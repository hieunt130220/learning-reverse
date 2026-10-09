import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient } from '../game/client.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

interface CapturedChat {
  time: string;
  idUser: number;
  text: string;
  style: number;
  isTeacher: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSchoolProbe() {
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const accountId = 1;
  const account = getAccountById(db, accountId);
  if (!account) throw new Error(`Không tìm thấy account ID ${accountId}`);
  const gamePass = readGamePass(db, config.masterKey, accountId);
  if (!gamePass) throw new Error(`Không có game pass cho account ID ${accountId}`);

  const client = new GameClient();
  const capturedChats: CapturedChat[] = [];

  client.on('log', (msg) => {
    // Chỉ in log quan trọng
    if (msg.includes('chat') || msg.includes('85') || msg.includes('dialog')) {
      console.log(`[CLIENT LOG] ${msg}`);
    }
  });

  client.on('dialog', (text) => console.log(`[DIALOG] ${text}`));

  client.on('park-chat', ({ idUser, text, style }) => {
    const isTeacher = idUser === 2000000336 || idUser === 2000000337;
    const time = new Date().toISOString().slice(11, 19);
    capturedChats.push({ time, idUser, text, style, isTeacher });
    const tag = isTeacher ? '👩‍🏫 [CÔ GIÁO]' : '👤 [USER]';
    console.log(`${time} ${tag} (${idUser}): ${text}`);
  });

  client.on('message', (msg: Message) => {
    if (msg.command !== 85 && msg.command !== 84 && msg.command !== 80 && msg.command !== -1) {
      // Log các message đặc biệt
      console.log(`[RX MSG] cmd: ${msg.command}, len: ${msg.getData().length}`);
    }
  });

  console.log(`\n=== 1. ĐĂNG NHẬP GAME ACCOUNT ${account.gameUser} ===`);
  await client.login({
    host: account.host,
    port: account.port,
    user: account.gameUser,
    pass: gamePass,
    device: account.device,
  });

  // Chờ online
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Login timeout')), 10_000);
    client.on('status', (s) => {
      if (s === 'online') {
        clearTimeout(t);
        resolve();
      }
    });
  });
  console.log(`✅ Đã đăng nhập online!`);
  await sleep(2000);

  // 2. Chuyển context Park
  console.log(`\n=== 2. CHUYỂN CONTEXT PARK (GET_HANDLER 9) ===`);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Park handler timeout')), 6_000);
    const onMsg = (msg: Message) => {
      if (msg.command === -1) {
        const d = msg.getData();
        if (d.length > 0 && d[0] === 9) {
          clearTimeout(t);
          client.session.removeListener('message', onMsg);
          resolve();
        }
      }
    };
    client.session.on('message', onMsg);
    client.enterParkContext();
  });
  console.log(`✅ Đã vào Park Context!`);
  await sleep(2000);

  // 3. VÀO MAP 6 BOARD 0 (TIẾNG ANH)
  console.log(`\n=== 3. VÀO MAP 6 BOARD 0 (LỚP TIẾNG ANH) ===`);
  const pos = NATIVE_PARK_JOIN_POSITIONS[6];
  client.joinPark(6, 0);
  console.log(`Đã gửi joinPark(map 6, board 0, x=${pos.x}, y=${pos.y})`);
  console.log(`Đang lắng nghe trong 45 giây...`);

  const startTimeEnglish = Date.now();
  let hasTestedEnglishAnswer = false;
  while (Date.now() - startTimeEnglish < 45_000) {
    await sleep(2000);
    // Nếu bắt được câu hỏi từ cô giáo mà chưa thử trả lời
    const teacherMsgs = capturedChats.filter(c => c.idUser === 2000000336);
    if (teacherMsgs.length > 0 && !hasTestedEnglishAnswer) {
      const lastQ = teacherMsgs[teacherMsgs.length - 1];
      console.log(`\n[THỬ NGHIỆM TX 85] Nhận câu hỏi: "${lastQ.text}" -> Thử gửi chat "test"...`);
      client.chatPark('test');
      hasTestedEnglishAnswer = true;
    }
  }

  // 4. CHUYỂN SANG MAP 6 BOARD 1 (TIẾNG VIỆT)
  console.log(`\n=== 4. CHUYỂN SANG MAP 6 BOARD 1 (LỚP TIẾNG VIỆT) ===`);
  client.joinPark(6, 1);
  console.log(`Đã gửi joinPark(map 6, board 1, x=${pos.x}, y=${pos.y})`);
  console.log(`Đang lắng nghe trong 45 giây...`);

  const startTimeViet = Date.now();
  let hasTestedVietAnswer = false;
  while (Date.now() - startTimeViet < 45_000) {
    await sleep(2000);
    const teacherMsgs = capturedChats.filter(c => c.idUser === 2000000337);
    if (teacherMsgs.length > 0 && !hasTestedVietAnswer) {
      const lastQ = teacherMsgs[teacherMsgs.length - 1];
      console.log(`\n[THỬ NGHIỆM TX 85] Nhận câu hỏi: "${lastQ.text}" -> Thử gửi chat "test"...`);
      client.chatPark('test');
      hasTestedVietAnswer = true;
    }
  }

  console.log(`\n=== TỔNG KẾT BẮT ĐƯỢC ${capturedChats.length} TIN NHẮN ===`);
  console.table(capturedChats);

  client.logout();
  db.close();
}

runSchoolProbe().catch((err) => {
  console.error('[PROBE ERROR]', err);
  process.exit(1);
});
