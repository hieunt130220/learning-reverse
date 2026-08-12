import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountById,
  listAccounts,
  listAutoEnabled,
  readGamePass,
  setAutoEnabled,
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

test('setAutoEnabled ghi cờ và config, listAutoEnabled đọc lại đúng', () => {
  const { db, a, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  createAccount(db, TEST_KEY, { userId: b.id, label: 'y', gameUser: 'u', gamePass: 'p' });

  setAutoEnabled(db, acc.id, true, { harvest: true, intervalMs: 60000 });
  const on = listAutoEnabled(db);
  assert.equal(on.length, 1);
  assert.equal(on[0].id, acc.id);
  assert.deepEqual(on[0].autoConfig, { harvest: true, intervalMs: 60000 });

  setAutoEnabled(db, acc.id, false, null);
  assert.equal(listAutoEnabled(db).length, 0);
  assert.equal(getAccount(db, a.id, acc.id)!.autoEnabled, false);
  db.close();
});

test('getAccountById không lọc theo user — dùng cho bootstrap', () => {
  const { db, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: b.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.equal(getAccountById(db, acc.id)!.userId, b.id);
  assert.equal(getAccountById(db, 999), null);
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
