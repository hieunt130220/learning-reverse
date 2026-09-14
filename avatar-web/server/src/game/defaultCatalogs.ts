import type { AnimalInfo, ItemInfo, TreeInfo } from './farmData.js';

export const DEFAULT_TREE_CATALOG: TreeInfo[] = [
  { id: 0, name: 'Cà chua', growMinutes: 4, value: 25, stageImages: [1, 2, 3, 4, 5, 6], attrsHex: '00180004ffff000a00010019000000010002000300040005000600250000', category: 'xu' },
  { id: 1, name: 'Cà rốt', growMinutes: 6, value: 36, stageImages: [7, 8, 9, 10, 11, 12], attrsHex: '00180006ffff000a000100240000000700080009000a000b000c00260000', category: 'xu' },
  { id: 2, name: 'Khóm', growMinutes: 10, value: 55, stageImages: [13, 14, 15, 16, 17, 18], attrsHex: '0018000affff000a000100370000000d000e000f00100011001200270000', category: 'xu' },
  { id: 3, name: 'Dưa Hấu', growMinutes: 8, value: 46, stageImages: [19, 20, 21, 22, 23, 24], attrsHex: '00180008ffff000a0001002e000000130014001500160017001800280000', category: 'xu' },
  { id: 4, name: 'Nho', growMinutes: 16, value: 80, stageImages: [25, 26, 27, 28, 29, 30], attrsHex: '00180010ffff000a0001005000000019001a001b001c001d001e00290000', category: 'xu' },
  { id: 5, name: 'Hoa Hồng', growMinutes: 2, value: 15, stageImages: [31, 32, 33, 34, 35, 36], attrsHex: '00180002ffff000a0001000f0000001f00200021002200230024002a0000', category: 'xu' },
  { id: 6, name: 'Lúa', growMinutes: 48, value: 240, stageImages: [37, 38, 39, 40, 41, 42], attrsHex: '00180030ffff000a000100f0000000250026002700280029002a002b0000', category: 'xu' },
  { id: 7, name: 'Xoài', growMinutes: 24, value: 120, stageImages: [43, 44, 45, 46, 47, 48], attrsHex: '00180018ffff000a000100780000002b002c002d002e002f0030002c0000', category: 'xu' },
  { id: 8, name: 'Thanh long', growMinutes: 12, value: 63, stageImages: [49, 50, 51, 52, 53, 54], attrsHex: '0018000cffff000a0001003f0000003100320033003400350036002d0000', category: 'xu' },
  { id: 9, name: 'Hoa hướng dương', growMinutes: 12, value: 63, stageImages: [55, 56, 57, 58, 59, 60], attrsHex: '0018000cffff000a0001003f0000003700380039003a003b003c002e0000', category: 'xu' },
  { id: 10, name: 'Hoa tulip', growMinutes: 6, value: 36, stageImages: [61, 62, 63, 64, 65, 66], attrsHex: '00180006ffff000a000100240000003d003e003f004000410042002f0000', category: 'xu' },
  { id: 30, name: 'Bắp', growMinutes: 24, value: 1440, stageImages: [169, 170, 171, 172, 173, 174], attrsHex: '0018000affff000a000105a0000000a900aa00ab00ac00ad00ae00430000', category: 'premium' },
  { id: 31, name: 'Nha đam', growMinutes: 2, value: 120, stageImages: [175, 176, 177, 178, 179, 180], attrsHex: '0002000affff000a00010078000000af00b000b100b200b300b400440000', category: 'premium' },
  { id: 43, name: 'Dưa Leo', growMinutes: 2, value: 120, stageImages: [247, 248, 249, 250, 251, 252], attrsHex: '0002000affff000a00010078000000f700f800f900fa00fb00fc00500000', category: 'premium' },
  { id: 32, name: 'Cà tìm', growMinutes: 3, value: 180, stageImages: [181, 182, 183, 184, 185, 186], attrsHex: '0003000affff000a000100b4000000b500b600b700b800b900ba00450000', category: 'premium' },
  { id: 34, name: 'Tỏi', growMinutes: 4, value: 240, stageImages: [193, 194, 195, 196, 197, 198], attrsHex: '0004000affff000a000100f0000000c100c200c300c400c500c600470000', category: 'premium' },
  { id: 35, name: 'Dâu Tây', growMinutes: 5, value: 300, stageImages: [199, 200, 201, 202, 203, 204], attrsHex: '0005000affff000a0001012c000000c700c800c900ca00cb00cc00480000', category: 'premium' },
  { id: 36, name: 'Chuối', growMinutes: 8, value: 480, stageImages: [205, 206, 207, 208, 209, 210], attrsHex: '0008000affff000a000101e0000000cd00ce00cf00d000d100d200490000', category: 'premium' },
  { id: 39, name: 'Cúc Chuồn Chuồn', growMinutes: 2, value: 120, stageImages: [223, 224, 225, 226, 227, 228], attrsHex: '0002000affff000a00010078000000df00e000e100e200e300e4004c0000', category: 'premium' },
  { id: 41, name: 'Bí Ngô', growMinutes: 2, value: 120, stageImages: [235, 236, 237, 238, 239, 240], attrsHex: '0002000affff000a00010078000000eb00ec00ed00ee00ef00f0004e0000', category: 'premium' },
  { id: 42, name: 'Khoai Tây', growMinutes: 6, value: 360, stageImages: [241, 242, 243, 244, 245, 246], attrsHex: '0006000affff000a00010168000000f100f200f300f400f500f6004f0000', category: 'premium' },
  { id: 44, name: 'Ớt', growMinutes: 1, value: 60, stageImages: [253, 254, 255, 256, 257, 258], attrsHex: '0001000affff000a0001003c000000fd00fe00ff01000101010200510000', category: 'premium' },
  { id: 111, name: 'Ớt hiểm', growMinutes: 1, value: 60, stageImages: [253, 254, 255, 256, 257, 258], attrsHex: '0001000affff000a0001003c000000fd00fe00ff01000101010200510000', category: 'premium' },
  { id: 45, name: 'Cải Thảo', growMinutes: 4, value: 240, stageImages: [259, 260, 261, 262, 263, 264], attrsHex: '0004000affff000a000100f0000001030104010501060107010800520000', category: 'premium' },
  { id: 46, name: 'Nhân Sâm', growMinutes: 4, value: 240, stageImages: [265, 266, 267, 268, 269, 270], attrsHex: '0004000affff000a000100f000000109010a010b010c010d010e00530000', category: 'premium' },
  { id: 47, name: 'Hoa Tam Giác Mạch', growMinutes: 3, value: 180, stageImages: [271, 272, 273, 274, 275, 276], attrsHex: '0003000affff000a000100b40000010f0110011101120113011400540000', category: 'premium' },
  { id: 48, name: 'Cây Dừa', growMinutes: 48, value: 2880, stageImages: [277, 278, 279, 280, 281, 282], attrsHex: '0030000affff000a00010b40000001150116011701180119011a00550000', category: 'premium' },
];

export const DEFAULT_ITEM_CATALOG: ItemInfo[] = [
  { id: 111, icon: 235, type: 2, name: 'Phân bón trung cấp', price: 7 },
  { id: 112, icon: 197, type: 2, name: 'Phân bón siêu cấp', price: 10 },
  { id: 116, icon: 322, type: 1029, name: 'Thức ăn thủy sản', price: 1 },
  { id: 117, icon: 322, type: 261, name: 'Thức ăn gia cầm', price: 1 },
  { id: 118, icon: 324, type: 517, name: 'Thức ăn gia súc', price: 1 },
  { id: 119, icon: 325, type: 773, name: 'Thưc ăn cho chó', price: 1 },
  { id: 120, icon: 321, type: 25604, name: 'Thuốc cúm', price: 10 },
  { id: 121, icon: 320, type: 25604, name: 'Thuốc tiêu chảy', price: 10 },
  { id: 122, icon: 319, type: 25862, name: 'Thuốc bổ', price: 25 },
  { id: 123, icon: 318, type: 3, name: 'Thuốc diệt cỏ', price: 5 },
  { id: 124, icon: 317, type: 7, name: 'Thuốc trừ sâu', price: 5 },
];

export const DEFAULT_ANIMAL_CATALOG: AnimalInfo[] = [
  {
    id: 50,
    name: 'Gà',
    desc: 'Thời gian lớn : 1 ngày - Bán : 950 xu - 1 đơn vị nông trại - Sản phẩm : 20 trứng gà sau mỗi 6 giờ - Giá sản phẩm 10 xu / Trứng Gà - Thời gian sống: 7 ngày\r\n',
  },
  {
    id: 51,
    name: 'Bò',
    desc: 'Thời gian lớn : 3 ngày - Bán : 2000 xu - 3 đơn vị nông trại - Sản phẩm : 30 sữa bò sau mỗi 6 giờ - Giá sản phẩm 20 xu / Sữa Bò - Thời gian sống: 30 ngày',
  },
  {
    id: 52,
    name: 'Heo',
    desc: 'Thời gian lớn : 2 ngày - Bán : 2000 xu - 2 đơn vị nông trại- Không  có sản phẩm - Thời gian sống: 20 ngày',
  },
  {
    id: 53,
    name: 'Chó',
    desc: 'Giữ nhà chống trộm - Thời gian sống: 15 ngày',
  },
  {
    id: 54,
    name: 'Cá chép',
    desc: 'Thời gian lớn : 3 ngày - Bán : 10000 xu - 1 đơn vị hồ cá - Không có sản phẩm - Thời gian sống: 30 ngày',
  },
  {
    id: 55,
    name: 'Vịt',
    desc: 'Thời gian lớn : 2 ngày - Bán : 1200 xu - 1 đơn vị nông trại - Sản phẩm : 20 trứng vịt sau mỗi 6 giờ - Giá sản phẩm 10 xu / Trứng Vịt - Thời gian sống: 7 ngày',
  },
  {
    id: 56,
    name: 'Cừu',
    desc: 'Thời gian lớn : 2 ngày - Bán : 1500 xu - 3 đơn vị nông trại - Sản phẩm : 20 lông cừu sau mỗi 12 giờ - Giá sản phẩm 30 xu / Lông Cừu - Thời gian sống: 10 ngày',
  },
  {
    id: 57,
    name: 'Mèo Tinh Ranh',
    desc: 'Tinh Ranh - Hỗ trợ trộm nông trại- Thời gian sống: 15 ngày',
  },
  {
    id: 58,
    name: 'Trâu',
    desc: 'Thời gian lớn : 3 ngày - Bán : 3000 xu - 2 đơn vị nông trại- Không  có sản phẩm - Thời gian sống: 30 ngày',
  },
  {
    id: 59,
    name: 'Rùa',
    desc: 'Thời gian lớn : 1 ngày - Bán : 5000 xu - 1 đơn vị hồ cá - Không có sản phẩm - Thời gian sống: 15 ngày',
  },
  {
    id: 60,
    name: 'Dê',
    desc: 'Thời gian lớn : 1 ngày - Bán : 3000 xu - 2 đơn vị nông trại - Sản phẩm : 40 sữa dê sau mỗi 4 giờ - Giá sản phẩm 60 xu / Sữa dê - Thời gian sống: 10 ngày',
  },
  {
    id: 61,
    name: 'Thỏ',
    desc: 'Thời gian lớn : 2 ngày - Bán : 4000 xu - 2 đơn vị nông trại- Không  có sản phẩm - Thời gian sống: 10 ngày. Yêu cầu khi mua : 24 ô đất',
  },
];
