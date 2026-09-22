import { useEffect, useState, type FormEvent } from 'react';

import { apiGet, apiPost, apiPut } from '../../api.js';
import type {
  AccountWithRuntime,
  AutomationSnapshot,
  MazeConfig,
  MazeStatus,
  StoredMazeConfigState,
} from '../../types.js';

interface MazePanelProps {
  account?: AccountWithRuntime;
  automation?: AutomationSnapshot;
  onChanged?(): void;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
}

function formatMazeStatus(
  isMaze: boolean,
  status?: MazeStatus,
  isOnline?: boolean,
): { text: string; color: string } {
  if (!isOnline) return { text: 'Tài khoản offline', color: 'var(--muted)' };
  if (!isMaze) return { text: 'Đã dừng', color: 'var(--muted)' };

  switch (status) {
    case 'entering':
      return { text: '🚶 Đang vào Mê cung (Map 28)', color: '#38bdf8' };
    case 'navigating':
      return { text: '🧭 Đang tìm đường tới rương', color: '#38bdf8' };
    case 'opening':
      return { text: '🎁 Đang mở rương kho báu', color: 'var(--ok, #4ade80)' };
    case 'switching_area':
      return { text: '🔄 Đang chuyển khu vực', color: '#facc15' };
    case 'waiting_respawn':
      return { text: '⏳ Đang chờ đợt rương mới', color: '#a855f7' };
    case 'daily_limit_reached':
      return { text: '⚠️ Đã đạt giới hạn 30 rương/ngày', color: '#f97316' };
    case 'stopped':
      return { text: 'Đã dừng', color: 'var(--muted)' };
    default:
      return { text: 'Đang kết nối...', color: '#38bdf8' };
  }
}

export function MazePanel({
  account,
  automation,
  onChanged,
  onAutomationChange,
}: MazePanelProps) {
  const accountId = account?.id;
  const isMazeDesired = automation?.desiredMode === 'auto_maze';
  const isMazeActive = automation?.activeMode === 'auto_maze';
  const isMaze = isMazeDesired || isMazeActive;
  const isSwitching = automation?.transitionState === 'switching';
  const isOnline = account?.runtime?.status === 'online';

  const runtime = automation?.mazeRuntime;

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [revision, setRevision] = useState(0);
  const [startArea, setStartArea] = useState(0);
  const [autoSwitchArea, setAutoSwitchArea] = useState(true);
  const [maxAreasToScan, setMaxAreasToScan] = useState(20);
  const [watchRespawn, setWatchRespawn] = useState(true);
  const [maxChestsPerSession, setMaxChestsPerSession] = useState(30);

  // Load configuration from server
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setLoadingConfig(true);
    apiGet<StoredMazeConfigState>(`/api/accounts/${accountId}/automation/maze/config`)
      .then((data) => {
        if (!active) return;
        setRevision(data.revision);
        setStartArea(data.config.startArea);
        setAutoSwitchArea(data.config.autoSwitchArea);
        setMaxAreasToScan(data.config.maxAreasToScan);
        setWatchRespawn(data.config.watchRespawn);
        setMaxChestsPerSession(data.config.maxChestsPerSession);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoadingConfig(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  const handleToggleAuto = async () => {
    if (!accountId || switchingMode) return;
    setSwitchingMode(true);
    setError('');
    try {
      if (isMaze) {
        const res = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/stop`, {});
        if (res) onAutomationChange?.(res);
      } else {
        const res = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/start`, {
          mode: 'auto_maze',
        });
        if (res) onAutomationChange?.(res);
      }
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!accountId || savingConfig) return;
    setSavingConfig(true);
    setError('');
    setSaveSuccess(false);

    const config: MazeConfig = {
      startArea: Number(startArea),
      autoSwitchArea: Boolean(autoSwitchArea),
      maxAreasToScan: Number(maxAreasToScan),
      watchRespawn: Boolean(watchRespawn),
      maxChestsPerSession: Number(maxChestsPerSession),
    };

    try {
      const res = await apiPut<StoredMazeConfigState>(
        `/api/accounts/${accountId}/automation/maze/config`,
        {
          expectedRevision: revision,
          config,
        },
      );
      setRevision(res.revision);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  };

  const statusInfo = formatMazeStatus(isMaze, runtime?.status, isOnline);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {/* ─── Header & Power Toggle ─── */}
      <section className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗝️</span> Tự Động Mê Cung (Map 28)
            </h3>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Trạng thái: <strong style={{ color: statusInfo.color }}>{statusInfo.text}</strong>
              {isSwitching && ' · Đang chuyển chế độ…'}
            </p>
          </div>

          <button
            type="button"
            className={isMaze ? 'danger' : 'primary'}
            onClick={handleToggleAuto}
            disabled={switchingMode || !accountId || !isOnline}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {switchingMode ? '⏳ Đang xử lý...' : isMaze ? '⏹️ Tắt Mê Cung' : '▶️ Bật Mê Cung'}
          </button>
        </div>

        {error && <p className="err" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </section>

      {/* ─── Daily Limit Warning ─── */}
      {runtime?.dailyLimitReached && (
        <div
          style={{
            background: 'rgba(249, 115, 22, 0.15)',
            border: '1px solid #f97316',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            color: '#fdba74',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span>
            <strong>Đã đạt giới hạn ngày:</strong> Tài khoản đã nhận đủ 30 hộp quà trong ngày hôm nay. Bot đã tự động dừng an toàn!
          </span>
        </div>
      )}

      {/* ─── Live Status Card ─── */}
      <section className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📊</span> Tiến Độ Mở Rương Thời Gian Thực
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)' }}>
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Bản Đồ</small>
            <b style={{ fontSize: '1rem' }}>Mê Cung (Map 28)</b>
          </div>

          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)' }}>
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Khu Vực (Area)</small>
            <b style={{ fontSize: '1rem' }}>
              {runtime?.currentArea !== null && runtime?.currentArea !== undefined
                ? `Khu ${runtime.currentArea}`
                : '—'}
            </b>
          </div>

          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)' }}>
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Rương Mở Phiên Này</small>
            <b style={{ fontSize: '1rem', color: 'var(--accent, #58a6ff)' }}>
              {runtime?.sessionChestsOpened ?? 0} / {maxChestsPerSession}
            </b>
          </div>

          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)' }}>
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Rương Đang Đến</small>
            <b style={{ fontSize: '0.9rem', color: 'var(--ok, #4ade80)' }}>
              {runtime?.targetChestId
                ? `ID ${runtime.targetChestId} (${runtime.targetChestPos?.x}, ${runtime.targetChestPos?.y})`
                : 'Chưa chọn'}
            </b>
          </div>
        </div>

        {runtime?.lastMessage && (
          <p className="hint" style={{ margin: 0, fontSize: '0.85rem' }}>
            💬 Thông báo server: <em>"{runtime.lastMessage}"</em>
          </p>
        )}
      </section>

      {/* ─── Settings Form ─── */}
      <section className="card" style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⚙️</span> Cài Đặt Tự Động Mê Cung
        </h4>

        {loadingConfig ? (
          <p className="hint">Đang tải cài đặt...</p>
        ) : (
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor="maze-start-area" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Khu vực xuất phát (0..50)
                </label>
                <input
                  id="maze-start-area"
                  type="number"
                  min="0"
                  max="50"
                  value={startArea}
                  onChange={(e) => setStartArea(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label htmlFor="maze-max-areas" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Số khu tối đa quét (1..50)
                </label>
                <input
                  id="maze-max-areas"
                  type="number"
                  min="1"
                  max="50"
                  value={maxAreasToScan}
                  onChange={(e) => setMaxAreasToScan(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label htmlFor="maze-max-chests" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Giới hạn rương mở mỗi phiên (1..30)
                </label>
                <input
                  id="maze-max-chests"
                  type="number"
                  min="1"
                  max="30"
                  value={maxChestsPerSession}
                  onChange={(e) => setMaxChestsPerSession(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={autoSwitchArea}
                  onChange={(e) => setAutoSwitchArea(e.target.checked)}
                />
                <span>Tự động chuyển khu kế tiếp khi khu hiện tại hết rương trống</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={watchRespawn}
                  onChange={(e) => setWatchRespawn(e.target.checked)}
                />
                <span>Treo máy chờ đợt rương mới hồi sinh nếu đã quét hết các khu</span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" className="primary" disabled={savingConfig}>
                {savingConfig ? 'Đang lưu...' : '💾 Lưu Cài Đặt Mê Cung'}
              </button>
              {saveSuccess && <span style={{ color: 'var(--ok, #4ade80)', fontSize: '0.85rem' }}>✅ Đã lưu thành công!</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
