# Development Workflow

## Quy trình bắt buộc: Spec → Plan → Production Code

Tất cả AI agent làm việc trên project này PHẢI tuân thủ nghiêm ngặt quy trình 3 bước theo chuẩn **Superpowers**:

### 1. Bước 1: Tạo Spec (Design Document)
- **Bắt buộc tạo file**: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- **Nội dung chuẩn Superpowers**:
  - **Mục tiêu & Bối cảnh**: Vấn đề cần giải quyết, lý do thay đổi.
  - **Phạm vi (Scope)**: Xác định rõ ranh giới in-scope và out-of-scope, input/output, edge cases.
  - **Thiết kế kiến trúc & Giải pháp kỹ thuật**:
    - Danh sách files/modules liên quan và vai trò từng file.
    - Interfaces, data contracts, flow xử lý, diagram (nếu cần).
  - **Verification Plan**: Cách thức kiểm tra thủ công hoặc automated sau khi code xong.
- **User Review Gate**: Trình bày thiết kế và chờ user duyệt (approve) file Spec trước khi chuyển sang bước viết Plan.

### 2. Bước 2: Tạo Plan (Implementation Plan)
- **Bắt buộc tạo file**: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
- **Cấu trúc chuẩn Superpowers**:
  - **Header bắt buộc**:
    ```markdown
    # [Feature Name] Implementation Plan

    > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

    **Goal:** [Mô tả mục tiêu trong 1 câu]

    **Architecture:** [Mô tả hướng tiếp cận trong 2-3 câu]

    **Tech Stack:** [Các công nghệ / thư viện chính]

    **Spec:** `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`

    ## Global Constraints
    [Các ràng buộc toàn cục từ spec: phiên bản, convention, platform, safety guards...]
    ```
  - **Phân rã Tasks chi tiết (Bite-sized Tasks)**:
    - Cấu trúc từng task:
      ```markdown
      ### Task N: [Tên Component/Tính năng]

      **Files:**
      - Create: `đường/dẫn/tới/file_moi.ts`
      - Modify: `đường/dẫn/tới/file_hien_tai.ts:12-45`
      - Test: `đường/dẫn/tới/file.test.ts` (chỉ khi user yêu cầu viết test)

      **Interfaces:**
      - Consumes: [Hàm/type/dữ liệu cần dùng từ các task trước]
      - Produces: [Hàm/type/dữ liệu cung cấp cho các task sau]

      - [ ] **Step 1: [Hành động cụ thể]**
      [Code snippet hoặc nội dung chi tiết cần viết/sửa]

      - [ ] **Step 2: [Kiểm tra/Verify]**
      Run: `lệnh kiểm tra nếu có`
      Expected: `kết quả mong đợi`

      - [ ] **Step 3: Commit**
      `git commit -m "feat/fix: ..."`
      ```
    - **Nguyên tắc No Placeholders**: Không dùng `TODO`, `TBD`, `implement later`, không mô tả mơ hồ không có code/hướng dẫn cụ thể.
- **User Review Gate**: Trình bày file Plan và chờ user duyệt trước khi thực thi code.

### 3. Bước 3: Implement (Thực thi Production Code)
- Thực thi theo từng task trong plan, tích chọn checkbox `- [x]` sau mỗi bước.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).

## KHÔNG thực hiện TDD

- **KHÔNG viết test trước khi viết code** (no test-first, no red-green-refactor)
- **KHÔNG tạo test files** trừ khi user yêu cầu rõ ràng
- **KHÔNG dùng TDD workflow** — bỏ qua skill `test-driven-development`, đi thẳng vào production code
- Chỉ viết test khi user **yêu cầu trực tiếp**, và viết **sau khi** code production hoàn thành

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **learning-reverse** (12459 symbols, 29527 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/learning-reverse/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/learning-reverse/context` | Codebase overview, check index freshness |
| `gitnexus://repo/learning-reverse/clusters` | All functional areas |
| `gitnexus://repo/learning-reverse/processes` | All execution flows |
| `gitnexus://repo/learning-reverse/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
