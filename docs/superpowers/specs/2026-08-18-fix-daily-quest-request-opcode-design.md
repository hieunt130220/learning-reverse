# Thiết Kế Kỹ Thuật (Design Document): Fix Lỗi Nhiệm Vụ Hàng Ngày Không Hiển Thị Dữ Liệu Từ Game

## 1. Mục Tiêu & Bối Cảnh (Context & Goal)
- **Hiện tượng lỗi**: Khi mở tab **Nhiệm vụ** $\rightarrow$ **Hàng ngày** trên giao diện Web, tài khoản đã đăng nhập online nhưng luôn hiển thị thông báo *"Chưa có dữ liệu nhiệm vụ hàng ngày."* kèm nút *"Tải nhiệm vụ từ game"*. Dù người dùng nhấn nút tải lại hay làm mới nhiều lần, giao diện vẫn không tải được dữ liệu, trong khi trong game Avatar tài khoản thực tế đang có chuỗi nhiệm vụ ngày (ví dụ: yêu cầu nộp Dâu tây `0/322`, Hoa hồng `0/702`, thưởng `700 Xu`, `100 XP`, `+7 ⭐`).
- **Mục tiêu**: Điều tra chính xác nguyên nhân gốc từ mã máy ARM64 của game Avatar HD (RVA `0x6a2008` và `0x4a0ab0`), sửa toàn bộ các phương thức gửi request Daily Quest trong `FarmService` từ `sub_type = 2` sang đúng `sub_type = 4`, bổ sung ánh xạ tên nông sản / phần thưởng, hiển thị điểm thưởng nhiệm vụ `missionScoreReward` (+7 ⭐) trên Web UI.

---

## 2. Phân Tích Nguyên Nhân Gốc (Root Cause Investigation)

Qua dịch ngược mã máy ARM64 trong file `libil2cpp.so` của Avatar HD (`AvatarHD_3.4.4_APKPure.apk`):

### 2.1. Phân tích hàm gửi gói tin `GlobalService.dailyquest(sbyte type)` (@RVA `0x6a2008`)
```arm64
0x6a2048: mov    w1, #0xa9                 ; Opcode = -87 (0xA9 / 169)
0x6a2054: bl     Message.create
0x6a205c: ldr    x0, [x20, #0x20]          ; Lấy stream writer của msg
0x6a2064: orr    w1, wzr, #0x4             ; w1 = 4 (sub_type = 4!)
0x6a206c: bl     myWriter.writeByte(4)     ; Ghi byte đầu tiên là 4
0x6a2070: ldr    x0, [x20, #0x20]          ; Lấy stream writer
0x6a2078: mov    w1, w19                   ; w1 = action_type (0, 1, 2, 3)
0x6a2080: bl     myWriter.writeByte(type)  ; Ghi byte thứ hai là action_type
0x6a2088: bl     Session.send(msg)         ; Gửi gói tin lên server
```

### 2.2. Điểm sai lệch nghiêm trọng trong codebase
Trong `avatar-web/server/src/game/farmService.ts` (dòng 248–268):
```typescript
  // ---- nhiệm vụ hàng ngày (cmd -87, byte đầu = sub-type 2) ----------------
  getDailyQuest(type = 0): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(type)); // ❌ SAI: Gửi byte 2
  }

  changeDailyQuest(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(1));    // ❌ SAI: Gửi byte 2
  }

  claimDailyQuestReward(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(2));    // ❌ SAI: Gửi byte 2
  }

  claimDailyQuestBox(): void {
    this.send(-87, (m) => m.writer!.writeByte(2).writeByte(3));    // ❌ SAI: Gửi byte 2
  }
```

### 2.3. Hệ quả chuỗi lỗi:
1. Khi Web hoặc `client.ts` gọi `this.farm.getDailyQuest(0)`, lệnh gửi lên server là `[-87, byte(2), byte(0)]`.
2. Gói tin có `sub_type = 2` vốn là mã opcode của gói dữ liệu rương đồ `CUSTOM_CHEST` / Part data, **không phải** Daily Quest.
3. Máy chủ game bỏ qua hoặc chỉ trả về gói `CUSTOM_CHEST` (`sub_type = 2`).
4. Trong `client.ts:564`, gói `sub_type = 2` bị bỏ qua (không xử lý).
5. Máy chủ game **chưa từng nhận được** yêu cầu Daily Quest thực sự (`sub_type = 4`), do đó không bao giờ gửi lại gói dữ liệu nhiệm vụ hàng ngày (`cmd -87, sub_type = 4`).
6. `this.dailyQuestState` trên server luôn là `null`, khiến Web UI luôn rơi vào trạng thái rỗng *"Chưa có dữ liệu nhiệm vụ hàng ngày."*.

---

## 3. Phạm Vi (Scope)

### Trong phạm vi (In-Scope)
1. **`avatar-web/server/src/game/farmService.ts`**:
   - Sửa toàn bộ 4 hàm `getDailyQuest()`, `changeDailyQuest()`, `claimDailyQuestReward()`, `claimDailyQuestBox()` gửi đúng `writeByte(4).writeByte(action_type)`.
2. **`avatar-web/server/src/game/farmData.ts`**:
   - Đọc và lưu `missionScoreReward` (`score_nhiemvu` từ `r.readInt()`) vào `DailyQuestState`.
   - Bổ sung các id hạt giống từ `DEFAULT_SEED_CATALOG` vào `KNOWN_PRODUCE_NAME_MAP` (Hoa Hồng `id: 5`, Dâu Tây `id: 35`, Khoai Tây `id: 42`, Ớt `id: 44`, ...) để luôn hiển thị đúng tên vật phẩm ngay cả khi chưa nạp xong bảng cây `this.trees`.
3. **`avatar-web/web/src/types.ts`**:
   - Thêm `missionScoreReward?: number;` vào interface `DailyQuestState`.
4. **`avatar-web/web/src/accounts/panels/QuestsPanel.tsx`**:
   - Hiển thị badge điểm thưởng năng động (ví dụ `⭐ +7 điểm năng động`) của nhiệm vụ trong panel chi tiết nhiệm vụ ngày.
   - Cải thiện trải nghiệm tải / làm mới dữ liệu.

### Ngoài phạm vi (Out-of-Scope)
- Không thay đổi các chức năng nông trại khác (tưới nước, bón phân, thu hoạch).

---

## 4. Thiết Kế Chi Tiết

### 4.1. File Changes Matrix

| File | Vai trò | Chi tiết thay đổi |
|---|---|---|
| `avatar-web/server/src/game/farmService.ts` | Gửi gói tin mạng | Đổi `writeByte(2)` thành `writeByte(4)` cho cả 4 phương thức `getDailyQuest`, `changeDailyQuest`, `claimDailyQuestReward`, `claimDailyQuestBox`. |
| `avatar-web/server/src/game/farmData.ts` | Giải mã dữ liệu | Thêm trường `missionScoreReward?: number` vào `DailyQuestState`, gán giá trị đọc từ `score_nhiemvu`. Mở rộng `KNOWN_PRODUCE_NAME_MAP`. |
| `avatar-web/web/src/types.ts` | Khai báo types | Thêm `missionScoreReward?: number` vào `DailyQuestState`. |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | Giao diện người dùng | Render điểm thưởng `+${daily.missionScoreReward} ⭐` trên thẻ nhiệm vụ. |

### 4.2. Giao Thức Mạng Chuẩn Xác Xác Minh Từ Binary

#### Request gửi đi (`GlobalService.dailyquest` @0x6a2008):
- Opcode: `-87` (0xA9)
- Byte 0: `sub_type = 4` (DAILY_QUEST)
- Byte 1: `action_type`:
  - `0`: `DAILYQUEST_SHOW` — Lấy danh sách nhiệm vụ và điểm năng động
  - `1`: `DAILYQUEST_CHANGE` — Đổi nhiệm vụ
  - `2`: `DAILYQUEST_DONE` — Nhận thưởng hoàn thành
  - `3`: `DAILYQUEST_GETBOX` — Mở rương quà mốc

#### Response trả về (`GlobalMessageHandler` @0x5ED07C & `DailyQuestScr`):
- Opcode: `-87` (0xA9)
- Byte 0: `sub_type = 4`
- Byte 1: `subAction` (0: SHOW, 1: CHANGE, 2: DONE, 3: GETBOX)
- Payload `subAction == 0 || 1`:
  - `curScore`: `int32` (Điểm năng động 0..100)
  - `boxDone`: `int8` (Bitmask 5 rương quà)
  - `nMission`: `int8` (Số nhiệm vụ)
    - `repeat nMission`: `idItem (int16)`, `numRequired (int32)`
  - `score_nhiemvu`: `int32` (Điểm thưởng năng động sau khi nộp đủ, ví dụ: 7 ⭐)
  - `nReward`: `int8` (Số phần thưởng vật phẩm/tiền tệ)
    - `repeat nReward`: `type (int8)`, nếu type 4/5: `itemId (int16)`, `amount (int32)`
  - `typeMoneyChange`: `int8` (-1: không đổi, 0: miễn phí, 1: xu, 2: lượng)
  - `moneyChange`: `int32` (chi phí đổi nếu typeMoneyChange > 0)

---

## 5. Kế Hoạch Xác Minh (Verification Plan)

### 5.1. Kiểm tra gửi & nhận gói tin thực tế
- Gửi lệnh `getDailyQuest(0)` từ client:
  - Kiểm tra traffic outgoing: Gói `-87` mang payload `[4, 0]`.
  - Server game phản hồi gói `-87` với `data[0] === 4`.
  - `decodeDailyQuestPacket` phân giải thành công `curScore = 0`, `boxes` 5 mốc, danh sách `missions` gồm các item cần nộp (ví dụ Dâu tây, Hoa hồng), `missionScoreReward = 7`, `rewards` gồm Xu và EXP.

### 5.2. Kiểm tra hiển thị Web UI
- Mở Web tab **Nhiệm vụ** $\rightarrow$ **Hàng ngày**:
  - Không còn thông báo rỗng "Chưa có dữ liệu".
  - Hiển thị thanh tiến trình năng động (0 / 100 ⭐), 5 rương mốc.
  - Danh sách nhiệm vụ liệt kê đúng các món cần thu hoạch / nộp kèm số lượng hiện có trong kho.
  - Điểm thưởng `⭐ +7 điểm năng động` và quà tặng (Xu, EXP) hiển thị trực quan.
  - Nút **Làm mới** tải lại dữ liệu mới nhất tức thì.
