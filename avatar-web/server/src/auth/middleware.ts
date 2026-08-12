import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { Db } from '../db/index.js';
import { lookupSession, renewSession, SESSION_TTL_MS } from './sessions.js';
import { findUserById } from './users.js';

export const SESSION_COOKIE = 'sid';

export interface AuthUser {
  id: number;
  email: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/**
 * Tự tách cookie thay vì kéo thêm `cookie-parser`: cả ứng dụng đọc đúng một
 * cookie, và WebSocket cũng cần hàm này trên `req.headers.cookie` thô.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[name] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function setSessionCookie(res: Response, rawId: string, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE, rawId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  });
}

/**
 * Xác thực từ header cookie thô. Dùng chung cho REST và WebSocket — WS không đi
 * qua middleware của Express nhưng phải áp đúng một luật.
 */
export function authenticateCookieHeader(
  db: Db,
  header: string | undefined,
  now = Date.now(),
): AuthUser | null {
  const rawId = parseCookies(header)[SESSION_COOKIE];
  if (!rawId) return null;
  const session = lookupSession(db, rawId, now);
  if (!session) return null;
  const user = findUserById(db, session.userId);
  // Phiên mồ côi không nên tồn tại (khoá ngoại CASCADE), nhưng nếu có thì nó
  // không được tính là đã xác thực.
  return user ? { id: user.id, email: user.email } : null;
}

export function makeRequireAuth(db: Db, isProduction: boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.cookie;
    const user = authenticateCookieHeader(db, header);
    if (!user) return res.status(401).json({ error: 'chưa đăng nhập' });

    const rawId = parseCookies(header)[SESSION_COOKIE];
    if (renewSession(db, rawId) !== null) setSessionCookie(res, rawId, isProduction);

    (req as AuthedRequest).user = user;
    next();
  };
}
