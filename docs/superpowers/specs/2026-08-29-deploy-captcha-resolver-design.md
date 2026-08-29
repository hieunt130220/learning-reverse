# Deploy Captcha Resolver Lên Production VPS — Design Spec

Ngày: 2026-08-29

## 1. Mục tiêu & Bối cảnh

### Hiện trạng

- Captcha resolver đang chạy local bằng:

  ```bash
  .venv-captcha312/bin/python captcha-solver/solver_server.py \
    --host 0.0.0.0 --port 8643
  ```

- `avatar-auto-patched.jar` hiện trỏ OCR về `http://127.0.0.1:8643/`, nên chỉ hoạt động khi MicroEmulator và resolver cùng máy.
- Production hiện có:
  - VPS: `34.46.208.67`.
  - Domain + TLS hợp lệ: `https://avt3xauto.duckdns.org`.
  - Nginx public trên port `80/443`; port `8643` và `8787` không public.
  - `avatar-web` chạy bằng PM2 sau Nginx.
  - GitHub Actions `.github/workflows/deploy.yml` SSH vào VPS, reset về `origin/main`, build và reload PM2.
- Máy local không có SSH key được VPS chấp nhận; đường deploy khả dụng là GitHub Actions hiện có, dùng repository secret `SERVER_SSH_KEY`.
- Runtime assets bắt buộc của resolver hiện đang bị `.gitignore` loại khỏi repository:
  - `captcha-solver/checkpoints/crnn_ctc.pt` — 3,628,245 bytes.
  - `captcha-solver/data/cached_chip_config.bin` — 1,070 bytes.
  - `captcha-solver/data/cached_data_php.bin` — 67,867 bytes.
  - `captcha-solver/data/cached_teacher_php.bin` — 938 bytes.

### Vấn đề cần giải quyết

1. Đưa Python/PyTorch resolver lên VPS và tự khởi động/restart cùng PM2.
2. Public resolver qua HTTPS mà không mở thêm firewall hoặc sửa Nginx.
3. Giữ nguyên byte-level request/response mà `az.class` yêu cầu.
4. Đảm bảo config offline do resolver trả về tiếp tục trỏ tới endpoint production, không quay về `127.0.0.1`.
5. Sinh JAR production trỏ tới resolver remote, đồng thời giữ bản local để debug.

### Mục tiêu

- Endpoint public:

  ```text
  https://avt3xauto.duckdns.org/api/solver/
  ```

- Resolver process chỉ listen `127.0.0.1:8643` trên VPS.
- `avatar-web` stream proxy raw HTTP từ `/api/solver/*` tới resolver nội bộ.
- GitHub Actions cài Python dependencies, start/reload PM2 process `captcha-solver`, chạy health checks và chỉ tiếp tục deploy web khi resolver khỏe.
- JAR production dùng endpoint public và tự giải captcha khi máy người dùng không chạy resolver local.

## 2. Phạm vi (Scope)

### In-scope

1. **Resolver production configuration**
   - Thêm `--public-base-url` cho `solver_server.py`.
   - Rewrite cached chip config khi phục vụ GET `/` để mọi URL OCR/data dùng production base URL.
   - Bind loopback trên VPS; local development vẫn giữ default `127.0.0.1:8643`.

2. **Runtime dependency và assets**
   - Tạo `captcha-solver/requirements-runtime.txt` khóa bộ tương thích Python
     3.10.12 đang có trên VPS; local training/debug vẫn dùng Python 3.12.13:

     ```text
     --index-url https://download.pytorch.org/whl/cpu
     torch==2.13.0
     numpy==2.2.6
     pillow==12.3.0
     ```

   - Track checkpoint và ba cache `.bin` cần cho OFFLINE mode; không track labels/dataset/tooling data.

3. **Avatar-web raw proxy**
   - Tạo module proxy raw GET/POST trước `express.json()`.
   - Forward path sau `/api/solver`, method, body và các header cần thiết.
   - Stream response binary nguyên byte, không parse JSON/UTF.
   - Giới hạn request body 2 MiB, upstream timeout 20 giây, trả `502` khi resolver unavailable.

4. **CI/CD**
   - Mở rộng workflow production để tạo/reuse Python venv, cài runtime requirements và quản lý process `captcha-solver` bằng PM2.
   - Health check local resolver và endpoint public.
   - Giữ nguyên deploy Node/web hiện có.

5. **JAR production**
   - Dùng `tools/jar/patch_jar.py --url https://avt3xauto.duckdns.org/api/solver/`.
   - Output riêng `avatar-jar/avatar-auto-production.jar`; không ghi đè JAR local.

### Out-of-scope

- Không retrain model hoặc thay đổi kiến trúc CRNN.
- Không mở public port `8643`.
- Không chỉnh firewall/VPC hoặc Nginx.
- Không thêm GPU; inference dùng CPU.
- Không triển khai nhiều replica/load balancer trong đợt này.
- Không thêm test file mới nếu user không yêu cầu; dùng typecheck, suite hiện có và smoke command.

### Input / Output

#### Public request

```text
GET  /api/solver/health
GET  /api/solver/
POST /api/solver/avatar/full/captcha.php
POST /api/solver/avatar/teacher.php
```

#### Internal forwarding

```text
https://avt3xauto.duckdns.org/api/solver/<path>
  -> avatar-web Express raw proxy
  -> http://127.0.0.1:8643/<path>
```

#### Captcha response contract

```text
HTTP 200
byte 0: 1          # status OK
byte 1: 0          # resultType
byte 2-3: 0x0004   # Java modified UTF byte length
byte 4-7: ASCII four digits
```

### Edge cases

- Resolver chưa boot/model load lỗi: proxy trả `502`, deploy health check fail và workflow dừng.
- Request body > 2 MiB: proxy trả `413`, không forward.
- Client disconnect giữa inference: đóng upstream request/response, không làm chết Node process.
- Cached config malformed/missing: resolver log lỗi và trả fail-safe; deployment health check GET config phải phát hiện payload rỗng.
- Public base URL có hoặc không có slash cuối: chuẩn hóa thành đúng một slash.
- Nhiều captcha đồng thời: `ThreadingHTTPServer` nhận concurrent; `_MODEL_LOCK` serialize inference để giữ model thread-safe.
- PM2 restart: model được load lại một lần; health chỉ pass sau khi model load xong.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Kiến trúc production

```text
MicroEmulator / avatar-auto-production.jar
  │ HTTPS GET/POST byte-level
  ▼
Nginx :443 (đã có)
  │ /api/* -> avatar-web :8787
  ▼
Express /api/solver/* raw proxy
  │ HTTP loopback, stream nguyên byte
  ▼
PM2 process captcha-solver
  │ Python 3 + PyTorch CPU
  ▼
CRNN checkpoint -> 4 chữ số -> status 1,0 + Java UTF
```

### 3.2. Files/modules liên quan

| File | Hành động | Vai trò |
|---|---|---|
| `captcha-solver/solver_server.py` | Modify | Nhận `--public-base-url`, rewrite cached config cho endpoint production, log startup config |
| `captcha-solver/requirements-runtime.txt` | Create | Dependency runtime pin chính xác |
| `captcha-solver/checkpoints/crnn_ctc.pt` | Track | Model production |
| `captcha-solver/data/cached_chip_config.bin` | Track | Config offline nguồn |
| `captcha-solver/data/cached_data_php.bin` | Track | Data offline |
| `captcha-solver/data/cached_teacher_php.bin` | Track | Teacher offline |
| `.gitignore` | Modify | Chỉ unignore bốn runtime assets trên; labels/dataset vẫn ignored |
| `avatar-web/server/src/game/captchaSolverProxy.ts` | Create | Raw reverse proxy, body guard, timeout, binary response |
| `avatar-web/server/src/index.ts` | Modify | Mount `/api/solver` trước `express.json()` |
| `.github/workflows/deploy.yml` | Modify | Install venv/deps, PM2 reload resolver, health checks |
| `tools/jar/patch_jar.py` | Modify nhẹ | Hỗ trợ output production rõ ràng trong docs/log; giữ default local |
| `avatar-jar/avatar-auto-production.jar` | Generate | Client trỏ endpoint production |
| `captcha-solver/README.md` | Modify | Cách chạy local/production và health checks |

### 3.3. Public base URL và config rewrite

`solver_server.py` thêm:

```python
DEFAULT_PUBLIC_BASE_URL = "http://127.0.0.1:8643/"

def _normalize_base_url(value: str) -> str:
    return value.rstrip("/") + "/"
```

CLI:

```text
--public-base-url https://avt3xauto.duckdns.org/api/solver/
```

Khi trả `cached_chip_config.bin` tại GET `/`, resolver decode XOR rồi thay các URL đã biết thành:

```text
https://avt3xauto.duckdns.org/api/solver/avatar/full/data.php
https://avt3xauto.duckdns.org/api/solver/avatar/full/captcha.php
https://avt3xauto.duckdns.org/api/solver/avatar/teacher.php
https://avt3xauto.duckdns.org/api/solver/avatar/avdata.php?_t=
https://avt3xauto.duckdns.org/api/solver/
```

Length prefix Java UTF phải được cập nhật trước khi XOR lại.

### 3.4. Express raw proxy contract

Interface:

```ts
export interface CaptchaSolverProxyOptions {
  upstreamOrigin?: string; // default http://127.0.0.1:8643
  maxBodyBytes?: number;   // default 2 MiB
  timeoutMs?: number;      // default 20_000
}

export function captchaSolverProxy(
  options?: CaptchaSolverProxyOptions,
): express.RequestHandler;
```

Behavior:

- Chỉ cho `GET`, `HEAD`, `POST`; method khác trả `405`.
- Validate `Content-Length` nếu có; đồng thời đếm bytes thực tế để chống chunked oversize.
- Forward `Content-Type`, `User-Agent`, `Accept`; tự đặt `Connection: close` và `Host: 127.0.0.1:8643`.
- Path upstream lấy từ `req.url`, nên mount `/api/solver` sẽ tự strip prefix.
- Copy status, `Content-Type`, `Content-Length`; không forward hop-by-hop headers.
- Abort upstream nếu downstream đóng.

Mount order:

```ts
app.use('/api/solver', captchaSolverProxy());
app.use('/api/captcha', captchaRouter());
app.use(express.json());
```

### 3.5. PM2 deploy flow

Workflow SSH chạy trong repository trên VPS:

```bash
SOLVER_VENV="$TARGET_DIR/.venv-captcha"
python3 -m venv "$SOLVER_VENV"
"$SOLVER_VENV/bin/pip" install --upgrade pip
"$SOLVER_VENV/bin/pip" install -r captcha-solver/requirements-runtime.txt

cd "$TARGET_DIR/captcha-solver"
pm2 delete captcha-solver >/dev/null 2>&1 || true
pm2 start solver_server.py \
  --name captcha-solver \
  --interpreter "$SOLVER_VENV/bin/python" \
  -- \
  --host 127.0.0.1 \
  --port 8643 \
  --public-base-url https://avt3xauto.duckdns.org/api/solver/

curl --fail --retry 12 --retry-delay 2 http://127.0.0.1:8643/health
```

Sau khi Node server reload:

```bash
curl --fail --retry 12 --retry-delay 2 \
  https://avt3xauto.duckdns.org/api/solver/health
```

`pm2 save` chỉ chạy sau khi cả resolver và avatar-web health pass.

### 3.6. Deployment flow

```text
Approved implementation
  -> track runtime assets
  -> implement public-base rewrite + raw proxy
  -> typecheck/suite/smoke local
  -> generate production JAR
  -> GitNexus detect-changes
  -> user explicitly approves commit + push
  -> push main triggers GitHub Actions
  -> VPS git reset origin/main
  -> install/update Python venv
  -> PM2 start captcha-solver
  -> local resolver health pass
  -> build/reload avatar-web proxy
  -> public resolver health pass
  -> live JAR captcha E2E
```

## 4. Verification Plan

### Local automated/smoke

```bash
python3 -m py_compile captcha-solver/solver_server.py tools/jar/patch_jar.py

cd avatar-web/server
npm run typecheck
npm test

cd ../..
.venv-captcha312/bin/python captcha-solver/solver_server.py \
  --host 127.0.0.1 \
  --port 8643 \
  --public-base-url https://avt3xauto.duckdns.org/api/solver/
```

Expected:

- `GET /health` trả `ok`.
- GET `/` trả non-empty XOR config; decode ra toàn bộ URL production và không còn `127.0.0.1`/`chip.vcdn.io.vn`.
- Replay captcha thật trả đúng payload `01 00 00 04 <4 digits>`.
- Proxy local trả response byte-for-byte giống gọi resolver trực tiếp.

### Production deployment

1. GitHub Actions job thành công.
2. `https://avt3xauto.duckdns.org/api/solver/health` trả `200 ok`.
3. GET production config qua `/api/solver/` có payload > 1,000 bytes.
4. PM2 có hai process online: `avatar-web`, `captcha-solver`.
5. Log resolver không có model/config load error.

### Live E2E

1. Mở `avatar-auto-production.jar` trên máy không chạy local resolver.
2. Trigger captcha.
3. Production log nhận `POST /avatar/full/captcha.php`.
4. Solver trả 4 chữ số đúng protocol; game đóng "Xin chờ" hoặc cấp captcha mới nếu OCR đoán sai.
5. Dừng local resolver và lặp lại để chứng minh client thực sự dùng production endpoint.

## 5. Rủi ro & Rollback

### Rủi ro

- PyTorch CPU wheel làm deploy đầu tiên chậm và dùng thêm disk/RAM.
- Endpoint public không có authentication; body/method/timeout guard giảm rủi ro abuse nhưng không loại bỏ hoàn toàn.
- Checkpoint/cache hiện ignored; thiếu exception `.gitignore` sẽ khiến workflow boot fail.
- HTTPS J2ME cần live verify trên MicroEmulator; nếu client TLS không tương thích, fallback là Nginx HTTP path không redirect hoặc public port riêng, nhưng nằm ngoài triển khai mặc định.
- Working tree hiện có nhiều thay đổi chưa commit. Workflow dùng `git reset --hard origin/main`, vì vậy không có thay đổi nào được deploy trước khi user duyệt commit/push.

### Rollback

1. Deploy commit trước đó của `main` bằng GitHub Actions workflow dispatch hoặc revert commit deploy resolver.
2. `pm2 stop captcha-solver`; avatar-web vẫn hoạt động, route proxy trả `502` thay vì ảnh hưởng session game.
3. Người dùng quay lại `avatar-auto-patched.jar` local trỏ `127.0.0.1:8643`.
4. Runtime assets không chứa credential; có thể xóa khỏi repository ở rollback sau nếu cần.

## 6. Assumptions cần user duyệt

- Deploy lên cùng VPS `34.46.208.67` và domain `avt3xauto.duckdns.org`.
- Dùng endpoint `https://avt3xauto.duckdns.org/api/solver/`.
- Dùng GitHub Actions + PM2; không yêu cầu cấp SSH key local.
- Cho phép track model 3.6 MiB và ba cache binary nhỏ trong Git repository.
- Khi đến checkpoint commit/push, agent sẽ hỏi xác nhận rõ ràng; không tự commit/push chỉ vì Spec được duyệt.
