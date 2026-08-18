import { useEffect, useState } from 'react';

import { apiGet, apiPost, apiPut } from '../../api.js';
import { StatusBadge } from '../AccountStatus.js';
import type { AutoConfigResponse, AutoConfigStateDto, SessionSnapshot } from '../../types.js';

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
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoErr, setAutoErr] = useState('');
  const [logoutAfterCycle, setLogoutAfterCycle] = useState(true);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [savingOpt, setSavingOpt] = useState(false);
  const farmSync = snap?.farmSync;
  const auto = snap?.auto ?? { running: false, cycle: 0, lastActions: [] };
  const autoActive = auto.running || snap?.desiredConnected === true;

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
    setAutoBusy(true);
    setAutoErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/start`, {});
      onChanged();
    } catch (e) {
      setAutoErr((e as Error).message);
    } finally {
      setAutoBusy(false);
    }
  }

  async function stopAuto() {
    setAutoBusy(true);
    setAutoErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/stop`);
      onChanged();
    } catch (e) {
      setAutoErr((e as Error).message);
    } finally {
      setAutoBusy(false);
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
      <div className="row">
        <button onClick={() => void startAuto()} disabled={autoActive || autoBusy}>
          {autoBusy && !autoActive ? 'Đang bật…' : 'Bật auto'}
        </button>
        <button className="ghost" onClick={() => void stopAuto()} disabled={!autoActive || autoBusy}>
          {autoBusy && autoActive ? 'Đang tắt…' : 'Tắt auto'}
        </button>
        <span className="hint">
          {auto.running
            ? `auto đang chạy — vòng ${auto.cycle}`
            : autoActive
              ? 'auto đang chờ vòng tiếp theo'
              : 'auto đang tắt'}
          {auto.lastRun ? ` · lần cuối ${new Date(auto.lastRun).toLocaleTimeString()}` : ''}
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
