import { describe, expect, test } from 'vitest';

import type { FarmProfileDto, TreeCellPlanEntry } from '../types.js';
import {
  applyTreePaint,
  DEFAULT_SEED_CATALOG,
  DEFAULT_TREE_CELL_SLOTS,
  invalidTreePlanEntries,
  summarizeTreePlan,
  TREE_CELL_COUNT,
} from './treeCellPlan.js';

const profile = (
  cellIndices: number[],
  seedIds: number[],
): FarmProfileDto => ({
  farmId: 12,
  cellIndices,
  barnAnimalSlots: [],
  pondAnimalSlots: [],
  seedCatalog: seedIds.map((id) => ({
    id,
    name: `Hạt ${id}`,
    growMinutes: 10,
    value: 20,
  })),
  cellsObservedAt: 1_000,
  seedsObservedAt: 2_000,
  updatedAt: 2_000,
});

describe('treeCellPlan constants', () => {
  test('TREE_CELL_COUNT là 48 và DEFAULT_TREE_CELL_SLOTS từ 0 tới 47', () => {
    expect(TREE_CELL_COUNT).toBe(48);
    expect(DEFAULT_TREE_CELL_SLOTS).toHaveLength(48);
    expect(DEFAULT_TREE_CELL_SLOTS[0]).toBe(0);
    expect(DEFAULT_TREE_CELL_SLOTS[47]).toBe(47);
  });

  test('DEFAULT_SEED_CATALOG có đầy đủ 27 loại hạt giống mặc định', () => {
    expect(DEFAULT_SEED_CATALOG.length).toBe(27);
    expect(DEFAULT_SEED_CATALOG.some((s) => s.id === 0 && s.name === 'Cà chua')).toBe(true);
    expect(DEFAULT_SEED_CATALOG.some((s) => s.id === 6 && s.name === 'Lúa')).toBe(true);
  });
});

describe('applyTreePaint', () => {
  test('default xóa override, skip và seed thay thế đúng một cell', () => {
    let plan: TreeCellPlanEntry[] = [];
    plan = applyTreePaint(plan, 7, { kind: 'seed', seedId: 6 });
    plan = applyTreePaint(plan, 7, { kind: 'skip' });
    expect(plan).toEqual([{ cellIndex: 7, action: 'skip' }]);

    plan = applyTreePaint(plan, 7, { kind: 'default' });
    expect(plan).toEqual([]);
  });

  test('không sửa mảng đầu vào và luôn sắp tăng theo cellIndex', () => {
    const before: TreeCellPlanEntry[] = [
      { cellIndex: 9, action: 'skip' },
      { cellIndex: 2, action: 'seed', seedId: 5 },
    ];

    const after = applyTreePaint(before, 7, { kind: 'seed', seedId: 6 });

    expect(before).toEqual([
      { cellIndex: 9, action: 'skip' },
      { cellIndex: 2, action: 'seed', seedId: 5 },
    ]);
    expect(after).toEqual([
      { cellIndex: 2, action: 'seed', seedId: 5 },
      { cellIndex: 7, action: 'seed', seedId: 6 },
      { cellIndex: 9, action: 'skip' },
    ]);
  });
});

describe('summarizeTreePlan', () => {
  test('summary dùng cell index truyền vào hoặc mặc định 48 ô', () => {
    const result = summarizeTreePlan(
      [2, 7, 9],
      [
        { cellIndex: 2, action: 'seed', seedId: 6 },
        { cellIndex: 7, action: 'skip' },
      ],
    );

    expect(result.defaults).toBe(1);
    expect(result.skipped).toBe(1);
    expect([...result.seeds]).toEqual([[6, 1]]);

    const defaultResult = summarizeTreePlan(
      DEFAULT_TREE_CELL_SLOTS,
      [
        { cellIndex: 2, action: 'seed', seedId: 6 },
        { cellIndex: 7, action: 'skip' },
      ],
    );
    expect(defaultResult.defaults).toBe(46);
    expect(defaultResult.skipped).toBe(1);
    expect([...defaultResult.seeds]).toEqual([[6, 1]]);
  });

  test('không đếm entry ngoài danh sách ô', () => {
    const result = summarizeTreePlan(
      [2, 7],
      [
        { cellIndex: 2, action: 'seed', seedId: 6 },
        { cellIndex: 99, action: 'skip' },
      ],
    );

    expect(result).toEqual({ defaults: 1, skipped: 0, seeds: new Map([[6, 1]]) });
  });
});

describe('invalidTreePlanEntries', () => {
  test('đánh dấu ô ngoài 48 ô và hạt không có trong catalog', () => {
    const entries: TreeCellPlanEntry[] = [
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'seed', seedId: 9999 },
      { cellIndex: 9, action: 'skip' },
      { cellIndex: 50, action: 'skip' },
    ];

    expect(invalidTreePlanEntries(profile([2, 7, 9], [5, 6]), entries)).toEqual([
      { cellIndex: 7, action: 'seed', seedId: 9999 },
      { cellIndex: 50, action: 'skip' },
    ]);
  });

  test('catalog rỗng tự động fallback DEFAULT_SEED_CATALOG và chấp nhận hạt mặc định', () => {
    expect(invalidTreePlanEntries(profile([], []), [
      { cellIndex: 2, action: 'skip' },
      { cellIndex: 7, action: 'seed', seedId: 6 }, // Hạt Lúa trong DEFAULT_SEED_CATALOG
    ])).toEqual([]);

    expect(invalidTreePlanEntries(profile([], []), [
      { cellIndex: 7, action: 'seed', seedId: 9999 }, // Không có trong DEFAULT_SEED_CATALOG
    ])).toEqual([{ cellIndex: 7, action: 'seed', seedId: 9999 }]);
  });
});
