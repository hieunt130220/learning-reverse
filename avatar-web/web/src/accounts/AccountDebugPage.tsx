import { Link, useParams } from 'react-router-dom';

import type { AccountWithRuntime } from '../types.js';
import { StatusBadge } from './AccountStatus.js';
import { useAccounts } from './AccountsProvider.js';
import { useAccountRuntime } from './useAccountRuntime.js';
import { DebugPanel } from './panels/DebugPanel.js';

export function AccountDebugPage() {
  const { id } = useParams();
  const accountId = Number(id);
  const { accounts, loading } = useAccounts();
  const account = Number.isInteger(accountId) && accountId > 0
    ? accounts.find((item) => item.id === accountId)
    : undefined;

  if (loading) return <p className="hint misc-loading">đang tải…</p>;
  if (!account) {
    return (
      <div className="app">
        <p className="err">không có tài khoản này</p>
        <Link to="/accounts">Về dashboard</Link>
      </div>
    );
  }
  return <LoadedDebugPage account={account} />;
}

/** Tách riêng vì hook runtime chỉ được gọi khi đã chắc chắn có account. */
function LoadedDebugPage({ account }: { account: AccountWithRuntime }) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  return (
    <div className="app account-debug-page">
      <header>
        <Link to={`/accounts/${account.id}`}>Về Vận hành</Link>
        <h1>Debug: {account.label}</h1>
        <StatusBadge status={snapshot?.status ?? 'idle'} />
      </header>
      <DebugPanel
        accountId={account.id}
        macro={snapshot?.macro ?? { running: false, cycle: 0 }}
        traffic={snapshot?.traffic ?? []}
      />
    </div>
  );
}
