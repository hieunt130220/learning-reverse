import type { Db } from '../db/index.js';
import type { InventoryItem } from '../game/farmData.js';
import type { MarketListing, OwnShopSlot, ShopPriceRule } from '../game/shopProtocol.js';

export type ShopTransactionKind =
  | 'list'
  | 'withdraw'
  | 'purchase'
  | 'unlock'
  | 'refresh-market';

export type ShopTransactionStatus =
  | 'queued'
  | 'sending'
  | 'awaiting_response'
  | 'reconciling'
  | 'succeeded'
  | 'failed'
  | 'unknown';

export interface ShopTransaction {
  id: string;
  accountId: number;
  idempotencyKey: string;
  kind: ShopTransactionKind;
  status: ShopTransactionStatus;
  request: Record<string, unknown>;
  before: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ShopTransactionPatch {
  status?: ShopTransactionStatus;
  result?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  updatedAt?: number;
  completedAt?: number | null;
}

export interface ProduceSnapshot {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  items: InventoryItem[];
}

export interface ShopSnapshot<T> {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  data: T;
}

export interface OwnShopData {
  numSlot: number;
  canOpenSlot: boolean;
  slots: OwnShopSlot[];
}

export interface MarketData {
  status: number;
  listings: MarketListing[];
}

export interface ShopCapabilities {
  readEnabled: boolean;
  writeEnabled: boolean;
  purchaseEnabled: boolean;
  slotUnlockEnabled: boolean;
  marketRefreshEnabled: boolean;
  liveAccountAllowed: boolean;
}

export interface ShopRuntimeState {
  syncStatus: 'idle' | 'syncing' | 'ready' | 'stale' | 'error';
  own: ShopSnapshot<OwnShopData> | null;
  market: ShopSnapshot<MarketData> | null;
  priceRules: ShopSnapshot<ShopPriceRule[]> | null;
  activeTransaction: ShopTransaction | null;
  recentTransactions: ShopTransaction[];
  capabilities: ShopCapabilities;
  lastError?: { code: string; message: string };
}

export interface PersistedShopCache {
  own: ShopSnapshot<OwnShopData> | null;
  market: ShopSnapshot<MarketData> | null;
  priceRules: ShopSnapshot<ShopPriceRule[]> | null;
  produce: ProduceSnapshot | null;
  ownObservedAt: number | null;
  marketObservedAt: number | null;
  rulesObservedAt: number | null;
  produceObservedAt: number | null;
  updatedAt: number;
}

interface CacheRow {
  account_id: number;
  own_snapshot_json: string | null;
  market_snapshot_json: string | null;
  price_rules_json: string | null;
  produce_json: string | null;
  own_observed_at: number | null;
  market_observed_at: number | null;
  rules_observed_at: number | null;
  produce_observed_at: number | null;
  updated_at: number;
}

interface TransactionRow {
  id: string;
  account_id: number;
  idempotency_key: string;
  kind: ShopTransactionKind;
  status: ShopTransactionStatus;
  request_json: string;
  before_json: string | null;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

const TERMINAL_STATUSES = new Set<ShopTransactionStatus>(['succeeded', 'failed', 'unknown']);

function parseJson<T>(raw: string | null, table: string, column: string, owner: string): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${table}.${column} chứa JSON không hợp lệ cho ${owner}`);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toTransaction(row: TransactionRow): ShopTransaction {
  const request = parseJson<Record<string, unknown>>(
    row.request_json,
    'avatar_shop_transactions',
    'request_json',
    `transaction ${row.id}`,
  );
  const before = parseJson<Record<string, unknown>>(
    row.before_json,
    'avatar_shop_transactions',
    'before_json',
    `transaction ${row.id}`,
  );
  const result = parseJson<Record<string, unknown>>(
    row.result_json,
    'avatar_shop_transactions',
    'result_json',
    `transaction ${row.id}`,
  );
  return {
    id: row.id,
    accountId: row.account_id,
    idempotencyKey: row.idempotency_key,
    kind: row.kind,
    status: row.status,
    request: request ?? {},
    before: before ?? {},
    ...(result === null ? {} : { result }),
    ...(row.error_code === null ? {} : { errorCode: row.error_code }),
    ...(row.error_message === null ? {} : { errorMessage: row.error_message }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  };
}

export class ShopRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  loadCache(accountId: number): PersistedShopCache | null {
    const row = this.db
      .prepare<[number], CacheRow>('SELECT * FROM avatar_shop_cache WHERE account_id = ?')
      .get(accountId);
    if (!row) return null;
    const owner = `account ${row.account_id}`;
    return {
      own: parseJson(row.own_snapshot_json, 'avatar_shop_cache', 'own_snapshot_json', owner),
      market: parseJson(row.market_snapshot_json, 'avatar_shop_cache', 'market_snapshot_json', owner),
      priceRules: parseJson(row.price_rules_json, 'avatar_shop_cache', 'price_rules_json', owner),
      produce: parseJson(row.produce_json, 'avatar_shop_cache', 'produce_json', owner),
      ownObservedAt: row.own_observed_at,
      marketObservedAt: row.market_observed_at,
      rulesObservedAt: row.rules_observed_at,
      produceObservedAt: row.produce_observed_at,
      updatedAt: row.updated_at,
    };
  }

  saveCache(accountId: number, state: ShopRuntimeState, produce: ProduceSnapshot | null): void {
    const updatedAt = Math.max(
      this.now(),
      state.own?.capturedAt ?? 0,
      state.market?.capturedAt ?? 0,
      state.priceRules?.capturedAt ?? 0,
      produce?.capturedAt ?? 0,
    );
    this.db.prepare(
      `INSERT INTO avatar_shop_cache
         (account_id, own_snapshot_json, market_snapshot_json, price_rules_json, produce_json,
          own_observed_at, market_observed_at, rules_observed_at, produce_observed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         own_snapshot_json = excluded.own_snapshot_json,
         market_snapshot_json = excluded.market_snapshot_json,
         price_rules_json = excluded.price_rules_json,
         produce_json = excluded.produce_json,
         own_observed_at = excluded.own_observed_at,
         market_observed_at = excluded.market_observed_at,
         rules_observed_at = excluded.rules_observed_at,
         produce_observed_at = excluded.produce_observed_at,
         updated_at = excluded.updated_at`,
    ).run(
      accountId,
      state.own === null ? null : JSON.stringify(state.own),
      state.market === null ? null : JSON.stringify(state.market),
      state.priceRules === null ? null : JSON.stringify(state.priceRules),
      produce === null ? null : JSON.stringify(produce),
      state.own?.capturedAt ?? null,
      state.market?.capturedAt ?? null,
      state.priceRules?.capturedAt ?? null,
      produce?.capturedAt ?? null,
      updatedAt,
    );
  }

  findTransaction(accountId: number, idempotencyKey: string): ShopTransaction | null {
    const row = this.db
      .prepare<[number, string], TransactionRow>(
        `SELECT * FROM avatar_shop_transactions
          WHERE account_id = ? AND idempotency_key = ?`,
      )
      .get(accountId, idempotencyKey);
    return row ? toTransaction(row) : null;
  }

  insertTransaction(transaction: ShopTransaction): ShopTransaction {
    this.db.prepare(
      `INSERT INTO avatar_shop_transactions
         (id, account_id, idempotency_key, kind, status, request_json, before_json,
          result_json, error_code, error_message, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      transaction.id,
      transaction.accountId,
      transaction.idempotencyKey,
      transaction.kind,
      transaction.status,
      JSON.stringify(transaction.request),
      JSON.stringify(transaction.before),
      transaction.result === undefined ? null : JSON.stringify(transaction.result),
      transaction.errorCode ?? null,
      transaction.errorMessage ?? null,
      transaction.createdAt,
      transaction.updatedAt,
      transaction.completedAt ?? null,
    );
    return clone(transaction);
  }

  updateTransaction(id: string, patch: ShopTransactionPatch): ShopTransaction {
    const current = this.getTransactionById(id);
    if (!current) throw new Error(`Không tìm thấy avatar_shop_transactions transaction ${id}`);
    const updatedAt = patch.updatedAt ?? this.now();
    const status = patch.status ?? current.status;
    const completedAt = patch.completedAt !== undefined
      ? patch.completedAt
      : TERMINAL_STATUSES.has(status)
        ? current.completedAt ?? updatedAt
        : current.completedAt ?? null;
    const result = patch.result === undefined ? current.result : patch.result;
    const errorCode = patch.errorCode === undefined ? current.errorCode ?? null : patch.errorCode;
    const errorMessage = patch.errorMessage === undefined
      ? current.errorMessage ?? null
      : patch.errorMessage;

    this.db.prepare(
      `UPDATE avatar_shop_transactions
          SET status = ?, result_json = ?, error_code = ?, error_message = ?,
              updated_at = ?, completed_at = ?
        WHERE id = ?`,
    ).run(
      status,
      result === undefined ? null : JSON.stringify(result),
      errorCode,
      errorMessage,
      updatedAt,
      completedAt,
      id,
    );
    return this.getTransactionById(id)!;
  }

  listTransactions(accountId: number, limit: number): ShopTransaction[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('limit lịch sử shop phải là số nguyên từ 1 đến 100');
    }
    return this.db
      .prepare<[number, number], TransactionRow>(
        `SELECT * FROM avatar_shop_transactions
          WHERE account_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ?`,
      )
      .all(accountId, limit)
      .map(toTransaction);
  }

  recoverInterruptedTransactions(): number {
    const recoveredAt = this.now();
    return this.db.transaction(() => {
      const queued = this.db.prepare(
        `UPDATE avatar_shop_transactions
            SET status = 'failed', error_code = 'PROCESS_INTERRUPTED_BEFORE_SEND',
                error_message = 'Tiến trình dừng trước khi gửi lệnh shop',
                updated_at = ?, completed_at = ?
          WHERE status = 'queued'`,
      ).run(recoveredAt, recoveredAt);
      const sent = this.db.prepare(
        `UPDATE avatar_shop_transactions
            SET status = 'unknown', error_code = 'PROCESS_INTERRUPTED_AFTER_SEND',
                error_message = 'Không xác định kết quả lệnh shop sau khi tiến trình dừng',
                updated_at = ?, completed_at = ?
          WHERE status IN ('sending', 'awaiting_response', 'reconciling')`,
      ).run(recoveredAt, recoveredAt);
      return queued.changes + sent.changes;
    })();
  }

  private getTransactionById(id: string): ShopTransaction | null {
    const row = this.db
      .prepare<[string], TransactionRow>('SELECT * FROM avatar_shop_transactions WHERE id = ?')
      .get(id);
    return row ? toTransaction(row) : null;
  }
}
