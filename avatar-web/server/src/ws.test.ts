import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';

import { newTestDb, TEST_KEY } from './test-helpers.js';
import { authRouter } from './auth/routes.js';
import { createAccount } from './accounts/repo.js';
import { createUser } from './auth/users.js';
import { createSession } from './auth/sessions.js';
import { SessionManager } from './session/manager.js';
import type { AvatarSession, AvatarSessionOptions } from './session/avatarSession.js';
import { attachWebSocket, type WsHub } from './ws.js';

class FakeSession {
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {}
  stop() {}
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online' };
  }
}

async function setup() {
  const db = newTestDb();
  const sessions = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions: 20,
    broadcast: (u, a, t, p) => hub.broadcast(u, a, t, p),
    createSession: (opts) => new FakeSession(opts) as unknown as AvatarSession,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: 'x', isProduction: false }));

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  const hub: WsHub = attachWebSocket(server, { db, sessions });

  const user = createUser(db, 'a@b.c', 'h', 0);
  const other = createUser(db, 'b@b.c', 'h', 0);
  const account = createAccount(db, TEST_KEY, {
    userId: user.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'p',
  });
  const sid = createSession(db, user.id);
  const otherSid = createSession(db, other.id);

  const connect = (cookie?: string) =>
    new WebSocket(`ws://127.0.0.1:${port}/ws`, cookie ? { headers: { cookie } } : undefined);

  const close = async () => {
    hub.close();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  };

  return { db, hub, sessions, user, other, account, sid, otherSid, connect, close };
}

/** Chờ một message JSON đầu tiên khớp `type`, hoặc timeout. */
function waitMessage(ws: WebSocket, type: string, ms = 500): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`quá hạn chờ "${type}"`)), ms);
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type !== type) return;
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

function waitOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

test('không có cookie thì bị đóng ngay', async () => {
  const h = await setup();
  const ws = h.connect();
  const code = await new Promise<number>((resolve) => {
    ws.on('close', (c) => resolve(c));
    ws.on('error', () => {});
  });
  assert.equal(code, 4401);
  assert.equal(h.hub.clientCount(), 0);
  await h.close();
});

test('cookie hợp lệ thì mở được', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  assert.equal(h.hub.clientCount(), 1);
  ws.close();
  await h.close();
});

test('sự kiện nhẹ đẩy tới mọi client của chủ sở hữu, không cần subscribe', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  const got = waitMessage(ws, 'status');
  h.hub.broadcast(h.user.id, h.account.id, 'status', 'online');
  const msg = await got;
  assert.equal(msg.accountId, h.account.id);
  assert.equal(msg.payload, 'online');
  ws.close();
  await h.close();
});

test('sự kiện nhẹ KHÔNG đẩy tới client của người khác', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.otherSid}`);
  await waitOpen(ws);
  const got = waitMessage(ws, 'status', 200);
  h.hub.broadcast(h.user.id, h.account.id, 'status', 'online');
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('sự kiện nặng chỉ đẩy khi đã subscribe accountId đó', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);

  const before = waitMessage(ws, 'traffic', 200);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => before, /quá hạn/);

  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  await waitMessage(ws, 'snapshot');

  const after = waitMessage(ws, 'traffic');
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 2 });
  assert.deepEqual((await after).payload, { cmd: 2 });
  ws.close();
  await h.close();
});

test('subscribe trả về snapshot hiện tại của phiên', async () => {
  const h = await setup();
  await h.sessions.connect(h.account.id);
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  const snap = await waitMessage(ws, 'snapshot');
  assert.equal(snap.accountId, h.account.id);
  assert.equal(snap.payload.status, 'online');
  ws.close();
  await h.close();
});

test('subscribe accountId của người khác bị bỏ qua', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.otherSid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));

  const got = waitMessage(ws, 'traffic', 300);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('unsubscribe thì thôi nhận sự kiện nặng', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  await waitMessage(ws, 'snapshot');
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [] }));
  await new Promise((r) => setTimeout(r, 50));

  const got = waitMessage(ws, 'traffic', 300);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('client đóng thì bị gỡ khỏi hub', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  await new Promise<void>((r) => {
    ws.on('close', () => r());
    ws.close();
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.hub.clientCount(), 0);
  await h.close();
});

test('tin nhắn rác không làm sập server', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send('không phải json');
  ws.send(JSON.stringify({ op: 'không-biết' }));
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: 'không phải mảng' }));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(h.hub.clientCount(), 1);
  ws.close();
  await h.close();
});
