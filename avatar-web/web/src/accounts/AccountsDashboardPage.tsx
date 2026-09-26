import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import { AccountCard } from './AccountCard.js';
import { useAccounts } from './AccountsProvider.js';
import { AddAccountModal } from './AddAccountModal.js';

export function AccountsDashboardPage() {
  const { user, logout } = useAuth();
  const { accounts, loading, error, reload } = useAccounts();
  const [adding, setAdding] = useState(false);

  return (
    <div className="app accounts-dashboard">
      <header className="dashboard-header">
        <div><p className="eyebrow">AVATAR WEB</p><h1>Tài khoản avatar</h1></div>
        <span className="hint">{user?.email}</span>
        <Link className="button-link ghost" to="/admin/monitoring">Monitoring</Link>
        <button className="ghost" onClick={() => void logout()}>Đăng xuất</button>
      </header>
      {/* Còn card để xem thì lỗi reload chỉ là thông báo, không chặn dashboard. */}
      {error && accounts.length > 0 && <p className="dashboard-error err">{error}</p>}
      {loading && accounts.length === 0 && <p className="hint">đang tải…</p>}
      {!loading && error && accounts.length === 0 ? (
        <section className="card dashboard-empty"><p className="err">{error}</p><button onClick={() => void reload()}>Thử lại</button></section>
      ) : (
        <section className="accounts-grid" aria-label="Danh sách tài khoản">
          {accounts.map((account) => <AccountCard key={account.id} account={account} reload={reload} />)}
          <button className="account-add-card" type="button" onClick={() => setAdding(true)}>
            <b>＋</b><span>Thêm tài khoản</span>
          </button>
        </section>
      )}
      <AddAccountModal open={adding} onClose={() => setAdding(false)} reload={reload} />
      <Outlet />
    </div>
  );
}
