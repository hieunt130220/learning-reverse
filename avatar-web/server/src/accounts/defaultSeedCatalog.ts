import type { CachedSeed } from './farmProfileRepo.js';

/**
 * Danh sách 26 loại cây trồng mặc định (gồm 11 cây xu và 15 cây mở rộng cao cấp).
 * Được khởi tạo mặc định khi tài khoản mới tạo hoặc chưa từng kết nối server game.
 */
export const DEFAULT_SEED_CATALOG: CachedSeed[] = [
  { id: 0, name: 'Cà chua', growMinutes: 4, value: 25 },
  { id: 1, name: 'Cà rốt', growMinutes: 6, value: 36 },
  { id: 2, name: 'Khóm', growMinutes: 10, value: 55 },
  { id: 3, name: 'Dưa Hấu', growMinutes: 8, value: 46 },
  { id: 4, name: 'Nho', growMinutes: 16, value: 80 },
  { id: 5, name: 'Hoa Hồng', growMinutes: 2, value: 15 },
  { id: 6, name: 'Lúa', growMinutes: 48, value: 240 },
  { id: 7, name: 'Xoài', growMinutes: 24, value: 120 },
  { id: 8, name: 'Thanh long', growMinutes: 12, value: 63 },
  { id: 9, name: 'Hoa hướng dương', growMinutes: 12, value: 63 },
  { id: 10, name: 'Hoa tulip', growMinutes: 6, value: 36 },
  { id: 30, name: 'Bắp', growMinutes: 24, value: 1440 },
  { id: 31, name: 'Nha đam', growMinutes: 2, value: 120 },
  { id: 43, name: 'Dưa Leo', growMinutes: 2, value: 120 },
  { id: 32, name: 'Cà tìm', growMinutes: 3, value: 180 },
  { id: 34, name: 'Tỏi', growMinutes: 4, value: 240 },
  { id: 35, name: 'Dâu Tây', growMinutes: 5, value: 300 },
  { id: 36, name: 'Chuối', growMinutes: 8, value: 480 },
  { id: 39, name: 'Cúc Chuồn Chuồn', growMinutes: 2, value: 120 },
  { id: 41, name: 'Bí Ngô', growMinutes: 2, value: 120 },
  { id: 42, name: 'Khoai Tây', growMinutes: 6, value: 360 },
  { id: 44, name: 'Ớt', growMinutes: 1, value: 60 },
  { id: 111, name: 'Ớt hiểm', growMinutes: 1, value: 60 },
  { id: 45, name: 'Cải Thảo', growMinutes: 4, value: 240 },
  { id: 46, name: 'Nhân Sâm', growMinutes: 4, value: 240 },
  { id: 47, name: 'Hoa Tam Giác Mạch', growMinutes: 3, value: 180 },
  { id: 48, name: 'Cây Dừa', growMinutes: 48, value: 2880 },
];

/**
 * 11 hạt trồng bằng xu (typeShop = 1), id 0–10. Hạt cao cấp (30–48) chưa xác
 * định loại tiền (`typeShop = 2`) nên không tự mua.
 */
export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
