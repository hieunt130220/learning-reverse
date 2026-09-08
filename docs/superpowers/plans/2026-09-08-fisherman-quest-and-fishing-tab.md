# Nhiệm Vụ Thợ Câu & Tích Hợp Tab Câu Cá Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng giao thức game client để tự động lấy và phân giải Nhiệm Vụ Thợ Câu (`userID = 38`), hiển thị tab Thợ Câu trong panel Nhiệm Vụ và tích hợp thẻ theo dõi tiến trình câu cá trong tab Câu Cá.

**Architecture:** Mở rộng `ProgressQuestKind` (`'fisherman'`) và `QuestOverviewState` (`fisherman`) từ backend ra frontend; cập nhật regex parser `parseQuestDialogText` và gửi truy vấn NPC 90 `userID = 38` qua `cmd -62` trong `GameClient.refreshProgressQuests()`; cập nhật `QuestsPanel.tsx` thêm tab "🎣 Thợ Câu" và `FishingPanel.tsx` thêm widget hiển thị trực tiếp tiến độ câu cá của nhiệm vụ.

**Tech Stack:** TypeScript, Node.js, React, Vite, CSS Modules / Stylesheet.

**Spec:** `docs/superpowers/specs/2026-09-08-fisherman-quest-and-fishing-tab-design.md`

## Global Constraints
- Tuân thủ quy trình Superpowers: KHÔNG thực hiện TDD, không tạo test files trừ khi được yêu cầu rõ ràng.
- Sử dụng GitNexus MCP tools trước khi sửa symbol (`gitnexus_impact`) và trước khi commit (`gitnexus_detect_changes`).
- Phân luồng state `cmd -62` chính xác theo `kind`: không ghi đè `fishermanQuestState` lên `farmerQuestState` hay `beginnerQuestState`.
- Tránh regression các chuỗi quest hiện tại (Tân Thủ `userID = 19`, Nhà Nông `userID = 35`, Nâng cấp farm `cmd 104`).

---

### Task 1: Server Domain Types & Parser cho Nhiệm Vụ Thợ Câu

**Files:**
- Modify: `avatar-web/server/src/game/progressQuests.ts`
- Modify: `avatar-web/server/src/game/farmData.ts`

**Interfaces:**
- Consumes: `ProgressQuestChain`, `ProgressQuestCondition`, `ProgressQuestReward`
- Produces:
  - `ProgressQuestKind`: `'beginner' | 'farmer' | 'fisherman'`
  - `QuestOverviewState.fisherman`: `ProgressQuestChain | null`
  - `DEFAULT_FISHERMAN_QUEST_STATE`: `ProgressQuestChain`
  - `parseQuestDialogText(text: string)`: hỗ trợ `kind: 'fisherman'` khi text chứa tiêu đề Thợ Câu

- [ ] **Step 1: Cập nhật `progressQuests.ts`**
  - Mở rộng type:
    ```ts
    export type ProgressQuestKind = 'beginner' | 'farmer' | 'fisherman';
    ```
  - Cập nhật regex bóc tách bước trong `parseStepFromTitle`:
    ```ts
    function parseStepFromTitle(title: string): number | null {
      const match = /(?:tân thủ|nhà nông|thợ câu|bước|cấp)\s*[-:]?\s*(\d+)/i.exec(title);
      if (match) {
        const num = parseInt(match[1], 10);
        return isNaN(num) ? null : num;
      }
      return null;
    }
    ```
  - Cập nhật `parseQuestDialogText`:
    ```ts
    const titleMatch = /(?:nhiệm vụ hiện tại của bạn là nhiệm vụ:)?\s*([^\n:]+):/i.exec(text);
    const title = titleMatch ? titleMatch[1].trim() : 'Nhiệm Vụ Nhà Nông - 1';
    const isBeginner = /tân thủ/i.test(title);
    const isFisherman = /thợ câu|câu cá/i.test(title);
    const kind: ProgressQuestKind = isBeginner ? 'beginner' : isFisherman ? 'fisherman' : 'farmer';
    const step = parseStepFromTitle(title) ?? (kind === 'farmer' ? 1 : kind === 'fisherman' ? 1 : 2);
    ```
    và trả về `screenType`:
    ```ts
    screenType: isBeginner ? 1 : isFisherman ? 2 : 0,
    ```
  - Thêm `DEFAULT_FISHERMAN_QUEST_STATE`:
    ```ts
    export const DEFAULT_FISHERMAN_QUEST_STATE: ProgressQuestChain = {
      kind: 'fisherman',
      screenType: 2,
      title: 'Nhiệm Vụ Thợ Câu',
      step: 1,
      conditions: [],
      rewards: [],
      source: 'default',
      updatedAt: Date.now(),
    };
    ```

- [ ] **Step 2: Cập nhật `farmData.ts`**
  - Thêm `fisherman: ProgressQuestChain | null;` vào `QuestOverviewState`:
    ```ts
    export interface QuestOverviewState {
      daily: DailyQuestState | null;
      beginner: ProgressQuestChain | null;
      farmer: ProgressQuestChain | null;
      fisherman: ProgressQuestChain | null;
      upgradeRequirements: FarmUpgradeRequirements | null;
      source: 'live' | 'cached' | 'none';
      updatedAt: number;
    }
    ```

- [ ] **Step 3: Kiểm tra biên dịch TypeScript phía Server**
  Run: `cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit`
  Expected: Không có lỗi TypeScript (Exit code 0).

- [ ] **Step 4: Commit thay đổi Task 1**
  ```bash
  git add avatar-web/server/src/game/progressQuests.ts avatar-web/server/src/game/farmData.ts
  git commit -m "feat(quests): add fisherman quest kind and update dialog parser"
  ```

---

### Task 2: GameClient Protocol & Session Integration cho Thợ Câu

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `GameClient`, `parseQuestDialogText`, `DEFAULT_FISHERMAN_QUEST_STATE`
- Produces:
  - `GameClient.fishermanQuestState`: `ProgressQuestChain | null`
  - `GameClient.refreshProgressQuests()`: gửi lệnh lấy quest Thợ Câu `userID = 38`
  - `AvatarSession.getQuestOverview()`: trả về trường `fisherman`

- [ ] **Step 1: Thêm `fishermanQuestState` và phân luồng gói tin trong `client.ts`**
  - Trong khai báo class `GameClient`:
    ```ts
    fishermanQuestState: ProgressQuestChain | null = null;
    ```
  - Trong `onMessage` case `-62`:
    ```ts
    const questState = parseQuestDialogText(text);
    if (questState) {
      if (questState.kind === 'beginner') {
        this.beginnerQuestState = questState;
      } else if (questState.kind === 'fisherman') {
        this.fishermanQuestState = questState;
      } else {
        this.farmerQuestState = questState;
      }
      this.emit(
        'log',
        `cập nhật ${questState.title}: ${questState.conditions
          .map((c) => `${c.name} (${c.current}/${c.total})`)
          .join(', ')}`,
      );
      this.emit('quests');
    }
    ```
  - Cập nhật tương tự trong case `-77`, `-40`, `-88` khi nhận `questState`:
    ```ts
    if (questState.kind === 'beginner') {
      this.beginnerQuestState = questState;
    } else if (questState.kind === 'fisherman') {
      this.fishermanQuestState = questState;
    } else if (questState.kind === 'farmer') {
      this.farmerQuestState = questState;
    }
    ```
  - Cập nhật `getQuestOverview()` trong `GameClient`:
    ```ts
    getQuestOverview(): QuestOverviewState {
      return {
        daily: this.dailyQuestState,
        beginner: this.beginnerQuestState,
        farmer: this.farmerQuestState,
        fisherman: this.fishermanQuestState,
        upgradeRequirements: this.farmUpgradeRequirements,
        source: this.beginnerQuestState || this.farmerQuestState || this.fishermanQuestState || this.dailyQuestState ? 'live' : 'none',
        updatedAt: Date.now(),
      };
    }
    ```

- [ ] **Step 2: Cập nhật `refreshProgressQuests()` trong `client.ts`**
  - Thêm truy vấn hỏi NPC 90 với `userID = 38`:
    ```ts
    this.farm.communicate(90);
    await new Promise((resolve) => setTimeout(resolve, 450));
    this.farm.doMenuOption(38, 0, 0); // "Xem nhiệm vụ hiện tại" (Thợ Câu) → cmd -62
    await new Promise((resolve) => setTimeout(resolve, 500));
    ```

- [ ] **Step 3: Cập nhật `AvatarSession.getQuestOverview()` trong `avatarSession.ts`**
  - Bổ sung `fisherman`:
    ```ts
    getQuestOverview(): QuestOverviewState {
      const c = this.client?.status === 'online' ? this.client : undefined;
      if (!c) {
        return this.runtimeSnapshot.quests ?? {
          daily: null,
          beginner: null,
          farmer: null,
          fisherman: null,
          upgradeRequirements: null,
          source: 'none',
          updatedAt: this.now(),
        };
      }
      if (typeof c.syncProgressQuests === 'function') c.syncProgressQuests();
      const daily = c.dailyQuestState ?? null;
      const beginner = c.beginnerQuestState ?? null;
      const farmer = c.farmerQuestState ?? null;
      const fisherman = c.fishermanQuestState ?? null;
      const overview: QuestOverviewState = {
        daily,
        beginner,
        farmer,
        fisherman,
        upgradeRequirements: c.farmUpgradeRequirements ?? null,
        source: daily || beginner || farmer || fisherman ? 'live' : 'none',
        updatedAt: Math.max(
          daily?.updatedAt ?? 0,
          beginner?.updatedAt ?? 0,
          farmer?.updatedAt ?? 0,
          fisherman?.updatedAt ?? 0,
          this.now(),
        ),
      };
      this.patchRuntimeSnapshot('quests', overview);
      return overview;
    }
    ```

- [ ] **Step 4: Kiểm tra biên dịch Server**
  Run: `cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit`
  Expected: Biên dịch thành công 0 lỗi.

- [ ] **Step 5: Commit thay đổi Task 2**
  ```bash
  git add avatar-web/server/src/game/client.ts avatar-web/server/src/session/avatarSession.ts
  git commit -m "feat(fishing): wire fisherman quest querying and session state"
  ```

---

### Task 3: Web Frontend Types & Tab Thợ Câu trong QuestsPanel

**Files:**
- Modify: `avatar-web/web/src/types.ts`
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`

**Interfaces:**
- Consumes: `ProgressQuestChain`, `QuestOverviewState`
- Produces:
  - `QuestTab`: `'daily' | 'beginner' | 'farmer' | 'fisherman' | 'upgrade'`
  - Tab UI `"🎣 Thợ Câu"` trong `QuestsPanel`

- [ ] **Step 1: Cập nhật `types.ts` trên Web**
  - Mở rộng `ProgressQuestKind`:
    ```ts
    export type ProgressQuestKind = 'beginner' | 'farmer' | 'fisherman';
    ```
  - Mở rộng `QuestOverviewState`:
    ```ts
    export interface QuestOverviewState {
      daily: DailyQuestState | null;
      beginner: ProgressQuestChain | null;
      farmer: ProgressQuestChain | null;
      fisherman: ProgressQuestChain | null;
      upgradeRequirements: FarmUpgradeRequirements | null;
      source: 'live' | 'cached' | 'none';
      updatedAt: number;
    }
    ```

- [ ] **Step 2: Cập nhật `QuestsPanel.tsx`**
  - Mở rộng `QuestTab`:
    ```ts
    type QuestTab = 'daily' | 'beginner' | 'farmer' | 'fisherman' | 'upgrade';
    ```
  - Lấy `fisherman` từ `effectiveQuests`:
    ```ts
    const fisherman = effectiveQuests?.fisherman ?? null;
    ```
  - Tính số lượng hoàn thành:
    ```ts
    const completedFishermanCount = fisherman?.conditions?.filter((c) => c.isDone).length ?? 0;
    const totalFishermanCount = fisherman?.conditions?.length ?? 0;
    ```
  - Thêm nút tab trong `quests-tabs-nav`:
    ```tsx
    <button
      type="button"
      className={`quests-tab-btn ${activeTab === 'fisherman' ? 'active' : ''}`}
      onClick={() => setActiveTab('fisherman')}
    >
      🎣 Thợ Câu
      {fisherman && totalFishermanCount > 0 && (
        <span className={`tab-badge ${completedFishermanCount >= totalFishermanCount ? 'tab-badge--done' : ''}`}>
          {completedFishermanCount}/{totalFishermanCount}
        </span>
      )}
    </button>
    ```
  - Thêm nội dung render tab `fisherman` tương tự tab `farmer`:
    ```tsx
    {activeTab === 'fisherman' && (
      fisherman ? (
        <div className="progress-quest-view">
          <div className="progress-quest-header">
            <h4>{fisherman.title}</h4>
            <span className="badge badge--neutral">Bước {fisherman.step ?? 1}</span>
          </div>
          {fisherman.conditions.length > 0 && (
            <div className="progress-quest-conditions">
              <h5>Mục tiêu câu cá:</h5>
              <ul className="conditions-list">
                {fisherman.conditions.map((cond, idx) => {
                  const percent = cond.total > 0 ? Math.min(100, Math.round((cond.current / cond.total) * 100)) : 0;
                  return (
                    <li key={idx} className={`condition-item ${cond.isDone ? 'condition-item--done' : ''}`}>
                      <div className="condition-info">
                        <span className="condition-name">{cond.name}</span>
                        <span className="condition-counter">
                          {cond.isDone ? '✅ Hoàn thành' : `${cond.current} / ${cond.total}`}
                        </span>
                      </div>
                      <div className="condition-progress-bar">
                        <div className="condition-progress-fill" style={{ width: `${percent}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {fisherman.rewards.length > 0 && (
            <div className="progress-quest-rewards">
              <h5>Phần thưởng:</h5>
              <div className="rewards-list">
                {fisherman.rewards.map((rew, idx) => (
                  <span key={idx} className="badge badge--reward">
                    🎁 {rew.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="quest-empty">
          <p>Chưa có dữ liệu nhiệm vụ Thợ Câu.</p>
          <button type="button" className="btn-compact" onClick={handleRefreshProgress} disabled={busy}>
            {busy ? '⏳ Đang tải…' : '🔄 Tải nhiệm vụ từ NPC'}
          </button>
        </div>
      )
    )}
    ```

- [ ] **Step 3: Kiểm tra biên dịch Web**
  Run: `cd /Users/devios/learning-reverse/avatar-web/web && npm run build`
  Expected: Build thành công không có lỗi type/lint.

- [ ] **Step 4: Commit thay đổi Task 3**
  ```bash
  git add avatar-web/web/src/types.ts avatar-web/web/src/accounts/panels/QuestsPanel.tsx
  git commit -m "feat(quests): add fisherman quest tab in web quests panel"
  ```

---

### Task 4: Tích hợp Thẻ Nhiệm Vụ Thợ Câu vào Tab Câu Cá (FishingPanel)

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`

**Interfaces:**
- Consumes: `quests` từ `useAccountRuntime(accountId)`
- Produces: Thẻ widget Nhiệm Vụ Thợ Câu trong `FishingPanel.tsx`

- [ ] **Step 1: Cập nhật `AccountOperationsDrawer.tsx`**
  - Truyền prop `quests={snapshot?.quests ?? null}` vào `FishingPanel`:
    ```tsx
    <FishingPanel
      account={account}
      automation={automation}
      quests={snapshot?.quests ?? null}
      onAutomationChange={handleAutomationChange}
      onChanged={() => {
        void reload();
        void refreshAutomation();
      }}
    />
    ```

- [ ] **Step 2: Cập nhật `FishingPanel.tsx`**
  - Mở rộng `FishingPanelProps`:
    ```ts
    interface FishingPanelProps {
      account?: AccountWithRuntime;
      automation?: AutomationSnapshot;
      quests?: QuestOverviewState | null;
      onAutomationChange?(snapshot: AutomationSnapshot): void;
      onChanged?(): void;
    }
    ```
  - Bổ sung state và action làm mới nhiệm vụ nhanh `handleRefreshQuest`:
    ```ts
    const [refreshingQuest, setRefreshingQuest] = useState(false);
    const fishermanQuest = quests?.fisherman ?? null;

    const handleRefreshQuest = async () => {
      if (!accountId || refreshingQuest) return;
      setRefreshingQuest(true);
      try {
        await apiPost(`/api/accounts/${accountId}/quests/progress/refresh`);
        onChanged?.();
      } catch {
        // ignore
      } finally {
        setTimeout(() => setRefreshingQuest(false), 1500);
      }
    };
    ```
  - Render Card "🎣 Nhiệm Vụ Thợ Câu" ngay dưới phần Header/Action và trước phần Metrics:
    - Nếu có `fishermanQuest`: Hiển thị tên nhiệm vụ (ví dụ `Nhiệm Vụ Thợ Câu 1`), các mục tiêu cá cần câu kèm `current/total`, thanh tiến trình mini và nút icon `🔄` làm mới.
    - Nếu chưa có dữ liệu: Hiển thị một dòng gợi ý nhẹ kèm nút "Tải nhiệm vụ Thợ Câu".

- [ ] **Step 3: Kiểm tra biên dịch Web**
  Run: `cd /Users/devios/learning-reverse/avatar-web/web && npm run build`
  Expected: Build thành công không có lỗi.

- [ ] **Step 4: Commit thay đổi Task 4**
  ```bash
  git add avatar-web/web/src/accounts/AccountOperationsDrawer.tsx avatar-web/web/src/accounts/panels/FishingPanel.tsx
  git commit -m "feat(fishing): embed fisherman quest widget in fishing panel"
  ```

---

### Task 5: End-to-end Verification & GitNexus Sync

**Files:**
- None (Kiểm tra & đồng bộ)

- [ ] **Step 1: Xác minh toàn bộ build Server & Web**
  Run: `cd /Users/devios/learning-reverse/avatar-web/server && npx tsc --noEmit && cd /Users/devios/learning-reverse/avatar-web/web && npm run build`
  Expected: Cả hai lệnh chạy thành công exit code 0.

- [ ] **Step 2: Kiểm tra phạm vi thay đổi qua GitNexus**
  Chạy `gitnexus_detect_changes({ scope: 'unstaged' })` hoặc `gitnexus_detect_changes({ scope: 'compare', base_ref: 'main' })` để đảm bảo chỉ thay đổi đúng các file đã lên kế hoạch.

- [ ] **Step 3: Cập nhật index GitNexus**
  Run: `npx gitnexus analyze`
  Expected: Knowledge graph được cập nhật phiên bản mới nhất.

- [ ] **Step 4: Xác minh Live (nếu account online)**
  Gửi yêu cầu làm mới nhiệm vụ qua endpoint `/api/accounts/:id/quests/progress/refresh` và kiểm tra phản hồi chứa dữ liệu `fisherman`.
