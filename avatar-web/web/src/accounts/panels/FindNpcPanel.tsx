import { useEffect, useRef, useState } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '../../api.js';
import type {
  AutomationApiErrorDto,
  AutomationSnapshot,
  StoredFindNpcConfigState,
} from '../../types.js';

const EMPTY_CONFIG: StoredFindNpcConfigState = {
  revision: 0,
  config: { npcName: '' },
};
const NOOP_BUSY = (_busy: boolean): void => {};
const NOOP_CAPABILITY = (_supported: boolean, _snapshot?: AutomationSnapshot): void => {};

function runtimeText(automation?: AutomationSnapshot): string {
  if (!automation) return 'Chưa tải trạng thái tự động';
  if (automation.transitionState === 'switching') return 'Đang chuyển chế độ';
  if (automation.location) {
    return `Đã thấy tại Map ${automation.location.map} - Khu ${automation.location.area}`;
  }
  const runtime = automation.findNpcRuntime;
  if (runtime.phase === 'scan_backoff' && runtime.backoffUntil) {
    return `Đang nghỉ đến ${new Date(runtime.backoffUntil).toLocaleTimeString()}`;
  }
  if (runtime.phase === 'scanning' && runtime.probing) {
    return `Đang quét ${Math.min(runtime.cursor + 1, runtime.total)}/${runtime.total} · Map ${runtime.probing.map} - Khu ${runtime.probing.area}`;
  }
  if (automation.desiredMode === 'find_npc') return 'Đang chờ bắt đầu quét';
  return 'Tìm NPC đang tắt';
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const body = error.body as AutomationApiErrorDto | undefined;
  if (body?.code === 'catalog-unverified') {
    return 'Catalog vị trí NPC chưa được xác minh live; chưa thể bắt đầu.';
  }
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
  const [draft, setDraft] = useState(editBase.config.npcName);
  const [busy, setBusy] = useState<'save' | 'start' | 'stop' | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<StoredFindNpcConfigState | null>(null);
  const draftRef = useRef(draft);
  const accountRef = useRef(accountId);
  draftRef.current = draft;
  const trimmed = draft.trim();
  const valid = [...trimmed].length >= 1 && [...trimmed].length <= 80;
  const dirty = draft !== editBase.config.npcName;

  useEffect(() => {
    if (
      dirty
      || (
        editBase.revision === serverConfig.revision
        && editBase.config.npcName === serverConfig.config.npcName
      )
    ) return;
    setEditBase(serverConfig);
    setDraft(serverConfig.config.npcName);
    setConflict(null);
  }, [dirty, editBase, serverConfig]);

  useEffect(() => {
    if (!savedState) return;
    if (
      incomingConfig.revision > savedState.revision
      || (
        incomingConfig.revision === savedState.revision
        && incomingConfig.config.npcName === savedState.config.npcName
      )
    ) setSavedState(null);
  }, [incomingConfig, savedState]);

  useEffect(() => {
    let active = true;
    accountRef.current = accountId;
    setSavedState(null);
    setFetchedAutomation(undefined);
    setEditBase(EMPTY_CONFIG);
    setDraft(EMPTY_CONFIG.config.npcName);
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
    const submittedName = trimmed;
    const submittedAccountId = accountId;
    setBusy('save');
    setError('');
    try {
      const saved = await apiPut<StoredFindNpcConfigState>(
        `/api/accounts/${accountId}/automation/find-npc/config`,
        { expectedRevision: editBase.revision, config: { npcName: submittedName } },
      );
      if (accountRef.current !== submittedAccountId) return;
      setSavedState(saved);
      setEditBase(saved);
      if (draftRef.current === submittedDraft) setDraft(saved.config.npcName);
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

  const findNpcStable = effectiveAutomation?.transitionState === 'stable'
    && (effectiveAutomation.desiredMode === 'find_npc' || effectiveAutomation.activeMode === 'find_npc');
  const canStop = effectiveAutomation !== undefined
    && (
      effectiveAutomation.desiredMode === 'find_npc'
      || effectiveAutomation.activeMode === 'find_npc'
      || effectiveAutomation.transitionState === 'switching'
    );

  return (
    <section className="card find-npc-status">
      <h2>Tìm NPC</h2>
      <label htmlFor="find-npc-name">Tên NPC chính xác</label>
      <input
        id="find-npc-name"
        value={draft}
        maxLength={80}
        disabled={busy === 'save'}
        aria-invalid={!valid}
        onChange={(event) => {
          setDraft(event.target.value);
          setError('');
        }}
      />
      <p className="hint">{runtimeText(effectiveAutomation)}</p>
      {effectiveAutomation?.findNpcRuntime.lastError && (
        <p className="err" role="alert" aria-live="polite">
          Find NPC: {effectiveAutomation.findNpcRuntime.lastError}
        </p>
      )}
      <div className="find-npc-actions">
        <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty || !valid}>
          {busy === 'save' ? 'Đang lưu…' : 'Lưu tên NPC'}
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
        <div className="find-npc-conflict">
          <p className="err" role="alert">
            Tên NPC trên server đã thay đổi thành “{conflict.config.npcName}”.
          </p>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSavedState(conflict);
              setEditBase(conflict);
              setDraft(conflict.config.npcName);
              setConflict(null);
              setError('');
            }}
          >
            Tải tên từ server
          </button>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
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
