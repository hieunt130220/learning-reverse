# Captcha Collector CLI Design

**Ngày:** 2026-08-25  
**Trạng thái:** Chờ user review file Spec  
**Design đã duyệt trong brainstorm:** CLI credentials, luồng Park → cổng game → captcha, thu thập lặp, dedupe SHA-256, output và safety limits

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu

Bổ sung một CLI TypeScript độc lập dùng `GameClient` hiện có để:

1. đăng nhập Avatar bằng username/password nhận trực tiếp từ CLI;
2. vào Khu giải trí;
3. chọn cổng game nằm trước màn hình chọn loại game (Kim Cương, Tiến Lên, ...);
4. nhận và lưu ảnh captcha do server gửi;
5. đóng dialog captcha, chờ một khoảng cấu hình được, mở lại cổng game và lấy captcha mới;
6. lặp đến khi lưu đủ số ảnh captcha duy nhất theo SHA-256 rồi logout sạch.

`avatar-auto.jar` chỉ là nguồn tham chiếu để xác minh protocol. Production CLI không khởi chạy, điều khiển UI hoặc phụ thuộc runtime của JAR.

### 1.2. Bối cảnh hiện tại

- `avatar-web/server/src/game/client.ts` đã có `GameClient` quản lý socket, handshake, login và trạng thái online.
- `avatar-web/server/src/tools/login-test.ts` chứng minh CLI có thể đăng nhập trực tiếp bằng user/password.
- `avatar-web/server/src/tools/npc-map-probe.ts` đã có flow chuyển sang Park context, đọc board list và direct join; các primitive phù hợp phải được tái sử dụng thay vì sao chép toàn bộ probe.
- Tài liệu reverse hiện có `docs/protocol/avatar-auto-captcha-handoff.md` xác định captcha J2ME nằm trong `cmd -60`, body gồm `targetId`, `menuId`, `prompt`, `inputType`, rồi tùy chọn `i16 imageLength + image bytes`.
- Tài liệu handoff chưa xác minh đầy đủ command/payload mở cổng game và cơ chế đóng dialog trong headless client. Các phần đó phải được static-verify từ đúng class JAR và live-verify trước khi tuyên bố CLI hoàn tất.
- `avatar-auto.jar` chứa class chỉ khác nhau hoa/thường; không được giải nén trực tiếp vào filesystem macOS case-insensitive để làm evidence.

### 1.3. Mô hình sử dụng được phép

CLI chỉ dùng cho tài khoản mà người vận hành được phép đăng nhập. Tính năng chỉ thu thập challenge captcha do chính session đó nhận; không giải captcha, không gửi đáp án, không vượt qua cơ chế captcha và không thao tác hàng loạt tài khoản.

## 2. Phạm vi

### 2.1. In-scope

1. CLI mới nhận:
   - `--user <username>`;
   - `--pass <password>`;
   - `--count <positive integer>`, mặc định `10`;
   - `--output-dir <path>`, mặc định `captcha-output`;
   - `--interval-ms <0..60000>`, mặc định `1000`.
2. Dùng `GameClient` để connect/login và chờ trạng thái online.
3. Chuyển đúng Park context bằng primitive hiện có hoặc primitive tối thiểu được bổ sung sau impact analysis.
4. Static reverse `avatar-auto.jar` để xác minh command/payload mở cổng game, đường dispatch `cmd -60`, và semantics đóng dialog/yêu cầu challenge mới.
5. Decoder captcha độc lập, có bounds checking và typed errors.
6. Nhận diện PNG/JPEG/GIF bằng magic bytes và lưu nguyên bytes server gửi.
7. Dedupe trong một lần chạy bằng SHA-256; chỉ ảnh duy nhất mới được lưu và tăng count.
8. Payload không nhận diện/giải mã được được lưu `.bin` cùng metadata `.json` đã redacted, nhưng không tăng count.
9. Ghi file nguyên tử và không ghi đè file cũ.
10. Đóng dialog, chờ interval, mở lại cổng game và lặp.
11. Cleanup signal listener, packet listener, timer và socket khi thành công, lỗi hoặc `Ctrl+C`.
12. Static/build verification và controlled live verification sau production code.

### 2.2. Out-of-scope

- Chạy hoặc điều khiển UI của `avatar-auto.jar`.
- OCR, giải captcha hoặc gửi đáp án captcha về server.
- Chọn hoặc tự động chơi Kim Cương, Tiến Lên hay game cụ thể khác.
- Web UI, WebSocket, API hoặc database persistence.
- Đọc account từ database bằng `--account-id`.
- Chạy nhiều account đồng thời hoặc nhận danh sách credentials.
- Retry login tự động sau rate-limit, permanent rejection hoặc socket close.
- Chuyển đổi/re-encode ảnh sang định dạng khác.
- Tạo test file hoặc viết test mới khi user chưa yêu cầu.

## 3. Global Invariants

1. **Không lộ credential:** password, socket key và packet đăng nhập đầy đủ không xuất hiện trong log, filename hoặc metadata.
2. **Một request in-flight:** không mở lại cổng game khi vòng trước chưa nhận captcha, timeout hoặc được hủy.
3. **Unique-only count:** `--count` chỉ tăng sau khi một ảnh hợp lệ có SHA-256 chưa thấy được ghi thành công.
4. **Nguyên bản:** ảnh được lưu đúng bytes server gửi; không resize, threshold hoặc re-encode.
5. **Bounded operation:** mọi wait có timeout; payload, lỗi liên tiếp và duplicate liên tiếp đều có giới hạn.
6. **Cleanup thật:** CLI không để listener, timer hoặc socket sống sau khi kết thúc.
7. **Protocol evidence gate:** không đưa magic command/payload mở cổng hoặc đóng dialog vào production nếu chưa có static evidence; không tuyên bố live-complete nếu chưa lấy được chuỗi captcha lặp trên server thật.
8. **Không bypass:** collector không OCR và không submit câu trả lời.
9. **Không phá flow dùng chung:** thay đổi `GameClient`/Park primitive phải tối thiểu và giữ nguyên login, farm, shop, quest và Auto Find NPC hiện có.
10. **Không ghi đè:** collector không xóa hoặc overwrite output đã tồn tại.

## 4. Kiến trúc & Giải pháp kỹ thuật

### 4.1. Protocol investigation

**Nguồn:**

- `avatar-jar/avatar-auto.jar`
- `docs/protocol/avatar-auto-captcha-handoff.md`
- `avatar-web/server/src/tools/npc-map-probe.ts`
- `avatar-web/server/src/game/client.ts`
- `avatar-web/server/src/game/parkService.ts`

Investigation phải xác minh:

1. command và body client gửi khi chọn cổng game trước màn hình chọn game cụ thể;
2. handler context cần thiết trước command đó;
3. `cmd -60` được dispatch trong context/session nào;
4. layout captcha chính xác và signedness của `imageLength`;
5. việc đóng dialog là UI-only hay có packet client → server;
6. điều kiện server cấp captcha mới khi chọn lại cổng;
7. response/ack hoặc packet nào chứng minh request đã được server xử lý.

Khi trích class JAR, dùng `ZipFile.read(entry)` hoặc công cụ tương đương để giữ riêng các class phân biệt hoa/thường. Evidence phải ghi class/method/bytecode branch liên quan. Không dùng source từ một thư mục unzip có collision làm kết luận cuối.

Nếu static investigation không xác định được command mở cổng hoặc headless flow khác J2ME, implementation dừng ở trạng thái **protocol investigation pending** và Spec được cập nhật trước khi code đoán packet.

### 4.2. Captcha protocol module

**File dự kiến:** `avatar-web/server/src/game/captchaProtocol.ts` (mới)

Module không biết credentials, filesystem hoặc CLI loop. Interface dự kiến:

```typescript
interface CaptchaChallenge {
  targetId: number;
  menuId: number;
  prompt: string;
  inputType: number;
  imageBytes: Buffer | null;
}

type CaptchaImageFormat = 'png' | 'jpeg' | 'gif';

interface DecodedCaptchaImage {
  format: CaptchaImageFormat;
  bytes: Buffer;
}

function decodeCaptchaChallenge(body: Buffer): CaptchaChallenge;
function decodeCaptchaImage(challenge: CaptchaChallenge): DecodedCaptchaImage;
```

Decoder rules:

- đọc big-endian theo J2ME `DataInputStream`;
- kiểm tra boundary trước mỗi field;
- `imageLength` phải dương và không vượt bytes còn lại;
- tổng image bytes tối đa `5 MiB` ở lớp collector; decoder có thể nhận limit làm input để fail trước allocation/copy không cần thiết;
- reject trailing bytes nếu static/live evidence không chứng minh chúng hợp lệ;
- lỗi typed chứa section/offset/command/length, không chứa prompt đầy đủ nếu prompt có thể nhạy cảm;
- `imageBytes=null` là text-input dialog thông thường, không phải captcha hợp lệ để tăng count.

Magic-byte detection:

- PNG: `89 50 4e 47 0d 0a 1a 0a`;
- JPEG: `ff d8 ff`;
- GIF: ASCII `GIF87a` hoặc `GIF89a`.

### 4.3. Park/game-gate action boundary

**Files dự kiến:**

- ưu tiên tái sử dụng `avatar-web/server/src/game/parkService.ts`;
- chỉ khi cần, sửa tối thiểu `avatar-web/server/src/game/client.ts`;
- có thể tạo `avatar-web/server/src/game/gameGateService.ts` nếu command mở cổng không thuộc responsibility của `ParkService`.

Public boundary dự kiến sau static verification:

```typescript
interface CaptchaGateClient {
  enterParkContext(): void;
  openGameGate(): void;
  closeCaptchaDialog(): void;
  waitForCaptcha(signal: AbortSignal, timeoutMs: number): Promise<CaptchaChallenge>;
}
```

`closeCaptchaDialog()` có hai implementation hợp lệ:

- no-op có giải thích nếu reverse chứng minh dialog chỉ tồn tại ở UI và không phát packet;
- gửi command đã static-verify nếu dialog close thực sự có network action.

Không được gửi một opcode đóng dialog suy đoán. `waitForCaptcha` chỉ resolve packet `cmd -60` mới nhận sau `openGameGate`, cleanup listener khi resolve/reject/abort/timeout và không consume packet của subsystem khác ngoài việc quan sát session event.

### 4.4. CLI coordinator

**File dự kiến:** `avatar-web/server/src/tools/captcha-collector.ts` (mới)

Invocation:

```text
npm --prefix avatar-web/server exec -- tsx src/tools/captcha-collector.ts \
  --user <username> \
  --pass <password> \
  [--count 10] \
  [--output-dir captcha-output] \
  [--interval-ms 1000]
```

CLI parser:

- chỉ chấp nhận exact key/value pairs nêu trên;
- reject unknown key, duplicate key, positional arg và thiếu value;
- `--user`, `--pass` bắt buộc và không rỗng;
- `--count` là số nguyên dương;
- `--interval-ms` là số nguyên `0..60000`;
- `--output-dir` không rỗng và được resolve từ current working directory;
- không in lại argv vì argv chứa password.

Flow:

1. Parse và validate args.
2. Tạo output directory nếu chưa có; không xóa nội dung cũ.
3. Tạo `GameClient`, gắn redacted status/error listeners.
4. Login và chờ `online` với timeout.
5. Vào Park context và chờ response/context readiness đã xác minh.
6. Gọi `openGameGate()` đúng một lần.
7. Chờ captcha mới với timeout.
8. Decode image, tính SHA-256.
9. Nếu hash mới: ghi file nguyên tử, thêm hash vào `Set`, tăng count.
10. Nếu hash trùng: không ghi và tăng duplicate streak.
11. Nếu malformed/unrecognized: lưu diagnostic `.bin` + `.json`, tăng failure streak.
12. Gọi `closeCaptchaDialog()`; chờ `interval-ms` có thể abort.
13. Nếu chưa đủ count, quay lại bước 6.
14. Đủ count: logout, cleanup và exit `0`.

### 4.5. Output contracts

Thư mục mặc định:

```text
captcha-output/
```

Tên ảnh:

```text
captcha-YYYYMMDD-HHmmss-001.png
captcha-YYYYMMDD-HHmmss-002.jpeg
```

Rules:

- timestamp local tại lúc challenge được nhận;
- sequence có tối thiểu ba chữ số và phản ánh thứ tự ảnh hợp lệ trong invocation;
- nếu tên tồn tại, thêm suffix collision tăng dần; không overwrite;
- ghi file tạm trong cùng thư mục rồi rename nguyên tử;
- chỉ sau rename thành công mới tăng count;
- cleanup file tạm best-effort nếu write/rename lỗi.

Diagnostic malformed payload:

```text
captcha-YYYYMMDD-HHmmss-failed-001.bin
captcha-YYYYMMDD-HHmmss-failed-001.json
```

Metadata JSON chỉ chứa:

```typescript
interface CaptchaFailureMetadata {
  receivedAt: string;
  command: -60;
  payloadLength: number;
  imageLength: number | null;
  sha256: string;
  errorCode: string;
  errorSection: string;
  errorOffset: number | null;
}
```

Không ghi username, password, prompt đầy đủ, target ID, menu ID, session key hoặc login packet vào diagnostic metadata.

### 4.6. Loop state và limits

Runtime state nội bộ:

```typescript
interface CollectorState {
  savedCount: number;
  failureStreak: number;
  duplicateStreak: number;
  seenHashes: Set<string>;
}
```

Rules:

- captcha hợp lệ và mới reset cả `failureStreak` và `duplicateStreak`;
- malformed/unrecognized tăng `failureStreak`, reset `duplicateStreak`;
- duplicate tăng `duplicateStreak`, reset `failureStreak`;
- `failureStreak >= 5`: dừng với lỗi;
- `duplicateStreak >= 20`: dừng với lỗi server không cấp challenge mới;
- timeout, login rejection, socket close hoặc rate-limit: dừng ngay, không tự reconnect/login loop;
- limit ảnh `5 MiB` áp dụng trước khi lưu;
- mọi sleep/wait nhận `AbortSignal`.

## 5. Error Handling & Cleanup

### 5.1. Timeout stages

Các timeout phải là named constants và lỗi phải chỉ rõ stage:

- connect/login start;
- online readiness;
- Park context readiness;
- game gate response/captcha wait;
- dialog-close acknowledgement nếu protocol có ack.

Giá trị cụ thể được chốt trong Plan dựa trên timeout convention hiện có; không dùng wait vô hạn.

### 5.2. Exit behavior

| Tình huống | Hành vi |
|---|---|
| Đủ captcha unique | Logout, cleanup, exit `0` |
| CLI args sai | Không connect; exit non-zero |
| Login fail/permanent rejection | Redacted error, cleanup, exit non-zero |
| Rate-limit/temporary rejection | Báo retry-after nếu có, không auto-retry, exit non-zero |
| Socket đóng | Cleanup, exit non-zero |
| Captcha text-only | Diagnostic metadata phù hợp, tính failure streak |
| Ảnh malformed/unknown | Lưu `.bin` + `.json`, không tăng count |
| Ảnh duplicate | Không lưu, không tăng count, yêu cầu lại |
| 5 failure liên tiếp | Cleanup, exit non-zero |
| 20 duplicate liên tiếp | Cleanup, exit non-zero |
| `Ctrl+C`/`SIGTERM` | Abort pending operation, logout best-effort, exit signal-compatible |
| Ghi file lỗi | Không tăng count; cleanup temp; dừng non-zero |

Cleanup phải idempotent. Một `AbortController` cấp CLI hủy pending wait/sleep; `finally` gỡ process signal handlers, event listeners và gọi logout. Không gọi `process.exit()` trước khi cleanup hoàn tất, trừ fallback có timeout để process không treo do socket lỗi.

## 6. Files/Modules và vai trò

| File/module | Hành động dự kiến | Vai trò |
|---|---|---|
| `avatar-jar/avatar-auto.jar` | Read-only reference | Static reverse command/payload |
| `docs/protocol/avatar-auto-captcha-handoff.md` | Read-only hoặc bổ sung evidence nếu user cho phép | Protocol evidence hiện có |
| `avatar-web/server/src/game/captchaProtocol.ts` | Create | Decode challenge và nhận diện image |
| `avatar-web/server/src/game/gameGateService.ts` | Create nếu boundary cần thiết | Encode action mở cổng/đóng dialog đã verify |
| `avatar-web/server/src/game/parkService.ts` | Modify chỉ nếu cần | Primitive Park context/action tái sử dụng |
| `avatar-web/server/src/game/client.ts` | Modify tối thiểu nếu cần | Expose wait/action boundary trên session hiện có |
| `avatar-web/server/src/tools/captcha-collector.ts` | Create | CLI orchestration, dedupe, output, cleanup |
| `docs/protocol/captcha-collector-evidence-2026-08-25.md` | Create sau live probe | Evidence redacted cho static/live protocol |

Không sửa web frontend, database schema, account repository, `AvatarSession`, automation coordinator hoặc AutoFarm trong scope này.

## 7. Verification Plan

Project không dùng TDD. Không tạo test file mới và không thêm test mới vì user chưa yêu cầu. Production code được viết trước; verification chạy sau.

### 7.1. Pre-edit safety

Trước khi sửa mọi symbol hiện có:

1. chạy GitNexus impact upstream cho từng function/class/method;
2. báo user trước nếu risk HIGH hoặc CRITICAL;
3. cập nhật mọi d=1 dependent nếu contract thay đổi.

### 7.2. Static verification

- Trích đúng class JAR phân biệt hoa/thường.
- Ghi evidence class/method cho command mở cổng và dialog-close behavior.
- Xác nhận layout `cmd -60` với bytecode.
- Xác nhận production command constants khớp evidence; không còn magic number không chú thích.

### 7.3. Build/regression verification

Run:

```text
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/server test
```

Expected:

- không TypeScript error;
- server build thành công;
- test suite hiện có pass;
- không có test file mới nếu user chưa yêu cầu.

### 7.4. CLI validation verification

Chạy các trường hợp không kết nối server:

- thiếu `--user`;
- thiếu `--pass`;
- `--count 0`, số âm, decimal hoặc non-number;
- `--interval-ms` ngoài `0..60000`;
- unknown/duplicate key;
- output path không thể tạo/ghi.

Expected: exit non-zero, error rõ, không in password hoặc argv đầy đủ.

### 7.5. Controlled live acceptance

Với một tài khoản do user cung cấp và được phép sử dụng:

1. login thành công;
2. chuyển Khu giải trí đúng một lần;
3. mở đúng cổng game trước màn hình chọn game cụ thể;
4. nhận `cmd -60` mới sau action;
5. decode và lưu ảnh mở được;
6. extension khớp magic bytes;
7. hash file khớp hash tính trước write;
8. đóng dialog, chờ interval và mở lại cổng;
9. thu được nhiều captcha unique liên tiếp;
10. duplicate không tạo file và không tăng count;
11. đủ `--count` thì logout/exit `0`;
12. output/log không chứa password, socket key hoặc login packet;
13. `Ctrl+C` trong lúc wait/sleep cleanup socket và file temp.

Nếu chỉ static protocol/build pass nhưng chưa chạy live, báo: **static/build verified; live captcha collection pending**. Nếu nhận được một ảnh nhưng chưa chứng minh loop lấy ảnh mới, báo: **single captcha verified; repeated refresh pending**. Chỉ tuyên bố complete khi chuỗi lặp đến đủ count đã chạy thành công.

### 7.6. Pre-commit scope verification

Trước commit chạy:

```text
gitnexus_detect_changes(scope: "all")
```

Expected: chỉ captcha protocol/gate service, CLI tool, thay đổi Park/GameClient tối thiểu và docs evidence liên quan bị ảnh hưởng. Không commit credential, captcha output, temporary decompile files hoặc JAR-generated artifacts.

## 8. Rủi ro và Mitigation

| Rủi ro | Mitigation |
|---|---|
| Nhầm class do case-insensitive filesystem | Trích từng entry bằng `ZipFile.read`; lưu evidence class chính xác |
| Protocol J2ME khác headless client hiện tại | Static verify cộng controlled live gate; không đoán command |
| `cmd -60` có imageLength signed | Bounds check; xác minh bytecode; reject giá trị không hợp lệ |
| Server rate-limit do mở cổng liên tục | Mặc định 1 giây, một request in-flight, dừng khi rejection |
| Server trả cùng captcha | SHA-256 dedupe và giới hạn 20 duplicate liên tiếp |
| Payload lỗi làm loop vô hạn | Dừng sau 5 lỗi liên tiếp |
| Payload lớn làm đầy memory/disk | Limit 5 MiB trước write |
| File dở dang | Temp file cùng thư mục + atomic rename + cleanup |
| Password lộ qua logs/process inspection | Không log argv/password; tài liệu cảnh báo CLI password vẫn có thể hiện trong process list/shell history |
| Sửa `GameClient` gây regression | Boundary tối thiểu, impact analysis, existing suite/build |
| Dialog close chỉ là UI action | Cho phép no-op được evidence chứng minh; không phát packet giả |
| Thu thập bị hiểu là bypass captcha | Không OCR, không submit answer, chỉ lưu challenge của session được phép |

## 9. Delivery Gates

### 9.1. Spec gate

- User duyệt file Spec này trước khi tạo Implementation Plan.

### 9.2. Plan gate

- Plan tuân thủ template project, bite-sized tasks, no placeholders và được user duyệt trước production code.

### 9.3. Code-complete gate

- Static protocol evidence hoàn chỉnh.
- Production implementation tuân thủ invariants.
- Typecheck/build/existing tests pass.
- GitNexus impact đã chạy trước mọi symbol edit.
- `gitnexus_detect_changes` xác nhận scope.

### 9.4. Live-complete gate

- CLI đã login, vào Park, mở cổng, nhận/lưu captcha, đóng dialog, yêu cầu captcha mới và lặp đến đủ count.
- Unique count và duplicate behavior được quan sát thật.
- Cleanup thành công khi hoàn tất và khi interrupt.
- Nếu chưa đạt gate này, báo đúng trạng thái pending; không tuyên bố hoàn thành end-to-end.
