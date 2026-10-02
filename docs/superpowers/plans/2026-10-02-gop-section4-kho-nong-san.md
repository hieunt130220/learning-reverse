# Gộp Section 4 Vào Kho Nông Sản Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gộp Section 4 (nông sản cao cấp, thủy cầm tươi sống) vào kho nông sản `produce` của GameClient và ánh xạ đầy đủ tên hiển thị cho các vật phẩm này ở cả server và web.

**Architecture:** Mở rộng gán `this.produce` trong `GameClient.ts` để kết hợp cả `inv.other[0]` (Section 3) và `inv.other[1]` (Section 4). Bổ sung danh mục ID vật phẩm Section 4 vào `KNOWN_PRODUCE_NAME_MAP` (server) và `ANIMAL_PRODUCT_NAMES` (web). Điều chỉnh gom nguyên liệu bếp trong `autoFarm.ts` để tránh đúp số lượng.

**Tech Stack:** TypeScript, Node.js, React

**Spec:** `docs/superpowers/specs/2026-10-02-gop-section4-kho-nong-san-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy impact trước khi sửa và detect_changes trước khi commit.
- KHÔNG dùng TDD: không tạo file test mới, chỉ kiểm tra typecheck và manual probe.
- Giữ nguyên `this.cookingMaterials` tham chiếu Section 4 để đảm bảo tương thích ngược cho các module đang đọc trực tiếp.

---

### Task 1: Bổ sung ID vật phẩm Section 4 vào `KNOWN_PRODUCE_NAME_MAP` trên Server

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:1936-1991`

**Interfaces:**
- Consumes: `KNOWN_PRODUCE_NAME_MAP`
- Produces: Ánh xạ tên đầy đủ cho các ID Section 4 (#200, #202, #204, #249, #266, #270, #271, #272, #276, #277, #279, #282, #283, #286, #289, #295, #297)

- [x] **Step 1: Cập nhật `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`**
Thêm các định danh vật phẩm Section 4 vào `KNOWN_PRODUCE_NAME_MAP`:
```typescript
  200: 'Bắp hạt',
  202: 'Dưa leo',
  204: 'Đậu nành',
  249: 'Chuối xanh',
  266: 'Hoa cúc khô',
  270: 'Bí ngô',
  271: 'Khoai tây cô đặc',
  272: 'Dưa hấu cô đặc',
  276: 'Thịt gà sống',
  277: 'Gà luộc',
  279: 'Mai rùa / Ba ba',
  282: 'Thịt heo tươi',
  283: 'Cá chép tươi sống',
  286: 'Ớt xay',
  289: 'Táo đỏ',
  295: 'Thịt trâu tươi',
  297: 'Vịt tươi sống',
```

- [x] **Step 2: Kiểm tra typecheck**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Không có lỗi TypeScript.

- [x] **Step 3: Commit**
`git commit -m "feat(farm): map section 4 produce and ingredient names in farmData"`

---

### Task 2: Gộp Section 3 và Section 4 vào `produce` trong `GameClient` & điều chỉnh `autoFarm`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:1484-1502`
- Modify: `avatar-web/server/src/autoFarm.ts:1416-1422`

**Interfaces:**
- Consumes: `decodeInventory`, `inv.other`
- Produces: `GameClient.produce` chứa cả 2 section; `autoFarm` tính nguyên liệu bếp không bị đúp

- [x] **Step 1: Cập nhật `GameClient.ts` case 70**
Chỉnh sửa khối xử lý case 70:
```typescript
        const section3 = inv.other[0] ?? [];
        const section4 = inv.other[1] ?? [];
        this.produce = [...section3, ...section4];
        this.cookingMaterials = section4;
```

- [x] **Step 2: Cập nhật `autoFarm.ts` gom nguyên liệu bếp**
Đổi dòng gom nguyên liệu bếp:
```typescript
            const availableMaterials = new Map<number, number>();
            for (const item of (this.client.produce ?? [])) {
              availableMaterials.set(item.id, (availableMaterials.get(item.id) ?? 0) + item.num);
            }
```

- [x] **Step 3: Kiểm tra typecheck**
Run: `npm --prefix avatar-web/server run typecheck`
Expected: Thành công không có lỗi compile.

- [x] **Step 4: Commit**
`git commit -m "fix(inventory): include section 4 items in farm produce and prevent double-counting in autoFarm"`

---

### Task 3: Cập nhật ánh xạ tên hiển thị kho nông sản trên Web UI

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx:44-53`

**Interfaces:**
- Consumes: `ANIMAL_PRODUCT_NAMES`
- Produces: `ANIMAL_PRODUCT_NAMES` được mở rộng chứa tên Section 4, phục vụ `AssetsPanel` và `CookingPanel`

- [x] **Step 1: Thêm các ID Section 4 vào `ANIMAL_PRODUCT_NAMES`**
Cập nhật `ANIMAL_PRODUCT_NAMES` trong `CookingPanel.tsx`:
```typescript
export const ANIMAL_PRODUCT_NAMES: Record<number, string> = {
  50: 'Trứng gà',
  51: 'Sữa bò',
  52: 'Thịt heo',
  54: 'Cá chép',
  55: 'Thịt vịt',
  57: 'Thịt trâu',
  59: 'Thịt ba ba',
  200: 'Bắp hạt',
  202: 'Dưa leo',
  204: 'Đậu nành',
  249: 'Chuối xanh',
  266: 'Hoa cúc khô',
  270: 'Bí ngô',
  271: 'Khoai tây cô đặc',
  272: 'Dưa hấu cô đặc',
  276: 'Thịt gà sống',
  277: 'Gà luộc',
  279: 'Mai rùa / Ba ba',
  282: 'Thịt heo tươi',
  283: 'Cá chép tươi sống',
  286: 'Ớt xay',
  289: 'Táo đỏ',
  295: 'Thịt trâu tươi',
  297: 'Vịt tươi sống',
};
```

- [x] **Step 2: Kiểm tra typecheck Web**
Run: `npm --prefix avatar-web/web run typecheck` (hoặc `npx tsc -b --noEmit`)
Expected: Không có lỗi TypeScript.

- [x] **Step 3: Commit**
`git commit -m "feat(web): add section 4 produce names for warehouse display"`

---

### Task 4: Chạy probe xác minh live trên tài khoản thật

**Files:**
- Run: `avatar-web/server/src/tools/inv-dump.ts`

- [x] **Step 1: Chạy công cụ `inv-dump.ts`**
Run: `npx tsx --env-file=.env src/tools/inv-dump.ts 1 0`
Expected:
In ra đầy đủ:
- Section 3 & Section 4 được gom chung vào kho nông sản
- Đủ 450 Bí ngô (#270), 1520 Dưa leo (#202), 10 Vịt tươi sống (#297), 18 Cá chép tươi sống (#283), 4 Mai rùa (#279)
- Hiển thị đúng tên tiếng Việt của từng món nông sản
