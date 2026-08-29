# Deploy Captcha Resolver Lên Production VPS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy captcha resolver lên VPS production, public qua `https://avt3xauto.duckdns.org/api/solver/`, và phát hành JAR production tự gọi resolver remote.

**Architecture:** Python resolver chỉ bind `127.0.0.1:8643`; `avatar-web` mount một raw binary proxy tại `/api/solver` trước `express.json()` để dùng lại Nginx/TLS hiện có. GitHub Actions cài Python venv, quản lý cả `captcha-solver` và `avatar-web` bằng PM2, rồi chỉ lưu process list sau khi local/public health checks đều pass.

**Tech Stack:** Python 3.10.12 production / 3.12 local, PyTorch CPU, NumPy, Pillow, Node.js 22+, Express 4, TypeScript 5.7, PM2, GitHub Actions, J2ME JAR bytecode/resource patching.

**Spec:** `docs/superpowers/specs/2026-08-29-deploy-captcha-resolver-design.md`

## Global Constraints

- Không mở public port `8643`, không sửa firewall/VPC/Nginx; traffic public đi qua HTTPS route của `avatar-web`.
- Resolver production phải bind `127.0.0.1`; URL public cố định là `https://avt3xauto.duckdns.org/api/solver/`.
- Proxy phải giữ nguyên binary request/response; không parse body bằng JSON, text hoặc form middleware.
- Không retrain model, không thay đổi CRNN architecture và không thêm test file mới.
- Chỉ track checkpoint và ba cache binary production; `labels.csv`, dataset và các artifact huấn luyện khác tiếp tục bị ignore.
- Giữ `avatar-auto-patched.jar` cho local rollback; production output là file riêng `avatar-auto-production.jar`.
- Working tree có thay đổi không liên quan trong `avatar-web/server/src/accounts/*`, `avatar-web/server/src/session/*`, `avatar-web/server/src/db/schema.sql` và tài liệu persist quest. Không stage, sửa, reset hoặc commit các file đó.
- Các fix captcha đã được duyệt nhưng chưa commit trong `captcha-solver/src/predict.py`, `captcha-solver/solver_server.py`, `tools/jar/patch_jar.py`, `docs/protocol/az-ocr-notes.md` và `avatar-jar/avatar-auto-patched.jar` là release prerequisites; phải được giữ nguyên và đưa vào release scope.
- Local `main` hiện đi trước `origin/main` 27 commits. Trước push phải hiển thị lại `origin/main..main` và nhận xác nhận rõ ràng rằng toàn bộ lịch sử ahead sẽ được đẩy.
- Không tự chạy `git commit` hoặc `git push`. Mọi commit command trong plan là checkpoint bị khóa cho tới khi user xác nhận riêng sau verification.
- Trước commit phải stage bằng allowlist, chạy `gitnexus detect-changes --scope staged`, và xác nhận không có file ngoài release scope.
- GitNexus impact đã chạy ngày 2026-08-29:
  - `_patch_chip_config`: LOW — 1 direct caller (`Handler._proxy`), ảnh hưởng flow `do_POST`.
  - `Handler._proxy`: LOW — 2 direct callers (`do_GET`, `do_POST`), ảnh hưởng một module/flow resolver.
  - `captcha-solver/solver_server.py::main`: LOW — chỉ file entrypoint gọi trực tiếp.
  - `tools/jar/patch_jar.py::main`: LOW — chỉ file entrypoint gọi trực tiếp.

---

### Task 1: Track Runtime Assets Và Pin Dependencies

**Files:**
- Modify: `.gitignore:34-43`
- Create: `captcha-solver/requirements-runtime.txt`
- Add: `captcha-solver/checkpoints/crnn_ctc.pt`
- Add: `captcha-solver/data/cached_chip_config.bin`
- Add: `captcha-solver/data/cached_data_php.bin`
- Add: `captcha-solver/data/cached_teacher_php.bin`

**Interfaces:**
- Consumes: Local runtime đã verify gồm Python `3.12.13`, torch `2.13.0`, numpy `2.5.2`, Pillow `12.3.0`; production VPS có Python `3.10.12` nên dùng numpy `2.2.6` tương thích.
- Produces: Một Git checkout đủ model/cache/dependencies để resolver boot độc lập trên VPS.

- [x] **Step 1: Thêm ignore exceptions có allowlist**

Append sau các Python/ML ignore rules trong `.gitignore`:

```gitignore
# --- captcha resolver production runtime ---
!captcha-solver/data/
captcha-solver/data/*
!captcha-solver/data/cached_chip_config.bin
!captcha-solver/data/cached_data_php.bin
!captcha-solver/data/cached_teacher_php.bin
!captcha-solver/checkpoints/crnn_ctc.pt
```

Thứ tự này bắt buộc: unignore parent `data/`, ignore lại toàn bộ children, rồi chỉ unignore ba cache production. Không unignore `labels.csv`, `library.json`, `templates.json`, `wordlist.txt` hoặc dataset.

- [x] **Step 2: Tạo runtime requirements khóa phiên bản**

Create `captcha-solver/requirements-runtime.txt` với đúng nội dung:

```text
--index-url https://download.pytorch.org/whl/cpu
torch==2.13.0
numpy==2.2.6
pillow==12.3.0
```

- [x] **Step 3: Verify asset allowlist và kích thước**

Run:

```bash
git check-ignore -v \
  captcha-solver/checkpoints/crnn_ctc.pt \
  captcha-solver/data/cached_chip_config.bin \
  captcha-solver/data/cached_data_php.bin \
  captcha-solver/data/cached_teacher_php.bin || true

git status --short -- \
  captcha-solver/checkpoints/crnn_ctc.pt \
  captcha-solver/data/cached_chip_config.bin \
  captcha-solver/data/cached_data_php.bin \
  captcha-solver/data/cached_teacher_php.bin

shasum -a 256 \
  captcha-solver/checkpoints/crnn_ctc.pt \
  captcha-solver/data/cached_chip_config.bin \
  captcha-solver/data/cached_data_php.bin \
  captcha-solver/data/cached_teacher_php.bin
```

Expected:

- `git check-ignore` không còn báo bốn runtime assets bị ignore.
- `git status` hiển thị đúng bốn file addable.
- Kích thước tương ứng là `3628245`, `1070`, `67867`, `938` bytes.

- [x] **Step 4: Commit checkpoint — deferred**

Không commit ở task này. Các file được stage bằng allowlist tại Task 7 sau khi user duyệt commit/push.

---

### Task 2: Rewrite Resolver Config Theo Public Base URL

**Files:**
- Modify: `captcha-solver/solver_server.py:33-109`
- Modify: `captcha-solver/solver_server.py:289-365`
- Modify: `captcha-solver/solver_server.py:423-445`
- Preserve/release: `captcha-solver/src/predict.py`

**Interfaces:**
- Consumes: XOR key `NguyenHuuQuyet`, cached config Java UTF fields, existing `_CACHE_BY_PATH`, `predict_array_fixed()`.
- Produces: `--public-base-url`, normalized runtime base URL, cached/online config rewrite, loopback-safe default bind.

- [x] **Step 1: Thêm public-base constants và normalization**

Add gần các constants hiện tại:

```python
DEFAULT_PUBLIC_BASE_URL = "http://127.0.0.1:8643/"
PUBLIC_BASE_URL = DEFAULT_PUBLIC_BASE_URL

_CONFIG_URL_PATHS = (
    "avatar/full/data.php",
    "avatar/full/captcha.php",
    "avatar/teacher.php",
    "avatar/avdata.php?_t=",
    "",
)

_CONFIG_SOURCE_BASE_URLS = (
    "http://chip.vcdn.io.vn/",
    DEFAULT_PUBLIC_BASE_URL,
)

def _normalize_base_url(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("public base URL must not be empty")
    return value.rstrip("/") + "/"
```

Không dùng URL parse/encode lại query suffix `_t=`; rewrite trên exact bytes để giữ protocol cũ.

- [x] **Step 2: Mở rộng `_patch_chip_config()` cho cache local và production**

Đổi signature thành:

```python
def _patch_chip_config(
    data: bytes,
    public_base_url: str = DEFAULT_PUBLIC_BASE_URL,
) -> bytes:
```

Implementation phải:

1. XOR decode input; nếu decode lỗi thì trả nguyên `data`.
2. Normalize `public_base_url`.
3. Với mỗi suffix trong `_CONFIG_URL_PATHS`, tạo target UTF bytes từ public base.
4. Với mỗi source base trong `_CONFIG_SOURCE_BASE_URLS`, tìm exact Java UTF field `struct.pack(">H", len(old)) + old` và thay bằng field có length prefix mới.
5. Cho phép source đã là target; trường hợp không có thay đổi thì trả đúng object `data` để caller nhận biết no-op.
6. XOR encode lại khi có ít nhất một replacement và log số URL, base target, old/new payload length.

Cached `cached_chip_config.bin` hiện chứa bốn URL `http://127.0.0.1:8643/...`, không còn `chip.vcdn.io.vn`; vì vậy chỉ check hostname `chip.vcdn.io.vn` là không đủ và phải bị loại bỏ.

- [x] **Step 3: Rewrite config trước khi trả cache hoặc online response**

Trong `Handler._proxy()`:

```python
if cache_file is not None and cache_file.exists():
    data = cache_file.read_bytes()
    if cache_file == CACHED_CONFIG:
        data = _patch_chip_config(data, PUBLIC_BASE_URL)
    self._send_bytes(data)
    ...
```

Online fallback cũng gọi `_patch_chip_config(data, PUBLIC_BASE_URL)` và log target thật thay vì hard-code `127.0.0.1:8643`.

- [x] **Step 4: Thêm CLI flag và secure bind default**

Trong `main()`:

```python
global MODEL_PATH, ORIGIN, PUBLIC_BASE_URL
...
ap.add_argument("--host", default="127.0.0.1")
ap.add_argument("--public-base-url", default=DEFAULT_PUBLIC_BASE_URL)
...
PUBLIC_BASE_URL = _normalize_base_url(args.public_base_url)
```

Startup log phải in `host`, `port`, `origin` và `public base`; bỏ message hard-code “bind 0.0.0.0”.

- [x] **Step 5: Verify resolver config rewrite tập trung**

Run:

```bash
python3 -m py_compile captcha-solver/solver_server.py captcha-solver/src/predict.py

.venv-captcha312/bin/python captcha-solver/solver_server.py \
  --host 127.0.0.1 \
  --port 18643 \
  --public-base-url https://avt3xauto.duckdns.org/api/solver/
```

Expected startup log chứa:

```text
127.0.0.1:18643
https://avt3xauto.duckdns.org/api/solver/
```

GET `/health` phải trả `ok`; GET `/` phải trả payload non-empty và sẽ được decode/assert đầy đủ ở Task 6.

- [x] **Step 6: Commit checkpoint — deferred**

Suggested commit message sau final approval: `fix: prepare captcha resolver for production`.

---

### Task 3: Thêm Express Raw Binary Solver Proxy

**Files:**
- Create: `avatar-web/server/src/game/captchaSolverProxy.ts`
- Modify: `avatar-web/server/src/index.ts:1-29`

**Interfaces:**
- Consumes: Express `RequestHandler`, Node `http.request`, mounted `req.url`, upstream `http://127.0.0.1:8643`.
- Produces: `CaptchaSolverProxyOptions` và `captchaSolverProxy()` tại public route `/api/solver/*`.

- [x] **Step 1: Implement proxy interface và defaults**

Create module với public contract:

```ts
export interface CaptchaSolverProxyOptions {
  upstreamOrigin?: string;
  maxBodyBytes?: number;
  timeoutMs?: number;
}

export function captchaSolverProxy(
  options: CaptchaSolverProxyOptions = {},
): RequestHandler;
```

Defaults:

```ts
const DEFAULT_UPSTREAM_ORIGIN = 'http://127.0.0.1:8643';
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);
```

- [x] **Step 2: Enforce method/body guards trước upstream**

Middleware behavior:

1. Method ngoài `GET`, `HEAD`, `POST` trả `405`, header `Allow: GET, HEAD, POST`, body rỗng.
2. Parse `Content-Length` khi có; non-finite/negative trả `400`, lớn hơn 2 MiB trả `413` trước khi tạo upstream request.
3. Với body chunked, đếm bytes ở `data`; khi vượt limit, destroy upstream request, ngừng nhận request body và trả `413` nếu response chưa gửi.
4. Không gọi `express.raw()`, `express.json()` hoặc `express.urlencoded()` trong module.

- [x] **Step 3: Forward raw request và binary response**

Implementation phải:

- Dùng `new URL(req.url, normalizedUpstreamOrigin)`; do middleware mount tại `/api/solver`, `req.url` đã strip prefix và giữ query string.
- Forward `Content-Type`, `User-Agent`, `Accept` khi tồn tại; set `Host` theo upstream URL và `Connection: close`.
- Stream request chunks trực tiếp vào `http.request()`; gọi `end()` ở downstream `end`.
- Set timeout bằng `upstreamRequest.setTimeout(timeoutMs, ...)`; timeout/network error trả `502` với body rỗng.
- Copy status code và chỉ copy `Content-Type`, `Content-Length`; không forward hop-by-hop headers.
- Pipe upstream response byte-for-byte; với `HEAD`, kết thúc response mà không ghi body.
- Khi downstream đóng trước khi hoàn tất, destroy upstream request/response để không bỏ inference chạy mồ côi.
- Chỉ gửi một response: mọi error/oversize path phải guard bằng `res.headersSent`/`res.writableEnded`.

- [x] **Step 4: Mount proxy trước parsers**

Trong `index.ts` import module và giữ đúng order:

```ts
app.use('/api/solver', captchaSolverProxy());
app.use('/api/captcha', captchaRouter());
app.use(express.json());
```

- [x] **Step 5: Verify TypeScript**

Run:

```bash
cd avatar-web/server
npm run typecheck
```

Expected: TypeScript strict mode pass; không thay đổi route behavior ngoài `/api/solver`.

- [x] **Step 6: Commit checkpoint — deferred**

Suggested commit message sau final approval: `feat: proxy captcha solver through avatar web`.

---

### Task 4: Extend GitHub Actions Và PM2 Deployment

**Files:**
- Modify: `.github/workflows/deploy.yml:18-126`

**Interfaces:**
- Consumes: Repository secrets hiện có, full repository checkout tại `TARGET_DIR`, Python 3, PM2, Nginx route tới `avatar-web`.
- Produces: Reproducible venv, PM2 process `captcha-solver`, local/public health gates, saved PM2 process list.

- [x] **Step 1: Harden remote deploy script và validate solver files**

Đổi remote heredoc sang `set -euo pipefail`. Sau `git reset --hard origin/main`, define:

```bash
SOLVER_ROOT="$TARGET_DIR/captcha-solver"
SOLVER_VENV="$TARGET_DIR/.venv-captcha"
PUBLIC_SOLVER_URL="https://avt3xauto.duckdns.org/api/solver/"

test -f "$SOLVER_ROOT/solver_server.py"
test -f "$SOLVER_ROOT/requirements-runtime.txt"
test -f "$SOLVER_ROOT/checkpoints/crnn_ctc.pt"
test -f "$SOLVER_ROOT/data/cached_chip_config.bin"
test -f "$SOLVER_ROOT/data/cached_data_php.bin"
test -f "$SOLVER_ROOT/data/cached_teacher_php.bin"
```

Workflow phải fail ngay với message rõ ràng nếu checkout thiếu runtime asset.

- [x] **Step 2: Create/reuse venv và install pinned runtime**

Run trên VPS; nếu Debian/Ubuntu thiếu `python3-venv`, dùng PyPA virtualenv zipapp
theo đúng Python minor để không cần quyền `sudo`:

```bash
if ! python3 -m venv "$SOLVER_VENV"; then
  PYTHON_MINOR=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  VIRTUALENV_PYZ="$TARGET_DIR/.cache/virtualenv-${PYTHON_MINOR}.pyz"
  mkdir -p "$TARGET_DIR/.cache"
  curl --fail --silent --show-error --location \
    "https://bootstrap.pypa.io/virtualenv/${PYTHON_MINOR}/virtualenv.pyz" \
    -o "$VIRTUALENV_PYZ"
  python3 "$VIRTUALENV_PYZ" --clear "$SOLVER_VENV"
fi
"$SOLVER_VENV/bin/python" -m pip install --upgrade pip
"$SOLVER_VENV/bin/python" -m pip install \
  -r "$SOLVER_ROOT/requirements-runtime.txt"
```

In runtime versions sau install:

```bash
"$SOLVER_VENV/bin/python" -c \
  "import sys, torch, numpy, PIL; print(sys.version); print(torch.__version__, numpy.__version__, PIL.__version__)"
```

- [x] **Step 3: Start resolver bằng PM2 và gate local health**

Run:

```bash
cd "$SOLVER_ROOT"
pm2 delete captcha-solver >/dev/null 2>&1 || true
pm2 start solver_server.py \
  --name captcha-solver \
  --interpreter "$SOLVER_VENV/bin/python" \
  -- \
  --host 127.0.0.1 \
  --port 8643 \
  --public-base-url "$PUBLIC_SOLVER_URL"

curl --fail --silent --show-error \
  --retry 12 --retry-delay 2 --retry-all-errors \
  http://127.0.0.1:8643/health
```

Nếu health fail, print `pm2 logs captcha-solver --lines 120 --nostream` rồi exit non-zero.

- [x] **Step 4: Build/reload avatar-web và gate public proxy**

Giữ Node deploy hiện có, nhưng `pm2 save` phải được dời khỏi ngay sau `avatar-web` reload. Sau backend reload:

```bash
curl --fail --silent --show-error \
  --retry 12 --retry-delay 2 --retry-all-errors \
  "${PUBLIC_SOLVER_URL}health"
```

Nếu public health fail, print cả `avatar-web` và `captcha-solver` logs rồi exit non-zero.

- [x] **Step 5: Build frontend, save PM2 và print status**

Sau khi frontend build và cả health gates pass:

```bash
pm2 save
pm2 status
```

Expected: `avatar-web` và `captcha-solver` đều `online`; process list chỉ được persist sau deploy thành công.

- [x] **Step 6: Validate workflow syntax/diff**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy.yml"); puts "workflow yaml ok"'
git diff --check -- .github/workflows/deploy.yml
```

- [x] **Step 7: Commit checkpoint — deferred**

Suggested commit message sau final approval: `ci: deploy captcha resolver with pm2`.

---

### Task 5: Generate Production JAR Và Document Operations

**Files:**
- Modify: `tools/jar/patch_jar.py:1-18`
- Modify: `tools/jar/patch_jar.py:206-214`
- Modify: `captcha-solver/README.md`
- Update: `avatar-jar/avatar-auto-patched.jar`
- Create: `avatar-jar/avatar-auto-production.jar`
- Preserve/release: `docs/protocol/az-ocr-notes.md`
- Preserve/release: `docs/superpowers/specs/2026-08-29-bypass-ocr-gate-jar-patch-design.md`
- Preserve/release: `docs/superpowers/plans/2026-08-29-bypass-ocr-gate-jar-patch.md`

**Interfaces:**
- Consumes: Existing `patch_config()`, approved `patch_fj_bytecode()` direct `az.if()` patch, production solver base URL.
- Produces: Reproducible local/production JAR outputs và operator documentation.

- [x] **Step 1: Make patch CLI explicit for local/production outputs**

Update module docstring để không mô tả tool là local-only. Trong `main()`:

- Thêm `description` cho `ArgumentParser`.
- Thêm help text cho `--url` và `--out`.
- Normalize `args.url` bằng `rstrip("/") + "/"` trước `patch_config()`.
- Print target URL và absolute output path trước khi repack.
- Giữ default `DEFAULT_URL` và `JAR_OUT`, không đổi default local behavior.

- [x] **Step 2: Regenerate local rollback JAR**

Run:

```bash
python3 tools/jar/patch_jar.py \
  --url http://127.0.0.1:8643/ \
  --out avatar-jar/avatar-auto-patched.jar
```

Expected: Output local JAR tiếp tục chứa direct `az.if()` bytecode fix và URL local.

- [x] **Step 3: Generate production JAR**

Run:

```bash
python3 tools/jar/patch_jar.py \
  --url https://avt3xauto.duckdns.org/api/solver/ \
  --out avatar-jar/avatar-auto-production.jar
```

Expected: File production được tạo riêng; `avatar-auto-patched.jar` không bị ghi đè bởi command này.

- [x] **Step 4: Verify embedded URL và bytecode patch**

Use `parse_archive()` + Base64 decode để assert key `2`:

```bash
python3 - <<'PY'
import base64
from pathlib import Path
from zipfile import ZipFile
from tools.jar.patch_jar import CONFIG_ENTRY, RES, parse_archive

jar_path = Path("avatar-jar/avatar-auto-production.jar")
with ZipFile(jar_path) as jar:
    entries, _ = parse_archive(jar.read(RES))
config = dict(entries)[CONFIG_ENTRY]
text = base64.b64decode(config).decode("utf-8")
assert "2=https://avt3xauto.duckdns.org/api/solver/" in text, text
print("production jar URL ok")
PY
```

Extract `fJ.class` và run `javap -c -p -v`; expected constant pool có `Methodref az.if:()V` và hai direct `invokevirtual` sites, không có `VerifyError` khi MicroEmulator load JAR.

- [x] **Step 5: Update resolver README**

Document:

- Local start command và local JAR.
- Production PM2 command, loopback bind và public proxy URL.
- Runtime asset list và pinned requirements.
- Local/public health commands.
- Production JAR generation command.
- Rollback về `avatar-auto-patched.jar` local.
- Lưu ý production deploy đi qua GitHub Actions vì local SSH key không được VPS chấp nhận.

- [x] **Step 6: Commit checkpoint — deferred**

Suggested commit message sau final approval: `build: publish production captcha solver jar`.

---

### Task 6: Run Focused Validation Và GitNexus Change Detection

**Files:**
- Modify: `docs/superpowers/plans/2026-08-29-deploy-captcha-resolver.md` (tick completed steps)
- Verify only: toàn bộ release scope; không tạo test file.

**Interfaces:**
- Consumes: Resolver port `18643`, ephemeral proxy port `18787`, một PNG captcha local, generated production JAR.
- Produces: Compile/typecheck/test/smoke evidence và blast-radius report trước staging.

- [x] **Step 1: Run static validation và existing test suite**

Run:

```bash
python3 -m py_compile captcha-solver/solver_server.py tools/jar/patch_jar.py

cd avatar-web/server
npm run typecheck
npm test
cd ../..

git diff --check -- \
  .github/workflows/deploy.yml \
  .gitignore \
  avatar-web/server/src/game/captchaSolverProxy.ts \
  avatar-web/server/src/index.ts \
  captcha-solver \
  tools/jar/patch_jar.py \
  docs/superpowers/specs/2026-08-29-deploy-captcha-resolver-design.md \
  docs/superpowers/plans/2026-08-29-deploy-captcha-resolver.md
```

Nếu existing suite fail do unrelated working-tree changes, lưu exact failing command/output và không sửa ngoài release scope.

- [x] **Step 2: Start resolver trên port tạm và verify config**

Start resolver background với log riêng:

```bash
.venv-captcha312/bin/python captcha-solver/solver_server.py \
  --host 127.0.0.1 \
  --port 18643 \
  --public-base-url https://avt3xauto.duckdns.org/api/solver/ \
  >/tmp/captcha-resolver-production-smoke.log 2>&1 &
SOLVER_PID=$!
```

Run health/config assertions:

```bash
curl -fsS http://127.0.0.1:18643/health
curl -fsS http://127.0.0.1:18643/ -o /tmp/captcha-production-config.bin

.venv-captcha312/bin/python - <<'PY'
from pathlib import Path

key = b"NguyenHuuQuyet"
raw = Path("/tmp/captcha-production-config.bin").read_bytes()
decoded = bytes(value ^ key[index % len(key)] for index, value in enumerate(raw))
base = b"https://avt3xauto.duckdns.org/api/solver/"
for suffix in (
    b"avatar/full/data.php",
    b"avatar/full/captcha.php",
    b"avatar/teacher.php",
    b"avatar/avdata.php?_t=",
):
    assert base + suffix in decoded, suffix
assert b"127.0.0.1:8643" not in decoded
assert b"chip.vcdn.io.vn" not in decoded
print("production config rewrite ok")
PY
```

- [x] **Step 3: Replay a real captcha directly**

Generate the JAR-format bitmap body from one existing local PNG:

```bash
.venv-captcha312/bin/python - <<'PY'
import sys
from pathlib import Path

sys.path.insert(0, "captcha-solver")
from src.captcha_io import load_alpha_binary

image = sorted(Path("avatar-web/server/captcha-dataset").glob("*.png"))[0]
alpha = load_alpha_binary(image)
jar_bitmap = 1 - alpha
Path("/tmp/captcha-production-body.txt").write_text(
    "_ab3=" + "".join(str(int(value)) for value in jar_bitmap.reshape(-1)),
    encoding="ascii",
)
print(image)
PY

curl -fsS \
  -X POST \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/captcha-production-body.txt \
  http://127.0.0.1:18643/avatar/full/captcha.php \
  -o /tmp/captcha-direct-response.bin

.venv-captcha312/bin/python - <<'PY'
from pathlib import Path

payload = Path("/tmp/captcha-direct-response.bin").read_bytes()
assert len(payload) == 8, payload.hex()
assert payload[:4] == b"\x01\x00\x00\x04", payload.hex()
assert payload[4:].isdigit(), payload.hex()
print(payload.hex(), payload[4:].decode("ascii"))
PY
```

- [x] **Step 4: Smoke raw Express proxy byte-for-byte**

Trong `avatar-web/server`, start một ephemeral Express app bằng inline script, mount `captchaSolverProxy({ upstreamOrigin: 'http://127.0.0.1:18643' })` tại `/api/solver`, listen `127.0.0.1:18787`, rồi run:

```bash
curl -fsS http://127.0.0.1:18787/api/solver/health
curl -fsS http://127.0.0.1:18787/api/solver/ \
  -o /tmp/captcha-proxy-config.bin
cmp /tmp/captcha-production-config.bin /tmp/captcha-proxy-config.bin

curl -fsS \
  -X POST \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @/tmp/captcha-production-body.txt \
  http://127.0.0.1:18787/api/solver/avatar/full/captcha.php \
  -o /tmp/captcha-proxy-response.bin

cmp /tmp/captcha-direct-response.bin /tmp/captcha-proxy-response.bin
```

Also verify `PUT` returns `405` and a generated body of `2097153` bytes returns `413` without reaching resolver logs.

- [x] **Step 5: Verify both JARs load**

Run MicroEmulator separately with local and production JARs. Expected:

- Cả hai load không `VerifyError`.
- Local JAR vẫn trỏ `127.0.0.1:8643`.
- Production JAR trỏ HTTPS public base.
- Direct `az.if()` patch vẫn tồn tại trong cả hai JARs.

- [x] **Step 6: Run GitNexus pre-stage analysis**

Run:

```bash
npx gitnexus detect-changes --repo learning-reverse --scope all --limit 200
```

Report changed symbols/flows thuộc resolver/proxy/deploy. Phân biệt rõ các unrelated working-tree changes đã có sẵn; không kết luận release scope sạch chỉ từ `scope all`.

- [x] **Step 7: Stop ephemeral processes và record evidence**

Kill `SOLVER_PID` và proxy PID bằng `trap`/explicit `kill`; lưu relevant tail của `/tmp/captcha-resolver-production-smoke.log`. Tick các checkbox đã thực hiện trong plan.

- [x] **Step 8: Commit checkpoint — deferred**

Không commit cho tới Task 7 và user approval riêng.

---

### Task 7: Commit, Push, Deploy Và Verify Production

**Files:**
- Stage only: release allowlist bên dưới.
- Exclude: mọi unrelated account/session/db/persist-quest changes.

**Interfaces:**
- Consumes: User approval, verified release artifacts, repository secrets `SERVER_SSH_KEY` và deploy workflow.
- Produces: Commit trên `main`, successful GitHub Actions deployment, public resolver health/config và live JAR handoff.

- [x] **Step 1: Present final diff và request explicit commit/push approval**

Run before asking approval:

```bash
git status --short
git log --oneline origin/main..main
git diff --stat -- \
  .github/workflows/deploy.yml \
  .gitignore \
  avatar-web/server/src/game/captchaSolverProxy.ts \
  avatar-web/server/src/index.ts \
  avatar-jar/avatar-auto-patched.jar \
  avatar-jar/avatar-auto-production.jar \
  captcha-solver \
  tools/jar/patch_jar.py \
  docs/protocol/az-ocr-notes.md \
  docs/superpowers/specs/2026-08-29-bypass-ocr-gate-jar-patch-design.md \
  docs/superpowers/plans/2026-08-29-bypass-ocr-gate-jar-patch.md \
  docs/superpowers/specs/2026-08-29-deploy-captcha-resolver-design.md \
  docs/superpowers/plans/2026-08-29-deploy-captcha-resolver.md
```

Explicitly state that `git push origin main` will also publish the 27 commits already ahead of `origin/main`. Wait for user confirmation; plan approval alone is not commit/push approval.

- [x] **Step 2: Stage exact release allowlist**

After approval only:

```bash
git add -- \
  .github/workflows/deploy.yml \
  .gitignore \
  avatar-web/server/src/game/captchaSolverProxy.ts \
  avatar-web/server/src/index.ts \
  avatar-jar/avatar-auto-patched.jar \
  avatar-jar/avatar-auto-production.jar \
  captcha-solver/README.md \
  captcha-solver/requirements-runtime.txt \
  captcha-solver/solver_server.py \
  captcha-solver/src/predict.py \
  captcha-solver/checkpoints/crnn_ctc.pt \
  captcha-solver/data/cached_chip_config.bin \
  captcha-solver/data/cached_data_php.bin \
  captcha-solver/data/cached_teacher_php.bin \
  tools/jar/patch_jar.py \
  docs/protocol/az-ocr-notes.md \
  docs/superpowers/specs/2026-08-29-bypass-ocr-gate-jar-patch-design.md \
  docs/superpowers/plans/2026-08-29-bypass-ocr-gate-jar-patch.md \
  docs/superpowers/specs/2026-08-29-deploy-captcha-resolver-design.md \
  docs/superpowers/plans/2026-08-29-deploy-captcha-resolver.md
```

- [x] **Step 3: Run mandatory staged GitNexus scope check**

Run:

```bash
git diff --cached --name-status
git diff --cached --check
npx gitnexus detect-changes --repo learning-reverse --scope staged --limit 200
```

Expected:

- Staged file list đúng allowlist.
- Không có account/session/db/persist-quest files.
- GitNexus affected symbols/flows chỉ thuộc captcha resolver, solver proxy, JAR patch/release docs và deployment workflow.
- Tất cả direct dependants từ impact analysis đã được cập nhật: `Handler._proxy`, `do_GET`, `do_POST`, solver entrypoint.

Nếu staged scope sai, run `git restore --staged <unexpected-path>`; không sửa hoặc discard working-tree content.

- [x] **Step 4: Commit**

Run only after staged scope passes:

```bash
git commit -m "feat: deploy production captcha resolver"
```

- [x] **Step 5: Push main và monitor GitHub Actions**

Run:

```bash
git push origin main
gh run list --workflow deploy.yml --branch main --limit 1
gh run watch --exit-status
```

Select/watch the run whose `headSha` equals the just-pushed commit. If workflow fails, capture failing step/log and stop; không retry mù hoặc sửa ngoài plan.

- [x] **Step 6: Verify public production endpoint**

Run:

```bash
curl --fail --silent --show-error \
  https://avt3xauto.duckdns.org/api/solver/health

curl --fail --silent --show-error \
  https://avt3xauto.duckdns.org/api/solver/ \
  -o /tmp/captcha-production-live-config.bin

wc -c /tmp/captcha-production-live-config.bin
```

Expected: health `ok`; config lớn hơn 1,000 bytes. Decode XOR và assert bốn URL production, không còn `127.0.0.1` hoặc `chip.vcdn.io.vn` như Task 6.

- [ ] **Step 7: Verify PM2 evidence và live JAR E2E**

Confirm GitHub Actions logs show both PM2 processes `online`. Open `avatar-jar/avatar-auto-production.jar` trên máy không chạy local resolver, trigger captcha, và verify game thoát “Xin chờ” hoặc nhận captcha mới nếu OCR answer sai.

Because local SSH key is not accepted by VPS, runtime request evidence must come from GitHub Actions logs/public health unless user supplies a valid SSH credential in a separate request.

Automated evidence completed: PM2 reports both processes online, production JAR embeds the HTTPS base and loads in MicroEmulator, and a real captcha bitmap passed through the public endpoint. Manual in-game captcha triggering remains the final user smoke check.

- [x] **Step 8: Update GitNexus index after commit**

Current `.gitnexus/meta.json` has `stats.embeddings = 0`, so run:

```bash
npx gitnexus analyze
```

Expected: index points to deployed commit; no `--embeddings` flag is needed.
