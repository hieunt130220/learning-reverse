import { useEffect, useState, type FormEvent } from 'react';

import { apiGet, apiPost, apiPut } from '../../api.js';
import type {
  AccountWithRuntime,
  AutomationSnapshot,
  MiningConfig,
  MiningStatus,
  MiningTarget,
  StoredMiningConfigState,
} from '../../types.js';

interface MiningPanelProps {
  account?: AccountWithRuntime;
  automation?: AutomationSnapshot;
  onChanged?(): void;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
}

const TARGET_LABELS: Record<MiningTarget, { label: string; desc: string; icon: string }> = {
  diamond: {
    label: 'Kim Cương Trắng',
    desc: 'Room 26 (Mỏ Đá Ngoại Ô) — 4 mỏ kim cương trữ lượng 3000/mỏ',
    icon: '💎',
  },
  wood: {
    label: 'Củi Khô',
    desc: 'Room 22 (Rừng Cây Ngoại Ô) — Khai thác củi từ thân cây khô (Khu 1-9)',
    icon: '🪵',
  },
  patrol: {
    label: 'Tuần Tra Cả Hai',
    desc: 'Đào hết kim cương ở Room 26 rồi chuyển sang chặt củi ở Room 22',
    icon: '🔄',
  },
};

function formatMiningStatus(
  isMining: boolean,
  status?: MiningStatus,
  isOnline?: boolean,
): { text: string; color: string } {
  if (!isOnline) return { text: 'Tài khoản offline', color: 'var(--muted)' };
  if (!isMining) return { text: 'Đã dừng', color: 'var(--muted)' };

  switch (status) {
    case 'mining':
      return { text: '⛏️ Đang khai thác', color: 'var(--ok, #4ade80)' };
    case 'navigating':
      return { text: '🚶 Đang vào bản đồ', color: '#38bdf8' };
    case 'scanning_nodes':
      return { text: '🔍 Đang tìm mỏ tài nguyên', color: '#38bdf8' };
    case 'switching_area':
      return { text: '🔄 Đang chuyển khu', color: '#facc15' };
    case 'paused_no_tool':
      return { text: '⚠️ Thiếu hoặc hỏng cuốc/rìu', color: '#ef4444' };
    case 'paused_low_energy':
      return { text: '⚡ Hết năng lượng/sức khỏe', color: '#f97316' };
    case 'stopped':
      return { text: 'Đã dừng', color: 'var(--muted)' };
    default:
      return { text: 'Đang kết nối...', color: '#38bdf8' };
  }
}

export function MiningPanel({
  account,
  automation,
  onChanged,
  onAutomationChange,
}: MiningPanelProps) {
  const accountId = account?.id;
  const isMiningDesired = automation?.desiredMode === 'auto_mining';
  const isMiningActive = automation?.activeMode === 'auto_mining';
  const isMining = isMiningDesired || isMiningActive;
  const isSwitching = automation?.transitionState === 'switching';
  const isOnline = account?.runtime?.status === 'online';

  const runtime = automation?.miningRuntime;

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<MiningTarget>('diamond');
  const [startArea, setStartArea] = useState(0);
  const [switchAreaWhenDepleted, setSwitchAreaWhenDepleted] = useState(true);
  const [delayMs, setDelayMs] = useState(3000);

  // Load configuration from server
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setLoadingConfig(true);
    apiGet<StoredMiningConfigState>(`/api/accounts/${accountId}/automation/mining/config`)
      .then((data) => {
        if (!active) return;
        setRevision(data.revision);
        setTarget(data.config.target);
        setStartArea(data.config.startArea);
        setSwitchAreaWhenDepleted(data.config.switchAreaWhenDepleted);
        setDelayMs(data.config.delayBetweenActionsMs);
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
      if (isMining) {
        const res = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/stop`, {});
        if (res) onAutomationChange?.(res);
      } else {
        const res = await apiPost<AutomationSnapshot>(`/api/accounts/${accountId}/automation/start`, {
          mode: 'auto_mining',
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

    const config: MiningConfig = {
      target,
      startArea,
      switchAreaWhenDepleted,
      maxAreasToScan: 10,
      delayBetweenActionsMs: delayMs,
    };

    try {
      const res = await apiPut<StoredMiningConfigState>(
        `/api/accounts/${accountId}/automation/mining/config`,
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

  const statusInfo = formatMiningStatus(isMining, runtime?.status, isOnline);

  // Tính phần trăm trữ lượng
  const remaining = runtime?.remainingCapacity ?? null;
  const maxCap = runtime?.maxCapacity ?? null;
  const capacityPercent =
    remaining !== null && maxCap !== null && maxCap > 0
      ? Math.max(0, Math.min(100, Math.round((remaining / maxCap) * 100)))
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {/* ─── Header & Power Toggle ─── */}
      <section className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⛏️</span> Tự Động Khai Thác Gỗ & Đá
            </h3>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Trạng thái: <strong style={{ color: statusInfo.color }}>{statusInfo.text}</strong>
              {isSwitching && ' · Đang chuyển chế độ…'}
            </p>
          </div>

          <button
            type="button"
            className={isMining ? 'danger' : 'primary'}
            onClick={handleToggleAuto}
            disabled={switchingMode || !accountId || !isOnline}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 600 }}
          >
            {switchingMode ? '⏳ Đang xử lý...' : isMining ? '⏹️ Tắt Khai Thác' : '▶️ Bật Khai Thác'}
          </button>
        </div>

        {error && <p className="err" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </section>

      {/* ─── Live Status Card ─── */}
      <section className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📊</span> Tiến Độ Khai Thác Thời Gian Thực
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)' }}>
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Bản Đồ Hiện Tại</small>
            <b style={{ fontSize: '1rem' }}>
              {runtime?.currentMap === 26
                ? 'Mỏ Đá (Room 26)'
                : runtime?.currentMap === 22
                ? 'Rừng Gỗ (Room 22)'
                : 'Chưa vào map'}
            </b>
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
            <small style={{ color: 'var(--muted, #8b949e)', display: 'block' }}>Thu Hoạch Phiên Này</small>
            <b style={{ fontSize: '1rem', color: 'var(--accent, #58a6ff)' }}>
              {runtime?.sessionHarvestCount ?? 0} lượt
            </b>
          </div>
        </div>

        {/* Trữ lượng mỏ hiện tại */}
        {runtime?.currentNodeName && (
          <div style={{ background: 'var(--bg-deep, #111722)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--line, #30363d)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>{runtime.currentNodeName}</strong> ({runtime.resourceName || 'Tài nguyên'})
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {remaining !== null ? `${remaining} / ${maxCap}` : '—'}
                {capacityPercent !== null && ` (${capacityPercent}%)`}
              </span>
            </div>

            {capacityPercent !== null && (
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${capacityPercent}%`,
                    height: '100%',
                    background: capacityPercent > 20 ? '#4ade80' : '#f87171',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {runtime?.lastMessage && (
          <div style={{ fontSize: '0.85rem', color: 'var(--muted, #8b949e)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
            💬 Thông điệp server: <em>{runtime.lastMessage}</em>
          </div>
        )}
      </section>

      {/* ─── Configuration Form ─── */}
      <section className="card" style={{ padding: '1rem' }}>
        <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⚙️</span> Cài Đặt Mục Tiêu Khai Thác
        </h4>

        {loadingConfig ? (
          <p className="hint">Đang tải cấu hình...</p>
        ) : (
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Lựa chọn mục tiêu */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Mục Tiêu Khai Thác
              </label>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {(Object.keys(TARGET_LABELS) as MiningTarget[]).map((t) => (
                  <label
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      background: target === t ? 'rgba(88, 166, 255, 0.1)' : 'var(--bg-deep, #111722)',
                      border: `1px solid ${target === t ? 'var(--accent, #58a6ff)' : 'var(--line, #30363d)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="miningTarget"
                      value={t}
                      checked={target === t}
                      onChange={() => setTarget(t)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {TARGET_LABELS[t].icon} {TARGET_LABELS[t].label}
                      </div>
                      <small style={{ color: 'var(--muted, #8b949e)', fontSize: '0.8rem' }}>
                        {TARGET_LABELS[t].desc}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Khu vực bắt đầu */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Khu Vực Bắt Đầu
                </label>
                <select
                  value={startArea}
                  onChange={(e) => setStartArea(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-deep, #111722)', border: '1px solid var(--line, #30363d)', color: 'inherit' }}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={i}>
                      Khu {i} {target === 'wood' && i === 0 ? '(Sảnh nghỉ)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Khoảng Cách Lượt Đào (ms)
                </label>
                <input
                  type="number"
                  min={2000}
                  max={8000}
                  step={500}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-deep, #111722)', border: '1px solid var(--line, #30363d)', color: 'inherit' }}
                />
              </div>
            </div>

            {/* Checkbox tự động chuyển khu */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={switchAreaWhenDepleted}
                  onChange={(e) => setSwitchAreaWhenDepleted(e.target.checked)}
                />
                <span>Tự động chuyển khu khi mỏ hiện tại cạn sản lượng</span>
              </label>
            </div>

            {/* Nút lưu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="submit"
                className="primary"
                disabled={savingConfig || !accountId}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu Cài Đặt'}
              </button>
              {saveSuccess && (
                <span style={{ color: 'var(--ok, #4ade80)', fontSize: '0.85rem' }}>
                  ✓ Đã lưu cài đặt thành công!
                </span>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
