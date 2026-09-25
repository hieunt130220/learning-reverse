# Minigame Lật Hình Trúc Xanh Map 7 Probe Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ probe CLI hoàn chỉnh (`trucxanh-probe.ts`) tự động kết nối live server, tham gia bàn Trúc Xanh tại Map 7 Khu 0, giải mã opcode `-90`, và tự động chơi hoàn thành trọn vẹn 1 ván đấu với thuật toán Perfect Memory.

**Architecture:** Tạo script Node.js/TypeScript `avatar-web/server/src/tools/trucxanh-probe.ts` tận dụng hạ tầng kết nối `GameClient` và `ParkService`. Xây dựng bộ giải mã `TrucXanhDecoder` bóc tách từng subAction của opcode `-90` kết hợp cùng máy trạng thái `TrucXanhSolver` ghi nhớ mọi thẻ bài được lật để giải trọn vẹn 12 cặp thẻ (24 ô) cho tới khi kết thúc ván (`ENDCARD`).

**Tech Stack:** TypeScript, Node.js v25, `GameClient`, `MyReader`, `Message`, SQLite (`avatar-web.db`).

**Spec:** `docs/superpowers/specs/2026-09-25-trucxanh-probe-design.md`

## Global Constraints
- Không tạo test files (tuân thủ nghiêm ngặt nguyên tắc **KHÔNG TDD** của dự án).
- Mọi gói tin điều khiển minigame đều thông qua master opcode `-90` (`MINIGAME`).
- Không gây ảnh hưởng tới các module auto farm / câu cá đang chạy; tự động kiểm tra port web server trước khi login.
- Thao tác lật thẻ giữ khoảng delay an toàn (800ms - 1200ms) để phản ánh nhịp độ tự nhiên và tránh server drop gói.

---

### Task 1: Bộ khung CLI, Login & Di chuyển vào Map 7 Khu 0

**Files:**
- Create: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `openDb`, `loadConfig`, `getAccountById`, `readGamePass`, `GameClient`, `NATIVE_PARK_JOIN_POSITIONS`.
- Produces: CLI script nhận đối số `--account-id`, `--delay`, `--timeout`, thực hiện đăng nhập và gia nhập Map 7 Khu 0 thành công.

- [ ] **Step 1: Viết khung CLI và hàm xử lý tham số dòng lệnh**

```typescript
import { get as httpGet } from 'node:http';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient } from '../game/client.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

export interface TrucXanhProbeArgs {
  accountId: number;
  delayMs: number;
  timeoutSec: number;
}

export function parseArgs(argv: string[]): TrucXanhProbeArgs {
  let accountId = 1;
  let delayMs = 900;
  let timeoutSec = 180;

  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--account-id' && val) accountId = Number(val);
    if (key === '--delay' && val) delayMs = Number(val);
    if (key === '--timeout' && val) timeoutSec = Number(val);
  }

  return { accountId, delayMs, timeoutSec };
}
```

- [ ] **Step 2: Viết logic kiểm tra port web server, kết nối game và vào Map 7**

```typescript
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
```

- [ ] **Step 3: Commit Task 1**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): scaffold trucxanh probe CLI with login and map7 navigation"
```

---

### Task 2: Bộ giải mã RX -90 và giao thức Wire Protocol Trúc Xanh

**Files:**
- Modify: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `MyReader`, `Message`.
- Produces: `decodeTrucXanhPacket`, `sendJoinGame`, `sendOpenCard`, `sendOutGame`.

- [ ] **Step 1: Định nghĩa các kiểu dữ liệu và hằng số Opcode -90**

```typescript
export const MINIGAME_CMD = -90;
export const GAME_ID_TRUCXANH = 1;

export const SUBCMD_JOIN = 0;
export const SUBCMD_START = 1;
export const SUBCMD_OPENCARD = 2;
export const SUBCMD_SETTURN = 3;
export const SUBCMD_ENDCARD = 4;
export const SUBCMD_OUTCARD = 5;

export type TrucXanhPacket =
  | { type: 'JOIN'; gameId: number; subAction: number; playerId: number; playerName: string }
  | { type: 'START'; gameId: number; subAction: number; turn: number; isMyTurn: boolean; time: number }
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
    }
  | { type: 'SETTURN'; gameId: number; subAction: number; turn: number; isMyTurn: boolean }
  | { type: 'ENDCARD'; gameId: number; subAction: number; win: number; score1: number; score2: number; giftBoxId?: number }
  | { type: 'OUTCARD'; gameId: number; subAction: number; iddb: number }
  | { type: 'UNKNOWN'; gameId: number; subAction: number; hex: string };
```

- [ ] **Step 2: Viết hàm decodeTrucXanhPacket bóc tách chính xác từng trường byte**

```typescript
export function decodeTrucXanhPacket(body: Buffer): TrucXanhPacket {
  const r = new MyReader(body);
  const gameId = r.readByte();
  const subAction = r.readByte();

  if (gameId !== GAME_ID_TRUCXANH) {
    return { type: 'UNKNOWN', gameId, subAction, hex: body.toString('hex') };
  }

  switch (subAction) {
    case SUBCMD_JOIN: {
      const playerId = r.readInt();
      const playerName = r.readUTF();
      return { type: 'JOIN', gameId, subAction, playerId, playerName };
    }
    case SUBCMD_START: {
      const turn = r.readByte();
      const time = r.readByte();
      return { type: 'START', gameId, subAction, turn, isMyTurn: turn === 0, time };
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
            r.readInt(); // unused / img2
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
      };
    }
    case SUBCMD_SETTURN: {
      const turn = r.readByte();
      return { type: 'SETTURN', gameId, subAction, turn, isMyTurn: turn === 0 };
    }
    case SUBCMD_ENDCARD: {
      const win = r.readByte();
      const score1 = r.readInt();
      const score2 = r.readInt();
      let giftBoxId: number | undefined;
      if (r.available() >= 2) {
        giftBoxId = r.readShort();
      }
      return { type: 'ENDCARD', gameId, subAction, win, score1, score2, giftBoxId };
    }
    case SUBCMD_OUTCARD: {
      const iddb = r.available() > 0 ? r.readByte() : -1;
      return { type: 'OUTCARD', gameId, subAction, iddb };
    }
    default:
      return { type: 'UNKNOWN', gameId, subAction, hex: body.toString('hex') };
  }
}
```

- [ ] **Step 3: Viết các hàm gửi lệnh TX -90**

```typescript
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
```

- [ ] **Step 4: Commit Task 2**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): implement trucxanh packet decoder and TX command senders"
```

---

### Task 3: Thuật toán giải cờ lật hình Perfect Memory & Quản lý ván đấu

**Files:**
- Modify: `avatar-web/server/src/tools/trucxanh-probe.ts`

**Interfaces:**
- Consumes: `TrucXanhPacket`, `sendOpenCard`, `sendOutGame`.
- Produces: `TrucXanhGameRunner` điều khiển vòng lặp chơi hoàn thành ván đấu.

- [ ] **Step 1: Viết lớp quản lý bộ nhớ và chiến thuật lật bài**

```typescript
export class TrucXanhMemory {
  readonly cardImages = new Map<number, number>(); // cardId -> imgId
  readonly removedCards = new Set<number>();
  readonly totalCards = 24; // lưới 6x4

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

  pickUnknownCard(): number | null {
    const unrevealed: number[] = [];
    for (let i = 0; i < this.totalCards; i++) {
      if (!this.isRemoved(i) && !this.cardImages.has(i)) {
        unrevealed.push(i);
      }
    }
    if (unrevealed.length > 0) {
      return unrevealed[Math.floor(Math.random() * unrevealed.length)];
    }
    // Fallback: thẻ chưa removed
    for (let i = 0; i < this.totalCards; i++) {
      if (!this.isRemoved(i)) return i;
    }
    return null;
  }
}
```

- [ ] **Step 2: Viết lớp vòng lặp điều khiển ván đấu TrucXanhGameRunner**

```typescript
export class TrucXanhGameRunner {
  private readonly memory = new TrucXanhMemory();
  private isMyTurn = false;
  private isPlaying = false;
  private firstFlippedCard: { cardId: number; img: number } | null = null;
  private pendingCardResolve: ((pkt: Extract<TrucXanhPacket, { type: 'OPENCARD' }>) => void) | null = null;

  constructor(
    private readonly client: GameClient,
    private readonly delayMs: number,
  ) {}

  async handlePacket(pkt: TrucXanhPacket): Promise<boolean> {
    switch (pkt.type) {
      case 'JOIN':
        console.log(`[BÀN CHƠI] Người chơi tham gia: ${pkt.playerName} (ID: ${pkt.playerId})`);
        break;
      case 'START':
        console.log(`[BẮT ĐẦU VÁN] Lượt: ${pkt.isMyTurn ? 'CỦA BẠN' : 'ĐỐI THỦ'}, Thời gian: ${pkt.time}s`);
        this.isPlaying = true;
        this.isMyTurn = pkt.isMyTurn;
        if (this.isMyTurn) {
          await this.executeTurn();
        }
        break;
      case 'OPENCARD':
        this.memory.recordCard(pkt.cardId, pkt.img);
        console.log(`[MỞ THẺ] Ô #${pkt.cardId} -> Hình #${pkt.img}`);
        if (pkt.isMatch && pkt.cardId2 !== undefined) {
          console.log(`[GHÉP ĐÚNG CẶP] Ô #${pkt.cardId} & #${pkt.cardId2}! Điểm: Bạn=${pkt.score1 ?? '?'}, Đối thủ=${pkt.score2 ?? '?'}`);
          this.memory.markRemoved(pkt.cardId, pkt.cardId2);
        }
        if (this.pendingCardResolve) {
          this.pendingCardResolve(pkt);
          this.pendingCardResolve = null;
        }
        break;
      case 'SETTURN':
        this.isMyTurn = pkt.isMyTurn;
        console.log(`[ĐỔI LƯỢT] Lượt tiếp theo: ${this.isMyTurn ? 'CỦA BẠN' : 'ĐỐI THỦ'}`);
        if (this.isMyTurn && this.isPlaying) {
          await this.executeTurn();
        }
        break;
      case 'ENDCARD':
        this.isPlaying = false;
        const winLabel = pkt.win === 1 ? 'CHIẾN THẮNG' : pkt.win === 2 ? 'THẤT BẠI' : 'HÒA';
        console.log(`\n=================== KẾT THÚC VÁN ĐẤU ===================`);
        console.log(`Kết quả: ${winLabel} (Mã win: ${pkt.win})`);
        console.log(`Điểm số: Player 1 = ${pkt.score1} | Player 2 = ${pkt.score2}`);
        if (pkt.giftBoxId !== undefined) {
          console.log(`Hộp quà phần thưởng: ID #${pkt.giftBoxId}`);
        }
        return true; // Ván đấu đã xong
    }
    return false;
  }

  private async executeTurn(): Promise<void> {
    if (!this.isPlaying || !this.isMyTurn) return;
    await new Promise((r) => setTimeout(r, this.delayMs));

    // 1. Kiểm tra cặp đã biết
    const pair = this.memory.findKnownPair();
    if (pair) {
      console.log(`[CHIẾN THUẬT] Phát hiện cặp đã biết: #${pair[0]} & #${pair[1]}`);
      await this.flipCardAndWait(pair[0]);
      await new Promise((r) => setTimeout(r, this.delayMs));
      await this.flipCardAndWait(pair[1]);
      return;
    }

    // 2. Mở thăm dò thẻ 1
    const card1 = this.memory.pickUnknownCard();
    if (card1 === null) return;
    console.log(`[CHIẾN THUẬT] Mở thăm dò thẻ 1: #${card1}`);
    const opened1 = await this.flipCardAndWait(card1);

    await new Promise((r) => setTimeout(r, this.delayMs));

    // 3. Kiểm tra xem thẻ 1 có trùng với thẻ nào đã biết không
    const matchCard = this.memory.findMatchFor(card1, opened1.img);
    if (matchCard !== null) {
      console.log(`[CHIẾN THUẬT] Thẻ 1 khớp với thẻ đã nhớ: #${matchCard}! Lật thẻ 2!`);
      await this.flipCardAndWait(matchCard);
      return;
    }

    // 4. Nếu không khớp, mở thẻ 2 chưa biết
    const card2 = this.memory.pickUnknownCard();
    if (card2 === null) return;
    console.log(`[CHIẾN THUẬT] Mở thăm dò thẻ 2: #${card2}`);
    await this.flipCardAndWait(card2);
  }

  private flipCardAndWait(cardId: number): Promise<Extract<TrucXanhPacket, { type: 'OPENCARD' }>> {
    return new Promise((resolve) => {
      this.pendingCardResolve = resolve;
      sendOpenCard(this.client, cardId);
    });
  }
}
```

- [ ] **Step 3: Commit Task 3**

```bash
git add avatar-web/server/src/tools/trucxanh-probe.ts
git commit -m "feat(probe): implement perfect memory solver and automated full-game runner"
```

---

### Task 4: Chạy kiểm chứng ván đấu thực tế trên Live Server

**Files:**
- Execute: `avatar-web/server/src/tools/trucxanh-probe.ts`

- [ ] **Step 1: Khởi chạy lệnh probe trên live server**

```bash
npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --account-id 1
```

- [ ] **Step 2: Ghi nhận nhật ký ván đấu và kết quả kết thúc ván**

- [ ] **Step 3: Cập nhật tài liệu kết quả kiểm chứng vào memory/doc nếu có phát hiện mới**

```bash
git add docs/protocol/avatar-map7-castle-minigame-protocol.md
git commit -m "docs: record live full-game trucxanh probe verification results"
```
