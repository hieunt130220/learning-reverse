import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from '../../api.js';
import type {
  AutoConfigResponse,
  AutoFarmConfigDto,
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
  autoCook: true,
};

const fixedConfig = {
  maxSellsPerCycle: 0,
  autoBuy: true,
  buyBudgetXu: Number.MAX_SAFE_INTEGER,
  stepDelayMs: 700,
  intervalMs: 300_000,
};

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

function renderPanel(props: { accountId?: number; onDirty?: (dirty: boolean) => void } = {}) {
  return render(
    <AutoFarmPanel
      accountId={props.accountId ?? 1}
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
      autoHarvestCook: true,
      treeCellPlan: nextPlan,
      barnAnimalPlan: [],
      pondAnimalPlan: [],
      cookingSlotPlan: [],
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
  view.rerender(<AutoFarmPanel accountId={2} />);
  expect(await screen.findByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();

  resolveOldConfig({ revision: 1, config: { seedId: 11 } });
  resolveOldProfile(profileWithSeed(11, 'Hạt cũ'));
  await Promise.all([oldConfig, oldProfile]);

  expect(screen.getByRole('button', { name: /Hạt mới/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Hạt cũ/ })).not.toBeInTheDocument();
});
