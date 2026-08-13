import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeAccount } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';
import { AccountsProvider, useAccounts } from './AccountsProvider.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  listeners: new Set<(message: WsMessage) => void>(),
}));

vi.mock('../api.js', () => ({ apiGet: mocks.apiGet }));
vi.mock('../ws.js', () => ({
  onWsMessage(listener: (message: WsMessage) => void) {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

function Probe() {
  const { accounts, loading, error, reload } = useAccounts();
  return (
    <div>
      <output data-testid="loading">{String(loading)}</output>
      <output data-testid="error">{error}</output>
      <output data-testid="account">{accounts[0]?.runtime?.status ?? 'none'}</output>
      <button onClick={() => void reload()}>Nạp lại</button>
      <Outlet />
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<AccountsProvider />}>
          <Route element={<Probe />}>
            <Route index element={<span>child</span>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => mocks.listeners.clear());

test('tải danh sách lần đầu và cập nhật status nhẹ qua WS', async () => {
  mocks.apiGet.mockResolvedValue([makeAccount()]);
  renderProvider();
  expect(await screen.findByTestId('account')).toHaveTextContent('online');

  act(() => {
    for (const listener of mocks.listeners) listener({ type: 'status', accountId: 1, payload: 'error' });
  });
  expect(screen.getByTestId('account')).toHaveTextContent('error');
});

test('reload lỗi giữ danh sách cũ và công bố lỗi không chặn', async () => {
  mocks.apiGet.mockResolvedValueOnce([makeAccount()]).mockRejectedValueOnce(new Error('mất mạng'));
  renderProvider();
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  await userEvent.click(screen.getByRole('button', { name: 'Nạp lại' }));
  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('mất mạng'));
  expect(screen.getByTestId('account')).toHaveTextContent('online');
});

test('auto-disabled nạp lại vì DB đã đổi', async () => {
  mocks.apiGet.mockResolvedValue([makeAccount()]);
  renderProvider();
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  act(() => {
    for (const listener of mocks.listeners) listener({ type: 'auto-disabled', accountId: 1, payload: {} });
  });
  await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));
});
