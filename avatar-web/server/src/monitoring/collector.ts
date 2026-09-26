import http from 'node:http';
import net from 'node:net';

import { listAccounts, type AvatarAccount } from '../accounts/repo.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import type { Db } from '../db/index.js';
import type { AvatarSessionSnapshot } from '../session/avatarSession.js';
import type { SessionManager } from '../session/manager.js';
import type {
  DependencyHealthDto,
  HealthStatus,
  MonitoringAccountDto,
  MonitoringErrorDto,
  MonitoringEventsDto,
  MonitoringOverviewDto,
  MonitoringSeverity,
  MonitoringSource,
  RuntimeStatus,
} from './types.js';

const HEALTH_TIMEOUT_MS = 2_000;
const MAX_EVENTS = 200;
const startedAt = Date.now();

function safeMessage(value: string): string {
  return value
    .replace(/(password|pass|mật khẩu|gamePass|MASTER_KEY)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 240);
}

function sourceFor(line: string): MonitoringSource {
  if (/captcha/i.test(line)) return 'captcha';
  if (/fishing|inference|câu cá/i.test(line)) return 'inference';
  if (/game|socket|map|RX\d+|TX\d+/i.test(line)) return 'game';
  return 'backend';
}

function severityFor(line: string): MonitoringSeverity {
  return /error|failed|fail|lỗi|timeout|hết giờ|refused|unavailable/i.test(line) ? 'error' : 'warning';
}

function eventFromLine(accountId: number, line: { t: number; line: string }, index: number): MonitoringErrorDto {
  const message = safeMessage(line.line);
  return {
    id: `${accountId}-${line.t}-${index}`,
    source: sourceFor(message),
    severity: severityFor(message),
    code: severityFor(message) === 'error' ? 'runtime-error' : 'runtime-warning',
    message,
    accountId,
    at: new Date(line.t).toISOString(),
  };
}

function dependencyHealth(
  name: DependencyHealthDto['name'],
  status: HealthStatus,
  started: number,
  errorCode?: DependencyHealthDto['errorCode'],
): DependencyHealthDto {
  return {
    name,
    status,
    checkedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - started),
    ...(errorCode ? { errorCode } : {}),
  };
}

function tcpHealth(host: string, port: number): Promise<DependencyHealthDto> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (status: HealthStatus, errorCode?: DependencyHealthDto['errorCode']): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(dependencyHealth('game-server', status, started, errorCode));
    };
    const timer = setTimeout(() => finish('degraded', 'timeout'), HEALTH_TIMEOUT_MS);
    timer.unref?.();
    socket.once('connect', () => {
      clearTimeout(timer);
      finish('healthy');
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      finish('down', error.code === 'ECONNREFUSED' ? 'refused' : 'unavailable');
    });
  });
}

function httpHealth(
  name: Exclude<DependencyHealthDto['name'], 'game-server'>,
  port: number,
): Promise<DependencyHealthDto> {
  const started = Date.now();
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/health', timeout: HEALTH_TIMEOUT_MS }, (response) => {
      response.resume();
      const status = response.statusCode === 200 ? 'healthy' : 'degraded';
      resolve({
        ...dependencyHealth(name, status, started, status === 'degraded' ? 'http-error' : undefined),
      });
    });
    const finish = (errorCode: DependencyHealthDto['errorCode']): void => {
      request.destroy();
      resolve(dependencyHealth(name, errorCode === 'timeout' ? 'degraded' : 'down', started, errorCode));
    };
    request.setTimeout(HEALTH_TIMEOUT_MS, () => finish('timeout'));
    request.once('error', (error: NodeJS.ErrnoException) => {
      finish(error.code === 'ECONNREFUSED' ? 'refused' : 'unavailable');
    });
  });
}

function runtimeStatus(snapshot: AvatarSessionSnapshot | null): RuntimeStatus {
  return snapshot?.status ?? 'idle';
}

function accountEvents(account: AvatarAccount, snapshot: AvatarSessionSnapshot | null): MonitoringErrorDto[] {
  if (!snapshot) return [];
  const lines = snapshot.logs.filter((line) => /error|failed|fail|lỗi|timeout|hết giờ|warning|cảnh báo/i.test(line.line));
  const events = lines.slice(-MAX_EVENTS).map((line, index) => eventFromLine(account.id, line, index));
  if (snapshot.lastError && !events.some((event) => event.message === safeMessage(snapshot.lastError!))) {
    events.push({
      id: `${account.id}-last-error-${snapshot.lastError}`,
      source: sourceFor(snapshot.lastError),
      severity: 'error',
      code: 'session-error',
      message: safeMessage(snapshot.lastError),
      accountId: account.id,
      at: new Date().toISOString(),
    });
  }
  return events;
}

export class MonitoringCollector {
  constructor(private readonly db: Db, private readonly sessions: SessionManager) {}

  async overview(userId: number): Promise<MonitoringOverviewDto> {
    const generatedAt = new Date().toISOString();
    const accounts = listAccounts(this.db, userId);
    const snapshots = accounts.map((account) => ({ account, snapshot: this.sessions.snapshot(account.id) }));
    const [game, captcha, fishing] = await Promise.all([
      tcpHealth(DEFAULT_GAME_SERVER.host, DEFAULT_GAME_SERVER.port),
      httpHealth('captcha-solver', 8643),
      httpHealth('fishing-ml', 8080),
    ]);
    const errors = snapshots.flatMap(({ account, snapshot }) => accountEvents(account, snapshot)).slice(-MAX_EVENTS);
    const connecting = snapshots.filter(({ snapshot }) => ['connecting', 'handshaking', 'logging-in'].includes(snapshot?.status ?? 'idle')).length;
    const online = snapshots.filter(({ snapshot }) => snapshot?.status === 'online').length;
    const errorCount = snapshots.filter(({ snapshot }) => snapshot?.status === 'error' || Boolean(snapshot?.lastError)).length;
    const accountDtos: MonitoringAccountDto[] = snapshots.map(({ account, snapshot }) => ({
      id: account.id,
      label: account.label,
      runtimeStatus: runtimeStatus(snapshot),
      host: account.host,
      port: account.port,
      lastEventAt: snapshot?.logs.at(-1)?.t ? new Date(snapshot.logs.at(-1)!.t).toISOString() : null,
      lastError: snapshot?.lastError ? {
        code: 'session-error',
        message: safeMessage(snapshot.lastError),
        at: new Date().toISOString(),
      } : null,
    }));
    return {
      schemaVersion: 1,
      generatedAt,
      backend: { status: 'healthy', uptimeMs: Date.now() - startedAt },
      dependencies: [game, captcha, fishing],
      accounts: accountDtos,
      counters: { total: accounts.length, online, connecting, errors: errorCount },
      errors,
      staleAt: null,
    };
  }

  async events(userId: number, limit: number): Promise<MonitoringEventsDto> {
    const overview = await this.overview(userId);
    return { schemaVersion: 1, generatedAt: overview.generatedAt, events: overview.errors.slice(-limit) };
  }
}
