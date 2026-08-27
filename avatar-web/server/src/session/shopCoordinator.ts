import crypto from 'node:crypto';

import type { AutoSellRule } from '../autoFarm.js';
import type { ShopPolicy } from '../config.js';
import type { GameClient } from '../game/client.js';
import type { InventoryItem } from '../game/farmData.js';
import type { FarmService } from '../game/farmService.js';
import type {
  DecodedShopPacket,
  OwnShopSlot,
  ShopProtocolEvent,
} from '../game/shopProtocol.js';
import {
  ShopRepository,
  type ProduceSnapshot,
  type ShopRuntimeState,
  type ShopTransaction,
  type ShopTransactionKind,
  type ShopTransactionStatus,
} from '../accounts/shopRepo.js';

export type ShopErrorCode =
  | 'INVALID_SHOP_REQUEST'
  | 'SHOP_CAPABILITY_DISABLED'
  | 'SESSION_OFFLINE'
  | 'STALE_STATE'
  | 'STALE_SHOP_STATE'
  | 'OPERATION_CONFLICT'
  | 'PRICE_OUT_OF_RANGE'
  | 'SHOP_RESPONSE_TIMEOUT'
  | 'SHOP_PROTOCOL_ERROR';

export class ShopError extends Error {
  constructor(
    readonly status: number,
    readonly code: ShopErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ShopError';
  }
}

export type AutoSellStopReason =
  | 'completed'
  | 'no-free-slot'
  | 'stopped'
  | 'uncertain-state';

export interface AutoSellRuleResult {
  itemId: number;
  listedLots: number;
  listedQuantity: number;
  skippedReason?: string;
}

export interface AutoSellCycleResult {
  startedAt: number;
  completedAt: number;
  collectedSoldSlots: number;
  withdrawnExpiredSlots: number;
  listedLots: number;
  stopReason: AutoSellStopReason;
  rules: AutoSellRuleResult[];
}

interface BaseWriteInput {
  idempotencyKey: string;
}

export interface CreateListingInput extends BaseWriteInput {
  slot: number;
  itemId: number;
  quantity: number;
  price: number;
  expectedShopRevision: number;
  expectedProduceRevision: number;
}

export interface WithdrawListingInput extends BaseWriteInput {
  slot: number;
  expectedShopRevision: number;
  expectedItemId: number;
  expectedQuantity: number;
  expectedPrice: number;
}

export interface PurchaseListingInput extends BaseWriteInput {
  idShop: number;
  verShop: number;
  expectedItemId: number;
  expectedQuantity: number;
  expectedPrice: number;
  expectedMarketRevision: number;
}

export interface UnlockSlotInput extends BaseWriteInput {
  type: number;
  expectedShopRevision: number;
}

export interface RefreshMarketInput extends BaseWriteInput {
  expectedMarketRevision: number;
}

export interface BrowseMarketItemInput {
  itemId: number;
  expectedMarketRevision: number;
}

export interface ShopCoordinatorDeps {
  accountId: number;
  repository: ShopRepository;
  policy: ShopPolicy;
  emit: (type: 'shop' | 'produce', payload: unknown) => void;
  now?: () => number;
  isAutomationRunning?: () => boolean;
  responseTimeoutMs?: number;
  minimumSendIntervalMs?: number;
  queueLimit?: number;
}

interface ShopRequestContext {
  marketItemId?: number;
  expectedMarketRevision?: number;
}

interface PendingShopResponse<T extends ShopProtocolEvent = ShopProtocolEvent> {
  epoch: number;
  expectedSubTypes: ReadonlySet<ShopProtocolEvent['subType']>;
  matches?: (event: ShopProtocolEvent) => event is T;
  context: ShopRequestContext;
  resolve: (event: T) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface PendingProduceResponse {
  epoch: number;
  previousRevision: number;
  resolve: (snapshot: ProduceSnapshot) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface ClientListeners {
  client: GameClient;
  shop: (payload: DecodedShopPacket) => void;
  shopError: (error: Error) => void;
  produce: (items: InventoryItem[]) => void;
}

type AutoCollectCandidate =
  | { kind: 'sold'; slot: OwnShopSlot }
  | { kind: 'expired'; slot: OwnShopSlot };

type AutoCollectResult = 'collected' | 'already-free';

const TERMINAL_STATUSES = new Set<ShopTransactionStatus>(['succeeded', 'failed', 'unknown']);

function defensiveClone<T>(value: T): T {
  return structuredClone(value);
}

function countItem(items: readonly InventoryItem[], itemId: number): number {
  return items.find((item) => item.id === itemId)?.num ?? 0;
}

function sameOwnSlot(actual: OwnShopSlot, expected: OwnShopSlot): boolean {
  return actual.slot === expected.slot
    && actual.itemId === expected.itemId
    && actual.quantity === expected.quantity
    && actual.price === expected.price;
}

function requireInteger(
  value: number,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ShopError(
      400,
      'INVALID_SHOP_REQUEST',
      `${label} phải là số nguyên trong [${minimum}, ${maximum}]`,
    );
  }
  return value;
}

function validateIdempotencyKey(value: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new ShopError(
      400,
      'INVALID_SHOP_REQUEST',
      'idempotencyKey phải là chuỗi không rỗng, tối đa 128 ký tự',
    );
  }
  return value;
}

function asShopError(error: unknown): ShopError {
  if (error instanceof ShopError) return error;
  const message = error instanceof Error ? error.message : 'Lỗi điều phối sạp không xác định';
  return new ShopError(500, 'SHOP_PROTOCOL_ERROR', message);
}

export class ShopCoordinator {
  private readonly accountId: number;
  private readonly repository: ShopRepository;
  private readonly policy: ShopPolicy;
  private readonly emitEvent: ShopCoordinatorDeps['emit'];
  private readonly now: () => number;
  private readonly isAutomationRunning: () => boolean;
  private readonly responseTimeoutMs: number;
  private readonly minimumSendIntervalMs: number;
  private readonly queueLimit: number;

  private client: GameClient | null = null;
  private connectionEpoch = 0;
  private listeners: ClientListeners | null = null;
  private pendingShop: PendingShopResponse | null = null;
  private pendingProduce: PendingProduceResponse | null = null;
  private queueTail: Promise<void> = Promise.resolve();
  private queueDepth = 0;
  private lastShopSendAt = 0;
  private readonly syncedEpochs = new Set<number>();
  private attachmentGeneration = 0;
  private marketFreshAttachmentGeneration: number | null = null;
  private shopChannelBlockedReason: string | null = null;
  private produce: ProduceSnapshot | null;
  private runtime: ShopRuntimeState;
  private isExecutingAutoSell = false;

  constructor(deps: ShopCoordinatorDeps) {
    this.accountId = deps.accountId;
    this.repository = deps.repository;
    this.policy = deps.policy;
    this.emitEvent = deps.emit;
    this.now = deps.now ?? Date.now;
    this.isAutomationRunning = deps.isAutomationRunning ?? (() => false);
    this.responseTimeoutMs = deps.responseTimeoutMs ?? 10_000;
    this.minimumSendIntervalMs = deps.minimumSendIntervalMs ?? 300;
    this.queueLimit = deps.queueLimit ?? 8;

    const cache = this.repository.loadCache(this.accountId);
    this.produce = cache?.produce ?? null;
    const capabilities = {
      readEnabled: this.policy.readEnabled,
      writeEnabled: this.policy.writeEnabled,
      purchaseEnabled: this.policy.purchaseEnabled,
      slotUnlockEnabled: this.policy.slotUnlockEnabled,
      marketRefreshEnabled: this.policy.marketRefreshEnabled,
      liveAccountAllowed: this.isLiveAccountAllowed(),
    };
    this.runtime = {
      syncStatus: cache ? 'stale' : 'idle',
      own: cache?.own ?? null,
      market: cache?.market ?? null,
      priceRules: cache?.priceRules ?? null,
      activeTransaction: null,
      recentTransactions: this.repository.listTransactions(this.accountId, 20),
      capabilities,
    };
  }

  attachClient(client: GameClient, connectionEpoch: number): void {
    requireInteger(connectionEpoch, 'connectionEpoch');
    if (this.client) this.detachClient('Thay thế game client');
    this.client = client;
    this.connectionEpoch = connectionEpoch;
    this.attachmentGeneration += 1;
    this.marketFreshAttachmentGeneration = null;
    this.shopChannelBlockedReason = null;
    const shop = (payload: DecodedShopPacket) => this.onShopProtocol(client, connectionEpoch, payload);
    const shopError = (error: Error) => this.onShopProtocolError(client, connectionEpoch, error);
    const produce = (items: InventoryItem[]) => this.onProduce(client, connectionEpoch, items);
    client.on('shop-protocol', shop);
    client.on('shop-protocol-error', shopError);
    client.on('produce', produce);
    this.listeners = { client, shop, shopError, produce };
    this.runtime = {
      ...this.runtime,
      syncStatus: this.runtime.own || this.runtime.market || this.produce ? 'stale' : 'idle',
      lastError: undefined,
    };
    this.emitShop();
  }

  detachClient(reason: string): void {
    this.removeClientListeners();
    this.client = null;
    this.marketFreshAttachmentGeneration = null;
    const error = new ShopError(409, 'SESSION_OFFLINE', reason || 'Phiên game đã ngắt kết nối');
    this.rejectPending(error);
    const active = this.runtime.activeTransaction;
    if (active && !TERMINAL_STATUSES.has(active.status)) {
      if (active.status === 'queued') {
        this.transition(active.id, 'failed', {
          errorCode: 'SESSION_OFFLINE',
          errorMessage: error.message,
        });
      } else {
        this.transition(active.id, 'unknown', {
          errorCode: 'SESSION_OFFLINE',
          errorMessage: 'Mất kết nối sau khi có thể đã gửi lệnh; không tự gửi lại',
        });
      }
    }
    this.runtime = {
      ...this.runtime,
      syncStatus: this.runtime.own || this.runtime.market || this.produce ? 'stale' : 'idle',
      activeTransaction: null,
      lastError: { code: error.code, message: error.message },
    };
    this.emitShop();
  }

  state(): ShopRuntimeState {
    return defensiveClone(this.runtime);
  }

  produceState(): ProduceSnapshot | null {
    return this.produce ? defensiveClone(this.produce) : null;
  }

  listTransactions(limit: number): ShopTransaction[] {
    return defensiveClone(this.repository.listTransactions(this.accountId, limit));
  }

  isBusy(): boolean {
    return this.queueDepth > 0 || this.pendingShop !== null || this.pendingProduce !== null;
  }

  hasInFlightShopOperation(): boolean {
    return this.isBusy();
  }

  assertIdleForAutomation(): void {
    if (this.hasInFlightShopOperation()) {
      throw new ShopError(409, 'OPERATION_CONFLICT', 'Sạp đang đồng bộ hoặc xử lý giao dịch');
    }
  }

  async syncOwnShop(): Promise<ShopRuntimeState> {
    this.assertReadAllowed();
    const epoch = this.assertOnlineAndIdle();
    this.setSyncStatus('syncing');
    try {
      return await this.enqueue('sync-own-shop', async () => {
        this.assertEpoch(epoch);
        await this.syncOwnShopInLane();
        return this.state();
      });
    } catch (error) {
      this.setRuntimeError(asShopError(error));
      throw error;
    }
  }

  async browseMarketCatalog(): Promise<ShopRuntimeState> {
    this.assertReadAllowed();
    const epoch = this.assertOnlineAndIdle();
    try {
      return await this.enqueue('browse-market-catalog', async () => {
        this.assertEpoch(epoch);
        await this.browseMarketCatalogInLane();
        this.setSyncStatus('ready');
        return this.state();
      });
    } catch (error) {
      this.setRuntimeError(asShopError(error));
      throw error;
    }
  }

  browseMarket(): Promise<ShopRuntimeState> {
    return this.browseMarketCatalog();
  }

  async browseMarketItem(input: BrowseMarketItemInput): Promise<ShopRuntimeState> {
    requireInteger(input.itemId, 'itemId', 0, 32_767);
    requireInteger(input.expectedMarketRevision, 'expectedMarketRevision');
    this.assertReadAllowed();
    const epoch = this.assertOnlineAndIdle();
    this.requireBrowseMarketItem(input);
    try {
      return await this.enqueue('browse-market-item', async () => {
        this.assertEpoch(epoch);
        this.requireBrowseMarketItem(input);
        await this.browseMarketItemInLane(input);
        this.setSyncStatus('ready');
        return this.state();
      });
    } catch (error) {
      const normalized = asShopError(error);
      if (normalized.code !== 'STALE_SHOP_STATE') this.setRuntimeError(normalized);
      throw error;
    }
  }

  createListing(input: CreateListingInput): ShopTransaction {
    this.validateCreateListingInput(input);
    const replay = this.findReplay(input.idempotencyKey);
    if (replay) return replay;
    this.assertWriteAllowed('writeEnabled');
    const epoch = this.assertOnlineAndIdle();
    const own = this.requireOwnRevision(input.expectedShopRevision);
    const produce = this.requireProduceRevision(input.expectedProduceRevision);
    if (input.slot >= own.data.numSlot) this.stale('Slot đăng bán không còn tồn tại');
    const occupied = own.data.slots.find((slot) => slot.slot === input.slot);
    if (occupied && occupied.itemId >= 0 && occupied.quantity > 0) {
      this.stale('Slot đăng bán không còn trống');
    }
    if (countItem(produce.items, input.itemId) < input.quantity) {
      this.stale('Số lượng nông sản trong kho không còn đủ');
    }
    const rule = this.runtime.priceRules?.data.find((item) => item.itemId === input.itemId);
    if (!rule) this.stale('Chưa có price rule hiện hành cho nông sản');
    if (input.price < rule.minPrice || input.price > rule.maxPrice) {
      throw new ShopError(
        409,
        'PRICE_OUT_OF_RANGE',
        `Giá phải nằm trong khoảng ${rule.minPrice}–${rule.maxPrice}`,
      );
    }
    const transaction = this.createTransaction('list', { ...input }, this.captureBefore());
    this.scheduleTransaction(transaction, epoch, (id) => this.runListing(id, input));
    return transaction;
  }

  withdrawListing(input: WithdrawListingInput): ShopTransaction {
    this.validateWithdrawInput(input);
    const replay = this.findReplay(input.idempotencyKey);
    if (replay) return replay;
    this.assertWriteAllowed('writeEnabled');
    const epoch = this.assertOnlineAndIdle();
    const own = this.requireOwnRevision(input.expectedShopRevision);
    const slot = own.data.slots.find((candidate) => candidate.slot === input.slot);
    if (
      !slot
      || slot.itemId !== input.expectedItemId
      || slot.quantity !== input.expectedQuantity
      || slot.price !== input.expectedPrice
    ) {
      this.stale('Listing cần rút không còn khớp snapshot');
    }
    const transaction = this.createTransaction('withdraw', { ...input }, this.captureBefore());
    this.scheduleTransaction(transaction, epoch, (id) => this.runWithdraw(id, input));
    return transaction;
  }

  purchaseListing(input: PurchaseListingInput): ShopTransaction {
    this.validatePurchaseInput(input);
    const replay = this.findReplay(input.idempotencyKey);
    if (replay) return replay;
    this.assertWriteAllowed('purchaseEnabled');
    const epoch = this.assertOnlineAndIdle();
    const market = this.requireMarketRevision(input.expectedMarketRevision);
    if (market.data.selectedItemId !== input.expectedItemId) {
      this.stale('Listing cần mua không thuộc nông sản đang chọn');
    }
    const listing = market.data.listings.find(
      (candidate) => candidate.idShop === input.idShop && candidate.verShop === input.verShop,
    );
    if (
      !listing
      || listing.itemId !== input.expectedItemId
      || listing.quantity !== input.expectedQuantity
      || listing.price !== input.expectedPrice
    ) {
      this.stale('Listing cần mua không còn khớp snapshot');
    }
    const transaction = this.createTransaction('purchase', { ...input }, this.captureBefore());
    this.scheduleTransaction(transaction, epoch, (id) => this.runPurchase(id, input));
    return transaction;
  }

  unlockSlot(input: UnlockSlotInput): ShopTransaction {
    this.validateUnlockInput(input);
    const replay = this.findReplay(input.idempotencyKey);
    if (replay) return replay;
    this.assertWriteAllowed('slotUnlockEnabled');
    const epoch = this.assertOnlineAndIdle();
    this.requireOwnRevision(input.expectedShopRevision);
    const transaction = this.createTransaction('unlock', { ...input }, this.captureBefore());
    this.scheduleTransaction(transaction, epoch, (id) => this.runUnlock(id, input));
    return transaction;
  }

  refreshMarket(input: RefreshMarketInput): ShopTransaction {
    this.validateRefreshInput(input);
    const replay = this.findReplay(input.idempotencyKey);
    if (replay) return replay;
    this.assertWriteAllowed('marketRefreshEnabled');
    const epoch = this.assertOnlineAndIdle();
    this.requireMarketRevision(input.expectedMarketRevision);
    const transaction = this.createTransaction('refresh-market', { ...input }, this.captureBefore());
    this.scheduleTransaction(transaction, epoch, (id) => this.runRefreshMarket(id, input));
    return transaction;
  }

  async runAutoSellCycle(
    rules: readonly AutoSellRule[],
    runId: string,
    shouldStop: () => boolean,
  ): Promise<AutoSellCycleResult> {
    return this.enqueue('auto-sell-cycle', async () => {
      this.isExecutingAutoSell = true;
      const startedAt = this.now();
      let collectedSoldSlots = 0;
      let withdrawnExpiredSlots = 0;
      let totalListedLots = 0;
      let stopReason: AutoSellStopReason = 'completed';
      const ruleResults: AutoSellRuleResult[] = [];

      try {
        if (!this.policy.writeEnabled) {
          return {
            startedAt,
            completedAt: this.now(),
            collectedSoldSlots,
            withdrawnExpiredSlots,
            listedLots: 0,
            stopReason: 'completed',
            rules: [],
          };
        }

        try {
          await this.syncOwnShopInLane();
        } catch (error) {
          const normalized = asShopError(error);
          return {
            startedAt,
            completedAt: this.now(),
            collectedSoldSlots,
            withdrawnExpiredSlots,
            listedLots: 0,
            stopReason: 'uncertain-state',
            rules: [],
          };
        }

        try {
          await this.browseMarketCatalogInLane();
        } catch (error) {
          const normalized = asShopError(error);
          try {
            this.client?.emit('log', JSON.stringify({
              scope: 'auto-sell-market-sync',
              code: normalized.code,
              message: normalized.message,
            }));
          } catch {
            /* log best-effort không được làm hỏng vòng auto-sell */
          }
        }

        const collectCandidates: AutoCollectCandidate[] = (this.runtime.own?.data.slots ?? [])
          .flatMap((slot): AutoCollectCandidate[] => {
            if (slot.isSale) return [{ kind: 'sold', slot: { ...slot } }];
            if (slot.isTimeOut) return [{ kind: 'expired', slot: { ...slot } }];
            return [];
          })
          .sort((left, right) => left.slot.slot - right.slot.slot);

        for (const candidate of collectCandidates) {
          if (shouldStop()) {
            stopReason = 'stopped';
            break;
          }
          try {
            const result = await this.collectAutoSellSlot(candidate, runId);
            if (result === 'collected') {
              if (candidate.kind === 'sold') collectedSoldSlots += 1;
              else withdrawnExpiredSlots += 1;
            }
          } catch {
            stopReason = 'uncertain-state';
            break;
          }
        }

        if (stopReason !== 'completed') {
          return {
            startedAt,
            completedAt: this.now(),
            collectedSoldSlots,
            withdrawnExpiredSlots,
            listedLots: totalListedLots,
            stopReason,
            rules: ruleResults,
          };
        }

        const ownSlots = this.runtime.own?.data.slots ?? [];
        const numSlot = this.runtime.own?.data.numSlot ?? 0;
        const freeSlots: number[] = [];
        for (let s = 0; s < numSlot; s++) {
          const slotItem = ownSlots.find((item) => item.slot === s);
          if (!slotItem || slotItem.itemId === -1 || slotItem.quantity <= 0) {
            freeSlots.push(s);
          }
        }

        for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
          const rule = rules[ruleIndex];
          const ruleResult: AutoSellRuleResult = {
            itemId: rule.itemId,
            listedLots: 0,
            listedQuantity: 0,
          };
          ruleResults.push(ruleResult);

          if (shouldStop()) {
            stopReason = 'stopped';
            break;
          }

          const priceRule = this.runtime.priceRules?.data.find(
            (pr) => pr.itemId === rule.itemId,
          );
          if (!priceRule) {
            ruleResult.skippedReason = 'Không có price rule';
            continue;
          }

          if (rule.price < priceRule.minPrice || rule.price > priceRule.maxPrice) {
            ruleResult.skippedReason = 'Giá ngoài khoảng quy định';
            continue;
          }

          let lotIndex = 0;

          while (freeSlots.length > 0) {
            if (shouldStop()) {
              stopReason = 'stopped';
              break;
            }

            const availableProduce = countItem(
              this.produce?.items ?? [],
              rule.itemId,
            );
            if (availableProduce < rule.quantity) {
              break;
            }

            const idempotencyKey = `auto-sell:${this.accountId}:${runId}:${ruleIndex}:${lotIndex}`;

            const replay = this.findReplay(idempotencyKey);
            if (replay && replay.status === 'succeeded') {
              ruleResult.listedLots += 1;
              ruleResult.listedQuantity += rule.quantity;
              totalListedLots += 1;
              lotIndex += 1;
              continue;
            }

            const targetSlot = freeSlots.shift()!;

            const beforeProduce = countItem(
              this.produce?.items ?? [],
              rule.itemId,
            );
            const transaction = this.createTransaction(
              'list',
              {
                idempotencyKey,
                slot: targetSlot,
                itemId: rule.itemId,
                quantity: rule.quantity,
                price: rule.price,
                expectedShopRevision: this.runtime.own?.revision ?? 0,
                expectedProduceRevision: this.produce?.revision ?? 0,
              },
              this.captureBefore(),
            );

            try {
              this.transition(transaction.id, 'sending');
              const ack = await this.request<
                Extract<ShopProtocolEvent, { subType: 3 }>
              >(
                3,
                (farm) => {
                  farm.addItemToShop(
                    targetSlot,
                    rule.itemId,
                    rule.quantity,
                    rule.price,
                  );
                  this.transition(transaction.id, 'awaiting_response');
                },
                (event) => event.slot === targetSlot,
              );

              if (
                ack.itemId !== rule.itemId ||
                ack.quantity !== rule.quantity ||
                ack.price !== rule.price
              ) {
                this.transition(transaction.id, 'unknown', {
                  errorCode: 'SHOP_PROTOCOL_ERROR',
                  errorMessage: 'Phản hồi đăng bán không khớp request',
                });
                stopReason = 'uncertain-state';
                break;
              }

              this.transition(transaction.id, 'reconciling', { result: { ack } });
              await this.syncOwnShopInLane();

              const afterSlot = this.runtime.own?.data.slots.find(
                (slot) => slot.slot === targetSlot,
              );
              const afterProduce = countItem(
                this.produce?.items ?? [],
                rule.itemId,
              );

              if (
                !afterSlot ||
                afterSlot.itemId !== rule.itemId ||
                afterSlot.quantity !== rule.quantity ||
                afterSlot.price !== rule.price ||
                afterProduce > beforeProduce - rule.quantity
              ) {
                this.transition(transaction.id, 'unknown', {
                  errorCode: 'SHOP_PROTOCOL_ERROR',
                  errorMessage: 'Chưa đủ bằng chứng xác nhận đăng bán',
                });
                stopReason = 'uncertain-state';
                break;
              }

              this.transition(transaction.id, 'succeeded', {
                result: { ack, own: this.runtime.own, produce: this.produce },
              });

              ruleResult.listedLots += 1;
              ruleResult.listedQuantity += rule.quantity;
              totalListedLots += 1;
              lotIndex += 1;
            } catch (error) {
              const normalized = asShopError(error);
              const currentTx = this.repository.findTransaction(
                this.accountId,
                idempotencyKey,
              );
              if (currentTx && !TERMINAL_STATUSES.has(currentTx.status)) {
                const sent = currentTx.status !== 'queued';
                this.transition(transaction.id, sent ? 'unknown' : 'failed', {
                  errorCode: normalized.code,
                  errorMessage: sent
                    ? `${normalized.message}; không tự gửi lại giao dịch`
                    : normalized.message,
                });
              }
              stopReason = 'uncertain-state';
              break;
            }
          }

          if (stopReason !== 'completed') {
            break;
          }

          if (freeSlots.length === 0) {
            stopReason = 'no-free-slot';
            break;
          }
        }

        return {
          startedAt,
          completedAt: this.now(),
          collectedSoldSlots,
          withdrawnExpiredSlots,
          listedLots: totalListedLots,
          stopReason,
          rules: ruleResults,
        };
      } finally {
        this.isExecutingAutoSell = false;
      }
    });
  }

  private enqueue<T>(label: string, run: () => Promise<T>): Promise<T> {
    if (this.queueDepth >= this.queueLimit) {
      throw new ShopError(409, 'OPERATION_CONFLICT', `Hàng đợi sạp đã đầy khi thêm ${label}`);
    }
    this.queueDepth += 1;
    const task = this.queueTail.then(run, run);
    this.queueTail = task.then(
      () => undefined,
      () => undefined,
    );
    return task.finally(() => {
      this.queueDepth -= 1;
    });
  }

  private request<T extends ShopProtocolEvent>(
    expectedSubType: T['subType'],
    send: (farm: FarmService) => void,
    matches?: (event: T) => boolean,
    context: ShopRequestContext = {},
  ): Promise<T> {
    const typedMatches = matches
      ? (event: ShopProtocolEvent): event is T => (
        event.subType === expectedSubType && matches(event as T)
      )
      : undefined;
    return this.requestForSubTypes(
      new Set([expectedSubType]),
      send,
      typedMatches,
      context,
    ) as Promise<T>;
  }

  private async requestForSubTypes(
    expectedSubTypes: ReadonlySet<ShopProtocolEvent['subType']>,
    send: (farm: FarmService) => void,
    matches?: (event: ShopProtocolEvent) => event is ShopProtocolEvent,
    context: ShopRequestContext = {},
  ): Promise<ShopProtocolEvent> {
    this.assertShopChannelSynchronized();
    if (this.pendingShop) {
      throw new ShopError(409, 'OPERATION_CONFLICT', 'Đã có cmd 103 đang chờ phản hồi');
    }
    const client = this.requireOnlineClient();
    const epoch = this.connectionEpoch;
    await this.waitForShopSendWindow();
    this.assertEpoch(epoch);
    this.assertShopChannelSynchronized();
    return new Promise<ShopProtocolEvent>((resolve, reject) => {
      let sent = false;
      const timer = setTimeout(() => {
        if (this.pendingShop?.timer !== timer) return;
        this.pendingShop = null;
        const error = new ShopError(504, 'SHOP_RESPONSE_TIMEOUT', 'Hết thời gian chờ phản hồi cmd 103');
        if (sent) this.blockShopChannel(error);
        reject(error);
      }, this.responseTimeoutMs);
      this.pendingShop = { epoch, expectedSubTypes, matches, context, resolve, reject, timer };
      try {
        send(client.farm);
        sent = true;
        this.lastShopSendAt = this.now();
      } catch (error) {
        clearTimeout(timer);
        this.pendingShop = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private requestProduce(send: (farm: FarmService) => void): Promise<ProduceSnapshot> {
    if (this.pendingProduce) {
      throw new ShopError(409, 'OPERATION_CONFLICT', 'Đã có cmd 70 đang chờ phản hồi');
    }
    const client = this.requireOnlineClient();
    const epoch = this.connectionEpoch;
    const previousRevision = this.produce?.revision ?? 0;
    return new Promise<ProduceSnapshot>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingProduce?.timer !== timer) return;
        this.pendingProduce = null;
        reject(new ShopError(504, 'SHOP_RESPONSE_TIMEOUT', 'Hết thời gian chờ kho nông sản cmd 70'));
      }, this.responseTimeoutMs);
      this.pendingProduce = { epoch, previousRevision, resolve, reject, timer };
      try {
        send(client.farm);
      } catch (error) {
        clearTimeout(timer);
        this.pendingProduce = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private async syncOwnShopInLane(): Promise<void> {
    await this.request<Extract<ShopProtocolEvent, { subType: 0 }>>(
      0,
      (farm) => farm.openShop(0, -1, -1),
    );
    await this.request<Extract<ShopProtocolEvent, { subType: 8 }>>(8, (farm) => farm.getShopItems());
    await this.requestProduce((farm) => farm.getInventory());
    this.setSyncStatus(
      this.runtime.market && !this.isMarketFreshForCurrentAttachment() ? 'stale' : 'ready',
    );
    if (!this.syncedEpochs.has(this.connectionEpoch)) {
      this.syncedEpochs.add(this.connectionEpoch);
      this.reconcileUnknownTransactions();
    }
  }

  private async browseMarketCatalogInLane(): Promise<void> {
    await this.request<Extract<ShopProtocolEvent, { kind: 'market-catalog' }>>(
      1,
      (farm) => farm.openShop(1, 0, -1),
      (event) => event.kind === 'market-catalog',
    );
  }

  private async browseMarketItemInLane(input: BrowseMarketItemInput): Promise<void> {
    await this.request<Extract<ShopProtocolEvent, { kind: 'market-listings' }>>(
      1,
      (farm) => {
        this.requireBrowseMarketItem(input);
        farm.openShop(1, 1, input.itemId);
      },
      (event) => event.kind === 'market-listings',
      {
        marketItemId: input.itemId,
        expectedMarketRevision: input.expectedMarketRevision,
      },
    );
  }

  private scheduleTransaction(
    transaction: ShopTransaction,
    epoch: number,
    run: (transactionId: string) => Promise<Record<string, unknown>>,
  ): void {
    let task: Promise<void>;
    try {
      task = this.enqueue(`transaction:${transaction.kind}`, async () => {
        this.assertEpoch(epoch);
        this.assertNoAutomation();
        this.setActiveTransaction(transaction.id);
        try {
          const result = await run(transaction.id);
          this.transition(transaction.id, 'succeeded', { result });
        } catch (error) {
          const normalized = asShopError(error);
          const current = this.repository.findTransaction(this.accountId, transaction.idempotencyKey);
          if (current && !TERMINAL_STATUSES.has(current.status)) {
            const sent = current.status !== 'queued';
            this.transition(transaction.id, sent ? 'unknown' : 'failed', {
              errorCode: normalized.code,
              errorMessage: sent
                ? `${normalized.message}; không tự gửi lại giao dịch`
                : normalized.message,
            });
          }
        } finally {
          this.runtime = { ...this.runtime, activeTransaction: null };
          this.emitShop();
        }
      });
    } catch (error) {
      const normalized = asShopError(error);
      this.transition(transaction.id, 'failed', {
        errorCode: normalized.code,
        errorMessage: normalized.message,
      });
      return;
    }
    void task.catch(() => undefined);
  }

  private async collectAutoSellSlot(
    candidate: AutoCollectCandidate,
    runId: string,
  ): Promise<AutoCollectResult> {
    const { slot } = candidate;
    const current = this.runtime.own?.data.slots.find((item) => item.slot === slot.slot);
    if (!current || current.itemId === -1 || current.quantity <= 0) return 'already-free';
    if (!sameOwnSlot(current, slot)) {
      throw new ShopError(409, 'STALE_SHOP_STATE', `Slot ${slot.slot} đã đổi trước khi thu sạp`);
    }
    const stateMatches = candidate.kind === 'sold'
      ? current.isSale
      : !current.isSale && current.isTimeOut;
    if (!stateMatches) {
      throw new ShopError(
        409,
        'STALE_SHOP_STATE',
        `Trạng thái slot ${slot.slot} đã đổi trước khi thu sạp`,
      );
    }

    const idempotencyKey = `auto-sell-collect:${this.accountId}:${runId}:${slot.slot}:${candidate.kind}`;
    const replay = this.findReplay(idempotencyKey);
    if (replay?.status === 'succeeded') return 'already-free';
    if (replay) {
      throw new ShopError(
        409,
        'STALE_SHOP_STATE',
        `Giao dịch thu slot ${slot.slot} chưa ở trạng thái an toàn`,
      );
    }

    const beforeProduce = countItem(this.produce?.items ?? [], slot.itemId);
    const transaction = this.createTransaction(
      'withdraw',
      {
        idempotencyKey,
        slot: slot.slot,
        expectedShopRevision: this.runtime.own?.revision ?? 0,
        expectedItemId: slot.itemId,
        expectedQuantity: slot.quantity,
        expectedPrice: slot.price,
        autoCollectKind: candidate.kind,
      },
      this.captureBefore(),
    );

    try {
      this.transition(transaction.id, 'sending');
      const ack = await this.request<Extract<ShopProtocolEvent, { subType: 4 }>>(
        4,
        (farm) => {
          farm.takeItemBack(slot.slot);
          this.transition(transaction.id, 'awaiting_response');
        },
        (event) => event.slot === slot.slot,
      );
      const ackMatches = candidate.kind === 'sold'
        ? ack.result === 0
        : ack.result === 1 && ack.itemId === slot.itemId;
      if (!ackMatches) {
        throw new ShopError(
          500,
          'SHOP_PROTOCOL_ERROR',
          `Phản hồi thu slot ${slot.slot} không khớp trạng thái`,
        );
      }

      this.transition(transaction.id, 'reconciling', { result: { ack } });
      await this.syncOwnShopInLane();
      const afterSlot = this.runtime.own?.data.slots.find((item) => item.slot === slot.slot);
      const stillSame = afterSlot && sameOwnSlot(afterSlot, slot)
        && (candidate.kind === 'sold' ? afterSlot.isSale : afterSlot.isTimeOut);
      const afterProduce = countItem(this.produce?.items ?? [], slot.itemId);
      if (stillSame || (candidate.kind === 'expired' && afterProduce < beforeProduce + slot.quantity)) {
        throw new ShopError(
          500,
          'SHOP_PROTOCOL_ERROR',
          `Chưa đủ bằng chứng xác nhận thu slot ${slot.slot}`,
        );
      }

      this.transition(transaction.id, 'succeeded', {
        result: {
          ack,
          autoCollectKind: candidate.kind,
          own: this.runtime.own,
          produce: this.produce,
        },
      });
      return 'collected';
    } catch (error) {
      const normalized = asShopError(error);
      const currentTransaction = this.repository.findTransaction(
        this.accountId,
        idempotencyKey,
      );
      if (currentTransaction && !TERMINAL_STATUSES.has(currentTransaction.status)) {
        const sent = currentTransaction.status !== 'queued';
        this.transition(transaction.id, sent ? 'unknown' : 'failed', {
          errorCode: normalized.code,
          errorMessage: sent
            ? `${normalized.message}; không tự gửi lại giao dịch`
            : normalized.message,
        });
      }
      throw normalized;
    }
  }

  private async runListing(id: string, input: CreateListingInput): Promise<Record<string, unknown>> {
    const beforeProduce = countItem(this.produce?.items ?? [], input.itemId);
    this.requireOnlineClient();
    this.transition(id, 'sending');
    const ack = await this.request<Extract<ShopProtocolEvent, { subType: 3 }>>(
      3,
      (farm) => {
        farm.addItemToShop(input.slot, input.itemId, input.quantity, input.price);
        this.transition(id, 'awaiting_response');
      },
      (event) => event.slot === input.slot,
    );
    if (
      ack.itemId !== input.itemId
      || ack.quantity !== input.quantity
      || ack.price !== input.price
    ) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Phản hồi đăng bán không khớp request');
    }
    this.transition(id, 'reconciling', { result: { ack } });
    await this.syncOwnShopInLane();
    const afterSlot = this.runtime.own?.data.slots.find((slot) => slot.slot === input.slot);
    const afterProduce = countItem(this.produce?.items ?? [], input.itemId);
    if (
      !afterSlot
      || afterSlot.itemId !== input.itemId
      || afterSlot.quantity !== input.quantity
      || afterSlot.price !== input.price
      || afterProduce > beforeProduce - input.quantity
    ) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Chưa đủ bằng chứng xác nhận đăng bán');
    }
    return { ack, own: this.runtime.own, produce: this.produce };
  }

  private async runWithdraw(id: string, input: WithdrawListingInput): Promise<Record<string, unknown>> {
    const beforeProduce = countItem(this.produce?.items ?? [], input.expectedItemId);
    this.requireOnlineClient();
    this.transition(id, 'sending');
    const ack = await this.request<Extract<ShopProtocolEvent, { subType: 4 }>>(
      4,
      (farm) => {
        farm.takeItemBack(input.slot);
        this.transition(id, 'awaiting_response');
      },
      (event) => event.slot === input.slot,
    );
    this.transition(id, 'reconciling', { result: { ack } });
    await this.syncOwnShopInLane();
    const afterSlot = this.runtime.own?.data.slots.find((slot) => slot.slot === input.slot);
    const afterProduce = countItem(this.produce?.items ?? [], input.expectedItemId);
    if (
      ack.result !== 1
      || ack.itemId !== input.expectedItemId
      || (afterSlot?.itemId === input.expectedItemId && afterSlot.quantity === input.expectedQuantity)
      || afterProduce < beforeProduce + input.expectedQuantity
    ) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Chưa đủ bằng chứng xác nhận rút listing');
    }
    return { ack, own: this.runtime.own, produce: this.produce };
  }

  private async runPurchase(id: string, input: PurchaseListingInput): Promise<Record<string, unknown>> {
    const beforeProduce = countItem(this.produce?.items ?? [], input.expectedItemId);
    this.requireOnlineClient();
    this.transition(id, 'sending');
    const ack = await this.request<Extract<ShopProtocolEvent, { subType: 5 }>>(
      5,
      (farm) => {
        farm.buyFromShop(input.idShop, input.verShop);
        this.transition(id, 'awaiting_response');
      },
      (event) => event.itemId === input.expectedItemId,
    );
    this.transition(id, 'reconciling', { result: { ack } });
    await this.browseMarketItemInLane({
      itemId: input.expectedItemId,
      expectedMarketRevision: input.expectedMarketRevision,
    });
    await this.requestProduce((farm) => farm.getInventory());
    const market = this.runtime.market;
    const listingStillPresent = market?.data.selectedItemId === input.expectedItemId
      ? market.data.listings.some(
        (listing) => listing.idShop === input.idShop && listing.verShop === input.verShop,
      )
      : true;
    const afterProduce = countItem(this.produce?.items ?? [], input.expectedItemId);
    if (listingStillPresent || afterProduce < beforeProduce + input.expectedQuantity) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Chưa đủ bằng chứng xác nhận mua listing');
    }
    return { ack, market: this.runtime.market, produce: this.produce };
  }

  private async runUnlock(id: string, input: UnlockSlotInput): Promise<Record<string, unknown>> {
    const beforeNumSlot = this.runtime.own?.data.numSlot ?? 0;
    this.requireOnlineClient();
    this.transition(id, 'sending');
    const ack = await this.request<Extract<ShopProtocolEvent, { subType: 2; state: 1 }>>(
      2,
      (farm) => {
        farm.unlockShopSlot(input.type);
        this.transition(id, 'awaiting_response');
      },
      (event) => event.kind === 'slot-opened' && event.type === input.type,
    );
    if (ack.kind !== 'slot-opened') {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Server chưa xác nhận mở slot');
    }
    this.transition(id, 'reconciling', { result: { ack } });
    await this.request<Extract<ShopProtocolEvent, { subType: 0 }>>(
      0,
      (farm) => farm.openShop(0, -1, -1),
    );
    if ((this.runtime.own?.data.numSlot ?? 0) <= beforeNumSlot) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Số slot không tăng sau phản hồi mở slot');
    }
    return { ack, own: this.runtime.own };
  }

  private async runRefreshMarket(
    id: string,
    input: RefreshMarketInput,
  ): Promise<Record<string, unknown>> {
    const beforeRevision = input.expectedMarketRevision;
    this.requireOnlineClient();
    this.transition(id, 'sending');
    const ackPromise = this.requestForSubTypes(new Set([6, 7]), (farm) => {
      farm.refreshShop();
      this.transition(id, 'awaiting_response');
    });
    const ack = await ackPromise;
    this.transition(id, 'reconciling', { result: { ack } });
    await this.browseMarketCatalogInLane();
    await this.requestProduce((farm) => farm.getInventory());
    if ((this.runtime.market?.revision ?? 0) <= beforeRevision) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', 'Market chưa đổi revision sau refresh');
    }
    return { ack, market: this.runtime.market, produce: this.produce };
  }

  private onShopProtocol(
    client: GameClient,
    epoch: number,
    payload: DecodedShopPacket,
  ): void {
    if (client !== this.client || epoch !== this.connectionEpoch) return;
    if (this.shopChannelBlockedReason !== null) {
      client.emit('log', JSON.stringify({
        scope: 'shop-protocol',
        code: 'SHOP_PROTOCOL_ERROR',
        message: 'Bỏ qua cmd 103 vì channel đang mất đồng bộ',
      }));
      return;
    }
    const pending = this.pendingShop;
    const matchesPending = pending !== null
      && pending.epoch === epoch
      && pending.expectedSubTypes.has(payload.event.subType)
      && (!pending.matches || pending.matches(payload.event));
    try {
      this.applyProtocolEvent(
        payload.event,
        epoch,
        matchesPending ? pending.context : undefined,
      );
    } catch (error) {
      const normalized = asShopError(error);
      client.emit('log', JSON.stringify({
        scope: 'shop-protocol',
        code: normalized.code,
        message: normalized.message,
      }));
      if (matchesPending) {
        if (normalized.code === 'SHOP_PROTOCOL_ERROR') this.blockShopChannel(normalized);
        this.rejectShopPending(normalized);
      }
      return;
    }
    if (!matchesPending) return;
    clearTimeout(pending.timer);
    this.pendingShop = null;
    pending.resolve(payload.event);
  }

  private onShopProtocolError(client: GameClient, epoch: number, error: Error): void {
    if (client !== this.client || epoch !== this.connectionEpoch) return;
    const normalized = new ShopError(
      500,
      'SHOP_PROTOCOL_ERROR',
      error.message || 'Packet cmd 103 không hợp lệ',
    );
    this.blockShopChannel(normalized);
    this.rejectShopPending(normalized);
  }

  private onProduce(client: GameClient, epoch: number, items: InventoryItem[]): void {
    if (client !== this.client || epoch !== this.connectionEpoch) return;
    const snapshot: ProduceSnapshot = {
      revision: (this.produce?.revision ?? 0) + 1,
      connectionEpoch: epoch,
      capturedAt: this.now(),
      items: items.map((item) => ({ ...item })),
    };
    this.persist(this.runtime, snapshot);
    this.produce = snapshot;
    this.emitEvent('produce', defensiveClone(snapshot));
    const pending = this.pendingProduce;
    if (!pending || pending.epoch !== epoch || snapshot.revision <= pending.previousRevision) return;
    clearTimeout(pending.timer);
    this.pendingProduce = null;
    pending.resolve(defensiveClone(snapshot));
  }

  private applyProtocolEvent(
    event: ShopProtocolEvent,
    epoch: number,
    context?: ShopRequestContext,
  ): void {
    const capturedAt = this.now();
    let next = this.runtime;
    if (event.kind === 'own-snapshot') {
      next = {
        ...next,
        own: {
          revision: (next.own?.revision ?? 0) + 1,
          connectionEpoch: epoch,
          capturedAt,
          data: {
            numSlot: event.numSlot,
            canOpenSlot: event.canOpenSlot,
            slots: event.slots.map((slot) => ({ ...slot })),
          },
        },
      };
    } else if (event.kind === 'market-catalog') {
      next = {
        ...next,
        market: {
          revision: (next.market?.revision ?? 0) + 1,
          connectionEpoch: epoch,
          capturedAt,
          data: {
            catalog: event.items.map((item) => ({ ...item })),
            timeRefresh: event.timeRefresh,
            priceRefresh: event.priceRefresh,
            selectedItemId: null,
            listings: [],
          },
        },
      };
    } else if (event.kind === 'market-listings') {
      const selectedItemId = context?.marketItemId;
      const expectedMarketRevision = context?.expectedMarketRevision;
      if (selectedItemId === undefined || expectedMarketRevision === undefined) {
        throw new ShopError(
          500,
          'SHOP_PROTOCOL_ERROR',
          'Seller listings thiếu market item/revision context',
        );
      }
      const previousMarket = next.market;
      if (
        !previousMarket
        || !this.isMarketFreshForCurrentAttachment()
        || previousMarket.revision !== expectedMarketRevision
        || previousMarket.connectionEpoch !== epoch
        || !previousMarket.data.catalog.some((item) => item.itemId === selectedItemId)
      ) {
        this.staleShop('Snapshot chợ đã đổi trước khi nhận seller listings');
      }
      const previous = previousMarket.data;
      next = {
        ...next,
        market: {
          revision: (next.market?.revision ?? 0) + 1,
          connectionEpoch: epoch,
          capturedAt,
          data: {
            ...previous,
            catalog: previous.catalog.map((item) => ({ ...item })),
            selectedItemId,
            listings: event.listings.map((listing) => ({ ...listing })),
          },
        },
      };
    } else if (event.kind === 'price-rules') {
      next = {
        ...next,
        priceRules: {
          revision: (next.priceRules?.revision ?? 0) + 1,
          connectionEpoch: epoch,
          capturedAt,
          data: event.rules.map((rule) => ({ ...rule })),
        },
      };
    }
    if (next !== this.runtime) {
      this.persist(next, this.produce);
      this.runtime = next;
      if (event.kind === 'market-catalog') {
        this.marketFreshAttachmentGeneration = this.attachmentGeneration;
      }
      this.emitShop();
    }
  }

  private reconcileUnknownTransactions(): void {
    const unknown = this.repository
      .listTransactions(this.accountId, 20)
      .filter((transaction) => transaction.status === 'unknown');
    for (const transaction of unknown) {
      const evidence = this.unknownEvidence(transaction);
      if (!evidence) continue;
      this.transition(transaction.id, 'succeeded', {
        result: { reconciledAfterReconnect: true, ...evidence },
        errorCode: null,
        errorMessage: null,
      });
    }
  }

  private unknownEvidence(transaction: ShopTransaction): Record<string, unknown> | null {
    const request = transaction.request;
    const before = transaction.before;
    const beforeProduce = before.produce as ProduceSnapshot | null | undefined;
    const itemId = Number(request.itemId ?? request.expectedItemId);
    const quantity = Number(request.quantity ?? request.expectedQuantity);
    const produceDelta = Number.isSafeInteger(itemId) && this.produce
      ? countItem(this.produce.items, itemId) - countItem(beforeProduce?.items ?? [], itemId)
      : 0;
    if (transaction.kind === 'list') {
      const slot = Number(request.slot);
      const listing = this.runtime.own?.data.slots.find((candidate) => candidate.slot === slot);
      if (
        listing
        && listing.itemId === itemId
        && listing.quantity === quantity
        && listing.price === Number(request.price)
        && produceDelta <= -quantity
      ) return { ownRevision: this.runtime.own?.revision, produceRevision: this.produce?.revision };
    }
    if (transaction.kind === 'withdraw') {
      const slot = Number(request.slot);
      const listing = this.runtime.own?.data.slots.find((candidate) => candidate.slot === slot);
      const manualListingGone = !listing
        || listing.itemId !== itemId
        || listing.quantity !== quantity;
      const autoCollectListingGone = manualListingGone
        || listing.price !== Number(request.expectedPrice);
      if (request.autoCollectKind === 'sold') {
        if (autoCollectListingGone) return { ownRevision: this.runtime.own?.revision };
      } else if (
        (request.autoCollectKind === 'expired' ? autoCollectListingGone : manualListingGone)
        && produceDelta >= quantity
      ) {
        return { ownRevision: this.runtime.own?.revision, produceRevision: this.produce?.revision };
      }
    }
    if (transaction.kind === 'purchase') {
      if (!this.isMarketFreshForCurrentAttachment()) return null;
      const market = this.runtime.market;
      if (market?.data.selectedItemId !== itemId) return null;
      const listing = market.data.listings.find(
        (candidate) => candidate.idShop === Number(request.idShop)
          && candidate.verShop === Number(request.verShop),
      );
      if (!listing && produceDelta >= quantity) {
        return { marketRevision: this.runtime.market?.revision, produceRevision: this.produce?.revision };
      }
    }
    if (transaction.kind === 'unlock') {
      const beforeOwn = before.own as ShopRuntimeState['own'];
      if ((this.runtime.own?.data.numSlot ?? 0) > (beforeOwn?.data.numSlot ?? Number.MAX_SAFE_INTEGER)) {
        return { ownRevision: this.runtime.own?.revision };
      }
    }
    return null;
  }

  private validateCreateListingInput(input: CreateListingInput): void {
    validateIdempotencyKey(input.idempotencyKey);
    requireInteger(input.slot, 'slot', 0, 127);
    requireInteger(input.itemId, 'itemId', 0, 32_767);
    requireInteger(input.quantity, 'quantity', 1, 2_147_483_647);
    requireInteger(input.price, 'price', 1, 2_147_483_647);
    requireInteger(input.expectedShopRevision, 'expectedShopRevision');
    requireInteger(input.expectedProduceRevision, 'expectedProduceRevision');
  }

  private validateWithdrawInput(input: WithdrawListingInput): void {
    validateIdempotencyKey(input.idempotencyKey);
    requireInteger(input.slot, 'slot', 0, 127);
    requireInteger(input.expectedShopRevision, 'expectedShopRevision');
    requireInteger(input.expectedItemId, 'expectedItemId', 0, 32_767);
    requireInteger(input.expectedQuantity, 'expectedQuantity', 1, 2_147_483_647);
    requireInteger(input.expectedPrice, 'expectedPrice', 1, 2_147_483_647);
  }

  private validatePurchaseInput(input: PurchaseListingInput): void {
    validateIdempotencyKey(input.idempotencyKey);
    requireInteger(input.idShop, 'idShop', 0, 2_147_483_647);
    requireInteger(input.verShop, 'verShop', 0, 32_767);
    requireInteger(input.expectedItemId, 'expectedItemId', 0, 32_767);
    requireInteger(input.expectedQuantity, 'expectedQuantity', 1, 2_147_483_647);
    requireInteger(input.expectedPrice, 'expectedPrice', 1, 2_147_483_647);
    requireInteger(input.expectedMarketRevision, 'expectedMarketRevision');
  }

  private validateUnlockInput(input: UnlockSlotInput): void {
    validateIdempotencyKey(input.idempotencyKey);
    requireInteger(input.type, 'type', 0, 127);
    requireInteger(input.expectedShopRevision, 'expectedShopRevision');
  }

  private validateRefreshInput(input: RefreshMarketInput): void {
    validateIdempotencyKey(input.idempotencyKey);
    requireInteger(input.expectedMarketRevision, 'expectedMarketRevision');
  }

  private findReplay(idempotencyKey: string): ShopTransaction | null {
    const existing = this.repository.findTransaction(this.accountId, idempotencyKey);
    return existing ? defensiveClone(existing) : null;
  }

  private createTransaction(
    kind: ShopTransactionKind,
    request: Record<string, unknown>,
    before: Record<string, unknown>,
  ): ShopTransaction {
    const timestamp = this.now();
    const transaction: ShopTransaction = {
      id: crypto.randomUUID(),
      accountId: this.accountId,
      idempotencyKey: String(request.idempotencyKey),
      kind,
      status: 'queued',
      request: defensiveClone(request),
      before: defensiveClone(before),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const inserted = this.repository.insertTransaction(transaction);
    this.refreshTransactions();
    this.emitShop();
    return inserted;
  }

  private captureBefore(): Record<string, unknown> {
    return defensiveClone({
      own: this.runtime.own,
      market: this.runtime.market,
      priceRules: this.runtime.priceRules,
      produce: this.produce,
    });
  }

  private transition(
    id: string,
    status: ShopTransactionStatus,
    patch: {
      result?: Record<string, unknown>;
      errorCode?: string | null;
      errorMessage?: string | null;
    } = {},
  ): ShopTransaction {
    const transaction = this.repository.updateTransaction(id, {
      status,
      result: patch.result,
      errorCode: patch.errorCode,
      errorMessage: patch.errorMessage,
      updatedAt: this.now(),
    });
    this.refreshTransactions();
    this.runtime = {
      ...this.runtime,
      activeTransaction: TERMINAL_STATUSES.has(status) ? null : transaction,
    };
    this.emitShop();
    return transaction;
  }

  private setActiveTransaction(id: string): void {
    const transaction = this.repository
      .listTransactions(this.accountId, 100)
      .find((candidate) => candidate.id === id);
    if (!transaction) throw new Error(`Không tìm thấy transaction ${id}`);
    this.runtime = { ...this.runtime, activeTransaction: transaction };
    this.emitShop();
  }

  private refreshTransactions(): void {
    this.runtime = {
      ...this.runtime,
      recentTransactions: this.repository.listTransactions(this.accountId, 20),
    };
  }

  private requireOwnRevision(expected: number): NonNullable<ShopRuntimeState['own']> {
    const own = this.runtime.own;
    if (!own || own.revision !== expected || own.connectionEpoch !== this.connectionEpoch) {
      this.stale('Snapshot sạp của tôi đã cũ');
    }
    return own;
  }

  private requireMarketRevision(expected: number): NonNullable<ShopRuntimeState['market']> {
    const market = this.runtime.market;
    if (
      !market
      || !this.isMarketFreshForCurrentAttachment()
      || market.revision !== expected
      || market.connectionEpoch !== this.connectionEpoch
    ) {
      this.stale('Snapshot chợ đã cũ');
    }
    return market;
  }

  private requireBrowseMarketItem(
    input: BrowseMarketItemInput,
  ): NonNullable<ShopRuntimeState['market']> {
    const market = this.runtime.market;
    if (
      !market
      || !this.isMarketFreshForCurrentAttachment()
      || market.revision !== input.expectedMarketRevision
      || market.connectionEpoch !== this.connectionEpoch
    ) {
      this.staleShop('Snapshot chợ đã cũ');
    }
    if (!market.data.catalog.some((item) => item.itemId === input.itemId)) {
      this.staleShop('Nông sản không còn trong danh mục chợ');
    }
    return market;
  }

  private requireProduceRevision(expected: number): ProduceSnapshot {
    const produce = this.produce;
    if (!produce || produce.revision !== expected || produce.connectionEpoch !== this.connectionEpoch) {
      this.stale('Snapshot nông sản đã cũ');
    }
    return produce;
  }

  private stale(message: string): never {
    throw new ShopError(409, 'STALE_STATE', message);
  }

  private staleShop(message: string): never {
    throw new ShopError(409, 'STALE_SHOP_STATE', message);
  }

  private isMarketFreshForCurrentAttachment(): boolean {
    return this.client !== null
      && this.marketFreshAttachmentGeneration === this.attachmentGeneration;
  }

  private blockShopChannel(error: ShopError): void {
    this.shopChannelBlockedReason ??= error.message;
  }

  private assertShopChannelSynchronized(): void {
    if (this.shopChannelBlockedReason === null) return;
    throw new ShopError(
      409,
      'SHOP_PROTOCOL_ERROR',
      `Kênh cmd 103 mất đồng bộ; cần reconnect trước khi gửi lệnh mới: ${this.shopChannelBlockedReason}`,
    );
  }

  private assertReadAllowed(): void {
    if (!this.policy.readEnabled) {
      throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Đọc dữ liệu sạp đang bị tắt');
    }
  }

  private isLiveAccountAllowed(): boolean {
    return this.policy.liveAccountAllowlist === 'all'
      || this.policy.liveAccountAllowlist.has(this.accountId);
  }

  private assertWriteAllowed(
    capability: 'writeEnabled' | 'purchaseEnabled' | 'slotUnlockEnabled' | 'marketRefreshEnabled',
  ): void {
    if (!this.policy.writeEnabled || !this.policy[capability]) {
      throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Capability giao dịch sạp chưa được bật');
    }
    if (!this.isLiveAccountAllowed()) {
      throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Tài khoản chưa thuộc allowlist giao dịch live');
    }
  }

  private assertOnlineAndIdle(): number {
    this.requireOnlineClient();
    this.assertNoAutomation();
    return this.connectionEpoch;
  }

  private assertNoAutomation(): void {
    if (!this.isExecutingAutoSell && this.isAutomationRunning()) {
      throw new ShopError(409, 'OPERATION_CONFLICT', 'AutoFarm hoặc Macro đang chạy');
    }
  }

  private requireOnlineClient(): GameClient {
    if (!this.client || this.client.status !== 'online') {
      throw new ShopError(409, 'SESSION_OFFLINE', 'Phiên game chưa online');
    }
    return this.client;
  }

  private assertEpoch(expected: number): void {
    this.requireOnlineClient();
    if (expected !== this.connectionEpoch) {
      throw new ShopError(409, 'SESSION_OFFLINE', 'Phiên game đã reconnect trước khi gửi lệnh');
    }
  }

  private async waitForShopSendWindow(): Promise<void> {
    const waitMs = this.minimumSendIntervalMs - (this.now() - this.lastShopSendAt);
    if (waitMs <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  private setSyncStatus(syncStatus: ShopRuntimeState['syncStatus']): void {
    const next = { ...this.runtime, syncStatus, lastError: undefined };
    this.persist(next, this.produce);
    this.runtime = next;
    this.emitShop();
  }

  private setRuntimeError(error: ShopError): void {
    const next = {
      ...this.runtime,
      syncStatus: 'error' as const,
      lastError: { code: error.code, message: error.message },
    };
    this.persist(next, this.produce);
    this.runtime = next;
    this.emitShop();
  }

  private persist(state: ShopRuntimeState, produce: ProduceSnapshot | null): void {
    this.repository.saveCache(this.accountId, state, produce);
  }

  private emitShop(): void {
    this.emitEvent('shop', this.state());
  }

  private rejectShopPending(error: Error): void {
    const pending = this.pendingShop;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingShop = null;
    pending.reject(error);
  }

  private rejectPending(error: Error): void {
    this.rejectShopPending(error);
    const produce = this.pendingProduce;
    if (!produce) return;
    clearTimeout(produce.timer);
    this.pendingProduce = null;
    produce.reject(error);
  }

  private removeClientListeners(): void {
    const listeners = this.listeners;
    if (!listeners) return;
    listeners.client.off('shop-protocol', listeners.shop);
    listeners.client.off('shop-protocol-error', listeners.shopError);
    listeners.client.off('produce', listeners.produce);
    this.listeners = null;
  }
}
