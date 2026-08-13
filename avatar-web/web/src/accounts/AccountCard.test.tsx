import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeAccount, makeSnapshot } from '../test/fixtures.js';
import { AccountCard } from './AccountCard.js';

const api = vi.hoisted(() => ({ apiPost: vi.fn(), apiDelete: vi.fn() }));
vi.mock('../api.js', () => api);

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderCard(account = makeAccount(), reload = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <AccountCard account={account} reload={reload} />
      <Location />
    </MemoryRouter>,
  );
  return { reload };
}

beforeEach(() => vi.spyOn(window, 'confirm').mockReturnValue(true));

test('hiển thị nhãn, game user, trạng thái, xu và vòng auto', () => {
  renderCard();
  expect(screen.getByText('Farm chính')).toBeInTheDocument();
  expect(screen.getByText('avatar01')).toBeInTheDocument();
  expect(screen.getByText('đang online')).toBeInTheDocument();
  expect(screen.getByText(/1[.\s]250[.\s]000/)).toBeInTheDocument();
  expect(screen.getByText('vòng 32')).toBeInTheDocument();
});

test('ưu tiên lastError; nếu không có lỗi thì hiển thị thời điểm retry', () => {
  const account = makeAccount({
    runtime: makeSnapshot({ lastError: 'mất kết nối', nextRetryAt: Date.now() + 60_000 }),
  });
  renderCard(account);
  expect(screen.getByText('mất kết nối')).toBeInTheDocument();
  expect(screen.queryByText(/thử lại lúc/)).not.toBeInTheDocument();
});

test('click vùng nội dung hoặc nút Mở vận hành đi tới route drawer', async () => {
  const user = userEvent.setup();
  renderCard();
  await user.click(screen.getByRole('button', { name: 'Mở Farm chính' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts/1');
});

test('Ngắt gọi API và reload nhưng không mở drawer', async () => {
  const user = userEvent.setup();
  api.apiPost.mockResolvedValue({});
  const { reload } = renderCard();
  await user.click(screen.getByRole('button', { name: 'Ngắt' }));
  expect(api.apiPost).toHaveBeenCalledWith('/api/accounts/1/disconnect');
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts');
});

test('Xóa xác nhận, gọi DELETE và không mở drawer', async () => {
  const user = userEvent.setup();
  api.apiDelete.mockResolvedValue({});
  const { reload } = renderCard();
  await user.click(screen.getByRole('button', { name: 'Xóa Farm chính' }));
  expect(window.confirm).toHaveBeenCalledWith('Xoá tài khoản "Farm chính"? Phiên đang chạy sẽ bị dừng.');
  expect(api.apiDelete).toHaveBeenCalledWith('/api/accounts/1');
  expect(reload).toHaveBeenCalledOnce();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts');
});

test('busy khóa các thao tác xung đột của cùng card', async () => {
  let resolveRequest!: () => void;
  api.apiPost.mockReturnValue(new Promise<void>((resolve) => { resolveRequest = resolve; }));
  renderCard();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ngắt' }));
  expect(screen.getByRole('button', { name: 'Ngắt' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Xóa Farm chính' })).toBeDisabled();
  resolveRequest();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ngắt' })).toBeEnabled());
});
