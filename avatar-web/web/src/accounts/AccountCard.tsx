import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDelete, apiPost } from '../api.js';
import type { AccountWithRuntime } from '../types.js';
import { StatusBadge } from './AccountStatus.js';

export interface AccountCardProps {
  account: AccountWithRuntime;
  reload(): Promise<void>;
}

export function AccountCard({ account, reload }: AccountCardProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'control' | 'delete' | null>(null);
  const [actionError, setActionError] = useState('');
  const runtime = account.runtime;
  const online = runtime?.status === 'online';
  // Lỗi thật quan trọng hơn lịch thử lại; chỉ khi không có lỗi mới cần đếm ngược.
  const runtimeNotice = runtime?.lastError
    ?? (runtime?.nextRetryAt
      ? `thử lại lúc ${new Date(runtime.nextRetryAt).toLocaleTimeString('vi-VN')}`
      : '');
  const open = () => navigate(`/accounts/${account.id}`);

  async function control() {
    setBusy('control');
    setActionError('');
    try {
      await apiPost(`/api/accounts/${account.id}/${online ? 'disconnect' : 'connect'}`);
      await reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

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
      {/* Vùng nội dung và footer là anh em: button lồng button vừa sai HTML vừa
          làm nút Ngắt/Xóa vô tình mở drawer. */}
      <button className="account-card-main" type="button" onClick={open} aria-label={`Mở ${account.label}`}>
        <span className="account-card-heading">
          <span><b>{account.label}</b><small>{account.gameUser}</small></span>
          <StatusBadge status={runtime?.status ?? 'idle'} />
        </span>
        <span className="account-card-stats">
          <span><small>Xu</small><b>{runtime?.money === undefined ? '—' : Intl.NumberFormat('vi-VN').format(runtime.money)}</b></span>
          <span><small>Tự động</small><b>{runtime?.auto.running ? `vòng ${runtime.auto.cycle}` : 'đang tắt'}</b></span>
        </span>
        {runtimeNotice && <span className="account-card-notice">{runtimeNotice}</span>}
      </button>
      <footer className="account-card-actions">
        <button type="button" onClick={() => void control()} disabled={busy !== null}>
          {online ? 'Ngắt' : 'Kết nối'}
        </button>
        <button className="ghost" type="button" onClick={open} disabled={busy !== null}>Mở vận hành</button>
        <button className="ghost danger" type="button" onClick={() => void remove()} disabled={busy !== null} aria-label={`Xóa ${account.label}`}>Xóa</button>
      </footer>
      {actionError && <p className="err account-card-error">{actionError}</p>}
    </article>
  );
}
