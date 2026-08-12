import type { Db } from '../db/index.js';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: number;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

/** Chuẩn hoá trước khi ghi VÀ trước khi tra, nếu không thì UNIQUE vô nghĩa. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function createUser(db: Db, email: string, passwordHash: string, now = Date.now()): User {
  const normalized = normalizeEmail(email);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(normalized, passwordHash, now);
  return { id: Number(info.lastInsertRowid), email: normalized, passwordHash, createdAt: now };
}

export function findUserByEmail(db: Db, email: string): User | null {
  const row = db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email));
  return row ? toUser(row) : null;
}

export function findUserById(db: Db, id: number): User | null {
  const row = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(id);
  return row ? toUser(row) : null;
}
