import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer } from '../test-helpers.js';
import { authRouter } from './routes.js';

const INVITE = 'ma-moi-bi-mat';
const PASSWORD = 'mat-khau-du-dai';

async function setup() {
  const db = newTestDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: INVITE, isProduction: false }));
  const server = await startTestServer(app);
  return { db, server };
}

test('đăng ký đúng mã mời rồi /me trả về chính mình', async () => {
  const { db, server } = await setup();
  const reg = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'Ai@Bee.Com', password: PASSWORD, inviteCode: INVITE },
  });
  assert.equal(reg.status, 200);
  assert.deepEqual(reg.body, { id: 1, email: 'ai@bee.com' });

  const me = await server.fetch('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.email, 'ai@bee.com');

  await server.close();
  db.close();
});

test('cookie phiên là HttpOnly, SameSite=Lax, không Secure khi dev', async () => {
  const { db, server } = await setup();
  const reg = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const [cookie] = reg.cookies;
  assert.match(cookie, /^sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.doesNotMatch(cookie, /Secure/i);
  await server.close();
  db.close();
});

test('sai mã mời bị chặn và không tạo user', async () => {
  const { db, server } = await setup();
  const r = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: 'sai' },
  });
  assert.equal(r.status, 403);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM users').get()!.n, 0);
  await server.close();
  db.close();
});

test('mật khẩu dưới 10 ký tự bị từ chối', async () => {
  const { db, server } = await setup();
  const r = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: 'ngan', inviteCode: INVITE },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /10/);
  await server.close();
  db.close();
});

test('email đã dùng bị từ chối', async () => {
  const { db, server } = await setup();
  const body = { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE };
  await server.fetch('/api/auth/register', { method: 'POST', json: body });
  const again = await server.fetch('/api/auth/register', { method: 'POST', json: body });
  assert.equal(again.status, 409);
  await server.close();
  db.close();
});

test('đăng nhập đúng thì đặt cookie, sai thì 401 với thông báo mơ hồ', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  server.clearCookies();

  const bad = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: 'sai-mat-khau' },
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error, 'email hoặc mật khẩu không đúng');

  const nobody = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'khong@co.com', password: PASSWORD },
  });
  // Email không tồn tại và sai mật khẩu phải không phân biệt được từ ngoài.
  assert.equal(nobody.status, 401);
  assert.equal(nobody.body.error, 'email hoặc mật khẩu không đúng');

  const good = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD },
  });
  assert.equal(good.status, 200);
  assert.equal((await server.fetch('/api/auth/me')).status, 200);

  await server.close();
  db.close();
});

test('10 lần đăng nhập sai trong cửa sổ thì lần 11 ra 429', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  server.clearCookies();

  for (let i = 0; i < 10; i += 1) {
    const r = await server.fetch('/api/auth/login', {
      method: 'POST',
      json: { email: 'a@b.c', password: 'sai-mat-khau' },
    });
    assert.equal(r.status, 401, `lần ${i + 1} phải là 401`);
  }
  const blocked = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD },
  });
  assert.equal(blocked.status, 429);

  await server.close();
  db.close();
});

test('logout xoá phiên trong DB và xoá cookie', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const out = await server.fetch('/api/auth/logout', { method: 'POST' });
  assert.equal(out.status, 200);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM web_sessions').get()!.n, 0);
  assert.equal((await server.fetch('/api/auth/me')).status, 401);
  await server.close();
  db.close();
});

test('/me khi chưa đăng nhập trả 401', async () => {
  const { db, server } = await setup();
  assert.equal((await server.fetch('/api/auth/me')).status, 401);
  await server.close();
  db.close();
});
