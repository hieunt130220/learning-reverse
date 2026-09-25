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
  mocks.apiGet.mockImplementation((url: string) => {
    if (url.includes('/automation/mining/config')) {
      return Promise.resolve({
        revision: 1,
        config: {
          target: 'diamond',
          startArea: 0,
          switchAreaWhenDepleted: true,
          maxAreasToScan: 10,
          delayBetweenActionsMs: 3000,
        },
      });
    }
    return Promise.resolve({ revision: 0, config: { logoutAfterCycle: true } });
  });
  mocks.apiPut.mockImplementation((url: string, body: any) => {
    if (url.includes('/automation/mining/config')) {
      return Promise.resolve({
        revision: 2,
        config: body?.config,
      });
    }
    return Promise.resolve({ revision: 1, config: { logoutAfterCycle: true } });
  });
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

test('bật auto Khai thác gỗ/đá mở popup chọn loại và kích hoạt auto', async () => {
  const onChanged = vi.fn();
  render(
    <StatusPanel
      accountId={1}
      snap={idleSnapshot}
      gameUser="user123"
      onChanged={onChanged}
    />,
  );

  // Chọn mode khai thác gỗ/đá
  const miningModeBtn = screen.getByRole('button', { name: '⛏️ Khai thác gỗ/đá' });
  await userEvent.click(miningModeBtn);

  // Bấm Bắt đầu
  const startBtn = screen.getByRole('button', { name: 'Bắt đầu' });
  await userEvent.click(startBtn);

  // Modal phải xuất hiện
  expect(await screen.findByRole('dialog', { name: /Chọn Loại Khai Thác/ })).toBeInTheDocument();
  expect(screen.getByText(/Khai thác Gỗ \(Củi khô\)/)).toBeInTheDocument();
  expect(screen.getByText(/Tuần Tra Cả Hai/)).toBeInTheDocument();

  // Chọn Khai thác Gỗ
  const woodRadio = screen.getByDisplayValue('wood');
  await userEvent.click(woodRadio);

  // Bấm Bắt đầu khai thác trong modal
  const submitMiningBtn = screen.getByRole('button', { name: 'Bắt đầu khai thác' });
  await userEvent.click(submitMiningBtn);

  await waitFor(() => {
    // Phải lưu config gỗ trước
    expect(mocks.apiPut).toHaveBeenCalledWith(
      '/api/accounts/1/automation/mining/config',
      expect.objectContaining({
        config: expect.objectContaining({ target: 'wood' }),
      }),
    );
    // Sau đó kích hoạt auto_mining
    expect(mocks.apiPost).toHaveBeenCalledWith('/api/accounts/1/automation/start', {
      mode: 'auto_mining',
    });
    expect(onChanged).toHaveBeenCalled();
  });
});
