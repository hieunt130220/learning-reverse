# Captcha Auto-Solver Integration (avatar-auto.jar patch) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch `avatar-auto.jar` để khi gặp captcha, JAR tự gọi solver API local lấy 4 chữ số rồi điền gửi về game.

**Architecture:** Tận dụng luồng OCR sẵn có của `az.class` (POST bitmap → OCR ngoài → đáp án). Viết `solver_server.py` mimic đúng format request/response của OCR gốc, sau đó chỉ patch string URL trong bytecode JAR trỏ về `127.0.0.1:8643`. Không đụng logic nào khác.

**Tech Stack:** Python stdlib (http.server) + PyTorch (checkpoint round 1); Java 17 (chạy sẵn) + CFR decompiler; Python zipfile để patch/repack JAR.

**Spec:** `docs/superpowers/specs/2026-08-28-captcha-autosolver-integration-design.md`

## Global Constraints
- J2ME case-sensitivity: trích class bằng `ZipFile.read()`, KHÔNG unzip trực tiếp (handoff doc §2).
- `avatar-auto.jar` gốc phải giữ nguyên vẹn; mọi patch xuất ra `avatar-jar/avatar-auto-patched.jar`.
- Solver server chỉ dùng Python stdlib + existing deps (torch, PIL, numpy) — không thêm framework.
- Format response mimic OCR phải đối chiếu trực tiếp với bytecode `az.class`, không suy đoán.
- Java 17 có sẵn tại `/usr/bin/java`; CFR cần tải về `tools/jar/cfr.jar`.

---

### Task 1: Decompile `az.class` — chốt URL + format request/response

**Files:**
- Create: `tools/jar/extract_classes.py` (trích class an toàn)
- Create: `docs/protocol/az-ocr-notes.md` (kết quả reverse)

**Interfaces:**
- Produces: URL OCR gốc + format request (tên trường form) + format response (byte status + thứ tự UTF) — đầu vào bắt buộc của Task 3, 4.

- [ ] **Step 1: Tải CFR decompiler**
  Run: `curl -L -o tools/jar/cfr.jar https://github.com/leibnitz27/cfr/releases/download/0.152/cfr-0.152.jar`
  Expected: file ~2MB, `java -jar tools/jar/cfr.jar --version` chạy được.

- [ ] **Step 2: Trích `az.class`, `br.class`, `cU.class`, `fJ.class` an toàn (tên file có hậu tố hash tránh va chạm hoa/thường)**
  Script `extract_classes.py` dùng `ZipFile('avatar-jar/avatar-auto.jar').read(name)` ghi ra `tools/jar/out/az_<hash8>.class`.
  Run: `../.venv-captcha312/bin/python tools/jar/extract_classes.py`
  Expected: 4 file .class trong `tools/jar/out/`.

- [ ] **Step 3: Decompile + phân tích**
  Run: `java -jar tools/jar/cfr.jar tools/jar/out/az_*.class --outputdir tools/jar/out/decompiled`
  Expected: có source Java. Đọc và chốt:
  1. URL OCR: string constant trong `az.class`? default trong `br.class`? động từ `cU.class`?
  2. Request: method, Content-Type, tên trường form, encoding bitmap.
  3. Response: byte status nghĩa gì (giá trị nào = success), thứ tự/tên các trường UTF, có checksum không.

- [ ] **Step 4: Ghi kết quả vào `docs/protocol/az-ocr-notes.md`**
  Nội dung bắt buộc: URL gốc (hoặc cơ chế cấu hình), schema request, schema response (byte-level), quyết định điểm patch.

- [ ] **Step 5: Commit**
  `git commit -m "docs(jar): reverse az.class - url + format request/response OCR"`

### Task 2: Expose `predict_array()` dùng chung

**Files:**
- Modify: `captcha-solver/src/predict.py`

**Interfaces:**
- Produces: `predict_array(arr: np.ndarray, model, charset) -> tuple[str, float]` — (digits, confidence = mean per-char prob).
- Consumes: `CharSet.from_serialized`, `CaptchaCRNN`, `load_alpha_binary`, `remove_isolated_noise`.

- [ ] **Step 1: Refactor predict.py** — tách hàm nhận mảng binary (1,15,100) đã denoise; CLI cũ gọi lại hàm này. Load model/charset từ checkpoint (key `charset` đã lưu trong .pt).
- [ ] **Step 2: Verify** — chạy predict CLI trên 1 ảnh có nhãn: digits khớp nhãn.
  Run: `cd captcha-solver && ../.venv-captcha312/bin/python -m src.predict --image ../avatar-web/server/captcha-dataset/captcha-20260827-213938-641-46f9e1-j2me.png --ckpt checkpoints/crnn_ctc.pt`
  Expected: `1192`.

### Task 3: `solver_server.py` — HTTP service (mimic OCR + /solve)

**Files:**
- Create: `captcha-solver/solver_server.py`
- Modify: `captcha-solver/README.md` (cách chạy)

**Interfaces:**
- Consumes: `predict_array()` (Task 2), format OCR (Task 1).
- Produces:
  - `POST /solve` JSON `{"imageBase64"}` → `{"digits","confidence"}`
  - `POST /` form URL-encoded theo format az.class → byte-status + UTF response giống OCR gốc

- [ ] **Step 1: Viết server** — `ThreadingHTTPServer` (mẫu như `label_tool.py`), load model 1 lần khi boot, port 8643. Parse bitmap payload từ form-encoded theo đúng schema Task 1 → dựng mảng binary → predict → trả response byte-level mimic.
- [ ] **Step 2: Smoke test /solve** — POST base64 của 5 ảnh có nhãn → digits khớp ≥ 4/5.
  Run: `curl -s -X POST localhost:8643/solve -H 'Content-Type: application/json' -d "{\"imageBase64\":\"$(base64 -i <png>)\"}"`
- [ ] **Step 3: Smoke test mimic OCR** — dựng request giả theo schema Task 1 → đối chiếu response byte-level với kỳ vọng từ bytecode.
- [ ] **Step 4: Commit**
  `git commit -m "feat(jar-integration): solver_server mimic OCR format + /solve endpoint"`

### Task 4: `patch_jar.py` — patch URL + repack

**Files:**
- Create: `tools/jar/patch_jar.py`
- Output: `avatar-jar/avatar-auto-patched.jar`

**Interfaces:**
- Consumes: URL gốc + URL mới (Task 1, 3).
- Produces: JAR đã patch, mọi entry khác giữ nguyên byte-for-byte.

- [ ] **Step 1: Viết patcher** — đọc `avatar-auto.jar` bằng `ZipFile`, với mỗi entry: nếu là class chứa URL target → tìm byte pattern của URL string constant (Java modified-UTF8: 2-byte length prefix + chars) → thay bằng URL mới. Ưu tiên URL mới pad cho bằng độ dài cũ để không đụng length prefix; nếu buộc đổi độ dài thì parse constant pool và cập nhật length prefix đúng chuẩn. Các entry khác ghi nguyên xi; giữ META-INF/MANIFEST.MF.
- [ ] **Step 2: Verify patch** — extract class từ patched jar, grep URL mới; decompile lại xác nhận chỉ URL đổi.
  Run: `../.venv-captcha312/bin/python tools/jar/patch_jar.py --in avatar-jar/avatar-auto.jar --out avatar-jar/avatar-auto-patched.jar`
  Expected: patched jar tạo thành công, đúng số entry như gốc.
- [ ] **Step 3: Chạy JAR patched trong emulator** (cần user phối hợp) — captcha thật: solver log nhận request từ JAR → trả digits → JAR điền.
- [ ] **Step 4: E2E live** — server game accept đáp án (xác minh cuối, chưa từng pass trước đây).
- [ ] **Step 5: Commit**
  `git commit -m "feat(jar-integration): patch_jar.py - redirect OCR URL tới solver local"`

## Rollback
- `avatar-auto.jar` gốc không bao giờ bị ghi đè. Xóa `avatar-auto-patched.jar` = rollback hoàn toàn.
- Solver server chết → OCR của JAR fail như lúc OCR ngoài chết — không hỏng thêm gì.
