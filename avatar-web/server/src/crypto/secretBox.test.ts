import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { encryptSecret, decryptSecret } from './secretBox.js';

const key = crypto.randomBytes(32);

test('khứ hồi trả lại đúng chuỗi gốc', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.notEqual(boxed, 'mat-khau-game');
  assert.equal(decryptSecret(key, '7', boxed), 'mat-khau-game');
});

test('bản mã có tiền tố phiên bản v1 và 4 phần', () => {
  const boxed = encryptSecret(key, '7', 'abc');
  const parts = boxed.split(':');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'v1');
});

test('mỗi lần mã hoá dùng IV khác nhau', () => {
  assert.notEqual(encryptSecret(key, '7', 'abc'), encryptSecret(key, '7', 'abc'));
});

test('đổi AAD (chép bản mã sang account khác) thì giải mã thất bại', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.throws(() => decryptSecret(key, '8', boxed));
});

test('sai khoá thì giải mã thất bại', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.throws(() => decryptSecret(crypto.randomBytes(32), '7', boxed));
});

test('bản mã bị sửa một byte thì giải mã thất bại', () => {
  const [v, iv, tag, ct] = encryptSecret(key, '7', 'mat-khau-game').split(':');
  const buf = Buffer.from(ct, 'base64');
  buf[0] ^= 0xff;
  assert.throws(() => decryptSecret(key, '7', [v, iv, tag, buf.toString('base64')].join(':')));
});

test('định dạng lạ thì ném lỗi rõ ràng', () => {
  assert.throws(() => decryptSecret(key, '7', 'v2:a:b:c'), /không nhận ra/);
  assert.throws(() => decryptSecret(key, '7', 'rác'), /không nhận ra/);
});
