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
- byte 0: status (0=OK)
- UTF string: answer (4 digits)

## Key Findings
- URL tu br.do(index) - config XOR-encoded
- Body: <sep1><bitmap><sep2><width><sep3><height>
- Response: byte status + UTF answer

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
