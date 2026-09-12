import type { Db } from '../db/index.js';
import {
  getFishName,
  type DailyFishingStatistics,
} from '../session/automationTypes.js';

export const FISHING_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: FISHING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function toVietnamDateKey(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    throw new Error('timestamp thống kê câu cá không hữu hạn');
  }
  const values = Object.fromEntries(
    DATE_FORMATTER.formatToParts(new Date(timestampMs)).map((part) => [part.type, part.value]),
  );
  const date = `${values.year}-${values.month}-${values.day}`;
  if (!DATE_KEY.test(date)) {
    throw new Error('không thể xác định ngày câu cá theo giờ Việt Nam');
  }
  return date;
}

export function emptyDailyFishingStatistics(now = Date.now()): DailyFishingStatistics {
  return {
    date: toVietnamDateKey(now),
    timezone: FISHING_TIMEZONE,
    totalCatches: 0,
    bySpecies: [],
    updatedAt: null,
  };
}

interface FishingCountRow {
  fish_id: number;
  catch_count: number;
  updated_at: number;
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} nằm ngoài giới hạn số nguyên an toàn`);
  }
  return value;
}

export class FishingStatisticsRepository {
  constructor(private readonly db: Db) {}

  private readDate(accountId: number, date: string): DailyFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    if (!DATE_KEY.test(date)) throw new Error('ngày thống kê câu cá không hợp lệ');
    const rows = this.db.prepare<[number, string], FishingCountRow>(`
      SELECT fish_id, catch_count, updated_at
      FROM avatar_daily_fishing_statistics
      WHERE account_id = ? AND local_date = ?
      ORDER BY catch_count DESC, fish_id ASC
    `).all(accountId, date);
    let totalCatches = 0;
    let updatedAt: number | null = null;
    const bySpecies = rows.map((row) => {
      const fishId = requireSafeInteger(row.fish_id, 'fishId');
      const count = requireSafeInteger(row.catch_count, 'catchCount', 1);
      const rowUpdatedAt = requireSafeInteger(row.updated_at, 'updatedAt');
      if (totalCatches > Number.MAX_SAFE_INTEGER - count) {
        throw new Error('tổng lượt câu vượt giới hạn số nguyên an toàn');
      }
      totalCatches += count;
      updatedAt = Math.max(updatedAt ?? 0, rowUpdatedAt);
      return { fishId, fishName: getFishName(fishId), count };
    });
    return { date, timezone: FISHING_TIMEZONE, totalCatches, bySpecies, updatedAt };
  }

  readToday(accountId: number, now = Date.now()): DailyFishingStatistics {
    return this.readDate(accountId, toVietnamDateKey(now));
  }

  recordCatch(accountId: number, fishId: number, caughtAt: number): DailyFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    requireSafeInteger(fishId, 'fishId');
    if (!Number.isFinite(caughtAt)) {
      throw new Error('timestamp thống kê câu cá không hữu hạn');
    }
    const date = toVietnamDateKey(caughtAt);
    return this.db.transaction(() => {
      const current = this.readDate(accountId, date);
      if (current.totalCatches === Number.MAX_SAFE_INTEGER) {
        throw new Error('tổng lượt câu vượt giới hạn số nguyên an toàn');
      }
      const result = this.db.prepare<[number, string, number, number]>(`
        INSERT INTO avatar_daily_fishing_statistics (
          account_id, local_date, fish_id, catch_count, updated_at
        ) VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(account_id, local_date, fish_id) DO UPDATE SET
          catch_count = catch_count + 1,
          updated_at = excluded.updated_at
        WHERE catch_count < 9007199254740991
      `).run(accountId, date, fishId, caughtAt);
      if (result.changes !== 1) {
        throw new Error('không thể tăng thống kê câu cá an toàn');
      }
      return this.readDate(accountId, date);
    })();
  }
}
