import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import { createAccount, getAccountById, setAutoEnabled } from '../accounts/repo.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import { BOOTSTRAP_STAGGER_MS, SessionManager } from './manager.js';

/** `AvatarSession` giả — ghi lại lời gọi, không mở socket. */
class FakeSession {
  started = 0;
  stopped = 0;
  desiredConnected = false;
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {
    this.started += 1;
    this.desiredConnected = true;
  }
  stop() {
    this.stopped += 1;
    this.desiredConnected = false;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online' };
  }
}

function setup(maxSessions = 20) {
  const db = newTestDb();
  const user = createUser(db, 'a@b.c', 'h', 0);
  const made: FakeSession[] = [];
  const sent: Array<{ userId: number; accountId: number; type: string }> = [];
  const timers: Array<{ fn: () => void; delay: number }> = [];

  const manager = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions,
    broadcast: (userId, accountId, type) => sent.push({ userId, accountId, type }),
    createSession: (opts) => {
      const s = new FakeSession(opts);
      made.push(s);
      return s as unknown as AvatarSession;
    },
    setTimeoutFn: ((fn: () => void, delay: number) => {
      timers.push({ fn, delay });
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
  });

  const newAccount = (label: string) =>
    createAccount(db, TEST_KEY, { userId: user.id, label, gameUser: 'u', gamePass: 'p' });

  return { db, user, manager, made, sent, timers, newAccount };
}

/** Bootstrap nối các lần đăng nhập bằng `void startAt(i+1)`, nên timer kế tiếp
 *  chỉ xuất hiện sau khi microtask chạy xong. */
const flush = () => new Promise((r) => setImmediate(r));

test('connect tạo đúng một phiên và dùng lại ở lần sau', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  await manager.connect(acc.id);
  assert.equal(made.length, 1);
  assert.equal(made[0].started, 2);
  assert.equal(manager.size(), 1);
  db.close();
});

test('loadCredentials đọc host/port/user và giải mã mật khẩu từ DB', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  const creds = await made[0].opts.loadCredentials();
  assert.equal(creds.user, 'u');
  assert.equal(creds.pass, 'p');
  assert.equal(creds.host, acc.host);
  assert.equal(creds.port, acc.port);
  assert.equal(creds.autoEnabled, false);
  db.close();
});

test('loadCredentials đọc lại DB mỗi lần — đổi cấu hình là có hiệu lực ngay', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  setAutoEnabled(db, acc.id, true, { harvest: true });
  const creds = await made[0].opts.loadCredentials();
  assert.equal(creds.autoEnabled, true);
  assert.deepEqual(creds.autoConfig, { harvest: true });
  db.close();
});

test('vượt MAX_SESSIONS thì ném lỗi', async () => {
  const { db, manager, newAccount } = setup(2);
  await manager.connect(newAccount('1').id);
  await manager.connect(newAccount('2').id);
  await assert.rejects(() => manager.connect(newAccount('3').id), /tối đa 2/);
  db.close();
});

test('tài khoản không tồn tại thì ném lỗi', async () => {
  const { db, manager } = setup();
  await assert.rejects(() => manager.connect(999), /không có tài khoản/);
  db.close();
});

test('disconnect dừng phiên nhưng giữ lại trong map', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  manager.disconnect(acc.id);
  assert.equal(made[0].stopped, 1);
  assert.equal(manager.size(), 1);
  db.close();
});

test('destroy dừng phiên và bỏ khỏi map', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  manager.destroy(acc.id);
  assert.equal(made[0].stopped, 1);
  assert.equal(manager.size(), 0);
  db.close();
});

test('sự kiện của phiên được phát tới đúng chủ sở hữu', async () => {
  const { db, manager, made, sent, newAccount, user } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  made[0].opts.onEvent('status', 'online');
  assert.deepEqual(sent, [{ userId: user.id, accountId: acc.id, type: 'status' }]);
  db.close();
});

test('lỗi vĩnh viễn thì tắt auto_enabled trong DB', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  setAutoEnabled(db, acc.id, true, { harvest: true });
  await manager.connect(acc.id);
  made[0].opts.onPermanentFailure('đăng nhập thất bại');
  assert.equal(getAccountById(db, acc.id)!.autoEnabled, false);
  db.close();
});

test('bootstrap chỉ bật tài khoản có auto_enabled = 1', async () => {
  const { db, manager, made, timers, newAccount } = setup();
  const on = newAccount('bật');
  newAccount('tắt');
  setAutoEnabled(db, on.id, true, {});

  await manager.bootstrap();
  assert.equal(made.length, 1);
  assert.equal(made[0].opts.accountId, on.id);
  assert.equal(timers.length, 0, 'chỉ một tài khoản thì không cần giãn cách');
  db.close();
});

test('bootstrap giãn cách giữa các lần đăng nhập', async () => {
  const { db, manager, made, timers, newAccount } = setup();
  const ids = ['a', 'b', 'c'].map((l) => newAccount(l).id);
  for (const id of ids) setAutoEnabled(db, id, true, {});

  await manager.bootstrap();
  assert.equal(made.length, 1, 'tài khoản đầu bật ngay');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, BOOTSTRAP_STAGGER_MS);

  timers[0].fn();
  await flush();
  assert.equal(made.length, 2);
  assert.equal(timers[1].delay, BOOTSTRAP_STAGGER_MS);
  db.close();
});

test('stopAll dừng mọi phiên', async () => {
  const { db, manager, made, newAccount } = setup();
  await manager.connect(newAccount('1').id);
  await manager.connect(newAccount('2').id);
  manager.stopAll();
  assert.deepEqual(made.map((s) => s.stopped), [1, 1]);
  assert.equal(manager.size(), 0);
  db.close();
});

test('snapshot trả null khi chưa có phiên', async () => {
  const { db, manager, newAccount } = setup();
  const acc = newAccount('x');
  assert.equal(manager.snapshot(acc.id), null);
  await manager.connect(acc.id);
  assert.equal(manager.snapshot(acc.id)!.accountId, acc.id);
  db.close();
});
