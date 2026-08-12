import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser, findUserByEmail, findUserById, normalizeEmail } from './users.js';

test('normalizeEmail hạ chữ và cắt khoảng trắng', () => {
  assert.equal(normalizeEmail('  Ai@Bee.Com  '), 'ai@bee.com');
});

test('tạo rồi tra lại được theo email và id', () => {
  const db = newTestDb();
  const u = createUser(db, 'Ai@Bee.Com', 'hash', 1000);
  assert.equal(u.email, 'ai@bee.com');
  assert.equal(u.createdAt, 1000);
  assert.deepEqual(findUserByEmail(db, ' AI@BEE.COM '), u);
  assert.deepEqual(findUserById(db, u.id), u);
  db.close();
});

test('email không tồn tại trả null', () => {
  const db = newTestDb();
  assert.equal(findUserByEmail(db, 'khong@co.com'), null);
  assert.equal(findUserById(db, 12345), null);
  db.close();
});

test('email trùng (khác hoa thường) bị chặn', () => {
  const db = newTestDb();
  createUser(db, 'ai@bee.com', 'h', 0);
  assert.throws(() => createUser(db, 'AI@BEE.COM', 'h2', 0), /UNIQUE/);
  db.close();
});
