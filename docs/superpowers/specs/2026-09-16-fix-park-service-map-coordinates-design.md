# Fix ParkService Map Coordinates (Khu Giải Trí & Mê Cung) Design

> **Ngày lập:** 2026-09-16  
> **Topic:** `fix-park-service-map-coordinates`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Trong `avatar-web/server/src/game/parkService.ts`, hằng số `NATIVE_PARK_JOIN_POSITIONS` dùng để lưu trữ toạ độ native cho lệnh `cmd 80` (`AVATAR_JOIN_PARK`) theo key là **server roomID** (`idToMap`).

Hiện tại đang có sự nhầm lẫn namespace giữa **CityMap Node ID** và **Server roomID**:
- Key `9` đang bị gán toạ độ `(57, 209)`. Đây thực chất là toạ độ của **CityMap Node ID 9** ("Mê cung", trỏ sang server `roomID = 28`).
- Thực tế server `roomID = 9` là **Khu giải trí** (trỏ từ CityMap Node 3), toạ độ native chuẩn là `(236, 280)`.
- Server `roomID = 28` (**Mê cung**) chưa có entry trong `NATIVE_PARK_JOIN_POSITIONS`.

Mục tiêu:
1. Sửa key `9` về toạ độ đúng của Khu giải trí: `(236, 280)`.
2. Thêm key `28` với toạ độ đúng của Mê cung: `(57, 209)`.
3. Cập nhật header comment ghi rõ ánh xạ giữa CityMap Node ID và server `roomID`.

---

## 2. Phạm Vi (Scope)

### In-Scope
- Chỉnh sửa hằng số `NATIVE_PARK_JOIN_POSITIONS` và comment giải thích trong `avatar-web/server/src/game/parkService.ts`.
- Đảm bảo tính nhất quán với TextAsset `CityMap` (`PositionMap`, SHA-256 `e3fc3c12...`) và `docs/danh-sach-tat-ca-cac-map-AvatarHD.md`.

### Out-of-Scope
- Không thay đổi signature hoặc logic thực thi của class `ParkService`.
- Không thêm tính năng tự động hoá mới.
- Không viết test mới (tuân thủ quy định KHÔNG TDD trong `CLAUDE.md`).

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Bảng Ánh Xạ CityMap Node sang Server roomID

Trích xuất từ `data.unity3d` (AvatarHD 3.4.4 APK):

| CityMap Node ID | Tên khu vực | Toạ độ (x, y) | Handler | Server roomID (`idToMap`) |
| :---: | :--- | :---: | :---: | :---: |
| **`3`** | **Khu giải trí** | `(236, 280)` | 9 | **`9`** |
| **`9`** | **Mê cung** | `(57, 209)` | 9 | **`28`** |

### 3.2 Thay Đổi Cụ Thể Trong `parkService.ts`

```typescript
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({
    1: Object.freeze({ x: 473, y: 100 }),
    3: Object.freeze({ x: 236, y: 280 }),
    4: Object.freeze({ x: 452, y: 250 }),
    5: Object.freeze({ x: 254, y: 82 }),
    7: Object.freeze({ x: 524, y: 423 }),
    9: Object.freeze({ x: 236, y: 280 }), // Sửa: roomID 9 = Khu giải trí
    13: Object.freeze({ x: 364, y: 64 }),
    14: Object.freeze({ x: 460, y: 97 }),
    15: Object.freeze({ x: 36, y: 97 }),
    16: Object.freeze({ x: 324, y: 157 }),
    17: Object.freeze({ x: 100, y: 100 }),
    27: Object.freeze({ x: 254, y: 82 }),
    28: Object.freeze({ x: 57, y: 209 }), // Thêm: roomID 28 = Mê cung (CityMap node 9)
  });
```

---

## 4. Verification Plan

1. **Static Analysis & Typecheck:**
   ```bash
   npm --prefix avatar-web/server run typecheck
   ```
   Kỳ vọng: Không có lỗi type TypeScript.

2. **Existing Tests Verification:**
   ```bash
   npm --prefix avatar-web/server run test
   ```
   Kỳ vọng: Toàn bộ test hiện có chạy qua mà không có regression.

3. **GitNexus Scope Check:**
   Chạy `gitnexus_detect_changes()` xác nhận chỉ thay đổi duy nhất file `parkService.ts`.
