/**
 * Điểm danh hàng ngày ("Báo danh hàng ngày" trong menu NPC Lái buôn).
 *
 * Wire contract đã xác minh bằng packet thật trên server game 26/08 — nguồn sự
 * thật: `avatar-re/notes/daily-attendance.md`. Tóm tắt:
 * - TX: `communicate(90)` rồi `doMenuOption(21, 0, 0)` — cmd -61 với
 *   `i32 userID=21`, `i8 menuIndex=0`, `i8 subIndex=0`.
 * - RX: cmd -40 (dialog chung), body là `utf text`; phân loại claimed /
 *   already-claimed bằng regex tiếng Việt ghi ở note. Server tự chặn khi
 *   báo danh lần 2 chưa đủ giờ (≥ 8 giờ giữa 2 lần/ngày) nên KHÔNG retry.
 */
import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

export const ATTENDANCE_USER_ID = 21;
export const ATTENDANCE_MENU_INDEX = 0;
export const ATTENDANCE_SUB_INDEX = 0;
/** Lái buôn = NPC id 90 trên bản đồ nông trại. */
export const MERCHANT_NPC_ID = 90;

/** Regex phân loại dialog -40; khớp text xác minh trong note. */
const CLAIMED_PATTERN = /báo danh.*thành công/i;
const ALREADY_CLAIMED_PATTERN = /đã báo danh/i;

export type DailyAttendanceResult =
  | { status: 'claimed'; rewardSummary?: string }
  | { status: 'already-claimed' }
  | { status: 'rejected'; reason?: string }
  | { status: 'timeout' };

/**
 * Phân loại text dialog server thành kết quả điểm danh. Hàm thuần — không
 * đụng state, dùng được cho cả log tái phân loại.
 */
export function classifyAttendanceDialog(text: string): DailyAttendanceResult {
  if (CLAIMED_PATTERN.test(text)) return { status: 'claimed', rewardSummary: text };
  if (ALREADY_CLAIMED_PATTERN.test(text)) return { status: 'already-claimed' };
  return { status: 'rejected', reason: text };
}

/** Gửi yêu cầu báo danh: communicate NPC rồi chọn mục menu. Tuần tự, fire-and-forget. */
export class DailyAttendanceService {
  constructor(private readonly session: Session) {}

  claim(): void {
    this.communicate(MERCHANT_NPC_ID);
    this.sendMenuOption(ATTENDANCE_USER_ID, ATTENDANCE_MENU_INDEX, ATTENDANCE_SUB_INDEX);
  }

  /** doCommunicate @0x69d070 — tương tác NPC (cùng cơ chế FarmService.communicate). */
  private communicate(idUser: number): void {
    const m = Message.create(-59);
    m.writer!.writeInt(idUser);
    this.session.send(m);
  }

  /** doMenuOption @0x69c8b0 — cmd -61: i32 userID, i8 menuIndex, i8 subIndex. */
  private sendMenuOption(userId: number, menuIndex: number, subIndex: number): void {
    const m = Message.create(-61);
    m.writer!.writeInt(userId);
    m.writer!.writeByte(menuIndex);
    m.writer!.writeByte(subIndex);
    this.session.send(m);
  }
}
