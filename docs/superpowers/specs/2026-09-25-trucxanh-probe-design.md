# Minigame Lật Hình (Trúc Xanh) Map 7 Probe Tool Design

> **Ngày lập:** 2026-09-25  
> **Topic:** `trucxanh-probe`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Minigame **Trúc Xanh** (Lật hình - `TRUCXANH`) tại Lâu đài Map 7 Khu 0 được điều khiển qua opcode `-90` (0xA6). Các phân tích dịch ngược từ IL2CPP (`TrucXanhMsgHandler`, `TrucXanhService`, `TrucXanhGameScr`) đã xác định cấu trúc các gói tin:
- `TX -90 [1, 0]`: Tham gia bàn chơi (`JOIN_TRUCXANH`).
- `TX -90 [1, 2, idCard]`: Lật lá bài (`OPENCARD_TRUCXANH`), với `idCard` từ `0..23` (lưới 6×4 gồm 12 cặp).
- `TX -90 [1, 5]`: Thoát bàn chơi (`OUTCARD_TRUCXANH`).

Mục tiêu của công cụ probe là:
1. Đăng nhập tài khoản vào live server và di chuyển tới Map 7 Khu 0.
2. Tham gia bàn Trúc Xanh (`TX -90 [1, 0]`), hỗ trợ cả chế độ 1 tài khoản (solo/chờ đối thủ) và 2 tài khoản (`--account-id-2`).
3. Tự động chơi hoàn thành trọn vẹn 1 ván đấu (Full Game Loop) bằng thuật toán Trí nhớ Hoàn hảo (Perfect Memory Solver):
   - Lưu trữ `memory[idCard] = img` mỗi khi có lá bài mở ra.
   - Khi có lượt: ưu tiên mở cặp bài đã biết hình giống nhau; nếu chưa biết thì mở thăm dò thẻ mới và kết nối với thẻ đã nhớ.
   - Tiếp tục chơi qua từng lượt cho đến khi toàn bộ 12 cặp bài được lật hết và máy chủ gửi gói `ENDCARD_TRUCXANH`.
4. In thống kê toàn bộ ván đấu: số lượt lật, các cặp ghép đúng, điểm số cuối cùng, kết quả thắng/thua và phần thưởng hộp quà.

---

## 2. Phạm Vi (Scope)

### In-Scope
- **File công cụ mới:** `avatar-web/server/src/tools/trucxanh-probe.ts`.
- **Kịch bản hoạt động:**
  1. `login`: Đăng nhập tài khoản qua `GameClient` (sử dụng `--account-id`). Nếu có `--account-id-2`, đăng nhập tài khoản thứ 2 song song để đối kháng trực tiếp.
  2. `enter-map7`: Chuyển sang ngữ cảnh Park (`TX -1 [9]`), xin danh sách khu (`TX 90 [7]`), và vào Map 7 Khu 0 (`TX 80 [7, 0, 524, 423]`).
  3. `join-game`: Gửi `TX -90 [1, 0]` để ngồi vào bàn Trúc Xanh.
  4. `full-game-loop` (Vòng lặp hoàn thành ván đấu):
     - Duy trì bảng trạng thái bàn cờ 24 ô (`cardStates`: `unopened` | `revealed` | `removed`), bộ nhớ hình ảnh (`cardImages: Map<cardId, imgId>`), và danh sách các cặp đã phát hiện (`knownPairs: Array<[number, number]>`).
     - Lắng nghe `RX -90` liên tục:
       - `0` (`JOIN_TRUCXANH`): Cập nhật người chơi trên bàn.
       - `1` (`START_TRUCXANH`): Khởi tạo ván mới, xác định ai đi trước (`isMyTurn = (turn == 0)`).
       - `2` (`OPENCARD_TRUCXANH`): Cập nhật `imgId` của thẻ vừa mở vào `cardImages`. Nếu `isMatch == true`: đánh dấu cặp thẻ `(cardId, cardId2)` là `removed`, cập nhật điểm số.
       - `3` (`SETTURN_TRUCXANH`): Cập nhật quyền đi tiếp (`isMyTurn = (turn == 0)`).
       - `4` (`ENDCARD_TRUCXANH`): Ván đấu hoàn thành, in bảng kết quả (thắng/thua, điểm số, hộp quà) và kết thúc vòng lặp.
     - **Thuật toán tự động lật bài trong lượt:**
       - Bước 1: Nếu trong `knownPairs` có cặp thẻ chưa loại bỏ $\rightarrow$ lật liên tiếp 2 thẻ đó (ăn điểm 100%).
       - Bước 2: Nếu chưa có cặp nào biết trước $\rightarrow$ chọn ngẫu nhiên 1 thẻ `unopened` chưa từng biết hình $\rightarrow$ gửi lật thẻ 1.
       - Bước 3: Chờ máy chủ trả về `imgId` của thẻ 1:
         - Nếu `imgId` này trùng với một thẻ khác đã nhớ trong bộ nhớ $\rightarrow$ lật ngay thẻ đó làm thẻ 2 (ăn điểm).
         - Nếu chưa từng thấy $\rightarrow$ chọn tiếp 1 thẻ `unopened` khác làm thẻ 2.
       - Bước 4: Delay giữa các nước đi: 800ms - 1000ms để mô phỏng nhịp độ người chơi tự nhiên.
  5. `cleanup`: Khi ván đấu kết thúc (`ENDCARD_TRUCXANH`), gửi `TX -90 [1, 5]` và đăng xuất an toàn.
- **CLI Arguments:**
  - `--account-id <number>`: ID tài khoản chính trong SQLite DB (mặc định: `1`).
  - `--account-id-2 <number>`: ID tài khoản phụ nếu cần 2 người chơi đấu với nhau (tùy chọn).
  - `--delay <number>`: Thời gian chờ giữa 2 lần lật thẻ tính bằng ms (mặc định: `900`).
  - `--timeout <number>`: Thời gian tối đa cho toàn bộ ván đấu tính bằng giây (mặc định: `180`).

### Out-of-Scope
- Không can thiệp vào các minigame khác (Cờ caro, Aincrad).
- Không tạo unit test file (tuân thủ nguyên tắc **KHÔNG TDD** của project).

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Flow Xử Lý Giao Thức

```
Client                                      Server
  |                                            |
  |--- TX -1 [9] ----------------------------->| Chuyển Park handler
  |<-- RX -1 [9] ------------------------------| ACK Park handler
  |--- TX 90 [7] ----------------------------->| Xin danh sách khu Map 7
  |<-- RX 90 [boardCount, ...] ----------------| Danh sách khu
  |--- TX 80 [7, 0, 524, 423] ----------------->| Vào Map 7 Khu 0
  |<-- RX 80 [roomId, boardId, ...] -----------| Thông tin phòng
  |                                            |
  |--- TX -90 [1, 0] ------------------------->| Tham gia Trúc Xanh
  |<-- RX -90 [1, 0, playerId, name, ...] -----| Thông tin người chơi bàn
  |<-- RX -90 [1, 1, turn, time] --------------| Bắt đầu ván (nếu đủ điều kiện)
  |                                            |
  | [Nếu turn == 0 (lượt mình)]:               |
  |--- TX -90 [1, 2, card1] ------------------>| Mở thẻ 1
  |<-- RX -90 [1, 2, card1, img1, 0] ----------| Broadcast hình thẻ 1
  |--- TX -90 [1, 2, card2] ------------------>| Mở thẻ 2
  |<-- RX -90 [1, 2, card2, img2, isMatch..] --| Kết quả so khớp cặp
  |                                            |
  |--- TX -90 [1, 5] ------------------------->| Thoát bàn (khi xong/timeout)
```

### 3.2 Bộ Giải Mã RX -90 (Decoder)

Trong `trucxanh-probe.ts`, xây dựng hàm decode chuyên biệt:
```typescript
interface TrucXanhMessage {
  gameId: number;
  subAction: number;
  data:
    | { type: 'JOIN'; playerId: number; name: string }
    | { type: 'START'; turn: number; isMyTurn: boolean; time: number }
    | {
        type: 'OPENCARD';
        cardId: number;
        img: number;
        flag: number;
        isMatch?: boolean;
        cardId2?: number;
        score1?: number;
        score2?: number;
      }
    | { type: 'SETTURN'; turn: number; isMyTurn: boolean }
    | { type: 'END'; win: number; score1: number; score2: number; giftBoxId?: number }
    | { type: 'OUT'; iddb: number }
    | { type: 'RAW'; hex: string };
}
```

---

## 4. Verification Plan

1. **Khởi chạy probe:**
   ```bash
   npx tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --account-id 1
   ```
2. **Kiểm tra kết quả kỳ vọng trên console:**
   - Đăng nhập thành công tài khoản `0975720501` (`xinkn01`).
   - Vào Map 7 Khu 0 nhận `RX 80`.
   - Gửi `TX -90 [1, 0]`, nhận `RX -90` subAction `0`.
   - Bắt gói `START_TRUCXANH` (bắt đầu ván đấu).
   - Tự động thực hiện các lượt lật thẻ thông minh qua `TX -90 [1, 2, id]` với thuật toán Perfect Memory.
   - Nhận diện toàn bộ các cặp thẻ mở và cập nhật điểm số.
   - Nhận gói `ENDCARD_TRUCXANH` (kết thúc ván đấu, in điểm số và kết quả).
   - Gửi `TX -90 [1, 5]` và đăng xuất an toàn.
