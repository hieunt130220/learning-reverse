import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/** AVATAR_JOIN_PARK: i8 roomID, i8 boardID, then native join coordinates. */
export const CMD_AVATAR_JOIN_PARK = 80;

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
 *   14: Khu cá rô (254, 82) — sub-area verified in auto-fishing spec
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
    14: Object.freeze({ x: 254, y: 82 }),
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
}
