import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword, verifyDummy, MIN_PASSWORD_LENGTH } from './password.js';

test('hash rồi verify đúng mật khẩu', async () => {
  const h = await hashPassword('mat-khau-du-dai');
  assert.ok(h.startsWith('$argon2id$'));
  assert.equal(await verifyPassword(h, 'mat-khau-du-dai'), true);
});

test('sai mật khẩu thì verify trả false', async () => {
  const h = await hashPassword('mat-khau-du-dai');
  assert.equal(await verifyPassword(h, 'mat-khau-du-daj'), false);
});

test('hash cùng một mật khẩu hai lần ra hai chuỗi khác nhau', async () => {
  assert.notEqual(await hashPassword('mat-khau-du-dai'), await hashPassword('mat-khau-du-dai'));
});

test('hash hỏng thì verify trả false chứ không ném', async () => {
  assert.equal(await verifyPassword('không-phải-hash', 'x'), false);
});

test('verifyDummy chạy được và không ném', async () => {
  await verifyDummy('bất kỳ');
});

test('độ dài tối thiểu là 10', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10);
});
