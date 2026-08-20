import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer, TEST_KEY } from '../test-helpers.js';
import { authRouter } from '../auth/routes.js';
import { accountsRouter } from '../accounts/routes.js';
import { DEFAULT_SEED_CATALOG } from '../accounts/defaultSeedCatalog.js';
import { getFarmProfile, updateFarmCells, updateSeedCatalog } from '../accounts/farmProfileRepo.js';
import { getAccountById, getAutoConfig, saveAutoConfig } from '../accounts/repo.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import { SessionManager } from './manager.js';
import { sessionRouter } from './routes.js';

const INVITE = 'ma-moi';
const PASSWORD = 'mat-khau-du-dai';

class FakeSession {
  calls: Array<{ name: string; args: unknown[] }> = [];
  throwOn?: string;
  updateResult: 'next-cycle' | 'next-start' = 'next-cycle';
  refreshResult: 'success' | 'offline' | 'timeout' = 'success';
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
  updateAutoConfig(cfg: unknown) {
    this.record('updateAutoConfig', cfg);
    return this.updateResult;
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
  async refreshFarmProfile() {
    this.record('refreshFarmProfile');
    if (this.refreshResult === 'offline') throw new Error('phiên chưa online');
    if (this.refreshResult === 'timeout') throw new Error('quá hạn đồng bộ farm');
    this.opts.onEvent('farm', { idFarm: 3, cells: [{ index: 2 }], updatedAt: 123 });
    this.opts.onEvent('trees', {
      trees: [{ id: 6, name: 'Lúa', growMinutes: 5, value: 10 }],
    });
  }
  lastPacketHex(cmd: number) {
    return cmd === 76 ? 'deadbeef' : undefined;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online', traffic: [{ cmd: 1 }, { cmd: 2 }] };
  }
}

function seedProfile(db: ReturnType<typeof newTestDb>, id: number): void {
  updateFarmCells(db, id, 3, [2, 4], [], [], 100);
  updateSeedCatalog(db, id, [
    { id: 6, name: 'Lúa', growMinutes: 5, value: 10 },
    { id: 8, name: 'Ngô', growMinutes: 8, value: 12 },
  ], 101);
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
  const normalizedCfg = { ...cfg, autoHarvestCook: true };
  assert.deepEqual(row.autoConfig, normalizedCfg);
  assert.deepEqual(made[0].calls.at(-1), { name: 'startAuto', args: [normalizedCfg] });
  await server.close();
  db.close();
});

test('auto/start khi chưa kết nối tự tạo session và đăng nhập', async () => {
  const { db, server, made, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: true },
  });
  assert.equal(r.status, 200);
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  assert.deepEqual(made[0].calls.map((call) => call.name), ['startAuto']);
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

test('GET/PUT config dùng revision và queue sau khi DB đã ghi', async () => {
  const { db, server, made, id } = await setup();
  const empty = await server.fetch(`/api/accounts/${id}/auto/config`);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { revision: 0, config: {} });

  seedProfile(db, id);
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const put = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: {
      expectedRevision: 0,
      config: { treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 6 }] },
    },
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.application, 'next-cycle');
  assert.deepEqual(made[0].calls.at(-1), {
    name: 'updateAutoConfig',
    args: [{ treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 6 }], autoHarvestCook: true }],
  });
  assert.deepEqual((await server.fetch(`/api/accounts/${id}/auto/config`)).body, {
    revision: 1,
    config: { treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 6 }], autoHarvestCook: true },
  });
  await server.close();
  db.close();
});

test('revision cũ trả 409 kèm current, không queue runtime', async () => {
  const { db, server, made, id } = await setup();
  const userId = getAccountById(db, id)!.userId;
  assert.equal(saveAutoConfig(db, userId, id, 0, { harvest: true }).status, 'saved');
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  const stale = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 0, config: { harvest: false } },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'revision-conflict');
  assert.deepEqual(stale.body.current, {
    revision: 1,
    config: { harvest: true, autoHarvestCook: true },
  });
  assert.deepEqual(made[0].calls.map((call) => call.name), ['start']);
  await server.close();
  db.close();
});

test('start body cũ merge không xóa plan, stop giữ config', async () => {
  const { db, server, made, id } = await setup();
  const userId = getAccountById(db, id)!.userId;
  seedProfile(db, id);
  assert.equal(saveAutoConfig(db, userId, id, 0, {
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  }).status, 'saved');
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  const start = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: false },
  });
  assert.equal(start.status, 200);
  assert.deepEqual(getAutoConfig(db, userId, id), {
    revision: 2,
    config: {
      harvest: false,
      treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
      autoHarvestCook: true,
    },
  });
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  assert.deepEqual(made[0].calls.at(-1), {
    name: 'startAuto',
    args: [{
      harvest: false,
      treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
      autoHarvestCook: true,
    }],
  });

  await server.fetch(`/api/accounts/${id}/auto/stop`, { method: 'POST', json: {} });
  assert.equal(getAccountById(db, id)!.autoEnabled, false);
  assert.deepEqual(getAutoConfig(db, userId, id), {
    revision: 2,
    config: {
      harvest: false,
      treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
      autoHarvestCook: true,
    },
  });
  const callsBeforeConflict = made[0].calls.length;
  const stale = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 1, config: {} },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.revision, 2);
  assert.equal(made[0].calls.length, callsBeforeConflict);
  await server.close();
  db.close();
});

test('start body rỗng chỉ bật config đã lưu, không tăng revision', async () => {
  const { db, server, made, id } = await setup();
  const userId = getAccountById(db, id)!.userId;
  assert.equal(saveAutoConfig(db, userId, id, 0, { harvest: true }).status, 'saved');
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  const start = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: {},
  });
  assert.equal(start.status, 200);
  assert.deepEqual(getAutoConfig(db, userId, id), {
    revision: 1,
    config: { harvest: true, autoHarvestCook: true },
  });
  assert.deepEqual(made[0].calls.at(-1), {
    name: 'startAuto',
    args: [{ harvest: true, autoHarvestCook: true }],
  });
  await server.close();
  db.close();
});

test('payload config sai trả 400 và không mutate DB/runtime', async () => {
  const cases = [
    { expectedRevision: 0.5, config: {} },
    { expectedRevision: 0, config: { notAConfigKey: true } },
    { expectedRevision: 0, config: [] },
    { expectedRevision: 0, config: {}, extra: true },
  ];
  for (const payload of cases) {
    const { db, server, made, id } = await setup();
    const userId = getAccountById(db, id)!.userId;
    await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
    const response = await server.fetch(`/api/accounts/${id}/auto/config`, {
      method: 'PUT',
      json: payload,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(getAutoConfig(db, userId, id), { revision: 0, config: {} });
    assert.equal(getAccountById(db, id)!.autoEnabled, false);
    assert.deepEqual(made[0].calls.map((call) => call.name), ['start']);
    await server.close();
    db.close();
  }
});

test('lỗi storage khi PUT config trả 500 và không queue runtime', async () => {
  const { db, server, made, id } = await setup();
  const userId = getAccountById(db, id)!.userId;
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  db.exec(`CREATE TRIGGER fail_auto_config_update
    BEFORE UPDATE OF auto_config_json ON avatar_accounts
    BEGIN
      SELECT RAISE(ABORT, 'storage unavailable');
    END`);

  const response = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 0, config: { harvest: true } },
  });
  assert.equal(response.status, 500);
  assert.deepEqual(getAutoConfig(db, userId, id), { revision: 0, config: {} });
  assert.deepEqual(made[0].calls.map((call) => call.name), ['start']);
  await server.close();
  db.close();
});

test('PUT config khi chưa có session trả application next-start', async () => {
  const { db, server, id } = await setup();
  const response = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 0, config: { harvest: true } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.application, 'next-start');
  assert.deepEqual(response.body.config, { harvest: true, autoHarvestCook: true });
  await server.close();
  db.close();
});

test('plan với ô ngoài dải hoặc seed ngoài catalog bị từ chối mà không mutate', async () => {
  const cases = [
    {
      prepare: (_db: ReturnType<typeof newTestDb>, _id: number) => {},
      config: { treeCellPlan: [{ cellIndex: 50, action: 'skip' }] },
      status: 400,
      code: 'invalid-tree-cell-plan',
    },
    {
      prepare: (db: ReturnType<typeof newTestDb>, id: number) => updateFarmCells(db, id, 3, [2]),
      config: { treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 9999 }] },
      status: 400,
      code: 'invalid-tree-cell-plan',
    },
  ];
  for (const item of cases) {
    for (const endpoint of ['auto/config', 'auto/start']) {
      const { db, server, made, id } = await setup();
      item.prepare(db, id);
      await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
      const response = await server.fetch(`/api/accounts/${id}/${endpoint}`, {
        method: endpoint === 'auto/config' ? 'PUT' : 'POST',
        json: endpoint === 'auto/config'
          ? { expectedRevision: 0, config: item.config }
          : item.config,
      });
      assert.equal(response.status, item.status);
      assert.equal(response.body.code, item.code);
      assert.deepEqual(getAutoConfig(db, getAccountById(db, id)!.userId, id), {
        revision: 0,
        config: {},
      });
      assert.equal(getAccountById(db, id)!.autoEnabled, false);
      assert.deepEqual(made[0].calls.map((call) => call.name), ['start']);
      await server.close();
      db.close();
    }
  }
});

test('chưa có profile cache vẫn chấp nhận plan hợp lệ trong 48 ô và seed mặc định', async () => {
  for (const config of [
    { treeCellPlan: [] },
    { treeCellPlan: [{ cellIndex: 2, action: 'skip' }] },
    { treeCellPlan: [{ cellIndex: 7, action: 'seed', seedId: 6 }] },
  ]) {
    const { db, server, id } = await setup();
    const response = await server.fetch(`/api/accounts/${id}/auto/config`, {
      method: 'PUT',
      json: { expectedRevision: 0, config },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(getAutoConfig(db, getAccountById(db, id)!.userId, id)?.config, {
      ...config,
      autoHarvestCook: true,
    });
    await server.close();
    db.close();
  }
});

test('plan có ô hoặc seed không hợp lệ trả danh sách lỗi chính xác cho PUT và legacy start', async () => {
  const invalidConfig = {
    treeCellPlan: [
      { cellIndex: 4, action: 'seed', seedId: 8 },
      { cellIndex: 50, action: 'seed', seedId: 9999 },
      { cellIndex: 52, action: 'skip' },
    ],
  };
  for (const endpoint of ['auto/config', 'auto/start']) {
    const { db, server, made, id } = await setup();
    seedProfile(db, id);
    await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
    const response = await server.fetch(`/api/accounts/${id}/${endpoint}`, {
      method: endpoint === 'auto/config' ? 'PUT' : 'POST',
      json: endpoint === 'auto/config'
        ? { expectedRevision: 0, config: invalidConfig }
        : invalidConfig,
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'invalid-tree-cell-plan');
    assert.deepEqual(response.body.invalidCellIndices, [50, 52]);
    assert.deepEqual(response.body.invalidSeedIds, [9999]);
    assert.deepEqual(getAutoConfig(db, getAccountById(db, id)!.userId, id), {
      revision: 0,
      config: {},
    });
    assert.equal(getAccountById(db, id)!.autoEnabled, false);
    assert.deepEqual(made[0].calls.map((call) => call.name), ['start']);
    await server.close();
    db.close();
  }
});

test('GET profile trả cache typed và refresh offline/timeout/online đúng contract', async () => {
  const { db, server, made, id } = await setup();
  assert.deepEqual((await server.fetch(`/api/accounts/${id}/farm/profile`)).body, {
    farmId: null,
    cellIndices: [],
    barnAnimalSlots: [],
    pondAnimalSlots: [],
    seedCatalog: DEFAULT_SEED_CATALOG,
    cellsObservedAt: null,
    seedsObservedAt: null,
    updatedAt: null,
  });

  const offline = await server.fetch(`/api/accounts/${id}/farm/profile/refresh`, { method: 'POST' });
  assert.equal(offline.status, 409);

  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  made[0].refreshResult = 'offline';
  const existingOffline = await server.fetch(`/api/accounts/${id}/farm/profile/refresh`, {
    method: 'POST',
  });
  assert.equal(existingOffline.status, 409);

  made[0].refreshResult = 'timeout';
  const timeout = await server.fetch(`/api/accounts/${id}/farm/profile/refresh`, { method: 'POST' });
  assert.equal(timeout.status, 504);

  made[0].refreshResult = 'success';
  const refreshed = await server.fetch(`/api/accounts/${id}/farm/profile/refresh`, { method: 'POST' });
  assert.equal(refreshed.status, 200);
  assert.deepEqual(refreshed.body, getFarmProfile(db, id));
  assert.deepEqual(refreshed.body.cellIndices, [2]);
  assert.deepEqual(refreshed.body.seedCatalog, DEFAULT_SEED_CATALOG);
  await server.close();
  db.close();
});

test('runtime lỗi sau khi PUT commit trả 500 nhưng giữ config đã persist', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  made[0].throwOn = 'updateAutoConfig';
  const response = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 0, config: { harvest: true } },
  });
  assert.equal(response.status, 500);
  assert.deepEqual(getAutoConfig(db, getAccountById(db, id)!.userId, id), {
    revision: 1,
    config: { harvest: true, autoHarvestCook: true },
  });
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
  for (const [path, method] of [
    ['auto/config', 'GET'],
    ['auto/config', 'PUT'],
    ['farm/profile', 'GET'],
    ['farm/profile/refresh', 'POST'],
  ]) {
    const r = await server.fetch(
      `/api/accounts/${id}/${path}`,
      method === 'GET' ? { method } : { method, json: {} },
    );
    assert.equal(r.status, 404, `${method} ${path} phải là 404`);
  }
  assert.equal((await server.fetch(`/api/accounts/${id}/state`)).status, 404);
  await server.close();
  db.close();
});
