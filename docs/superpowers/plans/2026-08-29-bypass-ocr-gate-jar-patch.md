# Bypass Toàn Bộ OCR Gate & Sửa Logic Jump Trong `fJ.class` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bypass hoàn toàn kiểm tra OCR server gate (`az.do:B`) và sửa logic jump trong `fJ.class` để avatar-auto.jar luôn gửi request giải captcha về solver server.

**Architecture:** Sửa `tools/jar/patch_jar.py` để patch bytecode `fJ.class`: (1) NOP 9 bytes kiểm tra `az.do:B`, (2) gán `var5=1, var6=1`, (3) giữ nguyên `ifeq` (0x99) nhảy tới khối OCR, (4) append Methodref và gọi trực tiếp `az.if()` thay vì lưu worker chờ screen tick. Đóng gói lại `avatar-auto-patched.jar`.

**Tech Stack:** Python 3, bytecode patching, `zipfile`.

**Spec:** `docs/superpowers/specs/2026-08-29-bypass-ocr-gate-jar-patch-design.md`

## Global Constraints
- Giữ nguyên ZIP create_system = 0 (MS-DOS) để tương thích MicroEmulator.
- Không sửa code `solver_server.py`.
- Tuân thủ quy trình GitNexus.

---

### Task 1: Sửa `patch_fj_bytecode()` trong `tools/jar/patch_jar.py`

**Files:**
- Modify: `tools/jar/patch_jar.py:90-136`

- [x] **Step 1: Cập nhật hàm `patch_fj_bytecode()`**

Thay thế logic cũ (bị lỗi `ifeq -> ifne`) bằng:
1. Đổi `iconst_1` (0x04) thành `iconst_2` (0x05) cho cả `var5` (offset +9) và `var6` (offset +16).
2. NOP 9 bytes của `az.do:B` check (offset +20 đến +28: `b2 00 c4 b8 01 df 99 00 3d` -> `00` * 9).
3. Không đổi `ifeq` thành `ifne` (giữ nguyên `0x99` cho target 19088).
4. Append `Methodref az.if:()V`, thay holder/wakeup bằng `invokevirtual az.if()` + 3 NOP ở cả nhánh `al` và `bS`.

- [x] **Step 2: Chạy `patch_jar.py` để tạo `avatar-auto-patched.jar`**

Run: `python3 tools/jar/patch_jar.py`
Expected: In ra các bước patch thành công và tạo file `avatar-jar/avatar-auto-patched.jar`.

- [x] **Step 3: Verify bytecode của `avatar-auto-patched.jar`**

Run: `javap -c -p -v /tmp/fJ-direct.class`
Expected: `#1209 = Methodref az.if:()V`; offset `7331` và `7357` là `invokevirtual #1209`; ba byte sau mỗi call là `nop`.

---

### Task 2: Cập nhật tài liệu & verification

**Files:**
- Modify: `docs/protocol/az-ocr-notes.md`

- [x] **Step 1: Cập nhật `az-ocr-notes.md`** ghi nhận fix bypass `az.do:B`, sửa logic `ifeq`, và direct invocation.
- [x] **Step 2: Chạy verification tập trung**: Python patch thành công, `javap` parse sạch, JAR khởi động không `VerifyError`, solver health `ok`.
