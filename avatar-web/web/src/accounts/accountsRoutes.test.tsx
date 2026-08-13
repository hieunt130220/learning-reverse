import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { App } from '../App.js';
import { makeAccount } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  connectWs: vi.fn(),
  subscribeAccounts: vi.fn(),
  listeners: new Set<(message: WsMessage) => void>(),
}));

vi.mock('../api.js', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiDelete: mocks.apiDelete,
}));
vi.mock('../ws.js', () => ({
  connectWs: mocks.connectWs,
  subscribeAccounts: mocks.subscribeAccounts,
  onWsMessage(listener: (message: WsMessage) => void) {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderRoute(path: string) {
  mocks.apiGet.mockImplementation((url: string) => {
    if (url === '/api/auth/me') return Promise.resolve({ id: 9, email: 'user@example.com' });
    if (url === '/api/accounts') return Promise.resolve([makeAccount()]);
    throw new Error(`API ngoài dự kiến: ${url}`);
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => mocks.listeners.clear());

test('/accounts hiển thị dashboard và không có drawer', async () => {
  renderRoute('/accounts');
  expect(await screen.findByText('Farm chính')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /Vận hành/ })).not.toBeInTheDocument();
});

test('/accounts/:id giữ dashboard phía sau và mở drawer đúng account', async () => {
  renderRoute('/accounts/1');
  expect(await screen.findByRole('dialog', { name: 'Vận hành Farm chính' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Tài khoản avatar' })).toBeInTheDocument();
  expect(mocks.subscribeAccounts).toHaveBeenCalledWith([1]);
});

test('Escape đóng drawer về /accounts và cleanup subscription', async () => {
  renderRoute('/accounts/1');
  await screen.findByRole('dialog', { name: 'Vận hành Farm chính' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/accounts'));
  expect(mocks.subscribeAccounts).toHaveBeenLastCalledWith([]);
});

test('id không tồn tại hiển thị lỗi an toàn trong drawer', async () => {
  renderRoute('/accounts/999');
  expect(await screen.findByText('không có tài khoản này')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Về dashboard' })).toHaveAttribute('href', '/accounts');
});

test('/accounts/:id/debug hiển thị Debug riêng và link về Vận hành', async () => {
  renderRoute('/accounts/1/debug');
  expect(await screen.findByRole('heading', { name: 'Debug: Farm chính' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Về Vận hành' })).toHaveAttribute('href', '/accounts/1');
  expect(screen.getByText('Hành động')).toBeInTheDocument();
});
