import { useCallback, useEffect, useState } from 'react';

import { apiGet, apiPost } from '../../api.js';

interface CaptureSnapshot {
  enabled: boolean;
  state?: 'capturing' | 'sealing' | 'ready' | 'blocked';
  sessionId?: string;
  targetBatchCount: number;
  savedBatchCount: number;
  failedBatchCount: number;
  reportReady: boolean;
  lastError?: string;
}

interface LiveReviewCaptureCardProps { accountId: number; isOnline: boolean }

export function LiveReviewCaptureCard({ accountId, isOnline }: LiveReviewCaptureCardProps) {
  const root = `/api/accounts/${accountId}/fishing-live-review`;
  const [snapshot, setSnapshot] = useState<CaptureSnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (isCurrent: () => boolean = () => true) => {
    try { const next = await apiGet<CaptureSnapshot>(root); if (isCurrent()) { setSnapshot(next); setError(''); } }
    catch (reason) { if (isCurrent()) setError((reason as Error).message); }
  }, [root]);

  useEffect(() => {
    let current = true;
    const isCurrent = () => current;
    void refresh(isCurrent);
    const timer = setInterval(() => void refresh(isCurrent), snapshot?.state === 'capturing' || snapshot?.state === 'sealing' ? 2000 : 5000);
    return () => { current = false; clearInterval(timer); };
  }, [refresh, snapshot?.state]);

  if (!snapshot?.enabled) return null;
  const running = snapshot.state === 'capturing' || snapshot.state === 'sealing';
  const progress = Math.min(100, Math.round(snapshot.savedBatchCount * 100 / snapshot.targetBatchCount));
  const act = async (action: 'start' | 'stop') => {
    setBusy(true); setError('');
    try { setSnapshot(await apiPost<CaptureSnapshot>(`${root}/${action}`)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  return <section aria-labelledby="live-review-title" style={{ padding: '0.85rem 1rem', background: '#12161d', border: '1px solid var(--line)', borderRadius: '8px', display: 'grid', gap: '0.65rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div><h4 id="live-review-title" style={{ margin: 0 }}>Dữ liệu review model</h4><p className="hint" style={{ margin: '0.2rem 0 0' }}>Thu inference thật khi Auto câu cá chạy; tự dừng ở 100 batch.</p></div>
      <span className={`badge ${snapshot.state === 'ready' ? 'badge-success' : 'badge-pending'}`}>{snapshot.state ?? 'Chưa bắt đầu'}</span>
    </div>
    <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>{snapshot.savedBatchCount}/{snapshot.targetBatchCount} batch</span><span>{progress}%</span></div><progress max={snapshot.targetBatchCount} value={snapshot.savedBatchCount} style={{ width: '100%' }} /></div>
    {snapshot.failedBatchCount > 0 && <p className="hint" style={{ margin: 0 }}>Có {snapshot.failedBatchCount} batch ghi lỗi.</p>}
    {(error || snapshot.lastError) && <p className="err" style={{ margin: 0 }}>{error || snapshot.lastError}</p>}
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {!running && <button type="button" onClick={() => void act('start')} disabled={busy || !isOnline}>{busy ? 'Đang bắt đầu…' : snapshot.state ? 'Bắt đầu phiên mới' : 'Bắt đầu thu thập 100 batch'}</button>}
      {running && <button type="button" onClick={() => void act('stop')} disabled={busy || snapshot.state === 'sealing'}>{snapshot.state === 'sealing' ? 'Đang tạo report…' : busy ? 'Đang dừng…' : 'Dừng và tạo report'}</button>}
      {snapshot.reportReady && snapshot.sessionId && <button type="button" className="ghost" onClick={() => window.open(`${root}/${encodeURIComponent(snapshot.sessionId!)}/report`, '_blank', 'noopener,noreferrer')}>Mở trang review</button>}
      <button type="button" className="ghost" onClick={() => void refresh()} disabled={busy}>Làm mới</button>
    </div>
  </section>;
}
