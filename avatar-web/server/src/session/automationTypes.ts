/**
 * Contracts automation dùng chung giữa coordinator, runner, API và WebSocket.
 * Module thuần type + helper — không import runtime gì để tránh chu kỳ phụ thuộc.
 */

export type AutomationMode = 'off' | 'auto_farm' | 'find_npc';
export type AutomationTransitionState = 'stable' | 'switching';

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
  | 'automation-start-failed';

export function idleFindNpcRuntime(targetName: string): AutoFindNpcState {
  return { phase: 'idle', running: false, targetName, cursor: 0, total: 0, timeoutStreak: 0 };
}
