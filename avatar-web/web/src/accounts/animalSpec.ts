export interface AnimalSpec {
  growMinutes?: number;
  lifeMinutes?: number;
  productCycleMinutes?: number;
  hasProduct: boolean;
}

const DAY_MINUTES = 24 * 60;

export function parseAnimalSpec(desc: string): AnimalSpec {
  const grow = /Thời gian lớn\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const life = /Thời gian sống\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const cycle = /(?:sau\s+mỗi|mỗi)\s+(\d+)\s*giờ/i.exec(desc);
  return {
    growMinutes: grow ? Number(grow[1]) * DAY_MINUTES : undefined,
    lifeMinutes: life ? Number(life[1]) * DAY_MINUTES : undefined,
    productCycleMinutes: cycle ? Number(cycle[1]) * 60 : undefined,
    hasProduct: /Sản phẩm\s*:/i.test(desc) && !/Không\s+có\s+sản phẩm/i.test(desc),
  };
}

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const days = Math.floor(m / DAY_MINUTES);
  const hours = Math.floor((m % DAY_MINUTES) / 60);
  const mins = m % 60;
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}
