import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer, TEST_KEY } from '../test-helpers.js';
import { authRouter } from '../auth/routes.js';
import { accountsRouter } from '../accounts/routes.js';
import { getAccountById } from '../accounts/repo.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import { SessionManager } from './manager.js';
import { sessionRouter } from './routes.js';

const INVITE = 'ma-moi';
const PASSWORD = 'mat-khau-du-dai';

class FakeSession {
  calls: Array<{ name: string; args: unknown[] }> = [];
  throwOn?: string;
  constructor(readonly opts: AvatarSessionOptions) {}
  private record(name: string, ...args: unknown[]) {
    this.calls.push({ name, args });
    if (this.throwOn === name) throw new Error(`hỏng: ${name}`);
  }
  async start() {
    this.record('start');
  }
  stop() {
    this.record('stop');
  }
  startAuto(cfg: unknown) {
    this.record('startAuto', cfg);
  }
  stopAuto() {
    this.record('stopAuto');
  }
  startMacro(m: unknown) {
    this.record('startMacro', m);
  }
  stopMacro() {
    this.record('stopMacro');
  }
  callFarm(name: string, args: unknown[]) {
    this.record('callFarm', name, args);
  }
  sendRaw(cmd: number, fields: unknown) {
    this.record('sendRaw', cmd, fields);
  }
  enterFarm() {
    this.record('enterFarm');
  }
  lastPacketHex(cmd: number) {
    return cmd === 76 ? 'deadbeef' : undefined;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online', traffic: [{ cmd: 1 }, { cmd: 2 }] };
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
  app.use('/api/accounts', sessionRouter({ db, isProduction: false, sessions }));
  const server = await startTestServer(app);

  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const created = await server.fetch('/api/accounts', {
    method: 'POST',
    json: { label: 'x', gameUser: 'u', gamePass: 'p' },
  });

  return { db, server, sessions, made, id: created.body.id as number };
}

test('connect tạo phiên và gọi start', async () => {
  const { db, server, made, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.deepEqual(made[0].calls.map((c) => c.name), ['start']);
  await server.close();
  db.close();
});

test('disconnect gọi stop', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const r = await server.fetch(`/api/accounts/${id}/disconnect`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(made[0].calls.at(-1)!.name, 'stop');
  await server.close();
  db.close();
});

test('auto/start ghi DB trước rồi mới áp vào phiên', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const cfg = { harvest: true, intervalMs: 60000 };
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, { method: 'POST', json: cfg });
  assert.equal(r.status, 200);

  const row = getAccountById(db, id)!;
  assert.equal(row.autoEnabled, true);
  assert.deepEqual(row.autoConfig, cfg);
  assert.deepEqual(made[0].calls.at(-1), { name: 'startAuto', args: [cfg] });
  await server.close();
  db.close();
});

test('auto/start khi chưa kết nối vẫn ghi được ý muốn vào DB', async () => {
  const { db, server, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: true },
  });
  assert.equal(r.status, 409);
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  await server.close();
  db.close();
});

test('phiên ném lỗi khi bật auto thì DB vẫn giữ ý muốn và trả 500', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  made[0].throwOn = 'startAuto';
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: true },
  });
  assert.equal(r.status, 500);
  // Ý muốn đã ghi rồi: bootstrap sau restart vẫn bật lại đúng.
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  await server.close();
  db.close();
});

test('auto/stop ghi DB trước rồi mới dừng phiên', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  await server.fetch(`/api/accounts/${id}/auto/start`, { method: 'POST', json: { harvest: true } });
  await server.fetch(`/api/accounts/${id}/auto/stop`, { method: 'POST' });
  assert.equal(getAccountById(db, id)!.autoEnabled, false);
  assert.equal(made[0].calls.at(-1)!.name, 'stopAuto');
  await server.close();
  db.close();
});

test('farm, raw, enter-farm, macro chuyển tiếp đúng tham số', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  await server.fetch(`/api/accounts/${id}/farm`, {
    method: 'POST',
    json: { name: 'harvest', args: [0, 3] },
  });
  await server.fetch(`/api/accounts/${id}/raw`, {
    method: 'POST',
    json: { cmd: 76, fields: [{ t: 'i32', v: '1' }] },
  });
  await server.fetch(`/api/accounts/${id}/enter-farm`, { method: 'POST' });
  await server.fetch(`/api/accounts/${id}/macro/start`, {
    method: 'POST',
    json: { name: 'm', intervalMs: 0, steps: [] },
  });
  await server.fetch(`/api/accounts/${id}/macro/stop`, { method: 'POST' });

  const names = made[0].calls.map((c) => c.name);
  assert.deepEqual(names, ['start', 'callFarm', 'sendRaw', 'enterFarm', 'startMacro', 'stopMacro']);
  assert.deepEqual(made[0].calls[1].args, ['harvest', [0, 3]]);
  assert.deepEqual(made[0].calls[2].args, [76, [{ t: 'i32', v: '1' }]]);
  await server.close();
  db.close();
});

test('gọi lệnh khi chưa có phiên thì 409', async () => {
  const { db, server, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/farm`, {
    method: 'POST',
    json: { name: 'harvest', args: [] },
  });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /chưa kết nối/);
  await server.close();
  db.close();
});

test('state trả snapshot, traffic cắt theo n, packet trả hex', async () => {
  const { db, server, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  assert.equal((await server.fetch(`/api/accounts/${id}/state`)).body.status, 'online');
  assert.equal((await server.fetch(`/api/accounts/${id}/traffic?n=1`)).body.length, 1);
  assert.equal((await server.fetch(`/api/accounts/${id}/packet/76`)).body.hex, 'deadbeef');
  assert.equal((await server.fetch(`/api/accounts/${id}/packet/99`)).status, 404);
  await server.close();
  db.close();
});

test('không điều khiển được phiên của người khác', async () => {
  const { db, server, id } = await setup();
  server.clearCookies();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'ke-la@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  for (const path of ['connect', 'disconnect', 'auto/start', 'auto/stop', 'farm', 'raw']) {
    const r = await server.fetch(`/api/accounts/${id}/${path}`, { method: 'POST', json: {} });
    assert.equal(r.status, 404, `${path} phải là 404`);
  }
  assert.equal((await server.fetch(`/api/accounts/${id}/state`)).status, 404);
  await server.close();
  db.close();
});
