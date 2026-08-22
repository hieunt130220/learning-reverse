# Auto Sell Farm Produce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated selling of farm produce on market stalls during the Auto Farm cycle based on user-configured rules.

**Architecture:** Mapped rules are added to the existing `AutoFarmConfig` JSON envelope. `AutoFarm` determines when the check is due (configured interval in minutes) and delegates the entire transaction chain to `ShopCoordinator` under a dedicated execution lane, reusing existing protocol encoding, validation, and reconciliation logic.

**Tech Stack:** TypeScript, Node.js (Express/WS server), React (Vite frontend), SQLite.

**Spec:** `docs/superpowers/specs/2026-08-22-auto-sell-farm-produce-design.md`

## Global Constraints
- **Quy trình bắt buộc:** Spec → Plan → Production Code. Spec đã duyệt, hiện tại viết Plan này.
- **KHÔNG thực hiện TDD:** Không viết test trước, không tạo file test mới trừ khi có yêu cầu trực tiếp từ user.
- **Không có placeholder:** Code block mẫu và hướng dẫn chi tiết phải đầy đủ, không ghi "TODO" hay "TBD".
- **Tính độc lập của task:** Mỗi task phải kiểm tra build thành công và chạy các test hiện có của module liên quan để không gây regression.

---

## Files to Create/Modify
- Create: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx` (Component UI riêng để quản lý quy tắc bán tự động)
- Modify:
  - `avatar-web/server/src/autoFarm.ts` (Thêm config type, option callback & log Auto Sell vào AutoFarm cycle)
  - `avatar-web/server/src/accounts/autoConfig.ts` (Thêm validation & parser cho các trường cấu hình mới)
  - `avatar-web/server/src/session/avatarSession.ts` (Giữ mốc thời gian lastAutoSellAt, sequence runId và gọi ShopCoordinator)
  - `avatar-web/server/src/session/shopCoordinator.ts` (Cung cấp phương thức chạy lượt tự động bán, khóa lane)
  - `avatar-web/web/src/types.ts` (Cập nhật DTO tương ứng)
  - `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` (Tích hợp AutoSellRulesEditor và xử lý lưu/đối chiếu draft)
  - `avatar-web/web/src/styles.css` (CSS bổ sung cho component)

---

## Tasks Detail

### Task 1: Định nghĩa Types và cập nhật DTO (Frontend & Backend)

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:32-154`
- Modify: `avatar-web/web/src/types.ts:390-449`

**Interfaces:**
- Consumes: Không
- Produces: `AutoSellRule` (interface), `AutoFarmConfig` (mở rộng với `autoSellProduce`, `autoSellIntervalMs`, `autoSellRules`)

- [ ] **Step 1: Cập nhật file types của Server**
  Mở rộng `AutoFarmConfig` trong `avatar-web/server/src/autoFarm.ts`:
  ```typescript
  export interface AutoSellRule {
    itemId: number;
    quantity: number;
    price: number;
  }

  // Thêm vào AutoFarmConfig:
  export interface AutoFarmConfig {
    // ... các trường hiện có ...
    autoSellProduce?: boolean;
    autoSellIntervalMs?: number;
    autoSellRules?: AutoSellRule[];
  }
  ```

- [ ] **Step 2: Cập nhật file types của Web Client**
  Thêm định nghĩa tương ứng vào `avatar-web/web/src/types.ts`:
  ```typescript
  export interface AutoSellRuleDto {
    itemId: number;
    quantity: number;
    price: number;
  }

  // Thêm vào AutoFarmConfigDto:
  export interface AutoFarmConfigDto {
    // ... các trường hiện có ...
    autoSellProduce?: boolean;
    autoSellIntervalMs?: number;
    autoSellRules?: AutoSellRuleDto[];
  }
  ```

- [ ] **Step 3: Verify & Compile Check**
  Chạy lệnh compile server & web để đảm bảo types khớp nhau và không gãy compile:
  Run: `npm run typecheck --workspace=avatar-web-server && npm run build --workspace=avatar-web-ui` (Hoặc lệnh build/typecheck tương ứng trong thư mục root của monorepo)
  Expected: Compile thành công không có lỗi type mismatch.

- [ ] **Step 4: Commit**
  `git commit -m "feat(types): define auto sell rules and config structure"`

---

### Task 2: Cập nhật Config Parser trên Server

**Files:**
- Modify: `avatar-web/server/src/accounts/autoConfig.ts:137-234`, `avatar-web/server/src/accounts/autoConfig.ts:260-298`

**Interfaces:**
- Consumes: `AutoSellRule` và `AutoFarmConfig` mới từ Task 1
- Produces: `normalizeAutoConfig`, `readStoredAutoConfig` hỗ trợ các trường cấu hình Auto Sell.

- [ ] **Step 1: Cập nhật parser trong `autoConfig.ts`**
  Thêm parser cho `autoSellProduce`, `autoSellIntervalMs`, và `autoSellRules` trong `parsers`:
  ```typescript
  autoSellProduce: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  autoSellIntervalMs: (value, key) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 300000) {
      throw new Error(`${key} phải là số nguyên tối thiểu 300000 ms (5 phút)`);
    }
    return value;
  },
  autoSellRules: (value, key) => {
    if (!Array.isArray(value)) throw new Error(`${key} phải là mảng`);
    const seenItemIds = new Set<number>();
    const rules = value.map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Mỗi quy tắc bán tại index ${index} phải là object`);
      }
      const itemId = item.itemId;
      const quantity = item.quantity;
      const price = item.price;
      if (typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId < 0 || itemId > 32767) {
        throw new Error(`Quy tắc ${index}: itemId phải là số nguyên trong [0, 32767]`);
      }
      if (seenItemIds.has(itemId)) {
        throw new Error(`Quy tắc ${index}: itemId ${itemId} bị lặp`);
      }
      seenItemIds.add(itemId);
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Quy tắc ${index}: quantity phải là số nguyên dương`);
      }
      if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
        throw new Error(`Quy tắc ${index}: price phải là số nguyên dương`);
      }
      return { itemId, quantity, price };
    });
    return rules;
  }
  ```
  Và đảm bảo `AUTO_CONFIG_KEYS` phía frontend hoặc server (nếu có validator) bao gồm 3 key mới này.

- [ ] **Step 2: Cập nhật default config fallbacks**
  Đảm bảo trong `readStoredAutoConfig` hoặc `normalizeAutoConfig` các trường này được normalize an toàn (nếu undefined thì gán mặc định hoặc bỏ qua).
  Mặc định:
  `autoSellProduce` -> `false`
  `autoSellIntervalMs` -> `600_000`
  `autoSellRules` -> `[]`

- [ ] **Step 3: Run existing config tests**
  Chạy test suite cho autoConfig:
  Run: `npm test --avatar-web-server src/accounts/autoConfig.test.ts` (hoặc lệnh test tương ứng)
  Expected: PASS tất cả test cũ.

- [ ] **Step 4: Commit**
  `git commit -m "feat(server): update autoConfig parser and validator for auto sell"`

---

### Task 3: Thêm logic tự động bán vào `ShopCoordinator`

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts` (Thêm API `runAutoSellCycle` và các kiểu dữ liệu output liên quan)

**Interfaces:**
- Consumes: `AutoSellRule`
- Produces: `runAutoSellCycle(rules: readonly AutoSellRule[], runId: string, shouldStop: () => boolean): Promise<AutoSellCycleResult>`

- [ ] **Step 1: Định nghĩa DTO kết quả ở `shopCoordinator.ts`**
  ```typescript
  export type AutoSellStopReason =
    | 'completed'
    | 'no-free-slot'
    | 'stopped'
    | 'uncertain-state';

  export interface AutoSellRuleResult {
    itemId: number;
    listedLots: number;
    listedQuantity: number;
    skippedReason?: string;
  }

  export interface AutoSellCycleResult {
    startedAt: number;
    completedAt: number;
    listedLots: number;
    stopReason: AutoSellStopReason;
    rules: AutoSellRuleResult[];
  }
  ```

- [ ] **Step 2: Triển khai hàm `runAutoSellCycle` trong lớp `ShopCoordinator`**
  Hàm này sẽ:
  1. Sử dụng `enqueue('auto-sell-cycle', ...)` để chạy tuần tự trong lane sạp.
  2. Bỏ qua kiểm tra `assertNoAutomation` bằng cách tạo một bypass flag cục bộ khi chạy từ AutoFarm.
  3. Thực hiện sync own shop, price rules, and inventory (`syncOwnShopInLane()`).
  4. Lấy danh sách slot trống trong `own.data.slots` (các slot có `itemId === -1` hoặc `quantity === 0`, nằm trong số lượng `numSlot` hiện có).
  5. Duyệt qua mảng rules theo thứ tự:
     - Nếu `shouldStop()` trả về true -> Dừng và trả `stopped`.
     - Tìm rule giá trần/sàn trong priceRules. Nếu không tìm thấy hoặc giá nằm ngoài khoảng, set `skippedReason = 'Giá ngoài khoảng quy định'` và bỏ qua rule này.
     - Lặp liên tục đăng bán cho đến khi:
       - Số lượng nông sản trong kho (được cập nhật mới nhất từ `this.produce`) < `rule.quantity` -> Chuyển sang rule tiếp theo.
       - Không còn slot sạp trống -> dừng chu kỳ và trả về `no-free-slot`.
       - Gửi packet đăng bán:
         - Phát sinh lỗi không chắc chắn (timeout, mất kết nối, reconcile mismatch) -> dừng ngay lập trình và ném lỗi/trả về `uncertain-state`.
         - Thành công -> sync lại sạp/kho, cập nhật slot trống và lượng kho hiện hành, tiếp tục lặp.
  6. Idempotency key cho mỗi slot đăng bán tự động:
     `auto-sell:${this.accountId}:${runId}:${ruleIndex}:${lotIndex}`

- [ ] **Step 3: Cho phép bỏ qua `assertNoAutomation` khi chạy Auto Sell**
  Thêm check đặc thù hoặc truyền param để `runAutoSellCycle` không bị chặn bởi check `isAutomationRunning` vốn dùng để chặn user thao tác thủ công khi bot đang chạy.

- [ ] **Step 4: Verify & Build**
  Run: `npm run typecheck --workspace=avatar-web-server`
  Expected: Compile thành công không lỗi.

- [ ] **Step 5: Commit**
  `git commit -m "feat(server): implement runAutoSellCycle in ShopCoordinator"`

---

### Task 4: Tích hợp chu kỳ bán tự động vào `AutoFarm` và `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts` (Thêm phase Auto Sell vào runCycle)
- Modify: `avatar-web/server/src/session/avatarSession.ts` (Lưu `lastAutoSellAt`, `autoSellRunId` và định nghĩa callback)

**Interfaces:**
- Consumes: `ShopCoordinator.runAutoSellCycle`
- Produces: Giai đoạn Auto Sell được thực thi ở cuối chu kỳ Auto Farm.

- [ ] **Step 1: Cập nhật dependency của AutoFarm**
  Mở rộng interface `AutoFarmOptions` hoặc dependency của `AutoFarm` để nhận callback chạy auto sell:
  ```typescript
  export interface AutoFarmOptions {
    // ... các trường hiện có ...
    runAutoSellCycle?: (
      rules: readonly AutoSellRule[],
      shouldStop: () => boolean,
    ) => Promise<AutoSellCycleResult>;
  }
  ```

- [ ] **Step 2: Cập nhật `runCycle()` trong `AutoFarm`**
  Ở cuối `runCycle()` (ngay trước khi xin lại dữ liệu farm ở cuối chu kỳ hoặc phát `cycle-complete`):
  ```typescript
  if (cfg.autoSellProduce && cfg.autoSellRules && cfg.autoSellRules.length > 0 && this.options.runAutoSellCycle) {
    note('bắt đầu kiểm tra sạp tự động...');
    try {
      const result = await this.options.runAutoSellCycle(cfg.autoSellRules, () => this.aborted);
      note(`[sạp tự động] hoàn thành: đã đăng ${result.listedLots} lô. Lý do dừng: ${result.stopReason}`);
      for (const r of result.rules) {
        if (r.listedLots > 0) {
          note(`  - ${r.itemId}: đăng ${r.listedLots} lô (${r.listedQuantity} sản phẩm)`);
        }
        if (r.skippedReason) {
          note(`  - ${r.itemId}: bỏ qua (${r.skippedReason})`);
        }
      }
    } catch (err) {
      note(`[sạp tự động] gặp lỗi: ${(err as Error).message}`);
    }
  }
  ```

- [ ] **Step 3: Cập nhật `AvatarSession` để giữ state Auto Sell**
  Trong lớp `AvatarSession` (file `avatar-web/server/src/session/avatarSession.ts`):
  1. Thêm private property:
     `private lastAutoSellAt = 0;`
     `private autoSellRunSequence = 0;`
  2. Khi khởi tạo `AutoFarm` trong hàm `connect()`:
     Truyền callback `runAutoSellCycle`:
     ```typescript
     createAutoFarm: (client) => new AutoFarm(client, {
       continuous: false,
       runAutoSellCycle: async (rules, shouldStop) => {
         const cfg = this.lastAutoConfig;
         const interval = cfg.autoSellIntervalMs ?? 600_000;
         const now = this.now();
         if (now - this.lastAutoSellAt < interval) {
           return {
             startedAt: now,
             completedAt: now,
             listedLots: 0,
             stopReason: 'completed',
             rules: rules.map(r => ({ itemId: r.itemId, listedLots: 0, listedQuantity: 0, skippedReason: 'Chưa tới chu kỳ' }))
           };
         }
         
         this.autoSellRunSequence += 1;
         const runId = `${this.onlineEpoch ?? 0}-${this.autoSellRunSequence}`;
         this.lastAutoSellAt = now;
         
         const coordinator = this.requireShop();
         return await coordinator.runAutoSellCycle(rules, runId, shouldStop);
       }
     })
     ```

- [ ] **Step 4: Chạy các test hiện có để kiểm chứng**
  Run: `npm test`
  Expected: Tất cả các test hiện có của `AutoFarm` và `AvatarSession` pass thành công.

- [ ] **Step 5: Commit**
  `git commit -m "feat(server): integrate runAutoSellCycle into AutoFarm and AvatarSession"`

---

### Task 5: Component UI quản lý Quy tắc tự động bán (`AutoSellRulesEditor`)

**Files:**
- Create: `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`
- Modify: `avatar-web/web/src/styles.css` (Thêm CSS class hỗ trợ danh sách drag/sắp xếp thủ công)

**Interfaces:**
- Consumes: `AutoSellRuleDto[]`, `ShopPriceRule[]`, `ProduceSnapshot`
- Produces: UI React Component hiển thị danh sách quy tắc, input cho phép thêm, sửa giá/lượng, và thay đổi thứ tự.

- [ ] **Step 1: Tạo file component `AutoSellRulesEditor.tsx`**
  Component sẽ chứa:
  1. Checkbox "Bật tự động bán nông sản".
  2. Input "Chu kỳ kiểm tra (phút)", mặc định 10, min 5.
  3. Bảng/Danh sách các quy tắc hiện tại với các cột:
     - Nông sản (Tên hiển thị lấy từ catalog mapping).
     - Số lượng mỗi lô.
     - Giá bán (Có hiển thị min/max cho phép từ `priceRules`).
     - Hành động (Lên, Xuống, Xóa).
  4. Form/Row thêm quy tắc mới:
     - Dropdown chọn nông sản (Lọc lấy các item có trong `priceRules` và không trùng với quy tắc đã có).
     - Input số lượng, giá bán (mặc định lấy giá trị trung bình hoặc min của price rules).
     - Nút "Thêm".
  5. Callback `onChange` truyền mảng rules đã thay đổi và trạng thái lên component cha.

- [ ] **Step 2: Thêm CSS styling cho editor mới**
  Thêm các class CSS cần thiết vào `avatar-web/web/src/styles.css` để định dạng table, nút lên xuống compact, và border cảnh báo giá trị ngoài vùng an toàn.

- [ ] **Step 3: Commit**
  `git commit -m "feat(web): add AutoSellRulesEditor component"`

---

### Task 6: Tích hợp editor vào `AutoFarmPanel` và API save

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` (Truyền thêm prop `shop` cho `AutoFarmPanel`)

**Interfaces:**
- Consumes: `AutoSellRulesEditor` component
- Produces: Lưu cấu hình Auto Sell thông qua API `savePlan` của `AutoFarmPanel`.

- [ ] **Step 1: Cập nhật Props của `AutoFarmPanel`**
  Nhận thêm:
  `shop?: ShopRuntimeState;`
  `produce?: ProduceSnapshot | null;` (produce sạp chứa catalog nông sản)

- [ ] **Step 2: Tích hợp component `AutoSellRulesEditor` vào form**
  Đặt component mới bên dưới phần Bếp nấu ăn tự động và ngay trên phần nút Lưu kế hoạch.
  Quản lý draft state cho:
  - `draftAutoSellProduce` (boolean)
  - `draftAutoSellIntervalMs` (number, tính bằng ms)
  - `draftAutoSellRules` (AutoSellRuleDto[])
  
  Cập nhật hàm so sánh `dirty` để kiểm tra sự khác biệt của Auto Sell config:
  ```typescript
  const dirty = // ... các check cũ ...
    || draftAutoSellProduce !== (storedState.config.autoSellProduce ?? false)
    || draftAutoSellIntervalMs !== (storedState.config.autoSellIntervalMs ?? 600000)
    || JSON.stringify(draftAutoSellRules) !== JSON.stringify(storedState.config.autoSellRules ?? []);
  ```

- [ ] **Step 3: Cập nhật hàm `savePlan()`**
  Đưa các trường cấu hình Auto Sell mới vào payload gửi cho API `PUT /api/accounts/:id/auto/config`.

- [ ] **Step 4: Truyền shop state từ `AccountOperationsDrawer`**
  Cập nhật nơi render `<AutoFarmPanel>` trong `LoadedOperations` để truyền:
  `shop={snapshot?.shop}`
  `produce={snapshot?.produce}`

- [ ] **Step 5: Run existing UI tests**
  Chạy vitest cho web client:
  Run: `npm run test --workspace=avatar-web-ui`
  Expected: PASS tất cả test hiện có.

- [ ] **Step 6: Commit**
  `git commit -m "feat(web): integrate AutoSellRulesEditor into AutoFarmPanel"`

---

## Verification and Safety Checklist

- [ ] Thực hiện `gitnexus_impact` trước khi chỉnh sửa bất kỳ symbol nào của `ShopCoordinator` và `AutoFarm`.
- [ ] Mọi thay đổi code backend phải được build thử để kiểm tra TypeScript compiler.
- [ ] Chạy `npm test` ở cả client và server để kiểm chứng không có regression.
- [ ] Chạy lệnh `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` trước khi commit toàn bộ code.
