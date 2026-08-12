import crypto from 'node:crypto';

import type { Db } from '../db/index.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface WebSession {
  userId: number;
  expiresAt: number;
}

/**
 * DB chỉ lưu hash. Đọc trộm được bảng `web_sessions` vẫn không mạo danh được ai —
 * cùng lý do người ta không lưu mật khẩu dạng rõ.
 */
export function hashSessionId(rawId: string): string {
  return crypto.createHash('sha256').update(rawId).digest('hex');
}

export function createSession(db: Db, userId: number, now = Date.now()): string {
  const rawId = crypto.randomBytes(32).toString('base64url');
  db.prepare(
    'INSERT INTO web_sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashSessionId(rawId), userId, now, now + SESSION_TTL_MS);
  return rawId;
}

export function lookupSession(db: Db, rawId: string, now = Date.now()): WebSession | null {
  const idHash = hashSessionId(rawId);
  const row = db
    .prepare<[string], { user_id: number; expires_at: number }>(
      'SELECT user_id, expires_at FROM web_sessions WHERE id_hash = ?',
    )
    .get(idHash);
  if (!row) return null;
  if (row.expires_at <= now) {
    db.prepare('DELETE FROM web_sessions WHERE id_hash = ?').run(idHash);
    return null;
  }
  return { userId: row.user_id, expiresAt: row.expires_at };
}

/**
 * Gia hạn khi thời gian còn lại xuống dưới một nửa. Ghi lại cookie mỗi request
 * là thừa; để phiên chết đúng lúc người dùng đang dùng là phiền.
 */
export function renewSession(db: Db, rawId: string, now = Date.now()): number | null {
  const session = lookupSession(db, rawId, now);
  if (!session) return null;
  if (session.expiresAt - now > SESSION_TTL_MS / 2) return null;
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('UPDATE web_sessions SET expires_at = ? WHERE id_hash = ?').run(
    expiresAt,
    hashSessionId(rawId),
  );
  return expiresAt;
}

export function destroySession(db: Db, rawId: string): void {
  db.prepare('DELETE FROM web_sessions WHERE id_hash = ?').run(hashSessionId(rawId));
}

/** Dọn rác lúc khởi động — phiên hết hạn không tự biến mất. */
export function purgeExpiredSessions(db: Db, now = Date.now()): number {
  return db.prepare('DELETE FROM web_sessions WHERE expires_at <= ?').run(now).changes;
}
