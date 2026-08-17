import { useState } from 'react';

import { apiPost } from '../../api.js';
import { StatusBadge } from '../AccountStatus.js';
import type { SessionSnapshot } from '../../types.js';

export function StatusPanel({
  accountId,
  snap,
  gameUser,
  onChanged,
}: {
  accountId: number;
  snap: SessionSnapshot | null;
  gameUser: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const online = snap?.status === 'online';
  const connecting = snap?.status === 'connecting'
    || snap?.status === 'handshaking'
    || snap?.status === 'logging-in';
  const farmSync = snap?.farmSync;

  async function toggle() {
    setBusy(true);
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/${online ? 'disconnect' : 'connect'}`);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
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
      <div className="row">
        <button onClick={() => void toggle()} disabled={busy || connecting}>
          {online ? 'Ngắt' : connecting ? 'Đang kết nối…' : 'Kết nối'}
        </button>
      </div>
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
      {(err || snap?.lastError) && <p className="err">{err || snap?.lastError}</p>}
    </section>
  );
}
