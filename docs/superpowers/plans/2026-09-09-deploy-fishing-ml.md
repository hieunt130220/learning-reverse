# Triển Khai Dịch Vụ AI Câu Cá (fishing-ml) Lên Môi Trường Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp tự động hóa quy trình cài đặt, quản lý daemon qua PM2 và kiểm tra sức khỏe của dịch vụ AI câu cá (`fishing-ml`) vào pipeline GitHub Actions deploy lên máy chủ VPS.

**Architecture:** Mở đường cho Git track trực tiếp mô hình frozen sản xuất (~2.9MB). Cung cấp entrypoint `run_service.py` cùng endpoint `GET /health` trong `inference_service.py`. Cập nhật kịch bản SSH deploy trong `.github/workflows/deploy.yml` để tự động tạo môi trường Python CPU-only, quản lý tiến trình PM2 độc lập và kiểm tra tính sẵn sàng trước khi nạp Backend.

**Tech Stack:** GitHub Actions, Bash, PM2, Python 3 (Virtualenv), PyTorch CPU (`https://download.pytorch.org/whl/cpu`), Node.js.

**Spec:** `docs/superpowers/specs/2026-09-09-deploy-fishing-ml-design.md`

## Global Constraints
- Tuân thủ quy định **KHÔNG thực hiện TDD** (không viết test trước, đi thẳng vào production code).
- Bắt buộc chạy `gitnexus_impact` trước khi sửa symbol code và `gitnexus_detect_changes` trước khi hoàn tất.
- Cài đặt PyTorch CPU-only trên VPS `e2-micro` (1GB RAM) để tránh OOM / tràn ổ đĩa.
- Giữ nguyên các hợp đồng dữ liệu wire contract (`InferenceRequest`, `InferenceResponse`).
- Không có bất kỳ placeholder nào (`TODO`, `TBD`, `implement later`).

---

### Task 1: Cấu hình Git Tracking cho Production Frozen Model Artifact

**Files:**
- Modify: `.gitignore:32-44`

**Interfaces:**
- Consumes: Thư mục `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/`
- Produces: Git cho phép theo dõi `best-dev.pt` và các metadata JSON trong thư mục frozen sản xuất

- [x] **Step 1: Cập nhật `.gitignore`**

Chỉnh sửa `.gitignore` tại phần `fishing-ml pipeline`, bổ sung các dòng un-ignore:
```gitignore
# --- fishing-ml pipeline (avatar-web/fishing-ml) ---
avatar-web/fishing-ml/.venv/
data/
avatar-web/fishing-ml/artifacts/*/
*.pt
.pytest_cache/
*.egg-info/
# keep the publishable-bundle policy doc tracked
!avatar-web/fishing-ml/artifacts/README.md

# Whitelist production frozen artifact bundle
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/*
```

- [x] **Step 2: Kiểm tra trạng thái Git nhận diện file model**

Run:
```bash
git status --porcelain avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen
```
Expected: Xuất hiện danh sách các file `?? avatar-web/fishing-ml/artifacts/.../frozen/best-dev.pt`, `dataset-snapshot.json`, `dev-metrics.json`, `environment.json`, `freeze-manifest.json`, `model-config.json`, `normalization.json`, `split-checksums.json`, `thresholds.json`.

---

### Task 2: Bổ sung Endpoint `GET /health` trong `inference_service.py`

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:760-765`

**Interfaces:**
- Consumes: `matcher.model_id` từ biến closure `matcher` trong `_make_handler`
- Produces: HTTP response 200 JSON cho đường dẫn `GET /health`

- [x] **Step 1: Chạy GitNexus impact analysis trên symbol `do_GET`**

Run:
```typescript
gitnexus_impact({target: "do_GET", direction: "upstream", repo: "learning-reverse"})
```
Expected: Đánh giá rủi ro LOW/MEDIUM, ghi nhận chỉ có `_Handler` gọi phương thức này khi nhận request HTTP GET.

- [x] **Step 2: Cập nhật hàm `do_GET` trong `_Handler`**

Trong file `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`, thay thế phương thức `do_GET`:
```python
        def do_GET(self) -> None:
            if _request_path(self.path) == "/health":
                self._send_json(200, {
                    "code": "ok",
                    "status": "ok",
                    "model_id": matcher.model_id,
                })
                return
            self._method_not_allowed()
```

- [x] **Step 3: Chạy Unit Tests để đảm bảo tính hồi quy (regression)**

Run:
```bash
cd avatar-web/fishing-ml && .venv/bin/python -m unittest discover -s tests
```
Expected: Toàn bộ 19 tests pass (`Ran 19 tests ... OK`).

---

### Task 3: Tạo Runner Entrypoint Script `run_service.py`

**Files:**
- Create: `avatar-web/fishing-ml/run_service.py`

**Interfaces:**
- Consumes: `fishing_ml.inference_service.main`
- Produces: CLI script cho phép PM2 chạy với interpreter `.venv/bin/python` và tự động nạp frozen-dir mặc định

- [x] **Step 1: Tạo file `avatar-web/fishing-ml/run_service.py`**

Tạo file với nội dung:
```python
#!/usr/bin/env python3
"""Production PM2 runner for fishing-ml inference service."""
import sys
from pathlib import Path

# Đảm bảo src/ nằm trong sys.path độc lập với việc đã pip install -e hay chưa
root_dir = Path(__file__).resolve().parent
src_dir = root_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fishing_ml.inference_service import main

if __name__ == "__main__":
    default_frozen = (
        root_dir
        / "artifacts"
        / "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"
        / "frozen"
    )
    if "--frozen-dir" not in sys.argv:
        sys.argv.extend(["--frozen-dir", str(default_frozen)])
    sys.exit(main())
```

- [x] **Step 2: Phân quyền thực thi và kiểm tra CLI options**

Run:
```bash
chmod +x avatar-web/fishing-ml/run_service.py
avatar-web/fishing-ml/.venv/bin/python avatar-web/fishing-ml/run_service.py --help
```
Expected: Hiển thị hướng dẫn sử dụng CLI của `inference_service.py` với các tham số `--host`, `--port`, `--frozen-dir`, `--timeout-ms`.

- [x] **Step 3: Kiểm tra khởi chạy cục bộ và truy vấn endpoint `/health`**

Run:
```bash
# Khởi chạy service trên cổng 8089 trong background
avatar-web/fishing-ml/.venv/bin/python avatar-web/fishing-ml/run_service.py --port 8089 &
RUNNER_PID=$!
sleep 2

# Truy vấn endpoint /health
HEALTH_RES=$(curl -s http://127.0.0.1:8089/health)
echo "Response: $HEALTH_RES"

# Dừng process test
kill -9 $RUNNER_PID 2>/dev/null || true
```
Expected: `Response: {"code":"ok","status":"ok","model_id":"p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"}`.

---

### Task 4: Cập nhật Pipeline Deploy trên GitHub Actions (`deploy.yml`)

**Files:**
- Modify: `.github/workflows/deploy.yml:102-195`

**Interfaces:**
- Consumes: `SOLVER_ROOT`, `FISHING_ROOT`, `FISHING_VENV`, `FISHING_FROZEN`
- Produces: Pipeline deploy 4 giai đoạn hoàn chỉnh:
  - `[1/4]` Captcha Solver
  - `[2/4]` AI Fishing ML
  - `[3/4]` Backend Server
  - `[4/4]` Frontend Web UI

- [x] **Step 1: Khai báo biến đường dẫn và kiểm tra runtime assets cho Fishing ML**

Trong `.github/workflows/deploy.yml`, sau đoạn khai báo `SOLVER_ROOT`, bổ sung:
```bash
            SOLVER_ROOT="$TARGET_DIR/captcha-solver"
            SOLVER_VENV="$TARGET_DIR/.venv-captcha"
            PUBLIC_SOLVER_URL="https://avt3xauto.duckdns.org/api/solver/"

            FISHING_ROOT="$TARGET_DIR/$BASE_PATH/fishing-ml"
            FISHING_VENV="$FISHING_ROOT/.venv"
            FISHING_FROZEN="$FISHING_ROOT/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen"

            echo "🔎 Đang kiểm tra runtime assets của fishing-ml..."
            for required_file in \
              "$FISHING_ROOT/run_service.py" \
              "$FISHING_FROZEN/best-dev.pt" \
              "$FISHING_FROZEN/freeze-manifest.json" \
              "$FISHING_FROZEN/model-config.json" \
              "$FISHING_FROZEN/normalization.json" \
              "$FISHING_FROZEN/thresholds.json"
            do
              if [ ! -f "$required_file" ]; then
                echo "❌ Thiếu fishing-ml runtime asset: $required_file"
                exit 1
              fi
            done
```

- [x] **Step 2: Đánh số lại `[1/4]` cho Captcha Solver và thêm khối `[2/4]` cho Fishing ML**

Chuyển `[1/3] Đang cập nhật Captcha Solver...` thành `[1/4] Đang cập nhật Captcha Solver...`.
Ngay sau khối Captcha Solver và trước khối Backend Server, thêm:
```bash
            # 4. Triển khai AI Fishing ML
            echo "🎣 [2/4] Đang cập nhật AI Fishing ML Service..."
            if ! python3 -m venv "$FISHING_VENV"; then
              echo "ℹ️ python3-venv không có; dùng virtualenv zipapp..."
              PYTHON_MINOR=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
              VIRTUALENV_PYZ="$TARGET_DIR/.cache/virtualenv-${PYTHON_MINOR}.pyz"
              mkdir -p "$TARGET_DIR/.cache"
              curl --fail --silent --show-error --location \
                --retry 3 --retry-delay 2 --retry-all-errors \
                "https://bootstrap.pypa.io/virtualenv/${PYTHON_MINOR}/virtualenv.pyz" \
                -o "$VIRTUALENV_PYZ"
              python3 "$VIRTUALENV_PYZ" --clear "$FISHING_VENV"
            fi
            "$FISHING_VENV/bin/python" -m pip install --upgrade pip
            "$FISHING_VENV/bin/python" -m pip install torch --index-url https://download.pytorch.org/whl/cpu
            "$FISHING_VENV/bin/python" -m pip install -e "$FISHING_ROOT"

            cd "$FISHING_ROOT"
            pm2 delete fishing-ml >/dev/null 2>&1 || true
            pm2 start run_service.py \
              --name fishing-ml \
              --interpreter "$FISHING_VENV/bin/python" \
              -- \
              --host 127.0.0.1 \
              --port 8080 \
              --frozen-dir "$FISHING_FROZEN"

            if ! curl --fail --silent --show-error \
              --retry 12 --retry-delay 2 --retry-all-errors \
              http://127.0.0.1:8080/health
            then
              echo "❌ Fishing ML service local health check thất bại"
              pm2 logs fishing-ml --lines 120 --nostream || true
              exit 1
            fi
```

- [x] **Step 3: Cập nhật đánh số `[3/4]` cho Backend Server và `[4/4]` cho Frontend Web UI**

Đổi:
- `[2/3] Đang cập nhật Backend Server...` ➔ `[3/4] Đang cập nhật Backend Server...`
- `[3/3] Đang cập nhật Frontend Web UI...` ➔ `[4/4] Đang cập nhật Frontend Web UI...`

- [x] **Step 4: Kiểm tra cú pháp YAML của workflow**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
```
Expected: Lệnh chạy thành công không có lỗi syntax YAML.

---

### Task 5: Xác Minh Toàn Diện & Kiểm Tra Phạm Vi GitNexus

**Files:**
- Toàn bộ các file thay đổi: `.gitignore`, `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`, `avatar-web/fishing-ml/run_service.py`, `.github/workflows/deploy.yml`.

- [x] **Step 1: Chạy `gitnexus_detect_changes()` để kiểm tra phạm vi ảnh hưởng**

Run:
```typescript
gitnexus_detect_changes({scope: "all"})
```
Expected: Báo cáo các symbol và files thay đổi trùng khớp với phạm vi thiết kế, không có tác dụng phụ ngoài ý muốn.

- [x] **Step 2: Kiểm tra tổng thể trạng thái Git**

Run:
```bash
git status
```
Expected: Các file sửa đổi và file mới hiển thị sạch sẽ, rõ ràng.
