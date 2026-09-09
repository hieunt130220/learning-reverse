# Thiết Kế Sửa Lỗi Giao Thức Mua Mồi Câu & Vật Phẩm Xếp Chồng (AvatarHD)

> **Ngày lập:** 2026-09-09  
> **Trạng thái:** Chờ User duyệt (Review Gate)  
> **Tác giả:** Claude Fable 5 & Devios  

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Hiện trạng & Triệu chứng lỗi
Khi bot câu cá chạy tại Map 14 (Khu cá rô) hết mồi câu, server trả về dialog:
`"Bạn cần sử dụng mồi câu để câu cá trong khu vực này"`
Bot đã phát hiện dialog và di chuyển về Map 13 (Khu sinh thái) để mua mồi, nhưng gặp 2 lỗi nghiêm trọng:

1. **Lỗi đầy 40/40 rương (Web UI vs Game Client):**
   - Khi bot chạy auto mua mồi trước đó bằng opcode `-92` trong vòng lặp, mỗi lần mua server tạo ra 1 slot item thời trang/trang phục riêng lẻ không xếp chồng (unstacked), làm rác và kẹt cứng 40/40 ô rương nhân vật (như ảnh `web.jpeg` đối chiếu với ảnh `game.jpeg` mua mồi xếp chồng `x2`).
2. **Lỗi mua giả tạo & lặp vô tận (False Success):**
   - Khi bot gửi opcode `-24`, server không hề thực hiện giao dịch (`tiền: +0`), không trừ tiền và không cộng mồi.
   - Bot vẫn log `[câu cá] Đã mua thành công Mồi cơm`, sau đó quay lại Map 14 câu và lập tức bị server từ chối tiếp: `[câu cá] phản hồi bắt đầu câu (RX45): iss=false (lỗi: Bạn cần sử dụng mồi câu để câu cá trong khu vực này)`.

### 1.2. Phân tích nguyên nhân gốc rễ (Root Cause Investigation)

Từ kết quả reverse engineering và dịch ngược native disassembly trên binary `libil2cpp.so` (ARM64) của AvatarHD 3.4.4:

1. **Opcode `-92` (`AVATAR_BUY_ITEM`)**:
   - Signature: `AvatarService.doBuyItem(short idPart, sbyte money)` tại RVA `0x9610B0`.
   - Payload: `writeShort(idPart)`, `writeByte(money)`, `writeByte(type)`.
   - **Mục đích:** Dành riêng cho vật phẩm thời trang/avatar không xếp chồng (mỗi item chiếm 1 ô rương riêng). Dùng opcode này cho mồi câu sẽ làm đầy 40/40 ô rương.

2. **Opcode `-24`**:
   - Trong J2ME cũ 10 năm trước, `-24` từng là shop buy opcode.
   - Nhưng trong AvatarHD 3.4.4, bảng điều phối `GlobalMessageHandler.onMessage` (RVA `0x5E5FD4`, jump table tại `0x14E311C`) điều hướng `cmd -24` sang RVA `0x5E9D6C`. Đây là hàm xử lý **`REQUEST_CITY_MAP`** (dữ liệu tile map thành phố), hoàn toàn không phải lệnh mua đồ!
   - Vì vậy server AvatarHD hoàn toàn lờ đi gói tin `-24`, không trừ tiền (`tiền: +0`), không có mồi nào được mua.

3. **Lỗi logic kiểm tra kết quả mua trong `avatarSession.ts` (False Success Bug)**:
   - Tại dòng 2006 của `avatarSession.ts`:
     ```typescript
     let successCount = 0;
     let failed = false;
     // ... lắng nghe phản hồi ...
     if (successCount === 0 && failed) {
       return false;
     }
     this.pushLog(`[câu cá] Đã mua thành công ${itemInfo.name}`);
     ```
   - Biến `failed` khởi tạo là `false`. Khi server không phản hồi gì (timeout 2s), `successCount` vẫn là `0` và `failed` vẫn là `false`.
   - Biểu thức `successCount === 0 && failed` ra `false`, code không return `false` mà chạy tiếp xuống dưới báo *"Đã mua thành công"*.

4. **Opcode chuẩn của AvatarHD cho vật phẩm xếp chồng (Stackable Items)**:
   - Native disassembly xác nhận tại RVA `0x8518C8` (`MapScr.IActionBuyStack.perform`) và RVA `0x8547b0` (`MapScr.IActionSelectedMoney.perform` khi `follow == -2`):
     Hàm gọi thẳng tới `AvatarService.doBuyItem(short idPart, int num, byte type)` tại RVA `0x96125C`.
   - Wire format gửi lên server:
     ```armasm
     52801aa1: mov w1, #0xd5   ; 0xd5 signed byte = -43 (BUY_ITEM_STACK)
     bl Message.create(-43)
     writeShort(idPart)         ; ID vật phẩm (443: Mồi cơm, 447: Mồi trùng, 448: Trứng kiến, 458: Vé câu rô...)
     writeInt(num)              ; Số lượng mua (ví dụ: 50)
     writeByte(type)            ; 1 = Xu, 2 = Lượng
     session.send(m)
     ```
   - Đây chính là opcode tạo ra item mồi câu có số lượng xếp chồng trong rương như trong `game.jpeg`.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-scope
1. **`parkService.ts`**:
   - Thêm opcode chuẩn `CMD_AVATAR_BUY_ITEM_STACK = -43`.
   - Thêm method `doBuyItemStack(idPart: number, num: number, typeMoney: number): void`.
   - Ghi chú deprecate/loại bỏ opcode `-24` và `-92` cho luồng mua mồi câu/vé câu.
2. **`avatarSession.ts`**:
   - Thay thế toàn bộ lệnh gửi mua mồi câu & vé câu sang `doBuyItemStack(itemInfo.id, quantity, itemInfo.typeMoney)`.
   - Sửa logic kiểm tra phản hồi giao dịch:
     - Lắng nghe sự kiện trừ tiền `metrics` (`cmd -3` / `UPDATE_MONEY`), sự kiện `dialog`, hoặc sự kiện `item-bought` (`cmd -92`).
     - Yêu cầu bắt buộc phải nhận được phản hồi thành công (`successCount > 0` hoặc số dư tiền giảm đúng giá trị).
     - Nếu timeout hoặc không nhận được xác nhận, đánh dấu thất bại `return false` và ghi log rõ ràng, không giả mạo thành công.

### Out-of-scope
- Không can thiệp vào máy trạng thái mini-game câu cá (`TX41`, `RX79`, `TX43`, `TX44`).
- Không đổi cấu trúc lưu cấu hình `FishingConfig`.

---

## 3. Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

### 3.1. Cấu trúc gói tin TX-43 (`BUY_ITEM_STACK`)
```text
Opcode: -43 (sbyte, 0xD5)
Payload:
  i16  idPart     // ID vật phẩm (443, 447, 448, 458, 459, 460)
  i32  num        // Số lượng mua (ví dụ: 50 mồi)
  i8   typeMoney  // Loại tiền (1 = Xu, 2 = Lượng)
```

### 3.2. Cơ chế xác nhận kết quả mua từ Server
Khi server xử lý `cmd -43`, server sẽ phản hồi:
1. Gói `cmd -3` (`UPDATE_MONEY`): server gửi số dư Xu/Lượng mới đã bị trừ (ví dụ 50 mồi cơm = 250 xu).
2. Có thể kèm gói `cmd -40` (hộp thoại thông báo) hoặc `cmd -92` (`onBuyItem` thông báo text và cập nhật tiền).
3. Client lắng nghe:
   - Nếu nhận `cmd -3` với tiền giảm, hoặc nhận `cmd -92`, hoặc dialog xác nhận thành công -> `success = true`.
   - Nếu nhận dialog lỗi (ví dụ "Không đủ tiền", "Rương đã đầy") -> `failed = true, error = reason`.
   - Hết timeout 3.000ms mà không có tín hiệu xác nhận -> `failed = true, error = "Timeout chờ phản hồi mua hàng từ server"`.

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

1. **Static Analysis & Build Verification**:
   - Chạy `npm run build` trong `avatar-web/server` để đảm bảo không lỗi kiểu dữ liệu TypeScript.
2. **Impact Analysis**:
   - Chạy `gitnexus_impact` trên các hàm sửa đổi trong `parkService.ts` và `avatarSession.ts`.
3. **Live Test trên tài khoản Game**:
   - Cho bot vào trạng thái hết mồi câu.
   - Quan sát bot di chuyển về Map 13 (Khu sinh thái).
   - Kiểm tra log gửi `TX-43` với `idPart=443, num=50, type=1`.
   - Kiểm tra server trả về trừ xu (xu giảm đúng 250 xu) và xác nhận thành công.
   - Kiểm tra bot quay lại Map 14, gửi `TX45 startFishing` và server chấp thuận (`RX45: iss=true`), tiến hành quăng cần và câu cá bình thường.
