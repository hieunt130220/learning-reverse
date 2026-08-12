import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { apiDelete, apiGet, apiPost } from '../api.js';
import { useAuth } from '../auth/useAuth.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import type { AccountWithRuntime, ClientStatus } from '../types.js';

export const statusLabel: Record<ClientStatus, string> = {
  idle: 'chưa kết nối',
  connecting: 'đang kết nối',
  handshaking: 'đang bắt tay',
  'logging-in': 'đang đăng nhập',
  online: 'đang online',
  error: 'lỗi',
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status] ?? status}</span>;
}

export function AccountsPage() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    try {
      setAccounts(await apiGet<AccountWithRuntime[]>('/api/accounts'));
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Trang danh sách không mở chi tiết tài khoản nào: bỏ mọi subscribe để khỏi
  // nhận gói tin và log của phiên đang chạy.
  useEffect(() => {
    subscribeAccounts([]);
  }, []);

  // `status` và `auto` là sự kiện nhẹ, server đẩy về không cần subscribe — đủ
  // để bảng tự cập nhật mà không phải hỏi lại API.
  useEffect(
    () =>
      onWsMessage((msg) => {
        if (msg.type === 'status') {
          setAccounts((list) =>
            list.map((a) =>
              a.id === msg.accountId && a.runtime
                ? { ...a, runtime: { ...a.runtime, status: msg.payload } }
                : a,
            ),
          );
        } else if (msg.type === 'auto') {
          setAccounts((list) =>
            list.map((a) =>
              a.id === msg.accountId && a.runtime
                ? { ...a, runtime: { ...a.runtime, auto: msg.payload } }
                : a,
            ),
          );
        } else if (msg.type === 'auto-disabled') {
          // Server tự tắt auto (sai mật khẩu game) — trạng thái DB đã đổi, hỏi lại.
          void reload();
        }
      }),
    [reload],
  );

  async function toggleAuto(acc: AccountWithRuntime) {
    setErr('');
    try {
      if (acc.autoEnabled) await apiPost(`/api/accounts/${acc.id}/auto/stop`);
      else await apiPost(`/api/accounts/${acc.id}/auto/start`, acc.runtime?.auto ?? {});
    } catch (e) {
      setErr((e as Error).message);
    }
    // Ý muốn đã ghi vào DB kể cả khi phiên chưa kết nối (server trả 409) —
    // nạp lại để công tắc phản ánh đúng trạng thái đã lưu.
    await reload();
  }

  async function connect(acc: AccountWithRuntime) {
    setErr('');
    try {
      const online = acc.runtime?.status === 'online';
      await apiPost(`/api/accounts/${acc.id}/${online ? 'disconnect' : 'connect'}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(acc: AccountWithRuntime) {
    if (!confirm(`Xoá tài khoản "${acc.label}"? Phiên đang chạy sẽ bị dừng.`)) return;
    setErr('');
    try {
      await apiDelete(`/api/accounts/${acc.id}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Tài khoản avatar</h1>
        <span className="hint">{user?.email}</span>
        <button className="ghost" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </header>

      {err && <p className="err">{err}</p>}

      <section className="card">
        {loading && <p className="hint">đang tải…</p>}
        {!loading && accounts.length === 0 && (
          <p className="hint">Chưa có tài khoản nào. Thêm một cái ở dưới.</p>
        )}
        {accounts.length > 0 && (
          <table className="accounts">
            <thead>
              <tr>
                <th>Nhãn</th>
                <th>Tài khoản game</th>
                <th>Trạng thái</th>
                <th>Tự động</th>
                <th>Xu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/accounts/${a.id}`}>{a.label}</Link>
                  </td>
                  <td>{a.gameUser}</td>
                  <td>
                    <StatusBadge status={a.runtime?.status ?? 'idle'} />
                    {a.runtime?.lastError && <div className="hint">{a.runtime.lastError}</div>}
                  </td>
                  <td>
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={a.autoEnabled}
                        onChange={() => void toggleAuto(a)}
                        style={{ width: 'auto' }}
                      />
                      {a.runtime?.auto.running ? `vòng ${a.runtime.auto.cycle}` : 'tắt'}
                    </label>
                  </td>
                  <td>{a.runtime?.money ?? '—'}</td>
                  <td className="row">
                    <button className="ghost" onClick={() => void connect(a)}>
                      {a.runtime?.status === 'online' ? 'Ngắt' : 'Kết nối'}
                    </button>
                    <Link className="btn-link" to={`/accounts/${a.id}`}>
                      Chi tiết
                    </Link>
                    <button className="ghost" onClick={() => void remove(a)}>
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddAccountForm onAdded={reload} />
    </div>
  );
}

function AddAccountForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [label, setLabel] = useState('');
  const [gameUser, setGameUser] = useState('');
  const [gamePass, setGamePass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await apiPost('/api/accounts', { label, gameUser, gamePass });
      setLabel('');
      setGameUser('');
      setGamePass('');
      await onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Thêm tài khoản</h2>
      <p className="hint">
        Mật khẩu game được mã hoá trước khi lưu và không bao giờ hiện lại trên giao diện.
      </p>
      <div className="row">
        <label className="inline">
          Nhãn
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label className="inline">
          Tài khoản game
          <input
            value={gameUser}
            onChange={(e) => setGameUser(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="inline">
          Mật khẩu game
          <input
            type="password"
            value={gamePass}
            onChange={(e) => setGamePass(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
      </div>
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'đang thêm…' : 'Thêm'}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}
