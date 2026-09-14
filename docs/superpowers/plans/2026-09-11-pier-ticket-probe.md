# Pier Ticket Probe (Vé Bến Tàu Map 27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo probe `pier-ticket-probe.ts` tìm chỗ bán vé câu cá bến tàu Map 27 qua 4 phase (A: discovery NPC, B: menu NPC, C: sweep buyItemStack, D: opcode -74).

**Architecture:** Một file tool độc lập trong `avatar-web/server/src/tools/`, reuse `GameClient` + `sendRaw` + events (`traffic`, `dialog`, `park-buy-item`) theo đúng pattern của `fishing-probe.ts` / `npc-map-probe.ts`. Không import automation runtime. Mỗi task thêm một phase, file luôn compile được sau mỗi task.

**Tech Stack:** Node 22, TypeScript 5.7 (strict), tsx, better-sqlite3 (qua `openDb`), ws (qua `GameClient`).

**Spec:** `docs/superpowers/specs/2026-09-11-pier-ticket-probe-design.md`

## Global Constraints

- KHÔNG TDD: không tạo test file, không viết test trước — verify bằng typecheck + chạy CLI khô. Chỉ viết test khi user yêu cầu trực tiếp.
- ESM: mọi import nội bộ có suffix `.js` (vd `../game/client.js`). Không dùng `import path` — nối chuỗi đường dẫn thường để tránh rủi ro `esModuleInterop`.
- An toàn tiền thật: sweep mua luôn `num=1`, delay 1s giữa các lệnh, pass xu (`typeMoney=1`) trước; pass Lượng (`typeMoney=2`) chỉ khi có flag `--allow-luong`; có `success` ngoài ý muốn → dừng sweep ngay; Phase B gặp prompt mua → dừng NPC đó, không confirm; không gửi `TX41`/`TX43` trong probe này.
- GitNexus: file probe là file mới, không sửa symbol hiện hữu nào → `impact` N/A; trước mỗi commit chạy `gitnexus_detect_changes({scope:"all"})` và chỉ commit đúng file probe.
- CLI: cặp key-value, không positional arg; `map` cố định `27` (không có flag `--map`); `--area` trong i8 `-128..127`, mặc định `0`; `--id-lo/--id-hi` mặc định `461/475`.
- Probe pattern: `assertAvatarWebStopped` trước mọi phase; `enterParkContext()` đúng 1 lần; `logout()` + `db.close()` trong `finally`.
- Commit message theo convention repo: `feat(probe): ...`.

---

### Task 1: Scaffold + shared infra + Phase A (discovery Map 27)

**Files:**
- Create: `avatar-web/server/src/tools/pier-ticket-probe.ts`

**Interfaces:**
- Consumes: `GameClient` (`login`, `enterParkContext`, `sendRaw`, events `traffic`/`dialog`/`status`/`temporary-rejection`, `session` events `message`/`closed`, `logout`), `NATIVE_PARK_JOIN_POSITIONS` (`../game/parkService.js`), `MyReader`/`Message` (`../proto/*.js`), `loadConfig`/`openDb`/`getAccountById`/`readGamePass`.
- Produces: `ProbeArgs` (phase `'a'`), `Evidence`, `NpcEntry`, `BuyCell`, `MenuProbeResult`, `Cmd74Probe`, helpers `delayCancellable`, `waitForRx45`, `waitForCmd`, `waitForRx80`, `joinPark`, `joinMap27WithRetry`, `decodeMapSpecialUpdate`, `collectMapSpecials`, `discoverNpc`, `ensureRunDir`, `writeJson`, `runPhaseA`, `runProbe`.

- [ ] **Step 1: Tạo file với imports + types + error + parseArgs (phase `a` only)**

```ts
import { get as httpGet } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo, SessionCloseKind } from '../proto/session.js';

type Phase = 'a';

interface ProbeArgs {
  accountId: number;
  phase: Phase;
  outputDir: string;
  area: number;
  idLo: number;
  idHi: number;
  npcId?: number;
  candidateIds: number[];
  allowLuong: boolean;
}

interface TxRxMetadata {
  phase: string;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}

interface ProbeEventMetadata {
  phase: string;
  event: 'dialog' | 'temporary-rejection' | 'status' | 'closed';
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseKind;
  hadError?: boolean;
}

interface NpcEntry {
  id: number;
  name: string;
  x: number;
  y: number;
  type: number;
  menuCount: number;
}

interface BuyCell {
  id: number;
  typeMoney: number;
  result: 'success' | 'rejected' | 'timeout';
  message?: string;
  price?: number;
  xuAfter?: number;
  luongAfter?: number;
}

interface MenuProbeResult {
  npcId: number;
  npcName: string;
  menuIndex: number;
  observedCmds: { cmd: number; len: number }[];
  dialogs: string[];
  outcome: 'responded' | 'no-response' | 'buy-prompt-stop';
}

interface Cmd74Probe {
  id: number;
  rxCmds: { cmd: number; len: number }[];
}

interface Evidence {
  timestamp: string;
  accountId: number;
  phase: string;
  requested: { map: number; area: number };
  traffic: TxRxMetadata[];
  events: ProbeEventMetadata[];
  rx45: { iss: boolean; error?: string } | null;
  dialog40: string[];
  npc: NpcEntry[];
  menuProbes: MenuProbeResult[];
  buyMatrix: BuyCell[];
  cmd74: Cmd74Probe[];
}

class RedactedProbeError extends Error {
  constructor(
    readonly section: string,
    message: string,
    readonly offset = -1,
  ) {
    super(message);
    this.name = 'RedactedProbeError';
  }
}

function redactedFailure(error: unknown): { section: string; offset: number; message: string } {
  if (error instanceof RedactedProbeError) {
    return { section: error.section, offset: error.offset, message: error.message };
  }
  return { section: 'runtime', offset: -1, message: 'probe thất bại; chi tiết runtime đã được ẩn' };
}

const BOOLEAN_FLAGS = new Set(['--allow-luong']);
const STRING_KEYS = new Set(['--phase', '--output-dir', '--candidate-ids']);
const INT_KEYS = new Set(['--account-id', '--area', '--id-lo', '--id-hi', '--npc-id']);
const ALL_KEYS = new Set([...BOOLEAN_FLAGS, ...STRING_KEYS, ...INT_KEYS]);

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new RedactedProbeError('cli', `${key} phải là số nguyên đơn`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new RedactedProbeError('cli', `${key} vượt giới hạn số nguyên an toàn`);
  }
  return value;
}

function parseCandidateIds(raw: string | undefined): number[] {
  if (!raw) return [];
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    if (!/^\d+$/.test(s)) {
      throw new RedactedProbeError('cli', `--candidate-ids chứa giá trị không phải số nguyên dương: ${s}`);
    }
    const v = Number(s);
    if (!Number.isSafeInteger(v) || v < 1 || v > 32767) {
      throw new RedactedProbeError('cli', `--candidate-ids id ngoài [1,32767]: ${s}`);
    }
    return v;
  });
  if (ids.length > 5) {
    throw new RedactedProbeError('cli', '--candidate-ids tối đa 5 id');
  }
  return [...new Set(ids)];
}

function parseArgs(argv: string[]): ProbeArgs {
  const ints = new Map<string, number>();
  const strs = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (!ALL_KEYS.has(key)) {
      throw new RedactedProbeError('cli', `key hoặc positional argument không được phép: ${key}`);
    }
    if (BOOLEAN_FLAGS.has(key)) {
      if (bools.has(key)) throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
      bools.add(key);
      continue;
    }
    const raw = argv[i + 1];
    if (raw === undefined || raw.startsWith('--')) {
      throw new RedactedProbeError('cli', `thiếu value cho ${key}`);
    }
    i++;
    if (STRING_KEYS.has(key)) {
      if (strs.has(key)) throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
      strs.set(key, raw);
      continue;
    }
    if (ints.has(key)) throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
    ints.set(key, parseInteger(key, raw));
  }
  const accountId = ints.get('--account-id');
  if (accountId === undefined) throw new RedactedProbeError('cli', 'thiếu key bắt buộc: --account-id');
  if (accountId <= 0) throw new RedactedProbeError('cli', '--account-id phải là số nguyên dương');
  const outputDir = strs.get('--output-dir');
  if (!outputDir) throw new RedactedProbeError('cli', 'thiếu key bắt buộc: --output-dir');
  const phaseRaw = strs.get('--phase') ?? 'a';
  if (phaseRaw !== 'a') throw new RedactedProbeError('cli', '--phase phải là a');
  const area = ints.get('--area') ?? 0;
  if (area < -128 || area > 127) throw new RedactedProbeError('cli', '--area phải nằm trong signed-byte -128..127');
  const idLo = ints.get('--id-lo') ?? 461;
  const idHi = ints.get('--id-hi') ?? 475;
  for (const [k, v] of [['--id-lo', idLo], ['--id-hi', idHi]] as const) {
    if (v < 1 || v > 32767) throw new RedactedProbeError('cli', `${k} phải nằm trong [1,32767]`);
  }
  if (idLo > idHi) throw new RedactedProbeError('cli', '--id-lo phải <= --id-hi');
  const npcId = ints.get('--npc-id');
  if (npcId !== undefined && npcId <= 0) {
    throw new RedactedProbeError('cli', '--npc-id phải là số nguyên dương');
  }
  return {
    accountId,
    phase: phaseRaw as Phase,
    outputDir,
    area,
    idLo,
    idHi,
    npcId,
    candidateIds: parseCandidateIds(strs.get('--candidate-ids')),
    allowLuong: bools.has('--allow-luong'),
  };
}
```

- [ ] **Step 2: Thêm shared infra — health check, login, waiters**

```ts
let shuttingDown = false;

function assertAvatarWebStopped(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RedactedProbeError('health', 'PORT local không hợp lệ');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    const request = httpGet({
      host: '127.0.0.1',
      port,
      path: '/api/auth/me',
      timeout: 750,
    }, (response) => {
      response.resume();
      finish(new RedactedProbeError('health', 'hãy dừng Avatar Web server trước khi probe'));
      request.destroy();
    });
    request.once('timeout', () => {
      finish();
      request.destroy();
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if (error.code === 'ECONNREFUSED') {
        finish();
        return;
      }
      finish(new RedactedProbeError('health', `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`));
    });
  });
}

async function loginWithTimeout(
  client: GameClient,
  options: Parameters<GameClient['login']>[0],
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        client.logout();
      } finally {
        reject(new RedactedProbeError('login', 'hết giờ kết nối hoặc bắt đầu đăng nhập game'));
      }
    }, timeoutMs);
  });
  try {
    const login = client.login(options);
    await Promise.race([login, timeout]);
  } catch (error) {
    if (error instanceof RedactedProbeError) throw error;
    throw new RedactedProbeError('login', 'không thể kết nối hoặc bắt đầu đăng nhập game');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(new RedactedProbeError('login', `game client không online (status=${client.status})`));
  }
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      client.removeListener('status', onStatus);
    };
    const onStatus = (status: ClientStatus): void => {
      if (status === 'online') {
        cleanup();
        resolve();
      } else if (status === 'error' || status === 'idle') {
        cleanup();
        reject(new RedactedProbeError('login', `game client không online (status=${status})`));
      }
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new RedactedProbeError('login', 'hết giờ chờ game client online'));
    }, timeoutMs);
    client.on('status', onStatus);
  });
}

function waitForParkHandlerResponse(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof RedactedProbeError
        ? error
        : new RedactedProbeError('handler', 'không nhận được ACK handler Park'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length !== 1 || body.readInt8(0) !== 9) return;
      finishResolve();
    };
    const onAbort = (): void => finishReject(new RedactedProbeError('handler', 'chờ ACK handler bị hủy'));
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(new RedactedProbeError('handler', 'hết giờ chờ ACK handler Park'));
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function delayCancellable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || shuttingDown) { resolve(); return; }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function waitForCmd(
  client: GameClient,
  signal: AbortSignal,
  cmd: number,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (v: boolean): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(v);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== cmd) return;
      finish(true);
    };
    const onAbort = (): void => finish(false);
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(false), timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function waitForRx45(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ iss: boolean; error?: string } | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (value: { iss: boolean; error?: string } | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 45) {
        try {
          const r = new MyReader(msg.getData());
          const iss = r.readBoolean();
          const error = iss ? undefined : r.readUTF();
          finish({ iss, error });
        } catch {
          finish({ iss: false, error: 'RX45 decode error' });
        }
      }
    };
    const onAbort = (): void => finish(null);
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function waitForRx80(client: GameClient, signal: AbortSignal, timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (v: Buffer | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(v);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 80) return;
      finish(msg.getData());
    };
    const onAbort = (): void => finish(null);
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
    if (signal.aborted) onAbort();
  });
}
```

- [ ] **Step 3: Thêm decode RX48 + join/discovery + output writers**

```ts
type MapSpecialUpdate =
  | { mode: number; operation: 'upsert'; responseBytes: number; id: number; name: string; x: number; y: number; type: number; imageCount: number; menuCount: number; trailingBytes: number }
  | { mode: number; operation: 'remove'; responseBytes: number; id: number; trailingBytes: number }
  | { mode: number; operation: 'unsupported'; responseBytes: number; id: number; trailingBytes: number };

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new RedactedProbeError('map-special', `thiếu count ${section}`, reader.position);
  }
  const raw = reader.readByte();
  if (raw < 0) return 0;
  if (raw > 64) {
    throw new RedactedProbeError('map-special', `count ${section} vượt giới hạn`, reader.position - 1);
  }
  return raw;
}

function readNativeUtf(reader: MyReader, section: string): string {
  if (reader.available() < 2) {
    throw new RedactedProbeError('map-special', `thiếu độ dài UTF ${section}`, reader.position);
  }
  const length = reader.readUnsignedShort();
  if (length > 8192 || reader.available() < length) {
    throw new RedactedProbeError('map-special', `UTF ${section} vượt bounds`, reader.position - 2);
  }
  return reader.readBytes(length).toString('utf8');
}

function readNativeBytes(reader: MyReader, bytes: number, section: string): void {
  if (bytes < 0 || reader.available() < bytes) {
    throw new RedactedProbeError('map-special', `thiếu bytes ${section}`, reader.position);
  }
  reader.readBytes(bytes);
}

function decodeMapSpecialUpdate(body: Buffer): MapSpecialUpdate {
  const reader = new MyReader(body);
  const mode = reader.readByte();
  if (mode === 2) {
    const id = reader.readInt();
    return { mode, operation: 'remove', responseBytes: body.length, id, trailingBytes: reader.available() };
  }
  if (mode < 0 || mode > 1) {
    return { mode, operation: 'unsupported', responseBytes: body.length, id: -1, trailingBytes: reader.available() };
  }
  const id = reader.readInt();
  const name = readNativeUtf(reader, 'special-update.name');
  const x = reader.readInt();
  const y = reader.readInt();
  const type = reader.readByte();
  const imageCount = readNativeCount(reader, 'special-update.images');
  readNativeBytes(reader, imageCount * 2, 'special-update.images');
  readNativeBytes(reader, 8 * 4, 'special-update.state');
  const menuCount = readNativeCount(reader, 'special-update.menus');
  readNativeBytes(reader, menuCount * 2, 'special-update.menus');
  return { mode, operation: 'upsert', responseBytes: body.length, id, name, x, y, type, imageCount, menuCount, trailingBytes: reader.available() };
}

function collectMapSpecials(client: GameClient): { stop: () => NpcEntry[] } {
  const entries = new Map<number, NpcEntry>();
  const onMessage = (msg: Message): void => {
    if (msg.command !== 48) return;
    try {
      const u = decodeMapSpecialUpdate(msg.getData());
      if (u.operation === 'upsert') {
        entries.set(u.id, { id: u.id, name: u.name, x: u.x, y: u.y, type: u.type, menuCount: u.menuCount });
      } else if (u.operation === 'remove') {
        entries.delete(u.id);
      }
    } catch {
      /* bỏ qua gói 48 lỗi — capture best-effort */
    }
  };
  client.session.on('message', onMessage);
  return {
    stop: () => {
      client.session.removeListener('message', onMessage);
      return [...entries.values()];
    },
  };
}

async function joinPark(client: GameClient, map: number, area: number, signal: AbortSignal): Promise<Buffer> {
  const pos = NATIVE_PARK_JOIN_POSITIONS[map] ?? { x: 254, y: 82 };
  const pending = waitForRx80(client, signal, 7000);
  client.sendRaw(80, [
    { t: 'i8', v: String(map) },
    { t: 'i8', v: String(area) },
    { t: 'i16', v: String(pos.x) },
    { t: 'i16', v: String(pos.y) },
  ]);
  const body = await pending;
  if (!body) throw new RedactedProbeError('park-response', `hết giờ chờ RX 80 (map ${map} khu ${area})`);
  return body;
}

async function joinMap27WithRetry(client: GameClient, args: ProbeArgs, signal: AbortSignal): Promise<number> {
  const areas = [args.area, 0, 1, 2].filter((v, i, a) => a.indexOf(v) === i);
  let lastErr: unknown = null;
  for (const area of areas) {
    if (signal.aborted || shuttingDown) break;
    try {
      const body = await joinPark(client, 27, area, signal);
      if (body.length >= 2 && body.readInt8(0) === 27) return area;
      lastErr = new RedactedProbeError('park-response', `RX80 trả map ${body.length >= 2 ? body.readInt8(0) : '?'} thay vì 27`);
    } catch (e) {
      lastErr = e;
    }
    await delayCancellable(1000, signal);
  }
  throw lastErr instanceof Error
    ? lastErr
    : new RedactedProbeError('park-response', 'không vào được Map 27 ở các area 0..2');
}

async function discoverNpc(
  client: GameClient,
  args: ProbeArgs,
  signal: AbortSignal,
  dialogs: string[],
): Promise<NpcEntry[]> {
  const collector = collectMapSpecials(client);
  const onDialog = (text: string): void => {
    dialogs.push(text);
  };
  client.on('dialog', onDialog);
  let npc: NpcEntry[] = [];
  try {
    await joinMap27WithRetry(client, args, signal);
    await delayCancellable(3000, signal);
  } finally {
    client.removeListener('dialog', onDialog);
    npc = collector.stop().sort((a, b) => a.id - b.id);
  }
  return npc;
}

function ensureRunDir(outputDir: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = `${outputDir}/pier-ticket/${stamp}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(dir: string, name: string, data: unknown): void {
  writeFileSync(`${dir}/${name}`, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 4: Thêm runPhaseA + runProbe + entry point**

```ts
async function runPhaseA(
  client: GameClient,
  args: ProbeArgs,
  signal: AbortSignal,
): Promise<{ rx45: Evidence['rx45']; dialog40: string[]; npc: NpcEntry[] }> {
  const boardPending = waitForCmd(client, signal, 90, 5000);
  client.sendRaw(90, [{ t: 'i8', v: '27' }]);
  await boardPending; // best-effort: có hay không đều đi tiếp join
  const dialogs: string[] = [];
  const npc = await discoverNpc(client, args, signal, dialogs);
  // TX45 biết trước sẽ reject — chỉ để capture chuỗi lỗi chính xác.
  const rx45Pending = waitForRx45(client, signal, 8000);
  client.sendRaw(45, []);
  const rx45 = await rx45Pending;
  client.sendRaw(44, []); // reset server state
  return { rx45, dialog40: dialogs.slice(), npc };
}

async function runProbe(
  args: ProbeArgs,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    throw new RedactedProbeError('config', 'cấu hình probe không hợp lệ hoặc thiếu');
  }
  await assertAvatarWebStopped(config.port);
  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  const phase = args.phase;
  const onTraffic = (entry: TrafficEntry): void => {
    metadata.push({ phase, dir: entry.dir === 'tx' ? 'TX' : 'RX', cmd: entry.cmd, len: entry.len });
  };
  const onDialog = (): void => {
    events.push({ phase, event: 'dialog' });
  };
  const onTemporaryRejection = (value: TemporaryLoginRejection): void => {
    events.push({ phase, event: 'temporary-rejection', retryAfterMs: value.retryAfterMs });
  };
  const onStatus = (status: ClientStatus): void => {
    events.push({ phase, event: 'status', status });
  };
  const onClosed = (info: SessionCloseInfo): void => {
    events.push({ phase, event: 'closed', closeKind: info.kind, hadError: info.hadError });
  };
  client.on('traffic', onTraffic);
  client.on('dialog', onDialog);
  client.on('temporary-rejection', onTemporaryRejection);
  client.on('status', onStatus);
  client.session.on('closed', onClosed);
  try {
    const row = getAccountById(db, args.accountId);
    if (!row) throw new RedactedProbeError('account', `không có account #${args.accountId}`);
    await loginWithTimeout(client, {
      host: row.host,
      port: row.port,
      user: row.gameUser,
      pass: readGamePass(db, config.masterKey, args.accountId),
      device: row.device,
    }, 12000);
    await waitUntilOnline(client, 10000);
    const handlerPending = waitForParkHandlerResponse(client, abort.signal, 5000);
    client.enterParkContext();
    await handlerPending;
    const evidence: Evidence = {
      timestamp: new Date().toISOString(),
      accountId: args.accountId,
      phase: args.phase,
      requested: { map: 27, area: args.area },
      traffic: metadata,
      events,
      rx45: null,
      dialog40: [],
      npc: [],
      menuProbes: [],
      buyMatrix: [],
      cmd74: [],
    };
    const fragA = await runPhaseA(client, args, abort.signal);
    evidence.rx45 = fragA.rx45;
    evidence.dialog40 = fragA.dialog40;
    evidence.npc = fragA.npc;
    const runDir = ensureRunDir(args.outputDir);
    writeJson(runDir, 'evidence.json', evidence);
    writeJson(runDir, 'npc.json', evidence.npc);
    console.log(JSON.stringify({
      timestamp: evidence.timestamp,
      runDir,
      phase: 'a',
      rx45: evidence.rx45,
      npcCount: evidence.npc.length,
      dialog40Count: evidence.dialog40.length,
    }, null, 2));
  } finally {
    client.removeListener('traffic', onTraffic);
    client.removeListener('dialog', onDialog);
    client.removeListener('temporary-rejection', onTemporaryRejection);
    client.removeListener('status', onStatus);
    client.session.removeListener('closed', onClosed);
    abort.abort();
    try {
      client.logout();
    } finally {
      db.close();
    }
  }
}

process.on('SIGINT', () => { shuttingDown = true; });
process.on('SIGTERM', () => { shuttingDown = true; });

let args: ProbeArgs | undefined;
const metadata: TxRxMetadata[] = [];
const events: ProbeEventMetadata[] = [];
try {
  args = parseArgs(process.argv.slice(2));
  await runProbe(args, metadata, events);
} catch (error) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...(args ? { accountId: args.accountId, requested: { map: 27, area: args.area } } : {}),
    traffic: metadata,
    events,
    decode: 'error',
    ...redactedFailure(error),
  }, null, 2));
  process.exitCode = 1;
}
```

- [ ] **Step 5: Typecheck**

Run: `cd avatar-web/server && npx tsc -p tsconfig.json --noEmit`
Expected: pass, không error mới.

- [ ] **Step 6: Chạy CLI khô (không login)**

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --phase a`
Expected: exit 1, JSON stderr chứa `thiếu key bắt buộc: --account-id`.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase b --output-dir /tmp/pier-probe`
Expected: exit 1, JSON stderr chứa `--phase phải là a`.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase a --output-dir /tmp/pier-probe --id-lo 500 --id-hi 400`
Expected: exit 1, JSON stderr chứa `--id-lo phải <= --id-hi`.

- [ ] **Step 7: Detect changes + Commit**

Run: `gitnexus_detect_changes({scope:"all"})`
Expected: chỉ `avatar-web/server/src/tools/pier-ticket-probe.ts` là file mới (cộng các file đã sửa từ trước như `AGENTS.md`, `CLAUDE.md` nếu còn) — không có file lạ.

```bash
git add avatar-web/server/src/tools/pier-ticket-probe.ts
git commit -m "feat(probe): scaffold pier-ticket probe + phase A Map 27 discovery"
```

---

### Task 2: Phase B (menu NPC Map 27, không mua)

**Files:**
- Modify: `avatar-web/server/src/tools/pier-ticket-probe.ts`

**Interfaces:**
- Consumes: `ProbeArgs`, `NpcEntry`, `MenuProbeResult`, `discoverNpc`, `delayCancellable`, `shuttingDown` từ Task 1; `client.farm.communicate(idUser)` (gửi `-59`), `client.farm.doMenuOption(idUser, menu, sub)` (gửi `-61`).
- Produces: `runPhaseB`, dispatch phase `b`, file `menu-probes.json`.

- [ ] **Step 1: Mở rộng Phase union + parseArgs cho `b`**

Old:
```ts
type Phase = 'a';
```
New:
```ts
type Phase = 'a' | 'b';
```

Old:
```ts
  if (phaseRaw !== 'a') throw new RedactedProbeError('cli', '--phase phải là a');
```
New:
```ts
  if (phaseRaw !== 'a' && phaseRaw !== 'b') throw new RedactedProbeError('cli', '--phase phải là a|b');
```

- [ ] **Step 2: Thêm runPhaseB**

```ts
const BUY_PROMPT_HINTS = ['mua', 'xác nhận', 'đồng ý', 'giá', 'xu', 'lượng'];

async function runPhaseB(
  client: GameClient,
  args: ProbeArgs,
  signal: AbortSignal,
  npc: NpcEntry[],
): Promise<MenuProbeResult[]> {
  const targets = (args.npcId !== undefined ? npc.filter((n) => n.id === args.npcId) : npc).slice(0, 5);
  if (targets.length === 0) {
    throw new RedactedProbeError(
      'npc',
      args.npcId !== undefined
        ? `không thấy NPC id ${args.npcId} ở Map 27`
        : 'không capture được NPC nào ở Map 27 — kiểm tra lại phase a',
    );
  }
  const results: MenuProbeResult[] = [];
  for (const target of targets) {
    if (signal.aborted || shuttingDown) break;
    // menuCount==0 vẫn thử menu 0 một lần: communicate có thể mở menu mà RX48 không báo.
    const menus = target.menuCount > 0 ? Math.min(target.menuCount, 4) : 1;
    client.farm.communicate(target.id);
    await delayCancellable(800, signal);
    for (let menu = 0; menu < menus; menu++) {
      if (signal.aborted || shuttingDown) break;
      const observed: { cmd: number; len: number }[] = [];
      const dialogs: string[] = [];
      const onMsg = (msg: Message): void => {
        observed.push({ cmd: msg.command, len: msg.getData().length });
      };
      const onDlg = (text: string): void => {
        dialogs.push(text);
      };
      client.session.on('message', onMsg);
      client.on('dialog', onDlg);
      try {
        client.farm.doMenuOption(target.id, menu, -1);
        await delayCancellable(5000, signal);
      } finally {
        client.session.removeListener('message', onMsg);
        client.removeListener('dialog', onDlg);
      }
      const lower = dialogs.join('\n').toLowerCase();
      const outcome: MenuProbeResult['outcome'] = BUY_PROMPT_HINTS.some((h) => lower.includes(h))
        ? 'buy-prompt-stop'
        : observed.some((o) => o.cmd === -61) ? 'responded' : 'no-response';
      results.push({ npcId: target.id, npcName: target.name, menuIndex: menu, observedCmds: observed, dialogs, outcome });
      if (outcome === 'buy-prompt-stop') break; // guard: không confirm dialog mua, dừng NPC này
      await delayCancellable(1000, signal);
    }
  }
  return results;
}
```

- [ ] **Step 3: Wiring dispatch phase `b` trong runProbe**

Old:
```ts
    const fragA = await runPhaseA(client, args, abort.signal);
    evidence.rx45 = fragA.rx45;
    evidence.dialog40 = fragA.dialog40;
    evidence.npc = fragA.npc;
    const runDir = ensureRunDir(args.outputDir);
    writeJson(runDir, 'evidence.json', evidence);
    writeJson(runDir, 'npc.json', evidence.npc);
    console.log(JSON.stringify({
      timestamp: evidence.timestamp,
      runDir,
      phase: 'a',
      rx45: evidence.rx45,
      npcCount: evidence.npc.length,
      dialog40Count: evidence.dialog40.length,
    }, null, 2));
```
New:
```ts
    const fragA = await runPhaseA(client, args, abort.signal);
    evidence.rx45 = fragA.rx45;
    evidence.dialog40 = fragA.dialog40;
    evidence.npc = fragA.npc;
    if (args.phase === 'b') {
      // Phase b chạy discovery riêng rồi mới dò menu — không phụ thuộc output phase a.
      const dialogsB: string[] = [];
      const npcB = await discoverNpc(client, args, abort.signal, dialogsB);
      evidence.npc = npcB;
      evidence.dialog40 = [...evidence.dialog40, ...dialogsB];
      evidence.menuProbes = await runPhaseB(client, args, abort.signal, npcB);
    }
    const runDir = ensureRunDir(args.outputDir);
    writeJson(runDir, 'evidence.json', evidence);
    writeJson(runDir, 'npc.json', evidence.npc);
    if (evidence.menuProbes.length > 0) writeJson(runDir, 'menu-probes.json', evidence.menuProbes);
    console.log(JSON.stringify({
      timestamp: evidence.timestamp,
      runDir,
      phase: args.phase,
      rx45: evidence.rx45,
      npcCount: evidence.npc.length,
      dialog40Count: evidence.dialog40.length,
      menuProbeCount: evidence.menuProbes.length,
    }, null, 2));
```

- [ ] **Step 4: Typecheck**

Run: `cd avatar-web/server && npx tsc -p tsconfig.json --noEmit`
Expected: pass, không error mới.

- [ ] **Step 5: Chạy CLI khô**

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase b --output-dir /tmp/pier-probe`
Expected: exit 0? Không — sẽ đi tiếp tới `loadConfig`/login và fail nếu không có DB/mạng; ở môi trường khô expect JSON lỗi `config` hoặc `account`, KHÔNG phải lỗi `--phase`. Điểm check: không còn báo `--phase phải là a`.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase c --output-dir /tmp/pier-probe`
Expected: exit 1, JSON stderr chứa `--phase phải là a|b`.

- [ ] **Step 6: Detect changes + Commit**

Run: `gitnexus_detect_changes({scope:"all"})`
Expected: chỉ file probe thay đổi (cộng file có sẵn từ trước nếu còn) — không có file lạ.

```bash
git add avatar-web/server/src/tools/pier-ticket-probe.ts
git commit -m "feat(probe): phase B menu NPC Map 27 khong mua"
```

---

### Task 3: Phase C (sweep buyItemStack 461–475, guard tiền thật)

**Files:**
- Modify: `avatar-web/server/src/tools/pier-ticket-probe.ts`

**Interfaces:**
- Consumes: `ProbeArgs`, `BuyCell`, `joinPark`, `waitBuyOutcome` (mới), `delayCancellable`, `shuttingDown` từ Task 1; event `park-buy-item` `{ itemId, price, typeMoney, message, xu, luong, luongKhoa }` từ `client.ts:1173`.
- Produces: `sweepBuyIds`, `runPhaseC`, dispatch phase `c`, file `buy-matrix.json`.

- [ ] **Step 1: Mở rộng Phase union + parseArgs cho `c`**

Old:
```ts
type Phase = 'a' | 'b';
```
New:
```ts
type Phase = 'a' | 'b' | 'c';
```

Old:
```ts
  if (phaseRaw !== 'a' && phaseRaw !== 'b') throw new RedactedProbeError('cli', '--phase phải là a|b');
```
New:
```ts
  if (phaseRaw !== 'a' && phaseRaw !== 'b' && phaseRaw !== 'c') {
    throw new RedactedProbeError('cli', '--phase phải là a|b|c');
  }
```

- [ ] **Step 2: Thêm waitBuyOutcome + sweepBuyIds + runPhaseC**

```ts
interface BuyOutcome {
  result: 'success' | 'rejected' | 'timeout';
  message?: string;
  price?: number;
  xuAfter?: number;
  luongAfter?: number;
}

function waitBuyOutcome(client: GameClient, signal: AbortSignal, timeoutMs: number): Promise<BuyOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.removeListener('park-buy-item', onBuy);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (v: BuyOutcome): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(v);
    };
    const onBuy = (evt: {
      itemId: number;
      price?: number;
      typeMoney?: number;
      message?: string;
      xu?: number;
      luong?: number;
      luongKhoa?: number;
    }): void => {
      if (evt.itemId === -1) {
        finish({ result: 'rejected', message: evt.message || 'Server từ chối mua', price: evt.price, xuAfter: evt.xu, luongAfter: evt.luong });
      } else {
        finish({ result: 'success', message: evt.message, price: evt.price, xuAfter: evt.xu, luongAfter: evt.luong });
      }
    };
    const onAbort = (): void => finish({ result: 'timeout', message: 'chờ park-buy-item bị hủy' });
    client.on('park-buy-item', onBuy);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish({ result: 'timeout', message: 'Server không phản hồi gói mua vật phẩm' }), timeoutMs);
    if (signal.aborted) onAbort();
  });
}

async function sweepBuyIds(
  client: GameClient,
  args: ProbeArgs,
  signal: AbortSignal,
  typeMoney: number,
): Promise<{ cells: BuyCell[]; stoppedOnSuccess: boolean }> {
  const cells: BuyCell[] = [];
  let timeoutStreak = 0;
  for (let id = args.idLo; id <= args.idHi; id++) {
    if (signal.aborted || shuttingDown) break;
    const pending = waitBuyOutcome(client, signal, 4000);
    client.sendRaw(-43, [
      { t: 'i16', v: String(id) },
      { t: 'i32', v: '1' },
      { t: 'i8', v: String(typeMoney) },
    ]);
    const out = await pending;
    timeoutStreak = out.result === 'timeout' ? timeoutStreak + 1 : 0;
    cells.push({
      id,
      typeMoney,
      result: out.result,
      message: out.message,
      price: out.price,
      xuAfter: out.xuAfter,
      luongAfter: out.luongAfter,
    });
    // Guard tiền thật: mua thành công ngoài ý muốn → dừng sweep ngay, không mua thêm.
    if (out.result === 'success') return { cells, stoppedOnSuccess: true };
    if (timeoutStreak >= 10) break;
    await delayCancellable(1000, signal);
  }
  return { cells, stoppedOnSuccess: false };
}

async function runPhaseC(client: GameClient, args: ProbeArgs, signal: AbortSignal): Promise<BuyCell[]> {
  await joinPark(client, 13, 0, signal);
  await delayCancellable(800, signal);
  const xuPass = await sweepBuyIds(client, args, signal, 1);
  if (xuPass.stoppedOnSuccess) return xuPass.cells;
  // Pass Lượng chỉ khi user truyền --allow-luong VÀ pass xu không mua được gì.
  if (!args.allowLuong) return xuPass.cells;
  await delayCancellable(1000, signal);
  const luongPass = await sweepBuyIds(client, args, signal, 2);
  return [...xuPass.cells, ...luongPass.cells];
}
```

- [ ] **Step 3: Wiring dispatch phase `c` trong runProbe**

Old:
```ts
    if (args.phase === 'b') {
```
New:
```ts
    if (args.phase === 'c') {
      evidence.buyMatrix = await runPhaseC(client, args, abort.signal);
    }
    if (args.phase === 'b') {
```

Old:
```ts
    if (evidence.menuProbes.length > 0) writeJson(runDir, 'menu-probes.json', evidence.menuProbes);
```
New:
```ts
    if (evidence.menuProbes.length > 0) writeJson(runDir, 'menu-probes.json', evidence.menuProbes);
    if (evidence.buyMatrix.length > 0) writeJson(runDir, 'buy-matrix.json', evidence.buyMatrix);
```

- [ ] **Step 4: Typecheck**

Run: `cd avatar-web/server && npx tsc -p tsconfig.json --noEmit`
Expected: pass, không error mới.

- [ ] **Step 5: Chạy CLI khô**

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase c --output-dir /tmp/pier-probe`
Expected: không còn lỗi `--phase`; đi tiếp tới login/config (fail ở đó nếu môi trường khô — chấp nhận được).

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase c --output-dir /tmp/pier-probe --allow-luong --candidate-ids "461, 463,461"`
Expected: tương tự trên (parse OK, dedupe candidate-ids không lỗi) — chứng minh boolean flag + candidate-ids parse đúng.

- [ ] **Step 6: Detect changes + Commit**

Run: `gitnexus_detect_changes({scope:"all"})`
Expected: chỉ file probe thay đổi (cộng file có sẵn từ trước nếu còn) — không có file lạ.

```bash
git add avatar-web/server/src/tools/pier-ticket-probe.ts
git commit -m "feat(probe): phase C sweep buyItemStack 461-475 co guard"
```

---

### Task 4: Phase D (opcode -74) + mode `all` + hoàn thiện

**Files:**
- Modify: `avatar-web/server/src/tools/pier-ticket-probe.ts`

**Interfaces:**
- Consumes: `ProbeArgs`, `Cmd74Probe`, `joinPark`, `delayCancellable`, `shuttingDown`, toàn bộ dispatch Task 1–3.
- Produces: `runPhaseD`, dispatch `d` + `all`, ghi file có điều kiện đầy đủ.

- [ ] **Step 1: Mở rộng Phase union + parseArgs cho `d`/`all`**

Old:
```ts
type Phase = 'a' | 'b' | 'c';
```
New:
```ts
type Phase = 'a' | 'b' | 'c' | 'd' | 'all';
```

Old:
```ts
  if (phaseRaw !== 'a' && phaseRaw !== 'b' && phaseRaw !== 'c') {
    throw new RedactedProbeError('cli', '--phase phải là a|b|c');
  }
```
New:
```ts
  if (phaseRaw !== 'a' && phaseRaw !== 'b' && phaseRaw !== 'c' && phaseRaw !== 'd' && phaseRaw !== 'all') {
    throw new RedactedProbeError('cli', '--phase phải là a|b|c|d|all');
  }
```

- [ ] **Step 2: Thêm runPhaseD**

```ts
async function runPhaseD(client: GameClient, args: ProbeArgs, signal: AbortSignal): Promise<Cmd74Probe[]> {
  // Schema -74 chưa biết nên chỉ ghi cmd/len thô, không decode sâu.
  await joinPark(client, 13, 0, signal);
  await delayCancellable(800, signal);
  const ids = (args.candidateIds.length > 0 ? args.candidateIds : [args.idLo]).slice(0, 5);
  const out: Cmd74Probe[] = [];
  for (const id of ids) {
    if (signal.aborted || shuttingDown) break;
    const seen: { cmd: number; len: number }[] = [];
    const onMsg = (msg: Message): void => {
      seen.push({ cmd: msg.command, len: msg.getData().length });
    };
    client.session.on('message', onMsg);
    try {
      client.sendRaw(-74, [
        { t: 'i16', v: String(id) },
        { t: 'i32', v: '1' },
        { t: 'i8', v: '1' },
      ]);
      await delayCancellable(3000, signal);
    } finally {
      client.session.removeListener('message', onMsg);
    }
    out.push({ id, rxCmds: seen });
    await delayCancellable(1000, signal);
  }
  return out;
}
```

- [ ] **Step 3: Wiring dispatch `d` + `all`, gọn lại block phase**

Old:
```ts
    if (args.phase === 'c') {
      evidence.buyMatrix = await runPhaseC(client, args, abort.signal);
    }
    if (args.phase === 'b') {
      // Phase b chạy discovery riêng rồi mới dò menu — không phụ thuộc output phase a.
      const dialogsB: string[] = [];
      const npcB = await discoverNpc(client, args, abort.signal, dialogsB);
      evidence.npc = npcB;
      evidence.dialog40 = [...evidence.dialog40, ...dialogsB];
      evidence.menuProbes = await runPhaseB(client, args, abort.signal, npcB);
    }
```
New:
```ts
    if (args.phase === 'c' || args.phase === 'all') {
      evidence.buyMatrix = await runPhaseC(client, args, abort.signal);
    }
    if (args.phase === 'b' || args.phase === 'all') {
      // Phase b/all chạy discovery riêng rồi mới dò menu — không phụ thuộc output phase a.
      const dialogsB: string[] = [];
      const npcB = await discoverNpc(client, args, abort.signal, dialogsB);
      const merged = new Map<number, NpcEntry>();
      for (const n of [...evidence.npc, ...npcB]) merged.set(n.id, n);
      evidence.npc = [...merged.values()].sort((a, b) => a.id - b.id);
      evidence.dialog40 = [...evidence.dialog40, ...dialogsB];
      evidence.menuProbes = await runPhaseB(client, args, abort.signal, npcB);
    }
    if (args.phase === 'd' || args.phase === 'all') {
      evidence.cmd74 = await runPhaseD(client, args, abort.signal);
    }
```

- [ ] **Step 4: Typecheck**

Run: `cd avatar-web/server && npx tsc -p tsconfig.json --noEmit`
Expected: pass, không error mới.

- [ ] **Step 5: Chạy ma trận CLI khô đầy đủ**

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase d --output-dir /tmp/pier-probe --candidate-ids "461,463"`
Expected: không lỗi `--phase`; đi tiếp tới login/config.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase all --output-dir /tmp/pier-probe`
Expected: tương tự — parse OK.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 1 --phase x --output-dir /tmp/pier-probe`
Expected: exit 1, JSON stderr chứa `--phase phải là a|b|c|d|all`.

Run: `cd avatar-web/server && node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id 0 --phase a --output-dir /tmp/pier-probe`
Expected: exit 1, JSON stderr chứa `--account-id phải là số nguyên dương`.

- [ ] **Step 6: Detect changes + Commit**

Run: `gitnexus_detect_changes({scope:"all"})`
Expected: chỉ file probe thay đổi (cộng file có sẵn từ trước nếu còn) — không có file lạ.

```bash
git add avatar-web/server/src/tools/pier-ticket-probe.ts
git commit -m "feat(probe): phase D opcode -74 va mode all hoan thien"
```

---

## Post-plan (thủ công, không phải commit gate)

Sau khi 4 task xong, user tự chạy live (đã dừng web server):

1. `node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id <id> --phase a --output-dir /tmp/pier-probe` — expect `rx45.error` chứa "vé câu cá bến tàu", `dialog40` có "Khu câu cá đặc biệt", `npc[]` non-empty.
2. Review `evidence.json` + `npc.json` rồi mới quyết định chạy `--phase b/c`.
3. Phase C pass xu trước; chỉ thêm `--allow-luong` sau khi user duyệt kết quả pass xu.
4. Kết quả là đầu vào cho spec tiếp theo (bổ sung `FISHING_TICKETS` / `executeParkPurchase`).
