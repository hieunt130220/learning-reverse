import { useEffect, useState } from 'react';

import { onWsMessage } from '../../ws.js';

interface CaptchaFile {
  fileName: string;
  size: number;
  mtime: string | null;
}

interface CaptchaWsPayload {
  accountId: number;
  fileName: string;
  format: string | null;
  sha256: string | null;
  prompt?: string;
  receivedAt?: string;
}

export function CaptchaPanel({ accountId }: { accountId: number }) {
  const [files, setFiles] = useState<CaptchaFile[]>([]);
  const [lastCaptcha, setLastCaptcha] = useState<CaptchaWsPayload | null>(null);

  const fetchList = async () => {
    try {
      const res = await fetch('/api/captcha/list');
      if (!res.ok) return;
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {}
  };

  useEffect(() => {
    void fetchList();
    const id = setInterval(() => void fetchList(), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const remove = onWsMessage((msg) => {
      if (msg.type === 'captcha' && (msg as { accountId: number }).accountId === accountId) {
        const payload = msg.payload as CaptchaWsPayload;
        setLastCaptcha(payload);
        void fetchList();
      }
    });
    return remove;
  }, [accountId]);

  return (
    <section className="card">
      <h2>Captcha</h2>
      <p className="hint">
        Ảnh captcha tự động lưu khi server gửi <code>cmd -60</code> (cả headless và J2ME patched). Thư mục{' '}
        <code>server/captcha-dataset/</code>. Nhấn tải để lưu về máy.
      </p>
      {lastCaptcha && (
        <div className="flash">
          Mới: {lastCaptcha.fileName} ({lastCaptcha.format ?? 'bin'}) {lastCaptcha.prompt ? `· "${lastCaptcha.prompt}"` : ''}{' '}
          <a href={`/api/captcha/dataset/${lastCaptcha.fileName}`} download>
            Tải
          </a>
        </div>
      )}
      <div className="misc-captcha-row">
        <button className="ghost" onClick={() => void fetchList()}>
          Làm mới
        </button>
        <a href="/api/captcha/list" target="_blank" rel="noreferrer" className="ghost">
          Xem JSON
        </a>
      </div>
      {files.length === 0 ? (
        <p className="hint">chưa có file</p>
      ) : (
        <div className="log">
          {files.slice(0, 20).map((f) => (
            <div key={f.fileName} className="misc-captcha-file">
              <span title={f.mtime ?? ''}>
                {f.fileName} <span className="hint">({(f.size / 1024).toFixed(1)} KB)</span>
              </span>
              <span>
                {f.fileName.endsWith('.png') || f.fileName.endsWith('.jpg') ? (
                  <a href={`/api/captcha/dataset/${f.fileName}`} target="_blank" rel="noreferrer">
                    Xem
                  </a>
                ) : null}
                <a href={`/api/captcha/dataset/${f.fileName}`} download>
                  Tải
                </a>
              </span>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && files[0].fileName.endsWith('.png') && (
        <div>
          <p className="hint">Xem trước mới nhất:</p>
          <img
            src={`/api/captcha/dataset/${files[0].fileName}`}
            alt="captcha preview"
            className="misc-captcha-img"
          />
        </div>
      )}
    </section>
  );
}
