# Loại bỏ setting cho thao tác chăm sóc mặc định Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ các control chăm sóc mặc định khỏi `AutoFarmPanel` và bảo đảm auto farm luôn dùng policy thu hoạch, cho ăn, chữa bệnh, bón phân cùng item ID mặc định kể cả với cấu hình cũ.

**Architecture:** Frontend giữ các setting nguy hiểm hoặc có lựa chọn thật của user, đồng thời gửi một policy cố định cho request Bật và lưu kế hoạch. Server đặt cùng policy ở lớp `makeConfig` sau input để mọi đường chạy runtime, khởi động lại và caller cũ đều có cùng hành vi. REST, WebSocket, SQLite schema và các kế hoạch cây/vật nuôi không đổi.

**Tech Stack:** React 18, TypeScript 5.7 strict, Vite 6, Node.js TypeScript/Express, `AutoFarm` runtime hiện có.

## Global Constraints

- Toàn bộ chuỗi UI mới hoặc còn lại hướng tới người dùng viết bằng tiếng Việt có dấu.
- Không thay đổi REST/WebSocket contract, kế hoạch cây theo ô, kế hoạch vật nuôi theo slot, bán vật nuôi, tự mua, chu kỳ hoặc thao tác Bật/Tắt.
- Các input bị bỏ không được thay bằng control disabled hoặc control ẩn.
- Cấu hình cũ có `false` vẫn phải chạy policy luôn bật; không migration SQLite.
- `seedId` giữ như fallback tương thích nội bộ; user chọn hạt qua `treeCellPlan`.
- Item ID mặc định cố định là `waterItemId: 100`, `grassItemId: 123`, `wormItemId: 124`.
- Không xóa các key cũ khỏi `AUTO_CONFIG_KEYS` hoặc server parser.
- Không tạo test file và không sửa test file vì user chưa yêu cầu; kiểm chứng bằng build, diff và UI/runtime smoke check.
- Không commit, stage hoặc sửa các thay đổi không thuộc task; giữ nguyên dirty files có sẵn trong worktree.

---

## File Structure

**Modify:**

- `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` — bỏ state/JSX của setting luôn bật, gửi policy cố định trong payload Bật và payload lưu kế hoạch.
- `avatar-web/server/src/autoFarm.ts` — khai báo policy chung, cập nhật `DEFAULTS` và áp policy sau input trong `makeConfig`.

**Create:** Không tạo file production hoặc test mới.

**Documentation already approved:**

- `docs/superpowers/specs/2026-08-14-avatar-web-remove-always-on-settings-design.md`

## GitNexus Preflight

Đã chạy trên index mới nhất (`node .gitnexus/run.cjs analyze` báo up-to-date):

- `AutoFarmPanel`: LOW, 0 caller upstream được graph nhận diện.
- `makeConfig`: LOW, 2 caller trực tiếp (`AutoFarm.start`, `AutoFarm.queueConfig`), một process Session bị ảnh hưởng.

Sau implementation phải chạy `gitnexus_detect_changes` hoặc CLI tương đương để xác nhận chỉ hai file production dự kiến cùng tài liệu plan/spec bị ảnh hưởng. Nếu xuất hiện process/module ngoài scope, dừng và kiểm tra diff trước khi báo hoàn tất.

### Task 1: Simplify AutoFarmPanel and send the fixed policy

**Files:**

- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:15-165,199-316,447-486,546-673`

**Interfaces:**

- Consumes: `AutoFarmConfigDto`, `apiPost`, `apiPut`, `storedState.config`, `treeCellPlan`, `barnAnimalPlan`, `pondAnimalPlan` already used by the component.
- Produces: a local `ALWAYS_ON_AUTO_CONFIG` object whose keys match the existing `AutoFarmConfigDto` contract; `start()` and `savePlan()` include the fixed policy while preserving user-controlled fields and plans.

- [ ] **Step 1: Add the frontend policy constant next to the existing empty config constants**

Add one typed constant without changing the public DTO:

```ts
const ALWAYS_ON_AUTO_CONFIG = {
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
} satisfies Partial<AutoFarmConfigDto>;
```

Keep `AUTO_CONFIG_KEYS` unchanged so old API payloads remain readable.

- [ ] **Step 2: Remove state and hydration setters for controls that no longer exist**

Keep `seedId` state only as an internal fallback loaded from `config.seedId`; remove the state variables and setters for `waterItemId`, `grassItemId`, `wormItemId`, `harvest`, `harvestBarnAnimals`, `harvestPondAnimals`, `feedBarnAnimals`, `feedPondAnimals`, `healAnimals`, and `fertilizeCells`. In `hydrateForm`, retain `setSeedId(optionalId(config.seedId))` and the sell/limit/buy/timing setters; delete the hydration calls for the removed controls.

Do not remove the type guard fields or parser-compatible keys. They are still needed to accept persisted config and server responses.

- [ ] **Step 3: Remove the obsolete derived form object and preserve plan dirty tracking**

Delete the unused `currentConfig` `useMemo` and its dependency list. Leave `dirty`, `planKey`, `animalPlanKey`, `storedState`, conflict handling, and `onPlanDirtyChange` unchanged because they compare only the plan fields and do not depend on the removed controls.

- [ ] **Step 4: Apply policy to the Bật payload without changing sell/buy/timing behavior**

In `start()`, keep the legacy `seedId: num(seedId)` field for compatibility, spread the fixed policy, then keep the existing sell, buy and timing fields:

```ts
await apiPost(`/api/accounts/${expectedAccountId}/auto/start`, {
  seedId: num(seedId),
  ...ALWAYS_ON_AUTO_CONFIG,
  sellAnimals: sellBarnAnimals || sellPondAnimals,
  sellBarnAnimals,
  sellPondAnimals,
  sellBarnSpecies: idList(sellBarnSpeciesStr),
  sellPondSpecies: idList(sellPondSpeciesStr),
  sellWhenGrownSpecies: [...idList(sellBarnSpeciesStr), ...idList(sellPondSpeciesStr)],
  maxSellsPerCycle,
  autoBuy,
  buyBudgetXu,
  intervalMs: intervalSec * 1000,
  stepDelayMs,
});
```

Retain the existing reload-after-start and race guards exactly as they are.

- [ ] **Step 5: Persist the policy when saving a tree/animal plan**

Inside the existing `apiPut` body in `savePlan()`, merge the policy into the config that is sent to the server before replacing the three plan fields:

```ts
config: {
  ...storedState.config,
  ...ALWAYS_ON_AUTO_CONFIG,
  treeCellPlan: sortedPlan(draftPlan),
  barnAnimalPlan: sortedAnimalPlan(draftBarnPlan),
  pondAnimalPlan: sortedAnimalPlan(draftPondPlan),
},
```

Keep the existing revision/conflict response handling and the fallback for omitted empty animal plans. Do not add a second save request.

- [ ] **Step 6: Delete only the requested JSX controls**

Remove the entire crop `setting-section` from the return tree. In the barn section remove the first checkbox row containing harvest, feed and heal. In the pond section remove only the harvest and feed labels; leave the sell labels and species input in the same row. Do not remove either `AnimalPlanEditor`, `TreeCellPlanEditor`, status buttons, auto-buy, limits, logs or errors.

After this step, the component must contain no visible text matching these removed labels: `🌱 Cây trồng`, `thu hoạch ô đã chín`, `bón phân khi sức sống`, `thu hoạch sản phẩm chuồng`, `cho vật nuôi chuồng ăn`, `thuốc bổ khi máu`, `thu hoạch sản phẩm hồ`, or `cho cá/rùa ăn`.

### Task 2: Enforce the policy at the AutoFarm runtime boundary

**Files:**

- Modify: `avatar-web/server/src/autoFarm.ts:35-115,165-185,852-867`

**Interfaces:**

- Consumes: `Partial<AutoFarmConfig>` passed to `AutoFarm.start()` and `AutoFarm.queueConfig()`.
- Produces: `AutoFarmConfig` from `makeConfig()` with the fixed policy applied after arbitrary input.

- [ ] **Step 1: Define the server policy once and make it the default source**

Add the following constant before `DEFAULTS`:

```ts
const ALWAYS_ON_CONFIG = {
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
} as const satisfies Partial<AutoFarmConfig>;
```

Construct `DEFAULTS` with `...ALWAYS_ON_CONFIG`, then retain all existing sell, health, buy, timing and limit defaults. This changes only the default policy and does not alter the default-off sell/auto-buy safety behavior.

- [ ] **Step 2: Apply the policy after input in `makeConfig`**

Keep the existing normalization and plan validation, but place `...ALWAYS_ON_CONFIG` after `...input` so persisted or caller-provided `false`/different item IDs cannot override the policy:

```ts
const cfg: AutoFarmConfig = {
  ...DEFAULTS,
  ...input,
  ...ALWAYS_ON_CONFIG,
  sellWhenGrownSpecies: speciesList(input.sellWhenGrownSpecies, SPECIES_SELL_WHEN_GROWN),
  sellNearDeathSpecies: speciesList(input.sellNearDeathSpecies, SPECIES_SELL_NEAR_DEATH),
  treeCellPlan: validateTreeCellPlan(input.treeCellPlan),
};
```

Leave validation for `stepDelayMs`, `maxSellsPerCycle`, species lists and tree plans unchanged. `seedId` remains input-controlled for legacy fallback; the policy does not invent a seed.

- [ ] **Step 3: Update only nearby comments that describe the default policy**

Adjust the `AutoFarmConfig` comments for harvest/feed/heal/fertilize and item IDs so they state that these actions/IDs are fixed defaults and are not user toggles in the drawer. Do not change field names or optionality, because persisted config and the API parser still accept them.

### Task 3: Build, diff and browser verification

**Files:**

- Read/verify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Read/verify: `avatar-web/server/src/autoFarm.ts`
- Read/verify: `docs/superpowers/specs/2026-08-14-avatar-web-remove-always-on-settings-design.md`
- Read/verify: `docs/superpowers/plans/2026-08-14-avatar-web-remove-always-on-settings.md`

**Interfaces:**

- Consumes: production changes from Tasks 1–2 and the running local app at `http://localhost:5173/accounts/1`.
- Produces: fresh build evidence, clean whitespace check, scoped GitNexus change report and a visual smoke result.

- [ ] **Step 1: Run frontend and server builds**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/web
npm run build
cd /Users/devios/learning-reverse/avatar-web/server
npm run build
```

Expected: both commands exit 0. Do not infer runtime correctness from TypeScript alone.

- [ ] **Step 2: Inspect the exact diff and whitespace**

Run:

```bash
cd /Users/devios/learning-reverse
git diff --check
git diff -- avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx avatar-web/server/src/autoFarm.ts
git status --short
```

Expected: only the two production files plus the approved spec/plan are task changes; pre-existing `AGENTS.md`, `CLAUDE.md` and `.gitignore` changes remain untouched.

- [ ] **Step 3: Run fresh GitNexus change detection**

Run the GitNexus `detect_changes` operation with `scope: "all"` for repo `learning-reverse` after the code edits. Confirm affected symbols are limited to `AutoFarmPanel`, its local helpers, `AutoFarm.start`/`queueConfig` through `makeConfig`, and the expected auto-farm process. If the report includes unrelated modules, inspect and correct the diff before proceeding.

- [ ] **Step 4: Verify the visible drawer state**

Using the existing local app tab, open `http://localhost:5173/accounts/1` and inspect the Vận hành drawer. Confirm the crop section and all requested harvest/feed/heal labels are absent, while animal slot plans, tree-cell plan, sell controls, auto-buy, Bật/Tắt and logs remain visible. Capture a screenshot only if the browser verification surface provides one.

- [ ] **Step 5: Verify the fixed payload/runtime behavior**

Use the existing browser/network or local runtime seam without changing account data beyond the normal Bật action. Confirm a config containing `false` for the fixed fields cannot produce a disabled runtime, and missing item IDs resolve to `100/123/124`. Report any UI-only limitation separately from build evidence; do not claim full game-server execution without a real connected account.
