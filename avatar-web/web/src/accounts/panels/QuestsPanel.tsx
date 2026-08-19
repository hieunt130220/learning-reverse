import { useEffect, useState } from 'react';

import { apiGet, apiPost } from '../../api.js';
import type { QuestOverviewState } from '../../types.js';

export function QuestsPanel({
  accountId,
  quests,
}: {
  accountId: number;
  quests: QuestOverviewState | null;
}) {
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
    if (!quests?.daily) {
      void apiGet<QuestOverviewState>(`/api/accounts/${accountId}/quests`)
        .then((res) => {
          if (res) setLocalQuests(res);
        })
        .catch(() => {});
    }
  }, [accountId, quests?.daily]);

  const effectiveQuests = localQuests ?? quests;
  const daily = effectiveQuests?.daily ?? null;

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

  const handleRefreshDaily = () => runAction(`/api/accounts/${accountId}/quests/daily/refresh`, 'làm mới nhiệm vụ');
  const handleChangeQuest = () => runAction(`/api/accounts/${accountId}/quests/daily/change`, 'đổi nhiệm vụ');
  const handleClaimReward = () => runAction(`/api/accounts/${accountId}/quests/daily/claim`, 'nhận thưởng nhiệm vụ');
  const handleClaimBox = () => runAction(`/api/accounts/${accountId}/quests/daily/box`, 'mở rương quà');

  const completedDailyCount = daily?.missions.filter((m) => m.isDone).length ?? 0;
  const totalDailyCount = daily?.missions.length ?? 0;
  const canClaimAnyBox = daily?.boxes.some((b) => b.canClaim) ?? false;

  return (
    <section className="card drawer-panel quests-panel">
      <header className="quests-header">
        <div className="quests-header-title">
          <h3>Nhiệm vụ Lái buôn</h3>
          {daily && (
            <span className="badge badge--star">
              ⭐ {daily.score} / {daily.maxScore} điểm{daily.score >= daily.maxScore && daily.missions.length === 0 ? ' · Đã hoàn thành' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-compact ghost"
          onClick={handleRefreshDaily}
          disabled={busy}
          title="Tải lại dữ liệu nhiệm vụ từ máy chủ"
        >
          {busy ? '⏳' : '🔄'} Làm mới
        </button>
      </header>

      {statusMsg && <div className="toast-inline toast-inline--success">{statusMsg}</div>}
      {errorMsg && <div className="toast-inline toast-inline--error">{errorMsg}</div>}

      <div className="quests-source-note">
        <span className="label-caption">Dữ liệu trực tiếp từ NPC Lái buôn trong Nông trại</span>
        {daily && totalDailyCount > 0 && (
          <span className="tab-pill">{completedDailyCount}/{totalDailyCount}</span>
        )}
      </div>

      <div className="quests-tab-content">
          {daily ? (
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
          )}
      </div>
    </section>
  );
}
