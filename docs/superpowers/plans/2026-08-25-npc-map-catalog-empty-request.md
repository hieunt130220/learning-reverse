# NPC Map Catalog Empty-Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended; not used here because inline execution was selected) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thử đúng caller native `LoadMap.doJoin` bằng cách gửi `REQUEST_CITY_MAP (-24)` với body rỗng và ghi nhận catalog live nếu server trả response.

**Architecture:** Sửa tối thiểu standalone probe: đổi phase/request/traffic assertion từ `-24 [0]` sang `-24 []`, giữ nguyên bounded decoder và redacted output, rồi chạy một invocation duy nhất.

**Tech Stack:** TypeScript, Node.js, `GameClient.sendRaw`, `Session` message event, npm/Node typecheck, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-empty-request-design.md`

## Global Constraints

- Chỉ sửa `avatar-web/server/src/tools/npc-map-probe.ts`; không sửa production client/service/catalog.
- Không gửi `-24 [0]` lại trong cùng invocation; request duy nhất là `client.sendRaw(-24, [])`.
- Không gửi `cmd 80`, `-23`, `-21`, command NPC, retry, reconnect hoặc sweep.
- Giữ decoder bounded, output redacted, không body/hex/credential/host/port/dialog text.
- Live run đúng account `2`, map `5`, area `7`; preflight localhost `:8787` phải refused.
- Không tạo test file, không commit/push khi user chưa yêu cầu.

---

### Task 1: Switch catalog request to the native empty-body candidate

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (`ProbePhase`, request line, traffic assertion/error text)

**Interfaces:**
- Consumes: existing `decodeCityMapCatalog`, `waitForCityMapCatalog`, phase-aware metadata.
- Produces: `catalog-empty` phase and exact `TX -24 len=0` contract.

- [ ] **Step 1: Run pre-change impact**

Run GitNexus impact upstream for `runProbe` and `assertExpectedTraffic` in repo
`learning-reverse`. Proceed only with LOW/MEDIUM risk and record d=1 callers;
stop for HIGH/CRITICAL.

- [ ] **Step 2: Change only the request contract**

Change the phase union from:

```ts
type ProbePhase = 'login' | 'park-context' | 'catalog';
```

to:

```ts
type ProbePhase = 'login' | 'park-context' | 'catalog-empty';
```

Change the assertion to `count('catalog-empty', 'TX', -24, 0) === 1` and send:

```ts
phase = 'catalog-empty';
const pending = waitForCityMapCatalog(client, abort.signal, 5_000);
client.sendRaw(-24, []);
const catalog = await pending;
```

Do not alter decoder, args, timeout, or any other command.

- [ ] **Step 3: Verify code and diff**

Run:

```bash
npm --prefix avatar-web/server run typecheck
git diff --check
```

Expected: both commands exit `0`; diff is limited to the probe and this
spec/plan.

### Task 2: Static scope and one live invocation

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-empty-request.md` (append live result)
- Do not modify: production evidence/catalog files

**Interfaces:**
- Consumes: switched probe from Task 1 and account 2 database row.
- Produces: redacted `catalog observed` or `catalog pending` result.

- [ ] **Step 1: Run scope/forbidden-output checks**

Run `git diff --check`, targeted `rg` for `sendRaw(-24`, `sendRaw(80`,
`sendRaw(-23`, `sendRaw(-21)`, `entry.hex`, password/token/body output, and
GitNexus `detect_changes(scope="all")`. Expected: only one new `sendRaw(-24, [])`,
risk LOW, no affected production process.

- [ ] **Step 2: Preflight**

From `avatar-web/server`, verify curl to `http://127.0.0.1:8787/api/auth/me`
is refused and `ps` shows no `npc-map-probe` process. Do not start Avatar Web.

- [ ] **Step 3: Run exactly once**

From `avatar-web/server`, run:

```bash
node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
  --account-id 2 --map 5 --area 7
```

Do not retry. Record only timestamp, redacted traffic/events, decode status and
the mapping classification in this plan; do not paste packet body.

- [ ] **Step 4: Classify**

Call the result `catalog observed` only when `TX -24 len=0`, `RX -24`, complete
decode and zero trailing bytes are all present. Otherwise record `catalog
pending`; do not create a production mapping or send a follow-up command.

## Rollback

Do not commit. Revert only the body/phase diff after reviewing `git diff` if the
candidate fails; preserve all unrelated dirty/untracked files.

#### Live attempt 2026-08-25T02:29:00.028Z UTC
- Preflight `127.0.0.1:8787` was refused and no prior `npc-map-probe` process was
  present.
- One exact invocation for account 2 / map 5 / area 7 exited after the catalog
  timeout.
- Positive traffic included login `RX -34 len178`, park-context `TX -1 len1`
  with `RX -1 len1`, and catalog-empty `TX -24 len0`.
- The only packet observed after the catalog request was `RX -61 len59`; no
  `RX -24` arrived, so there was no catalog decode and mapping remains
  unverified.
- Static native evidence places `-61` on a non-catalog handler path; it is not
  promoted to catalog evidence.
