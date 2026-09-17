# Thiết Kế — Truy Vết Map Con & Quét Đối Tượng Khai Thác Gỗ/Đá (AvatarHD 3.4.4)

> **Ngày:** 2026-09-17  
> **Chủ đề:** `quet-object-dao-go-da`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)  
> **Tài liệu nền tảng:**
> - `docs/superpowers/specs/2026-09-17-maplink-gates-design.md`
> - `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`
> - `docs/superpowers/specs/2026-09-16-dao-go-da-khu-ngoai-o-design.md`

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Vấn Đề
1. Người dùng yêu cầu: **Tiếp tục đi vào các map con sau các cổng của Map 17 (Khu ngoại ô) và quét các object đào gỗ và đào đá**.
2. Kết quả dịch ngược native ARM64 `libil2cpp.so` tại hàm `ImageMap.requestResendLinkMap` (`0x8F69EC`) và `GlobalMessageHandler.onMessage` (`0x5E5FD4`) đã chứng minh:
   - Client AvatarHD tải thông tin các cổng LinkMap bằng lệnh **`TX -51 (DOWNLOAD_DATA)`** với `subType = 24`, `idMap - 1`.
   - Server phản hồi gói **`RX -51`** chứa kích thước bản đồ và danh sách cổng liên kết (`LinkMap`: `x1, y1, x2, y2, idMapTo`).
   - Khi bước vào cổng, client gửi lệnh **`cmd 80 (AVATAR_JOIN_PARK)`** với `[roomID = idMapTo, boardID = -1, x, y]`.
3. Khi join thành công vào map con, server trả về gói tin snapshot **`RX 80`**, chứa danh sách các đối tượng bản đồ đặc biệt **`ItemMapSpecial`** (cây gỗ, tảng đá, mỏ khai thác) bao gồm ID đối tượng, tên, loại (`type`), số frame hình ảnh và các `menuIds` tương tác (`cmd -59` chạm và `cmd -61` đào).

### 1.2 Mục Tiêu Cụ Thể
- **G1 (Tải LinkMap Map 17):** Gửi 1 gói tin `TX -51 [24, 0, 16]` để server trả về danh sách các cổng của Map 17 (bao gồm tọa độ và dest roomID của mỏ gỗ, mỏ đá, nhà tù).
- **G2 (Join Map Con & Chụp Snapshot):** Tham gia vào từng map con đã xác định được roomID qua `cmd 80`.
- **G3 (Quét Đối Tượng Khai Thác):** Giải mã toàn bộ `ItemMapSpecial` từ `RX 80` của các map con để lập danh mục: ID đối tượng, tên, loại, tọa độ, và menu chức năng (đào gỗ / đào đá).
- **G4 (An Toàn Tuyệt Đối):** Tuân thủ safety guards: mỗi phiên ≤ giới hạn gói tin đã duyệt, cooldown ≥ 2000ms giữa các lần join, ngắt kết nối an toàn ngay khi có phản hồi bất thường.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Mở rộng công cụ probe:** Tận dụng `maplink-probe.ts` (hoặc tạo `mining-object-probe.ts`) với 2 chế độ:
   - Chế độ `--get-linkmap 17`: Gửi `TX -51 [24, 0, 16]` để bắt và decode `RX -51`.
   - Chế độ `--probe-submap <roomId>`: Gửi `TX 80 [roomId, boardId, x, y]` để nhận snapshot `RX 80` và trích xuất danh sách `ItemMapSpecial`.
2. **Decode `RX -51` (LinkMap):**
   - Payload: `[i8 subType = 24][i16 idMap]...[i32 wMap][i32 hMap][i8 linkCount]` và `linkCount` bộ `[i32 x1][i32 y1][i32 x2][i32 y2][i16 idMapTo]`.
3. **Decode `RX 80` (Snapshot đối tượng):**
   - Parse `specialCount` và danh sách `specials` (`id`, `name`, `type`, `menuIds`).
4. **Ghi nhận Evidence:** Cập nhật file evidence `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md` với đầy đủ kết quả thực tế.

### 2.2 Out-of-Scope
- Không thực hiện thao tác đào thật (không gửi `TX -61` đào tài nguyên gây biến động kho).
- Không quét hàng loạt (sweep) các roomID ngẫu nhiên.
- Không viết test files (tuân thủ nguyên tắc KHÔNG TDD trong `CLAUDE.md`).
- Không commit git trong phiên (để user tự quyết định commit).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Quy Trình Xử Lý 2 Giai Đoạn (Two-Phase Execution)

```
[Phase 1: Download LinkMap Map 17]
Login → enterParkContext (Handler 9)
  → TX -1 [8] (chuyển Handler 8: AvatarMsgHandler)
  → TX -51 [i8 24, i16 16] (Yêu cầu LinkMap Map 17)
  → Chờ RX -51 (Timeout 7s)
  → Parse linkCount & danh sách [x1, y1, x2, y2, idMapTo]
  → Báo cáo danh sách cổng và dest roomID cho User.

[Phase 2: Join Submap & Snapshot Objects]
(Chạy sau khi có dest roomID từ Phase 1)
Login → enterParkContext (Handler 9)
  → TX 80 [destRoomId, -1, xDefault, yDefault]
  → Chờ RX 80
  → Trích xuất danh sách ItemMapSpecial (Cây gỗ / Mỏ đá)
  → Thoát về Map 17 an toàn → Logout.
```

### 3.2 Cấu Trúc Gói Tin & Handler

| Chiều | Opcode | Ngữ cảnh | Payload | Mục đích |
| :---: | :---: | :---: | :--- | :--- |
| **TX** | **`-1`** | Global | `[i8 8]` | Chuyển sang Handler 8 (`AvatarMsgHandler`) |
| **TX** | **`-51`** | Handler 8 | `[i8 24][i16 16]` | Yêu cầu `LinkMap` của Map 17 (`17 - 1 = 16`) |
| **RX** | **`-51`** | Handler 8 | `[i8 24][i16 17]...[i8 linkCount][items...]` | Danh sách cổng và `idMapTo` |
| **TX** | **`80`** | Handler 9 | `[i8 roomId][i8 -1][i16 x][i16 y]` | Tham gia map con |
| **RX** | **`80`** | Handler 9 | `[snapshot bytes...]` | Snapshot map con, chứa `ItemMapSpecial` |

### 3.3 Safety Guards
1. **Whitelist gói tin nghiêm ngặt:** Chỉ cho phép `TX -1, -51, 80` (+ `-94` ping nội bộ). Mọi opcode khác lập tức bị chặn.
2. **Cooldown an toàn:** Nghỉ ≥ 2000ms giữa các lượt join.
3. **Kill-switch:** Dừng ngay lập tức nếu nhận dialog `-40` bất thường, ngắt kết nối hoặc rate-limit.
4. **Bảo mật dữ liệu (Redaction):** Không in thông tin tài khoản, pass, session key, host IP ra console.

---

## 4. Verification Plan

1. **Kiểm tra cú pháp & Typecheck:**
   ```bash
   cd avatar-web/server && npm run typecheck
   ```
2. **Kiểm tra Phase 1 (Tải LinkMap Map 17):**
   - Chạy lệnh probe tải LinkMap:
     ```bash
     npx tsx src/tools/maplink-probe.ts --account-id 3 --get-linkmap 17
     ```
   - Kết quả mong đợi: Bắt được `RX -51`, giải mã thành công danh sách cổng và các dest roomID (xác định map khai thác gỗ và đá).
3. **Kiểm tra Phase 2 (Quét Object Trong Map Con):**
   - Chạy probe join vào roomID vừa tìm được:
     ```bash
     npx tsx src/tools/maplink-probe.ts --account-id 3 --probe-submap <destRoomId>
     ```
   - Kết quả mong đợi: `RX 80` trả về danh sách đối tượng `ItemMapSpecial` có tên liên quan đến cây gỗ, tảng đá hoặc mỏ khai thác.
