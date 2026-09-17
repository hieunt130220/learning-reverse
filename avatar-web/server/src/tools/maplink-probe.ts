/**
 * maplink-probe.ts — truy vết map con sau 3 cổng Khu ngoại ô (map 17).
 *
 * Spec: docs/superpowers/specs/2026-09-17-quet-object-dao-go-da-design.md
 * Plan: docs/superpowers/plans/2026-09-17-quet-object-dao-go-da.md
 *
 * Các chế độ chạy:
 * 1. Tải LinkMap chuẩn qua TX -51:
 *    npx tsx src/tools/maplink-probe.ts --account-id 3 --get-linkmap 17
 * 2. Join probe map con & quét ItemMapSpecial:
 *    npx tsx src/tools/maplink-probe.ts --account-id 3 --area 0 --probe-submap <roomId>
 * 3. Thử nghiệm join room (legacy B1):
 *    npx tsx src/tools/maplink-probe.ts --account-id 3 --area 0 --probe-room <roomId>
 */
import { writeFileSync } from 'node:fs';
import { get as httpGet } from 'node:http';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
import type { Message } from '../proto/message.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo } from '../proto/session.js';

type ProbeMode = 'get-linkmap' | 'probe-submap' | 'probe-room';

interface ProbeArgs {
  accountId: number;
  mode: ProbeMode;
  targetId: number;
  area: number;
  mineRock?: number;
  menu?: number;
  scanAreas?: number;
}

type ProbePhase =
  | 'login'
  | 'park-context'
  | 'switch-handler-8'
  | 'request-linkmap'
  | 'probe-join'
  | 'scan-submap'
  | 'open-menu'
  | 'select-menu'
  | 'item-special'
  | 'scan-areas'
  | 'return-join';

interface LinkMapGate {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  idMapTo: number;
}

interface DecodedLinkMap {
  idMap: number;
  wMap: number;
  hMap: number;
  linkCount: number;
  gates: LinkMapGate[];
  rawBytes: number;
}

interface MapObjectMetadata {
  id: number;
  name: string;
  type: number;
  imageCount: number;
  menuIds: number[];
}

interface JoinObservation {
  status: 'joined' | 'timeout' | 'mismatch';
  roomId: number | null;
  boardId: number | null;
  x: number | null;
  y: number | null;
  responseBytes: number | null;
  specialCount?: number | null;
  specials?: MapObjectMetadata[];
}

interface MenuEntry {
  idMenu: number;
  caption: string;
}

interface OpenMenuObservation {
  objectId: number;
  menuEntries: MenuEntry[];
}

interface SelectMenuObservation {
  objectId: number;
  idMenu: number;
  dialogs: string[];
  containerDelta: Array<{ id: number; before: number; after: number }>;
  unknownRx: Array<{ cmd: number; len: number }>;
}

function sanitizeCaption(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
}

function safeUtf(msg: Message): string {
  try {
    const reader = new MyReader(msg.getData());
    return reader.readUTF();
  } catch {
    return '';
  }
}

function decodeAddMenu(body: Buffer): MenuEntry | null {
  try {
    const reader = new MyReader(body);
    const mode = reader.readByte();
    const idMenu = reader.readShort();
    if (mode === 1) {
      const caption = sanitizeCaption(reader.readUTF());
      return { idMenu, caption };
    }
    return null;
  } catch {
    return null;
  }
}

async function executeOpenMenu(
  client: GameClient,
  objectId: number,
  timeoutMs = 5_000,
): Promise<OpenMenuObservation> {
  const menuEntries: MenuEntry[] = [];

  return new Promise<OpenMenuObservation>((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const onMessage = (msg: Message): void => {
      if (msg.command === -101) {
        const entry = decodeAddMenu(msg.getData());
        if (entry) menuEntries.push(entry);
      } else if (
        msg.command === -62 ||
        msg.command === -70 ||
        msg.command === -71 ||
        msg.command === -87
      ) {
        try {
          const text = sanitizeCaption(safeUtf(msg));
          if (text) menuEntries.push({ idMenu: -1, caption: text });
        } catch {
          // ignore malformed utf
        }
      }
    };

    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };

    const finish = (): void => {
      cleanup();
      resolve({ objectId, menuEntries });
    };

    client.session.on('message', onMessage);
    timer = setTimeout(finish, timeoutMs);

    // Gửi TX -59 [i32 objectId] đúng 1 lần
    client.sendRaw(-59, [{ t: 'i32', v: String(objectId) }]);
  });
}

async function executeSelectMenu(
  client: GameClient,
  objectId: number,
  idMenu: number,
  timeoutMs = 5_000,
): Promise<SelectMenuObservation> {
  const dialogs: string[] = [];
  const containerDelta: Array<{ id: number; before: number; after: number }> = [];
  const unknownRx: Array<{ cmd: number; len: number }> = [];

  return new Promise<SelectMenuObservation>((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const onMessage = (msg: Message): void => {
      const cmd = msg.command;
      const data = msg.getData();
      if (
        cmd === -62 ||
        cmd === -70 ||
        cmd === -71 ||
        cmd === -87 ||
        cmd === -77 ||
        cmd === -40
      ) {
        try {
          const text = sanitizeCaption(safeUtf(msg));
          if (text) dialogs.push(text);
        } catch {
          unknownRx.push({ cmd, len: data.length });
        }
      } else if (cmd !== -3 && cmd !== 85 && cmd !== -20) {
        unknownRx.push({ cmd, len: data.length });
      }
    };

    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };

    const finish = (): void => {
      cleanup();
      resolve({ objectId, idMenu, dialogs, containerDelta, unknownRx });
    };

    client.session.on('message', onMessage);
    timer = setTimeout(finish, timeoutMs);

    // Gửi TX -61 [i32 objectId, i8 idMenu, i8 sub=-1] đúng 1 lần
    client.sendRaw(-61, [
      { t: 'i32', v: String(objectId) },
      { t: 'i8', v: String(idMenu) },
      { t: 'i8', v: '-1' },
    ]);
  });
}

interface ItemSpecialObservation {
  objectId: number;
  menuIndex: number;
  dialogs: string[];
  rxMessages: Array<{ cmd: number; len: number; hex?: string; text?: string }>;
}

async function executeItemSpecial(
  client: GameClient,
  objectId: number,
  menuIndex: number,
  timeoutMs = 5_000,
): Promise<ItemSpecialObservation> {
  const dialogs: string[] = [];
  const rxMessages: Array<{ cmd: number; len: number; hex?: string; text?: string }> = [];

  return new Promise<ItemSpecialObservation>((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const onMessage = (msg: Message): void => {
      const cmd = msg.command;
      const data = msg.getData();
      let text: string | undefined;
      if (
        cmd === -40 ||
        cmd === -62 ||
        cmd === -70 ||
        cmd === -71 ||
        cmd === -87 ||
        cmd === -77
      ) {
        try {
          text = sanitizeCaption(safeUtf(msg));
          if (text) dialogs.push(text);
        } catch {}
      }
      rxMessages.push({
        cmd,
        len: data.length,
        hex: data.length <= 64 ? data.toString('hex') : undefined,
        text,
      });
    };

    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };

    const finish = (): void => {
      cleanup();
      resolve({ objectId, menuIndex, dialogs, rxMessages });
    };

    client.session.on('message', onMessage);
    timer = setTimeout(finish, timeoutMs);

    // Gửi TX 48 [i8 3, i32 objectId, i8 menuIndex] đúng 1 lần (IL2CPP GlobalService.doItemSpecial)
    client.sendRaw(48, [
      { t: 'i8', v: '3' },
      { t: 'i32', v: String(objectId) },
      { t: 'i8', v: String(menuIndex) },
    ]);
  });
}

interface TxRxMetadata {
  phase: ProbePhase;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}

interface ProbeEventMetadata {
  phase: ProbePhase;
  event: 'dialog' | 'temporary-rejection' | 'status' | 'closed';
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseInfo['kind'];
  hadError?: boolean;
}

/**
 * Tọa độ THỬ NGHIỆM cho room chưa verify.
 */
const UNVERIFIED_PROBE_POSITIONS: Readonly<Record<number, { x: number; y: number }>> =
  Object.freeze({
    88: Object.freeze({ x: 100, y: 100 }), // mượn tạm tọa độ hub 17
    18: Object.freeze({ x: 108, y: 205 }), // tọa độ nhà tù từ bd.java
    22: Object.freeze({ x: 100, y: 100 }), // mỏ gỗ (Map 22)
    26: Object.freeze({ x: 250, y: 45 }), // đứng sát mỏ đá 2000000028 (pos: 260, 32)
  });

const HUB_MAP = 17;
const ALLOWED = new Set([
  '--account-id',
  '--area',
  '--probe-room',
  '--get-linkmap',
  '--probe-submap',
  '--mine-rock',
  '--menu',
  '--scan-areas',
]);
const JOIN_TIMEOUT_MS = 7_000;
const RETURN_COOLDOWN_MS = 2_000;

class RedactedProbeError extends Error {
  constructor(
    readonly section: string,
    message: string,
    readonly offset = -1,
  ) {
    super(message);
    this.name = 'RedactedProbeError';
  }
}

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new RedactedProbeError('cli', `${key} phải là số nguyên đơn`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new RedactedProbeError('cli', `${key} vượt giới hạn số nguyên an toàn`);
  }
  return value;
}

function parseArgs(argv: string[]): ProbeArgs {
  const values = new Map<string, number>();
  let i = 0;
  while (i < argv.length) {
    const key = argv[i]!;
    if (!ALLOWED.has(key)) {
      throw new RedactedProbeError('cli', 'key hoặc positional arg không được phép');
    }
    if (values.has(key)) {
      throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
    }
    const raw = argv[i + 1];
    if (raw === undefined || raw.startsWith('--')) {
      throw new RedactedProbeError('cli', `thiếu value cho ${key}`);
    }
    values.set(key, parseInteger(key, raw));
    i += 2;
  }

  if (!values.has('--account-id')) {
    throw new RedactedProbeError('cli', 'thiếu key bắt buộc: --account-id');
  }
  const accountId = values.get('--account-id')!;
  if (accountId <= 0) {
    throw new RedactedProbeError('cli', '--account-id phải là số nguyên dương');
  }

  let mode: ProbeMode;
  let targetId: number;
  if (values.has('--get-linkmap')) {
    mode = 'get-linkmap';
    targetId = values.get('--get-linkmap')!;
  } else if (values.has('--probe-submap')) {
    mode = 'probe-submap';
    targetId = values.get('--probe-submap')!;
  } else if (values.has('--probe-room')) {
    mode = 'probe-room';
    targetId = values.get('--probe-room')!;
  } else {
    throw new RedactedProbeError(
      'cli',
      'phải chỉ định 1 trong 3 chế độ: --get-linkmap, --probe-submap, hoặc --probe-room',
    );
  }

  const area = values.get('--area') ?? 0;
  if (area < -128 || area > 127) {
    throw new RedactedProbeError('cli', '--area phải nằm trong signed-byte -128..127');
  }

  const mineRock = values.get('--mine-rock');
  const menu = values.get('--menu');
  const scanAreas = values.get('--scan-areas');

  return { accountId, mode, targetId, area, mineRock, menu, scanAreas };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RedactedProbeError('health', 'PORT local không hợp lệ');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    const request = httpGet(
      { host: '127.0.0.1', port, path: '/api/auth/me', timeout: 750 },
      (response) => {
        response.resume();
        finish(new RedactedProbeError('health', 'hãy dừng Avatar Web server trước khi probe'));
        request.destroy();
      },
    );
    request.once('timeout', () => {
      finish();
      request.destroy();
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if (error.code === 'ECONNREFUSED') {
        finish();
        return;
      }
      finish(
        new RedactedProbeError(
          'health',
          `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`,
        ),
      );
    });
  });
}

async function loginWithTimeout(
  client: GameClient,
  options: Parameters<GameClient['login']>[0],
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        client.logout();
      } finally {
        reject(new RedactedProbeError('login', 'hết giờ kết nối hoặc bắt đầu đăng nhập game'));
      }
    }, timeoutMs);
  });
  try {
    await Promise.race([client.login(options), timeout]);
  } catch (error) {
    if (error instanceof RedactedProbeError) throw error;
    throw new RedactedProbeError('login', 'không thể kết nối hoặc bắt đầu đăng nhập game');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(
      new RedactedProbeError('login', `game client không online (status=${client.status})`),
    );
  }
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      client.removeListener('status', onStatus);
    };
    const onStatus = (status: ClientStatus): void => {
      if (status === 'online') {
        cleanup();
        resolve();
      } else if (status === 'error' || status === 'idle') {
        cleanup();
        reject(new RedactedProbeError('login', `game client không online (status=${status})`));
      }
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new RedactedProbeError('login', 'hết giờ chờ game client online'));
    }, timeoutMs);
    client.on('status', onStatus);
  });
}

function waitForHandlerResponse(
  client: GameClient,
  signal: AbortSignal,
  expectedHandler: number,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        error instanceof RedactedProbeError
          ? error
          : new RedactedProbeError('handler', `không nhận được ACK handler ${expectedHandler}`),
      );
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length !== 1 || body.readInt8(0) !== expectedHandler) return;
      finishResolve();
    };
    const onAbort = (): void =>
      finishReject(new RedactedProbeError('handler', 'chờ ACK handler bị hủy'));
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(
        new RedactedProbeError('handler', `hết giờ chờ ACK handler ${expectedHandler}`),
      );
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

/**
 * Đón nhận và giải mã gói tin RX -51 (DOWNLOAD_DATA / LinkMap).
 */
function waitForDownloadDataResponse(
  client: GameClient,
  signal: AbortSignal,
  expectedMapId: number,
  timeoutMs: number,
): Promise<DecodedLinkMap> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (val: DecodedLinkMap): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onAbort = (): void => {
      finishReject(new RedactedProbeError('linkmap-timeout', 'chờ RX -51 bị hủy'));
    };

    const onMessage = (msg: Message): void => {
      if (msg.command !== -51) return;
      const body = msg.getData();
      if (body.length < 3) return;
      try {
        writeFileSync('/tmp/rx51_map17.bin', body);
      } catch {}

      const reader = new MyReader(body);
      const subType = reader.readByte();
      if (subType !== 24 && subType !== 4) {
        return; // không phải subtype LinkMap
      }

      try {
        const idMap = reader.readShort();
        let wMap = 0;
        let hMap = 0;
        let linkCount = 0;
        const gates: LinkMapGate[] = [];

        if (subType === 24) {
          // 1. DataMap tile array: dataLen (int), bytes
          const dataLen = reader.readInt();
          if (dataLen > 0 && reader.available() >= dataLen) {
            reader.readBytes(dataLen);
          }
          // 2. Images: imgCount (byte), then for each: index (byte), imgLen (int), bytes
          const imgCount = reader.readByte();
          for (let i = 0; i < imgCount; i += 1) {
            if (reader.available() < 5) break;
            reader.readByte(); // image index
            const imgLen = reader.readInt();
            if (reader.available() >= imgLen) {
              reader.readBytes(imgLen);
            }
          }
          // 3. idBG: short
          if (reader.available() >= 2) {
            reader.readShort();
          }
          // 4. LinkMap header: linkIdMap (short), wMap (int), hMap (int), linkCount (byte)
          if (reader.available() >= 11) {
            const linkIdMap = reader.readShort();
            if (linkIdMap !== -1) {
              wMap = reader.readInt();
              hMap = reader.readInt();
              linkCount = reader.readByte();
              for (let idx = 0; idx < linkCount; idx += 1) {
                if (reader.available() < 18) break;
                const x1 = reader.readInt();
                const y1 = reader.readInt();
                const x2 = reader.readInt();
                const y2 = reader.readInt();
                const idMapTo = reader.readShort();
                gates.push({ index: idx, x1, y1, x2, y2, idMapTo });
              }
            }
          }
        } else if (subType === 4) {
          if (reader.available() >= 9) {
            wMap = reader.readInt();
            hMap = reader.readInt();
            linkCount = reader.readByte();
            for (let idx = 0; idx < linkCount; idx += 1) {
              if (reader.available() < 18) break;
              const x1 = reader.readInt();
              const y1 = reader.readInt();
              const x2 = reader.readInt();
              const y2 = reader.readInt();
              const idMapTo = reader.readShort();
              gates.push({ index: idx, x1, y1, x2, y2, idMapTo });
            }
          }
        }

        finishResolve({
          idMap,
          wMap,
          hMap,
          linkCount: gates.length,
          gates,
          rawBytes: body.length,
        });
      } catch (err) {
        finishReject(
          new RedactedProbeError('linkmap-decode', 'lỗi khi parse body gói tin RX -51'),
        );
      }
    };

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort);
    timer = setTimeout(() => {
      finishReject(new RedactedProbeError('linkmap-timeout', 'hết giờ chờ gói tin RX -51'));
    }, timeoutMs);
  });
}

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new RedactedProbeError('park-response', `thiếu count ${section}`, reader.position);
  }
  const raw = reader.readByte();
  if (raw < 0) return 0;
  if (raw > 64) {
    throw new RedactedProbeError(
      'park-response',
      `count ${section} vượt giới hạn`,
      reader.position - 1,
    );
  }
  return raw;
}

function readNativeUtf(reader: MyReader, section: string): string {
  if (reader.available() < 2) {
    throw new RedactedProbeError('park-response', `thiếu độ dài UTF ${section}`, reader.position);
  }
  const length = reader.readUnsignedShort();
  if (length > 8_192 || reader.available() < length) {
    throw new RedactedProbeError(
      'park-response',
      `UTF ${section} vượt bounds`,
      reader.position - 2,
    );
  }
  return reader.readBytes(length).toString('utf8');
}

function readNativeBytes(reader: MyReader, bytes: number, section: string): void {
  if (bytes < 0 || reader.available() < bytes) {
    throw new RedactedProbeError('park-response', `thiếu bytes ${section}`, reader.position);
  }
  reader.readBytes(bytes);
}

function readNativeBytesOne(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new RedactedProbeError('park-response', `thiếu byte ${section}`, reader.position);
  }
  return reader.readByte();
}

function skipListPlayer(reader: MyReader): number {
  const count = readNativeCount(reader, 'listPlayer');
  for (let i = 0; i < count; i += 1) {
    readNativeBytes(reader, 4, 'player.id');
    readNativeUtf(reader, `player[${i}].name`);
    const partCount = readNativeCount(reader, 'player.parts');
    readNativeBytes(reader, partCount * 2, 'player.parts');
    readNativeBytes(reader, 18, 'player.state');
  }
  const dropCount = readNativeCount(reader, 'dropParts');
  readNativeBytes(reader, dropCount * (1 + 2 + 4 + 2 + 2), 'dropParts');
  return count;
}

function readMapSpecial(reader: MyReader, index: number): MapObjectMetadata {
  if (reader.available() < 4) {
    throw new RedactedProbeError(
      'park-response',
      `thiếu id special[${index}].id`,
      reader.position,
    );
  }
  const id = reader.readInt();
  const name = readNativeUtf(reader, `special[${index}].name`);
  readNativeBytes(reader, 4 + 4, `special[${index}].pos`);
  const type = readNativeBytesOne(reader, `special[${index}].type`);
  const imageCount = readNativeCount(reader, `special[${index}].images`);
  readNativeBytes(reader, imageCount * 2, `special[${index}].images`);
  readNativeBytes(reader, 8 * 4, `special[${index}].state`);
  const menuCount = readNativeCount(reader, `special[${index}].menus`);
  const menuIds: number[] = [];
  for (let menu = 0; menu < menuCount; menu += 1) {
    if (reader.available() < 2) {
      throw new RedactedProbeError(
        'park-response',
        `thiếu menu[${menu}] special[${index}]`,
        reader.position,
      );
    }
    menuIds.push(reader.readShort());
  }
  return { id, name, type, imageCount, menuIds };
}

function parseSpecialsFromBuffer(body: Buffer): MapObjectMetadata[] {
  const specials: MapObjectMetadata[] = [];
  const sig = Buffer.from([0x77, 0x35, 0x94]); // 2,000,000,000 range objectId
  let pos = 0;
  while (pos < body.length) {
    const idx = body.indexOf(sig, pos);
    if (idx === -1) break;
    const objPos = idx;
    const reader = new MyReader(body.subarray(objPos));
    try {
      const id = reader.readInt();
      const nlen = reader.readShort();
      let name = '';
      if (nlen > 0 && reader.available() >= nlen) {
        name = reader.readBytes(nlen).toString('utf8');
      }
      if (reader.available() < 10) break;
      reader.readInt(); // x
      reader.readInt(); // y
      const type = reader.readByte();
      const imgCount = reader.readByte();
      if (reader.available() < imgCount * 2 + 32 + 1) break;
      for (let j = 0; j < imgCount; j++) {
        reader.readShort();
      }
      reader.readBytes(32); // states
      const menuCount = reader.readByte();
      const menuIds: number[] = [];
      for (let m = 0; m < menuCount; m++) {
        if (reader.available() < 2) break;
        menuIds.push(reader.readShort());
      }
      specials.push({ id, name, type, imageCount: imgCount, menuIds });
      pos = objPos + (body.length - objPos - reader.available());
    } catch {
      pos = idx + 4;
    }
  }
  return specials;
}

/**
 * Đọc toàn diện snapshot RX 80 bao gồm ItemMapSpecial.
 */
function waitForJoinWithSpecials(
  client: GameClient,
  signal: AbortSignal,
  expectedRoom: number,
  expectedBoard: number,
  timeoutMs: number,
): Promise<JoinObservation> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (value: JoinObservation): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 80) return;
      const body = msg.getData();
      if (body.length < 6) {
        finish({
          status: 'mismatch',
          roomId: null,
          boardId: null,
          x: null,
          y: null,
          responseBytes: body.length,
        });
        return;
      }
      const roomId = body.readInt8(0);
      const boardId = body.readInt8(1);
      const x = body.readInt16BE(2);
      const y = body.readInt16BE(4);
      try {
        writeFileSync(`/tmp/rx80_room${roomId}.bin`, body);
      } catch {}

      let specialCount: number | null = null;
      const specials: MapObjectMetadata[] = [];

      try {
        const reader = new MyReader(body);
        reader.readBytes(6); // Bỏ qua prefix (room, board, x, y)
        skipListPlayer(reader);

        // Map marker
        const mapMarker = reader.readByte();
        if (mapMarker === 1) {
          // mapItemType
          const typeCount = readNativeCount(reader, 'mapItemType');
          for (let i = 0; i < typeCount; i += 1) {
            readNativeBytes(reader, 1 + 2 + 1 + 2 + 2, 'mapItemType');
            const notTransCount = readNativeCount(reader, 'mapItemType.notTrans');
            readNativeBytes(reader, notTransCount * 2, 'mapItemType.notTrans');
          }
          // mapItem
          const itemCount = readNativeCount(reader, 'mapItem');
          readNativeBytes(reader, itemCount * 4, 'mapItem');
        }

        // Anim
        const animCount = readNativeCount(reader, 'animTempl');
        readNativeBytes(reader, animCount * (2 + 4 + 4), 'animTempl');

        // Specials
        specialCount = readNativeCount(reader, 'specials');
        for (let idx = 0; idx < specialCount; idx += 1) {
          specials.push(readMapSpecial(reader, idx));
        }
      } catch {
        // Nếu parse specials gặp lỗi do layout khác, vẫn giữ nguyên thông tin room/board
      }

      if (specials.length === 0) {
        const fallback = parseSpecialsFromBuffer(body);
        if (fallback.length > 0) {
          specials.push(...fallback);
          specialCount = fallback.length;
        }
      }

      finish({
        status: roomId === expectedRoom ? 'joined' : 'mismatch',
        roomId,
        boardId,
        x,
        y,
        responseBytes: body.length,
        specialCount,
        specials,
      });
    };
    const onAbort = (): void => {
      finish({
        status: 'timeout',
        roomId: null,
        boardId: null,
        x: null,
        y: null,
        responseBytes: null,
      });
    };
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finish({
        status: 'timeout',
        roomId: null,
        boardId: null,
        x: null,
        y: null,
        responseBytes: null,
      });
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

async function runProbe(
  args: ProbeArgs,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    throw new RedactedProbeError('config', 'cấu hình probe không hợp lệ hoặc thiếu');
  }
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  let phase: ProbePhase = 'login';
  const onTraffic = (entry: TrafficEntry): void => {
    metadata.push({
      phase,
      dir: entry.dir === 'tx' ? 'TX' : 'RX',
      cmd: entry.cmd,
      len: entry.len,
    });
  };
  const onDialog = (): void => {
    events.push({ phase, event: 'dialog' });
  };
  const onTemporaryRejection = (value: TemporaryLoginRejection): void => {
    events.push({ phase, event: 'temporary-rejection', retryAfterMs: value.retryAfterMs });
  };
  const onStatus = (status: ClientStatus): void => {
    events.push({ phase, event: 'status', status });
  };
  const onClosed = (info: SessionCloseInfo): void => {
    events.push({ phase, event: 'closed', closeKind: info.kind, hadError: info.hadError });
  };
  client.on('traffic', onTraffic);
  client.on('dialog', onDialog);
  client.on('temporary-rejection', onTemporaryRejection);
  client.on('status', onStatus);
  client.session.on('closed', onClosed);

  try {
    const row = getAccountById(db, args.accountId);
    if (!row) throw new RedactedProbeError('account', `không có account #${args.accountId}`);

    await loginWithTimeout(
      client,
      {
        host: row.host,
        port: row.port,
        user: row.gameUser,
        pass: readGamePass(db, config.masterKey, args.accountId),
        device: row.device,
      },
      25_000,
    );
    await waitUntilOnline(client, 20_000);

    if (args.mode === 'get-linkmap') {
      // 1. Chuyển sang Handler 8 (AvatarMsgHandler)
      phase = 'switch-handler-8';
      const handlerPending = waitForHandlerResponse(client, abort.signal, 8, 5_000);
      client.sendRaw(-1, [{ t: 'i8', v: '8' }]);
      await handlerPending;

      // 2. Gửi yêu cầu tải LinkMap: TX -51 [i8 24, i16 targetId - 1]
      phase = 'request-linkmap';
      const mapIdReq = args.targetId - 1;
      const downloadPending = waitForDownloadDataResponse(
        client,
        abort.signal,
        args.targetId,
        JOIN_TIMEOUT_MS,
      );
      client.sendRaw(-51, [
        { t: 'i8', v: '24' },
        { t: 'i16', v: String(mapIdReq) },
      ]);
      const linkMap = await downloadPending;

      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            accountId: args.accountId,
            mode: 'get-linkmap',
            requestedMapId: args.targetId,
            linkMap,
            traffic: metadata,
            events,
          },
          null,
          2,
        ),
      );
    } else {
      // Chế độ probe-submap hoặc probe-room
      phase = 'park-context';
      const handlerPending = waitForHandlerResponse(client, abort.signal, 9, 5_000);
      client.enterParkContext();
      await handlerPending;

      const hubPos = NATIVE_PARK_JOIN_POSITIONS[HUB_MAP] ?? { x: 100, y: 100 };
      const submapPos =
        NATIVE_PARK_JOIN_POSITIONS[args.targetId] ??
        UNVERIFIED_PROBE_POSITIONS[args.targetId] ?? { x: 100, y: 100 };

      phase = args.mode === 'probe-submap' ? 'scan-submap' : 'probe-join';
      const probePending = waitForJoinWithSpecials(
        client,
        abort.signal,
        args.targetId,
        args.area,
        JOIN_TIMEOUT_MS,
      );
      client.sendRaw(80, [
        { t: 'i8', v: String(args.targetId) },
        { t: 'i8', v: String(args.area) },
        { t: 'i16', v: String(submapPos.x) },
        { t: 'i16', v: String(submapPos.y) },
      ]);
      const probeJoin = await probePending;

      let areaScans: JoinObservation[] | undefined;
      if (args.scanAreas !== undefined && args.scanAreas > 0) {
        phase = 'scan-areas';
        areaScans = [probeJoin];
        for (let a = 1; a < args.scanAreas; a += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, RETURN_COOLDOWN_MS));
          const p = waitForJoinWithSpecials(
            client,
            abort.signal,
            args.targetId,
            a,
            JOIN_TIMEOUT_MS,
          );
          client.sendRaw(80, [
            { t: 'i8', v: String(args.targetId) },
            { t: 'i8', v: String(a) },
            { t: 'i16', v: String(submapPos.x) },
            { t: 'i16', v: String(submapPos.y) },
          ]);
          const res = await p;
          areaScans.push(res);
        }
      }

      let openMenuObs: OpenMenuObservation | undefined;
      let selectMenuObs: SelectMenuObservation | undefined;
      let itemSpecialObs: ItemSpecialObservation | undefined;
      if (args.mineRock !== undefined) {
        // 1. Thử gửi TX -59 [i32 objectId] (doCommunicate)
        phase = 'open-menu';
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        openMenuObs = await executeOpenMenu(client, args.mineRock, 3000);

        // 2. Thử gửi TX -61 nếu có menu
        if (args.menu !== undefined) {
          phase = 'select-menu';
          await new Promise<void>((resolve) => setTimeout(resolve, 1000));
          selectMenuObs = await executeSelectMenu(client, args.mineRock, args.menu, 3000);
        }

        // 3. Thử gửi TX 48 [i8 3, i32 objectId, i8 menuIndex] (chính xác theo IL2CPP doItemSpecial)
        phase = 'item-special';
        const menuIdx = args.menu === 1207 ? 0 : args.menu === 1220 ? 1 : (args.menu ?? 0);
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        itemSpecialObs = await executeItemSpecial(client, args.mineRock, menuIdx, 5000);
      }

      // Trở về hub map 17 an toàn
      await new Promise<void>((resolve) => setTimeout(resolve, RETURN_COOLDOWN_MS));
      phase = 'return-join';
      const returnPending = waitForJoinWithSpecials(
        client,
        abort.signal,
        HUB_MAP,
        args.area,
        JOIN_TIMEOUT_MS,
      );
      client.sendRaw(80, [
        { t: 'i8', v: String(HUB_MAP) },
        { t: 'i8', v: String(args.area) },
        { t: 'i16', v: String(hubPos.x) },
        { t: 'i16', v: String(hubPos.y) },
      ]);
      const returnJoin = await returnPending;

      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            accountId: args.accountId,
            mode: args.mode,
            targetRoomId: args.targetId,
            area: args.area,
            probeJoin,
            areaScans,
            mining:
              openMenuObs || selectMenuObs || itemSpecialObs
                ? {
                    openMenu: openMenuObs,
                    selectMenu: selectMenuObs,
                    itemSpecial: itemSpecialObs,
                  }
                : undefined,
            returnJoin,
            traffic: metadata,
            events,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    client.removeListener('dialog', onDialog);
    client.removeListener('temporary-rejection', onTemporaryRejection);
    client.removeListener('status', onStatus);
    client.session.removeListener('closed', onClosed);
    abort.abort();
    client.removeListener('traffic', onTraffic);
    try {
      client.logout();
    } finally {
      db.close();
    }
  }
}

let args: ProbeArgs | undefined;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(JSON.stringify({ failure: (error as Error).message }));
  process.exit(2);
}

const trafficMetadata: TxRxMetadata[] = [];
const eventMetadata: ProbeEventMetadata[] = [];

runProbe(args, trafficMetadata, eventMetadata).catch((error) => {
  console.error(
    JSON.stringify({
      failure: (error as Error).message,
      events: eventMetadata,
      traffic: trafficMetadata,
    }),
  );
  process.exit(1);
});
