import { Router, type Response } from 'express';

import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { SessionManager } from '../session/manager.js';
import {
  RX79_CAPTURE_CYCLE_ID,
  Rx79CaptureRegistry,
  type Rx79CaptureStart,
} from './rx79Capture.js';

export interface Rx79CaptureRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
  registry: Rx79CaptureRegistry | null;
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function conflict(res: Response, error: unknown): void {
  res.status(409).json({ error: error instanceof Error ? error.message : String(error) });
}

export function rx79CaptureRouter(deps: Rx79CaptureRoutesDeps): Router {
  const router = Router();
  const { db, isProduction, sessions, registry } = deps;
  const root = '/:id/fishing-rx79-capture';

  if (!registry) {
    const disabled = (_req: unknown, res: Response): void => {
      res.status(404).json({ error: 'RX79 capture chưa được bật' });
    };
    router.post(`${root}/start`, disabled);
    router.get(root, disabled);
    router.post(`${root}/stop`, disabled);
    return router;
  }

  const auth = makeRequireAuth(db, isProduction);
  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown): number => (req as AccountRequest).account!.id;

  router.post(`${root}/start`, auth, owned, (req, res) => {
    if (!exactObject(req.body, ['cycleId', 'map', 'area'])) {
      return res.status(400).json({ error: 'body phải có đúng cycleId, map và area' });
    }
    const { cycleId, map, area } = req.body;
    if (cycleId !== RX79_CAPTURE_CYCLE_ID || !nonNegativeInteger(map) || !nonNegativeInteger(area)) {
      return res.status(400).json({ error: 'cycleId, map hoặc area không hợp lệ' });
    }

    const id = accountId(req);
    try {
      const client = sessions.require(id).rawClient;
      if (!client || client.status !== 'online') {
        return res.status(409).json({ error: 'phiên game chưa online' });
      }
      const request: Rx79CaptureStart = { accountId: id, cycleId, map, area };
      return res.json(registry.start(client, request));
    } catch (error) {
      conflict(res, error);
    }
  });

  router.get(root, auth, owned, (req, res) => {
    const snapshot = registry.snapshot(accountId(req));
    if (!snapshot) return res.status(404).json({ error: 'capture chưa được bắt đầu' });
    return res.json(snapshot);
  });

  router.post(`${root}/stop`, auth, owned, async (req, res) => {
    try {
      return res.json(await registry.stopAndSeal(accountId(req)));
    } catch (error) {
      conflict(res, error);
    }
  });

  return router;
}
