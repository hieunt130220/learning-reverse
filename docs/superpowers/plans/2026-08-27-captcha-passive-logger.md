# Captcha Passive Logger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Lưu tự động ảnh captcha (cmd -60) khi người dùng chơi game qua avatar-web, kèm log và nút download.

**Architecture:** Mở rộng `GameClient.onMessage` để decode và emit `captcha` event; `AvatarSession` lắng event, ghi file nguyên tử vào `server/captcha-dataset/` và broadcast qua WS; frontend thêm panel hiển thị và download.

**Tech Stack:** TypeScript, Node.js, ws, fs/promises, crypto (sha256), PNG/JPEG/GIF magic detection (đã có trong captchaProtocol)

**Spec:** `docs/superpowers/specs/2026-08-27-captcha-passive-logger-design.md`

## Global Constraints
- Không OCR, không gửi đáp án, không bypass captcha.
- Không phá vỡ login/farm/shop/quest/auto hiện có; thay đổi tối thiểu.
- Không lộ credential: không log password/key, prompt chỉ log tóm tắt.
- Không ghi đè file: tên unique, temp+rename nguyên tử, giới hạn 5 MiB.
- Không TDD, không tạo test mới trừ khi user yêu cầu.
- Phải chạy `impact` trước khi sửa symbol hiện có, `detect_changes` trước commit.

### Task 1: Thêm handler cmd -60 trong GameClient

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:825-1400`
- Modify: `avatar-web/server/src/game/client.ts:195-320` (EventEmitter types nếu cần)

**Interfaces:**
- Consumes: `decodeCaptchaChallenge`, `decodeCaptchaImage`, `detectImageFormat` từ `./captchaProtocol.js`, `Message`, `crypto.createHash`
- Produces: `emit('captcha', CaptchaEvent)` cho AvatarSession và `emit('log', string)` cho UI

- [x] **Step 1: Thêm import và type CaptchaEvent**
  ```typescript
  import { decodeCaptchaChallenge, decodeCaptchaImage, detectImageFormat, type CaptchaChallenge } from './captchaProtocol.js';
  import crypto from 'node:crypto';
  export type CaptchaEvent = {
    challenge: CaptchaChallenge;
    decoded: { format: string; bytes: Buffer } | null;
    sha256: string | null;
    error: Error | null;
    rawHex: string;
  };
  ```

- [x] **Step 2: Thêm case -60 trong onMessage (trước default emit message)**
  ```typescript
  case -60: {
    const body = msg.getData();
    const rawHex = body.toString('hex');
    try {
      const challenge = decodeCaptchaChallenge(body);
      let decoded = null;
      let sha256: string | null = null;
      let error: Error | null = null;
      if (challenge.imageBytes) {
        sha256 = crypto.createHash('sha256').update(challenge.imageBytes).digest('hex');
        try {
          decoded = decodeCaptchaImage(challenge);
        } catch (e) {
          error = e as Error;
        }
      }
      this.emit('captcha', { challenge, decoded, sha256, error, rawHex } as CaptchaEvent);
      const fmt = decoded?.format ?? (challenge.imageBytes ? 'unknown' : 'no-image');
      const size = challenge.imageBytes?.length ?? 0;
      this.emit('log', `[captcha] nhận challenge targetId=${challenge.targetId} menuId=${challenge.menuId} prompt="${challenge.prompt.slice(0,30)}" format=${fmt} bytes=${size} sha=${(sha256 ?? '').slice(0,12)}${sha256 ? '...' : ''}`);
    } catch (err) {
      this.emit('captcha', { challenge: null as any, decoded: null, sha256: null, error: err as Error, rawHex });
      this.emit('log', `[captcha] lỗi decode: ${(err as Error).message} hex=${rawHex.slice(0,64)}`);
    }
    break;
  }
  ```
  Đảm bảo vẫn `this.emit('message', msg);` ở cuối `onMessage` để collector không miss packet.

- [x] **Step 3: Verify**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: no error

- [x] **Step 4: Commit**
  `git add avatar-web/server/src/game/client.ts && git commit -m "feat(captcha): handle cmd -60 in GameClient and emit captcha event"`

### Task 2: Lưu file passive và broadcast trong AvatarSession

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:720-830` (wire)
- Create: `avatar-web/server/src/game/captchaPassiveSaver.ts` (utility)
- Modify: `avatar-web/server/src/ws.ts:15` (LIGHT_EVENTS)

**Interfaces:**
- Consumes: `CaptchaEvent` từ GameClient, `fs/promises`, `path`, `crypto`
- Produces: WS event `captcha` payload, file trên đĩa, `pushLog`

- [x] **Step 1: Tạo utility savePassiveCaptcha**
  ```typescript
  // avatar-web/server/src/game/captchaPassiveSaver.ts
  import fs from 'node:fs/promises';
  import path from 'node:path';
  import crypto from 'node:crypto';
  import { type CaptchaChallenge } from './captchaProtocol.js';
  export async function savePassiveCaptcha(
    challenge: CaptchaChallenge,
    accountId: number,
    outputDir = path.resolve('server/captcha-dataset')
  ): Promise<{ fileName: string|null; savedPath: string|null; format: string|null; sha256:string|null; isDiagnostic:boolean }>{
    await fs.mkdir(outputDir, { recursive:true });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}-${String(now.getMilliseconds()).padStart(3,'0')}`;
    // seq per process: dùng global counter
    // detect format
    let ext = 'bin';
    let bytes: Buffer|null = challenge.imageBytes;
    if (bytes) {
      if (bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) ext='png';
      else if (bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) ext='jpeg';
      else if (bytes.subarray(0,6).toString('ascii')==='GIF87a' || bytes.subarray(0,6).toString('ascii')==='GIF89a') ext='gif';
    }
    // tìm tên không trùng
    let seq=1;
    let fileName='';
    while (true) {
      fileName = `captcha-${ts}-${String(seq).padStart(3,'0')}.${ext}`;
      try { await fs.access(path.join(outputDir, fileName)); seq++; } catch { break; }
      if (seq>999) break;
    }
    const tmp = path.join(outputDir, `.tmp-${fileName}`);
    const target = path.join(outputDir, fileName);
    if (bytes) await fs.writeFile(tmp, bytes);
    else await fs.writeFile(tmp, Buffer.from([]));
    await fs.rename(tmp, target);
    const sha = bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : null;
    return { fileName, savedPath: target, format: ext==='bin'?null:ext, sha256: sha, isDiagnostic: ext==='bin' };
  }
  ```

- [x] **Step 2: Wire trong AvatarSession**
  ```typescript
  // trong wire(client, epoch)
  client.on('captcha', async (ev: CaptchaEvent) => {
    if (!this.isCurrent(client, epoch)) return;
    try {
      if (!ev.challenge) {
        this.pushLog(`[captcha] lỗi decode không có challenge: ${ev.error?.message}`);
        this.emit('captcha', { accountId: this.opts.accountId, error: ev.error?.message, rawHex: ev.rawHex.slice(0,64) });
        return;
      }
      const { fileName, savedPath, format, sha256, isDiagnostic } = await savePassiveCaptcha(ev.challenge, this.opts.accountId);
      this.pushLog(`[captcha] đã lưu ${fileName} [${format ?? 'bin'}, ${ev.challenge.imageBytes?.length ?? 0} bytes, sha=${(sha256 ?? '').slice(0,12)}] prompt="${ev.challenge.prompt.slice(0,30)}"`);
      this.emit('captcha', {
        accountId: this.opts.accountId,
        targetId: ev.challenge.targetId,
        menuId: ev.challenge.menuId,
        prompt: ev.challenge.prompt,
        inputType: ev.challenge.inputType,
        format,
        fileName,
        savedPath,
        sha256,
        receivedAt: new Date().toISOString(),
        isDiagnostic
      });
    } catch (e) {
      this.pushLog(`[captcha] lỗi lưu file: ${(e as Error).message}`);
    }
  });
  ```

- [x] **Step 3: Thêm 'captcha' vào LIGHT_EVENTS**
  ```typescript
  // ws.ts
  export const LIGHT_EVENTS = new Set(['status','auto','auto-disabled','farm-sync','captcha']);
  ```

- [x] **Step 4: Verify**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: success, no regression

- [x] **Step 5: Commit**
  `git add avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/game/captchaPassiveSaver.ts avatar-web/server/src/ws.ts && git commit -m "feat(captcha): passive save and WS broadcast for cmd -60"`

### Task 3: API download và phục vụ file

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts` hoặc `avatar-web/server/src/index.ts`
- Modify: `avatar-web/server/src/game/captchaPassiveSaver.ts` (export outputDir constant)

**Interfaces:**
- Consumes: `fs`, `path`
- Produces: HTTP GET `/api/captcha/download/:accountId/:fileName`

- [x] **Step 1: Thêm route GET download**
  ```typescript
  // trong session routes hoặc index.ts
  app.get('/api/captcha/:accountId/download/:fileName', async (req,res)=>{
    const { accountId, fileName } = req.params;
    // auth check: getAccount(db, userId, Number(accountId))
    // sanitize fileName: chỉ cho phép captcha-*.png|jpeg|gif|bin
    if (!/^captcha-[\d-]+\.(\w+)$/.test(fileName)) return res.status(400).end();
    const filePath = path.resolve('server/captcha-dataset', fileName);
    // đảm bảo file nằm trong outputDir
    if (!filePath.startsWith(path.resolve('server/captcha-dataset'))) return res.status(403).end();
    try { await fs.access(filePath); } catch { return res.status(404).end(); }
    res.sendFile(filePath);
  });
  ```

- [x] **Step 2: Verify**
  Run: `curl` test với file mẫu `/tmp/captcha.png` copy vào `captcha-dataset` và GET

- [x] **Step 3: Commit**
  `git add avatar-web/server/src/session/routes.ts && git commit -m "feat(captcha): add download API for passive captcha images"`

### Task 4: Frontend hiển thị và download

**Files:**
- Create: `avatar-web/web/src/accounts/panels/CaptchaPanel.tsx`
- Modify: `avatar-web/web/src/types.ts`
- Modify: `avatar-web/web/src/accounts/useAccountRuntime.ts`
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx` hoặc `AccountsDashboardPage.tsx` để nhúng panel

**Interfaces:**
- Consumes: WS event `captcha` payload
- Produces: UI panel với thumbnail + download button

- [x] **Step 1: Thêm type**
  ```typescript
  export type CaptchaPayload = {
    accountId:number; prompt:string; format:string|null; fileName:string|null; sha256:string|null; receivedAt:string;
  };
  ```

- [x] **Step 2: Tạo CaptchaPanel**
  ```typescript
  export function CaptchaPanel({ captcha }:{captcha: CaptchaPayload|null}){
    if(!captcha) return <p className="hint">chưa có captcha</p>;
    return <div className="card">
      <h3>Captcha mới</h3>
      <p>{captcha.prompt} ({captcha.format})</p>
      <a href={`/api/captcha/${captcha.accountId}/download/${captcha.fileName}`} download>Download {captcha.fileName}</a>
      {captcha.format==='png' && <img src={`/api/captcha/${captcha.accountId}/download/${captcha.fileName}`} style={{maxWidth:200}} />}
    </div>
  }
  ```

- [x] **Step 3: Wire trong useAccountRuntime**
  ```typescript
  // lắng ws 'captcha' và setState
  ws.onmessage = (ev)=>{
    const msg=JSON.parse(ev.data);
    if(msg.type==='captcha') setCaptcha(msg.payload);
  }
  ```

- [x] **Step 4: Verify**
  Run: `npm --prefix avatar-web/web run build`
  Expected: build success

- [x] **Step 5: Commit**
  `git add avatar-web/web/src/accounts/panels/CaptchaPanel.tsx avatar-web/web/src/types.ts avatar-web/web/src/accounts/useAccountRuntime.ts && git commit -m "feat(web): show passive captcha and download link"`

### Task 5: Kiểm thử thủ công và dọn dẹp

**Files:**
- Verify các file đã tạo/sửa

- [x] **Step 1: Build toàn bộ**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
  Expected: all pass

- [x] **Step 2: Test thủ công**
  - Chạy server dev, đăng nhập 1 acc, trigger captcha bằng `openGameGate` (hoặc chơi đến khi server gửi -60).
  - Kiểm tra `server/captcha-dataset/` có file mới `captcha-...png` mở được, log có `[captcha] đã lưu`.
  - UI hiển thị panel, click Download tải được file.
  - Gửi `sendRaw -60` malformed -> diagnostic `.bin` + log không crash.

- [x] **Step 3: Pre-commit check**
  Run: `git status && git diff --stat`
  Expected: chỉ các file trong plan bị đổi

