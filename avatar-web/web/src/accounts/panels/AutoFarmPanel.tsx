import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, apiGet, apiPut } from '../../api.js';
import type {
  AnimalPlanEntry,
  AutoConfigResponse,
  AutoConfigStateDto,
  AutoFarmConfigDto,
  FarmProfileDto,
  KitchenPlanEntry,
  TreeCellPlanEntry,
} from '../../types.js';
import type { FoodRecipe } from '../../types.js';
import { BARN_ANIMAL_CATALOG, DEFAULT_BARN_ANIMAL_SLOTS, DEFAULT_POND_ANIMAL_SLOTS, POND_ANIMAL_CATALOG } from '../animalPlan.js';
import { AnimalPlanEditor } from '../AnimalPlanEditor.js';
import { KitchenPlanEditor } from '../KitchenPlanEditor.js';
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

const ALWAYS_ON_AUTO_CONFIG = {
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  sellAnimals: true,
  sellBarnAnimals: true,
  sellPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
  autoCook: true,
} satisfies Partial<AutoFarmConfigDto>;

const FIXED_AUTO_CONFIG = {
  maxSellsPerCycle: 0,
  autoBuy: true,
  buyBudgetXu: Number.MAX_SAFE_INTEGER,
  stepDelayMs: 700,
  intervalMs: 300_000,
} satisfies Partial<AutoFarmConfigDto>;

function sortedPlan(entries: TreeCellPlanEntry[] | undefined): TreeCellPlanEntry[] {
  return [...(entries ?? [])].sort((left, right) => left.cellIndex - right.cellIndex);
}

function planKey(entries: TreeCellPlanEntry[] | undefined): string {
  return JSON.stringify(sortedPlan(entries));
}

function animalPlanKey(entries: AnimalPlanEntry[] | undefined): string {
  return JSON.stringify(sortedAnimalPlan(entries));
}

function sortedAnimalPlan(entries: AnimalPlanEntry[] | undefined): AnimalPlanEntry[] {
  return [...(entries ?? [])].sort((left, right) => left.slotIndex - right.slotIndex);
}

function sortedKitchenPlan(entries: KitchenPlanEntry[] | undefined): KitchenPlanEntry[] {
  return [...(entries ?? [])].sort((left, right) => left.slotIndex - right.slotIndex);
}

function kitchenPlanKey(entries: KitchenPlanEntry[] | undefined): string {
  return JSON.stringify(sortedKitchenPlan(entries));
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
  'barnAnimalPlan', 'pondAnimalPlan', 'cookingSlotPlan', 'autoCook', 'autoHarvestCook',
  'prioritizeCookingMissions', 'defaultRecipeId', 'autoClaimDailyQuests', 'logoutAfterCycle',
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

function isKitchenPlan(value: unknown): value is KitchenPlanEntry[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!isRecord(entry)
      || typeof entry.slotIndex !== 'number'
      || !Number.isInteger(entry.slotIndex)
      || entry.slotIndex < 0) return false;
    if (entry.action === 'skip') return true;
    return entry.action === 'cook'
      && typeof entry.recipeId === 'number'
      && Number.isInteger(entry.recipeId)
      && entry.recipeId >= 0;
  });
}

function isAutoConfig(value: unknown): value is Partial<AutoFarmConfigDto> {
  if (!isRecord(value) || Object.keys(value).some((key) => !AUTO_CONFIG_KEYS.has(key))) return false;
  const optionalNumberKeys = [
    'seedId', 'waterItemId', 'grassItemId', 'wormItemId', 'minGrowthToSell',
    'nearDeathRatio', 'maxSellsPerCycle', 'minHealth', 'minVitality', 'buyBudgetXu',
    'maxBuyPerItem', 'stepDelayMs', 'intervalMs', 'startDelayMs', 'defaultRecipeId',
  ];
  const optionalBooleanKeys = [
    'harvest', 'harvestAnimals', 'harvestBarnAnimals', 'harvestPondAnimals',
    'sellAnimals', 'sellBarnAnimals', 'sellPondAnimals',
    'feedAnimals', 'feedBarnAnimals', 'feedPondAnimals',
    'healAnimals', 'fertilizeCells', 'autoBuy', 'autoCook', 'autoHarvestCook',
    'prioritizeCookingMissions', 'autoClaimDailyQuests', 'logoutAfterCycle',
  ];
  return optionalNumberKeys.every((key) => value[key] === undefined || isFiniteNumber(value[key]))
    && optionalBooleanKeys.every((key) => value[key] === undefined || typeof value[key] === 'boolean')
    && (value.sellWhenGrownSpecies === undefined || isIntegerArray(value.sellWhenGrownSpecies))
    && (value.sellNearDeathSpecies === undefined || isIntegerArray(value.sellNearDeathSpecies))
    && (value.sellBarnSpecies === undefined || isIntegerArray(value.sellBarnSpecies))
    && (value.sellPondSpecies === undefined || isIntegerArray(value.sellPondSpecies))
    && (value.treeCellPlan === undefined || isTreePlan(value.treeCellPlan))
    && (value.barnAnimalPlan === undefined || isAnimalPlan(value.barnAnimalPlan))
    && (value.pondAnimalPlan === undefined || isAnimalPlan(value.pondAnimalPlan))
    && (value.cookingSlotPlan === undefined || isKitchenPlan(value.cookingSlotPlan));
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
  foods?: FoodRecipe[];
  onPlanDirtyChange?(dirty: boolean): void;
}

export function AutoFarmPanel({
  accountId,
  foods = [],
  onPlanDirtyChange,
}: AutoFarmPanelProps) {
  const [storedState, setStoredState] = useState<AutoConfigStateDto>(EMPTY_AUTO);
  const [draftPlan, setDraftPlan] = useState<TreeCellPlanEntry[]>([]);
  const [draftBarnPlan, setDraftBarnPlan] = useState<AnimalPlanEntry[]>([]);
  const [draftPondPlan, setDraftPondPlan] = useState<AnimalPlanEntry[]>([]);
  const [draftKitchenPlan, setDraftKitchenPlan] = useState<KitchenPlanEntry[]>([]);
  const [profile, setProfile] = useState<FarmProfileDto>(EMPTY_PROFILE);
  const [configReady, setConfigReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configError, setConfigError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [planNotice, setPlanNotice] = useState('');
  const [planError, setPlanError] = useState('');
  const [conflict, setConflict] = useState<AutoConfigStateDto | null>(null);
  const requestGeneration = useRef(0);
  const currentAccountId = useRef(accountId);
  currentAccountId.current = accountId;

  const hydrateForm = useCallback((config: Partial<AutoFarmConfigDto>) => {
    setDraftKitchenPlan(sortedKitchenPlan(config.cookingSlotPlan));
  }, []);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    let active = true;
    setConfigReady(false);
    setProfileLoading(true);
    setSaving(false);
    setStoredState(EMPTY_AUTO);
    setDraftPlan([]);
    setDraftKitchenPlan([]);
    setProfile(EMPTY_PROFILE);
    hydrateForm({});
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
      setDraftKitchenPlan(sortedKitchenPlan(state.config.cookingSlotPlan));
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

  // Chỉ so sánh các phần UI cho phép sửa: kế hoạch cây + vật nuôi (chuồng/hồ) + bếp nấu.
  const dirty = useMemo(
    () => planKey(draftPlan) !== planKey(storedState.config.treeCellPlan)
      || animalPlanKey(draftBarnPlan) !== animalPlanKey(storedState.config.barnAnimalPlan)
      || animalPlanKey(draftPondPlan) !== animalPlanKey(storedState.config.pondAnimalPlan)
      || kitchenPlanKey(draftKitchenPlan) !== kitchenPlanKey(storedState.config.cookingSlotPlan),
    [draftPlan, draftBarnPlan, draftPondPlan, draftKitchenPlan, storedState.config],
  );
  const planDirtyRef = useRef(dirty);
  planDirtyRef.current = dirty;

  useEffect(() => {
    onPlanDirtyChange?.(dirty);
  }, [dirty, onPlanDirtyChange]);

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
          ...ALWAYS_ON_AUTO_CONFIG,
          ...FIXED_AUTO_CONFIG,
          treeCellPlan: sortedPlan(draftPlan),
          barnAnimalPlan: sortedAnimalPlan(draftBarnPlan),
          pondAnimalPlan: sortedAnimalPlan(draftPondPlan),
          cookingSlotPlan: sortedKitchenPlan(draftKitchenPlan),
          autoCook: true,
          autoHarvestCook: true,
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
      const nextKitchenPlan = Array.isArray(saved.config.cookingSlotPlan)
        ? sortedKitchenPlan(saved.config.cookingSlotPlan)
        : sortedKitchenPlan(draftKitchenPlan);
      setDraftPlan(nextTreePlan);
      setDraftBarnPlan(nextBarnPlan);
      setDraftPondPlan(nextPondPlan);
      setDraftKitchenPlan(nextKitchenPlan);
      setStoredState({
        revision: saved.revision,
        config: {
          ...saved.config,
          treeCellPlan: nextTreePlan,
          barnAnimalPlan: nextBarnPlan,
          pondAnimalPlan: nextPondPlan,
          cookingSlotPlan: nextKitchenPlan,
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
    setDraftKitchenPlan(sortedKitchenPlan(conflict.config.cookingSlotPlan));
    hydrateForm(conflict.config);
    setConflict(null);
    setPlanError('');
    setPlanNotice('Đã tải bản cấu hình mới nhất từ máy chủ.');
  }

  const barnAnimalSlots = DEFAULT_BARN_ANIMAL_SLOTS;
  const pondAnimalSlots = DEFAULT_POND_ANIMAL_SLOTS;

  return (
    <section className="card">
      <h2>Tự động chăm sóc</h2>
      <p className="hint">
        Mỗi chu kỳ xin lại dữ liệu farm rồi hành động theo trạng thái thật của từng ô và slot.
        Chăm sóc cơ bản, thu hoạch và cho vật nuôi ăn luôn được bật; kế hoạch bên dưới quyết định
        việc trồng hoặc nuôi.
      </p>
      <p className="hint">
        Bật/tắt tự động ở phần Trạng thái bên trên. Lưu kế hoạch ở đây là ghi vào cơ sở dữ liệu:
        server tự động chạy theo cấu hình đã lưu.
      </p>

      <div className="setting-section">
        <h3>🌱 Cây trồng</h3>
        <TreeCellPlanEditor
          profile={profile}
          entries={draftPlan}
          disabled={!configReady || saving}
          onChange={(entries) => {
            setDraftPlan(sortedPlan(entries));
            setPlanNotice('');
            setPlanError('');
            setConflict(null);
          }}
        />
      </div>

      <div className="setting-section">
        <h3>🐓 Vật nuôi chuồng (Gà, Vịt, Bò, Heo, Cừu, Trâu, Dê, Thỏ...)</h3>
        <AnimalPlanEditor
          title="Kế hoạch vật nuôi chuồng theo slot"
          catalog={BARN_ANIMAL_CATALOG}
          slotIndices={barnAnimalSlots}
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

      <div className="setting-section">
        <h3>🐟 Vật nuôi hồ (Cá chép, Rùa)</h3>
        <AnimalPlanEditor
          title="Kế hoạch vật nuôi hồ theo slot"
          catalog={POND_ANIMAL_CATALOG}
          slotIndices={pondAnimalSlots}
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

      <div className="setting-section">
        <h3>🍳 Bếp nấu ăn tự động</h3>
        <KitchenPlanEditor
          title="Kế hoạch món nấu theo ô bếp"
          entries={draftKitchenPlan}
          foods={foods}
          disabled={!configReady || saving}
          onChange={(entries) => {
            setDraftKitchenPlan(sortedKitchenPlan(entries));
            setPlanNotice('');
            setPlanError('');
            setConflict(null);
          }}
        />
      </div>

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
    </section>
  );
}
