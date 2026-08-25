# Bàn giao logic CAPTCHA của `avatar-auto.jar`

**Ngày cập nhật:** 2026-08-25  
**Phạm vi:** Reverse-engineering cơ chế nhận, xử lý và gửi đáp án CAPTCHA trong `avatar-auto.jar`  
**Đối tượng:** Người tiếp tục phát triển client headless hoặc luồng CAPTCHA human-in-the-loop

---

## 1. Tóm tắt kết quả

Cơ chế CAPTCHA thực tế của `avatar-auto.jar` đã được xác định từ đúng các class trong JAR:

```text
Server gửi cmd -60 kèm prompt và ảnh PNG
    ↓
class fJ parse packet
    ↓
class az chuyển ảnh thành chuỗi bitmap
    ↓
class az POST bitmap tới dịch vụ OCR ngoài
    ↓
OCR trả chuỗi đáp án
    ↓
client gửi targetId + menuId + đáp án về game
```

### Trạng thái xác minh

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Opcode chứa ảnh CAPTCHA | **Đã xác minh** | `cmd -60` trong JAR |
| Layout payload CAPTCHA | **Đã xác minh** | Đọc trực tiếp từ bytecode `fJ.class` |
| Thuật toán chuyển PNG thành bitmap | **Đã xác minh** | Đọc trực tiếp từ `az.class` |
| Cơ chế POST tới OCR | **Đã xác minh** | `HttpConnection`, POST form URL-encoded |
| Cấu trúc response OCR | **Đã xác minh** | Byte status + các trường UTF |
| Cấu trúc gửi đáp án về game | **Đã xác minh** | `targetId`, `menuId`, `UTF answer` |
| Ảnh CAPTCHA runtime thật | **Đã thu được** | Hook `Image.createImage(byte[], int, int)` trong MicroEmulator |
| URL OCR hiện tại | **Cấu hình động, chưa khôi phục đầy đủ** | Không hardcode nguyên văn trong JAR |
| OCR local cho ảnh thật | **Chưa hoàn tất** | Vision OCR không đọc ổn định ảnh nhiễu |
| Server game chấp nhận đáp án end-to-end | **Chưa xác minh** | Không được tuyên bố là đã hoàn thành |

> **Kết luận trung thực:** Phần protocol và thuật toán của JAR đã được reverse đầy đủ. Chưa có bằng chứng một đáp án OCR tự động đã được server game chấp nhận end-to-end.

---

## 2. Lỗi quan trọng khi decompile trên macOS

JAR chứa nhiều class chỉ khác nhau chữ hoa/chữ thường:

```text
al.class  ≠ aL.class
az.class  ≠ aZ.class
aQ.class  ≠ aq.class
gs.class  ≠ gS.class
fJ.class  ≠ fj.class
fp.class  ≠ fP.class
```

Filesystem macOS mặc định không phân biệt hoa/thường. Nếu dùng `unzip` trực tiếp vào một thư mục, class này có thể ghi đè class kia. Đây là nguyên nhân các lần decompile ban đầu cho kết quả sai hoặc thiếu logic.

### Cách trích class an toàn

Dùng `ZipFile.read()` và ghi mỗi entry sang tên không va chạm:

```python
from zipfile import ZipFile

with ZipFile("avatar-auto.jar") as jar:
    open("lower-al.class", "wb").write(jar.read("al.class"))
    open("upper-aL.class", "wb").write(jar.read("aL.class"))
```

Sau đó decompile từng file riêng:

```bash
java -jar cfr.jar lower-al.class --outputdir out
```

Không dùng source trong thư mục đã giải nén case-insensitive làm nguồn kết luận cuối cùng.

---

## 3. Các class chính

| Class chính xác | Kích thước quan sát | Vai trò |
|---|---:|---|
| `al.class` | ~12.9 KB | Auto Kim Cương thật; state machine và thuật toán chọn nước đi |
| `aL.class` | ~477 B | Callback nhỏ gửi một command; không phải Auto Kim Cương |
| `fJ.class` | ~32 KB | Global packet handler; parse `cmd -60` và tạo ảnh CAPTCHA |
| `az.class` | ~6.3 KB | Worker OCR CAPTCHA |
| `aQ.class` | ~29.7 KB | Đồng bộ thread, tiện ích và state toàn cục |
| `gs.class` | ~51.8 KB | Menu/dispatcher Auto |
| `br.class` | ~6 KB | Đọc resource đóng gói và bảng cấu hình động |
| `cU.class` | — | Tải/cập nhật cấu hình động từ server AngelChip |

### Nhận diện Auto Kim Cương

Trong đúng `al.class`:

```java
public final String toString() {
    return "Auto kim cương";
}
```

Class này chứa cả logic tự tìm cặp đổi trong bảng 8×8 và xử lý CAPTCHA qua worker `az`.

---

## 4. Packet CAPTCHA từ server

CAPTCHA được gửi trong nhánh `case -60` của đúng `fJ.class`.

### Layout

```text
cmd = -60
body:
    i32 targetId
    i8  menuId
    UTF prompt
    i8  inputType

    nếu còn dữ liệu:
        i16 imageLength
        byte[imageLength] captchaPng
```

Tất cả số nhiều byte dùng big-endian theo `DataInputStream`/`DataOutputStream` của Java.

### Pseudo-code đã chuẩn hóa

```java
int targetId = reader.readInt();
byte menuId = reader.readByte();
String prompt = reader.readUTF();
byte inputType = reader.readByte();

byte[] imageData = null;
if (reader.available() > 0) {
    int length = reader.readShort();
    imageData = new byte[length];
    reader.read(imageData);
}

if (imageData != null && currentAuto instanceof al) {
    Image image = Image.createImage(imageData, 0, imageData.length);
    al.captchaWorker = new az(image, targetId, menuId);
    wakeCaptchaWorker();
}
```

### Trường hợp không có ảnh

Nếu payload không có `imageLength + PNG`, client hiển thị hộp nhập thông thường từ `prompt`. Auto OCR chỉ chạy khi packet có ảnh.

---

## 5. Thuật toán xử lý ảnh trong `az.class`

Worker nhận:

```java
new az(Image captcha, int targetId, byte menuId)
```

### 5.1 Trích pixel

```java
int width = image.getWidth();
int height = image.getHeight();
int[] pixels = new int[width * height];

image.getRGB(pixels, 0, width, 0, 0, width, height);
```

### 5.2 Chuyển thành chuỗi bit

Mỗi pixel được tách thành alpha, red, green và blue.

Điều kiện thực tế, đối chiếu bytecode:

```java
boolean one = alpha == 0
    || (red > 84 && green > 84 && blue > 84);

bits += one ? "1" : "0";
```

> Lưu ý: decompiler cấp cao từng biểu diễn sai điều kiện alpha. Bytecode `az.class` cho thấy helper `int(int)` trả về `n == 0`; vì vậy điều kiện đúng là `alpha == 0`, không phải `alpha >= 128`.

### 5.3 Form gửi OCR

Worker tạo payload:

```text
formParts[0]
+ bits
+ formParts[1]
+ width
+ formParts[2]
+ height
```

Ba `formParts` được nhận từ cấu hình động, không phải literal cố định trong JAR.

Một representation tương đương để triển khai local:

```text
data=<bitmap>&width=<width>&height=<height>
```

Representation này đúng về dữ liệu, nhưng tên field chính xác của OCR AngelChip phải lấy từ config động nếu muốn gọi lại endpoint cũ.

---

## 6. HTTP OCR bên ngoài

Worker dùng Java ME `HttpConnection`:

```text
POST <dynamic OCR URL>
Content-Type: application/x-www-form-urlencoded
Content-Length: form.length
Connection: close
```

Ảnh không được upload nguyên file. JAR gửi chuỗi bitmap sau bước threshold.

### Response OCR

```text
i8 status
```

| Status | Các trường tiếp theo | Hành vi |
|---:|---|---|
| `0` | `UTF message` | Hiện thông báo và dừng/đổi flow |
| `1` | `i8 resultType`, `UTF answer` | OCR thành công; `answer` được gửi về game |
| `-1` | `UTF message` | Lỗi OCR/service |
| `3` | Ba chuỗi UTF và metadata | Flow cập nhật/đăng nhập phụ |

Các sentinel đã giải mã từ class:

```text
TRYAGAIN
ERROR
```

Worker retry có giới hạn; sau nhiều lần `TRYAGAIN` sẽ đóng flow và hiển thị lỗi.

---

## 7. Gửi đáp án về game

Khi OCR trả `answer`, worker gọi service với:

```text
targetId
menuId
answer
```

### Body

```text
i32 targetId
i8  menuId
UTF answer
```

Ví dụ:

```text
targetId = 123
menuId   = 7
answer   = "4827"
```

Body:

```hex
0000007b 07 0004 34383237
```

Tách trường:

```text
0000007b  # targetId
07        # menuId
0004      # UTF length
34383237  # "4827"
```

Command gửi đáp án phải lấy từ service J2ME tương ứng của `fV`; không nên dùng opcode Android `-70` nếu chưa xác minh mapping giữa hai client.

---

## 8. Cấu hình đóng gói trong JAR

Resource:

```text
normal/lg.png
```

Thực chất là archive mã hóa XOR, không phải PNG thông thường.

XOR key:

```text
NguyenHuuQuyet
```

Sau giải mã, archive chứa:

```text
c.png
t.png
u.png
```

`u.png` là Base64 config. Giải mã được:

```text
0=duchiep_fsvl
1=AngelChip.Net
2=http://chip.vcdn.io.vn/avatar/full/
3=https://www.facebook.com/angelchip1102
4=Lỗi kết nối! Không thể tải dữ liệu Auto
```

### Cấu hình động

`cU.class` tải thêm cấu hình từ server và đọc:

1. Các chuỗi hệ thống.
2. Bảng resource `br`.
3. Một URL/base string.
4. Bốn byte cấu hình câu cá.
5. Ba chuỗi `az.do[0..2]` dùng để ghép form OCR.
6. Một byte chọn biến thể endpoint OCR.
7. Các bảng map/item khác.

Do đó URL OCR và field form có thể thay đổi mà không phát hành lại JAR.

---

## 9. Bằng chứng runtime

### MicroEmulator

JAR chạy được bằng MicroEmulator:

```bash
java -jar microemulator.jar \
  --rms file \
  --resizableDevice 360 640 \
  avatar-auto.jar
```

Manifest xác nhận MIDlet:

```text
MIDlet-1: Avatar AngelChip,/icon.png,main.AngelChip
MIDlet-Version: 2.6.8
MicroEdition-Configuration: CLDC-1.1
MicroEdition-Profile: MIDP-2.0
```

### Ảnh CAPTCHA thật

Đã quan sát màn hình runtime có:

```text
Mời nhập mã pin:
[ảnh CAPTCHA nhiễu]
```

Đã hook:

```java
javax.microedition.lcdui.Image.createImage(byte[], int, int)
```

và dump các PNG runtime. Ảnh ứng viên CAPTCHA có kích thước:

```text
100 × 15
```

Ví dụ file nghiên cứu trong session:

```text
$CLAUDE_JOB_DIR/tmp/dumped-146.png
```

### Điều chưa có bằng chứng

Chưa có log chứng minh đầy đủ chuỗi:

```text
ảnh CAPTCHA thật
→ OCR ra mã chính xác
→ gửi đáp án
→ server chấp nhận
→ game tiếp tục
```

Vì vậy người nhận bàn giao không được ghi trạng thái tính năng là “đã verify live”.

---

## 10. Solver nghiên cứu hiện có

File throwaway trong job directory:

```text
$CLAUDE_JOB_DIR/tmp/diamond-captcha-solver.ts
```

Các hàm:

```ts
decodeChallenge(body)
imageToOcrForm(pngBytes)
encodeAnswer(challenge, answer)
```

### Việc cần sửa trước khi dùng

- Giữ điều kiện alpha là `a === 0`.
- Không hardcode `cmd -70`; dùng opcode gửi đáp án đã xác minh từ client J2ME.
- Không giả định prompt chứa bốn chữ số.
- Không log đáp án hoặc PNG nếu đây là dữ liệu nhạy cảm.
- Không tuyên bố end-to-end success trước khi server phản hồi thành công.

---

## 11. Hướng triển khai được khuyến nghị

### Phương án an toàn: human-in-the-loop

1. Backend nhận `cmd -60`.
2. Parse metadata và PNG.
3. Phát WebSocket event cho đúng tài khoản.
4. UI hiển thị prompt và ảnh.
5. Người dùng nhập mã.
6. Backend gửi lại `targetId`, `menuId`, `UTF answer`.
7. Chờ packet phản hồi từ server để đánh dấu accepted/rejected.

### State đề xuất

```ts
interface PendingCaptcha {
  challengeId: string;
  accountId: number;
  targetId: number;
  menuId: number;
  prompt: string;
  inputType: number;
  imageBase64: string;
  receivedAt: number;
  expiresAt: number;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'expired';
}
```

### Giới hạn an toàn

- Chỉ chấp nhận PNG magic `89 50 4E 47 0D 0A 1A 0A`.
- Giới hạn ảnh, đề xuất `64 KiB`.
- Một challenge pending trên mỗi session.
- Không lưu đáp án vào database/log.
- Xóa challenge khi logout, socket đóng hoặc hết hạn.
- Chống submit lại bằng `challengeId` một lần.

---

## 12. Checklist cho người tiếp nhận

### Static verification

- [x] Trích đúng class phân biệt hoa/thường.
- [x] Xác minh `cmd -60` chứa PNG.
- [x] Xác minh threshold pixel từ bytecode.
- [x] Xác minh response OCR.
- [x] Xác minh layout gửi đáp án.

### Implementation

- [ ] Thêm parser `cmd -60` vào client hiện tại.
- [ ] Xác định chính xác opcode gửi đáp án trong client J2ME.
- [ ] Thêm pending challenge state.
- [ ] Thêm WebSocket event/API submit.
- [ ] Thêm UI hiển thị ảnh và nhập mã.

### Live verification bắt buộc

- [ ] Nhận packet `cmd -60` từ server thật.
- [ ] UI hiển thị đúng PNG.
- [ ] Người dùng nhập mã hiển thị trong ảnh.
- [ ] Client gửi đúng metadata và UTF answer.
- [ ] Server xác nhận đáp án đúng.
- [ ] Game Kim Cương tiếp tục tải/chạy.
- [ ] Captcha sai được reject rõ ràng.
- [ ] Captcha hết hạn không thể replay.

---

## 13. Những kết luận cũ cần loại bỏ

Không sử dụng các kết luận sau từ các vòng reverse ban đầu:

```text
-68 NUMBER_SUPPORT là CAPTCHA Kim Cương
-70 TEXT_BOX chắc chắn là CAPTCHA Kim Cương
CAPTCHA luôn nằm trong prompt dạng text
cmd 21 [21,0] tự nó mở được Kim Cương trên Android session chính
```

Các kết luận này xuất phát từ:

1. Nhầm protocol Android với J2ME.
2. Class bị ghi đè do case-insensitive filesystem.
3. Suy luận trước khi lấy đúng `fJ.class`, `al.class` và `az.class`.

Nguồn đáng tin cậy nhất cho CAPTCHA JAR hiện tại là:

```text
fJ.class → case -60
az.class → image preprocessing + OCR HTTP
al.class → Auto Kim Cương state machine
```

---

## 14. Đường dẫn nghiên cứu liên quan

```text
avatar-jar/avatar-auto.jar
avatar-re/il2cpp_out/dump.cs
avatar-re/il2cpp_out/script.json
avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so
avatar-re/frida_scripts/_parser.js
avatar-web/server/src/proto/session.ts
avatar-web/server/src/proto/reader.ts
avatar-web/server/src/proto/writer.ts
```

Các file trong `$CLAUDE_JOB_DIR/tmp` là throwaway và sẽ bị xóa khi job bị xóa. Nếu cần giữ decompile output hoặc ảnh nghiên cứu, hãy sao chép sang vị trí durable sau khi xem xét dữ liệu nhạy cảm.
