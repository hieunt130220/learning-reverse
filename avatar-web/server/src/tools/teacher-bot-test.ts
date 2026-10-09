import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient } from '../game/client.js';
import type { Message } from '../proto/message.js';
import fs from 'node:fs';

const DICT_EN_FILE = 'data/teacher-dict-en.json';
const DICT_VI_FILE = 'data/teacher-dict-vi.json';

interface ViQuestion {
  question: string;
  prefix: string;
  suffix: string;
  answer: string;
}

// 1. Nạp từ điển tiếng Anh
let dictEn: Record<string, string> = {};
if (fs.existsSync(DICT_EN_FILE)) {
  try {
    dictEn = JSON.parse(fs.readFileSync(DICT_EN_FILE, 'utf-8'));
  } catch {}
}

// 2. Nạp từ điển tiếng Việt (ca dao tục ngữ)
let dictVi: ViQuestion[] = [];
if (fs.existsSync(DICT_VI_FILE)) {
  try {
    dictVi = JSON.parse(fs.readFileSync(DICT_VI_FILE, 'utf-8'));
  } catch {}
}

function saveDictEn() {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(DICT_EN_FILE, JSON.stringify(dictEn, null, 2), 'utf-8');
}

function saveDictVi() {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(DICT_VI_FILE, JSON.stringify(dictVi, null, 2), 'utf-8');
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:]+$/, '');
}

function findViAnswer(text: string): string | null {
  const normText = normalize(text);
  for (const item of dictVi) {
    const p = normalize(item.prefix);
    const s = normalize(item.suffix);
    if (p && s) {
      if (normText.startsWith(p) && normText.endsWith(s)) {
        return item.answer;
      }
    } else if (p && normText.startsWith(p)) {
      return item.answer;
    } else if (s && normText.endsWith(s)) {
      return item.answer;
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const mode = process.argv[2]?.toLowerCase() || 'both'; // 'en', 'vi', hoặc 'both'
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const accountId = 1;
  const account = getAccountById(db, accountId)!;
  const gamePass = readGamePass(db, config.masterKey, accountId)!;

  console.log(`📚 Đã nạp từ điển: ${Object.keys(dictEn).length} từ EN | ${dictVi.length} câu VN`);
  console.log(`🎯 Chế độ kiểm tra: ${mode.toUpperCase()}`);

  const client = new GameClient();

  client.on('dialog', (d) => console.log(`[DIALOG] ${d}`));

  client.on('park-chat', ({ idUser, text }) => {
    const time = new Date().toISOString().slice(11, 19);

    // 1. CÔ GIÁO TIẾNG ANH (Board chẵn - ID 2000000336)
    if (idUser === 2000000336) {
      console.log(`${time} 👩‍🏫 [CÔ ANH]: ${text}`);

      if (text.includes(' - ')) {
        const rawQ = text.split(' - ')[0].trim().toLowerCase();
        console.log(`\n🎯 [CÂU HỎI EN]: "${rawQ}"`);
        const ans = dictEn[rawQ];
        if (ans) {
          console.log(`⚡ [TRẢ LỜI EN]: "${ans}"`);
          client.chatPark(ans);
        } else {
          console.log(`⚠️ Chưa có trong từ điển EN: "${rawQ}"`);
        }
      }

      // Học từ mới khi cô công bố đáp án
      const matchAns = text.match(/Đáp án của câu hỏi\s+(.+?)\s+là\s+([a-zA-Z\s]+)/i);
      if (matchAns) {
        const q = matchAns[1].trim().toLowerCase();
        const a = matchAns[2].trim().toLowerCase();
        if (!dictEn[q]) {
          dictEn[q] = a;
          saveDictEn();
          console.log(`💡 [ĐÃ HỌC TỪ EN]: "${q}" -> "${a}" (Tổng: ${Object.keys(dictEn).length})`);
        }
      }

      if (text.includes('Chúc mừng bạn')) {
        console.log(`🏆 [THẮNG EN]: ${text}`);
      }
    }
    // 2. CÔ GIÁO TIẾNG VIỆT (Board lẻ - ID 2000000337)
    else if (idUser === 2000000337) {
      console.log(`${time} 👩‍🏫 [CÔ VIỆT]: ${text}`);

      if (text.includes('...')) {
        console.log(`\n🎯 [CÂU HỎI VN]: "${text}"`);
        const ans = findViAnswer(text);
        if (ans) {
          console.log(`⚡ [TRẢ LỜI VN]: "${ans}"`);
          client.chatPark(ans);
        } else {
          console.log(`⚠️ Chưa khớp câu tục ngữ nào trong DB!`);
        }
      }

      // Học đáp án VN khi cô công bố
      const matchAns = text.match(/Đáp án của câu hỏi\s+(.+?)\s+là\s+(.+)/i);
      if (matchAns) {
        const q = matchAns[1].trim().toLowerCase();
        const a = matchAns[2].trim().toLowerCase();
        console.log(`💡 [CÔNG BỐ ĐÁP ÁN VN]: "${q}" -> "${a}"`);
      }

      if (text.includes('Chúc mừng bạn')) {
        console.log(`🏆 [THẮNG VN]: ${text}`);
      }
    } else {
      // User chat
      console.log(`${time} 👤 [${idUser}]: ${text}`);
    }
  });

  console.log(`\nĐăng nhập ${account.gameUser}...`);
  await client.login({
    host: account.host,
    port: account.port,
    user: account.gameUser,
    pass: gamePass,
    device: account.device,
  });

  await new Promise<void>((resolve) => {
    client.on('status', (s) => s === 'online' && resolve());
  });
  console.log(`Online! Chờ vào Park...`);
  await sleep(1500);

  // Chuyển context Park
  await new Promise<void>((resolve) => {
    const onMsg = (msg: Message) => {
      if (msg.command === -1 && msg.getData()[0] === 9) {
        client.session.removeListener('message', onMsg);
        resolve();
      }
    };
    client.session.on('message', onMsg);
    client.enterParkContext();
  });

  // Chạy lớp Tiếng Anh (Board 0) nếu mode là 'en' hoặc 'both'
  if (mode === 'en' || mode === 'both') {
    console.log(`\n========================================`);
    console.log(`>>> VÀO MAP 6 BOARD 0 (LỚP TIẾNG ANH) <<<`);
    console.log(`========================================`);
    client.joinPark(6, 0);
    console.log(`Đang lắng nghe & trả lời tự động trong 40s...\n`);
    await sleep(40_000);
  }

  // Chạy lớp Tiếng Việt (Board 1) nếu mode là 'vi' hoặc 'both'
  if (mode === 'vi' || mode === 'both') {
    console.log(`\n========================================`);
    console.log(`>>> VÀO MAP 6 BOARD 1 (LỚP TIẾNG VIỆT) <<<`);
    console.log(`========================================`);
    client.joinPark(6, 1);
    console.log(`Đang lắng nghe & trả lời tự động trong 40s...\n`);
    await sleep(40_000);
  }

  console.log(`\nHoàn thành lượt test.`);
  client.logout();
  db.close();
}

main().catch(console.error);
