/**
 * Probe read-only: join map 13 → communicate NPC 4 → doMenuOption (uid=9, option=1)
 * → bắt RX -19 (OPEN_SHOP) → parse catalog 4 vật phẩm bến tàu.
 *
 * RX -19 format (từ disasm GlobalMessageHandler.onMessage 0x5EAEC8):
 *   i8  typeShop       (11 = Bến Tàu)
 *   utf nameShop       ("Bến Tàu")
 *   i16 count          (4)
 *   i16[] listIdPart   ([4874, 4879, 4875, 4876])
 *
 * Mapping từ 5 ảnh screenshot thực tế:
 *   - 4874: Cần Câu Lục Sĩ (20.000 xu)
 *   - 4879: Cần Câu Chuyên Gia (120 lượng)
 *   - 4875: Mồi Câu Cá Trâm (50 xu)
 *   - 4876: Vé Câu Bến Tàu (12.000 xu)
 *
 * Probe chỉ đọc, không gửi lệnh mua (-92).
 *
 *   npx tsx --env-file=.env src/tools/pier-shop-probe.ts [accountId]
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { MyReader } from '../proto/reader.js';
import { loadConfig } from '../config.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const accountId = Number(process.argv[2] ?? 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const OUT_DIR = '/tmp/pier-probe/shop-catalog';
mkdirSync(OUT_DIR, { recursive: true });

interface OpenShopData {
  typeShop: number;
  nameShop: string;
  count: number;
  itemIds: number[];
  extraBytes?: string;
  rawHex: string;
}

function decodeOpenShop(buf: Buffer): OpenShopData {
  const r = new MyReader(buf);
  const typeShop = r.readByte();          // i8 typeShop
  const nameShop = r.readUTF();           // utf nameShop
  const count = r.readShort();            // i16 count
  const itemIds: number[] = [];
  for (let i = 0; i < count; i++) {
    itemIds.push(r.readShort());
  }

  let extraBytes: string | undefined;
  if (r.available() > 0) {
    extraBytes = buf.subarray(buf.length - r.available()).toString('hex');
  }

  return { typeShop, nameShop, count, itemIds, extraBytes, rawHex: buf.toString('hex') };
}

const c = new GameClient();
c.on('log', (l: string) => console.log('   LOG', l));
c.on('error', (err: unknown) => console.log('   ERR', (err as Error)?.message ?? String(err)));
c.on('close', () => console.log('   CONNECTION CLOSED'));

// Safeguard timer
const globalTimer = setTimeout(() => {
  console.error('\n⚠️ Global timeout (30s) reached, exiting...');
  try { c.logout(); } catch { /* ignore */ }
  process.exit(1);
}, 30_000);
globalTimer.unref();

// Collect ALL RX -19 packets
const shopPackets: OpenShopData[] = [];
const rawPackets: { cmd: number; hex: string }[] = [];

c.on('message', (m: { command: number; getData(): Buffer }) => {
  const b = m.getData();
  if (m.command === -19) {
    console.log(`\n   🛒 RX -19 OPEN_SHOP len=${b.length}`);
    try {
      const shop = decodeOpenShop(b);
      shopPackets.push(shop);
      console.log(`   typeShop=${shop.typeShop} nameShop="${shop.nameShop}" count=${shop.count}`);
      console.log(`   itemIds: [${shop.itemIds.join(', ')}]`);
      if (shop.extraBytes) {
        console.log(`   extraBytes: ${shop.extraBytes}`);
      }
    } catch (err) {
      console.log(`   decode lỗi: ${(err as Error).message}`);
      console.log(`   raw hex: ${b.toString('hex')}`);
    }
    // Save raw
    writeFileSync(`${OUT_DIR}/rx-19-${Date.now()}.bin`, b);
  } else if (m.command === -40) {
    try {
      const r = new MyReader(b);
      const text = r.readUTF();
      console.log(`   💬 dialog (-40): "${text}"`);
    } catch { /* ignore */ }
  } else if (m.command === -61) {
    try {
      const r = new MyReader(b);
      const uid = r.readInt();
      const typeMenu = r.readByte();
      const count = r.readByte();
      console.log(`   📋 menu (-61): uid=${uid} typeMenu=${typeMenu} count=${count}`);
      for (let i = 0; i < count; i++) {
        console.log(`      [${i}] ${r.readUTF()}`);
      }
    } catch { /* ignore */ }
  } else if ([-36, -38, -87, 80, 81, 84, -34, -3].includes(m.command)) {
    // skip noise
  } else {
    rawPackets.push({ cmd: m.command, hex: b.subarray(0, 32).toString('hex') });
  }
});

console.log(`=== Pier Shop Probe ===`);
console.log(`Tài khoản #${accountId} (${row.gameUser}) -> ${row.host}:${row.port}`);
console.log(`Mục tiêu: join map 13 -> NPC 4 -> menuOption (uid=9, option=1) -> bắt RX -19 OPEN_SHOP\n`);

// Step 1: Login
console.log('--- Step 1: Login ---');
await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(2000);
console.log(`status=${c.status} playerId=${c.playerId}\n`);

// Step 2: Join park map 13 area 0
console.log('--- Step 2: Enter Park context & Join map 13 area 0 ---');
c.enterParkContext();
await sleep(1000);

c.joinPark(13, 0);
try {
  const snap = await c.waitForWorldSnapshot(AbortSignal.timeout(8000), 8000, { map: 13, area: 0 });
  console.log(`Đã vào map ${snap.roomId} khu ${snap.boardId}, ${snap.specials.length} specials\n`);
} catch (err) {
  console.log(`Cảnh báo waitForWorldSnapshot: ${(err as Error).message}\n`);
}
await sleep(1500);

// Step 3: Communicate NPC 4 (Lái buôn cá)
console.log('--- Step 3: Communicate NPC 4 (Lái buôn cá) ---');
c.farm.communicate(4);
await sleep(1200);

// Step 4: Gửi lệnh chọn mục [1] "Cửa hàng cá bến tàu"
console.log('--- Step 4: Gửi TX -61: writeInt(9).writeByte(0).writeByte(1) (Cửa hàng cá bến tàu) ---');
c.sendRaw(-61, [
  { t: 'i32', v: '9' },
  { t: 'i8', v: '0' },
  { t: 'i8', v: '1' },
]);
await sleep(4000);

// Step 5: Report
console.log(`\n=== KẾT QUẢ PROBE CATALOG BẾN TÀU ===`);
console.log(`Nhận ${shopPackets.length} gói RX -19 OPEN_SHOP`);
if (shopPackets.length > 0) {
  const ITEM_NAMES: Record<number, string> = {
    4874: 'Cần Câu Lục Sĩ (20.000 xu)',
    4879: 'Cần Câu Chuyên Gia (120 lượng)',
    4875: 'Mồi Câu Cá Trâm (50 xu)',
    4876: 'Vé Câu Bến Tàu (12.000 xu)',
  };

  for (const shop of shopPackets) {
    console.log(`\nShop: "${shop.nameShop}" (typeShop=${shop.typeShop}, count=${shop.count})`);
    console.log(`Item IDs: [${shop.itemIds.join(', ')}]`);
    for (let i = 0; i < shop.itemIds.length; i++) {
      const id = shop.itemIds[i];
      const desc = ITEM_NAMES[id] ?? 'Chưa đặt tên';
      console.log(`  ${i + 1}. itemId=${id} -> ${desc}`);
    }
  }

  // Save full evidence
  const evidence = {
    timestamp: new Date().toISOString(),
    accountId,
    shopName: shopPackets[0]?.nameShop,
    typeShop: shopPackets[0]?.typeShop,
    catalog: shopPackets[0]?.itemIds.map((id, idx) => ({
      index: idx,
      itemId: id,
      name: ITEM_NAMES[id] ?? 'Unknown',
    })),
    rawHex: shopPackets[0]?.rawHex,
    allShops: shopPackets,
    otherTraffic: rawPackets.slice(0, 30),
  };
  const path = `${OUT_DIR}/evidence-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  console.log(`\n✅ Bằng chứng catalog đã được lưu vào: ${path}`);
} else {
  console.log('\n⚠️ Không nhận RX -19');
}

c.logout();
await sleep(1000);
process.exit(0);
