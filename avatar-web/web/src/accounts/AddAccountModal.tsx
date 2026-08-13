import { useRef, useState, type FormEvent, type MouseEvent } from 'react';

import { apiPost } from '../api.js';
import { useDialogFocus } from './useDialogFocus.js';

export interface AddAccountModalProps {
  open: boolean;
  onClose(): void;
  reload(): Promise<void>;
}

export function AddAccountModal({ open, onClose, reload }: AddAccountModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [gameUser, setGameUser] = useState('');
  const [gamePass, setGamePass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useDialogFocus({ open, containerRef: dialogRef, initialFocusRef: labelRef, onClose });

  if (!open) return null;

  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/accounts', { label, gameUser, gamePass });
      setLabel('');
      setGameUser('');
      setGamePass('');
      onClose();
      // Tài khoản đã tạo xong; reload hỏng chỉ làm dashboard cũ một nhịp, không
      // được giữ modal lại vì bấm Thêm lần nữa sẽ tạo trùng.
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop dialog-backdrop--modal" onMouseDown={onBackdrop}>
      <section ref={dialogRef} className="account-modal" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
        <header className="dialog-heading">
          <h2 id="add-account-title">Thêm tài khoản</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        <form onSubmit={submit}>
          <label>
            Nhãn
            <input ref={labelRef} value={label} onChange={(event) => setLabel(event.target.value)} required />
          </label>
          <label>
            Tài khoản game
            <input value={gameUser} onChange={(event) => setGameUser(event.target.value)} autoComplete="off" required />
          </label>
          <label>
            Mật khẩu game
            <input type="password" value={gamePass} onChange={(event) => setGamePass(event.target.value)} autoComplete="new-password" required />
          </label>
          <p className="hint">Mật khẩu game được mã hoá trước khi lưu và không bao giờ hiện lại.</p>
          {error && <p className="err">{error}</p>}
          <footer className="dialog-actions">
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>Hủy</button>
            <button type="submit" disabled={busy}>{busy ? 'đang thêm…' : 'Thêm'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
