# Thiết Kế Bổ Sung Cấu Hình Mật Khẩu Rương Cho Chest-Probe và Use-Item-Probe

> **Ngày lập:** 2026-09-25  
> **Topic:** `chest-password-probe`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Hệ thống rương đồ cá nhân (`CUSTOM_CHEST` / `BoxScr`) trong game Avatar hỗ trợ cài đặt mật khẩu rương (pass rương) để bảo vệ tài sản người chơi.

Hiện trạng:
- `chest-probe.ts`: Khi quét tài khoản có mật khẩu rương, server phản hồi gói tin `RX -87 [subCmd=8, subCmd2=3]`. Probe chỉ in thông báo `🔒 RƯƠNG ĐÃ ĐƯỢC CÀI MẬT KHẨU! Cần gửi mật khẩu để mở rương.` rồi dừng lại mà không mở được rương để lấy danh sách item.
- `use-item-probe.ts`: Chỉ quét hành trang cá nhân (`CONTAINER` qua `TX -17`). Chưa hỗ trợ mở rương kiểm tra tình trạng vật phẩm trong rương đồ, và chưa có cơ chế truyền mật khẩu rương khi người chơi cần kiểm tra rương trước khi sử dụng item.

Mục tiêu:
1. Thêm tham số truyền mật khẩu rương qua CLI argument (kèm fallback đọc từ env `CHEST_PASS`) cho cả `chest-probe.ts` và `use-item-probe.ts`.
2. Hiện thực chuẩn wire protocol mở rương có mật khẩu: `TX -87 [i8 8, i8 0, utf passBag, utf passChest]` (giải mã từ `GlobalService.doSendPassOpenChest` @ `0x69E430`).
3. `chest-probe.ts`: Khi phát hiện rương có mật khẩu (hoặc chủ động mở rương), tự động gửi mật khẩu để mở khóa và in ra toàn bộ item trong rương đồ + số ô rương.
4. `use-item-probe.ts`: Bổ sung bước mở rương kiểm tra (nếu có mật khẩu rương thì gửi mở khóa), in danh sách item trong rương để quan sát trước khi tiếp tục flow kiểm tra hành trang và sử dụng item.

---

## 2. Phạm Vi (Scope)

### In-Scope
1. **`avatar-web/server/src/tools/chest-probe.ts`**:
   - Cú pháp CLI mới:
     ```bash
     npx tsx --env-file=.env src/tools/chest-probe.ts [accountId] [chestPass]
     ```
   - Nhận `chestPass` từ `process.argv[3] ?? process.env.CHEST_PASS ?? ''`.
   - Bắt sự kiện `RX -87 subCmd=8, subCmd2=3`: Nếu có `chestPass`, tự động gửi ngay gói `TX -87 [8, 0, "", chestPass]`.
   - Nếu `chestPass` được truyền ngay từ đầu, cập nhật bước `reqChestItems` gửi kèm `utf` chuỗi rỗng và `chestPass`.
   - Bắt sự kiện `RX -87 subCmd=8, subCmd2=4`: In thông báo lỗi / sai mật khẩu từ server nếu nhập sai pass.

2. **`avatar-web/server/src/tools/use-item-probe.ts`**:
   - Cú pháp CLI mới:
     ```bash
     npx tsx --env-file=.env src/tools/use-item-probe.ts [accountId] [partId] [times] [chestPass]
     ```
   - Nhận `chestPass` từ `process.argv[5] ?? process.env.CHEST_PASS ?? ''`.
   - Lắng nghe `msg.command === -87` (`CUSTOM_CHEST`): giải mã `subCmd=8` với các trường hợp `subCmd2=0` (in danh sách item trong rương), `subCmd2=3` (rương có pass, gửi pass nếu có), `subCmd2=4` (thông báo lỗi/sai pass).
   - Thêm bước gửi yêu cầu kiểm tra rương (`TX -87 [8, 3]`) sau khi login hoàn tất. Nếu có rương thì hiển thị để đối chiếu, sau đó mới sang bước `TX -17 (CONTAINER)` và thực hiện `TX -18 (USING_PART)`.

### Out-of-Scope
- Không tự động rút đồ từ rương sang hành trang (giữ theo lựa chọn "Chỉ mở rương kiểm tra").
- Không can thiệp logic của `autoFarm` hoặc các dịch vụ production khác.
- Không tạo unit test (tuân thủ nguyên tắc **KHÔNG TDD** của dự án).

---

## 3. Thiết Kế Kỹ Thuật

### 3.1. Wire Protocol Mật Khẩu Rương (Reverse Engineered từ libil2cpp.so arm64)

```
Client                                                  Server
  |                                                       |
  | -------- TX -87 [i8 8, i8 3] -----------------------> | (doRequestOpenChestScr)
  |                                                       |
  | <------- RX -87 [i8 8, i8 3] ------------------------ | (Rương đã cài mật khẩu)
  |                                                       |
  | -------- TX -87 [i8 8, i8 0, utf "", utf chestPass] ->| (doSendPassOpenChest)
  |                                                       |
  | <------- RX -87 [i8 8, i8 0, i16 count, ...] -------- | (Mở rương thành công)
  |   (hoặc)                                              |
  | <------- RX -87 [i8 8, i8 4, i8 flag, utf msg] ------ | (Sai mật khẩu / Lỗi)
```

Chi tiết cấu trúc gói tin `TX -87` mở rương có mật khẩu:
- `command`: `-87`
- `writeByte(8)`: `subCmd = 8` (Nhóm lệnh rương nhà)
- `writeByte(0)`: `subCmd2 = 0` (Gửi mật khẩu mở rương)
- `writeUTF(passBag)`: `""` (Mật khẩu hành trang / túi đồ, để trống nếu không có)
- `writeUTF(chestPass)`: Chuỗi mật khẩu rương

### 3.2. Cấu Trúc Thay Đổi Trong Các File

#### File 1: `avatar-web/server/src/tools/chest-probe.ts`
- Đọc tham số `const chestPass = process.argv[3] ?? process.env.CHEST_PASS ?? '';`
- Hàm gửi mật khẩu mở rương:
  ```ts
  function sendChestPass(pass: string) {
    const msg = Message.create(-87);
    msg.writer!.writeByte(8);
    msg.writer!.writeByte(0);
    msg.writer!.writeUTF('');
    msg.writer!.writeUTF(pass);
    client.session.send(msg);
  }
  ```
- Khi nhận `subCmd === 8 && subCmd2 === 3`:
  - In log rương có pass.
  - Nếu `chestPass` có giá trị $\rightarrow$ gọi `sendChestPass(chestPass)`.
  - Nếu không có $\rightarrow$ in hướng dẫn cách truyền pass qua CLI: `[accountId] [chestPass]`.
- Cập nhật nhánh `subCmd2 === 0` và `subCmd2 === 4` để hiển thị rõ kết quả xác thực mật khẩu.

#### File 2: `avatar-web/server/src/tools/use-item-probe.ts`
- Đọc tham số `const chestPass = process.argv[5] ?? process.env.CHEST_PASS ?? '';`
- Bổ sung handler lắng nghe `msg.command === -87` (`CUSTOM_CHEST`):
  - `subCmd === 8 && subCmd2 === 0`: Giải mã và hiển thị tóm tắt các item trong rương đồ.
  - `subCmd === 8 && subCmd2 === 3`:
    - Nếu có `chestPass` $\rightarrow$ gửi `TX -87 [8, 0, "", chestPass]`.
    - Nếu không có $\rightarrow$ in thông báo rương có mật khẩu nhưng không truyền `chestPass`.
  - `subCmd === 8 && subCmd2 === 4`: In thông báo lỗi pass nếu có.
- Trình tự thực thi:
  1. Login hoàn tất.
  2. Gửi `TX -87 [8, 3]` để mở rương kiểm tra (chờ 2s để nhận danh sách rương).
  3. Gửi `TX -17` để lấy `CONTAINER` (hành trang).
  4. Xác định vị trí `targetPartId` trong hành trang và thực hiện `TX -18 (USING_PART)`.

---

## 4. Verification Plan

1. **Static Analysis & Type Check**:
   - Chạy `npm run build` trong `avatar-web/server` để đảm bảo không lỗi TypeScript / cú pháp.
2. **Kiểm tra thực tế với chest-probe**:
   - Chạy lệnh không pass: `npx tsx --env-file=.env src/tools/chest-probe.ts 1`
   - Chạy lệnh có pass: `npx tsx --env-file=.env src/tools/chest-probe.ts 1 <mat_khau_ruong>`
   - Xác nhận server trả về `subCmd2 === 0` và in danh sách item trong rương.
3. **Kiểm tra thực tế với use-item-probe**:
   - Chạy lệnh kiểm tra rương trước khi dùng: `npx tsx --env-file=.env src/tools/use-item-probe.ts 1 6383 1 <mat_khau_ruong>`
   - Xác nhận probe mở rương kiểm tra thành công và sau đó dùng item bình thường.
