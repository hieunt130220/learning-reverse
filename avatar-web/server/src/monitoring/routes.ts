import { Router } from 'express';

import { makeRequireAuth, type AuthedRequest } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import { MonitoringCollector } from './collector.js';

export function monitoringRouter(deps: { db: Db; isProduction: boolean; collector: MonitoringCollector }): Router {
  const router = Router();
  router.use(makeRequireAuth(deps.db, deps.isProduction));

  router.get('/overview', async (req, res) => {
    try {
      const userId = (req as AuthedRequest).user!.id;
      res.json(await deps.collector.overview(userId));
    } catch {
      res.status(503).json({ error: 'không lấy được trạng thái monitoring' });
    }
  });

  router.get('/events', async (req, res) => {
    const rawLimit = Number(req.query.limit ?? 50);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
      return res.status(400).json({ error: 'limit phải là số nguyên từ 1 đến 200' });
    }
    try {
      const userId = (req as AuthedRequest).user!.id;
      res.json(await deps.collector.events(userId, rawLimit));
    } catch {
      res.status(503).json({ error: 'không lấy được monitoring events' });
    }
  });

  return router;
}
