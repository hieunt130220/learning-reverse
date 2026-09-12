import type { Db } from '../db/index.js';
import type { MlFishingStatistics } from '../session/automationTypes.js';

interface MlStatsRow {
  total_attempts: number;
  success_catches: number;
  updated_at: number;
}

export function emptyMlFishingStatistics(): MlFishingStatistics {
  return {
    totalAttempts: 0,
    successCatches: 0,
    accuracy: 0,
    updatedAt: null,
  };
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} nằm ngoài giới hạn số nguyên an toàn`);
  }
  return value;
}

function formatMlStats(row: MlStatsRow | undefined): MlFishingStatistics {
  if (!row) return emptyMlFishingStatistics();
  const totalAttempts = requireSafeInteger(row.total_attempts, 'totalAttempts');
  const successCatches = requireSafeInteger(row.success_catches, 'successCatches');
  const updatedAt = requireSafeInteger(row.updated_at, 'updatedAt');
  const accuracy = totalAttempts > 0 ? successCatches / totalAttempts : 0;
  return {
    totalAttempts,
    successCatches,
    accuracy,
    updatedAt,
  };
}

export class FishingMlStatisticsRepository {
  constructor(private readonly db: Db) {}

  read(accountId: number): MlFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    const row = this.db.prepare<[number], MlStatsRow>(`
      SELECT total_attempts, success_catches, updated_at
      FROM avatar_ml_fishing_statistics
      WHERE account_id = ?
    `).get(accountId);
    return formatMlStats(row);
  }

  recordResult(accountId: number, isSuccess: boolean, updatedAt: number): MlFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    if (!Number.isFinite(updatedAt)) {
      throw new Error('timestamp thống kê ML không hữu hạn');
    }
    const successInc = isSuccess ? 1 : 0;
    return this.db.transaction(() => {
      this.db.prepare<[number, number, number]>(`
        INSERT INTO avatar_ml_fishing_statistics (
          account_id, total_attempts, success_catches, updated_at
        ) VALUES (?, 1, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          total_attempts = total_attempts + 1,
          success_catches = success_catches + excluded.success_catches,
          updated_at = excluded.updated_at
        WHERE total_attempts < 9007199254740991
      `).run(accountId, successInc, updatedAt);
      return this.read(accountId);
    })();
  }
}
