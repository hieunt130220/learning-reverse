import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDelete } from '../api.js';
import type { AccountWithRuntime } from '../types.js';
import { ModeChip, StatusBadge } from './AccountStatus.js';

export interface AccountCardProps {
  account: AccountWithRuntime;
  reload(): Promise<void>;
}

export function AccountCard({ account, reload }: AccountCardProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'delete' | null>(null);
  const [actionError, setActionError] = useState('');
  const runtime = account.runtime;
  const cached = account.cachedMetrics;
  const xu = runtime?.xu ?? runtime?.money ?? cached?.xu;
  const luong = runtime?.luong ?? cached?.luong;
  const luongKhoa = runtime?.luongKhoa ?? cached?.luongKhoa;
  const playerLevel = runtime?.playerLevel ?? cached?.playerLevel;
  const farmLevel = runtime?.farmLevel ?? cached?.farmLevel;
  const automation = runtime?.automation;
  const autoActive = automation
    ? automation.desiredMode !== 'off'
      || automation.activeMode !== 'off'
      || automation.transitionState === 'switching'
    : runtime
      ? runtime.desiredConnected
      : account.autoEnabled;
  const formatMetric = (value: number | undefined) =>
    value === undefined ? '—' : Intl.NumberFormat('vi-VN').format(value);
  const formatLuong = () => {
    if (luong === undefined && luongKhoa === undefined) return '—';
    const main = luong !== undefined ? Intl.NumberFormat('vi-VN').format(luong) : '0';
    if (luongKhoa !== undefined && luongKhoa > 0) {
      return `${main} (+${Intl.NumberFormat('vi-VN').format(luongKhoa)} khóa)`;
    }
    return main;
  };
  // Lỗi thật quan trọng hơn lịch thử lại; chỉ khi không có lỗi mới cần đếm ngược.
  const runtimeNotice = runtime?.lastError
    ?? (runtime?.nextRetryAt
      ? `thử lại lúc ${new Date(runtime.nextRetryAt).toLocaleTimeString('vi-VN')}`
      : '');
  const open = () => navigate(`/accounts/${account.id}`);

  async function remove() {
    if (!confirm(`Xoá tài khoản "${account.label}"? Phiên đang chạy sẽ bị dừng.`)) return;
    setBusy('delete');
    setActionError('');
    try {
      await apiDelete(`/api/accounts/${account.id}`);
      await reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="account-card" data-account-id={account.id}>
      <button className="account-card-main" type="button" onClick={open} aria-label={`Mở ${account.label}`}>
        <span className="account-card-heading">
          <span><b>{account.label}</b><small>{account.gameUser}</small></span>
          <span className="account-card-status">
            <StatusBadge status={runtime?.status ?? 'idle'} />
            <ModeChip automation={automation} fallbackActive={autoActive && !automation} />
          </span>
        </span>
        <span className="account-card-stats">
          <span><small>Xu</small><b>{formatMetric(xu)}</b></span>
          <span><small>Lượng</small><b>{formatLuong()}</b></span>
          <span><small>Level</small><b>NV {playerLevel ?? '—'} · Farm {farmLevel ?? '—'}</b></span>
          <span>
            <small>Chu kỳ</small>
            <b>
              {runtime?.auto.running
                ? `vòng ${runtime.auto.cycle}${runtime.auto.lastRun ? ` · ${new Date(runtime.auto.lastRun).toLocaleTimeString()}` : ''}`
                : autoActive
                  ? 'đang chờ'
                  : '—'}
            </b>
          </span>
        </span>
        {runtimeNotice && <span className="account-card-notice">{runtimeNotice}</span>}
      </button>
      <footer className="account-card-actions">
        <button className="ghost" type="button" onClick={open} disabled={busy !== null}>Mở vận hành</button>
        <button className="ghost danger" type="button" onClick={() => void remove()} disabled={busy !== null} aria-label={`Xóa ${account.label}`}>Xóa</button>
      </footer>
      {actionError && <p className="err account-card-error">{actionError}</p>}
    </article>
  );
}
