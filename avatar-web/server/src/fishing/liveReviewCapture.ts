import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto';
import { existsSync, promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import type { CanCauPayload, SuccessfulInferenceResult } from './autoDecision.js';

export const LIVE_REVIEW_TARGET_BATCH_COUNT = 100 as const;
export type LiveReviewCaptureState = 'capturing' | 'sealing' | 'ready' | 'blocked';

export interface LiveReviewCaptureSnapshot {
  readonly enabled: true;
  readonly state?: LiveReviewCaptureState;
  readonly sessionId?: string;
  readonly targetBatchCount: 100;
  readonly savedBatchCount: number;
  readonly failedBatchCount: number;
  readonly startedAt?: string;
  readonly stoppedAt?: string;
  readonly reportReady: boolean;
  readonly lastError?: string;
}

interface BatchRecord { batchId: string; capturedAt: string; predictionPath: string }
interface CaptureState {
  accountId: number; sessionId: string; sessionRoot: string; startedAt: string;
  stoppedAt?: string; phase: LiveReviewCaptureState; savedBatchCount: number;
  failedBatchCount: number; records: BatchRecord[]; writeTail: Promise<void>;
  sealPromise?: Promise<LiveReviewCaptureSnapshot>; reportPath?: string; lastError?: string;
}

interface RegistryOptions {
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  buildReport?: (manifestPath: string, outputPath: string) => Promise<void>;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SESSION_ID_RE = /^live-review-[A-Za-z0-9-]+$/;
const compactUtc = (date: Date): string => date.toISOString().replace(/[-:.]/g, '');
const sanitize = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 300);
const sha256 = (body: Buffer): string => createHash('sha256').update(body).digest('hex');

async function writeExclusive(filePath: string, value: unknown): Promise<void> {
  const handle = await fs.open(filePath, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
}

export class LiveReviewCaptureRegistry {
  private readonly states = new Map<number, CaptureState>();
  private readonly now: () => Date;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly buildReport: (manifestPath: string, outputPath: string) => Promise<void>;

  constructor(private readonly captureRoot: string, options: RegistryOptions = {}) {
    if (!path.isAbsolute(captureRoot)) throw new Error('capture root phải là đường dẫn tuyệt đối');
    this.now = options.now ?? (() => new Date());
    this.randomBytes = options.randomBytes ?? cryptoRandomBytes;
    this.buildReport = options.buildReport ?? this.defaultBuildReport.bind(this);
  }

  start(accountId: number): LiveReviewCaptureSnapshot {
    this.assertAccountId(accountId);
    const current = this.states.get(accountId);
    if (current?.phase === 'capturing' || current?.phase === 'sealing') {
      throw new Error('capture đang chạy cho tài khoản này');
    }
    const startedAt = this.now();
    const sessionId = `live-review-${compactUtc(startedAt)}-${this.randomBytes(4).toString('hex')}`;
    const sessionRoot = path.join(this.captureRoot, 'sessions', sessionId);
    const state: CaptureState = { accountId, sessionId, sessionRoot, startedAt: startedAt.toISOString(), phase: 'capturing', savedBatchCount: 0, failedBatchCount: 0, records: [], writeTail: Promise.resolve() };
    this.states.set(accountId, state);
    state.writeTail = fs.mkdir(path.join(sessionRoot, 'raw'), { recursive: true, mode: 0o700 })
      .then(() => fs.mkdir(path.join(sessionRoot, 'staging'), { recursive: true, mode: 0o700 }))
      .then(() => this.writeSession(state))
      .catch((error) => { state.phase = 'blocked'; state.lastError = sanitize(error); });
    return this.toSnapshot(state);
  }

  snapshot(accountId: number): LiveReviewCaptureSnapshot {
    this.assertAccountId(accountId);
    const state = this.states.get(accountId);
    return state ? this.toSnapshot(state) : this.idleSnapshot();
  }

  record(accountId: number, payload: CanCauPayload, result: SuccessfulInferenceResult): void {
    const state = this.states.get(accountId);
    if (!state || state.phase !== 'capturing') return;
    const capturedAt = this.now();
    const images = payload.images.map((item) => Buffer.from(item));
    const imagesNew = payload.imagesNew?.map((item) => Buffer.from(item));
    const prediction = { ...result, predictions: result.predictions.map((item) => ({ ...item })) };
    state.writeTail = state.writeTail.then(async () => {
      if (state.phase === 'blocked' || state.phase === 'ready') return;
      try {
        this.validateBatch(images, imagesNew, prediction);
        const batchId = `live-${compactUtc(capturedAt)}-${this.randomBytes(4).toString('hex')}`;
        const stage = path.join(state.sessionRoot, 'staging', batchId);
        await fs.mkdir(path.join(stage, 'img'), { recursive: true, mode: 0o700 });
        await fs.mkdir(path.join(stage, 'new'), { recursive: true, mode: 0o700 });
        const files: Record<string, string> = {};
        for (let i = 0; i < images.length; i += 1) {
          const rel = `img/${i}.png`; await fs.writeFile(path.join(stage, rel), images[i]!, { mode: 0o600 }); files[rel] = sha256(images[i]!);
        }
        for (let i = 0; i < imagesNew!.length; i += 1) {
          const rel = `new/${i}.png`; await fs.writeFile(path.join(stage, rel), imagesNew![i]!, { mode: 0o600 }); files[rel] = sha256(imagesNew![i]!);
        }
        const predictionDoc = { schemaVersion: 1, batchId, capturedAt: capturedAt.toISOString(), idFish: payload.idFish, timeDelayMs: payload.timeDelayMs, images: images.map((_v, index) => ({ index, path: `img/${index}.png` })), imagesNew: imagesNew!.map((_v, index) => ({ index, path: `new/${index}.png` })), files, inference: prediction };
        await writeExclusive(path.join(stage, 'prediction.json'), predictionDoc);
        await fs.rename(stage, path.join(state.sessionRoot, 'raw', batchId));
        state.records.push({ batchId, capturedAt: capturedAt.toISOString(), predictionPath: `raw/${batchId}/prediction.json` });
        state.savedBatchCount += 1;
        await this.writeSession(state);
        if (state.savedBatchCount >= LIVE_REVIEW_TARGET_BATCH_COUNT) void this.stopAndSeal(accountId).catch(() => undefined);
      } catch (error) {
        state.failedBatchCount += 1; state.lastError = sanitize(error); await this.writeSession(state);
      }
    });
  }

  stopAndSeal(accountId: number): Promise<LiveReviewCaptureSnapshot> {
    const state = this.states.get(accountId);
    if (!state) return Promise.reject(new Error('capture chưa được bắt đầu'));
    if (state.phase === 'ready') return Promise.resolve(this.toSnapshot(state));
    if (state.phase === 'blocked') return Promise.reject(new Error(state.lastError ?? 'capture đã bị chặn'));
    if (state.phase === 'sealing') return state.sealPromise!;
    state.phase = 'sealing';
    state.sealPromise = this.seal(state);
    return state.sealPromise;
  }

  reportPath(accountId: number, sessionId: string): string | null {
    if (!Number.isSafeInteger(accountId) || accountId <= 0 || !SESSION_ID_RE.test(sessionId)) return null;
    const state = this.states.get(accountId);
    if (state?.sessionId === sessionId && state.phase === 'ready' && state.reportPath) return state.reportPath;
    const sessionRoot = path.resolve(this.captureRoot, 'sessions', sessionId);
    const root = path.resolve(this.captureRoot) + path.sep;
    if (!sessionRoot.startsWith(root)) return null;
    try {
      const doc = JSON.parse(readFileSync(path.join(sessionRoot, 'session.json'), 'utf8')) as { accountId?: unknown; state?: unknown };
      const report = path.join(sessionRoot, 'review.html');
      return doc.accountId === accountId && doc.state === 'ready' && existsSync(report) ? report : null;
    } catch { return null; }
  }

  abortAll(reason: string): void {
    for (const state of this.states.values()) {
      if (state.phase === 'capturing' || state.phase === 'sealing') { state.phase = 'blocked'; state.lastError = sanitize(reason); void state.writeTail.then(() => this.writeSession(state)); }
    }
  }

  private async seal(state: CaptureState): Promise<LiveReviewCaptureSnapshot> {
    try {
      await state.writeTail;
      if (state.savedBatchCount === 0) throw new Error('capture chưa có batch thành công');
      const stoppedAt = this.now().toISOString();
      const manifestPath = path.join(state.sessionRoot, 'manifest.json');
      const records = [...state.records].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.batchId.localeCompare(b.batchId));
      if (state.phase !== 'sealing') throw new Error(state.lastError ?? 'capture không còn ở trạng thái sealing');
      await writeExclusive(manifestPath, { schemaVersion: 1, sessionId: state.sessionId, accountId: state.accountId, startedAt: state.startedAt, stoppedAt, batches: records });
      const reportPath = path.join(state.sessionRoot, 'review.html');
      await this.buildReport(manifestPath, reportPath);
      await fs.access(reportPath);
      if (state.phase !== 'sealing') throw new Error(state.lastError ?? 'capture không còn ở trạng thái sealing');
      state.phase = 'ready'; state.stoppedAt = stoppedAt; state.reportPath = reportPath; await this.writeSession(state);
      return this.toSnapshot(state);
    } catch (error) {
      state.phase = 'blocked'; state.lastError = sanitize(error); await this.writeSession(state); throw error;
    }
  }

  private validateBatch(images: Buffer[], imagesNew: Buffer[] | undefined, result: SuccessfulInferenceResult): void {
    if (images.length !== 6 || images.some((item) => item.length === 0 || !item.subarray(0, 8).equals(PNG_SIGNATURE))) throw new Error('batch phải có đúng 6 PNG reference hợp lệ');
    if (!imagesNew || imagesNew.length < 1 || imagesNew.length > 255 || imagesNew.some((item) => item.length === 0 || !item.subarray(0, 8).equals(PNG_SIGNATURE))) throw new Error('batch phải có 1–255 PNG query hợp lệ');
    if (result.predictions.length !== imagesNew.length || result.predictionCount !== imagesNew.length) throw new Error('prediction không phủ đủ query');
    const seen = new Set<number>();
    let acceptedCount = 0;
    for (const item of result.predictions) {
      if (!Number.isInteger(item.queryIndex) || item.queryIndex < 0 || item.queryIndex >= imagesNew.length || seen.has(item.queryIndex)) throw new Error('queryIndex prediction không hợp lệ hoặc trùng');
      if (!Number.isInteger(item.referenceIndex) || item.referenceIndex < 0 || item.referenceIndex >= 6) throw new Error('referenceIndex prediction ngoài phạm vi');
      if (!Number.isFinite(item.similarity) || (item.margin !== null && !Number.isFinite(item.margin)) || typeof item.accepted !== 'boolean') throw new Error('score prediction không hợp lệ');
      seen.add(item.queryIndex);
      acceptedCount += Number(item.accepted);
    }
    if (acceptedCount !== result.acceptedCount) throw new Error('acceptedCount không khớp predictions');
  }

  private async writeSession(state: CaptureState): Promise<void> {
    await fs.mkdir(state.sessionRoot, { recursive: true, mode: 0o700 });
    const target = path.join(state.sessionRoot, 'session.json'); const temp = `${target}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify({ schemaVersion: 1, accountId: state.accountId, sessionId: state.sessionId, state: state.phase, targetBatchCount: LIVE_REVIEW_TARGET_BATCH_COUNT, savedBatchCount: state.savedBatchCount, failedBatchCount: state.failedBatchCount, startedAt: state.startedAt, stoppedAt: state.stoppedAt, reportReady: state.phase === 'ready', lastError: state.lastError }, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, target);
  }

  private idleSnapshot(): LiveReviewCaptureSnapshot { return { enabled: true, targetBatchCount: LIVE_REVIEW_TARGET_BATCH_COUNT, savedBatchCount: 0, failedBatchCount: 0, reportReady: false }; }
  private toSnapshot(state: CaptureState): LiveReviewCaptureSnapshot { return { enabled: true, state: state.phase, sessionId: state.sessionId, targetBatchCount: LIVE_REVIEW_TARGET_BATCH_COUNT, savedBatchCount: state.savedBatchCount, failedBatchCount: state.failedBatchCount, startedAt: state.startedAt, stoppedAt: state.stoppedAt, reportReady: state.phase === 'ready', lastError: state.lastError }; }
  private assertAccountId(value: number): void { if (!Number.isSafeInteger(value) || value <= 0) throw new Error('accountId capture không hợp lệ'); }

  private defaultBuildReport(manifestPath: string, outputPath: string): Promise<void> {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fishing-ml/scripts/build_live_review.py');
    return new Promise((resolve, reject) => {
      const child = spawn('python3', [script, '--manifest', manifestPath, '--output', outputPath], { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-4096); });
      child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`build report lỗi (${code}): ${stderr.trim()}`)));
    });
  }
}
