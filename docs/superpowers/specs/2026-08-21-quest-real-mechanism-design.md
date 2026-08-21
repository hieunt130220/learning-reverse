# Nhiệm Vụ Tân Thủ / Nhà Nông — Đồng bộ từ Hộp thoại NPC Thật

## Mục tiêu & Bối cảnh

### Vấn đề
Hiển thị tiến trình "Nhiệm Vụ Tân Thủ" và "Nhiệm Vụ Nhà Nông" trên avatar-web hiện **sai**:

1. **Nhiệm vụ được đánh dấu "Đã hoàn thành" dựa trên farmLevel ≥ 2** (`markQuestsCompletedForFarmLevel` trong `client.ts`). Thực tế user xác nhận: các nhiệm vụ này **KHÔNG liên quan** cấp độ nông trại.
2. **Chuỗi tương tác NPC dùng id `-1` sai** (`refreshProgressQuests` gửi `communicate(-1)` + `doMenuOption(-1, 0, 1)`), nên server không trả hộp thoại nhiệm vụ — dữ liệu quest hiển thị hiện nay phần lớn là **dữ liệu mặc định** (`DEFAULT_BEGINNER_QUEST_STATE` / `DEFAULT_FARMER_QUEST_STATE`) hoặc tính từ `FarmData`.

### Flow thật trong game (user mô tả, đã probe xác nhận)
Trong game: vào map **Nông trại** → bấm NPC **Lái buôn/Luffy** → bấm "Nhiệm vụ tân thủ" → bấm "Xem nhiệm vụ hiện tại".

Kết quả probe trên private server (account phu, trong farm handler):

| Bước | Lệnh gửi | Response | Nội dung nhận được |
|---|---|---|---|
| Tương tác NPC | `communicate(90)` | cmd **-61** | Menu `userID=35`, options: `["Xem nhiệm vụ hiện tại", "Xem danh sách nhiệm vụ"]` |
| Xem nhiệm vụ hiện tại | `doMenuOption(35, 0, 0)` | cmd **-62** | `"Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Nhà Nông - 1:\n- Thu hoạch 200 cà chua  - 192/200\n- Thu hoạch 200 cà rốt  - 0/200\n- Mua 2 con gà  - 0/2\n\nPhần Thưởng:\n - 5000 xu\n - 100 điểm kinh nghiệm"` |
| Xem danh sách | `doMenuOption(35, 0, 1)` | cmd **-81** | `"Danh Sách Nhiệm Vụ"` + 108 quest "Nhiệm Vụ Nhà Nông - N" với Phần Thưởng |

- NPC **90/91** → menu userID **35** → quest "Nhiệm Vụ Nhà Nông"
- NPC **95** → menu userID **38** → quest "Nhiệm Vụ Thợ Câu" (loại khác, cùng format)
- Chỉ trong **farm handler** mới có phản hồi; ở global thì `doMenuOption(35/90, ...)` câm.
- `parseQuestDialogText()` hiện có **đã parse chuẩn** payload cmd -62 (đã test trên payload thật: `kind=farmer`, `title="Nhiệm Vụ Nhà Nông - 1"`, `conditions` 192/200, `rewards`).

## Phạm vi (Scope)

### In-scope
- Sửa `refreshProgressQuests()` trong `server/src/game/client.ts` để gửi đúng chuỗi: `communicate(90)` → `doMenuOption(35, 0, 1)` (danh sách) và `communicate(90)` → `doMenuOption(35, 0, 0)` (nhiệm vụ hiện tại).
- Thêm handler giải mã **cmd -62** (nhiệm vụ hiện tại, có tiến trình) và **cmd -81** (danh sách nhiệm vụ) → cập nhật `beginnerQuestState` / `farmerQuestState`.
- **Bỏ** logic `markQuestsCompletedForFarmLevel()` (đánh "hoàn thành" theo farmLevel ≥ 2).
- Giữ nguyên 🚜 **Nâng Cấp** tab (dữ liệu cmd 104 thật đã hoạt động).

### Out-of-scope
- Không sửa nội dung quest list, không thêm quest mới.
- Không thay đổi giao diện web (chỉ đảm bảo dữ liệu quest mới được đẩy đúng vào `QuestOverviewState`).
- Không đụng tới Nhiệm Vụ Ngày (`dailyQuestState`) — đã hoạt động riêng.
- Không giải quyết việc rớt kết nối (đang điều tra ở task khác).

### Input / Output
- **Input:** gói tin server cmd **-62**, **-81** trả về sau chuỗi NPC.
- **Output:** `beginnerQuestState` / `farmerQuestState` (ProgressQuestChain) được cập nhật đúng dữ liệu server, không tính từ FarmData, không tự đánh "hoàn thành".

### Edge cases
- Không vào farm / chưa tương tác NPC → quest giữ nguyên hoặc bỏ qua (không crash).
- NPC trả quest có tên lạ (vd "Nhiệm Vụ Thợ Câu") → `kind` mặc định farmer, không ép thành beginner.
- `communicate` / `doMenuOption` không phản hồi (mất mạng, sai trạng thái) → timeout ngắn, không treo.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules liên quan
| File | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/game/client.ts` | Client game, handler gói tin | Modify: `refreshProgressQuests`, thêm case -62/-81, bỏ `markQuestsCompletedForFarmLevel`, sửa `syncProgressQuests` |
| `avatar-web/server/src/game/progressQuests.ts` | Parse & model quest | Modify (nếu cần): thêm parser cmd -81; chuẩn hóa `kind` từ title |
| `avatar-web/server/src/game/farmService.ts` | Gửi lệnh farm/NPC | Không đổi (wire format `doMenuOption` đã đúng) |
| `avatar-web/web/src/accounts/*` | UI | Không đổi (chỉ nhận dữ liệu qua API) |

### Data contracts

**cmd -62 — Nhiệm vụ hiện tại** (đã decode):
```
byte 0: 0x00 (header)
lặp: [i8 len][utf8]  → ["", "Nhiệm Vụ", "", "<nội dung quest>"]
```
`parseQuestDialogText("<nội dung quest>")` → `ProgressQuestChain` (đã chứng minh hoạt động).

**cmd -81 — Danh sách nhiệm vụ**:
```
[i8 len][utf8] lặp:
  [0] "lsnhiemvu"          (magic/type)
  [1] "Danh Sách Nhiệm Vụ"
  [2..] các mục quest — mỗi mục chứa "Nhiệm Vụ Nhà Nông - N" và "Phần Thưởng: ..."
```
Parser: tách từng mục theo regex `Nhiệm Vụ ... - \d+` rồi phần thưởng; dùng để biết tổng số quest + rewards (dữ liệu phụ trợ).

### Flow xử lý

```
[server] farm packet 69/61 (JOIN)
  → client.ts: onMessage
      → refreshProgressQuests():
          communicate(90)
          → doMenuOption(35, 0, 1)   // Xem danh sách → cmd -81
          → communicate(90)          // (tách lượt tương tác)
          → doMenuOption(35, 0, 0)   // Xem nhiệm vụ hiện tại → cmd -62
      → onMessage case -62 → parseQuestDialogText → cập nhật state → emit('quests')
      → onMessage case -81 → parseQuestList → cập nhật quest list phụ trợ
  → syncProgressQuests()  // KHÔNG còn markQuestsCompletedForFarmLevel
```

### Verification Plan
1. Chạy probe `doMenuOption(35, 0, 0)` trong farm → cmd -62 có đúng "Nhiệm Vụ Nhà Nông - 1" với 192/200 cà chua (khớp server).
2. Chạy server + login web → `GET /api/accounts/2/state` (hoặc quests) → `beginner/farmer` quest có `source: 'game-dialog'`, title "Nhiệm Vụ Nhà Nông - 1", conditions có current/total thật.
3. Account phu farmLevel=2: quest **KHÔNG** được đánh "Đã hoàn thành" — vẫn hiển thị tiến trình 192/200.
4. Regression: 🚜 Nâng Cấp tab vẫn hiển thị dữ liệu cmd 104.
