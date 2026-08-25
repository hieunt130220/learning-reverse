import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/** AVATAR_JOIN_PARK: i8 roomID, i8 boardID, then native join coordinates. */
export const CMD_AVATAR_JOIN_PARK = 80;

export interface NativeParkJoinPosition {
  x: number;
  y: number;
}

/**
 * PositionMap values copied from the reviewed native CityMap asset. Only map 5
 * has a complete live direct-join proof on the current server build; refusing
 * other maps is safer than sending a guessed coordinate pair.
 */
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({ 5: Object.freeze({ x: 254, y: 82 }) });

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
