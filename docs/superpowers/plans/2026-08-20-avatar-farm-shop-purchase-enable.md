# Avatar Farm Shop Purchase Enable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable listing, withdrawal, and full-listing market purchases for every current and future account through an explicit wildcard live-write policy while preserving all existing transaction safety guards.

**Architecture:** Extend `ShopPolicy.liveAccountAllowlist` from a numeric set to a typed numeric-set-or-`'all'` union parsed from `SHOP_LIVE_ACCOUNT_ALLOWLIST`. Centralize entitlement evaluation inside `ShopCoordinator`, keep existing capability/snapshot/idempotency/automation gates unchanged, add an explicit confirmation before listing, and activate only read/write/purchase in the local runtime configuration.

**Tech Stack:** TypeScript, Node.js, Express, React 18, Vite, SQLite-backed shop transactions, GitNexus CLI/MCP.

**Spec:** `docs/superpowers/specs/2026-08-20-avatar-farm-shop-purchase-enable-design.md`

## Global Constraints

- Work on the current `main` checkout as previously authorized; do not create or switch branches.
- Do not stage, modify, or commit `AGENTS.md` or `CLAUDE.md`.
- Do not use TDD and do not create test files. Production code comes first; verification uses focused inline harnesses, builds, API/runtime state, and browser evidence.
- Before editing every existing function, method, class, or interface, run `gitnexus_impact({ target, direction: "upstream" })`. Report direct callers, affected processes, and risk. Stop and warn the user before editing if risk is HIGH or CRITICAL.
- Before every commit, stage only the task files, run `gitnexus_detect_changes({ scope: "staged" })`, inspect `git diff --cached --check`, and verify `AGENTS.md`/`CLAUDE.md` are not staged.
- Preserve numeric allowlist behavior. Only the exact trimmed value `*` means all accounts; mixed wildcard/list values are invalid.
- Keep `SHOP_SLOT_UNLOCK_ENABLED=false`, `SHOP_MARKET_REFRESH_ENABLED=false`, and `SHOP_PROTOCOL_DEBUG_ENABLED` unchanged/false.
- Never send a real shop write during automated verification. Browser acceptance may open a confirmation dialog but must cancel it unless the user gives separate action-time approval for a specific transaction.
- Never auto-stop AutoFarm or Macro. `OPERATION_CONFLICT` must occur before any cmd 103 write packet is sent.
- Never retry a shop transaction whose outcome is `unknown`.

### Task 1: Add the Typed Wildcard Configuration Contract

**Files:**
- Modify: `avatar-web/server/src/config.ts:7-50`
- Modify: `avatar-web/README.md:20-41`

**Interfaces:**
- Consumes: `NodeJS.ProcessEnv`, the existing `ShopPolicy` consumers, and the `SHOP_LIVE_ACCOUNT_ALLOWLIST` environment variable.
- Produces: `LiveAccountAllowlist = ReadonlySet<number> | 'all'` and a documented exact `*` wildcard contract.

- [ ] **Step 1: Run GitNexus impact analysis for the configuration symbols**

Run:

```text
gitnexus_impact({ target: "ShopPolicy", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "parseAccountAllowlist", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "loadConfig", direction: "upstream", repo: "learning-reverse" })
```

Expected: direct consumers include `SessionManager`, `AvatarSession`, `ShopCoordinator`, session route assembly, and server startup. Record the returned risk and update all d=1 dependents that TypeScript identifies. If any result is HIGH or CRITICAL, report it and wait for user confirmation before editing.

- [ ] **Step 2: Extend the policy type and parser in `config.ts`**

Add the exported union immediately above `ShopPolicy`, then change the policy field and parser return type:

```ts
export type LiveAccountAllowlist = ReadonlySet<number> | 'all';

export interface ShopPolicy {
  readEnabled: boolean;
  writeEnabled: boolean;
  purchaseEnabled: boolean;
  slotUnlockEnabled: boolean;
  marketRefreshEnabled: boolean;
  liveAccountAllowlist: LiveAccountAllowlist;
  protocolDebugEnabled: boolean;
}
```

Replace `parseAccountAllowlist()` with:

```ts
function parseAccountAllowlist(value: string | undefined): LiveAccountAllowlist {
  const raw = value?.trim();
  if (!raw) return new Set<number>();
  if (raw === '*') return 'all';
  if (raw.includes('*')) {
    throw new Error('SHOP_LIVE_ACCOUNT_ALLOWLIST không được trộn wildcard với account id');
  }
  const accountIds = raw.split(',').map((token) => {
    const normalized = token.trim();
    if (!/^[1-9]\d*$/.test(normalized)) {
      throw new Error(`SHOP_LIVE_ACCOUNT_ALLOWLIST chứa account id không hợp lệ: ${normalized || '(trống)'}`);
    }
    const accountId = Number(normalized);
    if (!Number.isSafeInteger(accountId)) {
      throw new Error(`SHOP_LIVE_ACCOUNT_ALLOWLIST chứa account id vượt giới hạn: ${normalized}`);
    }
    return accountId;
  });
  return new Set(accountIds);
}
```

Do not change the existing defaults in `SessionManager`; `new Set<number>()` remains a valid deny-all value of the union.

- [ ] **Step 3: Document every shop environment flag in `avatar-web/README.md`**

Extend the environment-variable table after `NODE_ENV` with these exact rows:

```markdown
| `SHOP_READ_ENABLED` | bật đọc và browse dữ liệu sạp; mặc định tắt |
| `SHOP_WRITE_ENABLED` | master gate cho đăng bán, rút hàng và các shop write; mặc định tắt |
| `SHOP_PURCHASE_ENABLED` | gate bổ sung cho mua listing; chỉ có hiệu lực khi write đã bật |
| `SHOP_SLOT_UNLOCK_ENABLED` | gate riêng cho mở slot; mặc định tắt |
| `SHOP_MARKET_REFRESH_ENABLED` | gate riêng cho refresh chợ trả phí; mặc định tắt |
| `SHOP_LIVE_ACCOUNT_ALLOWLIST` | ID account phân tách bằng dấu phẩy, hoặc `*` để cho phép mọi account; không được trộn hai dạng |
| `SHOP_PROTOCOL_DEBUG_ENABLED` | debug protocol chỉ ở non-production; mặc định tắt |
```

Add this warning immediately after the table:

```markdown
`SHOP_LIVE_ACCOUNT_ALLOWLIST=*` là quyền live-write toàn cục cho cả tài khoản thêm
mới. Chỉ dùng cùng các capability đã chủ động phê duyệt; wildcard không tự bật bất
kỳ capability nào.
```

- [ ] **Step 4: Verify parser behavior with an inline production-code harness**

Run from `avatar-web/server`:

```bash
npx tsx -e "import { loadConfig } from './src/config.ts'; const base={MASTER_KEY:Buffer.alloc(32).toString('base64'),INVITE_CODE:'verification-only'}; const policy=(value?:string)=>loadConfig({...base,SHOP_LIVE_ACCOUNT_ALLOWLIST:value}).shopPolicy.liveAccountAllowlist; const empty=policy(); if (!(empty instanceof Set) || empty.size!==0) throw new Error('empty allowlist failed'); const ids=policy(' 2, 5,2 '); if (!(ids instanceof Set) || !ids.has(2) || !ids.has(5) || ids.size!==2) throw new Error('numeric allowlist failed'); if (policy(' * ')!=='all') throw new Error('wildcard failed'); for (const invalid of ['*,2','2,*','0','-1','1.5','2,,5',String(Number.MAX_SAFE_INTEGER)+'0']) { let threw=false; try { policy(invalid); } catch { threw=true; } if (!threw) throw new Error('expected invalid: '+invalid); } console.log('shop allowlist config OK')"
```

Expected:

```text
shop allowlist config OK
```

- [ ] **Step 5: Run server typecheck**

Run:

```bash
cd avatar-web/server && npm run typecheck
```

Expected: TypeScript exits 0 with no errors. A failure in `ShopCoordinator` because `.has()` is no longer valid is expected to be resolved in Task 2, so do not commit Task 1 until Task 2's runtime narrowing is included if the compiler requires the tasks to land together.

- [ ] **Step 6: Commit the configuration contract and documentation**

Stage only:

```bash
git add avatar-web/server/src/config.ts avatar-web/README.md
```

Run:

```text
gitnexus_detect_changes({ scope: "staged", repo: "learning-reverse" })
```

Then verify and commit:

```bash
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(shop): support all-account live write scope"
```

Expected staged names are exactly `avatar-web/server/src/config.ts` and `avatar-web/README.md`. If Task 1 cannot typecheck independently due to the typed union, defer this commit and combine its files with Task 2 rather than weakening the type.

### Task 2: Enforce Wildcard Entitlement at the Shop Runtime Boundary

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts:203-219`
- Modify: `avatar-web/server/src/session/shopCoordinator.ts:1208-1218`
- Modify if required by typecheck only: `avatar-web/server/src/session/manager.ts:35-43`

**Interfaces:**
- Consumes: `ShopPolicy.liveAccountAllowlist` from Task 1.
- Produces: one authoritative `isLiveAccountAllowed()` decision used by both UI capabilities and `assertWriteAllowed()`.

- [ ] **Step 1: Run GitNexus impact analysis for every modified runtime symbol**

Run:

```text
gitnexus_impact({ target: "ShopCoordinator", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "assertWriteAllowed", direction: "upstream", repo: "learning-reverse" })
```

Expected: direct behavior affects all shop write entry points and the shop capability view. Report risk/direct callers. Stop for user confirmation if HIGH or CRITICAL.

- [ ] **Step 2: Add the centralized entitlement helper**

Add this private method near the existing capability assertions:

```ts
private isLiveAccountAllowed(): boolean {
  return this.policy.liveAccountAllowlist === 'all'
    || this.policy.liveAccountAllowlist.has(this.accountId);
}
```

This helper is the only new policy interpretation. Do not add wildcard checks in routes or React.

- [ ] **Step 3: Use the helper when constructing runtime capabilities**

Change the capability field in the constructor from the direct set lookup to:

```ts
liveAccountAllowed: this.isLiveAccountAllowed(),
```

Do not change the public `ShopCapabilities` shape; clients still receive a boolean.

- [ ] **Step 4: Use the same helper in `assertWriteAllowed()`**

Keep the existing capability checks, and replace only the direct set lookup:

```ts
private assertWriteAllowed(
  capability: 'writeEnabled' | 'purchaseEnabled' | 'slotUnlockEnabled' | 'marketRefreshEnabled',
): void {
  if (!this.policy.writeEnabled || !this.policy[capability]) {
    throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Capability giao dịch sạp chưa được bật');
  }
  if (!this.isLiveAccountAllowed()) {
    throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Tài khoản chưa thuộc allowlist giao dịch live');
  }
}
```

Do not alter `assertOnlineAndIdle()`, `assertNoAutomation()`, `purchaseListing()`, transaction scheduling, or reconciliation.

- [ ] **Step 5: Verify server compilation and builds**

Run:

```bash
cd avatar-web/server && npm run typecheck && npm run build
```

Expected: both commands exit 0. No `.has()` error remains for the union type.

- [ ] **Step 6: Commit the runtime entitlement change**

If Task 1 was already committed, stage only the coordinator (and manager only if it genuinely changed):

```bash
git add avatar-web/server/src/session/shopCoordinator.ts
```

If Task 1 was deferred for type consistency, stage the complete compile-safe unit:

```bash
git add avatar-web/server/src/config.ts avatar-web/server/src/session/shopCoordinator.ts avatar-web/README.md
```

Run:

```text
gitnexus_detect_changes({ scope: "staged", repo: "learning-reverse" })
```

Then verify and commit:

```bash
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(shop): allow explicit global live writes"
```

Expected: GitNexus reports only configuration-to-shop-runtime capability/write flows; no farm protocol decoder or AutoFarm symbols should change.

### Task 3: Require Explicit Confirmation Before Listing

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/ShopPanel.tsx:241-274`

**Interfaces:**
- Consumes: validated `itemId`, `quantity`, `price`, `itemName()`, and the existing listing request body.
- Produces: an explicit user confirmation gate before the listing POST; withdrawal and purchase confirmations remain unchanged.

- [ ] **Step 1: Run GitNexus impact analysis for `submitListing`**

Run:

```text
gitnexus_impact({ target: "submitListing", direction: "upstream", repo: "learning-reverse" })
```

Expected: impact is limited to `ShopPanel` form submission. Report risk/direct callers and stop for confirmation if HIGH or CRITICAL.

- [ ] **Step 2: Add confirmation after validation and before `submitWrite()`**

Insert this exact guard after the price-range validation block and before `const accepted = await submitWrite(...)`:

```ts
if (!window.confirm(
  `Đăng bán ${itemName(itemId)} × ${quantity} với giá ${price} xu?`,
)) return;
```

Do not change the purchase prompt:

```ts
`Mua toàn bộ listing ${itemName(listing.itemId)} × ${listing.quantity} giá ${listing.price} xu?`
```

- [ ] **Step 3: Build the web client**

Run:

```bash
cd avatar-web/web && npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Commit the UI confirmation**

Stage only:

```bash
git add avatar-web/web/src/accounts/panels/ShopPanel.tsx
```

Run:

```text
gitnexus_detect_changes({ scope: "staged", repo: "learning-reverse" })
```

Then verify and commit:

```bash
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(shop): confirm live listing writes"
```

Expected staged output contains only `avatar-web/web/src/accounts/panels/ShopPanel.tsx`.

### Task 4: Activate the Approved Local Runtime Policy

**Files:**
- Modify but do not commit: `avatar-web/server/.env:11`

**Interfaces:**
- Consumes: wildcard parsing and runtime entitlement from Tasks 1-2.
- Produces: local runtime capabilities for read, listing, withdrawal, and purchase across all accounts.

- [ ] **Step 1: Preserve secrets and edit only shop flags in `.env`**

Using `apply_patch`, make the shop section contain exactly these non-secret values while leaving every other line byte-for-byte unchanged:

```dotenv
SHOP_READ_ENABLED=true
SHOP_WRITE_ENABLED=true
SHOP_PURCHASE_ENABLED=true
SHOP_LIVE_ACCOUNT_ALLOWLIST=*
SHOP_SLOT_UNLOCK_ENABLED=false
SHOP_MARKET_REFRESH_ENABLED=false
```

Do not print the complete `.env`. Verify only shop lines with:

```bash
rg -n '^SHOP_(READ|WRITE|PURCHASE|LIVE_ACCOUNT_ALLOWLIST|SLOT_UNLOCK|MARKET_REFRESH)_ENABLED|^SHOP_LIVE_ACCOUNT_ALLOWLIST' avatar-web/server/.env
```

Expected: the six approved values above. `.env` remains ignored and must not appear in `git status` or any commit.

- [ ] **Step 2: Restart the server without exposing credentials**

Identify the existing process listening on port 8787, stop only that process, and start the normal server command from `avatar-web/server`:

```bash
npm run dev
```

Expected: server starts successfully with no allowlist parse error. Keep the process available for browser acceptance. Do not print `.env` or process environment.

- [ ] **Step 3: Verify capability state through the authenticated UI/API**

For at least two owned accounts, inspect the shop response or the account detail UI and verify:

```json
{
  "readEnabled": true,
  "writeEnabled": true,
  "purchaseEnabled": true,
  "slotUnlockEnabled": false,
  "marketRefreshEnabled": false,
  "liveAccountAllowed": true
}
```

Expected: both accounts receive identical entitlement regardless of numeric ID. Do not infer wildcard behavior only from the account 2 page.

- [ ] **Step 4: Verify `OPERATION_CONFLICT` remains fail-closed**

On an account where AutoFarm or Macro is already running, open a write confirmation and proceed only if the action can be rejected before packet send without spending currency or changing inventory. Prefer a listing form with no final confirmation if runtime evidence can instead be obtained from an already observed conflict or a direct guarded request.

Expected:

```text
OPERATION_CONFLICT: AutoFarm hoặc Macro đang chạy
```

Also inspect server traffic/logs to confirm no cmd 103 write subtype was sent for the rejected request. Do not stop automation automatically.

- [ ] **Step 5: Verify browser enablement without completing a live write**

Using the signed-in browser session:

1. Open an online, idle account detail page.
2. Browse a market item with at least one listing.
3. Confirm `Mua toàn bộ` is enabled.
4. Click it and verify the dialog includes item name, entire quantity, and price.
5. Cancel the dialog.
6. Open the listing form, enter valid values, submit, verify the new listing confirmation, and cancel.
7. Confirm unlock-slot and paid-refresh controls remain disabled.

Expected: listing/withdraw/purchase controls follow online/idle/capability state, both destructive confirmations are visible, and no transaction row, xu balance, inventory quantity, or listing state changes because both confirmations are canceled.

- [ ] **Step 6: Run the full non-test verification suite**

Run:

```bash
cd avatar-web/server && npm run typecheck && npm run build
cd ../web && npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Run final GitNexus and Git scope checks**

Run:

```text
gitnexus_detect_changes({ scope: "compare", base_ref: "d37e68c", repo: "learning-reverse" })
```

Then run:

```bash
git status --short
git diff --check
git log --oneline d37e68c..HEAD
```

Expected:

- Changed production scope is limited to `config.ts`, `shopCoordinator.ts`, `ShopPanel.tsx`, and `avatar-web/README.md`.
- `.env` is absent because it is ignored.
- `AGENTS.md` and `CLAUDE.md` remain unstaged user changes.
- GitNexus reports only expected configuration, shop entitlement, and UI submission flows.

- [ ] **Step 8: Update the plan checkboxes and commit plan closure**

Mark every completed implementation/verification checkbox in this plan as `- [x]`. Stage only this plan, run staged GitNexus detection, and commit:

```bash
git add docs/superpowers/plans/2026-08-20-avatar-farm-shop-purchase-enable.md
git diff --cached --check
git diff --cached --name-only
git commit -m "docs(shop): close purchase enablement plan"
```

Expected: the closure commit contains only the plan file. Do not stage `AGENTS.md`, `CLAUDE.md`, or `.env`.

## Completion Handoff

Report:

- commit IDs created by Tasks 1-3 and plan closure;
- GitNexus risk/detect-change summaries;
- exact build command outcomes;
- current enabled/disabled capability matrix;
- browser evidence that `Mua toàn bộ` and listing confirmation are available but canceled;
- evidence that `OPERATION_CONFLICT` sends no shop write packet;
- confirmation that no xu, inventory, or listing data changed during acceptance;
- confirmation that `AGENTS.md` and `CLAUDE.md` were not staged or committed.
