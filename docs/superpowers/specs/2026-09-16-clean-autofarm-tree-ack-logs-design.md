# Dọn bớt log ACK và tinh gọn nhật ký cây trồng AutoFarm

## Mục tiêu & Bối cảnh

### Bối cảnh
Quy trình 3 pha (Thu hoạch & Làm đất → 1 Snapshot Gate → Trồng & Chăm sóc) đã chạy thực tế thành công:
- Khớp 100% số lượng nông sản (+1.027 cho 24 ô) và hạt giống.
- Thời gian chu kỳ giảm từ 93s xuống 24s.
- Không còn timeout làm đất, chỉ có đúng 1 lần snapshot farm.

### Vấn đề cần giải quyết
Nhật ký (log) hiện tại còn quá nhiều dòng thừa / debug:
1. **Raw hex packet**: `server trả lời cmd 64: 000029` và `server trả lời cmd 66: 000f56690002` được emit ở mỗi ô trong `client.ts`. Giao thức đã ổn định nên không cần log hex ra màn hình console nữa.
2. **Log dài dòng lặp đi lặp lại từ ngữ ACK**:
   - `[cây] ô X: thu hoạch xác nhận qua ACK (+41)`
   - `[cây] ô X: đã gửi làm đất (chờ xác nhận snapshot)`
   - `[cây] ô X: trồng #2 xác nhận qua ACK`
3. **Mục tiêu**: Dọn sạch các log ACK kỹ thuật. Mỗi ô chỉ để lại thông tin súc tích: thu hoạch, làm đất, trồng cây mới.

---

## Phạm vi (Scope)

### In-scope
- `avatar-web/server/src/game/client.ts`: Gỡ bỏ dòng emit log hex raw cho Cmd 64 và Cmd 66 (vẫn giữ nguyên việc decode và emit typed event `farm-harvest-reply`, `farm-plant-reply`).
- `avatar-web/server/src/autoFarm.ts`: Tinh gọn log cây trồng theo 1 trong 2 phương án format bên dưới.

### Out-of-scope
- Giữ nguyên toàn bộ logic 3 pha và các safety guards.
- Không thay đổi wire protocol, không đổi timing, không tạo test files.

---

## Thiết kế chi tiết & Format đề xuất

### 1. Gỡ bỏ log thô trong `client.ts`
Tại `GameClient.onMessage`:
- Xoá `this.emit('log', `server trả lời cmd 64: ${msg.getData().toString('hex')}`);`
- Xoá `this.emit('log', `server trả lời cmd 66: ${msg.getData().toString('hex')}`);`

### 2. Format nhật ký cho từng ô trong `autoFarm.ts` (Đã chọn: Phương án B — Realtime theo từng pha)

- **Pha 1 (Thu hoạch & làm đất)**: Gộp vào 1 dòng duy nhất khi hoàn tất gửi lệnh dọn đất:
  `[cây] ô X: thu hoạch (+Y), làm đất`
  *(Nếu ô trống sẵn không cần thu hoạch: không in ở Pha 1)*
- **Pha 3 (Gieo hạt mới)**: In ngắn gọn khi nhận ACK trồng thành công:
  `[cây] ô X: trồng #Z`
- **Pha 3 (Chăm sóc)**: Giữ format hiện tại:
  `[cây] ô X: tưới #100, bón phân`
  *(Các ô không có việc: giữ format `[cây] ô X: không có việc`)*

### Kết quả hiển thị mẫu cho 1 ô (ô 0):
```text
[cây] ô 0: thu hoạch (+41), làm đất
...
[nông trại] snapshot xác nhận 24 ô đất trống sẵn sàng trồng
...
[cây] ô 0: trồng #2
```
Toàn bộ các dòng log kỹ thuật sau bị loại bỏ:
- `server trả lời cmd 64: 000029`
- `server trả lời cmd 66: 000f56690002`
- `[cây] ô 0: đã gửi làm đất (chờ xác nhận snapshot)`
- Cụm từ `xác nhận qua ACK` trong tất cả các dòng log cây.

---

## Verification Plan

1. `npm run typecheck`: Không có lỗi TypeScript.
2. Chạy test suite sẵn có: 32/32 tests pass.
3. Kiểm tra diff: Không làm mất emit event `farm-harvest-reply` và `farm-plant-reply`.
