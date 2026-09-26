export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type RuntimeStatus = 'online' | 'connecting' | 'handshaking' | 'logging-in' | 'error' | 'idle';
export type MonitoringSource = 'game' | 'captcha' | 'inference' | 'backend';
export type MonitoringSeverity = 'error' | 'warning';

export interface DependencyHealthDto {
  name: 'game-server' | 'captcha-solver' | 'fishing-ml';
  status: HealthStatus;
  checkedAt: string;
  latencyMs: number | null;
  errorCode?: 'timeout' | 'refused' | 'http-error' | 'unavailable';
}

export interface MonitoringErrorDto {
  id: string;
  source: MonitoringSource;
  severity: MonitoringSeverity;
  code: string;
  message: string;
  accountId: number | null;
  at: string;
}

export interface MonitoringAccountDto {
  id: number;
  label: string;
  runtimeStatus: RuntimeStatus;
  host: string;
  port: number;
  lastEventAt: string | null;
  lastError: { code: string; message: string; at: string } | null;
}

export interface MonitoringOverviewDto {
  schemaVersion: 1;
  generatedAt: string;
  backend: { status: HealthStatus; uptimeMs: number };
  dependencies: DependencyHealthDto[];
  accounts: MonitoringAccountDto[];
  counters: { total: number; online: number; connecting: number; errors: number };
  errors: MonitoringErrorDto[];
  staleAt: string | null;
}

export interface MonitoringEventsDto {
  schemaVersion: 1;
  generatedAt: string;
  events: MonitoringErrorDto[];
}
