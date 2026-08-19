# Tài liệu Tổng Hợp: Giải Mã & Tích Hợp Hệ Thống Nhiệm Vụ Nông Trại AvatarHD

## 1. Tổng quan hệ thống nhiệm vụ Nông trại

Trong AvatarHD (Java/Unity IL2CPP), hệ thống nhiệm vụ trong nông trại được chia thành 3 nhóm độc lập với cơ chế packet, vòng đời và cách thức hiển thị khác nhau:

| Nhóm nhiệm vụ | Bản chất | Giao thức truyền tải | Chu kỳ / Tiến trình |
| :--- | :--- | :--- | :--- |
| **☀️ Nhiệm Vụ Hằng Ngày** *(Daily Quest)* | Nhiệm vụ năng động (0-100 sao), reset mỗi ngày. Giao nộp nông sản, chăn nuôi, thu hoạch. | `Cmd -87 (sub_type = 4)` | Nhận rương mốc: 20, 40, 60, 80, 100 điểm. Hỗ trợ đổi nhiệm vụ bằng Xu/Lượng. |
| **🐣 Nhiệm Vụ Tân Thủ** *(Beginner Quest)* | Chuỗi nhiệm vụ dành cho người chơi mới theo từng bước (Bước 1, Bước 2,...). | `Cmd 104 (OPEN_INFO_FARM)` / `Cmd -40 / -88` | Tuyến tính, hoàn thành nhận thưởng cố định (Xu, Trang phục vĩnh viễn, Nông sản). |
| **🌾 Nhiệm Vụ Nhà Nông** *(Farmer Progress Quest)* | Chuỗi nhiệm vụ phát triển nông trại (Bước 1, Bước 2,...) do NPC Lái buôn giao. | `Cmd 104 (OPEN_INFO_FARM)` / `Cmd -59 / -61` / `Cmd -40` | Mở rộng đất, cấp nông trại, bếp nấu ăn, chuồng trại, ao cá, thu hoạch số lượng lớn. |

---

## 2. Phân tích chi tiết giao thức Packet (Protocol Reverse Engineering)

### 2.1. Nhiệm Vụ Hằng Ngày (Daily Quest) — `Cmd -87`

* **File nguồn IL2CPP:** `DailyQuestScr.dailyQuestMessage` (@ `0xAF7664`)
* **Khung gói tin yêu cầu (C → S):**
  ```text
  [cmd: -87][sub_type: 4][action: i8]
  - action = 0: Lấy danh sách nhiệm vụ ngày (DAILYQUEST_SHOW)
  - action = 1: Đổi nhiệm vụ (DAILYQUEST_CHANGE) -> [idItem: i16]
  - action = 2: Trả nhiệm vụ (DAILYQUEST_DONE) -> [idItem: i16]
  - action = 3: Nhận rương mốc (DAILYQUEST_GETBOX) -> [indexBox: i8]
  ```
* **Khung gói tin phản hồi (S → C):**
  * `i8 sub_type = 4`
  * `i8 action`
  * Khi `action = 0` (SHOW):
    * `i32 curScore`: Điểm năng động hiện tại (0..100)
    * `i8 boxDone`: Bitmask các rương đã nhận (`bit 0..4` tương ứng mốc 20, 40, 60, 80, 100)
    * `i8 nMission`: Số lượng nhiệm vụ ngày (thường là 4)
      * `repeat nMission`: `[i16 idItem, i32 numRequired]`
    * `i8 nReward`: Số lượng phần thưởng rương
      * `repeat nReward`: `[i8 type, (nếu type == 4: i16 itemId), i32 amount]`
    * `i8 typeMoneyChange`: Loại tiền đổi (-1: không đổi, 0: free, 1: xu, 2: lượng)
    * `i32 moneyChange`: Phí đổi nhiệm vụ

---

### 2.2. Nhiệm Vụ Nhà Nông & Tân Thủ (Progress Quests) — `Cmd 104`

* **File nguồn IL2CPP:**
  * `FarmService.getInfoUpgradeFarm` (@ `0x5D405C`)
  * `GlobalMessageHandler.openInfoUpgradeFarm` (@ `0x5FA694`, `0x5FA8C8`)
  * `UpgradeFarmLvl2Scr.setInfo` (@ `0x864068`)

#### A. Khung yêu cầu (C → S):
```text
[cmd: 104][type: i8][(nếu idType != -1) idType: i8]
- type = 1: Yêu cầu thông tin nâng cấp Nông Trại Cấp 2 / Tiến trình Nhà Nông
- type = 3, idType = 0: Yêu cầu mở giao diện Nhiệm Vụ Nhà Nông
- type = 3, idType = 1: Yêu cầu mở giao diện Nhiệm Vụ Tân Thủ
- type = 5: Yêu cầu thông tin nhiệm vụ tiến trình đang hoạt động
```

#### B. Khung phản hồi `action = 1` (Checklist Tiến trình Nhà Nông & Nâng cấp):
```text
i8   action = 1
i8   screenType
i16  idMap, idTitle, idStorage, idBarnChicken, idBarnCow, idCooking, idBarnDog
i8   itemCount
repeat itemCount:
  i8   itemType
  if itemType in (7, 9):  // Nông sản hoặc Thuốc
    i32  idItem
    i32  numRequired
    i32  numCurrent
  else:
    i32  numRequired
    i32  numCurrent
```
* **Mapping ItemType:**
  * `1`: Cấp Nông Trại
  * `2`: Số ô đất mở rộng
  * `3`: Số ô bếp nấu ăn
  * `4`: Sức chứa chuồng trại
  * `5`: Sức chứa ao cá
  * `6`: Tích luỹ Xu
  * `7`: Nông sản thu hoạch (Cà chua, Cà rốt, Dưa hấu,...)
  * `8`: Tích luỹ Lượng
  * `9`: Thuốc tăng trưởng

#### C. Khung phản hồi `action = 2` hoặc `3` (MissionInfo & UpgradeInfo):
```text
i8   action = 2 (hoặc 3)
i8   screenType (0 = Nhà Nông, 1 = Tân Thủ)
i16  currentImageId, nextImageId
i16  rewardCount
repeat rewardCount:
  i8   type (6: Xu, 7: Vật phẩm/Nông sản, 8: Lượng, 9: Thuốc, 10: EXP)
  i32  idFarm
  i32  request (amount/value)
  i32  inStorage
i16  missionCount
repeat missionCount:
  utf  name (Tên nhiệm vụ, ví dụ: "Thu hoạch 200 cà chua")
  i32  numMiss (Tiến độ hiện tại)
  i32  totalMiss (Mục tiêu cần đạt)
```

---

### 2.3. Hộp Thoại Tương Tác NPC Lái Buôn (`Cmd -59`, `Cmd -61`, `Cmd -40`)

Khi người chơi bấm vào NPC Lái buôn trong trang trại để xem nhiệm vụ:
1. Client gửi `Cmd -59` (`COMMUNICATE`) với `idUser = -1` (NPC Lái buôn).
2. Client gửi `Cmd -61` (`DO_MENU_OPTION`) với `idUser = -1, menuIndex = 0, subIndex = 0` (Mục Nhiệm vụ).
3. Server trả về gói văn bản `Cmd -40` (hoặc `Cmd -88`) dạng:
   ```text
   Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Nhà Nông - 1:
   - Thu hoạch 200 cà chua  - 0/200
   - Thu hoạch 200 cà rốt  - 0/200
   - Mua 2 con gà  - 0/2

   Phần Thưởng:
   - 5000 xu
   - 100 điểm kinh nghiệm
   ```
4. Hàm parser `parseQuestDialogText(text)` tự động nhận diện regex và phân giải danh sách điều kiện `0/200`, `0/2` và phần thưởng `5000 xu`, `100 điểm kinh nghiệm` vào `farmerQuestState`.

---

## 3. Cấu trúc Module Source Code trong Project

```
avatar-web/
├── server/
│   └── src/
│       ├── game/
│       │   ├── farmData.ts        # Decoder Nhiệm Vụ Hằng Ngày (Cmd -87 / sub 4)
│       │   ├── progressQuests.ts  # Decoder Tiến trình Tân Thủ & Nhà Nông (Cmd 104 & NPC Text Dialog)
│       │   ├── farmService.ts     # Các phương thức gửi packet (getInfoUpgradeFarm, communicate, doMenuOption)
│       │   └── client.ts          # Dispatcher xử lý onMessage (case -87, -40, -88, 104) & refreshProgressQuests
│       └── session/
│           └── avatarSession.ts   # Session quản lý state thuần (getQuestOverview, thuần getter, chống spam)
└── web/
    └── src/
        └── accounts/
            └── panels/
                ├── QuestsPanel.tsx  # Giao diện Drawer 3 tab: Hằng Ngày, Tân Thủ, Nhà Nông
                └── QuestsPanel.css  # Styling glassmorphism, progress bar, reward pills
```

---

## 4. Đặc tả Data Model (TypeScript Contracts)

```ts
export type ProgressQuestKind = 'beginner' | 'farmer';

export interface ProgressQuestCondition {
  name: string;
  current: number;
  total: number;
  isDone: boolean;
}

export interface ProgressQuestReward {
  type: number;
  amount: number;
  value: number;
  extra?: number;
  displayName?: string;
}

export interface ProgressQuestChain {
  kind: ProgressQuestKind;
  screenType: number;
  title: string;
  step: number | null;
  conditions: ProgressQuestCondition[];
  rewards: ProgressQuestReward[];
  source: 'game-packet';
  updatedAt: number;
}

export interface QuestOverview {
  daily: DailyQuestState | null;
  beginner: ProgressQuestChain | null;
  farmer: ProgressQuestChain | null;
}
```

---

## 5. Hướng dẫn vận hành & kiểm tra (Verification Checklist)

1. **Khởi động Server:**
   ```bash
   npm --prefix avatar-web/server run build
   npm --prefix avatar-web/web run build
   ```
2. **Kiểm tra UI trên Web:**
   * Mở Drawer tài khoản → Chuyển đến mục **Nhiệm Vụ Nông Trại**.
   * **Tab 1 (☀️ Hằng Ngày):** Hiển thị 4 nhiệm vụ ngày, thanh sao 0-100, 5 rương quà và nút đổi nhiệm vụ.
   * **Tab 2 (🐣 Tân Thủ):** Hiển thị Nhiệm Vụ Tân Thủ (nếu tài khoản đang trong chuỗi tân thủ).
   * **Tab 3 (🌾 Nhà Nông):** Hiển thị `Nhiệm Vụ Nhà Nông - 1` với 3 nhiệm vụ (*Thu hoạch 200 cà chua, Thu hoạch 200 cà rốt, Mua 2 con gà*) và 2 phần thưởng (*5.000 Xu, 100 điểm kinh nghiệm*).
3. **Kiểm tra Anti-Spam & Liveness:**
   * Bấm liên tục nút làm mới: Cooldown 5s ngăn chặn spam packet lên máy chủ game.
   * Snapshot WebSocket và background events không tự ý gọi mạng đệ quy.
