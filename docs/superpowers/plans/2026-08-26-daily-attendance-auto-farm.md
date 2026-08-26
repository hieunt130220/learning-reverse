# Daily Attendance Auto Farm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse-engineer protocol điểm danh đăng nhập và, chỉ khi protocol được xác minh, chạy điểm danh best-effort sau mỗi login thành công trước khi bắt đầu farm automation.

**Architecture:** Chia triển khai thành hai phase có review gate: phase reverse truy từ `DailyRewardScr.IActionGetReward.perform` tới wire contract và xác minh bằng packet thật; phase production chỉ mở khi note reverse ghi `PRODUCTION GATE: PASS`. Production đặt serializer/decoder trong module game chuyên biệt, cung cấp `GameClient.claimDailyAttendance()`, rồi để `AvatarSession.onOnline` await bước này trước `resumeDesiredAutomation` trong khi giữ nguyên mọi epoch/generation/desired-mode guard.

**Tech Stack:** TypeScript, Node.js EventEmitter, custom binary `Message`/`Session`, Unity IL2CPP ARM64 tooling (`iladis.py`, `xrefs.py`, `pktsig.py`), Frida 17.17.x, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-26-daily-attendance-auto-farm-design.md`

## Global Constraints

- Điểm danh chạy sau `LOGIN_SUCESS (-34)` hợp lệ và settle trước farm automation.
- Gửi tối đa một request cho mỗi successful connection epoch; reconnect/login mới được gửi lại.
- Best-effort: success, already-claimed, rejection, timeout, unknown response và exception đều không chặn automation.
- Không retry trong cùng login epoch; không lưu ngày/múi giờ trong local state hoặc database.
- Server game là nguồn sự thật cho trạng thái “đã nhận hôm nay”.
- Không suy đoán command, subcommand, field width, payload hoặc success marker.
- Không dùng daily quest `cmd -87`, prefix `4`, làm attendance nếu packet thật không chứng minh.
- Không sửa `avatar-web/server/src/autoFarm.ts`; không thêm UI configuration.
- Không thực hiện TDD, không tạo hoặc sửa test file trừ khi user yêu cầu trực tiếp; test hiện có chỉ được chạy regression.
- Nếu Task 3 kết luận `PRODUCTION GATE: BLOCKED`, dừng plan tại đó và báo blocker; không thực hiện Tasks 4–8.
- Trước khi sửa bất kỳ function/class/method production nào, chạy GitNexus impact cho symbol đó. Nếu risk HIGH/CRITICAL, báo user và chờ xác nhận.
- Trước mỗi commit, chạy `gitnexus_detect_changes({ scope: "all" })`; xác nhận mọi d=1 dependent đã được xử lý.
- Không commit nếu user chưa yêu cầu; các step Commit dưới đây là checkpoint hướng dẫn và chỉ chạy khi đã có quyền commit rõ ràng.

---

## Phase 1 — Protocol Discovery

### Task 1: Truy static call path của Daily Reward

**Files:**
- Inspect: `avatar-re/il2cpp_out/dump.cs:271475-271476`
- Inspect: `avatar-re/il2cpp_out/dump.cs:278080-278169`
- Inspect: `avatar-re/il2cpp_out/script.json:357549-357636`
- Inspect: `avatar-re/il2cpp_out/stringliteral.json`
- Inspect: `avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so`
- Inspect: `avatar-re/tools/iladis.py`
- Inspect: `avatar-re/tools/xrefs.py`
- Inspect: `avatar-re/tools/pktsig.py`
- Create: `avatar-re/notes/daily-attendance.md`

**Interfaces:**
- Consumes: `DailyRewardScr.IActionGetReward.perform` at RVA `0x77B0C4`, `DailyRewardScr.setInfo(MyVector list, string time)`, `mResources.getRewardDailyLogin`, `mResources.RewardLogin`.
- Produces: static trace `DailyRewardScr.IActionGetReward.perform → exact service method → Message(command) → ordered writer calls → Session_ME.sendMessage`, plus RX/state-loading trace and candidate wire literals documented in `avatar-re/notes/daily-attendance.md`.

- [ ] **Step 1: Confirm symbols and addresses**

Run:

```bash
grep -nE 'DailyRewardScr|IActionGetReward|getRewardDailyLogin|RewardLogin' avatar-re/il2cpp_out/dump.cs
grep -nE 'DailyRewardScr|IActionGetReward' avatar-re/il2cpp_out/script.json
grep -niE 'daily.*reward|reward.*login|getRewardDailyLogin|RewardLogin' avatar-re/il2cpp_out/stringliteral.json
```

Expected: output includes `DailyRewardScr.IActionGetReward$$perform` at decimal address `7844036` (`0x77B0C4`) and the daily reward resource fields. Record exact output references in the note.

- [ ] **Step 2: Trace the claim action to the sender**

Use the repository Python/uv environment that already has Capstone; do not install dependencies implicitly. Run:

```bash
python avatar-re/tools/iladis.py 'DailyRewardScr.IActionGetReward$$perform' 160 --calls
python avatar-re/tools/iladis.py 0x77B0C4 160
python3 avatar-re/tools/xrefs.py 'DailyRewardScr\.IActionGetReward\$\$perform'
```

For every service method called by `perform`, run:

```bash
python avatar-re/tools/iladis.py '<exact-method-name-from-perform>' 220 --calls
python3 avatar-re/tools/pktsig.py '<exact-method-name-from-perform>'
```

Expected: an exact chain reaching `Message..ctor`, ordered `writeByte/writeShort/writeInt/writeUTF` calls, and `Session_ME.sendMessage`. If the chain cannot be resolved, write the unresolved call/RVA and mark static evidence incomplete rather than selecting a command candidate.

- [ ] **Step 3: Trace screen-open/state response path**

Run:

```bash
python3 avatar-re/tools/xrefs.py 'DailyRewardScr\$\$setInfo|DailyRewardScr\$\$switchToMe'
```

Disassemble each exact handler/caller found:

```bash
python avatar-re/tools/iladis.py '<exact-handler-or-caller>' 300 --calls
```

Expected: identify the request that loads daily reward state and the RX handler that calls `DailyRewardScr.setInfo`; record reader call order and widths. Do not assume it shares the claim command.

- [ ] **Step 4: Create the reverse note with static evidence**

Create `avatar-re/notes/daily-attendance.md` with these concrete sections:

```markdown
# Daily Attendance Protocol

## APK identity and artifacts
## UI and native symbols
## Claim TX static call path
## State-query TX static call path
## RX handler static call path
## Candidate wire contract — awaiting packet verification
## Capture matrix A–E
## Packet evidence
## Semantic result mapping
## Reward/state evidence
## Unresolved fields
## Production gate

PRODUCTION GATE: BLOCKED
Reason: packet matrix A–E has not yet verified claim success and already-claimed responses.
```

Populate every static section with exact methods, RVAs, command candidates, ordered field widths, and disassembly observations from Steps 1–3. Keep the gate blocked at this task.

- [ ] **Step 5: Review the static trace**

Verify manually:

- the trace starts at `DailyRewardScr.IActionGetReward.perform` rather than a broad opcode search;
- every command candidate has a direct native call-path citation;
- every TX/RX field lists the exact writer/reader method and width;
- uncertain branches are labeled uncertain;
- no daily quest assumption appears as evidence.

Expected: static leads are sufficient to filter packet captures but are not represented as verified production protocol.

- [ ] **Step 6: Commit checkpoint (only if authorized)**

Before commit, run `gitnexus_detect_changes({ scope: "all" })`, then:

```bash
git add avatar-re/notes/daily-attendance.md
git commit -m "docs: trace daily attendance protocol\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: commit contains only the reverse note.

### Task 2: Capture và correlate packet matrix A–E

**Files:**
- Inspect: `avatar-re/frida_scripts/parser.ts:83-153`
- Inspect: `avatar-re/frida_scripts/parser.ts:416-488`
- Inspect: `avatar-re/frida_scripts/opcodes.ts:1-220`
- Modify: `avatar-re/notes/daily-attendance.md`
- Generated locally: `avatar-re/frida_scripts/_parser.js` (không commit nếu đang ignored/generated)

**Interfaces:**
- Consumes: candidate command/action and field widths from Task 1; generic TX hook `Session_ME.sendMessage`, RX hook `Session_ME.onRecieveMsg`, raw command/payload hex logging.
- Produces: timestamped A–E packet evidence that distinguishes baseline login, state query, claim success, already-claimed state, and repeat-claim rejection/idempotency.

- [ ] **Step 1: Verify capture prerequisites**

Run:

```bash
adb devices
frida-ps -U
cd avatar-re/frida_scripts && npm run build:parser
```

Expected: one authorized Android device is listed, Frida can enumerate processes, and parser build exits 0. If Frida/frida-server are incompatible, align both to the documented 17.17.x series before capture.

- [ ] **Step 2: Start the generic parser without speculative schemas**

Run:

```bash
cd avatar-re/frida_scripts
frida -U -f com.TeaM.Avatar -l _parser.js
```

Expected: TX and RX logs include signed command IDs and complete raw payload hex. Do not use `agent.ts`, because it does not capture complete bodies and contains credential logging hooks.

- [ ] **Step 3: Capture case A — login baseline**

With an account not yet checked in today:

1. Record wall-clock start time.
2. Log in and wait for the session to stabilize.
3. Do not open the daily reward screen.
4. Save adjacent TX/RX commands and payloads for the stabilization window.
5. Mark login, keepalive and farm traffic as excluded noise.

Append to note: account state, timestamp range, raw relevant packets, and excluded command list.

Expected: baseline establishes which packets happen automatically after login and therefore cannot be attributed to opening/claiming attendance.

- [ ] **Step 4: Capture cases B and C — open and successful claim**

1. Record exact time immediately before opening the daily reward screen.
2. Open the screen and save the new TX/RX sequence as case B.
3. Record visible reward/status before claim.
4. Record exact time immediately before pressing claim.
5. Press claim once and save the new TX/RX/dialog sequence as case C.
6. Record wallet/inventory/reward/status after claim.

Append exact command, payload hex, parser decode, UI action, and observable state delta to the note.

Expected: case B isolates state loading; case C isolates claim request and a success marker backed by server-visible reward/state change.

- [ ] **Step 5: Capture cases D and E — already claimed and repeat claim**

1. Close and reopen the daily reward screen; capture case D.
2. Record the server/UI marker that today is already claimed.
3. If UI or controlled raw request permits, send the exact verified claim request once more; capture case E.
4. Record whether the response is idempotent, already-claimed, or rejected.
5. Do not repeat beyond one controlled request.

Expected: a verified already-claimed semantic marker and rejection/idempotency path.

- [ ] **Step 6: Correlate static and dynamic evidence**

In `avatar-re/notes/daily-attendance.md`, replace candidate descriptions with tables containing:

```text
Direction | Command | Action/subcommand | Ordered fields | Payload hex | Case | Evidence
```

For every result status, cite both packet evidence and observable UI/state evidence. Redact credentials, auth tokens, device identifiers, and private account data; preserve command and protocol bytes required to reproduce decoding.

Expected: state query and claim are no longer inferred only by timing; their payloads match the static writer/reader chain or repeat consistently across at least two business states.

- [ ] **Step 7: Commit checkpoint (only if authorized)**

Before commit, run `gitnexus_detect_changes({ scope: "all" })`, then:

```bash
git add avatar-re/notes/daily-attendance.md
git commit -m "docs: verify daily attendance packets\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: commit contains redacted protocol evidence only, not raw credentials or generated parser bundles.

### Task 3: Decide the production gate

**Files:**
- Modify: `avatar-re/notes/daily-attendance.md`
- Inspect: `docs/superpowers/specs/2026-08-26-daily-attendance-auto-farm-design.md:56-107`

**Interfaces:**
- Consumes: static trace from Task 1 and packet matrix from Task 2.
- Produces: a literal `PRODUCTION GATE: PASS` or `PRODUCTION GATE: BLOCKED` decision that controls all remaining tasks.

- [ ] **Step 1: Check all gate facts**

Mark each of these in the note with an exact citation:

1. APK owner class and sending method.
2. Claim UI call path from `DailyRewardScr.IActionGetReward.perform`.
3. Request command literal.
4. Request action/subcommand literal, or evidence that none exists.
5. Ordered TX field sequence and widths.
6. RX command(s).
7. Ordered RX fields/widths or verified dialog-only contract.
8. Success marker.
9. Already-claimed marker.
10. Rejection/idempotency path.
11. Timestamps and payload hex for A–E.
12. Observable reward/server-state change.
13. Static/packet agreement, or repeatable packet evidence in two business states.

Expected: every item is either backed by a specific note section/packet or explicitly missing.

- [ ] **Step 2: Set the gate decision**

If all 13 facts are verified, replace the Production gate section with:

```markdown
PRODUCTION GATE: PASS

The claim TX contract and the claimed/already-claimed RX semantics are verified by the evidence cited above. Production code must use exactly these recorded command/action/field literals.
```

If any required fact is missing, use:

```markdown
PRODUCTION GATE: BLOCKED

Missing evidence:
- <list each missing numbered fact with the exact capture/static blocker>

Production Tasks 4–8 must not run.
```

The angle-bracket line is an instruction to write the actual missing facts observed in this execution; do not leave it literally in the note.

- [ ] **Step 3: Apply the gate**

Run:

```bash
grep -n 'PRODUCTION GATE:' avatar-re/notes/daily-attendance.md
```

Expected:

- `BLOCKED`: stop execution, report the exact missing evidence, and make no production edits.
- `PASS`: continue to Task 4 and copy only the verified literals from the note into code.

- [ ] **Step 4: Commit checkpoint (only if authorized)**

Before commit, run `gitnexus_detect_changes({ scope: "all" })`, then:

```bash
git add avatar-re/notes/daily-attendance.md
git commit -m "docs: decide attendance production gate\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: the committed note contains one unambiguous gate decision and no placeholders.

---

## Phase 2 — Production Integration (Only When Gate Is PASS)

### Task 4: Encode verified protocol in reverse tooling

**Files:**
- Modify: `avatar-re/frida_scripts/opcodes.ts:1-220` only if the verified opcode lacks an accurate name
- Modify: `avatar-re/frida_scripts/parser.ts:83-153`
- Modify: `avatar-re/notes/daily-attendance.md` only to record replay verification

**Interfaces:**
- Consumes: exact command/action/field literals and layouts from the PASS note.
- Produces: parser schemas that decode the verified attendance TX/RX while preserving raw hex fallback and broad shared-opcode semantics.

- [ ] **Step 1: Run impact before editing parser symbols**

Run GitNexus impact upstream for the exact `CMD`, `SCHEMAS`, and `SCHEMAS_RX` symbols returned by context/search. Report risk and stop for user approval if HIGH/CRITICAL.

Expected: blast radius is known before edits.

- [ ] **Step 2: Add the verified opcode label without destroying shared meanings**

If the command is absent, add its verified attendance name to `CMD`. If it is a shared container opcode, retain existing names and append the attendance semantic rather than replacing other meanings.

Code rule:

```ts
[VERIFIED_COMMAND_FROM_NOTE]: 'EXISTING_NAME|DAILY_ATTENDANCE',
```

During execution, replace `VERIFIED_COMMAND_FROM_NOTE` and `EXISTING_NAME` with the literal number and current map value from the PASS note/source; these tokens must not remain in committed code.

- [ ] **Step 3: Add exact TX/RX schemas**

Add the verified field sequence to `SCHEMAS` and `SCHEMAS_RX` using the parser’s existing field DSL. If the command is shared, branch on the verified action byte instead of decoding all payloads as attendance. If RX has dynamic counts/strings, add a focused decoder that bounds every count by remaining payload length.

Acceptance criteria:

- schema order exactly matches the PASS note;
- every width matches native writer/reader evidence;
- unknown trailing bytes remain visible in raw hex;
- unrelated subcommands still decode through their existing path.

- [ ] **Step 4: Build and replay cases C/D**

Run:

```bash
cd avatar-re/frida_scripts
npm run build:parser
frida -U -f com.TeaM.Avatar -l _parser.js
```

Expected: successful claim and already-claimed packets decode into the documented fields with no unexplained trailing bytes except fields explicitly listed as unresolved in the note.

- [ ] **Step 5: Record replay evidence**

Append parser output summaries for cases C and D to the note. Do not include credentials or complete private payload fields.

- [ ] **Step 6: Commit checkpoint (only if authorized)**

Run `gitnexus_detect_changes({ scope: "all" })`, verify only reverse tooling/note flows are affected, then:

```bash
git add avatar-re/frida_scripts/opcodes.ts avatar-re/frida_scripts/parser.ts avatar-re/notes/daily-attendance.md
git commit -m "feat: decode daily attendance packets\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Add typed attendance protocol module

**Files:**
- Create: `avatar-web/server/src/game/dailyAttendance.ts`
- Modify: `avatar-web/server/src/game/client.ts:143-267`
- Inspect: exact service owner and wire contract in `avatar-re/notes/daily-attendance.md`

**Interfaces:**
- Consumes: verified command/action/field literals from the PASS note; `Session`, `Message`, and reader/writer idioms used by existing game services.
- Produces:
  - `DailyAttendanceService` with verified state/claim send methods;
  - `DailyAttendanceResult` union;
  - pure decoder functions for the verified RX payload(s);
  - `GameClient` ownership of `readonly dailyAttendance: DailyAttendanceService`.

- [ ] **Step 1: Run impact analysis before production edits**

Run GitNexus impact upstream for `GameClient` and for each existing service/decoder symbol whose behavior will be reused or modified. If HIGH/CRITICAL, report blast radius and wait for approval.

Expected: all production symbols to be edited have a recorded impact result.

- [ ] **Step 2: Define the typed semantic contract**

Create `avatar-web/server/src/game/dailyAttendance.ts` with:

```ts
export type DailyAttendanceResult =
  | { status: 'claimed'; rewardSummary?: string }
  | { status: 'already-claimed' }
  | { status: 'rejected'; reason?: string }
  | { status: 'timeout' }
  | { status: 'unknown-response'; command: number; payloadHex: string };
```

Also export a typed decoded-response union whose variants exactly mirror the verified RX statuses in the PASS note. Do not expose speculative reward fields; derive `rewardSummary` only from fields whose meaning is verified.

- [ ] **Step 3: Implement pure bounded decoders**

Implement one pure decoder per verified RX payload in `dailyAttendance.ts`. Each decoder must:

- accept `Buffer`;
- consume fields in the exact order/width from the note;
- reject truncation before each read;
- map only verified status/action values;
- preserve command and payload hex for an attendance-owned but unknown status;
- never log from the decoder.

Use named constants with comments citing `avatar-re/notes/daily-attendance.md`; do not leave raw unexplained numeric literals scattered across branches.

- [ ] **Step 4: Implement `DailyAttendanceService` serializer**

In `dailyAttendance.ts`, add:

```ts
export class DailyAttendanceService {
  constructor(private readonly session: Session) {}

  requestState(): void;
  claim(): void;
}
```

If the verified protocol has one combined request, expose only `claim(): void` and omit `requestState`. Each body must use `Message.create(<verified command>)`, the exact ordered writer chain from the note, and `this.session.send(message)`. Do not expose generic `fields: unknown[]` or use `GameClient.sendRaw` in production.

- [ ] **Step 5: Wire service ownership into `GameClient`**

Import the new module and add:

```ts
readonly dailyAttendance = new DailyAttendanceService(this.session);
```

Place it beside existing service ownership fields. The focused module name remains stable even if the APK’s native owner is a broad global service; cite that native owner in the serializer comment.

- [ ] **Step 6: Verify production compile**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
```

Expected: both commands exit 0; no test file is created or modified.

- [ ] **Step 7: Inspect serialized bytes against packet evidence**

Use the existing traffic/raw logging path in a controlled run and compare the emitted attendance request byte-for-byte with case B/C from the note.

Expected: command, action and body hex match the verified client packet; any account-specific fields differ only where documented.

- [ ] **Step 8: Commit checkpoint (only if authorized)**

Run `gitnexus_detect_changes({ scope: "all" })`, verify all d=1 dependents, then:

```bash
git add avatar-web/server/src/game/dailyAttendance.ts avatar-web/server/src/game/client.ts
git commit -m "feat: add daily attendance protocol client\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: Add `GameClient.claimDailyAttendance`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:269-288`
- Modify: `avatar-web/server/src/game/client.ts:470-535`
- Modify: `avatar-web/server/src/game/client.ts:670-1226`
- Consume: `avatar-web/server/src/game/dailyAttendance.ts`

**Interfaces:**
- Consumes: `DailyAttendanceService`, pure decoders, `DailyAttendanceResult`, verified RX command/action markers.
- Produces: `claimDailyAttendance(options?: { timeoutMs?: number }): Promise<DailyAttendanceResult>` and, when appropriate, a dedicated internal semantic event emitted by `onMessage`.

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact upstream for `GameClient.claimDailyAttendance` if indexed after Task 5, otherwise `GameClient`, plus `GameClient.onMessage`. Report risk; wait if HIGH/CRITICAL.

- [ ] **Step 2: Add verified RX decoding boundary**

In `GameClient.onMessage`, add a case for the verified attendance RX command only if it has a dedicated/structured response. Decode with the pure function and emit a dedicated internal event such as `daily-attendance-response`.

If attendance uses a shared command, preserve the existing branch and dispatch by the verified action/status byte; unrelated actions must continue through their current decoder. If the protocol is verified dialog-only, do not add a fake structured branch—use the verified bounded dialog marker in Step 3.

- [ ] **Step 3: Implement the Promise API with one cleanup path**

Add:

```ts
claimDailyAttendance(
  options: { timeoutMs?: number } = {},
): Promise<DailyAttendanceResult>
```

Implementation requirements:

1. Use `options.timeoutMs ?? 2_500`.
2. If status is not `online`, return `{ status: 'rejected', reason: 'chưa đăng nhập' }` without sending.
3. Register semantic response, verified attendance dialog, session close, and timeout handlers before sending.
4. Use one idempotent `finish(result)` that clears the timer and removes every listener before resolving.
5. Send the verified state→claim sequence, or the single verified claim request.
6. Resolve `claimed`, `already-claimed`, or `rejected` from verified markers only.
7. Resolve `timeout` after the bounded timer; do not retry.
8. Resolve `unknown-response` only for a response proven to belong to this attendance request.
9. Never alter client status, automation state, or connection lifecycle.

Model cleanup on `waitForWorldSnapshot`, not `waitForReply`, because `waitForReply` does not remove its listener on success.

- [ ] **Step 4: Audit listener lifecycle manually**

Trace each terminal branch:

- claimed;
- already claimed;
- rejected/dialog;
- unknown attendance response;
- timeout;
- session close;
- synchronous send exception.

Expected: every path invokes `finish` once or catches send failure and invokes it; no timer/listener survives settlement.

- [ ] **Step 5: Verify compile and unchanged regression suite**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
npm test
```

Expected: typecheck/build pass and the existing test suite passes unchanged. If an existing test fails, investigate without adding/modifying tests unless user explicitly asks.

- [ ] **Step 6: Live verify semantic results**

On server real, invoke the API once for an unclaimed account and once after claim.

Expected:

- first call resolves `claimed` and produces one claim packet;
- second login call resolves `already-claimed` and produces no retry loop;
- controlled no-response resolves `timeout` after the configured bound.

- [ ] **Step 7: Commit checkpoint (only if authorized)**

Run `gitnexus_detect_changes({ scope: "all" })`, verify all d=1 dependents, then:

```bash
git add avatar-web/server/src/game/client.ts avatar-web/server/src/game/dailyAttendance.ts
git commit -m "feat: expose daily attendance result\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 7: Gate farm automation in `AvatarSession.onOnline`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:648-653`
- Modify: `avatar-web/server/src/session/avatarSession.ts:827-905`
- Inspect only: `avatar-web/server/src/session/avatarSession.test.ts:234-277`
- Inspect only: `avatar-web/server/src/session/avatarSession.test.ts:440-451`

**Interfaces:**
- Consumes: `GameClient.claimDailyAttendance(options?): Promise<DailyAttendanceResult>`.
- Produces: `runDailyAttendanceBeforeAutomation(client: GameClient, epoch: number): Promise<void>` and an `onOnline` sequence that resumes desired automation only after attendance settles.

- [ ] **Step 1: Run required impact analyses**

Run GitNexus impact upstream for:

- `AvatarSession.onOnline`;
- `AvatarSession.resumeDesiredAutomation`;
- `AvatarSession.pushLog` if modified;
- new `AvatarSession.runDailyAttendanceBeforeAutomation` after declaration if index supports it.

Report direct callers, affected processes and risk. If HIGH/CRITICAL, stop for user approval.

- [ ] **Step 2: Implement semantic logging helper**

Add:

```ts
private async runDailyAttendanceBeforeAutomation(
  client: GameClient,
  epoch: number,
): Promise<void>
```

Call `client.claimDailyAttendance()` exactly once. Map results to:

- `claimed`: `[điểm danh] nhận thưởng thành công` plus sanitized `rewardSummary` when present;
- `already-claimed`: `[điểm danh] hôm nay đã nhận thưởng`;
- `rejected`: `[điểm danh] server từ chối: <reason> — vẫn tiếp tục tự động`;
- `timeout`: `[điểm danh] hết thời gian chờ — vẫn tiếp tục tự động`;
- `unknown-response`: `[điểm danh] phản hồi chưa nhận diện (cmd <number>) — vẫn tiếp tục tự động`;
- exception: `[điểm danh] lỗi: <message> — vẫn tiếp tục tự động`.

Before each `pushLog`, require `this.isCurrent(client, epoch)` so stale clients cannot pollute the active session log. Never log `payloadHex`.

- [ ] **Step 3: Sequence attendance before automation**

Preserve the duplicate epoch guard, retry reset, and parallel farm-sync `setImmediate` block. Replace the direct `resumeDesiredAutomation` call with one async chain:

1. only start it when `pendingAutomationTransitions === 0`;
2. await `runDailyAttendanceBeforeAutomation(client, epoch)`;
3. re-check `isCurrent(client, epoch)`, `client.status === 'online'`, and `pendingAutomationTransitions === 0`;
4. call `resumeDesiredAutomation(client, epoch)`;
5. rely on `resumeDesiredAutomation` to re-check transition sequence, generation, active mode and desired mode.

Do not call `AutoFarm.start()` directly and do not let a bare `finally` revive canceled automation.

- [ ] **Step 4: Audit epoch and transition scenarios**

Inspect the code paths for:

- duplicate `online` event in the same epoch;
- reconnect producing a new epoch;
- logout-after-cycle then login;
- user switching desired mode to `off` while attendance waits;
- stale client disconnect while attendance waits;
- pending automation transition appearing during attendance.

Expected: at most one attendance call per epoch; no stale/canceled automation starts; a later legitimate epoch performs a new attendance call.

- [ ] **Step 5: Verify compile and existing tests**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
npm test
```

Expected: all commands pass without creating or modifying a test file.

- [ ] **Step 6: Commit checkpoint (only if authorized)**

Run `gitnexus_detect_changes({ scope: "all" })`, confirm expected session/client execution flows only, then:

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat: check in before farm automation\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 8: End-to-end verification and scope audit

**Files:**
- Inspect: `avatar-re/notes/daily-attendance.md`
- Inspect: `avatar-web/server/src/game/dailyAttendance.ts`
- Inspect: `avatar-web/server/src/game/client.ts`
- Inspect: `avatar-web/server/src/session/avatarSession.ts`
- Verify unchanged: `avatar-web/server/src/autoFarm.ts`
- Verify unchanged behavior: `avatar-web/server/src/game/farmService.ts:318-337`
- Modify: `docs/superpowers/plans/2026-08-26-daily-attendance-auto-farm.md` (checkboxes only)

**Interfaces:**
- Consumes: completed reverse and production phases.
- Produces: evidence that packet order, best-effort behavior, epoch semantics, regression constraints and GitNexus scope all match the spec.

- [ ] **Step 1: Run static verification**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
npm test
```

Expected: all exit 0. Report exact failures if any; do not claim completion on partial success.

- [ ] **Step 2: Verify no forbidden scope changes**

Run:

```bash
git diff -- avatar-web/server/src/autoFarm.ts
git diff -- avatar-web/server/src/game/farmService.ts
git diff -- avatar-web/web
```

Expected:

- no `autoFarm.ts` diff;
- daily quest `getDailyQuest/changeDailyQuest/claimDailyQuestReward/claimDailyQuestBox` remains behaviorally unchanged;
- no web UI diff;
- no test file diff unless separately authorized by user.

- [ ] **Step 3: Verify live unclaimed and ordering scenario**

Log in with an unclaimed account while capturing timestamps/packets.

Expected sequence:

```text
LOGIN_SUCESS
attendance state/claim request
claimed response or bounded timeout
first farm automation packet
```

Confirm one attendance request for the epoch and a semantic session log before farm automation starts.

- [ ] **Step 4: Verify already-claimed and reconnect scenarios**

1. Log in again after the successful claim.
2. Confirm `already-claimed` log and normal farm start.
3. Trigger one legitimate reconnect/new login epoch.
4. Confirm exactly one new attendance request.
5. Emit/observe duplicate online status in the same epoch if the existing debug harness permits; confirm no second request.

Expected: one request per epoch, no local daily cache, no retry loop.

- [ ] **Step 5: Verify best-effort failure scenarios**

Use a controlled debug timeout or withheld response, then one verified rejection/unknown response scenario.

Expected:

- timeout logs once and farm proceeds;
- rejection/unknown logs warning and farm proceeds;
- no payload hex appears in normal session logs;
- user disabling automation while attendance waits prevents farm startup after settlement.

- [ ] **Step 6: Run final GitNexus scope check**

Run:

```text
gitnexus_detect_changes({ scope: "all" })
```

Expected: changed symbols and affected flows are limited to attendance protocol handling, `GameClient`, and the login-to-automation transition. Review every d=1 dependent and document that it is updated or behaviorally compatible.

- [ ] **Step 7: Update plan checkboxes**

Mark only actually completed steps `- [x]`. If live capture or a failure scenario was skipped, leave it unchecked and report it explicitly.

- [ ] **Step 8: Final commit checkpoint (only if authorized)**

After the final `gitnexus_detect_changes` result is accepted:

```bash
git add docs/superpowers/plans/2026-08-26-daily-attendance-auto-farm.md
git commit -m "docs: complete daily attendance rollout\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: plan accurately records completed versus outstanding verification; no unverified claim is marked complete.
