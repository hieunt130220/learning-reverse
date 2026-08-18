import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/**
 * Port của `FarmService` (Assembly-CSharp).
 *
 * Width của từng field lấy từ disassembly thân hàm (tools/pktsig.py), KHÔNG
 * lấy từ chữ ký C# — chữ ký khai `int` nhưng nhiều chỗ `writeByte` thật.
 * Ví dụ doPlantSeed(int,int,int) nhưng trên wire là i32,i8,i8.
 *
 * cmd 91 (COOKING) và 103 (OPEN_SHOP_FARM) là lệnh ghép: byte đầu là sub-type.
 */
export class FarmService {
  constructor(private readonly session: Session) {}

  private send(cmd: number, build?: (m: Message) => void): void {
    const m = Message.create(cmd);
    build?.(m);
    this.session.send(m);
  }

  // ---- vào farm & lấy dữ liệu -------------------------------------------

  /** doJoinFarm @0x5d0c08 — vào nông trại của idUser (của mình hoặc bạn bè). */
  joinFarm(idUser: number): void {
    this.send(69, (m) => m.writer!.writeInt(idUser));
  }

  /** getInventory @0x5d0bac — kho vật phẩm. */
  getInventory(): void {
    this.send(70);
  }

  /** getTreeInfo @0x5d09dc — bảng thông tin cây trồng. */
  getTreeInfo(): void {
    this.send(76);
  }

  /** getInfoFarm @0x5d3f50 */
  getInfoFarm(type: number): void {
    this.send(104, (m) => m.writer!.writeByte(type));
  }

  /** getInfoUpgradeFarm @0x5d405c */
  getInfoUpgradeFarm(type: number, step: number): void {
    this.send(104, (m) => m.writer!.writeByte(type).writeByte(step));
  }

  // ---- thao tác trên ô đất ----------------------------------------------

  /** doPlantSeed @0x5d1290 — trồng hạt vào ô. */
  plantSeed(idUser: number, indexCell: number, idSeed: number): void {
    this.send(66, (m) => m.writer!.writeInt(idUser).writeByte(indexCell).writeByte(idSeed));
  }

  /** doHervest @0x5d1548 — thu hoạch ô. */
  harvest(idFarm: number, indexCell: number): void {
    this.send(64, (m) => m.writer!.writeInt(idFarm).writeByte(indexCell));
  }

  /**
   * doUsingItem @0x5d13ec — dùng vật phẩm lên 1 ô: tưới nước, nhổ cỏ, bắt sâu,
   * bón phân đều đi qua đây với idItem khác nhau.
   */
  useItem(idUser: number, indexCell: number, idItem: number): void {
    this.send(65, (m) => m.writer!.writeInt(idUser).writeByte(indexCell).writeShort(idItem));
  }

  /** doOpenLand @0x5d1684 — mở rộng đất. */
  openLand(idFarm: number, typeBuy: number): void {
    this.send(60, (m) => m.writer!.writeInt(idFarm).writeByte(typeBuy));
  }

  /** doRequestPricePlant @0x5d17c0 */
  requestPricePlant(idFarm: number): void {
    this.send(61, (m) => m.writer!.writeInt(idFarm));
  }

  // ---- chợ / kho ---------------------------------------------------------

  /** doBuyItem @0x5d0d18 */
  buyItem(id: number, num: number, typeShop: number): void {
    this.send(68, (m) => m.writer!.writeShort(id).writeByte(num).writeByte(typeShop));
  }

  /** doSellItem @0x5d1154 */
  sellItem(idItem: number, num: number): void {
    this.send(67, (m) => m.writer!.writeShort(idItem).writeInt(num));
  }

  // ---- vật nuôi ----------------------------------------------------------

  /** doHarvestAnimal @0x5d18d0 */
  harvestAnimal(idFarm: number, index: number): void {
    this.send(54, (m) => m.writer!.writeInt(idFarm).writeByte(index));
  }

  /** doBuyAnimal @0x5d1b68 */
  buyAnimal(idAnimal: number, typeBuy: number): void {
    this.send(51, (m) => m.writer!.writeByte(idAnimal).writeByte(typeBuy));
  }

  /** doSellAnimal @0x5d1a2c */
  sellAnimal(idFarm: number, iddb: number): void {
    this.send(53, (m) => m.writer!.writeInt(idFarm).writeByte(iddb));
  }

  /** doRequestPriceAnimal @0x5d1dd0 */
  requestPriceAnimal(idFarm: number, iddb: number): void {
    this.send(52, (m) => m.writer!.writeInt(idFarm).writeByte(iddb));
  }

  // ---- bếp (cmd 91, byte đầu = sub-type) --------------------------------

  /** getCook @0x5d2730 */
  getCook(step: number): void {
    this.send(91, (m) => m.writer!.writeByte(step));
  }

  /** doCooking @0x5d2994 — sub-type 1. */
  cook(num: number, id: number): void {
    this.send(91, (m) => m.writer!.writeByte(1).writeByte(num).writeShort(id));
  }

  /** doHarvestCook @0x5d2c10 — sub-type 2. */
  harvestCook(id: number): void {
    this.send(91, (m) => m.writer!.writeByte(2).writeByte(id));
  }

  /** doOpenSlot @0x5d2d30 — sub-type 3. */
  openCookSlot(): void {
    this.send(91, (m) => m.writer!.writeByte(3));
  }

  /** doFastCook @0x5d283c — sub-type 4. */
  fastCook(step: number, num: number): void {
    this.send(91, (m) => m.writer!.writeByte(4).writeByte(step).writeByte(num));
  }

  /** doOpenLastSlot @0x5d2e3c — sub-type 5. */
  openLastCookSlot(): void {
    this.send(91, (m) => m.writer!.writeByte(5));
  }

  /** nauNhanh @0x5d2b10 */
  nauNhanh(step: number): void {
    this.send(93, (m) => m.writer!.writeByte(step));
  }

  // ---- ăn trộm -----------------------------------------------------------

  /** doStealInfo @0x5d2fa4 */
  stealInfo(): void {
    this.send(95);
  }

  /** doSteal @0x5d3000 */
  steal(step: number): void {
    this.send(96, (m) => m.writer!.writeByte(step));
  }

  /** doStealStore @0x5d3110 */
  stealStore(): void {
    this.send(97);
  }

  /** doLichSuAnTrom @0x5d316c */
  stealHistory(): void {
    this.send(98);
  }

  // ---- nâng cấp ----------------------------------------------------------

  /** doUpdateFarm @0x5d20b4 — nâng chuồng. */
  updateCattle(type: number, typeMoney: number): void {
    this.send(102, (m) => m.writer!.writeByte(type).writeByte(typeMoney));
  }

  /** doUpdateFish @0x5d21f8 — nâng ao cá. */
  updateFish(type: number, typeMoney: number): void {
    this.send(81, (m) => m.writer!.writeByte(type).writeByte(typeMoney));
  }

  /** doUpdateLand @0x5d245c — nâng đất. */
  updateLand(step: number, typeMoney: number): void {
    this.send(90, (m) => m.writer!.writeByte(step).writeByte(typeMoney));
  }

  /** doUpdateStore @0x5d260c — nâng kho. */
  updateStore(step: number, typeMoney: number): void {
    this.send(94, (m) => m.writer!.writeByte(step).writeByte(typeMoney));
  }

  // ---- cửa hàng cá nhân (cmd 103, byte đầu = sub-type) -------------------

  /** doOpenShop @0x5d33e0 */
  openShop(type: number, step: number, idItem: number): void {
    this.send(103, (m) => m.writer!.writeByte(type).writeByte(step).writeShort(idItem));
  }

  /** requestUnlockSlotShop @0x5d375c — sub-type 2. */
  unlockShopSlot(type: number): void {
    this.send(103, (m) => m.writer!.writeByte(2).writeByte(type));
  }

  /** doAddItemShop @0x5d3888 — sub-type 3. */
  addItemToShop(slot: number, idItem: number, num: number, price: number): void {
    this.send(103, (m) =>
      m.writer!.writeByte(3).writeByte(slot).writeShort(idItem).writeInt(num).writeInt(price),
    );
  }

  /** getItemShopBack @0x5d3b84 — sub-type 4. */
  takeItemBack(slot: number): void {
    this.send(103, (m) => m.writer!.writeByte(4).writeByte(slot));
  }

  /** doBuyItemShop @0x5d3a2c — sub-type 5. */
  buyFromShop(idShop: number, idItem: number): void {
    this.send(103, (m) => m.writer!.writeByte(5).writeInt(idShop).writeShort(idItem));
  }

  /** doTransMoney @0x5d1f0c — chuyển tiền vào/ra farm. */
  transMoney(type: number, money: number): void {
    this.send(55, (m) => m.writer!.writeByte(type).writeInt(money));
  }

  /** doFinishStarFruit @0x5d2f48 */
  finishStarFruit(): void {
    this.send(83);
  }

  /** doGetImgIcon @0x5d233c */
  getImgIcon(id: number): void {
    this.send(82, (m) => m.writer!.writeShort(id));
  }

  /** doRefeshShop @0x5d31c8 — sub-type 7. */
  refreshShop(): void {
    this.send(103, (m) => m.writer!.writeByte(7));
  }

  /** doGetItemShop @0x5d32d4 — sub-type 8. */
  getShopItems(): void {
    this.send(103, (m) => m.writer!.writeByte(8));
  }

  // ---- nhiệm vụ hàng ngày (cmd -87, byte đầu = sub-type 2) ----------------
  /** getDailyQuest — sub-type 2, type 0 = SHOW @0x6a2008 */
  getDailyQuest(type = 0): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(type));
  }

  /** changeDailyQuest — type 1 = CHANGE */
  changeDailyQuest(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(1));
  }

  /** claimDailyQuestReward — type 2 = DONE */
  claimDailyQuestReward(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(2));
  }

  /** claimDailyQuestBox — type 3 = GETBOX */
  claimDailyQuestBox(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(3));
  }
}
