# Thiết Kế Thống Kê Tỉ Lệ Giải ML Đúng Khi Câu Cá

> **Ngày lập:** 2026-09-12  
> **Trạng thái:** Chờ User Review  
> **Tài liệu liên quan:** `docs/superpowers/specs/2026-09-12-daily-fishing-statistics-design.md`, `docs/superpowers/specs/2026-09-12-handle-instant-fishing-escape-design.md`

## 1. Mục tiêu & bối cảnh

Hệ thống Auto Fishing hiện tại hỗ trợ giải minigame câu cá (RX 79 `CAN_CAU`) thông qua mô hình Machine Learning (`ProductionInferenceClient` gọi model tại endpoint inference). Khi model trả về dự đoán hợp lệ, hệ thống gửi đáp án phím (`TX 43`) với nguồn `decision.source = 'ml'`. Nếu model gặp lỗi, timeout hoặc unavailable, hệ thống tự động fallback sang bấm ngẫu nhiên (`source = 'random'`).

Hiện tại, người dùng chưa có số liệu trực quan để đánh giá:
- Model ML giải đúng bao nhiêu lượt, tỉ lệ thành công thực tế ra sao.
- Khi nào model hoạt động hiệu quả, khi nào bị giảm độ chính xác.

Do giao thức game Avatar không trả về đáp án đúng (ground truth) của minigame sau khi nộp TX 43, tiêu chí xác định kết quả thực tế dựa trên phản hồi của game server:
- **Thành công (Đúng)**: Game server trả `RX 43` (`CAU_THANH_CONG`) với `idFish >= 0` (bắt được cá thành công).
- **Thất bại (Sai)**: Game server trả `RX 43` với `idFish = -1` (giật hụt), hoặc xuất hiện dialog sổng cá ("Cá đã chạy mất tiêu rồi", "sổng cá", "trật rồi"), hoặc timeout không nhận được cá sau khi đã gửi đáp án ML.

Mục tiêu của tính năng:
- Lưu trữ thống kê lũy kế toàn thời gian (all-time cumulative) theo từng tài khoản (`account_id`) trong SQLite: tổng số lần giải bằng ML (`totalAttempts`), số lần bắt cá thành công (`successCatches`), tỉ lệ đúng (`accuracy = successCatches / totalAttempts`).
- Trả thông tin qua `AutomationSnapshot` theo cơ chế additive an toàn (tuân thủ GitNexus).
- Hiển thị trực quan tỉ lệ đúng và số lượt trên giao diện web tab Câu cá (`FishingPanel.tsx`).

## 2. Phạm vi

### 2.1. In-scope

- Ghi nhận thống kê **chỉ cho các lượt câu mà TX 43 được giải và gửi bởi ML** (`decision.source === 'ml'`).
- Bỏ qua các lượt giải bằng ngẫu nhiên (random fallback) để không làm sai lệch chỉ số đánh giá model ML.
- Bỏ qua các lượt bị hủy trước khi gửi TX 43 (bị chặn bởi Pre-Send Gate do sổng cá sớm, timeout sớm, hoặc đổi mode).
- Lưu trữ bền vững trong SQLite (bảng `avatar_ml_fishing_statistics`), hỗ trợ foreign key cascade khi xóa tài khoản.
- Cập nhật số liệu nguyên tử (atomic upsert) trong SQLite khi nhận kết quả câu cá.
- Đưa `mlFishingStatistics` vào `AutomationSnapshot` phía server như một trường tùy chọn (additive), truyền qua WebSocket và API.
- Hiển thị ô Metric thống kê tỉ lệ giải đúng trên web tab Câu cá (`FishingPanel.tsx`) bằng cơ chế narrowing cục bộ, không sửa `types.ts`.

### 2.2. Out-of-scope

- Thống kê phân rã theo từng ngày (tính năng theo dõi toàn thời gian lũy kế all-time).
- Thống kê chi tiết từng phím, từng ảnh trong minigame.
- Ground truth tuyệt đối từ phía game server (vì protocol không có).
- Sửa đổi các type có impact CRITICAL: tuyệt đối không sửa server/web `FishingRuntimeState`, không sửa web `AutomationSnapshot` trong `avatar-web/web/src/types.ts`.
- Tạo test files mới (tuân thủ nguyên tắc không TDD của dự án).

## 3. Input, output và trường hợp biên

### 3.1. Nguồn dữ liệu & Điều kiện kích hoạt

1. **Gửi đáp án ML:**
   - Trong `handleFishingChallenge` của `AvatarSession`: khi `decision.source === 'ml'` và vượt qua Pre-Send Gate để gọi `client.finishFishing(decision.answer)`, session đánh dấu `currentFishingChallengeSource = 'ml'`.
2. **Nhận kết quả câu cá:**
   - **Trường hợp 1 (Bắt được cá):** Nhận sự kiện `fishing-success-result` với `ev.idFish >= 0`. Nếu `currentFishingChallengeSource === 'ml'`, ghi nhận 1 lượt thành công (`isSuccess = true`).
   - **Trường hợp 2 (Giật hụt / sổng cá):** Nhận `fishing-success-result` với `ev.idFish < 0`. Nếu `currentFishingChallengeSource === 'ml'`, ghi nhận 1 lượt thất bại (`isSuccess = false`).
   - **Trường hợp 3 (Dialog sổng cá):** Nhận dialog sổng cá ("Cá đã chạy mất tiêu rồi") trong `runFishingLoop`. Nếu `currentFishingChallengeSource === 'ml'`, ghi nhận 1 lượt thất bại (`isSuccess = false`).
   - Sau khi ghi nhận (hoặc khi lượt câu reset/quăng mới), xóa cờ `currentFishingChallengeSource = undefined`.

### 3.2. Data Contract (DTO)

Phía server (`avatar-web/server/src/session/automationTypes.ts`):
```ts
export interface MlFishingStatistics {
  totalAttempts: number;
  successCatches: number;
  accuracy: number; // Tỉ lệ từ 0.0 đến 1.0 (trả về 0 khi totalAttempts = 0)
  updatedAt: number | null; // Timestamp epoch ms
}

export interface AutomationSnapshot {
  // ...các trường hiện có giữ nguyên
  dailyFishingStatistics?: DailyFishingStatistics;
  mlFishingStatistics?: MlFishingStatistics;
}
```

### 3.3. Trường hợp biên (Edge Cases)

- **Chưa có lượt giải ML nào (`totalAttempts = 0`):** `accuracy = 0`, UI hiển thị `—` hoặc `0.0% (0/0)`.
- **Thực hiện fallback random:** Không đánh dấu `currentFishingChallengeSource = 'ml'`, không ghi nhận vào bảng thống kê ML.
- **Sổng cá sớm trước khi kịp gửi TX 43:** Pre-Send Gate chặn gửi, `currentFishingChallengeSource` chưa được bật (hoặc bị reset), không ghi nhận lượt giải.
- **Server crash / reconnect giữa lượt câu:** Reset trạng thái session in-memory; số liệu đã ghi trong DB trước đó vẫn toàn vẹn.
- **Concurrent updates:** SQLite upsert thực hiện tăng giá trị nguyên tử (`total_attempts = total_attempts + 1, success_catches = success_catches + ?`), không bị race condition read-modify-write.
- **Xóa tài khoản:** Bảng có ràng buộc `REFERENCES avatar_accounts(id) ON DELETE CASCADE`, dữ liệu tự động dọn sạch.

## 4. Thiết kế kỹ thuật & Modules

### 4.1. Danh sách files thay đổi

| File | Vai trò | Ghi chú |
| --- | --- | --- |
| `avatar-web/server/src/db/schema.sql` | Bổ sung DDL tạo bảng `avatar_ml_fishing_statistics` | Idempotent `CREATE TABLE IF NOT EXISTS` |
| `avatar-web/server/src/accounts/fishingMlStatisticsRepo.ts` | Repository quản lý bảng thống kê ML | File mới: đọc và upsert atomic |
| `avatar-web/server/src/session/automationTypes.ts` | Định nghĩa DTO `MlFishingStatistics` và thêm vào `AutomationSnapshot` | Additive, impact MEDIUM (an toàn) |
| `avatar-web/server/src/session/avatarSession.ts` | Theo dõi `currentFishingChallengeSource` và gọi callback ghi nhận kết quả | Callback được inject qua `AvatarSessionOptions` |
| `avatar-web/server/src/session/manager.ts` | Khởi tạo repository, inject callback vào session, overlay DTO vào snapshot | Đồng bộ online/offline và broadcast WS |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Narrowing cục bộ `mlFishingStatistics` và render metric card | Không sửa `types.ts` (CRITICAL) |

### 4.2. Database Schema (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS avatar_ml_fishing_statistics (
  account_id INTEGER PRIMARY KEY REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  success_catches INTEGER NOT NULL DEFAULT 0 CHECK (success_catches >= 0),
  updated_at INTEGER NOT NULL
);
```

### 4.3. Repository Implementation (`fishingMlStatisticsRepo.ts`)

```ts
export class FishingMlStatisticsRepository {
  constructor(private readonly db: Database.Database) {}

  recordResult(accountId: number, isSuccess: boolean, updatedAt: number): MlFishingStatistics {
    const successInc = isSuccess ? 1 : 0;
    const stmt = this.db.prepare(`
      INSERT INTO avatar_ml_fishing_statistics (account_id, total_attempts, success_catches, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        total_attempts = total_attempts + 1,
        success_catches = success_catches + excluded.success_catches,
        updated_at = excluded.updated_at
      RETURNING total_attempts, success_catches, updated_at
    `);
    const row = stmt.get(accountId, successInc, updatedAt) as {
      total_attempts: number;
      success_catches: number;
      updated_at: number;
    };
    return formatMlStats(row);
  }

  read(accountId: number): MlFishingStatistics {
    const stmt = this.db.prepare(`
      SELECT total_attempts, success_catches, updated_at
      FROM avatar_ml_fishing_statistics
      WHERE account_id = ?
    `);
    const row = stmt.get(accountId) as {
      total_attempts: number;
      success_catches: number;
      updated_at: number;
    } | undefined;
    return formatMlStats(row);
  }
}
```

### 4.4. Tích hợp `AvatarSession` & `SessionManager`

- Trong `AvatarSessionOptions`, bổ sung:
  ```ts
  initialMlFishingStatistics?: MlFishingStatistics;
  onMlFishingResult?: (isSuccess: boolean, updatedAt: number) => MlFishingStatistics;
  ```
- `AvatarSession` quản lý biến:
  ```ts
  private mlFishingStatistics: MlFishingStatistics;
  private currentFishingChallengeSource?: 'ml' | 'random';
  ```
- Khi gửi TX 43:
  ```ts
  this.currentFishingChallengeSource = decision.source;
  ```
- Khi nhận kết quả (bắt được, sổng cá, hoặc dialog kết thúc):
  ```ts
  if (this.currentFishingChallengeSource === 'ml') {
    this.currentFishingChallengeSource = undefined;
    try {
      this.mlFishingStatistics = this.opts.onMlFishingResult?.(isSuccess, this.now())
        ?? this.mlFishingStatistics;
    } catch (err) {
      this.pushLog(`[câu cá] Lỗi ghi thống kê ML: ${(err as Error).message}`);
    }
  }
  ```
- Trong `SessionManager`:
  - Khởi tạo `FishingMlStatisticsRepository`.
  - Truyền `initialMlFishingStatistics` và callback `onMlFishingResult` khi tạo session.
  - Trong `automationSnapshot(accountId)`: luôn đọc số liệu mới nhất từ repo và overlay vào snapshot cả khi online và offline.

### 4.5. Web UI (`FishingPanel.tsx`)

Sử dụng narrowing cục bộ:
```ts
type AutomationWithMlStatistics = AutomationSnapshot & {
  mlFishingStatistics?: MlFishingStatistics;
};

function getMlFishingStatistics(
  automation: AutomationSnapshot | undefined,
): MlFishingStatistics | undefined {
  return (automation as AutomationWithMlStatistics | undefined)?.mlFishingStatistics;
}
```

Render thêm 1 ô thẻ metric trong lưới trạng thái (Live Metrics & Status):
- **Label:** `Tỉ lệ ML giải đúng`
- **Giá trị chính:** `{(stats.accuracy * 100).toFixed(1)}%` (hoặc `—` nếu chưa có lượt nào).
- **Subtext:** `(${stats.successCatches}/${stats.totalAttempts} lượt)`.

## 5. Ràng buộc an toàn & GitNexus

- **Server `AutomationSnapshot`**: Impact MEDIUM — cho phép thêm trường optional `mlFishingStatistics`.
- **Web `AutomationSnapshot` & `types.ts`**: Impact CRITICAL — **CẤM SỬA**. Toàn bộ type được khai báo cục bộ trong `FishingPanel.tsx`.
- **Server `FishingRuntimeState` & Web `FishingRuntimeState`**: Impact CRITICAL — **CẤM SỬA**. Không lưu thống kê này vào runtime state.
- **GitNexus Workflow**: Chạy kiểm tra impact trước khi sửa và `detect_changes` trước khi commit.

## 6. Kế hoạch xác minh (Verification Plan)

1. **Kiểm tra biên an toàn (Forbidden Boundaries):**
   - Xác nhận `git diff --name-only` không chứa `avatar-web/web/src/types.ts`.
   - Xác nhận không có bất kỳ thay đổi nào trong định nghĩa của `FishingRuntimeState`.
2. **Kiểm tra Typecheck & Build:**
   - Chạy `npm run build -w avatar-web/server` — yêu cầu không có lỗi TypeScript.
   - Chạy `npm run build -w avatar-web/web` — yêu cầu build web thành công.
3. **Kiểm tra Persistence & DB:**
   - Khởi động server với schema mới, kiểm tra bảng `avatar_ml_fishing_statistics` được tạo tự động.
   - Kiểm tra query upsert hoạt động đúng với trường hợp thành công và thất bại.
4. **Kiểm tra API & WebSocket:**
   - Gọi `GET /api/accounts/:id/automation`, kiểm tra trường `mlFishingStatistics` xuất hiện với các giá trị mặc định khi chưa có lượt câu.
   - Kiểm tra WebSocket payload nhận được `mlFishingStatistics` đồng bộ.
5. **Kiểm tra giao diện Web:**
   - Mở tab Câu cá của tài khoản trên trình duyệt.
   - Xác nhận thẻ metric "Tỉ lệ ML giải đúng" hiển thị đúng tỉ lệ phần trăm và số lượt đúng/tổng lượt.
