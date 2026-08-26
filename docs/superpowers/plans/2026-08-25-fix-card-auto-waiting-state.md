# Fix Card "đang chờ" dù đã tắt auto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card tài khoản hiển thị đúng "đang tắt" sau khi dừng automation, bằng cách đồng bộ cờ `desiredConnected` ở server và đổi card sang dùng automation snapshot.

**Architecture:** Sửa gốc ở `AvatarSession.switchAutomationMode`: hai nhánh đưa automation về `off` (dừng chủ động và start-failed) gọi thêm `setWanted(false)` để `snapshot().desiredConnected` phản ánh đúng thực tế, đồng thời phát WS event `desired-connected` cho frontend. Phía web, `AccountCard` tính `autoActive` từ `runtime.automation` theo cùng công thức với `StatusPanel`, fallback legacy `desiredConnected` / `account.autoEnabled` cho dữ liệu cũ.

**Tech Stack:** TypeScript, Node.js (node:test + tsx) cho server; React + Vitest + Testing Library cho web.

**Spec:** `docs/superpowers/specs/2026-08-25-fix-card-auto-waiting-state-design.md`

## Global Constraints

- **Không đổi hành vi kết nối**: "Dừng tự động" vẫn giữ phiên game online nếu đang online; chỉ đồng bộ cờ trạng thái.
- Không đổi API contract, DB schema, hay format WS event (`desired-connected` boolean đã có sẵn handler ở `accountRuntime.ts:31` và `AccountsProvider.tsx:68`).
- Không TDD: viết production code trước, test bổ sung sau (theo quy định AGENTS.md).
- Server test: `node:test` + `assert/strict`, harness sẵn có trong `avatarSession.test.ts` (FakeClient/FakeAuto).
- Web test: Vitest + Testing Library, fixture `makeAccount`/`makeSnapshot` trong `web/src/test/fixtures.ts`.
- Commit message theo kiểu `fix:` / `test:` (khớp lịch sử repo).
- GitNexus: impact analysis đã thực hiện thủ công trong Spec (blast radius: `switchAutomationMode` — callers `startAuto`/`stopAuto`/`stopAutomation`/manager `switchAutomationMode`/bootstrap; risk LOW). Trước mỗi commit chạy `detect_changes` nếu tool khả dụng.

---

### Task 1: Server — đồng bộ `wanted` khi automation về `off`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:365-370` (nhánh dừng chủ động)
- Modify: `avatar-web/server/src/session/avatarSession.ts:413-417` (nhánh start-failed trong `catch`)

**Interfaces:**
- Consumes: `private setWanted(wanted: boolean)` (avatarSession.ts:283) — đã tồn tại, tự phát event `desired-connected`.
- Produces: `snapshot().desiredConnected === false` sau khi stop automation; không đổi chữ ký hàm nào.

- [ ] **Step 1: Thêm `setWanted(false)` vào nhánh dừng chủ động**

Tại `switchAutomationMode`, nhánh `intent.desiredMode === 'off'` (hiện tại):

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
if (intent.desiredMode === 'off') {
  this.transitionState = 'stable';
  this.emitAutomation();
  return 'active';
}
```

sửa thành:

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
if (intent.desiredMode === 'off') {
  this.setWanted(false);
  this.transitionState = 'stable';
  this.emitAutomation();
  return 'active';
}
```

- [ ] **Step 2: Thêm `setWanted(false)` vào nhánh start-failed**

Trong `catch` của `run()` (hiện tại):

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
this.desiredMode = 'off';
this.transitionState = 'stable';
this.emitAutomation();
return 'start-failed';
```

sửa thành:

```ts
if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
this.setWanted(false);
this.desiredMode = 'off';
this.transitionState = 'stable';
this.emitAutomation();
return 'start-failed';
```

- [ ] **Step 3: Verify — toàn bộ test server phải pass (không sửa test trong bước này)**

Run: `npm test` (workdir `avatar-web/server`)
Expected: tất cả test hiện có pass. Đặc biệt không làm fail: `'auto hoàn tất vòng thì ngắt game…'` (dòng 247), `'tắt auto trong lúc chờ…'` (dòng 266), `'nhận LOGIN_FAIL (-35)…'` (dòng 467).

- [ ] **Step 4: Commit**

`git commit -m "fix: đồng bộ desiredConnected về false khi dừng automation"`

---

### Task 2: Server test — assert `desiredConnected=false` sau `stopAutomation`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.test.ts` (thêm test mới sau test dòng 266-276; thêm 1 assert vào test dòng 266)

**Interfaces:**
- Consumes: harness `harness(creds, clientCfg)` sẵn có; `session.startAuto(cfg)`, `session.stopAutomation()`, `session.snapshot()`.
- Produces: regression test cho hành vi mới.

- [ ] **Step 1: Thêm assert vào test `'tắt auto trong lúc chờ thì hủy vòng đăng nhập kế tiếp'`**

Sau dòng `await flush();` (dòng 274) thêm:

```ts
assert.equal(h.session.snapshot().desiredConnected, false);
```

- [ ] **Step 2: Thêm test mới cho `stopAutomation` (đường đi mới, không qua `stop()`)**

Chèn ngay sau test ở Step 1:

```ts
test('stopAutomation tắt desiredConnected nhưng giữ kết nối game', async () => {
  const h = harness({ autoConfig: { intervalMs: 321 } });
  await h.session.startAuto({ intervalMs: 321 });
  assert.equal(h.session.snapshot().desiredConnected, true);
  assert.equal(h.session.status, 'online');

  await h.session.stopAutomation();

  assert.equal(h.session.snapshot().desiredConnected, false);
  assert.equal(h.session.snapshot().automation?.desiredMode, 'off');
  assert.equal(h.session.status, 'online', 'dừng automation không được ngắt kết nối game');
});
```

- [ ] **Step 3: Verify**

Run: `npm test` (workdir `avatar-web/server`)
Expected: test mới pass; toàn bộ suite pass.

- [ ] **Step 4: Commit**

`git commit -m "test: phủ desiredConnected=false khi stopAutomation"`

---

### Task 3: Web — `AccountCard` dùng automation snapshot

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx:24` (đổi `autoWanted` → `autoActive`)
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx:67` (dùng tên biến mới)

**Interfaces:**
- Consumes: `runtime.automation?: AutomationSnapshot` (`web/src/types.ts:370-377,412`); công thức `autoActive` tham chiếu `StatusPanel.tsx:36-40`.
- Produces: nhãn "Tự động" trên card: `vòng N` / `đang chờ` / `đang tắt`.

- [ ] **Step 1: Thay dòng 24**

```ts
const autoWanted = runtime?.desiredConnected ?? account.autoEnabled;
```

thành:

```ts
const automation = runtime?.automation;
const autoActive = automation
  ? automation.desiredMode !== 'off'
    || automation.activeMode !== 'off'
    || automation.transitionState === 'switching'
  : runtime
    ? runtime.desiredConnected
    : account.autoEnabled;
```

- [ ] **Step 2: Thay dòng 67**

```tsx
<span><small>Tự động</small><b>{runtime?.auto.running ? `vòng ${runtime.auto.cycle}` : autoWanted ? 'đang chờ' : 'đang tắt'}</b></span>
```

thành:

```tsx
<span><small>Tự động</small><b>{runtime?.auto.running ? `vòng ${runtime.auto.cycle}` : autoActive ? 'đang chờ' : 'đang tắt'}</b></span>
```

- [ ] **Step 3: Verify**

Run: `npm test` (workdir `avatar-web/web`)
Expected: toàn bộ test hiện có pass (test cũ dùng fixture `desiredConnected: true` không có `automation` → vẫn rơi vào nhánh legacy → "đang chờ" như trước).

- [ ] **Step 4: Commit**

`git commit -m "fix: card tài khoản dùng automation snapshot thay vì desiredConnected"`

---

### Task 4: Web test — card hiển thị theo automation snapshot

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountCard.test.tsx` (thêm helper + 3 test case mới)

**Interfaces:**
- Consumes: `makeAccount`, `makeSnapshot` từ `../test/fixtures.js`; type `AutomationSnapshot` từ `../../types.js` (import type).
- Produces: test hồi quy cho 3 nhánh của `autoActive`.

- [ ] **Step 1: Thêm helper fixture automation vào đầu file (sau import)**

```tsx
import type { AutomationSnapshot } from '../types.js';

function makeAutomation(overrides: Partial<AutomationSnapshot> = {}): AutomationSnapshot {
  return {
    desiredMode: 'off',
    activeMode: 'off',
    transitionState: 'stable',
    findNpcConfig: { revision: 0, config: { npcName: '' } },
    findNpcRuntime: { phase: 'idle', running: false, targetName: '', cursor: 0, total: 0, timeoutStreak: 0 },
    location: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Thêm 3 test case (cuối file)**

```tsx
test('automation off thì card hiển thị đang tắt dù desiredConnected còn true', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'online',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
      automation: makeAutomation(),
    }),
  }));
  expect(screen.getByText('đang tắt')).toBeInTheDocument();
  expect(screen.queryByText('đang chờ')).not.toBeInTheDocument();
});

test('automation desired auto_farm chưa chạy vòng thì hiển thị đang chờ', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'idle',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
      automation: makeAutomation({ desiredMode: 'auto_farm' }),
    }),
  }));
  expect(screen.getByText('đang chờ')).toBeInTheDocument();
});

test('không có automation thì giữ hành vi legacy theo desiredConnected', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'idle',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
    }),
  }));
  expect(screen.getByText('đang chờ')).toBeInTheDocument();
});
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/accounts/AccountCard.test.tsx` (workdir `avatar-web/web`)
Expected: 3 test mới pass; toàn bộ file pass.

- [ ] **Step 4: Commit**

`git commit -m "test: AccountCard hiển thị theo automation snapshot"`

---

### Task 5: Verification tổng

**Files:** không sửa — chỉ chạy kiểm chứng.

- [ ] **Step 1: Typecheck + test server**

Run: `npm run typecheck && npm test` (workdir `avatar-web/server`)
Expected: typecheck sạch, toàn bộ suite pass.

- [ ] **Step 2: Typecheck + test web**

Run: `npx tsc -b && npm test` (workdir `avatar-web/web`)
Expected: `tsc -b` sạch, toàn bộ vitest pass.

- [ ] **Step 3: Kiểm tra thủ công (nếu có môi trường chạy)**

1. Bật auto cho 1 tài khoản → card "đang chờ"/"vòng N".
2. Bấm "Dừng tự động" → panel `desired=off · active=off · chăm farm đang tắt`, card chuyển **"đang tắt"** ngay (không refresh).
3. Bật lại auto → card về "đang chờ".
4. Tài khoản `autoEnabled` còn lưu DB sau restart server → card vẫn "đang chờ" tới khi vào panel tắt.

- [ ] **Step 4: GitNexus detect_changes trước commit cuối (nếu tool khả dụng)**

Run: `node .gitnexus/run.cjs` hoặc MCP `detect_changes` nếu có.
Expected: thay đổi chỉ chạm `switchAutomationMode`, `AccountCard`, 2 file test.
