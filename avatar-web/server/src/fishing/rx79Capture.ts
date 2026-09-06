import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { GameClient } from '../game/client.js';
import { decodeCanCau, saveCanCauBatch } from '../game/fishingDecode.js';
import type { Message } from '../proto/message.js';

export const RX79_CAPTURE_CYCLE_ID = 'p2cr-20260905-01' as const;

export interface Rx79CaptureStart {
  readonly accountId: number;
  readonly cycleId: typeof RX79_CAPTURE_CYCLE_ID;
  readonly map: number;
  readonly area: number;
}

export interface Rx79CaptureSnapshot {
  readonly state: 'capturing' | 'sealing' | 'sealed' | 'blocked';
  readonly savedBatchCount: number;
  readonly failedBatchCount: number;
  readonly startedAt: string;
  readonly inventoryPath?: string;
  readonly blockedReason?: string;
}

interface CaptureRecord {
  batchId: string;
  capturedAt: string;
  manifestSha256: string;
}

interface CaptureState {
  readonly accountId: number;
  readonly client: GameClient;
  readonly map: number;
  readonly area: number;
  readonly startedAt: Date;
  readonly onMessage: (message: Message) => void;
  readonly onClosed: () => void;
  readonly records: CaptureRecord[];
  phase: Rx79CaptureSnapshot['state'];
  savedBatchCount: number;
  failedBatchCount: number;
  writeTail: Promise<void>;
  sealPromise?: Promise<Rx79CaptureSnapshot>;
  inventoryPath?: string;
  blockedReason?: string;
}

async function sha256File(filePath: string): Promise<string> {
  const body = await fs.readFile(filePath);
  return createHash('sha256').update(body).digest('hex');
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await fs.open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class Rx79CaptureRegistry {
  private readonly states = new Map<number, CaptureState>();
  private readonly rawRoot: string;
  private readonly inventoryPath: string;

  constructor(private readonly captureRoot: string) {
    if (!path.isAbsolute(captureRoot)) {
      throw new Error('capture root phải là đường dẫn tuyệt đối');
    }
    this.rawRoot = path.join(captureRoot, 'raw');
    this.inventoryPath = path.join(captureRoot, 'evidence', 'capture-inventory.json');
  }

  start(client: GameClient, request: Rx79CaptureStart): Rx79CaptureSnapshot {
    if (request.cycleId !== RX79_CAPTURE_CYCLE_ID) {
      throw new Error('cycleId capture không hợp lệ');
    }
    if (!Number.isSafeInteger(request.accountId) || request.accountId <= 0) {
      throw new Error('accountId capture không hợp lệ');
    }
    if (
      !Number.isSafeInteger(request.map)
      || request.map < 0
      || !Number.isSafeInteger(request.area)
      || request.area < 0
    ) {
      throw new Error('map/area capture không hợp lệ');
    }
    if (client.status !== 'online') {
      throw new Error('phiên game chưa online');
    }
    if (this.states.has(request.accountId)) {
      throw new Error('capture đã có trạng thái cho account này');
    }

    let state: CaptureState;
    const onMessage = (message: Message): void => this.captureMessage(state, message);
    const onClosed = (): void => this.abort(request.accountId, 'game session closed');
    state = {
      accountId: request.accountId,
      client,
      map: request.map,
      area: request.area,
      startedAt: new Date(),
      onMessage,
      onClosed,
      records: [],
      phase: 'capturing',
      savedBatchCount: 0,
      failedBatchCount: 0,
      writeTail: Promise.resolve(),
    };
    this.states.set(request.accountId, state);
    client.session.on('message', onMessage);
    client.session.on('closed', onClosed);
    return this.toSnapshot(state);
  }

  snapshot(accountId: number): Rx79CaptureSnapshot | null {
    const state = this.states.get(accountId);
    return state ? this.toSnapshot(state) : null;
  }

  stopAndSeal(accountId: number): Promise<Rx79CaptureSnapshot> {
    const state = this.states.get(accountId);
    if (!state) {
      return Promise.reject(new Error('capture chưa được bắt đầu'));
    }
    if (state.phase === 'sealed') return Promise.resolve(this.toSnapshot(state));
    if (state.phase === 'blocked') {
      return Promise.reject(new Error(state.blockedReason ?? 'capture đã bị chặn'));
    }
    if (state.phase === 'sealing') return state.sealPromise!;

    state.phase = 'sealing';
    this.detach(state);
    const sealPromise = this.seal(state);
    state.sealPromise = sealPromise;
    return sealPromise;
  }

  abort(accountId: number, reason: string): void {
    const state = this.states.get(accountId);
    if (!state || state.phase === 'sealed' || state.phase === 'blocked') return;
    this.detach(state);
    state.phase = 'blocked';
    state.blockedReason = reason.trim() || 'capture aborted';
  }

  abortAll(reason: string): void {
    for (const accountId of this.states.keys()) this.abort(accountId, reason);
  }

  private captureMessage(state: CaptureState, message: Message): void {
    if (state.phase !== 'capturing' || message.command !== 79) return;
    const capturedAt = new Date();
    let payload;
    try {
      payload = decodeCanCau(message.getData());
    } catch {
      state.failedBatchCount += 1;
      return;
    }

    state.writeTail = state.writeTail.then(async () => {
      if (state.phase === 'blocked') return;
      try {
        const saved = await saveCanCauBatch(payload, {
          outputDir: this.rawRoot,
          tag: 'p2cr',
          map: state.map,
          area: state.area,
          capturedAt,
        });
        state.records.push({
          batchId: saved.batchId,
          capturedAt: capturedAt.toISOString(),
          manifestSha256: await sha256File(saved.manifestPath),
        });
        state.savedBatchCount += 1;
      } catch {
        state.failedBatchCount += 1;
      }
    });
  }

  private async seal(state: CaptureState): Promise<Rx79CaptureSnapshot> {
    try {
      await state.writeTail;
      this.assertSealing(state);
      const stoppedAt = new Date();
      const records = [...state.records].sort((left, right) => (
        left.capturedAt.localeCompare(right.capturedAt)
        || left.batchId.localeCompare(right.batchId)
      ));
      const inventoryDocument = {
        schemaVersion: 1,
        cycleId: RX79_CAPTURE_CYCLE_ID,
        startedAt: state.startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
        records: records.map(({ batchId, capturedAt, manifestSha256 }) => ({
          batchId,
          capturedAt,
          manifestSha256,
        })),
      };
      await this.writeInventory(state, `${JSON.stringify(inventoryDocument, null, 2)}\n`);
      this.assertSealing(state);
      state.phase = 'sealed';
      state.inventoryPath = this.inventoryPath;
      return this.toSnapshot(state);
    } catch (error) {
      const failure = asError(error);
      if (state.phase !== 'blocked') {
        state.phase = 'blocked';
        state.blockedReason = failure.message;
      }
      throw failure;
    }
  }

  private async writeInventory(state: CaptureState, body: string): Promise<void> {
    const directory = path.dirname(this.inventoryPath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    this.assertSealing(state);

    let created = false;
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    try {
      handle = await fs.open(this.inventoryPath, 'wx', 0o600);
      created = true;
      this.assertSealing(state);
      await handle.writeFile(body, 'utf8');
      this.assertSealing(state);
      await handle.sync();
      this.assertSealing(state);
      await handle.close();
      handle = undefined;
      await syncDirectory(directory);
      this.assertSealing(state);
    } catch (error) {
      if (handle) {
        try {
          await handle.close();
        } catch {
          // Preserve the original failure.
        }
      }
      if (created) {
        try {
          await fs.unlink(this.inventoryPath);
          await syncDirectory(directory);
        } catch {
          // Preserve the original failure and leave the stage blocked.
        }
      }
      throw error;
    }
  }

  private assertSealing(state: CaptureState): void {
    if (state.phase !== 'sealing') {
      throw new Error(state.blockedReason ?? 'capture không còn ở trạng thái sealing');
    }
  }

  private detach(state: CaptureState): void {
    state.client.session.removeListener('message', state.onMessage);
    state.client.session.removeListener('closed', state.onClosed);
  }

  private toSnapshot(state: CaptureState): Rx79CaptureSnapshot {
    return {
      state: state.phase,
      savedBatchCount: state.savedBatchCount,
      failedBatchCount: state.failedBatchCount,
      startedAt: state.startedAt.toISOString(),
      ...(state.inventoryPath ? { inventoryPath: state.inventoryPath } : {}),
      ...(state.blockedReason ? { blockedReason: state.blockedReason } : {}),
    };
  }
}
