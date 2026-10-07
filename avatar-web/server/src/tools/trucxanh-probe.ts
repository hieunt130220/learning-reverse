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
 * Chạy 1 tài khoản (solo/chờ đối thủ):
 *   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --account-id 1
 *
 * Chạy 2 tài khoản chơi cùng nhau (co-op chia sẻ trí nhớ):
 *   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --two-players
 *   hoặc:
 *   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --account-id 1 --account-id-2 2
 *
 * Chơi nhiều ván liên tiếp:
 *   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --two-players --rounds 5
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
  | { type: 'JOIN'; gameId: number; subAction: number; playerId: number; playerName: string; rawBuffer: Buffer; rawHex: string }
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

export function findMyPositionInJoin(body: Buffer, myPlayerId?: number, myName?: string): number {
  if (body.length >= 6 && typeof myPlayerId === 'number' && myPlayerId > 0) {
    const player0Id = body.readInt32BE(2);
    return player0Id === myPlayerId ? 0 : 1;
  }
  if (body.length >= 8 && myName) {
    try {
      const name0Len = body.readUInt16BE(6);
      if (name0Len > 0 && name0Len <= 50 && body.length >= 8 + name0Len) {
        const name0 = body.subarray(8, 8 + name0Len).toString('utf8');
        if (name0.toLowerCase() === myName.toLowerCase()) {
          return 0;
        }
        return 1;
      }
    } catch {
      // fallback
    }
  }
  return 0;
}

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
      return { type: 'JOIN', gameId, subAction, playerId, playerName, rawBuffer: body, rawHex };
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

  reset(): void {
    this.cardImages.clear();
    this.removedCards.clear();
  }

  findKnownDifferentCard(excludeCardId: number, diffImg: number): number | null {
    for (const [cId, img] of this.cardImages.entries()) {
      if (cId !== excludeCardId && img !== diffImg && !this.isRemoved(cId)) {
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
  readonly memory: TrucXanhMemory;
  isMyTurn = false;
  isPlaying = false;
  turnCount = 0;
  matchCount = 0;
  myPos = 0; // 0 hoặc 1

  private turnLock = false;
  private pendingCardResolvers: Array<{
    cardId: number;
    resolve: (pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(
    private readonly client: GameClient,
    private readonly delayMs: number,
    private readonly username: string = '',
    memory?: TrucXanhMemory,
    readonly tag: string = 'P1',
    readonly role: 'winner' | 'feeder' = 'winner',
  ) {
    this.memory = memory ?? new TrucXanhMemory();
  }

  reset(): void {
    this.isMyTurn = false;
    this.isPlaying = false;
    this.turnCount = 0;
    this.matchCount = 0;
    this.myPos = 0;
    this.turnLock = false;
    for (const resolver of this.pendingCardResolvers) {
      clearTimeout(resolver.timer);
    }
    this.pendingCardResolvers = [];
  }

  onOpenCardPacket(pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>): void {
    this.memory.recordCard(pkt.cardId, pkt.img);
    if (pkt.isMatch && pkt.cardId2 !== undefined && pkt.cardId2 >= 0) {
      this.matchCount++;
      this.memory.markRemoved(pkt.cardId, pkt.cardId2);
      console.log(`✨ [${this.tag} GHÉP ĐÚNG CẶP #${this.matchCount}] Ô #${pkt.cardId} & #${pkt.cardId2} (Hình #${pkt.img})! Điểm: Bạn=${pkt.score1 ?? '?'}, Đối thủ=${pkt.score2 ?? '?'}`);
    } else if (!pkt.isMatch) {
      console.log(`🃏 [${this.tag} MỞ THẺ] Ô #${pkt.cardId} -> Hình #${pkt.img}`);
    }

    // Resolve pending flip
    const idx = this.pendingCardResolvers.findIndex((r) => r.cardId === pkt.cardId);
    if (idx !== -1) {
      const resolver = this.pendingCardResolvers[idx];
      this.pendingCardResolvers.splice(idx, 1);
      clearTimeout(resolver.timer);
      resolver.resolve(pkt);
    }
  }

  async handlePacket(pkt: TrucXanhPacket): Promise<boolean> {
    switch (pkt.type) {
      case 'JOIN':
        if (pkt.rawBuffer) {
          this.myPos = findMyPositionInJoin(pkt.rawBuffer, this.client.playerId, this.username);
        }
        console.log(`👤 [${this.tag} BÀN CHƠI] Người chơi trên bàn: ${pkt.playerName} (ID: ${pkt.playerId}) | Vị trí của bạn: Player #${this.myPos}`);
        break;

      case 'START':
        this.isPlaying = true;
        this.isMyTurn = pkt.turn === this.myPos;
        console.log(`\n🎮 [${this.tag} BẮT ĐẦU VÁN ĐẤU] Lượt đầu: ${this.isMyTurn ? '👉 CỦA BẠN' : '⏳ ĐỐI THỦ'} (Turn #${pkt.turn}, myPos #${this.myPos}) | Thời gian lượt: ${pkt.time}s`);
        if (this.isMyTurn) {
          void this.executeTurn();
        }
        break;

      case 'OPENCARD':
        this.onOpenCardPacket(pkt);
        break;

      case 'SETTURN':
        this.isMyTurn = pkt.turn === this.myPos;
        console.log(`🔄 [${this.tag} ĐỔI LƯỢT] Quyền đi tiếp theo: ${this.isMyTurn ? '👉 CỦA BẠN' : '⏳ ĐỐI THỦ'} (Turn #${pkt.turn}, myPos #${this.myPos})`);
        if (this.isMyTurn && this.isPlaying) {
          void this.executeTurn();
        }
        break;

      case 'ENDCARD': {
        this.isPlaying = false;
        this.isMyTurn = false;
        for (const resolver of this.pendingCardResolvers) {
          clearTimeout(resolver.timer);
          resolver.reject(new Error('Ván đấu đã kết thúc'));
        }
        this.pendingCardResolvers = [];
        const isWin = pkt.win === (this.myPos === 0 ? 1 : 2);
        const isDraw = pkt.win === 0;
        const winLabel = isDraw ? '🤝 HÒA' : isWin ? '🏆 CHIẾN THẮNG' : '❌ THẤT BẠI';
        const myScore = this.myPos === 0 ? pkt.score1 : pkt.score2;
        const oppScore = this.myPos === 0 ? pkt.score2 : pkt.score1;
        console.log(`\n=================== TỔNG KẾT VÁN ĐẤU [${this.tag}] ===================`);
        console.log(`Kết quả: ${winLabel} (mã server: ${pkt.win}, myPos: ${this.myPos})`);
        console.log(`Điểm số: Bạn = ${myScore} | Đối thủ = ${oppScore}`);
        console.log(`Số cặp ghép đúng trong ván: ${this.matchCount}/12 cặp`);
        if (pkt.giftBoxId !== undefined && pkt.giftBoxId !== -1) {
          console.log(`🎁 Hộp quà phần thưởng: ID #${pkt.giftBoxId}`);
        }
        console.log(`========================================================\n`);
        return true;
      }

      case 'OUTCARD':
        console.log(`🚪 [${this.tag} RỜI BÀN] Người chơi (iddb=${pkt.iddb}) đã rời bàn`);
        break;
    }

    return false;
  }

  private async executeTurn(): Promise<void> {
    if (this.turnLock || !this.isPlaying || !this.isMyTurn) return;
    this.turnLock = true;
    try {
      if (this.role === 'feeder') {
        await this.executeFeederTurn();
      } else {
        await this.executeWinnerTurn();
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes('kết thúc')) {
        console.error(`❌ [${this.tag}] Lỗi thực thi lượt (${this.role}): ${msg}`);
      }
    } finally {
      this.turnLock = false;
    }
  }

  private async executeWinnerTurn(): Promise<void> {
    while (this.isPlaying && this.isMyTurn) {
      this.turnCount++;
      console.log(`\n👉 --- [${this.tag} LƯỢT #${this.turnCount}] ĐẾN LƯỢT BẠN ĐI ---`);
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (!this.isPlaying || !this.isMyTurn) break;

      // 1. Kiểm tra cặp thẻ đã biết trong bộ nhớ
      const pair = this.memory.findKnownPair();
      if (pair) {
        console.log(`🧠 [${this.tag} PERFECT MEMORY] Đã nhớ cặp giống nhau: Ô #${pair[0]} và Ô #${pair[1]}! Lật ngay!`);
        await this.flipCard(pair[0]);
        await new Promise((r) => setTimeout(r, this.delayMs));
        if (!this.isPlaying) break;
        const opened2 = await this.flipCard(pair[1]);
        if (!opened2.isMatch) break;
        continue; // Ghép đúng -> Giữ lượt, tiếp tục vòng lặp!
      }

      // 2. Chưa có cặp biết trước -> Lật thăm dò thẻ 1
      const card1 = this.memory.pickUnknownCard();
      if (card1 === null) {
        console.log(`⚠️ [${this.tag}] Không còn thẻ nào khả dụng trên bàn`);
        break;
      }

      console.log(`🔍 [${this.tag} THĂM DÒ] Lật thẻ thứ 1: Ô #${card1}`);
      const opened1 = await this.flipCard(card1);
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (!this.isPlaying) break;

      // 3. Sau khi thẻ 1 mở ra, kiểm tra xem hình này đã từng xuất hiện ở ô khác chưa
      const matchCard = this.memory.findMatchFor(card1, opened1.img);
      if (matchCard !== null) {
        console.log(`🎯 [${this.tag} TRÚNG CẶP] Thẻ 1 (Hình #${opened1.img}) khớp với Ô #${matchCard} đã nhớ! Lật thẻ 2!`);
        const opened2 = await this.flipCard(matchCard);
        if (!opened2.isMatch) break;
        continue; // Ghép đúng -> Giữ lượt, tiếp tục vòng lặp!
      }

      // 4. Nếu chưa từng thấy hình này, lật thăm dò tiếp thẻ 2
      const card2 = this.memory.pickUnknownCard(card1);
      if (card2 === null) {
        console.log(`⚠️ [${this.tag}] Không tìm được thẻ thứ 2 hợp lệ`);
        break;
      }

      console.log(`🔍 [${this.tag} THĂM DÒ] Lật thẻ thứ 2: Ô #${card2}`);
      const opened2 = await this.flipCard(card2);
      if (!opened2.isMatch) break;
      // Nếu ngẫu nhiên trúng cặp, continue tiếp tục lượt
    }
  }

  private async executeFeederTurn(): Promise<void> {
    while (this.isPlaying && this.isMyTurn) {
      this.turnCount++;
      console.log(`\n👉 --- [${this.tag} FEEDER LƯỢT #${this.turnCount}] ĐẾN LƯỢT P2 (NHƯỜNG ĐIỂM) ---`);
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (!this.isPlaying || !this.isMyTurn) break;

      // 1. Thẻ 1: Mở ô chưa biết để lấy thông tin hình ảnh cho P1
      let card1 = this.memory.pickUnknownCard();
      if (card1 === null) {
        // Nếu toàn bộ ô đều đã biết hình, chọn ô bất kỳ chưa bị removed
        for (let i = 0; i < this.memory.totalCards; i++) {
          if (!this.memory.isRemoved(i)) {
            card1 = i;
            break;
          }
        }
      }
      if (card1 === null) {
        console.log(`⚠️ [${this.tag} FEEDER] Không còn thẻ nào khả dụng trên bàn`);
        break;
      }

      console.log(`🔍 [${this.tag} FEEDER] Mở thăm dò thẻ 1: Ô #${card1}`);
      const opened1 = await this.flipCard(card1);
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (!this.isPlaying) break;

      // 2. Thẻ 2: Tìm thẻ CỐ TÌNH KHÁC HÌNH để trượt điểm 100%
      let card2 = this.memory.findKnownDifferentCard(card1, opened1.img);
      if (card2 === null) {
        // Chưa có thẻ nào khác hình được biết (chỉ xảy ra ở lượt đầu tiên)
        card2 = this.memory.pickUnknownCard(card1);
      }
      if (card2 === null) {
        for (let i = 0; i < this.memory.totalCards; i++) {
          if (i !== card1 && !this.memory.isRemoved(i)) {
            card2 = i;
            break;
          }
        }
      }
      if (card2 === null) {
        console.log(`⚠️ [${this.tag} FEEDER] Không tìm được thẻ thứ 2 hợp lệ`);
        break;
      }

      console.log(`🎯 [${this.tag} FEEDER] Chọn thẻ 2 lệch hình để nhường lượt: Ô #${card2}`);
      const opened2 = await this.flipCard(card2);
      if (!opened2.isMatch) {
        console.log(`✅ [${this.tag} FEEDER] Đã cố tình trượt cặp thành công! Chuyển lượt về cho P1.`);
        break; // Trượt cặp thành công -> Chuyển lượt về cho P1
      }
      // Nếu ngẫu nhiên trùng ở lượt 1, tiếp tục vòng lặp nhường
    }
  }

  private flipCard(cardId: number, timeoutMs = 7000): Promise<Extract<TrucXanhPacket, { type: 'OPENCARD' }>> {
    return new Promise((resolve, reject) => {
      if (!this.isPlaying || !this.isMyTurn) {
        reject(new Error('Ván đấu hoặc lượt đi đã kết thúc'));
        return;
      }
      const entry: {
        cardId: number;
        resolve: (pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>) => void;
        reject: (err: Error) => void;
        timer: NodeJS.Timeout;
      } = {
        cardId,
        resolve: (pkt) => {
          clearTimeout(entry.timer);
          resolve(pkt);
        },
        reject,
        timer: setTimeout(() => {
          const idx = this.pendingCardResolvers.findIndex((r) => r.cardId === cardId);
          if (idx !== -1) this.pendingCardResolvers.splice(idx, 1);
          reject(new Error(`[${this.tag}] Hết giờ chờ phản hồi lật thẻ #${cardId}`));
        }, timeoutMs),
      };

      this.pendingCardResolvers.push(entry);
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
  twoPlayers?: boolean;
  delayMs: number;
  timeoutSec: number;
  zone: number;
  rounds: number;
}

export function parseArgs(argv: string[]): TrucXanhProbeArgs {
  let accountId = 1;
  let accountId2: number | undefined;
  let twoPlayers = false;
  let delayMs = 900;
  let timeoutSec = 300;
  let customZone: number | undefined;
  let rounds = 1;

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const nextVal = argv[i + 1];

    if (key === '--two-players' || key === '-2' || key === '--coop' || key === '--both') {
      twoPlayers = true;
    } else if ((key === '--account-id' || key === '-a') && nextVal) {
      accountId = Number(nextVal);
      i++;
    } else if ((key === '--account-id-2' || key === '--p2') && nextVal) {
      accountId2 = Number(nextVal);
      twoPlayers = true;
      i++;
    } else if ((key === '--zone' || key === '-z') && nextVal) {
      customZone = Number(nextVal);
      i++;
    } else if ((key === '--delay' || key === '-d') && nextVal) {
      delayMs = Number(nextVal);
      i++;
    } else if ((key === '--timeout' || key === '-t') && nextVal) {
      timeoutSec = Number(nextVal);
      i++;
    } else if ((key === '--rounds' || key === '-r') && nextVal) {
      rounds = Math.max(1, Number(nextVal));
      i++;
    }
  }

  if (twoPlayers && !accountId2) {
    accountId2 = accountId === 1 ? 2 : 1;
  }

  const zone = customZone ?? (twoPlayers ? 15 : 0);

  return { accountId, accountId2, twoPlayers, delayMs, timeoutSec, zone, rounds };
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
  zone: number = 0,
): Promise<void> {
  client.on('log', (msg) => console.log(`[CLIENT LOG] ${msg}`));
  client.on('dialog', (dlg: { text: string }) => console.log(`[CLIENT DIALOG] ${dlg.text}`));

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

  // 3. Gia nhập Map 7 Khu `zone`
  const pos = NATIVE_PARK_JOIN_POSITIONS[7] ?? { x: 524, y: 423 };
  console.log(`[MAP 7] Vào Map 7 Khu ${zone} (tọa độ native ${pos.x}, ${pos.y})...`);
  const joinParkAck = waitForParkJoinResponse(client, 5_000, 7, zone);
  client.sendRaw(80, [
    { t: 'i8', v: '7' },
    { t: 'i8', v: String(zone) },
    { t: 'i16', v: String(pos.x) },
    { t: 'i16', v: String(pos.y) },
  ]);
  await joinParkAck;
  console.log(`[MAP 7] Đã vào Map 7 Khu ${zone} thành công!`);
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

  let account2: ReturnType<typeof getAccountById> | undefined;
  let pass2: string | undefined;

  if (args.accountId2) {
    account2 = getAccountById(db, args.accountId2);
    if (!account2) throw new Error(`Không tìm thấy tài khoản 2 #${args.accountId2}`);
    pass2 = readGamePass(db, config.masterKey, args.accountId2);
    if (!pass2) throw new Error(`Tài khoản 2 #${args.accountId2} thiếu mật khẩu`);
    client2 = new GameClient();
  }

  try {
    console.log(`\n=================== CHUẨN BỊ TÀI KHOẢN 1 (#${args.accountId} - ${account1.gameUser}) ===================`);
    await preparePlayerInMap7(client1, account1, pass1, args.zone);

    if (client2 && account2 && pass2) {
      console.log(`\n=================== CHUẨN BỊ TÀI KHOẢN 2 (#${args.accountId2} - ${account2.gameUser}) ===================`);
      await preparePlayerInMap7(client2, account2, pass2, args.zone);
    }

    // Khởi tạo Bộ nhớ chung & Runner cho các người chơi (P1 Winner ăn điểm, P2 Feeder nhường điểm)
    const sharedMemory = new TrucXanhMemory();
    const runner1 = new TrucXanhGameRunner(client1, args.delayMs, account1.gameUser, sharedMemory, 'P1', 'winner');
    let runner2: TrucXanhGameRunner | undefined;
    if (client2 && account2) {
      runner2 = new TrucXanhGameRunner(client2, args.delayMs, account2.gameUser, sharedMemory, 'P2', 'feeder');
    }

    let gameFinished = false;
    const roundStats: Array<{ round: number; p1Score: number; p2Score: number; p1Win: boolean; timedOut: boolean }> = [];

    // Lắng nghe tất cả RX trên client 1
    client1.session.on('message', (msg: Message) => {
      const body = msg.getData();
      if (msg.command === MINIGAME_CMD) {
        console.log(`[P1 RAW RX -90] (${body.length}b): ${body.toString('hex')}`);
        const pkt = decodeTrucXanhPacket(body);
        void runner1.handlePacket(pkt).then((done) => {
          if (done) gameFinished = true;
        });
      } else if (msg.command === -40) {
        const r = new MyReader(body);
        const text = r.available() >= 2 ? r.readUTF() : body.toString('utf8');
        console.log(`[P1 GAME DIALOG -40] ${text}`);
        const match = text.match(/sau\s+(\d+):(\d+)/);
        if (match) {
          const mins = Number(match[1]);
          const secs = Number(match[2]);
          const waitSecs = mins * 60 + secs + 3;
          console.log(`⏳ [P1] Đang bị phạt thoát bàn: còn ${mins}m ${secs}s. Tự động chờ ${waitSecs}s rồi vào lại...`);
          setTimeout(() => {
            console.log('🔄 [P1] Hết thời gian phạt! Thử tham gia bàn Trúc Xanh lại...');
            sendJoinGame(client1);
          }, waitSecs * 1000);
        }
      } else if (msg.command !== 84 && msg.command !== 48) {
        console.log(`[P1 RAW RX ${msg.command}] (${body.length}b): ${body.subarray(0, 32).toString('hex')}`);
      }
    });

    // Lắng nghe tất cả RX trên client 2
    if (client2 && runner2) {
      client2.session.on('message', (msg: Message) => {
        const body = msg.getData();
        if (msg.command === MINIGAME_CMD) {
          console.log(`[P2 RAW RX -90] (${body.length}b): ${body.toString('hex')}`);
          const pkt = decodeTrucXanhPacket(body);
          void runner2.handlePacket(pkt).then((done) => {
            if (done) gameFinished = true;
          });
        } else if (msg.command === -40) {
          const r = new MyReader(body);
          const text = r.available() >= 2 ? r.readUTF() : body.toString('utf8');
          console.log(`[P2 GAME DIALOG -40] ${text}`);
          const match = text.match(/sau\s+(\d+):(\d+)/);
          if (match) {
            const mins = Number(match[1]);
            const secs = Number(match[2]);
            const waitSecs = mins * 60 + secs + 3;
            console.log(`⏳ [P2] Đang bị phạt thoát bàn: còn ${mins}m ${secs}s. Tự động chờ ${waitSecs}s rồi vào lại...`);
            setTimeout(() => {
              console.log('🔄 [P2] Hết thời gian phạt! Thử tham gia bàn Trúc Xanh lại...');
              sendJoinGame(client2!);
            }, waitSecs * 1000);
          }
        } else if (msg.command !== 84 && msg.command !== 48) {
          console.log(`[P2 RAW RX ${msg.command}] (${body.length}b): ${body.subarray(0, 32).toString('hex')}`);
        }
      });
    }

    // === VÒNG LẶP CHƠI NHIỀU VÁN ===
    const totalRounds = args.rounds;
    for (let round = 1; round <= totalRounds; round++) {
      if (round > 1) {
        // Reset trạng thái giữa các ván
        sharedMemory.reset();
        runner1.reset();
        runner2?.reset();
        gameFinished = false;
        console.log(`\n💤 Chờ 2s trước khi bắt đầu ván ${round}/${totalRounds}...`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Tham gia bàn Trúc Xanh
      console.log(`\n======================================================`);
      console.log(`🎲 [VÁN ${round}/${totalRounds}] [TRÚC XANH P1] Gửi TX -90 [1, 0] tham gia bàn chơi...`);
      console.log('======================================================');
      sendJoinGame(client1);

      if (client2) {
        await new Promise((r) => setTimeout(r, 400));
        console.log(`🎲 [VÁN ${round}/${totalRounds}] [TRÚC XANH P2] Gửi TX -90 [1, 0] tham gia bàn chơi...`);
        sendJoinGame(client2);
      }

      // Chờ ván đấu hoàn thành hoặc timeout
      const startTime = Date.now();
      const maxMs = args.timeoutSec * 1000;

      while (!gameFinished && Date.now() - startTime < maxMs) {
        await new Promise((r) => setTimeout(r, 500));
      }

      if (gameFinished) {
        // Chờ các log và tổng kết ván từ cả 2 phía hiển thị hoàn tất
        await new Promise((r) => setTimeout(r, 1500));
        // Ghi nhận kết quả ván
        roundStats.push({
          round,
          p1Score: runner1.myPos === 0 ? runner1.matchCount : 0,
          p2Score: runner2 ? (runner2.myPos === 0 ? runner2.matchCount : 0) : 0,
          p1Win: true, // Nếu gameFinished=true thì ENDCARD handler đã in kết quả
          timedOut: false,
        });
      } else {
        console.log(`\n⏳ [VÁN ${round}/${totalRounds}] Hết thời gian chờ ván đấu (${args.timeoutSec}s)`);
        roundStats.push({ round, p1Score: 0, p2Score: 0, p1Win: false, timedOut: true });
      }

      // Rời bàn chơi an toàn nếu ván đấu đang diễn ra dở
      if (runner1.isPlaying || (runner2 && runner2.isPlaying)) {
        console.log('🚪 Gửi TX -90 [1, 5] rời bàn chơi...');
        sendOutGame(client1);
        if (client2) sendOutGame(client2);
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // === TỔNG KẾT TẤT CẢ CÁC VÁN ===
    if (totalRounds > 1) {
      const completed = roundStats.filter((s) => !s.timedOut).length;
      const timedOut = roundStats.filter((s) => s.timedOut).length;
      console.log(`\n=================== TỔNG KẾT ${totalRounds} VÁN ĐẤU ===================`);
      console.log(`Hoàn thành: ${completed}/${totalRounds} ván`);
      if (timedOut > 0) console.log(`Hết giờ: ${timedOut} ván`);
      for (const s of roundStats) {
        const status = s.timedOut ? '⏳ HẾT GIỜ' : '✅ XONG';
        console.log(`  Ván ${s.round}: ${status}`);
      }
      console.log('========================================================\n');
    }
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
