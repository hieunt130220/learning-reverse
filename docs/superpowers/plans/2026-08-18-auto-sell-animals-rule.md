# Auto Sell Animals Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ setting bán vật nuôi thủ công trên web UI và cố định quy tắc tự động bán trên server: vật nuôi có sản phẩm (Gà, Vịt, Bò, Dê, Cừu) luôn bán khi gần chết, các vật nuôi còn lại (Heo, Cá chép, Trâu, Rùa, Thỏ) luôn bán khi đủ lớn.

**Architecture:** Cập nhật hằng số danh sách phân loại vật nuôi trong `farmData.ts`, cấu hình tự động bán luôn bật trong `autoFarm.ts` và `AutoFarmPanel.tsx`, loại bỏ các control cấu hình bán thủ công trên UI `AutoFarmPanel.tsx`, và cập nhật test suites liên quan.

**Tech Stack:** TypeScript, React, Node.js, Vitest

**Spec:** `docs/superpowers/specs/2026-08-18-auto-sell-animals-rule-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD (không tạo test files mới, chỉ cập nhật các bài test hiện có sau khi viết code).
- Giữ nguyên kế hoạch vật nuôi theo slot (`barnAnimalPlan`, `pondAnimalPlan`).
- Bảo vệ thú tiện ích: Chó (53) và Mèo (57) tuyệt đối không bán.

---

### Task 1: Cập Nhật Phân Loại Loài & Cố Định Tự Động Bán Trên Server

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:815-840`
- Modify: `avatar-web/server/src/autoFarm.ts:195-230, 855-920, 1143-1165`

**Interfaces:**
- Consumes:
  - `SPECIES_SELL_NEAR_DEATH`: `[50, 51, 55, 56, 60]`
  - `SPECIES_SELL_WHEN_GROWN`: `[52, 54, 58, 59, 61]`
- Produces:
  - `AutoFarm`: Tự động bán vật nuôi theo đúng nhóm phân loại loài.

- [x] **Step 1: Cập nhật hằng số phân loại loài trong `farmData.ts`**
  - Đặt `SPECIES_SELL_WHEN_GROWN = [52, 54, 58, 59, 61]` (Heo, Cá chép, Trâu, Rùa, Thỏ).
  - Đặt `SPECIES_SELL_NEAR_DEATH = [50, 51, 55, 56, 60]` (Gà, Bò, Vịt, Cừu, Dê).
  - Cập nhật tài liệu chú thích trong file.

- [x] **Step 2: Cập nhật `ALWAYS_ON_CONFIG` và logic xử lý bán trong `autoFarm.ts`**
  - Trong `ALWAYS_ON_CONFIG`: thêm `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true`.
  - Trong `DEFAULTS`: đặt `sellAnimals: true`, `sellWhenGrownSpecies: SPECIES_SELL_WHEN_GROWN`, `sellNearDeathSpecies: SPECIES_SELL_NEAR_DEATH`.
  - Trong `makeConfig`: gán `sellWhenGrownSpecies: SPECIES_SELL_WHEN_GROWN` và `sellNearDeathSpecies: SPECIES_SELL_NEAR_DEATH`.
  - Trong vòng lặp kiểm tra bán (`autoFarm.ts`):
    - Đơn giản hóa điều kiện `whenGrown` và `nearDeath`:
      ```typescript
      const whenGrown = cfg.sellWhenGrownSpecies.includes(a.species);
      const nearDeath = cfg.sellNearDeathSpecies.includes(a.species);
      ```
    - Nếu `whenGrown`: bán khi `bornTime >= spec.growMinutes && a.numEggOne <= 0`.
    - Nếu `nearDeath`: bán khi `remainingMinutes <= 60` hoặc `hadProduct && remainingMinutes - cycle <= 60`.

- [x] **Step 3: Kiểm tra build server**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi TypeScript.

- [x] **Step 4: Commit thay đổi server**
  `git commit -m "feat(server): update animal selling classifications and make auto-sell always active"`

---

### Task 2: Gỡ Bỏ Setting Bán Vật Nuôi Trên Giao Diện Web

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:31-45, 195-240, 440-490`

**Interfaces:**
- Consumes:
  - `ALWAYS_ON_AUTO_CONFIG`: Chứa `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true`.
- Produces:
  - Giao diện `AutoFarmPanel` tinh gọn, không còn control bán thủ công.

- [x] **Step 1: Cập nhật `ALWAYS_ON_AUTO_CONFIG` trong `AutoFarmPanel.tsx`**
  - Bổ sung `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true` vào `ALWAYS_ON_AUTO_CONFIG`.

- [x] **Step 2: Xóa bỏ states và UI controls bán vật nuôi**
  - Xóa `sellBarnAnimals`, `sellPondAnimals`, `sellBarnSpeciesStr`, `sellPondSpeciesStr` khỏi `useState` và `hydrateForm`.
  - Xóa các phần tử JSX `<input type="checkbox" checked={sellBarnAnimals}...>` và ô nhập `sellBarnSpeciesStr` trong phần "🐓 Vật nuôi chuồng".
  - Xóa các phần tử JSX `<input type="checkbox" checked={sellPondAnimals}...>` và ô nhập `sellPondSpeciesStr` trong phần "🐟 Vật nuôi hồ".

- [x] **Step 3: Kiểm tra build web**
  Run: `npm --prefix avatar-web/web run build`
  Expected: Build bundle thành công không có lỗi TypeScript hay JSX.

- [x] **Step 4: Commit thay đổi web**
  `git commit -m "feat(web): remove manual animal selling controls from AutoFarmPanel"`

---

### Task 3: Cập Nhật Tests Hiện Có & Xác Minh Toàn Bộ Hệ Thống

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx`

**Interfaces:**
- Consumes:
  - Toàn bộ thay đổi từ Task 1 và Task 2.
- Produces:
  - Toàn bộ test suites pass và toàn bộ ứng dụng build sạch sẽ.

- [x] **Step 1: Cập nhật assertions trong `AutoFarmPanel.test.tsx`**
  - Cập nhật test `hydrate các control còn lại từ config đã lưu; control đã bỏ không hiển thị` để kiểm tra các checkbox/input bán vật nuôi không còn tồn tại trong DOM.
  - Cập nhật mock `alwaysOnConfig` trong test để phản ánh `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true`.

- [x] **Step 2: Chạy kiểm tra server & web tests**
  Run: `npm --prefix avatar-web/server test`
  Expected: Tất cả tests trong server pass.
  Run: `npm --prefix avatar-web/web test`
  Expected: Tất cả vitest trong web pass.

- [x] **Step 3: Commit cập nhật tests**
  `git commit -m "test: update autoFarm and AutoFarmPanel tests for always-on animal selling"`
