# Daily Attendance Auto Farm — Design Document

> **Spec:** `docs/superpowers/specs/2026-08-26-daily-attendance-auto-farm-design.md`
> **Luồng liên quan:** `avatar-web/server/src/session/avatarSession.ts`, `avatar-web/server/src/game/client.ts`, `avatar-web/server/src/autoFarm.ts`
> **Nguồn reverse hiện có:** `avatar-re/notes/login.md`, `avatar-re/notes/protocol.md`, `avatar-re/frida_scripts/opcodes.ts`

## 1. Mục tiêu & Bối cảnh

### Bối cảnh

`avatar-web` đã có tự động nhận thưởng nhiệm vụ hằng ngày và mở rương điểm ở cuối `AutoFarm.runCycle`. Luồng này dùng command `-87`, prefix `4`, và là hệ thống nhiệm vụ farm; nó không phải chức năng điểm danh đăng nhập hằng ngày.

Repository hiện chưa có command ID, payload, decoder, packet capture hoặc ghi chú reverse nào xác định protocol điểm danh đăng nhập. Vì vậy không được suy đoán rằng protocol nhiệm vụ hằng ngày có thể dùng cho điểm danh.

Auto farm hiện bắt đầu từ `AvatarSession.onOnline` sau khi `GameClient` nhận `LOGIN_SUCESS (-34)`. `onOnline` có guard theo connection epoch, nhưng đang gọi `resumeDesiredAutomation` mà không có bước điểm danh. Ngoài ra, cấu hình mặc định `logoutAfterCycle: true` khiến mỗi chu kỳ có thể tạo một lần đăng nhập mới.

### Mục tiêu

1. Reverse-engineer chính xác protocol điểm danh đăng nhập từ APK và packet thật.
2. Cung cấp API typed ở tầng game client để gửi yêu cầu và phân loại phản hồi điểm danh.
3. Chạy điểm danh một lần sau mỗi lần đăng nhập thành công, trước khi bắt đầu farm automation.
4. Giữ điểm danh ở chế độ best-effort: lỗi, timeout hoặc phản hồi chưa hiểu chỉ ghi log và không chặn auto farm.
5. Giữ luồng nhiệm vụ hằng ngày hiện có độc lập và không thay đổi hành vi của nó.

## 2. Phạm vi (Scope)

### In-scope

- Truy vết APK/IL2CPP để tìm màn hình, service method và command liên quan điểm danh.
- Thu packet ở các trạng thái chưa nhận, nhận thành công và đã nhận trong ngày.
- Xác định command ID, subcommand/action, payload TX, payload RX và dialog/error liên quan.
- Ghi bằng chứng reverse vào một note mới trong `avatar-re/notes/`.
- Bổ sung serializer/service method cho request điểm danh sau khi wire contract đã được xác minh.
- Bổ sung decoder và result contract phân biệt tối thiểu:
  - nhận thưởng thành công;
  - đã điểm danh hôm nay;
  - server từ chối/phản hồi lỗi;
  - timeout hoặc phản hồi không xác định.
- Điều phối điểm danh trong `AvatarSession` trước `resumeDesiredAutomation`.
- Gửi yêu cầu ở mỗi lần đăng nhập thành công, bao gồm đăng nhập lại sau logout/reconnect.
- Ghi kết quả vào nhật ký phiên hiện có.

### Out-of-scope

- Không dùng command `-87` của nhiệm vụ hằng ngày làm điểm danh nếu packet thật không chứng minh.
- Không đoán command ID, field width, payload hoặc success condition.
- Không lưu ngày điểm danh ở database hoặc local state; server là nguồn sự thật.
- Không retry trong cùng một lần đăng nhập.
- Không thêm cài đặt bật/tắt trên web UI; điểm danh là hành vi mặc định của luồng auto farm.
- Không sửa logic chăm cây, vật nuôi, bếp, sạp hoặc nhiệm vụ hằng ngày trong `AutoFarm.runCycle`.
- Không tạo test file trừ khi user yêu cầu trực tiếp; nếu bổ sung test vào file hiện có cũng chỉ thực hiện sau production code khi user yêu cầu test.
- Không triển khai production bằng protocol chưa được xác minh. Nếu reverse chưa đủ bằng chứng, implementation dừng tại báo cáo kết quả điều tra.

### Input

- Một `GameClient` vừa chuyển sang trạng thái `online` sau `LOGIN_SUCESS` hợp lệ.
- Connection epoch hiện tại của `AvatarSession`.
- Wire contract điểm danh đã được xác minh từ APK/packet thật.

### Output

Một kết quả typed nội bộ, dự kiến theo semantic contract sau; tên/field cuối cùng được chốt sau reverse:

```ts
type DailyAttendanceResult =
  | { status: 'claimed'; rewardSummary?: string }
  | { status: 'already-claimed' }
  | { status: 'rejected'; reason?: string }
  | { status: 'timeout' }
  | { status: 'unknown-response'; command: number; payloadHex: string };
```

Kết quả được chuyển thành log dễ hiểu. Mọi nhánh đều cho phép lifecycle tiếp tục sang farm automation nếu connection/epoch vẫn hợp lệ.

## 3. Thiết kế Reverse-Engineering

### 3.1 Ma trận capture bắt buộc

Thu packet với cùng một tài khoản hoặc các tài khoản có trạng thái phù hợp:

| Ca | Trạng thái ban đầu | Thao tác | Bằng chứng cần lưu |
|---|---|---|---|
| A | Chưa điểm danh hôm nay | Đăng nhập, chưa mở màn hình | Packet tự động sau login để loại nhiễu |
| B | Chưa điểm danh hôm nay | Mở màn hình điểm danh | Request lấy trạng thái và response |
| C | Chưa điểm danh hôm nay | Bấm nhận thưởng | Request claim, response, dialog và thay đổi ví/kho |
| D | Đã điểm danh hôm nay | Mở lại màn hình | State biểu diễn đã nhận |
| E | Đã điểm danh hôm nay | Thử claim lại nếu UI cho phép | Response idempotent hoặc lỗi server |

Mỗi capture phải ghi timestamp, hướng TX/RX, command, payload hex và thao tác UI tương ứng. Packet login/keepalive/farm không liên quan phải được đánh dấu để tránh gán nhầm.

### 3.2 Truy vết APK

1. Tìm chuỗi hiển thị liên quan điểm danh/phần thưởng đăng nhập trong language/static data.
2. Từ UI command/action, truy tới service method gửi `Message`.
3. Dùng IL2CPP metadata và ARM64 disassembly để xác định:
   - command constant;
   - thứ tự lời gọi `writeByte/writeShort/writeInt/writeUTF`;
   - nhánh request lấy trạng thái và request claim;
   - handler đọc response.
4. Đối chiếu opcode map hiện có và cập nhật parser/opcode note nếu command chưa được đặt tên.
5. Chỉ coi wire contract đã chốt khi static evidence và packet thật đồng thuận, hoặc khi packet thật cho kết quả lặp lại rõ ràng trong ít nhất hai trạng thái nghiệp vụ.

### 3.3 Deliverable reverse

Tạo `avatar-re/notes/daily-attendance.md` gồm:

- tên class/method và RVA nếu xác định được;
- command/subcommand;
- layout TX/RX với field width;
- packet mẫu đã ẩn dữ liệu nhạy cảm;
- mapping status/result;
- hành vi khi claim lại;
- thay đổi phần thưởng quan sát được;
- các giới hạn hoặc field chưa hiểu.

Nếu chưa xác minh được request claim hoặc success response, note phải nói rõ giới hạn và production integration không được bắt đầu.

## 4. Thiết kế Kiến trúc & Giải pháp Kỹ thuật

### 4.1 Ranh giới module

| File/module | Vai trò |
|---|---|
| `avatar-re/notes/daily-attendance.md` | Nguồn sự thật của kết quả reverse và packet đã xác minh |
| `avatar-re/frida_scripts/opcodes.ts` | Bổ sung tên command nếu opcode mới đã được xác minh |
| `avatar-re/frida_scripts/parser.ts` hoặc parser tương ứng | Decode packet phục vụ capture/reverse nếu cần |
| `avatar-web/server/src/game/*Service.ts` | Serialize request điểm danh theo pattern service hiện có; file cụ thể phụ thuộc owner protocol tìm được từ APK |
| `avatar-web/server/src/game/*Data.ts` | Decoder thuần và typed result/state nếu response có payload cấu trúc |
| `avatar-web/server/src/game/client.ts` | API mức cao, correlate response và expose kết quả điểm danh |
| `avatar-web/server/src/session/avatarSession.ts` | Điều phối best-effort theo connection epoch trước khi resume automation |
| `avatar-web/server/src/autoFarm.ts` | Không sửa cho tính năng này; nhiệm vụ hằng ngày vẫn chạy độc lập ở cuối chu kỳ |

Tên service/data file cuối cùng phải theo subsystem thực tế tìm được khi reverse, không ép điểm danh vào `FarmService` nếu APK cho thấy nó thuộc service khác.

### 4.2 API game client

`GameClient` cung cấp một API Promise mức cao, ví dụ:

```ts
claimDailyAttendance(options?: { timeoutMs?: number }): Promise<DailyAttendanceResult>
```

API chịu trách nhiệm:

- đăng ký listener/correlation trước khi gửi request;
- gửi đúng request đã reverse;
- phân loại response thành semantic result;
- timeout hữu hạn;
- dọn listener/timer ở mọi nhánh;
- không tự retry;
- không thay đổi trạng thái connection hoặc automation.

Nếu protocol yêu cầu request trạng thái trước rồi mới claim, API thực hiện chuỗi bounded tương ứng. Nếu response “đã nhận” đến qua dialog chung, correlation phải giới hạn trong cửa sổ request điểm danh và không nuốt dialog của nghiệp vụ khác.

### 4.3 Điều phối session

`AvatarSession.onOnline` hiện được guard bởi `onlineEpoch === epoch`. Bổ sung orchestration bất đồng bộ theo thứ tự:

```text
LOGIN_SUCESS hợp lệ
        ↓
AvatarSession.onOnline(client, epoch)
        ↓
reset retry + kickoff sync hiện có
        ↓
runDailyAttendanceBeforeAutomation(client, epoch)
        ├─ claimed/already claimed → log
        ├─ rejected/timeout/unknown → log cảnh báo
        └─ exception → bắt và log
        ↓
kiểm tra client + epoch + desired state còn hợp lệ
        ↓
resumeDesiredAutomation(client, epoch)
```

`resumeDesiredAutomation` phải được gọi trong đường hoàn tất tương đương `finally`, nhưng vẫn giữ toàn bộ guard lifecycle hiện có. Điểm danh không được làm một transition automation đã bị hủy sống lại.

Farm synchronization hiện được kickoff riêng bằng `setImmediate`. Việc đó có thể tiếp tục song song vì điểm danh chỉ có yêu cầu thứ tự trước **farm automation**, không yêu cầu chặn việc đồng bộ snapshot. Nếu reverse cho thấy request điểm danh xung đột với handler/context farm, plan phải serialize hai thao tác; mặc định không tạo ràng buộc này khi chưa có bằng chứng.

### 4.4 Chính sách theo epoch

- Một `onOnline` hợp lệ chạy điểm danh đúng một lần cho connection epoch đó.
- Event `online` trùng trong cùng epoch bị guard hiện có loại bỏ.
- Reconnect hoặc lần đăng nhập kế tiếp tạo epoch mới và gửi lại yêu cầu.
- Không cache “đã claim” giữa các epoch và không phụ thuộc ngày/múi giờ phía server web.
- Server quyết định request là claim mới hay đã nhận hôm nay.

### 4.5 Logging

Dùng `AvatarSession.pushLog`/cơ chế log phiên hiện có với các thông điệp semantic:

- `[điểm danh] nhận thưởng thành công...`
- `[điểm danh] hôm nay đã nhận thưởng`
- `[điểm danh] server từ chối: ... — vẫn tiếp tục tự động`
- `[điểm danh] hết thời gian chờ — vẫn tiếp tục tự động`
- `[điểm danh] phản hồi chưa nhận diện ... — vẫn tiếp tục tự động`

Không log toàn bộ payload chứa dữ liệu nhạy cảm trong đường production thông thường. Payload hex chỉ dành cho debug có giới hạn hoặc note reverse đã được rà soát.

## 5. Data Flow

```text
Game server
   │ LOGIN_SUCESS (-34)
   ▼
GameClient.onMessage
   │ setStatus('online')
   ▼
AvatarSession.onOnline(epoch)
   │
   ├──────────────► syncFarmAfterOnline (kickoff hiện có)
   │
   ▼
claimDailyAttendance(timeout)
   │
   ├─ TX request trạng thái/claim đã xác minh
   ├─ RX success/already/rejected
   └─ timeout/unknown
   │
   ▼
DailyAttendanceResult
   │
   ├─ ghi log
   └─ không ném lỗi chặn lifecycle
   ▼
resumeDesiredAutomation
   ▼
AutoFarm.start / automation mode tương ứng
```

## 6. Error Handling & Edge Cases

1. **Protocol chưa được xác minh:** không viết serializer production và không đoán payload.
2. **Đã điểm danh hôm nay:** coi là kết quả hoàn tất bình thường rồi tiếp tục farm.
3. **Timeout:** dọn listener/timer, ghi log và tiếp tục farm; không retry.
4. **Server từ chối:** ghi reason nếu decode an toàn được và tiếp tục farm.
5. **Phản hồi lạ:** trả `unknown-response`, log command; payload đầy đủ chỉ nằm trong debug/reverse artifact phù hợp.
6. **Mất kết nối trong khi chờ:** kết thúc best-effort; guard epoch ngăn resume automation trên client cũ. Lifecycle reconnect hiện có quyết định lần đăng nhập kế tiếp.
7. **User tắt automation khi đang chờ:** bước điểm danh có thể hoàn tất, nhưng guard desired mode/generation hiện có phải ngăn automation khởi động.
8. **Event online lặp:** `onlineEpoch` ngăn gửi request lần hai trong cùng epoch.
9. **Logout sau chu kỳ:** lần login kế tiếp gửi lại; server trả “đã nhận” nếu cùng ngày.
10. **Dialog chung:** listener điểm danh không được giữ quá timeout hoặc chặn dialog từ feature khác.
11. **Response đến sau timeout:** không được khởi động lại automation hay sửa kết quả đã hoàn tất; handler chung vẫn có thể log packet theo cơ chế hiện có.
12. **Điểm danh thành công nhưng phần thưởng decode thiếu:** coi claim thành công nếu success marker đã xác minh; reward summary là optional.
13. **Farm sync song song:** chỉ serialize nếu packet thực nghiệm chứng minh context/handler bị thay đổi gây xung đột.
14. **Automation transition đang pending:** không tạo hai lời gọi resume; giữ semantics của `pendingAutomationTransitions` và sequence/generation guards.

## 7. Quyết định Thiết kế Đã Chốt

- Điểm danh chạy **sau đăng nhập thành công và trước farm automation**.
- Gửi request **mỗi lần đăng nhập thành công**, không giới hạn một lần/ngày ở local state.
- Điểm danh là **best-effort**.
- Timeout/lỗi **không chặn auto farm**.
- **Không retry** trong cùng lần đăng nhập.
- Reverse-engineer protocol thuộc phạm vi bắt buộc của feature.
- Không dùng protocol nhiệm vụ hằng ngày làm điểm danh nếu không có bằng chứng.
- Không đặt logic này trong `AutoFarm.runCycle`; lifecycle session là boundary phù hợp.
- Không thêm UI config cho hành vi mặc định này.
- Không thực hiện TDD và không tạo test file nếu user không yêu cầu trực tiếp.

## 8. Verification Plan

### 8.1 Reverse verification

1. Capture đủ các ca A–E trong ma trận.
2. Đối chiếu TX khác biệt giữa mở màn hình và bấm claim.
3. Xác nhận field width bằng APK disassembly hoặc parser packet lặp lại ổn định.
4. Xác nhận success marker bằng thay đổi server observable: trạng thái đã nhận, ví hoặc kho.
5. Gửi claim lại sau khi đã nhận để xác định idempotency/error response.
6. Ghi packet mẫu và kết luận vào `avatar-re/notes/daily-attendance.md`.
7. Không chuyển sang production nếu request claim và success/already-claimed response chưa đủ bằng chứng.

### 8.2 Static verification production

- Typecheck server bằng command của workspace được xác định trong implementation plan.
- Kiểm tra API Promise dọn mọi timer/listener ở success, error và timeout.
- Kiểm tra `resumeDesiredAutomation` chỉ xuất hiện sau khi attendance Promise settle.
- Kiểm tra mọi nhánh lỗi attendance đều được bắt và log.
- Kiểm tra `onlineEpoch`, `isCurrent`, automation generation/transition guards vẫn bảo vệ client cũ và transition đã hủy.
- Không tạo test mới nếu user chưa yêu cầu.

### 8.3 Manual verification trên server thật

1. **Chưa điểm danh:** đăng nhập, log ghi nhận thưởng, sau đó auto farm bắt đầu.
2. **Đã điểm danh:** đăng nhập lại, log ghi đã nhận hôm nay, auto farm vẫn bắt đầu.
3. **Timeout:** dùng debug hook hoặc môi trường kiểm soát để không nhận response; hết timeout có log và auto farm bắt đầu.
4. **Server từ chối/phản hồi lạ:** có log cảnh báo và auto farm không bị chặn.
5. **Reconnect:** mỗi lần login mới phát đúng một request; event online trùng không phát thêm.
6. **Tắt automation khi đang chờ:** không khởi động farm sau khi attendance settle.
7. **Regression:** nhiệm vụ hằng ngày `cmd -87/prefix 4` vẫn nhận thưởng/rương ở cuối chu kỳ như trước.
8. **Thứ tự:** timestamp/packet log chứng minh request điểm danh hoàn tất hoặc timeout trước packet farm automation đầu tiên.

### 8.4 GitNexus và phạm vi thay đổi

- Trước khi sửa mỗi function/class/method production, chạy `gitnexus_impact` theo quy định project.
- Nếu kết quả HIGH/CRITICAL, cảnh báo user và chờ xác nhận trước khi sửa.
- Trước commit, chạy `gitnexus_detect_changes({ scope: "all" })` và xác nhận mọi d=1 dependent đã được xử lý.
- Sau commit, để hook cập nhật index hoặc chạy lại analyze với embeddings nếu cần.

## 9. Điều kiện Hoàn thành

Feature chỉ được coi hoàn thành khi:

1. Protocol point danh được ghi lại bằng bằng chứng có thể tái kiểm tra.
2. Request không dựa trên command/payload suy đoán.
3. Mỗi login epoch gửi tối đa một yêu cầu điểm danh.
4. Farm automation không bắt đầu trước khi bước điểm danh settle hoặc timeout.
5. Mọi lỗi attendance đều không chặn auto farm nhưng được log rõ ràng.
6. Reconnect/login lại gửi request mới và dựa vào server để xử lý “đã nhận”.
7. Luồng nhiệm vụ hằng ngày hiện có không bị thay đổi.
8. Verification bắt buộc đạt; nếu protocol reverse chưa đủ, báo cáo blocker trung thực thay vì triển khai production không an toàn.
