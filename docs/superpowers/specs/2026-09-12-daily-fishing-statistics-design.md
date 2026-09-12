# Thiết Kế Thống Kê Câu Cá Theo Ngày

> **Ngày lập:** 2026-09-12  
> **Trạng thái:** Chờ User Review  
> **Tài liệu liên quan:** `docs/superpowers/specs/2026-09-08-auto-fishing-web-integration-design.md`

## 1. Mục tiêu & bối cảnh

Auto Fishing hiện nhận `RX 43`, tăng `FishingRuntimeState.totalCatches` trong RAM và hiển thị tổng cùng cá gần nhất ở `FishingPanel`. Số liệu mất khi process khởi động lại, không phân biệt ngày và không cho biết cơ cấu loài cá.

Mục tiêu là lưu và hiển thị, cho từng tài khoản, thống kê **ngày hiện tại theo múi giờ `Asia/Ho_Chi_Minh`** gồm tổng số cá bắt thành công và số lượng theo từng `fishId`/tên cá. Số liệu phải sống qua reconnect, restart server và trạng thái tài khoản offline.

Lần thực thi trước dừng vì cả server và web `FishingRuntimeState` có impact HIGH/CRITICAL. Thiết kế mới giữ nguyên tuyệt đối hai type đó và đặt dữ liệu mới vào trường ngang hàng `dailyFishingStatistics` tại ranh giới `AutomationSnapshot`. Server `AutomationSnapshot` có impact MEDIUM nên được phép mở rộng cộng thêm; web `AutomationSnapshot` có impact CRITICAL nên không được sửa và chỉ được narrow cục bộ trong `FishingPanel`.

## 2. Phạm vi

### 2.1. In-scope

- Ghi nhận đúng một lượt khi `fishing-success-result` hợp lệ thuộc player hiện tại và `idFish >= 0`.
- Cộng dồn theo `(account_id, local_date, fish_id)` trong SQLite.
- Đọc tổng hợp của ngày hiện tại và đưa vào automation snapshot/API/WebSocket hiện có qua trường ngang hàng `dailyFishingStatistics`.
- Phát snapshot cập nhật qua event `automation` hiện có sau khi ghi thành công.
- Hiển thị trong tab Câu cá: ngày thống kê, tổng cá, danh sách loại cá và số lượng.
- Tên cá dùng catalog server `FISH_NAMES`; ID chưa biết hiển thị `Cá ID <id>`.
- Giữ nguyên toàn bộ contract và semantics hiện tại của server/web `FishingRuntimeState`.

### 2.2. Out-of-scope

- Lịch sử nhiều ngày, chọn khoảng ngày, biểu đồ, export, leaderboard hoặc thống kê gộp nhiều tài khoản.
- Thống kê lần quăng, giật hụt, thời gian câu, map/area, giá trị cá hay cá bán được.
- Sửa protocol, ML, runner Auto Fishing, cấu hình câu, nhiệm vụ Thợ Câu hoặc hành vi auto-farm định kỳ.
- Backfill số liệu trước khi feature được triển khai.
- Sửa server `FishingRuntimeState`, `idleFishingRuntime` hoặc bất kỳ logic nào nhằm đổi nghĩa `FishingRuntimeState.totalCatches`.
- Sửa web `FishingRuntimeState`, web `AutomationSnapshot` hoặc `avatar-web/web/src/types.ts`.
- Tạo test file hay thay đổi test hiện có; verification chỉ dùng typecheck/build, text search, kiểm tra DB/API và kiểm tra thủ công.

## 3. Input, output và trường hợp biên

### 3.1. Input nguồn sự thật

Sự kiện đã decode từ `GameClient`:

```ts
interface FishingSuccessResult {
  idUser: number;
  idFish: number;
}
```

Chỉ ghi khi session/client/connection epoch còn hiện hành, mode mong muốn là `auto_fishing`, `idUser === client.playerId` và `idFish >= 0`. `idFish < 0`, packet của người khác, event stale sau reconnect và lỗi decode không được tính.

### 3.2. DTO thống kê và snapshot server

```ts
interface DailyFishingSpeciesCount {
  fishId: number;
  fishName: string;
  count: number;
}

interface DailyFishingStatistics {
  date: string;               // YYYY-MM-DD tại Asia/Ho_Chi_Minh
  timezone: 'Asia/Ho_Chi_Minh';
  totalCatches: number;
  bySpecies: DailyFishingSpeciesCount[];
  updatedAt: number | null;   // Unix epoch milliseconds; null khi chưa có lượt
}

interface AutomationSnapshot {
  // toàn bộ fields hiện có giữ nguyên
  dailyFishingStatistics?: DailyFishingStatistics;
}
```

`dailyFishingStatistics` là field **ngang hàng** với `fishingRuntime`, không nằm trong `FishingRuntimeState`. Field server là optional để thay đổi mang tính additive và để các construction path cũ vẫn compile; mọi snapshot đi qua production `SessionManager` phải gắn field này.

`bySpecies` sắp xếp `count DESC`, rồi `fishId ASC` để UI ổn định. Khi chưa có dữ liệu: đúng ngày hiện tại, `totalCatches = 0`, `bySpecies = []`, `updatedAt = null`.

`FishingRuntimeState.totalCatches`, `lastFishId`, `lastFishName` và mọi runtime behavior hiện tại không bị đổi contract hay định nghĩa. UI thống kê ngày chỉ đọc `dailyFishingStatistics.totalCatches`; không dùng runtime counter làm nguồn persistence.

### 3.3. Narrowing cục bộ ở web

Web không mirror DTO vào `types.ts` và không sửa `AutomationSnapshot`. `FishingPanel.tsx` khai báo type cục bộ và helper chỉ đọc field optional từ JSON thực tế:

```ts
type AutomationWithDailyFishingStatistics = AutomationSnapshot & {
  dailyFishingStatistics?: DailyFishingStatistics;
};

function getDailyFishingStatistics(
  automation: AutomationSnapshot | undefined,
): DailyFishingStatistics | undefined {
  return (automation as AutomationWithDailyFishingStatistics | undefined)
    ?.dailyFishingStatistics;
}
```

Narrowing này cô lập feature tại consumer duy nhất, không lan contract qua hàng chục web modules đang phụ thuộc `AutomationSnapshot`.

### 3.4. Edge cases

- Hai lượt cùng loài trong cùng ngày: tăng nguyên tử một đơn vị.
- Hai session/process vô tình ghi đồng thời: SQLite upsert bảo toàn tổng, không dùng read-modify-write trong JavaScript.
- Process restart/reconnect/chuyển mode: không reset bản ghi ngày; snapshot tải lại từ DB.
- Qua nửa đêm: lượt trước 00:00 thuộc ngày cũ, lượt từ 00:00 thuộc ngày mới theo giờ Việt Nam; snapshot tiếp theo trả bucket mới dù session không restart.
- Đồng hồ hệ thống đổi ngược: phân bucket theo timestamp tại lúc nhận event; không di chuyển bản ghi đã ghi.
- `fishId` chưa có trong catalog: vẫn lưu theo ID và hiển thị fallback.
- Số đếm vượt `Number.MAX_SAFE_INTEGER`: repository từ chối cập nhật và báo lỗi; không trả số mất chính xác.
- Xóa account: thống kê bị xóa theo foreign key cascade.
- Payload web chưa có field additive: panel hiển thị empty/unavailable state an toàn, không suy đoán từ `FishingRuntimeState`.

## 4. Các phương án

### Phương án A — mở rộng `FishingRuntimeState`

Dễ nối vào UI cũ nhưng server type đã có impact CRITICAL và web type có blast radius lớn. Phương án này đã làm lần thực thi trước dừng và bị loại bỏ.

### Phương án B — sửa server và web `AutomationSnapshot`

Snapshot là đúng boundary phía server, nhưng web `AutomationSnapshot` có impact CRITICAL. Mirror contract trực tiếp vào `types.ts` sẽ buộc chạm ranh giới bị cấm, nên phương án này bị loại bỏ.

### Phương án C — snapshot server additive + web narrowing cục bộ (**lựa chọn**)

Server mở rộng optional field trên `AutomationSnapshot` có impact MEDIUM. `AvatarSession` giữ daily DTO ở state riêng, còn `SessionManager` luôn overlay kết quả repository mới nhất cho API/offline. Web giữ nguyên global types, dùng intersection/helper chỉ trong `FishingPanel`. Đây là thay đổi nhỏ nhất thỏa persistence, online/offline/API/WS và tránh cả ba contract rủi ro cao bị cấm.

## 5. Kiến trúc, modules và files

| File/module | Vai trò dự kiến |
| --- | --- |
| `avatar-web/server/src/db/schema.sql` | Tạo bảng/index aggregate idempotent cho DB mới. |
| `avatar-web/server/src/accounts/fishingStatisticsRepo.ts` | Chuyển timestamp sang ngày Việt Nam; upsert/read aggregate; map tên cá; cung cấp empty DTO. |
| `avatar-web/server/src/session/automationTypes.ts` | Khai báo DTO và thêm optional `AutomationSnapshot.dailyFishingStatistics`; không sửa `FishingRuntimeState`. |
| `avatar-web/server/src/session/avatarSession.ts` | Mở rộng LOW-impact `AvatarSessionOptions` bằng initial DTO/callback persistence; giữ DTO ở field riêng; gắn nó vào snapshot sau khi persist thành công. |
| `avatar-web/server/src/session/manager.ts` | Sở hữu repository, inject callback theo account và overlay current-day DTO vào mọi online/offline GET snapshot. |
| `avatar-web/server/src/session/routes.ts` | Giữ endpoint `GET /:id/automation`, chuẩn hóa lỗi read thành HTTP 500 theo convention hiện có; không thêm endpoint. |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Khai báo DTO/intersection/helper cục bộ, refresh sau nửa đêm và hiển thị thống kê. |

Các file bị cấm sửa: `avatar-web/web/src/types.ts`; mọi phần định nghĩa hoặc helper của server/web `FishingRuntimeState`; mọi phần định nghĩa web `AutomationSnapshot`.

Không dùng `avatar_runtime_snapshot_cache`: cache đó là snapshot quan sát có thể bị thay thế, không phù hợp counter cần cộng nguyên tử. Không nhân đôi catalog tên cá ở persistence; server là nguồn tên chuẩn, web render tên từ DTO. Catalog cũ trong `FishingPanel` chỉ còn phục vụ live last-fish hiện tại và không được dùng để map `dailyFishingStatistics`.

## 6. Persistence và ranh giới ngày

Schema:

```sql
CREATE TABLE IF NOT EXISTS avatar_daily_fishing_statistics (
  account_id INTEGER NOT NULL REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  fish_id INTEGER NOT NULL CHECK (fish_id >= 0),
  catch_count INTEGER NOT NULL CHECK (catch_count >= 1),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, local_date, fish_id),
  CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_avatar_daily_fishing_account_date
  ON avatar_daily_fishing_statistics(account_id, local_date);
```

Ghi dùng `INSERT ... ON CONFLICT(account_id, local_date, fish_id) DO UPDATE SET catch_count = catch_count + 1, updated_at = excluded.updated_at` trong một statement.

`toVietnamDateKey(timestampMs)` dùng `Intl.DateTimeFormat(...).formatToParts(...)` với timezone `Asia/Ho_Chi_Minh` và dựng chắc chắn `YYYY-MM-DD`; không cộng cứng `+07:00`, không phụ thuộc timezone host/database/browser. Cùng timestamp được dùng cho `local_date` và `updated_at`.

Không cần timer reset server lúc 00:00. Mỗi lần ghi và mỗi lần `SessionManager.automationSnapshot(accountId)` đều tính date key hiện tại; query chỉ đọc key đó nên ngày mới tự bắt đầu ở 0. `FishingPanel` đặt timer chỉ để gọi callback refresh hiện có ngay sau mốc đổi ngày Việt Nam; timer không sửa dữ liệu.

## 7. Contracts và flow

### 7.1. Callback session và state tách biệt

```ts
interface AvatarSessionOptions {
  initialDailyFishingStatistics?: DailyFishingStatistics;
  onFishingCatch?: (
    fishId: number,
    caughtAt: number,
  ) => DailyFishingStatistics;
}

class AvatarSession {
  private dailyFishingStatistics: DailyFishingStatistics;
}
```

Hai option là optional để các harness hiện có compile mà không sửa tests. Production `SessionManager` luôn truyền cả hai. `AvatarSession` dùng `this.now()` đúng một lần cho lượt bắt; callback đồng bộ phù hợp `better-sqlite3`, trả DTO persisted mới hoặc throw.

Field riêng `dailyFishingStatistics` không nằm trong `fishingRuntime`. Default cho construction path không-production là empty DTO theo ngày Việt Nam tại thời điểm tạo session.

### 7.2. Flow catch thành công và WebSocket

1. `GameClient` decode `RX 43` và emit `{ idUser, idFish }`.
2. `AvatarSession` áp dụng toàn bộ guard ownership/staleness hiện có.
3. Với `idFish >= 0`, session lấy `caughtAt` một lần và gọi `onFishingCatch(idFish, caughtAt)` trước khi công bố tổng persisted.
4. Repository tính date key Việt Nam và upsert atomic, sau đó trả `DailyFishingStatistics` mới.
5. Session thay field riêng `dailyFishingStatistics`, cập nhật live fish/runtime theo flow hiện có, log và emit `automationSnapshot()` có field ngang hàng `dailyFishingStatistics`.
6. `SessionManager.onEvent`/broadcast hiện có chuyển payload nguyên vẹn qua WebSocket; web runtime giữ extra JSON property dù global TypeScript type không khai báo nó.
7. `FishingPanel` dùng helper cục bộ để đọc field và render.

### 7.3. Flow API, online và offline

1. `GET /api/accounts/:id/automation` gọi `SessionManager.automationSnapshot(accountId)` như hiện tại.
2. Manager đọc `FishingStatisticsRepository.readToday(accountId)` trên mỗi GET để bắt đúng ngày hiện tại.
3. Nếu có live snapshot, manager trả `{ ...live, dailyFishingStatistics }`.
4. Nếu offline, manager trả `{ ...offlineAutomationSnapshot(persisted), dailyFishingStatistics }`.
5. Nhờ overlay cuối cùng tại manager, API luôn dùng DB làm nguồn sự thật kể cả session được tạo trước nửa đêm hoặc snapshot live tạm cũ.

## 8. Xử lý lỗi và tính nhất quán

- **Ghi DB thất bại:** không thay field `dailyFishingStatistics` và không công bố tổng ngày chưa lưu. Giữ live last fish, đặt `lastError`, log cảnh báo “đã bắt nhưng không ghi được thống kê”, emit snapshot với daily DTO thành công gần nhất và tiếp tục automation.
- **Callback không được cấu hình:** construction path không-production đi cùng failure behavior rõ ràng; production manager bắt buộc cấu hình callback.
- **Đọc DB thất bại:** GET trả HTTP 500 theo convention route; không thay bằng empty/zero. Web giữ dữ liệu thành công gần nhất vì refresh ngầm đã có behavior bỏ qua lỗi mạng.
- **Timezone/Intl không khả dụng hoặc timestamp không hữu hạn:** fail closed ở repository, không ghi bucket sai.
- **Tên catalog thay đổi:** dữ liệu chỉ lưu `fish_id`; lần đọc sau hiển thị tên mới mà không migration.
- **Atomicity:** chỉ thay daily DTO sau khi upsert hoàn tất; không suy ra tổng ngày từ `FishingRuntimeState.totalCatches`.
- **Duplicate:** protocol không có event ID/idempotency key, nên spec giả định mỗi `fishing-success-result` hợp lệ được `GameClient` emit đúng một lần. Chống duplicate tuyệt đối cần thay protocol/event ledger và nằm ngoài scope.

## 9. GitNexus và stale-index gate

Kết quả impact đã biết cho thiết kế này:

- Server `FishingRuntimeState`: HIGH/CRITICAL — tuyệt đối không sửa.
- Web `FishingRuntimeState`: HIGH/CRITICAL — tuyệt đối không sửa.
- Server `AutomationSnapshot`: MEDIUM — được phép thêm optional field.
- Web `AutomationSnapshot`: CRITICAL — tuyệt đối không sửa.
- `AvatarSessionOptions`: LOW trong lần phân tích quyết định kiến trúc — được phép thêm callback/initial DTO.

Index hiện stale và refresh index đã thất bại. Mỗi task production phải:

1. Hiển thị cảnh báo stale index trong báo cáo pre-edit; không mô tả kết quả graph là complete/current.
2. Chạy `impact(..., direction: "upstream")` cho symbol sẽ sửa dù index stale.
3. Chạy text search được chỉ định trong plan để xác nhận definitions, constructors, callers, object literals và forbidden files trên working tree hiện tại.
4. Dừng nếu graph hiện tại trả HIGH/CRITICAL cho một symbol dự định sửa hoặc text search cho thấy phải sửa server/web `FishingRuntimeState` hay web `AutomationSnapshot`.
5. Chạy `detect_changes({scope: "all"})` trước mỗi commit. Nếu `partial`/`truncated`, hoặc do staleness không thể xác nhận đầy đủ, phải báo unresolved và bổ sung `git diff --check`, scoped `git diff --name-only` và text-search validation; không gọi graph result là clean.

Không lặp lại index refresh đã biết là thất bại như một điều kiện tiến hành. Staleness phải được giữ thành cảnh báo minh bạch cho tới khi môi trường index được sửa.

## 10. Verification plan (không tạo test)

1. Text-search forbidden boundary trước và sau implementation: xác nhận không có diff trong `avatar-web/web/src/types.ts`, không có diff ở definitions/usages của server/web `FishingRuntimeState`, và `dailyFishingStatistics` chỉ xuất hiện ở server additive snapshot path cùng helper/render cục bộ trong `FishingPanel`.
2. Chạy typecheck/build hiện có của `avatar-web/server` và build của `avatar-web/web`; kỳ vọng không lỗi TypeScript/build.
3. Dùng DB tạm hoặc account thử nghiệm, bắt hai cá cùng ID và một cá ID khác; kiểm tra bảng có hai row với count `2` và `1`, API trả total `3`, thứ tự loài đúng contract.
4. Quan sát WebSocket `automation`: payload có `dailyFishingStatistics` ngang hàng với `fishingRuntime`; runtime fields giữ nguyên shape.
5. Reload web, disconnect account và restart server; GET cùng UI vẫn hiển thị tổng/cơ cấu của ngày hiện tại.
6. Giả lập 23:59:59 và 00:00:00 `Asia/Ho_Chi_Minh`; kiểm tra hai lượt vào hai `local_date`, GET sau mốc trả bucket mới và panel tự refresh dù không có catch mới.
7. Đổi timezone host/browser sang timezone khác; date key và nhãn ngày vẫn theo Việt Nam.
8. Gửi/quan sát event `idFish < 0`, player khác và event stale sau reconnect; kiểm tra không có row/count mới.
9. Dùng fish ID chưa có catalog; kiểm tra vẫn cộng và UI hiển thị `Cá ID <id>` từ server DTO.
10. Tạm làm DB không ghi/đọc được trên dữ liệu disposable; kiểm tra automation tiếp tục sau write failure, daily total không tăng sai, GET read failure trả 500 và web giữ snapshot thành công gần nhất.
11. Kiểm tra responsive tab Câu cá trên desktop/mobile; ngày, tổng, danh sách loài, status, nhiệm vụ, last fish, map/area và điều hướng cài đặt đều đọc/dùng được.
12. Chạy `git diff --check`, placeholder scan và scoped file-list comparison; kỳ vọng implementation chỉ chạm file được plan liệt kê và không sửa test.

## 11. Tự review spec

- Scope vẫn là một lát cắt server persistence → additive snapshot/API/WS → `FishingPanel`.
- Contract ngày, ordering, empty state, lỗi và source of truth được xác định duy nhất.
- Không có thay đổi nào vào server/web `FishingRuntimeState`, web `AutomationSnapshot` hoặc web `types.ts`.
- Stale-index limitation và text-search validation bắt buộc đã được đưa vào mọi gate liên quan.
- Không yêu cầu tạo/sửa test; production chỉ được thực thi sau khi user duyệt riêng spec và plan.
