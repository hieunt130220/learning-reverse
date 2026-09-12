import { Router, type Response } from 'express';

import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { SessionManager } from '../session/manager.js';
import { LIVE_REVIEW_TARGET_BATCH_COUNT, type LiveReviewCaptureRegistry } from './liveReviewCapture.js';

export interface LiveReviewCaptureRoutesDeps { db: Db; isProduction: boolean; sessions: SessionManager; registry: LiveReviewCaptureRegistry | null }
const disabledSnapshot = { enabled: false as const, targetBatchCount: LIVE_REVIEW_TARGET_BATCH_COUNT, savedBatchCount: 0, failedBatchCount: 0, reportReady: false };
const conflict = (res: Response, error: unknown): void => { res.status(409).json({ error: (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 300) }); };

export function liveReviewCaptureRouter({ db, isProduction, sessions, registry }: LiveReviewCaptureRoutesDeps): Router {
  const router = Router();
  const root = '/:id/fishing-live-review';
  const auth = makeRequireAuth(db, isProduction);
  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown): number => (req as AccountRequest).account!.id;

  router.get(root, auth, owned, (req, res) => res.json(registry ? registry.snapshot(accountId(req)) : disabledSnapshot));
  router.post(`${root}/start`, auth, owned, (req, res) => {
    if (!registry) return res.status(404).json({ error: 'live review capture chưa được bật' });
    const id = accountId(req);
    if (sessions.snapshot(id)?.status !== 'online') return res.status(409).json({ error: 'phiên game chưa online' });
    try { return res.json(registry.start(id)); } catch (error) { conflict(res, error); }
  });
  router.post(`${root}/stop`, auth, owned, async (req, res) => {
    if (!registry) return res.status(404).json({ error: 'live review capture chưa được bật' });
    try { return res.json(await registry.stopAndSeal(accountId(req))); } catch (error) { conflict(res, error); }
  });
  router.get(`${root}/:sessionId/report`, auth, owned, (req, res) => {
    if (!registry) return res.status(404).json({ error: 'live review capture chưa được bật' });
    const report = registry.reportPath(accountId(req), req.params.sessionId);
    return report ? res.sendFile(report) : res.status(404).json({ error: 'report chưa sẵn sàng' });
  });
  return router;
}
