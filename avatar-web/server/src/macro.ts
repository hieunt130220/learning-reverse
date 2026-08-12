import { EventEmitter } from 'node:events';

import type { GameClient } from './game/client.js';

export interface MacroStep {
  /** Tên method của FarmService, vd "harvest", "plantSeed". */
  action: string;
  args: unknown[];
  /** Chờ bao nhiêu ms sau bước này. */
  delayMs?: number;
}

export interface Macro {
  name: string;
  steps: MacroStep[];
  /** Lặp lại toàn bộ chuỗi sau bao nhiêu ms. 0 = chạy một lần. */
  intervalMs: number;
}

export interface MacroState {
  running: boolean;
  name?: string;
  cycle: number;
  lastRun?: number;
  lastError?: string;
}

/**
 * Chạy chuỗi action theo lịch. Cố ý giữ đơn giản và có delay giữa các bước:
 * server game xử lý tuần tự, dồn gói một lúc dễ bị bỏ qua hoặc bị coi là bất thường.
 */
export class MacroRunner extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private aborted = false;
  private current?: Macro;
  private cycle = 0;
  private lastRun?: number;
  private lastError?: string;

  constructor(private readonly client: GameClient) {
    super();
  }

  state(): MacroState {
    return {
      running: Boolean(this.current),
      name: this.current?.name,
      cycle: this.cycle,
      lastRun: this.lastRun,
      lastError: this.lastError,
    };
  }

  start(macro: Macro): void {
    if (!macro?.steps?.length) throw new Error('macro rỗng');
    this.stop();
    this.current = macro;
    this.aborted = false;
    this.cycle = 0;
    this.lastError = undefined;
    void this.runCycle();
  }

  stop(): void {
    this.aborted = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.current = undefined;
    this.emit('state', this.state());
  }

  private async runCycle(): Promise<void> {
    const macro = this.current;
    if (!macro || this.aborted) return;

    try {
      for (const step of macro.steps) {
        if (this.aborted) return;
        const fn = (this.client.farm as unknown as Record<string, unknown>)[step.action];
        if (typeof fn !== 'function') throw new Error(`không có action "${step.action}"`);
        (fn as (...a: unknown[]) => void).apply(this.client.farm, step.args ?? []);
        if (step.delayMs) await sleep(step.delayMs);
      }
      this.lastError = undefined;
    } catch (err) {
      this.lastError = (err as Error).message;
    }

    this.cycle += 1;
    this.lastRun = Date.now();
    this.emit('state', this.state());

    if (!this.aborted && macro.intervalMs > 0) {
      this.timer = setTimeout(() => void this.runCycle(), macro.intervalMs);
    } else {
      this.current = undefined;
      this.emit('state', this.state());
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
