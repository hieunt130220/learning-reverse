# Map 27 Pier Fishing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp bộ catalog Bến Tàu (Vé câu bến tàu 4876, Cần Lục Sĩ 4874, Cần Chuyên Gia 4879, Mồi cá trâm 4875) vào hệ thống cấu hình web và bot auto-buy `avatarSession`.

**Architecture:** Mở rộng các bảng dữ liệu `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS` đồng bộ ở cả server và web client. Cập nhật UI `FishingSettingsPanel.tsx` để hiển thị đúng gợi ý mua vé Map 27 và các lựa chọn cần/mồi mới. Bổ sung từ khóa nhận diện cần câu bến tàu vào bộ lọc dialog trong `avatarSession.ts` để kích hoạt reactive auto-buy khi câu tại Map 27.

**Tech Stack:** TypeScript, Node.js (ESM), React (Vite), SQLite

**Spec:** `docs/superpowers/specs/2026-09-14-map-27-pier-fishing-integration-design.md`

## Global Constraints
- KHÔNG thực hiện TDD: không viết test trước, không tạo test files trừ khi user yêu cầu rõ ràng.
- Giữ nguyên toàn bộ cấu trúc dữ liệu JSON `fishing_config_json` hiện tại trong DB, không cần migration schema.
- Giữ nguyên quy ước opcode: mua vật phẩm qua TX -43 `buyItemStack` tại Map 13 (đã verify live thành công ngày 2026-09-14).
- Phải chạy `typecheck` và `build` sau mỗi task để đảm bảo không gãy compile.

---

### Task 1: Cập nhật Data Contracts Backend & Frontend

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts:36-55`
- Modify: `avatar-web/web/src/types.ts:367-386`

**Interfaces:**
- Consumes: Không
- Produces: 
  - `FISHING_TICKETS[27]` (`id: 4876`, `name: 'Vé câu bến tàu'`, `cost: '12.000 xu (hạn 3 ngày)'`, `typeMoney: 1`)
  - `FISHING_RODS`: thêm ID `4874` (Cần câu Lục Sĩ, 20.000 xu, typeMoney: 1) và ID `4879` (Cần câu Chuyên Gia, 120 Lượng, typeMoney: 2)
  - `FISHING_BAITS`: thêm ID `4875` (Mồi câu cá trâm, 50 xu / mồi, typeMoney: 1)

- [ ] **Step 1: Cập nhật `automationTypes.ts` trên server**

Sửa `avatar-web/server/src/session/automationTypes.ts`:
```typescript
export const FISHING_TICKETS: Readonly<Record<number, { id: number; name: string; cost: string; typeMoney: number }>> = Object.freeze({
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
  27: { id: 4876, name: 'Vé câu bến tàu', cost: '12.000 xu (hạn 3 ngày)', typeMoney: 1 },
});

export const FISHING_RODS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 4874, name: 'Cần câu Lục Sĩ', cost: '20.000 xu', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 4879, name: 'Cần câu Chuyên Gia', cost: '120 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
]);

export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
  { id: 4875, name: 'Mồi câu cá trâm', cost: '50 xu / mồi', typeMoney: 1 },
]);
```

- [ ] **Step 2: Cập nhật `types.ts` trên web frontend**

Sửa `avatar-web/web/src/types.ts` đồng bộ chính xác với `automationTypes.ts`.

- [ ] **Step 3: Kiểm tra TypeScript server & frontend**

Run:
```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/web run build
```
Expected: Cả 2 lệnh exit code 0, không có lỗi type.

---

### Task 2: Cập nhật Web UI Fishing Settings

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx:29-45`

**Interfaces:**
- Consumes: `FISHING_TICKETS[27]`, `FISHING_RODS`, `FISHING_BAITS` từ Task 1
- Produces: Gợi ý vé câu Map 27 chính xác

- [ ] **Step 1: Cập nhật hàm `getTicketHint` trong `FishingSettingsPanel.tsx`**

Sửa nhánh `case 27` trong hàm `getTicketHint`:
```typescript
function getTicketHint(mapId: number): string {
  switch (mapId) {
    case 14:
      return 'Tự mua Vé cá rô (1.000 xu)';
    case 15:
      return 'Tự mua Vé cá lóc (10.000 xu)';
    case 16:
      return 'Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng';
    case 27:
      return 'Tự mua Vé câu bến tàu (12.000 xu)';
    default:
      return FISHING_TICKETS[mapId]
        ? `Tự mua ${FISHING_TICKETS[mapId].name}`
        : 'Bản đồ này không có vé bán tại NPC';
  }
}
```

- [ ] **Step 2: Kiểm tra Vite build frontend**

Run:
```bash
npm --prefix avatar-web/web run build
```
Expected: Build thành công (exit code 0).

---

### Task 3: Cập nhật Bot Runtime Rejection Detection & Build Server

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:3240-3246, 3515-3520`

**Interfaces:**
- Consumes: `FISHING_TICKETS[27]` từ Task 1
- Produces: Nhận diện lỗi thiếu cần câu khi server trả về thông báo liên quan đến "lục sĩ" hoặc "chuyên gia"

- [ ] **Step 1: Cập nhật regex / chuỗi nhận diện cần câu trong `avatarSession.ts`**

Tại dòng 3241-3245 (bắt lỗi trong `startFishingSession`):
```typescript
        } else if (
          errText.includes('cần câu')
          || errText.includes('sử dụng cần')
          || errText.includes('phải có cần')
          || errText.includes('cần tre')
          || errText.includes('cần sắt')
          || errText.includes('lục sĩ')
          || errText.includes('chuyên gia')
        ) {
          missingType = 'rod';
        }
```

Tại dòng 3515-3519 (bắt lỗi gãy cần / hết hạn cần trong lúc câu `castFishingLoop`):
```typescript
          } else if (
            castErrText.includes('cần câu')
            || castErrText.includes('sử dụng cần')
            || castErrText.includes('phải có cần')
            || castErrText.includes('cần tre')
            || castErrText.includes('cần sắt')
            || castErrText.includes('lục sĩ')
            || castErrText.includes('chuyên gia')
          ) {
            castMissingType = 'rod';
```

- [ ] **Step 2: Chạy typecheck và build toàn bộ server & web**

Run:
```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/web run build
```
Expected: Cả 3 lệnh exit 0 sạch sẽ.
