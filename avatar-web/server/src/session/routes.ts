import { Router, type Response } from 'express';

import { normalizeAutoConfig, type AutoConfigProfile } from '../accounts/autoConfig.js';
import { DEFAULT_SEED_CATALOG } from '../accounts/defaultSeedCatalog.js';
import { getFarmProfile } from '../accounts/farmProfileRepo.js';
import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import {
  AutoConfigProfileError,
  enableAutoWithConfigPatch,
  getAutoConfig,
  saveAutoConfig,
  setAutoEnabled,
} from '../accounts/repo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { ShopPolicy } from '../config.js';
import type { Macro } from '../macro.js';
import type { SessionManager } from './manager.js';

export interface SessionRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
  shopPolicy?: ShopPolicy;
}

const SHOP_FARM_ACTIONS = new Set([
  'openShop',
  'unlockShopSlot',
  'addItemToShop',
  'takeItemBack',
  'buyFromShop',
  'refreshShop',
  'getShopItems',
]);

/**
 * "Chưa kết nối" là trạng thái hợp lệ của tài nguyên, không phải lỗi máy chủ —
 * 409 để UI phân biệt được với 500 (lệnh gửi đi rồi mà hỏng).
 */
function fail(res: Response, err: unknown): void {
  const message = (err as Error).message;
  const unavailable = message.includes('chưa kết nối') || message.includes('chưa online');
  res.status(unavailable ? 409 : 500).json({ error: message });
}

function configFail(res: Response, err: unknown): void {
  if (err instanceof AutoConfigProfileError) {
    const status = err.code === 'invalid-tree-cell-plan' ? 400 : 409;
    res.status(status).json({
      error: err.message,
      code: err.code,
      ...(err.code === 'invalid-tree-cell-plan' ? {
        invalidCellIndices: err.invalidCellIndices,
        invalidSeedIds: err.invalidSeedIds,
      } : {}),
    });
    return;
  }
  res.status(400).json({ error: (err as Error).message });
}

function profileForConfig(db: Db, accountId: number): AutoConfigProfile | null {
  const profile = getFarmProfile(db, accountId);
  if (profile.cellsObservedAt === null && profile.seedsObservedAt === null) return null;
  return {
    cellIndices: profile.cellIndices,
    seedIds: profile.seedCatalog.map((seed) => seed.id),
  };
}

function validateProfile(config: Partial<AutoFarmConfig>, profile: AutoConfigProfile | null): void {
  const plan = config.treeCellPlan;
  if (plan === undefined || plan.length === 0) return;

  const seedEntries = plan.filter((entry) => entry.action === 'seed');
  const knownSeeds = new Set<number>([
    ...DEFAULT_SEED_CATALOG.map((s) => s.id),
    ...(profile?.seedIds ?? []),
  ]);

  const invalidCellIndices = [...new Set(
    plan.filter((entry) => !Number.isInteger(entry.cellIndex) || entry.cellIndex < 0 || entry.cellIndex >= 48).map((entry) => entry.cellIndex),
  )].sort((left, right) => left - right);
  const invalidSeedIds = [...new Set(
    seedEntries.filter((entry) => !knownSeeds.has(entry.seedId)).map((entry) => entry.seedId),
  )].sort((left, right) => left - right);

  if (invalidCellIndices.length > 0 || invalidSeedIds.length > 0) {
    throw new AutoConfigProfileError(
      'invalid-tree-cell-plan',
      'kế hoạch cây không hợp lệ',
      invalidCellIndices,
      invalidSeedIds,
    );
  }
}

export function sessionRouter(deps: SessionRoutesDeps): Router {
  const { db, isProduction, sessions, shopPolicy } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));

  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown) => (req as AccountRequest).account!.id;
  const userId = (req: unknown) => (req as AccountRequest).user!.id;

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

  router.get('/:id/auto/config', owned, (req, res) => {
    res.json(getAutoConfig(db, userId(req), accountId(req)));
  });

  router.put('/:id/auto/config', owned, (req, res) => {
    const body = req.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return res.status(400).json({ error: 'payload phải là object' });
    }
    const payload = body as Record<string, unknown>;
    const payloadKeys = Object.keys(payload);
    if (
      payloadKeys.length !== 2
      || !Object.prototype.hasOwnProperty.call(payload, 'expectedRevision')
      || !Number.isInteger(payload.expectedRevision)
      || (payload.expectedRevision as number) < 0
      || !Object.prototype.hasOwnProperty.call(payload, 'config')
    ) {
      return res.status(400).json({ error: 'expectedRevision phải là số nguyên không âm' });
    }

    let config: Partial<AutoFarmConfig>;
    try {
      config = normalizeAutoConfig(payload.config);
    } catch (err) {
      configFail(res, err);
      return;
    }

    try {
      validateProfile(config, profileForConfig(db, accountId(req)));
    } catch (err) {
      if (err instanceof AutoConfigProfileError) configFail(res, err);
      else fail(res, err);
      return;
    }

    try {
      const saved = saveAutoConfig(
        db,
        userId(req),
        accountId(req),
        payload.expectedRevision as number,
        config,
      );
      if (saved.status === 'conflict') {
        return res.status(409).json({
          error: 'revision cấu hình đã thay đổi',
          code: 'revision-conflict',
          current: saved.current,
        });
      }
      if (saved.status === 'missing') return res.status(404).json({ error: 'không có tài khoản này' });

      try {
        const application = sessions.peek(accountId(req))?.updateAutoConfig(saved.state.config)
          ?? 'next-start';
        res.json({ ...saved.state, application });
      } catch (err) {
        fail(res, err);
      }
    } catch (err) {
      fail(res, err);
    }
  });

  router.get('/:id/farm/profile', owned, (req, res) => {
    res.json(getFarmProfile(db, accountId(req)));
  });

  router.post('/:id/farm/profile/refresh', owned, async (req, res) => {
    try {
      await sessions.require(accountId(req)).refreshFarmProfile();
      res.json(getFarmProfile(db, accountId(req)));
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('quá hạn')) return res.status(504).json({ error: message });
      fail(res, err);
    }
  });

  router.post('/:id/auto/start', owned, async (req, res) => {
    const id = accountId(req);
    let patch: Partial<AutoFarmConfig>;
    const hasConfigPatch = Object.keys(req.body ?? {}).length > 0;
    try {
      patch = normalizeAutoConfig(req.body ?? {});
    } catch (err) {
      configFail(res, err);
      return;
    }
    try {
      let cfg: Partial<AutoFarmConfig>;
      if (!hasConfigPatch) {
        setAutoEnabled(db, id, true);
        cfg = getAutoConfig(db, userId(req), id)!.config;
      } else {
        const result = enableAutoWithConfigPatch(
          db,
          userId(req),
          id,
          patch,
          profileForConfig(db, id),
        );
        if (result.status === 'missing') {
          return res.status(404).json({ error: 'không có tài khoản này' });
        }
        if (result.status === 'conflict') {
          return res.status(409).json({
            error: 'revision cấu hình đã thay đổi',
            code: 'revision-conflict',
            current: result.current,
          });
        }
        cfg = result.state.config;
      }
      // DB là nguồn sự thật: commit ý muốn trước khi chạm runtime.
      await sessions.startAuto(id, cfg);
      res.json(sessions.snapshot(id));
    } catch (err) {
      if (err instanceof AutoConfigProfileError) configFail(res, err);
      else fail(res, err);
    }
  });

  router.post('/:id/auto/stop', owned, (req, res) => {
    const id = accountId(req);
    setAutoEnabled(db, id, false);
    sessions.peek(id)?.stopAuto();
    res.json({ ok: true });
  });

  router.post('/:id/farm', owned, (req, res) => {
    const { name, args } = (req.body ?? {}) as { name?: string; args?: unknown[] };
    if (typeof name !== 'string') return res.status(400).json({ error: 'thiếu tên action' });
    if (SHOP_FARM_ACTIONS.has(name)) {
      return res.status(403).json({
        error: {
          code: 'SHOP_CAPABILITY_DISABLED',
          message: 'Lệnh cmd 103 chỉ được gọi qua API sạp có kiểm soát',
        },
      });
    }
    try {
      sessions.require(accountId(req)).callFarm(name, args ?? []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  // ---- Cooking (Bếp nấu ăn) — chỉ giữ refresh trạng thái, bỏ nấu/mở bếp ----

  router.post('/:id/farm/cook/refresh', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).callFarm('getCook', [0]);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  // ---- Quests (Nhiệm vụ nông trại: Daily, Beginner, General) --------------

  router.get('/:id/quests', owned, (req, res) => {
    try {
      const sess = sessions.peek(accountId(req));
      if (!sess) {
        return res.json({
          daily: null,
          beginner: null,
          farmer: null,
          updatedAt: Date.now(),
        });
      }
      res.json(sess.getQuestOverview());
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/quests/progress/refresh', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).refreshProgressQuests();
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/quests/daily/refresh', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).callFarm('getDailyQuest', [0]);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/quests/daily/change', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).callFarm('changeDailyQuest', []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/quests/daily/claim', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).callFarm('claimDailyQuestReward', []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/quests/daily/box', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).callFarm('claimDailyQuestBox', []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/raw', owned, (req, res) => {
    const { cmd, fields } = (req.body ?? {}) as { cmd?: unknown; fields?: Array<{ t: string; v: string }> };
    const parsedCmd = Number(cmd);
    if (parsedCmd === 103 && (isProduction || !shopPolicy?.protocolDebugEnabled)) {
      return res.status(403).json({
        error: {
          code: 'SHOP_CAPABILITY_DISABLED',
          message: 'Raw cmd 103 bị tắt ngoài chế độ protocol debug cục bộ',
        },
      });
    }
    try {
      sessions.require(accountId(req)).sendRaw(parsedCmd, fields ?? []);
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
