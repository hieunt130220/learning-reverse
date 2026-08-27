# Captcha Passive Logger Design

**Ngày:** 2026-08-27  
**Trạng thái:** Đã duyệt (user "oke" 2026-08-27)  
**Liên quan:** `2026-08-25-captcha-collector-design.md` (CLI thu thập chủ động), `captchaProtocol.ts`, `client.ts`, `avatarSession.ts`

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu
Bổ sung khả năng **tự động ghi log và lưu file ảnh captcha (cmd -60)** khi người dùng chơi game bình thường qua `avatar-web` (session `AvatarSession`/`GameClient`), không cần chạy riêng `captcha-collector` CLI. Ảnh được lưu xuống đĩa (`server/captcha-dataset/` hoặc `server/captcha-output/`) với tênunique, đồng thời phát sự kiện qua WebSocket để UI cho phép tải về.

### 1.2. Bối cảnh
- `GameClient.onMessage` hiện xử lý nhiều opcode (-34, -40, 70, 80, 103…) nhưng **bỏ qua -60**. Khi captcha được server đẩy trong lúc chơi (ví dụ sau khi mở cổng game Kim Cương `cmd -1 + i32 3` hoặc trigger ngẫu nhiên), client không log, không lưu, không hiển thị.
- `captchaProtocol.ts` đã có decoder hoàn chỉnh (`decodeCaptchaChallenge`, `decodeCaptchaImage`, `detectImageFormat`) và được xác minh qua `pcap` và ảnh mẫu `100x15 PNG 305B`.
- `AvatarSession` đã có buffer `logs` (500 dòng) và `traffic` (100 entries) phát qua WS, nhưng chưa có kênh `captcha`.
- Thư mục `server/captcha-dataset` và `server/captcha-output` tồn tại nhưng rỗng; CLI collector ghi vào `captcha-output` với dedupe SHA-256.
- Người dùng muốn “thêm log hay gì đó để download ảnh captcha khi tôi chơi game” – tức **passive capture** trong mọi session đang online, không làm gián đoạn flow hiện tại.

### 1.3. Ràng buộc
- Không OCR, không gửi đáp án, không bypass.
- Không phá vỡ login/farm/shop/quest/auto hiện có.
- Không lộ credential, không ghi đè file, ghi nguyên tử.
- Không tạo test mới trừ khi user yêu cầu.

## 2. Phạm vi (Scope)

### 2.1. In-scope
1. Thêm handler `cmd -60` trong `GameClient.onMessage` để decode, log và emit event `captcha` (chứa `challenge`, `decodedImage` nếu có, `format`, `sha256`).
2. Thêm listener trong `AvatarSession.wire` để nhận event `captcha`, lưu file xuống đĩa (`captcha-dataset/` mặc định, cấu hình được), phát WS event `captcha` cho frontend, và push logline.
3. Lưu ảnh nguyên bytes server gửi (không re-encode), nhận diện PNG/JPEG/GIF qua magic bytes.
4. Đặt tên file `captcha-YYYYMMDD-HHmmss-SSS-<seq>.<ext>` với seq 3 chữ số, xử lý collision bằng suffix tăng dần, ghi temp + rename nguyên tử.
5. Trường hợp không có ảnh (`imageBytes: null`) hoặc lỗi decode: lưu diagnostic `.bin` + `.json` redacted, không crash session.
6. Thêm API HTTP `GET /api/captcha/download/:filename` hoặc phục vụ static để browser tải về (hoặc trả base64 qua WS).
7. Cập nhật frontend (`web`) hiển thị banner/toast + nút Download khi có captcha mới (tối thiểu: LogPanel hoặc panel mới `CaptchaPanel`).
8. Ghi log rõ ràng: `[captcha] nhận challenge targetId=... prompt="..." format=png bytes=305 sha=abc... saved=captcha-...png`.

### 2.2. Out-of-scope
- Không tự động trả lời captcha.
- Không thay đổi logic mở cổng game (`GameGateService`) hay CLI collector.
- Không OCR, không training dataset pipeline.
- Không lưu vào DB, không đồng bộ giữa các phiên.
- Không thay đổi cơ chế CAPTCHA của server.
- Không ghi đè file cũ, không xóa dataset.

### 2.3. Input / Output
- **Input:** `Message` `command=-60` body `Buffer` từ `Session` (đã XOR decode).
- **Output:**
  - File: `server/captcha-dataset/captcha-*.png|jpeg|gif` hoặc `*.bin` diagnostic.
  - LogLine: `t, line` trong `AvatarSession.logs`.
  - WS event: `{type:'captcha', payload:{accountId, challenge, fileName, format, sha256, prompt}}`.

### 2.4. Edge cases
- `imageBytes: null` (dialog text thông thường) -> log `"captcha text-only, no image"` + lưu diagnostic nếu cần.
- `imageLength <=0` hoặc `>5MiB` -> `CaptchaProtocolDecodeError` -> lưu `.bin` + `.json`, không emit file ảnh.
- `detectImageFormat` trả `null` -> lỗi `UNRECOGNIZED_IMAGE_FORMAT` -> lưu diagnostic.
- Trùng SHA-256: vẫn lưu file mới (passive logger không dedupe như collector) nhưng log cảnh báo `duplicate sha`.
- Disk full / permission: log lỗi, không ném ra ngoài làm rớt session.
- Nhiều captcha liên tiếp: mỗi cái một file, sequence tăng.
- Session chưa online vẫn nhận -60: vẫn xử lý (không yêu cầu online).

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Files/modules liên quan

| File | Vai trò | Hành động |
|---|---|---|
| `avatar-web/server/src/game/captchaProtocol.ts` | Decoder, đã có | **Read-only**, tái sử dụng `decodeCaptchaChallenge`, `decodeCaptchaImage`, `detectImageFormat`, `MAX_CAPTCHA_IMAGE_BYTES` |
| `avatar-web/server/src/game/client.ts:825` `onMessage` | Central message dispatch | **Modify** – thêm `case -60:` decode, log, `emit('captcha', ...)`, fallback `emit('message', msg)` cho collector |
| `avatar-web/server/src/session/avatarSession.ts:720` `wire` | Session lifecycle, log/traffic buffer, WS broadcast | **Modify** – lắng `client.on('captcha', ...)` lưu file, `pushLog`, `emit('captcha', ...)`, thêm `captcha` vào snapshot nếu cần |
| `avatar-web/server/src/session/manager.ts` | Tạo `AvatarSession` | **No change** (chỉ truyền `onEvent`) |
| `avatar-web/server/src/ws.ts:15` `LIGHT_EVENTS` | WS broadcast lọc | **Modify** – thêm `'captcha'` vào `LIGHT_EVENTS` hoặc đảm bảo broadcast đến subscriber |
| `avatar-web/server/src/index.ts` hoặc `server/src/tools/captchaPassiveSaver.ts` | Tạo utility lưu file | **Create** (hoặc inline trong `avatarSession.ts`) – hàm `saveCaptchaImage(challenge, accountId)` xử lý tên file, temp+rename, sha256, format |
| `avatar-web/server/src/routes.ts` hoặc `src/session/routes.ts` | API download | **Modify/Create** – `GET /api/captcha/:accountId/download/:file` hoặc static serve `captcha-dataset` |
| `avatar-web/web/src/types.ts` | TS types chung | **Modify** – thêm `CaptchaEventPayload` |
| `avatar-web/web/src/accounts/panels/CaptchaPanel.tsx` | UI hiển thị captcha mới | **Create** – panel nhỏ trong `AccountCard` hoặc `LogPanel` hiển thị thumbnail + nút tải |
| `avatar-web/web/src/accounts/useAccountRuntime.ts` | Hook WS snapshot | **Modify** – lắng `captcha` event, lưu vào state để UI render |
| `server/captcha-dataset/` | Lưu trữ passive | **Use** – mặc định, `mkdir -p` nếu chưa có |
| `server/package.json` | Script | **No change** (không cần script mới) |

### 3.2. Interfaces & Data contracts

```typescript
// GameClient emit
type CaptchaEvent = {
  challenge: CaptchaChallenge; // từ decodeCaptchaChallenge
  decoded: DecodedCaptchaImage | null; // null nếu text-only hoặc lỗi format
  sha256: string | null; // hex của imageBytes nếu có
  error: CaptchaProtocolDecodeError | null;
  rawHex: string; // body hex để debug (redacted prompt nếu cần)
};

// AvatarSession WS payload
type WsCaptchaPayload = {
  accountId: number;
  targetId: number;
  menuId: number;
  prompt: string;
  inputType: number;
  format: CaptchaImageFormat | null;
  fileName: string | null; // null nếu không có ảnh hoặc lỗi
  sha256: string | null;
  savedPath: string | null; // relative path trong captcha-dataset
  receivedAt: string; // ISO
  isDiagnostic: boolean; // true nếu lưu .bin+.json
};

// File saver contract
function savePassiveCaptcha(
  challenge: CaptchaChallenge,
  accountId: number,
  opts?: { outputDir?: string } // default server/captcha-dataset
): Promise<{ fileName: string; format: CaptchaImageFormat | null; sha256: string | null; isDiagnostic: boolean }>;
```

### 3.3. Flow xử lý

```
Session (decrypted) --Message cmd=-60--> GameClient.onMessage
  -> try decodeCaptchaChallenge(body)
  -> if imageBytes != null try decodeCaptchaImage -> format
  -> compute sha256(imageBytes) nếu có
  -> emit('captcha', CaptchaEvent)
  -> emit('log', `[captcha] ...`)
  -> emit('message', msg) // giữ cho GameGateService.waitForCaptcha vẫn hoạt động

GameClient 'captcha' --listener--> AvatarSession.wire
  -> savePassiveCaptcha(challenge, accountId)
     -> mkdir -p captcha-dataset
     -> tên file: captcha-YYYYMMDD-HHmmss-SSS-<seq3>.ext (ext từ format hoặc bin)
     -> collision check, temp file + rename
     -> tính sha256, ghi log pushLog()
  -> emit('captcha', WsCaptchaPayload) qua opts.onEvent -> WsHub.broadcast
  -> nếu lỗi disk: pushLog(`[captcha] lỗi lưu file: ${err.message}`) không ném

WsHub --broadcast--> Web client (AccountCard/CaptchaPanel)
  -> toast "Nhận captcha mới: <prompt> (png 305B)"
  -> hiển thị thumbnail (base64 hoặc fetch /api/captcha/download/...)
  -> nút Download -> GET /api/captcha/... hoặc data URL
```

### 3.4. Diagram (sequence)

```
User plays game
  -> Server sends cmd -60 (captcha) --Session--> GameClient
  -> GameClient decode -> emit captcha + log
  -> AvatarSession save file + WS broadcast
  -> Web UI receives captcha event -> shows panel + download link
  -> File on disk: server/captcha-dataset/captcha-20260827-xxxx.png
```

### 3.5. Bảo mật & safety
- Không log `imageBytes` hex đầy đủ (chỉ log sha/filename/format), không log password/key.
- Ghi file với `0o644`, không executable.
- Giới hạn `5 MiB`, reject vượt.
- Không ghi đè, dùng `fs.open` với `wx`.

## 4. Verification Plan

### 4.1. Pre-edit safety
- Chạy `impact({target:"GameClient.onMessage", direction:"upstream"})` trước khi sửa `client.ts` – báo nếu HIGH/CRITICAL.
- Chạy `impact({target:"AvatarSession.wire", direction:"upstream"})` trước khi sửa `avatarSession.ts`.

### 4.2. Static/build verification
```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/server test
```
- Không TypeScript error, build success, tests cũ pass.

### 4.3. Manual verification (không cần TDD)
1. Khởi động `avatar-web` dev (`npm --prefix avatar-web/server run dev` + `web`).
2. Đăng nhập 1 tài khoản hợp lệ, vào Khu giải trí, mở cổng game Kim Cương (`cmd -1 i32 3`) hoặc chơi bình thường đến khi trigger captcha.
3. Quan sát:
   - `LogPanel` xuất hiện `[captcha] nhận challenge ... saved=...`.
   - File mới trong `server/captcha-dataset/` (hoặc `captcha-output`) mở được bằng `file`/`open`.
   - WS event `captcha` tới frontend, UI hiển thị tên file + nút Download hoạt động.
4. Gửi captcha text-only (giả lập bằng `sendRaw -60` với body không có imageLength) -> log `text-only` và không crash.
5. Gửi captcha malformed (imageLength > body) -> lưu diagnostic `.bin`+`.json`, session vẫn online.
6. Kiểm tra collision: gửi 2 captcha cùng giây -> tên file khác nhau (seq tăng).
7. Kiểm tra không lộ credential trong log/metadata.

### 4.4. Pre-commit
```bash
node .gitnexus/run.cjs analyze # nếu cần reindex
git diff
# đảm bảo chỉ các file listed bị đổi
```

## 5. User Review Gate
Trình bày file Spec này, chờ user duyệt (approve) trước khi tạo Implementation Plan `docs/superpowers/plans/2026-08-27-captcha-passive-logger.md`.
