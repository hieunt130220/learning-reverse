import type { Db } from '../db/index.js';
import {
  emptyRuntimeSnapshot,
  type CachedRuntimeSnapshot,
  type RuntimeSnapshotPatch,
} from '../session/runtimeCache.js';

const CACHE_VERSION = 1;

interface CacheRow {
  payload_json: string | null;
  captured_at: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRuntimeSnapshotCache(
  db: Db,
  accountId: number,
): CachedRuntimeSnapshot {
  const row = db
    .prepare<[number], CacheRow>(
      `SELECT payload_json, captured_at
         FROM avatar_runtime_snapshot_cache
        WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row || !row.payload_json) return emptyRuntimeSnapshot();

  try {
    const value = JSON.parse(row.payload_json) as unknown;
    if (!isRecord(value) || value.version !== CACHE_VERSION) return emptyRuntimeSnapshot();
    const cache = emptyRuntimeSnapshot();
    const data = value as Record<string, unknown>;
    if (isRecord(data.quests) || data.quests === null) {
      cache.quests = data.quests as CachedRuntimeSnapshot['quests'];
    }
    if (isRecord(data.farm) || data.farm === null) {
      cache.farm = data.farm as CachedRuntimeSnapshot['farm'];
    }
    if (Array.isArray(data.inventory)) {
      cache.inventory = data.inventory as CachedRuntimeSnapshot['inventory'];
    }
    if (Array.isArray(data.farmProduce)) {
      cache.farmProduce = data.farmProduce as CachedRuntimeSnapshot['farmProduce'];
    }
    if (Array.isArray(data.cookingMaterials)) {
      cache.cookingMaterials = data.cookingMaterials as CachedRuntimeSnapshot['cookingMaterials'];
    }
    if (Array.isArray(data.trees)) {
      cache.trees = data.trees as CachedRuntimeSnapshot['trees'];
    }
    if (Array.isArray(data.items)) {
      cache.items = data.items as CachedRuntimeSnapshot['items'];
    }
    if (Array.isArray(data.animals)) {
      cache.animals = data.animals as CachedRuntimeSnapshot['animals'];
    }
    if (Array.isArray(data.foods)) {
      cache.foods = data.foods as CachedRuntimeSnapshot['foods'];
    }
    if (isRecord(data.cooking) || data.cooking === null) {
      cache.cooking = data.cooking as CachedRuntimeSnapshot['cooking'];
    }
    cache.capturedAt = typeof data.capturedAt === 'number' && Number.isFinite(data.capturedAt)
      ? data.capturedAt
      : row.captured_at;
    return cache;
  } catch {
    return emptyRuntimeSnapshot();
  }
}

export function saveRuntimeSnapshotCache(
  db: Db,
  accountId: number,
  patch: RuntimeSnapshotPatch,
  now = Date.now(),
): void {
  db.transaction(() => {
    const current = readRuntimeSnapshotCache(db, accountId);
    const next: CachedRuntimeSnapshot = { ...current, ...patch, capturedAt: now };
    db.prepare(
      `INSERT INTO avatar_runtime_snapshot_cache
          (account_id, payload_json, captured_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         payload_json = excluded.payload_json,
         captured_at = excluded.captured_at,
         updated_at = excluded.updated_at`,
    ).run(accountId, JSON.stringify({ version: CACHE_VERSION, ...next }), now, now);
  })();
}

export function deleteRuntimeSnapshotCache(db: Db, accountId: number): void {
  db.prepare('DELETE FROM avatar_runtime_snapshot_cache WHERE account_id = ?').run(accountId);
}
