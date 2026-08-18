# Thiết Kế Chức Năng Xem & Quản Lý Nhiệm Vụ Nông Trại

**Ngày tạo:** 2026-08-18  
**Trạng thái:** Chờ duyệt (Pending Review)  
**Tác giả:** Antigravity  

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Bối cảnh
Trong game Avatar (Teamobi), hệ thống nhiệm vụ là một phần quan trọng giúp người chơi định hướng phát triển nông trại, nhận thưởng tài nguyên (Xu, Lượng, Lượng khoá, EXP, vật phẩm), mở khóa các tính năng cao cấp và tăng điểm năng động hàng ngày.

Hiện tại, hệ thống `avatar-web` đã hỗ trợ quản lý nông trại (trồng trọt, chăm sóc, thu hoạch, vật nuôi, nấu ăn bếp, tự động farm), nhưng người dùng chưa có giao diện trực quan để xem tiến độ và tương tác với các nhiệm vụ trong nông trại:
1. **Nhiệm vụ hàng ngày (Daily Quests)**: Điểm năng động, các nhiệm vụ ngày (nộp nông sản/sản phẩm), các mốc rương quà năng động.
2. **Nhiệm vụ tân thủ (Beginner Quests)**: Chuỗi nhiệm vụ hướng dẫn nhập môn làm quen với các cơ chế cơ bản của nông trại.
3. **Nhiệm vụ chung & Thành tích (General Quests / Achievements)**: Các mốc nâng cấp nông trại (đất cấp 2, kho hàng, chuồng trại, ao cá, nhiệm vụ mở ô bếp Master).

### 1.2. Mục tiêu
- Xây dựng bảng điều khiển **Nhiệm vụ** (`QuestsPanel.tsx`) trong Drawer **Vận hành tài khoản**, cho phép người dùng theo dõi và tương tác với cả 3 nhóm nhiệm vụ một cách tập trung, trực quan, thời gian thực.
- Cung cấp khả năng tương tác đầy đủ: Nhận thưởng/hoàn thành nhiệm vụ hàng ngày, đổi nhiệm vụ hàng ngày, mở rương quà năng động theo mốc điểm.
- Hỗ trợ tuỳ chọn tự động nhận thưởng nhiệm vụ hàng ngày và mở rương trong chu kỳ của **AutoFarm Engine**.

---

## 2. Phạm Vi Thực Hiện (Scope)

### 2.1. In-Scope
- **Giao thức mạng & Decode/Encode**:
  - Đóng gói lệnh gửi `GlobalService.dailyquest(type)` (`cmd = -87`, `sub_cmd = 2`, `type = 0..3`).
  - Giải mã gói phản hồi Daily Quest từ server game: `curScore`, `boxDone`, `vecNhiemvu` (danh sách nhiệm vụ ngày), `vecPhanthuong` (phần thưởng), `typeMoneyChange`, `moneyChange`.
  - Hỗ trợ các action: `0: SHOW`, `1: CHANGE`, `2: DONE`, `3: GETBOX`.
- **Quản lý dữ liệu (Server Core)**:
  - Cập nhật `GameClient`: bổ sung phương thức `getDailyQuest()`, `changeDailyQuest()`, `claimDailyQuestReward()`, `claimDailyQuestBox()`.
  - Cập nhật `farmData.ts`: bổ sung decoder `decodeDailyQuestPacket`, type definitions cho `DailyQuestState`, `BeginnerQuest`, `GeneralQuest`, `QuestOverviewState`.
  - Tổng hợp trạng thái 3 nhóm nhiệm vụ trong `AccountSnapshot`:
    - `daily`: Dữ liệu thời gian thực từ server game.
    - `beginner`: Danh sách nhiệm vụ tân thủ với tiến độ tính toán từ trạng thái nông trại (cấp farm, số ô đất, vật nuôi, nấu ăn...).
    - `general`: Danh sách nhiệm vụ chung & thành tích nông trại (nâng cấp đất cấp 2, nâng cấp kho hàng, chuồng trại, ao cá, nhiệm vụ mở slot bếp Master từ `cookingState.missions`).
  - REST API endpoints trên Express server:
    - `GET /api/accounts/:id/quests` — Lấy snapshot tổng hợp 3 nhóm nhiệm vụ.
    - `POST /api/accounts/:id/quests/daily/refresh` — Gửi lệnh làm mới nhiệm vụ hàng ngày từ server game.
    - `POST /api/accounts/:id/quests/daily/change` — Gửi lệnh đổi nhiệm vụ hàng ngày.
    - `POST /api/accounts/:id/quests/daily/claim` — Gửi lệnh trả nhiệm vụ / nhận thưởng.
    - `POST /api/accounts/:id/quests/daily/box` — Gửi lệnh mở rương điểm năng động.
  - Tích hợp AutoFarm: Tuỳ chọn `autoClaimDailyQuests` trong `AutoFarmConfig` để tự động kiểm tra và nhận thưởng / mở rương quà khi đủ điều kiện trong mỗi chu kỳ auto.
- **Giao diện người dùng (Web Frontend)**:
  - Tạo component `QuestsPanel.tsx` với 3 Tab:
    1. **Hàng ngày**: Thanh tiến độ điểm năng động sao (0-100), 5 mốc rương quà (20, 40, 60, 80, 100), danh sách thẻ nhiệm vụ ngày kèm nút "Nhận thưởng", "Đổi nhiệm vụ".
    2. **Tân thủ**: Danh sách checklist các bước nhiệm vụ tân thủ, mục tiêu, trạng thái hoàn thành và phần thưởng.
    3. **Nhiệm vụ chung**: Danh sách thành tích phát triển nông trại (đất cấp 2, kho hàng, chuồng trại, ô bếp Master).
  - Tích hợp vào `AccountOperationsDrawer.tsx` và thêm checkbox cấu hình vào `AutoFarmPanel.tsx`.

### 2.2. Out-of-Scope
- Không tự động thực hiện nộp tiền/mua vật phẩm để đổi nhiệm vụ nếu tài khoản không đủ tài nguyên hoặc người dùng chưa bật tính năng.
- Không can thiệp vào các nhiệm vụ Clan / Bang hội (Clan quests) ngoài phạm vi nông trại.

---

## 3. Kiến Trúc & Thiết Kế Kỹ Thuật

### 3.1. Sơ Đồ Luồng Dữ Liệu (Data Flow)

```
+-------------------------------------------------------------------------+
|                              Web Frontend                               |
|  +-------------------------------------------------------------------+  |
|  |             QuestsPanel (Daily / Beginner / General Tabs)         |  |
|  |   [Refresh]  [Đổi nhiệm vụ]  [Nhận thưởng]  [Mở rương 20/40/..]   |  |
|  +-------------------------------------------------------------------+  |
+--------------------^----------------------------------|-----------------+
                     | WebSocket Real-time Update       | REST API POST
                     |                                  v
+--------------------+----------------------------------+------------------+
|                            Server (Express)                             |
|  - routes.ts: /api/accounts/:id/quests/*                                |
|  - AutoFarm Engine: chu kỳ tự kiểm tra & claim daily quests             |
|  - GameClient / AvatarSession: duy trì QuestOverviewState                |
+--------------------+----------------------------------+------------------+
                     |                                  |
                     | cmd -87 (sub=2, type=0..3)       | cmd -87 (sub=2)
                     v                                  v
+-------------------------------------------------------------------------+
|                           Avatar Game Server                            |
+-------------------------------------------------------------------------+
```

### 3.2. Cấu Trúc Giao Thức Gói Tin (Wire Protocol)

#### 3.2.1. Request (Client → Server)
Gửi qua `Message.create(-87)`:
- `writeByte(2)` (sub-command 2 = DAILY_QUEST)
- `writeByte(type)` với:
  - `0`: `DAILYQUEST_SHOW` — Yêu cầu nạp thông tin nhiệm vụ hàng ngày.
  - `1`: `DAILYQUEST_CHANGE` — Đổi nhiệm vụ hàng ngày.
  - `2`: `DAILYQUEST_DONE` — Hoàn thành / nhận thưởng nhiệm vụ.
  - `3`: `DAILYQUEST_GETBOX` — Mở rương điểm năng động.

#### 3.2.2. Response (Server → Client)
Server trả về `cmd -87` với `sub-type = 2`:
- `i8 sub_action` (0: show, 2: done, 3: getbox...)
- Khi `sub_action == 0` (DAILYQUEST_SHOW):
  - `i32 curScore`: Điểm năng động hiện có (0..100).
  - `i8 boxDone`: Trạng thái các rương đã nhận (bitmask/index).
  - `vecNhiemvu`:
    - `i8 nMission`: Số lượng nhiệm vụ ngày.
    - Lặp `nMission` lần:
      - `i16 idItem`: ID nông sản / vật phẩm nhiệm vụ yêu cầu.
      - `i32 num`: Số lượng yêu cầu.
  - `vecPhanthuong`:
    - `i8 nReward`: Số lượng phần thưởng.
    - Lặp `nReward` lần:
      - `i8 type`: Loại thưởng (0: Xu, 1: Lượng, 2: Lượng khoá, 3: EXP, 4: Item, 5: Potion).
      - Nếu `type == 4`: `i16 itemId`.
      - `i32 amount`: Số lượng thưởng.
  - `i8 typeMoneyChange`: Loại tiền dùng để đổi nhiệm vụ (-1: không đổi, 0: miễn phí, 1: xu, 2: lượng).
  - `i32 moneyChange`: Số tiền cần để đổi.

---

### 3.3. Data Structures & Interfaces

```typescript
// Định nghĩa cấu trúc Nhiệm vụ Hàng ngày
export interface DailyMissionItem {
  idItem: number;
  name: string;
  numRequired: number;
  numCurrent: number;
  isDone: boolean;
  iconId?: number;
}

export interface DailyRewardItem {
  type: number; // 0: xu, 1: lượng, 2: lượng khoá, 3: exp, 4: item, 5: potion
  name: string;
  amount: number;
  itemId?: number;
}

export interface DailyBoxMilestone {
  milestone: number; // 20, 40, 60, 80, 100
  isClaimed: boolean;
  canClaim: boolean;
}

export interface DailyQuestState {
  score: number;
  maxScore: number;
  boxDone: number;
  boxes: DailyBoxMilestone[];
  missions: DailyMissionItem[];
  rewards: DailyRewardItem[];
  typeMoneyChange: number;
  moneyChange: number;
  canChange: boolean;
  updatedAt: number;
}

// Định nghĩa cấu trúc Nhiệm vụ Tân thủ
export interface BeginnerQuest {
  id: string;
  title: string;
  description: string;
  category: 'farming' | 'cattle' | 'cooking' | 'social';
  target: number;
  current: number;
  isDone: boolean;
  rewardText: string;
}

// Định nghĩa cấu trúc Nhiệm vụ Chung / Thành tích
export interface GeneralQuest {
  id: string;
  title: string;
  description: string;
  category: 'land_upgrade' | 'storage' | 'barn_pond' | 'kitchen_slot';
  level: number;
  target: number;
  current: number;
  isDone: boolean;
  rewardText: string;
}

// Snapshot tổng hợp Nhiệm vụ của tài khoản
export interface QuestOverviewState {
  daily: DailyQuestState | null;
  beginner: BeginnerQuest[];
  general: GeneralQuest[];
  updatedAt: number;
}
```

---

### 3.4. Danh Sách Files Ảnh Hưởng

| File | Vai trò | Thay đổi chính |
|---|---|---|
| `avatar-web/server/src/game/farmData.ts` | Protocol Decoder & Types | Bổ sung hàm decode gói DailyQuest `cmd -87`, tính toán tiến độ vật phẩm từ kho, helper tạo danh sách nhiệm vụ tân thủ và nhiệm vụ chung |
| `avatar-web/server/src/game/farmService.ts` | Protocol Sender | Bổ sung các phương thức `getDailyQuest()`, `changeDailyQuest()`, `claimDailyQuestReward()`, `claimDailyQuestBox()` |
| `avatar-web/server/src/game/client.ts` | GameClient Core | Đón gói tin `cmd -87 (sub=2)`, lưu cache `questState`, phát sự kiện `quests`, phơi phương thức gửi lệnh nhiệm vụ |
| `avatar-web/server/src/session/avatarSession.ts` | Session Runtime | Đưa `quests` vào `AccountSnapshot`, tích hợp logic tự động kiểm tra nhiệm vụ trong AutoFarm |
| `avatar-web/server/src/autoFarm.ts` | AutoFarm Engine | Thêm bước kiểm tra & nhận thưởng nhiệm vụ hàng ngày khi đủ điều kiện nếu bật `autoClaimDailyQuests` |
| `avatar-web/server/src/session/routes.ts` | REST API Routes | Thêm các endpoint `/api/accounts/:id/quests/*` |
| `avatar-web/web/src/types.ts` | Frontend Type Definitions | Định nghĩa các interface `DailyQuestState`, `BeginnerQuest`, `GeneralQuest`, `QuestOverviewState` |
| `avatar-web/web/src/api.ts` | Frontend API Client | Thêm các hàm gọi API nhiệm vụ |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | UI Component *(Mới)* | Giao diện hiển thị 3 tab nhiệm vụ, thanh điểm năng động, rương quà và các nút tương tác |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer Vận hành | Nhúng `QuestsPanel` vào danh sách panel vận hành của tài khoản |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Cấu hình AutoFarm | Thêm toggle cấu hình tự động nhận thưởng nhiệm vụ hàng ngày |

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 4.1. Manual & Integration Verification
1. **Kiểm tra Decode Gói Tin**:
   - Chạy kiểm tra với dữ liệu mẫu byte stream thực của `cmd -87 (sub=2)`: xác nhận điểm số, số rương, danh sách nhiệm vụ và phần thưởng giải mã chính xác.
2. **Kiểm tra API Endpoints**:
   - `GET /api/accounts/:id/quests` trả về snapshot đầy đủ cả 3 tab (Daily, Beginner, General).
   - `POST /api/accounts/:id/quests/daily/refresh` kích hoạt gửi lệnh `dailyquest(0)` thành công.
   - `POST /api/accounts/:id/quests/daily/change`, `claim`, `box` gửi đúng opcode và tham số.
3. **Kiểm tra Giao Diện Frontend**:
   - Tab **Hàng ngày**: Điểm năng động hiển thị thanh tiến độ mượt mà, rương sáng khi đủ điểm, thẻ nhiệm vụ hiển thị số lượng yêu cầu / hiện có trong kho.
   - Tab **Tân thủ**: Hiển thị chuỗi nhiệm vụ hướng dẫn kèm trạng thái hoàn thành.
   - Tab **Nhiệm vụ chung**: Hiển thị tiến độ nâng cấp đất cấp 2, kho hàng, chuồng trại và nhiệm vụ mở slot bếp Master.
4. **Kiểm tra AutoFarm**:
   - Khi bật `autoClaimDailyQuests`, chu kỳ auto tự động phát hiện nhiệm vụ đủ điều kiện và gửi yêu cầu nhận thưởng mà không làm gián đoạn các pha trồng/thu hoạch/nấu ăn.
