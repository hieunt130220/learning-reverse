# Sửa hiển thị Nhiệm Vụ cho tài khoản farm level 2

> **Trạng thái:** SPEC — chờ User Review Gate trước khi viết Plan.

## 1. Mục tiêu & Bối cảnh

### Vấn đề
Account **phu** (id 2) có **farmLevel = 2** (xác nhận qua live API). Kết luận điều tra RE (xem
`docs/superpowers/../memory/quest-npc-protocol-investigation.md`):

- Quest **Tân Thủ / Nhà Nông** là nội dung **level 1→2** (màn hình `UpgradeFarmLvl2Scr`).
- Server **chỉ trả quest data (action=3)** cho account **farm level 1**. Với phu level 2, server
  **drop mọi combo quest** — bot không bao giờ nhận được dữ liệu quest thật.
- Vì vậy UI hiện tại hiển thị **placeholder gây hiểu lầm**: *"Thu hoạch 200 cà chua 0/200"*,
  *"Trồng 6 cây hoa hồng 0/6"* — người dùng tưởng nhiệm vụ chưa làm, trong khi thực tế đã
  **hoàn thành khi lên farm level 2**.

### Đồng thời tận dụng data thật đang có
Bot vẫn nhận được phản hồi **action=1** (cmd 104) — đây là **yêu cầu nâng cấp nông trại**
(`InfoFarmScr`). Sample hex đã xác minh format (xem §3.2): phu đang cần
**1.000.000 Xu** (đang có ~22.5k), **500 Lượng** (đang có 100), **20 nông sản × 12 loại**, **1 Thuốc EXP**.
Đây là thông tin hữu ích thực sự có thể hiển thị thay cho phần quest giả.

### Mục tiêu
1. Với `farmLevel >= 2`: hiển thị Tân Thủ / Nhà Nông ở trạng thái **"Đã hoàn thành"** (không còn
   placeholder 0/200 gây hiểu lầm).
2. Hiển thị **Yêu cầu Nâng Cấp nông trại** (data action=1 thật, decode verified) dưới dạng
   một tab mới trong QuestsPanel.

## 2. Phạm vi (Scope)

### In-scope
- Server: đánh dấu `beginnerQuestState` / `farmerQuestState` = **hoàn thành** khi `farmLevel >= 2`.
- Server: **decode action=1** → danh sách `FarmUpgradeRequirement[]` (format đã xác minh).
- Server: sửa bug `getInfoUpgradeFarm` (luôn gửi **2 byte** `[type, idType]` như client thật).
- Server: expose `upgradeRequirements` qua `GET /:id/quests` (additive field).
- Web: thêm tab **"🚜 Nâng Cấp"** hiển thị yêu cầu nâng cấp (target `request` / hiện có `inStorage`).
- Web: banner **"Đã hoàn thành"** cho Tân Thủ / Nhà Nông khi `source === 'completed'`.

### Out-of-scope (Phase 2 — ghi nhận, không làm lần này)
- Lấy quest data thật cho account **farm level 1** (cần 1 account level 1 — không có hiện tại).
- Gọi tên nông sản thật (id 206+) thay cho `#id` — cần đối chiếu bảng item, làm riêng.
- Ngữ nghĩa chính xác từng trường 7 short trong header action=1 (chỉ cần `imageId` để hiển thị).
- Sửa hành vi auto-farm / thu hoạch.

### Input / Output
- **Input:** trạng thái client (farmLevel, quest states), gói cmd 104 action=1 từ server.
- **Output:** `QuestOverviewState` (đã bổ sung `upgradeRequirements`), giao diện QuestsPanel.

### Edge cases
| Case | Xử lý |
|---|---|
| `farmLevel` chưa có (trước INVENTORY đầu tiên) | Chưa đánh dấu; sẽ tự đánh dấu khi gói 70 tới (bot luôn gửi getInventory khi vào farm). |
| `farmLevel < 2` (account mới) | Giữ nguyên dữ liệu hiện tại (default / game-packet). Không ghi đè. |
| action=3 thật tới (chỉ có thể với level 1) | `markQuestCompleted` có guard `isQuestCompleted` + điều kiện `farmLevel >= 2` → không ghi đè dữ liệu thật. |
| action=1 payload lạ / sai format | Trả `unsupported` → log, không đổi state. |
| idFarm type 7/9 | Lưu vào `idFarm`, display dùng `#id` fallback. |

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Format action=1 — ĐÃ XÁC MINH (từ sample hex 249 byte)

```
action(1) = 0x01
bool(1)    = 1 (có danh sách)
7 × short(2)  = imageId(6008), + 6 short khác (chưa cần ngữ nghĩa)
count(1)   = số lượng item  (sample: 0x14 = 20)
count × {
  type(1)             (7/9 → đọc thêm idFarm(4))
  idFarm(4)           [chỉ type 7 hoặc 9]
  request(4)          = yêu cầu
  inStorage(4)        = đang có
}
```

Sample giải mã (khớp đúng 249 byte):
- type 6 (Xu): request=1.000.000, inStorage=22.573
- type 8 (Lượng): request=500, inStorage=100
- type 9 (Thuốc EXP): idFarm=4704, request=1, inStorage=0
- type 7 (Nông sản): 12 loại, request=20, inStorage=0
- type 1..5 (Farm/Đất/Bếp/Chuồng/Ao): request theo loại

### 3.2 Danh sách files & vai trò

| File | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/game/progressQuests.ts` | Decoder + helpers quest | **Modify** |
| `avatar-web/server/src/game/client.ts` | GameClient state + xử lý cmd 104 + sync | **Modify** |
| `avatar-web/server/src/game/farmService.ts` | Gửi lệnh cmd 104 | **Modify** (fix 2-byte) |
| `avatar-web/server/src/session/avatarSession.ts` | `getQuestOverview()` | **Modify** (additive field) |
| `avatar-web/web/src/types.ts` | Type dùng chung web/server | **Modify** |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | UI 3 tab + tab Nâng Cấp mới | **Modify** |
| `avatar-web/web/src/accounts/panels/quests.css` *(nếu có)* | Style banner/tab mới | **Modify** *(kiểm tra khi làm)* |

### 3.3 Interfaces / Data contracts

**Server (`progressQuests.ts`):**
```ts
// Mở rộng source (thêm 'completed')
source: 'game-dialog' | 'game-packet' | 'default' | 'completed';

// Yêu cầu nâng cấp (decode action=1)
export interface FarmUpgradeRequirement {
  type: number;         // 1=FARM,2=SLOT_LAND,3=COOKING,4=BARN,5=POND,6=XU,7=PRODUCT,8=LUONG,9=POTION
  idFarm?: number;      // chỉ type 7/9
  request: number;      // yêu cầu
  inStorage: number;    // đang có
  displayName: string;  // "Xu", "Lượng", "Nông sản #206", ...
}
export interface FarmUpgradeRequirements {
  imageId: number;
  requirements: FarmUpgradeRequirement[];
}

// Helper
export function markQuestCompleted(q: ProgressQuestChain | null): ProgressQuestChain | null;
export function isQuestCompleted(q: ProgressQuestChain | null): boolean;
export function getRequirementDisplayName(type: number, idFarm?: number): string;

// Mở rộng kết quả decode (thêm nhánh action=1)
export type ProgressQuestDecodeResult =
  | { status: 'ok'; state: ProgressQuestChain }
  | { status: 'ok-upgrade'; requirements: FarmUpgradeRequirements }  // MỚI
  | { status: 'ignored'; action: number }
  | { status: 'unknown-screen'; action: number; screenType: number }
  | { status: 'unsupported'; reason: string; remainingHex: string };
```

**Client (`client.ts`):**
```ts
// Property mới
farmUpgradeRequirements?: FarmUpgradeRequirements | null;

// Trong syncProgressQuests(): đầu hàm gọi đánh dấu completed
private markQuestsCompletedForFarmLevel(): boolean;   // guard: farmLevel >= 2

// Trong handler cmd 104: xử lý res.status === 'ok-upgrade'
//   → this.farmUpgradeRequirements = res.requirements
```

**API (`GET /:id/quests`) — additive field:**
```jsonc
{
  "daily": {...},
  "beginner": {...},
  "farmer": {...},
  "upgradeRequirements": {           // MỚI (nullable, mặc định null)
    "imageId": 6008,
    "requirements": [
      { "type": 6, "request": 1000000, "inStorage": 22573, "displayName": "Xu" },
      ...
    ]
  },
  "updatedAt": 1776800000000
}
```

**Web (`web/src/types.ts`):** nhân bản các interface trên, `upgradeRequirements?` (optional để
không vỡ các nơi đang khởi tạo `QuestOverviewState` khác).

### 3.4 Flow xử lý

1. Bot vào farm → server gửi **INVENTORY (cmd 70)** → `farmLevel = inv.farmLevel` (đã có) →
   `syncProgressQuests()` → **farmLevel=2** → `markQuestsCompletedForFarmLevel()` đánh dấu
   Tân Thủ/Nhà Nông = completed (`source: 'completed'`, mọi condition `current=total, isDone=true`) → `emit('quests')`.
2. Người dùng mở QuestsPanel → `GET /:id/quests` → `getQuestOverview()` → trả quest đã completed.
3. Người dùng bấm **Làm mới tất cả** / mở tab Nâng Cấp → `POST /quests/progress/refresh` →
   `client.refreshProgressQuests()` → `getInfoUpgradeFarm(1)` (sau fix: gửi `[01 FF]`) →
   server trả action=1 → `decodeProgressQuestPacket` → `ok-upgrade` → `farmUpgradeRequirements` set.
4. Web poll `GET /:id/quests` → `upgradeRequirements` → tab 🚜 Nâng Cấp render progress bar.

### 3.5 Rủi ro & ảnh hưởng (GitNexus impact)

⚠️ **CẢNH BÁO CRITICAL:** `getQuestOverview` (avatarSession.ts) được GitNexus xếp **CRITICAL** —
3 caller trực tiếp (`snapshot`, `wire`, `sessionRouter`), 8 execution flows. **Thay đổi chỉ là
ADDITIVE** (thêm 1 field nullable vào object trả về), không đổi signature, không đổi hành vi cũ
nên không có gì vỡ. Các symbol còn lại (decodeProgressQuestPacket, getInfoUpgradeFarm,
refreshProgressQuests) đều **LOW**. Đã chạy `impact` cho từng symbol — sẽ chạy `detect_changes`
trước commit.

## 4. Verification Plan

### Manual (chính)
1. Build web (`npm run build` trong `web/`) + restart server.
2. Mở account **phu** → QuestsPanel:
   - Tab 🐣 Tân Thủ / 🌾 Nhà Nông hiển thị **"Đã hoàn thành"** (banner xanh), mọi condition
     `current=total`, không còn "0/200".
   - Tab **🚜 Nâng Cấp** hiển thị yêu cầu thật: 1.000.000 Xu (22.573 hiện có), 500 Lượng (100),
     nông sản ×12 (20/0), Thuốc EXP (1/0) — progress bar đúng.
3. Bấm **Làm mới tất cả** → không lỗi, `upgradeRequirements` không bị null (nếu bot online).

### Automated
- Không viết test files (theo CLAUDE.md — NO TDD, chỉ viết khi user yêu cầu).

### Rollback
- Thay đổi additive + idempotent (`isQuestCompleted` guard). Revert 1 commit là đủ.
