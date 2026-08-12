import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { loadConfig } from './config.js';

const KEY_B64 = crypto.randomBytes(32).toString('base64');

test('loadConfig đọc đủ biến bắt buộc', () => {
  const cfg = loadConfig({ MASTER_KEY: KEY_B64, INVITE_CODE: 'moi-vao' });
  assert.equal(cfg.masterKey.length, 32);
  assert.equal(cfg.inviteCode, 'moi-vao');
  assert.equal(cfg.port, 8787);
  assert.equal(cfg.maxSessions, 20);
  assert.equal(cfg.isProduction, false);
});

test('thiếu MASTER_KEY thì ném lỗi', () => {
  assert.throws(() => loadConfig({ INVITE_CODE: 'x' }), /MASTER_KEY/);
});

test('thiếu INVITE_CODE thì ném lỗi', () => {
  assert.throws(() => loadConfig({ MASTER_KEY: KEY_B64 }), /INVITE_CODE/);
});

test('MASTER_KEY không đủ 32 byte thì ném lỗi', () => {
  const short = crypto.randomBytes(16).toString('base64');
  assert.throws(() => loadConfig({ MASTER_KEY: short, INVITE_CODE: 'x' }), /32 byte/);
});

test('NODE_ENV=production bật isProduction', () => {
  const cfg = loadConfig({ MASTER_KEY: KEY_B64, INVITE_CODE: 'x', NODE_ENV: 'production' });
  assert.equal(cfg.isProduction, true);
});
