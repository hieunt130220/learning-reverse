# Auto Tìm NPC V1 Design

**Ngày:** 2026-08-24  
**Trạng thái:** Đã được user duyệt ngày 2026-08-24  
**Design đã duyệt trong brainstorm:** phạm vi v1, state machine, persistence/API/UI, live probe, safety và verification

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu

Bổ sung chế độ tự động **Tìm NPC** cho từng tài khoản Avatar Web. Chế độ này chuyển nhân vật qua một catalog map/khu đã được live-verify, đọc danh sách `ItemMapSpecial` từ snapshot enter-world `cmd -34`, khớp chính xác tên NPC, lưu và hiển thị vị trí tìm thấy, sau đó bám tại vị trí đó cho đến khi xác nhận NPC biến mất.

V1 chỉ **tìm và bám**. V1 không đánh NPC, không gọi menu NPC, không nhận quà và không đồng bộ vị trí qua dịch vụ bên ngoài.

### 1.2. Bối cảnh hiện tại

- `AvatarSession` đang giữ một `GameClient`, một `AutoFarm` và các runner/runtime khác.
- Ý muốn chạy AutoFarm hiện được lưu bằng `avatar_accounts.auto_enabled`; cấu hình farm nằm trong `auto_config_json`.
- Endpoint `/auto/start` và `/auto/stop` đang điều khiển AutoFarm trực tiếp.
- `GameClient` đã xử lý `cmd -34` để cập nhật trạng thái đăng nhập và số dư, nhưng chưa decode phần enter-world thành danh sách `ItemMapSpecial` dùng cho tìm NPC.
- Phân tích APK đã xác minh static payload của `GET_HANDLER -1`, `AVATAR_JOIN_PARK 80`, `SELECTED_MINI_MAP -23` và cấu trúc enter-world `-34`.
- Ánh xạ cặp map/khu thực tế chưa được live-verify. Production không được quét đoán `0..8` hoặc một dải khu tùy ý.

### 1.3. Tài liệu nguồn

- `.superpowers/brainstorm/9319-1787535780/content/state-machine.html`
- `docs/Phân tích kỹ thuật giao thức  — Di chuyển Map & Tìm NPC trong AvatarHD.md`
- `docs/Phân tích chức năng Tìm NPC trên 3x.4utovip.com.md`

## 2. Phạm vi

### 2.1. In-scope

1. Một automation coordinator cấp session với đúng một desired mode:
   - `off`
   - `auto_farm`
   - `find_npc`
2. Chuyển mode tuần tự qua trạng thái `switching`; tối đa một runner sở hữu `GameClient` tại một thời điểm.
3. Persistence riêng cho desired mode, cấu hình Find NPC có revision và vị trí NPC gần nhất.
4. Migration tương thích dữ liệu `auto_enabled` hiện có.
5. Protocol primitives cho park context và join map/khu.
6. Decoder enter-world `-34` trả danh sách `ItemMapSpecial` mà không thay đổi side effect login/wallet hiện có.
7. Tool live probe nội bộ, redacted, giới hạn từng cặp map/khu.
8. Catalog production chỉ chứa cặp map/khu có evidence live hợp lệ.
9. Runner `AutoFindNpc` theo state machine đã duyệt.
10. API cấu hình, start/stop và đọc trạng thái automation.
11. WebSocket snapshot/event cho trạng thái automation.
12. UI đầy đủ: nhập tên NPC, lưu cấu hình, bật/tắt, xem tiến độ và vị trí.
13. Error handling, cancellation, reconnect và scan backoff.
14. Static/build/regression verification và manual/live verification sau production code.

### 2.2. Out-of-scope

- Gửi opcode đánh/tương tác/menu để nhận quà.
- `REQUEST_JOIN_ANY -21` và hai context byte chưa xác minh.
- Tự chuyển sang mode khác sau khi tìm thấy.
- Đồng bộ vị trí giữa các account hoặc với `4utovip`/dịch vụ ngoài.
- Lập lịch theo giờ hoặc theo sự kiện.
- Cho user tự nhập catalog map/khu.
- Brute-force toàn bộ không gian map/khu.
- Tạo test file mới hoặc viết test mới khi user chưa yêu cầu.

## 3. Global Invariants

1. **DB là nguồn sự thật của ý muốn:** persist `desired_mode` trước khi chạm runtime.
2. **Một session, một runner:** AutoFarm và AutoFindNpc không bao giờ chạy đồng thời.
3. **Mọi chuyển mode đi qua cleanup:** `old runner stop → await cleanup → đổi context → start runner mới`.
4. **Không quét đoán:** catalog production không được chứa cặp thiếu evidence live.
5. **Không gửi lệnh nhận quà:** v1 chỉ dùng command context/join đã nằm trong phạm vi.
6. **Một join in-flight:** không gửi join kế tiếp khi bước trước chưa thành công, timeout hoặc bị hủy.
7. **Stop/switch là hủy thật:** mọi timer, listener và pending wait của runner cũ phải được cleanup trước khi runner mới chạy.
8. **Không hiển thị location stale:** restart/reconnect vào `find_npc` xóa location cũ trước lần quét đầu.
9. **Exact-name match:** chuẩn hóa cả target và tên nhận được bằng `normalize('NFC').trim().toLocaleLowerCase('vi')`, sau đó so sánh toàn chuỗi.
10. **Backward compatibility:** endpoint AutoFarm cũ và account có `auto_enabled=1` vẫn khởi động AutoFarm sau migration.

## 4. Kiến trúc & Modules

### 4.1. Automation persistence

**Files:**

- `avatar-web/server/src/db/schema.sql`
- `avatar-web/server/src/accounts/automationRepo.ts` (mới)
- `avatar-web/server/src/accounts/repo.ts`

Thêm bảng và backfill idempotent trong `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS avatar_automation_state (
  account_id              INTEGER PRIMARY KEY
                          REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  desired_mode            TEXT NOT NULL DEFAULT 'off'
                          CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc')),
  find_npc_config_json    TEXT,
  current_map             INTEGER,
  current_area            INTEGER,
  location_observed_at    INTEGER,
  updated_at              INTEGER NOT NULL,
  CHECK (
    (current_map IS NULL AND current_area IS NULL AND location_observed_at IS NULL)
    OR
    (current_map IS NOT NULL AND current_area IS NOT NULL AND location_observed_at IS NOT NULL)
  )
);

INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
SELECT id,
       CASE WHEN auto_enabled = 1 THEN 'auto_farm' ELSE 'off' END,
       updated_at
FROM avatar_accounts
ON CONFLICT(account_id) DO NOTHING;
```

`find_npc_config_json` dùng envelope:

```typescript
interface FindNpcConfig {
  npcName: string;
}

interface StoredFindNpcConfigEnvelope {
  version: 1;
  revision: number;
  config: FindNpcConfig;
}

interface StoredFindNpcConfigState {
  revision: number;
  config: FindNpcConfig;
}
```

Rules:

- Schema backfill tạo row cho mọi account hiện có. Legacy account có `auto_enabled=1` được backfill `desired_mode='auto_farm'`; các account còn lại là `off`.
- Defensive read khi chưa có row vẫn trả state mặc định `off`, config revision `0`, `npcName: ''`, location `null`; lần ghi đầu tạo row.
- Khi ghi desired mode:
  - `auto_farm` đồng bộ `avatar_accounts.auto_enabled=1` để rollback-compatible.
  - `off` hoặc `find_npc` đồng bộ `auto_enabled=0` để code cũ không diễn giải Find NPC thành AutoFarm.
- Ghi desired mode và cờ legacy trong cùng transaction.
- Config Find NPC dùng compare-and-swap theo `expectedRevision`.
- `npcName` được trim và phải dài 1–80 Unicode code points; reject key lạ.
- Location chỉ được ghi từ snapshot đã match. Xóa cả ba field location trong một update nguyên tử.

`AutomationRepository` không giữ runtime state. Runtime state thuộc `AvatarSession`/runner.

### 4.2. Automation coordinator

**Files:**

- `avatar-web/server/src/session/avatarSession.ts`
- `avatar-web/server/src/session/manager.ts`
- `avatar-web/server/src/session/automationTypes.ts` (mới)

Types công khai:

```typescript
type AutomationMode = 'off' | 'auto_farm' | 'find_npc';
type AutomationTransitionState = 'stable' | 'switching';

interface AutomationLocation {
  map: number;
  area: number;
  observedAt: number;
}

interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: AutomationTransitionState;
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  location: AutomationLocation | null;
}
```

`AvatarCredentials` thay `autoEnabled` bằng dữ liệu automation đã chuẩn hóa, đồng thời vẫn đọc `autoConfig` cho farm:

```typescript
interface LoadedAutomationIntent {
  desiredMode: AutomationMode;
  findNpcConfig: StoredFindNpcConfigState;
  location: AutomationLocation | null;
}
```

Coordinator giữ:

- `desiredMode`: intent đã persist.
- `activeMode`: runner đã sở hữu client; `off` khi không runner.
- `transitionState`: `stable | switching`.
- Promise chain/mutex nội bộ để serialize mọi `switchAutomationMode`.
- `AutoFarm` và `AutoFindNpc` nhưng chỉ một instance running.

Flow chuyển mode:

1. Tầng route/repository persist intent.
2. `SessionManager.switchAutomationMode(accountId, intent)` lấy hoặc tạo session.
3. Session đưa transition về `switching`, phát event `automation`.
4. Stop runner cũ và `await` cleanup.
5. Nếu target là `off`, đặt `activeMode='off'`, `stable`; chỉ dừng automation runner, giữ `GameClient` online nếu nó đang online.
6. Nếu target khác `off` và client chưa online, coordinator gọi `start()` để tạo/kết nối session. Trong thời gian chờ login, desired mode đã phản ánh intent còn `activeMode='off'`, `transitionState='switching'`.
7. `onOnline` đọc `desiredMode` hiện tại và chỉ start runner tương ứng; không dùng hai boolean độc lập như `wantAuto`/`wantFindNpc`.
8. Nếu target là `auto_farm`, đổi về farm context theo flow AutoFarm hiện có rồi start AutoFarm.
9. Nếu target là `find_npc`, xóa location cũ, chuyển park handler và start AutoFindNpc.
10. Thành công: cập nhật `activeMode`, `stable`, phát snapshot.
11. Start lỗi do kết nối tạm thời: giữ desired mode để reconnect policy hiện có thử lại; snapshot có `activeMode='off'` và lỗi mới nhất.
12. Start lỗi xác định do runner/config/catalog/protocol initialization: transactionally persist `off`, cleanup runner, đưa `desiredMode/activeMode` về `off`, `stable`, phát snapshot; không lặp start ở mỗi reconnect.

`SessionManager.bootstrap()` không còn chỉ gọi `listAutoEnabled()`: nó đọc mọi account có `desired_mode IN ('auto_farm', 'find_npc')` từ bảng automation mới và connect tuần tự với `BOOTSTRAP_STAGGER_MS`. Permanent login failure gọi tầng trên transactionally persist `off` và phát `automation-disabled`. Reconnect tạm thời không đổi desired mode.

### 4.3. Protocol và world snapshot

**Files:**

- `avatar-web/server/src/game/client.ts`
- `avatar-web/server/src/game/parkService.ts` (mới; chỉ encode `cmd 80`)
- `avatar-web/server/src/game/worldData.ts` (mới)
- `avatar-re/frida_scripts/parser.ts` (reference; không bắt buộc sửa)

`ParkService` chỉ encode các command v1:

```typescript
doJoinPark(map: number, area: number): void; // cmd 80, i8 roomID, i8 boardID
```

`GameClient` duy trì `currentHandlerContext: 8 | 9 | 10 | 'unknown'`: set `8` khi gửi handshake client type, set `9`/`10` khi gửi đổi handler, và reset `'unknown'` khi socket đóng/logout. `enterParkContext()` gửi `GET_HANDLER (-1) + i8 9` đúng một lần khi context hiện tại khác `9`, sau đó là no-op; quy tắc này tránh xin lại cùng handler và bị server đóng socket như flow farm đã quan sát.

Catalog v1 định nghĩa `map`/`area` chính xác là `roomID`/`boardID` của `cmd 80`. Đây là giả thuyết phải được probe chứng minh trước khi có production entry. Nếu probe chứng minh cặp UI cần `SELECTED_MINI_MAP -23` thay vì `cmd 80`, Spec phải được sửa và review lại; v1 không lưu opcode động trong từng entry và không tự fallback sang `-23`.

Không expose `requestJoinAny` hoặc `SELECTED_MINI_MAP` trong production v1.

`decodeEnterWorld(body)` trả:

```typescript
interface MapSpecial {
  id: number;
  name: string;
  type: number;
  imageIds: number[];
  menuIds: number[];
}

interface EnterWorldSnapshot {
  playerId: number;
  specials: MapSpecial[];
  specialSectionEnd: number;
  totalBytes: number;
  trailingBytes: number;
}
```

Decoder phải parse tuần tự layout đã static-verify trong `avatar-re/notes/login.md`: header → `readListPlayer` (15 state fields có width đã chốt) → map item types → map items → animations → `ItemMapSpecial[]`. Repository không có body `-34` raw/redacted đã commit để replay: evidence cũ chỉ là prose của packet `special=0`, không đủ xác minh record `ItemMapSpecial`. Vì vậy implementation port decoder reference bằng production code và static verification trước; lần xác minh đầu tiên trên body thật có special phải diễn ra trong controlled live probe ở §4.4. Không được tạo fixture/capture giả hoặc báo đã replay offline.

Decoder rules:

- kiểm tra biên trước mọi read và giới hạn count động để không đọc quá buffer;
- `playerId > 0` và section special phải parse trọn;
- `readItemDataMapSpecial` phải consume đúng toàn bộ từng item;
- protocol note ghi handler có thể có field phụ sau special, nên không yêu cầu `specialSectionEnd === totalBytes`; trả `trailingBytes` để evidence thấy rõ, và chỉ chấp nhận trailing bytes nếu live probe lặp lại cho cùng server build cho thấy giá trị ổn định/đã được redacted-review;
- ném lỗi typed có offset/section, không chứa credential;
- dùng body buffer độc lập, không phụ thuộc vị trí mutable của `msg.reader`.

Nếu decoder reference không tới được special trên live park packet, không được tạo catalog entry hoặc tiếp tục runner bằng offset scan/heuristic. Khi đó dừng ở protocol investigation, cập nhật tài liệu reverse và đưa Spec quay lại review gate.

Trong `GameClient.onMessage(-34)`:

- giữ nguyên toàn bộ hành vi login/player/wallet hiện có;
- thử decode world snapshot độc lập;
- nếu thành công, phát `world-snapshot`;
- nếu decode lỗi, log command/length/section/offset và phát `world-snapshot-error`; không crash process và không đổi status online đã xác định được.

`GameClient` cung cấp wait hẹp cho runner:

```typescript
enterParkContext(): void;
joinPark(map: number, area: number): void;
waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot>;
```

Mỗi wait gắn listener riêng, resolve đúng một snapshot mới sau join, và cleanup khi resolve/reject/timeout/abort.

### 4.4. Live probe và catalog gate

**Files:**

- `avatar-web/server/src/tools/npc-map-probe.ts` (mới)
- `avatar-web/server/src/game/npcMapCatalog.ts` (mới, chỉ tạo sau probe)
- `docs/protocol/npc-map-probe-evidence-2026-08-24.md` (mới, redacted)

Tool chạy thủ công với đúng một cặp mỗi invocation:

```text
npm --prefix avatar-web/server exec -- tsx src/tools/npc-map-probe.ts \
  --account-id <id> --map <signed-byte> --area <signed-byte>
```

Safety guard của tool:

- yêu cầu `--account-id`, `--map`, `--area`;
- không nhận range;
- không in game user/password/MASTER_KEY;
- một session, một join attempt;
- delay ít nhất 2 giây sau context switch trước join;
- timeout 5 giây;
- luôn disconnect/cleanup trong `finally`;
- output redacted gồm timestamp, account id, TX cmd/length, RX cmd/length, decode status, `specialSectionEnd/totalBytes/trailingBytes`, số special và tên special;
- precondition bắt buộc: dừng Avatar Web server trước khi chạy probe; tool thử health-check local server theo port cấu hình và fail-fast nếu server còn phản hồi, vì SQLite không chứng minh được account không có socket ở process khác;
- map/area phải là signed-byte (`-128..127`), nhưng v1 chỉ chấp nhận candidate đã nêu rõ trong lệnh thủ công, không sinh candidate kế tiếp.

Một cặp được phép vào production catalog khi evidence chứng minh:

1. đã gửi `GET_HANDLER 9` đúng một lần khi đổi context;
2. đã gửi `cmd 80(roomID=map, boardID=area)`;
3. nhận `cmd -34` mới sau join;
4. decoder parse tuần tự tới hết section special, mọi `ItemMapSpecial` consume đúng layout;
5. snapshot có `playerId > 0`; danh sách special có thể rỗng;
6. `trailingBytes` bằng `0`, hoặc phần trailing đã được live-probe lặp lại và review/redact thành evidence ổn định cho đúng server build.

Catalog production là readonly constant:

```typescript
interface NpcMapLocation {
  map: number;
  area: number;
}

export const VERIFIED_NPC_MAP_CATALOG = VERIFIED_ENTRIES_FROM_EVIDENCE;
```

`VERIFIED_ENTRIES_FROM_EVIDENCE` không phải symbol trung gian để implement nguyên văn: Plan chỉ được tạo `npcMapCatalog.ts` sau probe và phải chép các object literal `{ map, area }` từ evidence đã commit. Không tạo constant với dữ liệu đoán hoặc catalog rỗng rồi giả vờ feature sẵn sàng. Nếu chưa có ít nhất một cặp verified, chưa tạo module catalog; API start Find NPC dùng catalog provider trả empty và phản hồi `409` với code `catalog-unverified`.

### 4.5. AutoFindNpc runner

**File:** `avatar-web/server/src/autoFindNpc.ts` (mới)

States:

```typescript
type AutoFindNpcPhase =
  | 'idle'
  | 'scanning'
  | 'scan_backoff'
  | 'tracking'
  | 'stopping';
```

Runtime snapshot:

```typescript
interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  current?: NpcMapLocation;
  timeoutStreak: number;
  backoffUntil?: number;
  lastError?: string;
}
```

Dependencies:

```typescript
interface AutoFindNpcClient {
  enterParkContext(): void;
  joinPark(map: number, area: number): void;
  waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot>;
}
```

Runner nhận catalog readonly, callbacks `onState`, `onFound`, `onMissing`, clock/timer injectables. Runner không import DB, Express hoặc SessionManager.

#### Scan loop

1. Cursor lấy cặp kế tiếp từ catalog ổn định.
2. Chờ bảo đảm tối thiểu 2.000 ms từ join trước.
3. Gửi join và chờ snapshot tối đa 5.000 ms.
4. Match tên normalized toàn chuỗi.
5. Không thấy: cursor tiến một bước.
6. Thấy: callback persist location, chuyển `tracking`, giữ nguyên map/khu.
7. Hết catalog: `scan_backoff` 30.000 ms, rồi reset cursor về `0`.

Timeout/decode failure:

- tăng `timeoutStreak`;
- backoff `min(60_000, 5_000 * 2^(timeoutStreak-1))`;
- snapshot hợp lệ reset streak về `0`;
- không gửi join mới trong backoff.

#### Tracking

- Không join map khác.
- Refresh lại đúng cặp đã tìm thấy.
- Chỉ xác nhận biến mất khi có **hai snapshot hợp lệ liên tiếp** không chứa target, cách nhau ít nhất 2.000 ms.
- Snapshot có target reset missing count về `0` và cập nhật `observedAt`.
- Sau xác nhận biến mất: callback xóa location, cursor chuyển sang phần tử kế sau vị trí hiện tại, phase về `scanning`.

#### Stop

`stop()` idempotent và trả Promise chỉ resolve sau khi:

- AbortController đã abort pending wait;
- timer hiện tại đã clear;
- listener thuộc runner đã được gỡ;
- không callback state/location nào còn chạy sau resolve;
- phase cuối là `idle`, `running=false`.

### 4.6. API contracts

**File:** `avatar-web/server/src/session/routes.ts`

Tất cả endpoint dùng `requireOwnedAccount` và auth hiện có.

#### `GET /api/accounts/:id/automation`

Response:

```json
{
  "desiredMode": "find_npc",
  "activeMode": "find_npc",
  "transitionState": "stable",
  "findNpcConfig": {
    "revision": 2,
    "config": { "npcName": "Ngưu Lang" }
  },
  "findNpcRuntime": {
    "phase": "tracking",
    "running": true,
    "targetName": "Ngưu Lang",
    "cursor": 3,
    "total": 12,
    "current": { "map": 5, "area": 7 },
    "timeoutStreak": 0
  },
  "location": { "map": 5, "area": 7, "observedAt": 1787535780000 }
}
```

Khi không có live session, `activeMode='off'`, `transitionState='stable'`, runtime `idle`; desired/config/location vẫn đọc từ DB.

#### `PUT /api/accounts/:id/automation/find-npc/config`

Body chính xác:

```json
{
  "expectedRevision": 2,
  "config": { "npcName": "Ngưu Lang" }
}
```

- Payload/key/type sai: `400 invalid-find-npc-config`.
- Revision stale: `409 revision-conflict` kèm `current`.
- Save thành công khi runner đang chạy không tự mutate target giữa vòng; trả `application: 'next-start'`.
- User muốn đổi target đang chạy phải save rồi start `find_npc` lại; coordinator restart runner qua cleanup.

#### `POST /api/accounts/:id/automation/start`

Body:

```json
{ "mode": "auto_farm" }
```

hoặc:

```json
{ "mode": "find_npc" }
```

Validation:

- mode lạ/key thừa: `400 invalid-automation-mode`;
- Find NPC chưa có tên: `400 find-npc-name-required`;
- catalog chưa verified/có zero entry: `409 catalog-unverified`;
- persist thất bại: không chạm runtime;
- kết nối tạm thời thất bại sau persist: `409 automation-connect-pending`, giữ desired intent để retry và trả snapshot;
- runner/config/catalog/protocol init fail: persist lại `off`, cleanup, trả `500 automation-start-failed` cùng snapshot đã rollback.

Success body là automation snapshot đầy đủ. Nếu request phải login, route `await` lần connect ban đầu; khi login thành công response có `activeMode=mode, stable`. Nếu connect bị đóng/từ chối tạm thời, response dùng `automation-connect-pending` như trên thay vì trả thành công giả.

Mọi lỗi automation dùng shape thống nhất, không reuse helper `fail()` dựa trên substring:

```typescript
interface AutomationApiError {
  error: string;
  code:
    | 'invalid-automation-mode'
    | 'invalid-find-npc-config'
    | 'find-npc-name-required'
    | 'catalog-unverified'
    | 'revision-conflict'
    | 'automation-connect-pending'
    | 'automation-start-failed';
  snapshot?: AutomationSnapshot;
  current?: StoredFindNpcConfigState;
}
```

#### `POST /api/accounts/:id/automation/stop`

- Body phải là object rỗng hoặc không có body; key lạ trả `400 invalid-automation-mode`.
- Persist `off` trước rồi `await` cleanup runtime.
- Không disconnect `GameClient`; connection control vẫn thuộc `/connect` và `/disconnect`.
- Idempotent; response là automation snapshot mới nhất.

#### Backward-compatible aliases

- `POST /:id/auto/start` giữ normalize/merge AutoFarm config hiện có, sau đó gọi start mode `auto_farm` qua coordinator.
- `POST /:id/auto/stop` persist `off`, await cleanup runner, rồi **disconnect session** để giữ behavior legacy hiện tại. Endpoint chung `/automation/stop` chỉ dừng automation và giữ session online; `/disconnect` vẫn là control kết nối tách biệt.
- `GET/PUT /:id/auto/config` giữ nguyên contract và revision hiện có.

### 4.7. Snapshot và WebSocket

**Files:**

- `avatar-web/server/src/session/avatarSession.ts`
- `avatar-web/server/src/session/manager.ts`
- `avatar-web/web/src/types.ts`
- `avatar-web/web/src/accounts/accountRuntime.ts`

Thêm `automation` vào `AvatarSessionSnapshot`. Event WebSocket `automation` luôn mang toàn bộ field này, không phải patch nhỏ. Web reducer thay nguyên khối khi nhận event.

Mỗi automation snapshot phải tự nhất quán:

- `activeMode='find_npc'` chỉ khi runner Find NPC running.
- `activeMode='auto_farm'` khi AutoFarm đang chạy hoặc đang ở interval giữa hai cycle nhưng vẫn giữ desired AutoFarm ownership; nếu `logoutAfterCycle=true`, connection có thể idle trong interval nhưng `activeMode` vẫn là `auto_farm` cho đến khi stop/switch.
- `transitionState='switching'` trong toàn bộ cleanup/start window.
- location persist có thể tồn tại khi session offline trong GET API; session snapshot mới sau reconnect xóa location trước scan.

### 4.8. UI

**Files:**

- `avatar-web/web/src/accounts/panels/FindNpcPanel.tsx` (mới)
- `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
- `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- `avatar-web/web/src/accounts/accountRuntime.ts`
- `avatar-web/web/src/types.ts`
- CSS hiện có của account drawer/panels

#### Find NPC panel

- Tab mới: `Tìm NPC`.
- Input label `Tên NPC chính xác`, `maxlength=80`.
- Nút `Lưu tên NPC` chỉ enable khi draft hợp lệ và dirty.
- CAS conflict giữ draft local; hiển thị nút tải bản server.
- Nút `Bắt đầu tìm` gọi start mode `find_npc`.
- Nút `Dừng tìm` gọi automation stop.
- Hiển thị:
  - `Đang chuyển chế độ`;
  - `Đang quét <cursor+1>/<total> · Map <map> - Khu <area>`;
  - `Đang nghỉ đến <time>`;
  - `Đã thấy tại Map <map> - Khu <area>`;
  - lỗi catalog/protocol cùng hướng xử lý.
- Draft chưa lưu tham gia dirty-state guard của drawer.

#### Status panel

- Đổi nhãn `Bật auto` thành `Bật chăm farm`.
- Đổi nhãn `Tắt auto` thành `Dừng tự động`.
- Hiển thị desired mode, active mode và switching state.
- Bật farm trong khi Find NPC chạy dùng endpoint mode chung; không disable chỉ vì session đang desired-connected.
- Checkbox `logoutAfterCycle` chỉ liên quan AutoFarm và giữ nguyên config endpoint.

#### Responsive/accessibility

- Mobile thêm tab vào keyboard cycle trái/phải.
- Desktop tiếp tục render panel theo layout hiện tại.
- Input có label; lỗi được render bằng vùng đọc được; button busy/disabled phản ánh request đang chạy.
- Không thêm modal hoặc navigation mới.

## 5. Error Handling

| Tình huống | Hành vi |
|---|---|
| Config NPC sai | Reject 400, không ghi DB/runtime |
| Revision stale | 409 kèm current; giữ draft UI |
| Catalog chưa verified | 409, không persist `find_npc`, không join |
| Persist intent lỗi | Không chạm runtime |
| Kết nối tạm thời lỗi sau persist | Giữ desired intent, active off, reconnect policy thử lại |
| Runner/protocol init lỗi | Persist off, cleanup, không auto-loop qua reconnect |
| Snapshot timeout | Exponential scan backoff, không reconnect ngay |
| Decode `-34` lỗi | Log metadata/offset, runner coi bước thất bại, process sống |
| Decoder không tới được special trên park packet | Không tạo catalog; quay lại protocol investigation/Spec review |
| Socket đóng khi join | Session reconnect policy hiện có; restart scan từ catalog đầu |
| LOGIN_FAIL vĩnh viễn | Persist off, dừng runner, broadcast disabled |
| Stop/switch trong pending wait | Abort, cleanup, không command/callback muộn |
| NPC mất tạm trong một snapshot | Chưa xóa location; cần snapshot miss thứ hai |
| Restart server | Bootstrap desired mode; Find NPC xóa location stale rồi scan lại |

Error/log không được chứa game password, encrypted password, session cookie, `MASTER_KEY` hoặc full credential payload.

## 6. Verification Plan

Project không dùng TDD. Không tạo test file mới và không thêm test mới vì user chưa yêu cầu. Production code được viết trước; verification chạy sau.

### 6.1. Baseline đã xác nhận trước Spec

Tại `main` commit `0973a54`:

- Server: 258/258 tests pass; build pass.
- Web: 73/73 tests pass; build pass.

### 6.2. Static và regression

Run:

```text
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/server test
npm --prefix avatar-web/web run build
npm --prefix avatar-web/web test
```

Expected:

- Không TypeScript error.
- Build server/web thành công.
- Toàn bộ test suite hiện có pass.

### 6.3. Live probe acceptance

Với từng catalog entry:

- evidence redacted ghi đúng cặp;
- `GET_HANDLER 9` và `cmd 80` được gửi đúng body;
- nhận `cmd -34` sau join;
- decoder parse trọn tới hết section special; `trailingBytes` bằng 0 hoặc khớp evidence ổn định đã review;
- tool cleanup session sau một attempt;
- không gửi cmd `-21`, `87`, `-59`, `-61`.

Catalog source và evidence doc phải có cùng số entry và cùng thứ tự.

### 6.4. Manual API acceptance

1. Save config revision `0` thành revision `1`.
2. Save bằng stale revision `0` trả `409 revision-conflict`.
3. Start `find_npc` thiếu tên trả `400` và không đổi desired mode.
4. Start khi catalog unverified trả `409` và không đổi desired mode.
5. Chuyển `off → auto_farm → find_npc → off`; log/snapshot chứng minh tối đa một runner.
6. Automation stop hai lần liên tiếp đều thành công và giữ session online.
7. Restart server bootstrap cả account `auto_farm` và `find_npc`, reconnect rồi chạy đúng desired mode.
8. Permanent login failure persist `off`.
9. Endpoint `/auto/start` cũ vẫn vận hành AutoFarm; `/auto/stop` cũ vẫn disconnect session như trước.

### 6.5. Manual runner acceptance

- Stop/switch trong lúc chờ snapshot không phát join tiếp sau cleanup.
- Timeout tăng backoff đúng 5s, 10s, 20s, tối đa 60s.
- Snapshot hợp lệ reset timeout streak.
- Exact match chấp nhận khác biệt case/whitespace/NFC tương đương, reject substring.
- Tìm thấy persist location và chuyển tracking.
- Một miss không xóa location.
- Hai miss hợp lệ liên tiếp cách nhau ít nhất 2s xóa location và quay scanning.
- Reconnect xóa stale location và reset cursor.

### 6.6. Manual UI acceptance

- Save tên, conflict và reload bản server hoạt động.
- Unsaved draft chặn đóng drawer/navigation theo guard hiện có.
- Start Find NPC tự dừng AutoFarm qua switching; bật farm tự dừng Find NPC.
- State scanning/backoff/tracking/location cập nhật qua WebSocket không cần reload.
- Desktop và mobile không overflow ngang.
- Tab mobile mới hỗ trợ click, ArrowLeft/ArrowRight và focus đúng.

### 6.7. Live target acceptance

Khi NPC mục tiêu thật xuất hiện trong catalog verified:

1. runner match đúng tên;
2. persist đúng cặp protocol vừa join;
3. UI hiển thị location;
4. runner không rời map trong tracking;
5. sau hai snapshot xác nhận NPC biến mất, location được xóa và scan tiếp;
6. traffic không chứa command đánh/tương tác hoặc request ngoài.

Nếu thời gian verification không có NPC thật, trạng thái hoàn thành phải ghi rõ: **protocol/catalog verified; live target pending**. Không tuyên bố end-to-end live complete.

## 7. File/Module Summary

| File/module | Vai trò |
|---|---|
| `db/schema.sql` | Bảng automation one-to-one |
| `accounts/automationRepo.ts` | Normalize, CAS config, desired mode, location |
| `accounts/repo.ts` | Legacy migration/read integration |
| `game/worldData.ts` | Decode enter-world và ItemMapSpecial |
| `game/parkService.ts` | Encode cmd 80; `GameClient` quản lý GET_HANDLER/context |
| `game/client.ts` | Emit world snapshot, wait API hẹp |
| `tools/npc-map-probe.ts` | Probe thủ công một cặp, output redacted |
| `game/npcMapCatalog.ts` | Catalog readonly có evidence |
| `autoFindNpc.ts` | State machine scan/tracking/backoff/stop |
| `session/automationTypes.ts` | Shared server contracts |
| `session/avatarSession.ts` | Coordinator và runner ownership |
| `session/manager.ts` | DB/runtime bridge, bootstrap, persistence callbacks |
| `session/routes.ts` | API mode/config/status và alias cũ |
| `web/types.ts` | DTO automation |
| `web/accountRuntime.ts` | Merge WebSocket automation snapshot |
| `web/FindNpcPanel.tsx` | Config/start/stop/status UI |
| `web/StatusPanel.tsx` | Mode-aware farm controls |
| `web/AccountOperationsDrawer.tsx` | Tab và dirty guard |
| `docs/protocol/npc-map-probe-evidence-2026-08-24.md` | Evidence catalog redacted |

## 8. Rủi ro và Mitigation

| Rủi ro | Mitigation |
|---|---|
| Map/khu mapping sai | Live probe gate; không quét đoán |
| Anti-cheat/rate-limit | Một join in-flight, delay 2s, timeout/backoff, một cặp mỗi probe |
| Hai runner tranh client | Coordinator mutex và switching cleanup |
| Callback từ runner cũ mutate state mới | Abort signal, epoch/ownership guard, stop await cleanup |
| `-34` decoder phá login hiện có | Decoder độc lập trên body; giữ nguyên login/wallet side effect |
| Location stale sau restart | Xóa trước scan đầu/reconnect |
| Config farm và NPC xung đột revision | Persistence/revision tách riêng |
| Migration làm mất AutoFarm 24/7 | Legacy `auto_enabled=1` → desired auto_farm; alias endpoint |
| NPC sống ngắn hơn vòng scan | Catalog verified, scan tuần tự có delay tối thiểu; chia sẻ vị trí để spec sau |

## 9. Delivery Gates & Tiêu chí hoàn thành V1

### 9.1. Code-complete gate

- Spec và Plan đã được user duyệt.
- Persistence, protocol decoder, runner, coordinator, API, WebSocket và UI tuân thủ các invariant trên.
- Existing tests và builds pass.
- Manual API/runner/UI verification pass cho phần không cần NPC live.
- GitNexus impact đã chạy trước mọi symbol edit và `detect_changes` xác nhận scope trước commit.

### 9.2. Live-ready gate

- Decoder đã parse thành công park packet tới hết section special.
- Catalog có ít nhất một entry live-verified theo §4.4.
- API không còn trả `catalog-unverified` cho config hợp lệ.
- Nếu probe chưa chốt được `cmd 80(roomID, boardID)` hoặc decoder chưa tới special, delivery phải dừng ở **protocol investigation pending**; không được gọi V1 là live-ready.

### 9.3. End-to-end live gate

- Runner đã quan sát một NPC mục tiêu thật, persist/hiển thị đúng location và xác nhận disappearance theo hai snapshot.
- Nếu live-ready đã đạt nhưng chưa có NPC thật trong thời gian acceptance, báo chính xác: **protocol/catalog verified; live target pending**. Không tuyên bố end-to-end live complete.
