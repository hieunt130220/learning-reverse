/**
 * Đọc trọn văn bản server trả cho doRequestPricePlant (cmd 61).
 *   npx tsx --env-file=.env src/tools/price-plant.ts [accountId]
 *
 * Đây là lệnh DUY NHẤT cho tới giờ khiến server chịu trả lời khi đụng tới ô đã
 * thu hoạch — nội dung hộp thoại nhiều khả năng nói rõ phải làm gì để trồng lại.
 * Chỉ đọc, không trồng, không mua.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;
const c = new GameClient();

/** Nhiều gói mở đầu bằng [u16 len][utf8] — thử đọc, hỏng thì trả hex. */
function asText(b: Buffer): string {
  try {
    const n = b.readUInt16BE(0);
    if (n > 0 && n + 2 <= b.length) return b.subarray(2, 2 + n).toString('utf8');
  } catch { /* bỏ qua */ }
  return b.subarray(0, 48).toString('hex');
}

c.on('message', (m: { command: number; getData(): Buffer }) => {
  if ([-36, -38].includes(m.command)) return;
  if ([61, -40, 66, 64].includes(m.command)) {
    console.log(`RX cmd=${m.command}: ${asText(m.getData())}`);
  }
});

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(4000);
const ready = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await ready;
await sleep(2000);

console.log('TX requestPricePlant(idFarm)');
c.farm.requestPricePlant(c.farmState!.idFarm);
await sleep(6000);

c.logout();
process.exit(0);
