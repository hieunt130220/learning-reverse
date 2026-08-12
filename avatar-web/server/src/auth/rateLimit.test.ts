import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter } from './rateLimit.js';

test('cho qua đúng `max` lần rồi chặn', () => {
  const rl = createRateLimiter({ max: 3, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('a', 1), true);
  assert.equal(rl.hit('a', 2), true);
  assert.equal(rl.hit('a', 3), false);
});

test('các khoá khác nhau đếm riêng', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('b', 0), true);
  assert.equal(rl.hit('a', 0), false);
});

test('hết cửa sổ thì đếm lại từ đầu', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('a', 999), false);
  assert.equal(rl.hit('a', 1000), true);
});

test('reset xoá bộ đếm (dùng sau khi đăng nhập thành công)', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  rl.hit('a', 0);
  rl.reset('a');
  assert.equal(rl.hit('a', 0), true);
});

test('không giữ khoá đã hết hạn mãi trong RAM', () => {
  const rl = createRateLimiter({ max: 5, windowMs: 1000 });
  for (let i = 0; i < 100; i += 1) rl.hit(`ip-${i}`, 0);
  rl.hit('mới', 10_000);
  assert.equal(rl.size(), 1);
});
