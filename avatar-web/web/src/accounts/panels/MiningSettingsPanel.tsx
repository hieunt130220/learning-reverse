import { useEffect, useState, type FormEvent } from 'react';

import { apiGet, apiPut } from '../../api.js';
import type {
  AutomationSnapshot,
  MiningConfig,
  MiningTarget,
  StoredMiningConfigState,
} from '../../types.js';

export interface MiningSettingsPanelProps {
  accountId: number;
  automation?: AutomationSnapshot;
  onChanged?(): void;
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

export function MiningSettingsPanel({
  accountId,
  onChanged,
}: MiningSettingsPanelProps) {
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<MiningTarget>('diamond');
  const [startArea, setStartArea] = useState(0);
  const [switchAreaWhenDepleted, setSwitchAreaWhenDepleted] = useState(true);
  const [delayMs, setDelayMs] = useState(3000);

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

  return (
    <section className="card" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⛏️</span> Cấu Hình Tự Động Khai Thác Gỗ & Đá
      </h3>
      <p className="hint" style={{ margin: '0 0 1rem', fontSize: '0.85rem' }}>
        Tùy chỉnh bản đồ mục tiêu, khu vực bắt đầu và thời gian giãn cách giữa các lượt đào.
      </p>

      {error && <p className="err" style={{ marginBottom: '1rem' }}>{error}</p>}

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
                    name="settingsMiningTarget"
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
              {savingConfig ? 'Đang lưu...' : 'Lưu Cài Đặt Khai Thác'}
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
  );
}
