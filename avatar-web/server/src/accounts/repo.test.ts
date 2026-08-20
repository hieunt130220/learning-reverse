import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import { getFarmProfile, updateFarmCells } from './farmProfileRepo.js';
import {
  createAccount,
  deleteAccount,
  enableAutoWithConfigPatch,
  getAccount,
  getAccountById,
  getAutoConfig,
  listAccounts,
  listAutoEnabled,
  readGamePass,
  saveAutoConfig,
  setAutoEnabled,
  updateCachedMetrics,
  updateAccount,
} from './repo.js';

function setup() {
  const db = newTestDb();
  const a = createUser(db, 'a@b.c', 'h', 0);
  const b = createUser(db, 'b@b.c', 'h', 0);
  return { db, a, b };
}

test('tạo tài khoản, mặc định host/port từ config', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'chính',
    gameUser: 'NguoiChoi',
    gamePass: 'bimat',
  });
  assert.equal(acc.label, 'chính');
  assert.equal(acc.gameUser, 'NguoiChoi');
  assert.equal(acc.host, DEFAULT_GAME_SERVER.host);
  assert.equal(acc.port, DEFAULT_GAME_SERVER.port);
  assert.equal(acc.autoEnabled, false);
  assert.equal(acc.hasPassword, true);
  db.close();
});

test('bản ghi trả ra không chứa mật khẩu ở bất kỳ dạng nào', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'bimat',
  });
  const json = JSON.stringify(acc);
  assert.ok(!json.includes('bimat'));
  assert.ok(!json.includes('v1:'));
  assert.ok(!('gamePass' in acc));
  assert.ok(!('gamePassEnc' in acc));
  db.close();
});

test('mật khẩu giải mã lại được', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'bimat',
  });
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'bimat');
  db.close();
});

test('AAD buộc theo id: chép bản mã sang bản ghi khác thì đọc không ra', () => {
  const { db, a } = setup();
  const one = createAccount(db, TEST_KEY, { userId: a.id, label: '1', gameUser: 'u', gamePass: 'p1' });
  const two = createAccount(db, TEST_KEY, { userId: a.id, label: '2', gameUser: 'u', gamePass: 'p2' });
  const stolen = db
    .prepare<[number], { game_pass_enc: string }>('SELECT game_pass_enc FROM avatar_accounts WHERE id = ?')
    .get(one.id)!.game_pass_enc;
  db.prepare('UPDATE avatar_accounts SET game_pass_enc = ? WHERE id = ?').run(stolen, two.id);
  assert.throws(() => readGamePass(db, TEST_KEY, two.id));
  db.close();
});

test('danh sách chỉ trả tài khoản của chính chủ', () => {
  const { db, a, b } = setup();
  createAccount(db, TEST_KEY, { userId: a.id, label: 'của A', gameUser: 'ua', gamePass: 'p' });
  createAccount(db, TEST_KEY, { userId: b.id, label: 'của B', gameUser: 'ub', gamePass: 'p' });
  assert.deepEqual(listAccounts(db, a.id).map((x) => x.label), ['của A']);
  assert.deepEqual(listAccounts(db, b.id).map((x) => x.label), ['của B']);
  db.close();
});

test('user A không đọc/sửa/xoá được tài khoản của user B', () => {
  const { db, a, b } = setup();
  const accB = createAccount(db, TEST_KEY, { userId: b.id, label: 'của B', gameUser: 'ub', gamePass: 'p' });
  assert.equal(getAccount(db, a.id, accB.id), null);
  assert.equal(updateAccount(db, TEST_KEY, a.id, accB.id, { label: 'chiếm' }), null);
  assert.equal(deleteAccount(db, a.id, accB.id), false);
  assert.equal(getAccount(db, b.id, accB.id)!.label, 'của B');
  db.close();
});

test('sửa: gửi gamePass thì đổi, bỏ trống thì giữ nguyên', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'cu' });
  updateAccount(db, TEST_KEY, a.id, acc.id, { label: 'mới' });
  assert.equal(getAccount(db, a.id, acc.id)!.label, 'mới');
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'cu');

  updateAccount(db, TEST_KEY, a.id, acc.id, { gamePass: 'moi' });
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'moi');
  db.close();
});

test('device lưu và đọc lại đúng', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'p',
    device: { agent: 'abc', model: 'Pixel' },
  });
  assert.deepEqual(getAccount(db, a.id, acc.id)!.device, { agent: 'abc', model: 'Pixel' });
  updateAccount(db, TEST_KEY, a.id, acc.id, { device: null });
  assert.equal(getAccount(db, a.id, acc.id)!.device, undefined);
  db.close();
});

test('config null được chuẩn hóa và account không lộ envelope raw', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.deepEqual(getAutoConfig(db, a.id, acc.id), { revision: 0, config: {} });
  assert.deepEqual(acc.autoConfig, {});
  assert.equal(acc.autoConfigRevision, 0);

  db.prepare('UPDATE avatar_accounts SET auto_config_json = ? WHERE id = ?').run(
    JSON.stringify({ version: 1, revision: 3, config: { harvest: true } }),
    acc.id,
  );
  const reread = getAccount(db, a.id, acc.id)!;
  assert.deepEqual(reread.autoConfig, { harvest: true, autoHarvestCook: true });
  assert.equal(reread.autoConfigRevision, 3);
  assert.equal('version' in reread.autoConfig, false);
  db.close();
});

test('đọc config JSON legacy với revision 0 và save CAS ghi envelope revision kế', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  db.prepare('UPDATE avatar_accounts SET auto_config_json = ? WHERE id = ?').run(
    JSON.stringify({ harvest: true }),
    acc.id,
  );
  assert.deepEqual(getAutoConfig(db, a.id, acc.id), {
    revision: 0,
    config: { harvest: true, autoHarvestCook: true },
  });

  const saved = saveAutoConfig(db, a.id, acc.id, 0, { harvest: false }, 10);
  assert.deepEqual(saved, {
    status: 'saved',
    state: { revision: 1, config: { harvest: false, autoHarvestCook: true } },
  });
  const raw = db
    .prepare<[number], { auto_config_json: string }>(
      'SELECT auto_config_json FROM avatar_accounts WHERE id = ?',
    )
    .get(acc.id)!;
  assert.deepEqual(JSON.parse(raw.auto_config_json), {
    version: 1,
    revision: 1,
    config: { harvest: false, autoHarvestCook: true },
  });
  db.close();
});

test('CAS config phát hiện revision xung đột và ownership/missing', () => {
  const { db, a, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  const first = saveAutoConfig(db, a.id, acc.id, 0, { harvest: true }, 10);
  assert.equal(first.status, 'saved');
  assert.equal(first.status === 'saved' && first.state.revision, 1);

  const stale = saveAutoConfig(db, a.id, acc.id, 0, { harvest: false }, 11);
  assert.deepEqual(stale, {
    status: 'conflict',
    current: { revision: 1, config: { harvest: true, autoHarvestCook: true } },
  });
  assert.equal(getAutoConfig(db, b.id, acc.id), null);
  assert.deepEqual(saveAutoConfig(db, b.id, acc.id, 1, {}, 12), { status: 'missing' });
  db.close();
});

test('setAutoEnabled chỉ đổi cờ, giữ config và revision', () => {
  const { db, a, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  createAccount(db, TEST_KEY, { userId: b.id, label: 'y', gameUser: 'u', gamePass: 'p' });
  assert.equal(saveAutoConfig(db, a.id, acc.id, 0, { harvest: true, intervalMs: 60000 }).status, 'saved');

  setAutoEnabled(db, acc.id, true, 20);
  const on = listAutoEnabled(db);
  assert.equal(on.length, 1);
  assert.equal(on[0].id, acc.id);
  assert.deepEqual(on[0].autoConfig, { harvest: true, intervalMs: 60000, autoHarvestCook: true });
  assert.equal(on[0].autoConfigRevision, 1);

  setAutoEnabled(db, acc.id, false, 30);
  assert.equal(listAutoEnabled(db).length, 0);
  assert.equal(getAccount(db, a.id, acc.id)!.autoEnabled, false);
  assert.deepEqual(getAutoConfig(db, a.id, acc.id), {
    revision: 1,
    config: { harvest: true, intervalMs: 60000, autoHarvestCook: true },
  });
  db.close();
});

test('legacy start merge config, tăng revision và bật auto cùng transaction', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  saveAutoConfig(db, a.id, acc.id, 0, {
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  });

  const result = enableAutoWithConfigPatch(
    db,
    a.id,
    acc.id,
    { harvest: false },
    { cellIndices: [2], seedIds: [] },
    50,
  );
  assert.deepEqual(result, {
    status: 'saved',
    state: {
      revision: 2,
      config: {
        autoHarvestCook: true,
        harvest: false,
        treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
      },
    },
  });
  assert.equal(getAccount(db, a.id, acc.id)!.autoEnabled, true);
  db.close();
});

test('legacy start reject plan không hợp lệ và rollback revision lẫn cờ auto', () => {
  const cases = [
    {
      profile: null,
      patch: { treeCellPlan: [{ cellIndex: 50, action: 'skip' }] },
      code: 'invalid-tree-cell-plan',
    },
    {
      profile: { cellIndices: [2], seedIds: [] },
      patch: { treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 9999 }] },
      code: 'invalid-tree-cell-plan',
    },
  ] as const;

  for (const item of cases) {
    const { db, a } = setup();
    const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
    assert.throws(
      () => enableAutoWithConfigPatch(db, a.id, acc.id, item.patch, item.profile, 100),
      (error: unknown) =>
        error instanceof Error
        && 'code' in error
        && error.code === item.code,
    );
    assert.deepEqual(getAutoConfig(db, a.id, acc.id), { revision: 0, config: {} });
    assert.equal(getAccount(db, a.id, acc.id)!.autoEnabled, false);
    db.close();
  }
});

test('profile có cell nhưng chưa có catalog chấp nhận plan rỗng hoặc chỉ skip', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  const skip = enableAutoWithConfigPatch(
    db,
    a.id,
    acc.id,
    { treeCellPlan: [{ cellIndex: 2, action: 'skip' }] },
    { cellIndices: [2], seedIds: [] },
  );
  assert.equal(skip.status, 'saved');
  setAutoEnabled(db, acc.id, false);
  const empty = enableAutoWithConfigPatch(
    db,
    a.id,
    acc.id,
    { treeCellPlan: [] },
    { cellIndices: [2], seedIds: [] },
  );
  assert.equal(empty.status, 'saved');
  db.close();
});

test('đổi gameUser xóa riêng profile trong transaction và giữ config/password', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  saveAutoConfig(db, a.id, acc.id, 0, {
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  });
  updateFarmCells(db, acc.id, 1, [2]);
  updateAccount(db, TEST_KEY, a.id, acc.id, { gameUser: ' nhan-vat-moi ' });

  assert.equal(getAccount(db, a.id, acc.id)!.gameUser, 'nhan-vat-moi');
  assert.deepEqual(getFarmProfile(db, acc.id).cellIndices, []);
  assert.deepEqual(getAutoConfig(db, a.id, acc.id)?.config.treeCellPlan, [
    { cellIndex: 2, action: 'skip' },
  ]);
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'p');
  db.close();
});

test('gameUser hiện tại có whitespace nhưng sau chuẩn hóa không đổi thì giữ farm profile', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  db.prepare('UPDATE avatar_accounts SET game_user = ? WHERE id = ?').run(' u ', acc.id);
  updateFarmCells(db, acc.id, 1, [2]);
  updateAccount(db, TEST_KEY, a.id, acc.id, { gameUser: 'u' });
  assert.equal(getAccount(db, a.id, acc.id)!.gameUser, 'u');
  assert.deepEqual(getFarmProfile(db, acc.id).cellIndices, [2]);
  db.close();
});

test('getAccountById không lọc theo user — dùng cho bootstrap', () => {
  const { db, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: b.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.equal(getAccountById(db, acc.id)!.userId, b.id);
  assert.equal(getAccountById(db, 999), null);
  db.close();
});

test('lưu và đọc cached metrics sau khi session ngắt', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  updateCachedMetrics(db, acc.id, { xu: 1200, luong: 35, luongKhoa: 10, playerLevel: 7, farmLevel: 4 }, 123);
  assert.deepEqual(getAccountById(db, acc.id)!.cachedMetrics, {
    xu: 1200,
    luong: 35,
    luongKhoa: 10,
    playerLevel: 7,
    farmLevel: 4,
    syncedAt: 123,
  });
  db.close();
});

test('xoá rồi thì không còn trong danh sách', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.equal(deleteAccount(db, a.id, acc.id), true);
  assert.equal(listAccounts(db, a.id).length, 0);
  assert.equal(deleteAccount(db, a.id, acc.id), false);
  db.close();
});
