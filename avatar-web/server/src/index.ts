import http from 'node:http';
import express from 'express';

import { accountsRouter } from './accounts/routes.js';
import { ShopRepository } from './accounts/shopRepo.js';
import { authRouter } from './auth/routes.js';
import { purgeExpiredSessions } from './auth/sessions.js';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { VERIFIED_NPC_MAP_CATALOG } from './game/npcMapCatalog.js';
import { SessionManager } from './session/manager.js';
import { sessionRouter } from './session/routes.js';
import { shopRouter } from './session/shopRoutes.js';
import { attachWebSocket, type WsHub } from './ws.js';

// Ném ngay nếu thiếu MASTER_KEY / INVITE_CODE — dừng còn hơn lặng lẽ chạy bằng
// khoá mặc định rồi ghi cả DB bằng nó.
const config = loadConfig();
const db = openDb(config.dbPath);
purgeExpiredSessions(db);

const app = express();
// Rate limit đếm theo IP; sau reverse proxy thì `req.ip` phải là IP thật chứ
// không phải 127.0.0.1, nếu không cả thế giới dùng chung một bộ đếm.
app.set('trust proxy', true);
app.use(express.json());

let hub: WsHub;
const shopRepository = new ShopRepository(db);
const sessions = new SessionManager({
  db,
  masterKey: config.masterKey,
  maxSessions: config.maxSessions,
  shopRepository,
  shopPolicy: config.shopPolicy,
  findNpcCatalog: VERIFIED_NPC_MAP_CATALOG,
  broadcast: (userId, accountId, type, payload) => hub.broadcast(userId, accountId, type, payload),
});

app.use('/api/auth', authRouter({ db, inviteCode: config.inviteCode, isProduction: config.isProduction }));
app.use(
  '/api/accounts',
  accountsRouter({ db, masterKey: config.masterKey, isProduction: config.isProduction, sessions }),
);
app.use('/api/accounts', shopRouter({
  db,
  isProduction: config.isProduction,
  sessions,
  repository: shopRepository,
}));
app.use('/api/accounts', sessionRouter({
  db,
  isProduction: config.isProduction,
  sessions,
  shopPolicy: config.shopPolicy,
}));

const server = http.createServer(app);
hub = attachWebSocket(server, { db, sessions });

// Một process giữ mọi phiên: một promise bị bỏ rơi ở bất kỳ đâu cũng giết cả
// server và kéo theo mọi tài khoản khác.
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

function shutdown(signal: string): void {
  console.log(`${signal} — đang dừng`);
  sessions.stopAll();
  hub.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(config.port, () => {
  console.log(`avatar-web server: http://localhost:${config.port}`);
  void sessions.bootstrap().catch((err: Error) => console.error(`bootstrap lỗi: ${err.message}`));
});
