import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser } from './users.js';
import {
  SESSION_TTL_MS,
  createSession,
  destroySession,
  hashSessionId,
  lookupSession,
  purgeExpiredSessions,
  renewSession,
} from './sessions.js';

function setup() {
  const db = newTestDb();
  const user = createUser(db, 'a@b.c', 'hash', 0);
  return { db, user };
}

test('tạo rồi tra lại được', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 1000);
  const found = lookupSession(db, raw, 2000);
  assert.deepEqual(found, { userId: user.id, expiresAt: 1000 + SESSION_TTL_MS });
  db.close();
});

test('DB chỉ chứa hash, không chứa id gốc', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  const rows = db.prepare<[], { id_hash: string }>('SELECT id_hash FROM web_sessions').all();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id_hash, raw);
  assert.equal(rows[0].id_hash, hashSessionId(raw));
  db.close();
});

test('id phiên đủ dài và là base64url', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.ok(raw.length >= 43, `id quá ngắn: ${raw.length}`);
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  db.close();
});

test('phiên hết hạn trả null và bị xoá khỏi DB', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.equal(lookupSession(db, raw, SESSION_TTL_MS + 1), null);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM web_sessions').get()!.n, 0);
  db.close();
});

test('id không tồn tại trả null', () => {
  const { db } = setup();
  assert.equal(lookupSession(db, 'khong-co-that', 0), null);
  db.close();
});

test('gia hạn khi còn dưới nửa thời hạn', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  const late = SESSION_TTL_MS / 2 + 1000;
  const next = renewSession(db, raw, late);
  assert.equal(next, late + SESSION_TTL_MS);
  assert.equal(lookupSession(db, raw, late)!.expiresAt, late + SESSION_TTL_MS);
  db.close();
});

test('không gia hạn khi còn trên nửa thời hạn', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.equal(renewSession(db, raw, 1000), null);
  assert.equal(lookupSession(db, raw, 1000)!.expiresAt, SESSION_TTL_MS);
  db.close();
});

test('xoá phiên thì tra không ra nữa', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  destroySession(db, raw);
  assert.equal(lookupSession(db, raw, 0), null);
  db.close();
});

test('purge dọn đúng những phiên đã hết hạn', () => {
  const { db, user } = setup();
  createSession(db, user.id, 0);
  const fresh = createSession(db, user.id, SESSION_TTL_MS);
  assert.equal(purgeExpiredSessions(db, SESSION_TTL_MS + 1), 1);
  assert.ok(lookupSession(db, fresh, SESSION_TTL_MS + 1));
  db.close();
});
