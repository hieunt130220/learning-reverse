# Default System Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu bảng cây (27 loài), bảng vật phẩm (11 món), bảng vật nuôi (12 loài) và bảng món ăn (35 món) làm dữ liệu mặc định của hệ thống, khởi tạo sẵn cho GameClient và RuntimeCache, loại bỏ hoàn toàn các yêu cầu `getTreeInfo` tự động khi vào farm và khi chạy auto farm.

**Architecture:** Tạo module `defaultCatalogs.ts` chứa các hằng số typed chuẩn (`DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG`) và đồng bộ `DEFAULT_SEED_CATALOG`. Gán trực tiếp vào khởi tạo của `GameClient` và `emptyRuntimeSnapshot()`, bỏ lệnh `this.farm.getTreeInfo()` ở handler cmd 69/61 và tối ưu `fetchTreeCatalog()` trong `AutoFarm` trả về ngay lập tức không trễ.

**Tech Stack:** TypeScript (ESM, strict types), Node.js test runner (`node --test`), EventEmitter, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-14-default-system-catalogs-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD: không tạo thêm test file mới, không dùng test-first.
- Sử dụng GitNexus: chạy `impact` trước khi chỉnh sửa symbol và `detect_changes` trước khi commit.
- Giữ nguyên handler `case 76` trong `client.ts` để tương thích ngược khi có probe thủ công.
- Tất cả 274 unit tests hiện tại trong `avatar-web/server` phải tiếp tục pass 100%.

---

### Task 1: Tạo module `defaultCatalogs.ts` và đồng bộ nguồn dữ liệu cây trồng

**Files:**
- Create: `avatar-web/server/src/game/defaultCatalogs.ts`
- Modify: `avatar-web/server/src/game/farmData.ts:513-526, 732-740, 883-888`
- Modify: `avatar-web/server/src/accounts/defaultSeedCatalog.ts:1-42`

**Interfaces:**
- Consumes: `TreeInfo`, `ItemInfo`, `AnimalInfo` từ `avatar-web/server/src/game/farmData.ts`.
- Produces: `DEFAULT_TREE_CATALOG: TreeInfo[]`, `DEFAULT_ITEM_CATALOG: ItemInfo[]`, `DEFAULT_ANIMAL_CATALOG: AnimalInfo[]` từ `avatar-web/server/src/game/defaultCatalogs.ts`.

- [ ] **Step 1: Tạo file `avatar-web/server/src/game/defaultCatalogs.ts`**

Viết file `defaultCatalogs.ts` chứa 27 cây, 11 vật phẩm và 12 vật nuôi chuẩn hóa từ `shop-catalog.json`:

```typescript
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
```

- [ ] **Step 2: Re-export từ `avatar-web/server/src/game/farmData.ts`**

Trong `farmData.ts`, export `DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG` từ `defaultCatalogs.js`.

- [ ] **Step 3: Đồng bộ `DEFAULT_SEED_CATALOG` trong `defaultSeedCatalog.ts`**

Trong `avatar-web/server/src/accounts/defaultSeedCatalog.ts`, ánh xạ trực tiếp từ `DEFAULT_TREE_CATALOG`:

```typescript
import type { CachedSeed } from './farmProfileRepo.js';
import { DEFAULT_TREE_CATALOG } from '../game/defaultCatalogs.js';

export const DEFAULT_SEED_CATALOG: CachedSeed[] = DEFAULT_TREE_CATALOG.map((t) => ({
  id: t.id,
  name: t.name,
  growMinutes: t.growMinutes,
  value: t.value,
}));

export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
```

- [ ] **Step 4: Kiểm tra và verify Task 1**
Run: `npm test --prefix avatar-web/server`
Expected: 274 pass, 0 fail.

- [ ] **Step 5: Phân tích GitNexus và Commit Task 1**
Run: `detect_changes({ scope: "all", repo: "learning-reverse" })`
Run: `git commit -m "feat(catalogs): add default system catalogs for trees, items, animals and sync seed catalog"`

---

### Task 2: Cập nhật `emptyRuntimeSnapshot` và `GameClient`

**Files:**
- Modify: `avatar-web/server/src/session/runtimeCache.ts:28-42`
- Modify: `avatar-web/server/src/game/client.ts:346-354, 1660-1666`

**Interfaces:**
- Consumes: `DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG`, `DEFAULT_FOOD_CATALOG`.
- Produces: `GameClient.trees`, `items`, `animals`, `foods` được điền sẵn; `emptyRuntimeSnapshot()` trả về 4 catalog mặc định.

- [ ] **Step 1: Cập nhật `emptyRuntimeSnapshot` trong `runtimeCache.ts`**

Import `DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG` từ `../game/defaultCatalogs.js` và `DEFAULT_FOOD_CATALOG` từ `../game/farmData.js`.
Gán vào `emptyRuntimeSnapshot()`:

```typescript
export function emptyRuntimeSnapshot(): CachedRuntimeSnapshot {
  return {
    quests: null,
    farm: null,
    inventory: [],
    farmProduce: [],
    cookingMaterials: [],
    trees: [...DEFAULT_TREE_CATALOG],
    items: [...DEFAULT_ITEM_CATALOG],
    animals: [...DEFAULT_ANIMAL_CATALOG],
    foods: [...DEFAULT_FOOD_CATALOG],
    cooking: null,
    capturedAt: null,
  };
}
```

- [ ] **Step 2: Cập nhật khởi tạo và handler trong `GameClient` (`client.ts`)**

1. Khởi tạo thuộc tính của `GameClient` (dòng 346-354):
```typescript
  /** Bảng cây trồng mặc định của hệ thống. */
  trees: TreeInfo[] = [...DEFAULT_TREE_CATALOG];
  /** Bảng vật phẩm mặc định của hệ thống. */
  items: ItemInfo[] = [...DEFAULT_ITEM_CATALOG];
  /** Bảng vật nuôi mặc định của hệ thống. */
  animals: AnimalInfo[] = [...DEFAULT_ANIMAL_CATALOG];
  /** Danh mục công thức mặc định của hệ thống (35 món). */
  foods: FoodRecipe[] = [...DEFAULT_FOOD_CATALOG];
  /** Luôn sẵn sàng vì đã có catalog mặc định của hệ thống. */
  foodCatalogReady = true;
```

2. Trong handler `case 69` / `case 61` (dòng 1660-1666), bỏ gọi `this.farm.getTreeInfo()`:
```typescript
      case 69: // JOIN — toàn bộ dữ liệu farm
      case 61: // cùng payload readFarmData
        try {
          this.farmState = decodeFarmData(msg.getData());
          // Thông tin bếp và nhiệm vụ ngày khi vào farm (catalog cây/vật phẩm/món ăn đã có sẵn mặc định)
          this.farm.getCook(0);
          this.farm.getDailyQuest(0);
          // Tự động tương tác với NPC Lái buôn để lấy hộp thoại nhiệm vụ tiến trình mới nhất
          void this.refreshProgressQuests();
```

- [ ] **Step 3: Kiểm tra và verify Task 2**
Run: `npm test --prefix avatar-web/server`
Expected: 274 pass, 0 fail.

- [ ] **Step 4: Phân tích GitNexus và Commit Task 2**
Run: `detect_changes({ scope: "all", repo: "learning-reverse" })`
Run: `git commit -m "feat(client): initialize GameClient and runtimeCache with default catalogs and remove auto getTreeInfo on join"`

---

### Task 3: Cập nhật `AutoFarm` và FakeClient trong unit tests

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:447-475`
- Modify: `avatar-web/server/src/autoFarm.test.ts:60-70, 405-425, 610-630`

**Interfaces:**
- Consumes: `GameClient.trees`, `items`, `animals` sẵn sàng.
- Produces: `fetchTreeCatalog()` return `false` tức thì khi catalog đã sẵn sàng.

- [ ] **Step 1: Cập nhật `fetchTreeCatalog` trong `autoFarm.ts`**

Đảm bảo `fetchTreeCatalog` kiểm tra nhanh trước khi log hay tạo Promise:
```typescript
  private async fetchTreeCatalog(
    needed: boolean,
    note: (line: string) => void,
  ): Promise<boolean> {
    if (!needed) return false;
    if (this.client.trees.length > 0
      && this.client.items.length > 0
      && this.client.animals.length > 0) {
      return false;
    }
    let received = false;
    let onTrees = (): void => {};
    const timeout = new AbortController();
    const catalogEvent = new Promise<void>((resolve) => {
      onTrees = (): void => {
        received = true;
        resolve();
      };
      this.client.once('trees', onTrees);
    });
    note('chờ catalog cây…');
    this.client.farm.getTreeInfo();
    await Promise.race([catalogEvent, this.catalogTimeout(timeout.signal)]);
    timeout.abort();
    if (!received) this.client.removeListener('trees', onTrees);
    return !received;
  }
```

- [ ] **Step 2: Cập nhật `FakeClient` trong `autoFarm.test.ts`**

Trong `autoFarm.test.ts`, cập nhật `FakeClient` khởi tạo `trees`, `items`, `animals` bằng `DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG` để đồng bộ với `GameClient` thật:
```typescript
  items: ItemInfo[] = [...DEFAULT_ITEM_CATALOG];
  trees: TreeInfo[] = [...DEFAULT_TREE_CATALOG];
  cookingState?: CookingState;
  foods: FoodRecipe[] = [...DEFAULT_FOOD_CATALOG];
  animals: AnimalInfo[] = [...DEFAULT_ANIMAL_CATALOG];
```
Đối với các test case đặc thù kiểm tra trường hợp client chưa có catalog (như `client.animals = []` để test catalog timeout hoặc chưa có bảng vật nuôi), giữ nguyên việc gán rỗng có chủ đích của test đó.

- [ ] **Step 3: Kiểm tra và verify Task 3**
Run: `npm test --prefix avatar-web/server`
Expected: Toàn bộ test suite pass 100%.

- [ ] **Step 4: Phân tích GitNexus và Commit Task 3**
Run: `detect_changes({ scope: "all", repo: "learning-reverse" })`
Run: `git commit -m "feat(autofarm): streamline fetchTreeCatalog with default catalogs and align test FakeClient"`

---

### Task 4: Build, TypeCheck và Verification toàn diện

**Files:**
- Verify: Toàn bộ workspace `avatar-web/server` và `avatar-web/web`.

- [ ] **Step 1: Chạy build và typecheck server**
Run: `npm run build --prefix avatar-web/server`
Expected: Compile TypeScript thành công, không có error hoặc type warning.

- [ ] **Step 2: Chạy build frontend web**
Run: `npm run build --prefix avatar-web/web`
Expected: Vite build frontend thành công.

- [ ] **Step 3: Chạy toàn bộ test suite server**
Run: `npm test --prefix avatar-web/server`
Expected: 274+ tests pass 100%.

- [ ] **Step 4: Kiểm tra GitNexus graph state**
Run: `detect_changes({ scope: "all", repo: "learning-reverse" })`
Expected: Trạng thái graph ổn định, không có xung đột hay broken process.
