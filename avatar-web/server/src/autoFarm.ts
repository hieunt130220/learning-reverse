import { EventEmitter } from 'node:events';

import { DEFAULT_SEED_CATALOG, XU_SEED_IDS } from './accounts/defaultSeedCatalog.js';
import {
  DEFAULT_FOOD_CATALOG,
  GROWN_PERCENT,
  ITEM_DIARRHEA_CURE,
  ITEM_FERTILIZER,
  ITEM_FLU_CURE,
  ITEM_TONIC,
  NEAR_DEATH_RATIO,
  SHOP_XU,
  SPECIES_SELL_NEAR_DEATH,
  SPECIES_SELL_WHEN_GROWN,
  foodForSpecies,
  isCellRipe,
  parseAnimalSpec,
  isCellSpent,
  type CookingState,
  type FoodRecipe,
} from './game/farmData.js';
import type {
  AnimalInfo,
  FarmCell,
  FarmState,
  InventoryItem,
  ItemInfo,
  TreeInfo,
} from './game/farmData.js';

export type TreeCellPlanEntry =
  | { cellIndex: number; action: 'seed'; seedId: number }
  | { cellIndex: number; action: 'skip' };

export type AnimalPlanEntry =
  | { slotIndex: number; action: 'breed'; speciesId: number }
  | { slotIndex: number; action: 'skip' };

export type KitchenPlanEntry =
  | { slotIndex: number; action: 'cook'; recipeId: number }
  | { slotIndex: number; action: 'skip' };

export interface AutoFarmConfig {
  /** Hạt để trồng lại ô trống. Bỏ trống = không trồng. */
  seedId?: number;
  /** Kế hoạch trồng riêng cho từng ô; không có entry thì dùng `seedId`. */
  treeCellPlan?: TreeCellPlanEntry[];
  /** ID vật phẩm tưới nước cố định (#100). */
  waterItemId?: number;
  /** ID vật phẩm nhổ cỏ cố định (#123). */
  grassItemId?: number;
  /** ID vật phẩm bắt sâu cố định (#124). */
  wormItemId?: number;
  /** Luôn thu hoạch ô đã chín. */
  harvest: boolean;
  /**
   * Luôn thu hoạch sản phẩm vật nuôi (trứng/sữa) khi `numEggOne > 0`.
   */
  harvestAnimals: boolean;
  harvestBarnAnimals?: boolean;
  harvestPondAnimals?: boolean;
  /**
   * Bán vật nuôi. **Mặc định TẮT vì bán là KHÔNG LẤY LẠI ĐƯỢC** — phải bật rõ
   * ràng. Xem `sellWhenGrownSpecies` / `sellNearDeathSpecies`.
   */
  sellAnimals: boolean;
  sellBarnAnimals?: boolean;
  sellPondAnimals?: boolean;
  /**
   * Loài bán ngay khi lớn — loài không có sản phẩm để thu, giữ lại chỉ tốn
   * thức ăn. Mặc định Heo 52 / Cá chép 54 / Rùa 59.
   */
  sellWhenGrownSpecies: number[];
  /**
   * Loài chỉ bán khi gần hết thời gian sống — loài có sản phẩm thu nhiều lần.
   * Mặc định Gà 50 / Bò 51 / Vịt 55.
   *
   * Đã chạy được: đo trên server thật thấy `bornTime` ĐẾM LÊN +1 mỗi 60 giây =
   * số phút kể từ lúc sinh, còn tuổi thọ nằm trong `desc` của bảng vật nuôi
   * ("Thời gian sống: 7 ngày"). Bán khi `bornTime >= tuổi thọ × nearDeathRatio`.
   */
  sellNearDeathSpecies: number[];
  sellBarnSpecies?: number[];
  sellPondSpecies?: number[];
  /** `harvestPer` tối thiểu để coi là đã lớn, dùng cho `sellWhenGrownSpecies`. */
  minGrowthToSell: number;
  /**
   * Sống quá tỉ lệ này của tuổi thọ thì coi là "gần hết thời gian sống".
   * 0.9 = còn 10% đời.
   */
  nearDeathRatio: number;
  /**
   * Trần số con bán mỗi vòng. Giữ nhỏ: bán là thao tác không đảo ngược, nếu
   * điều kiện bị hiểu sai thì trần này chặn thiệt hại lại ở vài con.
   */
  maxSellsPerCycle: number;
  /** Luôn cho vật nuôi đang đói ăn (thức ăn chọn theo loài). */
  feedAnimals: boolean;
  feedBarnAnimals?: boolean;
  feedPondAnimals?: boolean;
  /** Luôn dùng Thuốc bổ (#122) cho vật nuôi có máu dưới `minHealth`. Mỗi liều +20. */
  healAnimals: boolean;
  minHealth: number;
  /** Luôn dùng Phân bón siêu cấp (#112) cho ô có sức sống dưới `minVitality`. */
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
   * Chờ bấy nhiêu ms sau khi đăng nhập rồi mới chạy vòng đầu.
   *
   * `AvatarSession.onOnline` gọi `start()` ngay khoảnh khắc nhận LOGIN_SUCESS,
   * nên vòng đầu bắn `enterFarm` + `getInventory` vào lúc phiên chưa ổn định.
   * `tools/rate-test.ts` — công cụ đo nhịp gửi với server thật — cố ý chờ 4s sau
   * đăng nhập rồi 3s nữa "để phiên ổn định trước khi bắn"; ở đây làm điều tương
   * tự thay vì lao vào ngay.
   */
  startDelayMs: number;
  barnAnimalPlan?: AnimalPlanEntry[];
  pondAnimalPlan?: AnimalPlanEntry[];
  /** Kế hoạch món nấu cho từng ô bếp; không có entry thì dùng logic mặc định. */
  cookingSlotPlan?: KitchenPlanEntry[];

  // ---- Cấu hình Bếp nấu ăn (Cooking) --------------------------------------
  /** Tự động nấu ăn khi có ô bếp trống. */
  autoCook?: boolean;
  /** Tự động thu hoạch món ăn khi nấu chín. */
  autoHarvestCook?: boolean;
  /** Ưu tiên nấu các món theo tiến độ nhiệm vụ mở ô cuối. */
  prioritizeCookingMissions?: boolean;
  /** ID món ăn mặc định khi nấu tự động (0: Thức ăn gia súc, 1: Gia cầm...). */
  defaultRecipeId?: number;
}

export interface AutoFarmState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  /** Việc đã làm ở vòng gần nhất. */
  lastActions: string[];
}

export interface AutoFarmClient {
  status: string;
  farmState?: FarmState;
  cookingState?: CookingState;
  foods?: FoodRecipe[];
  inventory: InventoryItem[];
  produce?: InventoryItem[];
  items: ItemInfo[];
  trees: TreeInfo[];
  animals: AnimalInfo[];
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
  /** Chờ gói phản hồi `cmd` của lệnh vừa gửi; true = có gói, false = hết giờ. */
  waitForReply(cmd: number, timeoutMs: number): Promise<boolean>;
  enterFarm(): void;
  farm: {
    getInventory(): void;
    getTreeInfo(): void;
    getCook(step: number): void;
    cook(num: number, id: number): void;
    harvestCook(id: number): void;
    useItem(idFarm: number, index: number, idItem: number): void;
    harvest(idFarm: number, index: number): void;
    buyItem(id: number, num: number, typeShop: number): void;
    buyAnimal(idAnimal: number, typeBuy: number): void;
    plantSeed(idFarm: number, cellIndex: number, seedId: number): void;
    harvestAnimal(idFarm: number, index: number): void;
    sellAnimal(idFarm: number, index: number): void;
  };
}

export interface AutoFarmOptions {
  sleep?: (ms: number) => Promise<void>;
  catalogTimeout?: (signal: AbortSignal) => Promise<void>;
  /** Chờ phản hồi tối đa cho mỗi lệnh farm; hết giờ thì bỏ qua, không treo vòng. */
  commandTimeoutMs?: number;
  /** Session tự quyết định thời điểm đăng nhập cho vòng kế tiếp. */
  continuous?: boolean;
}

const ALWAYS_ON_CONFIG = {
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
} as const satisfies Partial<AutoFarmConfig>;

export const DEFAULT_AUTO_INTERVAL_MS = 300_000;

const DEFAULTS: AutoFarmConfig = {
  ...ALWAYS_ON_CONFIG,
  sellAnimals: false,
  sellWhenGrownSpecies: SPECIES_SELL_WHEN_GROWN,
  sellNearDeathSpecies: SPECIES_SELL_NEAR_DEATH,
  minGrowthToSell: GROWN_PERCENT,
  nearDeathRatio: NEAR_DEATH_RATIO,
  maxSellsPerCycle: 0,
  minHealth: 100,
  minVitality: 100,
  autoBuy: false,
  buyBudgetXu: 5_000,
  maxBuyPerItem: 50,
  stepDelayMs: 700,
  intervalMs: DEFAULT_AUTO_INTERVAL_MS,
  startDelayMs: 3_000,
};

/**
 * Vòng tự động chăm sóc nông trại: mỗi chu kỳ xin lại dữ liệu farm rồi quyết
 * định theo trạng thái thật của từng ô (`isArid`/`isGrass`/`isWorm`/`time`),
 * chứ không phát lệnh mù.
 *
 * Cố ý chỉ trồng theo `seedId`/`treeCellPlan`; các thao tác chăm sóc cơ bản dùng
 * policy luôn bật, còn bán vẫn phải được bật rõ ràng trong config (tự mua luôn bật, trần bán/chi không giới hạn).
 */
export class AutoFarm extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private aborted = true;
  private activeConfig: AutoFarmConfig = DEFAULTS;
  private pendingConfig?: AutoFarmConfig;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly catalogTimeout: (signal: AbortSignal) => Promise<void>;
  private readonly commandTimeoutMs: number;
  private readonly continuous: boolean;
  private cycle = 0;
  private lastRun?: number;
  private lastError?: string;
  private lastActions: string[] = [];
  /**
   * Đo `bornTime` giữa các vòng để biết nó đếm LÊN (đã sống được) hay XUỐNG
   * (còn sống được) — chưa xác định được từ gói tĩnh, mà đó là trường duy nhất
   * suy ra "gần hết thời gian sống". Key `index:species` vì `index` (= IDDB)
   * bị dồn lại sau mỗi lần bán. Không gửi gói tin nào: chỉ đọc dữ liệu farm mà
   * vòng nào cũng đã xin sẵn.
   */
  private bornProbe = new Map<string, { value: number; at: number }>();

  constructor(private readonly client: AutoFarmClient, options: AutoFarmOptions = {}) {
    super();
    this.wait = options.sleep ?? sleep;
    this.catalogTimeout = options.catalogTimeout ?? waitForCatalogTimeout;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 2_500;
    this.continuous = options.continuous ?? true;
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
    this.activeConfig = makeConfig(cfg);
    this.pendingConfig = undefined;
    this.aborted = false;
    this.cycle = 0;
    this.lastError = undefined;
    // Vòng đầu chờ phiên ổn định; các vòng sau đã cách nhau `intervalMs`.
    if (this.activeConfig.startDelayMs > 0) {
      this.timer = setTimeout(() => void this.runCycle(), this.activeConfig.startDelayMs);
    } else {
      void this.runCycle();
    }
  }

  queueConfig(cfg: Partial<AutoFarmConfig>): void {
    this.pendingConfig = makeConfig(cfg);
  }

  stop(): void {
    this.aborted = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.emit('state', this.state());
  }

  /**
   * Xin bảng cây (gói 76) nếu một trong ba bảng con (cây/vật phẩm/vật nuôi) còn
   * thiếu, rồi chờ cho tới khi có gói trả lời hoặc hết thời gian.
   *
   * Gói 76 ~13 KB đựng CẢ ba bảng, nên chỉ cần xin một lần là đủ cho mọi thứ:
   * giá vật phẩm (auto-buy), thời gian lớn của cây (thu hoạch/trồng), và `desc`
   * vật nuôi (bán). Đo trên server thật: server KHÔNG tự đẩy gói 76 sau
   * GET_HANDLER farm — phải gọi `getTreeInfo` thủ công.
   *
   * @returns true nếu hết thời gian chờ mà vẫn chưa có catalog.
   */
  private async fetchTreeCatalog(
    needed: boolean,
    note: (line: string) => void,
  ): Promise<boolean> {
    if (!needed) return false;
    if (this.client.trees.length > 0
      && this.client.items.length > 0
      && this.client.animals.length > 0) {
      return false;
    }
    let received = false;
    let onTrees = (): void => {};
    const timeout = new AbortController();
    const catalogEvent = new Promise<void>((resolve) => {
      onTrees = (): void => {
        received = true;
        resolve();
      };
      this.client.once('trees', onTrees);
    });
    // PHẢI gọi SAU enterFarm: server chỉ định tuyến lệnh farm sau GET_HANDLER,
    // gọi trước thì gói 76 rơi vào hư không.
    note('chờ catalog cây…');
    this.client.farm.getTreeInfo();
    await Promise.race([catalogEvent, this.catalogTimeout(timeout.signal)]);
    timeout.abort();
    if (!received) this.client.removeListener('trees', onTrees);
    return !received;
  }

  /**
   * Xin lại kho (cmd 70) và chờ gói trả về. Server KHÔNG tự đẩy gói 70 sau
   * doBuyItem (chỉ trả UPDATE_MONEY + echo 68 + dialog), nên mua xong phải gọi
   * thủ công thì các giai đoạn sau (trồng/chăm sóc) mới thấy hàng vừa mua.
   */
  private async refreshInventory(): Promise<void> {
    const fresh = new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 5000);
      this.client.once('inventory', () => {
        clearTimeout(t);
        resolve();
      });
    });
    this.client.farm.getInventory();
    await fresh;
  }

  private async runCycle(): Promise<void> {
    if (this.pendingConfig) {
      this.activeConfig = this.pendingConfig;
      this.pendingConfig = undefined;
    }
    const cfg = this.activeConfig;
    if (cfg.barnAnimalPlan?.length === 0) cfg.barnAnimalPlan = undefined;
    if (cfg.pondAnimalPlan?.length === 0) cfg.pondAnimalPlan = undefined;
    if (this.aborted) return;
    const actions: string[] = [];
    // Một nguồn, hai đích: panel Tự động đọc `lastActions`, còn nhật ký phiên
    // nhận sự kiện `log` để có mốc giờ thật và chạy live qua WebSocket.
    const note = (line: string): void => {
      actions.push(line);
      this.emit('log', line);
    };

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
      await this.refreshInventory();
      const idFarm = farm.idFarm;

      const plantingConfigured = cfg.seedId !== undefined
        || cfg.treeCellPlan?.some((entry) => entry.action === 'seed') === true;
      // Thu hoạch cần bảng cây: điều kiện chín là `time >= growHours × 60`.
      // Với DEFAULT_SEED_CATALOG, các cây mặc định luôn có sẵn thông tin thời gian lớn.
      // fetchTreeCatalog chỉ cần nếu bật bán vật nuôi hoặc mua vật phẩm tự động.
      const needTreeCatalog = cfg.sellAnimals || cfg.autoBuy;
      // Chỉ xin khi thiếu vật phẩm/vật nuôi — nếu đã có thì không tốn thêm gói nào.
      const treeCatalogTimedOut = await this.fetchTreeCatalog(
        needTreeCatalog,
        note,
      );
      const specs = new Map(
        this.client.animals.map((a) => [a.id, parseAnimalSpec(a.desc)] as const),
      );
      const { seedId, waterItemId, grassItemId, wormItemId, harvest, feedAnimals } = cfg;

      // Đếm số lệnh đã gửi để biết cuối vòng có cần xin lại dữ liệu farm không.
      let sent = 0;
      // Nhịp nghỉ dùng chung: sau mỗi lệnh gửi đi, và sau mỗi đối tượng đã duyệt
      // dù không gửi gì. `tick` chỉ chờ; việc dừng vòng do `this.aborted` ở đầu
      // mỗi lượt lặp lo.
      const tick = (): Promise<void> => this.wait(cfg.stepDelayMs);

      // Chờ xác nhận của từng lệnh (giới hạn `commandTimeoutMs`): server im lặng
      // không được phép treo vòng — ghi chú rồi vẫn đi tiếp.
      const confirm = async (cmd: number, label: string): Promise<void> => {
        const ok = await this.client.waitForReply(cmd, this.commandTimeoutMs);
        if (!ok) note(`server im lặng — chưa nhận xác nhận: ${label}`);
      };

      // --- Ảnh chụp những gì vòng này NHÌN THẤY ------------------------------
      // Ghi cả khi không làm gì. `lastActions` vốn chỉ liệt kê việc ĐÃ làm, nên
      // "không có gì để làm" và "có việc nhưng lệnh bị server bỏ qua" đều hiện
      // ra y hệt nhau: một danh sách rỗng. Hai dòng dưới tách bạch hai ca đó.
      // Giờ để lớn theo loại cây, lấy từ bảng cây (gói 76) kết hợp DEFAULT_SEED_CATALOG.
      // `TreeInfo.growMinutes` bị đặt sai tên: đơn vị là GIỜ.
      const growHours = new Map<number, number>([
        ...DEFAULT_SEED_CATALOG.map((s) => [s.id, s.growMinutes] as const),
        ...this.client.trees.map((t) => [t.id, t.growMinutes] as const),
      ]);
      const cellRipe = (c: FarmCell): boolean => isCellRipe(c, growHours.get(c.idTree));

      // KHÔNG viết `filter(isCellRipe)`: filter truyền cả chỉ số mảng vào tham số
      // thứ hai, biến vị trí ô thành "giờ để lớn" và làm ô non hoá chín.
      const ripe = farm.cells.filter((c) => cellRipe(c)).length;
      const emptyCells = farm.cells.filter((c) => c.idTree === -1).length;
      const spent = farm.cells.filter(isCellSpent).length;
      const sick = farm.animals.filter((a) => a.health < cfg.minHealth).length;
      const fluCount = farm.animals.filter((a) => a.hasFlu).length;
      const diarrheaCount = farm.animals.filter((a) => a.hasDiarrhea).length;
      const hungry = farm.animals.filter((a) => a.hunger).length;
      const withProduct = farm.animals.filter((a) => a.numEggOne > 0).length;
      const sellable = farm.animals.filter((a) => {
        const s = specs.get(a.species);
        if (!s) return false;
        if (cfg.sellWhenGrownSpecies.includes(a.species)) {
          return s.growMinutes !== undefined && a.bornTime >= s.growMinutes;
        }
        if (cfg.sellNearDeathSpecies.includes(a.species)) {
          if (s.lifeMinutes === undefined) return false;
          const remainingMinutes = s.lifeMinutes - a.bornTime;
          const cycle = s.productCycleMinutes ?? 360;
          if (a.numEggOne > 0) {
            return remainingMinutes - cycle <= 60;
          }
          return remainingMinutes <= 60;
        }
        return false;
      }).length;
      note(
        `[quét] ${farm.cells.length} ô: ${ripe} chín, ${emptyCells} trống, ${spent} vừa thu (time=-1) · ` +
          `${farm.animals.length} con: ${hungry} đói, ${sick} máu<${cfg.minHealth}, ` +
          `${fluCount} cúm, ${diarrheaCount} tiêu chảy, ` +
          `${withProduct} có sản phẩm, ${sellable} đủ lớn để bán`,
      );
      // Việc bị tắt bằng config trông hệt như việc bị lỗi — nói thẳng ra.
      const off: string[] = [];
      if (!harvest) off.push('thu hoạch ô');
      if (seedId === undefined) off.push('trồng (chưa chọn id hạt)');
      if (!cfg.harvestAnimals) off.push('thu sản phẩm vật nuôi');
      if (!cfg.sellAnimals) off.push('bán vật nuôi');
      if (!cfg.healAnimals) off.push('chữa bệnh');
      if (!feedAnimals) off.push('cho ăn');
      if (!cfg.fertilizeCells) off.push('bón phân');
      if (waterItemId === undefined) off.push('tưới (chưa chọn id)');
      if (off.length > 0) note(`[tắt] ${off.join(', ')}`);
      if (treeCatalogTimedOut) note('bỏ qua trồng: hết thời gian chờ catalog cây');

      // --- Đo bornTime ------------------------------------------------------
      // Dấu của delta trả lời trực tiếp: âm = đếm ngược (còn sống được bao
      // lâu), dương = đếm lên (đã sống được bao lâu). Kèm số giây thật giữa 2
      // lần đọc để suy ra đơn vị. Chỉ đọc, không gửi gói tin nào.
      const nowMs = Date.now();
      for (const a of farm.animals) {
        const key = `${a.index}:${a.species}`;
        const prev = this.bornProbe.get(key);
        if (prev && prev.value !== a.bornTime) {
          const delta = a.bornTime - prev.value;
          const secs = Math.round((nowMs - prev.at) / 1000);
          note(
            `[đo] vật nuôi ${a.index} (loài ${a.species}): bornTime ${prev.value} -> ${a.bornTime} ` +
              `(${delta > 0 ? '+' : ''}${delta} sau ${secs}s)`,
          );
        }
        this.bornProbe.set(key, { value: a.bornTime, at: nowMs });
      }

      // --- Tính nhu cầu vật phẩm cho vòng này -----------------------------
      // Bản đồ kế hoạch ô và bộ hạt đã biết dùng chung cho cả bước mua bù lẫn
      // giai đoạn trồng — hai bước phải nhìn cùng một sự thật.
      const planByCell = new Map(cfg.treeCellPlan?.map((entry) => [entry.cellIndex, entry]));
      const knownSeeds = new Set<number>([
        ...DEFAULT_SEED_CATALOG.map((s) => s.id),
        ...this.client.trees.map((tree) => tree.id),
      ]);
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
          // Thuốc cúm / tiêu chảy (#120 / #121): dùng cả 2 loại khi phát hiện vật nuôi bị bệnh.
          if (a.hasFlu || a.hasDiarrhea) {
            want(ITEM_FLU_CURE);
            want(ITEM_DIARRHEA_CURE);
          }
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

      // Hạt giống cho các ô sẽ trống trong vòng này: ô đang trống, hoặc ô chín
      // được thu hoạch khi bật `harvest`. Chỉ đếm hạt giai đoạn trồng thật sự
      // dùng (plan skip / hạt ngoài catalog / hạt cao cấp thì không), để
      // auto-buy mua đúng số thiếu thay vì bỏ qua như trước.
      const seedBuyableWithXu = (id: number): boolean => {
        const tree = this.client.trees.find((t) => t.id === id);
        if (tree !== undefined) return tree.category !== 'premium';
        return XU_SEED_IDS.has(id);
      };
      for (const c of farm.cells) {
        const plan = planByCell.get(c.index);
        const plannedSeedId = plan?.action === 'seed' ? plan.seedId : seedId;
        if (plan?.action === 'skip') continue;
        if (plannedSeedId === undefined || !knownSeeds.has(plannedSeedId)) continue;
        if (!seedBuyableWithXu(plannedSeedId)) continue;
        const willBeEmpty = c.idTree === -1 || (harvest && cellRipe(c));
        if (willBeEmpty) want(plannedSeedId);
      }

      // --- Mua bù phần thiếu ----------------------------------------------
      // Đi TRƯỚC các bước dùng vật phẩm (chữa bệnh/cho ăn) để có hàng trong
      // kho trước khi dùng — không đổi vị trí bước này.
      if (cfg.autoBuy && this.client.inventory.length === 0) {
        note('bỏ qua tự mua: chưa đọc được kho');
      } else if (cfg.autoBuy) {
        const have = new Map(this.client.inventory.map((i) => [i.id, i.num]));
        let spent = 0;
        for (const [id, qty] of need) {
          if (this.aborted) return;
            const short = qty - (have.get(id) ?? 0);
          if (short <= 0) continue;
          // Hạt không nằm trong bảng vật phẩm (chỉ có 11 món tiêu dùng 111–124)
          // — giá hạt lấy từ bảng cây (`value` = giá xu), fallback
          // DEFAULT_SEED_CATALOG khi chưa có bảng cây.
          const price = this.client.items.find((i) => i.id === id)?.price
            ?? this.client.trees.find((t) => t.id === id)?.value
            ?? DEFAULT_SEED_CATALOG.find((s) => s.id === id)?.value;
          if (price === undefined) {
            note(`bỏ mua #${id}: chưa biết giá`);
            continue;
          }
          const cost = short * price;
          if (spent + cost > cfg.buyBudgetXu) {
            note(`dừng mua #${id}: vượt trần ${cfg.buyBudgetXu} xu`);
            continue;
          }
          // num là i8 trên wire -> chia lô tối đa 100 mỗi lệnh.
          let left = Math.min(short, cfg.maxBuyPerItem);
          while (left > 0 && !this.aborted) {
            const lot = Math.min(left, 20);
            this.client.farm.buyItem(id, lot, SHOP_XU);
            sent += 1;
            note(`mua #${id} ×${lot} (~${lot * price} xu)`);
            left -= lot;
            await tick();
          }
          spent += cost;
        }
        if (spent > 0) {
          await tick();
          // Server không tự đẩy gói 70 sau khi mua — làm mới kho để giai đoạn
          // trồng cùng vòng thấy hạt vừa mua.
          await this.refreshInventory();
        }
      }

      // --- MUA VẬT NUÔI THEO KẾ HOẠCH --------------------------------------
      // Slot trống không có bản ghi trong `farm.animals` — muốn biết slot nào
      // trống phải đối chiếu với danh sách slot (farm.animalSlots) chứ không
      // phải duyệt animals.
      //
      // Phản hồi từ server:
      // - Mua THÀNH CÔNG: server gửi gói -3 (UPDATE_MONEY) với delta < 0 (trừ tiền).
      // - Mua THẤT BẠI / HẾT CHỖ / HẾT TIỀN: server gửi gói -40 (dialog) báo lỗi
      //   (ví dụ "Bạn không thể mua thêm vì nông trại đã hết chỗ.") hoặc timeout
      //   mà không trừ tiền. Khi bị từ chối thì dừng mua nhóm đó và sang task kế.
      //
      // Thứ tự: AO trước (slot nhỏ, đứng đầu mảng), CHUỒNG sau.
      if (cfg.pondAnimalPlan || cfg.barnAnimalPlan) {
        const pondBySlot = new Map(
          (cfg.pondAnimalPlan ?? [])
            .filter((e): e is AnimalPlanEntry & { action: 'breed' } => e.action === 'breed')
            .map((e) => [e.slotIndex, e]),
        );
        const barnBySlot = new Map(
          (cfg.barnAnimalPlan ?? [])
            .filter((e): e is AnimalPlanEntry & { action: 'breed' } => e.action === 'breed')
            .map((e) => [e.slotIndex, e]),
        );
        const planGroups: Array<[string, Map<number, AnimalPlanEntry>]> = [
          ['ao', pondBySlot],
          ['chuồng', barnBySlot],
        ];
        const occupied = new Set(farm.animals.map((a) => a.index));
        let boughtThisRound = 0;
        for (const [groupName, bySlot] of planGroups) {
          if (bySlot.size === 0) continue;
          const targets = [...bySlot.keys()]
            .sort((a, b) => a - b)
            .filter((slot) => Number.isInteger(slot) && slot >= 0 && !occupied.has(slot));
          for (const slot of targets) {
            if (this.aborted) return;
            const entry = bySlot.get(slot);
            if (entry === undefined || entry.action !== 'breed') continue;
            const speciesName = this.client.animals.find((x) => x.id === entry.speciesId)?.name
              ?? `loài ${entry.speciesId}`;

            // Lắng nghe phản hồi: tiền trừ (thành công) hoặc dialog -40 / timeout (thất bại).
            const buyResultPromise = new Promise<{ ok: boolean; reason?: string }>((resolve) => {
              let settled = false;
              let timer: NodeJS.Timeout | undefined;
              let onMoney: ((m: any) => void) | undefined;
              let onDialog: ((reason: string) => void) | undefined;
              let onFarm: (() => void) | undefined;

              const cleanup = () => {
                if (timer) clearTimeout(timer);
                if (onMoney) this.client.removeListener('money', onMoney);
                if (onDialog) this.client.removeListener('dialog', onDialog);
                if (onFarm) this.client.removeListener('farm', onFarm);
              };

              const finish = (result: { ok: boolean; reason?: string }) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(result);
              };

              timer = setTimeout(() => {
                finish({ ok: false, reason: 'hết thời gian chờ phản hồi mua vật nuôi' });
              }, 2000);

              onMoney = (m: any) => {
                if (m && typeof m.delta === 'number' && m.delta < 0) {
                  finish({ ok: true });
                }
              };

              onFarm = () => {
                const currentCount = this.client.farmState?.animals.length ?? 0;
                if (currentCount > farm.animals.length) {
                  finish({ ok: true });
                }
              };

              onDialog = (reason: string) => {
                finish({ ok: false, reason });
              };

              this.client.once('money', onMoney);
              this.client.once('dialog', onDialog);
              this.client.once('farm', onFarm);
            });

            this.client.farm.buyAnimal(entry.speciesId, SHOP_XU);
            sent += 1;

            const buyResult = await buyResultPromise;
            if (buyResult.ok) {
              boughtThisRound += 1;
              note(`mua vật nuôi ${groupName} slot ${slot}: ${speciesName} (#${entry.speciesId})`);
              occupied.add(slot);
              // Cập nhật danh sách vật nuôi cục bộ để các vòng / slot sau nhận diện đúng
              if (!farm.animals.some((a) => a.index === slot)) {
                farm.animals.push({
                  index: slot,
                  species: entry.speciesId,
                  bornTime: 0,
                  health: 100,
                  harvestPer: 0,
                  numEggOne: 0,
                  hunger: false,
                  hasFlu: false,
                  hasDiarrhea: false,
                });
              }
              const added = this.client.farmState?.animals.filter(
                (a) => !farm.animals.some((x) => x.index === a.index),
              ) ?? [];
              for (const a of added) occupied.add(a.index);
              await tick();
            } else {
              const detail = buyResult.reason ? ` (${buyResult.reason})` : '';
              note(`dừng mua vật nuôi ${groupName}: server từ chối sau slot ${slot}${detail} — sang task kế`);
              break;
            }
          }
          if (this.aborted) return;
        }
        if (boughtThisRound === 0) {
          note('không còn slot trống theo kế hoạch vật nuôi');
        }
      }

      // --- GIAI ĐOẠN CÂY ----------------------------------------------------
      // Mỗi ô chạm đúng một lần, làm hết mọi việc của ô đó rồi mới sang ô sau.
      // Thu hoạch và trồng đi trước vì đó là mục đích chính của farm và không
      // phụ thuộc kho; chăm sóc ô là việc bảo trì nên xếp sau.
      const seedInventory = new Map(this.client.inventory.map((item) => [item.id, item.num]));
      for (const c of farm.cells) {
        if (this.aborted) return;
        const seen: string[] = [];
        const did: string[] = [];

        if (harvest && cellRipe(c)) {
          this.client.farm.harvest(idFarm, c.index);
          c.idTree = -1;
          sent += 1;
          // `hervestPer` thường là 0 kể cả trên ô chín, nên nói theo thời gian
          // lớn — số đó mới là căn cứ thật để quyết định thu.
          const need = growHours.get(c.idTree);
          seen.push(need === undefined ? `chín ${c.hervestPer}%` : `đủ tuổi ${c.time}/${need * 60} phút`);
          did.push('thu hoạch');
          await confirm(64, `thu hoạch ô ${c.index}`);
          await tick();
        }
        if (c.idTree === -1) {
          const plan = planByCell.get(c.index);
          const plannedSeedId = plan?.action === 'seed' ? plan.seedId : seedId;
          if (plan?.action === 'skip') {
            seen.push('trống');
            did.push('bỏ qua theo kế hoạch');
          } else if (plannedSeedId !== undefined && !knownSeeds.has(plannedSeedId)) {
            seen.push('trống');
            did.push(`bỏ qua hạt #${plannedSeedId} — không có trong catalog cây`);
          } else if (plannedSeedId !== undefined && (seedInventory.get(plannedSeedId) ?? 0) <= 0) {
            seen.push('trống');
            did.push(`bỏ qua — thiếu hạt #${plannedSeedId} trong kho`);
          } else if (plannedSeedId !== undefined) {
            this.client.farm.plantSeed(idFarm, c.index, plannedSeedId);
            seedInventory.set(plannedSeedId, (seedInventory.get(plannedSeedId) ?? 0) - 1);
            sent += 1;
            seen.push('trống');
            did.push(`trồng #${plannedSeedId}`);
            await confirm(66, `trồng #${plannedSeedId} ô ${c.index}`);
            await tick();
          }
        }
        if (c.isArid && waterItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, waterItemId);
          sent += 1;
          seen.push('hạn');
          did.push(`tưới #${waterItemId}`);
          await confirm(65, `tưới #${waterItemId} ô ${c.index}`);
          await tick();
        }
        if (c.isGrass && grassItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, grassItemId);
          sent += 1;
          seen.push('cỏ');
          did.push(`nhổ cỏ #${grassItemId}`);
          await confirm(65, `nhổ cỏ #${grassItemId} ô ${c.index}`);
          await tick();
        }
        if (c.isWorm && wormItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, wormItemId);
          sent += 1;
          seen.push('sâu');
          did.push(`bắt sâu #${wormItemId}`);
          await confirm(65, `bắt sâu #${wormItemId} ô ${c.index}`);
          await tick();
        }
        if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
          this.client.farm.useItem(idFarm, c.index, ITEM_FERTILIZER);
          sent += 1;
          seen.push(`sức sống ${c.vitalityPer}`);
          did.push('bón phân');
          await confirm(65, `bón phân ô ${c.index}`);
          await tick();
        }

        note(
          did.length > 0
            ? `[cây] ô ${c.index}: ${seen.join(', ')} -> ${did.join(', ')}`
            : `[cây] ô ${c.index}: không có việc`,
        );
        await tick();
      }

      // --- GIAI ĐOẠN VẬT NUÔI ------------------------------------------------
      // `index` là số SLOT trên server, không phải vị trí trong mảng: đo trên gói
      // 69 thật thì sau khi bán 4 con, server để lại 4 slot `-1` chứ KHÔNG dồn
      // mảng, và slot của các con còn lại giữ nguyên. Duyệt từ index CAO xuống
      // THẤP vì thế vẫn an toàn kể cả nếu server đổi ý và dồn mảng: bỏ phần tử
      // phía sau không xê dịch phần tử phía trước, nên index đọc từ ảnh chụp đầu
      // vòng luôn còn đúng.
      // Gộp cả bốn việc vào một lượt cũng sửa luôn một lỗi cũ: trước đây bán
      // chạy trước rồi chữa/cho ăn mới duyệt lại từ ảnh chụp cũ, nên sau một
      // lần bán là các lệnh sau đó trỏ nhầm con.
      const byIndexDesc = [...farm.animals].sort((x, y) => y.index - x.index);
      const inventoryMap = new Map(this.client.inventory.map((i) => [i.id, i.num]));
      let sold = 0;
      let noSpec = 0;

      for (const a of byIndexDesc) {
        if (this.aborted) return;
        const name = this.client.animals.find((x) => x.id === a.species)?.name ?? `loài ${a.species}`;
        const isPond = [54, 59].includes(a.species);
        const allowHarvest = isPond ? (cfg.harvestPondAnimals ?? cfg.harvestAnimals) : (cfg.harvestBarnAnimals ?? cfg.harvestAnimals);
        const allowFeed = isPond ? (cfg.feedPondAnimals ?? cfg.feedAnimals) : (cfg.feedBarnAnimals ?? cfg.feedAnimals);
        const allowSell = isPond ? (cfg.sellPondAnimals ?? cfg.sellAnimals) : (cfg.sellBarnAnimals ?? cfg.sellAnimals);
        const sellSpeciesList = isPond
          ? (cfg.sellPondSpecies ?? cfg.sellWhenGrownSpecies)
          : (cfg.sellBarnSpecies ?? cfg.sellWhenGrownSpecies);
        const seen: string[] = [];
        const did: string[] = [];

        // Thu sản phẩm (trứng/sữa): miễn phí và không phá huỷ gì. `numEggOne > 0`
        // = đang có sản phẩm chờ lấy — căn cứ: con Rùa (loài không có sản phẩm)
        // đo được `numEggOne = 0` dù `harvestPer` đã 100.
        const hadProduct = allowHarvest && a.numEggOne > 0;
        if (hadProduct) {
          this.client.farm.harvestAnimal(idFarm, a.index);
          sent += 1;
          seen.push(`${a.numEggOne} sản phẩm`);
          did.push('thu sản phẩm');
          await confirm(54, `thu sản phẩm ${name} slot ${a.index}`);
          await tick();
        }

        // Bán KHÔNG ĐẢO NGƯỢC ĐƯỢC: mặc định tắt, và khi bật vẫn chặn nhiều lớp
        // (chỉ đúng loài trong danh sách, phải đủ lớn, hoặc không kịp đợt sản phẩm tiếp theo).
        // Bỏ giới hạn trần số lượng con bán 1 vòng (hoặc maxSellsPerCycle <= 0 coi như không giới hạn).
        let didSell = false;
        const unconstrainedSell = cfg.maxSellsPerCycle <= 0 || !Number.isFinite(cfg.maxSellsPerCycle);
        if (allowSell && (unconstrainedSell || sold < cfg.maxSellsPerCycle)) {
          const whenGrown = sellSpeciesList.includes(a.species) || cfg.sellWhenGrownSpecies.includes(a.species);
          const nearDeath = cfg.sellNearDeathSpecies.includes(a.species);
          if (whenGrown || nearDeath) {
            // Thông số lấy từ mô tả trong bảng vật nuôi. Không có bảng thì KHÔNG
            // bán — thà bỏ lỡ một vòng còn hơn bán nhầm bằng phỏng đoán.
            const spec = specs.get(a.species);
            if (!spec) {
              noSpec += 1;
            } else {
              let why: string | undefined;
              if (whenGrown && spec.growMinutes !== undefined && a.bornTime >= spec.growMinutes && a.numEggOne <= 0) {
                why = `đã lớn (${fmtDays(a.bornTime)}/${fmtDays(spec.growMinutes)} tuổi lớn)`;
              } else if (nearDeath && spec.lifeMinutes !== undefined) {
                const remainingMinutes = spec.lifeMinutes - a.bornTime;
                const cycle = spec.productCycleMinutes ?? 360;
                if (hadProduct) {
                  // Vừa thu sản phẩm xong: kiểm tra có kịp đợt sản phẩm kế tiếp (cách >= 1h an toàn) không
                  if (remainingMinutes - cycle <= 60) {
                    why = `vừa thu xong, không kịp đợt kế tiếp (còn sống ${fmtDays(Math.max(0, remainingMinutes))} / chu kỳ ${(cycle / 60).toFixed(0)}h)`;
                  }
                } else if (a.numEggOne <= 0) {
                  // Đang không có sản phẩm: bán nếu còn sống <= 1h
                  if (remainingMinutes <= 60) {
                    why = `sắp chết dưới 1h (còn sống ${Math.max(0, remainingMinutes)} phút)`;
                  }
                }
              }
              if (why) {
                this.client.farm.sellAnimal(idFarm, a.index);
                sent += 1;
                sold += 1;
                didSell = true;
                did.push(`BÁN — ${why}`);
                await confirm(53, `bán ${name} slot ${a.index}`);
                await tick();
              }
            }
          }
        }

        if (!didSell) {
          // Thuốc bổ +20 máu mỗi liều (đo được 76 -> 96), dùng lặp tới khi đủ.
          if (cfg.healAnimals && a.health < cfg.minHealth) {
            let hp = a.health;
            let doses = 0;
            while (hp < cfg.minHealth && doses < 10) {
              this.client.farm.useItem(idFarm, a.index, ITEM_TONIC);
              sent += 1;
              hp += 20;
              doses += 1;
              await confirm(65, `thuốc bổ slot ${a.index}`);
              await tick();
            }
            seen.push(`máu ${a.health}`);
            did.push(`${doses} liều thuốc bổ (->~${hp})`);
          }
          // Thuốc cúm (#120) / tiêu chảy (#121): gửi cả 2 thuốc để đảm bảo chữa dứt điểm bệnh.
          if (cfg.healAnimals && (a.hasFlu || a.hasDiarrhea)) {
            const hasFluCure = (inventoryMap.get(ITEM_FLU_CURE) ?? 0) > 0;
            const hasDiarrheaCure = (inventoryMap.get(ITEM_DIARRHEA_CURE) ?? 0) > 0;
            this.client.farm.useItem(idFarm, a.index, ITEM_FLU_CURE);
            this.client.farm.useItem(idFarm, a.index, ITEM_DIARRHEA_CURE);
            sent += 2;
            seen.push(a.hasFlu && a.hasDiarrhea ? 'cúm + tiêu chảy' : a.hasFlu ? 'cúm' : 'tiêu chảy');
            did.push('chữa bệnh (#120 & #121)');
            if (!hasFluCure || !hasDiarrheaCure) {
              did.push('(lưu ý: cần bật Tự mua xu hoặc mua sẵn thuốc #120,#121 trong kho)');
            }
            await confirm(65, `chữa bệnh slot ${a.index}`);
            await tick();
          }
          // Thức ăn chọn theo loài. Kiểm chứng: useItem(farm, 0, 116) làm
          // hunger true -> false.
          if (allowFeed && a.hunger) {
            const food = foodForSpecies(a.species);
            if (food !== undefined) {
              this.client.farm.useItem(idFarm, a.index, food);
              sent += 1;
              seen.push('đói');
              did.push(`cho ăn #${food}`);
              await confirm(65, `cho ăn #${food} slot ${a.index}`);
              await tick();
            }
          }
        }

        note(
          did.length > 0
            ? `[vật nuôi] ${a.index} (${name}): ${seen.length > 0 ? `${seen.join(', ')} -> ` : ''}${did.join(', ')}`
            : `[vật nuôi] ${a.index} (${name}): không có việc`,
        );
        await tick();
      }

      if (cfg.sellAnimals && sold >= cfg.maxSellsPerCycle) {
        note(`đã đạt trần ${cfg.maxSellsPerCycle} con bán/vòng`);
      }
      if (noSpec > 0) {
        note(`bỏ qua bán ${noSpec} con: chưa có bảng vật nuôi để biết tuổi lớn/tuổi thọ`);
      }

      // ----------------------------------------------------------------------
      // GIAI ĐOẠN: BẾP NẤU ĂN (COOKING PHASE)
      // ----------------------------------------------------------------------
      const hasKitchenPlan = Array.isArray(cfg.cookingSlotPlan) && cfg.cookingSlotPlan.length > 0;
      if ((cfg.autoHarvestCook || cfg.autoCook || hasKitchenPlan) && !this.aborted) {
        // Xin dữ liệu bếp mới nhất nếu chưa có
        this.client.farm.getCook(0);
        await confirm(91, 'lấy thông tin bếp');
        await tick();

        const cookState = this.client.cookingState;
        if (cookState && cookState.slots.length > 0) {
          // 1. Tự động thu hoạch món chín
          if (cfg.autoHarvestCook !== false) {
            for (const slot of cookState.slots) {
              if (this.aborted) break;
              if (slot.idFood !== -1 && (slot.isDone || slot.remainTime <= 0)) {
                this.client.farm.harvestCook(slot.slot);
                sent += 1;
                note(`[bếp] thu hoạch món #${slot.idFood} ở ô ${slot.slot}`);
                slot.idFood = -1;
                slot.isDone = false;
                slot.remainTime = 0;
                await confirm(92, `thu hoạch món ô ${slot.slot}`);
                await tick();
              }
            }
          }

          // 2. Tự động nấu ăn cho các ô trống
          if (cfg.autoCook || hasKitchenPlan) {
            const foodCatalog: FoodRecipe[] = this.client.foods && this.client.foods.length > 0
              ? this.client.foods
              : DEFAULT_FOOD_CATALOG;
            const planBySlot = new Map<number, KitchenPlanEntry>(
              (cfg.cookingSlotPlan ?? []).map((entry) => [entry.slotIndex, entry]),
            );

            // Tổng hợp kho nguyên liệu hiện có (inventory + produce)
            const availableMaterials = new Map<number, number>();
            for (const item of [...this.client.inventory, ...(this.client.produce ?? [])]) {
              availableMaterials.set(item.id, (availableMaterials.get(item.id) ?? 0) + item.num);
            }

            for (const slot of cookState.slots) {
              if (this.aborted) break;
              if (slot.idFood !== -1 && !slot.isDone && slot.remainTime > 0) continue; // ô đang nấu, bỏ qua

              const planEntry = planBySlot.get(slot.slot);
              if (planEntry?.action === 'skip') {
                // Người dùng cài đặt "Không nấu" cho ô này -> bỏ qua
                continue;
              }

              // Xác định món cần nấu theo thứ tự ưu tiên
              let targetRecipe: FoodRecipe | undefined;

              // Ưu tiên 0: Kế hoạch món cho riêng ô bếp này
              if (planEntry && planEntry.action === 'cook') {
                targetRecipe = foodCatalog.find((f) => f.id === planEntry.recipeId);
              }

              // Ưu tiên 1: Nhiệm vụ mở ô bếp Master chưa hoàn thành
              if (!targetRecipe && cfg.prioritizeCookingMissions && cookState.missions.length > 0) {
                const pendingMission = cookState.missions.find((m) => !m.isDone && m.numCook < m.numNeed);
                if (pendingMission) {
                  targetRecipe = foodCatalog.find((f) => f.id === pendingMission.idFood);
                }
              }

              // Ưu tiên 2: Món mặc định theo config
              if (!targetRecipe && cfg.defaultRecipeId !== undefined) {
                targetRecipe = foodCatalog.find((f) => f.id === cfg.defaultRecipeId);
              }

              // Mặc định fallback: Món đầu tiên trong catalog nếu autoCook bật và không có plan
              if (!targetRecipe && cfg.autoCook && foodCatalog.length > 0) {
                targetRecipe = foodCatalog[0];
              }

              if (targetRecipe) {
                // Kiểm tra xem có đủ nguyên liệu không
                let canCook = true;
                for (const mat of targetRecipe.materials) {
                  const currentAmount = availableMaterials.get(mat.itemId) ?? 0;
                  if (currentAmount < mat.count) {
                    canCook = false;
                    break;
                  }
                }

                if (canCook) {
                  // Trừ nguyên liệu ảo để ô tiếp theo không tranh chấp
                  for (const mat of targetRecipe.materials) {
                    availableMaterials.set(mat.itemId, (availableMaterials.get(mat.itemId) ?? 0) - mat.count);
                  }

                  this.client.farm.cook(slot.slot, targetRecipe.id);
                  sent += 1;
                  note(`[bếp] nấu món "${targetRecipe.name}" ở ô ${slot.slot}`);
                  slot.idFood = targetRecipe.id;
                  slot.isDone = false;
                  slot.remainTime = targetRecipe.cookTimeMinutes * 60;
                  await confirm(91, `nấu món ô ${slot.slot}`);
                  await tick();
                } else {
                  note(`[bếp] ô ${slot.slot} thiếu nguyên liệu để nấu "${targetRecipe.name}"`);
                }
              }
            }
          }
        }
      }

      // Nếu trong chu kỳ có phát sinh lệnh làm thay đổi farm, làm mới lại farm
      // ở cuối chu kỳ để snapshot phản ánh chính xác trạng thái mới nhất.
      if (sent > 0 && !this.aborted) {
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

    this.emit('cycle-complete', this.state());
    if (!this.aborted && this.continuous) {
      this.timer = setTimeout(() => void this.runCycle(), cfg.intervalMs);
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const waitForCatalogTimeout = (signal: AbortSignal): Promise<void> => new Promise((resolve) => {
  const timer = setTimeout(resolve, 5_000);
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
});

function makeConfig(input: Partial<AutoFarmConfig>): AutoFarmConfig {
  const cfg: AutoFarmConfig = {
    ...DEFAULTS,
    ...input,
    ...ALWAYS_ON_CONFIG,
    // Tran ban/chi khong gioi han va luon tu mua khi thieu (bo setup tren UI).
    autoBuy: true,
    buyBudgetXu: Number.MAX_SAFE_INTEGER,
    maxSellsPerCycle: 0,
    sellWhenGrownSpecies: speciesList(input.sellWhenGrownSpecies, SPECIES_SELL_WHEN_GROWN),
    sellNearDeathSpecies: speciesList(input.sellNearDeathSpecies, SPECIES_SELL_NEAR_DEATH),
    treeCellPlan: validateTreeCellPlan(input.treeCellPlan),
    cookingSlotPlan: validateKitchenPlan(input.cookingSlotPlan),
  };
  if (!Number.isFinite(cfg.stepDelayMs) || cfg.stepDelayMs < 300) {
    throw new Error('stepDelayMs tối thiểu 300ms');
  }
  if (!Number.isFinite(cfg.maxSellsPerCycle) || cfg.maxSellsPerCycle < 0) {
    throw new Error('maxSellsPerCycle phải là số không âm');
  }
  return cfg;
}

function validateKitchenPlan(value: KitchenPlanEntry[] | undefined): KitchenPlanEntry[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('cookingSlotPlan phải là mảng');
  const seen = new Set<number>();
  return value.map((entry) => {
    if (!Number.isInteger(entry.slotIndex) || entry.slotIndex < 0) {
      throw new Error('slotIndex phải là số nguyên không âm');
    }
    if (seen.has(entry.slotIndex)) throw new Error(`ô bếp ${entry.slotIndex} bị lặp`);
    seen.add(entry.slotIndex);
    if (entry.action === 'skip') return { slotIndex: entry.slotIndex, action: 'skip' };
    if (entry.action !== 'cook' || !Number.isInteger(entry.recipeId) || entry.recipeId < 0) {
      throw new Error(`kế hoạch ô bếp ${entry.slotIndex} không hợp lệ`);
    }
    return { slotIndex: entry.slotIndex, action: 'cook', recipeId: entry.recipeId };
  });
}

function validateTreeCellPlan(value: TreeCellPlanEntry[] | undefined): TreeCellPlanEntry[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('treeCellPlan phải là mảng');
  const seen = new Set<number>();
  return value.map((entry) => {
    if (!Number.isInteger(entry.cellIndex) || entry.cellIndex < 0) {
      throw new Error('cellIndex phải là số nguyên không âm');
    }
    if (seen.has(entry.cellIndex)) throw new Error(`ô ${entry.cellIndex} bị lặp`);
    seen.add(entry.cellIndex);
    if (entry.action === 'skip') return { cellIndex: entry.cellIndex, action: 'skip' };
    if (entry.action !== 'seed' || !Number.isInteger(entry.seedId) || entry.seedId < 0) {
      throw new Error(`kế hoạch ô ${entry.cellIndex} không hợp lệ`);
    }
    return { cellIndex: entry.cellIndex, action: 'seed', seedId: entry.seedId };
  });
}

/** 2220 phút -> "1,5 ngày" — số ngày dễ đối chiếu với mô tả loài hơn số phút. */
const fmtDays = (minutes: number): string => `${(minutes / (24 * 60)).toFixed(1)} ngày`;

/** Lọc danh sách loài về mảng số thật; thứ không phải mảng mới rơi về mặc định. */
const speciesList = (v: unknown, fallback: number[]): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : fallback;
