# Captcha Solver Avatar — Design Document

**Ngày:** 2026-08-27
**Chủ đề:** Train model Python giải captcha game Avatar (J2ME world)
**Quyết định đã chốt với user:** Train trên đúng dataset captcha Avatar hiện có (dạng `số + Đ + từ tiếng Việt`), đầu ra là **chuỗi ký tự** (không phải 4 chữ số).

---

## 1. Mục tiêu & Bối cảnh

### Bối cảnh
- Game Avatar gửi captcha qua packet `cmd=-60` kèm ảnh PNG **100x15 RGBA**. Đặc điểm ảnh (đã phân tích thực tế 25 file trong `avatar-web/server/captcha-dataset/`, 24 unique theo hash alpha):
  - RGB toàn đen `(0,0,0)`, **nội dung chữ nằm ở kênh alpha** (pixel chữ = alpha 255, nền = alpha 0).
  - Nội dung dạng `<số>Đ<từ tiếng Việt>`: "1Đnai", "2Đbay", "7Đbông", "6Đbản"… (1–2 chữ số + "Đ" + từ tiếng Việt có dấu).
  - Nhiễu: pixel đơn/cluster nhỏ rải rác ngẫu nhiên, font bitmap cố định giữa các ảnh.
- Dataset hiện có **chưa có nhãn** (tên file chỉ chứa timestamp + hash, không chứa đáp án).

### Mục tiêu
Xây dựng pipeline Python hoàn chỉnh:
1. Công cụ gán nhãn dataset thật (human-in-the-loop).
2. Trích xuất glyph template từ dữ liệu có nhãn → sinh **dữ liệu synthetic không giới hạn** mô phỏng đúng phân bố thật (font + nhiễu).
3. Train model **CRNN + CTC** (PyTorch, CPU) nhận ảnh captcha → chuỗi ký tự.
4. CLI predict + evaluate với độ chính xác exact-match cao.

### Tiêu chí thành công (Success Criteria)
- Synthetic validation exact-match accuracy **≥ 99.5%**.
- Trên 24 ảnh thật có nhãn: exact-match accuracy **≥ 90%**.
- `predict.py` chạy 1 ảnh < 100ms (CPU).
- Toàn bộ pipeline chạy được bằng lệnh rõ ràng, không phụ thuộc GPU.

---

## 2. Phạm vi (Scope)

### In-scope
- Thư mục mới `captcha-solver/` chứa toàn bộ pipeline Python (không sửa code TS/Java hiện có).
- Label tool chạy bằng **Python stdlib** (`http.server`) — không thêm dependency web.
- Trích xuất template, synthetic generator, dataset loader, model CRNN+CTC, train, predict, evaluate.
- Dữ liệu nguồn: `avatar-web/server/captcha-dataset/*.png`.

### Out-of-scope
- Tích hợp trực tiếp vào server TypeScript `avatar-web` (chỉ cung cấp Python API/CLI, tích hợp làm phase sau).
- Gửi đáp án lên game server / autologin.
- Thu thập thêm dữ liệu (dùng captcha-collector hiện có khi cần).
- Captcha từ world APK hoặc nguồn khác.
- Viết unit test (theo quy định AGENTS.md — chỉ viết khi user yêu cầu).

### Edge cases cần xử lý
- Ảnh trùng lặp (theo hash alpha) → loại khi labeling/eval.
- Glyph dính nhau do nét gạch ngang của "Đ" → denoise trước khi tách, dùng heuristic số glyph = số ký tự nhãn.
- Tiền tố 1 hoặc 2 chữ số → generator sinh cả hai dạng.
- Ký tự có dấu (ả, ộ, ế…) → giữ nguyên trong charset, thêm bước dictionary post-process tùy chọn.
---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Files/Modules mới và vai trò

```
captcha-solver/
├── README.md                  # Hướng dẫn chạy từng bước
├── requirements.txt           # torch (CPU), pillow, numpy
├── label_tool.py              # HTTP server gán nhãn → data/labels.csv
├── src/
│   ├── captcha_io.py          # Load PNG → mảng alpha binary (100x15 uint8 0/1)
│   ├── denoise.py             # Loại nhiễu: pixel on có < N láng giềng on (8-conn)
│   ├── segment.py             # Tách glyph theo cột + trích template → data/templates.json
│   ├── synthetic.py           # Sinh ảnh captcha tổng hợp (template + nhiễu + jitter)
│   ├── dataset.py             # PyTorch Dataset (synthetic on-the-fly + real labeled)
│   ├── charset.py             # Charset + encode/decode CTC
│   ├── model.py               # CRNN: CNN backbone → BiLSTM → CTC head
│   ├── train.py               # CLI train, lưu checkpoints/crnn_ctc.pt
│   ├── predict.py             # CLI predict 1 ảnh hoặc cả folder
│   └── evaluate.py            # CLI eval exact-match trên real labels + synthetic val
├── data/                      # (sinh bởi tool) labels.csv, templates.json, wordlist.txt
└── checkpoints/               # (sinh bởi train) crnn_ctc.pt
```

Vai trò dữ liệu:
- `data/labels.csv`: `filename,label` do user gán qua label tool (24 dòng unique).
- `data/templates.json`: map `char → danh sách bitmap glyph` trích từ dữ liệu thật.
- `data/wordlist.txt`: các từ tiếng Việt xuất hiện trong nhãn.

### 3.2. Luồng xử lý (pipeline)

```
[1] label_tool.py  → labels.csv (nhãn người)
        ↓
[2] segment.py     → templates.json (glyph thật, dedupe) + wordlist.txt
        ↓
[3] synthetic.py   → sinh N mẫu train/val (font thật + nhiễu mô phỏng phân bố thật)
        ↓
[4] train.py       → CRNN + CTC loss → checkpoints/crnn_ctc.pt
        ↓
[5] evaluate.py    → accuracy trên 24 ảnh thật (hold-out, không train trên ảnh thật)
[6] predict.py     → ảnh mới → chuỗi ký tự
```
### 3.3. Chi tiết kỹ thuật

**Xử lý ảnh (captcha_io, denoise):**
- Load PNG, lấy kênh alpha, binary hóa `>0 → 1`.
- Denoise: đếm láng giềng on (8-conn); pixel có `< 2` láng giềng on bị loại; lặp 2 lần (tham số chỉnh qua CLI).

**Tách glyph (segment):**
- Vertical projection trên ảnh đã denoise → cột trống (sum=0) chia glyph.
- So số glyph với `len(label)`: nếu lệch → gộp/split theo heuristic bề rộng (~5–11 px/glyph).
- Dedupe bitmap hash → `templates.json` (mỗi char có thể có nhiều variant).
- Thống kê nhiễu thật (số px noise/ảnh, tỷ lệ cluster 1px/2px) lưu lại cho generator.

**Synthetic generator (synthetic):**
- Chuỗi mẫu: `1–2 chữ số` + `Đ` + từ trong wordlist (85%) hoặc pseudo-word ghép syllable (15%).
- Render glyphs cạnh nhau (jitter y ±1, khoảng cách glyph đo từ templates).
- Thêm nhiễu: đặt pixel đơn + cặp kề ngẫu nhiên đúng mật độ thống kê được.
- Kích thước giữ nguyên 100x15.

**Charset (charset):**
- `0-9`, `Đ`, chữ thường Latin + dấu tiếng Việt xuất hiện trong templates. Blank index 0 cho CTC.

**Model (model.py) — CRNN:**
- Input: `(B, 1, 15, 100)` float 0/1.
- CNN: 3 block `[Conv3x3 → ReLU → MaxPool]`:
  - block1: 32 kênh, pool `(2,2)` → `(32, 7, 50)`
  - block2: 64 kênh, pool `(2,1)` (chỉ pool rộng) → `(64, 3, 25)`
  - block3: 128 kênh, pool `(2,1)` + flatten chiều cao → sequence `(B, 25, 128)`.
- RNN: `BiLSTM(hidden=128, layers=2, bidirectional=True)` → `(B, T=25, 256)`.
- Head: `Linear(256, num_classes)` → CTC log-softmax.
- Loss: `nn.CTCLoss(blank=0, zero_infinity=True)`; T=25 ≥ max label len (~8) nên thỏa ràng buộc CTC.

**Train (train.py):**
- Synthetic on-the-fly: mỗi epoch sinh mới (re-roll word/noise/jitter) → chống overfit.
- Adam lr 1e-3, batch 64, steps/epoch 300, epochs 25 (~19k mẫu/epoch).
- Val: 1.000 mẫu synthetic cố định seed + báo cáo real-24 accuracy mỗi epoch (chỉ đo, không train).
- Early stop khi val exact-match ≥ 0.999. Lưu best checkpoint.
- Thời gian dự kiến: vài phút trên CPU (Apple Silicon).

**Predict (predict.py):**
- Greedy CTC decode → chuỗi. Tùy chọn `--dict` snap về wordlist (Levenshtein distance 1).
- CLI: `predict.py --image <path>` hoặc `--dir <folder>`; import được hàm `predict_image(path, model_path)`.

**Evaluate (evaluate.py):**
- Real-24: exact-match + per-char accuracy; in bảng so sánh dự đoán vs nhãn.
- Synthetic val: exact-match.

### 3.4. Environment & ràng buộc
- Python **3.12** qua `uv` (venv `.venv-captcha312` đã tạo, đã verify: torch 2.13.0 CPU + pillow + numpy chạy OK).
- Lý do không dùng Python 3.14 hệ thống: chưa có wheel torch.
- Không sửa symbol nào của code hiện có → toàn bộ file mới trong `captcha-solver/`, không phát sinh GitNexus impact trên codebase cũ.
- Không commit tự động; `detect_changes` sẽ chạy trước nếu có yêu cầu commit.

---

## 4. Verification Plan (kiểm chứng sau khi code xong)

1. **Label tool:** chạy `label_tool.py`, mở `http://localhost:8641`, gán nhãn 24 ảnh → `data/labels.csv` đủ 24 dòng hợp lệ.
2. **Templates:** chạy `segment.py` → báo cáo số glyph trích được, coverage charset (mọi char trong labels phải có ≥1 template).
3. **Synthetic sanity:** sinh 24 mẫu, ghép contact sheet PNG so sánh bằng mắt với ảnh thật (cùng font, mật độ nhiễu tương đương).
4. **Train:** `train.py` → loss giảm ổn định, val exact-match ≥ 99.5%, checkpoint được lưu.
5. **Evaluate real:** `evaluate.py` → in bảng 24 dòng + accuracy tổng ≥ 90% exact-match.
6. **Predict:** `predict.py --image <3 ảnh bất kỳ>` → chuỗi in ra khớp nhãn; thời gian < 100ms/ảnh.

---

## 5. Rủi ro & phương án dự phòng

| Rủi ro | Giải pháp |
|---|---|
| Tách glyph thất bại do ký tự dính nhau | Heuristic số glyph = len(label); gộp/split theo bề rộng; denoise mạnh hơn |
| Thiếu template cho vài char hiếm | Loại từ chứa char thiếu khỏi wordlist; cảnh báo user thu thêm dữ liệu |
| Nhãn người gán sai dấu | Bước review: evaluate in từng dự đoán vs nhãn để user soát; sửa labels.csv rồi train lại |
| Server đổi style captcha trong tương lai | Pipeline chỉ cần label lại + re-train (đã tự động hóa sẵn) |
