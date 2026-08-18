# Kế Hoạch Triển Khai Chức Năng Xem & Quản Lý Nhiệm Vụ Nông Trại

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chức năng xem và quản lý nhiệm vụ nông trại toàn diện gồm Nhiệm vụ hàng ngày (kèm nhận thưởng/đổi nhiệm vụ/mở rương), Nhiệm vụ tân thủ và Nhiệm vụ chung trên avatar-web.

**Architecture:** Mở rộng giao thức mạng với gói `cmd -87 (sub=2)` cho Daily Quest, xây dựng bộ chuyển đổi và tổng hợp 3 nhóm nhiệm vụ vào `QuestOverviewState`, cung cấp REST API + WebSocket đồng bộ thời gian thực, tích hợp tuỳ chọn auto-claim vào AutoFarm Engine và tạo UI `QuestsPanel` với 3 Tab trực quan trong Drawer Vận hành tài khoản.

**Tech Stack:** Node.js, TypeScript, Express, React, Vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-08-18-farm-quests-viewer-design.md`

## Global Constraints
- Không áp dụng TDD (không viết test trước, không tạo file test trừ khi có yêu cầu).
- Tuân thủ quy tắc GitNexus: kiểm tra impact trước khi sửa và detect changes trước khi commit.
- Code TypeScript nghiêm ngặt, không dùng `any` bừa bãi, không dùng placeholder (`TODO`, `TBD`).

---

### Task 1: Protocol Decoder & Type Definitions (`farmData.ts` & `types.ts`)

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: `MyReader`, `TreeInfo`, `ItemInfo`, `InventoryItem`, `FarmState`, `CookingState`
- Produces:
  - `DailyMissionItem`, `DailyRewardItem`, `DailyBoxMilestone`, `DailyQuestState`
  - `BeginnerQuest`, `GeneralQuest`, `QuestOverviewState`
  - `decodeDailyQuestPacket(body: Buffer, current?: DailyQuestState | null): { action: number; state: DailyQuestState } | null`
  - `buildBeginnerQuests(...)`, `buildGeneralQuests(...)`

- [x] **Step 1: Khai báo types và hàm decode DailyQuest trong `farmData.ts`**

Bổ sung các interface và hàm decode gói tin `cmd -87 (sub=2)` vào `avatar-web/server/src/game/farmData.ts`:

```typescript
export interface DailyMissionItem {
  idItem: number;
  name: string;
  numRequired: number;
  numCurrent: number;
  isDone: boolean;
  iconId?: number;
}

export interface DailyRewardItem {
  type: number; // 0: xu, 1: lượng, 2: lượng khoá, 3: exp, 4: item, 5: potion
  name: string;
  amount: number;
  itemId?: number;
}

export interface DailyBoxMilestone {
  milestone: number; // 20, 40, 60, 80, 100
  isClaimed: boolean;
  canClaim: boolean;
}

export interface DailyQuestState {
  score: number;
  maxScore: number;
  boxDone: number;
  boxes: DailyBoxMilestone[];
  missions: DailyMissionItem[];
  rewards: DailyRewardItem[];
  typeMoneyChange: number;
  moneyChange: number;
  canChange: boolean;
  updatedAt: number;
}

export interface BeginnerQuest {
  id: string;
  title: string;
  description: string;
  category: 'farming' | 'cattle' | 'cooking' | 'social';
  target: number;
  current: number;
  isDone: boolean;
  rewardText: string;
}

export interface GeneralQuest {
  id: string;
  title: string;
  description: string;
  category: 'land_upgrade' | 'storage' | 'barn_pond' | 'kitchen_slot';
  level: number;
  target: number;
  current: number;
  isDone: boolean;
  rewardText: string;
}

export interface QuestOverviewState {
  daily: DailyQuestState | null;
  beginner: BeginnerQuest[];
  general: GeneralQuest[];
  updatedAt: number;
}

export function decodeDailyQuestPacket(
  data: Buffer,
  current?: DailyQuestState | null,
): { action: number; state: DailyQuestState } | null {
  const r = new MyReader(data);
  const subAction = r.readByte(); // 0: show, 1: change, 2: done, 3: getbox

  if (subAction === 0) {
    const curScore = r.readInt();
    const boxDone = r.readByte();

    // Decode missions (vecNhiemvu)
    const nMission = r.readByte();
    const missions: DailyMissionItem[] = [];
    for (let i = 0; i < nMission; i++) {
      const idItem = r.readShort();
      const num = r.readInt();
      missions.push({
        idItem,
        name: getProduceOrItemName(idItem),
        numRequired: num,
        numCurrent: 0,
        isDone: false,
      });
    }

    // Decode rewards (vecPhanthuong)
    const nReward = r.readByte();
    const rewards: DailyRewardItem[] = [];
    for (let i = 0; i < nReward; i++) {
      const type = r.readByte();
      let itemId: number | undefined;
      if (type === 4) {
        itemId = r.readShort();
      }
      const amount = r.readInt();
      rewards.push({
        type,
        name: getRewardTypeName(type, itemId),
        amount,
        itemId,
      });
    }

    const typeMoneyChange = r.readByte();
    const moneyChange = r.readInt();

    const MILESTONES = [20, 40, 60, 80, 100];
    const boxes: DailyBoxMilestone[] = MILESTONES.map((m, idx) => {
      const isClaimed = (boxDone & (1 << idx)) !== 0;
      return {
        milestone: m,
        isClaimed,
        canClaim: !isClaimed && curScore >= m,
      };
    });

    return {
      action: subAction,
      state: {
        score: curScore,
        maxScore: 100,
        boxDone,
        boxes,
        missions,
        rewards,
        typeMoneyChange,
        moneyChange,
        canChange: typeMoneyChange >= 0,
        updatedAt: Date.now(),
      },
    };
  }

  return null;
}

export function buildBeginnerQuests(
  farm?: FarmState | null,
  inventory?: InventoryItem[],
  produce?: InventoryItem[],
  cooking?: CookingState | null,
  metrics?: { farmLevel?: number; playerLevel?: number },
): BeginnerQuest[] {
  const numCells = farm?.cells.length ?? 0;
  const numAnimals = farm?.animals.length ?? 0;
  const numCookSlots = cooking?.numSlot ?? 0;
  const farmLevel = metrics?.farmLevel ?? 1;

  return [
    {
      id: 'bg_1',
      title: 'Khai hoang mở đất',
      description: 'Mở rộng nông trại đạt ít nhất 10 ô đất',
      category: 'farming',
      target: 10,
      current: Math.min(numCells, 10),
      isDone: numCells >= 10,
      rewardText: '500 Xu, 10 EXP',
    },
    {
      id: 'bg_2',
      title: 'Nông dân chăm chỉ',
      description: 'Đạt cấp độ nông trại cấp 3',
      category: 'farming',
      target: 3,
      current: Math.min(farmLevel, 3),
      isDone: farmLevel >= 3,
      rewardText: '1.000 Xu, 20 EXP',
    },
    {
      id: 'bg_3',
      title: 'Gầy dựng đàn vật nuôi',
      description: 'Nuôi ít nhất 2 vật nuôi trong chuồng hoặc ao',
      category: 'cattle',
      target: 2,
      current: Math.min(numAnimals, 2),
      isDone: numAnimals >= 2,
      rewardText: '1.500 Xu, 30 EXP',
    },
    {
      id: 'bg_4',
      title: 'Đầu bếp tập sự',
      description: 'Mở khóa và sử dụng nhà bếp nông trại',
      category: 'cooking',
      target: 1,
      current: numCookSlots > 0 ? 1 : 0,
      isDone: numCookSlots > 0,
      rewardText: '2.000 Xu, 1 Lượng khoá',
    },
  ];
}

export function buildGeneralQuests(
  farm?: FarmState | null,
  inventory?: InventoryItem[],
  produce?: InventoryItem[],
  cooking?: CookingState | null,
  metrics?: { farmLevel?: number; playerLevel?: number },
): GeneralQuest[] {
  const cells = farm?.cells ?? [];
  const upgradedCells = cells.filter((c) => (c.level ?? 0) > 0).length;
  const cookingMissions = cooking?.missions ?? [];

  const quests: GeneralQuest[] = [
    {
      id: 'gen_land_up',
      title: 'Quy hoạch đất cấp cao',
      description: 'Nâng cấp toàn bộ ô đất lên Đất Đỏ / Đất Cấp 2',
      category: 'land_upgrade',
      level: 2,
      target: cells.length || 48,
      current: upgradedCells,
      isDone: cells.length > 0 && upgradedCells >= cells.length,
      rewardText: 'Tăng 20% tốc độ lớn của cây trồng',
    },
    {
      id: 'gen_storage',
      title: 'Mở rộng sức chứa kho nông trại',
      description: 'Nâng cấp kho hàng để dự trữ nông sản và vật phẩm lớn hơn',
      category: 'storage',
      level: 1,
      target: 500,
      current: (inventory?.length ?? 0) + (produce?.length ?? 0),
      isDone: false,
      rewardText: 'Gia tăng sức chứa kho',
    },
  ];

  // Tích hợp nhiệm vụ mở ô bếp Master
  if (cookingMissions.length > 0) {
    const doneCount = cookingMissions.filter((m) => m.isDone).length;
    quests.push({
      id: 'gen_kitchen_master',
      title: 'Thử thách Bếp trưởng Master',
      description: `Hoàn thành các công thức nấu ăn đặc biệt để mở ô bếp cuối cùng (${doneCount}/${cookingMissions.length} món)`,
      category: 'kitchen_slot',
      level: 1,
      target: cookingMissions.length,
      current: doneCount,
      isDone: doneCount >= cookingMissions.length,
      rewardText: 'Mở vĩnh viễn Ô Bếp Master thứ 6',
    });
  }

  return quests;
}
```

- [x] **Step 2: Đồng bộ type definitions trong `avatar-web/web/src/types.ts`**

Thêm các interface `DailyMissionItem`, `DailyRewardItem`, `DailyBoxMilestone`, `DailyQuestState`, `BeginnerQuest`, `GeneralQuest`, `QuestOverviewState` vào `avatar-web/web/src/types.ts`.

- [x] **Step 3: Verify TypeScript build**
Run: `npm run build --prefix avatar-web/server && npm run build --prefix avatar-web/web`
Expected: Compile thành công không có lỗi type.

- [x] **Step 4: Commit**
`git commit -m "feat(game): add daily, beginner and general quest data structures and decoders"`

---

### Task 2: FarmService Sender & GameClient Message Handling (`farmService.ts`, `client.ts`)

**Files:**
- Modify: `avatar-web/server/src/game/farmService.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `Session`, `Message`, `decodeDailyQuestPacket`
- Produces:
  - `FarmService.getDailyQuest(type?: number): void`
  - `FarmService.changeDailyQuest(): void`
  - `FarmService.claimDailyQuest(): void`
  - `FarmService.claimDailyQuestBox(): void`
  - `GameClient.dailyQuestState: DailyQuestState | null`
  - `GameClient.onMessage` handling `cmd -87 (sub=2)`

- [x] **Step 1: Bổ sung các hàm gửi lệnh Daily Quest trong `farmService.ts`**

```typescript
  // ---- nhiệm vụ hàng ngày (cmd -87, byte đầu = sub-type 2) ----------------
  /** getDailyQuest — sub-type 2, type 0 = SHOW */
  getDailyQuest(type = 0): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(type));
  }

  /** changeDailyQuest — type 1 = CHANGE */
  changeDailyQuest(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(1));
  }

  /** claimDailyQuestReward — type 2 = DONE */
  claimDailyQuestReward(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(2));
  }

  /** claimDailyQuestBox — type 3 = GETBOX */
  claimDailyQuestBox(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(3));
  }
```

- [x] **Step 2: Đón gói `cmd -87 (sub=2)` và quản lý trạng thái nhiệm vụ trong `client.ts`**

Trong `avatar-web/server/src/game/client.ts`:
- Bổ sung property `dailyQuestState: DailyQuestState | null = null;`
- Trong `onMessage(msg)`:
  - Bắt gói `-87`: kiểm tra byte đầu nếu bằng `2` thì chuyển sang `decodeDailyQuestPacket`.
  - Cập nhật `this.dailyQuestState`, tính toán `numCurrent` từ kho `this.produce` và `this.inventory`.
  - Phát event `this.emit('quests', this.dailyQuestState)`.
  - Tự động gọi `this.farm.getDailyQuest(0)` trong handler `cmd 69 / JOIN` để nạp nhiệm vụ ngay khi vào farm.
- Expose các helper: `getDailyQuest()`, `changeDailyQuest()`, `claimDailyQuest()`, `claimDailyQuestBox()`.

- [x] **Step 3: Verify TypeScript build**
Run: `npm run build --prefix avatar-web/server`
Expected: Build thành công không có lỗi.

- [x] **Step 4: Commit**
`git commit -m "feat(game): add daily quest protocol sending and message handling in GameClient"`

---

### Task 3: Session State, AutoFarm Integration & REST API Routes (`avatarSession.ts`, `autoFarm.ts`, `session/routes.ts`)

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/autoFarm.ts`
- Modify: `avatar-web/server/src/session/routes.ts`

**Interfaces:**
- Consumes: `GameClient`, `DailyQuestState`, `buildBeginnerQuests`, `buildGeneralQuests`
- Produces:
  - `AccountSnapshot.quests: QuestOverviewState`
  - `AutoFarmConfig.autoClaimDailyQuests: boolean`
  - REST endpoints:
    - `GET /api/accounts/:id/quests`
    - `POST /api/accounts/:id/quests/daily/refresh`
    - `POST /api/accounts/:id/quests/daily/change`
    - `POST /api/accounts/:id/quests/daily/claim`
    - `POST /api/accounts/:id/quests/daily/box`

- [x] **Step 1: Bổ sung Quests vào Snapshot trong `avatarSession.ts`**

- Định nghĩa getter `getQuestOverview(): QuestOverviewState`:
  - Lấy `daily`: `this.client.dailyQuestState` (tự động cập nhật `numCurrent` và `isDone` theo số lượng nông sản hiện có trong `produce` và `inventory`).
  - Lấy `beginner`: gọi `buildBeginnerQuests(...)`.
  - Lấy `general`: gọi `buildGeneralQuests(...)`.
- Đưa `quests: this.getQuestOverview()` vào `getSnapshot()`.
- Lắng nghe `this.client.on('quests', () => this.emit('snapshot', this.getSnapshot()))`.

- [x] **Step 2: Tích hợp Auto-claim Daily Quest vào `autoFarm.ts`**

Trong `avatar-web/server/src/autoFarm.ts`:
- Thêm `autoClaimDailyQuests?: boolean;` vào `AutoFarmConfig` (mặc định `false`).
- Trong hàm chạy chu kỳ auto `runCycle()`:
  - Nếu `config.autoClaimDailyQuests === true`:
    - Kiểm tra `dailyQuestState`:
      - Nếu có nhiệm vụ chưa hoàn thành nhưng kho đã đủ số lượng nông sản yêu cầu: gửi `farm.claimDailyQuestReward()`.
      - Nếu có rương quà điểm năng động đủ điều kiện mở (`canClaim === true`): gửi `farm.claimDailyQuestBox()`.
    - Ghi nhận action vào log auto: `"tự động trả nhiệm vụ hàng ngày / mở rương quà"`.

- [x] **Step 3: Thêm các REST API Routes trong `session/routes.ts`**

Bổ sung các handler endpoint:
- `GET /api/accounts/:id/quests`: Trả về `session.getQuestOverview()`.
- `POST /api/accounts/:id/quests/daily/refresh`: Gọi `session.client.farm.getDailyQuest(0)`.
- `POST /api/accounts/:id/quests/daily/change`: Gọi `session.client.farm.changeDailyQuest()`.
- `POST /api/accounts/:id/quests/daily/claim`: Gọi `session.client.farm.claimDailyQuestReward()`.
- `POST /api/accounts/:id/quests/daily/box`: Gọi `session.client.farm.claimDailyQuestBox()`.

- [x] **Step 4: Verify TypeScript build**
Run: `npm run build --prefix avatar-web/server`
Expected: Build thành công không có lỗi.

- [x] **Step 5: Commit**
`git commit -m "feat(server): integrate quests into session snapshot, autofarm and rest routes"`

---

### Task 4: Frontend API & QuestsPanel UI Component (`api.ts`, `QuestsPanel.tsx`, `AccountOperationsDrawer.tsx`, `AutoFarmPanel.tsx`, `styles.css`)

**Files:**
- Modify: `avatar-web/web/src/api.ts`
- Create: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Modify: `avatar-web/web/src/styles.css`

**Interfaces:**
- Consumes: `QuestOverviewState`, `DailyQuestState`, `BeginnerQuest`, `GeneralQuest`
- Produces:
  - `QuestsPanel` React component
  - UI 3 Tabs: Hàng ngày, Tân thủ, Nhiệm vụ chung
  - Checkbox cấu hình `autoClaimDailyQuests` trong `AutoFarmPanel`

- [x] **Step 1: Bổ sung các API client methods trong `avatar-web/web/src/api.ts`**

```typescript
export async function fetchQuests(accountId: number): Promise<QuestOverviewState> {
  const res = await fetch(`/api/accounts/${accountId}/quests`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refreshDailyQuest(accountId: number): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/quests/daily/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function changeDailyQuest(accountId: number): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/quests/daily/change`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function claimDailyQuestReward(accountId: number): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/quests/daily/claim`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function claimDailyQuestBox(accountId: number): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/quests/daily/box`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}
```

- [x] **Step 2: Xây dựng UI component `QuestsPanel.tsx`**

Tạo `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`:
- Quản lý tab đang chọn: `daily` | `beginner` | `general`.
- **Tab Hàng ngày**:
  - Score Bar: Thanh tiến trình 0..100 sao với 5 điểm checkpoint rương (20, 40, 60, 80, 100).
  - Trạng thái rương: Đã mở (mờ/check), Có thể mở (phát sáng, nút "Mở"), Chưa đạt (khoá).
  - Danh sách nhiệm vụ: Tên, số lượng cần / hiện có trong kho, thanh % hoàn thành, phần thưởng (Xu, Lượng, Lượng khoá, EXP).
  - Nút "Nhận thưởng" (sáng xanh khi đủ điều kiện), nút "Đổi nhiệm vụ" (kèm phí hiển thị).
- **Tab Tân thủ**:
  - Danh sách checklist nhiệm vụ: Badge danh mục, mô tả, thanh tiến độ, phần thưởng, icon check hoàn thành.
- **Tab Nhiệm vụ chung**:
  - Danh sách thành tích phát triển nông trại: Quy hoạch đất cấp 2, Mở rộng kho, Thử thách bếp Master...
- Nút "Làm mới" trên header để fetch lại dữ liệu mới nhất từ server game.

- [x] **Step 3: Nhúng `QuestsPanel` vào `AccountOperationsDrawer.tsx`**

Bổ sung `QuestsPanel` vào danh sách panel hiển thị của `LoadedOperations`:
```tsx
<QuestsPanel accountId={account.id} quests={snapshot?.quests ?? null} />
```

- [x] **Step 4: Bổ sung tuỳ chọn Auto-claim vào `AutoFarmPanel.tsx`**

Thêm checkbox trong bảng cấu hình `AutoFarmPanel`:
```tsx
<label className="checkbox-row">
  <input
    type="checkbox"
    checked={config.autoClaimDailyQuests ?? false}
    onChange={(e) => updateConfig({ autoClaimDailyQuests: e.target.checked })}
  />
  <span>Tự động nhận thưởng nhiệm vụ hàng ngày & mở rương</span>
</label>
```

- [x] **Step 5: Thêm styling CSS trong `avatar-web/web/src/styles.css`**

Tạo style chuẩn đẹp cho `QuestsPanel`:
- Tabs navigation pill design.
- Score progress bar with star badges & milestone gift boxes with glowing effects.
- Mission cards with item tags, progress indicator, action buttons with hover states.
- Clean typography and mobile-responsive layout.

- [x] **Step 6: Verify Frontend Build**
Run: `npm run build --prefix avatar-web/web`
Expected: Build thành công không có lỗi syntax hay styling.

- [x] **Step 7: Commit**
`git commit -m "feat(web): add QuestsPanel component and autofarm quest settings"`

---

### Task 5: Complete Verification & End-to-End Checks

**Files:**
- None (Toàn bộ project)

- [x] **Step 1: Run Full Project Typecheck & Build**
Run: `npm run build --prefix avatar-web/server && npm run build --prefix avatar-web/web`
Expected: Cả Server và Web Client biên dịch thành công 100% không có lỗi.

- [x] **Step 2: Commit All Clean State**
`git commit -m "chore: complete farm quests viewer implementation"`
