import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { App } from '../App.js';
import { makeAccount } from '../test/fixtures.js';
import type { WsMessage } from '../ws.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  connectWs: vi.fn(),
  subscribeAccounts: vi.fn(),
  listeners: new Set<(message: WsMessage) => void>(),
}));

vi.mock('../api.js', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPut: mocks.apiPut,
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
    if (url === '/api/accounts/1/auto/config') return Promise.resolve({ revision: 3, config: { treeCellPlan: [] } });
    if (url === '/api/accounts/1/farm/profile') return Promise.resolve({
      farmId: 12,
      cellIndices: [2, 7],
      seedCatalog: [{ id: 6, name: 'Hoa hồng', growMinutes: 30, value: 20 }],
      cellsObservedAt: 1_700_000_000_000,
      seedsObservedAt: 1_700_000_010_000,
      updatedAt: 1_700_000_010_000,
    });
    throw new Error(`API ngoài dự kiến: ${url}`);
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.listeners.clear();
  mocks.apiPost.mockResolvedValue({});
  mocks.apiPut.mockResolvedValue({
    revision: 4,
    config: { treeCellPlan: [{ cellIndex: 2, action: 'skip' }] },
    application: 'next-start',
  });
});

async function makePlanDirty() {
  const summary = await screen.findByText(/Kế hoạch cây theo ô/i);
  if (summary.closest('summary')) await userEvent.click(summary);
  await userEvent.click(screen.getByRole('button', { name: /Không trồng/i }));
  await userEvent.click(screen.getByRole('button', { name: /Ô 2(?:\D|$)/i }));
}

test('/accounts hiển thị dashboard và không có drawer', async () => {
  renderRoute('/accounts');
  expect(await screen.findByText('Farm chính')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: /Vận hành/ })).not.toBeInTheDocument();
});

test('/accounts/:id giữ dashboard phía sau và mở drawer đúng account', async () => {
  renderRoute('/accounts/1');
  expect(await screen.findByRole('dialog', { name: 'Vận hành Farm chính' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Tài khoản avatar' })).toBeInTheDocument();
  await waitFor(() => expect(mocks.subscribeAccounts).toHaveBeenCalledWith([1]));
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

test('Escape hỏi xác nhận khi plan bẩn và chỉ đóng khi đồng ý', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  renderRoute('/accounts/1');
  await makePlanDirty();

  await userEvent.keyboard('{Escape}');
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts/1');
  expect(confirm).toHaveBeenLastCalledWith('Kế hoạch cây chưa lưu. Bỏ thay đổi?');

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/accounts'));
});

test.each([
  ['nút Đóng', async () => userEvent.click(screen.getByRole('button', { name: 'Đóng' }))],
  ['backdrop', async () => {
    const backdrop = screen.getByRole('dialog', { name: 'Vận hành Farm chính' }).parentElement!;
    fireEvent.mouseDown(backdrop);
  }],
  ['link Debug', async () => userEvent.click(screen.getByRole('link', { name: /Debug chuyên sâu/i }))],
] as const)('%s dùng cùng dirty guard và thực hiện đúng đích sau khi chấp nhận', async (kind, leave) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  renderRoute('/accounts/1');
  await makePlanDirty();

  await leave();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts/1');
  expect(confirm).toHaveBeenLastCalledWith('Kế hoạch cây chưa lưu. Bỏ thay đổi?');

  await leave();
  const expected = kind === 'link Debug' ? '/accounts/1/debug' : '/accounts';
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(expected));
});

test('plan bẩn chặn beforeunload và save thành công gỡ chặn', async () => {
  renderRoute('/accounts/1');
  await makePlanDirty();

  const dirtyEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirtyEvent);
  expect(dirtyEvent.defaultPrevented).toBe(true);

  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));
  await waitFor(() => expect(mocks.apiPut).toHaveBeenCalled());
  const cleanEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
});
