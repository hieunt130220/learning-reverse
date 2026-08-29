# az.class (OCR Worker) - Reverse Notes

> Source: decompile avatar-auto.jar bang CFR 0.152

## Luong xu ly OCR

### Entry: az(Image image, int n, byte by)
- image: captcha screenshot
- n: target ID, by: menu ID

### HTTP Request
```
w = image.getWidth()
h = image.getHeight()
pixels = new int[w * h]
image.getRGB(pixels, 0, w, 0, 0, w, h)
bitmap = []
for y in range(h):
    for x in range(w):
        pixel = pixels[y * w + x]
        a = pixel >>> 24
        r = (pixel >> 16) & 0xFF
        g = (pixel >> 8) & 0xFF
        b = pixel & 0xFF
        if a == 0 or (r > thr and g > thr and b > thr):
            bitmap.append("1")
        else:
            bitmap.append("0")
body = sep1 + "".join(bitmap) + sep2 + str(w) + sep3 + str(h)
```

### HTTP Connection
- Content-Type: text/plain
- User-Agent: microedition.platform
- Connection: close

### Response
- byte `1` (status): `1` = OK (gửi đáp án), `0`/`-1`/`3` = thông báo/error/update
- Khi status `1`: tiếp `byte resultType` (0) + `UTF answer` (4 chữ số)
- Khi status `0`/`-1`/`3`: tiếp các trường UTF message/metadata (KHÔNG phải đáp án)

## Key Findings
- URL tu br.do(index) - config XOR-encoded
- Body: <sep1><bitmap><sep2><width><sep3><height>
- Response: byte status (1=OK) + byte resultType + UTF answer

## Implementation
1. Solver API nhan bitmap + width + height
2. Patch JAR doi URL sang 127.0.0.1:8643
3. Fallback: patch bytecode hoac redirect DNS

## Patch Bytecode fJ.class (Bypass OCR Gate & Jump Fix)

- cmd -60 handler nằm trong class **fJ**:
  - Gốc: `var5 = do[1]` (=0), `var6 = do[1]` (=0).
  - Gate kiểm tra: `getstatic az.do:B; if:(I)Z; ifeq 7165`. Nếu server không bật cờ OCR (`az.do:B == 0`), execution nhảy qua việc gán `var5/var6 = 1`, làm 2 biến này luôn bằng 0.
- Patch trong `tools/jar/patch_jar.py`:
  1. Đổi `iconst_1` -> `iconst_2` cho `var5` và `var6` để mặc định luôn là `do[2] = 1`.
  2. NOP 9 bytes kiểm tra `az.do:B` (`b2 00 c4 b8 01 df 99 00 3d` -> 9x `0x00`) để bypass hoàn toàn OCR gate từ server.
  3. Giữ nguyên opcode `ifeq` (`0x99`) tại offset `18973` và `18981` để khi `var5 != 0` hoặc `var6 != 0`, game nhảy thẳng qua manual dialog vào khối OCR (`7290`).
  4. Runtime attach cho thấy `al.do` đã chứa instance `az`, nhưng screen tick không gọi `az.if()` khi overlay "Xin chờ" active. Gọi phản chiếu `az.if()` trên chính instance này lập tức tạo POST captcha và solver trả `4104` (`conf 0.966`).
  5. Fix cuối: append `Methodref az.if:()V` vào constant pool và thay `putstatic al.do/bS.do + invokestatic wakeup` bằng `invokevirtual az.if() + nop + nop + nop`. OCR request vì thế chạy ngay trong cmd -60 handler, không phụ thuộc screen scheduler.
