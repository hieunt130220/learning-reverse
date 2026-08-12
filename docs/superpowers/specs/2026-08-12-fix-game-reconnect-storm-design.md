# Thiết kế sửa vòng lặp reconnect game

## Bối cảnh

Tài khoản game có thể đăng nhập và nhận dữ liệu farm bình thường, nhưng sau một
lần socket bị đóng, backend liên tục đăng nhập lại trong khoảng 4-12 giây. Log
runtime ngày 2026-08-12 cho thấy chuỗi sự kiện sau:

1. Client đăng nhập thành công và nhận `LOGIN_SUCESS (-34)`.
2. Socket đóng, `AvatarSession` hẹn một lần retry.
3. Khi timer chạy, `teardown()` gọi `GameClient.logout()` trước khi gỡ listener.
4. `logout()` phát thêm trạng thái `idle`, tạo một timer retry thứ hai.
5. Client mới đăng nhập thành công nhưng timer còn sót tiếp tục chạy và đóng
   client mới.
6. Game server bắt đầu trả `Hệ thống quá tải. Vui lòng đăng nhập lại sau 10s`
   và `Bạn đang đăng nhập quá nhanh. Vui lòng chờ`.

Một lỗi liên quan làm tình hình nặng hơn: `AvatarSession.connect()` đặt lại bộ
đếm retry ngay sau khi `GameClient.login()` trả về. Hàm này chỉ hoàn tất phần
TCP/handshake và gửi gói login; nó không chờ `LOGIN_SUCESS`. Vì vậy một attempt
bị server từ chối vẫn có thể làm backoff quay về mức đầu.

Nguyên nhân lần socket đầu tiên bị đóng chưa xác định được. `Session` hiện chỉ
phát chuỗi `socket closed`, không phân biệt server đóng, lỗi mạng hay đóng chủ
động từ backend.

## Mục tiêu

- Mỗi tài khoản chỉ có một connection attempt và một retry timer hợp lệ tại một
  thời điểm.
- Timer hoặc callback từ client cũ không thể thay đổi hay đóng client mới.
- Chỉ coi attempt thành công sau khi nhận `LOGIN_SUCESS` và chuyển sang
  `online`.
- Tôn trọng thời gian chờ do game server gửi và không đăng nhập dồn dập.
- Auto-farm bật lại ngay sau khi client online, đúng một lần cho mỗi attempt.
- Log đủ dữ liệu để phân loại lần socket bị đóng đầu tiên mà không ghi credential
  hoặc payload nhạy cảm.
- Không thay đổi REST API, schema SQLite hay UI trong phạm vi này.

## Không thuộc phạm vi

- Không reverse thêm giao thức game hoặc thay đổi opcode farm.
- Không thay đổi cấu hình hay hành vi nghiệp vụ của một chu kỳ auto-farm.
- Không thêm log bền vững vào SQLite.
- Không bảo đảm backend có thể ngăn game server chủ động đá một phiên hợp lệ;
  thay đổi này chỉ bảo đảm backend phản ứng đúng và có bằng chứng chẩn đoán.
- Không thay đổi hợp đồng `GameClient.login()` thành promise chờ kết quả login.

## Thiết kế vòng đời kết nối

### Một epoch hợp lệ

`AvatarSession` thêm một số `connectionEpoch` tăng mỗi khi tạo client mới hoặc
vô hiệu hóa client hiện tại. Mọi listener được gắn với epoch tại thời điểm tạo.
Listener chỉ được xử lý khi đồng thời thỏa:

- epoch của listener bằng epoch hiện tại;
- client phát sự kiện chính là `this.client` hiện tại.

Nhờ đó, sự kiện đến muộn từ socket/client cũ không thể đổi status, tạo timer hay
đóng client mới.

### Teardown chủ động

`teardown()` phải vô hiệu hóa epoch và gỡ listener khỏi client trước khi gọi
`logout()`. Trạng thái `idle` phát sinh do đóng chủ động vì vậy không đi vào
`onDisconnected()`.

Ba trường hợp đóng chủ động gồm:

- người dùng bấm ngắt kết nối;
- backend shutdown;
- timer retry thay client cũ bằng client mới.

Các trường hợp này không tự tạo thêm retry ngoài timer đã được quyết định trước.

### Quy tắc retry

`scheduleRetry()` chỉ được giữ một timer. Retry cơ sở đổi từ 5 giây thành 10
giây, sau đó tăng `10, 20, 40, 80...` giây, tối đa 5 phút, với jitter hiện hữu
`+-20%`.

Khi timer chạy, trình tự là:

1. Xóa tham chiếu timer đang chạy.
2. Kiểm tra `wanted`, trạng thái permanent failure và epoch.
3. Teardown client cũ theo đường đóng chủ động.
4. Tạo đúng một client/epoch mới.

Không đặt lại `retries` khi `GameClient.login()` vừa trả về. Chỉ sự kiện
`status = online` của client/epoch hiện tại mới:

- hủy timer còn sót nếu có;
- đặt `retries = 0`;
- xóa `nextRetryAt` và retry-after tạm thời;
- bật auto-farm nếu người dùng đang muốn chạy auto.

Nếu attempt chưa từng online, mỗi lần thất bại tiếp tục tăng backoff.

## Từ chối tạm thời từ game server

`GameClient` phân loại nội dung gói thông báo chung `-40`. Khi nội dung khớp các
thông báo đăng nhập quá nhanh hoặc có mẫu `sau <N>s`, client phát một sự kiện có
cấu trúc gồm lý do và thời gian chờ tối thiểu.

`AvatarSession` lưu thời gian này cho epoch hiện tại. Delay retry thực tế là giá
trị lớn hơn giữa:

- exponential backoff hiện tại;
- thời gian chờ tối thiểu từ server.

Thông báo có số giây dùng đúng số giây đó. Thông báo `Vui lòng chờ` không có số
dùng tối thiểu 10 giây. Retry-after của client cũ không được áp lên epoch mới,
và được xóa sau khi client online.

## Auto-farm sau reconnect

Auto-farm tiếp tục bật lại ngay khi client online theo lựa chọn đã duyệt.
`tryStartAuto()` chỉ được gọi từ một đường xử lý `online` hợp lệ của epoch hiện
tại. Lời gọi dự phòng ở cuối `connect()` bị loại bỏ để tránh khởi động hai chu kỳ
nếu hợp đồng bất đồng bộ của `GameClient.login()` thay đổi sau này.

Mỗi reconnect tạo một `AutoFarm` mới, nên một lần `start()` sẽ bắt đầu đúng một
chu kỳ mới. Teardown vẫn dừng `AutoFarm` và `MacroRunner` cũ trước khi đóng
client.

## Chẩn đoán TCP

`Session` thay chuỗi close chung bằng dữ liệu đóng có cấu trúc. Log phải phân
biệt được:

- `remote-end`: peer gửi FIN;
- `socket-error`: socket phát lỗi, kèm `code`, `errno`, `syscall` nếu Node cung
  cấp;
- `local-close`: backend chủ động đóng;
- `socket-close`: sự kiện close cuối cùng, kèm `hadError`.

Metadata chẩn đoán gồm:

- thời gian socket sống;
- thời điểm nhận dữ liệu cuối;
- tổng byte gửi và nhận;
- trạng thái `GameClient` tại thời điểm đóng;
- host và port đích.

`GameClient` chuyển dữ liệu này thành dòng log ngắn cho ring buffer hiện hữu.
Không log username, password, raw login packet, session cookie hay body của gói
nhạy cảm. Traffic masking hiện tại cho `LOGIN_ACC`, `LOGIN_IMEI` và
`REQUEST_REGISTER` được giữ nguyên.

## Thay đổi file dự kiến

- `avatar-web/server/src/proto/session.ts`: phân loại nguyên nhân đóng và phát
  close metadata có cấu trúc.
- `avatar-web/server/src/proto/session.test.ts`: test remote close, local close
  và metadata không chứa dữ liệu nhạy cảm.
- `avatar-web/server/src/game/client.ts`: log close metadata và phát temporary
  retry-after từ thông báo `-40`.
- `avatar-web/server/src/session/avatarSession.ts`: quản lý epoch, một timer,
  reset backoff khi online và khởi động auto đúng một lần.
- `avatar-web/server/src/session/avatarSession.test.ts`: test hồi quy reconnect
  storm, stale client, retry-after và auto start.

Không dự kiến sửa frontend, routes, database hoặc account repository.

## Kiểm thử

### Test `AvatarSession`

- Một lần drop chỉ tạo đúng một retry timer.
- Khi timer chạy, teardown không tạo timer thứ hai.
- Timer/callback thuộc epoch cũ không đóng hay đổi trạng thái client mới.
- `retries` không reset sau khi `login()` trả về nhưng client chưa online.
- `retries` reset về 0 sau sự kiện online hợp lệ.
- Đóng chủ động bằng `stop()` không tạo retry.
- Retry-after `10s` không cho retry trước 10 giây.
- Retry-after nhỏ hơn exponential backoff không làm giảm delay hiện tại.
- Auto-farm chỉ `start()` một lần trong mỗi lần chuyển online.
- `LOGIN_FAIL (-35)` vẫn là permanent failure và không retry.

### Test `Session` và `GameClient`

- Server test gửi FIN tạo nguyên nhân `remote-end`.
- `Session.close()` tạo nguyên nhân `local-close`.
- Socket error giữ được error metadata và `hadError`.
- Close metadata có thời gian sống và bộ đếm byte hợp lệ.
- Thông báo `-40` có `sau 10s` phát retry-after 10 giây.
- Thông báo đăng nhập nhanh không có số dùng mức tối thiểu 10 giây.
- Log và traffic snapshot không chứa mật khẩu hay body login rõ.

### Lệnh xác minh

```bash
cd avatar-web/server
npm test
npm run typecheck
cd ../..
git diff --check
```

Test runtime với game server thật chỉ thực hiện khi người dùng chủ động kết nối
tài khoản. Tiêu chí quan sát là một lần drop chỉ dẫn tới một lần đăng nhập lại;
sau `online`, không phát sinh attempt mới nếu socket hiện tại vẫn sống. Không cố
ý tạo reconnect liên tục để tránh làm tài khoản bị giới hạn hoặc khóa.

## Tiêu chí chấp nhận

- Không còn chuỗi login mới mỗi 4-12 giây do timer nội bộ còn sót.
- Mỗi account snapshot tại mọi thời điểm có nhiều nhất một `nextRetryAt` hợp lệ.
- Backoff chỉ reset sau `online`, không reset ở giai đoạn handshaking hoặc
  logging-in.
- Backend không retry sớm hơn thời gian game server yêu cầu.
- Auto-farm bật lại ngay và đúng một lần sau reconnect thành công.
- Log phân biệt được remote close, socket error và local close, kèm timing/byte
  metadata nhưng không lộ credential.
- Toàn bộ backend test, typecheck và `git diff --check` đạt.

## Rủi ro và giới hạn xác minh

GitNexus CLI đã index repository thành công, nhưng GitNexus MCP impact analysis
không đọc được index do storage version của MCP là 40 trong khi database mới là
42. Vì vậy blast radius trong thiết kế này được xác nhận bằng source trực tiếp:
`SessionManager`, session routes, bootstrap và các test phiên là các consumer
chính; API ngoài không đổi. Trước khi implementation, cần chạy lại impact nếu
MCP đã tương thích hoặc tiếp tục ghi rõ giới hạn công cụ này.
