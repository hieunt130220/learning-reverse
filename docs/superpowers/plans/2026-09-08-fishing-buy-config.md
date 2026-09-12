# Cấu Hình & Tự Động Mua Vật Phẩm Câu Cá (Vé, Cần, Mồi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm giao diện cấu hình mua vật phẩm câu cá (vé câu, cần câu, mồi câu, số lượng mồi) trên Web dashboard, lưu vào DB và kích hoạt bot tự động di chuyển sang Khu sinh thái (Map 13) để mua bù vật phẩm khi bị server từ chối câu cá.

**Architecture:** Mở rộng `FishingConfig` trong contracts dùng chung, lưu trữ vào SQLite `avatar_automation_state` có revision lock. Bổ sung gói `CMD_PARK_BUY_ITEM (-8)` vào `ParkService` và `GameClient`. Triển khai cơ chế Reactive Auto-Buy trong `AvatarSession.runFishingLoop` dựa trên phân tích phản hồi lỗi `RX45`, tự động sang Map 13 mua đồ và quay lại hồ câu tiếp tục. Cập nhật `FishingPanel.tsx` với đầy đủ controls và trạng thái runtime `buying`.

**Tech Stack:** TypeScript, React, Node.js / Express, SQLite (better-sqlite3), Avatar J2ME/Native Binary Protocol.

**Spec:** `docs/superpowers/specs/2026-09-08-fishing-buy-config-design.md`

## Global Constraints
- Tuân thủ quy tắc CLAUDE.md: **KHÔNG thực hiện TDD** (không viết test trước, không tạo file test mới trừ khi user yêu cầu).
- Trước khi chỉnh sửa bất kỳ symbol nào (function, class, method), **BẮT BUỘC** chạy `gitnexus_impact({target: "symbolName", direction: "upstream"})` và báo cáo blast radius.
- Trước khi commit thay đổi, **BẮT BUỘC** chạy `gitnexus_detect_changes()` để kiểm tra phạm vi ảnh hưởng.
- Không dùng placeholder (`TODO`, `TBD`, `implement later`), mọi đoạn code phải hoàn chỉnh.
- Bảo đảm an toàn tài sản: hiển thị cảnh báo rõ ràng khi cấu hình tiêu Lượng; có circuit breaker tối đa 2 lần mua thất bại liên tiếp thì dừng bot để tránh hao hụt tiền vô ích.

---

### Task 1: Cập Nhật Data Contracts & Shared Types

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: Không có (task nền tảng)
- Produces: `FishingConfig`, `DEFAULT_FISHING_CONFIG`, `StoredFishingConfigState`, `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS`, `FishingStatus` ('buying')

- [ ] **Step 1: Mở rộng `automationTypes.ts` trên Server**

Cập nhật `avatar-web/server/src/session/automationTypes.ts`:
```typescript
export interface FishingConfig {
  readonly map: number;
  readonly area: number;
  readonly castDelayMs: number;

  // Cấu hình tự động mua
  readonly autoBuyTicket: boolean;
  readonly rodType: number;
  readonly baitType: number;
  readonly baitQuantity: number;
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = Object.freeze({
  map: 14,
  area: 0,
  castDelayMs: 3000,
  autoBuyTicket: true,
  rodType: 442,      // Cần câu tre (10.000 xu)
  baitType: 448,     // Trứng kiến (30 xu)
  baitQuantity: 50,  // Mua 50 mồi mỗi lần
});

export interface StoredFishingConfigState {
  revision: number;
  config: FishingConfig;
}

export const FISHING_TICKETS: Readonly<Record<number, { id: number; name: string; cost: string; typeMoney: number }>> = Object.freeze({
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
});

export const FISHING_RODS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
]);

export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
]);

export type FishingStatus =
  | 'idle'
  | 'moving'
  | 'buying'
  | 'starting'
  | 'casting'
  | 'hooked'
  | 'caught'
  | 'rejected'
  | 'resting';
```
Cập nhật `LoadedAutomationIntent` và `AutomationSnapshot`:
- `LoadedAutomationIntent` thêm `fishingConfig: StoredFishingConfigState;`.
- `AutomationSnapshot` thêm `fishingConfig: StoredFishingConfigState;`.

- [ ] **Step 2: Đồng bộ types sang Frontend `web/src/types.ts`**

Cập nhật `avatar-web/web/src/types.ts`:
- Thêm các trường mới của `FishingConfig`: `autoBuyTicket`, `rodType`, `baitType`, `baitQuantity`.
- Thêm type `StoredFishingConfigState`.
- Thêm `'buying'` vào `FishingRuntimeState['status']`.
- Thêm `fishingConfig?: StoredFishingConfigState;` vào `AutomationSnapshot`.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npm --prefix avatar-web/server run build`
Expected: PASS hoặc chỉ lỗi ở các file chưa cập nhật implementation ở tasks sau.

- [ ] **Step 4: Commit**

```bash
git add avatar-web/server/src/session/automationTypes.ts avatar-web/web/src/types.ts
git commit -m "feat(fishing): expand fishing configuration and runtime status contracts"
```

---

### Task 2: Database Migration & Repository Persistence

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql`
- Modify: `avatar-web/server/src/db/index.ts`
- Modify: `avatar-web/server/src/accounts/automationRepo.ts`

**Interfaces:**
- Consumes: `FishingConfig`, `DEFAULT_FISHING_CONFIG`, `StoredFishingConfigState` từ Task 1
- Produces: `readAutomationState`, `saveFishingConfig`, `defaultFishingConfig`

- [ ] **Step 1: Thêm migration cột trong `schema.sql` và `db/index.ts`**

Trong `avatar-web/server/src/db/schema.sql`:
Thêm cột `fishing_config_json TEXT` vào bảng `avatar_automation_state`.

Trong `avatar-web/server/src/db/index.ts`:
```typescript
addColumn('ALTER TABLE avatar_automation_state ADD COLUMN fishing_config_json TEXT');
```

- [ ] **Step 2: Triển khai serialization & validation trong `automationRepo.ts`**

Thêm các helper vào `avatar-web/server/src/accounts/automationRepo.ts`:
```typescript
export function defaultFishingConfig(): StoredFishingConfigState {
  return {
    revision: 0,
    config: { ...DEFAULT_FISHING_CONFIG },
  };
}

export function parseFishingConfig(input: unknown): FishingConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Cấu hình câu cá phải là một object');
  }
  const obj = input as Record<string, unknown>;
  const map = typeof obj.map === 'number' && [14, 15, 16, 27].includes(obj.map) ? obj.map : 14;
  const area = typeof obj.area === 'number' && obj.area >= 0 && obj.area <= 15 ? Math.floor(obj.area) : 0;
  const castDelayMs = typeof obj.castDelayMs === 'number' && obj.castDelayMs >= 1000 && obj.castDelayMs <= 10000
    ? Math.floor(obj.castDelayMs) : 3000;
  const autoBuyTicket = typeof obj.autoBuyTicket === 'boolean' ? obj.autoBuyTicket : true;
  const rodType = typeof obj.rodType === 'number' && [0, 442, 445, 446].includes(obj.rodType) ? obj.rodType : 442;
  const baitType = typeof obj.baitType === 'number' && [0, 443, 447, 448].includes(obj.baitType) ? obj.baitType : 448;
  const baitQuantity = typeof obj.baitQuantity === 'number' && obj.baitQuantity >= 1 && obj.baitQuantity <= 200
    ? Math.floor(obj.baitQuantity) : 50;

  return {
    map,
    area,
    castDelayMs,
    autoBuyTicket,
    rodType,
    baitType,
    baitQuantity,
  };
}

function storedFishingConfig(raw: string | null): StoredFishingConfigState {
  if (!raw) return defaultFishingConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null
      && (parsed as Record<string, unknown>).version === 1
      && typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: parseFishingConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultFishingConfig();
}
```

Cập nhật `readAutomationState`:
Đọc thêm cột `fishing_config_json` và trả về `fishingConfig: storedFishingConfig(row.fishing_config_json)`.

Triển khai `saveFishingConfig`:
```typescript
export type SaveFishingConfigResult =
  | { status: 'saved'; state: StoredFishingConfigState }
  | { status: 'conflict'; current: StoredFishingConfigState }
  | { status: 'missing' };

export function saveFishingConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: FishingConfig,
  now = Date.now(),
): SaveFishingConfigResult {
  return db.transaction((): SaveFishingConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>('SELECT user_id FROM avatar_accounts WHERE id = ?')
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).fishingConfig;
    if (current.revision === expectedRevision && current.revision === 0
        && !db.prepare<[number], { account_id: number }>(
          'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
        ).get(accountId)) {
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    } else if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }

    const nextRevision = current.revision + 1;
    const json = JSON.stringify({
      version: 1,
      revision: nextRevision,
      config,
    });

    db.prepare(
      `UPDATE avatar_automation_state
         SET fishing_config_json = ?, updated_at = ?
       WHERE account_id = ?`,
    ).run(json, now, accountId);

    return { status: 'saved', state: { revision: nextRevision, config } };
  })();
}
```

- [ ] **Step 3: Verify repo changes**

Run: `npm --prefix avatar-web/server run build`
Expected: Build pass (hoặc compile sạch module repo).

- [ ] **Step 4: Commit**

```bash
git add avatar-web/server/src/db/schema.sql avatar-web/server/src/db/index.ts avatar-web/server/src/accounts/automationRepo.ts
git commit -m "feat(fishing): add fishing_config_json column and repo persistence"
```

---

### Task 3: Game Protocol & Park Service Implementation

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts`
- Modify: `avatar-web/server/src/game/client.ts`

**Interfaces:**
- Consumes: `Session` từ `game/proto/session.ts`
- Produces: `CMD_PARK_BUY_ITEM = -24`, `ParkService.doParkBuyItem(id, typeMoney)`, `GameClient.parkBuyItem(id, typeMoney)`

- [ ] **Step 1: Thêm `CMD_PARK_BUY_ITEM` & `doParkBuyItem` vào `parkService.ts`**

Trước khi sửa `parkService.ts`, chạy:
`gitnexus_impact({target: "ParkService", direction: "upstream", repo: "learning-reverse"})`

Trong `avatar-web/server/src/game/parkService.ts`:
```typescript
/** PARK_BUY_ITEM: i16 idItem, i8 typeMoney (1=Xu, 2=Lượng). Opcode -24 (verified from J2ME er_0.java:170 do[10]=-24 and fj_0.java:1477). */
export const CMD_PARK_BUY_ITEM = -24;
```
Thêm phương thức vào class `ParkService`:
```typescript
doParkBuyItem(id: number, typeMoney: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`doParkBuyItem: id không hợp lệ: ${id}`);
  }
  if (!Number.isSafeInteger(typeMoney) || (typeMoney !== 1 && typeMoney !== 2)) {
    throw new Error(`doParkBuyItem: typeMoney không hợp lệ: ${typeMoney}`);
  }
  const m = Message.create(CMD_PARK_BUY_ITEM);
  m.writer!.writeShort(id).writeByte(typeMoney);
  this.session.send(m);
}
```

- [ ] **Step 2: Thêm wrapper vào `GameClient` trong `client.ts`**

Trước khi sửa `client.ts`, chạy:
`gitnexus_impact({target: "GameClient", direction: "upstream", repo: "learning-reverse"})`

Trong `avatar-web/server/src/game/client.ts`:
Thêm phương thức:
```typescript
parkBuyItem(id: number, typeMoney: number): void {
  this.park.doParkBuyItem(id, typeMoney);
}
```

- [ ] **Step 3: Verify protocol methods**

Run: `npm --prefix avatar-web/server run build`
Expected: Build pass không có lỗi cú pháp.

- [ ] **Step 4: Commit**

```bash
git add avatar-web/server/src/game/parkService.ts avatar-web/server/src/game/client.ts
git commit -m "feat(fishing): add PARK_BUY_ITEM opcode -8 and service methods"
```

---

### Task 4: REST API Endpoints & Snapshot Updates

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts`
- Modify: `avatar-web/server/src/session/manager.ts`

**Interfaces:**
- Consumes: `saveFishingConfig`, `parseFishingConfig` từ Task 2
- Produces: `PUT /api/accounts/:id/automation/fishing/config`, cập nhật snapshot automation

- [ ] **Step 1: Bổ sung endpoint `PUT /:id/automation/fishing/config` trong `routes.ts`**

Trước khi sửa `routes.ts`, chạy:
`gitnexus_impact({target: "routes", direction: "upstream", repo: "learning-reverse"})`

Trong `avatar-web/server/src/session/routes.ts`:
```typescript
router.put('/:id/automation/fishing/config', owned, (req, res) => {
  if (
    !exactObject(req.body, ['expectedRevision', 'config'])
    || !Number.isInteger(req.body.expectedRevision)
    || (req.body.expectedRevision as number) < 0
  ) {
    automationError(res, 400, 'invalid-fishing-config', 'payload cấu hình câu cá không hợp lệ');
    return;
  }
  let config;
  try {
    config = parseFishingConfig(req.body.config);
  } catch (err) {
    automationError(res, 400, 'invalid-fishing-config', (err as Error).message);
    return;
  }

  let saved;
  try {
    saved = saveFishingConfig(
      db,
      accountId(req),
      req.body.expectedRevision as number,
      config,
    );
  } catch {
    automationError(res, 500, 'automation-save-failed', 'không lưu được cấu hình câu cá');
    return;
  }
  if (saved.status === 'missing') {
    res.status(404).json({ error: 'không có tài khoản này' });
    return;
  }
  if (saved.status === 'conflict') {
    automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
      current: saved.current,
    });
    return;
  }

  // Cập nhật cấu hình ngay cho session đang chạy nếu có
  sessions.updateFishingConfig(accountId(req), saved.state);
  res.json({ ...saved.state, application: 'immediate' });
});
```

- [ ] **Step 2: Cập nhật `sessionManager` và snapshot**

Trong `avatar-web/server/src/session/manager.ts`:
Thêm phương thức `updateFishingConfig(accountId: number, state: StoredFishingConfigState): void` ủy quyền cho `session.setFishingConfig(state)`.
Cập nhật `automationSnapshot` trả về trường `fishingConfig`.

- [ ] **Step 3: Verify routes**

Run: `npm --prefix avatar-web/server run build`
Expected: Build pass.

- [ ] **Step 4: Commit**

```bash
git add avatar-web/server/src/session/routes.ts avatar-web/server/src/session/manager.ts
git commit -m "feat(fishing): add PUT /automation/fishing/config API endpoint"
```

---

### Task 5: Bot Runtime Reactive Purchase Implementation

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `FishingConfig`, `parkBuyItem`, `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS`
- Produces: `executeParkPurchase`, vòng lặp tự động mua bù khi `RX45` thất bại

- [ ] **Step 1: Khởi tạo & Cập nhật `fishingConfig` trong `AvatarSession`**

Trước khi sửa `avatarSession.ts`, chạy:
`gitnexus_impact({target: "AvatarSession", direction: "upstream", repo: "learning-reverse"})`

Trong `avatarSession.ts`:
Thêm field:
```typescript
private fishingConfig: StoredFishingConfigState = defaultFishingConfig();
```
Cập nhật constructor / init để nạp `fishingConfig` từ credentials/intent.
Thêm method `setFishingConfig(state: StoredFishingConfigState)` để cập nhật cấu hình realtime khi user bấm Lưu trên Web.
Cập nhật `snapshotAutomation` bao gồm `fishingConfig: this.fishingConfig`.

- [ ] **Step 2: Triển khai phương thức `executeParkPurchase`**

Trong `AvatarSession`:
```typescript
private async executeParkPurchase(
  client: GameClient,
  epoch: number,
  signal: AbortSignal,
  missingType: 'ticket' | 'rod' | 'bait',
): Promise<boolean> {
  const cfg = this.fishingConfig.config;
  const targetMap = cfg.map;
  const targetArea = cfg.area;

  this.fishingRuntime.status = 'buying';
  this.emitAutomation();

  if (missingType === 'ticket') {
    if (!cfg.autoBuyTicket) {
      this.pushLog('[câu cá] Thiếu vé câu nhưng chưa bật tự mua vé — Dừng câu');
      return false;
    }
    const ticket = FISHING_TICKETS[targetMap];
    if (!ticket) {
      this.pushLog(`[câu cá] Map ${targetMap} cần vé sự kiện riêng, NPC không bán — Dừng câu`);
      return false;
    }
    this.pushLog(`[câu cá] Đang di chuyển sang Khu sinh thái (Map 13) để mua ${ticket.name}…`);
  } else if (missingType === 'rod') {
    if (cfg.rodType <= 0) {
      this.pushLog('[câu cá] Thiếu cần câu nhưng cấu hình Không tự mua cần — Dừng câu');
      return false;
    }
    const rod = FISHING_RODS.find((r) => r.id === cfg.rodType);
    this.pushLog(`[câu cá] Đang di chuyển sang Khu sinh thái (Map 13) để mua ${rod?.name ?? 'cần câu'}…`);
  } else if (missingType === 'bait') {
    if (cfg.baitType <= 0) {
      this.pushLog('[câu cá] Thiếu mồi câu nhưng cấu hình Không tự mua mồi — Dừng câu');
      return false;
    }
    const bait = FISHING_BAITS.find((b) => b.id === cfg.baitType);
    this.pushLog(`[câu cá] Đang di chuyển sang Khu sinh thái (Map 13) để mua ${bait?.name ?? 'mồi câu'} (×${cfg.baitQuantity})…`);
  }

  // 1. Di chuyển sang Map 13 (Khu sinh thái, tọa độ NPC 364, 64)
  try {
    const map13Snapshot = client.waitForWorldSnapshot(signal, 6000, { map: 13, area: 0 });
    client.joinPark(13, 0);
    await map13Snapshot;
  } catch (err) {
    if (signal.aborted || !this.isCurrent(client, epoch)) return false;
    this.pushLog(`[câu cá] Không vào được Khu sinh thái: ${(err as Error).message}`);
    return false;
  }

  await this.delayCancellable(800, signal);
  if (signal.aborted || !this.isCurrent(client, epoch)) return false;

  // 2. Gửi lệnh mua vật phẩm tương ứng
  if (missingType === 'ticket') {
    const ticket = FISHING_TICKETS[targetMap]!;
    client.parkBuyItem(ticket.id, ticket.typeMoney);
    this.pushLog(`[câu cá] Đã gửi lệnh mua ${ticket.name}`);
    await this.delayCancellable(1000, signal);
  } else if (missingType === 'rod') {
    const rod = FISHING_RODS.find((r) => r.id === cfg.rodType)!;
    client.parkBuyItem(rod.id, rod.typeMoney);
    this.pushLog(`[câu cá] Đã gửi lệnh mua ${rod.name}`);
    await this.delayCancellable(1000, signal);
  } else if (missingType === 'bait') {
    const bait = FISHING_BAITS.find((b) => b.id === cfg.baitType)!;
    const qty = cfg.baitQuantity;
    this.pushLog(`[câu cá] Đang mua ${bait.name} (số lượng ${qty})…`);
    for (let i = 0; i < qty; i++) {
      if (signal.aborted || !this.isCurrent(client, epoch)) return false;
      client.parkBuyItem(bait.id, bait.typeMoney);
      await this.delayCancellable(300, signal);
    }
    this.pushLog(`[câu cá] Đã gửi lệnh mua xong ${qty} ${bait.name}`);
    await this.delayCancellable(800, signal);
  }

  // 3. Quay trở lại hồ câu mục tiêu
  this.pushLog(`[câu cá] Đang quay trở lại hồ câu map ${targetMap}…`);
  try {
    const targetSnapshot = client.waitForWorldSnapshot(signal, 6000, { map: targetMap, area: targetArea });
    client.joinPark(targetMap, targetArea);
    await targetSnapshot;
  } catch (err) {
    if (signal.aborted || !this.isCurrent(client, epoch)) return false;
    this.pushLog(`[câu cá] Không quay lại được hồ câu: ${(err as Error).message}`);
    return false;
  }

  await this.delayCancellable(1000, signal);
  return true;
}
```

- [ ] **Step 3: Tích hợp vào `runFishingLoop` xử lý rejection của `TX45`**

Trong `runFishingLoop`:
- Đọc `config = this.fishingConfig.config;`.
- Khi nhận `startResult.iss === false`:
  - Chuẩn hóa text: `const errText = (startResult.error || '').toLowerCase();`.
  - Nhận diện `missingType`:
    - Nếu `errText.includes('vé') || errText.includes('bến tàu')`: `missingType = 'ticket'`.
    - Nếu `errText.includes('cần')`: `missingType = 'rod'`.
    - Nếu `errText.includes('mồi')`: `missingType = 'bait'`.
  - Nếu xác định được `missingType`:
    - Kiểm tra `consecutiveFailures`: nếu `>= 2` $\rightarrow$ dừng câu, báo lỗi để chống vòng lặp vô tận.
    - Gọi `const bought = await this.executeParkPurchase(client, epoch, signal, missingType);`.
    - Nếu `bought === true`: `consecutiveFailures++`, `continue;` vòng lặp để thử gửi lại `TX45`.
    - Nếu `bought === false`: dừng câu, `return;`.
  - Nếu không xác định được lý do hoặc lỗi khác: dừng câu và gán `fishingRuntime.lastError`.

- [ ] **Step 4: Verify session changes**

Run: `npm --prefix avatar-web/server run build`
Expected: Build pass không có lỗi.

- [ ] **Step 5: Commit**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(fishing): implement reactive auto-purchase flow in AvatarSession"
```

---

### Task 6: Giao Diện Web UI `FishingPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`

**Interfaces:**
- Consumes: `automation.fishingConfig`, `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS`, `PUT /automation/fishing/config`
- Produces: Form hoàn chỉnh cấu hình câu cá và mua vật phẩm trên Web

- [ ] **Step 1: Thêm state & logic lưu cấu hình trong `FishingPanel.tsx`**

Trong `avatar-web/web/src/accounts/panels/FishingPanel.tsx`:
- Lấy `initialConfig = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG`.
- Thêm state:
  - `selectedMap`, `area`, `delayMs`.
  - `autoBuyTicket: boolean` (mặc định: `initialConfig.autoBuyTicket ?? true`).
  - `rodType: number` (mặc định: `initialConfig.rodType ?? 442`).
  - `baitType: number` (mặc định: `initialConfig.baitType ?? 448`).
  - `baitQuantity: number` (mặc định: `initialConfig.baitQuantity ?? 50`).
  - `savingConfig: boolean`, `saveSuccess: boolean`.
- Thêm hàm `handleSaveConfig`:
  - Gửi `PUT /api/accounts/${accountId}/automation/fishing/config` với `expectedRevision = automation?.fishingConfig?.revision ?? 0`.
  - Hiển thị phản hồi lưu thành công hoặc báo lỗi conflict.

- [ ] **Step 2: Xây dựng UI Form Cấu Hình Mua Vật Phẩm**

Thêm các trường vào Form:
1. **Vé câu:** Checkbox `Tự động mua vé câu theo hồ` kèm nhãn giải thích động theo map:
   - Map 14: *"Tự mua Vé cá rô (1.000 xu)"*.
   - Map 15: *"Tự mua Vé cá lóc (10.000 xu)"*.
   - Map 16: *"Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng"*.
   - Map 27: *"Bến tàu cần vé sự kiện riêng, NPC không bán"*.
2. **Cần câu:** Dropdown chọn `rodType` (Không tự mua / Cần tre 10.000 xu / Cần sắt 25 Lượng / Cần VIP). Hiển thị badge màu cam cảnh báo nếu chọn loại cần tiêu Lượng.
3. **Mồi câu:** Dropdown chọn `baitType` (Không tự mua / Mồi cơm 5 xu / Mồi trùng 20 xu / Trứng kiến 30 xu) và Input `baitQuantity` (1..200).
4. **Nút "Lưu Cấu Hình":** Nút bấm màu xanh, disabled khi `isFishing` hoặc `savingConfig`.
5. **Cập nhật hiển thị trạng thái runtime:** Bổ sung case `'buying'` trong `formatFishingStatus`:
   `'Đang đi mua vật phẩm câu cá tại Khu sinh thái (Map 13)…'`.

- [ ] **Step 3: Verify frontend build**

Run: `npm --prefix avatar-web/web run build`
Expected: Build pass không có lỗi TypeScript hay Vite bundle.

- [ ] **Step 4: Commit**

```bash
git add avatar-web/web/src/accounts/panels/FishingPanel.tsx
git commit -m "feat(fishing): add auto-buy items configuration and status in FishingPanel UI"
```

---

### Task 7: Kiểm Tra Tích Hợp & Toàn Diện Toàn Bộ Dự Án

**Files:**
- Verification toàn bộ các files đã sửa.

- [ ] **Step 1: Chạy build production cho toàn bộ monorepo**

Run: `npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
Expected: Cả server và web đều build thành công không có lỗi type.

- [ ] **Step 2: Chạy kiểm tra scope ảnh hưởng với GitNexus**

Run: `gitnexus_detect_changes({scope: "unstaged"})`
Expected: Xác nhận chỉ các symbol mong muốn bị thay đổi.

- [ ] **Step 3: Cập nhật chỉ mục GitNexus**

Run: `npx gitnexus analyze`
Expected: GitNexus index được làm mới thành công.
