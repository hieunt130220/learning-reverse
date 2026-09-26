import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '../api.js';
import { onWsMessage } from '../ws.js';
import { getMonitoringOverview, type HealthStatus, type MonitoringOverview, type RuntimeStatus } from './monitoringApi.js';

const STATUS_LABEL: Record<HealthStatus | RuntimeStatus, string> = {
  healthy: 'tốt', degraded: 'suy giảm', down: 'down', unknown: 'chưa biết', online: 'online', connecting: 'connecting', handshaking: 'handshaking', 'logging-in': 'logging in', error: 'lỗi', idle: 'idle',
};
function formatTime(value: string | null): string { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }
function statusClass(status: string): string {
  if (status === 'healthy' || status === 'online') return 'monitoring-status monitoring-status--ok';
  if (status === 'degraded' || status === 'connecting' || status === 'handshaking' || status === 'logging-in') return 'monitoring-status monitoring-status--warn';
  if (status === 'down' || status === 'error') return 'monitoring-status monitoring-status--error';
  return 'monitoring-status';
}
function Status({ status }: { status: string }) { return <span className={statusClass(status)}>{STATUS_LABEL[status as HealthStatus | RuntimeStatus] ?? status}</span>; }

export function MonitoringPage() {
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const reload = useCallback(async () => {
    try {
      const next = await getMonitoringOverview();
      if (next.schemaVersion !== 1) throw new Error('dashboard không tương thích schema');
      setOverview(next); setLastLoadedAt(next.generatedAt); setError(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'không tải được monitoring'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 15_000);
    const unsubscribe = onWsMessage((message) => { if (message.type === 'status' || message.type === 'auto-disabled') void reload(); });
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, [reload]);
  const events = useMemo(() => {
    const items = overview?.errors ?? [];
    return sourceFilter === 'all' ? items : items.filter((event) => event.source === sourceFilter);
  }, [overview, sourceFilter]);
  const stale = overview ? Date.now() - Date.parse(overview.generatedAt) > 30_000 : false;

  return <div className="app monitoring-page">
    <header className="dashboard-header">
      <div><p className="eyebrow">AVATAR WEB / ADMIN</p><h1>System monitoring</h1></div>
      <span className="hint">{lastLoadedAt ? `Cập nhật ${formatTime(lastLoadedAt)}` : 'Chưa có snapshot'}</span>
      <button className="ghost" type="button" onClick={() => void reload()} disabled={loading}>Làm mới</button>
    </header>
    {stale && <p className="status-banner status-banner--warn">Dữ liệu đang cũ — kiểm tra kết nối WebSocket hoặc backend.</p>}
    {error && <p className="status-banner status-banner--error">{error}</p>}
    {loading && !overview && <p className="hint">đang tải monitoring…</p>}
    {overview && <>
      <section className="monitoring-summary" aria-label="Tổng quan hệ thống">
        <div className="card monitoring-metric"><span>Backend</span><Status status={overview.backend.status} /><strong>{Math.round(overview.backend.uptimeMs / 60_000)} phút</strong></div>
        <div className="card monitoring-metric"><span>Tài khoản online</span><strong>{overview.counters.online}/{overview.counters.total}</strong><small>{overview.counters.connecting} đang kết nối</small></div>
        <div className="card monitoring-metric"><span>Tài khoản lỗi</span><strong className={overview.counters.errors ? 'monitoring-number--error' : ''}>{overview.counters.errors}</strong><small>runtime hiện tại</small></div>
        <div className="card monitoring-metric"><span>Lỗi gần đây</span><strong className={overview.errors.length ? 'monitoring-number--error' : ''}>{overview.errors.length}</strong><small>trong bộ nhớ phiên</small></div>
      </section>
      <section className="card monitoring-section"><h2>Dependencies</h2><div className="monitoring-dependencies">{overview.dependencies.map((dependency) => <div className="monitoring-dependency" key={dependency.name}><div><strong>{dependency.name}</strong><p className="hint">kiểm tra {formatTime(dependency.checkedAt)}</p></div><span>{dependency.latencyMs === null ? '—' : `${dependency.latencyMs} ms`}</span><Status status={dependency.status} />{dependency.errorCode && <small className="err">{dependency.errorCode}</small>}</div>)}</div></section>
      <section className="card monitoring-section"><div className="monitoring-section-head"><h2>Accounts</h2><span className="hint">read-only</span></div><div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>Tài khoản</th><th>Trạng thái</th><th>Game server</th><th>Sự kiện cuối</th><th>Lỗi cuối</th></tr></thead><tbody>{overview.accounts.length === 0 && <tr><td colSpan={5} className="hint">Chưa có tài khoản</td></tr>}{overview.accounts.map((account) => <tr key={account.id}><td><strong>{account.label}</strong><small>#{account.id}</small></td><td><Status status={account.runtimeStatus} /></td><td><code>{account.host}:{account.port}</code></td><td>{formatTime(account.lastEventAt)}</td><td>{account.lastError ? <span className="err">{account.lastError.message}</span> : '—'}</td></tr>)}</tbody></table></div></section>
      <section className="card monitoring-section"><div className="monitoring-section-head"><h2>Recent errors</h2><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Lọc nguồn lỗi"><option value="all">Tất cả nguồn</option><option value="game">game</option><option value="captcha">captcha</option><option value="inference">inference</option><option value="backend">backend</option></select></div><div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>Thời gian</th><th>Nguồn</th><th>Mức độ</th><th>Account</th><th>Chi tiết</th></tr></thead><tbody>{events.length === 0 && <tr><td colSpan={5} className="hint">Không có lỗi gần đây</td></tr>}{events.slice().reverse().map((event) => <tr key={event.id}><td>{formatTime(event.at)}</td><td>{event.source}</td><td><span className={event.severity === 'error' ? 'err' : 'monitoring-warning'}>{event.severity}</span></td><td>{event.accountId ? `#${event.accountId}` : '—'}</td><td><code>{event.message}</code></td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
