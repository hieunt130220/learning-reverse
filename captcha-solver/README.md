# Avatar Captcha Solver

Train model **CRNN + CTC** (PyTorch, CPU) nhận ảnh captcha game Avatar → chuỗi ký tự.

- Ảnh captcha: PNG **100x15 RGBA**, chữ nằm ở **kênh alpha** (RGB toàn đen).
- Nhãn: chuỗi dạng `sốĐtừ` (VD: `1Đnai`, `2Đbay`).
- Dataset nguồn: `avatar-web/server/captcha-dataset/` (thu bằng `captcha-collector`).

## Môi trường

Python 3.12 + PyTorch CPU (đã chuẩn bị sẵn venv):

```bash
cd /Users/hieunt/learning-reverse
PY=.venv-captcha312/bin/python       # đã cài torch/pillow/numpy
$PY -c "import torch, PIL, numpy; print('ok')"
```

## Chạy Resolver API

Runtime production dùng `requirements-runtime.txt` với Python 3.10.12 trên VPS,
PyTorch CPU 2.13.0, NumPy 2.2.6 và Pillow 12.3.0. Local training/debug vẫn
dùng Python 3.12. Resolver cần bốn assets:

- `checkpoints/crnn_ctc.pt`
- `data/cached_chip_config.bin`
- `data/cached_data_php.bin`
- `data/cached_teacher_php.bin`

Chạy local cho MicroEmulator/JAR local:

```bash
cd /Users/hieunt/learning-reverse
.venv-captcha312/bin/python captcha-solver/solver_server.py \
  --host 127.0.0.1 \
  --port 8643 \
  --public-base-url http://127.0.0.1:8643/

curl -fsS http://127.0.0.1:8643/health
```

Trên production, resolver chỉ bind loopback và được public qua raw proxy của
`avatar-web`:

```text
https://avt3xauto.duckdns.org/api/solver/
  -> avatar-web
  -> http://127.0.0.1:8643/
```

PM2 command tương ứng:

```bash
pm2 start captcha-solver/solver_server.py \
  --name captcha-solver \
  --interpreter /var/www/avatar-web/.venv-captcha/bin/python \
  -- \
  --host 127.0.0.1 \
  --port 8643 \
  --public-base-url https://avt3xauto.duckdns.org/api/solver/
```

Health checks:

```bash
curl -fsS http://127.0.0.1:8643/health
curl -fsS https://avt3xauto.duckdns.org/api/solver/health
```

Production được deploy bằng `.github/workflows/deploy.yml` và repository secret
`SERVER_SSH_KEY`; SSH key trên máy local hiện không được VPS chấp nhận.

## Build JAR Resolver

Giữ hai output riêng để rollback nhanh:

```bash
# Local resolver
python3 tools/jar/patch_jar.py \
  --url http://127.0.0.1:8643/ \
  --out avatar-jar/avatar-auto-patched.jar

# Production resolver
python3 tools/jar/patch_jar.py \
  --url https://avt3xauto.duckdns.org/api/solver/ \
  --out avatar-jar/avatar-auto-production.jar
```

- Dùng `avatar-auto-production.jar` khi không chạy resolver local.
- Rollback về `avatar-auto-patched.jar` để debug với resolver trên máy hiện tại.

## Pipeline (6 bước)

```bash
cd captcha-solver

# Bước 1 — GÁN NHÃN (bắt buộc, human-in-the-loop)
$PY label_tool.py --dataset ../avatar-web/server/captcha-dataset \
                  --out data/labels.csv
# → mở http://localhost:8641, gõ nhãn từng ảnh, bấm "Save all".

# Bước 2 (tùy chọn) — trích thư viện glyph font bitmap từ nhãn
$PY -m src.library build --dataset ../avatar-web/server/captcha-dataset \
        --labels data/labels.csv --out data/library.json --min-group 2
$PY -m src.library dump --lib data/library.json   # review glyph ASCII
$PY -m src.library decode --lib data/library.json --image <ảnh>  # DP decode thử

# Bước 3 — TRAIN
$PY -m src.train \
    --dataset ../avatar-web/server/captcha-dataset \
    --labels data/labels.csv \
    --out checkpoints/crnn_ctc.pt \
    --epochs 40 --batch-size 32

# Bước 4 — ĐÁNH GIÁ (exact-match + per-char trên toàn bộ labels)
$PY -m src.evaluate \
    --dataset ../avatar-web/server/captcha-dataset \
    --labels data/labels.csv \
    --ckpt checkpoints/crnn_ctc.pt

# Bước 5 — PREDICT
$PY -m src.predict --image ../avatar-web/server/captcha-dataset/<file>.png \
    --ckpt checkpoints/crnn_ctc.pt
# hay --dir để predict hàng loạt

# Bước 6 — Dùng API trong code
# from src.predict import load_model, predict_image
# model, charset = load_model("checkpoints/crnn_ctc.pt")
# text, conf = predict_image("anh.png", model, charset)
```

## Ý tưởng & hạn chế đã phát hiện

- Font bitmap **cố định** nhưng các ký tự **đè/keo dính nhau** (digit + Đ merge, kerning âm)
  → project theo cột không tách được glyph; model CRNN+CTC end-to-end là hướng đúng.
- `segment.py` (font library + majority-vote + DP-decode) là **công cụ hỗ trợ**, không bắt buộc
  cho training. Dùng khi cần auto-label/xác minh.
- Tesseract OCR không đọc được font này. EasyOCR chưa khả dụng do xung đột torchvision.
- **Chất lượng phụ thuộc nhãn**: càng nhiều nhãn (đặc biệt đủ 10 chữ số + chữ cái + dấu),
  model càng chính xác. Đã verify pipeline chạy đúng trên seed 2 nhãn.

## Files

| File | Vai trò |
|---|---|
| `label_tool.py` | Web gán nhãn (stdlib `http.server`, localhost:8641) |
| `src/captcha_io.py` | Load PNG → binary từ kênh alpha, dedupe hash |
| `src/denoise.py` | Khử nhiễu pixel cô lập (8-connectivity) |
| `src/library.py` | Font glyph library: majority-vote, DP-match, CLI build/dump/decode |
| `src/segment.py` | Re-export cho plan cũ (`-m src.segment`) |
| `src/charset.py` | Charset + encode/decode CTC |
| `src/model.py` | CRNN (CNN→BiLSTM→CTC head), input 100x15 → (B, 25, C) |
| `src/dataset.py` | Dataset + augmentation (dịch, nhiễu, erode/dilate) |
| `src/train.py` | Vòng lặp CTC training, lưu checkpoint kèm charset |
| `src/predict.py` | Suy luận (greedy decode) |
| `src/evaluate.py` | Bảng đánh giá exact-match + per-char |
| `solver_server.py` | HTTP solver, offline cache và config URL rewrite |
| `requirements-runtime.txt` | Runtime dependencies pin cho VPS production |
