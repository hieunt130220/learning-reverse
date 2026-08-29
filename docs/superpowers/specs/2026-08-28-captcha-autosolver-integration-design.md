# Captcha Auto-Solver Integration — Design Document (Round 2)

**Ngày:** 2026-08-28
**Trạng thái:** Chờ user duyệt
**Tiền đề Round 1:** Model CRNN+CTC đã train (`captcha-solver/checkpoints/crnn_ctc.pt`), exact-match 88.2% trên 136 ảnh có nhãn, per-char 97.4%, 3 ms/ảnh, output 4 chữ số 0000–9999.

---

## 1. Mục tiêu & Bối cảnh

- **Yêu cầu của user (chốt):** PHẢI patch vào `avatar-auto.jar` — bản `avatar-web` là phiên bản game khác, không có captcha. `avatar-auto.jar` là client thật đang chạy.
- **Mục tiêu:** Khi JAR gặp captcha (`cmd -60` → class `az` xử lý), JAR gọi API solver local lấy 4 chữ số rồi tự điền gửi về game — không cần người nhập.
- **Cơ chế sẵn có để tận dụng (từ `docs/protocol/avatar-auto-captcha-handoff.md`, đã verify từ bytecode):**
  ```text
  Server gửi cmd -60 kèm PNG
    → fJ.class parse packet, tạo ảnh
    → az.class chuyển ảnh thành chuỗi bitmap
    → az.class POST bitmap (form URL-encoded) tới dịch vụ OCR ngoài qua HttpConnection
    → nhận response: byte status + các trường UTF
    → client gửi targetId + menuId + UTF answer về game
  ```
- **Chiến lược patch tối thiểu:** KHÔNG viết luồng HTTP mới trong bytecode. Thay vào đó:
  1. Viết **API solver local mimic đúng format request/response** của dịch vụ OCR mà `az.class` đang gọi (drop-in replacement).
  2. **Patch URL** trong JAR trỏ về `http://127.0.0.1:8643/...` (hoặc IP máy chạy solver).
  3. JAR giữ nguyên toàn bộ logic còn lại — xác suất phát sinh lỗi bytecode gần bằng 0 nếu URL là string constant.

## 2. Phạm vi (Scope)

### In-scope
1. **Solver API** (`captcha-solver/solver_server.py`, stdlib-only, port 8643):
   - Endpoint **drop-in mimic OCR**: nhận POST form URL-encoded với payload bitmap đúng format `az.class` gửi → trả response đúng format OCR (byte status + UTF fields, xác định chính xác khi decompile `az.class` trong plan).
   - Endpoint phụ `POST /solve` (`{"imageBase64": "..."}` → `{"digits","confidence"}`) để test độc lập không cần JAR.
   - Pipeline preprocess y hệt lúc train: `load_alpha_binary` → `remove_isolated_noise` → tensor (1,15,100) → CRNN+CTC greedy decode.
2. **Patch JAR** (`tools/jar/patch_jar.py` + decompile session):
   - Trích xuất an toàn các class (`ZipFile.read`, tên file không va chạm hoa/thường — handoff doc §2).
   - Decompile `az.class` (CFR) → xác định: URL OCR được tạo ở đâu (string constant / config `br.class` / động từ `cU.class`), format request chính xác, format response chính xác.
   - Patch: thay string URL (ưu tiên tuyệt đối — chỉ đổi constant, không đụng logic). Nếu URL nằm trong config động → patch giá trị default/fallback trong `br.class`/`cU.class` cùng cách.
   - Repack JAR giữ nguyên Manifest + thứ tự entry.
3. **Kiểm thử:** smoke test API độc lập; chạy JAR đã patch trong emulator với captcha thật → tự điền → server accept.

### Out-of-scope
- Không sửa `avatar-web/server` (bản khác, không có captcha).
- Không retrain model (dùng checkpoint round 1; round 3 sẽ train thêm).
- Không đổi logic `fJ.class`/`al.class` — chỉ đụng điểm URL OCR của `az.class` (và config nếu cần).

## 3. Thiết kế kiến trúc

```text
Game server ──cmd -60──▶ avatar-auto.jar (đã patch)
                            │ fJ.class parse PNG
                            │ az.class: bitmap → POST form URL-encoded
                            ▼
                http://127.0.0.1:8643/<đường dẫn mimic OCR>
                solver_server.py: decode bitmap → CRNN+CTC → 4 chữ số
                response: byte status + UTF (đúng format OCR gốc)
                            │
                            ▼
                az.class parse response → answer
                JAR gửi targetId + menuId + UTF answer về game (không đổi)
```

### Solver API (format byte-level sẽ chốt lại sau khi decompile az.class)
```
POST /  (mimic OCR — form URL-encoded, trường dữ liệu theo az.class)
  200: <byte status><UTF answer>  (byte-level giống OCR gốc)

POST /solve  (tiện test)
  body: {"imageBase64": "..."}
  200:  {"digits": "1192", "confidence": 0.97}
```

### Files liên quan
| File | Hành động | Vai trò |
|---|---|---|
| `captcha-solver/solver_server.py` | Create | HTTP service mimic OCR + /solve |
| `captcha-solver/src/predict.py` | Modify nhẹ | expose `predict_array(arr) -> (digits, conf)` dùng chung |
| `tools/jar/patch_jar.py` | Create | trích xuất + patch URL + repack (Python zipfile) |
| `avatar-jar/avatar-auto-patched.jar` | Output | JAR đã patch (bản gốc giữ nguyên) |
| `docs/protocol/az-ocr-notes.md` | Create | ghi nhận URL/format request-response tìm được từ bytecode |

## 4. Điểm chưa biết cần làm rõ khi implement (rủi ro chính)
1. **URL OCR nằm ở đâu:** string constant trong `az.class`, hay default trong bảng config `br.class`, hay tải động từ server AngelChip (`cU.class`)? → Bước decompile sẽ chốt. Kịch bản xấu nhất (URL do server cấu hình) → patch thêm giá trị fallback hoặc chặn hosts/DNS trỏ domain OCR về 127.0.0.1.
2. **Format request/response chính xác** của OCR: đã verify mức cấu trúc (form URL-encoded; byte status + UTF) — cần parse bytecode lấy tên trường + thứ tự để mimic 1:1.
3. **Máy chạy JAR có truy cập được 127.0.0.1:8643 không** (emulator chạy cùng máy → có). Nếu JAR chạy trên máy khác → dùng IP LAN.
4. Tooling: cần `java` + CFR decompiler (tải 1 lần); JDK chỉ nếu phải compile class mới (kịch bản dự phòng).

## 5. Verification Plan
1. **API standalone:** POST /solve với 5 ảnh có nhãn → digits khớp, confidence > 0.9.
2. **Mimic format:** dựng request giả theo format `az.class` → response byte-level so khớp kỳ vọng từ bytecode.
3. **JAR patched offline:** chạy trong emulator, trigger captcha thật → log HTTP ở solver nhận request từ JAR → trả đáp án → JAR điền.
4. **E2E live:** server game chấp nhận đáp án tự động (bước chưa từng verify — cần bạn chạy game thật).
5. **Rollback:** giữ `avatar-auto.jar` gốc nguyên vẹn; patch xuất ra file riêng.

## 6. Rủi ro & phương án
| Rủi ro | Phương án |
|---|---|
| URL OCR do server AngelChip cấu hình động | Patch default/fallback trong `br.class`, hoặc hosts/DNS redirect domain OCR → 127.0.0.1 |
| Response có checksum/sign | Đọc kỹ bytecode `az.class`; nếu có sign thì tính lại theo thuật toán trong bytecode |
| Prompt không phải 4 chữ số | Solver vẫn trả best-guess; đo tỉ lệ accept qua log, cải thiện round 3 |
| Accuracy ảnh mới thấp (41% unseen) | Telemetry log mỗi captcha → thu nhãn → train lại (round 3, 3 phút/lần) |
