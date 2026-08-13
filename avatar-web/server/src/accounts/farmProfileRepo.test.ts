import assert from 'node:assert/strict';
import test from 'node:test';

import { createUser } from '../auth/users.js';
import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createAccount } from './repo.js';
import {
  deleteFarmProfile,
  getFarmProfile,
  updateFarmCells,
  updateSeedCatalog,
} from './farmProfileRepo.js';

function setupAccount() {
  const db = newTestDb();
  const user = createUser(db, 'profile@b.c', 'h', 0);
  const account = createAccount(db, TEST_KEY, {
    userId: user.id,
    label: 'profile',
    gameUser: 'nguoi-choi',
    gamePass: 'p',
  });
  return { db, account };
}

test('profile chưa được cache trả object rỗng có kiểu ổn định', () => {
  const { db, account } = setupAccount();
  assert.deepEqual(getFarmProfile(db, account.id), {
    farmId: null,
    cellIndices: [],
    seedCatalog: [],
    cellsObservedAt: null,
    seedsObservedAt: null,
    updatedAt: null,
  });
  db.close();
});

test('cell và catalog upsert từng phần không xóa nhau', () => {
  const { db, account } = setupAccount();
  updateFarmCells(db, account.id, 12, [7, 2, 7], 100);
  updateSeedCatalog(db, account.id, [
    { id: 6, name: 'Hoa hồng', growMinutes: 5, value: 10 },
  ], 200);

  assert.deepEqual(getFarmProfile(db, account.id), {
    farmId: 12,
    cellIndices: [2, 7],
    seedCatalog: [{ id: 6, name: 'Hoa hồng', growMinutes: 5, value: 10 }],
    cellsObservedAt: 100,
    seedsObservedAt: 200,
    updatedAt: 200,
  });
  db.close();
});

test('catalog unique theo id và sắp tên theo locale rồi id', () => {
  const { db, account } = setupAccount();
  updateSeedCatalog(db, account.id, [
    { id: 9, name: 'Sen', growMinutes: 8, value: 20 },
    { id: 7, name: 'Hồng', growMinutes: 4, value: 12 },
    { id: 6, name: 'Hồng', growMinutes: 5, value: 10 },
    { id: 9, name: 'Cúc', growMinutes: 3, value: 8 },
  ], 50);

  assert.deepEqual(getFarmProfile(db, account.id).seedCatalog, [
    { id: 9, name: 'Cúc', growMinutes: 3, value: 8 },
    { id: 6, name: 'Hồng', growMinutes: 5, value: 10 },
    { id: 7, name: 'Hồng', growMinutes: 4, value: 12 },
  ]);
  db.close();
});

test('reject cell index không phải số nguyên không âm mà không làm mất cache cũ', () => {
  const { db, account } = setupAccount();
  updateFarmCells(db, account.id, 12, [2], 100);
  assert.throws(() => updateFarmCells(db, account.id, 13, [-1, 3.5], 200), /cell index/);
  assert.deepEqual(getFarmProfile(db, account.id).cellIndices, [2]);
  db.close();
});

test('xóa profile là idempotent và trả về profile rỗng', () => {
  const { db, account } = setupAccount();
  updateFarmCells(db, account.id, 12, [2], 100);
  deleteFarmProfile(db, account.id);
  deleteFarmProfile(db, account.id);
  assert.deepEqual(getFarmProfile(db, account.id).cellIndices, []);
  db.close();
});
