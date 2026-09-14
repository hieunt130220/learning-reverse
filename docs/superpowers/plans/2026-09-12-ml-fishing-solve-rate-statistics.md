# Thống Kê Tỉ Lệ Giải ML Đúng Khi Câu Cá Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thống kê và hiển thị lũy kế toàn thời gian tỉ lệ giải minigame câu cá đúng của model ML theo từng tài khoản trên web UI.

**Architecture:** Lưu trữ số lượt thử (`total_attempts`) và số lượt bắt cá thành công (`success_catches`) của các lượt câu do ML giải (`decision.source === 'ml'`) trong bảng SQLite `avatar_ml_fishing_statistics`. Server mở rộng trường tùy chọn `mlFishingStatistics` trên `AutomationSnapshot` và overlay dữ liệu mới nhất từ repository; web UI dùng narrowing cục bộ trong `FishingPanel.tsx` để render thẻ metric tỉ lệ thành công mà không chạm vào các type CRITICAL bị cấm.

**Tech Stack:** TypeScript, Node.js, better-sqlite3, React.

**Spec:** `docs/superpowers/specs/2026-09-12-ml-fishing-solve-rate-statistics-design.md`

## Global Constraints

- KHÔNG thực hiện TDD: không viết test trước, không tạo test files mới.
- Tuyệt đối KHÔNG sửa đổi `avatar-web/web/src/types.ts` (CRITICAL impact).
- Tuyệt đối KHÔNG sửa đổi `FishingRuntimeState` phía server và web (CRITICAL impact).
- Tuyệt đối KHÔNG sửa đổi định nghĩa web `AutomationSnapshot` trong các file dùng chung.
- Trường `mlFishingStatistics` trên server `AutomationSnapshot` là optional additive (MEDIUM impact).
- Web chỉ dùng type narrowing cục bộ trong `FishingPanel.tsx`.
- Tuân thủ quy tắc GitNexus: báo cáo impact trước khi sửa và kiểm tra thay đổi trước khi commit.

---

### Task 1: Thêm bảng `avatar_ml_fishing_statistics` vào database schema

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql:140-155`

**Interfaces:**
- Consumes: Bảng `avatar_accounts(id)`.
- Produces: Bảng `avatar_ml_fishing_statistics` với các cột `account_id`, `total_attempts`, `success_catches`, `updated_at`.

- [x] **Step 1: Khai báo DDL bảng `avatar_ml_fishing_statistics` trong `schema.sql`**

Thêm định nghĩa bảng vào cuối `avatar-web/server/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS avatar_ml_fishing_statistics (
  account_id INTEGER PRIMARY KEY REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  success_catches INTEGER NOT NULL DEFAULT 0 CHECK (success_catches >= 0),
  updated_at INTEGER NOT NULL
);
```

- [x] **Step 2: Kiểm tra cú pháp SQL và verify schema**

Run: `node -e "const fs = require('fs'); const sql = fs.readFileSync('avatar-web/server/src/db/schema.sql', 'utf8'); console.log(sql.includes('avatar_ml_fishing_statistics'));"`
Expected: `true`

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/db/schema.sql
git commit -m "feat(fishing): add ml fishing statistics schema"
```

---

### Task 2: Tạo repository `FishingMlStatisticsRepository`

**Files:**
- Create: `avatar-web/server/src/accounts/fishingMlStatisticsRepo.ts`

**Interfaces:**
- Consumes: `Db` từ `../db/index.js`, DTO `MlFishingStatistics` từ `../session/automationTypes.js`.
- Produces: `FishingMlStatisticsRepository` với hai methods:
  - `recordResult(accountId: number, isSuccess: boolean, updatedAt: number): MlFishingStatistics`
  - `read(accountId: number): MlFishingStatistics`
  - `emptyMlFishingStatistics(): MlFishingStatistics`

- [x] **Step 1: Viết `fishingMlStatisticsRepo.ts`**

Tạo file `avatar-web/server/src/accounts/fishingMlStatisticsRepo.ts`:

```ts
import type { Db } from '../db/index.js';
import type { MlFishingStatistics } from '../session/automationTypes.js';

interface MlStatsRow {
  total_attempts: number;
  success_catches: number;
  updated_at: number;
}

export function emptyMlFishingStatistics(): MlFishingStatistics {
  return {
    totalAttempts: 0,
    successCatches: 0,
    accuracy: 0,
    updatedAt: null,
  };
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} nằm ngoài giới hạn số nguyên an toàn`);
  }
  return value;
}

function formatMlStats(row: MlStatsRow | undefined): MlFishingStatistics {
  if (!row) return emptyMlFishingStatistics();
  const totalAttempts = requireSafeInteger(row.total_attempts, 'totalAttempts');
  const successCatches = requireSafeInteger(row.success_catches, 'successCatches');
  const updatedAt = requireSafeInteger(row.updated_at, 'updatedAt');
  const accuracy = totalAttempts > 0 ? successCatches / totalAttempts : 0;
  return {
    totalAttempts,
    successCatches,
    accuracy,
    updatedAt,
  };
}

export class FishingMlStatisticsRepository {
  constructor(private readonly db: Db) {}

  read(accountId: number): MlFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    const row = this.db.prepare<[number], MlStatsRow>(`
      SELECT total_attempts, success_catches, updated_at
      FROM avatar_ml_fishing_statistics
      WHERE account_id = ?
    `).get(accountId);
    return formatMlStats(row);
  }

  recordResult(accountId: number, isSuccess: boolean, updatedAt: number): MlFishingStatistics {
    requireSafeInteger(accountId, 'accountId', 1);
    if (!Number.isFinite(updatedAt)) {
      throw new Error('timestamp thống kê ML không hữu hạn');
    }
    const successInc = isSuccess ? 1 : 0;
    return this.db.transaction(() => {
      this.db.prepare<[number, number, number]>(`
        INSERT INTO avatar_ml_fishing_statistics (
          account_id, total_attempts, success_catches, updated_at
        ) VALUES (?, 1, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          total_attempts = total_attempts + 1,
          success_catches = success_catches + excluded.success_catches,
          updated_at = excluded.updated_at
        WHERE total_attempts < 9007199254740991
      `).run(accountId, successInc, updatedAt);
      return this.read(accountId);
    })();
  }
}
```

- [x] **Step 2: Typecheck server để xác nhận repository hợp lệ**

Run: `npx tsc -p avatar-web/server/tsconfig.json --noEmit`
Expected: Biên dịch sạch hoặc chỉ thiếu DTO `MlFishingStatistics` (sẽ hoàn tất ở Task 3).

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/accounts/fishingMlStatisticsRepo.ts
git commit -m "feat(fishing): add ml fishing statistics repository"
```

---

### Task 3: Cập nhật DTO `MlFishingStatistics` và `AutomationSnapshot`

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:160-185`

**Interfaces:**
- Consumes: Không.
- Produces: Export `interface MlFishingStatistics` và optional property `mlFishingStatistics?: MlFishingStatistics;` trên `AutomationSnapshot`.

- [x] **Step 1: Khai báo `MlFishingStatistics` và mở rộng `AutomationSnapshot`**

Trong `avatar-web/server/src/session/automationTypes.ts`, thêm định nghĩa `MlFishingStatistics`:

```ts
export interface MlFishingStatistics {
  totalAttempts: number;
  successCatches: number;
  accuracy: number;
  updatedAt: number | null;
}
```

Và thêm trường `mlFishingStatistics` vào `AutomationSnapshot`:

```ts
export interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: AutomationTransitionState;
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  fishingConfig?: StoredFishingConfigState;
  fishingRuntime?: FishingRuntimeState;
  dailyFishingStatistics?: DailyFishingStatistics;
  mlFishingStatistics?: MlFishingStatistics;
  location: AutomationLocation | null;
}
```

- [x] **Step 2: Typecheck server**

Run: `npx tsc -p avatar-web/server/tsconfig.json --noEmit`
Expected: PASS không lỗi.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/session/automationTypes.ts
git commit -m "feat(fishing): add ml fishing statistics contract"
```

---

### Task 4: Tích hợp ghi nhận kết quả giải ML trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `MlFishingStatistics` từ `automationTypes.js`.
- Produces: `AvatarSessionOptions.initialMlFishingStatistics`, `AvatarSessionOptions.onMlFishingResult`, theo dõi `currentFishingChallengeSource` và emit `mlFishingStatistics` trong `automationSnapshot`.

- [x] **Step 1: Thêm options và fields vào `AvatarSession`**

Trong `avatar-web/server/src/session/avatarSession.ts`:
1. Import `MlFishingStatistics` từ `./automationTypes.js` và `emptyMlFishingStatistics` từ `../accounts/fishingMlStatisticsRepo.js`.
2. Trong `AvatarSessionOptions`, thêm:
   ```ts
   initialMlFishingStatistics?: MlFishingStatistics;
   onMlFishingResult?: (isSuccess: boolean, updatedAt: number) => MlFishingStatistics;
   ```
3. Trong `AvatarSession` class, thêm:
   ```ts
   private mlFishingStatistics: MlFishingStatistics;
   private currentFishingChallengeSource?: 'ml' | 'random';
   ```
4. Khởi tạo trong constructor:
   ```ts
   this.mlFishingStatistics = opts.initialMlFishingStatistics ?? emptyMlFishingStatistics();
   ```
5. Thêm `recordMlResult(isSuccess: boolean)` helper:
   ```ts
   private recordMlResult(isSuccess: boolean): void {
     if (this.currentFishingChallengeSource !== 'ml') {
       this.currentFishingChallengeSource = undefined;
       return;
     }
     this.currentFishingChallengeSource = undefined;
     try {
       if (this.opts.onMlFishingResult) {
         this.mlFishingStatistics = this.opts.onMlFishingResult(isSuccess, this.now());
       }
     } catch (err) {
       this.pushLog(`[câu cá] lỗi ghi nhận thống kê ML: ${(err as Error).message}`);
     }
   }
   ```
6. Trong `automationSnapshot()`, thêm:
   ```ts
   mlFishingStatistics: this.mlFishingStatistics,
   ```

- [x] **Step 2: Gắn cờ khi gửi TX 43 và xử lý kết quả ở các nhánh kết thúc lượt câu**

1. Trong `handleFishingChallenge` (ngay trước `client.finishFishing(decision.answer)`):
   ```ts
   this.currentFishingChallengeSource = decision.source;
   ```
2. Trong handler `client.on('fishing-success-result')`:
   ```ts
   // Ghi nhận kết quả ML
   this.recordMlResult(ev.idFish >= 0);
   ```
3. Trong `runFishingLoop` (nhánh dialog sổng cá / cá chạy mất / trật rồi):
   ```ts
   this.recordMlResult(false);
   ```
4. Trong `runFishingLoop` (ngay trước `client.quanCau()` của lượt câu mới):
   ```ts
   // Nếu lượt cũ kết thúc mà chưa ghi nhận (ví dụ timeout không có RX 43 hay dialog):
   this.recordMlResult(false);
   ```

- [x] **Step 3: Typecheck server**

Run: `npx tsc -p avatar-web/server/tsconfig.json --noEmit`
Expected: PASS không lỗi.

- [x] **Step 4: Commit**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(fishing): track and record ml fishing challenge outcomes in session"
```

---

### Task 5: Tích hợp repository và snapshot overlay trong `SessionManager`

**Files:**
- Modify: `avatar-web/server/src/session/manager.ts`

**Interfaces:**
- Consumes: `FishingMlStatisticsRepository` từ `../accounts/fishingMlStatisticsRepo.js`.
- Produces: Quản lý instance repository, inject callback vào session và overlay `mlFishingStatistics` lên `AutomationSnapshot`.

- [x] **Step 1: Khởi tạo repository và truyền callback trong `manager.ts`**

Trong `avatar-web/server/src/session/manager.ts`:
1. Import `FishingMlStatisticsRepository` từ `../accounts/fishingMlStatisticsRepo.js`.
2. Bổ sung `fishingMlStatisticsRepository?: FishingMlStatisticsRepository;` vào `SessionManagerDeps`.
3. Khởi tạo `private readonly fishingMlStatisticsRepository: FishingMlStatisticsRepository;` trong constructor:
   ```ts
   this.fishingMlStatisticsRepository = deps.fishingMlStatisticsRepository
     ?? new FishingMlStatisticsRepository(deps.db);
   ```
4. Trong `createSession`:
   ```ts
   const initialMlFishingStatistics = this.fishingMlStatisticsRepository.read(accountId);
   // ... truyền vào opts:
   initialMlFishingStatistics,
   onMlFishingResult: (isSuccess, updatedAt) => (
     this.fishingMlStatisticsRepository.recordResult(accountId, isSuccess, updatedAt)
   ),
   ```
5. Trong `automationSnapshot(accountId)`:
   - Nhánh offline:
     ```ts
     return {
       ...offlineAutomationSnapshot(persisted),
       dailyFishingStatistics: this.fishingStatisticsRepository.readToday(accountId),
       mlFishingStatistics: this.fishingMlStatisticsRepository.read(accountId),
     };
     ```
   - Nhánh online (live):
     ```ts
     const mlFishingStatistics = this.fishingMlStatisticsRepository.read(accountId);
     return {
       ...live,
       dailyFishingStatistics,
       mlFishingStatistics,
     };
     ```

- [x] **Step 2: Typecheck server**

Run: `npx tsc -p avatar-web/server/tsconfig.json --noEmit`
Expected: PASS không lỗi.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/session/manager.ts
git commit -m "feat(fishing): serve persisted ml fishing statistics in session manager"
```

---

### Task 6: Hiển thị tỉ lệ giải ML đúng trên giao diện web `FishingPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`

**Interfaces:**
- Consumes: `AutomationSnapshot` từ web runtime.
- Produces: Render metric card "Tỉ lệ giải ML đúng" trong tab Câu cá.

- [x] **Step 1: Khai báo DTO và helper narrowing cục bộ**

Trong `avatar-web/web/src/accounts/panels/FishingPanel.tsx`:
1. Thêm interface cục bộ:
   ```ts
   interface MlFishingStatistics {
     totalAttempts: number;
     successCatches: number;
     accuracy: number;
     updatedAt: number | null;
   }

   type AutomationWithMlStatistics = AutomationSnapshot & {
     mlFishingStatistics?: MlFishingStatistics;
   };

   function getMlFishingStatistics(
     automation: AutomationSnapshot | undefined,
   ): MlFishingStatistics | undefined {
     return (automation as AutomationWithMlStatistics | undefined)
       ?.mlFishingStatistics;
   }
   ```
2. Trong component `FishingPanel`:
   ```ts
   const mlFishingStatistics = getMlFishingStatistics(automation);
   ```

- [x] **Step 2: Thêm thẻ metric vào Live Metrics & Status grid**

Trong lưới thẻ trạng thái (sau thẻ `Map / Khu vực`):
```tsx
        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Tỉ lệ giải ML đúng</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#58a6ff', marginTop: '0.2rem' }}>
            {mlFishingStatistics && mlFishingStatistics.totalAttempts > 0
              ? `${(mlFishingStatistics.accuracy * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="hint" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
            {mlFishingStatistics && mlFishingStatistics.totalAttempts > 0
              ? `${mlFishingStatistics.successCatches}/${mlFishingStatistics.totalAttempts} lượt`
              : 'Chưa có lượt giải'}
          </div>
        </div>
```

- [x] **Step 3: Build web client để verify syntax và JSX**

Run: `npm run build -w avatar-web/web`
Expected: Build web thành công (Vite build sạch, không lỗi type).

- [x] **Step 4: Commit**

```bash
git add avatar-web/web/src/accounts/panels/FishingPanel.tsx
git commit -m "feat(fishing): display ml fishing solve rate statistics"
```

---

### Task 7: End-to-end verification & Guard boundaries check

**Files:** Không tạo mới.

- [x] **Step 1: Kiểm tra ranh giới cấm (Forbidden Boundaries)**

Run: `git diff --name-only main | grep -E "types.ts|avatar-web/web/src/types.ts"`
Expected: Không có output (không file nào thuộc ranh giới cấm bị chạm tới).

- [x] **Step 2: Build toàn bộ project**

Run: `npm run build -w avatar-web/server && npm run build -w avatar-web/web`
Expected: Cả server và web đều build thành công không có lỗi.

- [x] **Step 3: GitNexus graph check**

Run: `git diff --check`
Expected: Không có lỗi whitespace hay conflict markers.
