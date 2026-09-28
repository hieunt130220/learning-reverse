# Giao thức Lâu đài Minigame Map 7 (AvatarHD & Live Server)

Tài liệu chi tiết kết quả điều tra reverse-engineering và kiểm chứng gói tin thực tế trên live server cho Lâu đài (Anim6001) tại Map 7 Khu 0.

---

## 1. Vị trí & Graphic trên Map 7
- **Bản đồ:** Map 7 Khu 0 (`DataMap8` trong asset `data.unity3d`, lưới 27×8 tile).
- **Vị trí Tile:** `(x=4..5, y=1)` là raw tile `205`.
- **Graphic Client:** `Anim6001` (PNG 171×154 px hình lâu đài 2 tháp, cổng vòm, mái ngói xanh/tím).
- **Client Tile Type:** `LoadMap.setTypeMap(i, 114, 4)` (`T_MINIGAME_TRUCXANH = 114`).
- **Client Label:** Gắn popup text `"Tham gia"` (`T.joinA`).

---

## 2. Wire Protocol 2 Minigame (Opcode -90 / 0xA6 / 166)
Master opcode phụ trách toàn bộ hệ thống Minigame trong Avatar: `GlobalLogicHandler.MINIGAME = -90`.

### 2.1 Cấu trúc gói tham gia (`MiniGameService.joinGame(gameId)`)
- **Gói gửi (TX -90):** `[i8 gameId, i8 subAction=0]`
  - **Lật hình (Trúc Xanh / `TRUCXANH`):** `gameId = 1`
  - **Cờ caro (`CARO`):** `gameId = 3`
  - *(Ghi chú: `gameId = 2` là Aincrad `AINCRAD`)*

### 2.2 Phản hồi từ Live Server (RX -90)
Cả 2 minigame đều đã được **kiểm chứng trực tiếp trên live server 27.0.14.120:19129**:
- **Định dạng gói nhận (RX -90):**
  `[i8 gameId, i8 subAction=0, i32 playerId, utf playerName, ...avatarParts]`
- **Dữ liệu thực tế bắt được từ server:**
  - **Trúc Xanh (gameId = 1):**
    ```hex
    01 00 0827ccca 0007 78696e6b6e3031 09021401ae00390038005600040043006a01240078003000ff00ffff0000ffffffffffff00ffffffff
    ```
  - **Cờ caro (gameId = 3):**
    ```hex
    03 00 0827ccca 0007 78696e6b6e3031 09021401ae00390038005600040043006a01240078003000ff00ffff0000ffffffffffff00ffffffff
    ```
  *(Hai gói phản hồi tương thích 100%, chỉ khác byte đầu định danh game `01` và `03`)*.

---

## 3. Bản chất khác biệt giữa Java (J2ME) và AvatarHD (IL2CPP)
- **Trên bản Java (J2ME gốc):**
  Khi nhân vật click vào Lâu đài, client hiển thị danh sách Menu cho người chơi chọn:
  1. **Lật hình** $\rightarrow$ gửi `TX -90 [1, 0]`.
  2. **Cờ caro** $\rightarrow$ gửi `TX -90 [3, 0]`.
- **Trên bản AvatarHD (Unity / IL2CPP):**
  - Trong `LoadMap.doJoin(x, y)` (`0x8CEB10`), TeaMobi hardcode click tile 114 gọi thẳng `TrucXanhService.gI().joinGame()` (`TX -90 [1, 0]`).
  - `CaroMsgHandler.onMessage` (`0x66A3A4`) trên client HD bị stub bằng lệnh `ret`, mặc dù class `CaroGameScr` vẫn chứa đầy đủ logic vẽ bàn cờ và xử lý nước đi.
  - Phía server thật vẫn giữ nguyên hệ thống và hỗ trợ đầy đủ cả 2 minigame qua opcode `-90`.

---

## 4. Bảng phân nhánh SubAction (Opcode -90)
### 4.1 Trúc Xanh (`gameId = 1`)
- `0`: `JOIN_TRUCXANH` (`TX -90 [1, 0]`)
- `1`: `START_TRUCXANH`
- `2`: `OPENCARD_TRUCXANH` (`TX -90 [1, 2, i8 cardId]`)
- `3`: `SETTURN_TRUCXANH`
- `4`: `ENDCARD_TRUCXANH`
- `5`: `OUTCARD_TRUCXANH`

### 4.2 Cờ Caro (`gameId = 3`)
- `0`: `JOIN_CARO` (`TX -90 [3, 0]`)
- `1`: `START_CARO`
- `2`: `SETTURN_CARO`
- `3`: `POINT_CARO` (`TX -90 [3, 3, i32 point]`)
- `4`: `END_CARO`

---

## 5. Chi tiết Wire Protocol & Bằng chứng thực tế Ván đấu Trúc Xanh (Full Game Loop)

Đã kiểm chứng trọn vẹn 100% ván đấu thực tế trên live server thông qua công cụ probe `avatar-web/server/src/tools/trucxanh-probe.ts`.

### 5.1 Cấu trúc gói tin Wire Protocol Trúc Xanh
1. **Tham gia bàn (`JOIN` - SubAction 0):**
   - **TX -90:** `[i8 gameId=1, i8 subAction=0]`
   - **RX -90:** `[i8 1, i8 0, Avatar player0, Avatar player1]`
   - Bóc tách vị trí: Avatar đầu tiên tương ứng Player Index 0 (offset byte 2..5 là `playerId0`), Avatar thứ hai tương ứng Player Index 1. Nếu `client.playerId === playerId0` thì `myPos = 0`, ngược lại `myPos = 1`.

2. **Bắt đầu ván đấu (`START` - SubAction 1):**
   - **RX -90:** `[i8 1, i8 1, i8 turn, i8 time]`
   - `turn`: Chỉ số người chơi được quyền đi (`0` hoặc `1`). Đến lượt mình khi `turn === myPos`.
   - `time`: Thời gian đếm ngược của lượt (mặc định server: `10` giây).

3. **Mở lá bài (`OPENCARD` - SubAction 2):**
   - **TX -90:** `[i8 1, i8 2, i8 cardId]` (`cardId` từ `0..23` trên lưới 6×4).
   - **RX -90 Broadcast lá bài 1:** `[i8 1, i8 2, i8 cardId, i32 img, i8 flag=0]`
   - **RX -90 Broadcast lá bài 2 (Nếu không trùng):** `[i8 1, i8 2, i8 cardId, i32 img, i8 flag=1, bool isMatch=false]`
   - **RX -90 Broadcast lá bài 2 (Nếu ghép đúng cặp):**
     `[i8 1, i8 2, i8 cardId, i32 img, i8 flag=1, bool isMatch=true, i8 cardId2, i32 unused, i32 score1, i32 score2]`
     - Cả 2 thẻ `cardId` và `cardId2` bị loại khỏi bàn.
     - `score1`: Tổng điểm hiện tại của Player 0.
     - `score2`: Tổng điểm hiện tại của Player 1.
     - Người ghép đúng tiếp tục giữ lượt đánh (không đổi lượt).
     - *Lưu ý về gói Reveal cuối trận:* Khi ván đấu kết thúc, server broadcast mở các thẻ còn lại với `cardId2 = -2` (`0xfe`). Client cần lọc `cardId2 >= 0` để tránh đếm sai số cặp ghép.

4. **Đổi lượt (`SETTURN` - SubAction 3):**
   - **RX -90:** `[i8 1, i8 3, i8 turn]` (`turn` là player index `0` hoặc `1`).

5. **Kết thúc ván đấu (`ENDCARD` - SubAction 4):**
   - **RX -90:** `[i8 1, i8 4, i8 win, i32 score1, i32 score2, i16 giftBoxId?]`
   - `win`: `0` = Hòa, `1` = Player 0 chiến thắng, `2` = Player 1 chiến thắng.
   - `giftBoxId`: ID hộp quà phần thưởng ngẫu nhiên sau trận (ví dụ: `#4494`).

6. **Chế độ 2 tài khoản chơi cùng nhau (Co-op / Đối kháng):**
   - Công cụ probe hỗ trợ flag `--two-players` hoặc `--account-id <id1> --account-id-2 <id2>`.
   - Cả 2 tài khoản cùng gia nhập Map 7 Khu 0, lần lượt ngồi vào 2 ghế trên bàn Trúc Xanh.
   - Sử dụng chung bộ nhớ `TrucXanhMemory` (shared memory): khi P1 thăm dò thẻ nào thì P2 đều tự động biết vị trí thẻ đó và ngược lại, giúp giải trọn vẹn bàn cờ nhanh gấp đôi mà không lãng phí lượt thăm dò lặp lại.

6. **Án phạt thoát bàn (Server Penalty):**
   - Nếu client thoát bàn khi ván đang diễn ra, server chặn tham gia ~5 phút qua hộp thoại `RX -40`: `Bạn đang bị phạt vì thoát bàn khi đang chơi. Vui lòng quay lại sau M:SS`.

### 5.2 Bằng chứng thực tế ván đấu trên Live Server (2026-09-25)
- **Tài khoản test:** `0975720501` (`xinkn01`, ID: `136826058`, vị trí `Player #1`).
- **Đối thủ:** `DungBaVi9x` (ID: `136730861`, vị trí `Player #0`).
- **Diễn biến trận đấu:**
  - Vòng mở đầu: `xinkn01` lật thăm dò ô `#0` (Hình #5007) và ô `#1` (Hình #5014).
  - Thuật toán Perfect Memory phát hiện và tự động ghép trúng liên tiếp các cặp thẻ:
    - Ô `#13` & `#5` (Hình #5013) $\rightarrow$ Điểm: `xinkn01=1`, `DungBaVi9x=0`
    - Ô `#11` & `#21` (Hình #5008) $\rightarrow$ Điểm: `xinkn01=1`, `DungBaVi9x=1`
    - Ô `#16` & `#8` (Hình #5018) $\rightarrow$ Điểm: `xinkn01=2`, `DungBaVi9x=1`
  - Ván đấu kết thúc với gói `RX -90` (13b): `0104010000000c00000004118e`
    - Điểm số chung cuộc: `DungBaVi9x` = 12, `xinkn01` = 4.
    - Hộp quà nhận được: ID `#4494`.
