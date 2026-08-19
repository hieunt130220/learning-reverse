# Decode Công Thức Nấu Ăn Từ APK/Packet Cmd 76

## 1. Mục tiêu & bối cảnh

Catalog công thức hiện tại trong `avatar-web` là dữ liệu hard-code được suy đoán từ
reverse-engineering trước đó. APK/binary chỉ xác nhận cấu trúc `Food` và trình tự đọc
dữ liệu; tên món, nguyên liệu, thời gian và thành phẩm được server gửi động trong phần
catalog của packet Cmd 76 (`GET_TREE_INFO`). Vì vậy catalog hard-code có thể sai ID,
nguyên liệu hoặc số lượng.

Mục tiêu là làm cho backend và frontend dùng catalog đã decode từ packet Cmd 76 làm
nguồn sự thật, có kiểm tra biên và không tự dùng fallback sai khi packet chưa có dữ liệu.

## 2. Phạm vi

### Trong phạm vi

- Xác định và hoàn thiện decoder phần `Food[]` trong luồng Cmd 76 theo schema đã xác nhận
  từ `FarmData.readTreeInfo`:
  `i16 id`, UTF name, `i16 productID`, `i16 cookTime`, `i16 numMaterials`, các cặp
  `i16 materialId`/`i16 count`, rồi `i8 level`.
- Validate số lượng món, độ dài UTF, số loại nguyên liệu, ID và thời gian để packet lỗi
  không làm lệch toàn bộ phần farm data.
- Giữ catalog động trên `GameClient`/snapshot/session và truyền nguyên vẹn sang Web UI.
- Loại bỏ việc dùng `DEFAULT_FOOD_CATALOG`/`FALLBACK_RECIPES` như nguồn thay thế khi
  server chưa gửi catalog; trạng thái chưa có catalog phải được biểu diễn rõ ràng.
- Cập nhật auto-cooking để không chọn công thức đoán khi catalog rỗng; ghi log lý do bỏ qua.
- Ghi lại bằng chứng decode (raw packet tối thiểu hoặc JSON export có nguồn/offset) để đối
  chiếu từng công thức sau này.

### Ngoài phạm vi

- Không suy đoán hoặc tự phát minh công thức khi không có packet Cmd 76.
- Không thay đổi opcode gửi nấu/thu hoạch hoặc giao thức Cmd 91/92/93.
- Không chỉnh logic cây trồng, vật nuôi, kho hoặc UI không liên quan.
- Không viết test trước production code; test bổ sung chỉ sau khi decoder/luồng dữ liệu hoàn tất.

## 3. Thiết kế kỹ thuật

### Nguồn dữ liệu và luồng

```text
Cmd 76 raw bytes
  -> FarmData decoder (bounded cursor + validation)
  -> FoodRecipe[] động trên GameClient
  -> AvatarSession snapshot / WebSocket
  -> CookingPanel + KitchenPlanEditor
  -> AutoFarm chỉ chọn recipe có trong catalog động
```

### Thành phần dự kiến

- `avatar-web/server/src/game/farmData.ts`: kiểu dữ liệu, cursor/decoder catalog Cmd 76,
  lỗi/validation và metadata nguồn decode.
- `avatar-web/server/src/game/client.ts`: thay thế khởi tạo catalog mặc định bằng trạng
  thái rỗng cho tới khi Cmd 76 được decode thành công; phát event cập nhật catalog.
- `avatar-web/server/src/session/avatarSession.ts` và các route/snapshot liên quan:
  chuyển catalog động, không hồi sinh fallback cũ.
- `avatar-web/server/src/autoFarm.ts`: nếu có kế hoạch recipe nhưng catalog chưa sẵn sàng
  hoặc recipe ID không tồn tại, bỏ qua an toàn và ghi log.
- `avatar-web/web/src/accounts/panels/CookingPanel.tsx` và
  `avatar-web/web/src/accounts/kitchenPlan.ts`: dùng catalog từ snapshot; hiển thị trạng
  thái chưa đồng bộ thay vì danh sách hard-code.
- Tài liệu/bằng chứng dưới `avatar-re/notes/` hoặc `docs/superpowers/` chứa mẫu packet,
  offset và kết quả decode; không ghi đè raw capture gốc.

### Quy tắc validation

- Cursor phải dừng an toàn nếu thiếu byte hoặc UTF length vượt phần còn lại.
- `totalFoods` và `numMaterials` phải nằm trong giới hạn hợp lý; không cấp phát vô hạn.
- ID món/nguyên liệu, product ID, thời gian và level phải là giá trị hợp lệ theo kiểu wire;
  bản ghi lỗi bị loại hoặc làm packet bị đánh dấu invalid, không được tạo catalog một phần
  mà không có trạng thái cảnh báo.
- Catalog chỉ được thay thế sau khi decode hoàn tất và hợp lệ; lỗi giữ catalog trước đó
  (nếu có) và phát cảnh báo.

## 4. Kế hoạch kiểm chứng

- Dùng packet Cmd 76 thực tế đã lưu để kiểm tra số món, offset cuối và từng trường của
  một số bản ghi đại diện.
- Chạy focused server tests cho decoder, catalog rỗng, catalog cập nhật và auto-cook khi
  recipe không tồn tại.
- Chạy build/typecheck web và kiểm tra UI thủ công: trước Cmd 76 hiển thị trạng thái chờ;
  sau Cmd 76 hiển thị đúng tên/ID/nguyên liệu; không còn danh sách 35 món fallback.
- Chạy `git diff --check` và `gitnexus_detect_changes` trước khi commit (nếu user yêu cầu
  commit); báo riêng phần kiểm chứng chưa thực hiện được.

## 5. Tiêu chí hoàn thành

- Có decoder Cmd 76 được chứng minh bằng packet/raw offsets.
- Không còn đường code nào tự dùng catalog 35 món hard-code khi catalog động chưa có.
- Auto-cooking không gửi recipe ID không tồn tại trong catalog động.
- Backend và frontend hiển thị cùng một `FoodRecipe[]` sau khi đồng bộ.
