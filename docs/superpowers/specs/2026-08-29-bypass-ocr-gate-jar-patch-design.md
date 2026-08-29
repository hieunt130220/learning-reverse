# Bypass Toàn Bộ OCR Gate & Sửa Logic Jump Trong `fJ.class` (Avatar Auto JAR) — Design Spec

Ngày: 2026-08-29

## 1. Mục tiêu & Bối cảnh

### Hiện tượng
- Chạy MicroEmulator với `avatar-auto-patched.jar`, khi gặp captcha, game hiện dialog **"Xin chờ"** nhưng treo vĩnh viễn, không gửi request giải captcha nào về solver server (`/tmp/solver.log` không có request POST).

### Nguyên nhân gốc rễ
Qua phân tích chi tiết bytecode của `fJ.class` (handler cmd -60):
1. **Gate `az.do:B != 0` (server flag)**: Ở offset `18893` (`javap 7098`), game kiểm tra cờ OCR do server trả về lúc login (`getstatic az.do:B; invokestatic if:(I)Z; ifeq 7165`). Nếu server không kích hoạt cờ này (`az.do:B == 0`), execution nhảy thẳng tới offset `18963` (`javap 7165`), bỏ qua hoàn toàn việc gán `var5 = 1` hoặc `var6 = 1`. Do đó `var5` và `var6` giữ nguyên giá trị 0.
2. **Lỗi đảo logic `ifeq -> ifne` (Bug của patch cũ)**: Ở offset `18973` và `18981` (`javap 7178` và `7186`), lệnh gốc là `iload; invokestatic if:(I)Z; ifeq 7290`. Hàm `if(i)` trả về `0` (false) khi `i != 0`. Lệnh `ifeq 7290` sẽ nhảy tới đoạn tạo OCR worker (7290) khi biến khác 0. Bản patch trước đổi `ifeq` (0x99) thành `ifne` (0x9c), làm logic bị đảo ngược: khi biến bằng 1 thì KHÔNG nhảy, rơi vào đoạn tạo dialog nhập tay và bỏ qua `new az(...)`.
3. **Patch gate vẫn chưa gọi `az.if()`**: Sau patch gate/jump, heap runtime cho thấy `al.do:Laz;` đã giữ một instance `az`, nhưng thread dump không có frame `az.if()` và solver vẫn không nhận POST. Đường gốc chỉ lưu worker vào `al.do`/`bS.do` rồi gọi wakeup; khi overlay "Xin chờ" đang active, screen tick chịu trách nhiệm lấy field này không chạy tới đoạn gọi `az.if()`.
4. **Bằng chứng runtime**: Gọi phản chiếu trực tiếp chính instance `al.do` trong JVM đang treo lập tức tạo `POST /avatar/full/captcha.php`, solver decode ảnh `100x15` thành `4104` với confidence `0.966`, trả đúng `status 1,0 + UTF`. Điều này xác nhận HTTP/config/solver đều hoạt động; điểm kẹt duy nhất là scheduler không gọi `az.if()`.

### Mục tiêu
- Sửa `tools/jar/patch_jar.py` để:
  1. **Bypass hoàn toàn kiểm tra `az.do:B`**: NOP 9 bytes kiểm tra `az.do:B` (offset `18893 - 18901`) để game luôn kiểm tra loại màn hình (`al` / `bS`) và bật cờ OCR bất kể server có gửi cờ hay không.
  2. **Gán default fallback `var5 = 1`**: Đổi `iconst_1` -> `iconst_2` ở offset `18882` để ngay cả khi màn hình không phải `al` hay `bS`, `var5` vẫn bằng 1 (fallback về `al.do`).
  3. **Khôi phục / giữ nguyên lệnh `ifeq` (0x99)** tại offset `18973` và `18981` để khi `var5 != 0` hoặc `var6 != 0`, code nhảy đúng vào khối khởi tạo OCR worker (7290) và bỏ qua dialog nhập tay.
  4. **Gọi `az.if()` trực tiếp ngay sau constructor**: Append một `Methodref az.if:()V` vào cuối constant pool, thay `putstatic al.do/bS.do + invokestatic wakeup` bằng `invokevirtual az.if + 3 NOP`. Bytecode dài bằng nhau và stack effect tương đương nên không cần sửa branch offset hay StackMap.
- Tự động đóng gói lại `avatar-jar/avatar-auto-patched.jar` đúng chuẩn ZIP MS-DOS compatible với MicroEmulator.

---

## 2. Phạm vi (Scope)

### In-scope
1. `tools/jar/patch_jar.py`: Cập nhật hàm `patch_fj_bytecode()` với các thay đổi bytecode chính xác.
2. Build lại `avatar-jar/avatar-auto-patched.jar`.
3. Verify bytecode đã patch bằng Python disassembler.

### Out-of-scope
- Không sửa `solver_server.py` (đã hoàn thiện và test kỹ).
- Không sửa các class khác trong JAR.

---

## 3. Thiết kế kỹ thuật chi tiết

### 3.1. Vị trí và Bytecode cần patch trong `fJ.class`

Pattern định vị (20 bytes tại offset `18873`):
```hex
12 02 b6 02 36 58 b2 01 37 04 2e 36 05 b2 01 37 04 2e 36 06
```

Các điểm patch:

1. **Khởi tạo `var5 = do[2] = 1` (Fallback default)**:
   - Offset: `idx + 9` (18882)
   - Gốc: `04` (`iconst_1` -> `var5 = do[1] = 0`)
   - Patch: `05` (`iconst_2` -> `var5 = do[2] = 1`)

2. **Khởi tạo `var6 = do[2] = 1` (Fallback default)**:
   - Offset: `idx + 16` (18889)
   - Gốc: `04` (`iconst_1` -> `var6 = do[1] = 0`)
   - Patch: `05` (`iconst_2` -> `var6 = do[2] = 1`)

3. **Bypass gate `az.do:B != 0`**:
   - Offset: `idx + 20` đến `idx + 28` (9 bytes: `b2 00 c4 b8 01 df 99 00 3d`)
   - Gốc: `getstatic az.do:B; invokestatic if:(I)Z; ifeq +61`
   - Patch: `00 00 00 00 00 00 00 00 00` (9 bytes `nop`) -> execution rơi thẳng vào kiểm tra `bX.do instanceof al / bS`.

4. **Giữ nguyên / đảm bảo `ifeq` (0x99) cho jump tới 7290**:
   - Offset `18973` và `18981`: Giữ nguyên opcode `0x99` (`ifeq`), **KHÔNG** đổi thành `0x9c` (`ifne`).

5. **Gọi OCR đồng bộ, không phụ thuộc screen tick**:
   - Append constant-pool entry `Methodref #64.#784 // az.if:()V` ở index mới `#1209`.
   - Nhánh `al`: thay `putstatic #177; invokestatic #394` bằng `invokevirtual #1209; nop; nop; nop`.
   - Nhánh `bS`: thay `putstatic #218; invokestatic #398` bằng `invokevirtual #1209; nop; nop; nop`.
   - `putstatic` và `invokevirtual ()V` đều consume một object reference; phần wakeup và 3 NOP đều có stack effect 0.

### 3.2. Luồng thực thi sau khi patch
```text
Cmd -60 nhận captcha image bytes
  -> var5 = 1, var6 = 1 (mặc định)
  -> Bypass az.do:B check (NOPs)
  -> Kiểm tra bX.do:
     -> Nếu al: var5 = 1
     -> Nếu bS: var6 = 1
  -> Jump qua manual dialog vì var6 != 0 / var5 != 0 (ifeq 7290)
  -> Tạo Image từ bytes
  -> Tạo new az(img, id, menuId)
  -> Gọi trực tiếp az.if() ngay trên instance vừa tạo
  -> az.if() POST bitmap tới solver http://127.0.0.1:8643/...
  -> Solver trả status 1, resultType 0 + UTF đáp án 4 số
  -> az nộp đáp án về game server và đóng dialog "Xin chờ"!
```

---

## 4. Verification Plan

1. **Kiểm tra bytecode patched**:
   - Disassemble vùng bytecode trong `avatar-auto-patched.jar`.
   - Xác nhận: NOPs tại `az.do:B`, `iconst_2` tại `var5/var6`, `ifeq` tại jumps, `#1209 = Methodref az.if:()V`, hai nhánh dùng `invokevirtual #1209`.
2. **Kiểm tra MicroEmulator**:
   - Chạy `avatar-auto-patched.jar` trong MicroEmulator.
   - Kiểm tra log `/tmp/solver.log` có nhận POST captcha và trả lời thành công.
