# Danh Sách & Phân Tích Các Map Câu Cá — AvatarHD

> **Ngày lập:** 2026-09-08  
> **Nguồn bằng chứng:**
> - Disassembly Native (`libil2cpp.so`) & String Literals (`stringliteral.json`) APK AvatarHD 3.4.4.
> - Mã nguồn dịch ngược bot `avatar-auto.jar` (`gs_0.java`, `bs_0.java`, `cb.java`).
> - Static CityMap TextAsset (`PositionMap`, SHA-256 `e3fc3c12...`).
> - Dữ liệu live probe & packet capture (`docs/superpowers/specs/2026-08-26-auto-fishing-design.md`, `avatar-re/notes/fishing.md`).

---

## 1. Tổng Quan Cơ Chế & Ngữ Cảnh Protocol

Hệ thống câu cá trong AvatarHD hoàn toàn nằm trong ngữ cảnh **Park (Handler 9)**, không phải Farm:

1. **Chuyển ngữ cảnh:** Gửi `GET_HANDLER (-1)` với `index = 9` (`GlobalService.getHandler(9)`).
2. **Lệnh vào map / chuyển khu:** Gửi `cmd 80 (AVATAR_JOIN_PARK / doJoinPark)` với payload 6 byte:
   ```text
   i8  roomID      // ID bản đồ (13, 14, 15, 16, 27)
   i8  boardID     // Số hiệu khu vực / area (thường là 0..n; -1 nếu mặc định)
   i16 x           // Tọa độ X join native (xJoinCasino / LoadMap)
   i16 y           // Tọa độ Y join native (yJoinCasino / LoadMap)
   ```
3. **Khu vực trung chuyển (Hub):** **Khu sinh thái (`roomID = 13`)**
   - Node 1 trên CityMap hiển thị là `Khu sinh thái` (`idToMap = 13`).
   - Tọa độ join mặc định: `(473, 100)`.
   - Vị trí NPC bán vé câu, cần câu, mồi câu: tọa độ `(364, 64)`.
   - Đóng vai trò là sảnh chờ để di chuyển vào 3 khu câu cá truyền thống: Cá rô, Cá lóc, Cá mập.

---

## 2. Chi Tiết Các Khu Câu Cá

### 2.1. Khu Câu Cá Rô
- **Map ID (`roomID`):** `14` (`ID 14: Khu cá rô` — `gs_0.java:3318`).
- **Phân cấp đối tượng:** Người mới tập câu.
  - *Chuỗi game:* `"Khu câu cá rô dành cho người mới tập câu"` (String literal `0x1B419D0`).
- **Tọa độ tham chiếu:**
  - Tọa độ join native / spec: `(254, 82)`.
  - Tọa độ câu auto-bot (`bs_0.java`): `x = 460, y = 97`.
- **Yêu cầu & Vé vào cổng:**
  - **Vé câu cá rô:** Item ID `458`.
  - Cần câu: Cần câu tre / sắt / VIP.
  - Mồi câu: Mồi câu cơ bản.
- **Thủy sản mục tiêu:** Cá rô, cá lòng tong, cá chép vàng...

### 2.2. Khu Câu Cá Lóc
- **Map ID (`roomID`):** `15` (`ID 15: Khu cá lóc` — `gs_0.java:3319`).
- **Phân cấp đối tượng:** Người chơi đã biết câu (trung cấp).
  - *Chuỗi game:* `"Khu câu cá lóc dành cho các bạn đã biết câu"` (String literal `0x1B419C0`).
- **Tọa độ tham chiếu:**
  - Tọa độ câu auto-bot (`bs_0.java`): `x = 36, y = 97`.
- **Yêu cầu & Vé vào cổng:**
  - **Vé câu cá lóc:** Item ID `459`.
  - Giá vé: **10.000 xu** (mua tại NPC Khu sinh thái).
  - Cần câu: Cần câu sắt / VIP.
- **Thủy sản mục tiêu:** Cá lóc, cá nóc, cua...

### 2.3. Khu Câu Cá Mập
- **Map ID (`roomID`):** `16` (`ID 16: Khu cá mập` — `gs_0.java:3320`).
- **Phân cấp đối tượng:** Cao thủ câu cá (cao cấp).
  - *Chuỗi game:* `"Khu câu cá mập dành cho các bạn đã là cao thủ câu cá"` (String literal `0x1B419C8`).
- **Tọa độ tham chiếu:**
  - Tọa độ câu auto-bot (`bs_0.java`): `x = 324, y = 157`.
- **Yêu cầu & Vé vào cổng:**
  - **Vé câu cá mập:** Item ID `460`.
  - Giá vé: Mua bằng **Lượng** (tại NPC Khu sinh thái).
  - Cần câu: Cần câu VIP.
- **Thủy sản mục tiêu:** Cá mập, cá chim, cá đuối, cá ngựa...

### 2.4. Bến Tàu (Khu Câu Cá Đặc Biệt / Bến Đảo Hawai)
- **Map ID (`roomID`):** `27` (`ID 27: Đảo Hawai / Bến tàu` — `gs_0.java:3326`).
- **Phân cấp đối tượng:** Khu câu cá đặc biệt / cao cấp.
- **Tọa độ tham chiếu:**
  - Khu vực: Thường câu ở `area = 0`.
  - Tọa độ join mặc định: `(254, 82)`.
- **Cơ chế xác thực & Phản hồi từ Server:**
  - Khi join vào map 27, server gửi gói `cmd -40` kèm dialog: *"Khu câu cá đặc biệt"*.
  - Khi client gửi lệnh bắt đầu câu `TX 45 (START_CAU_CA)`, nếu nhân vật không có vé bến tàu, server trả về `RX 45` với cờ `iss = false` kèm thông báo tiếng Việt:
    > `"Bạn cần vé câu cá bến tàu để câu cá khu vực này"`
- **Yêu cầu & Vé vào cổng:**
  - **Vé câu cá bến tàu:** Vé sự kiện hoặc mua theo cơ chế đặc thù của bến tàu (không phải vé mua bằng xu thông thường tại Map 13).
- **Đặc điểm cá & mini-game:**
  - Bắt các loài cá hiếm dải ID `45xx` (đã live capture: `idFish = 4507`, `4510`...).
  - Thời gian chờ delay kéo dài từ 20.000ms đến 25.000ms.
  - Thử thách `arrImg` và `arrImgNew` có độ phức tạp cao hơn (từ 6 đến 9 hình mẫu ngẫu nhiên).

---

## 3. Bảng Tổng Hợp Tham Chiếu

| Khu vực | Map ID (`roomID`) | Tọa độ tham chiếu `(x, y)` | Yêu cầu vé / Chi phí | Nhóm cá mục tiêu |
| :--- | :---: | :---: | :--- | :--- |
| **Khu sinh thái** | `13` | `(364, 64)` *(NPC)* | Không cần vé vào cổng | NPC bán vé câu (`458`, `459`, `460`) & cần câu |
| **Khu cá rô** | **`14`** | `(254, 82)` / `(460, 97)` | Vé câu cá rô (`ID 458`) | Cá rô, cá chép vàng, cá lòng tong |
| **Khu cá lóc** | **`15`** | `(36, 97)` | Vé câu cá lóc (`ID 459`, 10.000 xu) | Cá lóc, cá nóc, cua |
| **Khu cá mập** | **`16`** | `(324, 157)` | Vé câu cá mập (`ID 460`, Lượng) | Cá mập, cá chim, cá đuối, cá ngựa |
| **Bến tàu** | **`27`** | `(254, 82)` *(area 0)* | **Vé câu cá bến tàu** | Cá đặc biệt (dải ID 45xx như 4507, 4510) |

---

## 4. Trích Dẫn Mã Nguồn Bằng Chứng

### 4.1. Mapping Map ID từ `gs_0.java` (Auto JAR)
```java
vector.addElement(new fn_0("ID 13: Khu sinh thái", new bd(do[37])));
vector.addElement(new fn_0("ID 14: Khu cá rô", new bd(do[84])));
vector.addElement(new fn_0("ID 15: Khu cá lóc", new bd(do[1])));
vector.addElement(new fn_0("ID 16: Khu cá mập", new bd(do[5])));
...
vector.addElement(new fn_0("ID 27: Đảo Hawai", new bd(do[86])));
```

### 4.2. Logic Mua Vé & Tọa Độ Câu trong `bs_0.java` (Auto JAR)
```java
// Tọa độ câu theo map
switch (this.long) {
    case 14: { // Khu cá rô
        fj.int = 460; // X
        fj.byte = 97;  // Y
        break;
    }
    case 15: { // Khu cá lóc
        fj.int = 36;  // X
        fj.byte = 97;  // Y
        break;
    }
    case 16: { // Khu cá mập
        fj.int = 324; // X
        fj.byte = 157; // Y
        break;
    }
}
fp.do().do(this.long, n2); // Gửi cmd 80 doJoinPark(mapId, areaId)

// Mua vé tại map 13 (Khu sinh thái)
switch (this.long) {
    case 14:
        er_0.do().do(458, 1); // Mua vé cá rô (ID 458)
        break;
    case 15:
        // Cần tối thiểu 10.000 xu
        er_0.do().do(459, 1); // Mua vé cá lóc (ID 459)
        break;
    case 16:
        // Cần Lượng
        er_0.do().do(460, 2); // Mua vé cá mập (ID 460)
        break;
}
```
