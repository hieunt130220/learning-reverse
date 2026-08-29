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
> **Bug đã fix 2026-08-29:** `solver_server.py` cũ trả `0` + UTF (sai) → az.class nhận status 0 → không gửi đáp án → treo dialog "Xin chờ". Sửa thành `1,0` + UTF.

## Key Findings
- URL tu br.do(index) - config XOR-encoded
- Body: <sep1><bitmap><sep2><width><sep3><height>
- Response: byte status (1=OK) + byte resultType + UTF answer

## Implementation
1. Solver API nhan bitmap + width + height
2. Patch JAR doi URL sang 127.0.0.1:8643
3. Fallback: patch bytecode hoac redirect DNS

## Patch auto-fill (round 2, finding sau khi test MicroEmulator)

- JAR dung CUNG URL config (key 2=) cho ca: tai du lieu Auto luc khoi dong
  VA gui captcha OCR -> solver server phai la transparent proxy cho request
  khong phai bitmap (solver_server.py v2).
- cmd -60 handler nam trong class **fJ** (fJ hoa, khong phai fj):
  var5 = do[1](=0), var6 = do[1]; chi auto OCR khi var >= do[36](=1)
  VA flag az.do:B != 0 (server tra khi login) VA man hinh la al/bS.
  Neu khong -> bx.do.do(img) hien captcha nhap tay.
- Patch: 1 byte trong fJ.class — iconst_1 -> iconst_2 (offset site 7087,
  pattern 20-byte duy nhat) -> var5 = do[2](=1) luon vuot nguong ->
  moi captcha co anh deu new az(...) -> goi solver -> tu dien.
  Round 2b: patch thêm 2x ifeq→ifne (target 19088) để đảo logic hiển thị dialog nhập tay;
  bản patch hiện tại (`tools/jar/patch_jar.py`) đã gồm cả 2 phần.

## Bugfix 2026-08-29 (dialog "Xin chờ" treo)

- Nguyên nhân 1: `solver_server.py` trả `status 0` → az.class không gửi đáp án → treo.
- Nguyên nhân 2: bitmap JAR `1=nền,0=chữ` ngược với model `1=chữ` (alpha>0) → model đoán sai → server game reject → treo "Xin chờ".
- Fix: trả `01 00` + UTF (status 1, resultType 0) và `arr = 1 - arr` trước denoise.
