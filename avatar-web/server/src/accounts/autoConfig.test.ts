import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeAutoConfig,
  normalizeAutoConfig,
  readStoredAutoConfig,
  validateAutoConfigProfile,
} from './autoConfig.js';

test('đọc JSON legacy thành revision 0', () => {
  assert.deepEqual(readStoredAutoConfig({ harvest: true, intervalMs: 60_000 }), {
    revision: 0,
    config: { harvest: true, intervalMs: 60_000 },
  });
});

test('đọc envelope v1 và chuẩn hóa plan theo cellIndex', () => {
  const state = readStoredAutoConfig({
    version: 1,
    revision: 4,
    config: {
      treeCellPlan: [
        { cellIndex: 8, action: 'skip' },
        { cellIndex: 2, action: 'seed', seedId: 6 },
      ],
    },
  });

  assert.equal(state.revision, 4);
  assert.deepEqual(state.config.treeCellPlan, [
    { cellIndex: 2, action: 'seed', seedId: 6 },
    { cellIndex: 8, action: 'skip' },
  ]);
});

test('reject envelope lỗi theo validation legacy nguyên vẹn', () => {
  assert.throws(
    () => readStoredAutoConfig({ version: 1, revision: '4', config: { harvest: true } }),
    /key cấu hình version không hợp lệ/,
  );
});

test('merge patch cũ không xóa treeCellPlan', () => {
  const current = { treeCellPlan: [{ cellIndex: 2, action: 'skip' as const }] };

  assert.deepEqual(mergeAutoConfig(current, { harvest: false }), {
    harvest: false,
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  });
});

test('merge bỏ qua field undefined thay vì xóa cấu hình hiện có', () => {
  assert.deepEqual(
    mergeAutoConfig({ seedId: 6, treeCellPlan: [] }, { seedId: undefined }),
    { seedId: 6, treeCellPlan: [] },
  );
});

test('reject plan trùng index và plan ngoài profile', () => {
  assert.throws(
    () => normalizeAutoConfig({ treeCellPlan: [
      { cellIndex: 1, action: 'skip' },
      { cellIndex: 1, action: 'seed', seedId: 6 },
    ] }),
    /ô 1 bị lặp/,
  );
  assert.throws(
    () => validateAutoConfigProfile(
      normalizeAutoConfig({ treeCellPlan: [{ cellIndex: 9, action: 'seed', seedId: 99 }] }),
      { cellIndices: [0, 1], seedIds: [5, 6] },
    ),
    /ô 9|hạt 99/,
  );
});

test('reject key lạ, boolean không đúng kiểu, và id không hợp lệ', () => {
  assert.throws(() => normalizeAutoConfig({ unexpected: true }), /không hợp lệ/);
  assert.throws(() => normalizeAutoConfig({ toString: true }), /không hợp lệ/);
  assert.throws(() => normalizeAutoConfig({ valueOf: true }), /không hợp lệ/);
  assert.throws(() => normalizeAutoConfig({ harvest: 1 }), /harvest phải là boolean/);
  assert.throws(() => normalizeAutoConfig({ seedId: 1.5 }), /seedId phải là số nguyên không âm/);
});
