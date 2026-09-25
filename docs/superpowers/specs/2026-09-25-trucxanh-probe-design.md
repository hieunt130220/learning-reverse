# Minigame Lật Hình (Trúc Xanh) Map 7 Probe Tool Design

> **Ngày lập:** 2026-09-25  
> **Topic:** `trucxanh-probe`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Minigame **Trúc Xanh** (Lật hình - `TRUCXANH`) tại Lâu đài Map 7 Khu 0 được điều khiển qua opcode `-90` (0xA6). Các phân tích dịch ngược từ IL2CPP (`TrucXanhMsgHandler`, `TrucXanhService`, `TrucXanhGameScr`) đã xác định cấu trúc các gói tin:
- `TX -90 [1, 0]`: Tham gia bàn chơi (`JOIN_TRUCXANH`).
- `TX -90 [1, 2, idCard]`: Lật lá bài (`OPENCARD_TRUCXANH`), với `idCard` từ `0..23` (lưới 6×4).
- `TX -90 [1, 5]`: Thoát bàn chơi (`OUTCARD_TRUCXANH`).

Mục tiêu của công cụ probe là:
1. Đăng nhập tài khoản thật vào live server và di chuyển tới Map 7 Khu 0.
2. Tham gia bàn Trúc Xanh (`TX -90 [1, 0]`).
3. Kiểm chứng phản hồi live từ máy chủ:
   - Máy chủ có tự động bắt đầu ván đấu cho 1 người chơi (`START_TRUCXANH`) hay cần người chơi thứ 2?
   - Khi có lượt (`turn == 0`), probe tự động gửi lệnh lật bài (`TX -90 [1, 2, id]`) để quan sát phản hồi `OPENCARD_TRUCXANH`, `img`, cờ khớp thẻ (`isMatch`), điểm số và đổi lượt.
4. Ghi nhận log chi tiết toàn bộ hex payload để phục vụ xây dựng module Auto Farm / Minigame hoàn chỉnh.

---

## 2. Phạm Vi (Scope)

### In-Scope
- **File công cụ mới:** `avatar-web/server/src/tools/trucxanh-probe.ts`.
- **Kịch bản hoạt động:**
  1. `login`: Đăng nhập tài khoản qua `GameClient` (sử dụng `--account-id`).
  2. `enter-map7`: Chuyển sang ngữ cảnh Park (`TX -1 [9]`), xin danh sách khu (`TX 90 [7]`), và vào Map 7 Khu 0 (`TX 80 [7, 0, 524, 423]`).
  3. `join-game`: Gửi `TX -90 [1, 0]` để ngồi vào bàn Trúc Xanh.
  4. `game-loop`:
     - Lắng nghe `RX -90` với các subActions:
       - `0` (`JOIN_TRUCXANH`): Ghi nhận người tham gia.
       - `1` (`START_TRUCXANH`): Ghi nhận lượt đi đầu tiên (`turn`) và thời gian đếm ngược (`time`).
       - `2` (`OPENCARD_TRUCXANH`): Giải mã `idCard`, `img`, `isMatch`, cặp thẻ trùng, điểm số.
       - `3` (`SETTURN_TRUCXANH`): Đổi lượt người chơi.
       - `4` (`ENDCARD_TRUCXANH`): Kết thúc ván, ghi nhận kết quả thắng/thua, điểm, hộp quà thưởng.
     - Khi đến lượt probe: tự động lật 2 lá bài liên tiếp (ví dụ thẻ `0` và `1`, hoặc các thẻ chưa mở) với khoảng delay an toàn (1000ms) để quan sát gói tin.
  5. `cleanup`: Khi kết thúc ván hoặc sau timeout 60 giây, gửi `TX -90 [1, 5]` và ngắt kết nối an toàn.
- **CLI Arguments:**
  - `--account-id <number>`: ID tài khoản trong SQLite DB (mặc định: `1`).
  - `--card1 <number>`: Thẻ bài đầu tiên lật thử (mặc định: `0`).
  - `--card2 <number>`: Thẻ bài thứ hai lật thử (mặc định: `1`).
  - `--timeout <number>`: Thời gian tối đa chạy probe tính bằng giây (mặc định: `60`).

### Out-of-Scope
- Không can thiệp vào các minigame khác (Cờ caro, Aincrad).
- Không viết logic auto chơi thông minh tối ưu (chỉ lật bài cơ bản để verify giao thức).
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
   - Bắt gói `START_TRUCXANH` hoặc thông báo chờ đối thủ.
   - Thao tác gửi lật thẻ `TX -90 [1, 2, id]` và ghi nhận `RX -90` subAction `2`.
   - Thoát game `TX -90 [1, 5]` và ngắt kết nối sạch.
