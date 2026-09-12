import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeAccount, makeSnapshot } from '../test/fixtures.js';
import type { AutomationSnapshot } from '../types.js';
import { AccountCard } from './AccountCard.js';

function makeAutomation(overrides: Partial<AutomationSnapshot> = {}): AutomationSnapshot {
  return {
    desiredMode: 'off',
    activeMode: 'off',
    transitionState: 'stable',
    findNpcConfig: { revision: 0, config: { npcName: '' } },
    findNpcRuntime: { phase: 'idle', running: false, targetName: '', cursor: 0, total: 0, timeoutStreak: 0 },
    location: null,
    ...overrides,
  };
}

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

test('hiển thị cached xu, lượng và level khi chưa kết nối', () => {
  renderCard(makeAccount({
    autoEnabled: false,
    runtime: null,
    cachedMetrics: { xu: 1200, luong: 35, playerLevel: 7, farmLevel: 4, syncedAt: 123 },
  }));

  expect(screen.getByText('1.200')).toBeInTheDocument();
  expect(screen.getByText('35')).toBeInTheDocument();
  expect(screen.getByText('NV 7 · Farm 4')).toBeInTheDocument();
});

test('hiển thị lượng mở kèm lượng khoá khi cache có luongKhoa > 0', () => {
  renderCard(makeAccount({
    autoEnabled: false,
    runtime: null,
    cachedMetrics: { xu: 1200, luong: 0, luongKhoa: 337, playerLevel: 33, farmLevel: 39, syncedAt: 123 },
  }));

  expect(screen.getByText('0 (+337 khóa)')).toBeInTheDocument();
});

test('hiển thị gạch ngang cho lượng khi cache chưa có luong và luongKhoa', () => {
  // Đúng trạng thái của tài khoản chưa kết nối với cache cũ (cached_luong = NULL).
  renderCard(makeAccount({
    autoEnabled: false,
    runtime: null,
    cachedMetrics: { xu: 189587, playerLevel: 33, farmLevel: 39, syncedAt: 123 },
  }));

  expect(screen.getByText('Lượng').parentElement).toHaveTextContent('—');
  expect(screen.getByText('189.587')).toBeInTheDocument();
  expect(screen.getByText('NV 33 · Farm 39')).toBeInTheDocument();
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

test('không còn nút Kết nối hoặc Ngắt trên account card', () => {
  renderCard();
  expect(screen.queryByRole('button', { name: 'Kết nối' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ngắt' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mở vận hành' })).toBeInTheDocument();
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

test('automation off thì card hiển thị mode chip Tắt dù desiredConnected còn true', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'online',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
      automation: makeAutomation(),
    }),
  }));
  expect(screen.getByText('Tắt')).toBeInTheDocument();
  expect(screen.queryByText('đang chờ')).not.toBeInTheDocument();
  expect(screen.queryByText('Nông trại')).not.toBeInTheDocument();
});

test('automation desired auto_farm chưa chạy vòng thì hiển thị đang chờ', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'idle',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
      automation: makeAutomation({ desiredMode: 'auto_farm' }),
    }),
  }));
  expect(screen.getByText('đang chờ')).toBeInTheDocument();
});

test('không có automation thì giữ hành vi legacy theo desiredConnected', () => {
  renderCard(makeAccount({
    runtime: makeSnapshot({
      status: 'idle',
      auto: { running: false, cycle: 0, lastActions: [] },
      desiredConnected: true,
    }),
  }));
  expect(screen.getByText('đang chờ')).toBeInTheDocument();
});
