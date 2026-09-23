import { useEffect, useRef, useState } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '../../api.js';
import {
  DEFAULT_FIND_NPC_CONFIG,
  type AutomationApiErrorDto,
  type AutomationSnapshot,
  type FindNpcConfig,
  type StoredFindNpcConfigState,
} from '../../types.js';

const EMPTY_CONFIG: StoredFindNpcConfigState = {
  revision: 0,
  config: DEFAULT_FIND_NPC_CONFIG,
};
const NOOP_BUSY = (_busy: boolean): void => {};
const NOOP_CAPABILITY = (_supported: boolean, _snapshot?: AutomationSnapshot): void => {};

function isConfigEqual(a: FindNpcConfig, b: FindNpcConfig): boolean {
  return (
    a.npcName === b.npcName &&
    (a.fromMap ?? 1) === (b.fromMap ?? 1) &&
    (a.toMap ?? 8) === (b.toMap ?? 8) &&
    (a.fromBoard ?? 0) === (b.fromBoard ?? 0) &&
    (a.toBoard ?? 19) === (b.toBoard ?? 19) &&
    (a.stopOnMaxQuantity ?? true) === (b.stopOnMaxQuantity ?? true) &&
    (a.cycleDelaySeconds ?? 30) === (b.cycleDelaySeconds ?? 30)
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const body = error.body as AutomationApiErrorDto | undefined;
  if (body?.code === 'automation-connect-pending') {
    return 'Đã lưu yêu cầu, đang chờ kết nối game.';
  }
  return error.message;
}

export function FindNpcPanel({
  accountId,
  automation,
  onDirtyChange,
  automationMutationBusy = false,
  onAutomationMutationBusyChange = NOOP_BUSY,
  onAutomationCapabilityChange = NOOP_CAPABILITY,
}: {
  accountId: number;
  automation?: AutomationSnapshot;
  onDirtyChange(dirty: boolean): void;
  automationMutationBusy?: boolean;
  onAutomationMutationBusyChange?(busy: boolean): void;
  onAutomationCapabilityChange?(supported: boolean, snapshot?: AutomationSnapshot): void;
}) {
  const [savedState, setSavedState] = useState<StoredFindNpcConfigState | null>(null);
  const [fetchedAutomation, setFetchedAutomation] = useState<AutomationSnapshot | undefined>();
  const incomingConfig = newestConfig(
    fetchedAutomation?.findNpcConfig ?? null,
    automation?.findNpcConfig ?? EMPTY_CONFIG,
  );
  const serverConfig = newestConfig(savedState, incomingConfig);
  const baseAutomation = automation ?? fetchedAutomation;
  const effectiveAutomation = baseAutomation
    ? { ...baseAutomation, findNpcConfig: serverConfig }
    : undefined;

  const [editBase, setEditBase] = useState<StoredFindNpcConfigState>(serverConfig);
  const [draft, setDraft] = useState<FindNpcConfig>({ ...DEFAULT_FIND_NPC_CONFIG, ...serverConfig.config });
  const [busy, setBusy] = useState<'save' | 'start' | 'stop' | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<StoredFindNpcConfigState | null>(null);

  const draftRef = useRef(draft);
  const accountRef = useRef(accountId);
  draftRef.current = draft;

  const trimmedName = draft.npcName.trim();
  const valid = [...trimmedName].length >= 1 && [...trimmedName].length <= 80;
  const dirty = !isConfigEqual(draft, editBase.config);

  useEffect(() => {
    if (dirty || (editBase.revision === serverConfig.revision && isConfigEqual(editBase.config, serverConfig.config))) {
      return;
    }
    setEditBase(serverConfig);
    setDraft({ ...DEFAULT_FIND_NPC_CONFIG, ...serverConfig.config });
    setConflict(null);
  }, [dirty, editBase, serverConfig]);

  useEffect(() => {
    if (!savedState) return;
    if (
      incomingConfig.revision > savedState.revision ||
      (incomingConfig.revision === savedState.revision && isConfigEqual(incomingConfig.config, savedState.config))
    ) {
      setSavedState(null);
    }
  }, [incomingConfig, savedState]);

  useEffect(() => {
    let active = true;
    accountRef.current = accountId;
    setSavedState(null);
    setFetchedAutomation(undefined);
    setEditBase(EMPTY_CONFIG);
    setDraft(DEFAULT_FIND_NPC_CONFIG);
    setBusy(null);
    setError('');
    setConflict(null);
    onDirtyChange(false);
    onAutomationMutationBusyChange(false);

    void apiGet<AutomationSnapshot>(`/api/accounts/${accountId}/automation`)
      .then((snapshot) => {
        if (!active || accountRef.current !== accountId) return;
        setFetchedAutomation(snapshot);
        onAutomationCapabilityChange(true, snapshot);
      })
      .catch((cause: unknown) => {
        if (!active || accountRef.current !== accountId) return;
        if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
          onAutomationCapabilityChange(false);
          return;
        }
        setError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [accountId, onAutomationCapabilityChange, onAutomationMutationBusyChange, onDirtyChange]);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  async function save() {
    if (!dirty || !valid) return;
    const submittedDraft = draft;
    const submittedAccountId = accountId;
    setBusy('save');
    setError('');
    try {
      const saved = await apiPut<StoredFindNpcConfigState>(
        `/api/accounts/${accountId}/automation/find-npc/config`,
        {
          expectedRevision: editBase.revision,
          config: {
            ...submittedDraft,
            npcName: submittedDraft.npcName.trim(),
          },
        },
      );
      if (accountRef.current !== submittedAccountId) return;
      setSavedState(saved);
      setEditBase(saved);
      if (draftRef.current === submittedDraft) {
        setDraft({ ...DEFAULT_FIND_NPC_CONFIG, ...saved.config });
      }
      setConflict(null);
    } catch (cause) {
      if (accountRef.current !== submittedAccountId) return;
      const apiError = cause as ApiError;
      const body = apiError.body as AutomationApiErrorDto | undefined;
      if (apiError.status === 409 && body?.code === 'revision-conflict' && body.current) {
        setConflict(body.current);
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      if (accountRef.current === submittedAccountId) setBusy(null);
    }
  }

  async function start() {
    if (automationMutationBusy || effectiveAutomation?.transitionState === 'switching') return;
    const submittedAccountId = accountId;
    setBusy('start');
    onAutomationMutationBusyChange(true);
    setError('');
    try {
      await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/start`, {
        mode: 'find_npc',
      });
    } catch (cause) {
      if (accountRef.current === submittedAccountId) setError(errorMessage(cause));
    } finally {
      if (accountRef.current === submittedAccountId) {
        setBusy(null);
        onAutomationMutationBusyChange(false);
      }
    }
  }

  async function stop() {
    if (automationMutationBusy || effectiveAutomation?.transitionState === 'switching') return;
    const submittedAccountId = accountId;
    setBusy('stop');
    onAutomationMutationBusyChange(true);
    setError('');
    try {
      await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/stop`, {});
    } catch (cause) {
      if (accountRef.current === submittedAccountId) setError(errorMessage(cause));
    } finally {
      if (accountRef.current === submittedAccountId) {
        setBusy(null);
        onAutomationMutationBusyChange(false);
      }
    }
  }

  const findNpcStable =
    effectiveAutomation?.transitionState === 'stable' &&
    (effectiveAutomation.desiredMode === 'find_npc' || effectiveAutomation.activeMode === 'find_npc');
  const canStop =
    effectiveAutomation !== undefined &&
    (effectiveAutomation.desiredMode === 'find_npc' ||
      effectiveAutomation.activeMode === 'find_npc' ||
      effectiveAutomation.transitionState === 'switching');

  const runtime = effectiveAutomation?.findNpcRuntime;
  const isRunning = findNpcStable || runtime?.running;

  return (
    <section className="card find-npc-status">
      <h2>🎯 Tự Động Tìm NPC</h2>

      {/* Live Monitor Card */}
      <div className="card" style={{ marginBottom: '1rem', background: 'var(--color-bg-secondary, rgba(0,0,0,0.03))' }}>
        <h3 style={{ marginTop: 0 }}>Trạng thái hoạt động</h3>
        <div className="row" style={{ alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className={`chip ${isRunning ? 'chip-success' : ''}`}>
            {runtime?.phase === 'waiting_npc'
              ? '🎯 Đang ở cùng NPC'
              : runtime?.phase === 'daily_limit_reached'
              ? '🛑 Đã đạt giới hạn ngày'
              : runtime?.phase === 'waiting_next_cycle'
              ? '⏳ Chờ vòng quét tiếp'
              : isRunning
              ? '🔍 Đang quét phòng'
              : 'Tắt'}
          </span>
          {runtime?.currentMap !== null && runtime?.currentMap !== undefined && (
            <span className="hint">
              Vị trí hiện tại: <strong>Map {runtime.currentMap} - Khu {runtime.currentBoard ?? 0}</strong>
            </span>
          )}
          {runtime?.cursor !== undefined && runtime.total > 0 && (
            <span className="hint">
              Tiến độ quét: {runtime.cursor}/{runtime.total} phòng
            </span>
          )}
        </div>

        {runtime?.foundNpc && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--color-success, #22c55e)',
              background: 'rgba(34, 197, 94, 0.08)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-success, #16a34a)' }}>
              🎯 Đã tìm thấy NPC: "{runtime.foundNpc.name}" (ID: {runtime.foundNpc.id}) tại Map {runtime.foundNpc.map} - Khu {runtime.foundNpc.board}
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9em' }}>
              ⏳ Đang đứng tại phòng để nhận quà (đã chờ {runtime.waitingSeconds ?? 0}s)
            </p>
          </div>
        )}

        {runtime?.eventRewardProgress && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9em' }}>
              <span>🎁 Quà sự kiện nhận được:</span>
              <strong>
                {runtime.eventRewardProgress.current} / {runtime.eventRewardProgress.max}
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'var(--color-border, #e2e8f0)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.round((runtime.eventRewardProgress.current / runtime.eventRewardProgress.max) * 100))}%`,
                  height: '100%',
                  background: runtime.dailyLimitReached ? 'var(--color-warning, #f59e0b)' : 'var(--color-primary, #3b82f6)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {runtime?.dailyLimitReached && (
          <p className="hint" style={{ marginTop: '0.5rem', color: 'var(--color-warning, #d97706)', fontWeight: 600 }}>
            ⚠️ Tài khoản đã nhận đủ số lượng quà tối đa trong ngày ({runtime.eventRewardProgress?.current}/{runtime.eventRewardProgress?.max}). Bot sẽ tự động dừng quét!
          </p>
        )}

        {runtime?.lastError && (
          <p className="err" role="alert" style={{ marginTop: '0.5rem' }}>
            Lỗi gần nhất: {runtime.lastError}
          </p>
        )}
      </div>

      {/* Configuration Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label htmlFor="find-npc-name" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Tên NPC mục tiêu
          </label>
          <input
            id="find-npc-name"
            style={{ width: '100%' }}
            value={draft.npcName}
            maxLength={80}
            disabled={busy === 'save'}
            placeholder="Ví dụ: Chú Cuội, Chức Nữ, Ngưu Lang..."
            aria-invalid={!valid}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, npcName: event.target.value }));
              setError('');
            }}
          />
          <span className="hint">Tên NPC không phân biệt chữ hoa, chữ thường.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label htmlFor="find-npc-from-map" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9em' }}>
              Từ Map
            </label>
            <input
              id="find-npc-from-map"
              type="number"
              min={0}
              max={100}
              style={{ width: '100%' }}
              value={draft.fromMap ?? 1}
              onChange={(e) => setDraft((prev) => ({ ...prev, fromMap: parseInt(e.target.value, 10) || 1 }))}
            />
          </div>
          <div>
            <label htmlFor="find-npc-to-map" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9em' }}>
              Đến Map
            </label>
            <input
              id="find-npc-to-map"
              type="number"
              min={0}
              max={100}
              style={{ width: '100%' }}
              value={draft.toMap ?? 8}
              onChange={(e) => setDraft((prev) => ({ ...prev, toMap: parseInt(e.target.value, 10) || 8 }))}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label htmlFor="find-npc-from-board" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9em' }}>
              Từ Khu (Board)
            </label>
            <input
              id="find-npc-from-board"
              type="number"
              min={0}
              max={50}
              style={{ width: '100%' }}
              value={draft.fromBoard ?? 0}
              onChange={(e) => setDraft((prev) => ({ ...prev, fromBoard: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
          <div>
            <label htmlFor="find-npc-to-board" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9em' }}>
              Đến Khu (Board)
            </label>
            <input
              id="find-npc-to-board"
              type="number"
              min={0}
              max={50}
              style={{ width: '100%' }}
              value={draft.toBoard ?? 19}
              onChange={(e) => setDraft((prev) => ({ ...prev, toBoard: parseInt(e.target.value, 10) || 19 }))}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.stopOnMaxQuantity ?? true}
              onChange={(e) => setDraft((prev) => ({ ...prev, stopOnMaxQuantity: e.target.checked }))}
            />
            <span>Tự động dừng khi đạt giới hạn quà tối đa trong ngày (ví dụ 50/50)</span>
          </label>
        </div>

        <div>
          <label htmlFor="find-npc-cycle-delay" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9em' }}>
            Thời gian nghỉ giữa các vòng quét (giây)
          </label>
          <input
            id="find-npc-cycle-delay"
            type="number"
            min={5}
            max={3600}
            style={{ width: '120px' }}
            value={draft.cycleDelaySeconds ?? 30}
            onChange={(e) => setDraft((prev) => ({ ...prev, cycleDelaySeconds: parseInt(e.target.value, 10) || 30 }))}
          />
        </div>
      </div>

      <div className="find-npc-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty || !valid}>
          {busy === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy !== null || automationMutationBusy || effectiveAutomation?.transitionState === 'switching' || dirty || !valid || findNpcStable}
        >
          {busy === 'start' ? 'Đang bật…' : 'Bắt đầu tìm'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void stop()}
          disabled={busy !== null || automationMutationBusy || effectiveAutomation?.transitionState === 'switching' || !canStop}
        >
          {busy === 'stop' ? 'Đang dừng…' : 'Dừng tìm'}
        </button>
      </div>

      {conflict && (
        <div className="find-npc-conflict" style={{ marginTop: '0.75rem' }}>
          <p className="err" role="alert">
            Cấu hình trên server đã thay đổi từ phiên khác.
          </p>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSavedState(conflict);
              setEditBase(conflict);
              setDraft({ ...DEFAULT_FIND_NPC_CONFIG, ...conflict.config });
              setConflict(null);
              setError('');
            }}
          >
            Tải cấu hình từ server
          </button>
        </div>
      )}

      {error && <p className="err" role="alert" style={{ marginTop: '0.5rem' }}>{error}</p>}
    </section>
  );
}

function newestConfig(
  local: StoredFindNpcConfigState | null,
  incoming: StoredFindNpcConfigState,
): StoredFindNpcConfigState {
  if (!local) return incoming;
  return local.revision >= incoming.revision ? local : incoming;
}
