# Map Pier Fish IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ánh xạ các item ID cá câu được tại Bến Tàu (Map 27) vào `FISH_NAMES` trên server và web client theo danh sách xác nhận (4504: Cá lia thia, 4505: Cá chép, 4506: Cá hề, 4507: Cá vàng).

**Architecture:** Mở rộng từ điển `FISH_NAMES` đồng bộ ở cả server backend (`automationTypes.ts`) và web client (`FishingPanel.tsx`), sau đó cập nhật tài liệu tham chiếu `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`.

**Tech Stack:** TypeScript, Node.js (ESM), React, Vite

**Spec:** `docs/superpowers/specs/2026-09-15-map-pier-fish-ids-design.md`

## Global Constraints
- KHÔNG thực hiện TDD: Không viết test trước, không tạo test files trừ khi user yêu cầu rõ ràng.
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_detect_changes` trước khi commit.
- Chạy `typecheck` và `build` sau khi chỉnh sửa để đảm bảo không lỗi type.

---

### Task 1: Cập nhật `FISH_NAMES` Backend Server

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:72-86`

**Interfaces:**
- Consumes: Không
- Produces: `FISH_NAMES` chứa ID 4504, 4505, 4506, 4507

- [x] **Step 1: Cập nhật `FISH_NAMES` trong `automationTypes.ts`**

Thay thế đoạn khai báo `FISH_NAMES`:
```typescript
export const FISH_NAMES: Record<number, string> = {
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',
  4504: 'Cá lia thia',
  4505: 'Cá chép',
  4506: 'Cá hề',
  4507: 'Cá vàng',
  4510: 'Cá biển (4510)',
};
```

- [x] **Step 2: Kiểm tra compile TypeScript server**

Run: `npm --prefix avatar-web/server run typecheck`
Expected: Exit code 0, không có lỗi.

- [x] **Step 3: Kiểm tra hàm `getFishName`**

Run: `node -e 'const { getFishName } = require("./avatar-web/server/dist/session/automationTypes.js"); console.log(getFishName(4504), getFishName(4505), getFishName(4506), getFishName(4507));' 2>/dev/null || npx tsx -e 'import { getFishName } from "./avatar-web/server/src/session/automationTypes.js"; console.log(getFishName(4504), getFishName(4505), getFishName(4506), getFishName(4507));'`
Expected: `Cá lia thia Cá chép Cá hề Cá vàng`

---

### Task 2: Cập nhật `FISH_NAMES` Frontend Web

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:85-98`

**Interfaces:**
- Consumes: `FISH_NAMES` từ Task 1
- Produces: `FISH_NAMES` hiển thị trên UI FishingPanel

- [x] **Step 1: Cập nhật `FISH_NAMES` trong `FishingPanel.tsx`**

Đồng bộ `FISH_NAMES` trong `FishingPanel.tsx`:
```typescript
export const FISH_NAMES: Record<number, string> = {
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',
  4504: 'Cá lia thia',
  4505: 'Cá chép',
  4506: 'Cá hề',
  4507: 'Cá vàng',
  4510: 'Cá biển (4510)',
};
```

- [x] **Step 2: Kiểm tra build Web**

Run: `npm --prefix avatar-web/web run build`
Expected: Exit code 0, build thành công.

---

### Task 3: Cập nhật Tài Liệu Tham Chiếu & GitNexus Verification

**Files:**
- Modify: `docs/danh-sach-cac-map-cau-ca-AvatarHD.md:111-118`

**Interfaces:**
- Consumes: Mapping từ Task 1 & 2
- Produces: Bảng tài liệu tra cứu hoàn chỉnh

- [x] **Step 1: Cập nhật mục 3.2 trong `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`**

Cập nhật bảng thành:
```markdown
| ID (`idFish`) | Vị trí câu | Tên loại cá / Phân loại | Ghi chú & Đặc điểm |
| :---: | :---: | :--- | :--- |
| **`4504`** | Map 27 (Bến tàu / Biển Hawai) | **Cá lia thia** | Cá biển Bến Tàu |
| **`4505`** | Map 27 (Bến tàu / Biển Hawai) | **Cá chép** | Cá biển Bến Tàu (phân biệt với Cá chép vàng 450) |
| **`4506`** | Map 27 (Bến tàu / Biển Hawai) | **Cá hề** | Cá biển Bến Tàu |
| **`4507`** | Map 27 (Bến tàu / Biển Hawai) | **Cá vàng** | Cá biển Bến Tàu (thời gian delay mini-game 20-25s) |
| **`4510`** | Map 27 (Bến tàu / Biển Hawai) | **Cá biển (4510)** | Cá biển hiếm / sự kiện |
```

- [x] **Step 2: Chạy GitNexus `detect_changes`**

Gọi `detect_changes({scope: "all"})` để kiểm tra các symbol bị ảnh hưởng.
Expected: Chỉ ảnh hưởng các symbol liên quan (`FISH_NAMES`, `getFishName`, `FishingPanel`).

- [x] **Step 3: Commit thay đổi**

```bash
git add avatar-web/server/src/session/automationTypes.ts avatar-web/web/src/accounts/panels/FishingPanel.tsx docs/danh-sach-cac-map-cau-ca-AvatarHD.md docs/superpowers/specs/2026-09-15-map-pier-fish-ids-design.md docs/superpowers/plans/2026-09-15-map-pier-fish-ids.md
git commit -m "feat(fishing): map pier fish IDs to Vietnamese names"
```
