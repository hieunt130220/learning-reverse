# Fix Game Reconnect Storm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ vòng lặp đăng nhập lại do stale timer/client, tôn trọng thời gian chờ của game server và bổ sung log đủ để xác định nguyên nhân socket đóng.

**Architecture:** `Session` phát close metadata có cấu trúc; `GameClient` chuyển metadata thành log an toàn và phân loại thông báo throttle `-40`; `AvatarSession` dùng connection epoch để chỉ client hiện hành được điều khiển retry lifecycle. Backoff chỉ reset khi nhận `online`, mỗi epoch chỉ khởi động auto-farm một lần.

**Tech Stack:** Node 22+, TypeScript ESM `NodeNext`, `node:net`, `EventEmitter`, `node:test`, `tsx`.

**Spec:** [docs/superpowers/specs/2026-08-12-fix-game-reconnect-storm-design.md](../specs/2026-08-12-fix-game-reconnect-storm-design.md)

## Global Constraints

- Không thay đổi REST API, WebSocket payload, schema SQLite hoặc frontend.
- Không log username, password, cookie, raw login body hoặc payload nhạy cảm.
- Giữ masking hiện tại cho `LOGIN_ACC (-33)`, `LOGIN_IMEI (-32)` và `REQUEST_REGISTER (-30)`.
- Auto-farm bật lại ngay sau `online`, đúng một lần cho mỗi connection epoch.
- Retry cơ sở là 10 giây, exponential backoff tối đa 5 phút, jitter `+-20%`.
- `LOGIN_FAIL (-35)` vẫn là permanent failure và không retry.
- Không cố ý tạo reconnect storm với game server thật để kiểm thử.
- Không commit nếu người dùng chưa yêu cầu. Kết thúc mỗi task bằng focused test, typecheck và diff checkpoint; không stage `AGENTS.md`, `CLAUDE.md` hay file ngoài phạm vi.
- Trước khi sửa `Session`, `GameClient` hoặc `AvatarSession`, chạy GitNexus `impact` upstream theo `AGENTS.md`. Nếu MCP vẫn báo storage version 40/42, ghi lại lỗi công cụ, dùng `rg` để xác nhận consumer và không diễn giải kết quả lỗi thành risk LOW.

## File Map

| File | Trách nhiệm sau thay đổi |
|---|---|
| `avatar-web/server/src/proto/session.ts` | Theo dõi vòng đời socket và phát `SessionCloseInfo` đúng một lần khi close |
| `avatar-web/server/src/proto/session.test.ts` | Test remote FIN, local close, socket error và metadata byte/timing |
| `avatar-web/server/src/game/client.ts` | Log close metadata; parse và phát `temporary-rejection` từ gói `-40` |
| `avatar-web/server/src/game/client.test.ts` | Test parser throttle, event retry-after, close log và masking login |
| `avatar-web/server/src/session/avatarSession.ts` | Một active epoch, một retry timer, reset backoff khi online, auto start một lần |
| `avatar-web/server/src/session/avatarSession.test.ts` | Test hồi quy duplicate timer, stale callback, retry-after và online semantics |

---

## Task 1: TCP Close Metadata

**Files:**
- Modify: `avatar-web/server/src/proto/session.ts`
- Create: `avatar-web/server/src/proto/session.test.ts`

**Interfaces:**
- Consumes: Node `net.Socket` events `connect`, `data`, `end`, `error`, `close`.
- Produces:

```ts
export type SessionCloseKind = 'remote-end' | 'socket-error' | 'local-close' | 'socket-close';

export interface SessionSocketError {
  message: string;
  code?: string;
  errno?: string | number;
  syscall?: string;
}

export interface SessionCloseInfo {
  kind: SessionCloseKind;
  hadError: boolean;
  host: string;
  port: number;
  startedAt: number;
  connectedAt?: number;
  closedAt: number;
  lastDataAt?: number;
  lifetimeMs: number;
  bytesRead: number;
  bytesWritten: number;
  error?: SessionSocketError;
}
```

- `SessionEvents.closed` đổi từ `(reason: string)` thành `(info: SessionCloseInfo)`.

- [ ] **Step 1: Chạy impact analysis trước khi sửa**

Run GitNexus `impact({ target: "Session", direction: "upstream", includeTests: true })`.

Expected: consumer trực tiếp gồm `GameClient`, `FarmService` và test liên quan. Nếu gặp lỗi version 40/42, lưu output rồi chạy:

```bash
rg -n "new Session|SessionEvents|\.on\('closed'|\.close\(\)" avatar-web/server/src
```

- [ ] **Step 2: Viết test remote FIN và local close**

Tạo `avatar-web/server/src/proto/session.test.ts` với helper server TCP loopback và hai test cốt lõi:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { Session, type SessionCloseInfo } from './session.js';

async function listen(handler: (socket: net.Socket) => void): Promise<net.Server> {
  const server = net.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

function portOf(server: net.Server): number {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

function nextClose(session: Session): Promise<SessionCloseInfo> {
  return new Promise((resolve) => session.once('closed', resolve));
}

test('peer gửi FIN được phân loại remote-end', async () => {
  const server = await listen((socket) => socket.end(Buffer.from([1, 0, 0])));
  const session = new Session();
  session.on('error', () => {});
  const closed = nextClose(session);
  await session.connect('127.0.0.1', portOf(server));
  const info = await closed;

  assert.equal(info.kind, 'remote-end');
  assert.equal(info.hadError, false);
  assert.ok(info.bytesRead >= 3);
  assert.ok(info.connectedAt);
  assert.ok(info.closedAt >= info.startedAt);
  assert.equal(info.lifetimeMs, info.closedAt - info.startedAt);
  await closeServer(server);
});

test('Session.close được phân loại local-close và chỉ phát closed một lần', async () => {
  const server = await listen(() => {});
  const session = new Session();
  const events: SessionCloseInfo[] = [];
  session.on('closed', (info) => events.push(info));
  await session.connect('127.0.0.1', portOf(server));
  session.close();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'local-close');
  assert.equal(events[0].hadError, false);
  await closeServer(server);
});
```

- [ ] **Step 3: Viết test socket error**

Thêm test lấy một port loopback rồi đóng listener trước khi connect:

```ts
test('connect tới port đã đóng giữ socket-error metadata', async () => {
  const holder = await listen(() => {});
  const port = portOf(holder);
  await closeServer(holder);

  const session = new Session();
  const errors: Error[] = [];
  session.on('error', (err) => errors.push(err));
  const closed = nextClose(session);
  await assert.rejects(session.connect('127.0.0.1', port));
  const info = await closed;

  assert.equal(info.kind, 'socket-error');
  assert.equal(info.hadError, true);
  assert.ok(errors.length >= 1);
  assert.equal(info.error?.code, 'ECONNREFUSED');
  assert.equal(info.error?.syscall, 'connect');
});
```

- [ ] **Step 4: Chạy test để xác nhận đỏ**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/proto/session.test.ts
```

Expected: FAIL vì `closed` vẫn trả `string`, thiếu `SessionCloseInfo` và phân loại close.

- [ ] **Step 5: Cài đặt tracking trong `Session`**

Thêm các field riêng và reset chúng ở đầu `connect(host, port)`:

```ts
private targetHost = '';
private targetPort = 0;
private startedAt = 0;
private connectedAt?: number;
private lastDataAt?: number;
private remoteEnded = false;
private localCloseRequested = false;
private lastSocketError?: SessionSocketError;
```

Trong `connect()`:

```ts
this.targetHost = host;
this.targetPort = port;
this.startedAt = Date.now();

sock.once('connect', () => {
  this.connected = true;
  this.connectedAt = Date.now();
  this.emit('connected');
  resolve();
});
sock.on('data', (chunk) => {
  this.lastDataAt = Date.now();
  this.onData(chunk);
});
sock.on('end', () => {
  this.remoteEnded = true;
});
sock.on('error', (err: NodeJS.ErrnoException) => {
  this.lastSocketError = {
    message: err.message,
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
  };
  this.emit('error', err);
  reject(err);
});
sock.on('close', (hadError) => {
  const closedAt = Date.now();
  const kind: SessionCloseKind = this.localCloseRequested
    ? 'local-close'
    : this.lastSocketError
      ? 'socket-error'
      : this.remoteEnded
        ? 'remote-end'
        : 'socket-close';
  this.connected = false;
  this.emit('closed', {
    kind,
    hadError,
    host: this.targetHost,
    port: this.targetPort,
    startedAt: this.startedAt,
    connectedAt: this.connectedAt,
    closedAt,
    lastDataAt: this.lastDataAt,
    lifetimeMs: closedAt - this.startedAt,
    bytesRead: sock.bytesRead,
    bytesWritten: sock.bytesWritten,
    error: this.lastSocketError,
  });
});
```

Đổi `close()` để đánh dấu đóng chủ động trước `destroy()`:

```ts
close(): void {
  this.localCloseRequested = true;
  this.socket?.destroy();
  this.connected = false;
}
```

- [ ] **Step 6: Chạy focused test và typecheck**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/proto/session.test.ts
npm run typecheck
```

Expected: `session.test.ts` PASS và typecheck PASS. Callback hiện tại của `GameClient`
chỉ nội suy tham số close nên vẫn compile với `SessionCloseInfo`; Task 2 chịu trách
nhiệm đổi nội dung log. Nếu typecheck không pass, dừng và xác định lỗi thực tế,
không mở rộng Task 1 sang logic `GameClient`.

- [ ] **Step 7: Diff checkpoint**

Run:

```bash
git diff --check -- avatar-web/server/src/proto/session.ts avatar-web/server/src/proto/session.test.ts
git diff -- avatar-web/server/src/proto/session.ts avatar-web/server/src/proto/session.test.ts
```

Expected: chỉ có close metadata và focused tests; không stage hoặc commit.

---

## Task 2: GameClient Close Log And Temporary Rejection

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Create: `avatar-web/server/src/game/client.test.ts`

**Interfaces:**
- Consumes: `SessionCloseInfo`; gói `Message` command `-40`.
- Produces:

```ts
export interface TemporaryLoginRejection {
  reason: string;
  retryAfterMs: number;
}

export function parseTemporaryLoginRejection(text: string): TemporaryLoginRejection | null;
```

- Runtime event: `GameClient.emit('temporary-rejection', rejection)`.

- [ ] **Step 1: Chạy impact analysis trước khi sửa**

Run GitNexus `impact({ target: "GameClient", direction: "upstream", includeTests: true })`.

Expected: `AvatarSession`, `AutoFarm`, `MacroRunner` và tools là consumer. Nếu MCP lỗi version, chạy:

```bash
rg -n "new GameClient|GameClient|temporary-rejection|session\.on\('closed'" avatar-web/server/src
```

- [ ] **Step 2: Viết test parser và event `-40`**

Tạo `avatar-web/server/src/game/client.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { GameClient, parseTemporaryLoginRejection } from './client.js';
import { Message } from '../proto/message.js';
import { MyWriter } from '../proto/writer.js';

function incomingUtf(command: number, text: string): Message {
  return Message.fromData(command, new MyWriter().writeUTF(text).getData());
}

test('parse số giây từ thông báo đăng nhập lại', () => {
  assert.deepEqual(
    parseTemporaryLoginRejection('Hệ thống quá tải. Vui lòng đăng nhập lại sau 10s'),
    {
      reason: 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 10s',
      retryAfterMs: 10_000,
    },
  );
});

test('đăng nhập quá nhanh không có số dùng tối thiểu 10 giây', () => {
  assert.equal(
    parseTemporaryLoginRejection('Bạn đang đăng nhập quá nhanh. Vui lòng chờ')?.retryAfterMs,
    10_000,
  );
  assert.equal(parseTemporaryLoginRejection('Bảo trì lúc 22h'), null);
});

test('gói -40 phát temporary-rejection có cấu trúc', () => {
  const client = new GameClient();
  const events: unknown[] = [];
  client.on('temporary-rejection', (value) => events.push(value));
  client.session.emit(
    'message',
    incomingUtf(-40, 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 30s'),
  );
  assert.deepEqual(events, [{
    reason: 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 30s',
    retryAfterMs: 30_000,
  }]);
});
```

- [ ] **Step 3: Viết test close log và masking**

Thêm vào cùng file:

```ts
test('close metadata được log mà không có credential', () => {
  const client = new GameClient();
  client.status = 'online';
  const logs: string[] = [];
  client.on('log', (line) => logs.push(line));
  client.session.emit('closed', {
    kind: 'remote-end',
    hadError: false,
    host: '27.0.14.120',
    port: 19129,
    startedAt: 1_000,
    connectedAt: 1_100,
    closedAt: 2_200,
    lastDataAt: 1_900,
    lifetimeMs: 1_200,
    bytesRead: 256,
    bytesWritten: 128,
  });
  assert.match(logs.at(-1) ?? '', /remote-end/);
  assert.match(logs.at(-1) ?? '', /27\.0\.14\.120:19129/);
  assert.match(logs.at(-1) ?? '', /1200ms/);
  assert.match(logs.at(-1) ?? '', /rx=256B/);
  assert.match(logs.at(-1) ?? '', /trạng thái=online/);
  assert.doesNotMatch(logs.join('\n'), /password|gamePass|LOGIN_ACC/);
});

test('traffic của LOGIN_ACC tiếp tục ẩn body', () => {
  const client = new GameClient();
  const traffic: Array<{ hex: string }> = [];
  client.on('traffic', (entry) => traffic.push(entry));
  client.session.emit('traffic', 'tx', -33, Buffer.from('mat-khau', 'utf8'));
  assert.equal(traffic[0].hex, '<đã ẩn>');
});
```

- [ ] **Step 4: Chạy test để xác nhận đỏ**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/game/client.test.ts
```

Expected: FAIL vì thiếu parser/event và close callback chưa log metadata.

- [ ] **Step 5: Cài parser và close formatter**

Thêm parser thuần gần `SENSITIVE_CMDS`:

```ts
const MIN_LOGIN_RETRY_MS = 10_000;

export function parseTemporaryLoginRejection(text: string): TemporaryLoginRejection | null {
  const isThrottle = /đăng nhập quá nhanh|đăng nhập lại sau\s+\d+\s*s/i.test(text);
  if (!isThrottle) return null;
  const seconds = text.match(/sau\s+(\d+)\s*s/i)?.[1];
  return {
    reason: text,
    retryAfterMs: seconds ? Math.max(Number(seconds) * 1_000, MIN_LOGIN_RETRY_MS) : MIN_LOGIN_RETRY_MS,
  };
}
```

Đổi listener close:

```ts
this.session.on('closed', (info) => {
  this.stopKeepAlive();
  const statusAtClose = this.status;
  const idleMs = info.lastDataAt === undefined ? undefined : info.closedAt - info.lastDataAt;
  const error = info.error
    ? `, lỗi=${[info.error.code, info.error.syscall].filter(Boolean).join('/') || info.error.message}`
    : '';
  const idle = idleMs === undefined ? '' : `, im lặng ${idleMs}ms`;
  this.setStatus('idle');
  this.emit(
    'log',
    `mất kết nối: ${info.kind} ${info.host}:${info.port}, sống ${info.lifetimeMs}ms, ` +
      `rx=${info.bytesRead}B tx=${info.bytesWritten}B, trạng thái=${statusAtClose}${idle}${error}`,
  );
});
```

Đổi `case -40`:

```ts
case -40: {
  const reason = safeUtf(msg);
  this.emit('log', `server: ${reason}`);
  const rejection = parseTemporaryLoginRejection(reason);
  if (rejection) this.emit('temporary-rejection', rejection);
  break;
}
```

- [ ] **Step 6: Chạy focused tests và typecheck**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/proto/session.test.ts src/game/client.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Diff checkpoint**

Run:

```bash
git diff --check -- avatar-web/server/src/game/client.ts avatar-web/server/src/game/client.test.ts
git diff -- avatar-web/server/src/game/client.ts avatar-web/server/src/game/client.test.ts
```

Expected: parser chỉ nhận đúng throttle login; masking command nhạy cảm không đổi; không stage hoặc commit.

---

## Task 3: Single-Epoch Reconnect Lifecycle

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/avatarSession.test.ts`

**Interfaces:**
- Consumes: `TemporaryLoginRejection` event từ `GameClient`.
- Produces: không đổi public API của `AvatarSession` hoặc snapshot.
- Internal additions:

```ts
private connectionEpoch = 0;
private onlineEpoch?: number;
private retryAfter?: { epoch: number; notBefore: number };
private readonly now: () => number;
```

- `RETRY_BASE_MS` đổi thành `10_000`.
- `AvatarSessionOptions` thêm optional `now?: () => number` để test deadline không phụ thuộc wall clock.

- [ ] **Step 1: Chạy impact analysis trước khi sửa**

Run GitNexus `impact({ target: "AvatarSession", direction: "upstream", includeTests: true })`.

Expected: `SessionManager`, session routes và tests là consumer; public methods không đổi. Nếu MCP lỗi version, chạy:

```bash
rg -n "AvatarSession|sessions\.(connect|disconnect|snapshot|require|peek)" avatar-web/server/src
```

- [ ] **Step 2: Nâng harness để điều khiển online và timer**

Trong `avatarSession.test.ts`, đổi fake client và timer model:

```ts
class FakeClient extends EventEmitter {
  autoOnline = true;

  async login(opts: unknown): Promise<void> {
    this.loginArgs.push(opts);
    if (this.loginError) throw this.loginError;
    if (this.autoOnline) this.goOnline();
  }

  goOnline(): void {
    this.status = 'online';
    this.emit('status', 'online');
  }

  rejectTemporarily(retryAfterMs: number): void {
    this.emit('temporary-rejection', { reason: 'throttle', retryAfterMs });
  }

  logout(): void {
    this.logoutCount += 1;
    this.status = 'idle';
    this.emit('status', 'idle');
  }
}

interface FakeTimer {
  id: number;
  fn: () => void;
  delay: number;
  active: boolean;
}
```

Không thay các field dữ liệu và helper `enterFarm`, `sendRaw`, `drop` hiện có của
`FakeClient`. Thay chính xác `login()` và `logout()` bằng hai implementation trên,
thêm `autoOnline`, `goOnline()` và `rejectTemporarily()`.

Cho `harness` nhận `{ loginError?, autoOnline? }`, tiêm `now: () => 1_000_000`, đánh dấu timer inactive trong `clearTimeoutFn`, và để `fireTimer()` chỉ lấy timer active sớm nhất. Thêm `pendingTimers()` trả các timer active. Dùng chính timer object làm `NodeJS.Timeout` giả để `clearTimeoutFn` tắt đúng timer. Thay toàn bộ `Harness` và `harness()` hiện tại bằng:

```ts
interface Harness {
  session: AvatarSession;
  clients: FakeClient[];
  autos: FakeAuto[];
  timers: FakeTimer[];
  events: Array<{ type: string; payload: unknown }>;
  permanent: string[];
  pendingTimers(): FakeTimer[];
  fireTimer(): number;
}

function harness(
  creds: Partial<AvatarCredentials> = {},
  clientCfg: { loginError?: Error; autoOnline?: boolean } = {},
): Harness {
  const clients: FakeClient[] = [];
  const autos: FakeAuto[] = [];
  const timers: FakeTimer[] = [];
  const events: Array<{ type: string; payload: unknown }> = [];
  const permanent: string[] = [];
  let nextTimerId = 1;

  const session = new AvatarSession({
    accountId: 7,
    loadCredentials: async () => ({
      host: 'h',
      port: 1,
      user: 'u',
      pass: 'p',
      autoEnabled: false,
      ...creds,
    }),
    createClient: () => {
      const client = new FakeClient();
      client.loginError = clientCfg.loginError ?? null;
      client.autoOnline = clientCfg.autoOnline ?? true;
      clients.push(client);
      return client as unknown as GameClient;
    },
    createAutoFarm: () => {
      const auto = new FakeAuto();
      autos.push(auto);
      return auto as unknown as AutoFarm;
    },
    createMacroRunner: () => new FakeMacro() as unknown as MacroRunner,
    onEvent: (type, payload) => events.push({ type, payload }),
    onPermanentFailure: (reason) => permanent.push(reason),
    setTimeoutFn: ((fn: () => void, delay: number) => {
      const timer: FakeTimer = { id: nextTimerId++, fn, delay, active: true };
      timers.push(timer);
      return timer as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
    clearTimeoutFn: ((timer: NodeJS.Timeout) => {
      (timer as unknown as FakeTimer).active = false;
    }) as unknown as typeof clearTimeout,
    now: () => 1_000_000,
    random: () => 0.5,
  });

  return {
    session,
    clients,
    autos,
    timers,
    events,
    permanent,
    pendingTimers: () => timers.filter((timer) => timer.active),
    fireTimer() {
      const timer = timers.find((candidate) => candidate.active);
      assert.ok(timer, 'không có timer active');
      timer.active = false;
      timer.fn();
      return timer.delay;
    },
  };
}
```

Việc `FakeClient.logout()` phát `idle` là bắt buộc: đó chính là đường tái hiện bug hiện tại. Sau bản sửa, listener đã được gỡ trước `logout()`, nên sự kiện này không được tạo timer mới.

Đổi hai call site test lỗi login hiện có từ:

```ts
harness({}, new Error('không nhận được gói khóa (-27) sau 10s'));
```

thành:

```ts
harness({}, { loginError: new Error('không nhận được gói khóa (-27) sau 10s') });
```

Đổi `FakeAuto` để đếm số lần start:

```ts
class FakeAuto extends EventEmitter {
  running = false;
  startCount = 0;
  lastCfg: unknown;

  start(cfg: unknown): void {
    this.startCount += 1;
    this.running = true;
    this.lastCfg = cfg;
  }

  stop(): void {
    this.running = false;
  }

  state() {
    return { running: this.running, cycle: 0, lastActions: [] };
  }
}
```

- [ ] **Step 3: Viết test đỏ cho duplicate/stale timer**

```ts
test('timer retry teardown không sinh timer thứ hai', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].drop();
  assert.equal(h.pendingTimers().length, 1);
  h.fireTimer();
  await flush();
  assert.equal(h.clients.length, 2);
  assert.equal(h.pendingTimers().length, 0);
});

test('callback retry cũ không đóng client mới', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].drop();
  const stale = h.pendingTimers()[0].fn;
  h.fireTimer();
  await flush();
  assert.equal(h.clients.length, 2);
  stale();
  await flush();
  assert.equal(h.clients.length, 2);
  assert.equal(h.clients[1].logoutCount, 0);
});
```

- [ ] **Step 4: Viết test đỏ cho online/backoff semantics**

```ts
test('login trả về chưa online không reset backoff', async () => {
  const h = harness({}, { autoOnline: false });
  await h.session.start();
  h.clients[0].drop();
  assert.equal(h.fireTimer(), RETRY_BASE_MS);
  await flush();
  assert.equal(h.clients.length, 2);
  assert.equal(h.session.snapshot().retries, 1);
});

test('online reset backoff và auto chỉ start một lần', async () => {
  const h = harness({ autoEnabled: true }, { autoOnline: false });
  await h.session.start();
  h.clients[0].drop();
  h.fireTimer();
  await flush();
  h.clients[1].goOnline();
  h.clients[1].goOnline();
  assert.equal(h.session.snapshot().retries, 0);
  assert.equal(h.autos[1].startCount, 1);
});
```

`FakeAuto.start()` phải tăng `startCount` để assertion phân biệt một lần với hai lần.

- [ ] **Step 5: Viết test đỏ cho retry-after**

```ts
test('server retry-after lớn hơn exponential backoff quyết định delay', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].rejectTemporarily(30_000);
  h.clients[0].drop();
  assert.equal(h.pendingTimers()[0].delay, 30_000);
});

test('retry-after không được giảm exponential backoff hiện tại', async () => {
  const h = harness({}, { autoOnline: false });
  await h.session.start();
  h.clients[0].drop();
  h.fireTimer();
  await flush();
  h.clients[1].rejectTemporarily(10_000);
  h.clients[1].drop();
  assert.equal(h.pendingTimers()[0].delay, RETRY_BASE_MS * 2);
});
```

- [ ] **Step 6: Chạy focused test để xác nhận đỏ**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/session/avatarSession.test.ts
```

Expected: FAIL ở duplicate timer, reset backoff sớm, auto start hai lần hoặc thiếu retry-after handling.

- [ ] **Step 7: Cài connection epoch và online handler**

Thêm helper kiểm client hiện hành:

```ts
private isCurrent(client: GameClient, epoch: number): boolean {
  return this.client === client && this.connectionEpoch === epoch;
}
```

Trong `connect()`:

```ts
const epoch = ++this.connectionEpoch;
const client = this.opts.createClient ? this.opts.createClient() : new GameClient();
this.client = client;
this.retryAfter = undefined;
this.auto = this.opts.createAutoFarm ? this.opts.createAutoFarm(client) : new AutoFarm(client);
this.macros = this.opts.createMacroRunner
  ? this.opts.createMacroRunner(client)
  : new MacroRunner(client);
this.wire(client, epoch);

try {
  await client.login({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    pass: creds.pass,
    device: creds.device,
  });
} catch (err) {
  if (!this.isCurrent(client, epoch)) return;
  this.pushLog(`kết nối lỗi: ${(err as Error).message}`);
  this.scheduleRetry(epoch);
}
```

Không reset `retries` và không gọi `tryStartAuto()` ở cuối `connect()`.

Đổi `wire(client, epoch)` để mọi callback mở đầu bằng `if (!this.isCurrent(client, epoch)) return;`. Listener status phải truyền epoch vào đường disconnect:

```ts
client.on('status', (status: ClientStatus) => {
  if (!this.isCurrent(client, epoch)) return;
  this.emit('status', status);
  if (status === 'online') this.onOnline(client, epoch);
  if (status === 'idle' || status === 'error') this.onDisconnected(epoch);
});
```

Status online đi qua đúng một handler:

```ts
private onOnline(client: GameClient, epoch: number): void {
  if (!this.isCurrent(client, epoch) || this.onlineEpoch === epoch) return;
  this.onlineEpoch = epoch;
  this.cancelRetry();
  this.retries = 0;
  this.retryAfter = undefined;
  if (this.wantAuto) this.tryStartAuto();
}
```

Listener temporary rejection:

```ts
client.on('temporary-rejection', (rejection: TemporaryLoginRejection) => {
  if (!this.isCurrent(client, epoch)) return;
  this.retryAfter = { epoch, notBefore: this.now() + rejection.retryAfterMs };
  this.pushLog(`server yêu cầu chờ ${Math.ceil(rejection.retryAfterMs / 1000)}s trước khi đăng nhập lại`);
});
```

Đổi `onDisconnected()` để schedule đúng epoch phát sự kiện:

```ts
private onDisconnected(epoch: number): void {
  this.auto?.stop();
  this.macros?.stop();
  if (!this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;
  this.scheduleRetry(epoch);
}
```

- [ ] **Step 8: Cài single timer và teardown không phát retry**

Đổi `scheduleRetry(epoch)`:

```ts
private scheduleRetry(epoch: number): void {
  if (this.retryTimer || epoch !== this.connectionEpoch) return;
  const base = Math.min(RETRY_BASE_MS * 2 ** this.retries, RETRY_MAX_MS);
  const jittered = Math.round(base * (0.8 + 0.4 * this.random()));
  const serverDelay = this.retryAfter?.epoch === epoch
    ? Math.max(0, this.retryAfter.notBefore - this.now())
    : 0;
  const delay = Math.max(jittered, serverDelay);
  this.retries += 1;
  this.nextRetryAt = this.now() + delay;
  this.pushLog(`thử kết nối lại sau ${Math.round(delay / 1000)}s (lần ${this.retries})`);

  this.retryTimer = this.setTimeoutFn(() => {
    this.retryTimer = undefined;
    this.nextRetryAt = undefined;
    if (!this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;
    this.teardown();
    void this.connect().catch((err: Error) => {
      this.pushLog(`thử lại lỗi: ${err.message}`);
      this.scheduleRetry(this.connectionEpoch);
    });
  }, delay);
}
```

Đổi `teardown()` theo đúng thứ tự:

```ts
private teardown(): void {
  this.connectionEpoch += 1;
  this.auto?.stop();
  this.macros?.stop();
  const client = this.client;
  this.client = undefined;
  this.auto = undefined;
  this.macros = undefined;
  if (!client) return;
  client.removeAllListeners();
  try {
    client.logout();
  } catch {
    /* bỏ qua */
  }
}
```

`cancelRetry()` phải xóa `retryTimer` và `nextRetryAt`. `stop()` giữ `wanted = false`, gọi `cancelRetry()` rồi `teardown()`.

- [ ] **Step 9: Chạy focused test và cập nhật assertion backoff**

Run:

```bash
cd avatar-web/server
node --import tsx --test src/session/avatarSession.test.ts
```

Expected: PASS. Test dãy backoff cũ phải đổi expected từ `5, 10, 20...` thành `10, 20, 40, 80, 160, 300, 300...` giây theo `RETRY_BASE_MS = 10_000` và `RETRY_MAX_MS = 300_000`.

- [ ] **Step 10: Chạy focused cross-layer tests và typecheck**

Run:

```bash
cd avatar-web/server
node --import tsx --test \
  src/proto/session.test.ts \
  src/game/client.test.ts \
  src/session/avatarSession.test.ts \
  src/session/manager.test.ts \
  src/session/routes.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11: Diff checkpoint**

Run:

```bash
git diff --check -- avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/avatarSession.test.ts
git diff -- avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/avatarSession.test.ts
```

Expected: public snapshot và routes không đổi; không stage hoặc commit.

---

## Task 4: Full Verification And Runtime-Safe Handoff

**Files:**
- Verify only: all files in Tasks 1-3
- Update only if implementation behavior differs: `avatar-web/README.md`

**Interfaces:**
- Không tạo interface mới.
- Deliverable: test/typecheck/diff evidence và hướng quan sát runtime không gây login storm.

- [ ] **Step 1: Chạy toàn bộ backend tests**

Run:

```bash
cd avatar-web/server
npm test
```

Expected: exit `0`, không có failed test.

- [ ] **Step 2: Chạy typecheck và build**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
```

Expected: cả hai exit `0`. Build chứng minh production output compile được; không diễn giải build là runtime game test.

- [ ] **Step 3: Kiểm tra phạm vi thay đổi**

Run:

```bash
cd ../..
git diff --check
git status --short
git diff --stat
git diff -- \
  avatar-web/server/src/proto/session.ts \
  avatar-web/server/src/proto/session.test.ts \
  avatar-web/server/src/game/client.ts \
  avatar-web/server/src/game/client.test.ts \
  avatar-web/server/src/session/avatarSession.ts \
  avatar-web/server/src/session/avatarSession.test.ts
```

Expected: chỉ sáu file implementation/test dự kiến và tài liệu đã duyệt; `AGENTS.md`, `CLAUDE.md` vẫn ngoài phạm vi.

- [ ] **Step 4: Chạy GitNexus change detection nếu tương thích**

Run `detect_changes({ scope: "all", repo: "/Users/devios/learning-reverse" })`.

Expected: luồng bị ảnh hưởng giới hạn ở TCP session, game client và account reconnect. Nếu vẫn lỗi storage version 40/42, báo đúng lỗi công cụ và dùng output `git diff --stat` cùng focused tests làm bằng chứng thay thế; không gọi change risk là LOW.

- [ ] **Step 5: Xác minh server local sau hot reload hoặc restart**

Không tự kết nối tài khoản game. Kiểm tra HTTP process và API auth boundary:

```bash
curl -sS -o /dev/null -w 'frontend=%{http_code}\n' http://127.0.0.1:5174/
curl -sS -o /dev/null -w 'backend=%{http_code}\n' http://127.0.0.1:8787/api/auth/me
lsof -nP -iTCP:5174 -sTCP:LISTEN
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

Expected: frontend `200`, backend unauthenticated `401`, cả hai listener sống.

- [ ] **Step 6: Chuẩn bị tiêu chí quan sát game thật**

Chỉ sau khi người dùng chủ động bấm kết nối:

- xác nhận đúng một dòng `thử kết nối lại` cho một lần close;
- sau `đăng nhập thành công`, không có attempt mới nếu socket hiện tại còn sống;
- nếu server trả `sau 10s`, `nextRetryAt` không sớm hơn 10 giây;
- auto-farm chuyển sang running một lần;
- close log có kind, host/port, lifetime, rx/tx và không có credential.

Không chủ động làm rớt socket hoặc đăng nhập lặp để thử nghiệm.

- [ ] **Step 7: Báo cáo kết quả**

Báo riêng ba lớp bằng chứng:

1. Focused/full automated tests đã pass bao nhiêu test.
2. Typecheck/build/diff check đã đạt hay chưa.
3. Runtime game thật đã được người dùng kích hoạt và quan sát hay vẫn chưa xác minh.

Không commit hoặc stage trừ khi người dùng yêu cầu rõ ràng sau khi xem kết quả.
