# Khu Ngoại Ô (Map 17) Object & Mining Evidence — 2026-09-16

## 1. Trạng thái

`map17-verified; areas-scanned=20/20; object-catalog=empty; dig-menu=pending; material-ids=pending`

Bằng chứng thực nghiệm read-only được thu thập trực tiếp từ live server AvatarHD qua `mining-probe.ts` (Account ID 3) tại Khu Ngoại Ô (map 17, toàn bộ 20 khu 0..19).

---

## 2. Bảng Đối Tượng (Specials Catalog)

| ID | Tên đối tượng | Type | Image Count | Menu IDs | Ghi chú |
| :---: | :--- | :---: | :---: | :---: | :--- |
| *(trống)* | *(không có đối tượng `ItemMapSpecial` nào được nạp)* | - | - | `[]` | Quét toàn bộ 20 khu `0..19`, `specialCount = 0` |

### Chi tiết phản hồi tham gia khu (Direct Join Response)

- **Map ID:** 17 (`LoadMap.T_SLUM` / CityMap Node 8 "Ngoại ô")
- **Tọa độ Native Join:** `x = 100, y = 100` (nguồn: `CityMap` TextAsset version `11850`)
- **Số lượng khu vực (Board Count):** `20` khu (`0..19`), phản hồi từ `cmd 90` (`PARK_BOARD_LIST`)
- **Kết quả quét 20/20 khu:**
  - Khu 0: `specialCount = 0`, `listPlayerCount = 5`, `trailingBytes = 50`
  - Khu 1..4: `specialCount = 0`, `listPlayerCount = 4`, `trailingBytes = 40`
  - Khu 5..9: `specialCount = 0`, `listPlayerCount = 4`, `trailingBytes = 40`
  - Khu 10: `specialCount = 0`, `listPlayerCount = 5`, `trailingBytes = 50`
  - Khu 11..19: `specialCount = 0`, `listPlayerCount = 4`, `trailingBytes = 40`
  - `mapSpecialUpdates (cmd 48)`: 0 trên tất cả các khu (không có sự kiện đối tượng đẩy trễ)

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
  - `TX 80 len=6` (Direct Join Map 17 Area 0..19)
  - `RX 80 len=339/320/275` (Park Join Snapshot)
  - `RX -20 len=66` (Sound Request)
  - `RX -3 len=25` (Update Money)
  - `RX 85 len=23..82` (Park Chat Broadcast)
  - Hoàn toàn KHÔNG gửi TX `-59` hay TX `-61`.

---

## 6. Giới Hạn & Kết Luận Kỹ Thuật

1. Đã xác thực 100% việc kết nối và tham gia bản đồ Khu Ngoại Ô qua lệnh `cmd 80` với toạ độ native `(100, 100)` và `roomID = 17`.
2. Khu Ngoại Ô gồm 20 khu vực (areas 0..19). Đã quét toàn bộ 20/20 khu vực: KHÔNG có đối tượng tĩnh dạng `ItemMapSpecial` (cây/mỏ đá) nằm sẵn trong snapshot tham gia map `RX 80` hoặc được gửi qua `RX 48`.
3. Do mục 3 (`dig-menu`) và mục 4 (`material-ids`) đang ở trạng thái `pending`, Phase C (viết automation `auto_mining`) tạm hoãn theo đúng thiết kế Spec §3.3 cho đến khi xác định được cơ chế kích hoạt đào (NPC trung gian / item công cụ / toạ độ ô quặng / sự kiện theo giờ).
