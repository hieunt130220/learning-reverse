import { useEffect, useRef } from 'react';

import type { LogLine } from '../../types.js';

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [logs.length]);

  return (
    <section className="card">
      <h2>Nhật ký</h2>
      <p className="hint">Giữ 500 dòng gần nhất trong RAM của server — restart server là mất.</p>
      <div className="log">
        {logs.length === 0 && <p className="hint">chưa có gì</p>}
        {logs.map((l, i) => (
          <div key={i}>
            <span className="ts">{new Date(l.t).toLocaleTimeString()}</span> {l.line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
