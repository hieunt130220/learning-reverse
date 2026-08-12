import { EventEmitter } from 'node:events';

import {
  ITEM_FERTILIZER,
  ITEM_TONIC,
  SHOP_XU,
  foodForSpecies,
} from './game/farmData.js';
import type { GameClient } from './game/client.js';

export interface AutoFarmConfig {
  /** Hạt để trồng lại ô trống. Bỏ trống = không trồng. */
  seedId?: number;
  /** id vật phẩm tưới nước. Bỏ trống = không tưới. */
  waterItemId?: number;
  /** id vật phẩm nhổ cỏ. */
  grassItemId?: number;
  /** id vật phẩm bắt sâu. */
  wormItemId?: number;
  /** Có thu hoạch ô đã chín không. */
  harvest: boolean;
  /** Cho vật nuôi đang đói ăn (thức ăn chọn theo loài). */
  feedAnimals: boolean;
  /** Dùng Thuốc bổ (#122) cho vật nuôi có máu dưới `minHealth`. Mỗi liều +20. */
  healAnimals: boolean;
  minHealth: number;
  /** Dùng Phân bón siêu cấp (#112) cho ô có sức sống dưới `minVitality`. */
  fertilizeCells: boolean;
  minVitality: number;
  /**
   * Tự mua bù khi kho thiếu. CHỈ mua bằng xu (`typeShop = 1`) — loại tiền còn
   * lại (2) không dùng tự động vì chưa xác định là gì.
   */
  autoBuy: boolean;
  /** Trần chi tiêu mỗi vòng, tính bằng xu. Vượt thì dừng mua. */
  buyBudgetXu: number;
  /** Trần số lượng mua cho mỗi loại vật phẩm trong một vòng. */
  maxBuyPerItem: number;
  /** Nghỉ giữa 2 lệnh (ms). Đừng để quá thấp. */
  stepDelayMs: number;
  /** Chu kỳ quét lại (ms). */
  intervalMs: number;
  /**
   * Trần số lệnh farm gửi mỗi vòng (tưới/nhổ cỏ/bắt sâu/bón phân/thu hoạch/cho
   * ăn/chữa bệnh/mua, KHÔNG tính enterFarm/getInventory). Việc tồn đọng bị cắt
   * ở đây tự trôi sang vòng sau — farm còn tồn đọng nghĩa là `want`/điều kiện
   * vẫn đúng ở lần quét kế tiếp. Trần này tồn tại vì vòng đầu tiên sau khi bật
   * auto (nông trại có thể đã bỏ bê lâu ngày) có thể cần hàng chục/hàng trăm
   * lệnh liên tiếp — dồn hết vào một vòng là đúng thứ server phát hiện được
   * qua kiểm tra tần suất và ngắt kết nối.
   */
  maxActionsPerCycle: number;
}

export interface AutoFarmState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  /** Việc đã làm ở vòng gần nhất. */
  lastActions: string[];
}

const DEFAULTS: AutoFarmConfig = {
  harvest: true,
  feedAnimals: false,
  healAnimals: false,
  minHealth: 100,
  fertilizeCells: false,
  minVitality: 100,
  autoBuy: false,
  buyBudgetXu: 5_000,
  maxBuyPerItem: 50,
  stepDelayMs: 700,
  intervalMs: 120_000,
  maxActionsPerCycle: 20,
};

/**
 * Vòng tự động chăm sóc nông trại: mỗi chu kỳ xin lại dữ liệu farm rồi quyết
 * định theo trạng thái thật của từng ô (`isArid`/`isGrass`/`isWorm`/`time`),
 * chứ không phát lệnh mù.
 *
 * Cố ý CHỈ làm những việc được bật rõ ràng trong config — mặc định không trồng
 * và không dùng vật phẩm, để không tiêu tốn tài nguyên ngoài ý muốn.
 */
export class AutoFarm extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private aborted = true;
  private cfg: AutoFarmConfig = DEFAULTS;
  private cycle = 0;
  private lastRun?: number;
  private lastError?: string;
  private lastActions: string[] = [];

  constructor(private readonly client: GameClient) {
    super();
  }

  state(): AutoFarmState {
    return {
      running: !this.aborted,
      cycle: this.cycle,
      lastRun: this.lastRun,
      lastError: this.lastError,
      lastActions: this.lastActions,
    };
  }

  start(cfg: Partial<AutoFarmConfig>): void {
    if (this.client.status !== 'online') throw new Error('chưa đăng nhập');
    this.stop();
    this.cfg = { ...DEFAULTS, ...cfg };
    if (this.cfg.stepDelayMs < 300) throw new Error('stepDelayMs tối thiểu 300ms');
    this.aborted = false;
    this.cycle = 0;
    this.lastError = undefined;
    void this.runCycle();
  }

  stop(): void {
    this.aborted = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.emit('state', this.state());
  }

  private async runCycle(): Promise<void> {
    if (this.aborted) return;
    const actions: string[] = [];

    // Mất kết nối giữa chừng thì dừng hẳn thay vì quay vòng ném lỗi:
    // mọi lệnh sau đó đều fail, và tự đăng nhập lại là việc của người dùng
    // (server game đá phiên cũ khi đăng nhập chỗ khác).
    if (this.client.status !== 'online') {
      this.lastError = 'mất kết nối — đã dừng tự động';
      this.aborted = true;
      this.lastRun = Date.now();
      this.emit('state', this.state());
      return;
    }

    try {
      // Xin lại dữ liệu farm rồi chờ gói 69 về.
      const fresh = new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 5000);
        this.client.once('farm', () => {
          clearTimeout(t);
          resolve();
        });
      });
      this.client.enterFarm();
      await fresh;

      const farm = this.client.farmState;
      if (!farm) throw new Error('không lấy được dữ liệu farm');

      // Kho PHẢI mới trước khi tính nhu cầu: nếu đọc kho rỗng (vd server vừa
      // khởi động lại, chưa có gói 70 nào) thì auto-buy sẽ tưởng đang có 0 và
      // mua thừa toàn bộ. Xin lại kho và chờ phản hồi.
      const invFresh = new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 5000);
        this.client.once('inventory', () => {
          clearTimeout(t);
          resolve();
        });
      });
      this.client.farm.getInventory();
      await invFresh;
      const idFarm = farm.idFarm;
      const cfg = this.cfg;
      const { seedId, waterItemId, grassItemId, wormItemId, harvest, feedAnimals, stepDelayMs } = cfg;

      // Trần lệnh/vòng: việc bị cắt ở đây KHÔNG return khỏi runCycle (khác
      // this.aborted) — vòng vẫn kết thúc bình thường, phần tồn đọng tự xét
      // lại ở vòng sau vì điều kiện (isArid/hunger/health thấp/…) còn đúng
      // cho tới khi được xử lý.
      let sent = 0;
      const overBudget = () => sent >= cfg.maxActionsPerCycle;

      // --- Tính nhu cầu vật phẩm cho vòng này -----------------------------
      const need = new Map<number, number>();
      const want = (id: number, n = 1) => need.set(id, (need.get(id) ?? 0) + n);

      if (feedAnimals) {
        for (const a of farm.animals) {
          if (!a.hunger) continue;
          const f = foodForSpecies(a.species);
          if (f !== undefined) want(f);
        }
      }
      if (cfg.healAnimals) {
        for (const a of farm.animals) {
          // Mỗi liều Thuốc bổ +20 máu (đo được 76 -> 96).
          if (a.health < cfg.minHealth) want(ITEM_TONIC, Math.ceil((cfg.minHealth - a.health) / 20));
        }
      }
      if (cfg.fertilizeCells) {
        for (const c of farm.cells) {
          if (c.idTree !== -1 && c.vitalityPer < cfg.minVitality) want(ITEM_FERTILIZER);
        }
      }
      for (const c of farm.cells) {
        if (c.isGrass && grassItemId !== undefined) want(grassItemId);
        if (c.isWorm && wormItemId !== undefined) want(wormItemId);
      }

      // --- Mua bù phần thiếu ----------------------------------------------
      if (cfg.autoBuy && this.client.inventory.length === 0) {
        actions.push('bỏ qua tự mua: chưa đọc được kho');
      } else if (cfg.autoBuy) {
        const have = new Map(this.client.inventory.map((i) => [i.id, i.num]));
        let spent = 0;
        for (const [id, qty] of need) {
          if (this.aborted) return;
          if (overBudget()) break;
          const short = qty - (have.get(id) ?? 0);
          if (short <= 0) continue;
          const price = this.client.items.find((i) => i.id === id)?.price;
          if (price === undefined) {
            actions.push(`bỏ mua #${id}: chưa biết giá`);
            continue;
          }
          const cost = short * price;
          if (spent + cost > cfg.buyBudgetXu) {
            actions.push(`dừng mua #${id}: vượt trần ${cfg.buyBudgetXu} xu`);
            continue;
          }
          // num là i8 trên wire -> chia lô tối đa 100 mỗi lệnh.
          let left = Math.min(short, cfg.maxBuyPerItem);
          while (left > 0 && !this.aborted && !overBudget()) {
            const lot = Math.min(left, 20);
            this.client.farm.buyItem(id, lot, SHOP_XU);
            sent += 1;
            actions.push(`mua #${id} ×${lot} (~${lot * price} xu)`);
            left -= lot;
            await sleep(stepDelayMs);
          }
          spent += cost;
        }
        if (spent > 0) await sleep(stepDelayMs);
      }

      // Vật nuôi: địa chỉ hoá bằng vị trí trong danh sách (= IDDB), thức ăn
      // chọn theo loài. Kiểm chứng: useItem(farm, 0, 116) làm hunger true->false.
      if (feedAnimals) {
        for (const a of farm.animals) {
          if (this.aborted) return;
          if (overBudget()) break;
          if (!a.hunger) continue;
          const food = foodForSpecies(a.species);
          if (food === undefined) continue;
          this.client.farm.useItem(idFarm, a.index, food);
          sent += 1;
          actions.push(`vật nuôi ${a.index}: cho ăn #${food}`);
          await sleep(stepDelayMs);
        }
      }

      // Chữa bệnh: Thuốc bổ +20 máu/liều, dùng lặp tới khi đủ minHealth.
      if (cfg.healAnimals) {
        for (const a of farm.animals) {
          if (this.aborted) return;
          if (overBudget()) break;
          let hp = a.health;
          let doses = 0;
          while (hp < cfg.minHealth && doses < 10 && !overBudget()) {
            this.client.farm.useItem(idFarm, a.index, ITEM_TONIC);
            sent += 1;
            hp += 20;
            doses += 1;
            await sleep(stepDelayMs);
          }
          if (doses > 0) actions.push(`vật nuôi ${a.index}: ${doses} liều thuốc bổ (${a.health}->~${hp})`);
        }
      }

      for (const c of farm.cells) {
        if (this.aborted) return;
        if (overBudget()) break;

        if (c.isArid && waterItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, waterItemId);
          sent += 1;
          actions.push(`ô ${c.index}: tưới`);
          await sleep(stepDelayMs);
        }
        if (c.isGrass && grassItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, grassItemId);
          sent += 1;
          actions.push(`ô ${c.index}: nhổ cỏ`);
          await sleep(stepDelayMs);
        }
        if (c.isWorm && wormItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, wormItemId);
          sent += 1;
          actions.push(`ô ${c.index}: bắt sâu`);
          await sleep(stepDelayMs);
        }
        if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
          this.client.farm.useItem(idFarm, c.index, ITEM_FERTILIZER);
          sent += 1;
          actions.push(`ô ${c.index}: bón phân (sức sống ${c.vitalityPer})`);
          await sleep(stepDelayMs);
        }
        if (harvest && c.idTree !== -1 && c.time === 0) {
          this.client.farm.harvest(idFarm, c.index);
          sent += 1;
          actions.push(`ô ${c.index}: thu hoạch`);
          await sleep(stepDelayMs);
        }
        if (seedId !== undefined && c.idTree === -1) {
          this.client.farm.plantSeed(idFarm, c.index, seedId);
          sent += 1;
          actions.push(`ô ${c.index}: trồng #${seedId}`);
          await sleep(stepDelayMs);
        }
      }
      if (overBudget()) {
        actions.push(`đã đạt trần ${cfg.maxActionsPerCycle} lệnh/vòng — phần còn lại làm ở vòng sau`);
      }
      // Tưới nước KHÔNG được server đẩy kèm INFO_CELL, nên state cục bộ vẫn giữ
      // isArid cũ. Xin lại dữ liệu farm cuối vòng để UI phản ánh đúng thực tế.
      if (actions.length > 0 && !this.aborted) {
        const refreshed = new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 5000);
          this.client.once('farm', () => {
            clearTimeout(t);
            resolve();
          });
        });
        this.client.enterFarm();
        await refreshed;
      }
      this.lastError = undefined;
    } catch (err) {
      this.lastError = (err as Error).message;
      // Rớt kết nối giữa chu kỳ: dừng ngay thay vì để cờ `running` treo tới
      // lần quét sau.
      if (this.client.status !== 'online') {
        this.lastError = `mất kết nối giữa chu kỳ (${this.lastError}) — đã dừng tự động`;
        this.aborted = true;
      }
    }

    this.cycle += 1;
    this.lastRun = Date.now();
    this.lastActions = actions;
    this.emit('state', this.state());

    if (!this.aborted) {
      this.timer = setTimeout(() => void this.runCycle(), this.cfg.intervalMs);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
