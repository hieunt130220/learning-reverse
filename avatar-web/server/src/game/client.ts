import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

import { Message } from '../proto/message.js';
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
  DEFAULT_FOOD_CATALOG,
  type CookingState,
  type DailyQuestState,
  type FarmState,
  type FoodRecipe,
  type InventoryItem,
  type AnimalInfo,
  type FarmAnimal,
  type ItemInfo,
  type TreeInfo,
} from './farmData.js';
import { FarmService } from './farmService.js';
import { cmdName } from './opcodes.js';

/**
 * Giá trị handler cho `GET_HANDLER (-1)`. `GlobalLogicHandler.doGetHandler`
 * @0x5E4974 rẽ nhánh: 3 = casino, 8/9/10 = farm (10 là cái server trả về
 * kèm luôn gói dữ liệu farm cmd 69).
 */
export const HANDLER_FARM = 10;

/** Hằng lấy từ GameMidlet..cctor @0x5E0A4C. */
export const GAME_MIDLET = {
  CLIENT_TYPE: 8, // str w10=8 -> [+0x48]
  PROVIDER: 0, // strb wzr -> [+0x4C]
  DEVICE: 0, // str wzr -> [+0x6C]
  VERSION: '3.4.4', // = Application.version, khớp versionName trong apktool.yml
  VERSIONCODE: 13, // mov w10,#0xd -> [+0x78]
};

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

/**
 * Client headless: giữ TCP session, chạy handshake + login rồi phơi
 * FarmService ra ngoài cho tầng web điều khiển.
 */
export class GameClient extends EventEmitter {
  readonly session = new Session();
  readonly farm = new FarmService(this.session);

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
  /** Bảng cây trồng (cmd 76) — dùng để hiện tên thay vì id. */
  trees: TreeInfo[] = [];
  /** Bảng vật phẩm rút từ cùng gói 76. */
  items: ItemInfo[] = [];
  /** Bảng vật nuôi (id 50..61) từ cùng gói 76. */
  animals: AnimalInfo[] = [];
  /** Danh mục công thức món ăn nấu trong bếp. */
  foods: FoodRecipe[] = [...DEFAULT_FOOD_CATALOG];
  /** Trạng thái bếp nấu ăn (cmd 91). */
  cookingState?: CookingState;
  /** Trạng thái nhiệm vụ hàng ngày (cmd -87 sub 2). */
  dailyQuestState: DailyQuestState | null = null;
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
  /**
   * Body đầy đủ của gói RX gần nhất theo từng cmd, dạng hex.
   * Log gói tin trên UI cắt còn 64 byte, cái này giữ nguyên để còn giải mã tiếp
   * các gói lớn (vd GET_TREE_INFO 13 KB).
   */
  readonly lastPacket = new Map<number, string>();

  private device: DeviceProfile = { ...DEFAULT_DEVICE };
  private inFarm = false;
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
      this.inFarm = false;
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
  }): Promise<void> {
    this.device = { ...DEFAULT_DEVICE, ...opts.device };
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

    this.setProviderAndClientType();

    // GlobalService.getServerLoginInfo @0x699478 — cmd -87 sub-type 1.
    // Là request duy nhất đã xác nhận có phản hồi ở giai đoạn trước đăng nhập,
    // dùng làm kiểm chứng "server đang nghe và giải mã được ta".
    const info = Message.create(-87);
    info.writer!.writeByte(1);
    this.session.send(info);

    this.setStatus('logging-in');
    this.sendLogin(opts.user, opts.pass);
  }

  logout(): void {
    this.inFarm = false;
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
        this.farm.getInventory();
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
   * Vào nông trại.
   * - Lần đầu tiên trong phiên: xin handler farm bằng `GET_HANDLER (-1) + i8 10`.
   *   Server chuyển context sang farm và tự đẩy về gói 69.
   * - Các lần sau trong cùng phiên (làm mới dữ liệu farm / chu kỳ auto): gửi
   *   `doJoinFarm` (cmd 69) để cập nhật dữ liệu mà không gọi lại GET_HANDLER 10
   *   (server coi việc xin lại handler khi đang ở trong farm là bất thường và đóng TCP socket).
   */
  enterFarm(idFarm?: number): void {
    if (!this.inFarm) {
      this.inFarm = true;
      const m = Message.create(-1);
      m.writer!.writeByte(HANDLER_FARM);
      this.session.send(m);
    } else {
      const targetId = idFarm ?? this.farmState?.idFarm ?? this.playerId ?? 0;
      this.farm.joinFarm(targetId);
    }
  }

  /** Gửi yêu cầu lấy thông tin chi tiết nhân vật (cmd -94). */
  requestYourInfo(idUser?: number): void {
    const target = idUser ?? this.playerId ?? 0;
    const m = Message.create(-94);
    m.writer!.writeInt(target);
    this.session.send(m);
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

  private onMessage(msg: Message): void {
    this.lastRxAt = Date.now();
    this.lastPacket.set(msg.command, msg.getData().toString('hex'));
    switch (msg.command) {
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
      case -37: // VERSION — server báo sai phiên bản
        this.emit('log', `server trả VERSION: ${safeUtf(msg)}`);
        break;
      case -40: { // hộp thoại thông báo chung của server (lỗi login, giục update…)
        const reason = safeUtf(msg);
        this.emit('log', `server: ${reason}`);
        this.emit('dialog', reason);
        if (this.status === 'logging-in' || this.status === 'connecting' || this.status === 'handshaking') {
          this.lastError = reason;
        }
        const rejection = parseTemporaryLoginRejection(reason);
        if (rejection) this.emit('temporary-rejection', rejection);
        break;
      }
      case -87: {
        // INFO_TEXT_BOX_SERVER — phản hồi getServerLoginInfo (sub=1) hoặc DAILY_QUEST (sub=4 hoặc sub=2)
        const data = msg.getData();
        if (data.length > 0 && (data[0] === 4 || data[0] === 2)) {
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
              // Nếu vừa nhận thưởng nhiệm vụ (action 2), tự xin lại state đầy đủ
              if (res.action === 2) {
                this.farm.getDailyQuest(0);
              }
            }
          } catch (err) {
            this.emit('log', `giải mã nhiệm vụ ngày lỗi: ${(err as Error).message}`);
          }
        } else {
          this.emit('log', 'server phản hồi getServerLoginInfo — giải mã hai chiều OK');
        }
        break;
      }
      case 70: {
        // INVENTORY — 4 section; section 1 = hạt giống, 2 = vật phẩm; đuôi chứa số dư xu, farmLevel, levelStore, capacityStore
        const inv = decodeInventory(msg.getData());
        this.inventory = [...inv.seeds, ...inv.items];
        // Section 3 = NÔNG SẢN thu được (đo thật: `#6×2813` lúa, `#50×530` trứng
        // gà, `#51×202` sữa bò — id trùng bảng cây/bảng vật nuôi). Trước đây bị
        // bỏ đi cùng section 4, nên thu hoạch xong nhìn vào kho thấy y nguyên và
        // tưởng lệnh không chạy.
        this.produce = inv.other[0] ?? [];
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
            `${this.produce.length} loại nông sản (${this.produce.map((i) => `#${i.id}×${i.num}`).join(' ')})` +
            (inv.xu !== undefined ? ` · xu: ${inv.xu}` : '') +
            (inv.farmLevel !== undefined ? ` · farmLevel: ${inv.farmLevel}` : ''),
        );
        this.emit('inventory', this.inventory);

        // Cập nhật lại tiến độ kho hàng cho các nhiệm vụ ngày hiện có
        if (this.dailyQuestState && this.dailyQuestState.missions.length > 0) {
          let changed = false;
          for (const m of this.dailyQuestState.missions) {
            let numCurrent = 0;
            const pItem = this.produce.find((p) => p.id === m.idItem);
            if (pItem) numCurrent += pItem.num;
            const invItem = this.inventory.find((p) => p.id === m.idItem);
            if (invItem) numCurrent += invItem.num;
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
            this.emit('log', `bảng món ăn (${foods.length} món): ${foods.map((f) => `#${f.id} ${f.name}`).join(', ')}`);
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
          // INFO_ANIMAL (cmd 101) chỉ có index mà không có species-ngữ-cảnh —
          // nếu gói 101 về trước gói 69 thì vùng phân loại (đã lưu trong farmState)
          // chưa có để chia ao/chuồng.
          if (this.farmState.animals.length > 0) {
            classifyFarmSlots(this.farmState);
          }
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
      default:
        break;
    }
    this.emit('message', msg);
  }
}

/** Nhiều gói lỗi/dialog mở đầu bằng 1 chuỗi UTF — đọc thử, hỏng thì bỏ qua. */
function safeUtf(msg: Message): string {
  try {
    return msg.reader?.readUTF() ?? '';
  } catch {
    return `<${msg.getData().toString('hex')}>`;
  }
}
