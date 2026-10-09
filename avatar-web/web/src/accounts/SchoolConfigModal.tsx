import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { apiGet, apiPost, apiPut } from '../api.js';
import type {
  AutomationSnapshot,
  SchoolConfig,
  SchoolSubject,
  StoredSchoolConfigState,
} from '../types.js';
import { useDialogFocus } from './useDialogFocus.js';

export interface SchoolConfigModalProps {
  open: boolean;
  accountId: number;
  onClose(): void;
  onSuccess(snapshot: AutomationSnapshot): void;
}

const SUBJECT_OPTIONS: Array<{
  value: SchoolSubject;
  label: string;
  desc: string;
  icon: string;
}> = [
  {
    value: 'en',
    label: 'Lớp Tiếng Anh (Cô Giáo Anh)',
    desc: 'Map 6 (Khu chẵn 0, 2, 4...) — Câu hỏi dịch từ vựng tiếng Anh',
    icon: '🇬🇧',
  },
  {
    value: 'vi',
    label: 'Lớp Tiếng Việt (Cô Giáo Việt)',
    desc: 'Map 6 (Khu lẻ 1, 3, 5...) — Câu hỏi điền ca dao, tục ngữ tiếng Việt',
    icon: '🇻🇳',
  },
];

export function SchoolConfigModal({
  open,
  accountId,
  onClose,
  onSuccess,
}: SchoolConfigModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState<SchoolSubject>('en');
  const [targetWins, setTargetWins] = useState<number>(0);
  const [returnToFarm, setReturnToFarm] = useState<boolean>(true);
  const [revision, setRevision] = useState(0);

  useDialogFocus({ open, containerRef: dialogRef, initialFocusRef: firstOptionRef, onClose });

  useEffect(() => {
    if (!open || !accountId) return;
    let active = true;
    setLoading(true);
    setError('');

    apiGet<StoredSchoolConfigState>(`/api/accounts/${accountId}/automation/school/config`)
      .then((data) => {
        if (!active) return;
        setRevision(data.revision);
        setSubject(data.config.subject);
        setTargetWins(data.config.targetWins ?? 0);
        setReturnToFarm(data.config.returnToFarm ?? true);
      })
      .catch((err) => {
        if (!active) return;
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
      const nextConfig: SchoolConfig = {
        subject,
        targetWins: Math.max(0, Math.floor(Number(targetWins) || 0)),
        returnToFarm,
      };

      const putRes = await apiPut<StoredSchoolConfigState>(
        `/api/accounts/${accountId}/automation/school/config`,
        {
          expectedRevision: revision,
          config: nextConfig,
        },
      );
      setRevision(putRes.revision);

      const startRes = await apiPost<AutomationSnapshot>(
        `/api/accounts/${accountId}/automation/start`,
        { mode: 'auto_school' },
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
        aria-labelledby="school-config-title"
        style={{ maxWidth: '480px', width: '100%', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}
      >
        <header className="dialog-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="school-config-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>🎓</span> Cấu Hình Trường Học (Map 6)
          </h2>
          <button type="button" className="ghost" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
          <div>
            <p className="hint" style={{ margin: '0 0 0.5rem 0' }}>
              Chọn lớp học cô giáo muốn tham gia:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {SUBJECT_OPTIONS.map((opt, idx) => {
                const isSelected = subject === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '0.75rem 1rem',
                      margin: 0,
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(88, 166, 255, 0.12)' : 'var(--bg-deep, #111722)',
                      border: `1.5px solid ${isSelected ? 'var(--accent, #58a6ff)' : 'var(--line, #30363d)'}`,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s',
                      boxSizing: 'border-box',
                    }}
                  >
                    <input
                      ref={idx === 0 ? firstOptionRef : undefined}
                      type="radio"
                      name="schoolSubject"
                      value={opt.value}
                      checked={isSelected}
                      disabled={busy}
                      onChange={() => setSubject(opt.value)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{opt.icon}</span> {opt.label}
                      </div>
                      <div className="hint" style={{ fontSize: '0.82rem', marginTop: '2px' }}>
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
              🎯 Số câu thắng mục tiêu:
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              value={targetWins}
              disabled={busy}
              onChange={(e) => setTargetWins(Number(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <p className="hint" style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
              Mặc định 0 = không giới hạn (cắm liên tục). Nhập 10 để nhận đủ 10 cuốc/ngày.
            </p>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: busy ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={returnToFarm}
                disabled={busy}
                onChange={(e) => setReturnToFarm(e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Tự động chuyển về Nông trại sau khi hoàn thành</span>
            </label>
            <p className="hint" style={{ margin: '4px 0 0 24px', fontSize: '0.82rem' }}>
              Khi đạt đủ số câu thắng mục tiêu, bot sẽ tự động quay về nông trại để tiếp tục chăm sóc cây và vật nuôi.
            </p>
          </div>

          {error && (
            <div style={{ color: 'var(--danger, #f85149)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" disabled={busy || loading}>
              {busy ? 'Đang kích hoạt…' : 'Bắt đầu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
