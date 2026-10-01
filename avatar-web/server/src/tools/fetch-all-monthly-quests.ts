import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';
import { Message } from '../proto/message.js';
import { decodeQuestDialogStrings } from '../game/progressQuests.js';
import fs from 'node:fs/promises';

export interface DetailedMonthlyQuest {
  index: number;
  title: string;
  catalogReward: string;
  conditions: string[];
  rewards: string[];
  rawText: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const row = getAccountById(db, 1)!;
  const pass = readGamePass(db, cfg.masterKey, 1);
  const client = new GameClient();

  let activeCmd62Resolver: ((buf: Buffer) => void) | null = null;
  let activeCmd81Resolver: ((buf: Buffer) => void) | null = null;

  client.on('message', (msg: Message) => {
    if (msg.command === -62) {
      if (activeCmd62Resolver) {
        const r = activeCmd62Resolver;
        activeCmd62Resolver = null;
        r(Buffer.from(msg.getData()));
      }
    } else if (msg.command === -81) {
      if (activeCmd81Resolver) {
        const r = activeCmd81Resolver;
        activeCmd81Resolver = null;
        r(Buffer.from(msg.getData()));
      }
    }
  });

  console.log(`[1/3] Đang đăng nhập tài khoản ${row.gameUser}...`);
  await client.login({ host: row.host, port: row.port, user: row.gameUser, pass });
  client.enterFarm();

  console.log('[2/3] Chờ vào nông trại và ổn định kết nối (5s)...');
  await sleep(5000);

  console.log('[3/3] Gửi yêu cầu lấy danh sách nhiệm vụ tháng (doMenuOption(20, 0, 1))...');
  const p81 = new Promise<Buffer>((resolve) => {
    activeCmd81Resolver = resolve;
  });
  client.farm.communicate(90);
  await sleep(400);
  client.farm.doMenuOption(20, 0, 1);
  const listBuf = await p81;

  let o = 0;
  const readStr = () => {
    if (o + 2 > listBuf.length) return '';
    const len = listBuf.readUInt16BE(o);
    o += 2;
    const str = listBuf.toString('utf8', o, o + len);
    o += len;
    return str;
  };

  const magic1 = readStr();
  const magic2 = readStr();
  const idList = listBuf.readInt32BE(o);
  const count = listBuf.readInt32BE(o + 4);
  o += 8;

  console.log(`=> idList = ${idList}, tổng cộng ${count} nhiệm vụ.`);

  const catalogItems: { title: string; reward: string }[] = [];
  for (let i = 0; i < count; i++) {
    if (listBuf[o] === 0xff && listBuf[o + 1] === 0xff) o += 2;
    const t = readStr();
    const r = readStr();
    catalogItems.push({ title: t, reward: r });
  }

  const results: DetailedMonthlyQuest[] = [];

  console.log('\n=> Bắt đầu truy vấn điều kiện chi tiết từng nhiệm vụ (0..19)...\n');

  for (let idx = 0; idx < count; idx++) {
    const catalogItem = catalogItems[idx];
    process.stdout.write(`- Truy vấn nhiệm vụ #${idx + 1} (${catalogItem.title})... `);

    const p62 = new Promise<Buffer | null>((resolve) => {
      activeCmd62Resolver = resolve;
      setTimeout(() => {
        if (activeCmd62Resolver) {
          activeCmd62Resolver = null;
          resolve(null);
        }
      }, 3000);
    });

    const m = Message.create(-81);
    m.writer!.writeInt(idList);
    m.writer!.writeByte(0);
    m.writer!.writeShort(idx);
    m.writer!.writeByte(-1);
    client.session.send(m);

    const resp = await p62;
    if (!resp) {
      console.log('TIMEOUT!');
      results.push({
        index: idx + 1,
        title: catalogItem.title,
        catalogReward: catalogItem.reward,
        conditions: ['(Không phản hồi từ server)'],
        rewards: [catalogItem.reward],
        rawText: '',
      });
      continue;
    }

    const strs = decodeQuestDialogStrings(resp);
    // Chuỗi body luôn là chuỗi thứ 2 (hoặc chuỗi dài nhất chứa \n)
    const bodyText = (strs.length > 1 ? strs[1] : strs[0]) || '';

    const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
    const conditions: string[] = [];
    const rewards: string[] = [];
    let readingRewards = false;

    for (const line of lines) {
      if (/phần thưởng/i.test(line)) {
        readingRewards = true;
        continue;
      }
      if (readingRewards) {
        if (line.startsWith('-')) {
          rewards.push(line.replace(/^-\s*/, ''));
        } else if (line.length > 0 && !line.toLowerCase().includes('nhiệm vụ')) {
          rewards.push(line);
        }
      } else {
        if (line.startsWith('-')) {
          conditions.push(line.replace(/^-\s*/, ''));
        }
      }
    }

    console.log(`XONG (${conditions.length} điều kiện, ${rewards.length} phần thưởng)`);

    results.push({
      index: idx + 1,
      title: catalogItem.title,
      catalogReward: catalogItem.reward,
      conditions,
      rewards: rewards.length > 0 ? rewards : [catalogItem.reward],
      rawText: bodyText,
    });

    await sleep(400); // 400ms delay giữa các lệnh để server không nghẽn
  }

  console.log('\n================================================================');
  console.log('           BẢNG CHI TIẾT 20 NHIỆM VỤ THÁNG 9 (AVATAR HD)');
  console.log('================================================================\n');

  for (const q of results) {
    console.log(`[Nhiệm vụ #${String(q.index).padStart(2, '0')}] ${q.title}`);
    console.log('  * Điều kiện:');
    for (const c of q.conditions) {
      console.log(`    - ${c}`);
    }
    console.log('  * Phần thưởng:');
    for (const r of q.rewards) {
      console.log(`    + ${r}`);
    }
    console.log('');
  }

  await fs.writeFile('src/tools/monthly-quests-details.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('=> Đã lưu file kết quả: src/tools/monthly-quests-details.json');

  client.logout();
  db.close();
  process.exit(0);
}

main().catch(console.error);
