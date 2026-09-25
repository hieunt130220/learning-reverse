import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { apiGet, apiPost, apiPut } from '../api.js';
import type {
  AutomationSnapshot,
  MiningConfig,
  MiningTarget,
  StoredMiningConfigState,
} from '../types.js';
import { useDialogFocus } from './useDialogFocus.js';

export interface MiningTargetModalProps {
  open: boolean;
  accountId: number;
  onClose(): void;
  onSuccess(snapshot: AutomationSnapshot): void;
}

const TARGET_OPTIONS: Array<{
  value: MiningTarget;
  label: string;
  desc: string;
  icon: string;
}> = [
  {
    value: 'diamond',
    label: 'Khai thác Đá (Kim cương)',
    desc: 'Room 26 (Mỏ Đá Ngoại Ô) — 4 mỏ kim cương trữ lượng 3000/mỏ',
    icon: '💎',
  },
  {
    value: 'wood',
    label: 'Khai thác Gỗ (Củi khô)',
    desc: 'Room 22 (Rừng Cây Ngoại Ô) — Khai thác củi từ thân cây khô (Khu 1-9)',
    icon: '🪵',
  },
  {
    value: 'patrol',
    label: 'Tuần Tra Cả Hai (Đá & Gỗ)',
    desc: 'Đào hết kim cương ở Room 26 rồi chuyển sang chặt củi ở Room 22',
    icon: '🔄',
  },
];

export function MiningTargetModal({
  open,
  accountId,
  onClose,
  onSuccess,
}: MiningTargetModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<MiningTarget>('diamond');
  const [revision, setRevision] = useState(0);
  const [currentConfig, setCurrentConfig] = useState<MiningConfig | null>(null);

  useDialogFocus({ open, containerRef: dialogRef, initialFocusRef: firstOptionRef, onClose });

  useEffect(() => {
    if (!open || !accountId) return;
    let active = true;
    setLoading(true);
    setError('');

    apiGet<StoredMiningConfigState>(`/api/accounts/${accountId}/automation/mining/config`)
      .then((data) => {
        if (!active) return;
        setRevision(data.revision);
        setTarget(data.config.target);
        setCurrentConfig(data.config);
      })
      .catch((err) => {
        if (!active) return;
        // Nếu lỗi tải vẫn giữ mặc định diamond và revision 0
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, accountId]);

  if (!open) return null;

  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !busy) onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !accountId) return;
    setBusy(true);
    setError('');

    try {
      // 1. Cập nhật cấu hình mục tiêu khai thác
      const nextConfig: MiningConfig = {
        target,
        startArea: currentConfig?.startArea ?? 0,
        switchAreaWhenDepleted: currentConfig?.switchAreaWhenDepleted ?? true,
        maxAreasToScan: currentConfig?.maxAreasToScan ?? 10,
        delayBetweenActionsMs: currentConfig?.delayBetweenActionsMs ?? 3000,
      };

      const putRes = await apiPut<StoredMiningConfigState>(
        `/api/accounts/${accountId}/automation/mining/config`,
        {
          expectedRevision: revision,
          config: nextConfig,
        },
      );
      setRevision(putRes.revision);

      // 2. Kích hoạt auto_mining
      const startRes = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/start`,
        { mode: 'auto_mining' },
      );

      onSuccess(startRes);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop dialog-backdrop--modal" onMouseDown={onBackdrop}>
      <section
        ref={dialogRef}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mining-target-title"
        style={{ maxWidth: '480px', width: '100%' }}
      >
        <header className="dialog-heading">
          <h2 id="mining-target-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⛏️</span> Chọn Loại Khai Thác
          </h2>
          <button type="button" className="ghost" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <p className="hint" style={{ margin: 0 }}>
            Chọn tài nguyên bạn muốn tự động khai thác khi bắt đầu:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {TARGET_OPTIONS.map((opt, idx) => {
              const isSelected = target === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-deep, #111722)',
                    border: `1.5px solid ${isSelected ? 'var(--accent, #58a6ff)' : 'var(--line, #30363d)'}`,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <input
                    ref={idx === 0 ? firstOptionRef : undefined}
                    type="radio"
                    name="miningTarget"
                    value={opt.value}
                    checked={isSelected}
                    disabled={busy}
                    onChange={() => setTarget(opt.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isSelected ? 'var(--accent, #58a6ff)' : 'inherit' }}>
                      {opt.icon} {opt.label}
                    </div>
                    <small style={{ color: 'var(--muted, #8b949e)', display: 'block', marginTop: '2px', lineHeight: 1.35 }}>
                      {opt.desc}
                    </small>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="err" style={{ margin: 0 }}>{error}</p>}

          <footer className="dialog-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" disabled={busy || loading}>
              {busy ? 'Đang kích hoạt…' : 'Bắt đầu khai thác'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
