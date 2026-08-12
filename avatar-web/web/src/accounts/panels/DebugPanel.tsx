import { useEffect, useMemo, useRef, useState } from 'react';

import { apiPost } from '../../api.js';
import { ACTIONS, GROUPS, type ActionDef } from '../../actions.js';
import type { MacroState, TrafficEntry } from '../../types.js';

const FIELD_TYPES = ['i8', 'i16', 'i32', 'i64', 'bool', 'utf', 'hex'];

export function DebugPanel({
  accountId,
  macro,
  traffic,
}: {
  accountId: number;
  macro: MacroState;
  traffic: TrafficEntry[];
}) {
  return (
    <div className="cols">
      <div className="col">
        <ActionPanel accountId={accountId} />
        <MacroPanel accountId={accountId} macro={macro} />
      </div>
      <div className="col">
        <RawPanel accountId={accountId} />
        <TrafficPanel traffic={traffic} />
      </div>
    </div>
  );
}

function ActionPanel({ accountId }: { accountId: number }) {
  const [group, setGroup] = useState(GROUPS[0]);
  const list = useMemo(() => ACTIONS.filter((a) => a.group === group), [group]);

  return (
    <section className="card">
      <h2>Hành động</h2>
      <p className="hint">
        Gọi thẳng method của <code>FarmService</code> trên phiên của tài khoản này. Dùng để dò tiếp
        opcode; delay quá thấp dễ bị server từ chối.
      </p>
      <div className="tabs">
        {GROUPS.map((g) => (
          <button key={g} className={g === group ? 'tab active' : 'tab'} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      {list.map((a) => (
        <ActionRow key={a.action} def={a} accountId={accountId} />
      ))}
    </section>
  );
}

function ActionRow({ def, accountId }: { def: ActionDef; accountId: number }) {
  const [args, setArgs] = useState<number[]>(def.args.map((a) => a.default));
  const [flash, setFlash] = useState('');

  async function run() {
    try {
      await apiPost(`/api/accounts/${accountId}/farm`, { name: def.action, args });
      setFlash('đã gửi');
    } catch (e) {
      setFlash((e as Error).message);
    }
    setTimeout(() => setFlash(''), 1500);
  }

  return (
    <div className="action">
      <div className="action-head">
        <button onClick={() => void run()}>{def.label}</button>
        {def.args.map((a, i) => (
          <label key={a.name} className="inline">
            {a.label}
            <input
              type="number"
              value={args[i]}
              onChange={(e) => {
                const next = [...args];
                next[i] = Number(e.target.value);
                setArgs(next);
              }}
            />
          </label>
        ))}
        {flash && <span className="flash">{flash}</span>}
      </div>
      {def.hint && <p className="hint">{def.hint}</p>}
    </div>
  );
}

function MacroPanel({ accountId, macro }: { accountId: number; macro: MacroState }) {
  const [json, setJson] = useState(
    JSON.stringify(
      {
        name: 'thu hoạch + trồng lại',
        intervalMs: 60000,
        steps: [
          { action: 'joinFarm', args: [0], delayMs: 800 },
          { action: 'harvest', args: [0, 0], delayMs: 500 },
          { action: 'plantSeed', args: [0, 0, 1], delayMs: 500 },
        ],
      },
      null,
      2,
    ),
  );
  const [err, setErr] = useState('');

  async function start() {
    setErr('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return setErr(`JSON hỏng: ${(e as Error).message}`);
    }
    try {
      await apiPost(`/api/accounts/${accountId}/macro/start`, parsed);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function stop() {
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/macro/stop`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Macro</h2>
      <p className="hint">
        Chuỗi action lặp theo chu kỳ. `action` là tên method trong FarmService, `args` khớp thứ tự tham số.
      </p>
      <textarea rows={12} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      <div className="row">
        <button onClick={() => void start()} disabled={macro.running}>
          Chạy
        </button>
        <button className="ghost" onClick={() => void stop()} disabled={!macro.running}>
          Dừng
        </button>
        <span className="hint">
          {macro.running ? `đang chạy "${macro.name}" — vòng ${macro.cycle}` : 'đang dừng'}
        </span>
      </div>
      {(err || macro.lastError) && <p className="err">{err || macro.lastError}</p>}
    </section>
  );
}

function RawPanel({ accountId }: { accountId: number }) {
  const [cmd, setCmd] = useState(76);
  const [fields, setFields] = useState<{ t: string; v: string }[]>([]);
  const [flash, setFlash] = useState('');

  async function send() {
    try {
      await apiPost(`/api/accounts/${accountId}/raw`, { cmd, fields });
      setFlash('đã gửi');
    } catch (e) {
      setFlash((e as Error).message);
    }
    setTimeout(() => setFlash(''), 1500);
  }

  return (
    <section className="card">
      <h2>Gói tự do</h2>
      <p className="hint">Dò các opcode chưa chốt: chọn cmd + tự ghép field theo đúng thứ tự trên wire.</p>
      <label className="inline">
        cmd
        <input type="number" value={cmd} onChange={(e) => setCmd(Number(e.target.value))} />
      </label>
      {fields.map((f, i) => (
        <div key={i} className="row">
          <select
            value={f.t}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...f, t: e.target.value };
              setFields(next);
            }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            value={f.v}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...f, v: e.target.value };
              setFields(next);
            }}
          />
          <button className="ghost" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <button className="ghost" onClick={() => setFields([...fields, { t: 'i32', v: '0' }])}>
          + field
        </button>
        <button onClick={() => void send()}>Gửi</button>
        {flash && <span className="flash">{flash}</span>}
      </div>
    </section>
  );
}

function TrafficPanel({ traffic }: { traffic: TrafficEntry[] }) {
  const [filter, setFilter] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [traffic.length]);

  const rows = filter
    ? traffic.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()) || String(e.cmd) === filter)
    : traffic;

  return (
    <section className="card">
      <h2>Gói tin</h2>
      <input placeholder="lọc theo tên opcode hoặc cmd" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="log traffic">
        {rows.map((e, i) => (
          <div key={i} className={e.dir}>
            <span className="ts">{new Date(e.t).toLocaleTimeString()}</span>{' '}
            <span className="dir">{e.dir.toUpperCase()}</span> cmd={e.cmd}{' '}
            <span className="opname">{e.name}</span> len={e.len}
            {e.hex && <div className="hex">{e.hex}</div>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
