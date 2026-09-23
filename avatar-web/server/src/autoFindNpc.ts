/**
 * autoFindNpc.ts — Bộ điều phối tự động Tìm NPC (Công viên) trong Avatar HD.
 *
 * Spec: docs/superpowers/specs/2026-09-23-tich-hop-tim-npc-web-auto-design.md
 * Plan: docs/superpowers/plans/2026-09-23-tich-hop-tim-npc-web-auto.md
 */

import {
  GameClient,
  type ClientStatus,
} from './game/client.js';
import {
  NATIVE_PARK_JOIN_POSITIONS,
  type NativeParkJoinPosition,
} from './game/parkService.js';
import type { Message } from './proto/message.js';
import { MyReader } from './proto/reader.js';
import {
  DEFAULT_FIND_NPC_CONFIG,
  type AutoFindNpcPhase,
  type AutoFindNpcState,
  type AutomationLocation,
  type FindNpcConfig,
  type NpcMapLocation,
} from './session/automationTypes.js';
import { parseMaxQuantityDialog } from './tools/park-probe.js';

export interface ParkUser {
  id: number;
  name: string;
  x: number;
  y: number;
  dir: number;
}

export interface ParkNpc {
  id: number;
  name: string;
  x: number;
  y: number;
  type: number;
  menuIds: number[];
}

interface ParkJoinSnapshot {
  roomId: number;
  boardId: number;
  x: number;
  y: number;
  users: ParkUser[];
  npcs: ParkNpc[];
}

interface MapSpecialUpdate {
  mode: number;
  operation: 'upsert' | 'remove' | 'unsupported';
  id: number;
  name?: string;
  x?: number;
  y?: number;
  type?: number;
  menuIds?: number[];
}

interface MapSpecialCapture {
  updates: MapSpecialUpdate[];
  stop: () => void;
}

export interface AutoFindNpcOptions {
  client: GameClient;
  config?: FindNpcConfig;
  targetName?: string;
  catalog?: readonly NpcMapLocation[];
  onState?: (state: AutoFindNpcState) => void;
  onFound?: (location: AutomationLocation) => void;
  onMissing?: () => void;
  onTerminalFailure?: (error: Error) => void;
  onRequestStop?: (reason: 'daily_limit' | 'stopped' | 'error', message?: string) => void;
  onLog?: (message: string) => void;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new Error(`Thiếu count ${section}`);
  }
  const raw = reader.readByte();
  if (raw < 0) return 0;
  if (raw > 64) {
    throw new Error(`Count ${section} vượt giới hạn cho phép: ${raw}`);
  }
  return raw;
}

function readNativeUtf(reader: MyReader, section: string): string {
  if (reader.available() < 2) {
    throw new Error(`Thiếu độ dài UTF ${section}`);
  }
  const len = reader.readUnsignedShort();
  if (len > 8_192 || reader.available() < len) {
    throw new Error(`Chuỗi UTF ${section} vượt giới hạn độ dài (${len})`);
  }
  return reader.readBytes(len).toString('utf8');
}

function readNativeBytes(reader: MyReader, n: number, section: string): Buffer {
  if (n < 0 || reader.available() < n) {
    throw new Error(`Thiếu ${n} bytes ${section} (còn ${reader.available()})`);
  }
  return reader.readBytes(n);
}

function getJoinPosition(map: number): NativeParkJoinPosition {
  if (NATIVE_PARK_JOIN_POSITIONS[map]) {
    return NATIVE_PARK_JOIN_POSITIONS[map];
  }
  if (map >= 0 && map <= 8) {
    return { x: 254, y: 82 };
  }
  throw new Error(`Chưa có toạ độ native cho map ${map}`);
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

function decodeParkJoinResponse(body: Buffer): ParkJoinSnapshot {
  const reader = new MyReader(body);

  if (reader.available() < 2) {
    throw new Error('Gói RX 80 quá ngắn (thiếu roomId, boardId)');
  }
  const roomId = reader.readByte();
  const boardId = reader.readByte();

  if (reader.available() < 4) {
    throw new Error('Gói RX 80 thiếu tọa độ vị trí');
  }
  const x = reader.readShort();
  const y = reader.readShort();

  const users: ParkUser[] = [];
  const npcs: ParkNpc[] = [];
  const playerCount = readNativeCount(reader, 'listPlayer');
  for (let i = 0; i < playerCount; i += 1) {
    if (reader.available() < 4) {
      throw new Error(`Thiếu ID của player[${i}]`);
    }
    const id = reader.readInt();
    const name = readNativeUtf(reader, `player[${i}].name`);
    const partCount = readNativeCount(reader, `player[${i}].parts`);
    readNativeBytes(reader, partCount * 2, `player[${i}].parts`);

    if (reader.available() < 18) {
      throw new Error(`Thiếu state của player[${i}]`);
    }
    const px = reader.readShort();
    const py = reader.readShort();
    const dir = reader.readByte();
    readNativeBytes(reader, 13, `player[${i}].stateTail`);

    if (id >= 2_000_000_000 || id < 0) {
      npcs.push({ id, name, x: px, y: py, type: -1, menuIds: [] });
    } else {
      users.push({ id, name, x: px, y: py, dir });
    }
  }

  const dropCount = readNativeCount(reader, 'dropParts');
  readNativeBytes(reader, dropCount * 11, 'dropParts');

  if (reader.available() >= 2) {
    const mapMarker = reader.readShort();
    if (mapMarker >= 1) {
      if (reader.available() >= 1) {
        const itemTypeCount = readNativeCount(reader, 'mapItemType');
        for (let t = 0; t < itemTypeCount; t += 1) {
          readNativeBytes(reader, 8, `mapItemType[${t}]`);
          const notTransCount = readNativeCount(reader, `notTrans[${t}]`);
          readNativeBytes(reader, notTransCount * 2, `notTrans[${t}]`);
        }
      }
      if (reader.available() >= 1) {
        const itemCount = readNativeCount(reader, 'mapItem');
        readNativeBytes(reader, itemCount * 4, 'mapItem');
      }
    }
  }

  if (reader.available() >= 1) {
    const animCount = readNativeCount(reader, 'animTempl');
    if (animCount > 0) {
      readNativeBytes(reader, animCount * 10, 'animTempl');
    }
  }

  if (reader.available() >= 1) {
    const specialCount = readNativeCount(reader, 'specials');
    for (let s = 0; s < specialCount; s += 1) {
      if (reader.available() < 4) {
        throw new Error(`Thiếu ID của special[${s}]`);
      }
      const id = reader.readInt();
      const name = readNativeUtf(reader, `special[${s}].name`);
      if (reader.available() < 9) {
        throw new Error(`Thiếu tọa độ hoặc type của special[${s}]`);
      }
      const sx = reader.readInt();
      const sy = reader.readInt();
      const type = reader.readByte();

      const imageCount = readNativeCount(reader, `special[${s}].images`);
      readNativeBytes(reader, imageCount * 2, `special[${s}].images`);
      readNativeBytes(reader, 32, `special[${s}].state`);

      const menuCount = readNativeCount(reader, `special[${s}].menus`);
      const menuIds: number[] = [];
      for (let m = 0; m < menuCount; m += 1) {
        if (reader.available() < 2) {
          throw new Error(`Thiếu menu[${m}] của special[${s}]`);
        }
        menuIds.push(reader.readShort());
      }

      npcs.push({ id, name, x: sx, y: sy, type, menuIds });
    }
  }

  return { roomId, boardId, x, y, users, npcs };
}

function decodeMapSpecialUpdate(body: Buffer): MapSpecialUpdate {
  const reader = new MyReader(body);
  const mode = reader.readByte();
  if (mode === 2) {
    const id = reader.readInt();
    return {
      mode,
      operation: 'remove',
      id,
    };
  }
  if (mode < 0 || mode > 1) {
    return {
      mode,
      operation: 'unsupported',
      id: -1,
    };
  }

  const id = reader.readInt();
  const name = readNativeUtf(reader, 'special-update.name');
  const x = reader.readInt();
  const y = reader.readInt();
  const type = reader.readByte();
  const imageCount = readNativeCount(reader, 'special-update.images');
  readNativeBytes(reader, imageCount * 2, 'special-update.images');
  readNativeBytes(reader, 8 * 4, 'special-update.state');
  const menuCount = readNativeCount(reader, 'special-update.menus');
  const menuIds: number[] = [];
  for (let m = 0; m < menuCount; m += 1) {
    menuIds.push(reader.readShort());
  }
  return {
    mode,
    operation: 'upsert',
    id,
    name,
    x,
    y,
    type,
    menuIds,
  };
}

function startMapSpecialCapture(client: GameClient): MapSpecialCapture {
  const updates: MapSpecialUpdate[] = [];
  const onMessage = (msg: Message): void => {
    if (msg.command !== 48) return;
    try {
      updates.push(decodeMapSpecialUpdate(msg.getData()));
    } catch {
      // ignore
    }
  };
  client.session.on('message', onMessage);
  return {
    updates,
    stop: () => client.session.removeListener('message', onMessage),
  };
}

function waitForParkJoinResponse(
  client: GameClient,
  timeoutMs: number,
  expectedMap: number,
  expectedBoard: number,
): Promise<ParkJoinSnapshot> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (snap: ParkJoinSnapshot): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(snap);
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 80) {
        try {
          const snap = decodeParkJoinResponse(msg.getData());
          if (snap.roomId === expectedMap && snap.boardId === expectedBoard) {
            finishResolve(snap);
          }
        } catch (err) {
          finishReject(new Error(`Lỗi giải mã RX 80: ${(err as Error).message}`));
        }
      } else if (msg.command === -40) {
        try {
          const reader = new MyReader(msg.getData());
          const text = reader.readUTF();
          const lower = text.toLowerCase();
          if (
            lower.includes('đầy')
            || lower.includes('chật')
            || lower.includes('đã có người')
            || lower.includes('chậm lại')
            || lower.includes('chầm chậm')
          ) {
            finishReject(new Error(`Server từ chối vào khu (-40): ${text}`));
          }
        } catch {
          // ignore
        }
      }
    };
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ phản hồi vào khu (RX 80)'));
    }, timeoutMs);
  });
}

export class AutoFindNpc {
  private phase: AutoFindNpcPhase = 'idle';
  private running = false;
  private stopped = false;
  private config: FindNpcConfig;
  private currentMap: number | null = null;
  private currentBoard: number | null = null;
  private foundNpc: { id: number; name: string; map: number; board: number } | null = null;
  private waitingSeconds = 0;
  private eventRewardProgress: { current: number; max: number } | null = null;
  private lastRewardMessage: string | null = null;
  private dailyLimitReached = false;
  private cycleCount = 0;
  private cursor = 0;
  private totalRooms = 0;
  private timeoutStreak = 0;
  private lastError?: string;
  private settle?: () => void;
  private settled: Promise<void> = Promise.resolve();

  constructor(private readonly opts: AutoFindNpcOptions) {
    this.config = {
      ...DEFAULT_FIND_NPC_CONFIG,
      ...(opts.config ?? (opts.targetName ? { npcName: opts.targetName } : {})),
    };
  }

  state(): AutoFindNpcState {
    return {
      phase: this.phase,
      running: this.running,
      targetName: this.config.npcName,
      cursor: this.cursor,
      total: this.totalRooms,
      timeoutStreak: this.timeoutStreak,
      currentMap: this.currentMap,
      currentBoard: this.currentBoard,
      foundNpc: this.foundNpc,
      waitingSeconds: this.waitingSeconds,
      eventRewardProgress: this.eventRewardProgress,
      lastRewardMessage: this.lastRewardMessage,
      dailyLimitReached: this.dailyLimitReached,
      cycleCount: this.cycleCount,
      ...(this.lastError ? { lastError: this.lastError } : {}),
      updatedAt: Date.now(),
    };
  }

  updateConfig(newConfig: FindNpcConfig): void {
    this.config = { ...this.config, ...newConfig };
    this.emitState();
  }

  async start(overrideConfig?: FindNpcConfig): Promise<void> {
    if (this.running || this.stopped) return;
    if (overrideConfig) {
      this.config = { ...this.config, ...overrideConfig };
    }
    const targetName = this.config.npcName.trim();
    if (!targetName) {
      this.lastError = 'Tên NPC tìm kiếm không được để trống';
      this.emitState();
      return;
    }

    this.running = true;
    this.stopped = false;
    this.settled = new Promise<void>((resolve) => {
      this.settle = resolve;
    });

    this.phase = 'entering_park';
    this.emitState();
    this.log(`Bắt đầu tìm NPC "${targetName}"...`);

    void this.runLoop();
  }

  async stop(): Promise<void> {
    if (!this.running && !this.stopped) return;
    this.stopped = true;
    this.running = false;
    this.phase = 'stopping';
    this.emitState();
    await this.settled;
  }

  private emitState(): void {
    this.opts.onState?.(this.state());
  }

  private log(message: string): void {
    this.opts.onLog?.(message);
  }

  private async sleepWithCancel(ms: number): Promise<boolean> {
    const step = 200;
    let elapsed = 0;
    while (elapsed < ms) {
      if (this.stopped || !this.running) return false;
      const sleepTime = Math.min(step, ms - elapsed);
      await new Promise<void>((r) => setTimeout(r, sleepTime));
      elapsed += sleepTime;
    }
    return !this.stopped && this.running;
  }

  private async runLoop(): Promise<void> {
    try {
      // 1. Chuyển context sang Park và chờ ACK
      try {
        const parkAckPending = waitForParkHandlerResponse(this.opts.client, 5_000);
        this.opts.client.enterParkContext();
        await parkAckPending;
      } catch (err) {
        if (this.stopped) return;
        this.log(`Cảnh báo context park: ${(err as Error).message}`);
      }

      while (this.running && !this.stopped) {
        const fromMap = this.config.fromMap ?? DEFAULT_FIND_NPC_CONFIG.fromMap!;
        const toMap = this.config.toMap ?? DEFAULT_FIND_NPC_CONFIG.toMap!;
        const fromBoard = this.config.fromBoard ?? DEFAULT_FIND_NPC_CONFIG.fromBoard!;
        const toBoard = this.config.toBoard ?? DEFAULT_FIND_NPC_CONFIG.toBoard!;

        this.totalRooms = (toMap - fromMap + 1) * (toBoard - fromBoard + 1);
        this.cursor = 0;
        this.log(`Bắt đầu lượt quét chu kỳ #${this.cycleCount + 1}: Map ${fromMap}..${toMap}, Khu ${fromBoard}..${toBoard}`);

        const specialCapture = startMapSpecialCapture(this.opts.client);

        try {
          mapLoop: for (let m = fromMap; m <= toMap; m += 1) {
            if (this.stopped || !this.running || this.dailyLimitReached) break;
            const pos = getJoinPosition(m);

            for (let b = fromBoard; b <= toBoard; b += 1) {
              if (this.stopped || !this.running || this.dailyLimitReached) break mapLoop;

              this.cursor += 1;
              this.currentMap = m;
              this.currentBoard = b;
              this.phase = 'scanning';
              this.emitState();

              specialCapture.updates.length = 0;

              let snap: ParkJoinSnapshot | null = null;
              try {
                const joinPending = waitForParkJoinResponse(this.opts.client, 2_500, m, b);
                this.opts.client.sendRaw(80, [
                  { t: 'i8', v: String(m) },
                  { t: 'i8', v: String(b) },
                  { t: 'i16', v: String(pos.x) },
                  { t: 'i16', v: String(pos.y) },
                ]);
                snap = await joinPending;
                await new Promise<void>((r) => setTimeout(r, 150));
              } catch (err) {
                const msg = (err as Error).message;
                if (msg.includes('chầm chậm') || msg.includes('Chầm chậm')) {
                  await this.sleepWithCancel(1_500);
                }
              }

              if (this.stopped || !this.running || this.dailyLimitReached) break mapLoop;

              if (snap) {
                const npcMap = new Map<number, ParkNpc>();
                for (const n of snap.npcs) npcMap.set(n.id, n);
                for (const u of specialCapture.updates) {
                  if (
                    u.operation === 'upsert'
                    && u.name
                    && u.x !== undefined
                    && u.y !== undefined
                    && u.type !== undefined
                  ) {
                    npcMap.set(u.id, {
                      id: u.id,
                      name: u.name,
                      x: u.x,
                      y: u.y,
                      type: u.type,
                      menuIds: u.menuIds ?? [],
                    });
                  } else if (u.operation === 'remove') {
                    npcMap.delete(u.id);
                  }
                }

                const roomNpcs = Array.from(npcMap.values());
                const targetName = this.config.npcName.trim().toLowerCase();
                const match = roomNpcs.find(
                  (n) => n.name.trim().toLowerCase() === targetName,
                );

                if (match) {
                  this.foundNpc = { id: match.id, name: match.name, map: m, board: b };
                  this.phase = 'waiting_npc';
                  this.log(`🎯 Tìm thấy "${match.name}" (ID: ${match.id}) tại Map ${m} - Khu ${b}! Đứng lại nhận quà...`);
                  this.opts.onFound?.({ map: m, area: b, observedAt: Date.now() });
                  this.emitState();

                  await this.waitForNpcDeparture(m, b, match, pos);

                  this.foundNpc = null;
                  this.waitingSeconds = 0;
                  this.opts.onMissing?.();
                  this.emitState();

                  if (this.dailyLimitReached) {
                    break mapLoop;
                  }
                }
              }

              await this.sleepWithCancel(1_200);
            }
          }
        } finally {
          specialCapture.stop();
        }

        if (this.stopped || !this.running) break;

        if (this.dailyLimitReached) {
          this.log('Đã đạt giới hạn tối đa quà sự kiện trong ngày. Dừng tự động tìm NPC.');
          this.opts.onRequestStop?.('daily_limit', this.lastRewardMessage ?? 'Đã đạt giới hạn số lượng tối đa trong ngày');
          break;
        }

        // Hoàn thành 1 cycle, nghỉ giữa các chu kỳ
        this.cycleCount += 1;
        const delaySeconds = this.config.cycleDelaySeconds ?? DEFAULT_FIND_NPC_CONFIG.cycleDelaySeconds!;
        this.phase = 'waiting_next_cycle';
        this.emitState();
        this.log(`Đã hoàn thành lượt quét #${this.cycleCount}. Nghỉ ${delaySeconds}s trước lượt tiếp theo...`);

        const ok = await this.sleepWithCancel(delaySeconds * 1_000);
        if (!ok) break;
      }
    } catch (error) {
      if (!this.stopped) {
        this.lastError = (error as Error).message;
        this.phase = 'idle';
        this.running = false;
        this.emitState();
        this.opts.onRequestStop?.('error', this.lastError);
      }
    } finally {
      this.running = false;
      if (this.phase !== 'daily_limit_reached') {
        this.phase = 'idle';
      }
      this.emitState();
      this.settle?.();
    }
  }

  private waitForNpcDeparture(
    _roomId: number,
    _boardId: number,
    targetNpc: ParkNpc,
    _pos: NativeParkJoinPosition,
    maxWaitSeconds = 300,
  ): Promise<number> {
    const startTime = Date.now();

    return new Promise<number>((resolve) => {
      let settled = false;
      let heartbeatTimer: NodeJS.Timeout | undefined;
      let maxWaitTimer: NodeJS.Timeout | undefined;

      const cleanup = (): void => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (maxWaitTimer) clearTimeout(maxWaitTimer);
        this.opts.client.session.removeListener('message', onMessage);
        this.opts.client.removeListener('status', onStatus);
        this.opts.client.removeListener('dialog', onDialog);
      };

      const finish = (reason: string): void => {
        if (settled) return;
        settled = true;
        cleanup();
        const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
        this.log(`[RỜI KHU] ${reason} (sau ${elapsed}s)`);
        resolve(elapsed);
      };

      const onStatus = (status: ClientStatus): void => {
        if (status === 'error' || status === 'idle') {
          finish(`Mất kết nối game (status=${status})`);
        }
      };

      const onDialog = (text: string): void => {
        if (settled) return;
        const check = parseMaxQuantityDialog(text);
        if (check) {
          this.eventRewardProgress = { current: check.current, max: check.max };
          this.lastRewardMessage = text;
          this.emitState();

          if (check.isMax && this.config.stopOnMaxQuantity !== false) {
            this.dailyLimitReached = true;
            this.phase = 'daily_limit_reached';
            this.emitState();
            finish(`Đạt giới hạn số lượng tối đa (${check.current}/${check.max})`);
          }
        }
      };

      const onMessage = (msg: Message): void => {
        if (settled) return;
        if (this.stopped || !this.running) {
          finish('Nhận lệnh dừng bot');
          return;
        }

        // 1. RX 83 (PLAYER_LEAVE_PARK)
        if (msg.command === 83) {
          try {
            const reader = new MyReader(msg.getData());
            if (reader.available() >= 4) {
              const leaveId = reader.readInt();
              if (leaveId === targetNpc.id) {
                finish(`NPC ID ${leaveId} đã rời phòng (RX 83)`);
                return;
              }
            }
          } catch {
            // ignore
          }
        }

        // 2. RX 48 (ITEM_MAP_SPECIAL update remove)
        if (msg.command === 48) {
          try {
            const update = decodeMapSpecialUpdate(msg.getData());
            if (update.operation === 'remove' && update.id === targetNpc.id) {
              finish(`NPC ID ${update.id} đã bị gỡ khỏi map (RX 48)`);
              return;
            }
          } catch {
            // ignore
          }
        }
      };

      this.opts.client.session.on('message', onMessage);
      this.opts.client.on('status', onStatus);
      this.opts.client.on('dialog', onDialog);

      heartbeatTimer = setInterval(() => {
        if (settled) return;
        if (this.stopped || !this.running) {
          finish('Nhận lệnh dừng bot');
          return;
        }
        this.waitingSeconds = Math.floor((Date.now() - startTime) / 1000);
        this.emitState();
      }, 1_000);

      maxWaitTimer = setTimeout(() => {
        finish(`Hết thời gian chờ tối đa (${maxWaitSeconds}s)`);
      }, maxWaitSeconds * 1_000);
    });
  }
}
