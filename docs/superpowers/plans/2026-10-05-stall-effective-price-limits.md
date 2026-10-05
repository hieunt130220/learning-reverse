# Chuẩn Hoá Giới Hạn Giá Bán Sạp Thực Tế & Cập Nhật Tên Sản Phẩm Chăn Nuôi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hoá bảng giá trần/sàn sạp bán (cmd 103) theo giá thực tế mà server chấp nhận trên wire (thay vì trần kỹ thuật thô của protocol), đồng thời sửa định danh vật phẩm chăn nuôi #60 thành "Sữa dê".

**Architecture:** Bổ sung bảng `STALL_INNER_PRICE_LIMITS` và hàm `resolveEffectivePriceRules` trong `shopProtocol.ts`. Chuẩn hoá trực tiếp danh sách `priceRules` ngay tại `ShopCoordinator.onShopPacket` khi nhận gói `cmd 103 sub 8`, nhờ đó toàn bộ tầng kiểm tra backend (`validateListInput`, `autoListStall`), cache DB và UI web (`ShopPanel`, `AutoSellRulesEditor`) tự động thừa hưởng khoảng giá thực tế mà không cần sửa code giao diện.

**Tech Stack:** TypeScript, Node.js (avatar-web/server), React (avatar-web/web).

**Spec:** `docs/superpowers/specs/2026-10-05-stall-effective-price-limits-design.md`

## Global Constraints
- KHÔNG thực hiện TDD: không tạo test file mới, chỉ chạy và đảm bảo test suite hiện có pass 100%.
- Sử dụng GitNexus impact trước khi chỉnh sửa và detect changes trước khi commit.
- Giữ nguyên parser binary gốc `decodeShopPacket` (vẫn decode trung thực gói tin nhận từ server).

---

### Task 1: Cập nhật định danh nông sản #60 thành "Sữa dê"

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts`
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx`

**Interfaces:**
- Consumes: `KNOWN_PRODUCE_NAME_MAP`, `ANIMAL_PRODUCT_NAMES`
- Produces: Tên gọi chuẩn xác của vật phẩm #60 là 'Sữa dê'

- [x] **Step 1: Cập nhật `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`**
  Tại dòng mapping vật phẩm chăn nuôi:
  ```typescript
  60: 'Sữa dê', // Thay vì 'Cua'
  ```

- [x] **Step 2: Cập nhật `ANIMAL_PRODUCT_NAMES` trong `CookingPanel.tsx`**
  Tại map tên sản phẩm chăn nuôi:
  ```typescript
  60: 'Sữa dê', // Thay vì 'Cua'
  ```

- [x] **Step 3: Kiểm tra typecheck**
  Run: `npm --prefix /Users/devios/learning-reverse/avatar-web/server run typecheck && npm --prefix /Users/devios/learning-reverse/avatar-web/web run typecheck`
  Expected: Không có lỗi typecheck.

- [x] **Step 4: Commit**
  `git commit -m "fix(produce): rename animal product #60 to Sữa dê"`

---

### Task 2: Định nghĩa bảng giới hạn giá thực tế và hàm `resolveEffectivePriceRules` trong `shopProtocol.ts`

**Files:**
- Modify: `avatar-web/server/src/game/shopProtocol.ts`

**Interfaces:**
- Consumes: `ShopPriceRule`
- Produces:
  - `export interface StallInnerLimit { innerMin: number; innerMax: number; }`
  - `export const STALL_INNER_PRICE_LIMITS: Readonly<Record<number, StallInnerLimit>>`
  - `export function resolveEffectivePriceRules(rules: readonly ShopPriceRule[]): ShopPriceRule[]`

- [x] **Step 1: GitNexus impact check**
  Run: GitNexus impact cho `ShopPriceRule` và `shopProtocol.ts`.

- [x] **Step 2: Thêm hằng số `STALL_INNER_PRICE_LIMITS`**
  Khai báo cấu hình 26 mặt hàng đã kiểm chứng live:
  - Cây trồng cơ bản (#0 – #10): `innerMin: 1, innerMax: 10`
  - Chăn nuôi:
    - #50 Trứng Gà: `innerMin: 8, innerMax: 30`
    - #51 Sữa Bò: `innerMin: 16, innerMax: 40`
    - #55 Trứng Vịt: `innerMin: 8, innerMax: 30` (giao với protocol min 30 -> 30 xu)
    - #56 Lông Cừu: `innerMin: 72, innerMax: 110`
    - #60 Sữa Dê: `innerMin: 48, innerMax: 80`
  - Cây vụ mùa / cao cấp:
    - #200 Bắp: `innerMin: 1, innerMax: 20`
    - #201 Nha đam: `innerMin: 1, innerMax: 20`
    - #202 Dưa Leo: `innerMin: 1, innerMax: 10`
    - #204 Tỏi: `innerMin: 1, innerMax: 10`
    - #248 Dâu Tây: `innerMin: 1, innerMax: 10`
    - #249 Chuối: `innerMin: 1, innerMax: 10`
    - #270 Bí Ngô: `innerMin: 1, innerMax: 10`
    - #271 Khoai Tây: `innerMin: 3, innerMax: 30`
    - #286 Ớt hiểm: `innerMin: 1, innerMax: 10`
    - #288 Cải Thảo: `innerMin: 1, innerMax: 10`

- [x] **Step 3: Thêm hàm `resolveEffectivePriceRules`**
  ```typescript
  export function resolveEffectivePriceRules(rules: readonly ShopPriceRule[]): ShopPriceRule[] {
    return rules.map((rule) => {
      const inner = STALL_INNER_PRICE_LIMITS[rule.itemId];
      if (!inner) return { ...rule };

      const minPrice = Math.max(rule.minPrice, inner.innerMin);
      const maxPrice = Math.min(rule.maxPrice, inner.innerMax);

      return {
        itemId: rule.itemId,
        minPrice: Math.min(minPrice, maxPrice),
        maxPrice: Math.max(minPrice, maxPrice),
      };
    });
  }
  ```

- [x] **Step 4: Kiểm tra typecheck**
  Run: `npm --prefix /Users/devios/learning-reverse/avatar-web/server run typecheck`
  Expected: Typecheck thành công.

- [x] **Step 5: Commit**
  `git commit -m "feat(shop): add STALL_INNER_PRICE_LIMITS and resolveEffectivePriceRules"`

---

### Task 3: Chuẩn hoá `priceRules` trong `ShopCoordinator`

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts`

**Interfaces:**
- Consumes: `resolveEffectivePriceRules` từ `../game/shopProtocol.js`
- Produces: `ShopState.priceRules.data` chứa danh sách giá đã chuẩn hóa theo giới hạn thực tế

- [x] **Step 1: GitNexus impact check**
  Run: GitNexus impact cho `ShopCoordinator` và hàm `onShopPacket`.

- [x] **Step 2: Cập nhật nhánh `price-rules` trong `onShopPacket`**
  Import `resolveEffectivePriceRules` và áp dụng trước khi gán vào `next.priceRules`:
  ```typescript
  } else if (event.kind === 'price-rules') {
    const effectiveRules = resolveEffectivePriceRules(event.rules);
    next = {
      ...next,
      priceRules: {
        revision: (next.priceRules?.revision ?? 0) + 1,
        connectionEpoch: epoch,
        capturedAt,
        data: effectiveRules,
      },
    };
  }
  ```

- [x] **Step 3: Chạy test suite của server**
  Run: `npm --prefix /Users/devios/learning-reverse/avatar-web/server run test`
  Expected: Tất cả các test hiện có pass 100%.

- [x] **Step 4: Commit**
  `git commit -m "feat(shop): normalize priceRules with live effective limits in ShopCoordinator"`

---

### Task 4: Kiểm tra tổng thể & Cập nhật probe

**Files:**
- Modify: `avatar-web/server/src/tools/stall-price-probe.ts`

- [x] **Step 1: Cập nhật `stall-price-probe.ts` dùng chung `STALL_INNER_PRICE_LIMITS`**
  Import `STALL_INNER_PRICE_LIMITS` và `resolveEffectivePriceRules` từ `shopProtocol.ts` thay vì khai báo lặp lại hằng số trong probe.

- [x] **Step 2: Chạy kiểm tra toàn bộ project**
  Run:
  - `npm --prefix /Users/devios/learning-reverse/avatar-web/server run typecheck`
  - `npm --prefix /Users/devios/learning-reverse/avatar-web/server run test`
  - `npm --prefix /Users/devios/learning-reverse/avatar-web/web run build`
  Expected: Pass 100%.

- [x] **Step 3: GitNexus detect changes & commit**
  Run: `detect_changes({ scope: "all" })`
  Commit: `git commit -m "chore(tools): update stall-price-probe to use shared effective limits"`
