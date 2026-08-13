import { describe, expect, test } from 'vitest';

import type { FarmProfileDto, TreeCellPlanEntry } from '../types.js';
import {
  applyTreePaint,
  invalidTreePlanEntries,
  summarizeTreePlan,
} from './treeCellPlan.js';

const profile = (
  cellIndices: number[],
  seedIds: number[],
): FarmProfileDto => ({
  farmId: 12,
  cellIndices,
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
  test('summary dùng cell index thật, kể cả không liên tục', () => {
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
  });

  test('không đếm entry ngoài danh sách ô đã quan sát', () => {
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
  test('đánh dấu ô không tồn tại và hạt không có trong catalog', () => {
    const entries: TreeCellPlanEntry[] = [
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'seed', seedId: 99 },
      { cellIndex: 9, action: 'skip' },
      { cellIndex: 42, action: 'skip' },
    ];

    expect(invalidTreePlanEntries(profile([2, 7, 9], [5, 6]), entries)).toEqual([
      { cellIndex: 7, action: 'seed', seedId: 99 },
      { cellIndex: 42, action: 'skip' },
    ]);
    expect(entries).toEqual([
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'seed', seedId: 99 },
      { cellIndex: 9, action: 'skip' },
      { cellIndex: 42, action: 'skip' },
    ]);
  });

  test('catalog trống chỉ làm seed override không hợp lệ, không làm skip sai', () => {
    expect(invalidTreePlanEntries(profile([2, 7], []), [
      { cellIndex: 2, action: 'skip' },
      { cellIndex: 7, action: 'seed', seedId: 6 },
    ])).toEqual([{ cellIndex: 7, action: 'seed', seedId: 6 }]);
  });
});
