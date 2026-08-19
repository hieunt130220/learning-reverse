# Auto Replant Spent Cell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trồng lại ô vừa thu hoạch theo kế hoạch trong cùng hoặc vòng auto kế tiếp.

**Architecture:** Dùng tín hiệu `isCellSpent` đã có của farm decoder cùng với trạng thái ô rỗng trong giai đoạn planting của `AutoFarm`.

**Tech Stack:** TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-19-auto-replant-spent-cell-design.md`

## Global Constraints

- Không đổi giao thức farm hoặc cấu hình kế hoạch.
- Không tạo test mới nếu người dùng không yêu cầu.

### Task 1: Cho phép planting ô vừa thu hoạch

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts`

**Interfaces:**
- Consumes: `isCellSpent`, `treeCellPlan`.
- Produces: `plantSeed` được gọi cho ô có `time=-1`.

- [x] **Step 1: Update planting guard**
  Dùng `c.idTree === -1 || isCellSpent(c)`.

- [ ] **Step 2: Verify**
  Run: `npm test -- --test-name-pattern='thu hoạch|trồng|kế hoạch'`
  Expected: focused cases pass.

- [ ] **Step 3: Diff checks**
  Run: `git diff --check` và GitNexus detect changes.
