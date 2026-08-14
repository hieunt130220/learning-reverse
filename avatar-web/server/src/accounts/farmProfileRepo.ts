import type { Db } from '../db/index.js';
import { DEFAULT_SEED_CATALOG } from './defaultSeedCatalog.js';

export interface CachedSeed {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface FarmProfile {
  farmId: number | null;
  cellIndices: number[];
  /** Slot chuồng (index từ 4 trở lên trong mảng vật nuôi). */
  barnAnimalSlots: number[];
  /** Slot ao (4 slot đầu 0–3). */
  pondAnimalSlots: number[];
  seedCatalog: CachedSeed[];
  cellsObservedAt: number | null;
  seedsObservedAt: number | null;
  updatedAt: number | null;
}

interface FarmProfileRow {
  farm_id: number | null;
  cell_indices_json: string;
  animal_slots_json: string;
  barn_animal_slots_json: string;
  pond_animal_slots_json: string;
  seed_catalog_json: string;
  cells_observed_at: number | null;
  seeds_observed_at: number | null;
  updated_at: number;
}

const EMPTY_PROFILE: FarmProfile = {
  farmId: null,
  cellIndices: [],
  barnAnimalSlots: [],
  pondAnimalSlots: [],
  seedCatalog: DEFAULT_SEED_CATALOG,
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

function normalizedAnimalSlots(animalSlots: number[]): number[] {
  if (animalSlots.some((index) => !Number.isInteger(index) || index < 0)) {
    throw new Error('animal slot index phải là số nguyên không âm');
  }
  return [...new Set(animalSlots)].sort((left, right) => left - right);
}

/**
 * Tách mảng slot đầy đủ ra hai nửa ao/chuồng bằng ranh giới đã biết. Ranh giới
 * chỉ xác định được khi có dữ liệu con thật (loài ao), nên khi chưa biết thì
 * lùi về mặc định 4 slot ao đầu — khớp quy ước đang dùng trong `classifyFarmSlots`.
 */
function splitAnimalSlots(
  allSlots: number[],
  pondCount: number | undefined,
  knownPondCount: boolean,
): { barnAnimalSlots: number[]; pondAnimalSlots: number[] } {
  const pond = knownPondCount
    ? Math.max(0, Math.min(pondCount ?? 4, allSlots.length))
    : Math.min(4, allSlots.length);
  return {
    pondAnimalSlots: allSlots.slice(0, pond),
    barnAnimalSlots: allSlots.slice(pond),
  };
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

function decodeAnimalSlots(raw: string): number[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('animal_slots_json không phải mảng');
  const slots: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number') throw new Error('animal_slots_json chứa giá trị không hợp lệ');
    slots.push(item);
  }
  return normalizedAnimalSlots(slots);
}

function decodeBarnAnimalSlots(raw: string): number[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('barn_animal_slots_json không phải mảng');
  const slots: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number') throw new Error('barn_animal_slots_json chứa giá trị không hợp lệ');
    slots.push(item);
  }
  return normalizedAnimalSlots(slots);
}

function decodePondAnimalSlots(raw: string): number[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('pond_animal_slots_json không phải mảng');
  const slots: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number') throw new Error('pond_animal_slots_json chứa giá trị không hợp lệ');
    slots.push(item);
  }
  return normalizedAnimalSlots(slots);
}

/**
 * Lưu mảng slot vật nuôi ĐẦY ĐỦ (cả slot trống lẫn đã nuôi, theo thứ tự server
 * trả trong gói 69) — nguồn duy nhất suy ra ranh giới ao/chuồng khi chưa có
 * bằng chứng loài. Hai cột ao/chuồng cũ vẫn được ghi để migrate dần.
 */
export function updateAnimalSlots(
  db: Db,
  accountId: number,
  allSlots: number[],
  barnAnimalSlots: number[] = [],
  pondAnimalSlots: number[] = [],
  observedAt = Date.now(),
): FarmProfile {
  const normalizedAll = normalizedAnimalSlots(allSlots);
  const normalizedBarn = normalizedAnimalSlots(barnAnimalSlots);
  const normalizedPond = normalizedAnimalSlots(pondAnimalSlots);
  db.prepare(
    `INSERT INTO avatar_farm_profile_cache
       (account_id, animal_slots_json, barn_animal_slots_json, pond_animal_slots_json,
        updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       animal_slots_json = excluded.animal_slots_json,
       barn_animal_slots_json = excluded.barn_animal_slots_json,
       pond_animal_slots_json = excluded.pond_animal_slots_json,
       updated_at = excluded.updated_at`,
  ).run(
    accountId,
    JSON.stringify(normalizedAll),
    JSON.stringify(normalizedBarn),
    JSON.stringify(normalizedPond),
    observedAt,
  );
  return getFarmProfile(db, accountId);
}

function decodeSeedCatalog(raw: string): CachedSeed[] {
  if (!raw || raw === '[]') return DEFAULT_SEED_CATALOG;
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('seed_catalog_json không phải mảng');
  if (value.length === 0) return DEFAULT_SEED_CATALOG;
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
      `SELECT farm_id, cell_indices_json, animal_slots_json, barn_animal_slots_json,
              pond_animal_slots_json, seed_catalog_json, cells_observed_at, seeds_observed_at,
              updated_at
         FROM avatar_farm_profile_cache
        WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row) {
    return {
      ...EMPTY_PROFILE,
      cellIndices: [],
      barnAnimalSlots: [],
      pondAnimalSlots: [],
      seedCatalog: [],
    };
  }
  const allSlots = decodeAnimalSlots(row.animal_slots_json);
  const barnSlots = decodeBarnAnimalSlots(row.barn_animal_slots_json);
  const pondSlots = decodePondAnimalSlots(row.pond_animal_slots_json);
  // Cột ao/chuồng cũ đã được ghi rõ ràng (khác mặc định) thì tin nó, kể cả khi
  // ao trống — `animal_slots_json` chỉ là nguồn dự phòng cho lần ghi đầu tiên.
  const barnKnown = row.barn_animal_slots_json !== '' && row.barn_animal_slots_json !== '[]';
  const pondKnown = row.pond_animal_slots_json !== '' && row.pond_animal_slots_json !== '[]';
  const split = barnKnown || pondKnown
    ? { barnAnimalSlots: barnSlots, pondAnimalSlots: pondSlots }
    : splitAnimalSlots(allSlots, pondSlots.length, false);
  return {
    farmId: row.farm_id,
    cellIndices: decodeCells(row.cell_indices_json),
    barnAnimalSlots: split.barnAnimalSlots,
    pondAnimalSlots: split.pondAnimalSlots,
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
  barnAnimalSlots: number[] = [],
  pondAnimalSlots: number[] = [],
  observedAt = Date.now(),
): FarmProfile {
  const normalizedCells = normalizedCellIndices(cellIndices);
  const normalizedBarn = normalizedAnimalSlots(barnAnimalSlots);
  const normalizedPond = normalizedAnimalSlots(pondAnimalSlots);
  db.prepare(
    `INSERT INTO avatar_farm_profile_cache
       (account_id, farm_id, cell_indices_json, barn_animal_slots_json, pond_animal_slots_json,
        cells_observed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       farm_id = excluded.farm_id,
       cell_indices_json = excluded.cell_indices_json,
       barn_animal_slots_json = excluded.barn_animal_slots_json,
       pond_animal_slots_json = excluded.pond_animal_slots_json,
       cells_observed_at = excluded.cells_observed_at,
       updated_at = excluded.updated_at`,
  ).run(
    accountId,
    farmId,
    JSON.stringify(normalizedCells),
    JSON.stringify(normalizedBarn),
    JSON.stringify(normalizedPond),
    observedAt,
    observedAt,
  );
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
