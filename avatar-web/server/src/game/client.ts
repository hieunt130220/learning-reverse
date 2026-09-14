import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import { CMD_GET_KEY, Session } from '../proto/session.js';
import {
  classifyFarmSlots,
  decodeFarmData,
  decodeAnimalCatalog,
  decodeCookingPacket,
  decodeFoodCatalog,
  decodeInfoAnimal,
  decodeCreCharacter,
  decodeMoney,
  decodeInfoCell,
  decodeInventory,
  decodeLoginSuccessMoney,
  decodeItemCatalog,
  decodePlayerInfo,
  decodeTreeInfo,
  decodeDailyQuestPacket,
  type CookingState,
  type DailyQuestState,
  type FarmState,
  type FoodRecipe,
  type InventoryItem,
  type AnimalInfo,
  type FarmAnimal,
  type ItemInfo,
  type TreeInfo,
  type QuestOverviewState,
} from './farmData.js';
import {
  decodeProgressQuestPacket,
  parseQuestDialogText,
  decodeQuestDialogStrings,
  parseQuestListPacket,
  syncQuestStateWithFarm,
  type QuestCatalogEntry,
  type ProgressQuestChain,
  type ProgressQuestMapping,
  type FarmUpgradeRequirements,
  DEFAULT_PROGRESS_QUEST_MAPPINGS,
  DEFAULT_BEGINNER_QUEST_STATE,
  DEFAULT_FARMER_QUEST_STATE,
} from './progressQuests.js';
import { FarmService } from './farmService.js';
import {
  classifyAttendanceDialog,
  DailyAttendanceService,
  type DailyAttendanceResult,
} from './dailyAttendance.js';
import { decodeCanCau } from './fishingDecode.js';
import { ParkService } from './parkService.js';
import { cmdName } from './opcodes.js';
import {
  decodeShopPacket,
  ShopProtocolDecodeError,
  type ShopProtocolEvent,
  type ShopProtocolWarning,
} from './shopProtocol.js';
import {
  decodeEnterWorld,
  decodeParkJoinWorld,
  WorldDataDecodeError,
  type EnterWorldSnapshot,
} from './worldData.js';
import {
  decodeCaptchaChallenge,
  decodeCaptchaImage,
  type CaptchaChallenge,
} from './captchaProtocol.js';

/**
 * Giá trị handler cho `GET_HANDLER (-1)`. `GlobalLogicHandler.doGetHandler`
 * @0x5E4974 rẽ nhánh: 3 = casino, 8/9/10 = farm (10 là cái server trả về
 * kèm luôn gói dữ liệu farm cmd 69).
 */
export const HANDLER_MAIN = 8;
export const HANDLER_PARK = 9;
export const HANDLER_FARM = 10;

/** Hằng lấy từ GameMidlet..cctor @0x5E0A4C. */
export const GAME_MIDLET = {
  CLIENT_TYPE: 8, // str w10=8 -> [+0x48]
  PROVIDER: 0, // strb wzr -> [+0x4C]
  DEVICE: 0, // str wzr -> [+0x6C]
  VERSION: '3.4.4', // = Application.version, khớp versionName trong apktool.yml
  VERSIONCODE: 13, // mov w10,#0xd -> [+0x78]
};

/**
 * Định danh client dùng để login. Thế giới APK (AvatarHD 3.4.4, Android) và
 * thế giới J2ME (avatar-auto.jar, AngelChip 2.5.8) dùng opcode + layout gói
 * login khác nhau — server jar đọc creds từ gói `-1` client-info (body rich) +
 * `-2` LOGIN_ACC + `-79` SET_AGENT, trong khi avatar-web cũ chỉ gửi `-33`.
 * Reverse từ `fv_0.do[]` trong jar: do[1]=-1, do[6]=-2, do[4]=-79.
 */
export type LoginMode = 'apk' | 'j2me';

export interface ClientIdentity {
  clientType: number; // j2me: 0 | apk: 8
  version: string; // j2me: '2.5.8' | apk: '3.4.4'
  provider: number; // j2me: 0 | apk: 0
  agent: string; // từ config (jar: '0'/...)
  loginMode: LoginMode;
}

export const J2ME_IDENTITY: ClientIdentity = {
  clientType: 0,
  version: '2.5.8',
  provider: 0,
  agent: '',
  loginMode: 'j2me',
};

export const APK_IDENTITY: ClientIdentity = {
  clientType: GAME_MIDLET.CLIENT_TYPE,
  version: GAME_MIDLET.VERSION,
  provider: GAME_MIDLET.PROVIDER,
  agent: '',
  loginMode: 'apk',
};

const CMD_CLIENT_INFO = -1; // fv_0.do[1] — client-info/login hello (thế giới J2ME)
const CMD_LOGIN_J2ME = -2; // fv_0.do[6] — LOGIN_ACC thế giới J2ME (user, pass, token)
const CMD_SET_AGENT = -79; // fv_0.do[4] — SET_AGENT
// Opcode thực tế bắt được từ avatar-auto.jar trên MicroEmulator (pcap 2026-08-26, key 119028dd1862f297b06ee9aeba980982):
const CMD_J2ME_80 = -80;
const CMD_J2ME_17 = -17; // client-info J2ME thực tế (thay vì -1 suy đoán)
const CMD_J2ME_52 = -52;
// Body thô (plaintext trước XOR) của 4 gói J2ME bắt được:
const J2ME_80_BODY_HEX = '034a';
const J2ME_17_BODY_HEX =
  '000000c000000d4d6963726f456d756c61746f7200000400000001cb0000025d01000005322e352e3801616672703271727861636d69675f2c6e6c6431636f6d2e6e6f69675f2c747266727031717233353535643332383832346438372d347432353069675f2c787334667270317172313132333372337972373833393337322d337432353169675f2c747266727031717233353535643332383832346438372d327432353069675f2c667666727031717234313132333372386464643438347372672d317432353269675f2c74726672703171723335353564333238383234643837307432353069675f2c66766672703171723431313233337238646464343834737267317432353269675f2c74726672703171723335353564333238383234643837327432353069675f2c78733466727031717231313233337233797237383339333732337432353169675f2c74726672703171723335353564333238383234643837347432353069675f2c66766672703171723431313233337238646464343834737267357432353200046e6c64310005346e6c6431';
const J2ME_52_BODY_HEX = 'fe032b07';

export interface DeviceProfile {
  /** SystemInfo.deviceUniqueIdentifier — chuỗi hex ổn định cho mỗi "máy". */
  imei: string;
  /** SystemInfo.deviceModel */
  model: string;
  /** SystemInfo.systemMemorySize (MB) */
  memoryMb: number;
  screenWidth: number;
  screenHeight: number;
  /**
   * GameMidlet.AGENT — literal string chưa phân giải được từ metadata cache
   * (gói SET_AGENT -79). Nhiều khả năng chỉ là kênh phát hành/analytics.
   * Nếu server từ chối login, thử đổi giá trị này trước tiên.
   */
  agent: string;
}

export const DEFAULT_DEVICE: DeviceProfile = {
  imei: crypto.randomBytes(16).toString('hex'),
  model: 'samsung SM-G991B',
  memoryMb: 3814,
  screenWidth: 1080,
  screenHeight: 2340,
  agent: '',
};

/** Gói có chứa mật khẩu — không log body ra ngoài. */
const SENSITIVE_CMDS = new Set([-33, -32, -30]);

export interface TemporaryLoginRejection {
  reason: string;
  retryAfterMs: number;
}

const MIN_LOGIN_RETRY_MS = 10_000;
export const PARK_ALREADY_IN_AREA_DIALOG = 'Bạn đã ở trong khu vực muốn chuyển đến';

/**
 * Kiểm tra xem một dialog từ server có phải là thông báo phần thưởng / sự kiện / hoạt động hay không.
 */
export function isRewardDialog(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  // Nếu chứa từ khóa phủ định hoặc lỗi -> chắc chắn không phải nhận thưởng
  if (
    normalized.includes('không thể')
    || normalized.includes('không được')
    || normalized.includes('thất bại')
    || normalized.includes('chưa thể')
  ) {
    return false;
  }

  // 1. Chúc mừng
  if (normalized.includes('chúc mừng')) return true;

  // 2. Động từ nhận/thu hoạch vật phẩm
  if (
    normalized.includes('thu hoạch được')
    || normalized.includes('nhận được')
    || normalized.includes('nhặt được')
    || normalized.includes('kiếm được')
  ) {
    return true;
  }

  // 3. Có từ khóa phần thưởng
  if (normalized.includes('phần thưởng')) return true;

  // 4. Nhận từ hoạt động (ví dụ: "từ hoạt động câu cá", "từ hoạt động...")
  if (normalized.includes('từ hoạt động')) return true;

  // 5. Mẫu đếm giới hạn sự kiện trong ngày (ví dụ: "Số lượng 1/40", "Số lượng 1/50")
  if (/số lượng\s*\d+\s*\/\s*\d+/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem một dialog từ server có phải là thông báo thông tin chung cần bỏ qua
 * (không phải lỗi từ chối thao tác câu cá, di chuyển, hay vào map).
 */
export function isInformationalDialog(reason: string): boolean {
  const trimmed = reason.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();

  // 1. Dialog "đã ở trong khu vực này rồi"
  if (
    trimmed === PARK_ALREADY_IN_AREA_DIALOG
    || lower.includes('đã ở trong khu vực')
    || lower.includes('đã ở khu vực')
  ) {
    return true;
  }

  // 2. Dialog cập nhật tiến trình nhiệm vụ (Tân Thủ, Nhà Nông, Thợ Câu)
  if (parseQuestDialogText(reason) !== null) return true;

  // 3. Hộp thoại thông báo nhận thưởng sự kiện / chúc mừng
  if (isRewardDialog(trimmed)) return true;

  // 4. Hộp thoại chào mừng / giới thiệu khi vào map (vd: Map 27 Bến tàu)
  if (
    lower.includes('khu vực câu cá đặc biệt')
    || lower.includes('khu câu cá đặc biệt')
    || lower.includes('câu các loại cá ở bến tàu')
  ) {
    return true;
  }

  // 5. Cảnh báo spam / thao tác quá nhanh
  if (lower.includes('chầm chậm thôi')) return true;

  // 6. Hộp thoại broadcast thông báo hệ thống / bảo trì định kỳ
  if (
    lower.startsWith('thông báo:')
    || lower.startsWith('hệ thống:')
    || lower.startsWith('server:')
  ) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem một dialog từ chối từ server có phải do nhân vật thiếu vé câu cá hay không.
 * Sử dụng cụm từ ngữ cảnh chính xác để tránh bắt nhầm các thông báo nhận vé quay số,
 * vé sự kiện, vé may mắn...
 */
export function isMissingFishingTicketDialog(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  if (
    normalized.includes('cần vé câu')
    || normalized.includes('phải có vé')
    || normalized.includes('vé câu cá')
    || (normalized.includes('vé') && normalized.includes('khu vực này'))
    || (normalized.includes('vé') && normalized.includes('bến tàu'))
  ) {
    return true;
  }
  return false;
}

export function parseTemporaryLoginRejection(text: string): TemporaryLoginRejection | null {
  const isThrottle = /đang đăng nhập|đăng nhập quá nhanh|đăng nhập lại sau\s+\d+\s*s|quá tải/i.test(text);
  if (!isThrottle) return null;
  const seconds = text.match(/sau\s+(\d+)\s*s/i)?.[1];
  return {
    reason: text,
    retryAfterMs: seconds
      ? Math.max(Number(seconds) * 1_000, MIN_LOGIN_RETRY_MS)
      : MIN_LOGIN_RETRY_MS,
  };
}

export type ClientStatus = 'idle' | 'connecting' | 'handshaking' | 'logging-in' | 'online' | 'error';

export interface TrafficEntry {
  t: number;
  dir: 'tx' | 'rx';
  cmd: number;
  name: string;
  len: number;
  hex: string;
}

export interface CaptchaEvent {
  challenge: CaptchaChallenge | null;
  decoded: { format: string; bytes: Buffer } | null;
  sha256: string | null;
  error: Error | null;
  rawHex: string;
}

/**
 * Client headless: giữ TCP session, chạy handshake + login rồi phơi
 * FarmService ra ngoài cho tầng web điều khiển.
 */
export class GameClient extends EventEmitter {
  readonly session = new Session();
  readonly farm = new FarmService(this.session);
  readonly park = new ParkService(this.session);
  /** Điểm danh "Báo danh hàng ngày" — wire contract: notes/daily-attendance.md. */
  readonly dailyAttendance = new DailyAttendanceService(this.session);

  status: ClientStatus = 'idle';
  lastError?: string;
  /** id nhân vật, điền khi bắt được từ gói RX (dùng làm idUser cho lệnh farm). */
  playerId?: number;
  /** Trạng thái farm mới nhất, cập nhật mỗi khi nhận gói 69/61. */
  farmState?: FarmState;
  /** Kho vật phẩm (cmd 70) — hạt giống + vật phẩm (section 1 + 2). */
  inventory: InventoryItem[] = [];
  /**
   * Nông sản thu được (section 3 của gói 70): id trùng bảng cây với nông sản
   * trồng trọt, trùng bảng vật nuôi với trứng/sữa. Đây là nơi thu hoạch đổ vào —
   * bằng chứng lệnh thu hoạch có chạy hay không.
   */
  produce: InventoryItem[] = [];
  /** Nguyên liệu/vật phẩm đặc biệt dùng cho bếp (section 4 của gói 70). */
  cookingMaterials: InventoryItem[] = [];
  /** Bảng cây trồng (cmd 76) — dùng để hiện tên thay vì id. */
  trees: TreeInfo[] = [];
  /** Bảng vật phẩm rút từ cùng gói 76. */
  items: ItemInfo[] = [];
  /** Bảng vật nuôi (id 50..61) từ cùng gói 76. */
  animals: AnimalInfo[] = [];
  /** Danh mục công thức từ Cmd 76; rỗng cho tới khi decode được packet hợp lệ. */
  foods: FoodRecipe[] = [];
  /** Chỉ true sau khi decode được một block Food[] hoàn chỉnh từ Cmd 76. */
  foodCatalogReady = false;
  /** Event cmd 103 hợp lệ gần nhất; decoder lỗi không được ghi đè state này. */
  lastShopEvent: ShopProtocolEvent | null = null;
  /** Cảnh báo trailing bytes của event cmd 103 hợp lệ gần nhất. */
  lastShopWarning: ShopProtocolWarning | null = null;
  /** Trạng thái bếp nấu ăn (cmd 91). */
  cookingState?: CookingState;
  /** Trạng thái nhiệm vụ hàng ngày (cmd -87 sub 2). */
  dailyQuestState: DailyQuestState | null = null;
  /** Trạng thái nhiệm vụ tân thủ (cmd 104 / dialog NPC). */
  // Keep the user-confirmed current quest visible until the game sends a newer snapshot.
  beginnerQuestState: ProgressQuestChain | null = DEFAULT_BEGINNER_QUEST_STATE;
  /** Trạng thái nhiệm vụ nhà nông (cmd 104 / dialog NPC). */
  farmerQuestState: ProgressQuestChain | null = DEFAULT_FARMER_QUEST_STATE;
  /** Trạng thái nhiệm vụ thợ câu (cmd 104 / dialog NPC). */
  fishermanQuestState: ProgressQuestChain | null = null;
  /** Danh sách nhiệm vụ NPC (cmd -81, "Xem danh sách nhiệm vụ") — dữ liệu phụ trợ. */
  questCatalog: QuestCatalogEntry[] = [];
  /** Danh sách mapping giải mã tiến trình nhiệm vụ. */
  progressQuestMappings: readonly ProgressQuestMapping[] = DEFAULT_PROGRESS_QUEST_MAPPINGS;
  /** Số dư xu, cập nhật từ UPDATE_MONEY (-3), type 1. */
  money?: number;
  /** Số dư lượng mở, cập nhật từ UPDATE_MONEY (-3). */
  luong?: number;
  /** Số dư lượng khoá, cập nhật từ UPDATE_MONEY (-3). */
  luongKhoa?: number;
  /** Để dành cho parser player-info đã xác minh. */
  playerLevel?: number;
  /** Để dành cho parser farm-info đã xác minh. */
  farmLevel?: number;
  /** Yêu cầu nâng cấp nông trại (decode action=1 của cmd 104). */
  farmUpgradeRequirements?: FarmUpgradeRequirements | null;
  /**
   * Body đầy đủ của gói RX gần nhất theo từng cmd, dạng hex.
   * Log gói tin trên UI cắt còn 64 byte, cái này giữ nguyên để còn giải mã tiếp
   * các gói lớn (vd GET_TREE_INFO 13 KB).
   */
  readonly lastPacket = new Map<number, string>();

  private device: DeviceProfile = { ...DEFAULT_DEVICE };
  private identity: ClientIdentity = APK_IDENTITY;
  /** Handler context hiện tại: 8 main, 9 park, 10 farm; 'unknown' khi chưa/đã đóng. */
  currentHandlerContext: 8 | 9 | 10 | 'unknown' = 'unknown';
  /** RX80 Park gần nhất; không lấy snapshot login -34 làm cache Park. */
  private latestParkSnapshot?: EnterWorldSnapshot;

  get currentParkSnapshot(): EnterWorldSnapshot | undefined {
    return this.latestParkSnapshot;
  }
  private keepAliveTimer?: NodeJS.Timeout;
  /** Đóng socket khi server không gửi gói nào trong `silenceTimeoutMs`. */
  private silenceTimer?: NodeJS.Timeout;
  private lastRxAt = 0;
  private readonly silenceTimeoutMs: number;
  readonly traffic: TrafficEntry[] = [];

  constructor(options: { silenceTimeoutMs?: number } = {}) {
    super();
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 120_000;
    this.session.on('traffic', (dir, cmd, body) => {
      const entry: TrafficEntry = {
        t: Date.now(),
        dir,
        cmd,
        name: cmdName(cmd),
        len: body.length,
        // LOGIN_ACC / LOGIN_IMEI / REQUEST_REGISTER mang mật khẩu ở dạng rõ —
        // không đẩy ra UI để log có thể chia sẻ được.
        hex: SENSITIVE_CMDS.has(cmd) ? '<đã ẩn>' : body.subarray(0, 64).toString('hex'),
      };
      this.traffic.push(entry);
      if (this.traffic.length > 500) this.traffic.shift();
      this.emit('traffic', entry);
    });

    this.session.on('message', (msg) => this.onMessage(msg));
    this.session.on('closed', (info) => {
      this.currentHandlerContext = 'unknown';
      this.latestParkSnapshot = undefined;
      this.stopKeepAlive();
      this.stopSilenceWatchdog();
      const statusAtClose = this.status;
      const idleMs = info.lastDataAt === undefined ? undefined : info.closedAt - info.lastDataAt;
      const error = info.error
        ? `, lỗi=${[info.error.code, info.error.syscall].filter(Boolean).join('/') || info.error.message}`
        : '';
      const idle = idleMs === undefined ? '' : `, im lặng ${idleMs}ms`;
      this.setStatus('idle');
      this.emit(
        'log',
        `mất kết nối: ${info.kind} ${info.host}:${info.port}, sống ${info.lifetimeMs}ms, ` +
          `rx=${info.bytesRead}B tx=${info.bytesWritten}B, trạng thái=${statusAtClose}${idle}${error}`,
      );
    });
    this.session.on('error', (err) => {
      this.lastError = err.message;
      this.setStatus('error');
      this.emit('log', `lỗi: ${err.message}`);
    });
    this.startSilenceWatchdog();
  }

  /**
   * Chờ phản hồi của lệnh farm vừa gửi (gói `cmd` bất kỳ). Resolve `true` nếu
   * có gói về trong hạn, `false` nếu server im lặng tới khi hết giờ — vòng auto
   * luôn phải tiếp tục dù chưa nhận được xác nhận.
   */
  waitForReply(cmd: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      let onReply: (msg: Message) => void;
      const timer = setTimeout(() => {
        this.session.removeListener('message', onReply);
        resolve(false);
      }, timeoutMs);
      onReply = (msg: Message): void => {
        if (msg.command !== cmd) return;
        clearTimeout(timer);
        resolve(true);
      };
      this.session.on('message', onReply);
    });
  }

  /**
   * Game server đôi khi ngừng trả lời mà socket vẫn mở (status 'online'), khiến
   * auto cứ bắn lệnh vào khoảng không. Watchdog đóng socket sau
   * `silenceTimeoutMs` không nhận được gói nào để tầng phiên tự kết nối lại.
   */
  private startSilenceWatchdog(): void {
    if (this.silenceTimeoutMs <= 0 || this.silenceTimer) return;
    const check = (): void => {
      if (this.status !== 'online' || this.lastRxAt === 0) return;
      const idleMs = Date.now() - this.lastRxAt;
      if (idleMs <= this.silenceTimeoutMs) return;
      this.emit('log', `server im lặng ${Math.round(idleMs / 1000)}s — đóng socket để kết nối lại`);
      this.session.close();
    };
    this.silenceTimer = setInterval(check, Math.min(10_000, this.silenceTimeoutMs));
    this.silenceTimer.unref?.();
  }

  private stopSilenceWatchdog(): void {
    if (this.silenceTimer) clearInterval(this.silenceTimer);
    this.silenceTimer = undefined;
  }

  private setStatus(s: ClientStatus): void {
    this.status = s;
    this.emit('status', s);
  }

  async login(opts: {
    host: string;
    port: number;
    user: string;
    pass: string;
    device?: Partial<DeviceProfile>;
    identity?: ClientIdentity;
  }): Promise<void> {
    this.device = { ...DEFAULT_DEVICE, ...opts.device };
    this.identity = opts.identity ?? APK_IDENTITY;
    this.setStatus('connecting');
    await this.session.connect(opts.host, opts.port);
    this.emit('log', `đã kết nối ${opts.host}:${opts.port}, xin khóa...`);

    this.setStatus('handshaking');
    // Server không tự gửi khóa: client phải gửi gói -27 rỗng để xin.
    // (Xác minh bằng thực nghiệm với server thật — static analysis không lộ ra
    // vì chỗ gọi nằm ngoài Session_ME.)
    const wait = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('không nhận được gói khóa (-27) sau 10s')), 10_000);
      this.session.once('key', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.session.send(Message.create(CMD_GET_KEY));
    await wait;
    this.emit('log', 'đã nhận khóa, gửi thông tin client');

    this.setStatus('logging-in');
    if (this.identity.loginMode === 'j2me') {
      // Thế giới J2ME (avatar-auto.jar): server đọc creds từ gói -1 client-info
      // (body rich) + -2 LOGIN_ACC + -79 SET_AGENT. Avatar-web cũ dùng -33 nên
      // bị server jar "silent drop".
      this.sendClientInfoJ2me();
      this.sendLoginJ2me(opts.user, opts.pass);
    } else {
      this.setProviderAndClientType();

      // GlobalService.getServerLoginInfo @0x699478 — cmd -87 sub-type 1.
      // Là request duy nhất đã xác nhận có phản hồi ở giai đoạn trước đăng nhập,
      // dùng làm kiểm chứng "server đang nghe và giải mã được ta".
      const info = Message.create(-87);
      info.writer!.writeByte(1);
      this.session.send(info);

      this.sendLogin(opts.user, opts.pass);
    }
  }

  logout(): void {
    this.currentHandlerContext = 'unknown';
    this.isRefreshingProgress = false;
    this.stopKeepAlive();
    this.stopSilenceWatchdog();
    this.session.close();
    this.setStatus('idle');
  }

  /**
   * Server ngắt client im lặng sau khoảng ~2 phút (quan sát: nhiều phiên chết
   * đúng ~2 phút sau đăng nhập, kể cả khi vừa trao đổi thành công trước đó).
   * `Cmd_Message` không có opcode ping riêng, nên dùng một request nhẹ có phản
   * hồi — `getInventory` (cmd 70, trả ~148 byte) — làm nhịp giữ kết nối.
   */
  private startKeepAlive(intervalMs = 45_000): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.status !== 'online') return this.stopKeepAlive();
      try {
        if (this.currentHandlerContext === HANDLER_PARK) {
          // Ngữ cảnh Park: CMD -94 (Global) luôn có phản hồi, CMD 70 (Farm) bị ParkHandler bỏ qua
          this.requestYourInfo();
        } else {
          // Ngữ cảnh Farm / Main: CMD 70 (getInventory)
          this.farm.getInventory();
        }
      } catch {
        this.stopKeepAlive();
      }
    }, intervalMs);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = undefined;
  }

  /**
   * GlobalService.setProviderAndClientType @0x698898 — 3 gói liên tiếp,
   * thứ tự field đọc trực tiếp từ chuỗi lời gọi myWriter.
   */
  private setProviderAndClientType(): void {
    const d = this.device;

    // GET_HANDLER (-1): writeByte(GameMidlet.CLIENT_TYPE)
    const handler = Message.create(-1);
    handler.writer!.writeByte(GAME_MIDLET.CLIENT_TYPE);
    this.session.send(handler);
    this.currentHandlerContext = HANDLER_MAIN;

    // SET_PROVIDER (-47)
    const provider = Message.create(-47);
    provider
      .writer!.writeByte(GAME_MIDLET.PROVIDER)
      .writeInt(d.memoryMb) // SystemInfo.systemMemorySize
      .writeUTF(d.model) // SystemInfo.deviceModel
      .writeInt(10000) // hằng cứng trong hàm
      .writeInt(d.screenWidth)
      .writeInt(d.screenHeight)
      .writeBoolean(true)
      .writeByte(1)
      .writeUTF(GAME_MIDLET.VERSION)
      .writeUTF(d.imei)
      .writeByte(GAME_MIDLET.DEVICE);
    this.session.send(provider);

    // SET_AGENT (-79): writeUTF(GameMidlet.AGENT)
    const agent = Message.create(-79);
    agent.writer!.writeUTF(d.agent);
    this.session.send(agent);
  }

  /**
   * GlobalService.login @0x6991C8 — LOGIN_ACC(-33): utf user, utf pass, utf ???
   *
   * Tham số thứ 3 metadata đặt tên là `version`, NHƯNG call site trong
   * LoginScr @0x60876C truyền `GameMidlet.IMEI` ([+0x58]) chứ không phải version.
   * Username cũng được `ToLower()` trước khi gửi (@0x60871C).
   */
  private sendLogin(user: string, pass: string): void {
    const m = Message.create(-33);
    m.writer!.writeUTF(user.toLowerCase()).writeUTF(pass).writeUTF(this.device.imei);
    this.session.send(m);
  }

  /**
   * Gói client-info/login-hello của thế giới J2ME (avatar-auto.jar).
   * Đã bắt trọn từ MicroEmulator (pcap 2026-08-26):
   *   -80(034a) → -1(08) → -17(409B: provider 0, mem 49152, platform MicroEmulator,
   *   1024×459, version 2.5.8 + 3 token fingerprint) → -79(0000) → -52(fe032b07).
   * Trước đây suy đoán -1 là client-info là sai; thực tế -17 mới là client-info giàu.
   * Body được hardcode nguyên văn plaintext (Session sẽ XOR với key mới).
   */
  private sendClientInfoJ2me(): void {
    const m80 = Message.create(CMD_J2ME_80);
    m80.writer!.writeBytes(Buffer.from(J2ME_80_BODY_HEX, 'hex'));
    this.session.send(m80);
    this.emit('log', 'J2ME: gửi -80');

    const h = Message.create(CMD_CLIENT_INFO);
    h.writer!.writeBytes(Buffer.from('08', 'hex')); // GET_HANDLER 8
    this.session.send(h);
    this.emit('log', 'J2ME: gửi -1 handler 08');

    const m17 = Message.create(CMD_J2ME_17);
    m17.writer!.writeBytes(Buffer.from(J2ME_17_BODY_HEX, 'hex'));
    this.session.send(m17);
    this.emit('log', 'J2ME: gửi -17 client-info 409B (fingerprint MicroEmulator)');

    const agent = Message.create(CMD_SET_AGENT);
    // Capture: -79 body 0000 (empty agent)
    agent.writer!.writeBytes(Buffer.from('0000', 'hex'));
    this.session.send(agent);
    this.emit('log', 'J2ME: gửi SET_AGENT (-79) 0000');

    const m52 = Message.create(CMD_J2ME_52);
    m52.writer!.writeBytes(Buffer.from(J2ME_52_BODY_HEX, 'hex'));
    this.session.send(m52);
    this.emit('log', 'J2ME: gửi -52');
  }

  /** LOGIN_ACC thế giới J2ME: cmd -2, body = user, pass, version "2.5.8" (bắt được). */
  private sendLoginJ2me(user: string, pass: string): void {
    const m = Message.create(CMD_LOGIN_J2ME);
    m.writer!.writeUTF(user.toLowerCase()).writeUTF(pass).writeUTF(this.identity.version);
    this.session.send(m);
    this.emit('log', 'J2ME: gửi LOGIN_ACC (-2) version ' + this.identity.version);
  }

  clearParkSnapshot(): void {
    this.latestParkSnapshot = undefined;
  }

  /**
   * Vào nông trại.
   * - Lần đầu tiên trong phiên: xin handler farm bằng `GET_HANDLER (-1) + i8 10`.
   *   Server chuyển context sang farm và tự đẩy về gói 69.
   * - Các lần sau trong cùng phiên (làm mới dữ liệu farm / chu kỳ auto): gửi
   *   `doJoinFarm` (cmd 69) để cập nhật dữ liệu mà không gọi lại GET_HANDLER 10
   *   (server coi việc xin lại handler khi đang ở trong farm là bất thường và đóng TCP socket).
   */
  enterFarm(idFarm?: number): void {
    this.latestParkSnapshot = undefined;
    if (this.currentHandlerContext !== HANDLER_FARM) {
      this.currentHandlerContext = HANDLER_FARM;
      const m = Message.create(-1);
      m.writer!.writeByte(HANDLER_FARM);
      this.session.send(m);
    } else {
      const targetId = idFarm ?? this.farmState?.idFarm ?? this.playerId ?? 0;
      this.farm.joinFarm(targetId);
    }
  }

  /** Xin handler Park (9) đúng MỘT lần khi context khác 9; xin lại gây đóng socket. */
  enterParkContext(): void {
    if (this.currentHandlerContext === HANDLER_PARK) return;
    this.currentHandlerContext = HANDLER_PARK;
    const m = Message.create(-1);
    m.writer!.writeByte(HANDLER_PARK);
    this.session.send(m);
  }

  joinPark(map: number, area: number): void {
    this.park.doJoinPark(map, area);
  }

  startFishing(): void {
    this.park.doStartFishing();
  }

  quanCau(): void {
    this.park.doQuanCau();
  }

  finishFishing(answer: readonly number[]): void {
    this.park.doFinishFishing(answer);
  }

  cauCaXong(): void {
    this.park.doCauCaXong();
  }

  parkBuyItem(id: number, typeMoney: number): void {
    this.park.doParkBuyItem(id, typeMoney);
  }

  buyItemStack(id: number, num: number, typeMoney: number): void {
    this.park.doBuyItemStack(id, num, typeMoney);
  }

  chatPark(text: string, style = 0): void {
    this.park.chat(text, style);
  }

  /**
   * Chờ RX80 mới; nếu server báo đã ở đúng Park room/board thì dùng lại
   * snapshot RX80 gần nhất của chính connection đó, tránh timeout giả.
   */
  waitForWorldSnapshot(
    signal: AbortSignal,
    timeoutMs: number,
    expected?: { map: number; area: number },
  ): Promise<EnterWorldSnapshot> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const onSnapshot = (snap: EnterWorldSnapshot): void => {
        cleanup();
        resolve(snap);
      };
      const onSnapshotError = (error: unknown): void => {
        cleanup();
        reject(
          error instanceof WorldDataDecodeError
            ? error
            : new WorldDataDecodeError('enter-world', -1, error instanceof Error ? error.message : String(error)),
        );
      };
      const onSameArea = (reason: string): void => {
        const norm = reason.trim().toLowerCase();
        const isSameArea = norm === PARK_ALREADY_IN_AREA_DIALOG.toLowerCase()
          || norm.includes('đã ở trong khu vực')
          || norm.includes('đã ở khu vực');
        if (!expected || !isSameArea) return;
        cleanup();
        const cached = this.latestParkSnapshot;
        if (
          cached
          && cached.roomId === expected.map
          && cached.boardId === expected.area
        ) {
          this.emit(
            'log',
            `Park snapshot cache: server xác nhận đã ở map ${expected.map} khu ${expected.area}`,
          );
          resolve(cloneParkSnapshot(cached));
        } else {
          // Server xác nhận nhân vật đã ở đúng map/khu, tạo snapshot tối thiểu
          const synSnap: EnterWorldSnapshot = {
            playerId: this.playerId ?? 0,
            roomId: expected.map,
            boardId: expected.area,
            x: 0,
            y: 0,
            specials: [],
            specialSectionEnd: 0,
            totalBytes: 0,
            trailingBytes: 0,
          };
          this.latestParkSnapshot = synSnap;
          this.emit(
            'log',
            `Server xác nhận nhân vật đã ở map ${expected.map} khu ${expected.area} (chấp nhận dialog)`,
          );
          resolve(synSnap);
        }
      };
      const onAbort = (): void => {
        cleanup();
        reject(new Error('chờ enter-world bị hủy'));
      };
      const onClosed = (): void => {
        cleanup();
        reject(new Error('kết nối đã đóng khi chờ gói enter-world (-34)'));
      };
      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        this.removeListener('world-snapshot', onSnapshot);
        this.removeListener('world-snapshot-error', onSnapshotError);
        this.removeListener('dialog', onSameArea);
        signal.removeEventListener('abort', onAbort);
        this.session.removeListener('closed', onClosed);
      };
      timer = setTimeout(() => {
        cleanup();
        const msg = expected
          ? `hết giờ chờ vào map ${expected.map} khu ${expected.area} (RX80)`
          : 'hết giờ chờ gói enter-world (-34)';
        reject(new Error(msg));
      }, timeoutMs);
      this.once('world-snapshot', onSnapshot);
      this.once('world-snapshot-error', onSnapshotError);
      this.on('dialog', onSameArea);
      signal.addEventListener('abort', onAbort, { once: true });
      this.session.once('closed', onClosed);
      if (signal.aborted) onAbort();
    });
  }

  /** Gửi yêu cầu lấy thông tin chi tiết nhân vật (cmd -94). */
  requestYourInfo(idUser?: number): void {
    const target = idUser ?? this.playerId ?? 0;
    const m = Message.create(-94);
    m.writer!.writeInt(target);
    this.session.send(m);
  }

  /**
   * Điểm danh "Báo danh hàng ngày" (menu NPC Lái buôn, userID 21).
   *
   * Best-effort: mọi kết quả — kể cả timeout/đóng kết nối — đều resolve thành
   * `DailyAttendanceResult`, không throw, không retry. Server tự chặn khi báo
   * danh lần 2 chưa đủ giờ nên client không tự bắn lại.
   *
   * Wire contract đã xác minh: `avatar-re/notes/daily-attendance.md`.
   */
  claimDailyAttendance(options: { timeoutMs?: number } = {}): Promise<DailyAttendanceResult> {
    const timeoutMs = options.timeoutMs ?? 2_500;
    if (this.status !== 'online') {
      return Promise.resolve({ status: 'rejected', reason: 'chưa đăng nhập' });
    }
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | undefined;
      let settled = false;
      const finish = (result: DailyAttendanceResult): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const onDialog = (text: string): void => {
        // Chỉ dialog khớp mẫu báo danh mới kết thúc request; dialog nghiệp vụ
        // khác (nhiệm vụ NPC, thông báo chung) phải đi tiếp đường cũ của nó.
        const result = classifyAttendanceDialog(text);
        if (result.status === 'rejected') return;
        finish(result);
      };
      const onClosed = (): void => finish({ status: 'timeout' });
      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        this.removeListener('dialog', onDialog);
        this.session.removeListener('closed', onClosed);
      };
      timer = setTimeout(() => finish({ status: 'timeout' }), timeoutMs);
      this.on('dialog', onDialog);
      this.session.once('closed', onClosed);
      try {
        this.dailyAttendance.claim();
      } catch (err) {
        finish({ status: 'rejected', reason: (err as Error).message });
      }
    });
  }

  /** Gửi gói tự do — dùng để dò các opcode chưa chốt từ UI. */
  sendRaw(cmd: number, fields: Array<{ t: string; v: string }>): void {
    const m = Message.create(cmd);
    const w = m.writer!;
    for (const f of fields) {
      switch (f.t) {
        case 'i8':
          w.writeByte(Number(f.v));
          break;
        case 'i16':
          w.writeShort(Number(f.v));
          break;
        case 'i32':
          w.writeInt(Number(f.v));
          break;
        case 'i64':
          w.writeLong(BigInt(f.v));
          break;
        case 'bool':
          w.writeBoolean(f.v === 'true' || f.v === '1');
          break;
        case 'utf':
          w.writeUTF(f.v);
          break;
        case 'hex':
          w.writeBytes(Buffer.from(f.v.replace(/\s+/g, ''), 'hex'));
          break;
        default:
          throw new Error(`kiểu không hỗ trợ: ${f.t}`);
      }
    }
    this.session.send(m);
  }

  getDailyQuest(type = 0): void {
    this.farm.getDailyQuest(type);
  }

  changeDailyQuest(): void {
    this.farm.changeDailyQuest();
  }

  claimDailyQuest(): void {
    this.farm.claimDailyQuestReward();
  }

  claimDailyQuestBox(): void {
    this.farm.claimDailyQuestBox();
  }

  /** Đồng bộ tiến trình nhiệm vụ (Tân Thủ, Nhà Nông) với dữ liệu thực tế (vật nuôi, nông sản, ô đất). */
  syncProgressQuests(): boolean {
    let changed = false;
    if (this.beginnerQuestState) {
      const synced = syncQuestStateWithFarm(
        this.beginnerQuestState,
        this.farmState,
        this.inventory,
        this.produce,
      );
      if (synced && JSON.stringify(synced) !== JSON.stringify(this.beginnerQuestState)) {
        this.beginnerQuestState = synced;
        changed = true;
      }
    }
    if (this.farmerQuestState) {
      const synced = syncQuestStateWithFarm(
        this.farmerQuestState,
        this.farmState,
        this.inventory,
        this.produce,
      );
      if (synced && JSON.stringify(synced) !== JSON.stringify(this.farmerQuestState)) {
        this.farmerQuestState = synced;
        changed = true;
      }
    }
    if (changed) {
      this.emit('quests');
    }
    return changed;
  }

  getQuestOverview(): QuestOverviewState {
    return {
      daily: this.dailyQuestState,
      beginner: this.beginnerQuestState,
      farmer: this.farmerQuestState,
      fisherman: this.fishermanQuestState,
      upgradeRequirements: this.farmUpgradeRequirements,
      source: this.beginnerQuestState || this.farmerQuestState || this.fishermanQuestState || this.dailyQuestState ? 'live' : 'none',
      updatedAt: Date.now(),
    };
  }

  private lastProgressRefreshAt = 0;
  private isRefreshingProgress = false;

  /** Làm mới chuỗi nhiệm vụ tiến trình (Tân Thủ và Nhà Nông) từ game qua Cmd 104 & NPC Lái buôn. */
  async refreshProgressQuests(force = false): Promise<void> {
    if (this.status !== 'online') {
      this.emit('log', `không thể làm mới nhiệm vụ: client ${this.status}`);
      return;
    }
    if (this.isRefreshingProgress) {
      return;
    }
    const now = Date.now();
    if (!force && now - this.lastProgressRefreshAt < 5000) {
      return;
    }
    this.isRefreshingProgress = true;
    this.lastProgressRefreshAt = now;
    try {
      this.emit('log', 'gửi yêu cầu lấy nhiệm vụ tiến trình & tương tác NPC Lái buôn...');

      // 1. Gửi request OPEN_INFO_FARM hợp lệ đã xác nhận trên server hiện tại.
      // Body chỉ gồm type=1; biến thể type=3 + idType không trả response.
      this.farm.getInfoUpgradeFarm(1);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 2. Hỏi NPC quest thật (Lái buôn). Mỗi chuỗi quest có một userID riêng
      // trong doMenuOption (verified: 19=Tân Thủ, 35=Nhà Nông, 38=Thợ Câu);
      // userID lấy từ chính gói menu cmd -61. Server chỉ phản hồi trong farm
      // handler; mỗi menu option cần một lượt communicate() riêng.
      this.farm.communicate(90);
      await new Promise((resolve) => setTimeout(resolve, 450));
      this.farm.doMenuOption(35, 0, 0); // "Xem nhiệm vụ hiện tại" (Nhà Nông) → cmd -62
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.farm.communicate(90);
      await new Promise((resolve) => setTimeout(resolve, 450));
      this.farm.doMenuOption(35, 0, 1); // "Xem danh sách nhiệm vụ" (Nhà Nông) → cmd -81
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.farm.communicate(90);
      await new Promise((resolve) => setTimeout(resolve, 450));
      this.farm.doMenuOption(19, 0, 0); // "Xem nhiệm vụ hiện tại" (Tân Thủ) → cmd -62
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.farm.communicate(90);
      await new Promise((resolve) => setTimeout(resolve, 450));
      this.farm.doMenuOption(38, 0, 0); // "Xem nhiệm vụ hiện tại" (Thợ Câu) → cmd -62
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      this.emit('log', `làm mới nhiệm vụ tiến trình lỗi: ${(err as Error).message}`);
    } finally {
      this.isRefreshingProgress = false;
    }
  }

  private onMessage(msg: Message): void {
    this.lastRxAt = Date.now();
    this.lastPacket.set(msg.command, msg.getData().toString('hex'));
    switch (msg.command) {
      case -4: {
        // LOGIN_SUCESS_J2ME — server J2ME dùng -4 thay vì -34, body = i32 id trực tiếp
        // (khác APK: -34 body có i8 prefix trước i32 id).
        const r4 = msg.reader!;
        try {
          const id = r4.readInt();
          if (id > 0) {
            this.playerId = id;
            this.setStatus('online');
            this.startKeepAlive();
            this.emit('log', `đăng nhập J2ME thành công — id nhân vật = ${id}`);
          } else {
            this.emit('log', `đăng nhập J2ME không thành công (id = ${id})`);
          }
        } catch {
          this.emit('log', `LOGIN_SUCESS_J2ME body lạ: ${msg.getData().toString('hex')}`);
        }
        break;
      }
      case -34: {
        // LOGIN_SUCESS — body bắt đầu bằng i8 + i32 id; phần còn lại là dữ liệu
        // enter-world và các field Avatar (gồm xu, lượng, lượng khóa). id = -1
        // nghĩa là đăng nhập KHÔNG thành công (server vẫn gửi kèm gói -40).
        const r = msg.reader!;
        try {
          r.readByte();
          const id = r.readInt();
          if (id > 0) {
            this.playerId = id;
            this.setStatus('online');
            this.startKeepAlive();
            this.emit('log', `đăng nhập thành công — id nhân vật = ${id}`);
            // LOGIN_SUCESS (-34) chứa ví của Avatar; -94 bên dưới chỉ bổ sung level.
            const wallet = decodeLoginSuccessMoney(msg.getData());
            if (wallet) {
              this.money = wallet.xu;
              this.luong = wallet.luong;
              this.luongKhoa = wallet.luongKhoa;
              this.emit('metrics', {
                xu: wallet.xu,
                luong: wallet.luong,
                luongKhoa: wallet.luongKhoa,
              });
              this.emit(
                'log',
                `số dư login: xu=${wallet.xu} · lượng=${wallet.luong} · lượng khoá=${wallet.luongKhoa}`,
              );
            } else {
              this.emit('log', 'LOGIN_SUCESS không giải mã được số dư ví');
            }
            // Decoder chạy trên body độc lập; lỗi decode KHÔNG được ảnh hưởng status online.
            try {
              const snap = decodeEnterWorld(msg.getData());
              this.emit('world-snapshot', snap);
            } catch (err) {
              const section = (err as { section?: string }).section ?? '?';
              const offset = (err as { offset?: number }).offset ?? -1;
              this.emit('log', `decode enter-world lỗi tại ${section}@${offset}: ${(err as Error).message}`);
              this.emit('world-snapshot-error', err);
            }
            this.requestYourInfo(id);
          } else {
            this.emit('log', `đăng nhập không thành công (id = ${id})`);
          }
        } catch {
          this.emit('log', `LOGIN_SUCESS body lạ: ${msg.getData().toString('hex')}`);
        }
        break;
      }
      case -35: {
        // LOGIN_FAIL
        const reason = safeUtf(msg);
        this.lastError = reason;
        this.setStatus('error');
        this.emit('log', `đăng nhập thất bại: ${reason}`);
        break;
      }
      case 80: {
        // AVATAR_JOIN_PARK — native response carries a new Park snapshot.
        // It must not alter login status; only resolve a waiter registered by
        // AutoFindNpc after the six-byte join request.
        try {
          const snap = decodeParkJoinWorld(msg.getData(), this.playerId ?? 0);
          this.latestParkSnapshot = snap;
          this.emit('world-snapshot', snap);
        } catch (err) {
          const section = (err as { section?: string }).section ?? '?';
          const offset = (err as { offset?: number }).offset ?? -1;
          this.emit('log', `decode Park snapshot lỗi tại ${section}@${offset}: ${(err as Error).message}`);
          this.emit('world-snapshot-error', err);
        }
        break;
      }
      case -37: // VERSION — server báo sai phiên bản
        this.emit('log', `server trả VERSION: ${safeUtf(msg)}`);
        break;
      case -38: // SERVER_INFO
      case -39: // SERVER_MESSAGE
      case -70: // TEXT_BOX
      case -77: { // CUSTOM_POPUP
        try {
          const reason = safeUtf(msg);
          this.emit('log', `server (${msg.command}): ${reason}`);
          const questState = parseQuestDialogText(reason);
          if (questState) {
            if (questState.kind === 'beginner') {
              this.beginnerQuestState = questState;
            } else if (questState.kind === 'fisherman') {
              this.fishermanQuestState = questState;
            } else if (questState.kind === 'farmer') {
              this.farmerQuestState = questState;
            }
            this.syncProgressQuests();
            const q = questState.kind === 'beginner'
              ? this.beginnerQuestState
              : questState.kind === 'fisherman'
                ? this.fishermanQuestState
                : this.farmerQuestState;
            if (q) {
              this.emit(
                'log',
                `cập nhật ${q.title}: ${q.conditions.map((c) => `${c.name} (${c.current}/${c.total})`).join(', ')}`,
              );
            }
            this.emit('quests');
          }
        } catch {
          /* bỏ qua */
        }
        break;
      }
      case -43: // BUY_ITEM_STACK — phản hồi mua vật phẩm xếp chồng (RVA 0x96125C)
      case -92: // AVATAR_BUY_ITEM — phản hồi mua vật phẩm tại shop NPC / vé câu cá / mồi / cần câu (RVA 0x5EC29C)
      case -24: // PARK_BUY_ITEM — fallback cũ J2ME
      case -8: { // Dự phòng trường hợp server gửi -8
        try {
          const r = msg.reader!;
          const itemId = r.readShort();
          let price = 0;
          let typeMoney = 1;
          if (itemId !== -1 && r.available() >= 5) {
            price = r.readInt();
            typeMoney = r.readByte();
          } else if (itemId !== -1 && r.available() >= 4) {
            price = r.readInt();
          }
          let message = '';
          if (r.available() >= 2) {
            try {
              message = r.readUTF();
            } catch {
              /* không có utf message */
            }
          }
          const xu = r.available() >= 4 ? r.readInt() : (this.money ?? 0);
          let luong = this.luong ?? 0;
          let luongKhoa = this.luongKhoa ?? 0;
          if (r.available() >= 4) {
            luong = r.readInt();
          }
          if (r.available() >= 4) {
            luongKhoa = r.readInt();
          }
          this.money = xu;
          this.luong = luong;
          this.luongKhoa = luongKhoa;
          this.emit('metrics', { xu, luong, luongKhoa });
          if (itemId !== -1) {
            this.emit('log', `mua vật phẩm #${itemId} thành công${message ? `: ${message}` : ` (giá ${price}, xu=${xu}, lượng=${luong})`}`);
          } else {
            this.emit('log', `mua vật phẩm #${itemId} thất bại${message ? `: ${message}` : ''}`);
          }
          this.emit('park-buy-item', { itemId, price, typeMoney, message, xu, luong, luongKhoa });
        } catch (err) {
          this.emit('log', `decode phản hồi mua vật phẩm (${msg.command}) lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -10: // thông báo lỗi phiên bản / từ chối đăng nhập (thế giới J2ME)
      case -40: { // hộp thoại thông báo chung của server (lỗi login, nhiệm vụ NPC, giục update…)
        const reason = safeUtf(msg);
        this.emit('log', `server: ${reason}`);
        this.emit('dialog', reason);
        if (this.status === 'logging-in' || this.status === 'connecting' || this.status === 'handshaking') {
          this.lastError = reason;
        }
        const rejection = parseTemporaryLoginRejection(reason);
        if (rejection) this.emit('temporary-rejection', rejection);

        const questState = parseQuestDialogText(reason);
        if (questState) {
          if (questState.kind === 'beginner') {
            this.beginnerQuestState = questState;
          } else if (questState.kind === 'fisherman') {
            this.fishermanQuestState = questState;
          } else if (questState.kind === 'farmer') {
            this.farmerQuestState = questState;
          }
          this.syncProgressQuests();
          const q = questState.kind === 'beginner'
            ? this.beginnerQuestState
            : questState.kind === 'fisherman'
              ? this.fishermanQuestState
              : this.farmerQuestState;
          if (q) {
            this.emit(
              'log',
              `cập nhật ${q.title}: ${q.conditions.map((c) => `${c.name} (${c.current}/${c.total})`).join(', ')}`,
            );
          }
          this.emit('quests');
        }
        break;
      }
      case -88: { // LETTER / TEXT_POPUP (@0x5e99c4)
        try {
          const reason = safeUtf(msg);
          const questState = parseQuestDialogText(reason);
          if (questState) {
            if (questState.kind === 'beginner') {
              this.beginnerQuestState = questState;
            } else if (questState.kind === 'fisherman') {
              this.fishermanQuestState = questState;
            } else if (questState.kind === 'farmer') {
              this.farmerQuestState = questState;
            }
            this.syncProgressQuests();
            const q = questState.kind === 'beginner'
              ? this.beginnerQuestState
              : questState.kind === 'fisherman'
                ? this.fishermanQuestState
                : this.farmerQuestState;
            if (q) {
              this.emit(
                'log',
                `cập nhật ${q.title}: ${q.conditions.map((c) => `${c.name} (${c.current}/${c.total})`).join(', ')}`,
              );
            }
            this.emit('quests');
          }
        } catch {
          /* bỏ qua */
        }
        break;
      }
      case -62: { // CURRENT_QUEST — "Xem nhiệm vụ hiện tại" (NPC Lái buôn)
        try {
          const parts = decodeQuestDialogStrings(msg.getData());
          const text = parts.find((s) => /nhiệm vụ hiện tại/i.test(s));
          if (!text) {
            const meaningful = parts.map((p) => p.trim()).filter(Boolean);
            const joined = meaningful.join(' | ').trim();
            if (joined.length > 0) {
              this.emit('log', `thông báo (-62): ${joined}`);
            }
            break;
          }
          const questState = parseQuestDialogText(text);
          if (questState) {
            if (questState.kind === 'beginner') {
              this.beginnerQuestState = questState;
            } else if (questState.kind === 'fisherman') {
              this.fishermanQuestState = questState;
            } else {
              this.farmerQuestState = questState;
            }
            this.emit(
              'log',
              `cập nhật ${questState.title}: ${questState.conditions
                .map((c) => `${c.name} (${c.current}/${c.total})`)
                .join(', ')}`,
            );
            this.emit('quests');
          }
        } catch (err) {
          this.emit('log', `giải mã nhiệm vụ hiện tại lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -81: { // QUEST_LIST — "Xem danh sách nhiệm vụ" (NPC Lái buôn)
        try {
          const catalog = parseQuestListPacket(msg.getData());
          this.questCatalog = catalog;
          this.emit('log', `danh sách nhiệm vụ: ${catalog.length} quest (mẫu: ${catalog[0]?.title ?? '—'})`);
        } catch (err) {
          this.emit('log', `giải mã danh sách nhiệm vụ lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -87: {
        // INFO_TEXT_BOX_SERVER:
        // - sub_type = 1: phản hồi getServerLoginInfo (@0x5ED0B4)
        // - sub_type = 2: CUSTOM_CHEST / Part data (@0x5F18D8)
        // - sub_type = 3: LoadMap.getAvatar update (@0x5F1368)
        // - sub_type = 4: DAILY_QUEST (DailyQuestScr.dailyQuestMessage @0xAF7664)
        const data = msg.getData();
        if (data.length > 0 && data[0] === 4) {
          try {
            const res = decodeDailyQuestPacket(
              data.subarray(1),
              this.dailyQuestState,
              this.inventory,
              this.produce,
              { trees: this.trees, items: this.items },
            );
            if (res) {
              this.dailyQuestState = res.state;
              this.emit('quests', this.dailyQuestState);
              this.emit(
                'log',
                `nhiệm vụ ngày: ${res.state.score}/${res.state.maxScore} ⭐ · ${res.state.missions.length} nhiệm vụ (${res.state.missions.filter((m) => m.isDone).length} xong)`,
              );
              // Nếu vừa nhận thưởng nhiệm vụ (subAction = 2), nạp lại nhiệm vụ ngày từ server
              if (res.action === 2) {
                try {
                  this.farm.getDailyQuest(0);
                } catch {
                  /* bỏ qua */
                }
              }
            }
          } catch (err) {
            this.emit('log', `giải mã nhiệm vụ ngày lỗi: ${(err as Error).message}`);
          }
        } else if (data.length > 0 && data[0] === 1) {
          this.emit('log', 'server phản hồi getServerLoginInfo — giải mã hai chiều OK');
        } else if (data.length > 0 && data[0] === 2) {
          // Gói tin CUSTOM_CHEST / Part data - bỏ qua để không nhầm sang DailyQuest
        }
        break;
      }
      case 70: {
        // INVENTORY — 4 section; section 1 = hạt giống, 2 = vật phẩm; đuôi chứa số dư xu, farmLevel, levelStore, capacityStore
        const inv = decodeInventory(msg.getData());
        // Section 1 = hạt giống, 2 = vật phẩm thường, 3 = nông sản thu được
        // (`#6×2813` lúa, `#50×530` trứng gà, `#51×202` sữa bò), 4 = nguyên liệu
        // đặc biệt (`#276×10` gà nguyên con, `#279×4` mai rùa may mắn). Phải giữ
        // section 4 riêng: ID hạt giống có thể trùng ID nông sản (ví dụ #4 Nho),
        // nên gộp section 1 vào kho nguyên liệu bếp sẽ đếm hạt thành nông sản.
        this.inventory = [...inv.seeds, ...inv.items];
        this.produce = inv.other[0] ?? [];
        this.cookingMaterials = inv.other[1] ?? [];
        if (inv.xu !== undefined && inv.xu >= 0) {
          this.money = inv.xu;
          this.emit('money', { type: 1, balance: inv.xu, delta: 0 });
        }
        if (inv.farmLevel !== undefined && inv.farmLevel >= 0) {
          this.farmLevel = inv.farmLevel;
          this.emit('metrics', { farmLevel: inv.farmLevel, ...(inv.xu !== undefined ? { xu: inv.xu } : {}) });
        }
        this.emit(
          'log',
          `kho: ${inv.seeds.length} loại hạt, ${inv.items.length} loại vật phẩm, ` +
            `${this.produce.length} loại nông sản (${this.produce.map((i) => `#${i.id}×${i.num}`).join(' ')}), ` +
            `${this.cookingMaterials.length} loại nguyên liệu bếp (${this.cookingMaterials.map((i) => `#${i.id}×${i.num}`).join(' ')})` +
            (inv.xu !== undefined ? ` · xu: ${inv.xu}` : '') +
            (inv.farmLevel !== undefined ? ` · farmLevel: ${inv.farmLevel}` : ''),
        );
        this.emit('inventory', this.inventory);
        this.emit('produce', [...this.produce]);
        this.emit('cooking-materials', [...this.cookingMaterials]);

        this.syncProgressQuests();

        // Cập nhật lại tiến độ kho nông sản cho các nhiệm vụ ngày hiện có
        if (this.dailyQuestState && this.dailyQuestState.missions.length > 0) {
          let changed = false;
          for (const m of this.dailyQuestState.missions) {
            let numCurrent = 0;
            const pItem = this.produce.find((p) => p.id === m.idItem);
            if (pItem) numCurrent += pItem.num;
            if (m.numCurrent !== numCurrent) {
              m.numCurrent = numCurrent;
              m.isDone = numCurrent >= m.numRequired;
              changed = true;
            }
          }
          if (changed) {
            this.emit('quests', this.dailyQuestState);
          }
        }
        break;
      }
      case 100: {
        // INFO_CELL — server đẩy khi 1 ô đổi trạng thái (sau doUsingItem)
        const cell = decodeInfoCell(msg.getData());
        if (this.farmState?.cells[cell.index]) {
          this.farmState.cells[cell.index] = cell;
          this.emit('farm', this.farmState);
        }
        this.emit('log', `ô ${cell.index} cập nhật: hạn=${cell.isArid} cỏ=${cell.isGrass} sâu=${cell.isWorm}`);
        break;
      }
      case 103: {
        try {
          const decoded = decodeShopPacket(msg.getData());
          this.lastShopEvent = decoded.event;
          this.lastShopWarning = decoded.warning ?? null;
          this.emit('shop-protocol', decoded);
          if (decoded.warning) {
            this.emit(
              'log',
              `cmd 103 sub${decoded.event.subType} còn ${decoded.warning.remaining} byte chưa đọc`,
            );
          }
        } catch (err) {
          if (!(err instanceof ShopProtocolDecodeError)) throw err;
          this.emit('shop-protocol-error', err);
          this.emit('log', `giải mã cmd 103 lỗi: ${err.message}`);
        }
        break;
      }
      case 104: {
        // OPEN_INFO_FARM — thông tin chuỗi nhiệm vụ tiến trình (Tân Thủ / Nhà Nông)
        try {
          const data = msg.getData();
          this.emit('log', `nhận gói 104: length=${data.length}, hex=${data.toString('hex')}`);
          const res = decodeProgressQuestPacket(data, this.progressQuestMappings, {
            trees: this.trees,
            items: this.items,
          });
          if (res.status === 'ok-upgrade') {
            this.farmUpgradeRequirements = res.requirements;
            this.emit(
              'log',
              `cập nhật yêu cầu nâng cấp nông trại: ${res.requirements.requirements.length} mục (imageId=${res.requirements.imageId})`,
            );
            this.emit('quests');
          } else if (res.status === 'ok') {
            if (res.state.kind === 'beginner') {
              this.beginnerQuestState = res.state;
            } else if (res.state.kind === 'farmer') {
              this.farmerQuestState = res.state;
            }
            this.syncProgressQuests();
            const q = res.state.kind === 'beginner' ? this.beginnerQuestState : this.farmerQuestState;
            if (q) {
              this.emit(
                'log',
                `cập nhật ${q.title}: ${q.conditions.map((c) => `${c.name} (${c.current}/${c.total})`).join(', ')}`,
              );
            }
            this.emit('quests');
          } else if (res.status === 'unsupported') {
            this.emit('log', `gói 104 chưa hỗ trợ: ${res.reason} (hex=${res.remainingHex})`);
          } else if (res.status === 'ignored') {
            this.emit('log', `gói 104 bị bỏ qua do action=${res.action}`);
          }
        } catch (err) {
          this.emit('log', `giải mã gói 104 lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -94: {
        // REQUEST_YOUR_INFO — thông tin người chơi (idUser, playerLevel, ...)
        try {
          const info = decodePlayerInfo(msg.getData());
          if (info.playerLevel >= 0) {
            this.playerLevel = info.playerLevel;
            this.emit('metrics', { playerLevel: info.playerLevel });
            this.emit('log', `thông tin nhân vật: id=${info.playerId} level=${info.playerLevel}`);
          }
        } catch (err) {
          this.emit('log', `giải mã thông tin nhân vật lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -5: {
        // CRE_CHARACTER — server đẩy toàn bộ dữ liệu nhân vật khi vào game
        // (handler @0x5ed598): setMoney(xu), setGold(lượng mở), luongKhoa(+0x90).
        try {
          const ch = decodeCreCharacter(msg.getData());
          if (ch) {
            this.money = ch.xu;
            this.luong = ch.luong;
            this.luongKhoa = ch.luongKhoa;
            this.emit('metrics', { xu: ch.xu, luong: ch.luong, luongKhoa: ch.luongKhoa });
            this.emit(
              'log',
              `nhân vật: ${ch.name} (id=${ch.id}) · xu=${ch.xu} · lượng=${ch.luong} · lượng khoá=${ch.luongKhoa}`,
            );
          }
        } catch (err) {
          this.emit('log', `giải mã nhân vật lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -3: {
        // UPDATE_MONEY — server đẩy sau mỗi giao dịch (chứa đủ xu, luong mở, luong khoá)
        const m = decodeMoney(msg.getData());
        // Gói ngắn chỉ mang đúng loại tiền `type`; các loại còn lại là
        // undefined và phải được bỏ qua, không được ghi đè 0.
        if (typeof m.xu === 'number' && m.xu >= 0) this.money = m.xu;
        if (typeof m.luong === 'number' && m.luong >= 0) this.luong = m.luong;
        if (typeof m.luongKhoa === 'number' && m.luongKhoa >= 0) this.luongKhoa = m.luongKhoa;
        this.emit('metrics', {
          ...(typeof m.xu === 'number' && m.xu >= 0 ? { xu: m.xu } : {}),
          ...(typeof m.luong === 'number' && m.luong >= 0 ? { luong: m.luong } : {}),
          ...(typeof m.luongKhoa === 'number' && m.luongKhoa >= 0 ? { luongKhoa: m.luongKhoa } : {}),
        });
        this.emit(
          'log',
          `tiền: ${m.delta >= 0 ? '+' : ''}${m.delta} (loại ${m.type}) -> xu=${m.xu ?? '—'} lượng=${m.luong ?? '—'} khóa=${m.luongKhoa ?? '—'}`,
        );
        this.emit('money', m);
        break;
      }
      case 101: {
        // INFO_ANIMAL — server đẩy khi 1 con vật đổi trạng thái (sau khi cho ăn)
        const a: FarmAnimal = decodeInfoAnimal(msg.getData());
        // `index` là số SLOT, không phải vị trí trong mảng: slot trống bị bỏ qua
        // lúc decode nên hai số này lệch nhau ngay khi farm có con đã bán.
        const at = this.farmState?.animals.findIndex((x) => x.index === a.index) ?? -1;
        if (this.farmState && at !== -1) {
          this.farmState.animals[at] = a;
          this.emit('farm', this.farmState);
        }
        this.emit('log', `vật nuôi ${a.index} cập nhật: đói=${a.hunger} máu=${a.health}`);
        break;
      }
      case 65: {
        // USING_ITEM — echo xác nhận: i8 index, i16 idItem
        const r = msg.reader!;
        const index = r.readUnsignedByte();
        const idItem = r.readShort();
        this.emit('log', `server xác nhận: dùng vật phẩm #${idItem} lên ô ${index}`);
        break;
      }
      case 64: // HERVEST — thu hoạch ô
      case 66: // PLANT_SEED — trồng hạt
      case 53: // SELL_ANIMAL — bán vật nuôi
      case 54: { // HARVEST_ANIMAL — thu sản phẩm vật nuôi
        // Bốn lệnh này chưa chốt được layout gói trả lời, và cũng chính là bốn
        // lệnh hay "gửi xong không thấy gì xảy ra". Log nguyên hex để phân biệt
        // được: server im lặng bỏ qua, hay có trả lời mà mình chưa đọc.
        this.emit('log', `server trả lời cmd ${msg.command}: ${msg.getData().toString('hex')}`);
        break;
      }
      case 76: {
        // GET_TREE_INFO — bảng cây trồng. Gói ~13 KB đựng CẢ ba bảng: cây,
        // vật phẩm, vật nuôi. Chỉ decode những khối nào cần: cây là khối đầu
        // (thiết yếu cho thu hoạch/trồng), còn hai khối sau nằm sâu trong đuôi
        // chưa map hết nên decode lỗi không được chặn cây — server tự đẩy trả
        // về một lần cho mọi khối.
        const body = msg.getData();
        this.trees = decodeTreeInfo(body).trees;
        this.emit('log', `bảng cây: ${this.trees.map((t) => `#${t.id} ${t.name}`).join(', ')}`);
        try {
          this.items = decodeItemCatalog(body);
          this.emit('log', `bảng vật phẩm: ${this.items.map((i) => `#${i.id} ${i.name}`).join(', ')}`);
        } catch (err) {
          this.emit('log', `giải mã bảng vật phẩm lỗi: ${(err as Error).message}`);
        }
        try {
          this.animals = decodeAnimalCatalog(body);
          this.emit('log', `bảng vật nuôi: ${this.animals.map((a) => `#${a.id} ${a.name}`).join(', ')}`);
        } catch (err) {
          this.emit('log', `giải mã bảng vật nuôi lỗi: ${(err as Error).message}`);
        }
        try {
          const foods = decodeFoodCatalog(body);
          if (foods && foods.length > 0) {
            this.foods = foods;
            this.foodCatalogReady = true;
            this.emit('log', `bảng món ăn (${foods.length} món): ${foods.map((f) => `#${f.id} ${f.name}`).join(', ')}`);
          } else {
            this.emit('log', 'bảng món ăn chưa sẵn sàng: Cmd 76 không có block công thức hợp lệ');
          }
        } catch (err) {
          this.emit('log', `giải mã bảng món ăn lỗi: ${(err as Error).message}`);
        }
        this.emit('trees', { trees: this.trees, items: this.items, animals: this.animals, foods: this.foods });
        break;
      }
      case 91: {
        // COOKING container (sub-type 0..5)
        try {
          const res = decodeCookingPacket(msg.getData(), this.cookingState);
          if (res) {
            this.cookingState = res.state;
            this.emit('cooking', this.cookingState);
            this.emit(
              'log',
              `bếp (${res.type}): ${res.state.numSlot} ô · ${res.state.slots.filter((s) => s.idFood !== -1).length} ô đang nấu · ${res.state.slots.filter((s) => s.isDone).length} ô chín`,
            );
          }
        } catch (err) {
          this.emit('log', `giải mã bếp lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case 92: {
        // HARVEST_COOK / FLY
        this.emit('log', `thu hoạch món ăn thành công`);
        // Làm mới lại trạng thái kho và bếp sau khi thu hoạch
        this.farm.getInventory();
        this.farm.getCook(0);
        break;
      }
      case 93: {
        // NAU_NHANH
        this.emit('log', `nấu nhanh thành công`);
        this.farm.getCook(0);
        break;
      }
      case 69: // JOIN — toàn bộ dữ liệu farm
      case 61: // cùng payload readFarmData
        try {
          this.farmState = decodeFarmData(msg.getData());
          // Tự động tải catalog dữ liệu cây / vật phẩm / món ăn, thông tin bếp và nhiệm vụ ngày khi vào farm
          this.farm.getTreeInfo();
          this.farm.getCook(0);
          this.farm.getDailyQuest(0);
          // Tự động tương tác với NPC Lái buôn để lấy hộp thoại nhiệm vụ tiến trình mới nhất
          void this.refreshProgressQuests();
          // INFO_ANIMAL (cmd 101) chỉ có index mà không có species-ngữ-cảnh —
          // nếu gói 101 về trước gói 69 thì vùng phân loại (đã lưu trong farmState)
          // chưa có để chia ao/chuồng.
          if (this.farmState.animals.length > 0) {
            classifyFarmSlots(this.farmState);
          }
          this.syncProgressQuests();
          const n = this.farmState.cells.filter((c) => c.idTree !== -1).length;
          // In kèm idFarm và playerId: lệnh farm gửi đi lấy idFarm làm tham số
          // đầu, nhưng client thật gọi `doUsingItem(playerId, …)`. Hai số này
          // khác nhau là nghi can số một khi lệnh gửi đi mà không có tác dụng.
          this.emit(
            'log',
            `dữ liệu farm: ${this.farmState.cells.length} ô (${n} ô có cây) · ` +
              `idFarm=${this.farmState.idFarm} playerId=${this.playerId}`,
          );
          this.emit('farm', this.farmState);
        } catch (err) {
          this.emit('log', `giải mã farm lỗi: ${(err as Error).message}`);
        }
        break;
      case 45: {
        // START_CAU_CA (RX45): bool iss, [utf error if iss=false]
        try {
          const r = new MyReader(msg.getData());
          const iss = r.readBoolean();
          const error = iss ? undefined : r.readUTF();
          this.emit('log', `[câu cá] phản hồi bắt đầu câu (RX45): iss=${iss}${error ? ` (lỗi: ${error})` : ''}`);
          this.emit('fishing-start-result', { iss, error });
        } catch {
          this.emit('fishing-start-result', { iss: false, error: 'RX45 decode error' });
        }
        break;
      }
      case 41: {
        // QUANG_CAU (RX41): i32 idUser
        try {
          const r = new MyReader(msg.getData());
          const idUser = r.readInt();
          this.emit('fishing-quan-cau', { idUser });
        } catch {
          // ignore
        }
        break;
      }
      case 43: {
        // CAU_THANH_CONG (RX43): i32 idUser, i16 idFish
        try {
          const r = new MyReader(msg.getData());
          const idUser = r.readInt();
          const idFish = r.readShort();
          this.emit('fishing-success-result', { idUser, idFish });
        } catch {
          this.emit('log', 'RX43 CAU_THANH_CONG decode thất bại');
        }
        break;
      }
      case 44: {
        // CAU_CA_XONG (RX44): i32 idUser
        try {
          const r = new MyReader(msg.getData());
          const idUser = r.readInt();
          this.emit('fishing-done', { idUser });
        } catch {
          // ignore
        }
        break;
      }
      case 79: {
        // CAN_CAU (RX79) — cá cắn câu + ảnh mini-game
        try {
          const payload = decodeCanCau(msg.getData());
          this.emit('fishing-challenge', payload);
        } catch {
          this.emit('log', 'RX79 CAN_CAU decode thất bại');
        }
        break;
      }
      case 85: {
        // PARK_CHAT (RX85): i32 idUser, utf text, [i8 style]
        try {
          const r = new MyReader(msg.getData());
          const idUser = r.readInt();
          const text = r.readUTF();
          let style = 0;
          if (r.available() >= 1) {
            style = r.readByte();
          }
          this.emit('log', `[chat park] ${idUser}: ${text}`);
          this.emit('park-chat', { idUser, text, style });
        } catch (err) {
          this.emit('log', `decode park-chat (85) lỗi: ${(err as Error).message}`);
        }
        break;
      }
      case -60: {
        const body = msg.getData();
        const rawHex = body.toString('hex');
        try {
          const challenge = decodeCaptchaChallenge(body);
          let decoded: { format: string; bytes: Buffer } | null = null;
          let sha256: string | null = null;
          let error: Error | null = null;
          if (challenge.imageBytes) {
            sha256 = crypto.createHash('sha256').update(challenge.imageBytes).digest('hex');
            try {
              decoded = decodeCaptchaImage(challenge);
            } catch (e) {
              error = e as Error;
            }
          }
          this.emit('captcha', { challenge, decoded, sha256, error, rawHex } as CaptchaEvent);
          const fmt = decoded?.format ?? (challenge.imageBytes ? 'unknown' : 'no-image');
          const size = challenge.imageBytes?.length ?? 0;
          this.emit(
            'log',
            `[captcha] nhận challenge targetId=${challenge.targetId} menuId=${challenge.menuId} prompt="${challenge.prompt.slice(0, 30)}" format=${fmt} bytes=${size} sha=${(sha256 ?? '').slice(0, 12)}${sha256 ? '...' : ''}`,
          );
          if (error) {
            this.emit('log', `[captcha] lỗi nhận diện ảnh: ${error.message}`);
          }
        } catch (err) {
          this.emit('captcha', {
            challenge: null,
            decoded: null,
            sha256: null,
            error: err as Error,
            rawHex,
          } as CaptchaEvent);
          this.emit('log', `[captcha] lỗi decode: ${(err as Error).message} hex=${rawHex.slice(0, 64)}`);
        }
        break;
      }
      default:
        break;
    }
    this.emit('message', msg);
  }
}

function cloneParkSnapshot(snapshot: EnterWorldSnapshot): EnterWorldSnapshot {
  return {
    ...snapshot,
    specials: snapshot.specials.map((special) => ({
      ...special,
      imageIds: [...special.imageIds],
      menuIds: [...special.menuIds],
    })),
  };
}

/** Nhiều gói lỗi/dialog mở đầu bằng 1 chuỗi UTF — đọc thử, hỏng thì bỏ qua. */
function safeUtf(msg: Message): string {
  try {
    return msg.reader?.readUTF() ?? '';
  } catch {
    return `<${msg.getData().toString('hex')}>`;
  }
}
