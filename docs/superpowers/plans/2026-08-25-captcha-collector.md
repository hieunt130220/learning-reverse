# CAPTCHA Collector CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ CLI TypeScript độc lập thu thập ảnh CAPTCHA từ server Avatar thông qua GameClient và cổng chọn game với tính năng dedupe SHA-256 và atomic output.

**Architecture:** Tạo module `captchaProtocol.ts` xử lý giải mã packet `cmd -60` và magic bytes ảnh (PNG/JPEG/GIF); tạo `gameGateService.ts` quản lý gửi packet mở cổng game `cmd -1` + `i32 3` và wait challenge; xây dựng CLI coordinator `captcha-collector.ts` quản lý vòng lặp đăng nhập, Park context, thu thập ảnh, giới hạn lỗi/trùng, và ghi file nguyên tử.

**Tech Stack:** TypeScript 5.7, Node.js v22 (Buffer, Crypto, EventEmitter, AbortController), tsx.

**Spec:** `docs/superpowers/specs/2026-08-25-captcha-collector-design.md`

## Global Constraints
- Không rò rỉ credential: password, socket key và full login packet không xuất hiện trong log, filename hoặc metadata.
- Một request in-flight: không mở lại cổng game khi vòng trước chưa nhận captcha, timeout hoặc được hủy.
- Unique-only count: `--count` chỉ tăng khi một ảnh hợp lệ có SHA-256 chưa từng thấy được ghi thành công.
- Giữ nguyên bản: ảnh được lưu đúng bytes server gửi; không resize, threshold hoặc re-encode.
- Bounded operation: mọi wait có timeout; payload tối đa 5 MiB; dừng sau tối đa 5 lỗi liên tiếp hoặc 20 duplicate liên tiếp.
- Cleanup triệt để: giải phóng toàn bộ listener, timer, socket trên mọi nhánh hoàn tất, lỗi, timeout hoặc Ctrl+C.
- Không dùng TDD: không tạo file test mới trừ khi user yêu cầu; viết code production trước, verify sau.
- Atomic output: ghi file tạm trước rồi rename; không ghi đè file output đã tồn tại.

---

### Task 1: Protocol Evidence Document

**Files:**
- Create: `docs/protocol/captcha-collector-evidence-2026-08-25.md`

**Interfaces:**
- Consumes: Static reverse data từ `avatar-auto.jar` (các class `fJ.class`, `aO.class`, `fV.class`, `cc.class`, `az.class`).
- Produces: Tài liệu protocol evidence lưu trữ các hằng số, bytecode offsets, wire format và cơ chế đóng dialog cho các task sau đối chiếu.

- [x] **Step 1: Ghi nhận static reverse protocol evidence**
Tạo file `docs/protocol/captcha-collector-evidence-2026-08-25.md` với đầy đủ chi tiết byte-level đã xác minh từ static analysis:
- Packet `cmd -60`: layout `i32 targetId`, `i8 menuId`, `UTF prompt`, `i8 inputType`, tùy chọn `i16 imageLength` + `byte[imageLength] imageBytes`. Signed 16-bit short (`1..32767`).
- Request mở cổng game: `cmd -1`, body `i32 3` (4 bytes `00 00 00 03`).
- Semantics đóng dialog captcha: `cc.if(..., 120)` là UI-only action (`bx.do = null`), không tạo network packet.
- Semantics refresh captcha: gửi lại cùng packet `cmd -1` + `i32 3`.

- [x] **Step 2: Verify file tồn tại**
Kiểm tra file vừa tạo.

---

### Task 2: Captcha Protocol Decoder Module

**Files:**
- Create: `avatar-web/server/src/game/captchaProtocol.ts`

**Interfaces:**
- Consumes: Node.js `Buffer`, `crypto`
- Produces:
  - `CMD_CAPTCHA_CHALLENGE = -60`
  - `MAX_CAPTCHA_IMAGE_BYTES = 5 * 1024 * 1024`
  - `interface CaptchaChallenge`
  - `type CaptchaImageFormat = 'png' | 'jpeg' | 'gif'`
  - `interface DecodedCaptchaImage`
  - `class CaptchaProtocolDecodeError extends Error`
  - `function decodeCaptchaChallenge(body: Buffer, maxImageBytes?: number): CaptchaChallenge`
  - `function decodeCaptchaImage(challenge: CaptchaChallenge): DecodedCaptchaImage`

- [x] **Step 1: Tạo module `captchaProtocol.ts`**
Tạo `avatar-web/server/src/game/captchaProtocol.ts` với đầy đủ bounds checking, typed errors, và magic byte detection:

```typescript
export const CMD_CAPTCHA_CHALLENGE = -60;
export const MAX_CAPTCHA_IMAGE_BYTES = 5 * 1024 * 1024;
export const J2ME_MAX_IMAGE_BYTES = 32767;

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
  ) {
    super(`[${code}] at ${section}${offset !== null ? ` (offset ${offset})` : ''}: ${message}`);
    this.name = 'CaptchaProtocolDecodeError';
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_MAGIC = Buffer.from('GIF87a', 'ascii');
const GIF89A_MAGIC = Buffer.from('GIF89a', 'ascii');

export function detectImageFormat(bytes: Buffer): CaptchaImageFormat | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG_MAGIC)) {
    return 'jpeg';
  }
  if (
    bytes.length >= 6 &&
    (bytes.subarray(0, 6).equals(GIF87A_MAGIC) || bytes.subarray(0, 6).equals(GIF89A_MAGIC))
  ) {
    return 'gif';
  }
  return null;
}

export function decodeCaptchaChallenge(
  body: Buffer,
  maxImageBytes = MAX_CAPTCHA_IMAGE_BYTES,
): CaptchaChallenge {
  let offset = 0;

  // i32 targetId (4 bytes)
  if (body.length < offset + 4) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_TARGET_ID', 'header', offset, 'thiếu bytes cho targetId');
  }
  const targetId = body.readInt32BE(offset);
  offset += 4;

  // i8 menuId (1 byte signed)
  if (body.length < offset + 1) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_MENU_ID', 'header', offset, 'thiếu byte cho menuId');
  }
  const menuId = body.readInt8(offset);
  offset += 1;

  // UTF prompt (2 bytes uint16 len + utf8 string)
  if (body.length < offset + 2) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_PROMPT_LEN', 'prompt', offset, 'thiếu bytes cho prompt length');
  }
  const promptLen = body.readUInt16BE(offset);
  offset += 2;

  if (body.length < offset + promptLen) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_PROMPT_BODY', 'prompt', offset, 'thiếu bytes cho prompt content');
  }
  const prompt = body.toString('utf8', offset, offset + promptLen);
  offset += promptLen;

  // i8 inputType (1 byte signed)
  if (body.length < offset + 1) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_INPUT_TYPE', 'input-type', offset, 'thiếu byte cho inputType');
  }
  const inputType = body.readInt8(offset);
  offset += 1;

  // Optional image data
  if (offset === body.length) {
    return {
      targetId,
      menuId,
      prompt,
      inputType,
      imageBytes: null,
    };
  }

  // If there are bytes remaining, must have at least 2 bytes for image length
  if (body.length < offset + 2) {
    throw new CaptchaProtocolDecodeError('TRUNCATED_IMAGE_LEN', 'image-header', offset, 'thiếu bytes cho image length');
  }
  const imageLength = body.readInt16BE(offset);
  offset += 2;

  if (imageLength <= 0) {
    throw new CaptchaProtocolDecodeError('INVALID_IMAGE_LEN', 'image-header', offset - 2, `imageLength không dương: ${imageLength}`);
  }

  if (imageLength > maxImageBytes) {
    throw new CaptchaProtocolDecodeError(
      'IMAGE_TOO_LARGE',
      'image-body',
      offset,
      `imageLength (${imageLength}) vượt quá giới hạn tối đa (${maxImageBytes})`,
    );
  }

  if (body.length < offset + imageLength) {
    throw new CaptchaProtocolDecodeError(
      'TRUNCATED_IMAGE_DATA',
      'image-body',
      offset,
      `dữ liệu ảnh bị cụt: cần ${imageLength} bytes, chỉ còn ${body.length - offset} bytes`,
    );
  }

  const imageBytes = Buffer.from(body.subarray(offset, offset + imageLength));
  offset += imageLength;

  if (offset < body.length) {
    throw new CaptchaProtocolDecodeError(
      'TRAILING_BYTES',
      'payload-end',
      offset,
      `còn ${body.length - offset} bytes thừa chưa giải mã ở cuối payload`,
    );
  }

  return {
    targetId,
    menuId,
    prompt,
    inputType,
    imageBytes,
  };
}

export function decodeCaptchaImage(challenge: CaptchaChallenge): DecodedCaptchaImage {
  if (!challenge.imageBytes || challenge.imageBytes.length === 0) {
    throw new CaptchaProtocolDecodeError('NO_IMAGE_DATA', 'image', null, 'challenge không chứa dữ liệu ảnh');
  }

  const format = detectImageFormat(challenge.imageBytes);
  if (!format) {
    throw new CaptchaProtocolDecodeError('UNRECOGNIZED_IMAGE_FORMAT', 'image', 0, 'magic bytes ảnh không phải PNG, JPEG hoặc GIF');
  }

  return {
    format,
    bytes: challenge.imageBytes,
  };
}
```

- [x] **Step 2: Verify typecheck**
Chạy: `npm --prefix avatar-web/server run typecheck`
Expected: Không có lỗi typecheck.

---

### Task 3: Game Gate Service Module

**Files:**
- Create: `avatar-web/server/src/game/gameGateService.ts`

**Interfaces:**
- Consumes: `Session` từ `../proto/session.js`, `Message` từ `../proto/message.js`, `decodeCaptchaChallenge`, `CaptchaChallenge`, `CMD_CAPTCHA_CHALLENGE` từ `./captchaProtocol.js`.
- Produces:
  - `CMD_OPEN_GAME_GATE = -1`
  - `GAME_GATE_ID = 3`
  - `class GameGateService`:
    - `constructor(session: Session)`
    - `openGameGate(): void`
    - `closeCaptchaDialog(): void`
    - `waitForCaptcha(signal: AbortSignal, timeoutMs: number): Promise<CaptchaChallenge>`

- [x] **Step 1: Tạo module `gameGateService.ts`**
Tạo `avatar-web/server/src/game/gameGateService.ts`:

```typescript
import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';
import {
  CMD_CAPTCHA_CHALLENGE,
  decodeCaptchaChallenge,
  type CaptchaChallenge,
} from './captchaProtocol.js';

export const CMD_OPEN_GAME_GATE = -1;
export const GAME_GATE_ID = 3;

export class GameGateService {
  constructor(private readonly session: Session) {}

  /**
   * Gửi packet mở cổng game: cmd = -1, body = int32(3).
   * Evidence: class aO.case() gọi fV.do().int(aO.do[10]) với aO.do[10] = 3.
   */
  openGameGate(): void {
    const m = Message.create(CMD_OPEN_GAME_GATE);
    m.writer!.writeInt(GAME_GATE_ID);
    this.session.send(m);
  }

  /**
   * Đóng dialog captcha trên client.
   * Evidence: class cc.if(..., 120) thực hiện bx.do = null (UI-only),
   * không gửi packet lên server. Không gọi callback submit (eg).
   */
  closeCaptchaDialog(): void {
    // No-op theo static reverse evidence cc.if(..., 120)
  }

  /**
   * Chờ nhận packet captcha (cmd -60) từ server.
   * Đăng ký listener trước khi gọi openGameGate() để không bị miss packet.
   */
  waitForCaptcha(
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<CaptchaChallenge> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;

      const onMessage = (msg: Message): void => {
        if (msg.command !== CMD_CAPTCHA_CHALLENGE) return;
        cleanup();
        try {
          const challenge = decodeCaptchaChallenge(msg.getData());
          resolve(challenge);
        } catch (err) {
          reject(err);
        }
      };

      const onClosed = (): void => {
        cleanup();
        reject(new Error('kết nối đã đóng khi đang chờ captcha (-60)'));
      };

      const onAbort = (): void => {
        cleanup();
        reject(new Error('chờ captcha bị hủy'));
      };

      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        this.session.removeListener('message', onMessage);
        this.session.removeListener('closed', onClosed);
        signal.removeEventListener('abort', onAbort);
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`hết thời gian chờ captcha (-60) sau ${timeoutMs}ms`));
      }, timeoutMs);

      this.session.on('message', onMessage);
      this.session.once('closed', onClosed);
      signal.addEventListener('abort', onAbort, { once: true });

      if (signal.aborted) {
        onAbort();
      }
    });
  }
}
```

- [x] **Step 2: Verify typecheck**
Chạy: `npm --prefix avatar-web/server run typecheck`
Expected: Không có lỗi typecheck.

---

### Task 4: Captcha Collector CLI Coordinator

**Files:**
- Create: `avatar-web/server/src/tools/captcha-collector.ts`

**Interfaces:**
- Consumes:
  - `GameClient` từ `../game/client.js`
  - `GameGateService` từ `../game/gameGateService.js`
  - `decodeCaptchaImage`, `CaptchaChallenge`, `CaptchaProtocolDecodeError` từ `../game/captchaProtocol.js`
  - `node:fs/promises`, `node:path`, `node:crypto`
- Produces: CLI script chạy độc lập `captcha-collector.ts`.

- [x] **Step 1: Viết CLI script `captcha-collector.ts`**
Viết `avatar-web/server/src/tools/captcha-collector.ts` xử lý:
- CLI argument validation strict: `--user`, `--pass`, `--count` (default 10), `--output-dir` (default `captcha-output`), `--interval-ms` (default 1000).
- Không log raw password hoặc full argv.
- Connect, login và wait online với timeout.
- Chuyển sang Park context (`enterParkContext()`).
- Loop thu thập captcha với:
  - Atomic file write: ghi file `.tmp` cùng thư mục, sau đó atomic `rename`.
  - Naming: `captcha-YYYYMMDD-HHmmss-001.png`. Tăng collision suffix nếu file đã tồn tại.
  - SHA-256 hash tracking: chỉ tăng `savedCount` và ghi file khi hash chưa gặp.
  - Diagnostic error output: khi challenge không có ảnh hoặc decode thất bại, ghi `.bin` và `.json` đã redacted (chứa `receivedAt`, `command: -60`, `payloadLength`, `sha256`, `errorCode`, `errorSection`, `errorOffset`).
  - Streak tracking: dừng sau 5 failure liên tiếp hoặc 20 duplicate liên tiếp.
  - Cleanup idempotent trong `finally` block: abort controller, clear listeners, logout game client.
  - Xử lý SIGINT/SIGTERM graceful exit.

- [x] **Step 2: Verify typecheck**
Chạy: `npm --prefix avatar-web/server run typecheck`
Expected: Không có lỗi typecheck.

---

### Task 5: NPM Script Integration

**Files:**
- Modify: `avatar-web/server/package.json`

**Interfaces:**
- Consumes: CLI script `src/tools/captcha-collector.ts`
- Produces: npm script `"captcha:collect": "tsx src/tools/captcha-collector.ts"`

- [x] **Step 1: Thêm script vào `package.json`**
Cập nhật `avatar-web/server/package.json` để thêm `"captcha:collect"`.

- [x] **Step 2: Verify package.json syntax**
Chạy: `npm --prefix avatar-web/server run typecheck`

---

### Task 6: Static, Build & CLI Validation Verification

**Files:**
- N/A

- [x] **Step 1: Chạy Typecheck & Build**
Chạy: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
Expected: Build thành công không có lỗi.

- [x] **Step 2: Chạy Existing Tests**
Chạy: `npm --prefix avatar-web/server test`
Expected: Toàn bộ suite hiện có pass.

- [x] **Step 3: Test CLI argument validation (offline)**
Chạy các trường hợp lỗi CLI argument:
1. `npm --prefix avatar-web/server run captcha:collect -- --pass 123` (thiếu `--user`)
2. `npm --prefix avatar-web/server run captcha:collect -- --user test` (thiếu `--pass`)
3. `npm --prefix avatar-web/server run captcha:collect -- --user test --pass 123 --count 0` (count không hợp lệ)
4. `npm --prefix avatar-web/server run captcha:collect -- --user test --pass 123 --count 1.5` (count không phải số nguyên)
5. `npm --prefix avatar-web/server run captcha:collect -- --user test --pass 123 --interval-ms 60001` (interval ngoài dải)
6. `npm --prefix avatar-web/server run captcha:collect -- --user test --pass 123 --unknown-arg val` (unknown arg)
7. `npm --prefix avatar-web/server run captcha:collect -- --user a --user b --pass 123` (duplicate arg)
Expected: Tất cả trường hợp exit non-zero, in rõ thông báo lỗi, không in credential ra màn hình và không connect mạng.
