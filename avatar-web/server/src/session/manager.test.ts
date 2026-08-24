import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import {
  createAccount,
  getAccountById,
  getAutoConfig,
  saveAutoConfig,
  setAutoEnabled,
} from '../accounts/repo.js';
import { getFarmProfile } from '../accounts/farmProfileRepo.js';
import { DEFAULT_SEED_CATALOG } from '../accounts/defaultSeedCatalog.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import {
  idleFindNpcRuntime,
  type AutomationSnapshot,
  type AutomationStartOutcome,
  type LoadedAutomationIntent,
} from './automationTypes.js';
import { BOOTSTRAP_STAGGER_MS, SessionManager } from './manager.js';

/** `AvatarSession` giả — ghi lại lời gọi, không mở socket. */
class FakeSession {
  started = 0;
  stopped = 0;
  desiredConnected = false;
  startedConfig: unknown;
  private intent: LoadedAutomationIntent = {
    desiredMode: 'off',
    findNpcConfig: { revision: 0, config: { npcName: '' } },
    location: null,
  };
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {
    this.started += 1;
    this.desiredConnected = true;
    this.startedConfig = (await this.opts.loadCredentials()).autoConfig;
  }
  stop() {
    this.stopped += 1;
    this.desiredConnected = false;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online' };
  }
  async switchAutomationMode(intent: LoadedAutomationIntent): Promise<AutomationStartOutcome> {
    this.intent = intent;
    this.started += 1;
    this.desiredConnected = intent.desiredMode !== 'off';
    this.startedConfig = (await this.opts.loadCredentials()).autoConfig;
    return 'active';
  }
  automationSnapshot(): AutomationSnapshot {
    return {
      desiredMode: this.intent.desiredMode,
      activeMode: this.intent.desiredMode,
      transitionState: 'stable',
      findNpcConfig: this.intent.findNpcConfig,
      findNpcRuntime: idleFindNpcRuntime(this.intent.findNpcConfig.config.npcName),
      location: this.intent.location,
    };
  }
  async stopAutomation(): Promise<void> {
    this.intent = { ...this.intent, desiredMode: 'off' };
  }
}

function setup(
  maxSessions = 20,
  observeBroadcast?: (
    db: ReturnType<typeof newTestDb>,
    accountId: number,
    type: string,
    payload: unknown,
  ) => void,
) {
  const db = newTestDb();
  const user = createUser(db, 'a@b.c', 'h', 0);
  const made: FakeSession[] = [];
  const sent: Array<{ userId: number; accountId: number; type: string; payload: unknown }> = [];
  const timers: Array<{ fn: () => void; delay: number }> = [];

  const manager = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions,
    broadcast: (userId, accountId, type, payload) => {
      observeBroadcast?.(db, accountId, type, payload);
      sent.push({ userId, accountId, type, payload });
    },
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
  assert.equal(saveAutoConfig(db, acc.userId, acc.id, 0, { harvest: true }).status, 'saved');
  setAutoEnabled(db, acc.id, true);
  const creds = await made[0].opts.loadCredentials();
  assert.equal(creds.autoEnabled, true);
  assert.deepEqual(creds.autoConfig, { harvest: true, autoHarvestCook: true });
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
  assert.deepEqual(sent, [{ userId: user.id, accountId: acc.id, type: 'status', payload: 'online' }]);
  db.close();
});

test('permanent failure chỉ tắt cờ, giữ config envelope', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  assert.equal(saveAutoConfig(db, acc.userId, acc.id, 0, {
    harvest: true,
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  }).status, 'saved');
  setAutoEnabled(db, acc.id, true);
  await manager.connect(acc.id);
  made[0].opts.onPermanentFailure('đăng nhập thất bại');
  assert.equal(getAccountById(db, acc.id)!.autoEnabled, false);
  assert.deepEqual(getAutoConfig(db, acc.userId, acc.id), {
    revision: 1,
    config: {
      harvest: true,
      treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
      autoHarvestCook: true,
    },
  });
  db.close();
});

test('manager ghi cache trước khi broadcast farm và không ghi đè catalog khi nhận trees', async () => {
  const observed: unknown[] = [];
  const { db, manager, made, newAccount } = setup(
    20,
    (currentDb, accountId, type, payload) => {
      const profile = getFarmProfile(currentDb, accountId);
      observed.push({
        type,
        payload,
        profile: {
          farmId: profile.farmId,
          cellIndices: profile.cellIndices,
          seedCatalog: profile.seedCatalog,
        },
      });
    },
  );
  const acc = newAccount('x');
  await manager.connect(acc.id);

  const farm = {
    idFarm: 12,
    cells: [{ index: 7, idTree: -1 }, { index: 2, idTree: 6 }],
    animals: [],
    updatedAt: 100,
  };
  made[0].opts.onEvent('farm', farm);
  const trees = {
    trees: [{
      id: 6,
      name: 'Lúa',
      growMinutes: 48,
      value: 20,
      stageImages: [1, 2, 3],
      attrsHex: 'abcd',
    }],
    items: [{ id: 100, name: 'Nước' }],
    animals: [{ id: 50, name: 'Gà' }],
  };
  made[0].opts.onEvent('trees', trees);

  assert.deepEqual(observed, [
    {
      type: 'farm',
      payload: farm,
      profile: {
        farmId: 12,
        cellIndices: [2, 7],
        seedCatalog: DEFAULT_SEED_CATALOG,
      },
    },
    {
      type: 'trees',
      payload: trees,
      profile: {
        farmId: 12,
        cellIndices: [2, 7],
        seedCatalog: DEFAULT_SEED_CATALOG,
      },
    },
  ]);
  db.close();
});

test('payload profile lỗi bị bỏ qua nhưng vẫn broadcast', async () => {
  const { db, manager, made, sent, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);

  assert.doesNotThrow(() => made[0].opts.onEvent('farm', { idFarm: '12', cells: null }));
  assert.deepEqual(getFarmProfile(db, acc.id).cellIndices, []);
  assert.equal(sent.at(-1)?.type, 'farm');
  db.close();
});

test('persistence lỗi với payload hợp lệ thì không broadcast và không ném', async () => {
  const { db, manager, made, sent, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  const before = sent.length;
  db.close();

  assert.doesNotThrow(() => made[0].opts.onEvent('farm', {
    idFarm: 12,
    cells: [{ index: 2 }],
    animals: [],
    updatedAt: 100,
  }));
  assert.equal(sent.length, before);
});

test('bootstrap unwrap envelope và giữ nguyên treeCellPlan khi start auto', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  assert.equal(saveAutoConfig(db, acc.userId, acc.id, 0, {
    harvest: false,
    treeCellPlan: [
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'skip' },
    ],
  }).status, 'saved');
  setAutoEnabled(db, acc.id, true);

  await manager.bootstrap();

  assert.deepEqual(made[0].startedConfig, {
    harvest: false,
    treeCellPlan: [
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'skip' },
    ],
    autoHarvestCook: true,
  });
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
