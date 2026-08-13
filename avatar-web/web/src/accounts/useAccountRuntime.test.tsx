import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeSnapshot } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { useAccountRuntime } from './useAccountRuntime.js';

const ws = vi.hoisted(() => ({
  listeners: new Set<(message: WsMessage) => void>(),
  subscribeAccounts: vi.fn(),
}));

vi.mock('../ws.js', () => ({
  subscribeAccounts: ws.subscribeAccounts,
  onWsMessage(listener: (message: WsMessage) => void) {
    ws.listeners.add(listener);
    return () => ws.listeners.delete(listener);
  },
}));

beforeEach(() => ws.listeners.clear());

test('subscribe id khi mount, nhận event đúng account và cleanup về mảng rỗng', () => {
  const initial = makeSnapshot({ accountId: 1, money: 1 });
  const { result, unmount } = renderHook(() => useAccountRuntime(1, initial));

  expect(ws.subscribeAccounts).toHaveBeenLastCalledWith([1]);

  act(() => {
    for (const listener of ws.listeners) listener({ type: 'money', accountId: 2, payload: { balance: 2 } });
  });
  expect(result.current?.money).toBe(1);

  act(() => {
    for (const listener of ws.listeners) listener({ type: 'money', accountId: 1, payload: { balance: 88 } });
  });
  expect(result.current?.money).toBe(88);

  unmount();
  expect(ws.subscribeAccounts).toHaveBeenLastCalledWith([]);
  expect(ws.listeners.size).toBe(0);
});

test('đổi account cleanup subscription cũ trước khi subscribe id mới', () => {
  const first = makeSnapshot({ accountId: 1 });
  const second = makeSnapshot({ accountId: 2 });
  const { rerender } = renderHook(
    ({ id, snapshot }) => useAccountRuntime(id, snapshot),
    { initialProps: { id: 1, snapshot: first } },
  );

  rerender({ id: 2, snapshot: second });
  expect(ws.subscribeAccounts.mock.calls.slice(-2)).toEqual([[[]], [[2]]]);
});
