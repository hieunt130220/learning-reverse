import { useEffect, useState } from 'react';

import { apiPost } from '../../api.js';
import {
  type AccountWithRuntime,
  type AutomationSnapshot,
  type FishingRuntimeState,
  type QuestOverviewState,
} from '../../types.js';
import { LiveReviewCaptureCard } from './LiveReviewCaptureCard.js';

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

interface MlFishingStatistics {
  totalAttempts: number;
  successCatches: number;
  accuracy: number;
  updatedAt: number | null;
}

type AutomationWithMlStatistics = AutomationSnapshot & {
  mlFishingStatistics?: MlFishingStatistics;
};

function getMlFishingStatistics(
  automation: AutomationSnapshot | undefined,
): MlFishingStatistics | undefined {
  return (automation as AutomationWithMlStatistics | undefined)
    ?.mlFishingStatistics;
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
  // Map 14: Hồ cá rô
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',

  // Map 15: Hồ cá lóc
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',

  // Map 16: Hồ cá mập
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',

  // Map 27: Bến tàu / Biển Hawai
  4503: 'Cá voi trắng',
  4504: 'Cá lia thia',
  4505: 'Cá chép',
  4506: 'Cá hề',
  4507: 'Cá vàng',
  4508: 'Nhái',
  4509: 'Chàng hiu',
  4510: 'Ếch',
  4511: 'Sứa',
  4512: 'Lợn biển',
  4513: 'Cá voi sát thủ',
  4515: 'Cá heo',
  4516: 'Mực',
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
  const mlFishingStatistics = getMlFishingStatistics(automation);
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
    <div className="fishing-root">
      {/* ─── Header & Status ─── */}
      <div className="fishing-head">
        <div>
          <h3>Vận Hành Câu Cá Tự Động</h3>
          <p className="hint">
            Trạng thái: <strong>{formatFishingStatus(isFishing, fishingState?.status, account?.runtime?.status)}</strong>
            {isSwitching && ' · Đang chuyển chế độ…'}
          </p>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      {fishingState?.lastError && (
        <p className="err">
          Lỗi câu gần nhất: {fishingState.lastError}
        </p>
      )}

      {/* ─── Fisherman Quest Card ─── */}
      <div className="fishing-card">
        <div className="fishing-card-head">
          <div className="fishing-card-title">
            <span>🎣</span>
            <h4>
              {fishermanQuest?.title || 'Nhiệm Vụ Thợ Câu'}
            </h4>
            {fishermanQuest?.step !== null && fishermanQuest?.step !== undefined && (
              <span className="badge badge--step">Bước {fishermanQuest.step}</span>
            )}
            {fishermanQuest && (
              <span
                className={`fishing-count-pill ${
                  isAllConditionsDone
                    ? 'fishing-count-pill--done'
                    : 'fishing-count-pill--pending'
                }`}
              >
                {fishermanQuest.conditions.filter((c) => c.isDone).length}/
                {fishermanQuest.conditions.length} điều kiện
              </span>
            )}
          </div>

          <button
            type="button"
            className="ghost fishing-refresh-btn"
            onClick={handleRefreshQuest}
            disabled={refreshingQuest || !accountId}
            title="Làm mới nhiệm vụ từ máy chủ game"
          >
            {refreshingQuest ? '⏳' : '🔄'} Làm mới
          </button>
        </div>

        {fishermanQuest ? (
          fishermanQuest.source === 'completed' ? (
            <div className="fishing-done-banner">
              <span>🎉</span>
              <span>Đã hoàn thành toàn bộ chuỗi nhiệm vụ Thợ Câu!</span>
            </div>
          ) : fishermanQuest.conditions.length === 0 ? (
            <p className="hint">
              Không có điều kiện nhiệm vụ nào.
            </p>
          ) : (
            <div className="fishing-stack">
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
                    className={`fishing-cond ${
                      cond.isDone ? 'fishing-cond--done' : 'fishing-cond--pending'
                    }`}
                  >
                    <div className="fishing-cond-row">
                      <span className="fishing-cond-name">
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
          <div className="fishing-between">
            <p className="hint">
              Chưa có dữ liệu nhiệm vụ Thợ Câu từ game.
            </p>
            <button
              type="button"
              className="ghost fishing-refresh-btn"
              onClick={handleRefreshQuest}
              disabled={refreshingQuest || !accountId}
            >
              {refreshingQuest ? '⏳ Đang tải…' : 'Tải nhiệm vụ Thợ Câu'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Live Metrics & Status ─── */}
      <div className="fishing-metrics">
        <div className="fishing-metric">
          <div className="hint">Tổng cá hôm nay</div>
          <div className="fishing-metric-value fishing-metric-value--lg">
            {(dailyFishingStatistics?.totalCatches ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="fishing-metric">
          <div className="hint">Cá vừa bắt được</div>
          <div className="fishing-metric-value fishing-metric-value--fish">
            {formatFishName(fishingState?.lastFishId, fishingState?.lastFishName)}
          </div>
        </div>

        <div className="fishing-metric">
          <div className="hint">Map / Khu vực</div>
          <div className="fishing-metric-value fishing-metric-value--map">
            Map {fishingState?.currentMap ?? automation?.fishingConfig?.config?.map ?? 14} / Khu {fishingState?.currentArea ?? automation?.fishingConfig?.config?.area ?? 0}
          </div>
        </div>

        <div className="fishing-metric">
          <div className="hint">Tỉ lệ giải ML đúng</div>
          <div className="fishing-metric-value fishing-metric-value--rate">
            {mlFishingStatistics && mlFishingStatistics.totalAttempts > 0
              ? `${(mlFishingStatistics.accuracy * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="hint">
            {mlFishingStatistics && mlFishingStatistics.totalAttempts > 0
              ? `${mlFishingStatistics.successCatches}/${mlFishingStatistics.totalAttempts} lượt`
              : 'Chưa có lượt giải'}
          </div>
        </div>
      </div>

      <section aria-labelledby="daily-fishing-heading" className="fishing-card">
        <div className="fishing-between fishing-card-title">
          <h4 id="daily-fishing-heading">
            Cơ cấu cá hôm nay
          </h4>
          <span className="hint">
            {dailyFishingStatistics?.date ?? '—'} · Asia/Ho_Chi_Minh
          </span>
        </div>
        {dailyFishingStatistics && dailyFishingStatistics.bySpecies.length > 0 ? (
          <ul className="fishing-list">
            {dailyFishingStatistics.bySpecies.map((species) => (
              <li key={species.fishId} className="fishing-list-row">
                <span>
                  {species.fishName} <span className="hint">(ID {species.fishId})</span>
                </span>
                <strong>{species.count.toLocaleString('vi-VN')}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Chưa bắt được cá nào trong ngày.</p>
        )}
      </section>

      {accountId && <LiveReviewCaptureCard accountId={accountId} isOnline={account?.runtime?.status === 'online'} />}

      {/* ─── Navigation hint sang Cài đặt ─── */}
      <div className="setting-section fishing-between">
        <div className="fishing-foot">
          ⚙️ Cần thay đổi khu vực hồ câu, chọn cần, loại mồi hoặc vé tự mua?
        </div>
        {onSelectSettingsTab && (
          <button
            type="button"
            className="ghost"
            onClick={onSelectSettingsTab}
          >
            Sang tab Cài đặt →
          </button>
        )}
      </div>
    </div>
  );
}
