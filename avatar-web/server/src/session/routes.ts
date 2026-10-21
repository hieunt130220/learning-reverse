import { Router, type Response } from 'express';

import { normalizeAutoConfig, type AutoConfigProfile } from '../accounts/autoConfig.js';
import {
  normalizeFindNpcConfig,
  normalizeMazeConfig,
  normalizeMiningConfig,
  normalizeSchoolConfig,
  parseFishingConfig,
  readAutomationState,
  saveFindNpcConfig,
  saveFishingConfig,
  saveMazeConfig,
  saveMiningConfig,
  saveSchoolConfig,
  setDesiredMode,
} from '../accounts/automationRepo.js';
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
import type { AutomationApiErrorCode, LoadedAutomationIntent } from './automationTypes.js';
import { FIND_NPC_DISABLED } from './featureFlags.js';
import type { SessionManager } from './manager.js';

export interface SessionRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
  shopPolicy?: ShopPolicy;
}

interface AutomationHttpResponse {
  status: number;
  body: unknown;
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

function automationError(
  res: Response,
  status: number,
  code: AutomationApiErrorCode,
  error: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).json({ error, code, ...extra });
}

function automationFailure(
  status: number,
  code: AutomationApiErrorCode,
  error: string,
  extra: Record<string, unknown> = {},
): AutomationHttpResponse {
  return { status, body: { error, code, ...extra } };
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, i) => key === expected[i]);
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
  const automationTails = new Map<number, Promise<void>>();

  /**
   * Tuần tự hóa toàn bộ persist -> runtime -> rollback của cùng account.
   * Tail luôn resolve để một rejection không chặn các request sau. Operation
   * đã vào queue không được tự enqueue lại cùng account để tránh tự deadlock.
   */
  const serializeAutomation = <T>(id: number, operation: () => Promise<T>): Promise<T> => {
    const previous = automationTails.get(id) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(() => undefined, () => undefined);
    automationTails.set(id, tail);
    void tail.then(() => {
      if (automationTails.get(id) === tail) automationTails.delete(id);
    });
    return result;
  };

  const rollbackAutomation = async (id: number): Promise<void> => {
    let firstError: unknown;
    try {
      setDesiredMode(db, id, 'off');
    } catch (error) {
      firstError = error;
    }
    try {
      await sessions.stopAutomation(id);
    } catch (error) {
      firstError ??= error;
    }
    if (firstError !== undefined) throw firstError;
  };

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

  router.get('/:id/automation', owned, (req, res) => {
    try {
      res.json(sessions.automationSnapshot(accountId(req)));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/:id/automation/find-npc/config', owned, (req, res) => {
    try {
      const state = readAutomationState(db, accountId(req)).findNpcConfig;
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.put('/:id/automation/find-npc/config', owned, (req, res) => {
    if (
      !exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || (req.body.expectedRevision as number) < 0
    ) {
      automationError(res, 400, 'invalid-find-npc-config', 'payload cấu hình tìm NPC không hợp lệ');
      return;
    }
    let config;
    try {
      config = normalizeFindNpcConfig(req.body.config);
    } catch (error) {
      automationError(res, 400, 'invalid-find-npc-config', (error as Error).message);
      return;
    }
    let saved: ReturnType<typeof saveFindNpcConfig>;
    try {
      saved = saveFindNpcConfig(
        db,
        accountId(req),
        req.body.expectedRevision as number,
        config,
      );
    } catch {
      automationError(res, 500, 'automation-start-failed', 'không lưu được cấu hình tìm NPC');
      return;
    }
    if (saved.status === 'missing') {
      res.status(404).json({ error: 'không có tài khoản này' });
      return;
    }
    if (saved.status === 'conflict') {
      automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
        current: saved.current,
      });
      return;
    }
    sessions.updateFindNpcConfig(accountId(req), saved.state);
    res.json({ ...saved.state, application: 'immediate' });
  });

  router.put('/:id/automation/fishing/config', owned, (req, res) => {
    if (
      !exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || (req.body.expectedRevision as number) < 0
    ) {
      automationError(res, 400, 'invalid-fishing-config', 'payload cấu hình câu cá không hợp lệ');
      return;
    }
    let config;
    try {
      config = parseFishingConfig(req.body.config);
    } catch (err) {
      automationError(res, 400, 'invalid-fishing-config', (err as Error).message);
      return;
    }

    let saved;
    try {
      saved = saveFishingConfig(
        db,
        accountId(req),
        req.body.expectedRevision as number,
        config,
      );
    } catch {
      automationError(res, 500, 'automation-save-failed', 'không lưu được cấu hình câu cá');
      return;
    }
    if (saved.status === 'missing') {
      res.status(404).json({ error: 'không có tài khoản này' });
      return;
    }
    if (saved.status === 'conflict') {
      automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
        current: saved.current,
      });
      return;
    }

    // Cập nhật cấu hình ngay cho session đang chạy nếu có
    sessions.updateFishingConfig(accountId(req), saved.state);
    res.json({ ...saved.state, application: 'immediate' });
  });

  router.post('/:id/fishing/sell', owned, async (req, res) => {
    const id = accountId(req);
    const session = sessions.peek(id);
    if (!session || session.status !== 'online') {
      res.status(400).json({ error: 'Tài khoản cần kết nối game để bán cá' });
      return;
    }

    try {
      const result = await session.sellAllFish();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/:id/fishing/finance/reset', owned, (req, res) => {
    const id = accountId(req);
    const session = sessions.peek(id);
    let statistics;
    try {
      if (session) {
        statistics = session.resetFishingFinance();
      } else {
        const repo = sessions.getFishingFinancialStatisticsRepo();
        statistics = repo.reset(id);
      }
      res.json({ ok: true, statistics });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get('/:id/automation/mining/config', owned, (req, res) => {
    const state = readAutomationState(db, accountId(req)).miningConfig;
    res.json(state);
  });

  router.put('/:id/automation/mining/config', owned, (req, res) => {
    if (
      !exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || (req.body.expectedRevision as number) < 0
    ) {
      automationError(res, 400, 'invalid-mining-config', 'payload cấu hình khai thác không hợp lệ');
      return;
    }
    let config;
    try {
      config = normalizeMiningConfig(req.body.config);
    } catch (err) {
      automationError(res, 400, 'invalid-mining-config', (err as Error).message);
      return;
    }

    let saved;
    try {
      saved = saveMiningConfig(
        db,
        accountId(req),
        req.body.expectedRevision as number,
        config,
      );
    } catch {
      automationError(res, 500, 'automation-save-failed', 'không lưu được cấu hình khai thác');
      return;
    }
    if (saved.status === 'missing') {
      res.status(404).json({ error: 'không có tài khoản này' });
      return;
    }
    if (saved.status === 'conflict') {
      automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
        current: saved.current,
      });
      return;
    }

    // Cập nhật cấu hình ngay cho session đang chạy nếu có
    sessions.updateMiningConfig(accountId(req), saved.state);
    res.json({ ...saved.state, application: 'immediate' });
  });

  router.get('/:id/automation/maze/config', owned, (req, res) => {
    const state = readAutomationState(db, accountId(req)).mazeConfig;
    res.json(state);
  });

  router.put('/:id/automation/maze/config', owned, (req, res) => {
    if (
      !exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || (req.body.expectedRevision as number) < 0
    ) {
      automationError(res, 400, 'invalid-maze-config', 'payload cấu hình Mê cung không hợp lệ');
      return;
    }
    let config;
    try {
      config = normalizeMazeConfig(req.body.config);
    } catch (err) {
      automationError(res, 400, 'invalid-maze-config', (err as Error).message);
      return;
    }

    let saved;
    try {
      saved = saveMazeConfig(
        db,
        accountId(req),
        req.body.expectedRevision as number,
        config,
      );
    } catch {
      automationError(res, 500, 'automation-save-failed', 'không lưu được cấu hình Mê cung');
      return;
    }
    if (saved.status === 'missing') {
      res.status(404).json({ error: 'không có tài khoản này' });
      return;
    }
    if (saved.status === 'conflict') {
      automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
        current: saved.current,
      });
      return;
    }

    // Cập nhật cấu hình ngay cho session đang chạy nếu có
    sessions.updateMazeConfig(accountId(req), saved.state);
    res.json({ ...saved.state, application: 'immediate' });
  });

  router.get('/:id/automation/school/config', owned, (req, res) => {
    const state = readAutomationState(db, accountId(req)).schoolConfig;
    res.json(state);
  });

  router.put('/:id/automation/school/config', owned, (req, res) => {
    if (
      !exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || (req.body.expectedRevision as number) < 0
    ) {
      automationError(res, 400, 'invalid-school-config', 'payload cấu hình Trường học không hợp lệ');
      return;
    }
    let config;
    try {
      config = normalizeSchoolConfig(req.body.config);
    } catch (err) {
      automationError(res, 400, 'invalid-school-config', (err as Error).message);
      return;
    }

    let saved;
    try {
      saved = saveSchoolConfig(
        db,
        accountId(req),
        req.body.expectedRevision as number,
        config,
      );
    } catch {
      automationError(res, 500, 'automation-save-failed', 'không lưu được cấu hình Trường học');
      return;
    }
    if (saved.status === 'missing') {
      res.status(404).json({ error: 'không có tài khoản này' });
      return;
    }
    if (saved.status === 'conflict') {
      automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
        current: saved.current,
      });
      return;
    }

    // Cập nhật cấu hình ngay cho session đang chạy nếu có
    sessions.updateSchoolConfig(accountId(req), saved.state);
    res.json({ ...saved.state, application: 'immediate' });
  });

  router.post('/:id/automation/start', owned, async (req, res) => {
    if (
      !exactObject(req.body, ['mode'])
      || (
        req.body.mode !== 'auto_farm'
        && req.body.mode !== 'find_npc'
        && req.body.mode !== 'auto_fishing'
        && req.body.mode !== 'auto_fisherman_quest'
        && req.body.mode !== 'auto_mining'
        && req.body.mode !== 'auto_maze'
        && req.body.mode !== 'auto_school'
      )
    ) {
      automationError(res, 400, 'invalid-automation-mode', 'mode automation không hợp lệ');
      return;
    }
    const id = accountId(req);
    const mode = req.body.mode;
    try {
      const reply = await serializeAutomation(id, async (): Promise<AutomationHttpResponse> => {
        let persisted = false;
        let rollbackAttempted = false;
        try {
          const before = readAutomationState(db, id);
          if (mode === 'find_npc') {
            if (!before.findNpcConfig.config.npcName) {
              return automationFailure(
                400,
                'find-npc-name-required',
                'hãy lưu tên NPC trước khi bắt đầu',
              );
            }
          }

          try {
            setDesiredMode(db, id, mode);
          } catch {
            return automationFailure(
              500,
              'automation-start-failed',
              'không lưu được mode automation',
            );
          }
          persisted = true;

          const stored = readAutomationState(db, id);
          const intent: LoadedAutomationIntent = {
            desiredMode: mode,
            findNpcConfig: stored.findNpcConfig,
            fishingConfig: stored.fishingConfig,
            miningConfig: stored.miningConfig,
            mazeConfig: stored.mazeConfig,
            schoolConfig: stored.schoolConfig,
            location: stored.location,
          };
          const outcome = await sessions.switchAutomationMode(id, intent);
          const snapshot = sessions.automationSnapshot(id);
          if (outcome === 'connect-pending') {
            return automationFailure(
              409,
              'automation-connect-pending',
              'đang chờ kết nối game',
              { snapshot },
            );
          }
          if (outcome === 'start-failed') {
            rollbackAttempted = true;
            await rollbackAutomation(id);
            return automationFailure(
              500,
              'automation-start-failed',
              'không khởi tạo được automation',
              { snapshot: sessions.automationSnapshot(id) },
            );
          }
          return { status: 200, body: snapshot };
        } catch {
          if (persisted && !rollbackAttempted) {
            rollbackAttempted = true;
            try {
              await rollbackAutomation(id);
            } catch {
              // Vẫn trả response typed sau khi cả persist-off và cleanup đã settle.
            }
          }
          const extra: Record<string, unknown> = {};
          try {
            extra.snapshot = sessions.automationSnapshot(id);
          } catch {
            // Persistence lỗi có thể khiến snapshot offline không đọc được.
          }
          return automationFailure(
            500,
            'automation-start-failed',
            'không khởi tạo được automation',
            extra,
          );
        }
      });
      res.status(reply.status).json(reply.body);
    } catch {
      if (!res.headersSent) {
        automationError(res, 500, 'automation-start-failed', 'không khởi tạo được automation');
      }
    }
  });

  router.post('/:id/automation/stop', owned, async (req, res) => {
    const body = req.body === undefined ? {} : req.body;
    if (!exactObject(body, [])) {
      automationError(res, 400, 'invalid-automation-mode', 'payload stop phải rỗng');
      return;
    }
    const id = accountId(req);
    try {
      const snapshot = await serializeAutomation(id, async () => {
        setDesiredMode(db, id, 'off');
        await sessions.stopAutomation(id);
        return sessions.automationSnapshot(id);
      });
      res.json(snapshot);
    } catch {
      if (!res.headersSent) {
        automationError(res, 500, 'automation-start-failed', 'không dừng được automation');
      }
    }
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
      await serializeAutomation(id, async () => {
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
            res.status(404).json({ error: 'không có tài khoản này' });
            return;
          }
          if (result.status === 'conflict') {
            res.status(409).json({
              error: 'revision cấu hình đã thay đổi',
              code: 'revision-conflict',
              current: result.current,
            });
            return;
          }
          cfg = result.state.config;
        }
        // DB là nguồn sự thật: commit ý muốn trước khi chạm runtime.
        const outcome = await sessions.startAuto(id, cfg);
        if (outcome === 'start-failed') {
          await rollbackAutomation(id);
          throw new Error('không khởi tạo được tự động');
        }
      });
      if (!res.headersSent) res.json(sessions.snapshot(id));
    } catch (err) {
      if (!res.headersSent) {
        if (err instanceof AutoConfigProfileError) configFail(res, err);
        else fail(res, err);
      }
    }
  });

  router.post('/:id/auto/stop', owned, async (req, res) => {
    const id = accountId(req);
    try {
      await serializeAutomation(id, async () => {
        setAutoEnabled(db, id, false);
        await sessions.peek(id)?.stopAuto();
      });
      res.json({ ok: true });
    } catch (err) {
      if (!res.headersSent) fail(res, err);
    }
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
