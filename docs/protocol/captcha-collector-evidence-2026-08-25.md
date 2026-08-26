# Bằng chứng giao thức CAPTCHA Collector (`avatar-auto.jar` & Server)

**Ngày:** 2026-08-25  
**Phạm vi:** Bằng chứng static reverse và wire format cho luồng mở cổng game, nhận CAPTCHA, đóng dialog và yêu cầu ảnh mới.

---

## 1. Static Reverse từ `avatar-auto.jar`

Các class được trích xuất bằng Python `ZipFile.read()` trực tiếp sang file tạm phân biệt hoa/thường để tránh lỗi ghi đè trên hệ điều hành macOS:

### 1.1. Màn hình chọn cổng game (`aO.class`)
- Class `aO` quản lý menu chọn cổng game / minigame trước khi vào từng game cụ thể.
- Menu chứa các mục: Tiến Lên, Phỏm, Kim Cương, Bầu Cua, Chuyển tiền.
- Khi chọn mục mở cổng (Auto Kim Cương), method `aO.case()` được gọi:
  ```java
  // Bytecode call trong aO.case()
  fV.do().int(aO.do[10]);
  ```
- Mảng hằng số `aO.do`:
  ```java
  aO.do[10] = 3;
  ```
- Method `fV.int(int val)` tạo packet:
  ```text
  command = -1
  body:
      i32 value (big-endian)
  ```
- Do đó, request mở cổng game trước menu chọn game là:
  ```text
  TX cmd = -1
  body = [00, 00, 00, 03] (i32 3)
  ```

### 1.2. Packet CAPTCHA Challenge (`fJ.class`)
- Server gửi challenge về client qua packet `cmd = -60`.
- Trong `fJ.class` nhánh `case -60`:
  ```java
  int targetId = reader.readInt();
  byte menuId = reader.readByte();
  String prompt = reader.readUTF();
  byte inputType = reader.readByte();

  byte[] imageData = null;
  if (reader.available() > 0) {
      int imageLength = reader.readShort(); // DataInputStream.readShort() -> signed i16
      imageData = new byte[imageLength];
      reader.read(imageData);
  }
  ```
- Cấu trúc wire format:
  ```text
  RX cmd = -60
  body:
      i32 targetId     (4 bytes, big-endian)
      i8  menuId       (1 byte, signed)
      u16 promptLen    (2 bytes, big-endian)
      str prompt       (promptLen bytes, UTF-8)
      i8  inputType    (1 byte, signed)
      [Optional nếu còn bytes]:
          i16 imageLength (2 bytes, signed short, 1..32767)
          bytes imageBytes (imageLength bytes)
  ```

### 1.3. Cơ chế đóng Dialog CAPTCHA (`cc.class`)
- Khi người dùng hoặc auto đóng dialog CAPTCHA:
- Dialog nằm trong class `cc`.
- Xử lý close action (code `120`) trong `cc.if(..., 120)`:
  ```java
  bx.do = null;
  ```
- **Kết luận:** Đóng dialog hoàn toàn là hành vi cục bộ phía UI client (`UI-only`), không gửi packet mạng lên server, không gọi method của `fV` và không ghi dữ liệu vào socket. Headless client triển khai `closeCaptchaDialog()` là no-op.
- Tuyệt đối không gọi callback submit `eg` vì callback đó sẽ gửi đáp án (answer) lên server.

### 1.4. Cơ chế yêu cầu CAPTCHA mới
- Để nhận CAPTCHA mới, sau khi đóng dialog, client gửi lại chính xác packet mở cổng:
  ```text
  TX cmd = -1
  body = [00, 00, 00, 03] (i32 3)
  ```
- Không gửi kèm token, targetId cũ hay opcode đóng dialog nào khác.

---

## 2. Magic Bytes nhận diện định dạng ảnh

Client nhận diện định dạng ảnh thông qua magic bytes tiêu chuẩn:
1. **PNG**: `89 50 4E 47 0D 0A 1A 0A` (8 bytes)
2. **JPEG**: `FF D8 FF` (3 bytes)
3. **GIF**: `47 49 46 38 37 61` (`GIF87a`) hoặc `47 49 46 38 39 61` (`GIF89a`) (6 bytes)

Collector lưu nguyên vẹn buffer bytes nhận được từ server, không chuyển đổi hoặc re-encode.

---

## 3. Quy ước và Giới hạn an toàn

- **Tối đa payload ảnh:** 5 MiB (`MAX_CAPTCHA_IMAGE_BYTES = 5 * 1024 * 1024`).
- **Giới hạn J2ME signed short:** 32,767 bytes (`1..32767`).
- **Giới hạn duplicate liên tiếp:** 20 lần trùng hash SHA-256 liên tiếp sẽ dừng chương trình.
- **Giới hạn lỗi liên tiếp:** 5 lần lỗi decode/nhận diện liên tiếp sẽ dừng chương trình.
- **Bảo mật:** Không bao giờ log credentials (password), socket keys hay toàn bộ login packet ra console, file logs hay metadata JSON.
