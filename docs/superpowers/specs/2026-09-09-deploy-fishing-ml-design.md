# Thiết Kế Triển Khai Dịch Vụ AI Câu Cá (fishing-ml) Lên Môi Trường Production

- **Ngày tạo**: 2026-09-09
- **Tác giả**: AI Agent & devios
- **Chủ đề**: Tích hợp dịch vụ `fishing-ml` vào pipeline CI/CD GitHub Actions (`deploy.yml`) và hệ thống quản lý tiến trình PM2 trên máy chủ VPS Ubuntu.

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Bối cảnh
Hệ thống `avatar-web` hiện đã hoàn thiện mô hình so khớp ảnh câu cá Phase 2 (`fishing-ml`), được đông kết (freeze) tại thư mục `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen`. Dịch vụ suy luận HTTP nội bộ (`fishing_ml.inference_service`) chạy trên cổng `8080`, phục vụ endpoint `POST /infer` để Backend Server (`avatar-web/server`) gọi khi gặp mini-game thử thách câu cá.

Tài liệu `avatar-web/DEPLOY_GCP.md` và script `dev.sh` đã mô tả kiến trúc 3 thành phần backend/frontend/AI, tuy nhiên pipeline CI/CD tự động trên GitHub Actions (`.github/workflows/deploy.yml`) hiện tại mới chỉ triển khai:
1. `captcha-solver` (Cổng 8643)
2. `avatar-web` Backend Server (Cổng 8787)
3. `web` Frontend Web UI (Build static HTML/Vite)

Dịch vụ `fishing-ml` chưa có trong pipeline tự động, dẫn đến việc khi deploy lên VPS mới hoặc cập nhật code thì tính năng tự giải mini-game câu cá sẽ không hoạt động nếu chưa thao tác tay.

### 1.2. Mục tiêu
- Tự động hóa 100% quá trình cài đặt, cập nhật và khởi chạy `fishing-ml` trên VPS mỗi khi có commit mới vào nhánh `main`.
- Đảm bảo model checkpoint (`best-dev.pt` ~2.3MB cùng manifest ~0.6MB) được đồng bộ chính xác qua Git lên VPS mà không cần thao tác copy thủ công.
- Cung cấp cơ chế quản lý vòng đời tiến trình chuẩn xác qua PM2 (`--interpreter` trỏ đến venv độc lập) và cơ chế Health Check qua HTTP GET `/health` trước khi khởi chạy Backend Server.
- Fail-safe: Nếu thiếu model weights, môi trường Python lỗi, hoặc service không phản hồi trong thời gian chờ (12 lần retry), workflow deploy sẽ fail ngay lập tức (fail-closed) và in logs chi tiết.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
1. **Cấu hình Git Tracking (`.gitignore`)**:
   - Bổ sung quy tắc ngoại lệ để Git theo dõi thư mục frozen artifact sản xuất được chọn:
     `!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/`
     `!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/*`
2. **Cập nhật Python Inference Service (`avatar-web/fishing-ml/src/fishing_ml/inference_service.py`)**:
   - Bổ sung endpoint `GET /health` trả về mã HTTP 200 kèm payload JSON:
     `{"status": "ok", "model_id": matcher.model_id}`.
   - Các đường dẫn GET khác tiếp tục trả về mã HTTP 405 Method Not Allowed như thiết kế hiện tại.
   - Bổ sung unit test kiểm tra endpoint `GET /health`.
3. **Thêm Runner Entrypoint Script (`avatar-web/fishing-ml/run_service.py`)**:
   - Cung cấp entrypoint Python có đường dẫn cố định, tự động nhận diện thư mục `src/` và giá trị mặc định cho `--frozen-dir`.
   - Cho phép PM2 chạy trực tiếp với cú pháp chuẩn:
     `pm2 start run_service.py --name fishing-ml --interpreter <venv>/bin/python -- --host 127.0.0.1 --port 8080`
4. **Cập nhật GitHub Actions Deployment Workflow (`.github/workflows/deploy.yml`)**:
   - Bổ sung biến môi trường và bước kiểm tra file runtime assets của `fishing-ml`.
   - Bổ sung khối lệnh triển khai `[2/4] Triển khai AI Fishing ML`:
     - Khởi tạo/cập nhật virtualenv độc lập tại `$FISHING_ROOT/.venv` (hỗ trợ fallback bootstrap nếu thiếu `python3-venv`).
     - Nâng cấp `pip`, cài đặt `torch` CPU-only (`--index-url https://download.pytorch.org/whl/cpu`) để tiết kiệm dung lượng RAM trên VPS `e2-micro`.
     - Cài đặt package `fishing-ml` (`pip install -e .`).
     - Khởi chạy/reload PM2 service `fishing-ml`.
     - Health check retry với `curl http://127.0.0.1:8080/health`.

### 2.2. Out-of-Scope
- Không retrain hay thay đổi thuật toán mô hình PyTorch (mạng CNN MobileNet/ResNet thu gọn).
- Không thay đổi hợp đồng dữ liệu suy luận (data wire contract `InferenceRequest` / `InferenceResponse` tại `inference_contract.py`).
- Không can thiệp vào mã nguồn giải mã packet hay logic tự động câu cá của game client.

### 2.3. Edge Cases & Xử Lý Ngoại Lệ
1. **Thiếu module `python3-venv` trên VPS**: Sử dụng cơ chế bootstrap `virtualenv.pyz` tải về thư mục cache (đã được áp dụng thành công cho `captcha-solver`).
2. **VPS e2-micro chỉ có 1GB RAM**: Việc cài đặt PyTorch thông thường từ PyPI có thể kéo theo các file CUDA/cuDNN nặng hàng GB gây tràn ổ đĩa và tràn RAM. Bắt buộc sử dụng repo wheel CPU-only:
   `https://download.pytorch.org/whl/cpu`.
3. **Cổng 8080 bị tiến trình cũ chiếm dụng hoặc PM2 zombie**: Dùng `pm2 delete fishing-ml >/dev/null 2>&1 || true` trước khi start để đảm bảo socket port được giải phóng sạch sẽ.
4. **Sai lệch git revision của model frozen**: Hàm `load_frozen_matcher` trong `inference_service.py` kiểm tra `_is_git_ancestor(revision, current_rev)`. Vì commit của freeze-manifest (`8ca1f93...`) là commit tổ tiên (ancestor) của các commit hiện tại và tương lai, điều kiện này sẽ luôn thỏa mãn tự nhiên.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Sơ đồ Kiến trúc Quản lý Dịch vụ trên VPS

```text
GitHub Actions Runner (Ubuntu)
      │  SSH (Port 22)
      ▼
VPS Target Directory: /var/www/avatar-web
      │
      ├── [1/4] PM2: captcha-solver (Port 8643, .venv-captcha)
      │
      ├── [2/4] PM2: fishing-ml     (Port 8080, fishing-ml/.venv)
      │         │
      │         ├── Entrypoint: run_service.py
      │         ├── Model: artifacts/.../frozen/best-dev.pt
      │         └── Health: GET http://127.0.0.1:8080/health ──► 200 OK
      │
      ├── [3/4] PM2: avatar-web     (Port 8787, Node.js dist/index.js)
      │         └── Calls internal: http://127.0.0.1:8080/infer
      │
      └── [4/4] Web Static Build    (/web/dist)
```

### 3.2. Chi tiết các File và Thay đổi

#### 1. `.gitignore`
Cho phép commit các tệp trong thư mục frozen artifact sản xuất:
```gitignore
# --- fishing-ml pipeline (avatar-web/fishing-ml) ---
avatar-web/fishing-ml/.venv/
data/
avatar-web/fishing-ml/artifacts/*/
*.pt
.pytest_cache/
*.egg-info/
!avatar-web/fishing-ml/artifacts/README.md

# Whitelist production frozen artifact bundle
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/
!avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/*
```

#### 2. `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`
Trong `_make_handler`:
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

#### 3. `avatar-web/fishing-ml/run_service.py`
File thực thi entrypoint cho PM2:
```python
#!/usr/bin/env python3
import sys
from pathlib import Path

# Đảm bảo src/ nằm trong sys.path
root_dir = Path(__file__).resolve().parent
src_dir = root_dir / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fishing_ml.inference_service import main

if __name__ == "__main__":
    default_frozen = root_dir / "artifacts" / "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01" / "frozen"
    if "--frozen-dir" not in sys.argv:
        sys.argv.extend(["--frozen-dir", str(default_frozen)])
    sys.exit(main())
```

#### 4. `.github/workflows/deploy.yml`
Cập nhật nội dung SSH deploy script:
- Định nghĩa đường dẫn:
  ```bash
  FISHING_ROOT="$TARGET_DIR/$BASE_PATH/fishing-ml"
  FISHING_VENV="$FISHING_ROOT/.venv"
  FISHING_FROZEN="$FISHING_ROOT/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen"
  ```
- Kiểm tra runtime assets:
  ```bash
  for required_file in \
    "$FISHING_ROOT/run_service.py" \
    "$FISHING_FROZEN/best-dev.pt" \
    "$FISHING_FROZEN/freeze-manifest.json" \
    "$FISHING_FROZEN/model-config.json" \
    "$FISHING_FROZEN/normalization.json" \
    "$FISHING_FROZEN/thresholds.json"
  do
    if [ ! -f "$required_file" ]; then
      echo "❌ Thiếu fishing runtime asset: $required_file"
      exit 1
    fi
  done
  ```
- Khởi chạy & cài đặt môi trường `[2/4]`:
  ```bash
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

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 4.1. Automated Verification
1. **Kiểm tra Unit Test của Python**:
   - Tạo test case cho `GET /health` trong `avatar-web/fishing-ml/tests/test_inference_service.py` (hoặc bổ sung vào test suite hiện có).
   - Chạy lệnh:
     ```bash
     cd avatar-web/fishing-ml && .venv/bin/python -m unittest discover -s tests
     ```
     Kỳ vọng: 100% tests pass mà không có lỗi.
2. **Kiểm tra Un-ignore của Git**:
   - Chạy `git status` để xác nhận file `best-dev.pt` và các file json trong thư mục `frozen/` đã được git nhận diện để sẵn sàng commit.
3. **Kiểm tra cú pháp Shell & YAML**:
   - Dùng lệnh kiểm tra cú pháp yaml của `.github/workflows/deploy.yml`:
     ```bash
     python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
     ```

### 4.2. Manual Verification
1. Khởi chạy thử service cục bộ bằng `run_service.py`:
   ```bash
   avatar-web/fishing-ml/.venv/bin/python avatar-web/fishing-ml/run_service.py --port 8081 &
   curl http://127.0.0.1:8081/health
   kill %1
   ```
   Kỳ vọng: Nhận được HTTP 200 `{"code": "ok", "status": "ok", "model_id": "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"}`.
