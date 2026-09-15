# Thiết Kế: Bổ Sung Cá Bến Tàu (Map 27) Vào Luồng Auto Nhiệm Vụ Thợ Câu

> **Ngày lập:** 2026-09-15  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Tích hợp các loại cá Bến Tàu (Map 27) vào bộ giải mục tiêu nhiệm vụ Thợ Câu (`FISHERMAN_QUEST_FISH_MAP` & `AvatarSession`).

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
- Tính năng Auto Thợ Câu (`fishermanQuest.ts`) tự động đọc nhiệm vụ từ NPC Lái buôn (uid 38), phân tích điều kiện (ví dụ: `"Thu hoạch 5 con cá rô - 0/5"`), tra cứu `FISHERMAN_QUEST_FISH_MAP` để xác định `map` và `ticketId`, sau đó tự chuyển map và câu đủ số lượng cá yêu cầu.
- Hiện tại, `FISHERMAN_QUEST_FISH_MAP` chỉ có cá của Map 14 (cá rô, lòng tong, chép vàng), Map 15 (cá lóc, cá nóc, con cua), Map 16 (cá chim, cá đuối, cá ngựa, cá mập).
- Khi người chơi nhận được nhiệm vụ Thợ Câu liên quan đến các loại cá ở Bến Tàu (Cá lia thia, Cá chép, Cá hề, Cá vàng), bot sẽ báo lỗi:
  `"Không nhận diện được cá ... trong quest ..., dừng an toàn."`

### 1.2. Mục tiêu
- Bổ sung các loại cá Bến Tàu (Map 27) vào `FISHERMAN_QUEST_FISH_MAP`:
  - `4504`: **Cá lia thia** (`ca lia thia`, `lia thia`)
  - `4505`: **Cá chép** (`ca chep`)
  - `4506`: **Cá hề** (`ca he`, `he`)
  - `4507`: **Cá vàng** (`ca vang`)
- Tất cả các cá này ánh xạ đến `map: 27` và `ticketId: 4876` (Vé câu bến tàu).
- Thêm log cảnh báo/thông tin thân thiện trong `AvatarSession.ts` khi câu nhiệm vụ tại Map 27.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- File `avatar-web/server/src/session/fishermanQuest.ts`:
  - Mở rộng `FISHERMAN_QUEST_FISH_MAP` với các alias không dấu của 4 loài cá Bến Tàu.
- File `avatar-web/server/src/session/avatarSession.ts`:
  - Thêm log thông tin vé bến tàu khi `resolved.map === 27`.
- Đảm bảo cơ chế sort key theo độ dài trong `resolveFishQuestTarget` xử lý chính xác xung đột tên:
  - `"ca chep vang"` (12 ký tự) > `"ca chep"` (7 ký tự) $\rightarrow$ `"cá chép vàng"` match Map 14, `"cá chép"` match Map 27.
  - `"ca chep vang"` (12 ký tự) > `"ca vang"` (7 ký tự) $\rightarrow$ `"cá chép vàng"` match Map 14, `"cá vàng"` match Map 27.

### 2.2. Out-of-Scope
- Không thay đổi flow đối thoại quest NPC (-62/-81).
- Không sửa frontend UI vì UI chỉ hiển thị thông tin nhiệm vụ và trạng thái runtime nhận từ server.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan

| File | Đường dẫn | Vai trò |
|---|---|---|
| `fishermanQuest.ts` | `avatar-web/server/src/session/fishermanQuest.ts` | Khai báo mapping từ tên cá chuẩn hóa sang `{ fishId, map, ticketId }` |
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Điều phối bot auto câu khi làm nhiệm vụ Thợ Câu |

### 3.2. Chi Tiết Mapping Thêm Mới

```typescript
// Map 27: Bến tàu / Biển Hawai (Vé câu bến tàu 4876)
'ca lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
'lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
'ca chep': { fishId: 4505, map: 27, ticketId: 4876 },
'ca he': { fishId: 4506, map: 27, ticketId: 4876 },
'ca vang': { fishId: 4507, map: 27, ticketId: 4876 },
```

### 3.3. Log Thông Báo trong `avatarSession.ts`

```typescript
if (resolved.map === 16) this.pushLog('[thợ câu] map 16 dùng vé Lượng (2 Lượng/vé 460).');
if (resolved.map === 27) this.pushLog('[thợ câu] map 27 dùng vé bến tàu (12.000 xu/vé 4876).');
```

---

## 4. Verification Plan

1. **Unit Test Resolve Target:**
   - Test `resolveFishQuestTarget("Thu hoạch 5 con cá lia thia - 0/5")` $\rightarrow$ `{ ok: true, fishId: 4504, map: 27, ticketId: 4876 }`
   - Test `resolveFishQuestTarget("Thu hoạch 3 con cá chép - 0/3")` $\rightarrow$ `{ ok: true, fishId: 4505, map: 27, ticketId: 4876 }`
   - Test `resolveFishQuestTarget("Thu hoạch 5 con cá chép vàng - 0/5")` $\rightarrow$ `{ ok: true, fishId: 450, map: 14, ticketId: 458 }` (không bị nuốt bởi `ca chep` hay `ca vang`)
   - Test `resolveFishQuestTarget("Thu hoạch 5 con cá hề - 0/5")` $\rightarrow$ `{ ok: true, fishId: 4506, map: 27, ticketId: 4876 }`
   - Test `resolveFishQuestTarget("Thu hoạch 5 con cá vàng - 0/5")` $\rightarrow$ `{ ok: true, fishId: 4507, map: 27, ticketId: 4876 }`
2. **Typecheck & Build:**
   - `npm --prefix avatar-web/server run typecheck`
