import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, apiGet, apiPut } from '../../api.js';
import type {
  AnimalPlanEntry,
  AutoConfigResponse,
  AutoConfigStateDto,
  AutoFarmConfigDto,
  FarmProfileDto,
  TreeCellPlanEntry,
} from '../../types.js';
import { BARN_ANIMAL_CATALOG, DEFAULT_BARN_ANIMAL_SLOTS, DEFAULT_POND_ANIMAL_SLOTS, POND_ANIMAL_CATALOG } from '../animalPlan.js';
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

const ALWAYS_ON_AUTO_CONFIG = {
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
  onPlanDirtyChange?(dirty: boolean): void;
}

export function AutoFarmPanel({
  accountId,
  onPlanDirtyChange,
}: AutoFarmPanelProps) {
  const [seedId, setSeedId] = useState('');
  // Bán là thao tác KHÔNG lấy lại được -> mặc định tắt, người dùng phải tự bật.
  const [sellBarnAnimals, setSellBarnAnimals] = useState(false);
  const [sellPondAnimals, setSellPondAnimals] = useState(false);
  // Chuồng: Gà 50, Bò 51, Heo 52, Vịt 55 / Hồ: Cá chép 54, Rùa 59
  const [sellBarnSpeciesStr, setSellBarnSpeciesStr] = useState('50, 51, 52, 55');
  const [sellPondSpeciesStr, setSellPondSpeciesStr] = useState('54, 59');
  const [autoCook, setAutoCook] = useState(false);
  const [autoHarvestCook, setAutoHarvestCook] = useState(false);
  const [prioritizeCookingMissions, setPrioritizeCookingMissions] = useState(false);
  const [defaultRecipeId, setDefaultRecipeId] = useState('0');

  const [storedState, setStoredState] = useState<AutoConfigStateDto>(EMPTY_AUTO);
  const [draftPlan, setDraftPlan] = useState<TreeCellPlanEntry[]>([]);
  const [draftBarnPlan, setDraftBarnPlan] = useState<AnimalPlanEntry[]>([]);
  const [draftPondPlan, setDraftPondPlan] = useState<AnimalPlanEntry[]>([]);
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
    const optionalId = (value: number | undefined, fallback = '') => (
      value === undefined ? fallback : String(value)
    );
    setSeedId(optionalId(config.seedId));
    setSellBarnAnimals(config.sellBarnAnimals ?? config.sellAnimals ?? false);
    setSellPondAnimals(config.sellPondAnimals ?? config.sellAnimals ?? false);
    setSellBarnSpeciesStr(config.sellBarnSpecies?.join(', ') ?? '50, 51, 52, 55');
    setSellPondSpeciesStr(config.sellPondSpecies?.join(', ') ?? '54, 59');
    setAutoCook(config.autoCook ?? false);
    setAutoHarvestCook(config.autoHarvestCook ?? false);
    setPrioritizeCookingMissions(config.prioritizeCookingMissions ?? false);
    setDefaultRecipeId(optionalId(config.defaultRecipeId, '0'));
  }, []);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    let active = true;
    setConfigReady(false);
    setProfileLoading(true);
    setSaving(false);
    setStoredState(EMPTY_AUTO);
    setDraftPlan([]);
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

  // Chỉ so sánh các phần UI cho phép sửa: kế hoạch cây + vật nuôi (chuồng/hồ) + bếp nấu.
  const dirty = useMemo(
    () => planKey(draftPlan) !== planKey(storedState.config.treeCellPlan)
      || animalPlanKey(draftBarnPlan) !== animalPlanKey(storedState.config.barnAnimalPlan)
      || animalPlanKey(draftPondPlan) !== animalPlanKey(storedState.config.pondAnimalPlan)
      || autoCook !== (storedState.config.autoCook ?? false)
      || autoHarvestCook !== (storedState.config.autoHarvestCook ?? false)
      || prioritizeCookingMissions !== (storedState.config.prioritizeCookingMissions ?? false)
      || num(defaultRecipeId) !== storedState.config.defaultRecipeId,
    [draftPlan, draftBarnPlan, draftPondPlan, autoCook, autoHarvestCook, prioritizeCookingMissions, defaultRecipeId, storedState.config],
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
          autoCook,
          autoHarvestCook,
          prioritizeCookingMissions,
          defaultRecipeId: num(defaultRecipeId),
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
        <div className="row">
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
        <div className="row" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label className="inline">
            <input
              type="checkbox"
              checked={autoHarvestCook}
              onChange={(event) => setAutoHarvestCook(event.target.checked)}
              style={{ width: 'auto' }}
            />
            Tự động thu hoạch món chín khi xong
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={autoCook}
              onChange={(event) => setAutoCook(event.target.checked)}
              style={{ width: 'auto' }}
            />
            Tự động nấu món khi có ô trống (nếu đủ nguyên liệu)
          </label>
          <label className="inline" style={{ marginLeft: '1.25rem' }}>
            <input
              type="checkbox"
              checked={prioritizeCookingMissions}
              onChange={(event) => setPrioritizeCookingMissions(event.target.checked)}
              disabled={!autoCook}
              style={{ width: 'auto' }}
            />
            Ưu tiên nấu các món theo tiến độ nhiệm vụ mở ô Master
          </label>
          <label className="inline" style={{ marginLeft: '1.25rem' }}>
            ID món nấu mặc định (khi không theo nhiệm vụ):
            <input
              type="number"
              value={defaultRecipeId}
              onChange={(event) => setDefaultRecipeId(event.target.value)}
              placeholder="0 (Thức ăn gia súc)"
              disabled={!autoCook}
              style={{ width: '80px', marginLeft: '0.5rem' }}
            />
          </label>
        </div>
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
