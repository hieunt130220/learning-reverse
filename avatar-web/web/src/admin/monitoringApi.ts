import { apiGet } from '../api.js';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type RuntimeStatus = 'online' | 'connecting' | 'handshaking' | 'logging-in' | 'error' | 'idle';

export interface MonitoringOverview {
  schemaVersion: 1;
  generatedAt: string;
  backend: { status: HealthStatus; uptimeMs: number };
  dependencies: Array<{ name: string; status: HealthStatus; checkedAt: string; latencyMs: number | null; errorCode?: string }>;
  accounts: Array<{ id: number; label: string; runtimeStatus: RuntimeStatus; host: string; port: number; lastEventAt: string | null; lastError: { code: string; message: string; at: string } | null }>;
  counters: { total: number; online: number; connecting: number; errors: number };
  errors: Array<{ id: string; source: string; severity: 'error' | 'warning'; code: string; message: string; accountId: number | null; at: string }>;
  staleAt: string | null;
}

export function getMonitoringOverview(): Promise<MonitoringOverview> {
  return apiGet<MonitoringOverview>('/api/monitoring/overview');
}
