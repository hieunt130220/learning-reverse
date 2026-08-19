import { describe, expect, it } from 'vitest';

import { cellNeeds } from './AssetsPanel.js';
import type { FarmCell, TreeInfo } from '../../types.js';

/**
 * Cùng điều kiện chín với server (`isCellRipe` trong `game/farmData.ts`):
 * `time` đếm LÊN, là số phút kể từ lúc trồng, và ô chín khi
 * `time >= growMinutes × 60` — `TreeInfo.growMinutes` đơn vị là GIỜ.
 *
 * Số liệu lấy từ farm thật: Lúa (#6) 48 giờ -> ngưỡng 2880 phút. Ô 44 ở 2836
 * thử thu thì server im lặng; ô 45 ở 2938 thu được.
 */
const LUA: TreeInfo = { id: 6, name: 'Lúa', growMinutes: 48, value: 1 };

function cell(overrides: Partial<FarmCell> = {}): FarmCell {
  return {
    index: 0,
    idTree: 6,
    time: 0,
    vitalityPer: 100,
    hervestPer: 0,
    isArid: false,
    isWorm: false,
    isGrass: false,
    ...overrides,
  };
}

describe('cellNeeds', () => {
  it('báo thu hoạch khi ô đủ thời gian lớn, dù hervestPer = 0', () => {
    expect(cellNeeds(cell({ time: 3335 }), [LUA])).toContain('thu hoạch');
  });

  it('không báo thu hoạch với ô chưa đủ tuổi', () => {
    expect(cellNeeds(cell({ time: 2836 }), [LUA])).not.toContain('thu hoạch');
  });

  it('ô vừa thu xong (time = -1) không báo thu hoạch nữa và báo cần trồng lại', () => {
    expect(cellNeeds(cell({ time: -1, hervestPer: 100 }), [LUA])).not.toContain('thu hoạch');
    expect(cellNeeds(cell({ time: -1, hervestPer: 100 }), [LUA])).toEqual(['trống']);
  });

  it('chưa có bảng cây thì không đoán, chỉ tin hervestPer', () => {
    expect(cellNeeds(cell({ time: 9999 }), [])).not.toContain('thu hoạch');
    expect(cellNeeds(cell({ time: 10, hervestPer: 20 }), [])).toContain('thu hoạch');
  });

  it('vẫn báo việc chăm sóc kèm theo', () => {
    expect(cellNeeds(cell({ time: 3335, isArid: true, isGrass: true }), [LUA])).toEqual([
      'tưới',
      'cỏ',
      'thu hoạch',
    ]);
  });
});
