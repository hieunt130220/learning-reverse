import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  CMD_CAPTCHA_CHALLENGE,
  decodeCaptchaChallenge,
  decodeCaptchaImage,
  CaptchaProtocolDecodeError,
  type CaptchaChallenge,
} from '../game/captchaProtocol.js';
import {
  GameClient,
  APK_IDENTITY,
  J2ME_IDENTITY,
  type ClientIdentity,
  type ClientStatus,
} from '../game/client.js';
import { GameGateService } from '../game/gameGateService.js';
import { resolveJarGameServer } from '../game/jarServerExtractor.js';
import type { Message } from '../proto/message.js';

interface CollectorArgs {
  user: string;
  pass: string;
  count: number;
  outputDir: string;
  intervalMs: number;
  host?: string;
  port?: number;
  jar?: string;
  world?: 'apk' | 'j2me';
}

interface CaptchaFailureMetadata {
  receivedAt: string;
  command: typeof CMD_CAPTCHA_CHALLENGE;
  payloadLength: number;
  imageLength: number | null;
  sha256: string;
  errorCode: string;
  errorSection: string;
  errorOffset: number | null;
}

const ALLOWED_FLAGS = new Set(['--user', '--pass', '--count', '--output-dir', '--interval-ms', '--host', '--port', '--jar', '--world']);
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_CONSECUTIVE_DUPLICATES = 20;
const LOGIN_TIMEOUT_MS = 15_000;
const CAPTCHA_WAIT_TIMEOUT_MS = 10_000;
const PARK_CONTEXT_GRACE_MS = 1_000;

export function parseCollectorArgs(argv: string[]): CollectorArgs {
  const parsed = new Map<string, string>();
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Tham số không hợp lệ (không phải cờ bắt đầu bằng --): "${arg}"`);
    }
    if (!ALLOWED_FLAGS.has(arg)) {
      throw new Error(`Cờ không được hỗ trợ: "${arg}"`);
    }
    if (parsed.has(arg)) {
      throw new Error(`Cờ bị lặp lại: "${arg}"`);
    }
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      throw new Error(`Thiếu giá trị cho cờ: "${arg}"`);
    }
    parsed.set(arg, argv[i + 1]);
    i += 2;
  }

  const user = parsed.get('--user');
  if (!user || user.trim() === '') {
    throw new Error('Thiếu tham số bắt buộc: --user <username>');
  }

  const pass = parsed.get('--pass');
  if (!pass || pass.trim() === '') {
    throw new Error('Thiếu tham số bắt buộc: --pass <password>');
  }

  let count = 10;
  if (parsed.has('--count')) {
    const rawCount = parsed.get('--count')!;
    if (!/^\d+$/.test(rawCount) || Number(rawCount) <= 0) {
      throw new Error(`--count phải là số nguyên dương: "${rawCount}"`);
    }
    count = Number(rawCount);
  }

  let outputDir = 'captcha-output';
  if (parsed.has('--output-dir')) {
    const rawOutputDir = parsed.get('--output-dir')!;
    if (rawOutputDir.trim() === '') {
      throw new Error('--output-dir không được để trống');
    }
    outputDir = rawOutputDir;
  }

  let intervalMs = 1000;
  if (parsed.has('--interval-ms')) {
    const rawInterval = parsed.get('--interval-ms')!;
    if (!/^\d+$/.test(rawInterval)) {
      throw new Error(`--interval-ms phải là số nguyên (0..60000): "${rawInterval}"`);
    }
    const val = Number(rawInterval);
    if (val < 0 || val > 60_000) {
      throw new Error(`--interval-ms phải nằm trong dải 0..60000: "${val}"`);
    }
    intervalMs = val;
  }

  let host: string | undefined;
  if (parsed.has('--host')) {
    const rawHost = parsed.get('--host')!.trim();
    if (!rawHost) throw new Error('--host không được để trống');
    host = rawHost;
  }

  let port: number | undefined;
  if (parsed.has('--port')) {
    const rawPort = parsed.get('--port')!.trim();
    if (!/^\d+$/.test(rawPort) || Number(rawPort) <= 0 || Number(rawPort) > 65535) {
      throw new Error(`--port phải là cổng hợp lệ (1..65535): "${rawPort}"`);
    }
    port = Number(rawPort);
  }

  const jar = parsed.get('--jar')?.trim();

  let world: 'apk' | 'j2me' | undefined;
  if (parsed.has('--world')) {
    const rawWorld = parsed.get('--world')!.trim();
    if (rawWorld !== 'apk' && rawWorld !== 'j2me') {
      throw new Error(`--world phải là 'apk' hoặc 'j2me': "${rawWorld}"`);
    }
    world = rawWorld;
  }

  return {
    user,
    pass,
    count,
    outputDir: path.resolve(process.cwd(), outputDir),
    intervalMs,
    host,
    port,
    jar,
    world,
  };
}

function formatTimestamp(date: Date): string {
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`;
}

async function writeAtomic(targetPath: string, data: Buffer | string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tempName = `.${path.basename(targetPath)}.tmp.${crypto.randomBytes(6).toString('hex')}`;
  const tempPath = path.join(dir, tempName);

  try {
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, targetPath);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore temp file cleanup error
    }
    throw err;
  }
}

async function getUniqueFilePath(dir: string, baseName: string, ext: string): Promise<string> {
  let candidate = path.join(dir, `${baseName}.${ext}`);
  let collisionIdx = 1;

  while (true) {
    try {
      await fs.access(candidate);
      // File exists, add collision suffix
      candidate = path.join(dir, `${baseName}-${collisionIdx}.${ext}`);
      collisionIdx++;
    } catch {
      // File does not exist, good to use
      return candidate;
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      return reject(new Error('Dừng khi đang chờ interval'));
    }
    let timer: NodeJS.Timeout;
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('Dừng khi đang chờ interval'));
    };
    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function runCollector(args: CollectorArgs): Promise<void> {
  const abortController = new AbortController();
  const { signal } = abortController;

  const onSignal = (): void => {
    console.log('\n[CAPTCHA-COLLECTOR] Nhận tín hiệu ngắt (SIGINT/SIGTERM), đang dọn dẹp...');
    abortController.abort();
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  await fs.mkdir(args.outputDir, { recursive: true });

  const client = new GameClient();
  const gateService = new GameGateService(client.session);

  let failureStreak = 0;
  let duplicateStreak = 0;
  let savedCount = 0;
  let sequence = 0;
  let failureSequence = 0;
  const seenHashes = new Set<string>();

  client.on('log', (msg: string) => {
    console.log(`  [GameClient] ${msg}`);
  });

  client.on('error', (err: unknown) => {
    console.error(`  [GameClient Error] ${err instanceof Error ? err.message : String(err)}`);
  });

  try {
    // Phân giải host và port từ CLI args hoặc file JAR
    let targetHost: string;
    let targetPort: number;
    let serverSource: string;
    let identity: ClientIdentity;

    if (args.host && args.port) {
      targetHost = args.host;
      targetPort = args.port;
      serverSource = 'CLI arguments (--host / --port)';
      // Mặc định CLI host/port là thế giới APK; --world ghi đè.
      identity = args.world === 'j2me' ? J2ME_IDENTITY : APK_IDENTITY;
    } else {
      const jarServer = await resolveJarGameServer({ jarPath: args.jar });
      targetHost = args.host ?? jarServer.host;
      targetPort = args.port ?? jarServer.port;
      serverSource = jarServer.source;
      // Server lấy từ jar luôn là thế giới J2ME; --world apk ghi đè.
      identity = args.world === 'apk' ? APK_IDENTITY : J2ME_IDENTITY;
    }

    console.log(`[CAPTCHA-COLLECTOR] Bắt đầu kết nối máy chủ ${targetHost}:${targetPort} (${serverSource})`);
    console.log(`[CAPTCHA-COLLECTOR] Tài khoản đăng nhập: ${args.user}`);
    console.log(`[CAPTCHA-COLLECTOR] Thư mục lưu ảnh: ${args.outputDir}`);
    console.log(`[CAPTCHA-COLLECTOR] Mục tiêu: ${args.count} ảnh duy nhất | Khoảng chờ: ${args.intervalMs}ms`);

    // 1. Login
    const loginPromise = client.login({
      host: targetHost,
      port: targetPort,
      user: args.user,
      pass: args.pass,
      identity,
    });

    const onlineWait = new Promise<void>((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const onStatus = (status: ClientStatus): void => {
        if (status === 'online') {
          cleanup();
          resolve();
        } else if (status === 'error') {
          cleanup();
          reject(new Error(`Đăng nhập thất bại: ${client.lastError ?? 'lỗi không xác định'}`));
        }
      };
      const onDialog = (reason: string): void => {
        if (client.status === 'logging-in' || client.status === 'connecting' || client.status === 'handshaking') {
          cleanup();
          reject(new Error(`Server từ chối đăng nhập: ${reason}`));
        }
      };
      const onAbort = (): void => {
        cleanup();
        reject(new Error('Hủy đăng nhập do tín hiệu ngắt'));
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        client.removeListener('status', onStatus);
        client.removeListener('dialog', onDialog);
        signal.removeEventListener('abort', onAbort);
      };
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Hết thời gian chờ trạng thái online sau ${LOGIN_TIMEOUT_MS}ms`));
      }, LOGIN_TIMEOUT_MS);

      client.on('status', onStatus);
      client.on('dialog', onDialog);
      signal.addEventListener('abort', onAbort, { once: true });
      if (client.status === 'online') {
        cleanup();
        resolve();
      }
    });

    await loginPromise;
    await onlineWait;
    console.log('[CAPTCHA-COLLECTOR] Đăng nhập thành công, trạng thái: online');

    // 2. Chuyển Park context
    console.log('[CAPTCHA-COLLECTOR] Chuyển context Khu giải trí (Park)...');
    client.enterParkContext();
    await abortableSleep(PARK_CONTEXT_GRACE_MS, signal);

    // 3. Vòng lặp thu thập captcha
    while (savedCount < args.count) {
      if (signal.aborted) break;

      const receivedAt = new Date();
      const ts = formatTimestamp(receivedAt);

      console.log(`\n[CAPTCHA-COLLECTOR] Yêu cầu captcha mới (#${savedCount + 1}/${args.count})...`);

      let challenge: CaptchaChallenge;
      try {
        const captchaPromise = gateService.waitForCaptcha(signal, CAPTCHA_WAIT_TIMEOUT_MS);
        gateService.openGameGate();
        challenge = await captchaPromise;
      } catch (err) {
        failureStreak++;
        duplicateStreak = 0;
        console.error(`[CAPTCHA-COLLECTOR] Lỗi nhận packet captcha: ${err instanceof Error ? err.message : String(err)} (failure streak: ${failureStreak}/${MAX_CONSECUTIVE_FAILURES})`);
        if (failureStreak >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`Dừng do đạt giới hạn ${MAX_CONSECUTIVE_FAILURES} lỗi liên tiếp`);
        }
        gateService.closeCaptchaDialog();
        await abortableSleep(args.intervalMs, signal);
        continue;
      }

      // Kiểm tra có dữ liệu ảnh không
      if (!challenge.imageBytes || challenge.imageBytes.length === 0) {
        failureStreak++;
        duplicateStreak = 0;
        failureSequence++;
        const failSeqStr = String(failureSequence).padStart(3, '0');
        const failBaseName = `captcha-${ts}-failed-${failSeqStr}`;
        const binPath = await getUniqueFilePath(args.outputDir, failBaseName, 'bin');
        const jsonPath = await getUniqueFilePath(args.outputDir, failBaseName, 'json');

        const metadata: CaptchaFailureMetadata = {
          receivedAt: receivedAt.toISOString(),
          command: CMD_CAPTCHA_CHALLENGE,
          payloadLength: 0,
          imageLength: null,
          sha256: '',
          errorCode: 'NO_IMAGE_DATA',
          errorSection: 'image',
          errorOffset: null,
        };

        await writeAtomic(binPath, Buffer.alloc(0));
        await writeAtomic(jsonPath, JSON.stringify(metadata, null, 2));

        console.warn(`[CAPTCHA-COLLECTOR] Challenge không chứa ảnh (đã lưu diagnostic: ${path.basename(jsonPath)}) (failure streak: ${failureStreak}/${MAX_CONSECUTIVE_FAILURES})`);

        if (failureStreak >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`Dừng do đạt giới hạn ${MAX_CONSECUTIVE_FAILURES} lỗi liên tiếp`);
        }

        gateService.closeCaptchaDialog();
        await abortableSleep(args.intervalMs, signal);
        continue;
      }

      // Tính SHA-256
      const sha256 = crypto.createHash('sha256').update(challenge.imageBytes).digest('hex');

      if (seenHashes.has(sha256)) {
        duplicateStreak++;
        failureStreak = 0;
        console.log(`[CAPTCHA-COLLECTOR] Ảnh trùng SHA-256 (${sha256.substring(0, 12)}...) - bỏ qua (duplicate streak: ${duplicateStreak}/${MAX_CONSECUTIVE_DUPLICATES})`);

        if (duplicateStreak >= MAX_CONSECUTIVE_DUPLICATES) {
          throw new Error(`Dừng do server trả ${MAX_CONSECUTIVE_DUPLICATES} ảnh trùng liên tiếp — không cấp challenge mới`);
        }

        gateService.closeCaptchaDialog();
        await abortableSleep(args.intervalMs, signal);
        continue;
      }

      // Giải mã định dạng ảnh
      try {
        const decoded = decodeCaptchaImage(challenge);
        sequence++;
        const seqStr = String(sequence).padStart(3, '0');
        const baseName = `captcha-${ts}-${seqStr}`;
        const targetPath = await getUniqueFilePath(args.outputDir, baseName, decoded.format);

        await writeAtomic(targetPath, decoded.bytes);

        seenHashes.add(sha256);
        savedCount++;
        failureStreak = 0;
        duplicateStreak = 0;

        console.log(`[CAPTCHA-COLLECTOR] Đã lưu ảnh (${savedCount}/${args.count}): ${path.basename(targetPath)} [${decoded.format.toUpperCase()}, ${decoded.bytes.length} bytes, SHA-256: ${sha256.substring(0, 12)}...]`);
      } catch (err) {
        failureStreak++;
        duplicateStreak = 0;
        failureSequence++;
        const failSeqStr = String(failureSequence).padStart(3, '0');
        const failBaseName = `captcha-${ts}-failed-${failSeqStr}`;
        const binPath = await getUniqueFilePath(args.outputDir, failBaseName, 'bin');
        const jsonPath = await getUniqueFilePath(args.outputDir, failBaseName, 'json');

        const isDecodeError = err instanceof CaptchaProtocolDecodeError;
        const metadata: CaptchaFailureMetadata = {
          receivedAt: receivedAt.toISOString(),
          command: CMD_CAPTCHA_CHALLENGE,
          payloadLength: challenge.imageBytes.length,
          imageLength: challenge.imageBytes.length,
          sha256,
          errorCode: isDecodeError ? err.code : 'UNKNOWN_ERROR',
          errorSection: isDecodeError ? err.section : 'general',
          errorOffset: isDecodeError ? err.offset : null,
        };

        await writeAtomic(binPath, challenge.imageBytes);
        await writeAtomic(jsonPath, JSON.stringify(metadata, null, 2));

        console.warn(`[CAPTCHA-COLLECTOR] Không nhận diện được định dạng ảnh (đã lưu diagnostic: ${path.basename(jsonPath)}) (failure streak: ${failureStreak}/${MAX_CONSECUTIVE_FAILURES})`);

        if (failureStreak >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`Dừng do đạt giới hạn ${MAX_CONSECUTIVE_FAILURES} lỗi liên tiếp`);
        }
      }

      gateService.closeCaptchaDialog();

      if (savedCount < args.count) {
        await abortableSleep(args.intervalMs, signal);
      }
    }

    if (savedCount >= args.count) {
      console.log(`\n[CAPTCHA-COLLECTOR] Thành công! Đã thu thập đủ ${savedCount} ảnh CAPTCHA duy nhất tại: ${args.outputDir}`);
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    console.log('[CAPTCHA-COLLECTOR] Đang đăng xuất và đóng kết nối socket...');
    client.logout();
  }
}

// Chạy trực tiếp nếu là entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseCollectorArgs(process.argv.slice(2));
    await runCollector(args);
    process.exit(0);
  } catch (err) {
    console.error(`\n[CAPTCHA-COLLECTOR ERROR] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
