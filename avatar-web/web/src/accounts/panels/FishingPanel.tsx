import { useEffect, useState } from 'react';

import { apiPost } from '../../api.js';
import {
  type AccountWithRuntime,
  type AutomationSnapshot,
  type FishingRuntimeState,
  type QuestOverviewState,
} from '../../types.js';

interface FishingPanelProps {
  account?: AccountWithRuntime;
  automation?: AutomationSnapshot;
  quests?: QuestOverviewState | null;
  onChanged?(): void;
  onSelectSettingsTab?(): void;
}

interface DailyFishingSpeciesCount {
  fishId: number;
  fishName: string;
  count: number;
}

interface DailyFishingStatistics {
  date: string;
  timezone: 'Asia/Ho_Chi_Minh';
  totalCatches: number;
  bySpecies: DailyFishingSpeciesCount[];
  updatedAt: number | null;
}

type AutomationWithDailyFishingStatistics = AutomationSnapshot & {
  dailyFishingStatistics?: DailyFishingStatistics;
};

function getDailyFishingStatistics(
  automation: AutomationSnapshot | undefined,
): DailyFishingStatistics | undefined {
  return (automation as AutomationWithDailyFishingStatistics | undefined)
    ?.dailyFishingStatistics;
}

const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function millisecondsUntilVietnamDateChange(now = Date.now()): number {
  const current = VIETNAM_DATE.format(now);
  let low = now;
  let high = now + 30 * 60 * 60 * 1000;
  if (VIETNAM_DATE.format(high) === current) {
    throw new Error('không xác định được mốc đổi ngày Việt Nam');
  }
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (VIETNAM_DATE.format(middle) === current) low = middle;
    else high = middle;
  }
  return Math.max(1000, high - now + 1000);
}

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

export function formatFishingStatus(
  isFishing: boolean,
  status?: FishingRuntimeState['status'],
  accountStatus?: string,
): string {
  if (!isFishing && (!status || status === 'idle')) {
    return 'Đang tắt';
  }
  switch (status) {
    case 'moving':
      return 'Đang di chuyển vào hồ câu';
    case 'buying':
      return 'Đang đi mua vật phẩm câu cá tại Khu sinh thái (Map 13)…';
    case 'selling':
      return 'Rương đầy, đang tự động bán cá (banca)…';
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
      if (isFishing) {
        return accountStatus === 'online'
          ? 'Đang chuẩn bị vào hồ…'
          : 'Đang chờ kết nối game…';
      }
      return 'Đang tắt';
  }
}

export function FishingPanel({
  account,
  automation,
  quests,
  onChanged,
  onSelectSettingsTab,
}: FishingPanelProps) {
  const dailyFishingStatistics = getDailyFishingStatistics(automation);
  const accountId = account?.id;
  const isFishingDesired = automation?.desiredMode === 'auto_fishing';
  const isFishingActive = automation?.activeMode === 'auto_fishing';
  const isFishing = isFishingDesired || isFishingActive;
  const isSwitching = automation?.transitionState === 'switching';

  const [error, setError] = useState('');
  const [refreshingQuest, setRefreshingQuest] = useState(false);

  useEffect(() => {
    if (!onChanged) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const schedule = (): void => {
      if (cancelled) return;
      let delay = 60_000;
      try {
        delay = millisecondsUntilVietnamDateChange();
      } catch {
        // Retry date-boundary calculation without changing displayed data.
      }
      timer = setTimeout(() => {
        if (cancelled) return;
        onChanged();
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [onChanged]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {/* ─── Header & Status ─── */}
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
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Vận Hành Câu Cá Tự Động</h3>
          <p className="hint" style={{ margin: '0.2rem 0 0 0' }}>
            Trạng thái: <strong>{formatFishingStatus(isFishing, fishingState?.status, account?.runtime?.status)}</strong>
            {isSwitching && ' · Đang chuyển chế độ…'}
          </p>
        </div>
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
          <div className="hint" style={{ fontSize: '0.8rem' }}>Tổng cá hôm nay</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ok)', marginTop: '0.2rem' }}>
            {(dailyFishingStatistics?.totalCatches ?? 0).toLocaleString('vi-VN')}
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
            Map {fishingState?.currentMap ?? automation?.fishingConfig?.config?.map ?? 14} / Khu {fishingState?.currentArea ?? automation?.fishingConfig?.config?.area ?? 0}
          </div>
        </div>
      </div>

      <section aria-labelledby="daily-fishing-heading" style={{
        padding: '0.85rem 1rem', background: '#12161d', borderRadius: '8px',
        border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '0.65rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <h4 id="daily-fishing-heading" style={{ margin: 0, fontSize: '0.95rem' }}>
            Cơ cấu cá hôm nay
          </h4>
          <span className="hint" style={{ fontSize: '0.8rem' }}>
            {dailyFishingStatistics?.date ?? '—'} · Asia/Ho_Chi_Minh
          </span>
        </div>
        {dailyFishingStatistics && dailyFishingStatistics.bySpecies.length > 0 ? (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.45rem' }}>
            {dailyFishingStatistics.bySpecies.map((species) => (
              <li key={species.fishId} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--fg)' }}>
                  {species.fishName} <span className="hint">(ID {species.fishId})</span>
                </span>
                <strong>{species.count.toLocaleString('vi-VN')}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint" style={{ margin: 0 }}>Chưa bắt được cá nào trong ngày.</p>
        )}
      </section>

      {/* ─── Navigation hint sang Cài đặt ─── */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          ⚙️ Cần thay đổi khu vực hồ câu, chọn cần, loại mồi hoặc vé tự mua?
        </div>
        {onSelectSettingsTab && (
          <button
            type="button"
            className="ghost"
            onClick={onSelectSettingsTab}
            style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            Sang tab Cài đặt →
          </button>
        )}
      </div>
    </div>
  );
}
