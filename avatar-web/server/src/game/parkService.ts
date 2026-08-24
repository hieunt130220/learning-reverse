import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/** AVATAR_JOIN_PARK: i8 roomID (map), i8 boardID (khu). */
export const CMD_AVATAR_JOIN_PARK = 80;

/** V1 chỉ encode cmd 80 — không có REQUEST_JOIN_ANY/-23 hay opcode tương tác. */
export class ParkService {
  constructor(private readonly session: Session) {}

  doJoinPark(map: number, area: number): void {
    const m = Message.create(CMD_AVATAR_JOIN_PARK);
    m.writer!.writeByte(map);
    m.writer!.writeByte(area);
    this.session.send(m);
  }
}
