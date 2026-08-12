import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser } from './users.js';
import { createSession, SESSION_TTL_MS } from './sessions.js';
import { authenticateCookieHeader, parseCookies, SESSION_COOKIE } from './middleware.js';

test('parseCookies tách đúng nhiều cookie', () => {
  assert.deepEqual(parseCookies('sid=abc; theme=dark'), { sid: 'abc', theme: 'dark' });
});

test('parseCookies giải mã giá trị và chịu được header rỗng', () => {
  assert.deepEqual(parseCookies('sid=a%2Fb'), { sid: 'a/b' });
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(''), {});
});

test('cookie hợp lệ trả về người dùng', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id);
  assert.deepEqual(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`), {
    id: u.id,
    email: 'a@b.c',
  });
  db.close();
});

test('không cookie, cookie rác, hoặc phiên hết hạn đều trả null', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id, 0);
  assert.equal(authenticateCookieHeader(db, undefined), null);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=rác`), null);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`, SESSION_TTL_MS + 1), null);
  db.close();
});

test('phiên còn sống nhưng user đã bị xoá thì trả null', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`), null);
  db.close();
});
