import { useEffect, useState } from 'react';

import { apiPost, apiPut, ApiError } from '../../api.js';
import {
  DEFAULT_FISHING_CONFIG,
  FISHING_BAITS,
  FISHING_RODS,
  FISHING_TICKETS,
  type AccountWithRuntime,
  type AutomationSnapshot,
  type FishingConfig,
  type FishingRuntimeState,
  type QuestOverviewState,
} from '../../types.js';

interface FishingPanelProps {
  account?: AccountWithRuntime;
  automation?: AutomationSnapshot;
  quests?: QuestOverviewState | null;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
  onChanged?(): void;
}

const FISHING_MAPS = [
  { id: 14, name: 'Khu cá rô (Map 14 - Mặc định)' },
  { id: 15, name: 'Khu cá lóc (Map 15)' },
  { id: 16, name: 'Khu cá mập (Map 16)' },
  { id: 27, name: 'Bến tàu / Đảo Hawai (Map 27)' },
];

export const FISH_NAMES: Record<number, string> = {
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',
  4507: 'Cá biển (4507)',
  4510: 'Cá biển (4510)',
};

export function formatFishName(id: number | null | undefined, name?: string | null): string {
  if (!id || id <= 0) return '—';
  if (name) return `${name} (ID ${id})`;
  const mapped = FISH_NAMES[id];
  return mapped ? `${mapped} (ID ${id})` : `Cá ID ${id}`;
}

function getTicketHint(mapId: number): string {
  switch (mapId) {
    case 14:
      return 'Tự mua Vé cá rô (1.000 xu)';
    case 15:
      return 'Tự mua Vé cá lóc (10.000 xu)';
    case 16:
      return 'Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng';
    case 27:
      return 'Bến tàu cần vé sự kiện riêng, NPC không bán';
    default:
      return FISHING_TICKETS[mapId]
        ? `Tự mua ${FISHING_TICKETS[mapId].name}`
        : 'Bản đồ này không có vé bán tại NPC';
  }
}

function formatFishingStatus(
  isFishingDesired: boolean,
  status?: FishingRuntimeState['status'],
  accountStatus?: string,
): string {
  if (!isFishingDesired && (!status || status === 'idle')) {
    return 'Đang tắt';
  }
  switch (status) {
    case 'moving':
      return 'Đang di chuyển vào hồ câu';
    case 'buying':
      return 'Đang đi mua vật phẩm câu cá tại Khu sinh thái (Map 13)…';
    case 'starting':
      return 'Đang gửi yêu cầu câu (TX45)…';
    case 'casting':
      return 'Đang quăng cần, chờ cá cắn…';
    case 'hooked':
      return 'Cá cắn câu! ML đang giải mini-game…';
    case 'caught':
      return 'Đã bắt được cá!';
    case 'rejected':
      return 'Server từ chối câu';
    case 'resting':
      return 'Đang nghỉ giữa vòng quăng cần';
    case 'idle':
    default:
      if (isFishingDesired) {
        if (accountStatus !== 'online') {
          return 'Đang chờ kết nối game…';
        }
        return 'Đang chuẩn bị vào hồ…';
      }
      return 'Đang tắt';
  }
}

export function FishingPanel({
  account,
  automation,
  quests,
  onAutomationChange,
  onChanged,
}: FishingPanelProps) {
  const accountId = account?.id;
  const isFishingDesired = automation?.desiredMode === 'auto_fishing';
  const isFishingActive = automation?.activeMode === 'auto_fishing';
  const isFishing = isFishingDesired || isFishingActive;
  const isSwitching = automation?.transitionState === 'switching';

  const initialConfig = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMap, setSelectedMap] = useState<number>(initialConfig.map ?? DEFAULT_FISHING_CONFIG.map);
  const [area, setArea] = useState<number>(initialConfig.area ?? DEFAULT_FISHING_CONFIG.area);
  const [delayMs, setDelayMs] = useState<number>(initialConfig.castDelayMs ?? DEFAULT_FISHING_CONFIG.castDelayMs);
  const [autoBuyTicket, setAutoBuyTicket] = useState<boolean>(initialConfig.autoBuyTicket ?? DEFAULT_FISHING_CONFIG.autoBuyTicket);
  const [rodType, setRodType] = useState<number>(initialConfig.rodType ?? DEFAULT_FISHING_CONFIG.rodType);
  const [baitType, setBaitType] = useState<number>(initialConfig.baitType ?? DEFAULT_FISHING_CONFIG.baitType);
  const [baitQuantity, setBaitQuantity] = useState<number>(initialConfig.baitQuantity ?? DEFAULT_FISHING_CONFIG.baitQuantity);

  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [refreshingQuest, setRefreshingQuest] = useState(false);

  useEffect(() => {
    const cfg = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG;
    setSelectedMap(cfg.map);
    setArea(cfg.area);
    setDelayMs(cfg.castDelayMs);
    setAutoBuyTicket(cfg.autoBuyTicket);
    setRodType(cfg.rodType);
    setBaitType(cfg.baitType);
    setBaitQuantity(cfg.baitQuantity);
    setSaveSuccess(false);
    setSaveError('');
  }, [account?.id, automation?.fishingConfig?.revision]);

  const handleSaveConfig = async () => {
    if (!accountId || savingConfig || isFishing) return;
    setSavingConfig(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const payload = {
        expectedRevision: automation?.fishingConfig?.revision ?? 0,
        config: {
          map: selectedMap,
          area,
          castDelayMs: delayMs,
          autoBuyTicket,
          rodType,
          baitType,
          baitQuantity,
        },
      };

      const result = await apiPut<{
        revision: number;
        config: FishingConfig;
        application: string;
      }>(`/api/accounts/${accountId}/automation/fishing/config`, payload);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);

      if (automation && onAutomationChange) {
        onAutomationChange({
          ...automation,
          fishingConfig: {
            revision: result.revision,
            config: result.config,
          },
        });
      }
      onChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as {
          code?: string;
          current?: { revision: number; config: FishingConfig };
          error?: string;
        } | undefined;
        setSaveError(
          body?.error || 'Xung đột phiên bản: cấu hình đã được cập nhật từ nơi khác. Vui lòng thử lại.',
        );
        if (body?.current && automation && onAutomationChange) {
          onAutomationChange({
            ...automation,
            fishingConfig: body.current,
          });
        }
      } else {
        setSaveError((err as Error).message);
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const fishermanQuest = quests?.fisherman ?? null;
  const isAllConditionsDone = Boolean(
    fishermanQuest &&
      fishermanQuest.conditions.length > 0 &&
      fishermanQuest.conditions.every((c) => c.isDone),
  );

  const handleRefreshQuest = async () => {
    if (!accountId || refreshingQuest) return;
    setRefreshingQuest(true);
    setError('');
    try {
      await apiPost(`/api/accounts/${accountId}/quests/progress/refresh`);
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimeout(() => setRefreshingQuest(false), 4000);
    }
  };

  const fishingState = automation?.fishingRuntime;
  const selectedRod = FISHING_RODS.find((r) => r.id === rodType);
  const isRodLuong = selectedRod?.typeMoney === 2;

  const handleToggle = async () => {
    if (!accountId || loading || isSwitching) return;
    setLoading(true);
    setError('');

    try {
      if (isFishing) {
        const snap = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/stop`, {});
        if (snap) onAutomationChange?.(snap);
      } else {
        const snap = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/start`, {
          mode: 'auto_fishing',
        });
        if (snap) onAutomationChange?.(snap);
      }
      onChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const bodySnap = (err.body as { snapshot?: AutomationSnapshot })?.snapshot;
        if (bodySnap) onAutomationChange?.(bodySnap);
        onChanged?.();
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {/* ─── Header & Action Button ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: '#1d2430',
          borderRadius: '8px',
          border: '1px solid var(--line)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Tự Động Câu Cá (Phase 3 ML)</h3>
          <p className="hint" style={{ margin: '0.2rem 0 0 0' }}>
            Trạng thái: <strong>{formatFishingStatus(isFishingDesired, fishingState?.status, account?.runtime?.status)}</strong>
            {isSwitching && ' · Đang chuyển chế độ…'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || isSwitching || !accountId}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            cursor: loading || isSwitching ? 'not-allowed' : 'pointer',
            background: isFishing ? '#b83a3a' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
          }}
        >
          {loading ? 'Đang xử lý…' : isFishing ? 'Dừng câu cá' : 'Bắt đầu câu cá'}
        </button>
      </div>

      {error && <p className="err" style={{ margin: 0 }}>{error}</p>}
      {fishingState?.lastError && (
        <p className="err" style={{ margin: 0 }}>
          Lỗi câu gần nhất: {fishingState.lastError}
        </p>
      )}

      {/* ─── Fisherman Quest Card ─── */}
      <div
        style={{
          padding: '0.85rem 1rem',
          background: '#12161d',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.1rem' }}>🎣</span>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              {fishermanQuest?.title || 'Nhiệm Vụ Thợ Câu'}
            </h4>
            {fishermanQuest?.step !== null && fishermanQuest?.step !== undefined && (
              <span className="badge badge--step">Bước {fishermanQuest.step}</span>
            )}
            {fishermanQuest && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: isAllConditionsDone
                    ? 'rgba(63, 185, 80, 0.15)'
                    : 'rgba(88, 166, 255, 0.12)',
                  color: isAllConditionsDone ? '#3fb950' : '#58a6ff',
                  border: isAllConditionsDone
                    ? '1px solid rgba(63, 185, 80, 0.3)'
                    : '1px solid rgba(88, 166, 255, 0.25)',
                }}
              >
                {fishermanQuest.conditions.filter((c) => c.isDone).length}/
                {fishermanQuest.conditions.length} điều kiện
              </span>
            )}
          </div>

          <button
            type="button"
            className="ghost"
            onClick={handleRefreshQuest}
            disabled={refreshingQuest || !accountId}
            title="Làm mới nhiệm vụ từ máy chủ game"
            style={{
              fontSize: '0.8rem',
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: refreshingQuest ? 'not-allowed' : 'pointer',
            }}
          >
            {refreshingQuest ? '⏳' : '🔄'} Làm mới
          </button>
        </div>

        {fishermanQuest ? (
          fishermanQuest.source === 'completed' ? (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(63, 185, 80, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(63, 185, 80, 0.25)',
                fontSize: '0.85rem',
                color: '#3fb950',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🎉</span>
              <span>Đã hoàn thành toàn bộ chuỗi nhiệm vụ Thợ Câu!</span>
            </div>
          ) : fishermanQuest.conditions.length === 0 ? (
            <p className="hint" style={{ margin: 0, fontSize: '0.85rem' }}>
              Không có điều kiện nhiệm vụ nào.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fishermanQuest.conditions.map((cond, idx) => {
                const pct =
                  cond.total > 0
                    ? Math.min(100, Math.round((cond.current / cond.total) * 100))
                    : cond.isDone
                    ? 100
                    : 0;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: cond.isDone ? 'rgba(63, 185, 80, 0.04)' : '#161b22',
                      borderRadius: '6px',
                      border: cond.isDone
                        ? '1px solid rgba(63, 185, 80, 0.3)'
                        : '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--fg)' }}>
                        {cond.isDone ? '✅' : '🐟'} {cond.name}
                      </span>
                      <span
                        className={`mission-badge ${cond.isDone ? 'badge-success' : 'badge-pending'}`}
                      >
                        {cond.isDone
                          ? 'Hoàn thành'
                          : `${cond.current.toLocaleString('vi-VN')} / ${cond.total.toLocaleString(
                              'vi-VN',
                            )} (${pct}%)`}
                      </span>
                    </div>

                    <div className="mission-mini-bar">
                      <div
                        className={`mission-mini-bar-fill ${cond.isDone ? 'bar-done' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.25rem 0',
            }}
          >
            <p className="hint" style={{ margin: 0, fontSize: '0.85rem' }}>
              Chưa có dữ liệu nhiệm vụ Thợ Câu từ game.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={handleRefreshQuest}
              disabled={refreshingQuest || !accountId}
              style={{
                fontSize: '0.8rem',
                padding: '4px 10px',
                cursor: refreshingQuest ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshingQuest ? '⏳ Đang tải…' : 'Tải nhiệm vụ Thợ Câu'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Live Metrics & Status ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Tổng cá đã bắt</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ok)', marginTop: '0.2rem' }}>
            {fishingState?.totalCatches ?? 0}
          </div>
        </div>

        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Cá vừa bắt được</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#d2a8ff', marginTop: '0.3rem' }}>
            {formatFishName(fishingState?.lastFishId, fishingState?.lastFishName)}
          </div>
        </div>

        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Map / Khu vực</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f0f6fc', marginTop: '0.4rem' }}>
            Map {fishingState?.currentMap ?? selectedMap} / Khu {fishingState?.currentArea ?? area}
          </div>
        </div>
      </div>

      {/* ─── Configuration Form ─── */}
      <div
        style={{
          padding: '1rem',
          background: '#12161d',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Cấu hình hồ câu</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Khu vực câu:</label>
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(Number(e.target.value))}
            disabled={isFishing}
            style={{
              padding: '0.4rem 0.6rem',
              background: '#1d2430',
              color: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '4px',
            }}
          >
            {FISHING_MAPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Khu vực (Area 0-15):</label>
            <input
              type="number"
              min={0}
              max={15}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Delay giữa các lần quăng (ms):</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0.25rem 0' }} />

        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Cấu hình mua vật phẩm tự động</h4>

        {/* 1. Vé câu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: isFishing ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={autoBuyTicket}
              onChange={(e) => setAutoBuyTicket(e.target.checked)}
              disabled={isFishing}
              style={{ cursor: isFishing ? 'not-allowed' : 'pointer' }}
            />
            <span>Tự động mua vé câu theo hồ</span>
          </label>
          <div
            style={{
              fontSize: '0.8rem',
              color: selectedMap === 16 ? '#e3b341' : 'var(--muted)',
              marginLeft: '1.4rem',
            }}
          >
            {getTicketHint(selectedMap)}
          </div>
        </div>

        {/* 2. Cần câu */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Cần câu:</label>
            {isRodLuong && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(210, 153, 34, 0.15)',
                  color: '#e3b341',
                  border: '1px solid rgba(210, 153, 34, 0.4)',
                  fontWeight: 500,
                }}
              >
                ⚠️ Tiêu Lượng
              </span>
            )}
          </div>
          <select
            value={rodType}
            onChange={(e) => setRodType(Number(e.target.value))}
            disabled={isFishing}
            style={{
              padding: '0.4rem 0.6rem',
              background: '#1d2430',
              color: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '4px',
            }}
          >
            {FISHING_RODS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.cost ? ` - ${r.cost}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Mồi câu & Số lượng */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Mồi câu:</label>
            <select
              value={baitType}
              onChange={(e) => setBaitType(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            >
              {FISHING_BAITS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.cost ? ` - ${b.cost}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Số lượng mồi mua mỗi lần:</label>
            <input
              type="number"
              min={1}
              max={200}
              value={baitQuantity}
              onChange={(e) => setBaitQuantity(Number(e.target.value))}
              onBlur={() => setBaitQuantity((prev) => Math.max(1, Math.min(200, Number(prev) || 50)))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* 4. Nút Lưu Cấu Hình */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isFishing || savingConfig || !accountId}
            style={{
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              cursor: isFishing || savingConfig || !accountId ? 'not-allowed' : 'pointer',
              background: isFishing || savingConfig || !accountId ? '#23863688' : '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
            }}
          >
            {savingConfig ? 'Đang lưu…' : 'Lưu Cấu Hình'}
          </button>
          {saveSuccess && (
            <span style={{ color: '#3fb950', fontSize: '0.85rem', fontWeight: 500 }}>
              Đã lưu cấu hình thành công!
            </span>
          )}
          {saveError && (
            <span style={{ color: '#f85149', fontSize: '0.85rem', fontWeight: 500 }}>
              {saveError}
            </span>
          )}
        </div>

        <p className="hint" style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem' }}>
          💡 Lưu ý: Map mặc định là <strong>Khu cá rô (ID 14)</strong>. Bot sẽ tự động di chuyển đến Khu sinh thái (Map 13) để mua cần câu, mồi hoặc vé theo cấu hình khi hết vật phẩm.
        </p>
      </div>
    </div>
  );
}
