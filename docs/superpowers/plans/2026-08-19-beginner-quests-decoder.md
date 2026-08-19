# Beginner and Farmer Quest Decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Giải mã packet thật và hiển thị riêng Nhiệm Vụ Tân Thủ cùng Nhiệm Vụ Nhà Nông bên cạnh nhiệm vụ hằng ngày.

**Architecture:** Xác nhận mapping request/response `Cmd 104` bằng raw capture trước, đặt decoder thuần trong module riêng, rồi nối state qua `GameClient` → `AvatarSession` → API → React. Daily Quest `Cmd -87 / sub 4` giữ nguyên và độc lập.

**Tech Stack:** TypeScript, Node.js, `MyReader`/`MyWriter`, Express, React, Vite, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-19-beginner-quests-decoder-design.md`

## Global Constraints

- Chỉ dùng packet game thật; không hardcode danh sách từ ảnh hoặc state local.
- Request `Cmd 104` dùng `i8 type` và chỉ ghi `i8 idType` khi tham số thứ hai tồn tại.
- Không gán `beginner`/`farmer` trước khi payload khớp title, điều kiện và reward trên cùng tài khoản.
- Decoder giới hạn count, từ chối packet lệch/cắt và chỉ cập nhật state khi đọc hết body.
- Không log credential, không tự động làm/nhận thưởng, không thay Daily Quest.
- Không tạo test file vì người dùng chưa yêu cầu; verify sau production code bằng capture, typecheck, build và runtime UI.
- Chạy `gitnexus_impact` trước mọi symbol edit; dừng và cảnh báo nếu HIGH/CRITICAL.
- Chạy `gitnexus_detect_changes()` trước đề xuất commit; không commit nếu người dùng chưa yêu cầu.
- Bảo toàn mọi thay đổi không liên quan trong worktree.

---

### Task 1: Capture và chốt wire contract Cmd 104

**Files:**
- Reference: `avatar-web/server/src/game/farmService.ts:37-46`
- Reference: `avatar-web/server/src/game/client.ts:413-437`
- Reference: `avatar-web/server/src/session/routes.ts:319-369`
- Create: `/private/tmp/avatar-progress-quests/capture-manifest.json` (runtime only)
- Create: `/private/tmp/avatar-progress-quests/cmd-104-*.hex` (runtime only)

**Interfaces:**
- Consumes: raw endpoint với `{cmd:104, fields:[{t:'i8',v:string}]}` và packet endpoint cmd `104`.
- Produces: manifest gồm `requestFields`, `responseFile`, `action`, `screenType`, `observedTitle`, `kind` cho cả hai loại.

- [x] **Step 1: Kiểm tra index và raw path**

Run:

```bash
node .gitnexus/run.cjs analyze
rg -n "getInfoUpgradeFarm|sendRaw|lastPacketHex|packets/:cmd" avatar-web/server/src
```

Expected: analyze thành công; raw sender hỗ trợ `i8` và packet endpoint trả body đầy đủ.

- [x] **Step 2: Probe tuần tự, có giới hạn**

Lần lượt gửi type `0..5`, mỗi lần chờ/lưu response trước request kế tiếp:

```json
{"cmd":104,"fields":[{"t":"i8","v":"0"}]}
```

Nếu một byte chưa trả `action = 3`, thử tuple `type 0..5, idType 0..5` theo cùng nguyên tắc tuần tự:

```json
{"cmd":104,"fields":[{"t":"i8","v":"0"},{"t":"i8","v":"0"}]}
```

Expected: server lỗi/đóng kết nối thì dừng sweep tại tuple đó; không gửi song song vì response không có correlation id.

- [x] **Step 3: Lưu evidence không chứa credential**

```json
{
  "capturedAt": "ISO-8601",
  "gameVersion": "3.4.4",
  "captures": [{
    "requestFields": [{"t":"i8","v":"0"}],
    "responseFile": "cmd-104-type-0.hex",
    "action": 3,
    "screenType": 0,
    "observedTitle": "Nhiệm Vụ Nhà Nông - 1",
    "kind": "farmer"
  }]
}
```

Thay toàn bộ giá trị minh họa bằng dữ liệu thật; không ghi token/cookie/password.

- [x] **Step 4: Gate hai loại**

Expected: tối thiểu một capture Tân Thủ và một Nhà Nông, mỗi capture khớp title, tất cả conditions và rewards. Thiếu một loại thì dừng, báo evidence còn thiếu và không viết decoder production.

- [x] **Step 5: Commit**

Không commit; artifacts chỉ nằm trong `/private/tmp`.

### Task 2: Tạo decoder thuần và data contract

**Files:**
- Create: `avatar-web/server/src/game/progressQuests.ts`
- Modify: `avatar-web/server/src/game/farmData.ts:1765-1810,2139-2260`

**Interfaces:**
- Consumes: `Buffer`, mapping đã chứng minh và reward layout từ Task 1.
- Produces: `decodeProgressQuestPacket(data, mappings): ProgressQuestDecodeResult` cùng các types bên dưới.

- [x] **Step 1: Impact trước edits**

Chạy upstream impact cho `QuestOverviewState`, `BeginnerQuest`, `GeneralQuest`, `buildBeginnerQuests`, `buildGeneralQuests`; báo và dừng nếu HIGH/CRITICAL.

- [x] **Step 2: Định nghĩa contract**

```ts
export type ProgressQuestKind = 'beginner' | 'farmer';
export interface ProgressQuestCondition { name: string; current: number; total: number; isDone: boolean }
export interface ProgressQuestReward { type: number; amount: number; value: number; extra?: number; displayName?: string }
export interface ProgressQuestChain {
  kind: ProgressQuestKind; screenType: number; title: string; step: number | null;
  conditions: ProgressQuestCondition[]; rewards: ProgressQuestReward[];
  source: 'game-packet'; updatedAt: number;
}
export interface ProgressQuestMapping { requestType: number; idType?: number; screenType: number; kind: ProgressQuestKind }
export type ProgressQuestDecodeResult =
  | { status: 'ok'; state: ProgressQuestChain }
  | { status: 'ignored'; action: number }
  | { status: 'unknown-screen'; action: 3; screenType: number }
  | { status: 'unsupported'; reason: string; remainingHex: string };
export function decodeProgressQuestPacket(data: Buffer, mappings: readonly ProgressQuestMapping[]): ProgressQuestDecodeResult;
```

Guards: `MAX_REWARDS = 32`, `MAX_CONDITIONS = 64`, `MAX_TEXT_BYTES = 4096`.

- [x] **Step 3: Parse action 3 theo capture thật**

```ts
const r = new MyReader(data);
const action = r.readByte();
if (action !== 3) return { status: 'ignored', action };
const screenType = r.readByte();
const currentImageId = r.readShort();
const nextImageId = r.readShort();
```

Sau header, đọc reward count/branches và mission count bằng đúng width trong evidence Task 1. Mỗi mission đọc `UTF name`, `i32 current`, `i32 total`; `isDone = current >= total`. Trả `unsupported` nếu count vượt guard, UTF quá dài, số âm, `current > total`, buffer cắt hoặc `r.available() !== 0`.

- [x] **Step 4: Xóa model/builder hardcode**

Xóa `BeginnerQuest`, `GeneralQuest`, `buildBeginnerQuests`, `buildGeneralQuests`. Contract overview mới:

```ts
export interface QuestOverviewState {
  daily: DailyQuestState | null;
  beginner: ProgressQuestChain | null;
  farmer: ProgressQuestChain | null;
  updatedAt: number;
}
```

- [x] **Step 5: Verify decoder sau production code**

Dùng script one-shot `tsx` đọc từng hex trong manifest. Expected: hai capture trả `ok`, khớp kind/title/conditions/rewards và hết byte; bản sao bị cắt một byte trả `unsupported` mà không crash process.

- [x] **Step 6: Verify typecheck**

Run: `npm --prefix avatar-web/server run typecheck`

Expected: PASS.

- [x] **Step 7: Commit**

Chỉ khi được yêu cầu: stage đúng hai file và commit `feat(quests): decode progress quest packets`.

### Task 3: Nối FarmService và GameClient state

**Files:**
- Modify: `avatar-web/server/src/game/farmService.ts:37-46`
- Modify: `avatar-web/server/src/game/client.ts:1-30,140-165,462-625`

**Interfaces:**
- Consumes: decoder/types Task 2 và mapping Task 1.
- Produces: `beginnerQuestState`, `farmerQuestState`, `refreshProgressQuests()` và event `quests`.

- [x] **Step 1: Impact trước edits**

Chạy upstream impact cho `FarmService.getInfoUpgradeFarm`, `GameClient`, `GameClient.onMessage`, `dailyQuestState`; báo và dừng nếu HIGH/CRITICAL.

- [x] **Step 2: Chuẩn hóa request**

```ts
getInfoUpgradeFarm(type: number, idType = -1): void {
  this.send(104, (m) => {
    m.writer!.writeByte(type);
    if (idType !== -1) m.writer!.writeByte(idType);
  });
}
```

- [x] **Step 3: Thêm state và mapping literal đã xác nhận**

Thêm hai field `beginnerQuestState: ProgressQuestChain | null = null` và `farmerQuestState: ProgressQuestChain | null = null`. Khai báo `progressQuestMappings: readonly ProgressQuestMapping[]` bằng các object literal lấy nguyên giá trị `requestType`, `idType`, `screenType`, `kind` của hai record đã vượt gate Task 1; không đưa range sweep hoặc record `unknown` vào production.

- [x] **Step 4: Route `case 104`**

Decode body; `ok` cập nhật đúng state theo kind và emit `quests`. `unsupported`/`unknown-screen` chỉ log trạng thái, giữ snapshot gần nhất. Không sửa `case -87`.

- [x] **Step 5: Refresh tuần tự**

`refreshProgressQuests()` gửi từng mapping, chờ response hoặc timeout trước mapping kế tiếp. Timeout một loại vẫn tiếp tục loại còn lại; không dùng vòng `for` gửi đồng thời.

- [x] **Step 6: Verify**

Run: `npm --prefix avatar-web/server run typecheck`

Expected: PASS; handler Daily nguyên trạng.

- [x] **Step 7: Commit**

Chỉ khi được yêu cầu: commit `feat(quests): sync beginner and farmer quest state` với đúng hai file.

### Task 4: Expose qua AvatarSession và API

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:159-176,315-330,450-465`
- Modify: `avatar-web/server/src/session/routes.ts:270-330`

**Interfaces:**
- Consumes: hai state và refresh method Task 3.
- Produces: GET quests gồm `daily/beginner/farmer`; POST `/quests/progress/refresh`.

- [x] **Step 1: Impact trước edits**

Chạy upstream impact cho `AvatarSession.getQuestOverview`, `AvatarSessionSnapshot`, `createSessionRouter`; báo và dừng nếu HIGH/CRITICAL.

- [x] **Step 2: Trả ba miền độc lập**

```ts
return {
  daily,
  beginner: c?.beginnerQuestState ?? null,
  farmer: c?.farmerQuestState ?? null,
  updatedAt: Math.max(daily?.updatedAt ?? 0, c?.beginnerQuestState?.updatedAt ?? 0,
    c?.farmerQuestState?.updatedAt ?? 0) || Date.now(),
};
```

Online và thiếu state thì refresh Daily/progress bằng method riêng, không dựng từ inventory.

- [x] **Step 3: Sửa default API shape**

Session chưa tồn tại trả `{ daily:null, beginner:null, farmer:null, updatedAt:Date.now() }`.

- [x] **Step 4: Thêm endpoint refresh cố định**

Thêm wrapper `AvatarSession.refreshProgressQuests()`, rồi endpoint `POST /:id/quests/progress/refresh` gọi wrapper. Không nhận type/idType từ browser.

- [x] **Step 5: Verify**

Run: `npm --prefix avatar-web/server run typecheck`

Expected: PASS và API đúng shape.

- [x] **Step 6: Commit**

Chỉ khi được yêu cầu: commit `feat(quests): expose progress quest snapshots` với đúng hai file.

### Task 5: Hiển thị ba nhóm trên web

**Files:**
- Modify: `avatar-web/web/src/types.ts:160-195`
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx:1-240`
- Modify: `avatar-web/web/src/styles.css:667-1035`

**Interfaces:**
- Consumes: overview mới và progress refresh endpoint.
- Produces: UI Hằng Ngày, Tân Thủ, Nhà Nông tách biệt.

- [x] **Step 1: Impact trước edits**

Chạy upstream impact cho web `QuestOverviewState` và `QuestsPanel`; báo và dừng nếu HIGH/CRITICAL.

- [x] **Step 2: Đồng bộ types**

Định nghĩa cùng `ProgressQuestCondition/Reward/Chain` như server và sửa overview thành `daily`, `beginner`, `farmer`, `updatedAt`.

- [x] **Step 3: Refresh hai nguồn**

Nút refresh tổng gọi Daily refresh và progress refresh, sau đó GET overview. Lỗi phải nêu rõ nguồn nào thất bại.

- [x] **Step 4: Render `ProgressQuestSection`**

Props là `{ heading: 'Nhiệm Vụ Tân Thủ' | 'Nhiệm Vụ Nhà Nông'; quest: ProgressQuestChain | null }`. Null hiển thị “Chưa nhận dữ liệu từ game”; có state thì render title, từng `current/total`, progress bar và rewards theo đúng thứ tự packet. Không gộp rewards trùng.

- [x] **Step 5: Giữ Daily nguyên trạng**

Score, boxes, đổi nhiệm vụ và nhận thưởng chỉ dùng `daily`; hai state mới không bật action Daily.

- [x] **Step 6: CSS riêng**

Thêm `.progress-quest-section`, `.progress-quest-condition`, `.progress-quest-rewards`, `.progress-quest-empty`; không sửa semantics selector Daily.

- [x] **Step 7: Verify web**

Run: `npm --prefix avatar-web/web run build`

Expected: TypeScript và Vite PASS.

- [x] **Step 8: Commit**

Chỉ khi được yêu cầu: commit `feat(quests): show beginner and farmer quest chains` với đúng ba file.

### Task 6: Runtime verification và scope audit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-19-beginner-quests-decoder.md` (chỉ checkboxes)
- Runtime: `/private/tmp/avatar-progress-quests/*`

**Interfaces:**
- Consumes: Task 1-5.
- Produces: evidence decoder/API/UI và blast-radius report.

- [x] **Step 1: Build verification**

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/web run build
```

Expected: cả ba PASS; báo rõ không chạy test suite.

- [x] **Step 2: API runtime check**

GET quests phải có `daily`, `beginner`, `farmer`, `updatedAt`; hai chuỗi mới có `source:'game-packet'`, conditions/rewards thật, không còn `general` hoặc fallback.

- [x] **Step 3: UI manual check**

Xác nhận Daily không hồi quy; Tân Thủ và Nhà Nông khớp game; reward trùng vẫn tách; thiếu cmd 104 chỉ hiện trạng thái chưa có dữ liệu.

- [x] **Step 4: Diff và graph audit**

```bash
git diff --check
git diff --stat
```

Chạy `gitnexus_detect_changes({scope:"all"})`. Expected: chỉ files/symbols Task 2-5 và checkbox plan; mọi d=1 caller được cập nhật. HIGH/CRITICAL ngoài scope thì báo và không commit.

- [x] **Step 5: Commit**

Không commit trừ khi người dùng yêu cầu; khi được yêu cầu phải kiểm tra staged diff chỉ chứa files thuộc nhiệm vụ.
