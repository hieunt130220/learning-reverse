# Bàn giao công việc CAPTCHA Collector CLI

**Ngày:** 2026-08-25  
**Repository:** `learning-reverse`  
**Trạng thái:** Spec đã được user duyệt; protocol gate/captcha đã static-reverse; Implementation Plan và production code chưa được tạo

## 1. Mục tiêu

Xây dựng CLI TypeScript độc lập dùng `GameClient` hiện có để:

1. nhận username/password trực tiếp từ CLI;
2. đăng nhập Avatar;
3. vào Khu giải trí;
4. mở cổng chọn game nằm trước danh sách Kim Cương, Tiến Lên, Phỏm, Bầu Cua;
5. nhận và lưu ảnh captcha;
6. đóng dialog captcha ở phía client, chờ một giây rồi mở lại cổng để nhận ảnh mới;
7. lặp đến khi lưu đủ số ảnh captcha duy nhất theo SHA-256;
8. logout và cleanup toàn bộ listener, timer, socket.

CLI chỉ thu thập ảnh. Không OCR, không gửi đáp án và không chọn game cụ thể.

## 2. Các quyết định đã được user duyệt

- Viết script TypeScript độc lập; `avatar-auto.jar` chỉ dùng làm tài liệu reverse protocol.
- Credentials truyền qua:

  ```text
  --user <username> --pass <password>
  ```

- Nếu nhận diện được ảnh, lưu đúng định dạng PNG/JPEG/GIF.
- Nếu payload chưa decode hoặc không nhận diện được, lưu `.bin` và metadata `.json` đã redacted.
- Sau mỗi captcha:
  1. đóng dialog;
  2. chờ `--interval-ms`;
  3. mở lại cổng game;
  4. nhận captcha mới.
- Dừng bằng `--count N`, mặc định `10`.
- Output mặc định là `captcha-output/`, cho phép đổi bằng `--output-dir`.
- Tên file dạng:

  ```text
  captcha-YYYYMMDD-HHmmss-001.png
  ```

- Khoảng chờ mặc định là `1000 ms`.
- Chỉ ảnh có SHA-256 chưa gặp mới được lưu và tính vào count.
- Dừng sau 5 payload lỗi liên tiếp.
- Dừng sau 20 captcha trùng liên tiếp.
- Giới hạn payload ảnh là 5 MiB ở collector.
- Không viết test file mới vì user không yêu cầu; production code trước, verification sau.

## 3. Spec đã duyệt

Spec chính:

```text
docs/superpowers/specs/2026-08-25-captcha-collector-design.md
```

Spec đã được user duyệt trong cuộc hội thoại ngày 2026-08-25.

Nội dung chính của Spec:

- phạm vi và out-of-scope;
- global invariants;
- protocol investigation gate;
- `captchaProtocol.ts`;
- `gameGateService.ts`;
- `captcha-collector.ts`;
- atomic output và diagnostic metadata;
- timeout, duplicate/failure streak và cleanup;
- static/build/live verification gates;
- GitNexus impact/detect-changes workflow.

## 4. Protocol CAPTCHA đã xác minh trước đó

Tài liệu hiện có:

```text
docs/protocol/avatar-auto-captcha-handoff.md
```

### 4.1. Packet captcha

Server gửi:

```text
cmd = -60
body:
    i32 targetId
    i8  menuId
    UTF prompt
    i8  inputType

    nếu còn dữ liệu:
        i16 imageLength
        byte[imageLength] imageBytes
```

- Multi-byte dùng big-endian.
- JAR đọc `imageLength` bằng `DataInputStream.readShort()`, tức signed Java short.
- Giá trị hợp lệ theo client J2ME là `1..32767` bytes.
- Không có bytes sau `inputType` nghĩa là dialog nhập text thông thường, không có ảnh.
- Nhánh này nằm trong `fJ.class`, command dispatch `-60`.

### 4.2. Ảnh captcha

JAR gọi:

```java
Image.createImage(imageBytes, 0, imageBytes.length)
```

Ảnh runtime thật từng quan sát có kích thước `100 × 15` và là PNG. Collector vẫn nhận diện thêm JPEG/GIF theo Spec, nhưng không re-encode ảnh.

### 4.3. Không gửi đáp án

JAR có callback submit chứa:

```text
i32 targetId
i8  menuId
UTF answer
```

Collector không được gọi flow này và không cần xác định opcode gửi đáp án.

## 5. Kết quả static reverse mới: mở cổng game

Nguồn phân tích:

```text
avatar-jar/avatar-auto.jar
```

Việc trích class được thực hiện trực tiếp bằng Python `ZipFile.read()` và ghi sang tên tạm không va chạm, tránh lỗi filesystem macOS không phân biệt hoa/thường.

### 5.1. Màn hình chọn game

Class `aO` hiển thị danh sách được lấy từ `bT.do`:

```text
Tiến Lên
Phỏm
Kim Cương
Bầu Cua
Chuyển tiền
```

Method:

```text
aO.case(): void
```

gọi:

```text
fV.do().int(aO.do[10])
```

Constant được resolve:

```text
aO.do[10] = 3
```

Method `fV.int(int)` tạo packet:

```text
command = -1
body = i32 value
```

Do đó request mở cổng chọn game/captcha là:

```text
command: -1
body:
    i32 gameId = 3
```

Wire body:

```hex
00 00 00 03
```

Không có byte hoặc string bổ sung.

### 5.2. Không chọn game cụ thể

Sau khi qua cổng, cùng screen có thể gửi:

```text
Tiến Lên:  cmd -1, i32 0
Phỏm:      cmd -1, i32 1
Kim Cương: cmd -1, i32 2
Bầu Cua:   cmd -1, i32 3
```

Tuy nhiên collector phải dừng ở captcha trước bước này. Không gửi request chọn Kim Cương/Tiến Lên.

### 5.3. Context cần thiết

Static call chain của Auto Kim Cương:

```text
authenticated session
→ điều hướng Khu giải trí
→ current screen là aO
→ aO.case()
→ cmd -1 + i32 3
→ server gửi cmd -60
```

JAR chứng minh request được gửi từ screen `aO`, nhưng không chứng minh request có thể gửi từ map tùy ý. Production CLI phải dùng Park flow hiện có và controlled live verification để chốt readiness trước `openGameGate()`.

### 5.4. Đóng dialog captcha

Dialog nằm trong class `cc`. Close action code `120` thực hiện:

```java
bx.do = null;
```

Không gọi `fV`, không tạo packet và không ghi `DataOutputStream`.

Kết luận:

- đóng dialog là UI-only;
- headless collector triển khai `closeCaptchaDialog()` như no-op có comment evidence;
- tuyệt đối không gọi callback submit `eg`, vì callback đó gửi đáp án.

### 5.5. Yêu cầu captcha mới

Sau khi đóng dialog, JAR gọi lại cùng request:

```text
cmd -1
body i32 3
```

Không gửi:

- close opcode;
- previous `targetId`;
- previous `menuId`;
- refresh token;
- captcha answer.

Server có cấp ảnh duy nhất mỗi lần hay rate-limit không thể chứng minh bằng static reverse; phải live-verify.

## 6. Code hiện có cần tái sử dụng

### 6.1. `GameClient`

File:

```text
avatar-web/server/src/game/client.ts
```

Symbols quan trọng:

```typescript
class GameClient

async login(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  device?: Partial<DeviceProfile>;
}): Promise<void>;

logout(): void;
enterParkContext(): void;
joinPark(map: number, area: number): void;
waitForWorldSnapshot(
  signal: AbortSignal,
  timeoutMs: number,
  expected?: { map: number; area: number },
): Promise<EnterWorldSnapshot>;
```

`GameClient` expose `readonly session = new Session()` và emit `message` cho packet nhận được.

Ưu tiên không sửa `GameClient` nếu `GameGateService` có thể nhận `client.session` trực tiếp.

### 6.2. `ParkService`

File:

```text
avatar-web/server/src/game/parkService.ts
```

Có:

```typescript
export const CMD_AVATAR_JOIN_PARK = 80;

class ParkService {
  constructor(private readonly session: Session);
  doJoinPark(map: number, area: number): void;
}
```

Không đặt command game gate vào `ParkService` chỉ vì cổng nằm trong Park. Dùng `gameGateService.ts` để giữ responsibility hẹp.

### 6.3. Protocol primitives

Files:

```text
avatar-web/server/src/proto/message.ts
avatar-web/server/src/proto/reader.ts
avatar-web/server/src/proto/writer.ts
avatar-web/server/src/proto/session.ts
```

Reusable API:

```typescript
Message.create(command: number): Message;
Message.getData(): Buffer;

MyWriter.writeByte(value: number): this;
MyWriter.writeShort(value: number): this;
MyWriter.writeInt(value: number): this;
MyWriter.writeUTF(value: string): this;
MyWriter.writeBytes(value: Buffer): this;

Session.send(message: Message): void;
```

Không thay đổi global behavior của `MyReader`. Decoder captcha phải tự bounds-check vì thay đổi reader dùng chung có thể ảnh hưởng mọi protocol decoder.

### 6.4. Tool tham chiếu

File:

```text
avatar-web/server/src/tools/npc-map-probe.ts
```

Nên tái sử dụng pattern:

- strict key/value CLI parser;
- redacted error;
- login timeout;
- wait online;
- Park handler ACK waiter;
- abort/timeout/listener cleanup;
- đăng ký waiter trước khi gửi request;
- cleanup idempotent trong `finally`.

Không tái sử dụng:

- database `--account-id`;
- generic `sendRaw()` trong production gate action;
- board/map probing không cần thiết;
- health check Avatar Web nếu live flow không chứng minh cần độc quyền account.

## 7. Files dự kiến tạo/sửa

### Tạo mới

```text
avatar-web/server/src/game/captchaProtocol.ts
avatar-web/server/src/game/gameGateService.ts
avatar-web/server/src/tools/captcha-collector.ts
docs/protocol/captcha-collector-evidence-2026-08-25.md
```

### Có thể sửa

```text
avatar-web/server/package.json
avatar-web/server/src/game/client.ts       # chỉ khi thật sự cần API/property mới
avatar-web/server/src/game/parkService.ts  # chỉ khi evidence chứng minh cần
```

### Không thuộc scope

```text
avatar-web/web/**
avatar-web/server/src/db/**
avatar-web/server/src/accounts/**
avatar-web/server/src/session/avatarSession.ts
avatar-web/server/src/autoFarm.ts
avatar-web/server/src/autoFindNpc.ts
```

## 8. Interfaces dự kiến

### 8.1. `captchaProtocol.ts`

```typescript
export const CMD_CAPTCHA_CHALLENGE = -60;
export const MAX_CAPTCHA_IMAGE_BYTES = 5 * 1024 * 1024;

export interface CaptchaChallenge {
  targetId: number;
  menuId: number;
  prompt: string;
  inputType: number;
  imageBytes: Buffer | null;
}

export type CaptchaImageFormat = 'png' | 'jpeg' | 'gif';

export interface DecodedCaptchaImage {
  format: CaptchaImageFormat;
  bytes: Buffer;
}

export class CaptchaProtocolDecodeError extends Error {
  constructor(
    readonly code: string,
    readonly section: string,
    readonly offset: number | null,
    message: string,
  );
}

export function decodeCaptchaChallenge(
  body: Buffer,
  maxImageBytes?: number,
): CaptchaChallenge;

export function decodeCaptchaImage(
  challenge: CaptchaChallenge,
): DecodedCaptchaImage;
```

Decoder phải:

- bounds-check trước mọi read;
- dùng big-endian;
- giữ `menuId` và `inputType` là signed byte;
- đọc image length là signed i16 và yêu cầu `> 0`;
- chấp nhận đúng zero remaining bytes thành `imageBytes: null`;
- reject truncated fields, unexplained trailing bytes và oversized image;
- không đưa prompt, targetId, menuId hoặc raw image vào error text.

### 8.2. `gameGateService.ts`

```typescript
export const CMD_OPEN_GAME_GATE = -1;
export const GAME_GATE_ID = 3;

export class GameGateService {
  constructor(private readonly session: Session);

  openGameGate(): void;

  closeCaptchaDialog(): void;

  waitForCaptcha(
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<CaptchaChallenge>;
}
```

Behavior:

- `openGameGate()` gửi một packet `cmd -1`, body `writeInt(3)`;
- `closeCaptchaDialog()` là no-op có comment trỏ tới evidence `cc.if(..., 120)`;
- `waitForCaptcha()` chỉ nhận `cmd -60`;
- listener phải được gắn trước `openGameGate()`;
- reject khi abort, timeout, session close hoặc decode lỗi;
- cleanup mọi listener/timer trên mọi terminal path.

### 8.3. `captcha-collector.ts`

```typescript
interface CollectorArgs {
  user: string;
  pass: string;
  count: number;
  outputDir: string;
  intervalMs: number;
}

interface CollectorState {
  savedCount: number;
  failureStreak: number;
  duplicateStreak: number;
  seenHashes: Set<string>;
}
```

CLI invocation dự kiến:

```bash
npm --prefix avatar-web/server run captcha:collect -- \
  --user '<authorized-user>' \
  --pass '<password>' \
  --count 10 \
  --output-dir captcha-output \
  --interval-ms 1000
```

Lưu ý: ứng dụng không log password, nhưng password truyền qua CLI vẫn có thể xuất hiện trong shell history và process list.

## 9. Thứ tự triển khai đề xuất

1. Ghi static reverse evidence mới vào protocol evidence document.
2. Tạo `captchaProtocol.ts` với checked decoder và image magic detection.
3. Tạo `gameGateService.ts` với verified `cmd -1 + i32 3` và close no-op.
4. Tạo CLI parser, login/online/Park readiness orchestration.
5. Thêm loop nhận captcha, SHA-256 dedupe và streak limits.
6. Thêm atomic output và redacted malformed diagnostics.
7. Thêm abortable interval sleep, signal handling và cleanup idempotent.
8. Thêm npm script `captcha:collect`.
9. Typecheck/build/existing tests.
10. Chạy live count `1`, sau đó count `3` để verify repeated refresh.
11. Chạy GitNexus detect changes trước commit.

## 10. Timeout/limit đề xuất

```text
login start timeout:    12 giây
wait online:            10 giây
Park handler response:   5 giây
captcha wait:           10 giây
interval mặc định:       1 giây
failure streak tối đa:   5
negative duplicate gate: 20
collector image limit:   5 MiB
J2ME signed-i16 limit:   32767 bytes
```

Nếu live evidence cho thấy latency bình thường khác, cập nhật named constant và evidence cùng lúc.

## 11. Verification bắt buộc

### 11.1. GitNexus trước edit

Trước khi sửa bất kỳ symbol hiện có nào:

```text
gitnexus_impact(target: "GameClient", direction: "upstream")
gitnexus_impact(target: "ParkService", direction: "upstream")
```

Chỉ chạy impact cho symbol thực sự sửa. Nếu HIGH hoặc CRITICAL, phải báo user trước khi edit.

### 11.2. Build/regression

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/server test
```

Không tạo test file mới nếu user chưa yêu cầu.

### 11.3. CLI validation không connect

Kiểm tra:

```bash
npm --prefix avatar-web/server run captcha:collect -- --pass x
npm --prefix avatar-web/server run captcha:collect -- --user x
npm --prefix avatar-web/server run captcha:collect -- --user x --pass y --count 0
npm --prefix avatar-web/server run captcha:collect -- --user x --pass y --count 1.5
npm --prefix avatar-web/server run captcha:collect -- --user x --pass y --interval-ms 60001
npm --prefix avatar-web/server run captcha:collect -- --user x --user y --pass z
npm --prefix avatar-web/server run captcha:collect -- --user x --pass y --unknown z
```

Expected:

- exit non-zero;
- không connect;
- không in argv/password;
- validation fail trước khi tạo output side effect không cần thiết.

### 11.4. Live acceptance

Chỉ dùng tài khoản được phép:

1. chạy `--count 1`;
2. xác nhận login và Park flow;
3. traffic có `TX cmd=-1 len=4`, body redacted/verified tương ứng `i32 3`;
4. nhận `RX cmd=-60`;
5. file ảnh mở được và extension đúng magic bytes;
6. chạy `--count 3` để xác nhận close → wait → reopen;
7. SHA-256 của ba ảnh khác nhau;
8. đủ count thì logout và exit `0`;
9. interrupt trong captcha wait và interval sleep để kiểm tra cleanup;
10. log không chứa password, key hoặc login packet.

Trạng thái báo cáo chính xác:

- `static/build verified; live captcha collection pending`;
- `single captcha verified; repeated refresh pending`;
- chỉ báo complete khi repeated unique collection đạt count thật.

### 11.5. Pre-commit

```text
gitnexus_detect_changes(scope: "all")
```

Không commit:

- credentials;
- `captcha-output/`;
- decompile output tạm;
- dump ảnh nghiên cứu;
- generated JAR artifacts.

## 12. Trạng thái repository tại thời điểm bàn giao

Các path đang untracked trước khi production implementation bắt đầu:

```text
avatar-jar/
docs/protocol/avatar-auto-captcha-handoff.md
docs/superpowers/specs/2026-08-25-captcha-collector-design.md
```

Không được xóa hoặc ghi đè các file này. `avatar-auto.jar` và handoff protocol là input nghiên cứu của công việc.

Chưa có:

```text
docs/superpowers/plans/2026-08-25-captcha-collector.md
avatar-web/server/src/game/captchaProtocol.ts
avatar-web/server/src/game/gameGateService.ts
avatar-web/server/src/tools/captcha-collector.ts
```

## 13. Workflow bắt buộc tiếp theo

Project yêu cầu quy trình:

```text
Spec → Plan → Production Code
```

Spec đã được duyệt. Bước tiếp theo:

1. tạo Implementation Plan tại:

   ```text
   docs/superpowers/plans/2026-08-25-captcha-collector.md
   ```

2. trình Plan cho user duyệt;
3. chỉ sau khi Plan được duyệt mới viết production code;
4. trong implementation, không dùng TDD và không tạo test file mới;
5. chạy GitNexus impact trước mọi edit symbol hiện có;
6. chạy GitNexus detect changes trước commit.

## 14. Điểm chưa được live-verify

Static reverse đã chốt:

- inbound captcha `cmd -60`;
- body captcha;
- gate request `cmd -1 + i32 3`;
- close dialog là UI-only;
- request mới là gửi lại cùng packet.

Vẫn cần live-verify:

- Park map/area và readiness chính xác trước gate request;
- server headless hiện tại chấp nhận `cmd -1 + i32 3` trong context đó;
- server trả `cmd -60` sau mỗi request;
- captcha mới có unique SHA-256;
- rate-limit/timing thực tế;
- repeated loop đến đủ count;
- cleanup socket trên success/error/interrupt.

Không được tuyên bố end-to-end complete trước khi các điểm này có evidence thật.
