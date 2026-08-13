import type { AccountWithRuntime, SessionSnapshot } from '../types.js';

export function makeSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    accountId: 1,
    status: 'online',
    playerId: 101,
    money: 1_250_000,
    auto: { running: true, cycle: 32, lastActions: [] },
    macro: { running: false, cycle: 0 },
    inventory: [],
    trees: [],
    items: [],
    animals: [],
    logs: [],
    traffic: [],
    retries: 0,
    desiredConnected: true,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<AccountWithRuntime> = {}): AccountWithRuntime {
  const id = overrides.id ?? 1;
  return {
    id,
    label: 'Farm chính',
    gameUser: 'avatar01',
    host: '27.0.14.120',
    port: 19129,
    autoEnabled: true,
    hasPassword: true,
    createdAt: 1,
    updatedAt: 1,
    runtime: makeSnapshot({ accountId: id }),
    ...overrides,
  };
}
