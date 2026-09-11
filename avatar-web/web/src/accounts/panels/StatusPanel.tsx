import { useEffect, useState } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '../../api.js';
import { StatusBadge } from '../AccountStatus.js';
import type { AutomationSnapshot, AutoConfigResponse, AutoConfigStateDto, SessionSnapshot } from '../../types.js';
import { formatFishingStatus } from './FishingPanel.js';

type StatusAutomationMode = 'auto_farm' | 'auto_fishing' | 'auto_fisherman_quest';

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
    if (snapshotMode === 'auto_farm' || snapshotMode === 'auto_fishing' || snapshotMode === 'auto_fisherman_quest') {
      setSelectedMode(snapshotMode);
    }
  }, [automation?.desiredMode, automation?.activeMode]);

  const automationProgress = (() => {
    if (!automation || progressMode === 'off') return 'automation đang tắt';
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
      <div className="row" style={{ marginTop: '0.25rem' }}>
        <label
          className="inline"
          style={{
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <input
            type="checkbox"
            checked={logoutAfterCycle}
            disabled={savingOpt || loadingOpt}
            onChange={(e) => void toggleLogoutAfterCycle(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          Đăng xuất sau khi chạy xong 1 vòng (tự đăng nhập lại ở vòng kế)
        </label>
      </div>
      {(autoErr || auto.lastError) && <p className="err">{autoErr || auto.lastError}</p>}
      {farmSync?.status === 'syncing' && (
        <p className="hint">Đang tự động đồng bộ dữ liệu nông trại…</p>
      )}
      {farmSync?.status === 'success' && farmSync.completedAt && (
        <p className="hint">
          Đã đồng bộ nông trại lúc {new Date(farmSync.completedAt).toLocaleTimeString()}
        </p>
      )}
      {farmSync?.status === 'error' && (
        <p className="err">Đồng bộ nông trại thất bại: {farmSync.error}</p>
      )}
      {/* Đang đếm ngược để thử lại: cho người dùng biết server chưa bỏ cuộc. */}
      {snap?.nextRetryAt && (
        <p className="hint">
          thử kết nối lại lần {snap.retries} lúc {new Date(snap.nextRetryAt).toLocaleTimeString()}
        </p>
      )}
      {snap?.lastError && <p className="err">{snap.lastError}</p>}
    </section>
  );
}
