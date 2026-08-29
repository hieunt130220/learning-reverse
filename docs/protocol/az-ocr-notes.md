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
