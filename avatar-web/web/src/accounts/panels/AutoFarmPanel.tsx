import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, apiGet, apiPost, apiPut } from '../../api.js';
import type {
  AnimalPlanEntry,
  AutoConfigResponse,
  AutoConfigStateDto,
  AutoFarmConfigDto,
  AutoState,
  FarmProfileDto,
  ItemInfo,
  TreeCellPlanEntry,
} from '../../types.js';
import { BARN_ANIMAL_CATALOG, DEFAULT_ANIMAL_SLOTS, POND_ANIMAL_CATALOG } from '../animalPlan.js';
import { AnimalPlanEditor } from '../AnimalPlanEditor.js';
import { TreeCellPlanEditor } from '../TreeCellPlanEditor.js';

const EMPTY_PROFILE: FarmProfileDto = {
  farmId: null,
  cellIndices: [],
  barnAnimalSlots: [],
  pondAnimalSlots: [],
  seedCatalog: [],
  cellsObservedAt: null,
  seedsObservedAt: null,
  updatedAt: null,
};

const EMPTY_AUTO: AutoConfigStateDto = { revision: 0, config: {} };

function sortedPlan(entries: TreeCellPlanEntry[] | undefined): TreeCellPlanEntry[] {
  return [...(entries ?? [])].sort((left, right) => left.cellIndex - right.cellIndex);
}

function planKey(entries: TreeCellPlanEntry[] | undefined): string {
  return JSON.stringify(sortedPlan(entries));
}

function sortedAnimalPlan(entries: AnimalPlanEntry[] | undefined): AnimalPlanEntry[] {
  return [...(entries ?? [])].sort((left, right) => left.slotIndex - right.slotIndex);
}

function animalPlanKey(entries: AnimalPlanEntry[] | undefined): string {
  return JSON.stringify(sortedAnimalPlan(entries));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const AUTO_CONFIG_KEYS = new Set([
  'seedId', 'waterItemId', 'grassItemId', 'wormItemId', 'harvest', 'harvestAnimals',
  'harvestBarnAnimals', 'harvestPondAnimals', 'sellAnimals', 'sellBarnAnimals', 'sellPondAnimals',
  'sellWhenGrownSpecies', 'sellNearDeathSpecies', 'sellBarnSpecies', 'sellPondSpecies',
  'minGrowthToSell', 'nearDeathRatio', 'maxSellsPerCycle', 'feedAnimals', 'feedBarnAnimals',
  'feedPondAnimals', 'healAnimals', 'minHealth', 'fertilizeCells', 'minVitality', 'autoBuy',
  'buyBudgetXu', 'maxBuyPerItem', 'stepDelayMs', 'intervalMs', 'startDelayMs', 'treeCellPlan',
  'barnAnimalPlan', 'pondAnimalPlan',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === 'number' && Number.isInteger(item));
}

function isTreePlan(value: unknown): value is TreeCellPlanEntry[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!isRecord(entry)
      || typeof entry.cellIndex !== 'number'
      || !Number.isInteger(entry.cellIndex)
      || entry.cellIndex < 0) return false;
    if (entry.action === 'skip') return true;
    return entry.action === 'seed'
      && typeof entry.seedId === 'number'
      && Number.isInteger(entry.seedId)
      && entry.seedId >= 0;
  });
}

function isAnimalPlan(value: unknown): value is AnimalPlanEntry[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!isRecord(entry)
      || typeof entry.slotIndex !== 'number'
      || !Number.isInteger(entry.slotIndex)
      || entry.slotIndex < 0) return false;
    if (entry.action === 'skip') return true;
    return entry.action === 'breed'
      && typeof entry.speciesId === 'number'
      && Number.isInteger(entry.speciesId)
      && entry.speciesId >= 0;
  });
}

function isAutoConfig(value: unknown): value is Partial<AutoFarmConfigDto> {
  if (!isRecord(value) || Object.keys(value).some((key) => !AUTO_CONFIG_KEYS.has(key))) return false;
  const optionalNumberKeys = [
    'seedId', 'waterItemId', 'grassItemId', 'wormItemId', 'minGrowthToSell',
    'nearDeathRatio', 'maxSellsPerCycle', 'minHealth', 'minVitality', 'buyBudgetXu',
    'maxBuyPerItem', 'stepDelayMs', 'intervalMs', 'startDelayMs',
  ];
  const optionalBooleanKeys = [
    'harvest', 'harvestAnimals', 'harvestBarnAnimals', 'harvestPondAnimals',
    'sellAnimals', 'sellBarnAnimals', 'sellPondAnimals',
    'feedAnimals', 'feedBarnAnimals', 'feedPondAnimals',
    'healAnimals', 'fertilizeCells', 'autoBuy',
  ];
  return optionalNumberKeys.every((key) => value[key] === undefined || isFiniteNumber(value[key]))
    && optionalBooleanKeys.every((key) => value[key] === undefined || typeof value[key] === 'boolean')
    && (value.sellWhenGrownSpecies === undefined || isIntegerArray(value.sellWhenGrownSpecies))
    && (value.sellNearDeathSpecies === undefined || isIntegerArray(value.sellNearDeathSpecies))
    && (value.sellBarnSpecies === undefined || isIntegerArray(value.sellBarnSpecies))
    && (value.sellPondSpecies === undefined || isIntegerArray(value.sellPondSpecies))
    && (value.treeCellPlan === undefined || isTreePlan(value.treeCellPlan))
    && (value.barnAnimalPlan === undefined || isAnimalPlan(value.barnAnimalPlan))
    && (value.pondAnimalPlan === undefined || isAnimalPlan(value.pondAnimalPlan));
}

function isAutoConfigState(value: unknown): value is AutoConfigStateDto {
  if (!isRecord(value)) return false;
  return typeof value.revision === 'number'
    && Number.isInteger(value.revision)
    && value.revision >= 0
    && isAutoConfig(value.config);
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item))
    : [];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export interface AutoFarmPanelProps {
  accountId: number;
  auto: AutoState;
  items: ItemInfo[];
  onPlanDirtyChange?(dirty: boolean): void;
}

export function AutoFarmPanel({
  accountId,
  auto,
  items,
  onPlanDirtyChange,
}: AutoFarmPanelProps) {
  const [seedId, setSeedId] = useState('');
  // 123/124 đối chiếu khớp giữa bảng vật phẩm và kho; 100 là hằng số cứng trong
  // FarmScr.resetAction, chưa kiểm chứng nên để trống mặc định.
  const [waterItemId, setWaterItemId] = useState('100');
  const [grassItemId, setGrassItemId] = useState('123');
  const [wormItemId, setWormItemId] = useState('124');
  const [harvest, setHarvest] = useState(true);
  const [harvestBarnAnimals, setHarvestBarnAnimals] = useState(true);
  const [harvestPondAnimals, setHarvestPondAnimals] = useState(true);
  const [feedBarnAnimals, setFeedBarnAnimals] = useState(true);
  const [feedPondAnimals, setFeedPondAnimals] = useState(true);
  const [healAnimals, setHealAnimals] = useState(true);
  const [fertilizeCells, setFertilizeCells] = useState(true);
  // Bán là thao tác KHÔNG lấy lại được -> mặc định tắt, người dùng phải tự bật.
  const [sellBarnAnimals, setSellBarnAnimals] = useState(false);
  const [sellPondAnimals, setSellPondAnimals] = useState(false);
  // Chuồng: Gà 50, Bò 51, Heo 52, Vịt 55 / Hồ: Cá chép 54, Rùa 59
  const [sellBarnSpeciesStr, setSellBarnSpeciesStr] = useState('50, 51, 52, 55');
  const [sellPondSpeciesStr, setSellPondSpeciesStr] = useState('54, 59');
  const [maxSellsPerCycle, setMaxSellsPerCycle] = useState(0);
  const [autoBuy, setAutoBuy] = useState(false);
  const [buyBudgetXu, setBuyBudgetXu] = useState(5000);
  const [intervalSec, setIntervalSec] = useState(120);
  const [stepDelayMs, setStepDelayMs] = useState(700);

  const [storedState, setStoredState] = useState<AutoConfigStateDto>(EMPTY_AUTO);
  const [draftPlan, setDraftPlan] = useState<TreeCellPlanEntry[]>([]);
  const [draftBarnPlan, setDraftBarnPlan] = useState<AnimalPlanEntry[]>([]);
  const [draftPondPlan, setDraftPondPlan] = useState<AnimalPlanEntry[]>([]);
  const [profile, setProfile] = useState<FarmProfileDto>(EMPTY_PROFILE);
  const [configReady, setConfigReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [err, setErr] = useState('');
  const [configError, setConfigError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [planNotice, setPlanNotice] = useState('');
  const [planError, setPlanError] = useState('');
  const [conflict, setConflict] = useState<AutoConfigStateDto | null>(null);
  const requestGeneration = useRef(0);
  const currentAccountId = useRef(accountId);
  currentAccountId.current = accountId;

  const hydrateForm = useCallback((config: Partial<AutoFarmConfigDto>) => {
    const optionalId = (value: number | undefined, fallback = '') => (
      value === undefined ? fallback : String(value)
    );
    setSeedId(optionalId(config.seedId));
    setWaterItemId(optionalId(config.waterItemId, '100'));
    setGrassItemId(optionalId(config.grassItemId, '123'));
    setWormItemId(optionalId(config.wormItemId, '124'));
    setHarvest(config.harvest ?? true);
    setHarvestBarnAnimals(config.harvestBarnAnimals ?? config.harvestAnimals ?? true);
    setHarvestPondAnimals(config.harvestPondAnimals ?? config.harvestAnimals ?? true);
    setFeedBarnAnimals(config.feedBarnAnimals ?? config.feedAnimals ?? true);
    setFeedPondAnimals(config.feedPondAnimals ?? config.feedAnimals ?? true);
    setHealAnimals(config.healAnimals ?? true);
    setFertilizeCells(config.fertilizeCells ?? true);
    setSellBarnAnimals(config.sellBarnAnimals ?? config.sellAnimals ?? false);
    setSellPondAnimals(config.sellPondAnimals ?? config.sellAnimals ?? false);
    setSellBarnSpeciesStr(config.sellBarnSpecies?.join(', ') ?? '50, 51, 52, 55');
    setSellPondSpeciesStr(config.sellPondSpecies?.join(', ') ?? '54, 59');
    setMaxSellsPerCycle(config.maxSellsPerCycle ?? 0);
    setAutoBuy(config.autoBuy ?? false);
    setBuyBudgetXu(config.buyBudgetXu ?? 5000);
    setIntervalSec((config.intervalMs ?? 120_000) / 1000);
    setStepDelayMs(config.stepDelayMs ?? 700);
  }, []);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    let active = true;
    setConfigReady(false);
    setProfileLoading(true);
    setSaving(false);
    setRefreshing(false);
    setStarting(false);
    setStopping(false);
    setStoredState(EMPTY_AUTO);
    setDraftPlan([]);
    setProfile(EMPTY_PROFILE);
    hydrateForm({});
    setErr('');
    setConfigError('');
    setProfileError('');
    setPlanNotice('');
    setPlanError('');
    setConflict(null);

    const configRequest = apiGet<AutoConfigResponse>(`/api/accounts/${accountId}/auto/config`);
    const profileRequest = apiGet<FarmProfileDto>(`/api/accounts/${accountId}/farm/profile`);
    void configRequest.then((state) => {
      if (!active || requestGeneration.current !== generation) return;
      setStoredState({ revision: state.revision, config: state.config });
      setDraftPlan(sortedPlan(state.config.treeCellPlan));
      setDraftBarnPlan(sortedAnimalPlan(state.config.barnAnimalPlan));
      setDraftPondPlan(sortedAnimalPlan(state.config.pondAnimalPlan));
      hydrateForm(state.config);
      setConfigReady(true);
    }).catch((cause: unknown) => {
      if (!active || requestGeneration.current !== generation) return;
      setConfigError(`Không tải được cấu hình: ${errorMessage(cause)}`);
    });
    void profileRequest.then((nextProfile) => {
      if (!active || requestGeneration.current !== generation) return;
      setProfile(nextProfile);
    }).catch((cause: unknown) => {
      if (!active || requestGeneration.current !== generation) return;
      setProfileError(`Không tải được farm profile: ${errorMessage(cause)}`);
    }).finally(() => {
      if (active && requestGeneration.current === generation) setProfileLoading(false);
    });

    return () => {
      active = false;
    };
  }, [accountId, hydrateForm]);

  const num = (value: string) => (value.trim() === '' ? undefined : Number(value));
  /** "52, 54, 59" -> [52, 54, 59]. Bỏ phần rác thay vì gửi NaN lên server. */
  const idList = (value: string) =>
    value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id));

  const currentConfig = useMemo((): Partial<AutoFarmConfigDto> => ({
    seedId: num(seedId),
    waterItemId: num(waterItemId),
    grassItemId: num(grassItemId),
    wormItemId: num(wormItemId),
    harvest,
    harvestAnimals: harvestBarnAnimals || harvestPondAnimals,
    harvestBarnAnimals,
    harvestPondAnimals,
    feedAnimals: feedBarnAnimals || feedPondAnimals,
    feedBarnAnimals,
    feedPondAnimals,
    healAnimals,
    fertilizeCells,
    sellAnimals: sellBarnAnimals || sellPondAnimals,
    sellBarnAnimals,
    sellPondAnimals,
    sellBarnSpecies: idList(sellBarnSpeciesStr),
    sellPondSpecies: idList(sellPondSpeciesStr),
    sellWhenGrownSpecies: [...idList(sellBarnSpeciesStr), ...idList(sellPondSpeciesStr)],
    maxSellsPerCycle,
    autoBuy,
    buyBudgetXu,
    intervalMs: intervalSec * 1000,
    stepDelayMs,
    treeCellPlan: sortedPlan(draftPlan),
    barnAnimalPlan: sortedAnimalPlan(draftBarnPlan),
    pondAnimalPlan: sortedAnimalPlan(draftPondPlan),
  }), [
    seedId, waterItemId, grassItemId, wormItemId, harvest,
    harvestBarnAnimals, harvestPondAnimals, feedBarnAnimals, feedPondAnimals,
    healAnimals, fertilizeCells, sellBarnAnimals, sellPondAnimals,
    sellBarnSpeciesStr, sellPondSpeciesStr, maxSellsPerCycle, autoBuy,
    buyBudgetXu, intervalSec, stepDelayMs, draftPlan, draftBarnPlan, draftPondPlan,
  ]);

  // Chỉ so sánh các phần UI cho phép sửa: kế hoạch cây + vật nuôi (chuồng/hồ).
  // Các field không có control (minGrowthToSell, startDelayMs…) luôn khác nhau
  // giữa stored và currentConfig — so cả object là vỡ.
  const dirty = useMemo(
    () => planKey(draftPlan) !== planKey(storedState.config.treeCellPlan)
      || animalPlanKey(draftBarnPlan) !== animalPlanKey(storedState.config.barnAnimalPlan)
      || animalPlanKey(draftPondPlan) !== animalPlanKey(storedState.config.pondAnimalPlan),
    [draftPlan, draftBarnPlan, draftPondPlan, storedState.config],
  );
  const planDirtyRef = useRef(dirty);
  planDirtyRef.current = dirty;

  useEffect(() => {
    onPlanDirtyChange?.(dirty);
  }, [dirty, onPlanDirtyChange]);

  async function reloadStoredConfig(
    expectedGeneration: number,
    expectedAccountId: number,
  ) {
    if (requestGeneration.current !== expectedGeneration
      || currentAccountId.current !== expectedAccountId) return;
    const latest = await apiGet<AutoConfigResponse>(
      `/api/accounts/${expectedAccountId}/auto/config`,
    );
    if (requestGeneration.current !== expectedGeneration
      || currentAccountId.current !== expectedAccountId) return;
    setStoredState({ revision: latest.revision, config: latest.config });
    // Quyết định ở đúng lúc áp response: người dùng có thể tô plan sau POST hoặc
    // trong khi GET revision mới còn đang chờ.
    if (!planDirtyRef.current) {
      setDraftPlan(sortedPlan(latest.config.treeCellPlan));
      setDraftBarnPlan(sortedAnimalPlan(latest.config.barnAnimalPlan));
      setDraftPondPlan(sortedAnimalPlan(latest.config.pondAnimalPlan));
    }
    hydrateForm(latest.config);
  }

  async function start() {
    if (!configReady || starting) return;
    const generation = requestGeneration.current;
    const expectedAccountId = accountId;
    setStarting(true);
    setErr('');
    try {
      await apiPost(`/api/accounts/${expectedAccountId}/auto/start`, {
        seedId: num(seedId),
        waterItemId: num(waterItemId),
        grassItemId: num(grassItemId),
        wormItemId: num(wormItemId),
        harvest,
        harvestAnimals: harvestBarnAnimals || harvestPondAnimals,
        harvestBarnAnimals,
        harvestPondAnimals,
        feedAnimals: feedBarnAnimals || feedPondAnimals,
        feedBarnAnimals,
        feedPondAnimals,
        healAnimals,
        fertilizeCells,
        sellAnimals: sellBarnAnimals || sellPondAnimals,
        sellBarnAnimals,
        sellPondAnimals,
        sellBarnSpecies: idList(sellBarnSpeciesStr),
        sellPondSpecies: idList(sellPondSpeciesStr),
        sellWhenGrownSpecies: [...idList(sellBarnSpeciesStr), ...idList(sellPondSpeciesStr)],
        maxSellsPerCycle,
        autoBuy,
        buyBudgetXu,
        intervalMs: intervalSec * 1000,
        stepDelayMs,
      });
      // Legacy start có body làm revision tăng ở server. Tải lại revision nhưng
      // không đụng vào draft kế hoạch chưa lưu của người dùng.
      try {
        await reloadStoredConfig(generation, expectedAccountId);
      } catch (cause) {
        if (requestGeneration.current !== generation
          || currentAccountId.current !== expectedAccountId) return;
        setErr(`Đã bật auto nhưng chưa tải lại được cấu hình: ${errorMessage(cause)}`);
      }
    } catch (cause) {
      if (requestGeneration.current !== generation
        || currentAccountId.current !== expectedAccountId) return;
      setErr(errorMessage(cause));
    } finally {
      if (requestGeneration.current === generation
        && currentAccountId.current === expectedAccountId) setStarting(false);
    }
  }

  async function stop() {
    if (stopping) return;
    const generation = requestGeneration.current;
    const expectedAccountId = accountId;
    setStopping(true);
    setErr('');
    try {
      await apiPost(`/api/accounts/${expectedAccountId}/auto/stop`);
    } catch (cause) {
      if (requestGeneration.current !== generation
        || currentAccountId.current !== expectedAccountId) return;
      setErr(errorMessage(cause));
    } finally {
      if (requestGeneration.current === generation
        && currentAccountId.current === expectedAccountId) setStopping(false);
    }
  }

  async function refreshProfile() {
    const generation = requestGeneration.current;
    setRefreshing(true);
    setPlanError('');
    setProfileError('');
    try {
      const refreshed = await apiPost<FarmProfileDto>(
        `/api/accounts/${accountId}/farm/profile/refresh`,
      );
      if (requestGeneration.current !== generation) return;
      setProfile(refreshed);
      setProfileError('');
      setPlanNotice('Đã cập nhật cache farm và catalog hạt.');
    } catch (cause) {
      if (requestGeneration.current !== generation) return;
      setPlanError(errorMessage(cause));
    } finally {
      if (requestGeneration.current === generation) setRefreshing(false);
    }
  }

  async function savePlan() {
    const generation = requestGeneration.current;
    setSaving(true);
    setPlanError('');
    setPlanNotice('');
    setConflict(null);
    try {
      const saved = await apiPut<AutoConfigResponse>(`/api/accounts/${accountId}/auto/config`, {
        expectedRevision: storedState.revision,
        config: {
          ...storedState.config,
          treeCellPlan: sortedPlan(draftPlan),
          barnAnimalPlan: sortedAnimalPlan(draftBarnPlan),
          pondAnimalPlan: sortedAnimalPlan(draftPondPlan),
        },
      });
      if (requestGeneration.current !== generation) return;
      // `saved.config` có thể thiếu barn/pondAnimalPlan (server bỏ key rỗng) —
      // ghi nhớ cả bản vừa gửi để dirty so sánh khớp.
      const nextTreePlan = sortedPlan(saved.config.treeCellPlan);
      const nextBarnPlan = Array.isArray(saved.config.barnAnimalPlan)
        ? sortedAnimalPlan(saved.config.barnAnimalPlan)
        : sortedAnimalPlan(draftBarnPlan);
      const nextPondPlan = Array.isArray(saved.config.pondAnimalPlan)
        ? sortedAnimalPlan(saved.config.pondAnimalPlan)
        : sortedAnimalPlan(draftPondPlan);
      setDraftPlan(nextTreePlan);
      setDraftBarnPlan(nextBarnPlan);
      setDraftPondPlan(nextPondPlan);
      setStoredState({
        revision: saved.revision,
        config: {
          ...saved.config,
          treeCellPlan: nextTreePlan,
          barnAnimalPlan: nextBarnPlan,
          pondAnimalPlan: nextPondPlan,
        },
      });
      setPlanNotice(saved.application === 'next-cycle'
        ? 'Đã lưu kế hoạch; cấu hình sẽ áp dụng từ vòng kế tiếp.'
        : 'Đã lưu kế hoạch; cấu hình sẽ áp dụng ở lần bật tiếp theo.');
    } catch (cause) {
      if (requestGeneration.current !== generation) return;
      if (!(cause instanceof ApiError) || !isRecord(cause.body)) {
        setPlanError(errorMessage(cause));
        return;
      }
      const body = cause.body;
      if (cause.status === 409 && body.code === 'revision-conflict') {
        if (isAutoConfigState(body.current)) setConflict(body.current);
        setPlanError('Cấu hình trên máy chủ đã thay đổi. Draft local vẫn được giữ nguyên.');
        return;
      }
      if (cause.status === 409 && body.code === 'farm-profile-required') {
        setPlanError('Kết nối và đồng bộ farm trước khi lưu kế hoạch. Draft vẫn được giữ nguyên.');
        return;
      }
      if (cause.status === 409 && body.code === 'seed-catalog-required') {
        setPlanError('Catalog hạt cần được đồng bộ lại. Hãy kết nối và đồng bộ farm; draft vẫn được giữ nguyên.');
        return;
      }
      if (cause.status === 400 && body.code === 'invalid-tree-cell-plan') {
        const invalidCells = numberArray(body.invalidCellIndices);
        const invalidSeeds = numberArray(body.invalidSeedIds);
        setPlanError([
          'Kế hoạch không còn khớp farm hiện tại.',
          invalidCells.length > 0 ? `Ô không hợp lệ: ${invalidCells.join(', ')}.` : '',
          invalidSeeds.length > 0 ? `Hạt không hợp lệ: ${invalidSeeds.join(', ')}.` : '',
          'Draft vẫn được giữ nguyên.',
        ].filter(Boolean).join(' '));
        return;
      }
      setPlanError(cause.message);
    } finally {
      if (requestGeneration.current === generation) setSaving(false);
    }
  }

  function loadConflict() {
    if (conflict === null) return;
    setStoredState(conflict);
    setDraftPlan(sortedPlan(conflict.config.treeCellPlan));
    setDraftBarnPlan(sortedAnimalPlan(conflict.config.barnAnimalPlan));
    setDraftPondPlan(sortedAnimalPlan(conflict.config.pondAnimalPlan));
    hydrateForm(conflict.config);
    setConflict(null);
    setPlanError('');
    setPlanNotice('Đã tải bản cấu hình mới nhất từ máy chủ.');
  }

  const barnAnimalSlots = useMemo(
    () => (profile.barnAnimalSlots?.length > 0 ? profile.barnAnimalSlots : DEFAULT_ANIMAL_SLOTS),
    [profile.barnAnimalSlots],
  );
  const pondAnimalSlots = useMemo(
    () => (profile.pondAnimalSlots?.length > 0 ? profile.pondAnimalSlots : [0, 1, 2, 3]),
    [profile.pondAnimalSlots],
  );

  return (
    <section className="card">
      <h2>Tự động chăm sóc</h2>
      <p className="hint">
        Mỗi chu kỳ xin lại dữ liệu farm rồi hành động theo trạng thái thật của từng ô. Ô nào để trống
        thì việc đó bị tắt. <b>100</b> (tưới) và <b>123</b> (nhổ cỏ) đã kiểm chứng bằng gói thật;{' '}
        <b>124</b> (bắt sâu) mới suy từ tên vật phẩm, chưa thử được.
      </p>
      <p className="hint">
        Bật ở đây là ghi vào cơ sở dữ liệu: server tự bật lại tài khoản này sau khi khởi động lại,
        không cần mở trình duyệt.
      </p>
      {/* KHỐI 1: CÂY TRỒNG */}
      <div className="setting-section">
        <h3>🌱 Cây trồng</h3>
        <div className="row">
          <label className="inline">
            id hạt trồng lại
            <input value={seedId} onChange={(event) => setSeedId(event.target.value)} placeholder="tắt" />
          </label>
          <label className="inline">
            id tưới nước
            <input value={waterItemId} onChange={(event) => setWaterItemId(event.target.value)} placeholder="tắt" />
          </label>
        </div>
        <div className="row">
          <label className="inline">
            id thuốc cỏ
            <input value={grassItemId} onChange={(event) => setGrassItemId(event.target.value)} placeholder="tắt" />
          </label>
          <label className="inline">
            id thuốc sâu
            <input value={wormItemId} onChange={(event) => setWormItemId(event.target.value)} placeholder="tắt" />
          </label>
        </div>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={harvest} onChange={(event) => setHarvest(event.target.checked)} style={{ width: 'auto' }} />
            thu hoạch ô đã chín
          </label>
          <label className="inline">
            <input type="checkbox" checked={fertilizeCells} onChange={(event) => setFertilizeCells(event.target.checked)} style={{ width: 'auto' }} />
            bón phân khi sức sống &lt; 100
          </label>
        </div>
      </div>

      {/* KHỐI 2: VẬT NUÔI CHUỒNG */}
      <div className="setting-section">
        <h3>🐓 Vật nuôi chuồng (Gà, Vịt, Bò, Heo, Cừu, Trâu, Dê, Thỏ...)</h3>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={harvestBarnAnimals} onChange={(event) => setHarvestBarnAnimals(event.target.checked)} style={{ width: 'auto' }} />
            thu hoạch sản phẩm chuồng (trứng/sữa/lông)
          </label>
          <label className="inline">
            <input type="checkbox" checked={feedBarnAnimals} onChange={(event) => setFeedBarnAnimals(event.target.checked)} style={{ width: 'auto' }} />
            cho vật nuôi chuồng ăn (thức ăn Gia cầm/Gia súc)
          </label>
          <label className="inline">
            <input type="checkbox" checked={healAnimals} onChange={(event) => setHealAnimals(event.target.checked)} style={{ width: 'auto' }} />
            thuốc bổ khi máu &lt; 100
          </label>
        </div>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={sellBarnAnimals} onChange={(event) => setSellBarnAnimals(event.target.checked)} style={{ width: 'auto' }} />
            bán vật nuôi chuồng khi lớn
          </label>
          <label className="inline">
            loài bán chuồng
            <input value={sellBarnSpeciesStr} onChange={(event) => setSellBarnSpeciesStr(event.target.value)} placeholder="không bán" disabled={!sellBarnAnimals} />
          </label>
        </div>
        <AnimalPlanEditor
          title="Kế hoạch vật nuôi chuồng theo slot"
          catalog={BARN_ANIMAL_CATALOG}
          slotIndices={barnAnimalSlots}
          observedAt={profile.cellsObservedAt}
          hasCache={(profile.barnAnimalSlots?.length ?? 0) > 0}
          entries={draftBarnPlan}
          disabled={!configReady || saving}
          onChange={(entries) => {
            setDraftBarnPlan(sortedAnimalPlan(entries));
            setPlanNotice('');
            setPlanError('');
            setConflict(null);
          }}
        />
      </div>

      {/* KHỐI 3: VẬT NUÔI HỒ */}
      <div className="setting-section">
        <h3>🐟 Vật nuôi hồ (Cá chép, Rùa)</h3>
        <div className="row">
          <label className="inline">
            <input type="checkbox" checked={harvestPondAnimals} onChange={(event) => setHarvestPondAnimals(event.target.checked)} style={{ width: 'auto' }} />
            thu hoạch sản phẩm hồ
          </label>
          <label className="inline">
            <input type="checkbox" checked={feedPondAnimals} onChange={(event) => setFeedPondAnimals(event.target.checked)} style={{ width: 'auto' }} />
            cho cá/rùa ăn (thức ăn Thủy sản)
          </label>
          <label className="inline">
            <input type="checkbox" checked={sellPondAnimals} onChange={(event) => setSellPondAnimals(event.target.checked)} style={{ width: 'auto' }} />
            bán cá/rùa khi lớn
          </label>
          <label className="inline">
            loài bán hồ
            <input value={sellPondSpeciesStr} onChange={(event) => setSellPondSpeciesStr(event.target.value)} placeholder="54, 59" disabled={!sellPondAnimals} />
          </label>
        </div>
        <AnimalPlanEditor
          title="Kế hoạch vật nuôi hồ theo slot"
          catalog={POND_ANIMAL_CATALOG}
          slotIndices={pondAnimalSlots}
          observedAt={profile.cellsObservedAt}
          hasCache={(profile.pondAnimalSlots?.length ?? 0) > 0}
          entries={draftPondPlan}
          disabled={!configReady || saving}
          onChange={(entries) => {
            setDraftPondPlan(sortedAnimalPlan(entries));
            setPlanNotice('');
            setPlanError('');
            setConflict(null);
          }}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="inline">
          trần bán/vòng (0 = không giới hạn)
          <input type="number" value={maxSellsPerCycle} onChange={(event) => setMaxSellsPerCycle(Number(event.target.value))} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={autoBuy} onChange={(event) => setAutoBuy(event.target.checked)} style={{ width: 'auto' }} />
          tự mua khi thiếu (chỉ bằng xu)
        </label>
        <label className="inline">
          trần chi/vòng (xu)
          <input type="number" value={buyBudgetXu} onChange={(event) => setBuyBudgetXu(Number(event.target.value))} />
        </label>
        <label className="inline">
          chu kỳ (giây)
          <input type="number" value={intervalSec} onChange={(event) => setIntervalSec(Number(event.target.value))} />
        </label>
        <label className="inline">
          nghỉ giữa lệnh (ms)
          <input type="number" value={stepDelayMs} onChange={(event) => setStepDelayMs(Number(event.target.value))} />
        </label>
      </div>

      <TreeCellPlanEditor
        profile={profile}
        entries={draftPlan}
        disabled={!configReady || saving}
        refreshing={refreshing}
        onChange={(entries) => {
          setDraftPlan(sortedPlan(entries));
          setPlanNotice('');
          setPlanError('');
          setConflict(null);
        }}
        onRefresh={() => void refreshProfile()}
      />
      <div className="row tree-plan-save-row">
        <button type="button" onClick={() => void savePlan()} disabled={!configReady || saving || !dirty}>
          {saving ? 'Đang lưu…' : 'Lưu kế hoạch'}
        </button>
        {conflict && (
          <button type="button" className="ghost" onClick={loadConflict}>Tải bản máy chủ</button>
        )}
        {dirty && <span className="hint">có thay đổi chưa lưu</span>}
      </div>
      {planNotice && <p className="hint">{planNotice}</p>}
      {planError && <p className="err">{planError}</p>}
      {configError && <p className="err">{configError}</p>}
      {profileError && <p className="err">{profileError}</p>}
      {profileLoading && <p className="hint">đang tải farm profile…</p>}

      <div className="row">
        <button onClick={() => void start()} disabled={auto.running || !configReady || starting}>
          {starting ? 'Đang bật…' : 'Bật'}
        </button>
        <button className="ghost" onClick={() => void stop()} disabled={!auto.running || stopping}>
          {stopping ? 'Đang tắt…' : 'Tắt'}
        </button>
        <span className="hint">
          {auto.running ? `đang chạy — vòng ${auto.cycle}` : 'đang tắt'}
          {auto.lastRun ? ` · lần cuối ${new Date(auto.lastRun).toLocaleTimeString()}` : ''}
        </span>
      </div>
      {auto.lastActions.length > 0 && (
        <div className="log" style={{ maxHeight: 120 }}>
          {auto.lastActions.map((action, index) => <div key={index}>{action}</div>)}
        </div>
      )}
      {items.length > 0 && (
        <p className="hint">vật phẩm: {items.map((item) => `${item.name} ${item.price}xu`).join(' · ')}</p>
      )}
      {(err || auto.lastError) && <p className="err">{err || auto.lastError}</p>}
    </section>
  );
}
