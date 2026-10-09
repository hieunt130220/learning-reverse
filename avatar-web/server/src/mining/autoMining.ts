/**
 * autoMining.ts — Bộ điều phối tự động khai thác Kim Cương (Room 26) và Củi Khô (Room 22).
 *
 * Spec: docs/superpowers/specs/2026-09-17-tich-hop-khai-thac-go-da-web-auto-design.md
 * Plan: docs/superpowers/plans/2026-09-17-tich-hop-khai-thac-go-da-web-auto.md
 */

import type { GameClient } from '../game/client.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import {
  idleMiningRuntime,
  type MiningConfig,
  type MiningRuntimeState,
} from '../session/automationTypes.js';

export interface MiningTargetNode {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly type: number;
  readonly menuIds: number[];
  depleted: boolean;
}

export interface AutoMiningRunnerDeps {
  accountId: number;
  onStateChange?: (state: MiningRuntimeState) => void;
  onRequestStop?: (reason: 'no_tool' | 'low_energy' | 'depleted' | 'error' | 'stopped', message?: string) => void;
  onLog?: (message: string) => void;
}

export function isNoToolDialog(text: string): boolean {
  return /hết cuốc/i.test(text);
}

const ROOM_DIAMOND = 26;
const ROOM_WOOD = 22;
const ROOM_HUB = 17;

const SPAWN_POSITIONS: Readonly<Record<number, { x: number; y: number }>> = Object.freeze({
  [ROOM_DIAMOND]: Object.freeze({ x: 250, y: 45 }), // Gần mỏ kim cương 2000000028 (260, 32)
  [ROOM_WOOD]: Object.freeze({ x: 100, y: 100 }),
  [ROOM_HUB]: Object.freeze({ x: 100, y: 100 }),
});

function sanitizeCaption(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
}

function safeUtf(msg: Message): string {
  try {
    const reader = new MyReader(msg.getData());
    return reader.readUTF();
  } catch {
    return '';
  }
}

/**
 * Quét danh sách ItemMapSpecial từ snapshot RX 80.
 */
function parseSpecialsFromBuffer(body: Buffer): MiningTargetNode[] {
  const nodes: MiningTargetNode[] = [];
  const sig = Buffer.from([0x77, 0x35, 0x94]); // 2,000,000,000 range objectId
  let pos = 0;
  while (pos < body.length) {
    const idx = body.indexOf(sig, pos);
    if (idx === -1) break;
    const objPos = idx;
    const reader = new MyReader(body.subarray(objPos));
    try {
      const id = reader.readInt();
      const nlen = reader.readShort();
      let name = '';
      if (nlen > 0 && reader.available() >= nlen) {
        name = reader.readBytes(nlen).toString('utf8');
      }
      if (reader.available() < 10) break;
      const x = reader.readInt();
      const y = reader.readInt();
      const type = reader.readByte();
      const imgCount = reader.readByte();
      if (reader.available() < imgCount * 2 + 32 + 1) break;
      for (let j = 0; j < imgCount; j += 1) {
        reader.readShort();
      }
      reader.readBytes(32); // states
      const menuCount = reader.readByte();
      const menuIds: number[] = [];
      for (let m = 0; m < menuCount; m += 1) {
        if (reader.available() < 2) break;
        menuIds.push(reader.readShort());
      }
      // Chỉ nhận các đối tượng tài nguyên (type 2) có menu đào/chặt 1207
      if (type === 2 && menuIds.includes(1207)) {
        nodes.push({ id, name, x, y, type, menuIds, depleted: false });
      }
      pos = objPos + (body.length - objPos - reader.available());
    } catch {
      pos = idx + 4;
    }
  }
  return nodes;
}

export class AutoMiningRunner {
  private config: MiningConfig | null = null;
  private state: MiningRuntimeState = idleMiningRuntime();
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private readonly client: GameClient,
    private readonly deps: AutoMiningRunnerDeps,
  ) {}

  public getRuntimeState(): MiningRuntimeState {
    return { ...this.state };
  }

  public isRunning(): boolean {
    return this.running;
  }

  public updateConfig(config: MiningConfig): void {
    this.config = config;
  }

  public async start(config: MiningConfig): Promise<void> {
    if (this.running) return;
    this.config = config;
    this.running = true;
    this.abortController = new AbortController();
    this.state = {
      ...idleMiningRuntime(),
      status: 'navigating',
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

    try {
      // Đưa nhân vật quay về hub map 17 an toàn trước khi kết thúc
      const hubPos = SPAWN_POSITIONS[ROOM_HUB] ?? { x: 100, y: 100 };
      this.client.sendRaw(80, [
        { t: 'i8', v: String(ROOM_HUB) },
        { t: 'i8', v: '0' },
        { t: 'i16', v: String(hubPos.x) },
        { t: 'i16', v: String(hubPos.y) },
      ]);
    } catch {
      /* Bỏ qua nếu socket đã đóng */
    }

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
    this.deps.onStateChange?.(this.getRuntimeState());
  }

  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  private async runLoop(signal: AbortSignal): Promise<void> {
    if (!this.config) return;

    // 1. Chuyển sang ngữ cảnh Park (Handler 9)
    try {
      this.client.enterParkContext();
    } catch {
      // Tiếp tục nếu đã ở trong park
    }
    await this.sleep(1500, signal);
    if (signal.aborted || !this.running) return;

    // Xác định map ban đầu theo cấu hình
    let currentTargetMap = this.config.target === 'wood' ? ROOM_WOOD : ROOM_DIAMOND;
    let currentArea =
      this.config.target === 'wood' && this.config.startArea === 0
        ? 1 // Khu 0 của Rừng gỗ là sảnh nghỉ
        : this.config.startArea;

    while (this.running && !signal.aborted) {
      // 2. Join vào Map mục tiêu
      this.state = {
        ...this.state,
        status: 'navigating',
        currentMap: currentTargetMap,
        currentArea,
      };
      this.emitState();

      const spawn = SPAWN_POSITIONS[currentTargetMap] ?? { x: 100, y: 100 };
      const joinPending = this.waitForMapSnapshot(signal, currentTargetMap, 6000);
      this.client.sendRaw(80, [
        { t: 'i8', v: String(currentTargetMap) },
        { t: 'i8', v: String(currentArea) },
        { t: 'i16', v: String(spawn.x) },
        { t: 'i16', v: String(spawn.y) },
      ]);

      const nodes = await joinPending;
      if (signal.aborted || !this.running) return;

      this.state = {
        ...this.state,
        status: 'scanning_nodes',
      };
      this.emitState();

      // Nếu khu không có mỏ hoặc các mỏ đều cạn
      const activeNodes = nodes.filter((n) => !n.depleted);
      if (activeNodes.length === 0) {
        if (!this.config.switchAreaWhenDepleted) {
          this.state = {
            ...this.state,
            status: 'stopped',
            lastMessage: `Khu ${currentArea} không có tài nguyên. Đã dừng theo cấu hình.`,
          };
          this.emitState();
          this.running = false;
          return;
        }

        // Chuyển khu tiếp theo
        this.state = {
          ...this.state,
          status: 'switching_area',
          lastMessage: `Khu ${currentArea} đã cạn. Đang chuyển khu...`,
        };
        this.emitState();

        const maxAreas = Math.min(this.config.maxAreasToScan, 10);
        if (currentTargetMap === ROOM_WOOD) {
          currentArea = (currentArea % (maxAreas - 1)) + 1; // 1..9
        } else {
          currentArea = (currentArea + 1) % maxAreas; // 0..9
        }

        await this.sleep(2000, signal);
        continue;
      }

      // 3. Khai thác từng đối tượng trong khu
      for (const node of activeNodes) {
        if (!this.running || signal.aborted) break;

        this.state = {
          ...this.state,
          status: 'mining',
          currentNodeId: node.id,
        };
        this.emitState();

        // Bước 3.1: Gửi menuIndex = 0 một lần để lấy tên mỏ và sản lượng ban đầu
        const infoPending = this.waitForMiningResult(signal, 3000);
        this.client.sendRaw(48, [
          { t: 'i8', v: '3' },
          { t: 'i32', v: String(node.id) },
          { t: 'i8', v: '0' },
        ]);
        const infoResult = await infoPending;
        if (!this.running || signal.aborted) break;
        for (const d of infoResult.dialogs) {
          if (isNoToolDialog(d)) {
            this.state = {
              ...this.state,
              status: 'paused_no_tool',
              lastMessage: `Tạm dừng: ${d}`,
            };
            this.emitState();
            this.running = false;
            this.deps.onRequestStop?.('no_tool', d);
            return;
          }
          const parsed = this.parseHarvestMessage(d);
          if (parsed) {
            this.state = {
              ...this.state,
              currentNodeName: parsed.nodeName,
              resourceName: parsed.resourceName,
              remainingCapacity: parsed.remaining,
              maxCapacity: parsed.max,
              lastMessage: d,
            };
            this.emitState();
            if (parsed.remaining === 0) {
              node.depleted = true;
              break;
            }
          }
        }
        if (node.depleted) continue;

        await this.sleep(1000, signal);

        // Bước 3.2: Gửi menuIndex = 1 để THỰC HIỆN ĐÀO / THU HOẠCH TÀI NGUYÊN
        let nodeDepleted = false;
        while (this.running && !signal.aborted && !nodeDepleted) {
          const outcomePending = this.waitForMiningResult(signal, 5000);
          this.client.sendRaw(48, [
            { t: 'i8', v: '3' },
            { t: 'i32', v: String(node.id) },
            { t: 'i8', v: '1' }, // MENU 1 = KHAI THÁC THỰC TẾ
          ]);

          const result = await outcomePending;
          if (!this.running || signal.aborted) break;

          let batchHarvestCount = 0;
          for (const dialog of result.dialogs) {
            this.state = {
              ...this.state,
              lastMessage: dialog,
            };

            // 1. Thu hoạch thành công
            if (/thu hoạch được/i.test(dialog)) {
              batchHarvestCount += 1;
              if (this.state.remainingCapacity && this.state.remainingCapacity > 0) {
                this.state.remainingCapacity -= 1;
              }
            }

            // 2. Kiểm tra mỏ cạn
            if (/cạn|hết sản lượng|không còn/i.test(dialog)) {
              nodeDepleted = true;
              node.depleted = true;
            }

            // 3. Kiểm tra lỗi thiếu công cụ (chỉ bắt từ hết cuốc theo yêu cầu)
            if (isNoToolDialog(dialog)) {
              this.state = {
                ...this.state,
                status: 'paused_no_tool',
                lastMessage: `Tạm dừng: ${dialog}`,
              };
              this.emitState();
              this.running = false;
              this.deps.onRequestStop?.('no_tool', dialog);
              return;
            }

            // 4. Kiểm tra lỗi cạn năng lượng
            if (/sức khỏe|năng lượng|nghỉ ngơi/i.test(dialog)) {
              this.state = {
                ...this.state,
                status: 'paused_low_energy',
                lastMessage: `Tạm dừng: ${dialog}`,
              };
              this.emitState();
              this.running = false;
              return;
            }
          }

          if (batchHarvestCount > 0) {
            this.state = {
              ...this.state,
              sessionHarvestCount: this.state.sessionHarvestCount + batchHarvestCount,
            };
            this.emitState();
          }

          if (result.dialogs.length === 0 && !result.hasUpdate) {
            // Không nhận được phản hồi tiếp, kết thúc node
            break;
          }

          if (this.state.remainingCapacity !== null && this.state.remainingCapacity <= 0) {
            nodeDepleted = true;
            node.depleted = true;
            break;
          }

          // Khoảng cách an toàn giữa các lượt đào
          const jitter = Math.floor(Math.random() * 500);
          const delay = Math.max(2500, this.config.delayBetweenActionsMs) + jitter;
          await this.sleep(delay, signal);
        }
      }

      // Khi đã duyệt hết các mỏ trong khu hiện tại, đổi khu nếu được bật
      if (this.config.switchAreaWhenDepleted && this.running && !signal.aborted) {
        this.state = {
          ...this.state,
          status: 'switching_area',
          lastMessage: `Đã khai thác xong khu ${currentArea}. Chuyển khu tiếp theo...`,
        };
        this.emitState();

        const maxAreas = Math.min(this.config.maxAreasToScan, 10);
        if (currentTargetMap === ROOM_WOOD) {
          currentArea = (currentArea % (maxAreas - 1)) + 1;
        } else {
          currentArea = (currentArea + 1) % maxAreas;
        }

        // Nếu là chế độ tuần tra và đã duyệt hết khu, chuyển sang map còn lại
        if (this.config.target === 'patrol' && currentArea === 0) {
          currentTargetMap = currentTargetMap === ROOM_DIAMOND ? ROOM_WOOD : ROOM_DIAMOND;
          currentArea = currentTargetMap === ROOM_WOOD ? 1 : 0;
        }

        await this.sleep(2000, signal);
      } else if (!this.config.switchAreaWhenDepleted) {
        break;
      }
    }
  }

  private parseHarvestMessage(text: string): {
    nodeName: string;
    resourceName: string;
    remaining: number;
    max: number;
  } | null {
    // Định dạng: "KIM CƯƠNG  Thu hoạch : Kim Cương Trắng  Sản lượng : 3000/3000"
    // hoặc: "THÂN CÂY KHÔ  Thu hoạch : Củi Khô  Sản lượng : 3688/4000"
    const match = text.match(/(.+?)\s+Thu hoạch\s*:\s*(.+?)\s+Sản lượng\s*:\s*(\d+)\/(\d+)/i);
    if (!match) return null;
    return {
      nodeName: match[1]!.trim(),
      resourceName: match[2]!.trim(),
      remaining: Number(match[3]),
      max: Number(match[4]),
    };
  }

  private waitForMapSnapshot(
    signal: AbortSignal,
    expectedRoom: number,
    timeoutMs: number,
  ): Promise<MiningTargetNode[]> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const cleanup = (): void => {
        this.client.session.removeListener('message', onMessage);
        signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
      };

      const finish = (nodes: MiningTargetNode[]): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(nodes);
      };

      const onMessage = (msg: Message): void => {
        if (msg.command !== 80) return;
        const body = msg.getData();
        if (body.length < 6) return;
        const roomId = body.readInt8(0);
        if (roomId !== expectedRoom) return;

        const nodes = parseSpecialsFromBuffer(body);
        finish(nodes);
      };

      const onAbort = (): void => finish([]);

      this.client.session.on('message', onMessage);
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => finish([]), timeoutMs);
    });
  }

  private waitForMiningResult(
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<{ dialogs: string[]; hasUpdate: boolean }> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      let debounceTimer: NodeJS.Timeout | undefined;
      const dialogs: string[] = [];
      let hasUpdate = false;

      const cleanup = (): void => {
        this.client.session.removeListener('message', onMessage);
        signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
        if (debounceTimer) clearTimeout(debounceTimer);
      };

      const finish = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ dialogs, hasUpdate });
      };

      const onMessage = (msg: Message): void => {
        const cmd = msg.command;
        if (cmd === -40) {
          try {
            const text = sanitizeCaption(safeUtf(msg));
            if (text) dialogs.push(text);
          } catch {}
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(finish, 800);
        } else if (cmd === 48 || cmd === 70) {
          hasUpdate = true;
        }
      };

      const onAbort = (): void => finish();

      this.client.session.on('message', onMessage);
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(finish, timeoutMs);
    });
  }
}
