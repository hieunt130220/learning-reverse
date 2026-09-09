# Deploy Shell Syntax Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore valid Bash syntax in the production SSH deployment workflow so deployment proceeds to starting the Fishing ML service.

**Architecture:** Remove the orphaned dependency-check fragment left by commit `05ef605` and preserve the existing install, PM2 startup, and health-check flow. Verify both the workflow YAML and the exact remote heredoc script statically before any production rerun.

**Tech Stack:** GitHub Actions YAML, Bash, Ruby standard-library YAML parser, GitNexus CLI

**Spec:** `docs/superpowers/specs/2026-09-09-deploy-shell-syntax-fix-design.md`

## Global Constraints

- Do not change Python dependencies, package versions, PM2 configuration, health-check policy, Captcha Solver, backend, frontend, or VPS configuration.
- Do not add test files; production code must be changed before verification, per repository policy.
- Keep `"$FISHING_VENV/bin/python" -m pip install -e "$FISHING_ROOT"` as the dependency installation gate protected by the remote script's `set -euo pipefail`.
- Do not trigger production deployment as part of local implementation.
- Run GitNexus impact analysis before editing and GitNexus change detection before committing.
- Preserve unrelated existing modifications in `AGENTS.md` and `CLAUDE.md`.

---

### Task 1: Remove the orphaned dependency-check fragment

**Files:**
- Modify: `.github/workflows/deploy.yml:196-198`
- Modify: `docs/superpowers/plans/2026-09-09-deploy-shell-syntax-fix.md`

**Interfaces:**
- Consumes: Successful exit from `"$FISHING_VENV/bin/python" -m pip install -e "$FISHING_ROOT"` and the remote Bash script's `set -euo pipefail` behavior.
- Produces: A syntactically valid continuation from package installation to `cd "$FISHING_ROOT"`, followed by the unchanged PM2 startup and health-check sequence.

- [x] **Step 1: Run pre-edit GitNexus impact analysis**

Run:

```bash
npx gitnexus impact deploy --repo learning-reverse --file .github/workflows/deploy.yml --direction upstream
```

Expected: GitNexus reports the deployment workflow's available callers/processes or reports that no indexed symbol named `deploy` exists because the target is declarative YAML. If risk is HIGH or CRITICAL, stop and warn the user before editing. Otherwise record the reported risk and continue; the static verification below is authoritative for this YAML-only change.

- [x] **Step 2: Delete the incomplete command**

In `.github/workflows/deploy.yml`, replace:

```bash
            # Validate dependencies before starting service
            echo "✅ Kiểm tra dependencies..."
            "$FISHING_VENV/bin/python" -c "

            cd "$FISHING_ROOT"
```

with:

```bash
            cd "$FISHING_ROOT"
```

Do not alter adjacent installation or PM2 commands.

- [x] **Step 3: Mark completed implementation steps in this plan**

Change the checkboxes for Steps 1-3 from `- [ ]` to `- [x]` after the production edit is applied.

- [x] **Step 4: Parse the workflow YAML**

Run:

```bash
ruby -e 'require "yaml"; YAML.parse_file(".github/workflows/deploy.yml"); puts "YAML syntax OK"'
```

Expected: exit code `0` and output `YAML syntax OK`.

- [x] **Step 5: Validate the remote Bash heredoc**

Run:

```bash
set -o pipefail
awk '/<< '\''EOF'\''/{capture=1; next} /^[[:space:]]*EOF$/{capture=0} capture{sub(/^ {12}/, ""); print}' .github/workflows/deploy.yml | bash -n
```

Expected: exit code `0` with no Bash syntax error.

- [x] **Step 6: Confirm the intended diff and GitNexus change scope**

Run:

```bash
git diff --check
git diff -- .github/workflows/deploy.yml docs/superpowers/specs/2026-09-09-deploy-shell-syntax-fix-design.md docs/superpowers/plans/2026-09-09-deploy-shell-syntax-fix.md
npx gitnexus detect-changes --repo learning-reverse
```

Expected: `git diff --check` exits `0`; the workflow diff only removes the three orphaned lines; documentation changes contain only the approved spec, this plan, and checkbox updates; GitNexus reports no unexpected affected symbols or execution flows.

- [x] **Step 7: Mark verification steps complete**

Change the checkboxes for Steps 4-7 from `- [ ]` to `- [x]` after every verification command passes. Re-run `git diff --check` after the checkbox edit and expect exit code `0`.

- [x] **Step 8: Commit the scoped fix**

Run:

```bash
git add .github/workflows/deploy.yml docs/superpowers/specs/2026-09-09-deploy-shell-syntax-fix-design.md docs/superpowers/plans/2026-09-09-deploy-shell-syntax-fix.md
git diff --cached --check
git commit -m "fix(deploy): remove orphaned dependency check command"
```

Expected: staged diff excludes unrelated `AGENTS.md` and `CLAUDE.md` modifications; `git diff --cached --check` exits `0`; commit succeeds with the three scoped files.

- [x] **Step 9: Refresh GitNexus after the commit**

Because `.gitnexus/meta.json` reports `stats.embeddings: 0`, run:

```bash
npx gitnexus analyze
npx gitnexus status
```

Expected: analysis completes successfully and status reports the new commit as current with an up-to-date index.

- [x] **Step 10: Report the production verification handoff**

Report the commit hash and local verification results. Ask the user to push/merge the commit and rerun `Deploy to Production VPS`; expected production evidence is that the workflow passes the former Bash parse point and reaches `⏳ Đang khởi động Fishing ML service...`.
