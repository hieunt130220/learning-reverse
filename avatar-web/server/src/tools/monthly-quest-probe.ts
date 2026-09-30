/**
 * Công cụ Probe Lấy Danh Sách & Tiến Trình Nhiệm Vụ Tháng (Monthly Quest Probe)
 *
 * Chạy từ thư mục avatar-web/server:
 *   npx tsx --env-file=.env src/tools/monthly-quest-probe.ts [options]
 *
 * Tùy chọn:
 *   --account-id <number>   ID tài khoản trong database (mặc định: 1)
 *   --uid <number>          userID của menu NPC Lái buôn (mặc định: 20 - Nhiệm vụ tháng)
 *   --sweep                 Bật chế độ quét dải userID thay vì chỉ thử 1 uid
 *   --min <number>          UID bắt đầu khi sweep (mặc định: 15)
 *   --max <number>          UID kết thúc khi sweep (mặc định: 50)
 *   --delay <number>        Thời gian chờ giữa các lệnh tính bằng ms (mặc định: 500)
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';
import { Message } from '../proto/message.js';
import {
  parseQuestListPacket,
  decodeQuestDialogStrings,
  parseQuestDialogText,
  type QuestCatalogEntry,
  type ProgressQuestChain,
} from '../game/progressQuests.js';

interface CliArgs {
  accountId: number;
  uid: number;
  sweep: boolean;
  minUid: number;
  maxUid: number;
  delayMs: number;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    accountId: 1,
    uid: 20,
    sweep: false,
    minUid: 15,
    maxUid: 50,
    delayMs: 500,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--account-id' && args[i + 1]) {
      result.accountId = Number(args[++i]);
    } else if (arg === '--uid' && args[i + 1]) {
      result.uid = Number(args[++i]);
    } else if (arg === '--sweep') {
      result.sweep = true;
    } else if (arg === '--min' && args[i + 1]) {
      result.minUid = Number(args[++i]);
    } else if (arg === '--max' && args[i + 1]) {
      result.maxUid = Number(args[++i]);
    } else if (arg === '--delay' && args[i + 1]) {
      result.delayMs = Number(args[++i]);
    }
  }

  return result;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function extractQuestCatalog(buf: Buffer): { source: 'standard' | 'fallback'; entries: QuestCatalogEntry[] } {
  try {
    const std = parseQuestListPacket(buf);
    if (std.length > 0) {
      return { source: 'standard', entries: std };
    }
  } catch {
    // tiếp tục fallback
  }

  const strings: string[] = [];
  let o = 0;
  while (o + 2 <= buf.length) {
    const len = buf.readUInt16BE(o);
    if (len > 0 && len < 2000 && o + 2 + len <= buf.length) {
      const slice = buf.subarray(o + 2, o + 2 + len);
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(slice);
        if (text.length > 0 && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
          strings.push(text);
          o += 2 + len;
          if (o + 1 < buf.length && buf[o] === 0xff && buf[o + 1] === 0xff) {
            o += 2;
          }
          continue;
        }
      } catch {
        // không phải UTF-8
      }
    }
    o++;
  }

  const entries: QuestCatalogEntry[] = [];
  const questStrings = strings.filter(
    (s) => s !== 'lsnhiemvu' && !s.toLowerCase().includes('danh sách nhiệm vụ')
  );

  for (let i = 0; i < questStrings.length; i += 2) {
    const title = questStrings[i];
    const reward = questStrings[i + 1] ?? '—';
    if (title && (title.toLowerCase().includes('nhiệm vụ') || title.toLowerCase().includes('tháng') || title.length > 3)) {
      entries.push({ title, reward });
    }
  }

  return { source: 'fallback', entries };
}

interface ProbeResult {
  uid: number;
  catalog: QuestCatalogEntry[];
  catalogSource: string;
  catalogRawLen: number;
  currentQuestRaw: string[];
  currentQuestParsed: ProgressQuestChain | null;
  dialogs: string[];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('=== KHỞI ĐỘNG CÔNG CỤ PROBE NHIỆM VỤ THÁNG ===');
  console.log(`- Tài khoản ID: ${opts.accountId}`);
  console.log(`- Chế độ: ${opts.sweep ? `Quét dải UID (${opts.minUid}..${opts.maxUid})` : `Thăm dò mục tiêu UID=${opts.uid}`}`);
  console.log(`- Delay: ${opts.delayMs}ms`);

  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const row = getAccountById(db, opts.accountId);
  if (!row) {
    console.error(`Lỗi: Không tìm thấy tài khoản ID ${opts.accountId} trong cơ sở dữ liệu.`);
    process.exit(1);
  }

  const pass = readGamePass(db, cfg.masterKey, opts.accountId);
  const client = new GameClient();

  // Packet collector để bắt chính xác phản hồi cho từng request
  let pendingCmd81Resolver: ((buf: Buffer) => void) | null = null;
  let pendingCmd62Resolver: ((buf: Buffer) => void) | null = null;
  const recentDialogs: string[] = [];

  client.on('message', (msg: Message) => {
    if (msg.command === -81) {
      const data = Buffer.from(msg.getData());
      if (pendingCmd81Resolver) {
        pendingCmd81Resolver(data);
        pendingCmd81Resolver = null;
      }
    } else if (msg.command === -62) {
      const data = Buffer.from(msg.getData());
      if (pendingCmd62Resolver) {
        pendingCmd62Resolver(data);
        pendingCmd62Resolver = null;
      }
    } else if (msg.command === -40 || msg.command === -88 || msg.command === -70 || msg.command === -77) {
      try {
        const text = msg.reader ? msg.reader.readUTF() : msg.getData().toString('utf8');
        recentDialogs.push(`[cmd ${msg.command}] ${text}`);
      } catch {
        // bỏ qua lỗi decode dialog
      }
    }
  });

  client.on('log', (l: string) => {
    if (l.includes('đăng nhập') || l.includes('nhiệm vụ:')) {
      console.log(`   [Client] ${l}`);
    }
  });

  try {
    console.log(`-> Đang đăng nhập (${row.gameUser} @ ${row.host}:${row.port})...`);
    await client.login({
      host: row.host,
      port: row.port,
      user: row.gameUser,
      pass,
    });

    console.log('-> Đăng nhập thành công! Đang tiến vào Nông trại...');
    const farmPromise = new Promise<void>((resolve) => client.once('farm', () => resolve()));
    client.enterFarm();
    await Promise.race([farmPromise, sleep(4000)]);

    // Đợi 3.5 giây để client kết thúc đợt refreshProgressQuests() tự động lúc login
    console.log('-> Đợi hệ thống ổn định trạng thái nông trại...');
    await sleep(3500);
    console.log('-> Đã sẵn sàng tương tác NPC Lái buôn.\n');

    const uidsToTest = opts.sweep
      ? Array.from({ length: opts.maxUid - opts.minUid + 1 }, (_, i) => opts.minUid + i)
      : [opts.uid];

    const results: ProbeResult[] = [];

    for (const uid of uidsToTest) {
      if (client.status !== 'online') {
        console.warn(`[Cảnh báo] Mất kết nối khi probe UID ${uid}. Dừng phiên.`);
        break;
      }

      recentDialogs.length = 0;

      // 1. Thử lấy danh sách nhiệm vụ (doMenuOption(uid, 0, 1))
      const p81 = new Promise<Buffer | null>((resolve) => {
        pendingCmd81Resolver = resolve;
        setTimeout(() => {
          if (pendingCmd81Resolver) {
            pendingCmd81Resolver = null;
            resolve(null);
          }
        }, 2000);
      });

      client.farm.communicate(90);
      await sleep(opts.delayMs);
      client.farm.doMenuOption(uid, 0, 1);
      const catalogData = await p81;

      let catalogEntries: QuestCatalogEntry[] = [];
      let catalogSource = 'none';
      let rawLen = 0;

      if (catalogData) {
        rawLen = catalogData.length;
        const res = extractQuestCatalog(catalogData);
        catalogEntries = res.entries;
        catalogSource = res.source;
      }

      await sleep(opts.delayMs);

      // 2. Thử lấy nhiệm vụ hiện tại (doMenuOption(uid, 0, 0))
      const p62 = new Promise<Buffer | null>((resolve) => {
        pendingCmd62Resolver = resolve;
        setTimeout(() => {
          if (pendingCmd62Resolver) {
            pendingCmd62Resolver = null;
            resolve(null);
          }
        }, 2000);
      });

      client.farm.communicate(90);
      await sleep(opts.delayMs);
      client.farm.doMenuOption(uid, 0, 0);
      const progressData = await p62;

      let currentQuestStrings: string[] = [];
      let parsedQuest: ProgressQuestChain | null = null;

      if (progressData) {
        currentQuestStrings = decodeQuestDialogStrings(progressData);
        const questText = currentQuestStrings.find((s) => /nhiệm vụ hiện tại/i.test(s));
        if (questText) {
          parsedQuest = parseQuestDialogText(questText);
        }
      }

      const hasData = catalogEntries.length > 0 || currentQuestStrings.length > 0 || recentDialogs.length > 0;
      if (hasData || !opts.sweep) {
        results.push({
          uid,
          catalog: catalogEntries,
          catalogSource,
          catalogRawLen: rawLen,
          currentQuestRaw: currentQuestStrings,
          currentQuestParsed: parsedQuest,
          dialogs: [...recentDialogs],
        });
      }

      if (opts.sweep && hasData) {
        const titleSummary = catalogEntries[0]?.title ?? parsedQuest?.title ?? recentDialogs[0] ?? 'Có dữ liệu';
        console.log(`[Sweep] Phát hiện UID ${uid}: ${titleSummary} (Catalog: ${catalogEntries.length}, Quest: ${parsedQuest ? parsedQuest.title : 'Không'})`);
      }
    }

    // In báo cáo tổng hợp
    console.log('\n================================================================================');
    console.log('                     KẾT QUẢ PROBE NHIỆM VỤ THÁNG');
    console.log('================================================================================\n');

    if (results.length === 0) {
      console.log('Không nhận được dữ liệu nhiệm vụ nào từ server với các UID đã thử.');
    }

    for (const r of results) {
      console.log(`--- [KẾT QUẢ CHO USER_ID = ${r.uid}] ---`);
      if (r.dialogs.length > 0) {
        console.log(`Hộp thoại server: ${r.dialogs.join(' | ')}`);
      }

      if (r.currentQuestParsed) {
        const q = r.currentQuestParsed;
        const kindLabel = /tháng/i.test(q.title) ? 'monthly (nhiệm vụ tháng)' : q.kind;
        console.log(`\n* NHIỆM VỤ HIỆN TẠI (Cmd -62):`);
        console.log(`  - Tiêu đề: ${q.title} (Loại: ${kindLabel}, Bước: ${q.step})`);
        console.log(`  - Điều kiện:`);
        for (const c of q.conditions) {
          console.log(`    + ${c.name}: ${c.current}/${c.total} ${c.isDone ? '[XONG]' : '[CHƯA XONG]'}`);
        }
        if (q.rewards && q.rewards.length > 0) {
          console.log(`  - Phần thưởng:`);
          for (const rw of q.rewards) {
            console.log(`    + ${rw.displayName ?? `Loại #${rw.type} x${rw.amount}`}`);
          }
        }
      } else if (r.currentQuestRaw.length > 0) {
        console.log(`\n* DỮ LIỆU HIỆN TẠI RAW (Cmd -62):`);
        for (const s of r.currentQuestRaw) {
          console.log(`  > ${s}`);
        }
      }

      if (r.catalog.length > 0) {
        console.log(`\n* DANH SÁCH NHIỆM VỤ (Cmd -81, ${r.catalog.length} nhiệm vụ, nguồn: ${r.catalogSource}, rawLen: ${r.catalogRawLen}B):`);
        r.catalog.forEach((item, idx) => {
          console.log(`  #${String(idx + 1).padStart(2, '0')} | ${item.title}`);
          console.log(`        ${item.reward}`);
        });
      } else if (r.catalogRawLen > 0) {
        console.log(`\n* Gói tin Cmd -81 nhận được (${r.catalogRawLen} byte) nhưng chưa parse được mục nào.`);
      }

      console.log('\n--------------------------------------------------------------------------------\n');
    }

  } catch (err) {
    console.error('Lỗi trong quá trình probe:', (err as Error).message);
  } finally {
    console.log('-> Đăng xuất và dọn dẹp kết nối...');
    client.logout();
    await sleep(500);
    db.close();
    console.log('=== HOÀN TẤT PHIÊN PROBE ===');
    process.exit(0);
  }
}

main();
