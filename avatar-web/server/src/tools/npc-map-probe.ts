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
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo, SessionCloseKind } from '../proto/session.js';

interface ProbeArgs {
  accountId: number;
  map: number;
  area: number;
}

type ProbePhase = 'login' | 'park-context' | 'board-list' | 'direct-join';

interface TxRxMetadata {
  phase: ProbePhase;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}

type ProbeEventKind = 'dialog' | 'temporary-rejection' | 'status' | 'closed';

interface ProbeEventMetadata {
  phase: ProbePhase;
  event: ProbeEventKind;
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseKind;
  hadError?: boolean;
}

interface ParkJoinResponseMetadata {
  responseBytes: number;
  decodeMode: 'strict' | 'prefix';
  roomId: number;
  boardId: number;
  x: number;
  y: number;
  playerLayout: string;
  listPlayerCount: number;
  listPlayerEnd: number;
  mapMarker: number | null;
  mapItemTypeCount: number | null;
  mapItemCount: number | null;
  animCount: number | null;
  specialCount: number | null;
  specialNames: string[];
  specialSectionEnd: number | null;
  trailingBytes: number;
}

interface ParkBoardAreaMetadata {
  /** 0-based index used by the native ParkListSrc selection UI. */
  area: number;
  occupancy: number;
}

interface ParkBoardCatalogMetadata {
  command: 90;
  roomId: number;
  boardCount: number;
  areas: ParkBoardAreaMetadata[];
}

interface ParkBoardCatalogObservation {
  status: 'observed' | 'pending' | 'malformed';
  catalog?: ParkBoardCatalogMetadata;
  error?: { section: string; offset: number; message: string };
}

interface MapSpecialUpdateMetadata {
  mode: number;
  operation: 'upsert' | 'remove' | 'unsupported';
  responseBytes: number;
  id: number;
  name?: string;
  x?: number;
  y?: number;
  type?: number;
  imageCount?: number;
  menuCount?: number;
  trailingBytes: number;
}

interface NativeJoinPosition {
  x: number;
  y: number;
}

const ALLOWED = new Set(['--account-id', '--map', '--area']);
const REQUIRED_KEYS = ['--account-id', '--map', '--area'] as const;
const POST_JOIN_GRACE_MS = 3_000;
const BOARD_LIST_TIMEOUT_MS = 5_000;

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
  if (argv.length % 2 !== 0) {
    throw new RedactedProbeError('cli', 'mỗi key CLI phải có đúng một value');
  }

  const values = new Map<string, number>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!;
    const raw = argv[i + 1];
    if (!ALLOWED.has(key)) {
      throw new RedactedProbeError('cli', 'key hoặc positional arg không được phép');
    }
    if (values.has(key)) {
      throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
    }
    if (raw === undefined || raw.startsWith('--')) {
      throw new RedactedProbeError('cli', `thiếu value cho ${key}`);
    }
    values.set(key, parseInteger(key, raw));
  }

  for (const key of REQUIRED_KEYS) {
    if (!values.has(key)) {
      throw new RedactedProbeError('cli', `thiếu key bắt buộc: ${key}`);
    }
  }

  const accountId = values.get('--account-id')!;
  const map = values.get('--map')!;
  const area = values.get('--area')!;
  if (accountId <= 0) {
    throw new RedactedProbeError('cli', '--account-id phải là số nguyên dương');
  }
  for (const [key, value] of [['--map', map], ['--area', area]] as const) {
    if (value < -128 || value > 127) {
      throw new RedactedProbeError('cli', `${key} phải nằm trong signed-byte -128..127`);
    }
  }
  return { accountId, map, area };
}

function resolveNativeJoinPosition(map: number): NativeJoinPosition {
  // This is the only position that has been reproduced on the current
  // account/server build. Do not silently reuse it for another room ID:
  // legacy server-map IDs and Unity CityMap node IDs are separate namespaces.
  if (map !== 5) {
    throw new RedactedProbeError(
      'cli',
      'chỉ có native join position đã review cho map 5; không đoán tọa độ map khác',
    );
  }
  return { x: 254, y: 82 };
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

    const request = httpGet({
      host: '127.0.0.1',
      port,
      path: '/api/auth/me',
      timeout: 750,
    }, (response) => {
      response.resume();
      finish(new RedactedProbeError('health', 'hãy dừng Avatar Web server trước khi probe'));
      request.destroy();
    });

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
      finish(new RedactedProbeError(
        'health',
        `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`,
      ));
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
    const login = client.login(options);
    await Promise.race([login, timeout]);
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
    return Promise.reject(new RedactedProbeError(
      'login',
      `game client không online (status=${client.status})`,
    ));
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

function waitForParkHandlerResponse(
  client: GameClient,
  signal: AbortSignal,
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
      reject(error instanceof RedactedProbeError
        ? error
        : new RedactedProbeError('handler', 'không nhận được ACK handler Park'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length !== 1 || body.readInt8(0) !== 9) return;
      finishResolve();
    };
    const onAbort = (): void => finishReject(new RedactedProbeError('handler', 'chờ ACK handler bị hủy'));

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(new RedactedProbeError('handler', 'hết giờ chờ ACK handler Park'));
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function readNativeI8(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new RedactedProbeError('board-list', `thiếu byte ${section}`, reader.position);
  }
  return reader.readByte();
}

function decodeParkBoardListResponse(
  body: Buffer,
  roomId: number,
): ParkBoardCatalogMetadata {
  const reader = new MyReader(body);
  try {
    const boardCount = readNativeI8(reader, 'count');
    // Native ParkMsgHandler reads the count as a signed byte and allocates an
    // int[] of that size. Reject negative/implausibly large values instead of
    // treating them as an empty catalog.
    if (boardCount < 0 || boardCount > 64) {
      throw new RedactedProbeError(
        'board-list',
        'count board-list nằm ngoài signed-byte catalog bounds',
        reader.position - 1,
      );
    }

    const areas: ParkBoardAreaMetadata[] = [];
    for (let area = 0; area < boardCount; area += 1) {
      areas.push({ area, occupancy: readNativeI8(reader, `occupancy[${area}]`) });
    }
    if (reader.available() !== 0) {
      throw new RedactedProbeError(
        'board-list',
        'RX 90 có trailing bytes ngoài native board-list schema',
        reader.position,
      );
    }
    return { command: 90, roomId, boardCount, areas };
  } catch (error) {
    if (error instanceof RedactedProbeError) throw error;
    throw new RedactedProbeError(
      'board-list',
      'RX 90 không giải mã được theo native board-list schema',
      reader.position,
    );
  }
}

function waitForParkBoardList(
  client: GameClient,
  signal: AbortSignal,
  roomId: number,
  timeoutMs: number,
): Promise<ParkBoardCatalogObservation> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (value: ParkBoardCatalogObservation): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof RedactedProbeError
        ? error
        : new RedactedProbeError('board-list', 'chờ RX 90 thất bại'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 90) return;
      try {
        finishResolve({
          status: 'observed',
          catalog: decodeParkBoardListResponse(msg.getData(), roomId),
        });
      } catch (error) {
        finishResolve({ status: 'malformed', error: redactedFailure(error) });
      }
    };
    const onAbort = (): void => finishReject(new RedactedProbeError(
      'board-list',
      'chờ RX 90 bị hủy',
    ));

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishResolve({
        status: 'pending',
        error: redactedFailure(new RedactedProbeError(
          'board-list',
          'hết giờ chờ RX 90 board-list',
        )),
      });
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new RedactedProbeError('park-response', `thiếu count ${section}`, reader.position);
  }
  const raw = reader.readByte();
  if (raw < 0) return 0;
  if (raw > 64) {
    throw new RedactedProbeError('park-response', `count ${section} vượt giới hạn`, reader.position - 1);
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

function skipListPlayer(reader: MyReader): { count: number; listEnd: number } {
  const count = readNativeCount(reader, 'listPlayer');
  for (let i = 0; i < count; i += 1) {
    readNativeBytes(reader, 4, 'player.id');
    readNativeUtf(reader, `player[${i}].name`);
    const partCount = readNativeCount(reader, 'player.parts');
    readNativeBytes(reader, partCount * 2, 'player.parts');
    // RX80's native readListPlayer path has the map-state byte after the
    // optional player short: i16,i16,i8,i8,i8,i16,i8,i8,i16,i16,i16,i8
    // (18 bytes). The helper then consumes the drop-part vector before the
    // caller reads map-marker/map-items.
    readNativeBytes(reader, 18, 'player.state');
  }

  const dropCount = readNativeCount(reader, 'dropParts');
  readNativeBytes(reader, dropCount * (1 + 2 + 4 + 2 + 2), 'dropParts');
  return { count, listEnd: reader.position };
}

function readMapItemTypeCount(reader: MyReader): number {
  const count = readNativeCount(reader, 'mapItemType');
  for (let i = 0; i < count; i += 1) {
    readNativeBytes(reader, 1 + 2 + 1 + 2 + 2, 'mapItemType');
    const notTransCount = readNativeCount(reader, 'mapItemType.notTrans');
    readNativeBytes(reader, notTransCount * 2, 'mapItemType.notTrans');
  }
  return count;
}

function readMapItemCount(reader: MyReader): number {
  const count = readNativeCount(reader, 'mapItem');
  readNativeBytes(reader, count * 4, 'mapItem');
  return count;
}

function readAnimCount(reader: MyReader): number {
  const count = readNativeCount(reader, 'animTempl');
  readNativeBytes(reader, count * (2 + 4 + 4), 'animTempl');
  return count;
}

function readMapSpecialName(reader: MyReader, index: number): string {
  readNativeBytes(reader, 4, `special[${index}].id`);
  const name = readNativeUtf(reader, `special[${index}].name`);
  readNativeBytes(reader, 4 + 4 + 1, `special[${index}].header`);
  const imageCount = readNativeCount(reader, `special[${index}].images`);
  readNativeBytes(reader, imageCount * 2, `special[${index}].images`);
  readNativeBytes(reader, 8 * 4, `special[${index}].state`);
  const menuCount = readNativeCount(reader, `special[${index}].menus`);
  readNativeBytes(reader, menuCount * 2, `special[${index}].menus`);
  return name;
}

// Native GlobalMessageHandler cmd 48 reads one mode byte first. Modes 0/1
// then call AvatarData.readItemDataMapSpecial @0xA0C280, while mode 2 reads
// one i32 and calls removeItemDataMapSpecial @0xA0C704. The upsert payload is
// i32, UTF, i32 x, i32 y, i8 type, i8+nShort image ids, eight i32 state
// coordinates, then i8+nShort menu ids.
function decodeMapSpecialUpdate(body: Buffer): MapSpecialUpdateMetadata {
  const reader = new MyReader(body);
  const mode = reader.readByte();
  if (mode === 2) {
    const id = reader.readInt();
    return {
      mode,
      operation: 'remove',
      responseBytes: body.length,
      id,
      trailingBytes: reader.available(),
    };
  }
  if (mode < 0 || mode > 1) {
    return {
      mode,
      operation: 'unsupported',
      responseBytes: body.length,
      id: -1,
      trailingBytes: reader.available(),
    };
  }

  const id = reader.readInt();
  const name = readNativeUtf(reader, 'special-update.name');
  const x = reader.readInt();
  const y = reader.readInt();
  const type = reader.readByte();
  const imageCount = readNativeCount(reader, 'special-update.images');
  readNativeBytes(reader, imageCount * 2, 'special-update.images');
  readNativeBytes(reader, 8 * 4, 'special-update.state');
  const menuCount = readNativeCount(reader, 'special-update.menus');
  readNativeBytes(reader, menuCount * 2, 'special-update.menus');
  return {
    mode,
    operation: 'upsert',
    responseBytes: body.length,
    id,
    name,
    x,
    y,
    type,
    imageCount,
    menuCount,
    trailingBytes: reader.available(),
  };
}

interface MapSpecialCapture {
  updates: MapSpecialUpdateMetadata[];
  error?: RedactedProbeError;
  stop: () => void;
}

function startMapSpecialCapture(client: GameClient): MapSpecialCapture {
  const updates: MapSpecialUpdateMetadata[] = [];
  let error: RedactedProbeError | undefined;
  const onMessage = (msg: Message): void => {
    if (msg.command !== 48) return;
    try {
      updates.push(decodeMapSpecialUpdate(msg.getData()));
    } catch (cause) {
      error = cause instanceof RedactedProbeError
        ? cause
        : new RedactedProbeError('map-special', 'RX 48 không giải mã được theo native schema');
    }
  };
  client.session.on('message', onMessage);
  return {
    updates,
    get error() { return error; },
    stop: () => client.session.removeListener('message', onMessage),
  };
}

function decodeParkJoinResponse(body: Buffer): ParkJoinResponseMetadata {
  const reader = new MyReader(body);
  try {
    readNativeBytes(reader, 1, 'roomID');
    const roomId = body.readInt8(0);
    readNativeBytes(reader, 1, 'boardID');
    const boardId = body.readInt8(1);
    if (reader.available() < 4) {
      throw new RedactedProbeError('park-response', 'thiếu tọa độ response', reader.position);
    }
    const x = reader.readShort();
    const y = reader.readShort();
    const players = skipListPlayer(reader);

    let mapMarker: number | null = null;
    let mapItemTypeCount: number | null = null;
    let mapItemCount: number | null = null;
    let animCount: number | null = null;
    let specialCount: number | null = null;
    let specialNames: string[] = [];
    let specialSectionEnd: number | null = null;
    if (reader.available() >= 2) {
      mapMarker = reader.readShort();
      if (mapMarker >= 1) {
        mapItemTypeCount = readMapItemTypeCount(reader);
        mapItemCount = readMapItemCount(reader);
      }
    }
    if (reader.available() >= 1) {
      animCount = readAnimCount(reader);
    }
    if (reader.available() >= 1) {
      specialCount = readNativeCount(reader, 'specials');
      specialNames = [];
      for (let i = 0; i < specialCount; i += 1) {
        specialNames.push(readMapSpecialName(reader, i));
      }
      specialSectionEnd = reader.position;
    }

    return {
      responseBytes: body.length,
      decodeMode: 'prefix',
      roomId,
      boardId,
      x,
      y,
      playerLayout: 'state18-native-list-with-drop-tail',
      listPlayerCount: players.count,
      listPlayerEnd: players.listEnd,
      mapMarker,
      mapItemTypeCount,
      mapItemCount,
      animCount,
      specialCount,
      specialNames,
      specialSectionEnd,
      trailingBytes: reader.available(),
    };
  } catch (error) {
    if (error instanceof RedactedProbeError) throw error;
    throw new RedactedProbeError(
      'park-response',
      'response cmd 80 không giải mã được theo native prefix layout',
      reader.position,
    );
  }
}

function waitForParkJoinResponse(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ParkJoinResponseMetadata> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (value: ParkJoinResponseMetadata): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof RedactedProbeError
        ? error
        : new RedactedProbeError('park-response', 'không nhận được RX 80'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 80) return;
      try {
        finishResolve(decodeParkJoinResponse(msg.getData()));
      } catch (error) {
        finishReject(error);
      }
    };
    const onAbort = (): void => finishReject(new RedactedProbeError(
      'park-response',
      'chờ RX 80 bị hủy',
    ));

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(new RedactedProbeError('park-response', 'hết giờ chờ RX 80'));
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function captureRelevantTraffic(
  metadata: TxRxMetadata[],
  phase: ProbePhase,
  entry: TrafficEntry,
): void {
  metadata.push({
    phase,
    dir: entry.dir === 'tx' ? 'TX' : 'RX',
    cmd: entry.cmd,
    len: entry.len,
  });
}

function assertExpectedTraffic(
  metadata: TxRxMetadata[],
  boardCatalog: ParkBoardCatalogObservation,
): void {
  const count = (
    phase: ProbePhase,
    dir: 'TX' | 'RX',
    cmd: number,
    len?: number,
  ): number => (
    metadata.filter((entry) => (
      entry.phase === phase
      && entry.dir === dir
      && entry.cmd === cmd
      && (len === undefined || entry.len === len)
    )).length
  );
  if (
    count('login', 'RX', -34) !== 1
    || count('park-context', 'TX', -1, 1) !== 1
    || count('park-context', 'RX', -1, 1) !== 1
    || count('board-list', 'TX', 90, 1) !== 1
    || count('direct-join', 'TX', 80, 6) !== 1
    || count('direct-join', 'RX', 80) !== 1
  ) {
    throw new RedactedProbeError(
      'traffic',
      'traffic phase không khớp login/park/board-list/direct-join contract',
    );
  }

  const boardRxCount = count('board-list', 'RX', 90);
  if (boardCatalog.status === 'observed' && boardRxCount !== 1) {
    throw new RedactedProbeError('traffic', 'catalog observed nhưng thiếu đúng một RX 90');
  }
  if (boardCatalog.status === 'malformed' && boardRxCount !== 1) {
    throw new RedactedProbeError('traffic', 'catalog malformed nhưng thiếu RX 90 để đối chiếu');
  }
  if (boardCatalog.status === 'pending' && boardRxCount !== 0) {
    throw new RedactedProbeError('traffic', 'catalog pending nhưng traffic đã ghi RX 90');
  }
}

function printRedactedEvidence(
  args: ProbeArgs,
  response: ParkJoinResponseMetadata,
  boardCatalog: ParkBoardCatalogObservation,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
  mapSpecialUpdates: MapSpecialUpdateMetadata[],
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    accountId: args.accountId,
    requested: { map: args.map, area: args.area },
    traffic: metadata,
    events,
    parkBoardCatalog: boardCatalog,
    boardListRequestBodyBytes: 1,
    mapSpecialUpdates,
    postJoinGraceMs: POST_JOIN_GRACE_MS,
    decode: response.decodeMode === 'strict'
      ? 'park-response-ok'
      : 'park-response-prefix-pending',
    requestBodyBytes: 6,
    parkJoinResponse: response,
  }, null, 2));
}

function redactedFailure(error: unknown): { section: string; offset: number; message: string } {
  if (error instanceof RedactedProbeError) {
    return {
      section: error.section,
      offset: error.offset,
      message: error.message,
    };
  }
  return {
    section: 'runtime',
    offset: -1,
    message: 'probe thất bại; chi tiết runtime đã được ẩn',
  };
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

  const joinPosition = resolveNativeJoinPosition(args.map);
  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  let phase: ProbePhase = 'login';
  const onTraffic = (entry: TrafficEntry): void => captureRelevantTraffic(metadata, phase, entry);
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

    await loginWithTimeout(client, {
      host: row.host,
      port: row.port,
      user: row.gameUser,
      pass: readGamePass(db, config.masterKey, args.accountId),
      device: row.device,
    }, 12_000);
    await waitUntilOnline(client, 10_000);

    // GameClient.login() already emitted the native main-handler request as
    // part of setProviderAndClientType(). Re-emitting -1[8] here would add a
    // non-native context transition before the direct join.
    phase = 'park-context';
    const handlerPending = waitForParkHandlerResponse(client, abort.signal, 5_000);
    client.enterParkContext();
    await handlerPending;

    phase = 'board-list';
    const boardListPending = waitForParkBoardList(
      client,
      abort.signal,
      args.map,
      BOARD_LIST_TIMEOUT_MS,
    );
    // Native ParkService.doRequestBoardList(sbyte roomId) writes exactly one
    // signed byte before sending PARK_BOARD_LIST (cmd 90). This is the
    // read-only UI route that supplies the board/area occupancy list.
    client.sendRaw(90, [{ t: 'i8', v: String(args.map) }]);
    const boardCatalog = await boardListPending;

    phase = 'direct-join';
    const pending = waitForParkJoinResponse(client, abort.signal, 7_000);
    const mapSpecialCapture = startMapSpecialCapture(client);
    // Native ParkService.doJoinPark writes the two requested signed bytes and
    // then LoadMap.xJoinCasino/yJoinCasino as two big-endian i16 values. The
    // reviewed map-5 candidate uses x=254,y=82 from CityMap node id=5; that
    // node's label/idToMap are kept separate from the requested room ID.
    client.sendRaw(80, [
      { t: 'i8', v: String(args.map) },
      { t: 'i8', v: String(args.area) },
      { t: 'i16', v: String(joinPosition.x) },
      { t: 'i16', v: String(joinPosition.y) },
    ]);
    try {
      const response = await pending;
      // ITEM_MAP_SPECIAL (cmd 48) can be pushed asynchronously after RX 80.
      // Keep this read-only probe online briefly so a delayed NPC event is not
      // mistaken for an empty map snapshot.
      await new Promise<void>((resolve) => setTimeout(resolve, POST_JOIN_GRACE_MS));
      if (mapSpecialCapture.error) throw mapSpecialCapture.error;
      if (response.roomId !== args.map || response.boardId !== args.area) {
        throw new RedactedProbeError(
          'park-response',
          'room/board response không khớp request',
        );
      }
      assertExpectedTraffic(metadata, boardCatalog);
      printRedactedEvidence(
        args,
        response,
        boardCatalog,
        metadata,
        events,
        mapSpecialCapture.updates,
      );
    } finally {
      mapSpecialCapture.stop();
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
const metadata: TxRxMetadata[] = [];
const events: ProbeEventMetadata[] = [];
try {
  args = parseArgs(process.argv.slice(2));
  await runProbe(args, metadata, events);
} catch (error) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...(args ? {
      accountId: args.accountId,
      requested: { map: args.map, area: args.area },
    } : {}),
    traffic: metadata,
    events,
    decode: 'error',
    ...redactedFailure(error),
  }, null, 2));
  process.exitCode = 1;
}
