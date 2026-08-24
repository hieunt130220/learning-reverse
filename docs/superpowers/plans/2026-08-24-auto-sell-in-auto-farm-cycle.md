# Auto Sell In AutoFarm Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chạy toàn bộ pha thu dọn rồi đăng bán của sạp đúng một lần trong mỗi vòng AutoFarm, không còn gate rules rỗng hoặc throttle 10 phút riêng.

**Architecture:** `AutoFarm.runCycle()` trở thành nguồn nhịp duy nhất cho pha sạp và luôn truyền `cfg.autoSellRules ?? []` khi Auto Sell bật. `AvatarSession` chỉ cấp `runId` rồi chuyển việc sang `ShopCoordinator`; UI bỏ điều khiển chu kỳ nhưng vẫn round-trip field legacy để tương thích config cũ.

**Tech Stack:** TypeScript, Node.js, `EventEmitter`, React, Vite, Vitest, Node test runner, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-24-auto-sell-collect-without-rules-design.md`

## Global Constraints

- Đọc toàn bộ Spec trước khi thực thi và giữ thứ tự cleanup trước listing của `ShopCoordinator.runAutoSellCycle()`.
- Checkout hiện tại có thể đang được backend `tsx watch` nối game thật theo dõi. Trước production edit, dùng `superpowers:using-git-worktrees` để tạo worktree cô lập nếu process đó còn chạy; không sửa source đang được live process theo dõi.
- Không tự dừng/restart backend, bật/tắt AutoFarm hoặc phát cmd 103. Live acceptance cần xác nhận riêng tại thời điểm thực hiện.
- Không dùng TDD và không tạo/sửa test file vì người dùng không yêu cầu test. Chỉ chạy test hiện có sau production code.
- Giữ `autoSellIntervalMs` trong parser, DTO, JSON config và draft/save round-trip để tương thích; field này không được dùng làm runtime gate hoặc hiển thị trên UI.
- Không đổi API, SQLite schema, wire protocol, `AutoSellCycleResult`, `AutoFarmOptions.runAutoSellCycle` hoặc primitive giao dịch của `ShopCoordinator`.
- Trước khi sửa mỗi symbol, chạy `gitnexus_impact` theo hướng upstream. Nếu kết quả mới là HIGH/CRITICAL, báo người dùng và dừng trước edit.
- Với `AutoFarm.runCycle`, target tên ngắn bị trùng với `MacroRunner.runCycle`; dùng exact UID/context theo file và không lấy kết quả symbol nhầm làm bằng chứng.
- Trước mọi commit, chạy `gitnexus_detect_changes({ scope: "all" })`. Không commit nếu người dùng chưa yêu cầu rõ ràng.
- Giữ nguyên `AGENTS.md`, `CLAUDE.md`, `.superpowers/brainstorm/9319-1787535780/` và mọi dirty work không thuộc task.

---

### Task 1: Chạy pha sạp trong mỗi vòng AutoFarm

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1262-1286`
- Modify: `avatar-web/server/src/session/avatarSession.ts:162,494-523`

**Interfaces:**
- Consumes: `AutoFarmConfig.autoSellProduce?: boolean`, `AutoFarmConfig.autoSellRules?: AutoSellRule[]`, `AutoFarmOptions.runAutoSellCycle(rules, shouldStop): Promise<AutoSellCycleResult>`.
- Produces: cùng interface callback hiện có, nhưng được gọi đúng một lần mỗi vòng AutoFarm khi `autoSellProduce` bật; `AvatarSession` tạo một `runId` cho mỗi lần gọi mà không kiểm tra `autoSellIntervalMs`.

- [x] **Step 1: Xác nhận workspace an toàn và impact trước khi sửa**

Kiểm tra process chỉ đọc:

```bash
pgrep -fl "tsx watch.*avatar-web/server|tsx watch.*src/index.ts"
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

Nếu process đang theo dõi checkout hiện tại, tạo worktree cô lập bằng skill `superpowers:using-git-worktrees` trước khi tiếp tục. Sau đó chạy GitNexus:

```text
gitnexus_context({ name: "AutoFarm.runCycle" })
gitnexus_impact({ target: "Method:avatar-web/server/src/autoFarm.ts:AutoFarm.runCycle#0", direction: "upstream" })
gitnexus_context({ name: "AvatarSession.connect" })
gitnexus_impact({ target: "Method:avatar-web/server/src/session/avatarSession.ts:AvatarSession.connect#0", direction: "upstream" })
```

Expected: exact context trỏ vào hai file trên; không có cảnh báo HIGH/CRITICAL chưa được xử lý. Nếu GitNexus không nhận UID, chạy impact cấp class `AutoFarm`/`AvatarSession`, rồi dùng exact context/Cypher theo `filePath` để ghi nhận direct callers trước edit.

- [x] **Step 2: Nới gate và chuẩn hóa rules trong `AutoFarm.runCycle()`**

Thay riêng điều kiện và đối số callback, giữ nguyên log, summary, `catch` và `await tick()`:

```ts
if (cfg.autoSellProduce && this.options.runAutoSellCycle) {
  note('[sạp tự động] bắt đầu kiểm tra sạp...');
  try {
    const result = await this.options.runAutoSellCycle(
      cfg.autoSellRules ?? [],
      () => this.aborted,
    );
    if (result.collectedSoldSlots > 0 || result.withdrawnExpiredSlots > 0) {
      note(
        `[sạp tự động] đã thu tiền ${result.collectedSoldSlots} ô đã bán, `
          + `rút hàng ${result.withdrawnExpiredSlots} ô hết hạn`,
      );
    }
    note(`[sạp tự động] hoàn thành: đã đăng ${result.listedLots} lô. Lý do dừng: ${result.stopReason}`);
    for (const r of result.rules) {
      if (r.listedLots > 0) {
        note(`  - Nông sản #${r.itemId}: đăng ${r.listedLots} lô (${r.listedQuantity} sản phẩm)`);
      }
      if (r.skippedReason) {
        note(`  - Nông sản #${r.itemId}: bỏ qua (${r.skippedReason})`);
      }
    }
  } catch (err) {
    note(`[sạp tự động] gặp lỗi: ${(err as Error).message}`);
  }
  await tick(); // Nhịp nghỉ sau khi chạy Auto Sell
}
```

Không thêm timer, scheduler hoặc lần gọi callback thứ hai.

- [x] **Step 3: Xóa throttle 10 phút khỏi `AvatarSession`**

Xóa field:

```ts
private lastAutoSellAt = 0;
```

Thay callback hiện tại bằng:

```ts
runAutoSellCycle: async (rules, shouldStop) => {
  this.autoSellRunSequence += 1;
  const runId = `${this.onlineEpoch ?? 0}-${this.autoSellRunSequence}`;
  const coordinator = this.requireShop();
  return await coordinator.runAutoSellCycle(rules, runId, shouldStop);
},
```

Không xóa `this.now` khỏi session vì retry, metrics và các flow khác vẫn dùng nó.

- [x] **Step 4: Kiểm tra source contract của server**

Run:

```bash
rg -n "lastAutoSellAt|Chưa đến chu kỳ kiểm tra" avatar-web/server/src/session/avatarSession.ts
```

Expected: không có kết quả.

Run:

```bash
rg -n "autoSellRules.length > 0|runAutoSellCycle\(cfg.autoSellRules" avatar-web/server/src/autoFarm.ts
```

Expected: không còn gate rules-length hay callback nhận trực tiếp mảng có thể `undefined`.

Run:

```bash
rg -n "cfg.autoSellRules \?\? \[\]|runAutoSellCycle" avatar-web/server/src/autoFarm.ts avatar-web/server/src/session/avatarSession.ts
```

Expected: một call site trong `AutoFarm.runCycle()` dùng `cfg.autoSellRules ?? []`; callback session chuyển thẳng sang coordinator.

- [x] **Step 5: Verify server sau production code**

Run trong `avatar-web/server`:

```bash
npm run typecheck
```

Expected: exit code 0, không có TypeScript error.

```bash
npm test
```

Expected: toàn bộ Node test hiện có pass, không có failed test.

```bash
npm run build
```

Expected: `tsc` và bước copy schema hoàn tất với exit code 0.

- [x] **Step 6: Commit chỉ khi người dùng yêu cầu rõ ràng**

Trước commit phải hoàn thành Task 3 và chạy `gitnexus_detect_changes`. Khi đã có quyền commit:

```bash
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/session/avatarSession.ts
git commit -m "fix: run shop actions with every auto farm cycle"
```

Nếu chưa có yêu cầu commit, để step này chưa tích và tiếp tục verification.

---

### Task 2: Bỏ điều khiển chu kỳ 10 phút khỏi UI

**Files:**
- Modify: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx:1-38,135-170`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:545-563`

**Interfaces:**
- Consumes: `autoSellProduce`, `autoSellRules`, price rules, produce items và `onChange` hiện có của editor.
- Produces: `AutoSellRulesEditorProps` không còn prop/patch `autoSellIntervalMs`; `AutoFarmPanel` vẫn giữ state và save round-trip legacy bên ngoài editor.

- [x] **Step 1: Chạy impact cho hai component trước khi sửa**

```text
gitnexus_context({ name: "AutoSellRulesEditor" })
gitnexus_impact({ target: "AutoSellRulesEditor", direction: "upstream" })
gitnexus_context({ name: "AutoFarmPanel" })
gitnexus_impact({ target: "AutoFarmPanel", direction: "upstream" })
```

Expected: parent trực tiếp của editor là `AutoFarmPanel`; không có cảnh báo HIGH/CRITICAL chưa được xử lý.

- [x] **Step 2: Thu hẹp contract của `AutoSellRulesEditor`**

Đổi import và props thành:

```tsx
import { useMemo, useState } from 'react';

export interface AutoSellRulesEditorProps {
  autoSellProduce: boolean;
  autoSellRules: AutoSellRuleDto[];
  priceRules: ShopPriceRule[];
  produceItems: { id: number; num: number }[];
  nameById: Map<number, string>;
  disabled?: boolean;
  onChange(patch: {
    autoSellProduce?: boolean;
    autoSellRules?: AutoSellRuleDto[];
  }): void;
}
```

Xóa `autoSellIntervalMs` khỏi destructuring. Xóa toàn bộ
`intervalMinutesInput`, effect đồng bộ interval và `handleIntervalChange`.

- [x] **Step 3: Xóa control interval khỏi JSX**

Phần đầu editor sau thay đổi phải có cấu trúc:

```tsx
<div className="auto-sell-header-controls">
  <label className="auto-sell-checkbox-label">
    <input
      type="checkbox"
      checked={autoSellProduce}
      disabled={disabled}
      onChange={(event) => onChange({ autoSellProduce: event.target.checked })}
    />
    <span>Tự động bán trên sạp</span>
  </label>
</div>
```

Không render label “Chu kỳ kiểm tra”, input phút hoặc giá trị 10 phút. Giữ CSS legacy ngoài scope để patch không lan sang stylesheet dùng chung.

- [x] **Step 4: Cập nhật call site trong `AutoFarmPanel`**

Call site cuối cùng phải là:

```tsx
<AutoSellRulesEditor
  autoSellProduce={draftAutoSellProduce}
  autoSellRules={draftAutoSellRules}
  priceRules={shop?.priceRules?.data ?? []}
  produceItems={produce?.items ?? []}
  nameById={nameById}
  disabled={!configReady || saving}
  onChange={(patch) => {
    if (patch.autoSellProduce !== undefined) setDraftAutoSellProduce(patch.autoSellProduce);
    if (patch.autoSellRules !== undefined) setDraftAutoSellRules(patch.autoSellRules);
    setPlanNotice('');
    setPlanError('');
    setConflict(null);
  }}
/>
```

Không sửa các dòng hydrate, dirty comparison, request payload và saved-state merge của `draftAutoSellIntervalMs`; chúng giữ field legacy không đổi khi lưu config.

- [x] **Step 5: Kiểm tra source contract của UI**

Run:

```bash
rg -n "autoSellIntervalMs|Chu kỳ kiểm tra|intervalMinutesInput|handleIntervalChange|useEffect" avatar-web/web/src/accounts/AutoSellRulesEditor.tsx
```

Expected: không có kết quả.

Run:

```bash
sed -n '545,563p' avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
```

Expected: editor không nhận/trả interval; các patch boolean và rules vẫn được xử lý.

Run:

```bash
rg -n "draftAutoSellIntervalMs|autoSellIntervalMs" avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
```

Expected: field legacy vẫn xuất hiện ở hydrate, dirty comparison, save và saved-state merge, nhưng không xuất hiện trong props/onChange của editor.

- [x] **Step 6: Verify web sau production code**

Run trong `avatar-web/web`:

```bash
npm test
```

Expected: toàn bộ Vitest hiện có pass, gồm round-trip config cũ trong `AutoFarmPanel.test.tsx`.

```bash
npm run build
```

Expected: TypeScript project build và Vite build hoàn tất với exit code 0.

- [x] **Step 7: Commit chỉ khi người dùng yêu cầu rõ ràng**

Trước commit phải hoàn thành Task 3 và chạy `gitnexus_detect_changes`. Khi đã có quyền commit:

```bash
git add avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
git commit -m "fix: remove separate auto sell interval control"
```

Nếu chưa có yêu cầu commit, để step này chưa tích và tiếp tục verification.

---

### Task 3: Verification tích hợp và kiểm tra phạm vi

**Files:**
- Inspect: `avatar-web/server/src/autoFarm.ts`
- Inspect: `avatar-web/server/src/session/avatarSession.ts`
- Inspect: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`
- Inspect: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Update checkboxes: `docs/superpowers/plans/2026-08-24-auto-sell-in-auto-farm-cycle.md`

**Interfaces:**
- Consumes: production changes từ Task 1 và Task 2.
- Produces: bằng chứng build/test/source contract/GitNexus đầy đủ mà không phát live game write.

- [x] **Step 1: Chạy lại toàn bộ verification ở HEAD làm việc**

Run riêng từng lệnh, không che exit code:

```bash
cd avatar-web/server
npm run typecheck
npm test
npm run build
```

Expected: ba lệnh đều exit 0 và không có failed test.

```bash
cd avatar-web/web
npm test
npm run build
```

Expected: hai lệnh đều exit 0 và không có failed test.

- [x] **Step 2: Chạy invariant checks không nối game thật**

Run từ repo root:

```bash
node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const farm=fs.readFileSync('avatar-web/server/src/autoFarm.ts','utf8'); const session=fs.readFileSync('avatar-web/server/src/session/avatarSession.ts','utf8'); const editor=fs.readFileSync('avatar-web/web/src/accounts/AutoSellRulesEditor.tsx','utf8'); assert.match(farm,/cfg\.autoSellRules \?\? \[\]/); assert.doesNotMatch(farm,/autoSellRules\.length > 0/); assert.doesNotMatch(session,/lastAutoSellAt|Chưa đến chu kỳ kiểm tra/); assert.doesNotMatch(editor,/autoSellIntervalMs|Chu kỳ kiểm tra/); console.log('auto-sell cycle invariants: ok');"
```

Expected: in đúng `auto-sell cycle invariants: ok` và exit 0. Đây là static harness; xác nhận live chỉ thực hiện ở Task 4.

- [x] **Step 3: Kiểm tra diff và dirty work**

```bash
git diff --check
git status --short
git diff -- avatar-web/server/src/autoFarm.ts avatar-web/server/src/session/avatarSession.ts avatar-web/web/src/accounts/AutoSellRulesEditor.tsx avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
```

Expected:

- `git diff --check` không có output;
- production diff chỉ gồm bốn file dự kiến;
- không có thay đổi tới API, schema, protocol, `shopCoordinator.ts`, test files hoặc unrelated dirty files.

- [x] **Step 4: Chạy GitNexus change detection**

```text
gitnexus_detect_changes({ scope: "all" })
```

Expected: thay đổi nằm trong flow AutoFarm/Auto Sell và UI config. Nếu index stale, kiểm tra `.gitnexus/meta.json`; chạy `npx gitnexus analyze --embeddings` khi `stats.embeddings > 0`, ngược lại chạy `npx gitnexus analyze`, rồi lặp lại detection. Không bỏ qua d=1 dependents hoặc cảnh báo HIGH/CRITICAL.

- [x] **Step 5: Xác minh UI ở chế độ đọc-only khi có frontend an toàn để mở**

Mở tài khoản, tab AutoFarm và phần “Tự động đưa nông sản lên sạp”; không bấm Lưu, không bật/tắt AutoFarm và không thao tác sạp.

Expected:

- còn checkbox “Tự động bán trên sạp” và editor rules;
- không còn “Chu kỳ kiểm tra”, input phút hoặc giá trị 10;
- config cũ có `autoSellIntervalMs` không gây lỗi render.

- [x] **Step 6: Cập nhật checklist và báo cáo bằng chứng**

Dùng `apply_patch` đổi các step thực sự hoàn tất từ `- [ ]` sang `- [x]`. Giữ nguyên unchecked cho commit và live acceptance nếu chưa được phép. Báo chính xác test count/result, build result, files changed và mọi verification chưa chạy được.

---

### Task 4: Live acceptance có kiểm soát

**Files:**
- Read-only inspect: `avatar-web/server/data/avatar-web.db`
- No source modifications.

**Interfaces:**
- Consumes: bản production đã verify và tài khoản có `autoSellProduce = true`.
- Produces: bằng chứng pha sạp chạy ở vòng AutoFarm kế tiếp, không cần chờ 10 phút.

- [x] **Step 1: Xin xác nhận riêng trước live write/integration vào checkout đang được theo dõi**

Nêu rõ việc áp dụng/restart có thể khiến vòng AutoFarm kế tiếp gửi cmd 103 subtype 4 để thu slot hoặc đăng listing. Không tiếp tục nếu chưa có xác nhận tại thời điểm này.

- [x] **Step 2: Chụp trạng thái trước vòng bằng truy vấn read-only**

Ghi nhận config revision, `autoSellProduce`, rule count, own-shop revision/slot state và transaction count. Dùng `sqlite3 -readonly`; không sửa DB trực tiếp.

Expected: có baseline xác định slot `isSale`/`isTimeOut`, rules rỗng hoặc có dữ liệu và transaction trước khi chạy.

- [ ] **Step 3: Quan sát đúng một vòng AutoFarm**

Không bấm `Rút` hoặc thao tác sạp song song. Xác nhận log có một dòng bắt đầu pha sạp và một summary trong vòng AutoFarm kế tiếp, không chờ gate 600.000 ms.

Expected: callback sạp chạy đúng một lần trong vòng; rules rỗng không tạo listing, rules có dữ liệu chỉ listing sau cleanup.

- [ ] **Step 4: Đối chiếu hậu trạng thái và transaction**

Dùng API/browser read-only và `sqlite3 -readonly` để đối chiếu own-shop revision, slot và transaction `auto-sell-collect:*`/listing.

Expected: slot cũ không còn trạng thái đã bán/hết hạn khi withdraw được xác nhận. Nếu ACK/reconciliation không đủ bằng chứng, báo `unknown`/`uncertain-state`; không retry hoặc tự bấm lại.

- [x] **Step 5: Báo kết quả live trung thực**

Báo riêng kết quả static verification và live acceptance. Build pass không được mô tả là live acceptance; nếu Task 4 chưa được phép hoặc chưa có candidate phù hợp, giữ task chưa hoàn tất.
