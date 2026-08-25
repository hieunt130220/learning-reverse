# NPC Map Area Board-List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu thập live board/area catalog bằng native `cmd 90` trước khi xác nhận direct join account 2 / map 5 / area 7.

**Architecture:** Mở rộng standalone probe với phase `board-list`, waiter và decoder strict cho `RX 90`, sau đó giữ nguyên direct-join và passive `ItemMapSpecial` capture. Chỉ output evidence đã redacted; không thay đổi production catalog hay game state ngoài hai lệnh read-only đã được native chứng minh.

**Tech Stack:** TypeScript, Node.js `EventEmitter`, `GameClient`, `tsx`, npm server typecheck, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-area-board-list-design.md`

## Global Constraints

- Chỉ chạy một invocation account 2 / map 5 / area 7; không range, sweep, retry hoặc reconnect.
- Protocol mới duy nhất là `cmd 90` body một byte `[5]`; direct join giữ đúng `cmd 80` sáu byte đã live-verify.
- Không gửi `-24`, `-23`, `-21`, command NPC/combat/reward hoặc write command.
- Không in packet body/hex/credential/cookie/token/host/port; output chỉ metadata redacted.
- Không tạo hoặc bật `npcMapCatalog.ts` trước evidence complete; không tạo test file vì user chưa yêu cầu.
- Trước khi sửa symbol phải chạy `gitnexus_impact`; trước commit (nếu user yêu cầu) phải chạy `gitnexus_detect_changes`. Không commit trong bước probe này nếu chưa được yêu cầu.
- Preserve unrelated dirty/untracked files.

### Task 1: Thêm contract và decoder board-list

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `GameClient` raw traffic, existing probe phase and redacted error types.
- Produces: `ProbePhase` có `board-list`; `ParkBoardCatalogMetadata`; decoder strict `RX 90`.

- [x] **Step 1: Pre-edit impact**

  Chạy GitNexus impact upstream cho `runProbe`, `assertExpectedTraffic`,
  `printRedactedEvidence` và symbol decoder mới nếu index nhận diện được.
  Nếu risk HIGH/CRITICAL thì dừng để báo user.

- [x] **Step 2: Define and implement decoder**

  Thêm decoder đọc signed `i8 count`, reject count âm hoặc >64, đọc đúng
  `count` signed occupancy bytes, reject trailing bytes, và trả:

  ```ts
  { command: 90, roomId: 5, boardCount: count,
    areas: Array<{ area: number; occupancy: number }> }
  ```

  Gắn `area` là index 0-based UI; không đổi occupancy âm thành giá trị khác.

- [x] **Step 3: Typecheck**

  Chạy `npm --prefix avatar-web/server run typecheck`; expected PASS.

### Task 2: Gắn board-list vào một flow probe

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: Task 1 decoder, existing `waitForParkHandlerResponse`, traffic capture và cleanup.
- Produces: một `TX 90 [5]`/`RX 90` trước direct join và evidence redacted.

- [x] **Step 1: Add waiter and phase boundary**

  Thêm phase `board-list`; arm one-shot `RX 90` waiter trước `client.sendRaw(90,
  [i8 map])`; chuyển sang `direct-join` chỉ sau khi decode thành công.

- [x] **Step 2: Preserve direct join and ItemMapSpecial capture**

  Giữ nguyên một `cmd 80` với native coordinates, snapshot/RX80 decode, grace
  window và cleanup. Không thêm command nào khác.

- [x] **Step 3: Assert/output metadata**

  `assertExpectedTraffic` yêu cầu đúng một `TX 90 len=1`, một `RX 90` hợp lệ,
  và giữ các assertion direct-join hiện có. `printRedactedEvidence` thêm
  `parkBoardCatalog` và trạng thái `catalog-pending` khi thiếu/malformed.

### Task 3: Verify và chạy live probe

**Files:**
- Verify: `avatar-web/server/src/tools/npc-map-probe.ts`,
  `docs/protocol/npc-map-probe-evidence-2026-08-25.md`

**Interfaces:**
- Consumes: Task 2 probe.
- Produces: redacted evidence; không tạo production catalog nếu contract không complete.

- [x] **Step 1: Static safety**

  Chạy `git diff --check`; scan source để bảo đảm không có `entry.hex`, raw
  body logging, command cấm, loop/range/retry.

- [x] **Step 2: Live preflight and one invocation**

  Xác nhận local Avatar Web `:8787` tắt, rồi chạy đúng lệnh account 2/map 5/area
  7 từ spec. Lưu chỉ metadata redacted.

- [x] **Step 3: Classify evidence**

  Nếu RX90 đầy đủ: ghi board count/occupancy, đánh dấu area catalog observed.
  Nếu timeout/malformed: ghi pending, không suy diễn. RX80/RX48 được báo độc
  lập; không thay đổi catalog production.

- [x] **Step 4: Update evidence doc**

  Append timestamp, command/length metadata, decode classification và namespace
  warning vào evidence doc; không ghi credential/raw packet.
