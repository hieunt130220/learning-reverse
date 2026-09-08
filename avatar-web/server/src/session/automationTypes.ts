/**
 * Contracts automation dùng chung giữa coordinator, runner, API và WebSocket.
 * Module thuần type + helper — không import runtime gì để tránh chu kỳ phụ thuộc.
 */

export type AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing';
export type AutomationTransitionState = 'stable' | 'switching';

export interface FishingConfig {
  readonly map: number;
  readonly area: number;
  readonly castDelayMs: number;

  // Cấu hình tự động mua
  readonly autoBuyTicket: boolean;
  readonly rodType: number;
  readonly baitType: number;
  readonly baitQuantity: number;
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = Object.freeze({
  map: 14,
  area: 0,
  castDelayMs: 3000,
  autoBuyTicket: true,
  rodType: 442,      // Cần câu tre (10.000 xu)
  baitType: 448,     // Trứng kiến (30 xu)
  baitQuantity: 50,  // Mua 50 mồi mỗi lần
});

export interface StoredFishingConfigState {
  revision: number;
  config: FishingConfig;
}

export const FISHING_TICKETS: Readonly<Record<number, { id: number; name: string; cost: string; typeMoney: number }>> = Object.freeze({
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
});

export const FISHING_RODS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
]);

export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
]);

export type FishingStatus =
  | 'idle'
  | 'moving'
  | 'buying'
  | 'starting'
  | 'casting'
  | 'hooked'
  | 'caught'
  | 'rejected'
  | 'resting';

export const FISH_NAMES: Record<number, string> = {
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',
  4507: 'Cá biển (4507)',
  4510: 'Cá biển (4510)',
};

export function getFishName(id: number): string {
  return FISH_NAMES[id] ?? `Cá ID ${id}`;
}

export interface FishingRuntimeState {
  status: FishingStatus;
  totalCatches: number;
  lastFishId: number | null;
  lastFishName?: string | null;
  lastError: string | null;
  currentMap: number;
  currentArea: number;
}

export function idleFishingRuntime(): FishingRuntimeState {
  return {
    status: 'idle',
    totalCatches: 0,
    lastFishId: null,
    lastFishName: null,
    lastError: null,
    currentMap: 14,
    currentArea: 0,
  };
}

export interface AutomationLocation {
  map: number;
  area: number;
  observedAt: number;
}

export interface FindNpcConfig {
  npcName: string;
}

export interface StoredFindNpcConfigState {
  revision: number;
  config: FindNpcConfig;
}

/** Ý muốn đã chuẩn hóa đọc từ DB, truyền xuống session khi start/switch. */
export interface LoadedAutomationIntent {
  desiredMode: AutomationMode;
  findNpcConfig: StoredFindNpcConfigState;
  fishingConfig?: StoredFishingConfigState;
  location: AutomationLocation | null;
}

export type AutoFindNpcPhase =
  | 'idle'
  | 'scanning'
  | 'scan_backoff'
  | 'tracking'
  | 'stopping';

export interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  current?: NpcMapLocation;
  /** Map/khu đang chờ snapshot; tồn tại cả khi phase=scanning. */
  probing?: NpcMapLocation;
  timeoutStreak: number;
  backoffUntil?: number;
  lastError?: string;
}

/** Một cặp map/khu đã được live-verify. `map`/`area` == roomID/boardID của cmd 80. */
export interface NpcMapLocation {
  map: number;
  area: number;
}

export interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: AutomationTransitionState;
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  fishingConfig?: StoredFishingConfigState;
  fishingRuntime?: FishingRuntimeState;
  location: AutomationLocation | null;
}

/** Kết quả một lần switch do coordinator trả về cho tầng route. */
export type AutomationStartOutcome = 'active' | 'connect-pending' | 'start-failed';

export type AutomationApiErrorCode =
  | 'invalid-automation-mode'
  | 'invalid-find-npc-config'
  | 'find-npc-name-required'
  | 'catalog-unverified'
  | 'find-npc-disabled'
  | 'revision-conflict'
  | 'automation-connect-pending'
  | 'automation-start-failed'
  | 'invalid-fishing-config'
  | 'automation-save-failed';

export function idleFindNpcRuntime(targetName: string): AutoFindNpcState {
  return { phase: 'idle', running: false, targetName, cursor: 0, total: 0, timeoutStreak: 0 };
}
