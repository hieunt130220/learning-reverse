# Danh Sách & Phân Tích Các Map Câu Cá & Bảng Mapping ID Cá — AvatarHD

> **Ngày lập:** 2026-09-08  
> **Nguồn bằng chứng:**
> - Disassembly Native (`libil2cpp.so`) & String Literals (`stringliteral.json`) APK AvatarHD 3.4.4.
> - Mã nguồn dịch ngược bot `avatar-auto.jar` (`gs_0.java`, `bs_0.java`, `cb.java`, `fj_0.java`).
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
  - Mồi câu: Mồi câu cơ bản (mồi cơm).
- **Thủy sản mục tiêu:** Cá rô (`444`), cá lòng tong (`449`), cá chép vàng (`450`).

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
- **Thủy sản mục tiêu:** Cá lóc (`451`), cá nóc (`452`), con cua (`453`).

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
- **Thủy sản mục tiêu:** Cá chim (`454`), cá đuối (`455`), cá ngựa (`456`), cá mập (`457`).

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

## 3. Bảng Mapping ID Sang Tên Tất Cả Các Loại Cá

### 3.1. Thủy Sản Câu Được (Hồ Câu Khu Sinh Thái)

Bảng trích xuất trực tiếp từ vector khởi tạo bảng giá bán và bộ lọc cá của bot auto `avatar-auto.jar` ([tools/jar/all_src/bs_0.java:1447-1455](tools/jar/all_src/bs_0.java#L1447-L1455)):

| ID (`idFish` / Item ID) | Tên loại cá / thủy sản | Vị trí hồ câu | Giá bán NPC (Xu) | Ghi chú & Đặc điểm |
| :---: | :--- | :---: | :---: | :--- |
| **`444`** | **Cá rô** | Map 14 (Hồ cá rô) | 50 xu | Cá phổ biến nhất hồ cá rô |
| **`449`** | **Cá lòng tong** | Map 14 (Hồ cá rô) | 50 xu | Cá nhỏ, tỉ lệ cắn câu cao |
| **`450`** | **Cá chép vàng** | Map 14 (Hồ cá rô) | 60 xu | Cá giá trị cao nhất hồ cá rô |
| **`451`** | **Cá lóc** | Map 15 (Hồ cá lóc) | 80 xu | Loài cá chính hồ trung cấp |
| **`452`** | **Cá nóc** | Map 15 (Hồ cá lóc) | 70 xu | Cá hồ trung cấp |
| **`453`** | **Con cua** (Cua) | Map 15 (Hồ cá lóc) | 90 xu | Thủy sản nhiệm vụ ("bắt cua") |
| **`454`** | **Cá chim** | Map 16 (Hồ cá mập) | 100 xu | Cá hồ cao cấp |
| **`455`** | **Cá đuối** | Map 16 (Hồ cá mập) | 110 xu | Cá hồ cao cấp |
| **`456`** | **Cá ngựa** | Map 16 (Hồ cá mập) | 120 xu | Cá hiếm hồ cao cấp |
| **`457`** | **Cá mập** | Map 16 (Hồ cá mập) | — | Quý hiếm nhất, auto bot đếm riêng và giữ lại rương |

### 3.2. Cá Câu Tại Bến Tàu (Map 27 — Biển Đặc Biệt)

Server push `RX 79 (CAN_CAU)` chứa `idFish` thuộc dải ID mở rộng:

| ID (`idFish`) | Vị trí câu | Tên loại cá / Phân loại | Ghi chú & Đặc điểm |
| :---: | :---: | :--- | :--- |
| **`4503`** | Map 27 (Bến tàu / Biển Hawai) | **Cá voi trắng** | 200 xu |
| **`4504`** | Map 27 (Bến tàu / Biển Hawai) | **Cá lia thia** | 140 xu |
| **`4505`** | Map 27 (Bến tàu / Biển Hawai) | **Cá chép** | 150 xu (phân biệt với Cá chép vàng 450) |
| **`4506`** | Map 27 (Bến tàu / Biển Hawai) | **Cá hề** | 160 xu |
| **`4507`** | Map 27 (Bến tàu / Biển Hawai) | **Cá vàng** | 170 xu (thời gian delay mini-game 20-25s) |
| **`4508`** | Map 27 (Bến tàu / Biển Hawai) | **Nhái** | 175 xu |
| **`4509`** | Map 27 (Bến tàu / Biển Hawai) | **Chàng hiu** | 180 xu |
| **`4510`** | Map 27 (Bến tàu / Biển Hawai) | **Ếch** | 185 xu |
| **`4511`** | Map 27 (Bến tàu / Biển Hawai) | **Sứa** | 190 xu |
| **`4512`** | Map 27 (Bến tàu / Biển Hawai) | **Lợn biển** | 330 xu |
| **`4513`** | Map 27 (Bến tàu / Biển Hawai) | **Cá voi sát thủ** | 300 xu |
| **`4514`** | Map 27 (Bến tàu / Biển Hawai) | **Cá mập** | Thủy sản hiếm |
| **`4515`** | Map 27 (Bến tàu / Biển Hawai) | **Cá heo** | 250 xu |
| **`4516`** | Map 27 (Bến tàu / Biển Hawai) | **Mực** | 195 xu |

### 3.3. Cá & Thủy Sản Trong Nông Trại (Farm / Ao Cá)

Hệ thống nuôi trồng thủy sản trong Nông trại (khác với hệ thống câu cá giải trí):

| ID | Tên gọi | Ngữ cảnh | Đặc điểm |
| :---: | :--- | :--- | :--- |
| **`54`** | **Cá chép** | Ao nuôi nông trại | Mua con giống thả vào ao, bán lớn 10.000 xu |
| **`59`** | **Rùa** | Ao nuôi nông trại | Thủy sản nuôi ao cùng cá chép |
| **`283`** | **Cá chép chế biến** | Kho thực phẩm / Bếp | Nguyên liệu nấu món *"Cá chép om dưa"* (Món ăn ID `23`) |

### 3.4. Dụng Cụ, Mồi & Vé Câu Đi Kèm (Dải ID 44x..46x)

Các vật phẩm hỗ trợ câu cá nằm liền kề với ID cá trong cơ sở dữ liệu game:

| ID | Loại | Tên vật phẩm | Chi tiết mua / Sử dụng |
| :---: | :--- | :--- | :--- |
| **`442`** | Cần câu | Cần câu tre | Mua 10.000 xu (hạn 7 ngày) |
| **`445`** | Cần câu | Cần câu sắt | Mua 25 Lượng (20 ngày) hoặc 100 Lượng (30 ngày) |
| **`446`** | Cần câu | Cần câu VIP | Mua bằng Lượng, tăng tỉ lệ câu thành công |
| **`443`** | Mồi câu | Mồi cơm | 5 xu / mồi |
| **`447`** | Mồi câu | Mồi trùng | 20 xu / mồi |
| **`448`** | Mồi câu | Trứng kiến | 30 xu / mồi |
| **`458`** | Vé câu | Vé câu cá rô | 1.000 xu (hạn 3 ngày) |
| **`459`** | Vé câu | Vé câu cá lóc | 10.000 xu (hạn 5 ngày) |
| **`460`** | Vé câu | Vé câu cá mập | 2 Lượng (hạn 2 ngày) |

---

## 4. Bảng Tổng Hợp Tham Chiếu Khu Vực & Nhóm Cá

| Khu vực | Map ID (`roomID`) | Tọa độ tham chiếu `(x, y)` | Yêu cầu vé / Chi phí | Nhóm cá mục tiêu (ID) |
| :--- | :---: | :---: | :--- | :--- |
| **Khu sinh thái** | `13` | `(364, 64)` *(NPC)* | Không cần vé vào cổng | NPC bán vé câu (`458`, `459`, `460`), cần câu & mồi câu |
| **Khu cá rô** | **`14`** | `(254, 82)` / `(460, 97)` | Vé câu cá rô (`ID 458`) | Cá rô (`444`), Cá lòng tong (`449`), Cá chép vàng (`450`) |
| **Khu cá lóc** | **`15`** | `(36, 97)` | Vé câu cá lóc (`ID 459`, 10.000 xu) | Cá lóc (`451`), Cá nóc (`452`), Con cua (`453`) |
| **Khu cá mập** | **`16`** | `(324, 157)` | Vé câu cá mập (`ID 460`, Lượng) | Cá chim (`454`), Cá đuối (`455`), Cá ngựa (`456`), Cá mập (`457`) |
| **Bến tàu** | **`27`** | `(254, 82)` *(area 0)* | **Vé câu cá bến tàu** | Cá lia thia (`4504`), Cá chép (`4505`), Cá hề (`4506`), Cá vàng (`4507`), Nhái (`4508`), Chàng hiu (`4509`), Ếch (`4510`), Sứa (`4511`), Cá heo (`4515`), Mực (`4516`)... |

---

## 5. Trích Dẫn Mã Nguồn Bằng Chứng

### 5.1. Mapping Map ID từ `gs_0.java` (Auto JAR)
```java
vector.addElement(new fn_0("ID 13: Khu sinh thái", new bd(do[37])));
vector.addElement(new fn_0("ID 14: Khu cá rô", new bd(do[84])));
vector.addElement(new fn_0("ID 15: Khu cá lóc", new bd(do[1])));
vector.addElement(new fn_0("ID 16: Khu cá mập", new bd(do[5])));
...
vector.addElement(new fn_0("ID 27: Đảo Hawai", new bd(do[86])));
```

### 5.2. Khởi Tạo Danh Sách ID Cá trong `bs_0.java` (Auto JAR)
```java
// Khởi tạo vector các loại cá tự động bán cho lái buôn
do.addElement(new bl_0(444, "cá rô"));
do.addElement(new bl_0(449, "cá lòng tong"));
do.addElement(new bl_0(450, "cá chép vàng"));
do.addElement(new bl_0(451, "cá lóc"));
do.addElement(new bl_0(452, "cá nóc"));
do.addElement(new bl_0(453, "con cua"));
do.addElement(new bl_0(454, "cá chim"));
do.addElement(new bl_0(455, "cá đuối"));
do.addElement(new bl_0(456, "cá ngựa"));
// Cá mập (457) được auto bot đếm số lượng bắt được và lọc không bán
```

### 5.3. Logic Mua Vé & Tọa Độ Câu trong `bs_0.java` (Auto JAR)
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
