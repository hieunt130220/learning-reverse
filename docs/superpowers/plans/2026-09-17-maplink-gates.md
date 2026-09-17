# Truy vết 3 cổng map con Khu ngoại ô (map 17) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xác định roomID + tọa độ join của 3 map con sau 3 cổng map 17 (gỗ/đá/+1), bắt đầu bằng 1 lần join thử room 88 đã được user duyệt.

**Architecture:** Tool probe mới `maplink-probe.ts` reuse khung `mining-probe.ts` (login, park barrier, traffic whitelist, redaction). B1 dùng tọa độ thử nghiệm gắn nhãn rõ ràng (không đưa vào bảng verified). Không sửa file production nào.

**Tech Stack:** Node.js + TypeScript ESM, `tsx`, `GameClient.sendRaw`, `cmd 80`.

**Spec:** `docs/superpowers/specs/2026-09-17-maplink-gates-design.md`

## Global Constraints
- Không TDD, không test files (theo `AGENTS.md`).
- Mỗi phiên live ≤ số TX ghi đã duyệt; cooldown ≥2000ms giữa join; dừng ngay khi dialog lạ/`RX -35`/socket đóng.
- Chỉ in dest roomID, tọa độ, tên do server cấp (cắt 120 ký tự). Cấm credential/host/hex/chat.
- Không commit (GitNexus tools không có trong session → để uncommitted cho user).
- GitNexus impact: N/A (chỉ tạo file mới, không sửa symbol cũ).

---

### Task 1 (APPROVED — user duyệt chạy): B1 join thử room 88

**User approval:** Duyệt spec + "Chạy B1 join room 88" (2026-09-17). Approval này bao trùm toàn bộ Task 1.

**Files:**
- Create: `avatar-web/server/src/tools/maplink-probe.ts`
- Modify: none
- Test: none (no TDD per AGENTS.md)

**Interfaces:**
- Consumes: `loadConfig` (`src/config.ts`), `openDb` (`src/db/index.ts`), `getAccountById/readGamePass` (`src/accounts/repo.ts`), `GameClient/login/enterParkContext/sendRaw` (`src/game/client.ts:718/726/912`), `NATIVE_PARK_JOIN_POSITIONS[17]` (`src/game/parkService.ts:98`)
- Produces: JSON redacted `{probeJoin: {roomId, boardId, x, y, status}, returnJoin, traffic[], events[]}` ra stdout

- [x] **Step 1: Tạo `maplink-probe.ts` với đường `--probe-room`**
```ts
// Điểm khác duy nhất so với mining-probe: cho phép 1 room thử nghiệm ngoài bảng verified,
// tọa độ gắn nhãn UNVERIFIED, chỉ dùng khi có cờ --probe-room + approve từng lần chạy.
const UNVERIFIED_PROBE_POSITIONS: Readonly<Record<number, { x: number; y: number }>> =
  Object.freeze({ 88: Object.freeze({ x: 100, y: 100 }) }); // B1: mượn tạm tọa độ hub 17
```
Flow: `login → online → enterParkContext (chờ ACK -1[9]) → TX 80 [88,area,x,y] → chờ RX 80 7s (đọc prefix room/board/x/y) → nghỉ 2000ms → TX 80 [17,area,100,100] → chờ RX 80 7s (best-effort) → logout (finally)`.
Whitelist TX sau login: `-1, 80` (+ `-94` nội bộ client). Ngoài whitelist → throw, dừng.

- [x] **Step 2: Typecheck + build**
Run: `cd avatar-web/server && npm run typecheck`
Expected: pass, không lỗi.

- [x] **Step 3: Chạy live B1 đúng 1 lần**
Run: `set -a; source .env; set +a; npx tsx src/tools/maplink-probe.ts --account-id 3 --area 0 --probe-room 88`
Expected: `probeJoin.status = 'joined'` + `roomId = 88` (verified), hoặc `'timeout'` (unverified) + `returnJoin` về 17 OK. Không TX nào ngoài whitelist.

- [x] **Step 4: Ghi kết quả vào evidence + báo user**
`probeJoin.roomId = 88` → 88 = map con (đối chiếu tên nếu server cấp). Timeout → 88 giữ `unverified`, không thử room khác trong phiên đó.

---

### Task 2 (PENDING — cần static xong + approve riêng): B2 mirror tile-request

**Files:**
- Modify: `avatar-web/server/src/tools/maplink-probe.ts` (thêm `--mirror-tile-request`)
- Static trước: decode `fv_0.do[]` + field class `ht` trong `tools/jar/all_src/`

- [ ] **Step 1: Decode shape request tile đúng nghĩa (mirror 1-1 call site J2ME)**
- [ ] **Step 2: Chờ user approve riêng rồi mới chạy live**
- [ ] **Fallback:** nếu không chốt được shape → ghi `tile-request-shape: unknown`, kết thúc điều tra static, chuyển sang chờ tên map từ user (Spec D4).

---

### Task 3 (sau B1): Evidence doc 3 cổng

**Files:**
- Create: `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md` (schema theo Spec §3.3)

- [ ] **Step 1: Ghi bảng gates/submaps với status verified/unverified/pending, không lấp số**
