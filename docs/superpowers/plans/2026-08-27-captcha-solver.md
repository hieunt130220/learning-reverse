# Avatar Captcha Solver Implementation Plan

> **Status (2026-08-28):** Tasks 1–3, 5–10 hoàn thành theo hướng triển khai đã linh hoạt
> (chi tiết ở dưới). **Task 4 (gán nhãn 24+ ảnh) là GATE DUY NHẤT còn lại do user thực hiện**
> — chạy `captcha-solver/label_tool.py`, gõ nhãn, bấm Save all, rồi `train` để đạt mục tiêu.
>
> **Điều chỉnh so với plan gốc:** synthetic generator (`Task 6`) KHÔNG dùng cho training vì
> glyphs đè nhau không tách được (đã chứng minh bằng đo lường). Thay bằng train trực tiếp
> trên ảnh thật + augmentation (dịch, nhiễu, erode/dilate). `src.library` giữ vai trò công cụ
> hỗ trợ (build/dump/decode), không bắt buộc. Tesseract/EasyOCR không đọc được font này.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline Python train model CRNN+CTC giải captcha game Avatar (ảnh 100x15 RGBA, chữ ở kênh alpha, dạng `số+Đ+từ tiếng Việt`) → xuất chuỗi ký tự.

**Architecture:** Human gán nhãn 24 ảnh thật qua label tool → trích glyph template (font bitmap thật) → sinh unlimited dữ liệu synthetic mô phỏng font+nhiễu thật → train CRNN+CTC (PyTorch CPU) → predict/evaluate CLI.

**Tech Stack:** Python 3.12 (uv venv `.venv-captcha312`), PyTorch 2.13 CPU, Pillow, NumPy. Label tool dùng `http.server` stdlib.

**Spec:** `docs/superpowers/specs/2026-08-27-captcha-solver-design.md`

## Global Constraints

- Toàn bộ code mới nằm trong `captcha-solver/`, KHÔNG sửa file hiện có của repo.
- Chạy Python bằng `.venv-captcha312/bin/python` (torch đã cài sẵn; tuyệt đối không cài package vào Python hệ thống 3.14).
- Không viết unit test (AGENTS.md: chỉ viết test khi user yêu cầu).
- Không TDD; mỗi task viết production code rồi verify bằng lệnh CLI.
- Commit theo từng task, message dạng `feat(captcha-solver): ...`.
- Ảnh captcha: 100x15, binary từ kênh alpha (`alpha > 0`), text = 1, nền = 0.

## Dataset nguồn

- Ảnh: `avatar-web/server/captcha-dataset/*.png` (25 file, 24 unique theo hash kênh alpha — file `captcha-20260827-214053-485-46f9e1-j2me.png` trùng với file đầu tiên).

---

### Task 1: Scaffold dự án `captcha-solver/`

**Files:**
- Create: `captcha-solver/requirements.txt`
- Create: `captcha-solver/README.md` (khung, cập nhật nội dung ở Task 10)
- Create: `captcha-solver/src/__init__.py` (rỗng)
- Create: `captcha-solver/data/.gitkeep`, `captcha-solver/checkpoints/.gitkeep`

**Interfaces:**
- Produces: cấu trúc thư mục cho các task sau.

- [ ] **Step 1: Tạo cây thư mục + requirements.txt**

```
captcha-solver/
├── requirements.txt      # torch, pillow, numpy (đã cài trong .venv-captcha312)
├── README.md
├── label_tool.py
├── src/{__init__.py,captcha_io.py,denoise.py,segment.py,synthetic.py,
│        charset.py,model.py,dataset.py,train.py,predict.py,evaluate.py}
├── data/                 # labels.csv, templates.json, wordlist.txt (sinh runtime)
└── checkpoints/          # crnn_ctc.pt (sinh runtime)
```

`requirements.txt`:
```
--index-url https://download.pytorch.org/whl/cpu
torch>=2.0
pillow>=10.0
numpy>=1.24
```

- [ ] **Step 2: Verify** Run: `ls -R captcha-solver && .venv-captcha312/bin/python -c "import torch, PIL, numpy; print('env OK')"`
  Expected: cây thư mục đúng, in `env OK`.

- [ ] **Step 3: Commit** `git commit -m "feat(captcha-solver): scaffold project structure"`

---

### Task 2: IO ảnh + denoise (`captcha_io.py`, `denoise.py`)

**Files:**
- Create: `captcha-solver/src/captcha_io.py`
- Create: `captcha-solver/src/denoise.py`

**Interfaces:**
- Produces:
  - `captcha_io.load_alpha_binary(path) -> np.ndarray` (uint8 0/1, shape (15,100))
  - `captcha_io.alpha_sha256(arr) -> str` (dedupe ảnh trùng)
  - `captcha_io.list_dataset_images(dataset_dir) -> list[str]` (đường dẫn .png sort tên)
  - `denoise.remove_isolated_noise(arr, min_neighbors=2, iterations=2) -> np.ndarray`
  - `denoise.noise_mask(original, denoised) -> np.ndarray` (mask pixel bị loại = nhiễu)

- [ ] **Step 1: Viết `captcha_io.py`** — dùng PIL: `np.array(Image.open(path))[:, :, 3] > 0` → uint8. `alpha_sha256` hash `arr.tobytes()`.
- [ ] **Step 2: Viết `denoise.py`** — đếm láng giềng 8-conn bằng `np.pad` + cộng 8 lát cắt dịch; pixel on có số láng giềng `< min_neighbors` → off; lặp `iterations` lần.
- [ ] **Step 3: Verify** Run: `.venv-captcha312/bin/python -c "import sys; sys.path.insert(0,'captcha-solver'); from src.captcha_io import *; from src.denoise import *; a=load_alpha_binary('captcha-solver/../avatar-web/server/captcha-dataset/captcha-20260827-213938-641-46f9e1-j2me.png'); d=remove_isolated_noise(a); print(a.shape, a.sum(), d.sum(), noise_mask(a,d).sum())"`
  Expected: `(15, 100)`, `a.sum()` ~317, `d.sum()` nhỏ hơn (~250-280), noise count > 0.

- [ ] **Step 4: Commit** `git commit -m "feat(captcha-solver): alpha binary IO and isolated-noise denoiser"`

---

### Task 3: Label tool HTTP (`label_tool.py`)

**Files:**
- Create: `captcha-solver/label_tool.py`

**Interfaces:**
- Consumes: `captcha_io.list_dataset_images`, `captcha_io.load_alpha_binary`, `captcha_io.alpha_sha256`
- Produces: `captcha-solver/data/labels.csv` (cột `filename,label`), trang web `http://localhost:8641`

- [ ] **Step 1: Viết HTTP server stdlib**
  - `GET /` → HTML một trang: render lần lượt từng ảnh (embed base64 PNG, **vẽ binary lên nền trắng, upscale x8 NEAREST** từ kênh alpha), ô input value = nhãn hiện có, nút Save từng dòng + Save all.
  - Ảnh trùng hash chỉ hiện 1 lần (dedupe bằng `alpha_sha256`).
  - `POST /save` body JSON `[{filename,label}]` → ghi `data/labels.csv` (UTF-8) + response ok.
  - Cổng 8641, bind `127.0.0.1`; in URL ra console; Ctrl+C thoát.
  - Validate label: regex `^[0-9]{1,2}Đ[a-zà-ỹđ]+$` (cảnh báo vàng nếu lệch, không chặn).

- [ ] **Step 2: Verify** Run: `.venv-captcha312/bin/python captcha-solver/label_tool.py --dataset avatar-web/server/captcha-dataset --out captcha-solver/data/labels.csv` rồi mở `http://localhost:8641` — thấy 24 ảnh upscale rõ ràng; Save → labels.csv được ghi đúng số dòng.

- [ ] **Step 3: Commit** `git commit -m "feat(captcha-solver): browser labeling tool over stdlib http.server"`

---

### Task 4: [USER GATE] Gán nhãn 24 ảnh

**Files:**
- Modify: `captcha-solver/data/labels.csv` (24 dòng)

**Interfaces:**
- Consumes: label tool từ Task 3
- Produces: `labels.csv` hoàn chỉnh — input bắt buộc của Task 5

- [ ] **Step 1: Hỗ trợ pre-fill**: Agent đọc ảnh (render upscale) điền nhãn dự đoán ban đầu vào labels.csv để user chỉ cần soát/sửa.
- [ ] **Step 2: User chạy label tool, soát từng ảnh, sửa sai (đặc biệt các ký tự có dấu), bấm Save all.**
- [ ] **Step 3: Verify** Run: `.venv-captcha312/bin/python -c "import csv;rows=list(csv.reader(open('captcha-solver/data/labels.csv')));print(len(rows)-1,'labels');[print(r) for r in rows[1:]]"`
  Expected: `24 labels`, mỗi dòng `filename,label` hợp lệ.

- (Không commit nhãn nhạy cảm? — labels.csv KHÔNG chứa thông tin tài khoản, chỉ là text captcha; commit bình thường.)

---

### Task 5: Tách glyph + template + wordlist (`segment.py`)

**Files:**
- Create: `captcha-solver/src/segment.py`

**Interfaces:**
- Consumes: `captcha_io.*`, `denoise.*`, `labels.csv`
- Produces:
  - `segment.split_glyphs(denoised) -> list[np.ndarray]` (vertical projection cắt cột trống)
  - `segment.extract_templates(dataset_dir, labels_csv, out_json, out_wordlist) -> dict` — map `char -> [bitmap]` (dedupe hash), gộp/split heuristic khi số glyph ≠ len(label); ghi `data/templates.json` + `data/wordlist.txt` (từ = phần sau chữ số và "Đ")
  - `segment.measure_noise(dataset_dir) -> dict` (px nhiễu/ảnh trung bình, tỷ lệ cluster 1px/2px) — nhét vào templates.json mục `"noise_stats"`
  - CLI: `python -m src.segment --dataset ... --labels ... --out ...`

- [ ] **Step 1: Vertical projection split** — `col_on = denoised.sum(axis=0)`; chạylength các đoạn `col_on>0` thành glyph; bỏ đoạn rộng <2px (mảnh nhiễu sót).
- [ ] **Step 2: Heuristic khớp len(label)** — nếu `len(glyphs) != len(label)`: gộp cặp glyph kề nhau có khoảng trống nhỏ nhất (khi thiếu) hoặc split glyph rộng nhất tại cột có `col_on` thấp nhất (khi thừa); cảnh báo nếu vẫn lệch (bỏ ảnh khỏi template, giữ trong eval).
- [ ] **Step 3: Dedupe + ghi JSON** — key JSON là char, value list của `{hash, width, height, rows: ["0101...", ...]}`; wordlist = phần chữ cái của label (sau prefix số và "Đ"), dedupe, sort.
- [ ] **Step 4: Verify** Run: `.venv-captcha312/bin/python -m src.segment --dataset avatar-web/server/captcha-dataset --labels captcha-solver/data/labels.csv --out captcha-solver/data`
  Expected: in báo cáo `templates: N chars, M glyphs; words: K; segmentation failures: x/24` — yêu cầu mọi char trong labels có template (failures chỉ chấp nhận khi char đó có template từ ảnh khác).
- [ ] **Step 5: Commit** `git commit -m "feat(captcha-solver): glyph segmentation and template extraction"`

---

### Task 6: Charset + synthetic generator (`charset.py`, `synthetic.py`)

**Files:**
- Create: `captcha-solver/src/charset.py`
- Create: `captcha-solver/src/synthetic.py`

**Interfaces:**
- Consumes: `data/templates.json`, `data/wordlist.txt`
- Produces:
  - `charset.CharSet(templates_json)` — `blank_id=0`, `encode(text) -> list[int]`, `decode(ids) -> str`, `size`, `chars`
  - `synthetic.SyntheticGenerator(templates_json, wordlist, rng)` — `generate(text=None) -> (np.ndarray uint8 0/1 (15,100), str text)`
  - `synthetic.make_contact_sheet(samples, out_png)` — sanity check trực quan

- [ ] **Step 1: `charset.py`** — chars = sorted keys của templates + digits nếu thiếu; CTC greedy decode: bỏ lặp, bỏ blank.
- [ ] **Step 2: `synthetic.py`** — text mặc định: `str(rng.integers(0,10)) + "Đ" + word` (85% wordlist, 15% pseudo-word = ghép syllables cắt từ wordlist: mỗi từ chia nửa đầu/đầu ghép ngẫu nhiên); render: đặt glyphs cách nhau đúng khoảng trống thật (median gap từ templates), jitter y ±1; cộng nhiễu theo `noise_stats`: mỗi ảnh đặt `Poisson(mean_px)` noise, mỗi noise là 1px (90%) hoặc cặp kề (10%), vị trí uniform (đè lên nền, không đè chữ — check trước khi đặt).
- [ ] **Step 3: Sanity visual** Run: `.venv-captcha312/bin/python -c "import sys; sys.path.insert(0,'captcha-solver'); from src.synthetic import *; from src.charset import CharSet; import json; g=SyntheticGenerator(json.load(open('captcha-solver/data/templates.json')), open('captcha-solver/data/wordlist.txt').read().split(), __import__('numpy').random.default_rng(7)); ss=[g.generate() for _ in range(24)]; make_contact_sheet(ss,'/tmp/synth_sheet.png')"` rồi agent đọc `/tmp/synth_sheet.png` bằng read_files so với thật.
  Expected: ảnh giống hệt style thật (font, gap, mật độ nhiễu), text đọc được đúng chuỗi sinh ra.

- [ ] **Step 4: Commit** `git commit -m "feat(captcha-solver): charset codec and template-based synthetic generator"`

---

### Task 7: Model + Dataset (`model.py`, `dataset.py`)

**Files:**
- Create: `captcha-solver/src/model.py`
- Create: `captcha-solver/src/dataset.py`

**Interfaces:**
- Consumes: `synthetic.SyntheticGenerator`, `charset.CharSet`, `captcha_io.load_alpha_binary`
- Produces:
  - `model.CaptchaCRNN(num_classes)` — forward `(B,1,15,100) float32 -> (B,T,C)` log-softmax; `T=25`
  - `model.ctc_loss_fn(logits_len...)` bọc `nn.CTCLoss`
  - `dataset.SyntheticDataset(generator, charset, length)` — sinh fresh mỗi `__getitem__` (từ chung 1 generator, num_workers=0)
  - `dataset.RealDataset(dataset_dir, labels_csv, charset)` — ảnh thật đã denoise
  - `dataset.collate(batch) -> (images, targets, target_lens)` pad target

- [ ] **Step 1: CNN backbone**: Conv(1→32,3x3,pad1)+ReLU+MaxPool(2,2) → (32,7,50); Conv(32→64)+ReLU+MaxPool(2,1) → (64,3,25); Conv(64→128)+ReLU+MaxPool(2,1) → (128,1,25) — cần pad input height 15→16 trước (F.pad 1 pixel trên/dưới) để chia hết 2 lần.
- [ ] **Step 2: squeeze chiều height → `(B,25,128)` → BiLSTM(128,2,bidi) → Linear(256→C) → log_softmax.
- [ ] **Step 3: `dataset.py`** — collate: targets nối mảng 1D + `target_lengths`; ảnh → tensor `(1,15,100)` float32, pad height 16 ngay trong dataset.
- [ ] **Step 4: Verify** Run: `.venv-captcha312/bin/python -c "import sys; sys.path.insert(0,'captcha-solver'); import torch; from src.model import CaptchaCRNN; m=CaptchaCRNN(40); x=torch.rand(4,1,16,100); y=m(x); print(y.shape)"`
  Expected: `torch.Size([4, 25, 40])`.

- [ ] **Step 5: Commit** `git commit -m "feat(captcha-solver): CRNN-CTC model and torch datasets"`

---

### Task 8: Train (`train.py`)

**Files:**
- Create: `captcha-solver/src/train.py`

**Interfaces:**
- Consumes: Task 6 + Task 7
- Produces: `checkpoints/crnn_ctc.pt` (state_dict + charset chars + config), log huấn luyện

- [ ] **Step 1: Vòng lặp train** — Adam lr 1e-3; batch 64; 300 steps/epoch; 25 epochs; CTC loss `(log_probs, targets, input_lens=25, target_lens)`; log loss mỗi 50 steps.
- [ ] **Step 2: Val mỗi epoch** — 1.000 mẫu synthetic seed cố định (generator riêng rng seed 42): exact-match accuracy; đồng thời chạy real-24 (chỉ đánh giá). Early stop khi synthetic val ≥ 0.999. Save best (theo synthetic val acc) + save last.
- [ ] **Step 3: Verify** Run: `.venv-captcha312/bin/python -m src.train --templates captcha-solver/data/templates.json --wordlist captcha-solver/data/wordlist.txt --out captcha-solver/checkpoints`
  Expected: loss giảm về ~0, val acc đạt ≥ 0.995 trong ≤ 25 epochs, file `crnn_ctc.pt` tồn tại. Thời gian vài phút CPU.

- [ ] **Step 4: Commit** `git commit -m "feat(captcha-solver): CTC training loop with on-the-fly synthetic data"`

---

### Task 9: Predict + Evaluate (`predict.py`, `evaluate.py`)

**Files:**
- Create: `captcha-solver/src/predict.py`
- Create: `captcha-solver/src/evaluate.py`

**Interfaces:**
- Consumes: `model.CaptchaCRNN`, `charset.CharSet`, `captcha_io`, `denoise`, checkpoint Task 8
- Produces:
  - `predict.load_model(ckpt_path) -> (model, charset)`; `predict.predict_image(path, model, charset, dict_words=None) -> str` (denoise → tensor → greedy decode → nếu `dict_words` và từ không nằm trong dict, snap Levenshtein ≤ 1)
  - CLI: `python -m src.predict --image <p> | --dir <dir> --ckpt ... [--dict wordlist]`
  - `evaluate.evaluate_real(dataset_dir, labels_csv, ckpt, dict_words) -> dict` — exact-match, per-char acc; in bảng từng ảnh
  - CLI: `python -m src.evaluate --dataset ... --labels ... --ckpt ... [--dict ...]`

- [ ] **Step 1: predict.py** — load checkpoint (torch.load, map_location='cpu', rebuild model từ chars lưu trong ckpt), batch qua --dir.
- [ ] **Step 2: evaluate.py** — bảng `filename | label | pred | OK?`; tổng hợp exact-match %, per-char %; thời gian/ảnh.
- [ ] **Step 3: Verify** Run: `.venv-captcha312/bin/python -m src.evaluate --dataset avatar-web/server/captcha-dataset --labels captcha-solver/data/labels.csv --ckpt captcha-solver/checkpoints/crnn_ctc.pt --dict captcha-solver/data/wordlist.txt`
  Expected: exact-match real-24 ≥ 90%; predict 1 ảnh < 100ms.

- [ ] **Step 4: Commit** `git commit -m "feat(captcha-solver): inference CLI and evaluation report"`

---

### Task 10: End-to-end verification + README + GitNexus check

**Files:**
- Modify: `captcha-solver/README.md` (điền hướng dẫn đầy đủ)
- Create: `/tmp/captcha_solver_report.md` (báo cáo kết quả cho user, không commit)

**Interfaces:**
- Consumes: toàn bộ pipeline

- [ ] **Step 1: Chạy trọn pipeline từ đầu theo README** (labels đã có từ Task 4): segment → synthetic sanity → train → evaluate → predict 3 ảnh đơn lẻ.
- [ ] **Step 2: Đối chiếu Success Criteria trong spec**: synthetic val ≥ 99.5%, real ≥ 90%, < 100ms/ảnh. Nếu real < 90% → soát bảng eval từng ảnh, sửa nhãn sai (nếu nhãn sai) rồi train lại 1 lần.
- [ ] **Step 3: GitNexus** — toàn bộ là file mới trong `captcha-solver/`, không sửa symbol cũ; chạy `node .gitnexus/run.cjs analyze` (nếu index stale) và `detect_changes` trước commit cuối để xác nhận scope thay đổi chỉ nằm trong `captcha-solver/` + `docs/`.
- [ ] **Step 4: Cập nhật README**: yêu cầu môi trường, 6 lệnh pipeline, cách tích hợp `predict_image()` vào server TS sau này (spawn python subprocess), troubleshooting.
- [ ] **Step 5: Commit** `git commit -m "docs(captcha-solver): README end-to-end guide"`

---

## Phụ lục: Thứ tự chạy lệnh hoàn chỉnh (sau khi implement xong)

```bash
cd /Users/hieunt/learning-reverse
PY=.venv-captcha312/bin/python

# 1. Gán nhãn (chạy 1 lần, user review)
$PY captcha-solver/label_tool.py --dataset avatar-web/server/captcha-dataset \
    --out captcha-solver/data/labels.csv

# 2. Trích template + wordlist
$PY -m src.segment --dataset avatar-web/server/captcha-dataset \
    --labels captcha-solver/data/labels.csv --out captcha-solver/data    # (cd captcha-solver)

# 3. Train
$PY -m src.train --templates captcha-solver/data/templates.json \
    --wordlist captcha-solver/data/wordlist.txt --out captcha-solver/checkpoints

# 4. Evaluate + predict
$PY -m src.evaluate --dataset avatar-web/server/captcha-dataset \
    --labels captcha-solver/data/labels.csv \
    --ckpt captcha-solver/checkpoints/crnn_ctc.pt --dict captcha-solver/data/wordlist.txt
$PY -m src.predict --image <ảnh mới> --ckpt captcha-solver/checkpoints/crnn_ctc.pt
```
