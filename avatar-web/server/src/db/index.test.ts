import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';

test('tạo đủ bảng, gồm cache farm profile', () => {
  const db = newTestDb();
  const names = db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);
  for (const t of ['users', 'web_sessions', 'avatar_accounts', 'avatar_farm_profile_cache']) {
    assert.ok(names.includes(t), `thiếu bảng ${t}`);
  }
  db.close();
});

test('cache farm profile có FK xoá theo account', () => {
  const db = newTestDb();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (1, ?, ?, 0)').run(
    'profile@b.c',
    'h',
  );
  db.prepare(
    `INSERT INTO avatar_accounts
       (id, user_id, label, game_user, game_pass_enc, host, port, created_at, updated_at)
     VALUES (4, 1, 'nhãn', 'u', 'enc', 'h', 19129, 0, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO avatar_farm_profile_cache
       (account_id, farm_id, cell_indices_json, cells_observed_at, updated_at)
     VALUES (4, 12, '[2,7]', 100, 100)`,
  ).run();

  db.prepare('DELETE FROM avatar_accounts WHERE id = 4').run();

  const row = db
    .prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM avatar_farm_profile_cache')
    .get();
  assert.equal(row!.n, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  db.close();
});

test('bật ràng buộc khoá ngoại', () => {
  const db = newTestDb();
  const [{ foreign_keys: on }] = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
  assert.equal(on, 1);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO avatar_accounts
             (user_id, label, game_user, game_pass_enc, host, port, created_at, updated_at)
           VALUES (999, 'a', 'b', 'c', 'h', 1, 0, 0)`,
        )
        .run(),
    /FOREIGN KEY/,
  );
  db.close();
});

test('xoá user thì xoá luôn phiên web và tài khoản avatar', () => {
  const db = newTestDb();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (1, ?, ?, 0)').run(
    'a@b.c',
    'h',
  );
  db.prepare('INSERT INTO web_sessions (id_hash, user_id, created_at, expires_at) VALUES (?,1,0,0)').run(
    'hash',
  );
  db.prepare(
    `INSERT INTO avatar_accounts
       (user_id, label, game_user, game_pass_enc, host, port, created_at, updated_at)
     VALUES (1, 'nhãn', 'u', 'enc', 'h', 19129, 0, 0)`,
  ).run();

  db.prepare('DELETE FROM users WHERE id = 1').run();

  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM web_sessions').get()!.n, 0);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM avatar_accounts').get()!.n, 0);
  db.close();
});

test('email trùng bị chặn', () => {
  const db = newTestDb();
  const ins = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, 0)');
  ins.run('a@b.c', 'h');
  assert.throws(() => ins.run('a@b.c', 'h2'), /UNIQUE/);
  db.close();
});

test('chạy migration hai lần không lỗi', () => {
  const db = newTestDb();
  assert.doesNotThrow(() => newTestDb());
  db.close();
});
