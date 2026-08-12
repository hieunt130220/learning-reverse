import { useEffect, useMemo, useRef, useState } from 'react';

import { ACTIONS, GROUPS, type ActionDef } from './actions.js';

interface TrafficEntry {
  t: number;
  dir: 'tx' | 'rx';
  cmd: number;
  name: string;
  len: number;
  hex: string;
}

interface FarmCell {
  index: number;
  idTree: number;
  time: number;
  vitalityPer: number;
  hervestPer: number;
  isArid: boolean;
  isWorm: boolean;
  isGrass: boolean;
  level?: number;
}

interface FarmAnimal {
  index: number;
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  hunger: boolean;
}

interface AnimalInfo {
  id: number;
  name: string;
  desc: string;
}

interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  updatedAt: number;
}

interface TreeInfo {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

interface ItemInfo {
  id: number;
  name: string;
  price: number;
}

interface AutoState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  lastActions: string[];
}

interface InventoryItem {
  id: number;
  num: number;
}

interface MacroState {
  running: boolean;
  name?: string;
  cycle: number;
  lastRun?: number;
  lastError?: string;
}

// 27.0.14.67 nhận kết nối và trả getServerLoginInfo nhưng KHÔNG xử lý LOGIN_ACC
// (nhiều khả năng là server data). Chỉ .120 đăng nhập được.
const SERVERS = [
  { label: '27.0.14.120 (đăng nhập được)', host: '27.0.14.120', port: 19129 },
  { label: '27.0.14.67 (không xử lý login)', host: '27.0.14.67', port: 19129 },
];

async function post(url: string, body: unknown): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function App() {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<{ t: number; line: string }[]>([]);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [macro, setMacro] = useState<MacroState>({ running: false, cycle: 0 });
  const [farm, setFarm] = useState<FarmState | null>(null);
  const [auto, setAuto] = useState<AutoState>({ running: false, cycle: 0, lastActions: [] });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trees, setTrees] = useState<TreeInfo[]>([]);
  const [items, setItems] = useState<ItemInfo[]>([]);
  const [animals, setAnimals] = useState<AnimalInfo[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onmessage = (ev) => {
      const { type, payload } = JSON.parse(ev.data);
      if (type === 'snapshot') {
        setStatus(payload.status);
        setTraffic(payload.traffic ?? []);
        setMacro(payload.macro);
        setFarm(payload.farm ?? null);
        setAuto(payload.auto ?? { running: false, cycle: 0, lastActions: [] });
        setInventory(payload.inventory ?? []);
        setTrees(payload.trees ?? []);
        setItems(payload.items ?? []);
        setAnimals(payload.animals ?? []);
      } else if (type === 'farm') setFarm(payload);
      else if (type === 'auto') setAuto(payload);
      else if (type === 'inventory') setInventory(payload);
      else if (type === 'trees') {
        setTrees(payload.trees ?? []);
        setItems(payload.items ?? []);
        setAnimals(payload.animals ?? []);
      }
      else if (type === 'status') setStatus(payload);
      else if (type === 'log') setLogs((l) => [...l.slice(-200), payload]);
      else if (type === 'traffic') setTraffic((t) => [...t.slice(-300), payload]);
      else if (type === 'macro') setMacro(payload);
    };
    return () => ws.close();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Avatar Farm</h1>
        <StatusBadge status={status} />
      </header>

      <div className="cols">
        <div className="col">
          <ConnectPanel status={status} />
          <FarmPanel farm={farm} inventory={inventory} trees={trees} />
          <AnimalPanel farm={farm} catalog={animals} />
          <AutoPanel auto={auto} items={items} />
          <ActionPanel />
          <MacroPanel macro={macro} />
        </div>
        <div className="col">
          <RawPanel />
          <LogPanel logs={logs} />
          <TrafficPanel traffic={traffic} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    idle: 'chưa kết nối',
    connecting: 'đang kết nối',
    handshaking: 'đang bắt tay',
    'logging-in': 'đang đăng nhập',
    online: 'đang online',
    error: 'lỗi',
  };
  return <span className={`badge badge-${status}`}>{label[status] ?? status}</span>;
}

function ConnectPanel({ status }: { status: string }) {
  const [serverIdx, setServerIdx] = useState(0);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [agent, setAgent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const connected = status === 'online' || status === 'logging-in';

  async function connect() {
    setBusy(true);
    setErr('');
    const s = SERVERS[serverIdx];
    const r = await post('/api/login', {
      host: s.host,
      port: s.port,
      user,
      pass,
      device: agent ? { agent } : undefined,
    });
    if (r.error) setErr(r.error);
    setBusy(false);
  }

  return (
    <section className="card">
      <h2>Kết nối</h2>
      <label>
        Server
        <select value={serverIdx} onChange={(e) => setServerIdx(Number(e.target.value))}>
          {SERVERS.map((s, i) => (
            <option key={s.host} value={i}>
              {s.label}:{s.port}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tài khoản
        <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Mật khẩu
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label>
        AGENT <span className="hint">(gói SET_AGENT, chưa chốt được giá trị — để trống trước)</span>
        <input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="(trống)" />
      </label>
      <div className="row">
        <button onClick={connect} disabled={busy || connected || !user}>
          Đăng nhập
        </button>
        <button className="ghost" onClick={() => post('/api/logout', {})} disabled={!connected}>
          Ngắt
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </section>
  );
}

function cellNeeds(c: FarmCell): string[] {
  if (c.idTree === -1) return ['trống'];
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('cỏ');
  if (c.isWorm) n.push('sâu');
  if (c.time === 0) n.push('thu hoạch');
  return n;
}

function AnimalPanel({ farm, catalog }: { farm: FarmState | null; catalog: AnimalInfo[] }) {
  const name = (sp: number) => catalog.find((a) => a.id === sp)?.name ?? `#${sp}`;
  if (!farm || farm.animals.length === 0) return null;
  const hungry = farm.animals.filter((a) => a.hunger).length;

  return (
    <section className="card">
      <h2>Vật nuôi</h2>
      <p className="hint">
        {farm.animals.length} con · {hungry} đang đói. Địa chỉ hoá bằng vị trí trong danh sách (= IDDB).
      </p>
      <div className="log" style={{ maxHeight: 260 }}>
        {farm.animals.map((a) => (
          <div key={a.index} className={a.hunger ? 'care' : ''}>
            <b>#{a.index}</b> {name(a.species)} · máu {a.health} · thu hoạch {a.harvestPer}% · trứng{' '}
            {a.numEggOne}
            {a.hunger && <span style={{ color: '#d9a441' }}> · ĐÓI</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function AutoPanel({ auto, items }: { auto: AutoState; items: ItemInfo[] }) {
  const [seedId, setSeedId] = useState('');
  // 123/124 đối chiếu khớp giữa bảng vật phẩm và kho; 100 là hằng số cứng trong
  // FarmScr.resetAction, chưa kiểm chứng nên để trống mặc định.
  const [waterItemId, setWaterItemId] = useState('100');
  const [grassItemId, setGrassItemId] = useState('123');
  const [wormItemId, setWormItemId] = useState('124');
  const [harvest, setHarvest] = useState(true);
  const [feedAnimals, setFeedAnimals] = useState(true);
  const [healAnimals, setHealAnimals] = useState(true);
  const [fertilizeCells, setFertilizeCells] = useState(true);
  const [autoBuy, setAutoBuy] = useState(false);
  const [buyBudgetXu, setBuyBudgetXu] = useState(5000);
  const [intervalSec, setIntervalSec] = useState(120);
  const [stepDelayMs, setStepDelayMs] = useState(700);
  const [err, setErr] = useState('');

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  async function start() {
    setErr('');
    const r = await post('/api/auto/start', {
      seedId: num(seedId),
      waterItemId: num(waterItemId),
      grassItemId: num(grassItemId),
      wormItemId: num(wormItemId),
      harvest,
      feedAnimals,
      healAnimals,
      fertilizeCells,
      autoBuy,
      buyBudgetXu,
      intervalMs: intervalSec * 1000,
      stepDelayMs,
    });
    if (r.error) setErr(r.error);
  }

  return (
    <section className="card">
      <h2>Tự động chăm sóc</h2>
      <p className="hint">
        Mỗi chu kỳ xin lại dữ liệu farm rồi hành động theo trạng thái thật của từng ô. Ô nào để trống
        thì việc đó bị tắt. <b>100</b> (tưới) và <b>123</b> (nhổ cỏ) đã kiểm chứng bằng gói thật;{' '}
        <b>124</b> (bắt sâu) mới suy từ tên vật phẩm, chưa thử được.
      </p>
      <div className="row">
        <label className="inline">
          id hạt trồng lại
          <input value={seedId} onChange={(e) => setSeedId(e.target.value)} placeholder="tắt" />
        </label>
        <label className="inline">
          id tưới nước
          <input value={waterItemId} onChange={(e) => setWaterItemId(e.target.value)} placeholder="tắt" />
        </label>
      </div>
      <div className="row">
        <label className="inline">
          id thuốc cỏ
          <input value={grassItemId} onChange={(e) => setGrassItemId(e.target.value)} placeholder="tắt" />
        </label>
        <label className="inline">
          id thuốc sâu
          <input value={wormItemId} onChange={(e) => setWormItemId(e.target.value)} placeholder="tắt" />
        </label>
      </div>
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={harvest}
            onChange={(e) => setHarvest(e.target.checked)}
            style={{ width: 'auto' }}
          />
          thu hoạch ô đã chín
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={feedAnimals}
            onChange={(e) => setFeedAnimals(e.target.checked)}
            style={{ width: 'auto' }}
          />
          cho vật nuôi ăn
        </label>
        <label className="inline">
          <input type="checkbox" checked={healAnimals} onChange={(e) => setHealAnimals(e.target.checked)} style={{ width: 'auto' }} />
          thuốc bổ khi máu &lt; 100
        </label>
        <label className="inline">
          <input type="checkbox" checked={fertilizeCells} onChange={(e) => setFertilizeCells(e.target.checked)} style={{ width: 'auto' }} />
          bón phân khi sức sống &lt; 100
        </label>
      </div>
      <div className="row">
        <label className="inline">
          <input type="checkbox" checked={autoBuy} onChange={(e) => setAutoBuy(e.target.checked)} style={{ width: 'auto' }} />
          tự mua khi thiếu (chỉ bằng xu)
        </label>
        <label className="inline">
          trần chi/vòng (xu)
          <input type="number" value={buyBudgetXu} onChange={(e) => setBuyBudgetXu(Number(e.target.value))} />
        </label>
        <label className="inline">
          chu kỳ (giây)
          <input type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} />
        </label>
        <label className="inline">
          nghỉ giữa lệnh (ms)
          <input type="number" value={stepDelayMs} onChange={(e) => setStepDelayMs(Number(e.target.value))} />
        </label>
      </div>
      <div className="row">
        <button onClick={start} disabled={auto.running}>
          Bật
        </button>
        <button className="ghost" onClick={() => post('/api/auto/stop', {})} disabled={!auto.running}>
          Tắt
        </button>
        <span className="hint">
          {auto.running ? `đang chạy — vòng ${auto.cycle}` : 'đang tắt'}
          {auto.lastRun ? ` · lần cuối ${new Date(auto.lastRun).toLocaleTimeString()}` : ''}
        </span>
      </div>
      {auto.lastActions.length > 0 && (
        <div className="log" style={{ maxHeight: 120 }}>
          {auto.lastActions.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <p className="hint">
          vật phẩm: {items.map((i) => `${i.name} ${i.price}xu`).join(' · ')}
        </p>
      )}
      {(err || auto.lastError) && <p className="err">{err || auto.lastError}</p>}
    </section>
  );
}

function FarmPanel({
  farm,
  inventory,
  trees,
}: {
  farm: FarmState | null;
  inventory: InventoryItem[];
  trees: TreeInfo[];
}) {
  const [sel, setSel] = useState<FarmCell | null>(null);
  const treeName = (id: number) => trees.find((t) => t.id === id)?.name ?? `#${id}`;

  const planted = farm?.cells.filter((c) => c.idTree !== -1).length ?? 0;
  const ready = farm?.cells.filter((c) => c.idTree !== -1 && c.time === 0).length ?? 0;
  const care = farm?.cells.filter((c) => c.isArid || c.isGrass || c.isWorm).length ?? 0;

  return (
    <section className="card">
      <h2>Nông trại</h2>
      <div className="row">
        <button onClick={() => post('/api/enter-farm', {})}>Vào nông trại / làm mới</button>
        {farm && (
          <span className="hint">
            farm #{farm.idFarm} · {farm.cells.length} ô · {planted} có cây · {ready} chờ thu ·{' '}
            {care} cần chăm
          </span>
        )}
      </div>

      {!farm && <p className="hint">Bấm "Vào nông trại" sau khi đăng nhập xong.</p>}

      {inventory.length > 0 && (
        <div className="row">
          <span className="hint">kho:</span>
          {inventory.map((it) => (
            <span key={it.id} className="chip">
              {treeName(it.id)} × {it.num}
            </span>
          ))}
          <button className="ghost" onClick={() => post('/api/farm', { name: 'getInventory', args: [] })}>
            làm mới kho
          </button>
          <button className="ghost" onClick={() => post('/api/farm', { name: 'getTreeInfo', args: [] })}>
            tải bảng cây
          </button>
        </div>
      )}

      {farm && (
        <div className="grid">
          {farm.cells.map((c) => {
            const needs = cellNeeds(c);
            const cls = [
              'cell',
              c.idTree === -1 ? 'empty' : '',
              c.time === 0 && c.idTree !== -1 ? 'ready' : '',
              c.isArid || c.isGrass || c.isWorm ? 'care' : '',
              sel?.index === c.index ? 'sel' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button key={c.index} className={cls} onClick={() => setSel(c)} title={needs.join(', ')}>
                <span className="idx">{c.index}</span>
                {c.idTree !== -1 && <span className="tree">{treeName(c.idTree)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div className="cell-detail">
          <b>Ô {sel.index}</b> — {sel.idTree === -1 ? 'trống' : treeName(sel.idTree)}
          {sel.idTree !== -1 && (
            <>
              {' '}· còn {sel.time}s · sức sống {sel.vitalityPer}% · thu hoạch {sel.hervestPer}%
              {sel.level !== undefined && ` · level ${sel.level}`}
            </>
          )}
          <div className="hint">cần: {cellNeeds(sel).join(', ') || 'không'}</div>
        </div>
      )}
    </section>
  );
}

function ActionPanel() {
  const [group, setGroup] = useState(GROUPS[0]);
  const list = useMemo(() => ACTIONS.filter((a) => a.group === group), [group]);

  return (
    <section className="card">
      <h2>Hành động</h2>
      <div className="tabs">
        {GROUPS.map((g) => (
          <button key={g} className={g === group ? 'tab active' : 'tab'} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      {list.map((a) => (
        <ActionRow key={a.action} def={a} />
      ))}
    </section>
  );
}

function ActionRow({ def }: { def: ActionDef }) {
  const [args, setArgs] = useState<number[]>(def.args.map((a) => a.default));
  const [flash, setFlash] = useState('');

  async function run() {
    const r = await post('/api/farm', { name: def.action, args });
    setFlash(r.error ?? 'đã gửi');
    setTimeout(() => setFlash(''), 1500);
  }

  return (
    <div className="action">
      <div className="action-head">
        <button onClick={run}>{def.label}</button>
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

function MacroPanel({ macro }: { macro: MacroState }) {
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
    try {
      const r = await post('/api/macro/start', JSON.parse(json));
      if (r.error) setErr(r.error);
    } catch (e) {
      setErr(`JSON hỏng: ${(e as Error).message}`);
    }
  }

  return (
    <section className="card">
      <h2>Tự động</h2>
      <p className="hint">
        Chuỗi action lặp theo chu kỳ. `action` là tên method trong FarmService, `args` khớp thứ tự tham số.
      </p>
      <textarea rows={12} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      <div className="row">
        <button onClick={start} disabled={macro.running}>
          Chạy
        </button>
        <button className="ghost" onClick={() => post('/api/macro/stop', {})} disabled={!macro.running}>
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

const FIELD_TYPES = ['i8', 'i16', 'i32', 'i64', 'bool', 'utf', 'hex'];

function RawPanel() {
  const [cmd, setCmd] = useState(76);
  const [fields, setFields] = useState<{ t: string; v: string }[]>([]);
  const [flash, setFlash] = useState('');

  async function send() {
    const r = await post('/api/raw', { cmd, fields });
    setFlash(r.error ?? 'đã gửi');
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
        <button onClick={send}>Gửi</button>
        {flash && <span className="flash">{flash}</span>}
      </div>
    </section>
  );
}

function LogPanel({ logs }: { logs: { t: number; line: string }[] }) {
  return (
    <section className="card">
      <h2>Nhật ký</h2>
      <div className="log">
        {logs.length === 0 && <p className="hint">chưa có gì</p>}
        {logs.map((l, i) => (
          <div key={i}>
            <span className="ts">{new Date(l.t).toLocaleTimeString()}</span> {l.line}
          </div>
        ))}
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
