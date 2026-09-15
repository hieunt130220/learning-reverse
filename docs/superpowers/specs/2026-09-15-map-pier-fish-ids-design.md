# Thiết Kế: Cập Nhật Bảng Mapping ID Sang Tên Các Loại Cá Khu Bến Tàu (Map 27)

> **Ngày lập:** 2026-09-15  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Ánh xạ các item ID cá câu được tại Bến Tàu (Map 27) vào `FISH_NAMES` trên server và web client.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
- Khi câu cá tại **Khu Bến Tàu / Đảo Hawai (Map 27)**, server gửi gói `RX 79 (CAN_CAU)` chứa `idFish` thuộc dải ID 45xx (4504, 4505, 4506, 4507...).
- Trước đây, hệ thống chưa có đủ mapping nên chỉ gán tạm:
  - `4507`: `'Cá biển (4507)'`
  - `4510`: `'Cá biển (4510)'`
  - Các ID `4504`, `4505`, `4506` rơi vào fallback `'Cá ID <id>'`.
- Người dùng đã xác nhận mapping thực tế khi câu cá tại Bến Tàu:
  - `4504`: **Cá lia thia**
  - `4505`: **Cá chép**
  - `4506`: **Cá hề**
  - `4507`: **Cá vàng**

### 1.2. Mục tiêu
- Cập nhật `FISH_NAMES` trong `avatar-web/server/src/session/automationTypes.ts` và `avatar-web/web/src/accounts/panels/FishingPanel.tsx`.
- Cập nhật tài liệu tham chiếu `docs/danh-sach-cac-map-cau-ca-AvatarHD.md` (Mục 3.2: Cá câu tại Bến Tàu).

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- Bổ sung 4 loài cá Bến Tàu vào từ điển `FISH_NAMES`:
  - `4504: 'Cá lia thia'`
  - `4505: 'Cá chép'`
  - `4506: 'Cá hề'`
  - `4507: 'Cá vàng'` (thay thế cho `'Cá biển (4507)'`)
  - Giữ nguyên `4510: 'Cá biển (4510)'` làm dự phòng cho đến khi có tên chính xác.
- Đồng bộ ở 2 vị trí:
  - Backend: `avatar-web/server/src/session/automationTypes.ts`
  - Frontend: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`
- Cập nhật bảng tổng hợp ở `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`.

### 2.2. Out-of-Scope
- Không thay đổi logic xử lý câu cá hay flow mua bán.
- Không thay đổi schema DB SQLite (thống kê `avatar_daily_fishing_statistics` lưu `fish_id` dạng integer và hiển thị theo `FISH_NAMES`).

---

## 3. Thiết Kế Kiến Trúc & Danh Sách File

### 3.1. Danh Sách Files Liên Quan

| File | Đường dẫn | Vai trò |
|---|---|---|
| `automationTypes.ts` | `avatar-web/server/src/session/automationTypes.ts` | Cung cấp `FISH_NAMES` và `getFishName(id)` cho bot runtime & API thống kê |
| `FishingPanel.tsx` | `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Cung cấp `FISH_NAMES` và `formatFishName(id, name)` cho UI |
| `danh-sach-cac-map-cau-ca-AvatarHD.md` | `docs/danh-sach-cac-map-cau-ca-AvatarHD.md` | Tài liệu tra cứu mapping các loại cá theo map |

### 3.2. Chi Tiết Contract `FISH_NAMES` Sau Khi Cập Nhật

```typescript
export const FISH_NAMES: Record<number, string> = {
  // Map 14: Hồ cá rô
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',

  // Map 15: Hồ cá lóc
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',

  // Map 16: Hồ cá mập
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',

  // Map 27: Bến tàu / Biển Hawai
  4504: 'Cá lia thia',
  4505: 'Cá chép',
  4506: 'Cá hề',
  4507: 'Cá vàng',
  4510: 'Cá biển (4510)',
};
```

---

## 4. Verification Plan

1. **Typecheck & Build:**
   - Server: `npm --prefix avatar-web/server run typecheck`
   - Web: `npm --prefix avatar-web/web run build`
2. **Kiểm tra output hàm:**
   - `getFishName(4504)` trả về `'Cá lia thia'`
   - `getFishName(4505)` trả về `'Cá chép'`
   - `getFishName(4506)` trả về `'Cá hề'`
   - `getFishName(4507)` trả về `'Cá vàng'`
