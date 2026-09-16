# Danh Sách & Phân Tích Kỹ Thuật Tất Cả Các Map Trong AvatarHD APK (Unity IL2CPP)

> **Ngày lập:** 2026-09-16  
> **Phiên bản target:** AvatarHD 3.4.4 APK (`com.TeaM.Avatar`, APK SHA-256 `401b1788...`)  
> **Nguồn trích xuất:**
> - Disassembly native `libil2cpp.so` + `il2cpp_out/dump.cs` + `script.json`
> - Static `CityMap` TextAsset (`PositionMap`, SHA-256 `e3fc3c12...`)
> - Hằng số map trong `LoadMap` (`T_*`), `MapScr`, `MiniMap`, `ImageMap`
> - Chuỗi định danh UI trong `T.strText*` & `stringliteral.json`

---

## 1. Tổng Quan Kiến Trúc Map Trong AvatarHD APK

Khác với phiên bản Java J2ME (`.jar`), toàn bộ logic bản đồ của AvatarHD APK chạy trên nền tảng **Unity IL2CPP** (C# biên dịch sang native ARM64):

### 1.1 Các Ngữ Cảnh Handler (`GET_HANDLER -1`)
Server phân tuyến xử lý bản đồ qua lệnh `GET_HANDLER (-1) + [i8 index]`:
- **Handler 8 (`AvatarMsgHandler`):** Ngữ cảnh trò chơi chính / Handshake sau login.
- **Handler 9 (`ParkMsgHandler`):** Quản lý toàn bộ bản đồ Thành Phố, Công Viên, Khu Mua Sắm, Sinh Thái, Giải Trí, Ngoại Ô, Nhà Ở, Sân Bay.
- **Handler 10 (`FarmMsgHandler`):** Ngữ cảnh Nông Trại (trồng trọt, chăn nuôi, ao cá, kho, ATM).
- **Handler 3 (`CasinoMsgHandler`):** Ngữ cảnh Sòng Bạc Casino & các phòng game bài/cờ.

### 1.2 Giao Thức Di Chuyển & Tham Gia Map
- **Vào khu / bản đồ (`cmd 80 - AVATAR_JOIN_PARK`):**
  ```text
  Payload: [i8 roomID][i8 boardID][i16 x][i16 y] (6 byte)
  ```
  - `roomID`: ID bản đồ server (trùng hằng số `LoadMap.T_*` hoặc `MapScr`).
  - `boardID`: Số hiệu khu vực / phòng (`0..n`; `-1` nếu chọn mặc định).
  - `x, y`: Tọa độ native lấy từ `LoadMap.xJoinCasino/yJoinCasino` (được nạp từ `PositionMap`).
- **Chọn khu từ MiniMap (`cmd -23 - SELECTED_MINI_MAP`):** `[i8 idCityMap][i8 id]`.
- **Yêu cầu danh sách khu (`cmd 90 - REQUEST_BOARD_LIST`):** `[i8 roomID]`.
- **Dữ liệu gói snapshot vào map (`cmd -34 - LOGIN_SUCCESS / enter-world`):** Trả về danh sách người chơi, item map, animation và danh sách NPC/đối tượng tương tác (`ItemMapSpecial`).

---

## 2. Bản Đồ Thành Phố Chính (CityMap / PositionMap)

Bản đồ gốc điều hướng thành phố được lưu trong TextAsset `CityMap` (`PositionMap`, 188 byte):

| Node ID | Tên khu vực | Tọa độ native (x, y) | Handler | roomID (`idToMap`) | Chức năng chính |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **`1`** | **Khu sinh thái** | `(473, 100)` | 9 | `13` | Hub câu cá, NPC bán vé, cần câu, mồi câu |
| **`3`** | **Khu giải trí** | `(236, 280)` | 9 | `9` | Tòa thị chính, Casino, trường đua, hội quán cờ |
| **`4`** | **Khu mua sắm** | `(452, 250)` | 9 | `23` | Shop thời trang, Thẩm mỹ viện, Cửa hàng quà tặng, Pet |
| **`5`** | **Công viên** | `(254, 82)` | 9 | `11` | Giao lưu bạn bè, quay số, đấu giá, cưới hỏi |
| **`7`** | **Nông trại** | `(524, 423)` | 10 | `25` | Trồng trọt, chăn nuôi gà/bò, ao cá, nấu ăn, ATM |
| **`8`** | **Ngoại ô** | `(100, 100)` | 9 | `17` | Khai thác mỏ gỗ và đá, nhiệm vụ |
| **`9`** | **Mê cung** | `(57, 209)` | 9 | `28` | Thử thách mê cung vượt chướng ngại vật |

---

## 3. Chi Tiết Từng Cụm Bản Đồ & Phân Khu (LoadMap.T_*)

### 3.1 Cụm Công Viên & Sự Kiện (`T_PARK`)
- **`T_PARK = 0` (Công viên trung tâm):** Quảng trường, hồ nước, ghế đá trò chuyện, kết nối các phân khu.
- **Phân khu công viên `1..8` (`T_PARK_1` .. `T_PARK_8` = 1..8):**
  - Khu 1: Khu quay số cũ.
  - Khu 2: Khu đấu giá cũ.
  - Khu 3: Khu ăn xin trái.
  - Khu 5: Khu tài xỉu.
  - Khu 6: Khu cô giáo.
  - Khu 7: Dưới khu cô giáo.
  - Khu 8: Khu 4 con vịt.
- **`T_PARK_PATH = 11` (Đường công viên):** Khu nối các trục đường chính.
- **`T_PARK_ADVANCED = 12` (Công viên mở rộng):** Các tiện ích mở rộng của công viên.
- **`T_CONG_SANH_CUOI = 10` & `T_LE_CUOI = 19`:** Cổng sảnh cưới và Nhà thờ tổ chức lễ cưới cho các cặp đôi.
- **`T_PRISON = 18`:** Nhà tù giam giữ nhân vật vi phạm.

### 3.2 Cụm Khu Sinh Thái & Câu Cá (`T_FISHING`)
- **`T_FISHING_ADVANCED = 13` (Khu sinh thái):** Sảnh trung chuyển, vị trí NPC bán vật phẩm câu cá tại tọa độ `(364, 64)`.
- **`T_FISING_1 = 14` (Hồ câu cá rô):** Dành cho người mới tập câu. Cần vé câu cá rô (Item ID `458`). Thủy sản: Cá rô (`444`), cá lòng tong (`449`), cá chép vàng (`450`).
- **`T_FISING_2 = 15` (Hồ câu cá lóc):** Cấp trung cấp. Vé câu cá lóc (Item ID `459`, 10.000 xu). Thủy sản: Cá lóc (`451`), cá nóc (`452`), con cua (`453`).
- **`T_FISING_3 = 16` (Hồ câu cá mập):** Cấp cao thủ. Vé câu cá mập (Item ID `460`, mua bằng Lượng). Thủy sản: Cá chim (`454`), cá đuối (`455`), cá ngựa (`456`), cá mập (`457`).
- **`T_POPUP = 27` (Bến tàu / Bến Đảo Hawai):** Khu vực câu cá đặc biệt biển đảo. Cần vé câu bến tàu. Thủy sản hiếm dải ID `45xx`.

### 3.3 Cụm Khu Mua Sắm & Dịch Vụ (`T_KHU_MUA_SAM`)
- **`T_KHU_MUA_SAM = 23`:** Khuôn viên mua sắm ngoài trời.
- **`T_SHOP = 57` & `T_SHOP_2 = 62`:** Cửa hàng thời trang, quần áo, mũ nón.
- **`T_BEAUTYSALON = 58` & `T_BEAUTYSALON_2 = 63`:** Thẩm mỹ viện (thay đổi kiểu tóc, màu mắt, làm đẹp).
- **`T_GIFT = 59` & `T_GIFT_2 = 64`:** Cửa hàng quà tặng, phụ kiện, đồ chơi.
- **`T_PET_SHOP = 104`:** Cửa hàng thú cưng (chó, mèo, pet theo sau).
- **`T_PRIMEUM_SHOP = 103`:** Cửa hàng vật phẩm cao cấp.

### 3.4 Cụm Nông Trại (`T_FARM` / Handler 10)
- **`T_FARMWAY = 25`:** Đường dẫn vào nông trại.
- **`T_FARM = 24`:** Nông trại cá nhân (các ô đất trồng cây, ao cá nhỏ, chuồng nuôi).
- **`T_FARM_FRIEND = 53`:** Nông trại bạn bè (thăm nông trại, tưới cây, bắt sâu hộ).
- **Nông trại Cấp 2 (`isFarmLvl2` / `IDMapLvl2`):** Nông trại mở rộng sau khi nâng cấp.
- **`T_BARN_CHICKEN = 124` & `T_BARN_COW = 125`:** Khu chuồng gà lấy trứng và chuồng bò lấy sữa.
- **`T_SHOP_FARM = 117`:** Cửa hàng nông nghiệp (bán hạt giống, con giống, phân bón, thuốc).
- **`T_CONTAINER_FARM = 118`:** Kho chứa nông sản sau thu hoạch.
- **`T_BANK = 55`:** Cây ATM chuyển tiền giữa tài khoản nông trại và tài khoản chính.
- **`T_COOKING = 98`:** Bếp nấu ăn chế biến món ăn từ nông sản.

### 3.5 Cụm Khu Giải Trí, Casino & Minigame
- **`T_CITY = 9` (Khu giải trí):** Trung tâm giải trí thành phố (Tòa thị chính nhận nhiệm vụ hội nhóm, gian hàng quay số, đấu giá).
- **`T_CASINO = 108` & `T_CASINO_2 = 109`:** Sòng bạc Casino (tầng 1 và tầng 2).
- **`T_RACE = 107`:** Trường đua thú đặt cược (Pet racing).
- **6 Sảnh Chơi Bài / Cờ Trong Casino:**
  - `T_TL = 72`: Sảnh Tiến Lên.
  - `T_P = 73`: Sảnh Phỏm (Tá Lả).
  - `T_CT = 74`: Sảnh Cờ Tướng.
  - `T_CR = 75`: Sảnh Cờ Caro.
  - `T_DM = 76`: Sảnh Domino.
  - `T_BC = 77`: Sảnh Bầu Cua / Ba Cây.
- **Bàn Chờ Chơi Cờ:** `T_BOARD_WAIT_2 = 60`, `T_BOARD_WAIT_4 = 61`, `T_BOARD_WAIT_5 = 65`.
- **Minigame Độc Lập:**
  - `T_MINIGAME_TRUCXANH = 114`: Trò chơi lật hình Trúc Xanh (`TrucXanhService`).
  - `T_MINIGAME_AINCRAD = 115`: Minigame Aincrad (`AincradService`).

### 3.6 Cụm Ngoại Ô, Nhà Tù & Mê Cung
- **`T_SLUM = 17` (Khu ngoại ô):**
  - Định danh: roomID `17`, toạ độ `(100, 100)`.
  - Chức năng: Khu vực khai thác tài nguyên mỏ **Gỗ** và **Đá** phục vụ nâng cấp nông trại cấp 2 và xây dựng.
  - Đối tượng: Chứa các `ItemMapSpecial` (cây, mỏ đá, quái/NPC sự kiện).
  - Tương tác: Gửi lệnh `cmd -59` (chạm) và `cmd -61` (chọn menu đào).
- **`T_PRISON = 18` (Nhà tù):** Nơi giam giữ.
- **`T_STORE = 28` (Mê cung):** Bản đồ mê cung thử thách tìm đường.

### 3.7 Cụm Nhà Ở / Khu Dân Cư (`T_ROAD_HOUSE = 21`)
- **`T_ROAD_HOUSE = 21`:** Đường vào khu nhà ở dân cư.
- **Các Cấp Nhà Riêng:**
  - `T_HOUSE_1 = 68`: Nhà cấp 1 (Nhà tranh / nhà gỗ cơ bản).
  - `T_HOUSE_2 = 69`: Nhà cấp 2 (Nhà phố).
  - `T_HOUSE_3 = 70`: Nhà cấp 3 (Biệt thự).
  - `T_HOUSE_4 = 110`: Nhà cấp 4 (Lâu đài sang trọng).
- **`T_HO_HOUSE = 112`:** Hồ bơi trang bị tại khuôn viên nhà riêng.
- **`T_NAM_NGHI = 67`:** Khu nghỉ ngơi, phòng nằm hồi phục thể lực.

### 3.8 Cụm Giao Thông & Quốc Tế
- **`T_SAN_BAY = 20` (Sân bay quốc tế):** Nhà ga sân bay di chuyển quốc tế.
- **`T_VE_BAY = 71` (Phòng bán vé máy bay):** Điểm mua vé bay đến các địa điểm xa.
- **`T_BUS_STOP = 81` (Trạm xe buýt):** Trạm trung chuyển giao thông công cộng, đưa người chơi trở về các khu trung tâm.

---

## 4. Bảng Tra Cứu Toàn Bộ Hằng Số Map (`LoadMap.T_*`)

```csharp
// Trích xuất từ Assembly-CSharp.dll / LoadMap (TypeDefIndex: 6304)
public const sbyte T_PARK = 0;              // Công viên trung tâm
public const sbyte T_PARK_1 = 1;            // Công viên khu 1 (Quay số)
public const sbyte T_PARK_2 = 2;            // Công viên khu 2 (Đấu giá)
public const sbyte T_PARK_3 = 3;            // Công viên khu 3 (Ăn xin)
public const sbyte T_PARK_4 = 4;            // Công viên khu 4
public const sbyte T_PARK_5 = 5;            // Công viên khu 5 (Tài xỉu)
public const sbyte T_PARK_6 = 6;            // Công viên khu 6 (Cô giáo)
public const sbyte T_PARK_7 = 7;            // Công viên khu 7
public const sbyte T_PARK_8 = 8;            // Công viên khu 8 (4 con vịt)
public const sbyte T_CITY = 9;              // Khu giải trí trung tâm
public const sbyte T_CONG_SANH_CUOI = 10;   // Cổng sảnh cưới
public const sbyte T_PARK_PATH = 11;        // Đường công viên
public const sbyte T_PARK_ADVANCED = 12;    // Công viên nâng cao
public const sbyte T_FISHING_ADVANCED = 13; // Sảnh Khu sinh thái
public const sbyte T_FISING_1 = 14;         // Hồ câu cá rô
public const sbyte T_FISING_2 = 15;         // Hồ câu cá lóc
public const sbyte T_FISING_3 = 16;         // Hồ câu cá mập
public const sbyte T_SLUM = 17;             // Khu ngoại ô (Đào gỗ/đá)
public const sbyte T_PRISON = 18;           // Nhà tù
public const sbyte T_LE_CUOI = 19;          // Nhà thờ lễ cưới
public const sbyte T_SAN_BAY = 20;          // Sân bay
public const sbyte T_ROAD_HOUSE = 21;       // Đường vào khu nhà ở
public const sbyte T_KHU_MUA_SAM = 23;      // Khu mua sắm
public const sbyte T_FARM = 24;             // Nông trại cá nhân
public const sbyte T_FARMWAY = 25;          // Đường vào nông trại
public const sbyte T_POPUP = 27;            // Bến tàu / Bến Đảo Hawai
public const sbyte T_STORE = 28;            // Mê cung
public const sbyte T_CHECK_POINT = 29;      // Điểm kiểm tra
public const sbyte T_PLANT = 51;            // Ô đất trồng cây
public const sbyte T_CUAHANG = 52;          // Cửa hàng nông trại
public const sbyte T_FARM_FRIEND = 53;      // Nông trại bạn bè
public const sbyte T_FISHING_CHAIR = 54;    // Ghế câu cá
public const sbyte T_BANK = 55;             // Trạm ATM
public const sbyte T_JOIN = 56;             // Điểm kết nối
public const sbyte T_SHOP = 57;             // Cửa hàng thời trang 1
public const sbyte T_BEAUTYSALON = 58;      // Thẩm mỹ viện 1
public const sbyte T_GIFT = 59;             // Cửa hàng quà tặng 1
public const sbyte T_BOARD_WAIT_2 = 60;     // Bàn chờ 2
public const sbyte T_BOARD_WAIT_4 = 61;     // Bàn chờ 4
public const sbyte T_SHOP_2 = 62;           // Cửa hàng thời trang 2
public const sbyte T_BEAUTYSALON_2 = 63;    // Thẩm mỹ viện 2
public const sbyte T_GIFT_2 = 64;           // Cửa hàng quà tặng 2
public const sbyte T_BOARD_WAIT_5 = 65;     // Bàn chờ 5
public const sbyte T_NAM_NGHI = 67;         // Phòng nằm nghỉ
public const sbyte T_HOUSE_1 = 68;          // Nhà cấp 1
public const sbyte T_HOUSE_2 = 69;          // Nhà cấp 2
public const sbyte T_HOUSE_3 = 70;          // Nhà cấp 3
public const sbyte T_VE_BAY = 71;           // Phòng vé máy bay
public const sbyte T_TL = 72;               // Sảnh bài Tiến Lên
public const sbyte T_P = 73;                // Sảnh bài Phỏm
public const sbyte T_CT = 74;               // Sảnh Cờ Tướng
public const sbyte T_CR = 75;               // Sảnh Cờ Caro
public const sbyte T_DM = 76;               // Sảnh Domino
public const sbyte T_BC = 77;               // Sảnh Bầu Cua
public const sbyte T_CHAIR = 79;            // Ghế ngồi công cộng
public const sbyte T_BUS_STOP = 81;         // Trạm xe buýt
public const sbyte T_ROCK = 88;             // Mỏ đá (Khu ngoại ô)
public const sbyte T_ICE_CREAM = 93;        // Tiệm kem
public const sbyte T_FISH_SHOP = 94;        // Cửa hàng bán cá
public const sbyte T_COOKING = 98;          // Bếp nấu ăn
public const sbyte T_QUAY_SO = 99;          // Gian quay số
public const sbyte T_DAU_GIA = 106;         // Gian đấu giá
public const sbyte T_UPGRADE = 102;         // Thợ nâng cấp đồ
public const sbyte T_PRIMEUM_SHOP = 103;    // Shop VIP / Premium
public const sbyte T_PET_SHOP = 104;        // Cửa hàng thú cưng
public const sbyte T_THO_KHOA = 105;        // Thợ khóa
public const sbyte T_RACE = 107;            // Trường đua thú
public const sbyte T_CASINO = 108;          // Sòng bạc Casino 1
public const sbyte T_CASINO_2 = 109;        // Sòng bạc Casino 2
public const sbyte T_HOUSE_4 = 110;         // Nhà cấp 4
public const sbyte T_HO_HOUSE = 112;        // Hồ bơi tại nhà
public const sbyte T_MINIGAME_TRUCXANH = 114; // Minigame Trúc Xanh
public const sbyte T_MINIGAME_AINCRAD = 115;  // Minigame Aincrad
public const sbyte T_SHOP_FARM = 117;       // Cửa hàng nông trại
public const sbyte T_CONTAINER_FARM = 118;  // Rương/kho nông sản
public const sbyte T_BARN_CHICKEN = 124;    // Chuồng gà
public const sbyte T_BARN_COW = 125;        // Chuồng bò
```
