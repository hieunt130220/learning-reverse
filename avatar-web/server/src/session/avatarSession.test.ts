import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import type { AutoFarm } from '../autoFarm.js';
import type { GameClient } from '../game/client.js';
import type { MacroRunner } from '../macro.js';
import { AvatarSession, RETRY_BASE_MS, RETRY_MAX_MS, type AvatarCredentials } from './avatarSession.js';

/** GameClient giả: đủ bề mặt để `AvatarSession` chạy, không mở socket nào. */
class FakeClient extends EventEmitter {
  status = 'idle';
  autoOnline = true;
  lastError: string | undefined;
  playerId: number | undefined;
  farmState: unknown;
  inventory: unknown[] = [];
  trees: unknown[] = [];
  items: unknown[] = [];
  animals: unknown[] = [];
  money: number | undefined;
  traffic: unknown[] = [];
  lastPacket = new Map<number, string>();
  readonly farm = { getInventory: () => this.calls.push('getInventory') };
  calls: string[] = [];
  loginArgs: unknown[] = [];
  loginError: Error | null = null;
  logoutCount = 0;

  async login(opts: unknown): Promise<void> {
    this.loginArgs.push(opts);
    if (this.loginError) throw this.loginError;
    if (this.autoOnline) this.goOnline();
  }
  goOnline(): void {
    this.status = 'online';
    this.emit('status', 'online');
  }
  logout(): void {
    this.logoutCount += 1;
    this.status = 'idle';
    this.emit('status', 'idle');
  }
  enterFarm(): void {
    this.calls.push('enterFarm');
  }
  sendRaw(cmd: number): void {
    this.calls.push(`raw:${cmd}`);
  }
  /** Mô phỏng server đá phiên. */
  drop(): void {
    this.status = 'idle';
    this.emit('status', 'idle');
  }
  rejectTemporarily(retryAfterMs: number): void {
    this.emit('temporary-rejection', { reason: 'throttle', retryAfterMs });
  }
}

/**
 * AutoFarm/MacroRunner thật dùng `setTimeout` thật với chu kỳ hàng phút và
 * không tiêm được đồng hồ. Test ở đây chỉ quan tâm `AvatarSession` có gọi
 * đúng `start`/`stop` hay không, nên thay bằng bản giả.
 */
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

class FakeMacro extends EventEmitter {
  running = false;
  start(_m: unknown) {
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  state() {
    return { running: this.running, cycle: 0 };
  }
}

const flush = () => new Promise((r) => setImmediate(r));

interface FakeTimer {
  id: number;
  fn: () => void;
  delay: number;
  active: boolean;
}

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
      const a = new FakeAuto();
      autos.push(a);
      return a as unknown as AutoFarm;
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
    random: () => 0.5, // jitter = hệ số 1.0, backoff thành số tròn
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

test('start đăng nhập với thông tin lấy từ loadCredentials', async () => {
  const h = harness();
  await h.session.start();
  assert.equal(h.clients.length, 1);
  assert.deepEqual(h.clients[0].loginArgs, [
    { host: 'h', port: 1, user: 'u', pass: 'p', device: undefined },
  ]);
  assert.equal(h.session.status, 'online');
});

test('start hai lần không tạo client thứ hai', async () => {
  const h = harness();
  await h.session.start();
  await h.session.start();
  assert.equal(h.clients.length, 1);
});

test('autoEnabled = true thì bật AutoFarm sau khi online', async () => {
  const h = harness({ autoEnabled: true, autoConfig: { intervalMs: 60000 } });
  await h.session.start();
  assert.equal(h.session.snapshot().auto.running, true);
  assert.deepEqual(h.autos[0].lastCfg, { intervalMs: 60000 });
});

test('autoEnabled = false thì không tự bật', async () => {
  const h = harness();
  await h.session.start();
  assert.equal(h.session.snapshot().auto.running, false);
});

test('login liên tục lỗi thì backoff tăng gấp đôi, trần 5 phút', async () => {
  const h = harness({}, { loginError: new Error('không nhận được gói khóa (-27) sau 10s') });
  await h.session.start();

  const delays: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    delays.push(h.fireTimer());
    await flush();
  }
  assert.deepEqual(delays, [
    RETRY_BASE_MS,
    RETRY_BASE_MS * 2,
    RETRY_BASE_MS * 4,
    RETRY_BASE_MS * 8,
    RETRY_BASE_MS * 16,
    RETRY_MAX_MS,
    RETRY_MAX_MS,
    RETRY_MAX_MS,
  ]);
});

test('login ném lỗi thì start không ném ra ngoài mà ghi log rồi hẹn thử lại', async () => {
  const h = harness({}, { loginError: new Error('không nhận được gói khóa (-27) sau 10s') });
  await h.session.start();
  assert.equal(h.pendingTimers().length, 1);
  assert.equal(h.pendingTimers()[0].delay, RETRY_BASE_MS);
  const logs = h.session.snapshot().logs.map((l) => l.line);
  assert.ok(logs.some((l) => l.includes('kết nối lỗi')));
});

test('rớt kết nối khi đang muốn kết nối thì hẹn thử lại', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].drop();
  assert.equal(h.pendingTimers().length, 1);
  assert.equal(h.pendingTimers()[0].delay, RETRY_BASE_MS);
});

test('kết nối lại thành công thì đặt lại bộ đếm backoff', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].drop();
  assert.equal(h.fireTimer(), RETRY_BASE_MS);
  await flush();
  assert.equal(h.clients.length, 2, 'phải tạo client mới');
  assert.equal(h.session.snapshot().retries, 0);
});

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

test('stop thì không thử lại nữa', async () => {
  const h = harness();
  await h.session.start();
  h.session.stop();
  h.clients[0].drop();
  assert.equal(h.timers.length, 0);
  assert.equal(h.clients[0].logoutCount, 1);
});

test('nhận LOGIN_FAIL (-35) thì dừng hẳn và báo lỗi vĩnh viễn', async () => {
  const h = harness({ autoEnabled: true });
  await h.session.start();
  h.clients[0].emit('message', { command: -35 });
  h.clients[0].drop();

  assert.equal(h.pendingTimers().length, 0, 'không được hẹn thử lại');
  assert.equal(h.session.desiredConnected, false);
  assert.equal(h.permanent.length, 1);
  assert.match(h.permanent[0], /đăng nhập/);
});

test('ring buffer log giữ tối đa 500 dòng, mới nhất ở cuối', async () => {
  const h = harness();
  await h.session.start();
  for (let i = 0; i < 600; i += 1) h.clients[0].emit('log', `dòng ${i}`);
  const logs = h.session.snapshot().logs;
  assert.equal(logs.length, 500);
  assert.equal(logs[logs.length - 1].line, 'dòng 599');
  assert.equal(logs[0].line, 'dòng 100');
});

test('ring buffer traffic giữ tối đa 100 gói', async () => {
  const h = harness();
  await h.session.start();
  for (let i = 0; i < 150; i += 1) {
    h.clients[0].emit('traffic', { t: i, dir: 'tx', cmd: i, name: 'x', len: 0, hex: '' });
  }
  assert.equal(h.session.snapshot().traffic.length, 100);
});

test('sự kiện của client được đẩy ra ngoài qua onEvent', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].emit('log', 'xin chào');
  h.clients[0].emit('money', { balance: 10 });
  const types = h.events.map((e) => e.type);
  assert.ok(types.includes('status'));
  assert.ok(types.includes('log'));
  assert.ok(types.includes('money'));
});

test('callFarm gọi đúng method, tên sai thì ném', async () => {
  const h = harness();
  await h.session.start();
  h.session.callFarm('getInventory', []);
  assert.deepEqual(h.clients[0].calls, ['getInventory']);
  assert.throws(() => h.session.callFarm('khongCo', []), /không có action/);
});

test('gọi lệnh khi chưa kết nối thì ném lỗi rõ ràng', () => {
  const h = harness();
  assert.throws(() => h.session.callFarm('getInventory', []), /chưa kết nối/);
  assert.throws(() => h.session.sendRaw(76, []), /chưa kết nối/);
  assert.throws(() => h.session.enterFarm(), /chưa kết nối/);
});

test('lỗi trong handler sự kiện không làm chết process', async () => {
  const h = harness();
  await h.session.start();
  // onEvent của thật có thể ném (vd WS đã đóng); AvatarSession phải nuốt.
  assert.doesNotThrow(() => h.clients[0].emit('log', 'x'));
});

test('snapshot có đủ trường cho UI', async () => {
  const h = harness();
  await h.session.start();
  const s = h.session.snapshot();
  for (const k of [
    'accountId',
    'status',
    'auto',
    'macro',
    'inventory',
    'trees',
    'items',
    'animals',
    'logs',
    'traffic',
    'retries',
    'desiredConnected',
  ]) {
    assert.ok(k in s, `snapshot thiếu ${k}`);
  }
  assert.equal(s.accountId, 7);
});
