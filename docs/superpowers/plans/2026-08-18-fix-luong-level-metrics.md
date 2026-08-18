# Fix Lượng và Level Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải mã số dư xu/lượng/lượng khóa ngay từ gói đăng nhập `-34`, đồng thời giữ đồng bộ level và số dư bổ sung từ các gói farm/tiền để Web UI hiển thị ngay sau login.

**Architecture:** `decodeLoginSuccessMoney` đọc layout động trong `LOGIN_SUCESS (-34)` và phát ví ngay khi login thành công. `decodeInventory` và `decodePlayerInfo` tiếp tục bổ sung farm/player level, còn `-3/-5` vẫn được giữ để cập nhật tương thích sau giao dịch hoặc khi server gửi character payload. `GameClient` và `AvatarSession` lưu các patch vào `cachedMetrics` (SQLite), từ đó Web UI hiển thị ngay cả khi offline.

**Tech Stack:** TypeScript, Node.js, SQLite, React, Vite.

**Spec:** `docs/superpowers/specs/2026-08-18-fix-luong-level-metrics-design.md`

## Global Constraints
- Tuân thủ quy định GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).
- Không phá vỡ các luồng auto-farm và xử lý kho hiện tại.
- Xử lý an toàn khi kích thước gói tin hoặc phiên bản server trả về ít byte hơn (graceful fallback).

---

### Task 1: Mở rộng các decoder metrics trong `farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:200-250`
- Modify: `avatar-web/server/src/game/farmData.test.ts` (nếu có hoặc test tương ứng)

**Interfaces:**
- Consumes: `MyReader`
- Produces: `DecodedInventory` có `farmLevel`, `perLvFarm`, `levelStore`, `capacityStore`, `xu`; `decodePlayerInfo(body: Buffer)`; `decodeLoginSuccessMoney(body: Buffer)`.

- [x] **Step 1: Cập nhật hàm `decodeInventory`, thêm `decodePlayerInfo` và `decodeLoginSuccessMoney`**
Trong [avatar-web/server/src/game/farmData.ts](avatar-web/server/src/game/farmData.ts):
```ts
export interface DecodedInventory {
  seeds: InventoryItem[];
  items: InventoryItem[];
  other: InventoryItem[][];
  xu?: number;
  farmLevel?: number;
  perLvFarm?: number;
  levelStore?: number;
  capacityStore?: number;
  restHex: string;
}

export function decodeInventory(body: Buffer): DecodedInventory {
  const r = new MyReader(body);
  const sections: InventoryItem[][] = [];
  for (let s = 0; s < 4 && r.available() > 0; s++) {
    const count = r.readByte();
    if (count < 0 || r.available() < count * 6) {
      break;
    }
    const list: InventoryItem[] = [];
    for (let i = 0; i < count; i++) list.push({ id: r.readShort(), num: r.readInt() });
    sections.push(list);
  }

  let xu: number | undefined;
  let farmLevel: number | undefined;
  let perLvFarm: number | undefined;
  let levelStore: number | undefined;
  let capacityStore: number | undefined;
  let restHex = '';

  if (r.available() > 0) {
    if (r.available() >= 12) {
      try {
        const parsedXu = r.readInt();
        if (parsedXu >= 0) xu = parsedXu;
        farmLevel = r.readShort();
        perLvFarm = r.readByte();
        levelStore = r.readByte();
        capacityStore = r.readInt();
      } catch {
        /* fallback */
      }
    } else if (r.available() >= 4) {
      try {
        const parsedXu = r.readInt();
        if (parsedXu >= 0) xu = parsedXu;
      } catch {}
    }
    restHex = r.rest().toString('hex');
  }

  return {
    seeds: sections[0] ?? [],
    items: sections[1] ?? [],
    other: sections.slice(2),
    ...(xu !== undefined ? { xu } : {}),
    ...(farmLevel !== undefined ? { farmLevel } : {}),
    ...(perLvFarm !== undefined ? { perLvFarm } : {}),
    ...(levelStore !== undefined ? { levelStore } : {}),
    ...(capacityStore !== undefined ? { capacityStore } : {}),
    restHex,
  };
}

export function decodePlayerInfo(body: Buffer): { playerId: number; playerLevel: number; perLvMain?: number } {
  const r = new MyReader(body);
  const playerId = r.readInt();
  const playerLevel = r.readByte();
  const perLvMain = r.available() > 0 ? r.readByte() : undefined;
  return { playerId, playerLevel, perLvMain };
}
```

- [x] **Step 2: Kiểm tra test suite**
Run: `npm test` trong `avatar-web/server`
Expected: 254 tests pass thành công.

---

### Task 2: Cập nhật `GameClient` để xử lý ví login và phát event metrics

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:470-520`

**Interfaces:**
- Consumes: `decodeLoginSuccessMoney`, `decodeInventory`, `decodePlayerInfo` từ `farmData.ts`
- Produces: `client.money`, `client.luong`, `client.luongKhoa`, `client.farmLevel`, `client.playerLevel`, event `metrics`

- [x] **Step 1: Xử lý cmd -34, cmd 70 và cmd -94 trong `client.ts`**
Trong [avatar-web/server/src/game/client.ts](avatar-web/server/src/game/client.ts):
- Khi nhận cmd `-34` login thành công, gọi `decodeLoginSuccessMoney(msg.getData())`, cập nhật ba field ví và phát một event `metrics`. Không gửi request mua/bán hay request phụ để lấy ví.
- Khi nhận cmd 70 (INVENTORY):
  - Cập nhật `this.farmLevel = inv.farmLevel`.
  - Phát event `metrics` với `{ farmLevel: inv.farmLevel, xu: inv.xu }`.
- Khi nhận cmd -94 (REQUEST_YOUR_INFO) hoặc cmd 24 (REQUEST_DETAIL):
  - Gọi `decodePlayerInfo(msg.getData())`.
  - Cập nhật `this.playerLevel = info.playerLevel`.
  - Phát event `metrics` với `{ playerLevel: info.playerLevel }`.
- Thêm phương thức `requestYourInfo(idUser?: number)` trong `GameClient`.

- [x] **Step 2: Kiểm tra test suite**
Run: `npm test` trong `avatar-web/server`
Expected: 254 tests pass thành công.

---

### Task 3: Cập nhật `AvatarSession` để lưu và cập nhật `cachedMetrics`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:390-410`

**Interfaces:**
- Consumes: Events `metrics`, `money` từ `GameClient`
- Produces: Cập nhật `cachedMetrics`, gọi `this.updateCachedMetrics(...)`

- [x] **Step 1: Lắng nghe event `metrics` trong `AvatarSession`**
Trong [avatar-web/server/src/session/avatarSession.ts](avatar-web/server/src/session/avatarSession.ts):
- Đăng ký listener `client.on('metrics', (patch: AccountMetricsPatch) => { this.updateCachedMetrics(patch); })`.
- Đồng thời khi kết nối online thành công (`onOnline`), nếu có `client.playerId`, gửi `client.requestYourInfo()` để lấy level nhân vật.

- [x] **Step 2: Kiểm tra test suite và build**
Run: `npm test` trong `avatar-web/server` và `npm run build` trong `avatar-web/web`
Expected: server 254/254, web 71/71 và build pass.
