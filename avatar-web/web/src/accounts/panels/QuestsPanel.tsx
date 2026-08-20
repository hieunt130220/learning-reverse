import { useEffect, useState } from 'react';

import { apiGet, apiPost } from '../../api.js';
import type { QuestOverviewState, ProgressQuestChain } from '../../types.js';

type QuestTab = 'daily' | 'beginner' | 'farmer';

export function QuestsPanel({
  accountId,
  quests,
}: {
  accountId: number;
  quests: QuestOverviewState | null;
}) {
  const [activeTab, setActiveTab] = useState<QuestTab>('daily');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localQuests, setLocalQuests] = useState<QuestOverviewState | null>(quests);

  useEffect(() => {
    if (quests) {
      setLocalQuests(quests);
    }
  }, [quests]);

  useEffect(() => {
    if (!quests?.daily && !quests?.beginner && !quests?.farmer) {
      void apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`)
        .then((res) => {
          if (res) setLocalQuests(res);
        })
        .catch(() => {});
    }
  }, [accountId, quests]);

  const effectiveQuests = localQuests ?? quests;
  const daily = effectiveQuests?.daily ?? null;
  const beginner = effectiveQuests?.beginner ?? null;
  const farmer = effectiveQuests?.farmer ?? null;

  const runAction = async (endpoint: string, label: string) => {
    try {
      setBusy(true);
      setErrorMsg(null);
      setStatusMsg(`Đang thực hiện ${label}…`);
      await apiPost(endpoint);
      setStatusMsg(`${label} thành công!`);
      setTimeout(() => setStatusMsg(null), 3000);
      setTimeout(async () => {
        try {
          const res = await apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`);
          if (res) setLocalQuests(res);
        } catch {}
      }, 500);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      setBusy(true);
      setErrorMsg(null);
      setStatusMsg('Đang làm mới nhiệm vụ từ máy chủ…');
      await Promise.allSettled([
        apiPost(`/api/accounts/${accountId}/quests/daily/refresh`),
        apiPost(`/api/accounts/${accountId}/quests/progress/refresh`),
      ]);
      setStatusMsg('Đã gửi yêu cầu làm mới!');
      setTimeout(() => setStatusMsg(null), 3500);
      [800, 1800, 3200].forEach((delay) => {
        setTimeout(async () => {
          try {
            const res = await apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`);
            if (res) setLocalQuests(res);
          } catch {}
        }, delay);
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'beginner' && !beginner && !busy) {
      void apiPost(`/api/accounts/${accountId}/quests/progress/refresh`).then(() => {
        [600, 1500, 3000].forEach((delay) => {
          setTimeout(async () => {
            try {
              const res = await apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`);
              if (res) setLocalQuests(res);
            } catch {}
          }, delay);
        });
      }).catch(() => {});
    }
  }, [activeTab, accountId, beginner, busy]);

  const handleRefreshDaily = () => runAction(`/api/accounts/${accountId}/quests/daily/refresh`, 'làm mới nhiệm vụ ngày');
  const handleRefreshProgress = async () => {
    try {
      setBusy(true);
      setErrorMsg(null);
      setStatusMsg('Đang tải nhiệm vụ từ game…');
      await apiPost(`/api/accounts/${accountId}/quests/progress/refresh`);
      setStatusMsg('Đã gửi yêu cầu tải nhiệm vụ!');
      setTimeout(() => setStatusMsg(null), 3000);
      [500, 1200, 2500].forEach((delay) => {
        setTimeout(async () => {
          try {
            const res = await apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`);
            if (res) setLocalQuests(res);
          } catch {}
        }, delay);
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const handleChangeQuest = () => runAction(`/api/accounts/${accountId}/quests/daily/change`, 'đổi nhiệm vụ');
  const handleClaimReward = () => runAction(`/api/accounts/${accountId}/quests/daily/claim`, 'nhận thưởng nhiệm vụ');
  const handleClaimBox = () => runAction(`/api/accounts/${accountId}/quests/daily/box`, 'mở rương quà');

  const completedDailyCount = daily?.missions?.filter((m) => m.isDone).length ?? 0;
  const totalDailyCount = daily?.missions?.length ?? 0;
  const canClaimAnyBox = daily?.boxes?.some((b) => b.canClaim) ?? false;

  const completedBeginnerCount = beginner?.conditions?.filter((c) => c.isDone).length ?? 0;
  const totalBeginnerCount = beginner?.conditions?.length ?? 0;

  const completedFarmerCount = farmer?.conditions?.filter((c) => c.isDone).length ?? 0;
  const totalFarmerCount = farmer?.conditions?.length ?? 0;

  return (
    <section className="card drawer-panel quests-panel">
      <header className="quests-header">
        <div className="quests-header-title">
          <h3>Nhiệm vụ Nông Trại</h3>
          {daily && (
            <span className="badge badge--star">
              ⭐ {daily.score} / {daily.maxScore} điểm{daily.score >= daily.maxScore && daily.missions.length === 0 ? ' · Hoàn thành ngày' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-compact ghost"
          onClick={handleRefreshAll}
          disabled={busy}
          title="Tải lại tất cả nhiệm vụ từ máy chủ"
        >
          {busy ? '⏳' : '🔄'} Làm mới tất cả
        </button>
      </header>

      {statusMsg && <div className="toast-inline toast-inline--success">{statusMsg}</div>}
      {errorMsg && <div className="toast-inline toast-inline--error">{errorMsg}</div>}

      <div className="quests-tabs-nav">
        <button
          type="button"
          className={`quests-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          ☀️ Hằng Ngày
          {daily && totalDailyCount > 0 && (
            <span className="tab-badge">{completedDailyCount}/{totalDailyCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`quests-tab-btn ${activeTab === 'beginner' ? 'active' : ''}`}
          onClick={() => setActiveTab('beginner')}
        >
          🐣 Tân Thủ
          {beginner && totalBeginnerCount > 0 && (
            <span className={`tab-badge ${completedBeginnerCount >= totalBeginnerCount ? 'tab-badge--done' : ''}`}>
              {completedBeginnerCount}/{totalBeginnerCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`quests-tab-btn ${activeTab === 'farmer' ? 'active' : ''}`}
          onClick={() => setActiveTab('farmer')}
        >
          🌾 Nhà Nông
          {farmer && totalFarmerCount > 0 && (
            <span className={`tab-badge ${completedFarmerCount >= totalFarmerCount ? 'tab-badge--done' : ''}`}>
              {completedFarmerCount}/{totalFarmerCount}
            </span>
          )}
        </button>
      </div>

      <div className="quests-tab-content">
        {/* TAB 1: NHIỆM VỤ HẰNG NGÀY */}
        {activeTab === 'daily' && (
          daily ? (
            <>
              {/* Điểm năng động & Rương quà */}
              <div className="daily-progress-section">
                <div className="daily-progress-header">
                  <span className="label-caption">Tiến trình năng động ngày</span>
                  <span className="score-text">
                    <strong>{daily.score}</strong> / {daily.maxScore} ⭐
                  </span>
                </div>

                <div className="daily-meter">
                  <div
                    className="daily-meter-fill"
                    style={{ width: `${Math.min(100, Math.max(0, (daily.score / daily.maxScore) * 100))}%` }}
                  />
                </div>

                {/* Danh sách 5 rương quà theo mốc */}
                <div className="daily-boxes-row">
                  {daily.boxes.map((box) => (
                    <div
                      key={box.milestone}
                      className={`box-milestone-card ${
                        box.isClaimed
                          ? 'box-milestone-card--claimed'
                          : box.canClaim
                          ? 'box-milestone-card--can-claim'
                          : 'box-milestone-card--locked'
                      }`}
                    >
                      <div className="box-icon">
                        {box.isClaimed ? '🎁' : box.canClaim ? '✨' : '🔒'}
                      </div>
                      <span className="box-milestone-label">{box.milestone} ⭐</span>
                      {box.isClaimed ? (
                        <span className="box-status-tag tag-claimed">Đã nhận</span>
                      ) : box.canClaim ? (
                        <button
                          type="button"
                          className="btn-box-claim"
                          onClick={handleClaimBox}
                          disabled={busy}
                        >
                          Mở
                        </button>
                      ) : (
                        <span className="box-status-tag tag-locked">Chưa đạt</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danh sách nhiệm vụ ngày */}
              <div className="daily-missions-list">
                <div className="missions-list-header">
                  <h4>Danh sách nhiệm vụ ({daily.missions.length})</h4>
                  {completedDailyCount > 0 && (
                    <button
                      type="button"
                      className="btn-primary btn-claim-all"
                      onClick={handleClaimReward}
                      disabled={busy}
                    >
                      🎁 Nhận thưởng ({completedDailyCount})
                    </button>
                  )}
                </div>

                {daily.missions.length === 0 ? (
                  <div className="daily-completed-banner">
                    <span className="banner-icon">{daily.score >= daily.maxScore ? '🎉' : '📋'}</span>
                    <div className="banner-text">
                      {daily.score >= daily.maxScore ? (
                        <>
                          <h5>Đã hoàn thành toàn bộ nhiệm vụ hôm nay!</h5>
                          <p>
                            Tài khoản đã hoàn tất nhiệm vụ hàng ngày và tích luỹ 100/100 ⭐ điểm năng động.
                            Nhiệm vụ mới sẽ được máy chủ làm mới vào ngày mai.
                          </p>
                        </>
                      ) : (
                        <>
                          <h5>Chưa có danh sách nhiệm vụ cần làm</h5>
                          <p>
                            Tài khoản hiện chưa có nhiệm vụ nào trong chuỗi hoặc đang chờ máy chủ làm mới.
                            Bạn có thể nhấn nút "Làm mới" ở góc trên để tải lại dữ liệu mới nhất.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  daily.missions.map((mission, idx) => {
                    const pct = Math.min(100, Math.round((mission.numCurrent / mission.numRequired) * 100));
                    return (
                      <div
                        key={`${mission.idItem}_${idx}`}
                        className={`mission-item-card ${mission.isDone ? 'mission-item-card--done' : ''}`}
                      >
                        <div className="mission-item-header">
                          <div className="mission-item-title">
                            <span className="mission-bullet">{mission.isDone ? '✅' : '📌'}</span>
                            <span className="mission-name">{mission.name}</span>
                          </div>
                          <span className={`mission-badge ${mission.isDone ? 'badge-success' : 'badge-pending'}`}>
                            {mission.numCurrent} / {mission.numRequired} ({pct}%)
                          </span>
                        </div>

                        {/* Progress bar nhỏ */}
                        <div className="mission-mini-bar">
                          <div
                            className={`mission-mini-bar-fill ${mission.isDone ? 'bar-done' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Phần thưởng hàng ngày */}
                {(daily.rewards.length > 0 || (daily.missionScoreReward !== undefined && daily.missionScoreReward > 0)) && (
                  <div className="daily-rewards-block">
                    <span className="label-caption">Phần thưởng khi hoàn thành:</span>
                    <div className="rewards-pill-group">
                      {daily.missionScoreReward !== undefined && daily.missionScoreReward > 0 && (
                        <span className="reward-pill reward-pill--star">
                          ⭐ +{daily.missionScoreReward} điểm năng động
                        </span>
                      )}
                      {daily.rewards.map((r, i) => (
                        <span key={i} className="reward-pill">
                          {r.name}: +{r.amount.toLocaleString('vi-VN')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action footer */}
                <div className="daily-actions-footer">
                  {daily.canChange && (
                    <button
                      type="button"
                      className="ghost btn-change-quest"
                      onClick={handleChangeQuest}
                      disabled={busy}
                    >
                      🎲 Đổi nhiệm vụ
                      {daily.moneyChange > 0 && (
                        <small> ({daily.moneyChange.toLocaleString('vi-VN')} {daily.typeMoneyChange === 1 ? 'Xu' : 'Lượng'})</small>
                      )}
                    </button>
                  )}
                  {canClaimAnyBox && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClaimBox}
                      disabled={busy}
                    >
                      🎁 Mở rương quà mốc
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="quests-empty-state">
              <p className="hint">Chưa có dữ liệu nhiệm vụ hàng ngày.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRefreshDaily}
                disabled={busy}
              >
                Tải nhiệm vụ từ game
              </button>
            </div>
          )
        )}

        {/* TAB 2: NHIỆM VỤ TÂN THỦ */}
        {activeTab === 'beginner' && (
          <ProgressQuestSection
            heading="Nhiệm Vụ Tân Thủ"
            icon="🐣"
            quest={beginner}
            busy={busy}
            onRefresh={handleRefreshProgress}
          />
        )}

        {/* TAB 3: NHIỆM VỤ NHÀ NÔNG */}
        {activeTab === 'farmer' && (
          <ProgressQuestSection
            heading="Nhiệm Vụ Nhà Nông"
            icon="🌾"
            quest={farmer}
            busy={busy}
            onRefresh={handleRefreshProgress}
          />
        )}
      </div>
    </section>
  );
}

function ProgressQuestSection({
  heading,
  icon,
  quest,
  busy,
  onRefresh,
}: {
  heading: string;
  icon: string;
  quest: ProgressQuestChain | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  if (!quest) {
    return (
      <div className="quests-empty-state">
        <span className="empty-icon">{icon}</span>
        <p className="hint">Chưa nhận dữ liệu {heading} từ máy chủ game.</p>
        <button type="button" className="btn-secondary" onClick={onRefresh} disabled={busy}>
          🔄 Tải {heading} từ game
        </button>
      </div>
    );
  }

  const completedCount = quest.conditions.filter((c) => c.isDone).length;
  const totalCount = quest.conditions.length;

  return (
    <div className="progress-quest-section">
      <div className="progress-quest-header">
        <div className="progress-quest-title">
          <h4>{quest.title || heading}</h4>
          {quest.step !== null && (
            <span className="badge badge--step">Bước {quest.step}</span>
          )}
        </div>
        <span className={`tab-pill ${completedCount >= totalCount && totalCount > 0 ? 'pill-done' : ''}`}>
          {completedCount}/{totalCount} điều kiện
        </span>
      </div>

      <div className="progress-quest-conditions-list">
        {quest.conditions.length === 0 ? (
          <p className="hint">Không có điều kiện nhiệm vụ nào.</p>
        ) : (
          quest.conditions.map((cond, idx) => {
            const pct = cond.total > 0 ? Math.min(100, Math.round((cond.current / cond.total) * 100)) : (cond.isDone ? 100 : 0);
            return (
              <div
                key={idx}
                className={`mission-item-card ${cond.isDone ? 'mission-item-card--done' : ''}`}
              >
                <div className="mission-item-header">
                  <div className="mission-item-title">
                    <span className="mission-bullet">{cond.isDone ? '✅' : '📌'}</span>
                    <span className="mission-name">{cond.name}</span>
                  </div>
                  <span className={`mission-badge ${cond.isDone ? 'badge-success' : 'badge-pending'}`}>
                    {cond.current.toLocaleString('vi-VN')} / {cond.total.toLocaleString('vi-VN')} ({pct}%)
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
          })
        )}
      </div>

      {quest.rewards.length > 0 && (
        <div className="daily-rewards-block">
          <span className="label-caption">Phần thưởng hoàn thành:</span>
          <div className="rewards-pill-group">
            {quest.rewards.map((r, i) => (
              <span key={i} className="reward-pill reward-pill--progress">
                🎁 {r.displayName || `Thưởng #${r.type}: ${r.value || r.amount}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
