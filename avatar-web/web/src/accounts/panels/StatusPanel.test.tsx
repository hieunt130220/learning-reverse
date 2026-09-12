import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { makeSnapshot } from '../../test/fixtures.js';
import type { AutomationSnapshot } from '../../types.js';
import { StatusPanel } from './StatusPanel.js';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../api.js', () => ({
  apiPost: mocks.apiPost,
  apiGet: mocks.apiGet,
  apiPut: mocks.apiPut,
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status = 500, body: unknown = undefined) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

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

const idleSnapshot = makeSnapshot({
  status: 'idle',
  retries: 0,
  auto: { running: false, cycle: 0, lastActions: [] },
  desiredConnected: false,
});

const onlineSnapshot = makeSnapshot({
  status: 'online',
  retries: 0,
  playerId: 123456,
  money: 500000,
  auto: { running: true, cycle: 15, lastRun: 1_700_000_000_000, lastActions: [] },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiPost.mockResolvedValue(makeAutomation());
  mocks.apiGet.mockResolvedValue({ revision: 0, config: { logoutAfterCycle: true } });
  mocks.apiPut.mockResolvedValue({ revision: 1, config: { logoutAfterCycle: true } });
});

test('hiển thị trạng thái và các nút điều khiển auto', () => {
  render(
    <StatusPanel
      accountId={1}
      snap={onlineSnapshot}
      gameUser="user123"
      onChanged={vi.fn()}
      automation={makeAutomation({ desiredMode: 'auto_farm', activeMode: 'auto_farm' })}
    />,
  );

  expect(screen.getByText('tài khoản game: user123')).toBeInTheDocument();
  expect(screen.getByText('id nhân vật: 123456')).toBeInTheDocument();
  expect(screen.getByText('500000 xu')).toBeInTheDocument();
  expect(screen.getByText('Nông trại')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Dừng Auto' })).toBeEnabled();
  expect(screen.getByText(/auto farm đang chạy — vòng 15/)).toBeInTheDocument();
});

test('đang chờ vòng kế tiếp thì vẫn giữ auto active và không cho bật lại', () => {
  render(
    <StatusPanel
      accountId={1}
      snap={makeSnapshot({
        status: 'idle',
        auto: { running: false, cycle: 15, lastActions: [] },
        desiredConnected: true,
      })}
      gameUser="user123"
      onChanged={vi.fn()}
      automation={makeAutomation({ desiredMode: 'auto_farm', activeMode: 'off' })}
    />,
  );

  expect(screen.getByRole('button', { name: 'Bắt đầu' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Dừng Auto' })).toBeEnabled();
  expect(screen.getByText('auto farm đang chờ kết nối / vòng tiếp theo')).toBeInTheDocument();
});

test('Bắt đầu gọi API automation/start và callback onChanged', async () => {
  const onChanged = vi.fn();
  render(
    <StatusPanel
      accountId={1}
      snap={idleSnapshot}
      gameUser="user123"
      onChanged={onChanged}
    />,
  );

  const startBtn = screen.getByRole('button', { name: 'Bắt đầu' });
  expect(startBtn).toBeEnabled();
  await userEvent.click(startBtn);

  await waitFor(() => {
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/accounts/1/automation/start', { mode: 'auto_farm' });
    expect(onChanged).toHaveBeenCalled();
  });
});

test('Dừng Auto gọi API automation/stop và callback onChanged', async () => {
  const onChanged = vi.fn();
  render(
    <StatusPanel
      accountId={1}
      snap={onlineSnapshot}
      gameUser="user123"
      onChanged={onChanged}
      automation={makeAutomation({ desiredMode: 'auto_farm', activeMode: 'auto_farm' })}
    />,
  );

  const stopBtn = screen.getByRole('button', { name: 'Dừng Auto' });
  expect(stopBtn).toBeEnabled();
  await userEvent.click(stopBtn);

  await waitFor(() => {
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/accounts/1/automation/stop', {});
    expect(onChanged).toHaveBeenCalled();
  });
});

test('hiển thị lỗi khi gọi bật auto thất bại', async () => {
  mocks.apiPost.mockRejectedValueOnce(new Error('Máy chủ từ chối'));
  render(
    <StatusPanel
      accountId={1}
      snap={idleSnapshot}
      gameUser="user123"
      onChanged={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));
  expect(await screen.findByText('Máy chủ từ chối')).toBeInTheDocument();
});
