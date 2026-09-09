import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/** AVATAR_JOIN_PARK: i8 roomID, i8 boardID, then native join coordinates. */
export const CMD_AVATAR_JOIN_PARK = 80;

/** QUANG_CAU: empty body. */
export const CMD_AVATAR_QUANG_CAU = 41;

/** CAU_THANH_CONG: bool isF=true, i8 len, len × i8 answers. */
export const CMD_AVATAR_CAU_THANH_CONG = 43;

/** CAU_CA_XONG: empty body. */
export const CMD_AVATAR_CAU_CA_XONG = 44;

/** START_CAU_CA: empty body. */
export const CMD_AVATAR_START_CAU_CA = 45;

/**
 * BUY_ITEM_STACK: i16 idPart, i32 num, i8 type (1=Xu, 2=Lượng).
 * Opcode -43 (0xD5): AvatarService.doBuyItem(short idPart, int num, byte type)
 * RVA 0x96125C, gọi từ MapScr.IActionBuyStack (0x8518C8) & MapScr.IActionSelectedMoney (0x8547B0).
 * Mua vật phẩm xếp chồng (mồi câu, vé câu...).
 */
export const CMD_AVATAR_BUY_ITEM_STACK = -43;

/**
 * @deprecated Opcode -24 trong AvatarHD là REQUEST_CITY_MAP (tile map). Dùng CMD_AVATAR_BUY_ITEM_STACK (-43).
 */
export const CMD_PARK_BUY_ITEM = -43;

export interface NativeParkJoinPosition {
  x: number;
  y: number;
}

/**
 * PositionMap values extracted from the CityMap TextAsset in AvatarHD 3.4.4.
 * Node IDs:
 *   1: Khu sinh thái (473, 100)
 *   3: Khu giải trí (236, 280)
 *   4: Khu mua sắm (452, 250)
 *   5: Công viên (254, 82)
 *   7: Nông trại (524, 423)
 *   8: Ngoại ô (100, 100)
 *   9: Mê cung (57, 209)
 *   13: Khu sinh thái / cửa hàng sinh thái (364, 64)
 *   14: Khu cá rô (460, 97) — verified from native bot bs_0.java & live traffic
 *   15: Khu cá lóc (36, 97)
 *   16: Khu cá mập (324, 157)
 *   27: Bến tàu / Đảo Hawai (254, 82)
 */
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({
    1: Object.freeze({ x: 473, y: 100 }),
    3: Object.freeze({ x: 236, y: 280 }),
    4: Object.freeze({ x: 452, y: 250 }),
    5: Object.freeze({ x: 254, y: 82 }),
    7: Object.freeze({ x: 524, y: 423 }),
    8: Object.freeze({ x: 100, y: 100 }),
    9: Object.freeze({ x: 57, y: 209 }),
    13: Object.freeze({ x: 364, y: 64 }),
    14: Object.freeze({ x: 460, y: 97 }),
    15: Object.freeze({ x: 36, y: 97 }),
    16: Object.freeze({ x: 324, y: 157 }),
    27: Object.freeze({ x: 254, y: 82 }),
  });

/** V1 chỉ encode cmd 80 — không có REQUEST_JOIN_ANY/-23 hay opcode tương tác. */
export class ParkService {
  constructor(private readonly session: Session) {}

  doJoinPark(map: number, area: number): void {
    const position = NATIVE_PARK_JOIN_POSITIONS[map];
    if (!position) {
      throw new Error(`chưa có tọa độ native đã verify cho map ${map}`);
    }
    const m = Message.create(CMD_AVATAR_JOIN_PARK);
    m.writer!
      .writeByte(map)
      .writeByte(area)
      .writeShort(position.x)
      .writeShort(position.y);
    this.session.send(m);
  }

  /**
   * CAU_THANH_CONG (TX43): bool isF=true, i8 len, len × i8 answers.
   * Throws if answer is empty, length > 255, or any value is not integer in [0, 255].
   */
  doFinishFishing(answer: readonly number[]): void {
    if (!Array.isArray(answer) || answer.length === 0) {
      throw new Error('TX43: answer must be a non-empty array');
    }
    if (answer.length > 255) {
      throw new Error(`TX43: answer length ${answer.length} exceeds 255`);
    }
    for (let i = 0; i < answer.length; i++) {
      const b = answer[i];
      if (!Number.isSafeInteger(b) || b < 0 || b > 255) {
        throw new Error(`TX43: invalid answer byte at index ${i}: ${b}`);
      }
    }
    const m = Message.create(CMD_AVATAR_CAU_THANH_CONG);
    m.writer!.writeBoolean(true).writeByte(answer.length);
    for (let i = 0; i < answer.length; i++) {
      m.writer!.writeByte(answer[i]!);
    }
    this.session.send(m);
  }

  doStartFishing(): void {
    const m = Message.create(CMD_AVATAR_START_CAU_CA);
    this.session.send(m);
  }

  doQuanCau(): void {
    const m = Message.create(CMD_AVATAR_QUANG_CAU);
    this.session.send(m);
  }

  doCauCaXong(): void {
    const m = Message.create(CMD_AVATAR_CAU_CA_XONG);
    this.session.send(m);
  }

  /**
   * BUY_ITEM_STACK (TX-43): Mua vật phẩm xếp chồng (mồi câu, vé câu).
   * Payload: i16 idPart, i32 num, i8 typeMoney (1=Xu, 2=Lượng).
   */
  doBuyItemStack(id: number, num: number, typeMoney: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error(`doBuyItemStack: id không hợp lệ: ${id}`);
    }
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new Error(`doBuyItemStack: num không hợp lệ: ${num}`);
    }
    if (!Number.isSafeInteger(typeMoney) || (typeMoney !== 1 && typeMoney !== 2)) {
      throw new Error(`doBuyItemStack: typeMoney không hợp lệ: ${typeMoney}`);
    }
    const m = Message.create(CMD_AVATAR_BUY_ITEM_STACK);
    m.writer!.writeShort(id).writeInt(num).writeByte(typeMoney);
    this.session.send(m);
  }

  doParkBuyItem(id: number, typeMoney: number): void {
    this.doBuyItemStack(id, 1, typeMoney);
  }
}
