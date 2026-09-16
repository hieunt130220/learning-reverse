# Khu Ngoại Ô (Map 17) Object & Mining Evidence — 2026-09-16

## 1. Trạng thái

`map17-verified; areas-scanned=5; object-catalog=empty; dig-menu=pending; material-ids=pending`

Bằng chứng thực nghiệm read-only được thu thập trực tiếp từ live server AvatarHD qua `mining-probe.ts` (Account ID 3) tại Khu Ngoại Ô (map 17, areas 0..4).

---

## 2. Bảng Đối Tượng (Specials Catalog)

| ID | Tên đối tượng | Type | Image Count | Menu IDs | Ghi chú |
| :---: | :--- | :---: | :---: | :---: | :--- |
| *(trống)* | *(không có đối tượng `ItemMapSpecial` nào được nạp)* | - | - | `[]` | Quét các khu `0..4`, `specialCount = 0` |

### Chi tiết phản hồi tham gia khu (Direct Join Response)

- **Map ID:** 17 (`LoadMap.T_SLUM` / CityMap Node 8 "Ngoại ô")
- **Tọa độ Native Join:** `x = 100, y = 100` (nguồn: `CityMap` TextAsset version `11850`)
- **Số lượng khu vực (Board Count):** `20` khu (`0..19`), phản hồi từ `cmd 90` (`PARK_BOARD_LIST`)
- **Occupancy mỗi khu:** 2
- **Cấu trúc gói RX 80 (339 bytes tại Area 0, 275 bytes tại Areas 1..4):**
  - `roomId`: 17, `boardId`: 0..4
  - `x`: 100, `y`: 100
  - `listPlayerCount`: 5 (Area 0), 4 (Areas 1..4)
  - `mapMarker`: 0
  - `mapItemTypeCount`: null (bỏ qua do marker = 0)
  - `mapItemCount`: null (bỏ qua do marker = 0)
  - `animCount`: 0
  - `specialCount`: 0
  - `mapSpecialUpdates (cmd 48)`: 0 (không có gói cập nhật đối tượng đẩy trễ)
  - `trailingBytes`: 50 bytes (Area 0: 5 record 10-byte dạng `[i32 id][6x 0xFF]` tương ứng 5 người chơi trong phòng)

---

## 3. Bảng Menu Tương Tác (`cmd -61`)

| idMenu | Caption | TX Command | RX Quan Sát | Trạng Thái |
| :---: | :--- | :---: | :---: | :--- |
| - | - | `-61` | - | `pending` (chưa có đối tượng đặc thù để mở menu) |

---

## 4. Bảng Vật Phẩm Khai Thác (Mined Materials)

| Item ID | Tên vật phẩm | Section Inventory | Delta mỗi lần | Trạng Thái |
| :---: | :--- | :---: | :---: | :--- |
| - | Gỗ | - | - | `pending` |
| - | Đá | - | - | `pending` |

---

## 5. Metadata, Hash & Phiên Bản

- **Môi trường:** AvatarHD 3.4.4 APK (`com.TeaM.Avatar`, Android ARM64)
- **APK SHA-256:** `401b17880bacd1270188bdfdbb8a3fa0f1ed6a78b6fd58d28c8780d639979f4e`
- **CityMap TextAsset SHA-256:** `e3fc3c1272d6d6f7e2ba100f9e7c408ced3dd496f2b326721b17c719e9d5d4da`
- **Timestamp Capture:** `2026-09-16T08:05:00.430Z`
- **Account Probe:** ID 3 (live session, 0 write actions)
- **Traffic Phù Hợp Whitelist:**
  - `TX -1 len=1` (Context Park)
  - `RX -1 len=1` (Ack Context)
  - `TX 90 len=1` (Request Board List Map 17)
  - `RX 90 len=21` (Catalog 20 Boards)
  - `TX 80 len=6` (Direct Join Map 17 Area 0..4)
  - `RX 80 len=339/275` (Park Join Snapshot)
  - `RX -20 len=66` (Sound Request)
  - `RX -3 len=25` (Update Money)
  - `RX 85 len=40..71` (Park Chat Broadcast)
  - Hoàn toàn KHÔNG gửi TX `-59` hay TX `-61`.

---

## 6. Giới Hạn & Kết Luận Kỹ Thuật

1. Đã xác thực 100% việc kết nối và tham gia bản đồ Khu Ngoại Ô qua lệnh `cmd 80` với toạ độ native `(100, 100)` và `roomID = 17`.
2. Khu Ngoại Ô gồm 20 khu vực (areas 0..19). Không có đối tượng tĩnh dạng `ItemMapSpecial` (cây/mỏ đá) nằm sẵn trong snapshot tham gia map `RX 80` hoặc được gửi qua `RX 48` ở các khu quét mẫu (0..4).
3. Do mục 3 (`dig-menu`) và mục 4 (`material-ids`) đang ở trạng thái `pending`, Phase C (viết automation `auto_mining`) tạm hoãn theo đúng thiết kế Spec §3.3 cho đến khi xác định được cơ chế kích hoạt đào (NPC trung gian / item công cụ / toạ độ ô quặng).
