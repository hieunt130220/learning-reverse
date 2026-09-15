# Thu hoạch và trồng lại theo xác nhận từng ô

## Mục tiêu và bối cảnh

Loại bỏ JOIN toàn farm sau mỗi ô thu hoạch trên luồng thành công; giữ thứ tự thu hoạch → làm đất → trồng cho từng ô. Đồng bộ cuối vòng và khi kết quả không rõ. Không coi đã gửi lệnh hoặc timeout là thành công.

Source hiện tại chỉ log Cmd 64/66, waitForReply chỉ khớp command và không gỡ listener khi thành công. JOIN thay farmState nhưng AutoFarm tiếp tục dùng snapshot đầu vòng. Sự kiện farm còn được phát bởi Cmd 101 nên không xác nhận được JOIN.

## Bằng chứng giao thức

- `avatar-re/notes/farm.md`: RX 64 đọc byte + short; gói ghi nhận `2b 00c0` ứng với ô 43. RX 66 đọc int + byte + byte.
- `avatar-re/il2cpp_out/dump.cs:280692`: `onPlantSeed(int idUser, int indexCell, int idSeed)` tại RVA 0x63AB28.
- `avatar-re/il2cpp_out/dump.cs:280698`: `onHarvestTree(int indexCell2, int number)` tại RVA 0x63B08C.
- Cmd 66 với seed -1 dùng làm đất; gốc sau thu vẫn giữ idTree và time=-1. Không coi gốc là ô trống.
- Các bằng chứng trên là tài liệu reverse engineering và metadata đang có; chưa có xác nhận live trong task này. Trước khi tuyên bố chấp nhận runtime cần đối chiếu packet làm đất/trồng và snapshot cuối lượt.

## Phạm vi

In-scope: giải mã xác nhận cây, chờ đúng thao tác, vòng cây AutoFarm, đồng bộ farm có phân biệt nguồn, cleanup listener/timer liên quan. Giữ plan chọn hạt, auto-buy, ngân sách, nhịp nghỉ và chế độ chạy hiện tại. Không tạo test file, không TDD.

Out-of-scope: UI mới, thay chính sách mua/bán, refactor vật nuôi/bếp, thay wire TX, tự chọn tài khoản để chạy probe, commit/push công việc khác.

## Kiến trúc và interfaces

### Files

- `avatar-web/server/src/game/farmData.ts`: decoder thu hoạch và trồng/làm đất, kiểm tra độ dài trước khi đọc.
- `avatar-web/server/src/game/client.ts`: phát sự kiện typed cho xác nhận đã decode; thêm sự kiện riêng cho snapshot JOIN hợp lệ; cleanup waiter chung.
- `avatar-web/server/src/autoFarm.ts`: xử lý tuần tự xác nhận từng ô, trạng thái thao tác cục bộ, fallback snapshot, cleanup khi dừng.
- `avatar-re/notes/farm.md`: ghi rõ nguồn bằng chứng và kết quả xác minh sau triển khai.

### Data contracts

- Harvest reply: `{ cellIndex: number, quantity: number }`, từ byte chỉ số ô và short số lượng. Không tự gán farm ID vào payload nhận.
- Plant reply: `{ idUser: number, cellIndex: number, seedId: number }`, seed đọc signed byte để giữ -1.
- Full snapshot event: FarmState đã decode thành công từ Cmd 69; không dùng sự kiện farm chung làm ACK JOIN. Giữ sự kiện farm cũ cho các consumer hiện hữu.
- Kết quả chờ: confirmed, timeout hoặc cancelled. Packet sai cấu trúc không xác nhận thành công.

### Luồng thành công

1. Dùng snapshot đầu vòng để chọn ô; lưu previousTreeId phục vụ chọn giống cũ.
2. Đăng ký waiter trước khi gửi thu hoạch, khớp index và ownership client/farm/generation hiện tại. Chỉ một thao tác cây outstanding.
3. Nhận Cmd 64 hợp lệ cho đúng ô: đánh dấu thao tác đã thu trong trạng thái cục bộ. Không tự tính kho nông sản từ snapshot cũ.
4. Gửi làm đất và chờ Cmd 66 khớp idUser của farm đang thao tác, index, seed=-1. Không trồng nếu chưa xác nhận làm đất.
5. Áp dụng plan hiện có. Nếu trồng: chờ Cmd 66 đúng idUser/index/seed. Chỉ cập nhật số hạt cục bộ theo kết quả rõ ràng; khi không rõ, không tái sử dụng giả định kho cho lệnh tiếp theo.
6. Không chăm sóc cây vừa thu/trồng bằng cờ care của snapshot cũ. Sang ô tiếp theo sau khoảng nghỉ hiện tại.
7. Tận dụng đồng bộ cuối vòng hiện có, chờ đúng full snapshot. Không thêm JOIN giữa các ô trên happy path.

Trạng thái tiến trình từng ô là dữ liệu cục bộ của vòng; không dựng vitality/care giả vào farmState công khai từ ACK thiếu trường. UI nhận trạng thái đầy đủ sau đồng bộ cuối vòng. Điều này tránh biến sự kiện xác nhận thao tác thành snapshot farm giả.

### Timeout, lỗi và lifecycle

- Timeout thao tác: không gửi bước phụ thuộc. Xin full snapshot một lần và đọc lại ô bằng index từ snapshot mới; refresh kho nếu lệnh trồng có kết quả không rõ.
- Thu timeout: chỉ tiếp tục làm đất nếu snapshot mới chứng minh ô đã thu; nếu cây còn nguyên hoặc không xác định, bỏ ô trong lượt này. Không tự thu lại ngay.
- Làm đất timeout: chỉ trồng khi snapshot mới chứng minh ô trống.
- Trồng timeout: không gửi lại trong lượt này; đối chiếu snapshot và kho, ghi kết quả rõ ràng hoặc chưa xác định.
- Fallback snapshot timeout hoặc farm/ownership thay đổi: kết thúc giai đoạn cây, không phát thêm lệnh dựa trên dữ liệu cũ.
- Stop/disconnect/generation thay đổi phải hủy waiter và timer; gỡ listener ở mọi nhánh thành công, timeout, hủy và lỗi gửi.
- Cmd 64 không có farm/request ID: tuần tự hóa và ownership giảm nhầm phản hồi nhưng không tạo được correlation tuyệt đối. Không retry cùng ô trong cùng lượt sau timeout; không tuyên bố protocol có request ID.
- Cmd 101 không được đánh thức chờ JOIN. Không thay timestamp full snapshot vì chỉ nhận ACK cây.

## Các hướng đã cân nhắc

1. Chọn: ACK từng ô, đồng bộ cuối vòng. Giữ thứ tự hiện tại và giảm JOIN trên happy path.
2. Thu cả loạt rồi JOIN rồi trồng: giảm JOIN nhưng thay thứ tự xử lý, vẫn cần xác định thu thành công; không chọn.
3. Chỉ xóa JOIN: vẫn dùng ACK theo command và snapshot cũ, không đáp ứng yêu cầu xác nhận an toàn.

## Verification plan

- Trước chỉnh symbol chạy GitNexus impact; báo HIGH/CRITICAL. Trước commit chạy detect_changes.
- Kiểm tra dung lượng trước build; chỉ dùng một scratch nếu cần probe và dọn artifact thuộc task.
- Chạy typecheck và các test sẵn có liên quan sau production code; không thêm test file. Nếu test cũ mô phỏng ACK không đủ contract, báo giới hạn và xử lý trong plan, không coi fake ACK là bằng chứng live.
- Kiểm tra decoder bằng payload đã ghi nhận và metadata; payload thiếu byte, sai ô/farm/seed không được hoàn tất waiter.
- Kiểm tra listener không tăng sau thành công/timeout/stop; waiter đăng ký trước send; packet Cmd 101 không hoàn tất JOIN.
- Live acceptance cần tài khoản/phiên và ô phù hợp đã được xác định: đối chiếu TX/RX 64, 66(-1), 66(seed); snapshot cuối có cây mới, kho tương ứng. Không chạy tool cũ mặc định account 1 chỉ để lấy bằng chứng.
- Với N ô chín thành công: không có JOIN do thu hoạch giữa N ô; vẫn có JOIN đầu/cuối vòng và fallback khi lỗi. Báo số packet quan sát thực tế, không suy ra tốc độ nếu chưa đo.

## Trạng thái duyệt

User đã duyệt Spec và Plan. Production đã triển khai; xem phần kết quả thực thi trong Plan để biết bằng chứng, regression fixture chưa cập nhật và live acceptance chưa chạy.
