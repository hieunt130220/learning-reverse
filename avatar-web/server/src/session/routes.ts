import { Router, type Response } from 'express';

import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import { setAutoEnabled } from '../accounts/repo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { Macro } from '../macro.js';
import type { SessionManager } from './manager.js';

export interface SessionRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
}

/**
 * "Chưa kết nối" là trạng thái hợp lệ của tài nguyên, không phải lỗi máy chủ —
 * 409 để UI phân biệt được với 500 (lệnh gửi đi rồi mà hỏng).
 */
function fail(res: Response, err: unknown): void {
  const message = (err as Error).message;
  res.status(message.includes('chưa kết nối') ? 409 : 500).json({ error: message });
}

export function sessionRouter(deps: SessionRoutesDeps): Router {
  const { db, isProduction, sessions } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));

  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown) => (req as AccountRequest).account!.id;

  router.post('/:id/connect', owned, async (req, res) => {
    try {
      await sessions.connect(accountId(req));
      res.json(sessions.snapshot(accountId(req)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/:id/disconnect', owned, (req, res) => {
    sessions.disconnect(accountId(req));
    res.json({ ok: true });
  });

  router.post('/:id/auto/start', owned, (req, res) => {
    const id = accountId(req);
    const cfg = (req.body ?? {}) as Partial<AutoFarmConfig>;
    // Ghi ý muốn vào DB TRƯỚC. Làm ngược lại thì restart giữa chừng là mất ý
    // muốn của người dùng, và bootstrap sẽ không bật lại tài khoản này.
    setAutoEnabled(db, id, true, cfg);
    try {
      sessions.require(id).startAuto(cfg);
      res.json(sessions.snapshot(id));
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/auto/stop', owned, (req, res) => {
    const id = accountId(req);
    setAutoEnabled(db, id, false, null);
    sessions.peek(id)?.stopAuto();
    res.json({ ok: true });
  });

  router.post('/:id/farm', owned, (req, res) => {
    const { name, args } = (req.body ?? {}) as { name?: string; args?: unknown[] };
    if (typeof name !== 'string') return res.status(400).json({ error: 'thiếu tên action' });
    try {
      sessions.require(accountId(req)).callFarm(name, args ?? []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/raw', owned, (req, res) => {
    const { cmd, fields } = (req.body ?? {}) as { cmd?: unknown; fields?: Array<{ t: string; v: string }> };
    try {
      sessions.require(accountId(req)).sendRaw(Number(cmd), fields ?? []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/enter-farm', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).enterFarm();
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/macro/start', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).startMacro(req.body as Macro);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/macro/stop', owned, (req, res) => {
    sessions.peek(accountId(req))?.stopMacro();
    res.json({ ok: true });
  });

  router.get('/:id/state', owned, (req, res) => {
    res.json(sessions.snapshot(accountId(req)));
  });

  router.get('/:id/traffic', owned, (req, res) => {
    const snap = sessions.snapshot(accountId(req));
    if (!snap) return res.json([]);
    const n = Math.min(Number(req.query.n ?? 30), 500);
    res.json(snap.traffic.slice(-n));
  });

  router.get('/:id/packet/:cmd', owned, (req, res) => {
    const cmd = Number(req.params.cmd);
    const hex = sessions.peek(accountId(req))?.lastPacketHex(cmd);
    if (!hex) return res.status(404).json({ error: 'chưa nhận gói này' });
    res.json({ cmd, bytes: hex.length / 2, hex });
  });

  return router;
}
