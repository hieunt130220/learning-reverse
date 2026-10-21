import type { Db } from '../db/index.js';
import type { FishingFinancialStatistics } from '../session/automationTypes.js';

interface FinancialRow {
  account_id: number;
  spent_bait_xu: number;
  spent_ticket_xu: number;
  spent_rod_xu: number;
  earned_fish_xu: number;
  updated_at: number;
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} nằm ngoài giới hạn số nguyên an toàn`);
  }
  return value;
}

export class FishingFinancialStatisticsRepository {
  constructor(private readonly db: Db) {}

  read(accountId: number): FishingFinancialStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    const row = this.db.prepare<[number], FinancialRow>(`
      SELECT account_id, spent_bait_xu, spent_ticket_xu, spent_rod_xu, earned_fish_xu, updated_at
      FROM avatar_fishing_financial_statistics
      WHERE account_id = ?
    `).get(accountId);

    if (!row) {
      return {
        spentBaitXu: 0,
        spentTicketXu: 0,
        spentRodXu: 0,
        earnedFishXu: 0,
        netProfitXu: 0,
        updatedAt: null,
      };
    }

    const spentBaitXu = requireSafeInteger(row.spent_bait_xu, 'spent_bait_xu');
    const spentTicketXu = requireSafeInteger(row.spent_ticket_xu, 'spent_ticket_xu');
    const spentRodXu = requireSafeInteger(row.spent_rod_xu, 'spent_rod_xu');
    const earnedFishXu = requireSafeInteger(row.earned_fish_xu, 'earned_fish_xu');
    const updatedAt = requireSafeInteger(row.updated_at, 'updated_at');
    const totalExpenses = spentBaitXu + spentTicketXu + spentRodXu;
    const netProfitXu = earnedFishXu - totalExpenses;

    return {
      spentBaitXu,
      spentTicketXu,
      spentRodXu,
      earnedFishXu,
      netProfitXu,
      updatedAt,
    };
  }

  recordExpense(
    accountId: number,
    type: 'bait' | 'ticket' | 'rod',
    amountXu: number,
    now = Date.now(),
  ): FishingFinancialStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    requireSafeInteger(amountXu, 'amountXu', 0);
    if (amountXu === 0) return this.read(accountId);

    const column =
      type === 'bait'
        ? 'spent_bait_xu'
        : type === 'ticket'
        ? 'spent_ticket_xu'
        : 'spent_rod_xu';

    return this.db.transaction(() => {
      this.db.prepare<[number, number, number]>(`
        INSERT INTO avatar_fishing_financial_statistics (
          account_id, ${column}, updated_at
        ) VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          ${column} = ${column} + excluded.${column},
          updated_at = excluded.updated_at
      `).run(accountId, amountXu, now);
      return this.read(accountId);
    })();
  }

  recordRevenue(
    accountId: number,
    amountXu: number,
    now = Date.now(),
  ): FishingFinancialStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    requireSafeInteger(amountXu, 'amountXu', 0);
    if (amountXu === 0) return this.read(accountId);

    return this.db.transaction(() => {
      this.db.prepare<[number, number, number]>(`
        INSERT INTO avatar_fishing_financial_statistics (
          account_id, earned_fish_xu, updated_at
        ) VALUES (?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          earned_fish_xu = earned_fish_xu + excluded.earned_fish_xu,
          updated_at = excluded.updated_at
      `).run(accountId, amountXu, now);
      return this.read(accountId);
    })();
  }

  reset(accountId: number, now = Date.now()): FishingFinancialStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    return this.db.transaction(() => {
      this.db.prepare<[number, number]>(`
        INSERT INTO avatar_fishing_financial_statistics (
          account_id, spent_bait_xu, spent_ticket_xu, spent_rod_xu, earned_fish_xu, updated_at
        ) VALUES (?, 0, 0, 0, 0, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          spent_bait_xu = 0,
          spent_ticket_xu = 0,
          spent_rod_xu = 0,
          earned_fish_xu = 0,
          updated_at = excluded.updated_at
      `).run(accountId, now);
      return this.read(accountId);
    })();
  }
}
