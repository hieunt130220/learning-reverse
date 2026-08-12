export interface TrafficEntry {
  t: number;
  dir: 'tx' | 'rx';
  cmd: number;
  name: string;
  len: number;
  hex: string;
}

export interface FarmCell {
  index: number;
  idTree: number;
  time: number;
  vitalityPer: number;
  hervestPer: number;
  isArid: boolean;
  isWorm: boolean;
  isGrass: boolean;
  level?: number;
}

export interface FarmAnimal {
  index: number;
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  hunger: boolean;
}

export interface AnimalInfo {
  id: number;
  name: string;
  desc: string;
}

export interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  updatedAt: number;
}

export interface TreeInfo {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  price: number;
}

export interface AutoState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  lastActions: string[];
}

export interface InventoryItem {
  id: number;
  num: number;
}

export interface MacroState {
  running: boolean;
  name?: string;
  cycle: number;
  lastRun?: number;
  lastError?: string;
}

export interface LogLine {
  t: number;
  line: string;
}

export type ClientStatus =
  | 'idle'
  | 'connecting'
  | 'handshaking'
  | 'logging-in'
  | 'online'
  | 'error';

/** Khớp `AvatarSessionSnapshot` phía server. */
export interface SessionSnapshot {
  accountId: number;
  status: ClientStatus;
  lastError?: string;
  playerId?: number;
  money?: number;
  farm?: FarmState;
  auto: AutoState;
  macro: MacroState;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
  logs: LogLine[];
  traffic: TrafficEntry[];
  retries: number;
  nextRetryAt?: number;
  desiredConnected: boolean;
}

export interface AvatarAccount {
  id: number;
  label: string;
  gameUser: string;
  host: string;
  port: number;
  autoEnabled: boolean;
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AccountWithRuntime extends AvatarAccount {
  runtime: SessionSnapshot | null;
}

export interface AuthUser {
  id: number;
  email: string;
}
