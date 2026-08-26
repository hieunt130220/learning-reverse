# AutoFarm Step Delay 300ms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm giá trị nghỉ mặc định giữa các bước AutoFarm từ `700ms` xuống `300ms` ở cả server và giao diện web.

**Architecture:** Giữ nguyên `AutoFarmConfig` và toàn bộ orchestration hiện tại, chỉ đổi hai nguồn giá trị mặc định đang điều khiển `stepDelayMs`. Server default và cấu hình cố định từ web phải cùng là `300` để không lệch hành vi giữa các đường khởi tạo/cập nhật.

**Tech Stack:** TypeScript 5.7, Node.js, React 18, Vite 6

**Spec:** `docs/superpowers/specs/2026-08-26-autofarm-step-delay-300ms-design.md`

## Global Constraints

- Không thay đổi cơ chế `sleep`, vị trí nghỉ hoặc thứ tự xử lý ô cây và vật nuôi.
- Không thay đổi `intervalMs`, `startDelayMs`, timeout protocol hoặc delay của tool thử nghiệm.
- Không sửa các giá trị `700` dùng làm timestamp fixture, CSS font weight, permission mode hoặc dữ liệu hex.
- Không thay đổi cấu trúc `AutoFarmConfig` hay API contract.
- Không migration cấu hình đã lưu và không ép client cũ dùng `300ms`.
- Không tạo hoặc sửa test file vì user không yêu cầu trực tiếp.
- Không dùng TDD; production code được sửa trước, sau đó chạy verification hiện có.
- Trước khi sửa từng symbol production, phải chạy GitNexus impact analysis và cảnh báo user nếu risk là HIGH hoặc CRITICAL.
- Trước khi commit, phải chạy `gitnexus_detect_changes({ scope: "all" })` và xác nhận mọi d=1 dependent đã được xử lý.

---

### Task 1: Đồng bộ nhịp AutoFarm mặc định thành 300ms

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:253-270`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:58-64`
- Test: Không tạo hoặc sửa test file; chạy typecheck/build và test hiện có sau production code.

**Interfaces:**
- Consumes: `AutoFarmConfig.stepDelayMs: number` và `AutoFarmConfigDto.stepDelayMs: number` hiện có.
- Produces: `DEFAULTS.stepDelayMs === 300` phía server và `FIXED_AUTO_CONFIG.stepDelayMs === 300` phía web; không tạo interface hoặc symbol mới.

- [ ] **Step 1: Phân tích blast radius của hai symbol trước khi sửa**

Chạy:

```text
gitnexus_impact({
  target: "DEFAULTS",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["ACCESSES", "IMPORTS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})

gitnexus_impact({
  target: "FIXED_AUTO_CONFIG",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["ACCESSES", "IMPORTS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})
```

Expected: Xác định các consumer của hai object cấu hình. Nếu một kết quả là HIGH hoặc CRITICAL, dừng và cảnh báo user trước khi sửa; nếu LOW/MEDIUM, báo tóm tắt blast radius rồi tiếp tục.

- [ ] **Step 2: Đổi server default thành 300ms**

Trong `avatar-web/server/src/autoFarm.ts`, thay đúng thuộc tính trong `DEFAULTS`:

```ts
  stepDelayMs: 300,
```

Không thay đổi `intervalMs: DEFAULT_AUTO_INTERVAL_MS`, `startDelayMs: 3_000` hoặc các thuộc tính khác.

- [ ] **Step 3: Đổi cấu hình cố định của web thành 300ms**

Trong `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`, thay đúng thuộc tính trong `FIXED_AUTO_CONFIG`:

```ts
  stepDelayMs: 300,
```

Không thay đổi `maxSellsPerCycle`, `autoBuy`, `buyBudgetXu` hoặc `intervalMs`.

- [ ] **Step 4: Kiểm tra không còn default production bị lệch**

Run:

```bash
rg -n 'stepDelayMs:\s*700' avatar-web/server/src avatar-web/web/src
```

Expected: Không có kết quả trong production source. Các fixture test có thể còn `700` vì task này không sửa test file.

Run:

```bash
rg -n 'stepDelayMs:\s*300' avatar-web/server/src/autoFarm.ts avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
```

Expected: Có đúng hai kết quả, một tại `DEFAULTS` và một tại `FIXED_AUTO_CONFIG`.

- [ ] **Step 5: Chạy typecheck/build cho server và web**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/web run build
```

Expected: Cả hai lệnh exit code `0`; server TypeScript không báo lỗi và web hoàn tất `tsc -b && vite build`.

- [ ] **Step 6: Chạy test hiện có liên quan**

Run:

```bash
npm --prefix avatar-web/server test -- src/autoFarm.test.ts
npm --prefix avatar-web/web test -- src/accounts/panels/AutoFarmPanel.test.tsx
```

Expected: Các test hiện có pass. Nếu fixture đang khẳng định trực tiếp default cũ `700`, báo rõ conflict với yêu cầu “không sửa test” thay vì tự ý sửa test file.

- [ ] **Step 7: Kiểm tra phạm vi thay đổi bằng GitNexus**

Chạy:

```text
gitnexus_detect_changes({
  scope: "all",
  base_ref: "main",
  repo: "learning-reverse"
})
```

Expected: Hai symbol production bị ảnh hưởng là `DEFAULTS` và `FIXED_AUTO_CONFIG`; không có execution flow hoặc d=1 dependent ngoài phạm vi dự kiến chưa được xử lý. Lưu ý working tree đã có thay đổi từ trước, vì vậy phải phân biệt thay đổi của task này với `AGENTS.md`, `CLAUDE.md` và spec APK care-all-crops đang tồn tại.

- [ ] **Step 8: Commit**

Chỉ thực hiện khi user đã cho phép commit. Không stage các thay đổi có sẵn không thuộc task.

```bash
git add \
  docs/superpowers/specs/2026-08-26-autofarm-step-delay-300ms-design.md \
  docs/superpowers/plans/2026-08-26-autofarm-step-delay-300ms.md \
  avatar-web/server/src/autoFarm.ts \
  avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx
git commit -m "perf: giảm nhịp nghỉ AutoFarm xuống 300ms

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: Commit chỉ chứa hai tài liệu của task và hai file production nêu trên; không chứa `AGENTS.md`, `CLAUDE.md` hoặc `docs/superpowers/specs/2026-08-26-apk-care-all-crops-design.md`.
