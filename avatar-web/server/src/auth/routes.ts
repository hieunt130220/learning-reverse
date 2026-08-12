import crypto from 'node:crypto';
import { Router } from 'express';

import type { Db } from '../db/index.js';
import {
  clearSessionCookie,
  makeRequireAuth,
  parseCookies,
  SESSION_COOKIE,
  setSessionCookie,
  type AuthedRequest,
} from './middleware.js';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyDummy, verifyPassword } from './password.js';
import { createRateLimiter } from './rateLimit.js';
import { createSession, destroySession } from './sessions.js';
import { createUser, findUserByEmail, normalizeEmail } from './users.js';

export interface AuthDeps {
  db: Db;
  inviteCode: string;
  isProduction: boolean;
}

const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** So sánh bằng thời gian hằng — mã mời là bí mật, đừng để lộ qua thời gian. */
function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function authRouter(deps: AuthDeps): Router {
  const { db, inviteCode, isProduction } = deps;
  const router = Router();
  const limiter = createRateLimiter({ max: LOGIN_MAX, windowMs: LOGIN_WINDOW_MS });
  const requireAuth = makeRequireAuth(db, isProduction);

  router.post('/register', async (req, res) => {
    const { email, password, inviteCode: sent } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof sent !== 'string') {
      return res.status(400).json({ error: 'thiếu email, mật khẩu hoặc mã mời' });
    }
    if (!sameSecret(sent, inviteCode)) return res.status(403).json({ error: 'mã mời không đúng' });
    if (!normalizeEmail(email).includes('@')) {
      return res.status(400).json({ error: 'email không hợp lệ' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    if (findUserByEmail(db, email)) return res.status(409).json({ error: 'email đã được dùng' });

    const user = createUser(db, email, await hashPassword(password));
    setSessionCookie(res, createSession(db, user.id), isProduction);
    res.json({ id: user.id, email: user.email });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'thiếu email hoặc mật khẩu' });
    }

    // Đếm theo cả IP lẫn email: chỉ theo IP thì một botnet vẫn dò được một tài
    // khoản, chỉ theo email thì một IP vẫn quét được cả danh sách email.
    const ipKey = `ip:${req.ip ?? 'unknown'}`;
    const emailKey = `email:${normalizeEmail(email)}`;
    if (!limiter.hit(ipKey) || !limiter.hit(emailKey)) {
      return res.status(429).json({ error: 'thử quá nhiều lần, đợi 15 phút' });
    }

    const user = findUserByEmail(db, email);
    if (!user) {
      // Verify giả để thời gian phản hồi không tiết lộ email nào có thật.
      await verifyDummy(password);
      return res.status(401).json({ error: 'email hoặc mật khẩu không đúng' });
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'email hoặc mật khẩu không đúng' });
    }

    limiter.reset(ipKey);
    limiter.reset(emailKey);
    setSessionCookie(res, createSession(db, user.id), isProduction);
    res.json({ id: user.id, email: user.email });
  });

  router.post('/logout', (req, res) => {
    const rawId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (rawId) destroySession(db, rawId);
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json((req as AuthedRequest).user);
  });

  return router;
}
