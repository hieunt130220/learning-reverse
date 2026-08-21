# Phân tích chức năng Tìm NPC trên 3x.4utovip.com

> **Ngày:** 2026-08-21 · **Nguồn:** phân tích giao diện trực tiếp + `app.js` + `index.html` của `3x.4utovip.com`, trang chủ & API công khai của `4utovip.com`, quan sát thực tế dữ liệu NPC sự kiện.
> **Trạng thái:** frontend & API công khai đã xác minh; thuật toán bot phía server không công khai (suy luận từ mô tả tính năng 4utovip).

## 1. Tổng quan

`3x.4utovip.com` là dịch vụ bot tự động cho game **Avatar 3X** (`com.TeaM.Avatar` 3.4.4 — server private `27.0.14.120:19129`, đúng hệ thống đang reverse trong repo này). Người dùng mua "ô" (slot), nhập tài khoản game, bot chạy phía server của họ.

**"Tìm NPC" là 1 trong 5 chế độ chạy** (mô tả chính thức: *"Tự động tìm NPC nhận quà"*):

| Mode id | Tên hiển thị | Mô tả |
|---|---|---|
| `fishTool` | Câu cá | Tự động câu cá, độ chính xác 99.9% |
| `combinedTool` | Câu cá & Nông trại | Câu cá + chăm nông trại mỗi 30 phút |
| `fishermanTool` | Nhiệm vụ thợ câu | Tự động nhận nhiệm vụ, xác định khu câu, lọc cá |
| `farmSllTool` | Chăm farm SLL | Chăm nông trại theo danh sách tối đa 50 tài khoản/ô |
| `findNpcTool` | **Tìm NPC** | **Tự động tìm NPC nhận quà** |

## 2. Giao diện & cấu hình (frontend — đã xác minh)

Khi chọn chế độ **Tìm NPC** trong bảng cài đặt ô (`index.html`, section `#npcSearchSettings`), chỉ có 2 tuỳ chọn:

- **Tên NPC** — `#npcName`, `maxlength=80`, placeholder *"Nhập chính xác tên NPC"*. Người dùng phải nhập **chính xác tên NPC** (ví dụ `Ngưu Lang`).
- **Khi tìm xong NPC** — `#npcCompletionMode` (`npcSwitchOnComplete`):
  - `none` — Không làm gì
  - `fishTool` — Câu cá
  - `combinedTool` — Câu cá & Nông trại
  - `fishermanTool` — Nhiệm vụ thợ câu

Tức là sau khi tìm thấy NPC (và đánh nhận quà), bot có thể **tự chuyển sang chế độ khác** — không treo máy sau khi xong việc.

### Card ô tài khoản khi chạy chế độ `findNpcTool` (`app.js` renderSlots)

```
NPC: <tên NPC>              Thời gian treo: 00:00:00
Vị trí: Map X - Khu Y       Đồng bộ toàn bộ ô
```

- `Vị trí: Đang tìm` khi `currentMap == null || currentMap < 0` — bot chưa định vị được NPC.
- `Vị trí: Map X - Khu Y` — server bot báo vị trí hiện tại/đã tìm thấy (`currentMap`, `currentArea`).
- **"Đồng bộ toàn bộ ô"** — vị trí NPC tìm thấy được chia sẻ cho mọi ô tài khoản của user (và trong hệ sinh thái 4utovip).

## 3. Cách hoạt động (suy luận từ mô tả 4utovip + dữ liệu quan sát)

Tính năng tương ứng trên [4utovip.com](https://4utovip.com/) (cùng chủ, bán MOD + VPS) — **Auto Tìm NPC** và **Auto Sự kiện**:

- *"Hỗ trợ tìm và đánh NPC nhận quà"*
- *"Đồng bộ vị trí NPC với người dùng MOD khác để tìm nhanh hơn"*
- *"Tìm xong có thể chuyển chế độ auto khác"*
- *"Tìm và đánh NPC nhận quà theo thời gian cài đặt hằng ngày"* (Auto Sự kiện)

Luồng hoạt động của bot:

1. Di chuyển nhân vật qua các map/khu (MOD dùng lệnh chat `m{id}` — chuyển map, `k{id}` — chuyển khu).
2. Quét/dò tìm NPC theo **tên chính xác** người dùng nhập.
3. Khi thấy NPC → **"đánh" NPC** để nhận quà (MOD có lệnh `d{sl}` đánh, `ad{sl}` đánh đối tượng N lần).
4. **Báo cáo vị trí tìm thấy** (map_id + zone + server) lên hệ thống chia sẻ chung.
5. Nếu cấu hình "Khi tìm xong NPC" ≠ none → chuyển sang chế độ đó.

## 4. Hệ sinh thái đồng bộ vị trí NPC (đã xác minh bằng API thật)

4utovip công khai bảng **"NPC Sự kiện"** trên trang chủ (`#sec-npc-sukien` — *"Danh sách NPC đang xuất hiện"*), JS `npc.js`:

- Poll API mỗi **5 giây**: `GET https://4utovip.com/api/npc/events.php` (không cần đăng nhập).
- NPC sống tối đa **60 giây** (`MAX_SEC`) rồi **"Biến mất"**; còn ≤ **30 giây** (`URGENT_SEC`) chuyển trạng thái khẩn.
- Dữ liệu trả về:

```json
[
  {
    "id": 0,
    "npc_name": "Ngưu Lang",
    "map_id": 5,
    "zone": "7",
    "server": "Diệu Kỳ",
    "found_at": "2026-08-21 21:10:32",
    "seconds_ago": 36
  }
]
```

### Quan sát thực tế (2026-08-21, sự kiện Thất Tịch — Ngưu Lang/Chức Nữ)

| Thời điểm (UTC+7) | Kết quả |
|---|---|
| 21:10:32 | NPC `Ngưu Lang` ở **Map 5 - Khu 7**, server Diệu Kỳ (`seconds_ago=36`) |
| ~21:11 | Danh sách rỗng (NPC đã biến mất) |
| 21:12:36 | NPC `Ngưu Lang` respawn ở **Map 2 - Khu 6** (`seconds_ago=3`) |

→ **NPC sự kiện spawn ngẫu nhiên theo map/khu, sống rất ngắn (~60s), respawn vị trí khác sau ~1–2 phút.** Đây chính là lý do cần công cụ tìm + cơ chế chia sẻ vị trí giữa các bot.

## 5. API của 3x.4utovip.com (liên quan NPC)

Từ `app.js` (tải `https://3x.4utovip.com/app.js?v=...`, kèm cache-buster `v=YYYYMMDDHHMMSS`):

| Endpoint | Method | Body / Ghi chú |
|---|---|---|
| `/api/slots/:index` | PUT | Lưu cấu hình: `npcName`, `npcSwitchOnComplete`, `npcCompletionMode`, `mode`, `accounts`, `passwords`, … |
| `/api/slots/:index/npc-completion` | PUT | `{ enabled, mode }` — đổi hành động sau khi tìm xong NPC |
| `/api/slots/:index/start` / `stop` | POST | Khởi động / dừng bot |
| `/api/slots/:index/reset` | POST | Reset bộ đếm |
| `/api/slots` | GET | Poll trạng thái; mỗi **3s** (tab hiển thị) / **15s** (tab ẩn) |

**Live keys NPC** (từ `SLOT_LIVE_KEYS`): `currentMap`, `currentArea` (+ `npcName`, `npcSwitchOnComplete`, `npcCompletionMode` ở config).

Toàn bộ API yêu cầu đăng nhập (`/api/session` — cookie same-origin), đứng sau Cloudflare. **Logic bot tìm NPC nằm hoàn toàn phía server, không công khai.**

## 6. Liên hệ giao thức game (cho project avatar-web)

Những gì đã có sẵn trong repo này có thể dùng làm nền để implement "tìm NPC":

- Tương tác NPC: `communicate(idUser)` = cmd `-59` (COMMUNICATE) — `avatar-web/server/src/game/farmService.ts:69`.
- Menu NPC: `doMenuOption(userID, menuIndex, subIndex)` = cmd `-61` — `farmService.ts:74`.
- Quest từ NPC: cmd `-62` (CURRENT_QUEST), `-81` (QUEST_LIST) — `client.ts:532-570`.
- Vào nông trại: `enterFarm(idFarm?)` — `client.ts:427`.

Còn thiếu để implement đầy đủ (chưa có trong avatar-web):

1. **Di chuyển map/khu** — MOD dùng lệnh chat `m{id}` / `k{id}`; cần reverse cmd tương ứng (vd `-21 REQUEST_JOIN_ANY`, `-24 REQUEST_CITY_MAP`, `-23 SELECTED_MINI_MAP` — xem `opcodes.ts`).
2. **Phát hiện NPC trên map** — parse danh sách đối tượng/NPC trong gói enter-map / cập nhật map (`readListPlayer`, `readMapItem`, `readMapItemType` — `avatar-re/notes/login.md:47-100`).
3. **Lệnh đánh/tương tác NPC** — "đánh NPC nhận quà" (`ad{sl}` / `d{sl}` trong MOD); cần tìm cmd gốc.
4. **Báo vị trí tìm thấy** — endpoint sync riêng (public: `api/npc/events.php` bên 4utovip chỉ đọc).

## 6b. Phân tích kỹ thuật giao thức game (reverse AvatarHD)

Phần phân tích giao thức chi tiết (handler context, lệnh TX di chuyển map/khu, decode gói enter-world chứa NPC, hằng số map/zone, đối chiếu `Map X - Khu Y`) đã được reverse từ APK 3.4.4 — xem:

- [`docs/Phân tích kỹ thuật giao thức  — Di chuyển Map & Tìm NPC trong AvatarHD.md`](Phân tích kỹ thuật giao thức  — Di chuyển Map & Tìm NPC trong AvatarHD.md)

## 7. Điểm chưa xác minh được

- Thuật toán duyệt map chính xác (thứ tự, tần suất, timeout).
- Cách bot nhận biết "đã tìm thấy" NPC (so tên từ gói tin map?).
- Cơ chế sync server→bot của 3x.4utovip (server tự đẩy vị trí NPC cho các slot hay bot tự report).
- Nguồn dữ liệu `api/npc/events.php` (MOD client report hay bot 3x report, hoặc cả hai).

---

## Phụ lục — Tham chiếu nhanh

- Frontend 3x: `https://3x.4utovip.com/app.js` (cache-buster theo version), `index.html` section `#npcSearchSettings`.
- Bảng NPC sự kiện công khai: `https://4utovip.com/#sec-npc-sukien` + `https://4utovip.com/js/npc.js`.
- API NPC sự kiện: `GET https://4utovip.com/api/npc/events.php`.
