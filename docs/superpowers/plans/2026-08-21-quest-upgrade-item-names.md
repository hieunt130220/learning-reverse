# Hiển thị tên thật item trong yêu cầu nâng cấp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị tên item thật trong tab `Nâng Cấp` thay vì tên dạng `Nông sản #id` hoặc `Thuốc #id`.

**Architecture:** Decoder action=1 nhận context catalog hiện có từ `GameClient`, resolve ID theo item trước rồi đến cây, sau đó dùng fallback theo loại. State, payload và UI contract giữ nguyên.

**Tech Stack:** TypeScript, Node.js, React/Vite.

**Spec:** `docs/superpowers/specs/2026-08-21-quest-upgrade-item-names-design.md`

## Global Constraints

- Không thay đổi wire format cmd 104 hoặc giá trị progress.
- Catalog chưa tải/không có ID phải không làm decoder lỗi.
- Không tạo test files mới; kiểm tra sau khi production code hoàn tất.
- Chạy GitNexus impact trước khi sửa symbol và detect_changes trước commit.
- Không thêm mapping phỏng đoán cho ID không có trong catalog.

### Task 1: Mở rộng decoder để resolve tên từ catalog

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: `TreeInfo`, `ItemInfo`, `getProduceOrItemName` từ `farmData.ts`.
- Produces: `decodeProgressQuestPacket(data, mappings, catalog?)` với `displayName` được resolve.

- [x] **Step 1: Impact analysis**
  Chạy GitNexus impact cho `decodeProgressQuestPacket` và `getRequirementDisplayName`, ghi nhận caller và risk.

- [x] **Step 2: Thêm context catalog tùy chọn**
  Import type cần thiết, định nghĩa context `{ trees?: TreeInfo[]; items?: ItemInfo[] }`, giữ tương thích
  với các caller không truyền context.

- [x] **Step 3: Resolve tên requirement**
  Với type 7/9 và `idFarm > 0`, gọi helper catalog để lấy tên thật; nếu không tìm thấy dùng fallback hiện tại.
  Không đổi tên các type 1..6, 8 và không đổi `request`/`inStorage`.

- [x] **Step 4: Verify**
  Chạy typecheck server; kiểm tra thủ công decoder với catalog có ID và catalog rỗng.

- [ ] **Step 5: Commit**
  `git commit -m "fix(quest): resolve upgrade item names from catalog"`

### Task 2: Truyền catalog từ GameClient vào decoder

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `this.trees`, `this.items`, decoder context ở Task 1.
- Produces: `farmUpgradeRequirements` có `displayName` thật khi catalog đã tải.

- [x] **Step 1: Impact analysis**
  Chạy GitNexus impact cho `decodeProgressQuestPacket` và handler cmd 104 trước khi sửa.

- [x] **Step 2: Truyền context tại handler action=1**
  Bổ sung `{ trees: this.trees, items: this.items }` vào lời gọi decoder; không sửa state transition khác.

- [x] **Step 3: Verify**
  Chạy build/typecheck server và web hiện có; mở `/accounts/2`, tải lại quest và xác nhận item có catalog
  hiển thị bằng tên thật, item không có catalog vẫn fallback ổn định.

- [ ] **Step 4: Detect changes**
  Chạy `gitnexus_detect_changes()` và xác nhận chỉ flow decoder/action=1 và quest overview bị ảnh hưởng.

- [ ] **Step 5: Commit**
  `git commit -m "fix(quest): pass item catalog to upgrade decoder"`
