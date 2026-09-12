import { useMemo, useState } from 'react';

import type { LogLine } from '../../types.js';

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const [query, setQuery] = useState('');
  const filter = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!filter) return logs;
    return logs.filter((entry) => entry.line.toLowerCase().includes(filter));
  }, [filter, logs]);

  return (
    <section className="card">
      <h2>Nhật ký</h2>
      <p className="hint">Giữ 500 dòng gần nhất trong RAM của server — restart server thủ công mới xoá.</p>
      <div className="log-filter-bar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Lọc log…"
          aria-label="Lọc nhật ký"
        />
        <span className="hint">
          {filter
            ? `${filtered.length}/${logs.length} dòng khớp`
            : `${logs.length} dòng`}
        </span>
      </div>
      <div className="log">
        {filtered.length === 0 && (
          <p className="hint">
            {logs.length === 0 ? 'chưa có gì' : 'không có dòng nào khớp bộ lọc'}
          </p>
        )}
        {filtered.map((l, i) => (
          <div key={`${l.t}-${i}`}>
            <span className="ts">{new Date(l.t).toLocaleTimeString()}</span> {l.line}
          </div>
        ))}
      </div>
    </section>
  );
}
