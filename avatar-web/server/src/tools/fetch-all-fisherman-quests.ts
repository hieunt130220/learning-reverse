import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';
import { Message } from '../proto/message.js';
import { decodeQuestDialogStrings } from '../game/progressQuests.js';
import fs from 'node:fs/promises';

export interface DetailedQuest {
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
  const accountId = Number(process.argv[2] ?? 1);
  const row = getAccountById(db, accountId)!;
  const pass = readGamePass(db, cfg.masterKey, accountId);
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
    } else if (msg.command === -40) {
      try {
        const text = msg.reader ? msg.reader.readUTF() : msg.getData().toString('utf8');
        console.log(`   [Dialog] ${text}`);
      } catch {}
    }
  });

  client.on('log', (l: string) => {
    console.log(`   [Client] ${l}`);
  });

  console.log(`[1/3] Đang đăng nhập tài khoản ${row.gameUser}...`);
  await client.login({ host: row.host, port: row.port, user: row.gameUser, pass });

  console.log('-> Đăng nhập thành công! Đang tiến vào Nông trại...');
  const farmPromise = new Promise<void>((resolve) => client.once('farm', () => resolve()));
  client.enterFarm();
  await Promise.race([farmPromise, sleep(4000)]);

  console.log('[2/3] Chờ vào nông trại và ổn định kết nối (4s)...');
  await sleep(4000);

  console.log('[3/3] Gửi yêu cầu lấy danh sách nhiệm vụ Thợ Câu (doMenuOption(38, 0, 1))...');
  const p81 = new Promise<Buffer>((resolve) => {
    activeCmd81Resolver = resolve;
  });
  client.farm.communicate(90);
  await sleep(400);
  client.farm.doMenuOption(38, 0, 1);
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

  const results: DetailedQuest[] = [];
  const fishTypesSet = new Set<string>();

  const START_IDX = Number(process.argv[3] ?? 71);
  const END_IDX = Number(process.argv[4] ?? count);
  console.log(`\n=> Bắt đầu truy vấn điều kiện chi tiết từng nhiệm vụ (${START_IDX}..${END_IDX - 1})...\n`);

  for (let idx = START_IDX; idx < END_IDX; idx++) {
    const catalogItem = catalogItems[idx];
    process.stdout.write(`- [#${idx + 1}/${count}] ${catalogItem.title}... `);

    if (idx > START_IDX && idx % 4 === 0) {
      client.farm.communicate(90);
      await sleep(300);
    }

    const p62 = new Promise<Buffer | null>((resolve) => {
      activeCmd62Resolver = resolve;
      setTimeout(() => {
        if (activeCmd62Resolver) {
          activeCmd62Resolver = null;
          resolve(null);
        }
      }, 2000);
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
        conditions: ['(TIMEOUT)'],
        rewards: [catalogItem.reward],
        rawText: '',
      });
      continue;
    }

    const strs = decodeQuestDialogStrings(resp);
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
          const cond = line.replace(/^-\s*/, '');
          conditions.push(cond);
          // Trích xuất tên cá
          // Pattern: "Câu X con <tên cá> - 0/X" hoặc "Thu hoạch X con <tên cá>"
          const mFish = /câu\s+\d+\s+con\s+([^-:]+?)(?:\s*-\s*\d+\/\d+|\s*$)/i.exec(cond);
          if (mFish) {
            fishTypesSet.add(mFish[1].trim());
          } else {
            fishTypesSet.add(cond);
          }
        }
      }
    }

    console.log(`OK! Cond: [${conditions.join('; ')}]`);

    results.push({
      index: idx + 1,
      title: catalogItem.title,
      catalogReward: catalogItem.reward,
      conditions,
      rewards,
      rawText: bodyText,
    });

    await sleep(80);
  }

  const outPath = 'src/tools/fisherman-quests-details.json';
  await fs.writeFile(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n=> Đã lưu toàn bộ ${results.length} nhiệm vụ vào ${outPath}`);

  console.log('\n========================================');
  console.log('TẤT CẢ CÁC LOẠI CÁ TRONG NHIỆM VỤ THỢ CÂU:');
  console.log('========================================');
  for (const f of Array.from(fishTypesSet).sort()) {
    console.log(`- ${f}`);
  }

  client.session.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
