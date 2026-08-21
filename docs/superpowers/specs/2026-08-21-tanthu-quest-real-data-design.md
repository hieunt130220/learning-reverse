# Hiển thị Nhiệm Vụ Tân Thủ thật từ server — Design Spec

- **Ngày:** 2026-08-21
- **Trạng thái:** Chờ duyệt
- **Liên quan:** `docs/superpowers/specs/2026-08-21-quest-real-mechanism-design.md` (spec đã duyệt cho Nhà Nông)

## Mục tiêu & Bối cảnh

Sau khi sửa quest Nhà Nông (commit `4a4bcd6`), tab **Nhiệm Vụ Tân Thủ** trên avatar-web vẫn hiển thị dữ liệu mặc định `DEFAULT_BEGINNER_QUEST_STATE` ("Nhiệm Vụ Tân Thủ 1", "Trồng 6 cây hoa hồng 0/6") — không phải dữ liệu thật từ server.

User yêu cầu: *"nhiệm vụ nhà nông đã đúng, làm tiếp với nhiệm vụ tân thủ"* — tab Tân Thủ phải hiển thị quest tiến trình thật từ server, giống như tab Nhà Nông đã làm.

## Phạm vi (Scope)

### In-scope
- Thêm query chuỗi quest **Tân Thủ** trong `GameClient.refreshProgressQuests()` sao cho `beginnerQuestState` được điền dữ liệu thật từ server (nguồn hộp thoại NPC, `cmd -62`).
- Xác minh decode end-to-end: server → `beginnerQuestState` → `/api/:id/state#quests.beginner` → tab Tân Thủ trên web.

### Out-of-scope
- **KHÔNG** đổi cấu trúc dữ liệu / API / web UI — tab Tân Thủ vốn đã render `quests.beginner` (`QuestsPanel.tsx`).
- **KHÔNG** parse danh sách quest Tân Thủ (`doMenuOption(19,0,1)` trả `-81` len=1316 nhưng `parseQuestListPacket` ra 0 quest — cấu trúc khác, và UI không dùng `questCatalog` cho tab Tân Thủ).
- **KHÔNG** xử lý các chuỗi quest khác phát hiện được (Thợ Câu uid=38, Tháng 7 uid=20, Tiền Sử uid=46, VIP uid=33) — không có tab UI tương ứng.
- **KHÔNG** thay đổi `syncProgressQuests` / đánh dấu completed tự động (đã bỏ ở commit `4a4bcd6`).

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Bản đồ userID → chuỗi quest (verified live 2026-08-21, account phu)

Mỗi chuỗi nhiệm vụ nông trại có một **userID** riêng, gửi qua `doMenuOption(userID, menuIndex, subIndex)`. Phát hiện bằng cách quét `doMenuOption(uid, 0, 0)` sau `communicate(90)`:

| userID | Chuỗi quest | Ghi chú |
|--------|-------------|---------|
| **19** | **Nhiệm Vụ Tân Thủ** | ⭐ Target của task này |
| 35 | Nhiệm Vụ Nhà Nông | Đã implement (commit `4a4bcd6`) |
| 38 | Nhiệm Vụ Thợ Câu | NPC 95 |
| 20 | Nhiệm Vụ Tháng 7 | — |
| 46 | Nhiệm Vụ Tiền Sử | — |
| 33 | VIP info | không phải quest |

### Dữ liệu Tân Thủ xác minh (account phu)

`communicate(90)` → `doMenuOption(19, 0, 0)` → **cmd -62** (cùng format Nhà Nông: byte0=0x00 header, rồi lặp `[i8 len][utf8]`):

```
["", "Nhiệm Vụ", "", "Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:\n
- Mua 5 con gà  - 0/5\n
- Mua 2 con cá chép  -Xong\n\n
Phần Thưởng: \n - 5000 xu - 1 Tiến Sĩ vĩnh viễn  - 1 Tiến Sĩ vĩnh viễn "]
```

`parseQuestDialogText(phần tử chứa "nhiệm vụ hiện tại")` → **verified**:
```json
{
  "kind": "beginner", "screenType": 1, "title": "Nhiệm Vụ Tân Thủ 2", "step": 2,
  "conditions": [
    { "name": "Mua 5 con gà", "current": 0, "total": 5, "isDone": false },
    { "name": "Mua 2 con cá chép", "current": 2, "total": 2, "isDone": true }
  ],
  "rewards": [
    { "type": 6, "amount": 5000, "displayName": "5.000 Xu" },
    { "type": 7, "amount": 1, "displayName": "1 Tiến Sĩ vĩnh viễn" }
  ],
  "source": "game-dialog"
}
```

### Thay đổi code

**File duy nhất: `avatar-web/server/src/game/client.ts` — `refreshProgressQuests()` (dòng ~533-567)**

Thêm interaction thứ 4 sau query Nhà Nông (giữ nguyên pattern "mỗi doMenuOption cần một lượt communicate() riêng"):

```ts
this.farm.communicate(90);
await new Promise((resolve) => setTimeout(resolve, 450));
this.farm.doMenuOption(19, 0, 0); // Nhiệm Vụ Tân Thủ → cmd -62
await new Promise((resolve) => setTimeout(resolve, 500));
```

Handler **cmd -62 hiện có** (`client.ts:707-737`) đã tự định tuyến theo `kind`:
- `parts.find((s) => /nhiệm vụ hiện tại/i.test(s))` → lấy đúng phần tử quest
- `parseQuestDialogText` → `kind: 'beginner'` vì title chứa "Tân Thủ" → gán `this.beginnerQuestState` → emit `'quests'`.

**Không đụng** `progressQuests.ts`, `avatarSession.ts`, `routes.ts`, web UI.

### Data flow sau khi fix

```
refreshProgressQuests()  (trigger: vào farm / POST /quests/progress/refresh)
 └─ communicate(90) → doMenuOption(35,0,0) → -62 Nhà Nông → farmerQuestState  (như cũ)
 └─ communicate(90) → doMenuOption(35,0,1) → -81 list 108 → questCatalog        (như cũ)
 └─ communicate(90) → doMenuOption(19,0,0) → -62 Tân Thủ → beginnerQuestState  (MỚI)
        → emit('quests') → getQuestOverview() → /api/:id/state#quests.beginner
        → QuestsPanel tab "Tân Thủ" render conditions/rewards thật
```

### Rủi ro / impact

- `impact(refreshProgressQuests)` (GitNexus, resolved về `AvatarSession` wrapper): **LOW**, 0 caller trực tiếp, additive.
- Caller thật của `GameClient.refreshProgressQuests`: (1) `client.ts:1066` khi vào farm; (2) `POST /:id/quests/progress/refresh` → `avatarSession.ts:232`. Không có API break.
- Tân Thủ (uid=19) ghi vào `beginnerQuestState`, Nhà Nông (uid=35) ghi `farmerQuestState` — **khác kind, không ghi đè lẫn nhau** (khác với lỗi cũ khi query NPC 95).
- Nếu account không có quest Tân Thủ đang active: server trả -62 không chứa "nhiệm vụ hiện tại" → handler bỏ qua, `beginnerQuestState` giữ giá trị cũ. An toàn.

## Verification Plan

1. **Probe script** (`/tmp/verify-tanthu.ts` — đã chạy): `communicate(90)` → `doMenuOption(19,0,0)` → decode -62 → `kind=beginner`, `title="Nhiệm Vụ Tân Thủ 2"`, conditions/rewards đúng. ✅ Đã pass.
2. **Live e2e sau khi code**: reconnect account phu → `POST /:id/quests/progress/refresh` → `GET /:id/state` → kiểm tra `quests.beginner.title === "Nhiệm Vụ Tân Thủ 2"`, `source: 'game-dialog'`, conditions `Mua 5 con gà (0/5)`, `Mua 2 con cá chép (2/2)`.
3. **Không regression**: `quests.farmer` vẫn là `"Nhiệm Vụ Nhà Nông - 1"` (192/200 cà chua), `quests.upgradeRequirements` vẫn 20 mục.
4. **UI**: mở tab Tân Thủ trong QuestsPanel → hiển thị "Nhiệm Vụ Tân Thủ 2" + điều kiện/thưởng thật, không còn mặc định "Trồng 6 cây hoa hồng".
5. **`detect_changes()`** trước khi commit — chỉ ảnh hưởng symbol `refreshProgressQuests`.
