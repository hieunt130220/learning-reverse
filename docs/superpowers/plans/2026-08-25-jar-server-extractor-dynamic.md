# jarServerExtractor Dynamic Resolve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay hardcode sai `27.0.14.120:19129` bằng cơ chế resolve động đúng như cách `avatar-auto.jar` lấy server list (lg.png → u.png → config URL → fetch + XOR + parse).

**Architecture:** Viết lại `jarServerExtractor.ts` thành module async tự chứa: đọc resource `normal/lg.png` từ jar bằng ZIP central-directory parser thủ công (node:zlib, không thêm dep), giải mã XOR `NguyenHuuQuyet`, trích base URL config từ `u.png`, fetch payload server list, parse DataInputStream, cache last-known-good ra đĩa với TTL 24h. Caller duy nhất `captcha-collector.ts` chuyển sang `await`.

**Tech Stack:** Node 22 (ESM), global `fetch`, `node:zlib`, `Buffer`, TypeScript strict, tsx.

**Spec:** `docs/superpowers/specs/2026-08-25-jar-server-extractor-dynamic-design.md`

## Global Constraints
- KHÔNG thêm npm dependency mới; chỉ dùng builtin `node:fs`, `node:path`, `node:url`, `node:zlib` + global `fetch`.
- KHÔNG bao giờ fall-back âm thầm về `27.0.14.120:19129` — lỗi phải throw rõ ràng hoặc dùng cache tươi (< 24h).
- KHÔNG viết test files, KHÔNG TDD (AGENTS.md).
- Message lỗi tiếng Việt, phong cách nhất quán với code hiện có.
- Giữ nguyên hành vi ưu tiên CLI: `--host/--port` > resolve động.
- Blast radius đã xác minh: chỉ 1 caller (`captcha-collector.ts:248`), 0 test tham chiếu — LOW risk.
- Trước khi commit: chạy GitNexus `detect_changes()` để xác nhận scope đúng 2 file nguồn.
- Comment code: giữ tối thiểu, chỉ JSDoc ngắn cho API export (mô phỏng style hiện có của file).

---

### Task 1: Viết lại `jarServerExtractor.ts` với resolver động

**Files:**
- Modify: `avatar-web/server/src/game/jarServerExtractor.ts` (toàn bộ file)

**Interfaces:**
- Consumes: `getDefaultJarPath()` (giữ nguyên logic tìm jar), global `fetch`, `node:zlib.inflateRawSync`.
- Produces: `resolveJarGameServer(opts?: { jarPath?: string; timeoutMs?: number }): Promise<GameServerEndpoint>`; interface `GameServerEndpoint { host; port; source }` (giữ nguyên shape cho caller).

- [x] **Step 1: Ghi toàn bộ nội dung mới của file**

```typescript
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export interface GameServerEndpoint {
  host: string;
  port: number;
  source: string;
}

/**
 * Server game mặc định của thế giới APK AvatarHD — CHỈ dùng làm fallback
 * cho luồng APK, tuyệt đối KHÔNG dùng cho world của avatar-auto.jar.
 */
const JAR_XOR_KEY = Buffer.from('NguyenHuuQuyet', 'utf8');
const FALLBACK_CONFIG_URL = 'http://chip.vcdn.io.vn/avatar/full/';
const CONFIG_ENTRY_KEY = '2';
const LG_RESOURCE = 'normal/lg.png';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/jar-server-cache.json',
);

/**
 * Tìm đường dẫn file JAR mặc định trong repository
 */
export function getDefaultJarPath(): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), 'avatar-jar/avatar-auto.jar'),
    path.resolve(process.cwd(), '../avatar-jar/avatar-auto.jar'),
    path.resolve(process.cwd(), '../../avatar-jar/avatar-auto.jar'),
    path.resolve(currentDir, '../../../../avatar-jar/avatar-auto.jar'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function xorKeyDecrypt(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i++) {
    out[i] ^= JAR_XOR_KEY[i % JAR_XOR_KEY.length];
  }
  return out;
}

function findZipEntry(jarBytes: Buffer, entryName: string): Buffer | null {
  let eocd = -1;
  const scanFloor = Math.max(0, jarBytes.length - 22 - 65_536);
  for (let i = jarBytes.length - 22; i >= scanFloor; i--) {
    if (jarBytes.readUInt32LE(i) === 0x0605_4b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const totalEntries = jarBytes.readUInt16LE(eocd + 10);
  let p = jarBytes.readUInt32LE(eocd + 16);
  for (let n = 0; n < totalEntries; n++) {
    if (p + 46 > jarBytes.length || jarBytes.readUInt32LE(p) !== 0x0201_4b50) return null;
    const method = jarBytes.readUInt16LE(p + 10);
    const compressedSize = jarBytes.readUInt32LE(p + 20);
    const nameLen = jarBytes.readUInt16LE(p + 28);
    const extraLen = jarBytes.readUInt16LE(p + 30);
    const commentLen = jarBytes.readUInt16LE(p + 32);
    const localOffset = jarBytes.readUInt32LE(p + 42);
    const name = jarBytes.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name !== entryName) continue;

    const lhNameLen = jarBytes.readUInt16LE(localOffset + 26);
    const lhExtraLen = jarBytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const raw = Buffer.from(jarBytes.subarray(dataStart, dataStart + compressedSize));
    if (method === 0) return raw;
    if (method === 8) return zlib.inflateRawSync(raw);
    return null;
  }
  return null;
}

function extractUConfig(lgResource: Buffer): string | null {
  try {
    const data = xorKeyDecrypt(lgResource);
    let off = 0;
    const entryCount = data.readUInt8(off);
    off += 1;
    const lengths: number[] = [];
    const names: string[] = [];
    for (let i = 0; i < entryCount; i++) {
      const nameLen = data.readUInt8(off);
      off += 1;
      names.push(xorKeyDecrypt(data.subarray(off, off + nameLen)).toString('latin1'));
      off += nameLen;
      const dataLen = data.readUInt16BE(off);
      off += 2;
      lengths.push(dataLen);
    }
    const blob = xorKeyDecrypt(data.subarray(off));
    const uIndex = names.indexOf('u.png');
    if (uIndex < 0) return null;

    let blobOff = 0;
    for (let i = 0; i < uIndex; i++) blobOff += lengths[i];
    return blob.toString('latin1', blobOff, blobOff + lengths[uIndex]).trim();
  } catch {
    return null;
  }
}

function extractConfigUrl(uConfigBase64: string): string | null {
  try {
    const decoded = Buffer.from(uConfigBase64, 'base64').toString('utf8');
    for (const segment of decoded.split('|')) {
      const eq = segment.indexOf('=');
      if (eq <= 0) continue;
      if (segment.slice(0, eq).trim() === CONFIG_ENTRY_KEY) {
        const value = segment.slice(eq + 1).trim();
        return value.startsWith('http') ? value : null;
      }
    }
  } catch {
    // base64 hỏng — dùng fallback URL
  }
  return null;
}

interface JarServerList {
  groupName: string;
  serverName: string;
  host: string;
  port: number;
}

function parseServerListPayload(payload: Buffer): JarServerList | null {
  try {
    const dec = xorKeyDecrypt(payload);
    let off = 0;
    const readByte = (): number => dec.readUInt8(off++);
    const readUtf = (): string => {
      const len = dec.readUInt16BE(off);
      off += 2;
      const s = dec.toString('utf8', off, off + len);
      off += len;
      return s;
    };
    const readInt = (): number => {
      const v = dec.readInt32BE(off);
      off += 4;
      return v;
    };

    if (readByte() !== 1) return null;
    readUtf();
    readUtf();
    readUtf();

    const groupCount = readByte();
    for (let g = 0; g < groupCount; g++) {
      const serverCount = readByte();
      const groupName = readUtf();
      for (let s = 0; s < serverCount; s++) {
        const serverName = readUtf();
        const host = readUtf().trim();
        const port = readInt();
        if (host !== '' && port > 0 && port <= 65_535) {
          return { groupName, serverName, host, port };
        }
      }
    }
  } catch {
    // payload lệch format — trả null để đi nhánh cache/throw
  }
  return null;
}

async function readCache(): Promise<(GameServerEndpoint & { fetchedAt: string }) | null> {
  try {
    const raw = await fsp.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as GameServerEndpoint & { fetchedAt: string };
    if (
      typeof parsed.host === 'string' &&
      typeof parsed.port === 'number' &&
      typeof parsed.fetchedAt === 'string'
    ) {
      return parsed;
    }
  } catch {
    // chưa có cache hoặc cache hỏng
  }
  return null;
}

async function writeCache(endpoint: GameServerEndpoint): Promise<void> {
  const payload = JSON.stringify(
    { ...endpoint, fetchedAt: new Date().toISOString() },
    null,
    2,
  );
  await fsp.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fsp.writeFile(CACHE_FILE, `${payload}\n`, 'utf8');
}

/**
 * Resolve endpoint game server mà avatar-auto.jar thực sự sử dụng:
 * đọc base URL config từ resource normal/lg.png trong jar, tải payload động
 * và parse server list (cùng cơ chế runtime của jar).
 *
 * Không bao giờ fall-back âm thầm sang server khác; khi mạng lỗi sẽ dùng
 * cache tươi (< 24h) nếu có, ngược lại throw để caller xử lý.
 */
export async function resolveJarGameServer(
  opts: { jarPath?: string; timeoutMs?: number } = {},
): Promise<GameServerEndpoint> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let configUrl = FALLBACK_CONFIG_URL;
  const targetJar = opts.jarPath ? path.resolve(process.cwd(), opts.jarPath) : getDefaultJarPath();
  if (targetJar && fs.existsSync(targetJar)) {
    try {
      const jarBytes = await fsp.readFile(targetJar);
      const lgResource = findZipEntry(jarBytes, LG_RESOURCE);
      const uConfig = lgResource !== null ? extractUConfig(lgResource) : null;
      const urlFromJar = uConfig !== null ? extractConfigUrl(uConfig) : null;
      if (urlFromJar !== null) configUrl = urlFromJar;
    } catch {
      // jar đọc lỗi — giữ fallback URL
    }
  }

  let configHost = FALLBACK_CONFIG_URL;
  try {
    configHost = new URL(configUrl).host;
  } catch {
    // URL lạ — hiển thị nguyên chuỗi trong source label
    configHost = configUrl;
  }

  try {
    const res = await fetch(configUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = Buffer.from(await res.arrayBuffer());
    const server = parseServerListPayload(payload);
    if (server === null) {
      throw new Error('payload không parse được server list (case != 1 hoặc lệch format)');
    }

    const endpoint: GameServerEndpoint = {
      host: server.host,
      port: server.port,
      source: `dynamic config (${configHost}) → ${server.groupName} / ${server.serverName}`,
    };
    try {
      await writeCache(endpoint);
    } catch {
      // cache ghi thất bại không ảnh hưởng kết quả
    }
    return endpoint;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const cached = await readCache();
    if (cached !== null && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL_MS) {
      console.warn(
        `[jarServerExtractor] Không tải được config động (${reason}); dùng cache từ ${cached.fetchedAt}`,
      );
      return {
        host: cached.host,
        port: cached.port,
        source: `${cached.source} (cache ${cached.fetchedAt})`,
      };
    }
    throw new Error(
      `Không resolve được server game của jar từ ${configUrl} (${reason}). ` +
        'Hãy kiểm tra mạng hoặc truyền --host/--port thủ công.',
    );
  }
}
```

Lưu ý: xoá bỏ hoàn toàn `getGameServerFromJar()` cũ, `DEFAULT_FALLBACK_HOST/PORT` cũ và comment sai "reverse từ bx.class/aC.class".

- [x] **Step 2: Kiểm tra compile từng phần**

Run: `cd avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: lỗi duy nhất xuất phát từ `captcha-collector.ts` (chưa cập nhật caller ở Task 2); `jarServerExtractor.ts` không báo lỗi.

---

### Task 2: Cập nhật caller `captcha-collector.ts`

**Files:**
- Modify: `avatar-web/server/src/tools/captcha-collector.ts:15-18,239-252`

**Interfaces:**
- Consumes: `resolveJarGameServer()` từ Task 1.
- Produces: hành vi chạy của tool không đổi khi truyền đủ `--host --port`; tự resolve đúng khi thiếu.

- [x] **Step 1: Sửa import**

Dòng 15 đổi tên hàm:
```typescript
import { resolveJarGameServer } from '../game/jarServerExtractor.js';
```
Xoá dòng 18 (`import { DEFAULT_GAME_SERVER } from '../config.js';`) — dead import.

- [x] **Step 2: Sửa block phân giải server (line ~239-252)**

Thay:
```typescript
    } else {
      const jarServer = getGameServerFromJar(args.jar);
      targetHost = args.host ?? jarServer.host;
      targetPort = args.port ?? jarServer.port;
      serverSource = jarServer.source;
    }
```
Bằng:
```typescript
    } else {
      const jarServer = await resolveJarGameServer({ jarPath: args.jar });
      targetHost = args.host ?? jarServer.host;
      targetPort = args.port ?? jarServer.port;
      serverSource = jarServer.source;
    }
```

- [x] **Step 3: Kiểm tra typecheck toàn project**

Run: `cd avatar-web/server && npm run typecheck`
Expected: exit 0, không còn lỗi nào.

- [x] **Step 4: Commit Task 1+2**

Run:
```bash
git add avatar-web/server/src/game/jarServerExtractor.ts avatar-web/server/src/tools/captcha-collector.ts
```
Chạy GitNexus `detect_changes()` xác nhận scope chỉ gồm các symbol trên trước khi commit:
```bash
git commit -m "fix: resolve đúng server game của avatar-auto.jar qua kênh config động"
```

---

### Task 3: Verification end-to-end

**Files:**
- Read-only: `avatar-web/server/data/jar-server-cache.json` (được tạo lúc chạy)

**Interfaces:**
- Consumes: output Task 1 + Task 2.

- [x] **Step 1: Smoke test resolver**

Run:
```bash
cd avatar-web/server && npx tsx -e "
import { resolveJarGameServer } from './src/game/jarServerExtractor.js';
const ep = await resolveJarGameServer();
console.log(JSON.stringify(ep, null, 2));
"
```
Expected: `host === '112.213.85.102'`, `port === 19128`, `source` chứa "Xứ Sở Diệu Kỳ" và "Thành Phố Hoàn Mỹ".

- [x] **Step 2: Kiểm tra cache file**

Run: `cat avatar-web/server/data/jar-server-cache.json`
Expected: JSON hợp lệ có `host`, `port`, `source`, `fetchedAt`.

- [x] **Step 3: Kiểm tra nhánh offline (cache hit)**

Run: chặn DNS/tạm sửa `FALLBACK_CONFIG_URL` thành domain không tồn tại rồi chạy lại Step 1 một lần nữa (không commit thay đổi này).
Expected: log warning "Không tải được config động" + vẫn trả `112.213.85.102:19128` từ cache; xóa cache file rồi chạy lại lần nữa → throw Error tiếng Việt hướng dẫn `--host/--port`. Khôi phục code sau test.

- [ ] **Step 4: Chạy thật collector 1 ảnh (tuỳ chọn, cần tài khoản)**

Run: `cd avatar-web/server && npm run captcha:collect -- --user <TK> --pass <MK> --count 1` (không truyền `--host/--port`)
Expected: log "[CAPTCHA-COLLECTOR] Bắt đầu kết nối máy chủ 112.213.85.102:19128 (dynamic config ...)"; đăng nhập vào đúng world Xứ Sở Diệu Kỳ.

