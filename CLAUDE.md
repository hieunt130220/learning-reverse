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

This project is indexed by GitNexus as **learning-reverse** (15932 symbols, 58141 relationships, 560 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/learning-reverse/context` | Codebase overview, check index freshness |
| `gitnexus://repo/learning-reverse/clusters` | All functional areas |
| `gitnexus://repo/learning-reverse/processes` | All execution flows |
| `gitnexus://repo/learning-reverse/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
