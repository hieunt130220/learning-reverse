import { Router, type Response } from 'express';

import { ShopRepository, type ShopTransaction } from '../accounts/shopRepo.js';
import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { AvatarSession } from './avatarSession.js';
import type { SessionManager } from './manager.js';
import { ShopError } from './shopCoordinator.js';

export interface ShopRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
  repository: ShopRepository;
}

function apiError(res: Response, error: unknown): void {
  if (error instanceof ShopError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('shop route unexpected error:', error instanceof Error ? error.stack : error);
  res.status(500).json({
    error: {
      code: 'SHOP_PROTOCOL_ERROR',
      message: 'Không thể xử lý yêu cầu sạp',
    },
  });
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'Body phải là object JSON');
  }
  return value as Record<string, unknown>;
}

function integerField(
  body: Record<string, unknown>,
  name: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = body[name];
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ShopError(
      400,
      'INVALID_SHOP_REQUEST',
      `${name} phải là số nguyên trong [${minimum}, ${maximum}]`,
    );
  }
  return value as number;
}

function idempotencyKey(body: Record<string, unknown>): string {
  const value = body.idempotencyKey;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new ShopError(
      400,
      'INVALID_SHOP_REQUEST',
      'idempotencyKey phải là chuỗi không rỗng, tối đa 128 ký tự',
    );
  }
  return value;
}

function routeSlot(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'slot phải là số nguyên không âm');
  }
  const slot = Number(value);
  if (!Number.isSafeInteger(slot) || slot > 127) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'slot phải nằm trong [0, 127]');
  }
  return slot;
}

function routeItemId(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'itemId phải là số nguyên không âm');
  }
  const itemId = Number(value);
  if (!Number.isSafeInteger(itemId) || itemId > 32_767) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'itemId phải nằm trong [0, 32767]');
  }
  return itemId;
}

function historyLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'limit phải là số nguyên từ 1 đến 100');
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > 100) {
    throw new ShopError(400, 'INVALID_SHOP_REQUEST', 'limit phải là số nguyên từ 1 đến 100');
  }
  return limit;
}

function requireLiveSession(sessions: SessionManager, accountId: number): AvatarSession {
  const session = sessions.peek(accountId);
  if (!session || session.status !== 'online') {
    throw new ShopError(409, 'SESSION_OFFLINE', 'Phiên game chưa online');
  }
  return session;
}

function writeStatus(transaction: ShopTransaction): 200 | 202 {
  return transaction.status === 'succeeded'
    || transaction.status === 'failed'
    || transaction.status === 'unknown'
    ? 200
    : 202;
}

export function shopRouter(deps: ShopRoutesDeps): Router {
  const { db, isProduction, sessions, repository } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));
  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown) => (req as AccountRequest).account!.id;
  const userId = (req: unknown) => (req as AccountRequest).user!.id;

  router.get('/:id/shop', owned, (req, res) => {
    try {
      const view = sessions.getShopView(userId(req), accountId(req));
      if (!view) return res.status(404).json({ error: 'không có tài khoản này' });
      res.json(view);
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/sync', owned, async (req, res) => {
    try {
      const session = requireLiveSession(sessions, accountId(req));
      const shop = await session.syncShop();
      res.json({ shop, produce: session.shopProduceState() });
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/browse', owned, async (req, res) => {
    try {
      const session = requireLiveSession(sessions, accountId(req));
      const shop = await session.browseShopCatalog();
      res.json({ shop, produce: session.shopProduceState() });
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/browse/:itemId', owned, async (req, res) => {
    try {
      const itemId = routeItemId(req.params.itemId);
      const body = bodyObject(req.body);
      const expectedMarketRevision = integerField(body, 'expectedMarketRevision');
      const session = requireLiveSession(sessions, accountId(req));
      const shop = await session.browseShopItem({ itemId, expectedMarketRevision });
      res.json({ shop, produce: session.shopProduceState() });
    } catch (error) {
      apiError(res, error);
    }
  });

  router.get('/:id/shop/transactions', owned, (req, res) => {
    try {
      res.json(repository.listTransactions(accountId(req), historyLimit(req.query.limit)));
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/listings', owned, (req, res) => {
    try {
      const body = bodyObject(req.body);
      const transaction = requireLiveSession(sessions, accountId(req)).createShopListing({
        idempotencyKey: idempotencyKey(body),
        slot: integerField(body, 'slot', 0, 127),
        itemId: integerField(body, 'itemId', 0, 32_767),
        quantity: integerField(body, 'quantity', 1, 2_147_483_647),
        price: integerField(body, 'price', 1, 2_147_483_647),
        expectedShopRevision: integerField(body, 'expectedShopRevision'),
        expectedProduceRevision: integerField(body, 'expectedProduceRevision'),
      });
      res.status(writeStatus(transaction)).json(transaction);
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/listings/:slot/withdraw', owned, (req, res) => {
    try {
      const body = bodyObject(req.body);
      const transaction = requireLiveSession(sessions, accountId(req)).withdrawShopListing({
        idempotencyKey: idempotencyKey(body),
        slot: routeSlot(req.params.slot),
        expectedShopRevision: integerField(body, 'expectedShopRevision'),
        expectedItemId: integerField(body, 'expectedItemId', 0, 32_767),
        expectedQuantity: integerField(body, 'expectedQuantity', 1, 2_147_483_647),
        expectedPrice: integerField(body, 'expectedPrice', 1, 2_147_483_647),
      });
      res.status(writeStatus(transaction)).json(transaction);
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/purchases', owned, (req, res) => {
    try {
      const body = bodyObject(req.body);
      const transaction = requireLiveSession(sessions, accountId(req)).purchaseShopListing({
        idempotencyKey: idempotencyKey(body),
        idShop: integerField(body, 'idShop', 0, 2_147_483_647),
        verShop: integerField(body, 'verShop', 0, 32_767),
        expectedItemId: integerField(body, 'expectedItemId', 0, 32_767),
        expectedQuantity: integerField(body, 'expectedQuantity', 1, 2_147_483_647),
        expectedPrice: integerField(body, 'expectedPrice', 1, 2_147_483_647),
        expectedMarketRevision: integerField(body, 'expectedMarketRevision'),
      });
      res.status(writeStatus(transaction)).json(transaction);
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/slots/unlock', owned, (req, res) => {
    try {
      const body = bodyObject(req.body);
      const transaction = requireLiveSession(sessions, accountId(req)).unlockShopSlot({
        idempotencyKey: idempotencyKey(body),
        type: integerField(body, 'type', 0, 127),
        expectedShopRevision: integerField(body, 'expectedShopRevision'),
      });
      res.status(writeStatus(transaction)).json(transaction);
    } catch (error) {
      apiError(res, error);
    }
  });

  router.post('/:id/shop/market/refresh', owned, (req, res) => {
    try {
      const body = bodyObject(req.body);
      const transaction = requireLiveSession(sessions, accountId(req)).refreshShopMarket({
        idempotencyKey: idempotencyKey(body),
        expectedMarketRevision: integerField(body, 'expectedMarketRevision'),
      });
      res.status(writeStatus(transaction)).json(transaction);
    } catch (error) {
      apiError(res, error);
    }
  });

  return router;
}
