# Master Kitchen Mission Recipe Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chọn món đầu tiên có thể nấu trong toàn bộ nhiệm vụ mở bếp Master chưa hoàn thành, thay vì dừng ở nhiệm vụ chưa hoàn thành đầu tiên.

**Architecture:** Giữ nguyên cooking phase và toàn bộ thứ tự ưu tiên hiện tại, nhưng thêm predicate cục bộ kiểm tra nguyên liệu rồi dùng nó trong vòng lặp scan `cookState.missions`. Guard nguyên liệu chung, phép trừ nguyên liệu ảo, Cmd 91 và các fallback ngoài mission không thay đổi.

**Tech Stack:** TypeScript 5.7, Node.js 22, GitNexus MCP, Node test runner hiện có

**Spec:** `docs/superpowers/specs/2026-08-26-master-kitchen-mission-recipe-selection-design.md`

## Global Constraints

- Chỉ sửa production logic trong `avatar-web/server/src/autoFarm.ts`; không đổi UI, REST API, WebSocket, config, protocol hoặc data contracts.
- Giữ thứ tự ưu tiên: kế hoạch món riêng của ô → nhiệm vụ Master đầu tiên đủ nguyên liệu → `defaultRecipeId` → món đầu catalog khi `autoCook` bật.
- Scan mission theo đúng thứ tự `cookState.missions` do server cung cấp; không sắp xếp hoặc tối ưu lại.
- Mission chỉ còn thiếu khi `!mission.isDone && mission.numCook < mission.numNeed`.
- Mission không có recipe trong catalog hoặc recipe thiếu nguyên liệu phải bị bỏ qua để scan tiếp.
- Giữ guard nguyên liệu chung và phép trừ `availableMaterials` sau khi chọn món.
- Không thêm log cho từng mission bị bỏ qua.
- Không tạo hoặc sửa test file vì user không yêu cầu viết test; production code phải được viết trước mọi verification.
- Trước khi sửa `AutoFarm.runCycle`, bắt buộc chạy GitNexus impact analysis và cảnh báo user nếu mức rủi ro HIGH hoặc CRITICAL.
- Trước commit, bắt buộc chạy `gitnexus_detect_changes({ scope: "all" })`; chỉ commit khi user yêu cầu.

---

### Task 1: Scan mọi món nhiệm vụ Master có thể nấu

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1204-1282`
- Test: Không tạo test mới; chạy typecheck, build và bộ test server hiện có sau production code

**Interfaces:**
- Consumes: `FoodRecipe`, `cookState.missions`, `foodCatalog`, `availableMaterials: Map<number, number>`, `cfg.prioritizeCookingMissions`
- Produces: `targetRecipe: FoodRecipe | undefined` được chọn từ mission chưa hoàn thành đầu tiên có recipe hợp lệ và đủ nguyên liệu; không tạo export hoặc data contract mới

- [x] **Step 1: Đọc lại spec và xác nhận working tree**

Run:

```bash
git status --short
git diff -- docs/superpowers/specs/2026-08-26-master-kitchen-mission-recipe-selection-design.md avatar-web/server/src/autoFarm.ts
```

Expected:

- Spec đúng với file ghi trong header.
- `avatar-web/server/src/autoFarm.ts` không có thay đổi chưa liên quan cần ghi đè.
- Giữ nguyên file untracked hoặc thay đổi khác của user.

- [x] **Step 2: Phân tích blast radius trước khi sửa symbol**

Run GitNexus MCP:

```text
gitnexus_impact({
  target: "AutoFarm.runCycle",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["CALLS", "IMPORTS"],
  includeTests: false,
  minConfidence: 0.7,
  repo: "learning-reverse"
})
```

Expected:

- Ghi nhận risk level, direct callers và affected processes.
- Nếu risk là HIGH hoặc CRITICAL, báo user và chờ xác nhận trước Step 3.
- Nếu GitNexus không resolve member-qualified name, chạy lại với `target: "runCycle"` và file context `avatar-web/server/src/autoFarm.ts` khi đọc kết quả.

- [x] **Step 3: Thêm predicate kiểm tra nguyên liệu dùng khi scan mission**

Trong `avatar-web/server/src/autoFarm.ts`, ngay sau khi dựng `availableMaterials` và trước vòng lặp `for (const slot of cookState.slots)`, thêm:

```ts
const hasMaterials = (recipe: FoodRecipe): boolean =>
  recipe.materials.every(
    (material) => (availableMaterials.get(material.itemId) ?? 0) >= material.count,
  );
```

Predicate phải đọc trực tiếp `availableMaterials`, để mỗi ô sau tự động thấy số lượng đã bị trừ bởi các ô trước.

- [x] **Step 4: Thay lựa chọn mission đầu tiên bằng scan toàn bộ mission có thể nấu**

Thay block hiện tại:

```ts
if (!targetRecipe && cfg.prioritizeCookingMissions && cookState.missions.length > 0) {
  const pendingMission = cookState.missions.find((m) => !m.isDone && m.numCook < m.numNeed);
  if (pendingMission) {
    targetRecipe = foodCatalog.find((f) => f.id === pendingMission.idFood);
  }
}
```

bằng:

```ts
if (!targetRecipe && cfg.prioritizeCookingMissions && cookState.missions.length > 0) {
  for (const mission of cookState.missions) {
    if (mission.isDone || mission.numCook >= mission.numNeed) continue;

    const recipe = foodCatalog.find((food) => food.id === mission.idFood);
    if (!recipe || !hasMaterials(recipe)) continue;

    targetRecipe = recipe;
    break;
  }
}
```

Không thay đổi các block kế tiếp cho `defaultRecipeId`, `cfg.autoCook`, guard `canCook`, phép trừ nguyên liệu ảo hoặc `farm.cook(...)`.

- [x] **Step 5: Rà soát code path theo các edge case trong spec**

Đọc block cooking đã sửa và xác nhận trực tiếp:

```text
A thiếu nguyên liệu, B đủ       -> vòng for bỏ A và chọn B
A không có recipe, B đủ        -> vòng for bỏ A và chọn B
A và B đều đủ                  -> break sau A
mission đã hoàn thành          -> continue
plan món riêng tìm thấy        -> không vào nhánh mission
không mission nào đủ           -> chạy defaultRecipeId rồi autoCook fallback
ô trước đã trừ nguyên liệu     -> hasMaterials đọc Map mới khi xử lý ô sau
```

Expected: không có thay đổi về thứ tự fallback, logging hoặc packet send.

- [x] **Step 6: Chạy TypeScript typecheck sau production code**

Run:

```bash
npm --prefix avatar-web/server run typecheck
```

Expected: exit code 0, không có TypeScript error.

- [x] **Step 7: Chạy server build**

Run:

```bash
npm --prefix avatar-web/server run build
```

Expected: exit code 0; TypeScript compile thành công và `schema.sql` được copy vào dist.

- [x] **Step 8: Chạy bộ test server hiện có**

Run:

```bash
npm --prefix avatar-web/server test
```

Expected: tất cả test hiện có pass; không tạo hoặc sửa test file.

- [x] **Step 9: Kiểm tra phạm vi thay đổi bằng GitNexus**

Run GitNexus MCP:

```text
gitnexus_detect_changes({
  scope: "all",
  base_ref: "main",
  repo: "learning-reverse"
})
```

Expected:

- Changed production symbol là `AutoFarm.runCycle` trong `avatar-web/server/src/autoFarm.ts`.
- Affected flow chỉ thuộc Auto Farm/cooking execution path dự kiến.
- Không có UI, API route, protocol serializer hoặc data contract ngoài phạm vi bị thay đổi.

- [x] **Step 10: Kiểm tra diff cuối và cập nhật checkbox plan**

Run:

```bash
git diff --check
git diff -- avatar-web/server/src/autoFarm.ts docs/superpowers/specs/2026-08-26-master-kitchen-mission-recipe-selection-design.md docs/superpowers/plans/2026-08-26-master-kitchen-mission-recipe-selection.md
```

Expected:

- `git diff --check` không báo whitespace error.
- Diff production chỉ chứa predicate `hasMaterials` và vòng scan mission đã mô tả.
- Đánh dấu `- [x]` cho từng step hoàn thành; nếu verification nào thất bại, giữ step đó ở `- [ ]` và ghi kết quả thực tế bên dưới step.

- [ ] **Step 11: Commit chỉ khi user yêu cầu**

Sau khi `gitnexus_detect_changes` và toàn bộ verification pass, nếu user yêu cầu commit:

```bash
git add avatar-web/server/src/autoFarm.ts \
  docs/superpowers/specs/2026-08-26-master-kitchen-mission-recipe-selection-design.md \
  docs/superpowers/plans/2026-08-26-master-kitchen-mission-recipe-selection.md
git commit -m "fix: chọn món nhiệm vụ bếp có thể nấu

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: commit thành công và chỉ chứa ba file nêu trên.
