import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer, TEST_KEY } from '../test-helpers.js';
import { authRouter } from '../auth/routes.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import { SessionManager } from '../session/manager.js';
import type { AvatarSession, AvatarSessionOptions } from '../session/avatarSession.js';
import { readGamePass } from './repo.js';
import { accountsRouter } from './routes.js';

const INVITE = 'ma-moi';
const PASSWORD = 'mat-khau-du-dai';

class FakeSession {
  stopped = 0;
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {}
  stop() {
    this.stopped += 1;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online', money: 42 };
  }
}

async function setup() {
  const db = newTestDb();
  const made: FakeSession[] = [];
  const sessions = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions: 20,
    broadcast: () => {},
    createSession: (opts) => {
      const s = new FakeSession(opts);
      made.push(s);
      return s as unknown as AvatarSession;
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: INVITE, isProduction: false }));
  app.use('/api/accounts', accountsRouter({ db, masterKey: TEST_KEY, isProduction: false, sessions }));
  const server = await startTestServer(app);

  const register = (email: string) =>
    server.fetch('/api/auth/register', {
      method: 'POST',
      json: { email, password: PASSWORD, inviteCode: INVITE },
    });

  return { db, server, sessions, made, register };
}

const NEW_ACCOUNT = { label: 'chính', gameUser: 'NguoiChoi', gamePass: 'bimat' };

test('chưa đăng nhập thì mọi endpoint trả 401', async () => {
  const { db, server } = await setup();
  assert.equal((await server.fetch('/api/accounts')).status, 401);
  assert.equal((await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT })).status, 401);
  assert.equal((await server.fetch('/api/accounts/1', { method: 'DELETE' })).status, 401);
  await server.close();
  db.close();
});

test('tạo tài khoản rồi thấy trong danh sách', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  assert.equal(created.status, 200);
  assert.equal(created.body.label, 'chính');
  assert.equal(created.body.host, DEFAULT_GAME_SERVER.host);

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, created.body.id);
  await server.close();
  db.close();
});

test('response không bao giờ chứa mật khẩu, chỉ có cờ hasPassword', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const list = await server.fetch('/api/accounts');
  for (const body of [created.body, list.body]) {
    const json = JSON.stringify(body);
    assert.ok(!json.includes('bimat'), 'lộ mật khẩu rõ');
    assert.ok(!json.includes('v1:'), 'lộ bản mã');
  }
  assert.equal(created.body.hasPassword, true);
  await server.close();
  db.close();
});

test('thiếu trường bắt buộc thì 400', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const r = await server.fetch('/api/accounts', { method: 'POST', json: { label: 'x' } });
  assert.equal(r.status, 400);
  await server.close();
  db.close();
});

test('danh sách kèm trạng thái runtime của phiên đang chạy', async () => {
  const { db, server, sessions, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  await sessions.connect(created.body.id);

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body[0].runtime.status, 'online');
  assert.equal(list.body[0].runtime.money, 42);
  await server.close();
  db.close();
});

test('sửa: gửi gamePass thì đổi, không gửi thì giữ nguyên', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const id = created.body.id;

  await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { label: 'đổi tên' } });
  assert.equal(readGamePass(db, TEST_KEY, id), 'bimat');

  await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { gamePass: 'moi' } });
  assert.equal(readGamePass(db, TEST_KEY, id), 'moi');

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body[0].label, 'đổi tên');
  await server.close();
  db.close();
});

test('xoá thì dừng phiên trước rồi mới xoá bản ghi', async () => {
  const { db, server, sessions, made, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  await sessions.connect(created.body.id);

  const r = await server.fetch(`/api/accounts/${created.body.id}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal(made[0].stopped, 1);
  assert.equal(sessions.size(), 0);
  assert.equal((await server.fetch('/api/accounts')).body.length, 0);
  await server.close();
  db.close();
});

test('không đụng được vào tài khoản của người khác', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const id = created.body.id;

  server.clearCookies();
  await register('ke-la@b.c');

  assert.equal((await server.fetch('/api/accounts')).body.length, 0);
  assert.equal(
    (await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { label: 'chiếm' } })).status,
    404,
  );
  assert.equal((await server.fetch(`/api/accounts/${id}`, { method: 'DELETE' })).status, 404);
  await server.close();
  db.close();
});

test('id không phải số thì 400', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  assert.equal((await server.fetch('/api/accounts/abc', { method: 'DELETE' })).status, 400);
  await server.close();
  db.close();
});
