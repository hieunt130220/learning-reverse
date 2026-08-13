import { describe, expect, test } from 'vitest';

import { makeSnapshot } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { reduceAccountRuntime } from './accountRuntime.js';

const event = (type: string, payload: WsMessage['payload'], accountId = 1): WsMessage => ({
  type,
  payload,
  accountId,
});

describe('reduceAccountRuntime', () => {
  test('snapshot thay toàn bộ runtime', () => {
    const next = makeSnapshot({ money: 99 });
    expect(reduceAccountRuntime(1, makeSnapshot({ money: 1 }), event('snapshot', next))).toBe(next);
  });

  test.each([
    ['status', 'error', 'status'],
    ['auto', { running: false, cycle: 7, lastActions: [] }, 'auto'],
    ['macro', { running: true, cycle: 2 }, 'macro'],
    ['farm', { idFarm: 7, cells: [], animals: [], updatedAt: 3 }, 'farm'],
    ['inventory', [{ id: 12, num: 4 }], 'inventory'],
  ] as const)('%s chỉ cập nhật trường %s', (type, payload, key) => {
    const before = makeSnapshot();
    const after = reduceAccountRuntime(1, before, event(type, payload));
    expect(after).toEqual({ ...before, [key]: payload });
  });

  test('money đọc balance và giữ các trường khác', () => {
    const before = makeSnapshot({ money: 1 });
    expect(reduceAccountRuntime(1, before, event('money', { balance: 88 }))).toEqual({
      ...before,
      money: 88,
    });
  });

  test('trees cập nhật đồng thời cây, vật phẩm và vật nuôi', () => {
    const before = makeSnapshot();
    const payload = {
      trees: [{ id: 1, name: 'Khế', growMinutes: 5, value: 10 }],
      items: [{ id: 2, name: 'Nước', price: 100 }],
      animals: [{ id: 3, name: 'Gà', desc: '' }],
    };
    expect(reduceAccountRuntime(1, before, event('trees', payload))).toMatchObject(payload);
  });

  test('bỏ qua event của account khác', () => {
    const before = makeSnapshot({ money: 1 });
    expect(reduceAccountRuntime(1, before, event('money', { balance: 88 }, 2))).toBe(before);
  });

  test('event lẻ không dựng snapshot khi runtime đang null', () => {
    expect(reduceAccountRuntime(1, null, event('status', 'online'))).toBeNull();
  });

  test('log giữ đúng 500 dòng gần nhất', () => {
    const logs = Array.from({ length: 500 }, (_, t) => ({ t, line: String(t) }));
    const after = reduceAccountRuntime(1, makeSnapshot({ logs }), event('log', { t: 500, line: '500' }));
    expect(after?.logs).toHaveLength(500);
    expect(after?.logs[0].t).toBe(1);
    expect(after?.logs.at(-1)?.t).toBe(500);
  });

  test('traffic giữ đúng 300 gói gần nhất', () => {
    const traffic = Array.from({ length: 300 }, (_, t) => ({
      t,
      dir: 'rx' as const,
      cmd: t,
      name: String(t),
      len: 0,
      hex: '',
    }));
    const incoming = { t: 300, dir: 'tx' as const, cmd: 300, name: '300', len: 1, hex: '00' };
    const after = reduceAccountRuntime(1, makeSnapshot({ traffic }), event('traffic', incoming));
    expect(after?.traffic).toHaveLength(300);
    expect(after?.traffic[0].t).toBe(1);
    expect(after?.traffic.at(-1)?.t).toBe(300);
  });
});
