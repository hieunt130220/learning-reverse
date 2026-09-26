import { useEffect, useState } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '../../api.js';
import { ModeChip, StatusBadge } from '../AccountStatus.js';
import { StatusBanner } from '../StatusBanner.js';
import type { AutomationSnapshot, AutoConfigResponse, AutoConfigStateDto, SessionSnapshot } from '../../types.js';
import { formatFishingStatus } from './FishingPanel.js';
import { MiningTargetModal } from '../MiningTargetModal.js';

type StatusAutomationMode =
  | 'auto_farm'
  | 'auto_fishing'
  | 'auto_fisherman_quest'
  | 'auto_mining'
  | 'auto_maze'
  | 'find_npc';

export function StatusPanel({
  accountId,
  snap,
  gameUser,
  onChanged,
  automation: automationProp,
  onAutomationChange,
  automationMutationBusy = false,
  onAutomationMutationBusyChange = () => {},
}: {
  accountId: number;
  snap: SessionSnapshot | null;
  gameUser: string;
  onChanged: () => void;
  automation?: AutomationSnapshot;
  /** @deprecated Compatibility only; ignored by the new controller. */
  automationSupported?: boolean;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
  automationMutationBusy?: boolean;
  onAutomationMutationBusyChange?(busy: boolean): void;
}) {
  const [autoAction, setAutoAction] = useState<'start' | 'stop' | null>(null);
  const [autoErr, setAutoErr] = useState('');
  const [selectedMode, setSelectedMode] = useState<StatusAutomationMode>('auto_farm');
  const [showMiningModal, setShowMiningModal] = useState(false);
  const [logoutAfterCycle, setLogoutAfterCycle] = useState(true);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [savingOpt, setSavingOpt] = useState(false);
  const farmSync = snap?.farmSync;
  const auto = snap?.auto ?? { running: false, cycle: 0, lastActions: [] };
  const automation = automationProp ?? snap?.automation;
  const autoActive = Boolean(
    automation
      && (
        automation.desiredMode !== 'off'
        || automation.activeMode !== 'off'
        || automation.transitionState === 'switching'
      ),
  );
  const mutationBusy = autoAction !== null || automationMutationBusy;
  const controlsLocked = autoActive || mutationBusy;
  const progressMode = automation?.activeMode !== 'off'
    ? automation?.activeMode
    : automation?.desiredMode;

  useEffect(() => {
    const snapshotMode = automation?.desiredMode !== 'off'
      ? automation?.desiredMode
      : automation?.activeMode;
    if (
      snapshotMode === 'auto_farm' ||
      snapshotMode === 'auto_fishing' ||
      snapshotMode === 'auto_fisherman_quest' ||
      snapshotMode === 'auto_mining' ||
      snapshotMode === 'auto_maze' ||
      snapshotMode === 'find_npc'
    ) {
      setSelectedMode(snapshotMode);
    }
  }, [automation?.desiredMode, automation?.activeMode]);

  const automationProgress = (() => {
    if (!automation || progressMode === 'off') return 'automation đang tắt';
    if (progressMode === 'find_npc') {
      const f = automation.findNpcRuntime;
      const mapStr =
        f?.currentMap !== null && f?.currentMap !== undefined
          ? `Map ${f.currentMap} - Khu ${f.currentBoard ?? 0}`
          : 'đang vào công viên';
      const statusStr =
        f?.phase === 'waiting_npc'
          ? ` · 🎯 đang chờ ${f.foundNpc?.name ?? 'NPC'} (${f.waitingSeconds ?? 0}s)`
          : f?.phase === 'daily_limit_reached'
          ? ' · ⚠️ đã đạt giới hạn ngày'
          : f?.phase === 'waiting_next_cycle'
          ? ' · ⏳ chờ vòng quét tiếp'
          : ' · 🔍 đang quét';
      const progressStr = f?.eventRewardProgress
        ? ` · 🎁 số lượng ${f.eventRewardProgress.current}/${f.eventRewardProgress.max}`
        : '';
      return `tìm NPC: ${mapStr}${statusStr}${progressStr}`;
    }
    if (progressMode === 'auto_maze') {
      const mz = automation.mazeRuntime;
      const areaStr = mz?.currentArea !== null && mz?.currentArea !== undefined ? `Khu ${mz.currentArea}` : 'đang vào map 28';
      const statusStr =
        mz?.status === 'navigating'
          ? ' · 🚶 đang đi tới rương'
          : mz?.status === 'opening'
          ? ' · 🎁 đang mở rương'
          : mz?.status === 'switching_area'
          ? ' · 🔄 đang chuyển khu'
          : mz?.status === 'waiting_respawn'
          ? ' · ⏳ chờ hồi sinh rương'
          : mz?.status === 'daily_limit_reached'
          ? ' · ⚠️ đã đạt 30 hộp quà'
          : '';
      const openedStr = mz?.sessionChestsOpened ? ` · đã mở: ${mz.sessionChestsOpened} rương` : '';
      return `mê cung: ${areaStr}${statusStr}${openedStr}`;
    }
    if (progressMode === 'auto_mining') {
      const m = automation.miningRuntime;
      const mapStr = m?.currentMap === 26 ? 'mỏ đá (26)' : m?.currentMap === 22 ? 'rừng gỗ (22)' : 'đang vào map';
      const areaStr = m?.currentArea !== null && m?.currentArea !== undefined ? ` khu ${m.currentArea}` : '';
      const nodeStr = m?.currentNodeName ? ` · ${m.currentNodeName}` : '';
      const capStr = m?.remainingCapacity !== null && m?.remainingCapacity !== undefined ? ` (${m.remainingCapacity}/${m.maxCapacity})` : '';
      const countStr = m?.sessionHarvestCount ? ` · thu hoạch: ${m.sessionHarvestCount}` : '';
      const statusDesc = m?.status === 'paused_no_tool' ? ' · ⚠️ thiếu cuốc/rìu' : m?.status === 'paused_low_energy' ? ' · ⚡ hết năng lượng' : '';
      return `khai thác: ${mapStr}${areaStr}${nodeStr}${capStr}${countStr}${statusDesc}`;
    }
    if (progressMode === 'auto_fishing') {
      return `câu cá: ${formatFishingStatus(
        true,
        automation.fishingRuntime?.status,
        snap?.status,
      )}`;
    }
    if (progressMode === 'auto_farm') {
      return auto.running
        ? `auto farm đang chạy — vòng ${auto.cycle}`
        : 'auto farm đang chờ kết nối / vòng tiếp theo';
    }
    if (progressMode === 'auto_fisherman_quest') {
      const q = automation.fishermanQuestRuntime;
      const questPart = q?.questTitle
        ? `${q.questTitle}${q.targetFishName ? ` — ${q.targetFishName} ${q.caught}/${q.needed}` : ''}`
        : 'đang quét nhiệm vụ thợ câu…';
      const fishPart = `câu cá: ${formatFishingStatus(
        true,
        automation.fishingRuntime?.status,
        snap?.status,
      )}`;
      const errPart = q?.lastError ? ` · lỗi: ${q.lastError}` : '';
      return `${questPart} · ${fishPart}${errPart}`;
    }
    return `automation ${progressMode} đang hoạt động — hãy dừng trước khi đổi mode`;
  })();

  useEffect(() => {
    let active = true;
    setLoadingOpt(true);
    apiGet<AutoConfigResponse>(`/api/accounts/${accountId}/auto/config`)
      .then((res) => {
        if (active) {
          setLogoutAfterCycle(res.config.logoutAfterCycle ?? true);
        }
      })
      .catch(() => {
        /* bỏ qua nếu chưa tải được */
      })
      .finally(() => {
        if (active) setLoadingOpt(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  async function startAuto() {
    if (autoActive || mutationBusy) return;
    if (selectedMode === 'auto_mining') {
      setShowMiningModal(true);
      return;
    }
    setAutoAction('start');
    onAutomationMutationBusyChange(true);
    setAutoErr('');
    try {
      const loaded = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/start`,
        { mode: selectedMode },
      );
      if (loaded) onAutomationChange?.(loaded);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const loaded = (error.body as { snapshot?: AutomationSnapshot })?.snapshot;
        if (loaded) onAutomationChange?.(loaded);
        onChanged();
      } else {
        setAutoErr((error as Error).message);
      }
    } finally {
      setAutoAction(null);
      onAutomationMutationBusyChange(false);
    }
  }

  async function stopAuto() {
    if (!autoActive || mutationBusy) return;
    setAutoAction('stop');
    onAutomationMutationBusyChange(true);
    setAutoErr('');
    try {
      const loaded = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/stop`,
        {},
      );
      if (loaded) onAutomationChange?.(loaded);
      if (selectedMode === 'find_npc' || selectedMode === 'auto_maze') {
        setSelectedMode('auto_farm');
      }
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const loaded = (error.body as { snapshot?: AutomationSnapshot })?.snapshot;
        if (loaded) onAutomationChange?.(loaded);
        if (selectedMode === 'find_npc' || selectedMode === 'auto_maze') {
          setSelectedMode('auto_farm');
        }
        onChanged();
      } else {
        setAutoErr((error as Error).message);
      }
    } finally {
      setAutoAction(null);
      onAutomationMutationBusyChange(false);
    }
  }

  async function toggleLogoutAfterCycle(checked: boolean) {
    setSavingOpt(true);
    setAutoErr('');
    try {
      const current = await apiGet<AutoConfigResponse>(`/api/accounts/${accountId}/auto/config`);
      const nextConfig = {
        ...current.config,
        logoutAfterCycle: checked,
      };
      await apiPut<AutoConfigStateDto>(`/api/accounts/${accountId}/auto/config`, {
        expectedRevision: current.revision,
        config: nextConfig,
      });
      setLogoutAfterCycle(checked);
      onChanged();
    } catch (e) {
      setAutoErr((e as Error).message);
    } finally {
      setSavingOpt(false);
    }
  }

  return (
    <section className="card">
      <h2>Trạng thái</h2>
      <div className="row">
        <StatusBadge status={snap?.status ?? 'idle'} />
        <ModeChip automation={automation} fallbackActive={false} />
        <span className="hint">tài khoản game: {gameUser}</span>
        {snap?.playerId !== undefined && <span className="hint">id nhân vật: {snap.playerId}</span>}
        {snap?.money !== undefined && <span className="chip">{snap.money} xu</span>}
      </div>
      <div className="row automation-mode-selector" role="group" aria-label="Chọn chế độ tự động">
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_farm' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_farm'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_farm')}
        >
          Auto Farm
        </button>
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_fishing' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_fishing'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_fishing')}
        >
          Auto Fishing
        </button>
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_fisherman_quest' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_fisherman_quest'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_fisherman_quest')}
        >
          🎣 Làm nhiệm vụ thợ câu
        </button>
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_mining' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_mining'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_mining')}
        >
          ⛏️ Khai thác gỗ/đá
        </button>
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'auto_maze' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'auto_maze'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('auto_maze')}
        >
          🗝️ Mê cung
        </button>
        <button
          type="button"
          className={`automation-mode-button${selectedMode === 'find_npc' ? ' active' : ''}`}
          aria-pressed={selectedMode === 'find_npc'}
          disabled={controlsLocked}
          onClick={() => setSelectedMode('find_npc')}
        >
          🎯 Tìm NPC
        </button>
      </div>
      <div className="row">
        <button
          onClick={() => void startAuto()}
          disabled={autoActive || mutationBusy}
        >
          {autoAction === 'start' ? 'Đang bắt đầu…' : 'Bắt đầu'}
        </button>
        <button
          className="ghost"
          onClick={() => void stopAuto()}
          disabled={!autoActive || mutationBusy}
        >
          {autoAction === 'stop' ? 'Đang dừng…' : 'Dừng Auto'}
        </button>
        <span className="hint">
          {automationProgress}
          {automation?.transitionState === 'switching'
            ? ` · đang chuyển ${automation.activeMode} → ${automation.desiredMode}`
            : ''}
          {progressMode === 'auto_farm' && auto.lastRun
            ? ` · lần cuối ${new Date(auto.lastRun).toLocaleTimeString()}`
            : ''}
        </span>
      </div>
      <div className="row misc-status-row">
        <label className="inline misc-check-label">
          <input
            type="checkbox"
            checked={logoutAfterCycle}
            disabled={savingOpt || loadingOpt}
            onChange={(e) => void toggleLogoutAfterCycle(e.target.checked)}
            className="misc-check-input"
          />
          Đăng xuất sau khi chạy xong 1 vòng (tự đăng nhập lại ở vòng kế)
        </label>
      </div>
      {(autoErr || auto.lastError) && (
        <StatusBanner tone="error">{autoErr || auto.lastError}</StatusBanner>
      )}
      {farmSync?.status === 'syncing' && (
        <StatusBanner tone="info">Đang tự động đồng bộ dữ liệu nông trại…</StatusBanner>
      )}
      {farmSync?.status === 'success' && farmSync.completedAt && (
        <StatusBanner tone="success">
          Đã đồng bộ nông trại lúc {new Date(farmSync.completedAt).toLocaleTimeString()}
        </StatusBanner>
      )}
      {farmSync?.status === 'error' && (
        <StatusBanner tone="error">Đồng bộ nông trại thất bại: {farmSync.error}</StatusBanner>
      )}
      {/* Đang đếm ngược để thử lại: cho người dùng biết server chưa bỏ cuộc. */}
      {snap?.nextRetryAt && (
        <StatusBanner tone="warn">
          thử kết nối lại lần {snap.retries} lúc {new Date(snap.nextRetryAt).toLocaleTimeString()}
        </StatusBanner>
      )}
      {snap?.lastError && <StatusBanner tone="error">{snap.lastError}</StatusBanner>}
      <MiningTargetModal
        open={showMiningModal}
        accountId={accountId}
        onClose={() => setShowMiningModal(false)}
        onSuccess={(snapshot) => {
          if (snapshot) onAutomationChange?.(snapshot);
          onChanged();
        }}
      />
    </section>
  );
}
