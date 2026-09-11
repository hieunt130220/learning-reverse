# Auto Fisherman Quest — Design Document

**Ngày:** 2026-09-11
**Topic:** `auto_fisherman_quest` ("Làm nhiệm vụ thợ câu") cho `avatar-web`
**Trạng thái:** Chờ user duyệt (Gate 1)
**Spec liên quan:** `docs/superpowers/specs/2026-09-08-fisherman-quest-and-fishing-tab-design.md`
**Approach đã duyệt:** Approach 1 — Quest Orchestrator tái dùng fishing loop (mode mới độc lập, không sửa sâu `runFishingLoop`)

---

## 1. Mục tiêu & Bối cảnh

### Vấn đề
Hiện tại `avatar-web` có hai mảnh rời nhau:
- **Quest Thợ Câu** chỉ hiển thị (NPC 90/95 → `communicate(90)` → `doMenuOption(38,0,0)` → cmd `-62` → `parseQuestDialogText()` ra `ProgressQuestChain` với `kind: 'fisherman'`, ví dụ `- Cá rô - 0/5`). UI `QuestsPanel` / `FishingPanel` đã xem được tiến độ nhưng bot không tự hành động theo quest.
- **Auto Fishing** (`auto_fishing`) câu tự động theo `FishingConfig` do user cấu hình tay (map/vé/cần/mồi), không biết quest cần cá gì.

User phải đọc quest rồi cấu hình tay map + vé cho khớp — tốn công và dễ sai map.

### Mục tiêu
Triển khai chế độ tự động mới `auto_fisherman_quest`: bot tự quét quest Thợ Câu hiện tại, trích xuất loại cá + số lượng thiếu, tự chọn map/mua vé/mồi phù hợp, câu đến khi xong điều kiện, rồi tự quét quest mới và chạy tiếp không dừng. Tiến độ hiển thị realtime trên `StatusPanel`.

### Quyết định đã chốt với user (2026-09-11)
1. **Xong quest → tự quét quest mới, chạy tiếp không dừng** (không nghỉ chờ nộp tay, không đoán opcode nộp quest).
2. **Nhiều điều kiện khác map → làm tuần tự từng mục tiêu**, xong 1 loại mới chuyển map.
3. **Tên cá không nhận diện được → dừng an toàn + log rõ** (không đoán map).
4. **Tái dùng toàn bộ `FishingConfig` của user** (cần/mồi/area/castDelay), chỉ override `map` theo quest; **được phép mua vé Lượng map 16** như `auto_fishing`, log info mỗi lần mua vé Lượng.
5. **Chỉnh sửa bảng map:** Cá chim (454) thuộc **Map 16**, không phải Map 15.

---

## 2. Phạm vi (Scope)

### In-scope
- Mở rộng `AutomationMode` với `'auto_fisherman_quest'` trên toàn bộ server + web client (type, validation, DB CHECK, whitelist).
- Module pure mới `fishermanQuest.ts`: normalize tên cá, ánh xạ cá → map/vé, chọn mục tiêu tiếp theo.
- State machine quest trong `AvatarSession` (nhánh `startFishermanQuest` trong `startDesiredAutomation`): SCAN → RESOLVE → FISH → SYNC → NEXT/STOP.
- Tái dùng nguyên vẹn `startFishingLoop()` / `prepareFishingAtPark()` / `executeParkPurchase()` / `executeSellFish()` / periodic farm / reconnect.
- Đếm tiến độ qua sự kiện `fishing-success-result`, sync định kỳ với server qua `refreshProgressQuests()`.
- `StatusPanel.tsx`: thêm nút "🎣 Làm nhiệm vụ thợ câu" + hiển thị tiến độ quest realtime qua WS `automation` snapshot.
- Tương thích ngược SQLite (`automationRepo`, migration `db/index.ts`).

### Out-of-scope
- **Không** tự nộp quest / nhận thưởng (chưa có opcode nộp quest Thợ Câu đã verify) — khi xong hết điều kiện chỉ log + quét quest mới.
- **Không** sửa logic cốt lõi `auto_farm` và `auto_fishing` (chỉ gọi lại, không sửa sâu `runFishingLoop`, periodic farm scheduler, dialog filter).
- **Không** thay đổi parser `parseQuestDialogText()` / `decodeProgressQuestPacket()` (đã đủ cho fisherman qua dialog text).
- **Không** chạm `.env`, config bảo mật, `package-lock.json`, `avatar-web/fishing-ml/`, `tools/jar/`.
- **Không** viết test file (theo CLAUDE.md: tuyệt đối không TDD trừ khi user yêu cầu trực tiếp).

### Input / Output
- **Input:** `POST /api/accounts/:id/automation/start {mode:'auto_fisherman_quest'}`; `FishingConfig` hiện có của user (rod/bait/area/castDelay); quest dialog từ NPC 90 uid 38 (cmd `-62`).
- **Output:** `AutomationSnapshot` mở rộng `fishermanQuestRuntime`; WS event `automation`; log scan/resolve/sync; cá trong rương tăng; quest server tiến triển.

### Edge cases
| # | Trường hợp | Hành vi (đã duyệt Section 4/5) |
|---|-----------|-------------------------------|
| 1 | Tên cá không match bảng | `phase='stopped'`, `lastError` rõ tên cá + tên quest, snapshot WS → UI đỏ. Không đoán map. |
| 2 | Quest rỗng (`conditions: []`, source `default`) | Không dừng — `phase='scanning'`, retry `refreshProgressQuests` mỗi 60s, UI "đang chờ quest thợ câu…". |
| 3 | Hết xu / hết mồi / rương đầy | Kế thừa guard `executeParkPurchase` / `executeSellFish` của `auto_fishing` → dừng + `lastError` tương ứng. |
| 4 | Mất kết nối giữa chừng | Kế thừa `onDisconnected` / reconnect / `resumeDesiredAutomation`; quest loop check `signal.aborted` mỗi vòng. |
| 5 | Đếm local lệch server | Tin server (source of truth), chuyển mục tiêu, log warn `local=X server=Y`. |
| 6 | Vé map 16 tốn Lượng | Được phép mua; log info mỗi lần mua để kiểm tra sau. |
| 7 | User câu tay xen vào làm xong condition | SYNC phát hiện server đã xong → chuyển mục tiêu tiếp theo, không câu thừa. |

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Kiến trúc tổng quan (đã duyệt Section 1/5)

```
User chọn "🎣 Làm nhiệm vụ thợ câu" (StatusPanel)
  → POST /automation/start {mode:'auto_fisherman_quest'}
  → AvatarSession.startDesiredAutomation (nhánh mới)
  → FishermanQuestOrchestrator (vòng lặp riêng, avatarSession.ts + fishermanQuest.ts)
       ├─ Phase SCAN: refreshProgressQuests() → đọc fishermanQuestState
       ├─ Phase RESOLVE: condition chưa xong đầu tiên → resolveFishQuestTarget()
       │     (tên cá → {fishId, map, ticketId}) via FISHERMAN_QUEST_FISH_MAP
       ├─ Phase FISH: override fishingConfig.map → startFishingLoop() (tái dùng nguyên vẹn)
       │     đếm fishing-success-result → match fishId mục tiêu → caught++
       ├─ Phase SYNC: mỗi 5 cá mục tiêu HOẶC mỗi 3 phút → refreshProgressQuests()
       ├─ Phase NEXT: xong mục tiêu → mục tiêu tiếp theo (tuần tự)
       │     xong hết → SCAN lại quest mới, chạy tiếp không dừng
       └─ Phase STOP: cá lạ → dừng an toàn + log; lỗi vé/mồi → dừng như auto_fishing
  → Snapshot mở rộng fishermanQuestRuntime → WS 'automation' → StatusPanel hiển thị
```

### 3.2. Files / modules liên quan và vai trò

**File mới (1):**
| File | Vai trò |
|------|---------|
| `avatar-web/server/src/session/fishermanQuest.ts` | Pure logic, không import runtime (tránh chu kỳ phụ thuộc, giống `automationTypes.ts`): `normalizeFishName()`, `FISHERMAN_QUEST_FISH_MAP`, `resolveFishQuestTarget()`, `pickNextFishTarget()`. |

**File sửa (6):**
| File | Thay đổi |
|------|----------|
| `avatar-web/server/src/session/automationTypes.ts` | `AutomationMode` += `'auto_fisherman_quest'`; thêm `FishermanQuestPhase`, `FishermanQuestRuntimeState`, `idleFishermanQuestRuntime()`; `AutomationSnapshot` += `fishermanQuestRuntime?`. (`FISHERMAN_QUEST_FISH_MAP` sống trong `fishermanQuest.ts`, không ở đây.) |
| `avatar-web/server/src/session/avatarSession.ts` | Nhánh `auto_fisherman_quest` trong `startDesiredAutomation()` (sau `ensureDailyAttendance`, giống `auto_fishing`); `startFishermanQuest()` / `stopFishermanQuestLoop()`; hook đếm `fishing-success-result` (mở rộng handler `:1076-1095`, chỉ đếm thêm khi activeMode là quest); mở rộng `stopActiveAutomation()` dọn cả quest loop; quest-sync timer. Không sửa `runFishingLoop` / `prepareFishingAtPark`. |
| `avatar-web/server/src/accounts/automationRepo.ts` | `listDesiredAutomation` += mode mới trong `WHERE desired_mode IN (...)` (nếu không, restart sẽ bỏ qua resume); `offlineAutomationSnapshot()` += `fishermanQuestRuntime: idle`. |
| `avatar-web/server/src/db/index.ts` + `schema.sql` | Migration rebuild bảng khi thiếu `'auto_fisherman_quest'` (copy pattern `auto_fishing` ở `index.ts:41-80`); `schema.sql` CHECK += mode mới. |
| `avatar-web/server/src/session/routes.ts` | `POST /:id/automation/start` gate (`:286-293`) += mode mới; precondition: không yêu cầu thêm (rod/bait lấy từ `FishingConfig` hiện có). |
| `avatar-web/web/src/accounts/panels/StatusPanel.tsx` + `web/src/types.ts` | `StatusAutomationMode` += `'auto_fisherman_quest'`; nút thứ 3 "🎣 Làm nhiệm vụ thợ câu"; `automationProgress` hiển thị `questTitle + targetFishName + caught/needed + fishingStatus`; `types.ts:338` `AutomationMode` mirror + snapshot type mở rộng. |

**Whitelist `AutomationMode` đầy đủ (từ khảo sát Explore):**
`automationTypes.ts:6`, `web/types.ts:338`, `schema.sql:104-108`, `db/index.ts:41-80`, `automationRepo.ts:310`, `routes.ts:286-293`, `avatarSession.ts:1583-1637`, `StatusPanel.tsx:8`. Thiếu bất kỳ điểm nào → mode mới no-op câm / 400 / không resume sau restart.

### 3.3. Interfaces & data contracts (đã duyệt Section 2/5, gồm sửa Cá chim → Map 16)

```ts
// automationTypes.ts
export type FishermanQuestPhase =
  | 'idle' | 'scanning' | 'resolving' | 'fishing'
  | 'syncing' | 'switching-target' | 'completed-cycle' | 'stopped';

export interface FishermanQuestRuntimeState {
  phase: FishermanQuestPhase;
  questTitle: string | null;
  targetFishName: string | null;
  targetFishId: number | null;
  targetMap: number | null;
  needed: number;   // total - current của condition mục tiêu (tính tại lúc RESOLVE)
  caught: number;   // số cá đúng targetFishId từ fishing-success-result kể từ khi vào mục tiêu
  lastError: string | null;
}

export interface FishermanQuestFishMapping {
  readonly fishId: number;
  readonly map: number;
  readonly ticketId: number;
}
```

**`FISHERMAN_QUEST_FISH_MAP`** (key = tên chuẩn hóa: lowercase + bỏ dấu + trim):

| Tên quest | fishId | Map | Vé |
|---|---|---|---|
| ca ro | 444 | 14 | 458 (1.000 xu) |
| ca long tong | 449 | 14 | 458 |
| ca chep vang / chep vang | 450 | 14 | 458 |
| ca loc | 451 | 15 | 459 (10.000 xu) |
| ca noc / noc | 452 | 15 | 459 |
| con cua / cua | 453 | 15 | 459 |
| ca duoi / duoi | 455 | 16 | 460 (2 Lượng) |
| ca ngua / ngua | 456 | 16 | 460 |
| ca chim / chim | 454 | 16 | 460 |
| ca map | 457 | 16 | 460 |

```ts
// fishermanQuest.ts
export function normalizeFishName(raw: string): string;
export function resolveFishQuestTarget(condName: string):
  | { ok: true; fishId: number; map: number; ticketId: number }
  | { ok: false; unknownName: string };
export function pickNextFishTarget(
  conditions: readonly ProgressQuestCondition[],
): ProgressQuestCondition | null; // null = xong hết
```

- `resolveFishQuestTarget` thử match cả tên đầy đủ và tên rút gọn (bảng trên liệt kê cả hai); strip tiền tố số lượng ("Thu hoạch 5 con cá rô" → "cá rô") trước khi match.
- `pickNextFishTarget` trả condition `!isDone` đầu tiên (tuần tự, Q2-A); `null` nghĩa là xong hết → orchestrator chuyển sang SCAN quest mới.

### 3.4. Flow xử lý & lifecycle (đã duyệt Section 3/5)

1. **START**: `POST /automation/start {mode}` → `setDesiredMode` persist → `switchAutomationMode` (guard generation/epoch hiện có) → nhánh mới `startFishermanQuest()` sau `ensureDailyAttendance`.
2. **SCAN** (`phase='scanning'`): `refreshProgressQuests()` → đọc `fishermanQuestState`. Quest rỗng → retry sau 60s, không dừng.
3. **RESOLVE** (`phase='resolving'`): `pickNextFishTarget()` → `resolveFishQuestTarget()` ra map. Cá lạ → STOP an toàn (edge 1).
4. **FISH** (`phase='fishing'`): override `fishingConfig.map` = target map (giữ rod/bait/area/castDelay của user) → gọi `startFishingLoop()` nguyên vẹn. `fishing-success-result` có `idFish == targetFishId` → `caught++`; cá khác loại chỉ tính `totalCatches` + log debug.
5. **SYNC** (`phase='syncing'`): sau mỗi 5 cá mục tiêu HOẶC mỗi 3 phút → `refreshProgressQuests()`; server là source of truth — server báo xong thì chuyển mục tiêu dù đếm local thiếu.
6. **NEXT** (`phase='switching-target'`): xong 1 mục tiêu → dừng fishing loop → mục tiêu tiếp theo (đổi map nếu cần → mua vé mới qua `executeParkPurchase`). Xong hết (`pickNextFishTarget() == null`) → log `Hoàn thành <title>` → `phase='completed-cycle'` → quay SCAN quest mới, chạy tiếp (Q1-C).
7. **STOP**: `POST /automation/stop` / switch mode → `stopActiveAutomation` (mở rộng dọn quest loop + fishing loop, không viết dọn riêng).

### 3.5. Rủi ro regression & guard
- Periodic farm scheduler vừa sửa 5 commit liên tiếp (`36cf27e7…26ef4e0c`): không chạm — quest mode chỉ gọi `startFishingLoop`, farm xen kẽ kế thừa y nguyên.
- `runFishingLoop` / `prepareFishingAtPark` / dialog filter (`isRewardDialog`): không sửa.
- `syncProgressQuests()` chỉ sync beginner/farmer, không chạm fisherman — giữ nguyên.
- Session-side còn dở (memory `avatar-web-autofarm-open-threads`): quest loop tuân thủ generation/epoch + `signal.aborted` hiện có, không thêm cơ chế resume riêng.
- GitNexus bắt buộc: `gitnexus_impact` trước khi sửa mỗi symbol (`startDesiredAutomation`, `stopActiveAutomation`, `AutomationMode`, `listDesiredAutomation`, route start), `gitnexus_detect_changes` trước commit.

---

## 4. Verification Plan (đã duyệt Section 5/5, không test file)

1. `npx tsc --noEmit` trong `avatar-web/server` và `avatar-web/web` — không lỗi type.
2. `npm run build` cả server + web thành công.
3. Thủ công: chọn mode mới → Bắt đầu → log SCAN hiện đúng quest + mục tiêu cá; bot đến đúng map, mua đúng vé; câu 1 con đúng loại → `caught` tăng trên UI realtime qua WS.
4. Thủ công: quest chứa cá lạ → bot dừng + `lastError` hiện đúng trên StatusPanel.
5. Thủ công: xong hết điều kiện → log hoàn thành → tự SCAN quest mới, chạy tiếp.
6. `gitnexus_detect_changes()` trước commit — chỉ chạm đúng 6 files + 1 file mới trong scope.
