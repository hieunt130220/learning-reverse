import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { AccountWithRuntime } from '../types.js';
import { useAccounts } from './AccountsProvider.js';
import { useAccountRuntime } from './useAccountRuntime.js';
import { useDialogFocus } from './useDialogFocus.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { AutoFarmPanel } from './panels/AutoFarmPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

export function AccountOperationsDrawer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const accountId = Number(id);
  const { accounts, loading, reload } = useAccounts();
  const account = Number.isInteger(accountId) && accountId > 0
    ? accounts.find((item) => item.id === accountId)
    : undefined;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => navigate('/accounts');
  useDialogFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose: close });

  return (
    <div className="dialog-backdrop dialog-backdrop--drawer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <aside ref={dialogRef} className="account-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="dialog-heading">
          <div><p className="eyebrow">VẬN HÀNH</p><h2 id="drawer-title">{account ? `Vận hành ${account.label}` : 'Vận hành tài khoản'}</h2></div>
          <button ref={closeRef} type="button" className="ghost" onClick={close} aria-label="Đóng">×</button>
        </header>
        {loading ? <p className="hint">đang tải…</p> : account ? (
          <LoadedOperations account={account} reload={reload} />
        ) : (
          <div className="drawer-empty"><p className="err">không có tài khoản này</p><Link to="/accounts">Về dashboard</Link></div>
        )}
      </aside>
    </div>
  );
}

/** Tách riêng vì hook runtime chỉ được gọi khi đã chắc chắn có account. */
function LoadedOperations({ account, reload }: { account: AccountWithRuntime; reload(): Promise<void> }) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  return (
    <div className="drawer-panels">
      <StatusPanel accountId={account.id} snap={snapshot} gameUser={account.gameUser} onChanged={() => void reload()} />
      <AutoFarmPanel accountId={account.id} auto={snapshot?.auto ?? { running: false, cycle: 0, lastActions: [] }} items={snapshot?.items ?? []} />
      <AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} />
      <LogPanel logs={snapshot?.logs ?? []} />
      <Link className="btn-link drawer-debug-link" to={`/accounts/${account.id}/debug`}>Debug chuyên sâu →</Link>
    </div>
  );
}
