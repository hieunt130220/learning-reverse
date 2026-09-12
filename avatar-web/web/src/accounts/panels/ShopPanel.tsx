import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { ApiError, apiGet, apiPost } from '../../api.js';
import type {
  AnimalInfo,
  FoodRecipe,
  ItemInfo,
  MarketListing,
  ProduceSnapshot,
  ShopPriceRule,
  ShopRuntimeState,
  ShopTransaction,
  TreeInfo,
} from '../../types.js';

type ShopTab = 'own' | 'market' | 'transactions';

interface ShopPanelProps {
  accountId: number;
  accountName: string;
  online: boolean;
  shop?: ShopRuntimeState;
  produce?: ProduceSnapshot | null;
  trees: TreeInfo[];
  animals: AnimalInfo[];
  items: ItemInfo[];
  foods: FoodRecipe[];
}

interface ShopViewResponse {
  shop: ShopRuntimeState;
  produce: ProduceSnapshot | null;
}

interface UiError {
  code?: string;
  message: string;
}

interface ListingDraft {
  slot: number;
  itemId: string;
  quantity: string;
  price: string;
}

const TRANSACTION_LABELS: Record<ShopTransaction['kind'], string> = {
  list: 'Đăng bán',
  withdraw: 'Rút hàng',
  purchase: 'Mua hàng',
  unlock: 'Mở slot',
  'refresh-market': 'Làm mới trả phí',
};

const STATUS_LABELS: Record<ShopTransaction['status'], string> = {
  queued: 'Đang chờ',
  sending: 'Đang gửi',
  awaiting_response: 'Chờ server',
  reconciling: 'Đang đối chiếu',
  succeeded: 'Thành công',
  failed: 'Thất bại',
  unknown: 'Chưa xác định',
};

const SHOP_PRODUCE_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  200: 'Ngô',
};

function formatTime(value: number | undefined): string {
  return value ? new Date(value).toLocaleString('vi-VN') : '—';
}

function errorDetails(error: unknown): UiError {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as { error?: unknown };
    if (body.error && typeof body.error === 'object') {
      const structured = body.error as { code?: unknown; message?: unknown };
      return {
        ...(typeof structured.code === 'string' ? { code: structured.code } : {}),
        message: typeof structured.message === 'string' ? structured.message : error.message,
      };
    }
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

export function ShopPanel({
  accountId,
  accountName,
  online,
  shop,
  produce,
  trees,
  animals,
  items,
  foods,
}: ShopPanelProps) {
  const [tab, setTab] = useState<ShopTab>('own');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [history, setHistory] = useState<ShopTransaction[] | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [marketView, setMarketView] = useState<'catalog' | 'listings'>('catalog');
  const inFlightOperation = useRef<symbol | null>(null);

  useEffect(() => {
    inFlightOperation.current = null;
    setBusy(null);
    setError(null);
    setMarketView('catalog');
  }, [accountId]);

  useEffect(() => {
    if (shop?.market?.data.selectedItemId == null) {
      setMarketView('catalog');
    }
  }, [shop?.market?.data.selectedItemId]);

  const nameById = useMemo(() => {
    const names = new Map<number, string>();
    for (const entry of trees) names.set(entry.id, entry.name);
    for (const entry of animals) names.set(entry.id, entry.name);
    for (const entry of items) names.set(entry.id, entry.name);
    for (const entry of foods) {
      if (entry.productID >= 0) names.set(entry.productID, entry.name);
    }
    return names;
  }, [animals, foods, items, trees]);

  const itemName = (itemId: number) => (
    SHOP_PRODUCE_NAME_OVERRIDES[itemId]
    ?? nameById.get(itemId)
    ?? `#${itemId}`
  );
  const shopPath = (suffix: string) => `/api/accounts/${accountId}/shop/${suffix}`;
  const capabilities = shop?.capabilities;
  const active = shop?.activeTransaction !== null && shop?.activeTransaction !== undefined;
  const readReady = online && capabilities?.readEnabled === true && busy === null;
  const baseWriteReady = online
    && capabilities?.writeEnabled === true
    && capabilities.liveAccountAllowed
    && !active
    && busy === null;
  const transactions = history ?? shop?.recentTransactions ?? [];
  const priceRules = shop?.priceRules?.data ?? [];
  const produceItems = produce?.items ?? [];
  const eligibleProduce = produceItems.filter(
    (entry) => entry.num > 0 && priceRules.some((rule) => rule.itemId === entry.id),
  );
  const selectedMarketItemId = shop?.market?.data.selectedItemId ?? null;
  const visibleMarketView = selectedMarketItemId === null
    ? 'catalog'
    : marketView;

  function beginOperation(label: string): symbol | null {
    if (inFlightOperation.current !== null) return null;
    const operation = Symbol(label);
    inFlightOperation.current = operation;
    setBusy(label);
    setError(null);
    return operation;
  }

  function ownsOperation(operation: symbol): boolean {
    return inFlightOperation.current === operation;
  }

  function finishOperation(operation: symbol): void {
    if (!ownsOperation(operation)) return;
    inFlightOperation.current = null;
    setBusy(null);
  }

  async function runRead(
    label: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    const operation = beginOperation(label);
    if (!operation) return false;
    try {
      await apiPost<ShopViewResponse>(path, body);
      return ownsOperation(operation);
    } catch (caught) {
      if (ownsOperation(operation)) setError(errorDetails(caught));
      return false;
    } finally {
      finishOperation(operation);
    }
  }

  async function browseCatalog(): Promise<void> {
    if (await runRead('browse-market', shopPath('browse'))) {
      setMarketView('catalog');
    }
  }

  async function browseItem(itemId: number): Promise<void> {
    const revision = shop?.market?.revision;
    if (revision === undefined) return;
    if (await runRead(`browse-market-${itemId}`, shopPath(`browse/${itemId}`), {
      expectedMarketRevision: revision,
    })) {
      setMarketView('listings');
    }
  }

  async function loadHistory() {
    const operation = beginOperation('history');
    if (!operation) return;
    try {
      const loaded = await apiGet<ShopTransaction[]>(
        `/api/accounts/${accountId}/shop/transactions?limit=50`,
      );
      if (ownsOperation(operation)) setHistory(loaded);
    } catch (caught) {
      if (ownsOperation(operation)) setError(errorDetails(caught));
    } finally {
      finishOperation(operation);
    }
  }

  function rememberTransaction(transaction: ShopTransaction) {
    setHistory((current) => {
      const source = current ?? shop?.recentTransactions ?? [];
      return [transaction, ...source.filter((entry) => entry.id !== transaction.id)].slice(0, 50);
    });
  }

  async function submitWrite(path: string, body: Record<string, unknown>) {
    const operation = beginOperation('write');
    if (!operation) return false;
    try {
      const transaction = await apiPost<ShopTransaction>(path, body);
      if (!ownsOperation(operation)) return false;
      rememberTransaction(transaction);
      setTab('transactions');
      return true;
    } catch (caught) {
      if (ownsOperation(operation)) setError(errorDetails(caught));
      return false;
    } finally {
      finishOperation(operation);
    }
  }

  async function submitListing(event: FormEvent) {
    event.preventDefault();
    if (!draft || !shop?.own || !produce) return;
    const itemId = Number(draft.itemId);
    const quantity = Number(draft.quantity);
    const price = Number(draft.price);
    const stock = produce.items.find((entry) => entry.id === itemId)?.num ?? 0;
    const rule = priceRules.find((entry) => entry.itemId === itemId);
    if (!Number.isInteger(itemId) || !rule) {
      setError({ code: 'INVALID_SHOP_REQUEST', message: 'Nông sản không có price rule hiện hành' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
      setError({ code: 'INVALID_SHOP_REQUEST', message: `Số lượng phải từ 1 đến ${stock}` });
      return;
    }
    if (!Number.isInteger(price) || price < rule.minPrice || price > rule.maxPrice) {
      setError({
        code: 'PRICE_OUT_OF_RANGE',
        message: `Giá phải từ ${rule.minPrice} đến ${rule.maxPrice}`,
      });
      return;
    }
    if (!window.confirm(
      `Đăng bán ${itemName(itemId)} × ${quantity} với giá ${price} xu?`,
    )) return;
    const accepted = await submitWrite(`/api/accounts/${accountId}/shop/listings`, {
      idempotencyKey: crypto.randomUUID(),
      slot: draft.slot,
      itemId,
      quantity,
      price,
      expectedShopRevision: shop.own.revision,
      expectedProduceRevision: produce.revision,
    });
    if (accepted) setDraft(null);
  }

  async function withdraw(slot: number) {
    if (!shop?.own) return;
    const listing = shop.own.data.slots.find((entry) => entry.slot === slot);
    if (!listing) return;
    if (!window.confirm(`Rút ${itemName(listing.itemId)} × ${listing.quantity} khỏi sạp?`)) return;
    await submitWrite(`/api/accounts/${accountId}/shop/listings/${slot}/withdraw`, {
      idempotencyKey: crypto.randomUUID(),
      expectedShopRevision: shop.own.revision,
      expectedItemId: listing.itemId,
      expectedQuantity: listing.quantity,
      expectedPrice: listing.price,
    });
  }

  async function purchase(listing: MarketListing) {
    if (!shop?.market) return;
    if (!window.confirm(
      `Mua toàn bộ listing ${itemName(listing.itemId)} × ${listing.quantity} giá ${listing.price} xu?`,
    )) return;
    await submitWrite(`/api/accounts/${accountId}/shop/purchases`, {
      idempotencyKey: crypto.randomUUID(),
      idShop: listing.idShop,
      verShop: listing.verShop,
      expectedItemId: listing.itemId,
      expectedQuantity: listing.quantity,
      expectedPrice: listing.price,
      expectedMarketRevision: shop.market.revision,
    });
  }

  async function paidRefresh() {
    if (!shop?.market) return;
    if (!window.confirm(
      'Đây là làm mới có thể tốn XU, khác với nút Cập nhật chợ. Tiếp tục gửi đúng một lần?',
    )) return;
    await submitWrite(`/api/accounts/${accountId}/shop/market/refresh`, {
      idempotencyKey: crypto.randomUUID(),
      expectedMarketRevision: shop.market.revision,
    });
  }

  const selectedRule: ShopPriceRule | undefined = draft
    ? priceRules.find((entry) => entry.itemId === Number(draft.itemId))
    : undefined;
  const selectedStock = draft
    ? produceItems.find((entry) => entry.id === Number(draft.itemId))?.num ?? 0
    : 0;

  return (
    <section className="card shop-panel" aria-labelledby="shop-panel-title">
      <div className="shop-heading">
        <div>
          <h2 id="shop-panel-title">Sạp nông sản</h2>
          <p className="hint">
            {accountName} · {online ? 'đang online' : 'offline — đang xem cache'}
            {shop ? ` · ${shop.syncStatus}` : ''}
          </p>
        </div>
        <div className="row shop-read-actions">
          <button
            type="button"
            className="ghost"
            disabled={!readReady}
            onClick={() => void runRead('sync', shopPath('sync'))}
          >
            {busy === 'sync' ? 'Đang đồng bộ…' : 'Đồng bộ sạp'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!readReady}
            onClick={() => void browseCatalog()}
          >
            {busy === 'browse-market' ? 'Đang cập nhật…' : 'Cập nhật chợ'}
          </button>
        </div>
      </div>

      {!shop && (
        <div className="shop-empty">
          <p>Chưa có cache sạp cho tài khoản này.</p>
          <p className="hint">
            {online
              ? capabilities?.readEnabled === false
                ? 'Backend đang tắt quyền đọc sạp.'
                : 'Bấm Đồng bộ sạp để tải slot, price rule và nông sản.'
              : 'Kết nối tài khoản trước khi đồng bộ lần đầu.'}
          </p>
        </div>
      )}

      {shop?.lastError && (
        <p className="err">{shop.lastError.code}: {shop.lastError.message}</p>
      )}
      {error && <p className="err">{error.code ? `${error.code}: ` : ''}{error.message}</p>}
      {shop?.activeTransaction && (
        <p className="shop-active-note">
          {TRANSACTION_LABELS[shop.activeTransaction.kind]} ·{' '}
          {STATUS_LABELS[shop.activeTransaction.status]}
        </p>
      )}

      <nav className="shop-tabs" aria-label="Các mục sạp">
        <button type="button" className={tab === 'own' ? 'active' : ''} onClick={() => setTab('own')}>
          Sạp của tôi
        </button>
        <button type="button" className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>
          Chợ
        </button>
        <button
          type="button"
          className={tab === 'transactions' ? 'active' : ''}
          onClick={() => {
            setTab('transactions');
            if (history === null) void loadHistory();
          }}
        >
          Giao dịch
        </button>
      </nav>

      {tab === 'own' && (
        <div className="shop-tab-content">
          <div className="shop-meta">
            <span>{shop?.own ? `${shop.own.data.numSlot} slot` : 'Chưa có snapshot'}</span>
            <span>revision {shop?.own?.revision ?? '—'}</span>
            <span>lúc {formatTime(shop?.own?.capturedAt)}</span>
            <span>nông sản revision {produce?.revision ?? '—'}</span>
          </div>
          {shop?.own ? (
            <div className="shop-table-wrap">
              <table className="shop-table">
                <thead><tr><th>Slot</th><th>Nông sản</th><th>SL</th><th>Giá</th><th>Trạng thái</th><th /></tr></thead>
                <tbody>
                  {shop.own.data.slots.map((slot) => {
                    const empty = slot.itemId < 0 || slot.quantity <= 0;
                    return (
                      <tr key={slot.slot}>
                        <td data-label="Slot">{slot.slot}</td>
                        <td data-label="Nông sản">{empty ? 'Trống' : itemName(slot.itemId)}</td>
                        <td data-label="Số lượng">{empty ? '—' : slot.quantity}</td>
                        <td data-label="Giá">{empty ? '—' : `${slot.price} xu`}</td>
                        <td data-label="Trạng thái">{empty ? 'Sẵn sàng' : slot.isSale ? 'Đã bán' : slot.isTimeOut ? 'Hết hạn' : 'Đang bán'}</td>
                        <td data-label="Hành động">
                          {empty ? (
                            <button
                              type="button"
                              className="ghost compact"
                              disabled={!baseWriteReady || eligibleProduce.length === 0}
                              onClick={() => setDraft({
                                slot: slot.slot,
                                itemId: String(eligibleProduce[0]?.id ?? ''),
                                quantity: '1',
                                price: String(priceRules.find((rule) => rule.itemId === eligibleProduce[0]?.id)?.minPrice ?? ''),
                              })}
                            >Đăng bán</button>
                          ) : (
                            <button
                              type="button"
                              className="ghost compact danger"
                              disabled={!baseWriteReady}
                              onClick={() => void withdraw(slot.slot)}
                            >Rút</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">Chưa đồng bộ sạp của tôi.</p>}
          {eligibleProduce.length === 0 && produce && (
            <p className="hint">Không có nông sản nào đồng thời còn hàng và có price rule.</p>
          )}
        </div>
      )}

      {tab === 'market' && (
        <div className="shop-tab-content">
          <div className="shop-meta">
            <span>{shop?.market?.data.catalog.length ?? 0} nông sản</span>
            <span>revision {shop?.market?.revision ?? '—'}</span>
            <span>lúc {formatTime(shop?.market?.capturedAt)}</span>
            <span>
              Thời gian làm mới server: {shop?.market?.data.timeRefresh ?? '—'} giây
            </span>
            <span>
              Giá làm mới server (chưa xác định loại tiền):{' '}
              {shop?.market?.data.priceRefresh ?? '—'}
            </span>
          </div>
          {shop?.market && visibleMarketView === 'catalog' ? (
            <div className="shop-table-wrap">
              <table className="shop-table">
                <thead><tr><th>ID</th><th>Nông sản</th><th>Giá server</th><th /></tr></thead>
                <tbody>
                  {shop.market.data.catalog.map((entry) => (
                    <tr key={entry.itemId}>
                      <td data-label="ID">{entry.itemId}</td>
                      <td data-label="Nông sản">{itemName(entry.itemId)}</td>
                      <td data-label="Giá server">{entry.price}</td>
                      <td data-label="Hành động">
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={!readReady}
                          onClick={() => void browseItem(entry.itemId)}
                        >
                          {busy === `browse-market-${entry.itemId}` ? 'Đang tải…' : 'Xem sạp bán'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shop.market.data.catalog.length === 0 && (
                    <tr><td colSpan={4} className="hint table-empty-row">Chợ chưa có danh mục nông sản.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : shop?.market && visibleMarketView === 'listings' ? (
            <>
              <div className="row">
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => setMarketView('catalog')}
                >Quay lại danh mục</button>
                <h3>
                  Sạp bán{' '}
                  {selectedMarketItemId === null
                    ? 'nông sản chưa xác định'
                    : `${itemName(selectedMarketItemId)} · ID ${selectedMarketItemId}`}
                </h3>
              </div>
              <div className="shop-table-wrap">
                <table className="shop-table">
                  <thead><tr><th>ID sạp</th><th>Số lượng</th><th>Giá</th><th /></tr></thead>
                  <tbody>
                    {shop.market.data.listings.map((listing) => (
                      <tr key={`${listing.idShop}:${listing.verShop}:${listing.index}`}>
                        <td data-label="ID sạp">{listing.idShop}/{listing.verShop}</td>
                        <td data-label="Số lượng">{listing.quantity}</td>
                        <td data-label="Giá">{listing.price} xu</td>
                        <td data-label="Hành động"><button
                          type="button"
                          className="compact"
                          disabled={
                            !baseWriteReady
                            || capabilities?.purchaseEnabled !== true
                            || selectedMarketItemId === null
                            || listing.itemId !== selectedMarketItemId
                          }
                          onClick={() => void purchase(listing)}
                        >Mua toàn bộ</button></td>
                      </tr>
                    ))}
                    {shop.market.data.listings.length === 0 && (
                      <tr>
                        <td colSpan={4} className="hint table-empty-row">Chưa có sạp bán nông sản này</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p className="hint">Chưa tải chợ. Nút Cập nhật chợ chỉ browse, không gọi làm mới trả phí.</p>}
          <div className="shop-paid-action">
            <button
              type="button"
              className="danger"
              disabled={!baseWriteReady || capabilities?.marketRefreshEnabled !== true || !shop?.market}
              onClick={() => void paidRefresh()}
            >Làm mới có thể tốn XU</button>
            <span className="hint">Gửi sub7 đúng một lần; không dùng cho cập nhật chợ thông thường.</span>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="shop-tab-content">
          <div className="row">
            <button type="button" className="ghost compact" disabled={busy !== null} onClick={() => void loadHistory()}>
              {busy === 'history' ? 'Đang tải…' : 'Tải lại lịch sử'}
            </button>
          </div>
          <div className="shop-transaction-list">
            {transactions.map((transaction) => (
              <article key={transaction.id} className={`shop-transaction status-${transaction.status}`}>
                <div>
                  <strong>{TRANSACTION_LABELS[transaction.kind]}</strong>
                  <span className="shop-transaction-status">{STATUS_LABELS[transaction.status]}</span>
                </div>
                <p className="hint">{formatTime(transaction.createdAt)} · {transaction.idempotencyKey}</p>
                {transaction.errorMessage && <p className="err">{transaction.errorCode}: {transaction.errorMessage}</p>}
                {transaction.status === 'unknown' && (
                  <p className="shop-unknown-warning">Không gửi lại. Hãy đồng bộ để đối chiếu trạng thái server.</p>
                )}
              </article>
            ))}
            {transactions.length === 0 && <p className="hint">Chưa có giao dịch sạp.</p>}
          </div>
        </div>
      )}

      {draft && (
        <div className="shop-modal-backdrop">
          <form className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-listing-title" onSubmit={(event) => void submitListing(event)}>
            <h3 id="shop-listing-title">Đăng bán ở slot {draft.slot}</h3>
            <label>Nông sản
              <select value={draft.itemId} onChange={(event) => {
                const itemId = Number(event.target.value);
                const rule = priceRules.find((entry) => entry.itemId === itemId);
                setDraft({ ...draft, itemId: event.target.value, price: String(rule?.minPrice ?? '') });
              }}>
                {eligibleProduce.map((entry) => <option key={entry.id} value={entry.id}>{itemName(entry.id)} · còn {entry.num}</option>)}
              </select>
            </label>
            <label>Số lượng
              <input type="number" min={1} max={selectedStock} step={1} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} />
            </label>
            <label>Giá
              <input type="number" min={selectedRule?.minPrice} max={selectedRule?.maxPrice} step={1} value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
            </label>
            {selectedRule && <p className="hint">Khoảng server cho phép: {selectedRule.minPrice}–{selectedRule.maxPrice}</p>}
            <div className="dialog-actions">
              <button type="button" className="ghost" disabled={busy !== null} onClick={() => setDraft(null)}>Huỷ</button>
              <button type="submit" disabled={!baseWriteReady}>Xác nhận đăng bán</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
