# Sửa hiển thị Nhiệm Vụ cho tài khoản farm level 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Với tài khoản `farmLevel >= 2`, hiển thị Tân Thủ / Nhà Nông là "Đã hoàn thành" (bỏ placeholder 0/200 gây hiểu lầm) và thêm tab 🚜 Nâng Cấp hiển thị yêu cầu nâng cấp nông trại thật (decode action=1).

**Architecture:** Server-side, trong `GameClient.syncProgressQuests()` thêm bước đánh dấu completed khi `farmLevel >= 2` (idempotent, guard `isQuestCompleted`). Decode thêm nhánh `action=1` trong `decodeProgressQuestPacket` → lưu `farmUpgradeRequirements` → expose qua `getQuestOverview()` (additive field). Web thêm tab 🚜 Nâng Cấp + banner "Đã hoàn thành" cho quest `source==='completed'`. Không tính toán từ FarmData — chỉ dùng dữ liệu server gửi (INVENTORY farmLevel + cmd 104).

**Tech Stack:** TypeScript, Node.js (tsx), Express (server); React + Vite (web).

**Spec:** `docs/superpowers/specs/2026-08-21-quest-display-level2-design.md`

## Global Constraints
- **Nguồn chân lý quest:** chỉ từ server packets (cmd 104) + farmLevel từ INVENTORY — **KHÔNG** tự tính từ FarmState/Inventory.
- **NO TDD:** không viết test trước, không tạo test files (trừ khi user yêu cầu rõ ràng).
- **GitNexus:** chạy `impact` trước khi sửa từng symbol; chạy `detect_changes` trước mỗi commit. `getQuestOverview` đang **CRITICAL** — thay đổi **chỉ additive** (thêm field nullable), không đổi signature.
- **Idempotent:** `markQuestCompleted` chạy lại nhiều lần không đổi state (`isQuestCompleted` guard).
- **Không đụng:** 3 file `*PlanEditor.tsx` (WIP sẵn của user), docs `default-close-plan-editors` (chủ đề khác).
- **Không đổi hành vi auto-farm / lệnh thu hoạch.**
- Commit theo từng task (convention repo: commit thẳng `main`).

---

### Task 1: progressQuests.ts — helpers completed + decode action=1

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`

**Interfaces:**
- Consumes: `MyReader` (đã có: `readBoolean`, `readShort`, `readInt`, `readUnsignedByte`), `MAX_REWARDS`.
- Produces: `FarmUpgradeRequirement`, `FarmUpgradeRequirements`, `markQuestCompleted`, `isQuestCompleted`, `getRequirementDisplayName`, status `'ok-upgrade'`.

- [ ] **Step 1: Mở rộng union `source` + thêm 2 interface mới**
  Thay dòng 28:
  ```ts
  source: 'game-dialog' | 'game-packet' | 'default' | 'completed';
  ```
  Thêm sau `ProgressQuestChain` (sau dòng 30):
  ```ts
  export interface FarmUpgradeRequirement {
    type: number;         // 1=FARM,2=SLOT_LAND,3=COOKING,4=BARN,5=POND,6=XU,7=PRODUCT,8=LUONG,9=POTION
    idFarm?: number;      // chỉ type 7/9
    request: number;      // yêu cầu
    inStorage: number;    // đang có
    displayName: string;
  }

  export interface FarmUpgradeRequirements {
    imageId: number;
    requirements: FarmUpgradeRequirement[];
  }
  ```

- [ ] **Step 2: Thêm `getRequirementDisplayName`** (đặt cạnh `getRewardDisplayName`, sau dòng 94):
  ```ts
  export function getRequirementDisplayName(type: number, idFarm?: number): string {
    switch (type) {
      case 1: return 'Nâng cấp Nông Trại';
      case 2: return 'Ô đất';
      case 3: return 'Ô bếp nấu ăn';
      case 4: return 'Chuồng trại';
      case 5: return 'Ao cá';
      case 6: return 'Xu';
      case 7: return idFarm !== undefined ? `Nông sản #${idFarm}` : 'Nông sản';
      case 8: return 'Lượng';
      case 9: return idFarm !== undefined ? `Thuốc #${idFarm}` : 'Thuốc tăng trưởng';
      default: return `Yêu cầu #${type}`;
    }
  }
  ```

- [ ] **Step 3: Thêm 2 helper completed** (sau `syncQuestStateWithFarm`, cuối file):
  ```ts
  /** Đánh dấu chuỗi nhiệm vụ là đã hoàn thành (mọi điều kiện current=total, isDone=true). */
  export function markQuestCompleted(quest: ProgressQuestChain | null): ProgressQuestChain | null {
    if (!quest || !quest.conditions || quest.conditions.length === 0) return quest ?? null;
    return {
      ...quest,
      conditions: quest.conditions.map((c) => ({
        ...c,
        current: c.total,
        isDone: true,
      })),
      source: 'completed',
      updatedAt: Date.now(),
    };
  }

  export function isQuestCompleted(quest: ProgressQuestChain | null): boolean {
    return !!quest && quest.source === 'completed';
  }
  ```

- [ ] **Step 4: Mở rộng `ProgressQuestDecodeResult`** (thêm dòng vào union, sau dòng 48):
  ```ts
  | { status: 'ok-upgrade'; requirements: FarmUpgradeRequirements }
  ```

- [ ] **Step 5: Thay branch `action === 1`** (hiện trả `ignored`) bằng decode đầy đủ (dòng 297-300):
  ```ts
  // action = 1: InfoFarmScr — yêu cầu nâng cấp nông trại.
  // Format đã xác minh từ sample hex 249 byte:
  //   bool(1) + 7 short(14) + count(1) + count×[type(1), (idFarm(4) nếu 7/9), request(4), inStorage(4)]
  if (action === 1) {
    if (r.available() < 1) {
      return { status: 'unsupported', reason: 'payload action=1 thiếu byte bool', remainingHex: data.toString('hex') };
    }
    r.readBoolean(); // có danh sách hay không (sample = true)
    if (r.available() < 14) {
      return { status: 'unsupported', reason: 'payload action=1 thiếu 7 short header', remainingHex: data.toString('hex') };
    }
    const imageId = r.readShort();
    for (let i = 0; i < 6; i++) r.readShort(); // 6 short còn lại (chưa dùng)
    if (r.available() < 1) {
      return { status: 'unsupported', reason: 'payload action=1 thiếu byte count', remainingHex: data.toString('hex') };
    }
    const reqCount = r.readUnsignedByte();
    if (reqCount < 0 || reqCount > MAX_REWARDS) {
      return { status: 'unsupported', reason: `reqCount action=1 không hợp lệ: ${reqCount}`, remainingHex: data.toString('hex') };
    }
    const requirements: FarmUpgradeRequirement[] = [];
    for (let i = 0; i < reqCount; i++) {
      if (r.available() < 1) {
        return { status: 'unsupported', reason: `thiếu byte type yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
      }
      const type = r.readByte();
      let idFarm: number | undefined;
      if (type === 7 || type === 9) {
        if (r.available() < 12) {
          return { status: 'unsupported', reason: `thiếu byte idFarm/request/inStorage yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
        }
        idFarm = r.readInt();
      } else {
        if (r.available() < 8) {
          return { status: 'unsupported', reason: `thiếu byte request/inStorage yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
        }
      }
      const request = r.readInt();
      const inStorage = r.readInt();
      requirements.push({ type, idFarm, request, inStorage, displayName: getRequirementDisplayName(type, idFarm) });
    }
    return { status: 'ok-upgrade', requirements: { imageId, requirements } };
  }
  ```

- [ ] **Step 6: Verify** — type-check không lỗi:
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
  ```
  Expected: không lỗi TS ở `progressQuests.ts` (lỗi khác file do bước sau — bỏ qua tạm).

- [ ] **Step 7: Commit**
  `git add avatar-web/server/src/game/progressQuests.ts && git commit -m "feat(quest): decode action=1 thành yêu cầu nâng cấp nông trại + helper markQuestCompleted"`

---

### Task 2: farmData.ts — mở rộng `QuestOverviewState` + re-export type mới

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:1773-1792`

**Interfaces:**
- Consumes: `FarmUpgradeRequirement`, `FarmUpgradeRequirements` từ progressQuests.js.
- Produces: `QuestOverviewState.upgradeRequirements?`.

- [ ] **Step 1: Thêm import + re-export 2 type mới** (dòng 1773-1785):
  ```ts
  import type {
    ProgressQuestChain,
    ProgressQuestCondition,
    ProgressQuestReward,
    ProgressQuestKind,
    FarmUpgradeRequirement,
    FarmUpgradeRequirements,
  } from './progressQuests.js';

  export type {
    ProgressQuestChain,
    ProgressQuestCondition,
    ProgressQuestReward,
    ProgressQuestKind,
    FarmUpgradeRequirement,
    FarmUpgradeRequirements,
  };
  ```

- [ ] **Step 2: Thêm field optional `upgradeRequirements`** (dòng 1787-1792):
  ```ts
  export interface QuestOverviewState {
    daily: DailyQuestState | null;
    beginner: ProgressQuestChain | null;
    farmer: ProgressQuestChain | null;
    upgradeRequirements?: FarmUpgradeRequirements | null;
    updatedAt: number;
  }
  ```

- [ ] **Step 3: Verify**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "farmData" | head
  ```
  Expected: không lỗi TS liên quan `farmData.ts`.

- [ ] **Step 4: Commit**
  `git add avatar-web/server/src/game/farmData.ts && git commit -m "feat(quest): thêm upgradeRequirements vào QuestOverviewState"`

---

### Task 3: client.ts — đánh dấu quest completed + lưu upgradeRequirements + xử lý ok-upgrade

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:41` (import), `:182` (property), `:490-520` (syncProgressQuests), `:816-841` (cmd 104 handler)

**Interfaces:**
- Consumes: `markQuestCompleted`, `isQuestCompleted`, `FarmUpgradeRequirements` (đã có từ Task 1).
- Produces: `client.farmUpgradeRequirements`, `syncProgressQuests()` đánh dấu completed khi farmLevel ≥ 2.

- [ ] **Step 1: Bổ sung import** (dòng 41 — đang import từ `./progressQuests.js`):
  ```ts
  import {
    decodeProgressQuestPacket,
    syncQuestStateWithFarm,
    DEFAULT_BEGINNER_QUEST_STATE,
    DEFAULT_FARMER_QUEST_STATE,
    markQuestCompleted,
    isQuestCompleted,
    type FarmUpgradeRequirements,
  } from './progressQuests.js';
  ```

- [ ] **Step 2: Thêm property `farmUpgradeRequirements`** (sau `farmLevel`, dòng 182):
  ```ts
  /** Yêu cầu nâng cấp nông trại (decode action=1 của cmd 104). */
  farmUpgradeRequirements?: FarmUpgradeRequirements | null;
  ```

- [ ] **Step 3: Thêm private method `markQuestsCompletedForFarmLevel`** (đặt ngay trên `syncProgressQuests`, trước dòng 490):
  ```ts
  /** Đánh dấu Tân Thủ/Nhà Nông là đã hoàn thành khi farm level ≥ 2 (quest là nội dung level 1→2). */
  private markQuestsCompletedForFarmLevel(): boolean {
    if (this.farmLevel === undefined || this.farmLevel < 2) return false;
    let changed = false;
    if (this.beginnerQuestState && !isQuestCompleted(this.beginnerQuestState)) {
      this.beginnerQuestState = markQuestCompleted(this.beginnerQuestState);
      changed = true;
    }
    if (this.farmerQuestState && !isQuestCompleted(this.farmerQuestState)) {
      this.farmerQuestState = markQuestCompleted(this.farmerQuestState);
      changed = true;
    }
    return changed;
  }
  ```

- [ ] **Step 4: Gọi ở đầu `syncProgressQuests()`** (dòng 490-491):
  ```ts
  syncProgressQuests(): boolean {
    let changed = this.markQuestsCompletedForFarmLevel();
    // ... giữ nguyên logic syncQuestStateWithFarm bên dưới (đã dùng biến `changed`)
  ```

- [ ] **Step 5: Xử lý `ok-upgrade` trong handler cmd 104** (chèn trước nhánh `res.status === 'ok'`, dòng 822):
  ```ts
  if (res.status === 'ok-upgrade') {
    this.farmUpgradeRequirements = res.requirements;
    this.emit(
      'log',
      `cập nhật yêu cầu nâng cấp nông trại: ${res.requirements.requirements.length} mục (imageId=${res.requirements.imageId})`,
    );
    this.emit('quests');
  } else if (res.status === 'ok') {
  ```

- [ ] **Step 6: Verify**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "client.ts" | head
  ```
  Expected: không lỗi TS liên quan `client.ts`.

- [ ] **Step 7: Commit**
  `git add avatar-web/server/src/game/client.ts && git commit -m "feat(quest): đánh dấu quest hoàn thành khi farmLevel>=2 + lưu yêu cầu nâng cấp từ action=1"`

---

### Task 4: farmService.ts — fix `getInfoUpgradeFarm` gửi luôn 2 byte

**Files:**
- Modify: `avatar-web/server/src/game/farmService.ts:63-71`

**Interfaces:**
- Consumes: — (không đổi interface gọi: `getInfoUpgradeFarm(type, idType=-1)`).
- Produces: wire `[i8 type, i8 idType]` luôn 2 byte như client thật.

- [ ] **Step 1: Sửa body** (dòng 63-71):
  ```ts
  /** getInfoUpgradeFarm @0x5d405c — luôn gửi 2 byte (i8 type, i8 idType) như client thật. */
  getInfoUpgradeFarm(type: number, idType = -1): void {
    this.send(104, (m) => m.writer!.writeByte(type).writeByte(idType));
  }
  ```

- [ ] **Step 2: Verify**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "farmService" | head
  ```
  Expected: không lỗi TS.

- [ ] **Step 3: Commit**
  `git add avatar-web/server/src/game/farmService.ts && git commit -m "fix(farm): getInfoUpgradeFarm gửi đủ 2 byte [type, idType] như client thật"`

---

### Task 5: avatarSession.ts — expose `upgradeRequirements` qua `getQuestOverview`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:206-226`

**Interfaces:**
- Consumes: `client.farmUpgradeRequirements` (Task 3).
- Produces: `QuestOverviewState.upgradeRequirements?` (additive).

> ⚠️ `getQuestOverview` = CRITICAL theo GitNexus. Thay đổi CHỈ thêm 1 field nullable — không đổi signature, không đổi hành vi cũ.

- [ ] **Step 1: Sửa `getQuestOverview()`** (dòng 206-226):
  ```ts
  getQuestOverview(): QuestOverviewState {
    const c = this.client;
    if (typeof c?.syncProgressQuests === 'function') {
      c.syncProgressQuests();
    }
    const daily = c?.dailyQuestState ?? null;
    const beginner = c?.beginnerQuestState ?? null;
    const farmer = c?.farmerQuestState ?? null;
    const upgradeRequirements = c?.farmUpgradeRequirements ?? null;
    const updatedAt = Math.max(
      daily?.updatedAt ?? 0,
      beginner?.updatedAt ?? 0,
      farmer?.updatedAt ?? 0,
    ) || Date.now();

    return {
      daily,
      beginner,
      farmer,
      upgradeRequirements,
      updatedAt,
    };
  }
  ```

- [ ] **Step 2: Verify**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "avatarSession" | head
  ```
  Expected: không lỗi TS.

- [ ] **Step 3: Commit**
  `git add avatar-web/server/src/session/avatarSession.ts && git commit -m "feat(quest): expose upgradeRequirements qua GET /:id/quests"`

---

### Task 6: web/types.ts — đồng bộ type

**Files:**
- Modify: `avatar-web/web/src/types.ts:160-193`

**Interfaces:**
- Consumes: — (nhân bản type server).
- Produces: `FarmUpgradeRequirement`, `FarmUpgradeRequirements`, `QuestOverviewState.upgradeRequirements?`, source `'completed'`.

- [ ] **Step 1: Thêm source `'completed'`** (dòng 184):
  ```ts
  source: 'game-dialog' | 'game-packet' | 'default' | 'completed';
  ```

- [ ] **Step 2: Thêm 2 interface** (sau `ProgressQuestChain`, dòng 186):
  ```ts
  export interface FarmUpgradeRequirement {
    type: number;
    idFarm?: number;
    request: number;
    inStorage: number;
    displayName: string;
  }

  export interface FarmUpgradeRequirements {
    imageId: number;
    requirements: FarmUpgradeRequirement[];
  }
  ```

- [ ] **Step 3: Thêm field optional vào `QuestOverviewState`** (dòng 188-193):
  ```ts
  export interface QuestOverviewState {
    daily: DailyQuestState | null;
    beginner: ProgressQuestChain | null;
    farmer: ProgressQuestChain | null;
    upgradeRequirements?: FarmUpgradeRequirements | null;
    updatedAt: number;
  }
  ```

- [ ] **Step 4: Verify**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "types.ts" | head
  ```
  Expected: không lỗi TS.

- [ ] **Step 5: Commit**
  `git add avatar-web/web/src/types.ts && git commit -m "feat(quest): đồng bộ type upgradeRequirements + source completed (web)"`

---

### Task 7: QuestsPanel.tsx — tab 🚜 Nâng Cấp + banner "Đã hoàn thành"

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`
- Modify: `avatar-web/web/src/styles.css` *(chỉ nếu thiếu class — kiểm tra ở bước 4)*

**Interfaces:**
- Consumes: `FarmUpgradeRequirements`, `QuestOverviewState.upgradeRequirements` (Task 6), `ProgressQuestChain.source`.
- Produces: tab UI + banner.

- [ ] **Step 1: Import type + mở rộng union tab** (đầu file):
  ```ts
  import type { QuestOverviewState, ProgressQuestChain, FarmUpgradeRequirements } from '../../types.js';

  type QuestTab = 'daily' | 'beginner' | 'farmer' | 'upgrade';
  ```
  Và đọc `upgrade` từ `effectiveQuests` (cạnh dòng 40):
  ```ts
  const upgrade = effectiveQuests?.upgradeRequirements ?? null;
  ```

- [ ] **Step 2: Thêm nút tab 🚜 Nâng Cấp** (sau nút 🌾 Nhà Nông, dòng 200):
  ```tsx
  <button
    type="button"
    className={`quests-tab-btn ${activeTab === 'upgrade' ? 'active' : ''}`}
    onClick={() => setActiveTab('upgrade')}
  >
    🚜 Nâng Cấp
    {upgrade && upgrade.requirements.length > 0 && (
      <span className="tab-badge">{upgrade.requirements.length}</span>
    )}
  </button>
  ```

- [ ] **Step 3: Thêm tab content** (sau tab farmer, dòng 411):
  ```tsx
  {/* TAB 4: YÊU CẦU NÂNG CẤP NÔNG TRẠI */}
  {activeTab === 'upgrade' && (
    <UpgradeRequirementsSection requirements={upgrade} busy={busy} onRefresh={handleRefreshProgress} />
  )}
  ```

- [ ] **Step 4: Thêm component `UpgradeRequirementsSection`** (cuối file, sau `ProgressQuestSection`):
  ```tsx
  function UpgradeRequirementsSection({
    requirements,
    busy,
    onRefresh,
  }: {
    requirements: FarmUpgradeRequirements | null;
    busy: boolean;
    onRefresh: () => void;
  }) {
    if (!requirements || requirements.requirements.length === 0) {
      return (
        <div className="quests-empty-state">
          <span className="empty-icon">🚜</span>
          <p className="hint">Chưa có dữ liệu yêu cầu nâng cấp nông trại. Bấm tải để lấy từ game.</p>
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={busy}>
            🔄 Tải yêu cầu nâng cấp từ game
          </button>
        </div>
      );
    }
    return (
      <div className="progress-quest-section">
        <div className="progress-quest-header">
          <div className="progress-quest-title">
            <h4>Yêu Cầu Nâng Cấp Nông Trại</h4>
            <span className="badge badge--step">Cấp 2 → 3</span>
          </div>
          <span className="tab-pill">{requirements.requirements.length} mục</span>
        </div>
        <div className="progress-quest-conditions-list">
          {requirements.requirements.map((req, idx) => {
            const pct = req.request > 0 ? Math.min(100, Math.round((req.inStorage / req.request) * 100)) : 0;
            const done = req.inStorage >= req.request;
            return (
              <div key={idx} className={`mission-item-card ${done ? 'mission-item-card--done' : ''}`}>
                <div className="mission-item-header">
                  <div className="mission-item-title">
                    <span className="mission-bullet">{done ? '✅' : '📌'}</span>
                    <span className="mission-name">{req.displayName}</span>
                  </div>
                  <span className={`mission-badge ${done ? 'badge-success' : 'badge-pending'}`}>
                    {req.inStorage.toLocaleString('vi-VN')} / {req.request.toLocaleString('vi-VN')} ({pct}%)
                  </span>
                </div>
                <div className="mission-mini-bar">
                  <div
                    className={`mission-mini-bar-fill ${done ? 'bar-done' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  ```
  *Ghi chú style:* tái dùng các class có sẵn (`quests-empty-state`, `empty-icon`, `tab-badge`, `progress-quest-*`, `mission-item-*`). Kiểm tra `empty-icon` & `badge badge--step` tồn tại trong `styles.css` — nếu thiếu mới thêm rule.

- [ ] **Step 5: Thêm banner "Đã hoàn thành" trong `ProgressQuestSection`** (chèn sau khối header, trước `progress-quest-conditions-list`, dòng ~458):
  ```tsx
  {quest.source === 'completed' && (
    <div className="daily-completed-banner">
      <span className="banner-icon">🎉</span>
      <div className="banner-text">
        <h5>Đã hoàn thành chuỗi nhiệm vụ!</h5>
        <p>Tài khoản đã nâng cấp nông trại lên cấp 2 — nhiệm vụ này dành cho người mới (cấp 1 → 2).</p>
      </div>
    </div>
  )}
  ```

- [ ] **Step 6: Verify build web**
  ```bash
  cd /Users/devios/learning-reverse/avatar-web/web && npm run build 2>&1 | tail -5
  ```
  Expected: build thành công, không lỗi TS/rollup.

- [ ] **Step 7: Commit**
  `git add avatar-web/web/src/accounts/panels/QuestsPanel.tsx && git commit -m "feat(quest): tab Nâng Cấp + banner đã hoàn thành cho farm level 2"`

---

## Verification tổng thể (sau Task 7)

- [ ] **Manual (bắt buộc):** restart server + web, mở account **phu**:
  1. Tab 🐣 Tân Thủ / 🌾 Nhà Nông: banner xanh "Đã hoàn thành", mọi condition `current=total` (vd "Thu hoạch 200 cà chua 200/200"), **không còn** 0/200.
  2. Tab 🚜 Nâng Cấp: hiển thị 20 mục — `1.000.000 Xu (22.573)`, `500 Lượng (100)`, 12× `Nông sản #id (0/20)`, `Thuốc #4704 (0/1)`... với progress bar.
  3. Bấm **Làm mới tất cả**: không lỗi, số liệu nâng cấp cập nhật.
- [ ] **detect_changes trước commit cuối:** `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — chỉ chạm đúng các symbol trong plan.
- [ ] **Rollback:** revert từng commit (mỗi task 1 commit, độc lập, additive).
