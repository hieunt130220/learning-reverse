import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../api.js';
import type {
  AutoConfigResponse,
  AutoFarmConfigDto,
  AutoState,
  FarmProfileDto,
} from '../../types.js';
import { AutoFarmPanel } from './AutoFarmPanel.js';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api.js')>();
  return {
    ...actual,
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiPut: mocks.apiPut,
  };
});

const stoppedAuto: AutoState = { running: false, cycle: 0, lastActions: [] };
const completeProfile: FarmProfileDto = {
  farmId: 12,
  cellIndices: [2, 7],
  barnAnimalSlots: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  pondAnimalSlots: [0, 1, 2, 3],
  seedCatalog: [{ id: 6, name: 'Hoa hồng', growMinutes: 30, value: 20 }],
  cellsObservedAt: 1_700_000_000_000,
  seedsObservedAt: 1_700_000_010_000,
  updatedAt: 1_700_000_010_000,
};

const storedConfig: Partial<AutoFarmConfigDto> = {
  seedId: 6,
  waterItemId: 101,
  grassItemId: 125,
  wormItemId: 126,
  harvest: false,
  harvestAnimals: false,
  harvestBarnAnimals: false,
  harvestPondAnimals: false,
  feedAnimals: false,
  feedBarnAnimals: false,
  feedPondAnimals: false,
  healAnimals: false,
  fertilizeCells: false,
  sellAnimals: true,
  sellBarnAnimals: true,
  sellBarnSpecies: [50, 51],
  sellPondAnimals: true,
  sellPondSpecies: [54, 59],
  sellWhenGrownSpecies: [50, 51, 54, 59],
  sellNearDeathSpecies: [52],
  minGrowthToSell: 90,
  nearDeathRatio: 0.1,
  maxSellsPerCycle: 8,
  autoBuy: true,
  buyBudgetXu: 9_000,
  maxBuyPerItem: 4,
  stepDelayMs: 450,
  intervalMs: 150_000,
  startDelayMs: 2_500,
  treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  barnAnimalPlan: [],
  pondAnimalPlan: [],
};

const alwaysOnConfig = {
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
};

const fixedConfig = {
  maxSellsPerCycle: 0,
  autoBuy: true,
  buyBudgetXu: Number.MAX_SAFE_INTEGER,
  stepDelayMs: 700,
  intervalMs: 300_000,
};

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => {
    throw new Error('deferred chưa khởi tạo');
  };
  let rejectPromise: (reason: unknown) => void = () => {
    throw new Error('deferred chưa khởi tạo');
  };
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function profileWithSeed(id: number, name: string, cellIndices = [2, 7]): FarmProfileDto {
  return {
    ...completeProfile,
    cellIndices,
    seedCatalog: [{ id, name, growMinutes: 30, value: 20 }],
  };
}

function installGets(
  config: AutoConfigResponse = { revision: 4, config: storedConfig },
  profile: FarmProfileDto = completeProfile,
) {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path.endsWith('/auto/config')) return Promise.resolve(config);
    if (path.endsWith('/farm/profile')) return Promise.resolve(profile);
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
}

function renderPanel(props: { accountId?: number; auto?: AutoState; onDirty?: (dirty: boolean) => void } = {}) {
  return render(
    <AutoFarmPanel
      accountId={props.accountId ?? 1}
      auto={props.auto ?? stoppedAuto}
      onPlanDirtyChange={props.onDirty}
    />,
  );
}

async function openPlanEditor() {
  const summary = await screen.findByText(/Kế hoạch cây theo ô/i);
  if (summary.closest('summary')) await userEvent.click(summary);
}

async function paintSkip(cellIndex: number) {
  await openPlanEditor();
  await userEvent.click(screen.getByRole('button', { name: /^⛔ Không trồng$/i }));
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`Ô ${cellIndex}(?:\\D|$)`, 'i') }));
}

beforeEach(() => {
  installGets();
  mocks.apiPost.mockResolvedValue({});
  mocks.apiPut.mockResolvedValue({ revision: 5, config: storedConfig, application: 'next-start' });
});

test('hydrate các control còn lại từ config đã lưu; control đã bỏ không hiển thị', async () => {
  renderPanel();

  await waitFor(() => expect(screen.getByRole('checkbox', { name: /bán vật nuôi chuồng khi lớn/ })).toBeChecked());
  expect(screen.getByLabelText('loài bán chuồng')).toHaveValue('50, 51');
  expect(screen.getByRole('checkbox', { name: /bán cá\/rùa khi lớn/ })).toBeChecked();
  expect(screen.getByLabelText('loài bán hồ')).toHaveValue('54, 59');

  // Các setup đã bỏ theo yêu cầu: không còn control nào trong UI.
  expect(screen.queryByLabelText('chu kỳ (giây)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('id hạt trồng lại')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('id tưới nước')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('id thuốc cỏ')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('id thuốc sâu')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/trần bán\/vòng/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/tự mua khi thiếu/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('trần chi/vòng (xu)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('nghỉ giữa lệnh (ms)')).not.toBeInTheDocument();
});

test('config thành công vẫn hydrate và Bật đúng stored values khi profile lỗi độc lập', async () => {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path.endsWith('/auto/config')) {
      return Promise.resolve({ revision: 4, config: storedConfig });
    }
    if (path.endsWith('/farm/profile')) return Promise.reject(new Error('profile tạm lỗi'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  renderPanel();

  await waitFor(() => expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled());
  expect(await screen.findByText(/Không tải được farm profile.*profile tạm lỗi/i)).toBeInTheDocument();
  const startButton = screen.getByRole('button', { name: 'Bật' });
  expect(startButton).toBeEnabled();
  await userEvent.click(startButton);

  await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith('/api/accounts/1/auto/start', {
    seedId: 6,
    ...alwaysOnConfig,
    sellAnimals: true,
    sellBarnAnimals: true,
    sellBarnSpecies: [50, 51],
    sellPondAnimals: true,
    sellPondSpecies: [54, 59],
    sellWhenGrownSpecies: [50, 51, 54, 59],
    ...fixedConfig,
  }));
});

test('config pending khóa Bật dù profile đã xong và không gửi hard-coded defaults', async () => {
  const pendingConfig = deferred<AutoConfigResponse>();
  mocks.apiGet.mockImplementation((path: string) => {
    if (path.endsWith('/auto/config')) return pendingConfig.promise;
    if (path.endsWith('/farm/profile')) return Promise.resolve(completeProfile);
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  renderPanel();

  await waitFor(() => {
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/accounts/1/auto/config');
    expect(mocks.apiGet).toHaveBeenCalledWith('/api/accounts/1/farm/profile');
  });
  const startButton = screen.getByRole('button', { name: 'Bật' });
  expect(startButton).toBeDisabled();
  await userEvent.click(startButton);
  expect(mocks.apiPost).not.toHaveBeenCalled();

  pendingConfig.resolve({ revision: 4, config: storedConfig });
  await waitFor(() => expect(startButton).toBeEnabled());
});

test('config lỗi giữ Bật bị khóa và không bao giờ POST defaults hiển thị tạm', async () => {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path.endsWith('/auto/config')) return Promise.reject(new Error('config không tải được'));
    if (path.endsWith('/farm/profile')) return Promise.resolve(completeProfile);
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  renderPanel();

  expect(await screen.findByText(/Không tải được cấu hình.*config không tải được/i)).toBeInTheDocument();
  const startButton = screen.getByRole('button', { name: 'Bật' });
  expect(startButton).toBeDisabled();
  await userEvent.click(startButton);
  expect(mocks.apiPost).not.toHaveBeenCalled();
});

test('lưu gửi đúng full stored config cùng plan mới và báo áp dụng vòng kế tiếp', async () => {
  const onDirty = vi.fn();
  renderPanel({ onDirty });
  await paintSkip(7);
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(true));

  const nextPlan = [
    { cellIndex: 2, action: 'skip' as const },
    { cellIndex: 7, action: 'skip' as const },
  ];
  mocks.apiPut.mockResolvedValueOnce({
    revision: 5,
    config: {
      ...storedConfig,
      treeCellPlan: nextPlan,
    },
    application: 'next-cycle',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));

  await waitFor(() => expect(mocks.apiPut).toHaveBeenCalledWith('/api/accounts/1/auto/config', {
    expectedRevision: 4,
    config: {
      ...storedConfig,
      ...alwaysOnConfig,
      ...fixedConfig,
      treeCellPlan: nextPlan,
      barnAnimalPlan: [],
      pondAnimalPlan: [],
    },
  }));
  expect(await screen.findByText(/vòng kế tiếp/i)).toBeInTheDocument();
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false));
});

test('revision conflict giữ draft local và chỉ tải current khi người dùng chọn', async () => {
  const onDirty = vi.fn();
  renderPanel({ onDirty });
  await paintSkip(7);
  const current = {
    revision: 9,
    config: { ...storedConfig, seedId: 11, treeCellPlan: [{ cellIndex: 7, action: 'seed' as const, seedId: 6 }] },
  };
  mocks.apiPut.mockRejectedValueOnce(new ApiError(409, 'xung đột', {
    error: 'xung đột',
    code: 'revision-conflict',
    current,
  }));

  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));
  expect(await screen.findByRole('button', { name: 'Tải bản máy chủ' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument();
  expect(onDirty).toHaveBeenLastCalledWith(true);

  await userEvent.click(screen.getByRole('button', { name: 'Tải bản máy chủ' }));
  expect(await screen.findByRole('button', { name: /Ô 7.*Hoa hồng/i })).toBeInTheDocument();
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(false));
});

test('revision conflict có current sai shape không cho nạp dữ liệu chưa narrow', async () => {
  renderPanel();
  await paintSkip(7);
  mocks.apiPut.mockRejectedValueOnce(new ApiError(409, 'xung đột', {
    error: 'xung đột',
    code: 'revision-conflict',
    current: { revision: 9, config: { treeCellPlan: 'không-phải-mảng' } },
  }));

  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));

  expect(await screen.findByText(/Draft local vẫn được giữ nguyên/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tải bản máy chủ' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument();
});

test.each([
  ['farm-profile-required', /Kết nối và đồng bộ farm/i],
  ['seed-catalog-required', /catalog hạt/i],
] as const)('lỗi %s giữ draft và hiện hướng dẫn đúng', async (code, guidance) => {
  const onDirty = vi.fn();
  renderPanel({ onDirty });
  await paintSkip(7);
  mocks.apiPut.mockRejectedValueOnce(new ApiError(409, 'cần đồng bộ', {
    error: 'cần đồng bộ',
    code,
  }));

  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));

  expect((await screen.findAllByText(guidance)).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument();
  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole('button', { name: 'Tải bản máy chủ' })).not.toBeInTheDocument();
});

test('400 invalid plan hiện đúng cell/seed sai và không xoá draft', async () => {
  renderPanel();
  await paintSkip(7);
  mocks.apiPut.mockRejectedValueOnce(new ApiError(400, 'kế hoạch không hợp lệ', {
    error: 'kế hoạch không hợp lệ',
    code: 'invalid-tree-cell-plan',
    invalidCellIndices: [99],
    invalidSeedIds: [77],
  }));

  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));

  expect(await screen.findByText(/99/)).toBeInTheDocument();
  expect(screen.getByText(/77/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument();
});

test('Bật gửi legacy form patch không kèm plan; Tắt không gửi config', async () => {
  const view = renderPanel();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Bật' }));
  await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith(
    '/api/accounts/1/auto/start',
    expect.not.objectContaining({ treeCellPlan: expect.anything() }),
  ));

  mocks.apiPost.mockClear();
  view.rerender(<AutoFarmPanel accountId={1} auto={{ ...stoppedAuto, running: true }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Tắt' }));
  expect(mocks.apiPost).toHaveBeenCalledWith('/api/accounts/1/auto/stop');
});

test('response muộn của account cũ không ghi đè account mới', async () => {
  let resolveOldConfig!: (value: AutoConfigResponse) => void;
  let resolveOldProfile!: (value: FarmProfileDto) => void;
  const oldConfig = new Promise<AutoConfigResponse>((resolve) => { resolveOldConfig = resolve; });
  const oldProfile = new Promise<FarmProfileDto>((resolve) => { resolveOldProfile = resolve; });
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') return oldConfig;
    if (path === '/api/accounts/1/farm/profile') return oldProfile;
    if (path === '/api/accounts/2/auto/config') return Promise.resolve({ revision: 2, config: { seedId: 22 } });
    if (path === '/api/accounts/2/farm/profile') return Promise.resolve(profileWithSeed(22, 'Hạt mới'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  const view = renderPanel({ accountId: 1 });
  view.rerender(<AutoFarmPanel accountId={2} auto={stoppedAuto} />);
  expect(await screen.findByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();

  resolveOldConfig({ revision: 1, config: { seedId: 11 } });
  resolveOldProfile(profileWithSeed(11, 'Hạt cũ'));
  await Promise.all([oldConfig, oldProfile]);

  expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Hạt cũ/ })).not.toBeInTheDocument();
});

test('đổi account khi start đang chờ không GET account cũ dưới generation mới hoặc ghi lỗi lên account mới', async () => {
  const oldStart = deferred<unknown>();
  mocks.apiPost.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/start') return oldStart.promise;
    return Promise.resolve({});
  });
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') return Promise.resolve({ revision: 1, config: { seedId: 11 } });
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(profileWithSeed(11, 'Hạt cũ'));
    if (path === '/api/accounts/2/auto/config') return Promise.resolve({ revision: 2, config: { seedId: 22 } });
    if (path === '/api/accounts/2/farm/profile') return Promise.resolve(profileWithSeed(22, 'Hạt mới'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  const view = renderPanel({ accountId: 1 });
  await openPlanEditor();
  await waitFor(() => expect(screen.getByRole('button', { name: /Hạt cũ/ })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Bật' }));
  await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith(
    '/api/accounts/1/auto/start',
    expect.objectContaining({ seedId: 11 }),
  ));

  view.rerender(<AutoFarmPanel accountId={2} auto={stoppedAuto} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Đang bật…' })).not.toBeInTheDocument();
  oldStart.resolve({});
  await oldStart.promise;
  await Promise.resolve();

  expect(mocks.apiGet.mock.calls.filter(([path]) => path === '/api/accounts/1/auto/config')).toHaveLength(1);
  expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();
  expect(screen.queryByText(/Đã bật auto nhưng/i)).not.toBeInTheDocument();
});

test('plan tô trong lúc start pending không bị GET config sau start ghi đè', async () => {
  const pendingStart = deferred<unknown>();
  const bumpedConfig = deferred<AutoConfigResponse>();
  let configReads = 0;
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') {
      configReads += 1;
      return configReads === 1
        ? Promise.resolve({ revision: 4, config: { ...storedConfig, treeCellPlan: [] } })
        : bumpedConfig.promise;
    }
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(completeProfile);
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  mocks.apiPost.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/start') return pendingStart.promise;
    return Promise.resolve({});
  });
  const onDirty = vi.fn();
  renderPanel({ onDirty });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Bật' }));

  await paintSkip(7);
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(true));
  expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument();

  pendingStart.resolve({});
  await pendingStart.promise;
  await waitFor(() => expect(configReads).toBe(2));
  bumpedConfig.resolve({ revision: 5, config: { ...storedConfig, treeCellPlan: [] } });
  await bumpedConfig.promise;

  await waitFor(() => expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument());
  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Lưu kế hoạch' })).toBeEnabled();
});

test('plan tô trong lúc follow-up GET pending không bị response config ghi đè', async () => {
  const pendingStart = deferred<unknown>();
  const pendingReload = deferred<AutoConfigResponse>();
  let configReads = 0;
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') {
      configReads += 1;
      return configReads === 1
        ? Promise.resolve({ revision: 4, config: { ...storedConfig, treeCellPlan: [] } })
        : pendingReload.promise;
    }
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(completeProfile);
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  mocks.apiPost.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/start') return pendingStart.promise;
    return Promise.resolve({});
  });
  const onDirty = vi.fn();
  renderPanel({ onDirty });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Bật' }));

  pendingStart.resolve({});
  await pendingStart.promise;
  await waitFor(() => expect(configReads).toBe(2));
  await paintSkip(7);
  await waitFor(() => expect(onDirty).toHaveBeenLastCalledWith(true));

  pendingReload.resolve({ revision: 5, config: { ...storedConfig, treeCellPlan: [] } });
  await pendingReload.promise;

  await waitFor(() => expect(screen.getByRole('button', { name: /Ô 7.*Không trồng/i })).toBeInTheDocument());
  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Lưu kế hoạch' })).toBeEnabled();
});

test('đổi account bỏ qua lỗi stop muộn của account cũ', async () => {
  const oldStop = deferred<unknown>();
  mocks.apiPost.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/stop') return oldStop.promise;
    return Promise.resolve({});
  });
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') return Promise.resolve({ revision: 1, config: { seedId: 11 } });
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(profileWithSeed(11, 'Hạt cũ'));
    if (path === '/api/accounts/2/auto/config') return Promise.resolve({ revision: 2, config: { seedId: 22 } });
    if (path === '/api/accounts/2/farm/profile') return Promise.resolve(profileWithSeed(22, 'Hạt mới'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  const runningAuto: AutoState = { ...stoppedAuto, running: true };
  const view = renderPanel({ accountId: 1, auto: runningAuto });
  await openPlanEditor();
  await waitFor(() => expect(screen.getByRole('button', { name: /Hạt cũ/ })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Tắt' }));

  view.rerender(<AutoFarmPanel accountId={2} auto={runningAuto} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument());
  oldStop.reject(new Error('stop account cũ lỗi'));
  await oldStop.promise.catch(() => undefined);
  await Promise.resolve();

  expect(screen.queryByText('stop account cũ lỗi')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();
});

test('đổi account reset trạng thái save pending; response cũ không làm bẩn account mới', async () => {
  const oldSave = deferred<AutoConfigResponse>();
  mocks.apiPut.mockReturnValue(oldSave.promise);
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') return Promise.resolve({ revision: 1, config: { treeCellPlan: [] } });
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(completeProfile);
    if (path === '/api/accounts/2/auto/config') return Promise.resolve({ revision: 2, config: { treeCellPlan: [] } });
    if (path === '/api/accounts/2/farm/profile') return Promise.resolve(profileWithSeed(22, 'Hạt mới'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  const view = renderPanel({ accountId: 1 });
  await paintSkip(2);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }));
  expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();

  view.rerender(<AutoFarmPanel accountId={2} auto={stoppedAuto} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Bật' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Đang lưu…' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Lưu kế hoạch' })).toBeDisabled();

  oldSave.resolve({ revision: 9, config: { treeCellPlan: [{ cellIndex: 2, action: 'skip' }] } });
  await oldSave.promise;
  await Promise.resolve();
  expect(screen.getByRole('button', { name: /Ô 2.*Mặc định/i })).toBeInTheDocument();
});

test('đổi account reset form và hiển thị profile mới', async () => {
  mocks.apiGet.mockImplementation((path: string) => {
    if (path === '/api/accounts/1/auto/config') return Promise.resolve({ revision: 1, config: {} });
    if (path === '/api/accounts/1/farm/profile') return Promise.resolve(profileWithSeed(11, 'Hạt cũ'));
    if (path === '/api/accounts/2/auto/config') return Promise.resolve({ revision: 2, config: {} });
    if (path === '/api/accounts/2/farm/profile') return Promise.resolve(profileWithSeed(22, 'Hạt mới'));
    throw new Error(`GET ngoài dự kiến: ${path}`);
  });
  const view = renderPanel({ accountId: 1 });
  await openPlanEditor();

  view.rerender(<AutoFarmPanel accountId={2} auto={stoppedAuto} />);
  expect(await screen.findByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Hạt cũ/ })).not.toBeInTheDocument();
});
