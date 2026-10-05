# ParkService Native Coordinates (Maps 11, 2, 6, 8, 10, 12) Design

> **Ngày lập:** 2026-10-05  
> **Topic:** `park-service-native-coordinates`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Trong [avatar-web/server/src/game/parkService.ts](avatar-web/server/src/game/parkService.ts), bảng `NATIVE_PARK_JOIN_POSITIONS` cung cấp toạ độ `(x, y)` cho lệnh `cmd 80` (`AVATAR_JOIN_PARK`) khi tham gia các phân khu / bản đồ thành phố theo server `roomID`.

Hiện tại, các map:
- `11` (`T_PARK_PATH` - Đường công viên / Khu công viên trung tâm)
- `2` (`T_PARK_2` - Khu đấu giá cũ)
- `6` (`T_PARK_6` - Khu cô giáo)
- `8` (`T_PARK_8` - Khu 4 con vịt)
- `10` (`T_CONG_SANH_CUOI` - Cổng sảnh cưới / Lễ đường)
- `12` (`T_PARK_ADVANCED` - Công viên mở rộng / Khu trống)

chưa được định nghĩa trong `NATIVE_PARK_JOIN_POSITIONS`. Khi gọi `doJoinPark(map, area)` với các map này, hàm ném ngoại lệ: `chưa có tọa độ native đã verify cho map ${map}`.

Mục tiêu:
1. Bổ sung các toạ độ native chuẩn đã giải mã từ TextAsset `CityMap` và J2ME fast-travel logic vào `NATIVE_PARK_JOIN_POSITIONS`.
2. Cập nhật chú thích header giải thích rõ nguồn gốc và tên map tương ứng.

---

## 2. Phạm Vi (Scope)

### In-Scope
- Bổ sung các key `2`, `6`, `8`, `10`, `11`, `12` vào hằng số `NATIVE_PARK_JOIN_POSITIONS` trong [avatar-web/server/src/game/parkService.ts](avatar-web/server/src/game/parkService.ts).
- Cập nhật tài liệu kỹ thuật chú thích trong code.

### Out-of-Scope
- Không thay đổi signature hoặc logic nghiệp vụ của `ParkService`.
- Không tạo test mới (tuân thủ quy định KHÔNG TDD trong `CLAUDE.md`).
- Không sweep live server trong task này.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Bảng Toạ Độ Chi Tiết

| Room ID | Hằng số `LoadMap` | Tên khu vực | Tọa độ Native (x, y) | Nguồn chứng cứ |
| :---: | :--- | :--- | :---: | :--- |
| **`2`** | `T_PARK_2` | Khu công viên 2 (Đấu giá cũ) | `(168, 157)` | `RunnableC0031bd` (J2ME); `DataMap2` (310×80) |
| **`6`** | `T_PARK_6` | Khu công viên 6 (Khu cô giáo) | `(264, 157)` | `RunnableC0031bd` (J2ME); `DataMap6` (270×80) |
| **`8`** | `T_PARK_8` | Khu công viên 8 (Khu 4 con vịt) | `(264, 157)` | `RunnableC0031bd` (J2ME); `DataMap8` (270×80) |
| **`10`** | `T_CONG_SANH_CUOI` | Cổng sảnh cưới / Lễ đường | `(336, 181)` | `RunnableC0031bd` (J2ME); `LinkMap10`; `DataMap10` (420×80) |
| **`11`** | `T_PARK_PATH` | Công viên / Đường công viên | `(254, 82)` | TextAsset `CityMap` Node 5 (`idToMap=11`); J2ME auto `(474, 156)` |
| **`12`** | `T_PARK_ADVANCED` | Công viên mở rộng / Khu trống | `(594, 156)` | `RunnableC0031bd` (J2ME); `DataMap12` (440×80) |

*Ghi chú về Map 11:* Toạ độ `(254, 82)` là toạ độ native chính thức từ `CityMap` TextAsset Node 5 (idToMap=11, Công viên). Client AvatarHD sử dụng toạ độ này khi join từ bản đồ thành phố.

### 3.2 Cập Nhật Code `parkService.ts`

```typescript
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({
    0: Object.freeze({ x: 254, y: 82 }), // Công viên trung tâm (LoadMap.T_PARK = 0)
    1: Object.freeze({ x: 473, y: 100 }),
    2: Object.freeze({ x: 168, y: 157 }), // Khu đấu giá cũ (LoadMap.T_PARK_2 = 2)
    3: Object.freeze({ x: 236, y: 280 }),
    4: Object.freeze({ x: 452, y: 250 }),
    5: Object.freeze({ x: 254, y: 82 }),
    6: Object.freeze({ x: 264, y: 157 }), // Khu cô giáo (LoadMap.T_PARK_6 = 6)
    7: Object.freeze({ x: 524, y: 423 }),
    8: Object.freeze({ x: 264, y: 157 }), // Khu 4 con vịt (LoadMap.T_PARK_8 = 8)
    9: Object.freeze({ x: 236, y: 280 }),
    10: Object.freeze({ x: 336, y: 181 }), // Cổng sảnh cưới / Lễ đường (LoadMap.T_CONG_SANH_CUOI = 10)
    11: Object.freeze({ x: 254, y: 82 }),  // Công viên (LoadMap.T_PARK_PATH = 11 / CityMap node 5)
    12: Object.freeze({ x: 594, y: 156 }), // Công viên mở rộng / Khu trống (LoadMap.T_PARK_ADVANCED = 12)
    13: Object.freeze({ x: 364, y: 64 }),
    14: Object.freeze({ x: 460, y: 97 }),
    15: Object.freeze({ x: 36, y: 97 }),
    16: Object.freeze({ x: 324, y: 157 }),
    17: Object.freeze({ x: 100, y: 100 }),
    27: Object.freeze({ x: 254, y: 82 }),
    28: Object.freeze({ x: 57, y: 209 }),
  });
```

---

## 4. Verification Plan

1. **Typecheck:**
   ```bash
   npm --prefix avatar-web/server run typecheck
   ```
   Kỳ vọng: Không có lỗi type.

2. **Existing Tests:**
   ```bash
   npm --prefix avatar-web/server run test
   ```
   Kỳ vọng: Toàn bộ suite test hiện tại pass 100%.

3. **GitNexus Analysis:**
   - Chạy `impact` trước khi sửa.
   - Chạy `detect_changes` trước khi commit.
