import type { Db } from '../db/index.js';

export interface CachedSeed {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface FarmProfile {
  farmId: number | null;
  cellIndices: number[];
  seedCatalog: CachedSeed[];
  cellsObservedAt: number | null;
  seedsObservedAt: number | null;
  updatedAt: number | null;
}

interface FarmProfileRow {
  farm_id: number | null;
  cell_indices_json: string;
  seed_catalog_json: string;
  cells_observed_at: number | null;
  seeds_observed_at: number | null;
  updated_at: number;
}

const EMPTY_PROFILE: FarmProfile = {
  farmId: null,
  cellIndices: [],
  seedCatalog: [],
  cellsObservedAt: null,
  seedsObservedAt: null,
  updatedAt: null,
};

function normalizedCellIndices(cellIndices: number[]): number[] {
  if (cellIndices.some((index) => !Number.isInteger(index) || index < 0)) {
    throw new Error('cell index phải là số nguyên không âm');
  }
  return [...new Set(cellIndices)].sort((left, right) => left - right);
}

function normalizedSeedCatalog(seeds: CachedSeed[]): CachedSeed[] {
  const byId = new Map<number, CachedSeed>();
  for (const seed of seeds) {
    if (!Number.isInteger(seed.id) || seed.id < 0) {
      throw new Error('seed id phải là số nguyên không âm');
    }
    if (typeof seed.name !== 'string') throw new Error('tên seed phải là chuỗi');
    if (!Number.isFinite(seed.growMinutes) || !Number.isFinite(seed.value)) {
      throw new Error('thông số seed phải là số hữu hạn');
    }
    byId.set(seed.id, { ...seed });
  }
  return [...byId.values()].sort(
    (left, right) => left.name.localeCompare(right.name, 'vi') || left.id - right.id,
  );
}

function decodeCells(raw: string): number[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('cell_indices_json không phải mảng');
  const cells: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number') throw new Error('cell_indices_json chứa giá trị không hợp lệ');
    cells.push(item);
  }
  return normalizedCellIndices(cells);
}

function decodeSeedCatalog(raw: string): CachedSeed[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('seed_catalog_json không phải mảng');
  const seeds: CachedSeed[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('seed_catalog_json chứa giá trị không hợp lệ');
    }
    const seed = item as Record<string, unknown>;
    if (
      typeof seed.id !== 'number'
      || typeof seed.name !== 'string'
      || typeof seed.growMinutes !== 'number'
      || typeof seed.value !== 'number'
    ) {
      throw new Error('seed_catalog_json chứa seed không hợp lệ');
    }
    seeds.push({
      id: seed.id,
      name: seed.name,
      growMinutes: seed.growMinutes,
      value: seed.value,
    });
  }
  return normalizedSeedCatalog(seeds);
}

export function getFarmProfile(db: Db, accountId: number): FarmProfile {
  const row = db
    .prepare<[number], FarmProfileRow>(
      `SELECT farm_id, cell_indices_json, seed_catalog_json,
              cells_observed_at, seeds_observed_at, updated_at
         FROM avatar_farm_profile_cache
        WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row) {
    return {
      ...EMPTY_PROFILE,
      cellIndices: [],
      seedCatalog: [],
    };
  }
  return {
    farmId: row.farm_id,
    cellIndices: decodeCells(row.cell_indices_json),
    seedCatalog: decodeSeedCatalog(row.seed_catalog_json),
    cellsObservedAt: row.cells_observed_at,
    seedsObservedAt: row.seeds_observed_at,
    updatedAt: row.updated_at,
  };
}

export function updateFarmCells(
  db: Db,
  accountId: number,
  farmId: number,
  cellIndices: number[],
  observedAt = Date.now(),
): FarmProfile {
  const normalized = normalizedCellIndices(cellIndices);
  db.prepare(
    `INSERT INTO avatar_farm_profile_cache
       (account_id, farm_id, cell_indices_json, cells_observed_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       farm_id = excluded.farm_id,
       cell_indices_json = excluded.cell_indices_json,
       cells_observed_at = excluded.cells_observed_at,
       updated_at = excluded.updated_at`,
  ).run(accountId, farmId, JSON.stringify(normalized), observedAt, observedAt);
  return getFarmProfile(db, accountId);
}

export function updateSeedCatalog(
  db: Db,
  accountId: number,
  seeds: CachedSeed[],
  observedAt = Date.now(),
): FarmProfile {
  const normalized = normalizedSeedCatalog(seeds);
  db.prepare(
    `INSERT INTO avatar_farm_profile_cache
       (account_id, seed_catalog_json, seeds_observed_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       seed_catalog_json = excluded.seed_catalog_json,
       seeds_observed_at = excluded.seeds_observed_at,
       updated_at = excluded.updated_at`,
  ).run(accountId, JSON.stringify(normalized), observedAt, observedAt);
  return getFarmProfile(db, accountId);
}

export function deleteFarmProfile(db: Db, accountId: number): void {
  db.prepare('DELETE FROM avatar_farm_profile_cache WHERE account_id = ?').run(accountId);
}
