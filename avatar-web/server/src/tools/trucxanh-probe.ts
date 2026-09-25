/**
 * Minigame Lật Hình Trúc Xanh Map 7 Probe Tool
 *
 * Spec: docs/superpowers/specs/2026-09-25-trucxanh-probe-design.md
 * Plan: docs/superpowers/plans/2026-09-25-trucxanh-probe.md
 *
 * Điều khiển qua opcode -90 (MINIGAME):
 *   TX -90 [1, 0]: Tham gia bàn Trúc Xanh (JOIN_TRUCXANH)
 *   TX -90 [1, 2, idCard]: Lật lá bài 0..23 (OPENCARD_TRUCXANH)
 *   TX -90 [1, 5]: Thoát bàn (OUTCARD_TRUCXANH)
 *
 * Chạy:
 *   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --account-id 1
 */

import { get as httpGet } from 'node:http';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient, type ClientStatus } from '../game/client.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

// ==========================================
// 1. CONSTANTS & WIRE PROTOCOL DEFINITIONS
// ==========================================

export const MINIGAME_CMD = -90;
export const GAME_ID_TRUCXANH = 1;

export const SUBCMD_JOIN = 0;
export const SUBCMD_START = 1;
export const SUBCMD_OPENCARD = 2;
export const SUBCMD_SETTURN = 3;
export const SUBCMD_ENDCARD = 4;
export const SUBCMD_OUTCARD = 5;

export type TrucXanhPacket =
  | { type: 'JOIN'; gameId: number; subAction: number; playerId: number; playerName: string; rawHex: string }
  | { type: 'START'; gameId: number; subAction: number; turn: number; isMyTurn: boolean; time: number; rawHex: string }
  | {
      type: 'OPENCARD';
      gameId: number;
      subAction: number;
      cardId: number;
      img: number;
      flag: number;
      isMatch?: boolean;
      cardId2?: number;
      score1?: number;
      score2?: number;
      rawHex: string;
    }
  | { type: 'SETTURN'; gameId: number; subAction: number; turn: number; isMyTurn: boolean; rawHex: string }
  | {
      type: 'ENDCARD';
      gameId: number;
      subAction: number;
      win: number;
      score1: number;
      score2: number;
      giftBoxId?: number;
      rawHex: string;
    }
  | { type: 'OUTCARD'; gameId: number; subAction: number; iddb: number; rawHex: string }
  | { type: 'UNKNOWN'; gameId: number; subAction: number; rawHex: string };

export function decodeTrucXanhPacket(body: Buffer): TrucXanhPacket {
  const r = new MyReader(body);
  const rawHex = body.toString('hex');
  const gameId = r.readByte();
  const subAction = r.readByte();

  if (gameId !== GAME_ID_TRUCXANH) {
    return { type: 'UNKNOWN', gameId, subAction, rawHex };
  }

  switch (subAction) {
    case SUBCMD_JOIN: {
      const playerId = r.readInt();
      const playerName = r.readUTF();
      return { type: 'JOIN', gameId, subAction, playerId, playerName, rawHex };
    }
    case SUBCMD_START: {
      const turn = r.readByte();
      const time = r.readByte();
      return { type: 'START', gameId, subAction, turn, isMyTurn: turn === 0, time, rawHex };
    }
    case SUBCMD_OPENCARD: {
      const cardId = r.readByte();
      const img = r.readInt();
      let flag = 0;
      let isMatch = false;
      let cardId2: number | undefined;
      let score1: number | undefined;
      let score2: number | undefined;

      if (r.available() > 0) {
        flag = r.readByte();
        if (flag === 1 && r.available() > 0) {
          isMatch = r.readBoolean();
          if (isMatch && r.available() >= 13) {
            cardId2 = r.readByte();
            r.readInt(); // img2 / unused
            score1 = r.readInt();
            score2 = r.readInt();
          }
        }
      }
      return {
        type: 'OPENCARD',
        gameId,
        subAction,
        cardId,
        img,
        flag,
        isMatch,
        cardId2,
        score1,
        score2,
        rawHex,
      };
    }
    case SUBCMD_SETTURN: {
      const turn = r.readByte();
      return { type: 'SETTURN', gameId, subAction, turn, isMyTurn: turn === 0, rawHex };
    }
    case SUBCMD_ENDCARD: {
      const win = r.readByte();
      const score1 = r.readInt();
      const score2 = r.readInt();
      let giftBoxId: number | undefined;
      if (r.available() >= 2) {
        giftBoxId = r.readShort();
      }
      return { type: 'ENDCARD', gameId, subAction, win, score1, score2, giftBoxId, rawHex };
    }
    case SUBCMD_OUTCARD: {
      const iddb = r.available() > 0 ? r.readByte() : -1;
      return { type: 'OUTCARD', gameId, subAction, iddb, rawHex };
    }
    default:
      return { type: 'UNKNOWN', gameId, subAction, rawHex };
  }
}

export function sendJoinGame(client: GameClient): void {
  const m = Message.create(MINIGAME_CMD);
  m.writer!.writeByte(GAME_ID_TRUCXANH).writeByte(SUBCMD_JOIN);
  client.session.send(m);
}

export function sendOpenCard(client: GameClient, cardId: number): void {
  const m = Message.create(MINIGAME_CMD);
  m.writer!.writeByte(GAME_ID_TRUCXANH).writeByte(SUBCMD_OPENCARD).writeByte(cardId);
  client.session.send(m);
}

export function sendOutGame(client: GameClient): void {
  const m = Message.create(MINIGAME_CMD);
  m.writer!.writeByte(GAME_ID_TRUCXANH).writeByte(SUBCMD_OUTCARD);
  client.session.send(m);
}

// ==========================================
// 2. PERFECT MEMORY SOLVER
// ==========================================

export class TrucXanhMemory {
  readonly cardImages = new Map<number, number>(); // cardId -> imgId
  readonly removedCards = new Set<number>();
  readonly totalCards = 24; // lưới 6 x 4

  recordCard(cardId: number, imgId: number): void {
    this.cardImages.set(cardId, imgId);
  }

  markRemoved(c1: number, c2: number): void {
    this.removedCards.add(c1);
    this.removedCards.add(c2);
  }

  isRemoved(cardId: number): boolean {
    return this.removedCards.has(cardId);
  }

  findKnownPair(): [number, number] | null {
    const imgToCards = new Map<number, number[]>();
    for (const [cId, img] of this.cardImages.entries()) {
      if (this.isRemoved(cId)) continue;
      const list = imgToCards.get(img) ?? [];
      list.push(cId);
      imgToCards.set(img, list);
      if (list.length >= 2) {
        return [list[0], list[1]];
      }
    }
    return null;
  }

  findMatchFor(cardId: number, img: number): number | null {
    for (const [cId, existingImg] of this.cardImages.entries()) {
      if (cId !== cardId && existingImg === img && !this.isRemoved(cId)) {
        return cId;
      }
    }
    return null;
  }

  pickUnknownCard(excludeCard?: number): number | null {
    const candidates: number[] = [];
    for (let i = 0; i < this.totalCards; i++) {
      if (i === excludeCard) continue;
      if (!this.isRemoved(i) && !this.cardImages.has(i)) {
        candidates.push(i);
      }
    }
    if (candidates.length > 0) {
      return candidates[0]; // chọn theo thứ tự ô từ 0..23
    }
    // Fallback: thẻ chưa removed và khác excludeCard
    for (let i = 0; i < this.totalCards; i++) {
      if (i === excludeCard) continue;
      if (!this.isRemoved(i)) return i;
    }
    return null;
  }
}

// ==========================================
// 3. FULL GAME CONTROLLER & RUNNER
// ==========================================

export class TrucXanhGameRunner {
  readonly memory = new TrucXanhMemory();
  isMyTurn = false;
  isPlaying = false;
  turnCount = 0;
  matchCount = 0;

  private turnLock = false;
  private pendingCardResolvers: Array<{
    cardId: number;
    resolve: (pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>) => void;
  }> = [];

  constructor(
    private readonly client: GameClient,
    private readonly delayMs: number,
  ) {}

  onOpenCardPacket(pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>): void {
    this.memory.recordCard(pkt.cardId, pkt.img);
    if (pkt.isMatch && pkt.cardId2 !== undefined) {
      this.matchCount++;
      this.memory.markRemoved(pkt.cardId, pkt.cardId2);
      console.log(`✨ [GHÉP ĐÚNG CẶP #${this.matchCount}] Ô #${pkt.cardId} & #${pkt.cardId2} (Hình #${pkt.img})! Điểm: Bạn=${pkt.score1 ?? '?'}, Đối thủ=${pkt.score2 ?? '?'}`);
    } else {
      console.log(`🃏 [MỞ THẺ] Ô #${pkt.cardId} -> Hình #${pkt.img}`);
    }

    // Resolve pending flip
    const idx = this.pendingCardResolvers.findIndex((r) => r.cardId === pkt.cardId);
    if (idx !== -1) {
      const resolver = this.pendingCardResolvers[idx];
      this.pendingCardResolvers.splice(idx, 1);
      resolver.resolve(pkt);
    }
  }

  async handlePacket(pkt: TrucXanhPacket): Promise<boolean> {
    switch (pkt.type) {
      case 'JOIN':
        console.log(`👤 [BÀN CHƠI] Người chơi trên bàn: ${pkt.playerName} (ID: ${pkt.playerId})`);
        break;

      case 'START':
        this.isPlaying = true;
        this.isMyTurn = pkt.isMyTurn;
        console.log(`\n🎮 [BẮT ĐẦU VÁN ĐẤU] Lượt đầu: ${this.isMyTurn ? 'CỦA BẠN' : 'ĐỐI THỦ'} | Thời gian lượt: ${pkt.time}s`);
        if (this.isMyTurn) {
          void this.scheduleTurn();
        }
        break;

      case 'OPENCARD':
        this.onOpenCardPacket(pkt);
        // Nếu vừa ghép đúng và vẫn là lượt của mình, tiếp tục đánh
        if (pkt.isMatch && this.isMyTurn && this.isPlaying) {
          void this.scheduleTurn();
        }
        break;

      case 'SETTURN':
        this.isMyTurn = pkt.isMyTurn;
        console.log(`🔄 [ĐỔI LƯỢT] Quyền đi tiếp theo: ${this.isMyTurn ? '👉 CỦA BẠN' : '⏳ ĐỐI THỦ'}`);
        if (this.isMyTurn && this.isPlaying) {
          void this.scheduleTurn();
        }
        break;

      case 'ENDCARD':
        this.isPlaying = false;
        const winLabel = pkt.win === 1 ? '🏆 CHIẾN THẮNG' : pkt.win === 2 ? '❌ THẤT BẠI' : '🤝 HÒA';
        console.log(`\n=================== TỔNG KẾT VÁN ĐẤU ===================`);
        console.log(`Kết quả: ${winLabel} (mã: ${pkt.win})`);
        console.log(`Điểm số: Bạn = ${pkt.score1} | Đối thủ = ${pkt.score2}`);
        console.log(`Số cặp ghép đúng: ${this.matchCount}/12 cặp`);
        if (pkt.giftBoxId !== undefined && pkt.giftBoxId !== -1) {
          console.log(`🎁 Hộp quà phần thưởng: ID #${pkt.giftBoxId}`);
        }
        console.log(`========================================================\n`);
        return true;

      case 'OUTCARD':
        console.log(`🚪 [RỜI BÀN] Người chơi (iddb=${pkt.iddb}) đã rời bàn`);
        break;
    }

    return false;
  }

  private async scheduleTurn(): Promise<void> {
    if (this.turnLock) return;
    this.turnLock = true;
    try {
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (!this.isPlaying || !this.isMyTurn) return;
      this.turnCount++;
      console.log(`\n👉 --- [LƯỢT #${this.turnCount}] ĐẾN LƯỢT BẠN ĐI ---`);

      // 1. Kiểm tra cặp thẻ đã biết trong bộ nhớ
      const pair = this.memory.findKnownPair();
      if (pair) {
        console.log(`🧠 [PERFECT MEMORY] Đã nhớ cặp giống nhau: Ô #${pair[0]} và Ô #${pair[1]}! Lật ngay!`);
        await this.flipCard(pair[0]);
        await new Promise((r) => setTimeout(r, this.delayMs));
        await this.flipCard(pair[1]);
        return;
      }

      // 2. Chưa có cặp biết trước -> Lật thăm dò thẻ 1
      const card1 = this.memory.pickUnknownCard();
      if (card1 === null) {
        console.log('⚠️ Không còn thẻ nào khả dụng trên bàn');
        return;
      }

      console.log(`🔍 [THĂM DÒ] Lật thẻ thứ 1: Ô #${card1}`);
      const opened1 = await this.flipCard(card1);
      await new Promise((r) => setTimeout(r, this.delayMs));

      // 3. Sau khi thẻ 1 mở ra, kiểm tra xem hình này đã từng xuất hiện ở ô khác chưa
      const matchCard = this.memory.findMatchFor(card1, opened1.img);
      if (matchCard !== null) {
        console.log(`🎯 [TRÚNG CẶP] Thẻ 1 (Hình #${opened1.img}) khớp với Ô #${matchCard} đã nhớ! Lật thẻ 2!`);
        await this.flipCard(matchCard);
        return;
      }

      // 4. Nếu chưa từng thấy hình này, lật thăm dò tiếp thẻ 2
      const card2 = this.memory.pickUnknownCard(card1);
      if (card2 === null) {
        console.log('⚠️ Không tìm được thẻ thứ 2 hợp lệ');
        return;
      }

      console.log(`🔍 [THĂM DÒ] Lật thẻ thứ 2: Ô #${card2}`);
      await this.flipCard(card2);
    } catch (err) {
      console.error(`❌ Lỗi thực thi lượt: ${(err as Error).message}`);
    } finally {
      this.turnLock = false;
    }
  }

  private flipCard(cardId: number, timeoutMs = 7000): Promise<Extract<TrucXanhPacket, { type: 'OPENCARD' }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingCardResolvers.findIndex((r) => r.cardId === cardId);
        if (idx !== -1) this.pendingCardResolvers.splice(idx, 1);
        reject(new Error(`Hết giờ chờ phản hồi lật thẻ #${cardId}`));
      }, timeoutMs);

      this.pendingCardResolvers.push({
        cardId,
        resolve: (pkt) => {
          clearTimeout(timer);
          resolve(pkt);
        },
      });

      sendOpenCard(this.client, cardId);
    });
  }
}

// ==========================================
// 4. MAIN PROBE RUNNER
// ==========================================

export interface TrucXanhProbeArgs {
  accountId: number;
  accountId2?: number;
  delayMs: number;
  timeoutSec: number;
}

export function parseArgs(argv: string[]): TrucXanhProbeArgs {
  let accountId = 1;
  let accountId2: number | undefined;
  let delayMs = 900;
  let timeoutSec = 180;

  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--account-id' && val) accountId = Number(val);
    if (key === '--account-id-2' && val) accountId2 = Number(val);
    if (key === '--delay' && val) delayMs = Number(val);
    if (key === '--timeout' && val) timeoutSec = Number(val);
  }

  return { accountId, accountId2, delayMs, timeoutSec };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = httpGet(`http://127.0.0.1:${port}/api/health`, () => {
      reject(new Error(`avatar-web đang chạy trên port ${port}. Hãy dừng service trước.`));
    });
    req.on('error', () => resolve());
    req.setTimeout(500, () => {
      req.destroy();
      resolve();
    });
  });
}

async function loginWithTimeout(
  client: GameClient,
  options: Parameters<GameClient['login']>[0],
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        client.logout();
      } finally {
        reject(new Error('Hết giờ kết nối hoặc đăng nhập game'));
      }
    }, timeoutMs);
  });

  try {
    const login = client.login(options);
    await Promise.race([login, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(new Error(`Game client không online (status=${client.status})`));
  }

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      client.removeListener('status', onStatus);
    };
    const onStatus = (status: ClientStatus): void => {
      if (status === 'online') {
        cleanup();
        resolve();
      } else if (status === 'error' || status === 'idle') {
        cleanup();
        reject(new Error(`Game client không online (status=${status})`));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Hết giờ chờ game client online'));
    }, timeoutMs);
    client.on('status', onStatus);
  });
}

function waitForParkHandlerResponse(client: GameClient, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length === 1 && body.readInt8(0) === 9) {
        finishResolve();
      }
    };
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ ACK handler Park (RX -1 [9])'));
    }, timeoutMs);
  });
}

function waitForParkJoinResponse(
  client: GameClient,
  timeoutMs: number,
  expectedMap: number,
  expectedBoard: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 80) {
        const reader = new MyReader(msg.getData());
        if (reader.available() >= 2) {
          const roomId = reader.readByte();
          const boardId = reader.readByte();
          if (roomId === expectedMap && boardId === expectedBoard) {
            finishResolve();
          }
        }
      }
    };
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ phản hồi vào khu (RX 80)'));
    }, timeoutMs);
  });
}

async function preparePlayerInMap7(
  client: GameClient,
  account: { host: string; port: number; gameUser: string; device?: unknown },
  gamePass: string,
): Promise<void> {
  // 1. Login
  console.log(`[LOGIN] Đang kết nối tài khoản ${account.gameUser}...`);
  await loginWithTimeout(
    client,
    {
      host: account.host,
      port: account.port,
      user: account.gameUser,
      pass: gamePass,
      device: account.device as never,
    },
    12_000,
  );
  await waitUntilOnline(client, 10_000);
  console.log(`[LOGIN] Đăng nhập thành công tài khoản ${account.gameUser}!`);

  // 2. Chuyển context Park
  console.log('[PARK] Đang chuyển sang Park context (TX -1 [9])...');
  const parkAck = waitForParkHandlerResponse(client, 5_000);
  client.enterParkContext();
  await parkAck;

  // 3. Gia nhập Map 7 Khu 0
  const pos = NATIVE_PARK_JOIN_POSITIONS[7] ?? { x: 524, y: 423 };
  console.log(`[MAP 7] Vào Map 7 Khu 0 (tọa độ native ${pos.x}, ${pos.y})...`);
  const joinParkAck = waitForParkJoinResponse(client, 5_000, 7, 0);
  client.sendRaw(80, [
    { t: 'i8', v: '7' },
    { t: 'i8', v: '0' },
    { t: 'i16', v: String(pos.x) },
    { t: 'i16', v: String(pos.y) },
  ]);
  await joinParkAck;
  console.log('[MAP 7] Đã vào Map 7 Khu 0 thành công!');
}

export async function runTrucXanhProbe(args: TrucXanhProbeArgs): Promise<void> {
  const config = loadConfig();
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  const client1 = new GameClient();
  let client2: GameClient | undefined;

  const account1 = getAccountById(db, args.accountId);
  if (!account1) throw new Error(`Không tìm thấy tài khoản #${args.accountId}`);
  const pass1 = readGamePass(db, config.masterKey, args.accountId);
  if (!pass1) throw new Error(`Tài khoản #${args.accountId} thiếu mật khẩu`);

  try {
    await preparePlayerInMap7(client1, account1, pass1);

    if (args.accountId2) {
      const account2 = getAccountById(db, args.accountId2);
      if (!account2) throw new Error(`Không tìm thấy tài khoản #${args.accountId2}`);
      const pass2 = readGamePass(db, config.masterKey, args.accountId2);
      if (!pass2) throw new Error(`Tài khoản #${args.accountId2} thiếu mật khẩu`);

      client2 = new GameClient();
      console.log('\n--- Chuẩn bị tài khoản 2 đối kháng ---');
      await preparePlayerInMap7(client2, account2, pass2);
    }

    // Khởi tạo Runner cho Client 1
    const runner = new TrucXanhGameRunner(client1, args.delayMs);
    let gameFinished = false;

    // Lắng nghe RX -90 trên client 1
    client1.session.on('message', (msg: Message) => {
      if (msg.command !== MINIGAME_CMD) return;
      const body = msg.getData();
      const pkt = decodeTrucXanhPacket(body);
      void runner.handlePacket(pkt).then((done) => {
        if (done) gameFinished = true;
      });
    });

    // Nếu có client 2, lắng nghe log từ client 2 và tự động gửi JOIN
    if (client2) {
      client2.session.on('message', (msg: Message) => {
        if (msg.command !== MINIGAME_CMD) return;
        const body = msg.getData();
        const pkt = decodeTrucXanhPacket(body);
        if (pkt.type === 'START') {
          console.log(`[P2] Bắt đầu ván! Lượt P2: ${pkt.isMyTurn}`);
        }
      });
    }

    // Tham gia bàn Trúc Xanh
    console.log('\n======================================================');
    console.log('🎲 [TRÚC XANH] Gửi TX -90 [1, 0] tham gia bàn chơi...');
    console.log('======================================================');
    sendJoinGame(client1);

    if (client2) {
      await new Promise((r) => setTimeout(r, 1000));
      console.log('🎲 [TRÚC XANH P2] Gửi TX -90 [1, 0] tham gia bàn chơi...');
      sendJoinGame(client2);
    }

    // Chờ ván đấu hoàn thành hoặc timeout
    const startTime = Date.now();
    const maxMs = args.timeoutSec * 1000;

    while (!gameFinished && Date.now() - startTime < maxMs) {
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!gameFinished) {
      console.log(`\n⏳ Hết thời gian chờ ván đấu (${args.timeoutSec}s)`);
    }

    // Rời bàn chơi an toàn
    console.log('🚪 Gửi TX -90 [1, 5] rời bàn chơi...');
    sendOutGame(client1);
    if (client2) sendOutGame(client2);
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    try {
      client1.logout();
    } catch {
      // ignore
    }
    if (client2) {
      try {
        client2.logout();
      } catch {
        // ignore
      }
    }
  }
}

// ==========================================
// 5. CLI ENTRY POINT
// ==========================================

const isDirectCli = process.argv[1]?.endsWith('trucxanh-probe.ts');
if (isDirectCli) {
  const args = parseArgs(process.argv.slice(2));
  runTrucXanhProbe(args).catch((err) => {
    console.error('\n❌ PROBE THẤT BẠI:', (err as Error).message);
    process.exit(1);
  });
}
