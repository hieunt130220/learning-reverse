import { useEffect, useRef, useState } from 'react';

import { ApiError, apiPost, apiPut } from '../../api.js';
import type {
  AutomationApiErrorDto,
  AutomationSnapshot,
  StoredFindNpcConfigState,
} from '../../types.js';

const EMPTY_CONFIG: StoredFindNpcConfigState = {
  revision: 0,
  config: { npcName: '' },
};

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
  onAutomationMutationBusyChange = () => {},
}: {
  accountId: number;
  automation?: AutomationSnapshot;
  onDirtyChange(dirty: boolean): void;
  automationMutationBusy?: boolean;
  onAutomationMutationBusyChange?(busy: boolean): void;
}) {
  const [savedState, setSavedState] = useState<StoredFindNpcConfigState | null>(null);
  const incomingConfig = automation?.findNpcConfig ?? EMPTY_CONFIG;
  const serverConfig = savedState ?? incomingConfig;
  const [editBase, setEditBase] = useState<StoredFindNpcConfigState>(serverConfig);
  const [draft, setDraft] = useState(editBase.config.npcName);
  const [busy, setBusy] = useState<'save' | 'start' | 'stop' | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<StoredFindNpcConfigState | null>(null);
  const draftRef = useRef(draft);
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
    if (!savedState || incomingConfig.revision < savedState.revision) return;
    setSavedState(null);
  }, [incomingConfig, savedState]);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  async function save() {
    if (!dirty || !valid) return;
    const submittedDraft = draft;
    const submittedName = trimmed;
    setBusy('save');
    setError('');
    try {
      const saved = await apiPut<StoredFindNpcConfigState>(
        `/api/accounts/${accountId}/automation/find-npc/config`,
        { expectedRevision: editBase.revision, config: { npcName: submittedName } },
      );
      setSavedState(saved);
      setEditBase(saved);
      if (draftRef.current === submittedDraft) setDraft(saved.config.npcName);
      setConflict(null);
    } catch (cause) {
      const apiError = cause as ApiError;
      const body = apiError.body as AutomationApiErrorDto | undefined;
      if (apiError.status === 409 && body?.code === 'revision-conflict' && body.current) {
        setConflict(body.current);
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    if (automationMutationBusy || automation?.transitionState === 'switching') return;
    setBusy('start');
    onAutomationMutationBusyChange(true);
    setError('');
    try {
      await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/start`, {
        mode: 'find_npc',
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
      onAutomationMutationBusyChange(false);
    }
  }

  async function stop() {
    if (automationMutationBusy || automation?.transitionState === 'switching') return;
    setBusy('stop');
    onAutomationMutationBusyChange(true);
    setError('');
    try {
      await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/stop`, {});
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
      onAutomationMutationBusyChange(false);
    }
  }

  const findNpcStable = automation?.transitionState === 'stable'
    && (automation.desiredMode === 'find_npc' || automation.activeMode === 'find_npc');
  const canStop = automation !== undefined
    && (
      automation.desiredMode === 'find_npc'
      || automation.activeMode === 'find_npc'
      || automation.transitionState === 'switching'
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
      <p className="hint">{runtimeText(automation)}</p>
      <div className="find-npc-actions">
        <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty || !valid}>
          {busy === 'save' ? 'Đang lưu…' : 'Lưu tên NPC'}
        </button>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy !== null || automationMutationBusy || automation?.transitionState === 'switching' || dirty || !valid || findNpcStable}
        >
          {busy === 'start' ? 'Đang bật…' : 'Bắt đầu tìm'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void stop()}
          disabled={busy !== null || automationMutationBusy || automation?.transitionState === 'switching' || !canStop}
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
