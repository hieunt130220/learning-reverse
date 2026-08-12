import http from 'node:http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

import { DEFAULT_SERVER, readAccount } from './account.js';
import { GameClient } from './game/client.js';
import { AutoFarm, type AutoFarmConfig } from './autoFarm.js';
import { Macro, MacroRunner } from './macro.js';

const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(express.json());

const client = new GameClient();
const macros = new MacroRunner(client);
const auto = new AutoFarm(client);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Set<WebSocket>();

function broadcast(type: string, payload: unknown): void {
  const data = JSON.stringify({ type, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws) => {
  sockets.add(ws);
  ws.send(
    JSON.stringify({
      type: 'snapshot',
      payload: {
        status: client.status,
        lastError: client.lastError,
        playerId: client.playerId,
        traffic: client.traffic.slice(-100),
        macro: macros.state(),
        farm: client.farmState,
        auto: auto.state(),
        inventory: client.inventory,
        trees: client.trees,
        items: client.items,
        animals: client.animals,
        money: client.money,
      },
    }),
  );
  ws.on('close', () => sockets.delete(ws));
});

client.on('status', (s) => broadcast('status', s));
client.on('log', (line: string) => broadcast('log', { t: Date.now(), line }));
client.on('traffic', (entry) => broadcast('traffic', entry));
client.on('farm', (state) => broadcast('farm', state));
macros.on('state', (s) => broadcast('macro', s));
auto.on('state', (s) => broadcast('auto', s));
client.on('inventory', (i) => broadcast('inventory', i));
client.on('trees', (t) => broadcast('trees', t));
client.on('money', (m) => broadcast('money', m));

// ---- REST ---------------------------------------------------------------

app.post('/api/login', async (req, res) => {
  const body = req.body ?? {};
  // Gọi không kèm tài khoản -> lấy từ file `avatar-web/account`.
  const acc = body.user ? null : readAccount();
  const host = body.host ?? DEFAULT_SERVER.host;
  const port = body.port ?? DEFAULT_SERVER.port;
  const user = body.user ?? acc?.user;
  const pass = body.pass ?? acc?.pass ?? '';
  const device = body.device;
  if (!host || !port || !user) return res.status(400).json({ error: 'thiếu host/port/user' });
  try {
    await client.login({ host, port: Number(port), user, pass: pass ?? '', device });
    res.json({ ok: true, status: client.status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/logout', (_req, res) => {
  macros.stop();
  auto.stop();
  client.logout();
  res.json({ ok: true });
});

/** Vào nông trại (xin handler farm) — server sẽ đẩy về gói dữ liệu farm. */
app.post('/api/enter-farm', (_req, res) => {
  try {
    client.enterFarm();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Gọi thẳng một method của FarmService: { name, args:[...] } */
app.post('/api/farm', (req, res) => {
  const { name, args } = req.body ?? {};
  const fn = (client.farm as unknown as Record<string, unknown>)[name];
  if (typeof fn !== 'function') return res.status(400).json({ error: `không có action "${name}"` });
  try {
    (fn as (...a: unknown[]) => void).apply(client.farm, args ?? []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Gói tự do để dò opcode: { cmd, fields:[{t,v}] } */
app.post('/api/raw', (req, res) => {
  const { cmd, fields } = req.body ?? {};
  try {
    client.sendRaw(Number(cmd), fields ?? []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/macro/start', (req, res) => {
  try {
    macros.start(req.body as Macro);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/macro/stop', (_req, res) => {
  macros.stop();
  res.json({ ok: true });
});

app.post('/api/auto/start', (req, res) => {
  try {
    auto.start((req.body ?? {}) as Partial<AutoFarmConfig>);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/auto/stop', (_req, res) => {
  auto.stop();
  res.json({ ok: true });
});

/** Body đầy đủ (hex) của gói RX gần nhất theo cmd — để giải mã các gói lớn. */
app.get('/api/packet/:cmd', (req, res) => {
  const hex = client.lastPacket.get(Number(req.params.cmd));
  if (!hex) return res.status(404).json({ error: 'chưa nhận gói này' });
  res.json({ cmd: Number(req.params.cmd), bytes: hex.length / 2, hex });
});

/**
 * Log gói tin gần nhất. Có endpoint này để chẩn đoán mà KHÔNG phải tạo file
 * script tạm trong thư mục server — làm vậy khiến `tsx watch` nạp lại và rớt phiên.
 */
app.get('/api/traffic', (req, res) => {
  const n = Math.min(Number(req.query.n ?? 30), 500);
  res.json(client.traffic.slice(-n));
});

app.get('/api/state', (_req, res) => {
  res.json({
    status: client.status,
    lastError: client.lastError,
    playerId: client.playerId,
    macro: macros.state(),
    farm: client.farmState,
    auto: auto.state(),
    inventory: client.inventory,
    trees: client.trees,
    items: client.items,
    animals: client.animals,
    money: client.money,
  });
});

server.listen(PORT, async () => {
  console.log(`avatar-web server: http://localhost:${PORT}`);

  // Tự đăng nhập lại khi khởi động nếu có file account — để `tsx watch` nạp lại
  // code không làm mất phiên. Tắt bằng AUTO_LOGIN=0.
  if (process.env.AUTO_LOGIN === '0') return;
  const acc = readAccount();
  if (!acc) return;
  try {
    await client.login({ ...DEFAULT_SERVER, user: acc.user, pass: acc.pass });
    console.log(`tự đăng nhập: ${acc.user}`);
  } catch (err) {
    console.log(`tự đăng nhập lỗi: ${(err as Error).message}`);
  }
});
