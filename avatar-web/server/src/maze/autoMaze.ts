/**
 * autoMaze.ts — Bộ điều phối tự động chạy Mê Cung (Map 28) trong Avatar HD.
 *
 * Spec: docs/superpowers/specs/2026-09-22-tich-hop-me-cung-web-auto-design.md
 * Plan: docs/superpowers/plans/2026-09-22-tich-hop-me-cung-web-auto.md
 */

import type { GameClient } from '../game/client.js';
import { findMazePath } from '../game/mazePathfinding.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import { decodeCustomTabPacket } from '../game/progressQuests.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import {
  idleMazeRuntime,
  type MazeConfig,
  type MazeRuntimeState,
} from '../session/automationTypes.js';

export interface MazeChestNode {
  id: number;
  name: string;
  x: number;
  y: number;
  type: number;
  touch: number[];
  block: number[];
  imageCount: number;
  imageIds?: number[];
  menuIds: number[];
}

export interface AutoMazeRunnerDeps {
  accountId: number;
  accountLabel?: string;
  onStateChange?: (state: MazeRuntimeState) => void;
  onRequestStop?: (reason: 'closed' | 'daily_limit' | 'depleted' | 'error' | 'stopped', message?: string) => void;
  onLog?: (message: string) => void;
}

function readNativeCount(reader: MyReader): number {
  if (reader.available() < 1) throw new Error('Thiếu count');
  const raw = reader.readByte();
  return raw < 0 ? 0 : raw;
}

function readNativeUtf(reader: MyReader): string {
  if (reader.available() < 2) throw new Error('Thiếu UTF');
  const len = reader.readUnsignedShort();
  if (len > 8192 || reader.available() < len) throw new Error('UTF không hợp lệ');
  return reader.readBytes(len).toString('utf8');
}

export function isMazeClosureMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('mê cung') && lower.includes('đóng cửa');
}

export function isDailyLimitMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('đủ 30 hộp quà') ||
    (lower.includes('30 hộp quà') && (lower.includes('hôm nay') || lower.includes('ngày')))
  );
}

function readItemMapSpecial(reader: MyReader): MazeChestNode | null {
  if (reader.available() < 4) return null;
  const id = reader.readInt();
  const name = readNativeUtf(reader);
  if (reader.available() < 8) return null;
  const x = reader.readInt();
  const y = reader.readInt();
  if (reader.available() < 1) return null;
  const type = reader.readByte();
  if (reader.available() < 1) return null;
  const imgCount = readNativeCount(reader);
  if (imgCount < 0 || imgCount > 64 || reader.available() < imgCount * 2) return null;
  const imageIds: number[] = [];
  for (let i = 0; i < imgCount; i++) {
    imageIds.push(reader.readShort());
  }
  if (reader.available() < 8 * 4) return null;
  const touch = Array.from({ length: 4 }, () => reader.readInt());
  const block = Array.from({ length: 4 }, () => reader.readInt());
  if (reader.available() < 1) return null;
  const menuCount = readNativeCount(reader);
  if (menuCount < 0 || menuCount > 64 || reader.available() < menuCount * 2) return null;
  const menuIds: number[] = [];
  for (let m = 0; m < menuCount; m++) {
    menuIds.push(reader.readShort());
  }
  return { id, name, x, y, type, touch, block, imageCount: imgCount, imageIds, menuIds };
}

function decodeParkJoinSnapshot(body: Buffer): {
  roomId: number;
  boardId: number;
  x: number;
  y: number;
  specials: MazeChestNode[];
} | null {
  try {
    const r = new MyReader(body);
    if (r.available() < 2) return null;
    const roomId = r.readByte();
    const boardId = r.readByte();
    if (r.available() < 4) return null;
    const x = r.readShort();
    const y = r.readShort();

    // List player
    const playerCount = readNativeCount(r);
    for (let p = 0; p < playerCount; p++) {
      if (r.available() < 4) return null;
      r.readBytes(4); // id
      readNativeUtf(r); // name
      const parts = readNativeCount(r);
      if (r.available() < parts * 2) return null;
      r.readBytes(parts * 2);
      if (r.available() < 18) return null;
      r.readBytes(18); // state
    }

    // Drop parts
    const dropCount = readNativeCount(r);
    if (r.available() < dropCount * 11) return null;
    r.readBytes(dropCount * 11);

    // Map marker + items
    if (r.available() >= 2) {
      const mapMarker = r.readShort();
      if (mapMarker >= 1) {
        if (r.available() >= 1) {
          const itemTypeCount = readNativeCount(r);
          for (let t = 0; t < itemTypeCount; t++) {
            if (r.available() < 8) return null;
            r.readBytes(8);
            const notTrans = readNativeCount(r);
            if (r.available() < notTrans * 2) return null;
            r.readBytes(notTrans * 2);
          }
        }
        if (r.available() >= 1) {
          const itemCount = readNativeCount(r);
          if (r.available() < itemCount * 4) return null;
          r.readBytes(itemCount * 4);
        }
      }
    }

    // Anim templates
    if (r.available() >= 1) {
      const animCount = readNativeCount(r);
      if (animCount > 0) {
        if (r.available() < animCount * 10) return null;
        r.readBytes(animCount * 10);
      }
    }

    // ItemMapSpecial (Specials / Chests)
    const specials: MazeChestNode[] = [];
    if (r.available() >= 1) {
      const specialCount = readNativeCount(r);
      for (let s = 0; s < specialCount; s++) {
        const obj = readItemMapSpecial(r);
        if (!obj) return null;
        specials.push(obj);
      }
    }

    return { roomId, boardId, x, y, specials };
  } catch {
    return null;
  }
}

export function isChest(s: MazeChestNode): boolean {
  return (
    s.name.toLowerCase().includes('rương') ||
    s.name.toLowerCase().includes('kho báu') ||
    s.menuIds.includes(1217) ||
    (s.imageIds?.includes(1133) ?? false)
  );
}

export class AutoMazeRunner {
  private config: MazeConfig | null = null;
  private state: MazeRuntimeState = idleMazeRuntime();
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  private currentSpecials = new Map<number, MazeChestNode>();
  private removedChestIds = new Set<number>();
  private dialogMessages: string[] = [];
  private announcements: string[] = [];
  private lastJoinSnapshot: { roomId: number; boardId: number; x: number; y: number } | null = null;
  private isJoinPending = false;
  private respawnDetected = false;

  constructor(
    private readonly client: GameClient,
    private readonly deps: AutoMazeRunnerDeps,
  ) {}

  public getRuntimeState(): MazeRuntimeState {
    return { ...this.state };
  }

  public isRunning(): boolean {
    return this.running;
  }

  public updateConfig(config: MazeConfig): void {
    this.config = config;
  }

  public async start(config: MazeConfig): Promise<void> {
    if (this.running) return;
    this.config = config;
    this.running = true;
    this.abortController = new AbortController();
    this.state = {
      ...idleMazeRuntime(),
      status: 'entering',
    };
    this.emitState();

    this.loopPromise = this.runLoop(this.abortController.signal).catch((err) => {
      if (this.running) {
        this.state = {
          ...this.state,
          status: 'stopped',
          lastMessage: `Lỗi runner: ${(err as Error).message}`,
        };
        this.emitState();
        this.running = false;
        this.deps.onRequestStop?.('error', (err as Error).message);
      }
    });
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.abortController?.abort();

    this.state = {
      ...this.state,
      status: 'stopped',
    };
    this.emitState();

    if (this.loopPromise) {
      await Promise.race([
        this.loopPromise,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      this.loopPromise = null;
    }
  }

  private emitState(): void {
    this.deps.onStateChange?.({ ...this.state });
  }

  private log(message: string): void {
    this.deps.onLog?.(message);
  }

  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const onAbort = (): void => {
        if (timer) clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new Error('aborted'));
      };
      if (signal.aborted) {
        reject(new Error('aborted'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    });
  }

  private handleMessage = (msg: Message): void => {
    const body = Buffer.from(msg.getData());

    if (msg.command === -38) {
      try {
        const r = new MyReader(body);
        const text = readNativeUtf(r);
        if (text) {
          this.announcements.push(text);
          this.log(`[MAZE BROADCAST] "${text}"`);
          if (text.includes('hộp quà đã xuất hiện') || text.includes('mê cung')) {
            this.respawnDetected = true;
          }
        }
      } catch {}
    } else if (msg.command === -40) {
      try {
        const r = new MyReader(body);
        const text = readNativeUtf(r);
        if (text) {
          this.dialogMessages.push(text);
        }
      } catch {}
    } else if (msg.command === -62) {
      try {
        const tab = decodeCustomTabPacket(body);
        const text = [tab.title, tab.content].filter(Boolean).join(': ');
        if (text) {
          this.dialogMessages.push(text);
        }
      } catch {}
    } else if (msg.command === 80) {
      const snapshot = decodeParkJoinSnapshot(body);
      if (snapshot && snapshot.roomId === 28) {
        this.lastJoinSnapshot = {
          roomId: snapshot.roomId,
          boardId: snapshot.boardId,
          x: snapshot.x,
          y: snapshot.y,
        };
        this.currentSpecials.clear();
        for (const s of snapshot.specials) {
          this.currentSpecials.set(s.id, s);
        }
        this.isJoinPending = false;
        this.respawnDetected = true;
      }
    } else if (msg.command === 48) {
      try {
        const r = new MyReader(body);
        if (r.available() >= 1) {
          const mode = r.readByte();
          if (mode === 2 && r.available() >= 4) {
            const removedId = r.readInt();
            this.currentSpecials.delete(removedId);
            this.removedChestIds.add(removedId);
          } else if (mode === 0 || mode === 1) {
            const obj = readItemMapSpecial(r);
            if (obj) {
              this.currentSpecials.set(obj.id, obj);
              this.removedChestIds.delete(obj.id);
            }
          }
        }
      } catch {}
    }
  };

  private async waitForBoard(area: number, signal: AbortSignal, timeoutMs = 8000): Promise<boolean> {
    const start = Date.now();
    this.isJoinPending = true;
    while (Date.now() - start < timeoutMs && !signal.aborted) {
      if (!this.isJoinPending && this.lastJoinSnapshot?.boardId === area) {
        return true;
      }
      for (const msg of this.dialogMessages) {
        if (isMazeClosureMessage(msg)) {
          return false;
        }
      }
      await this.sleep(250, signal);
    }
    return false;
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    const config = this.config;
    if (!config) return;

    this.client.session.on('message', this.handleMessage);
    try {
      this.state.status = 'entering';
      this.state.lastMessage = 'Chuyển ngữ cảnh công viên (Park context)...';
      this.emitState();

      this.client.enterParkContext();
      await this.sleep(1000, signal);

      // Yêu cầu danh sách khu vực Mê cung
      this.client.sendRaw(90, [{ t: 'i8', v: '28' }]);
      await this.sleep(1000, signal);

      let currentArea = Math.max(0, config.startArea);
      const maxArea = Math.min(50, Math.max(currentArea, config.maxAreasToScan));
      const pos = NATIVE_PARK_JOIN_POSITIONS[28] ?? { x: 57, y: 209 };

      while (this.running && !signal.aborted) {
        this.dialogMessages.length = 0;
        this.currentSpecials.clear();
        this.removedChestIds.clear();
        this.lastJoinSnapshot = null;

        this.state.status = 'entering';
        this.state.currentArea = currentArea;
        this.state.lastMessage = `Đang vào Mê cung Khu ${currentArea}...`;
        this.emitState();

        this.client.sendRaw(80, [
          { t: 'i8', v: '28' },
          { t: 'i8', v: String(currentArea) },
          { t: 'i16', v: String(pos.x) },
          { t: 'i16', v: String(pos.y) },
        ]);

        const joined = await this.waitForBoard(currentArea, signal);
        if (!joined) {
          const closureMsg = this.dialogMessages.find(isMazeClosureMessage);
          if (closureMsg) {
            this.state.status = 'stopped';
            this.state.lastMessage = closureMsg;
            this.emitState();
            this.log(`[MAZE] Mê cung đóng cửa: "${closureMsg}" -> dừng bot.`);
            this.deps.onRequestStop?.('closed', closureMsg);
            return;
          }
          this.log(`[MAZE] Vào khu ${currentArea} không phản hồi, thử lại sau 2 giây.`);
          await this.sleep(2000, signal);
          continue;
        }

        const snap = this.lastJoinSnapshot as { x: number; y: number } | null;
        let avatarPos = {
          x: snap?.x ?? pos.x,
          y: snap?.y ?? pos.y,
        };

        this.log(`[MAZE] Đã vào Mê cung Khu ${currentArea} tại (${avatarPos.x}, ${avatarPos.y}).`);

        // Vòng lặp nhặt rương trong khu vực hiện tại
        const visitedChestIds = new Set<number>();

        while (this.running && !signal.aborted) {
          if (this.state.sessionChestsOpened >= config.maxChestsPerSession) {
            this.state.status = 'stopped';
            this.state.lastMessage = `Đã đạt chỉ tiêu mở rương (${this.state.sessionChestsOpened}/${config.maxChestsPerSession}).`;
            this.emitState();
            this.log(`[MAZE] Đã đạt chỉ tiêu mở ${config.maxChestsPerSession} rương.`);
            this.deps.onRequestStop?.('stopped', this.state.lastMessage);
            return;
          }

          const allSpecials = Array.from(this.currentSpecials.values());
          const availableChests = allSpecials
            .filter(isChest)
            .filter((c) => !c.name && !visitedChestIds.has(c.id) && !this.removedChestIds.has(c.id));

          if (availableChests.length === 0) {
            this.log(`[MAZE] Khu ${currentArea} đã hết rương trống khả dụng.`);
            break;
          }

          // Chọn rương gần nhất
          const targetChest = availableChests.slice().sort((a, b) => {
            const distA = Math.hypot(a.x - avatarPos.x, a.y - avatarPos.y);
            const distB = Math.hypot(b.x - avatarPos.x, b.y - avatarPos.y);
            return distA - distB;
          })[0]!;

          visitedChestIds.add(targetChest.id);
          this.state.targetChestId = targetChest.id;
          this.state.targetChestPos = { x: targetChest.x, y: targetChest.y };
          this.state.status = 'navigating';
          this.state.lastMessage = `Tìm đường tới rương ID ${targetChest.id} tại (${targetChest.x}, ${targetChest.y})...`;
          this.emitState();

          const allChests = allSpecials.filter(isChest);
          const path = findMazePath(
            avatarPos,
            { x: targetChest.x, y: targetChest.y },
            (tx, ty) => {
              if (tx < 0 || ty < 0 || tx > 120 || ty > 120) return true;
              const px = tx * 24 + 12;
              const py = ty * 24 + 12;
              for (const c of allChests) {
                if (c.id === targetChest.id) continue;
                if (c.block && c.block.length >= 4) {
                  const [bx = 0, by = 0, bw = 0, bh = 0] = c.block;
                  if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
                    return true;
                  }
                }
              }
              return false;
            },
          );

          if (!path.reachable) {
            this.log(`[MAZE] Rương ID ${targetChest.id} bị chặn đường hoàn toàn, bỏ qua.`);
            continue;
          }

          this.log(`[MAZE] Di chuyển tới rương ID ${targetChest.id} (${path.waypoints.length} bước)...`);

          for (const wp of path.waypoints) {
            if (signal.aborted || !this.running) break;
            this.client.sendRaw(84, [
              { t: 'i16', v: String(wp.x) },
              { t: 'i16', v: String(wp.y) },
              { t: 'i8', v: String(wp.direct) },
            ]);
            avatarPos = { x: wp.x, y: wp.y };
            await this.sleep(250, signal);
          }

          const distToChest = Math.hypot(avatarPos.x - targetChest.x, avatarPos.y - targetChest.y);
          if (distToChest <= 36 && !this.removedChestIds.has(targetChest.id)) {
            this.dialogMessages.length = 0;
            this.state.status = 'opening';
            this.state.lastMessage = `Mở rương ID ${targetChest.id}...`;
            this.emitState();

            this.client.sendRaw(48, [
              { t: 'i8', v: '3' },
              { t: 'i32', v: String(targetChest.id) },
              { t: 'i8', v: '0' },
            ]);
            await this.sleep(1500, signal);

            const outcomeText = this.dialogMessages.join(' | ');
            if (this.dialogMessages.some(isDailyLimitMessage) || isDailyLimitMessage(outcomeText)) {
              this.state.dailyLimitReached = true;
              this.state.status = 'daily_limit_reached';
              this.state.lastMessage = 'Đã nhận đủ 30 hộp quà của ngày hôm nay! Dừng chạy.';
              this.emitState();
              this.log(`[MAZE] Đã đạt giới hạn 30 hộp quà trong ngày! Tắt auto.`);
              this.deps.onRequestStop?.('daily_limit', this.state.lastMessage);
              return;
            }

            const updated = this.currentSpecials.get(targetChest.id);
            if (
              outcomeText.includes('Chúc mừng') ||
              (updated && updated.name === this.deps.accountLabel) ||
              (updated && updated.name.length > 0 && outcomeText.length === 0)
            ) {
              this.state.sessionChestsOpened++;
              this.state.lastMessage = `Mở thành công rương ID ${targetChest.id} (${this.state.sessionChestsOpened} rương)!`;
              this.emitState();
              this.log(`[MAZE] Nhặt thành công rương ID ${targetChest.id}. Tổng phiên: ${this.state.sessionChestsOpened}.`);
            } else if (outcomeText.includes('nhặt rồi')) {
              this.log(`[MAZE] Rương ID ${targetChest.id} đã bị người khác mở trước.`);
            }
          }
        }

        // Hết rương trong khu vực hiện tại
        if (config.autoSwitchArea && currentArea + 1 <= maxArea) {
          currentArea++;
          this.state.status = 'switching_area';
          this.state.lastMessage = `Chuyển sang Khu ${currentArea}...`;
          this.emitState();
          this.log(`[MAZE] Chuyển sang khu tiếp theo: Khu ${currentArea}.`);
          await this.sleep(1500, signal);
        } else {
          // Đã duyệt hết các khu
          if (config.watchRespawn) {
            this.state.status = 'waiting_respawn';
            this.state.lastMessage = 'Đã quét hết các khu. Đang chờ rương hồi sinh đợt mới...';
            this.emitState();
            this.log(`[MAZE] Đã quét hết khu vực. Treo máy chờ đợt rương mới...`);

            this.respawnDetected = false;
            const waitRespawnStart = Date.now();
            // Chờ tối đa 15 phút (900s)
            while (Date.now() - waitRespawnStart < 900_000 && !this.respawnDetected && !signal.aborted && this.running) {
              await this.sleep(3000, signal);
            }

            if (this.respawnDetected) {
              this.log(`[MAZE] Phát hiện đợt rương mới! Khởi động lại từ Khu ${config.startArea}.`);
              currentArea = config.startArea;
              await this.sleep(2000, signal);
            } else {
              this.state.status = 'stopped';
              this.state.lastMessage = 'Hết thời gian chờ rương hồi sinh.';
              this.emitState();
              this.deps.onRequestStop?.('depleted', this.state.lastMessage);
              return;
            }
          } else {
            this.state.status = 'stopped';
            this.state.lastMessage = 'Đã quét hết tất cả các khu vực cho phép.';
            this.emitState();
            this.log(`[MAZE] Hoàn thành quét tất cả các khu vực.`);
            this.deps.onRequestStop?.('depleted', this.state.lastMessage);
            return;
          }
        }
      }
    } finally {
      this.client.session.removeListener('message', this.handleMessage);
    }
  }
}
