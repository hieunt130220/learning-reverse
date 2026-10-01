# Thiết Kế: Cập Nhật Bảng Mapping ID Sang Tên Các Loài Thủy Sản Khu Bến Tàu (Map 27)

> **Ngày lập:** 2026-10-01  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Ánh xạ các item ID 4508 (Nhái), 4509 (Chàng hiu), 4510 (Ếch) cùng các loài thủy hải sản dải 45xx vào `FISH_NAMES` và `FISHERMAN_QUEST_FISH_MAP`.  
> **Bằng chứng xác minh:** Gửi opcode TX -108 (`requestPartDynaMic`) nhận phản hồi RX -108 từ game server ngày 2026-10-01.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
- Khi câu cá tại **Khu Bến Tàu / Đảo Hawai (Map 27)**, server push gói `RX 79 (CAN_CAU)` chứa `idFish` thuộc dải ID 45xx.
- Trước đây:
  - `4504`: Cá lia thia
  - `4505`: Cá chép
  - `4506`: Cá hề
  - `4507`: Cá vàng
  - `4508`, `4509`: Rơi vào fallback `'Cá ID <id>'`.
  - `4510`: Đang ghi tạm là `'Cá biển (4510)'`.
- Ngày 2026-10-01, hệ thống đã gửi yêu cầu truy vấn dynamic part trực tiếp lên game server qua opcode TX -108 (`requestPartDynaMic`) và thu được dữ liệu chính xác 100%:
  - `4508`: **Nhái** (coin: 175 xu, icon: 9323)
  - `4509`: **Chàng hiu** (coin: 180 xu, icon: 9324)
  - `4510`: **Ếch** (coin: 185 xu, icon: 9325)
  - Các loài mở rộng đi kèm: `4503`: Cá voi trắng (200 xu), `4511`: Sứa (190 xu), `4512`: Lợn biển (330 xu), `4513`: Cá voi sát thủ (300 xu), `4515`: Cá heo (250 xu), `4516`: Mực (195 xu).

### 1.2. Mục tiêu
1. Cập nhật `FISH_NAMES` trên server (`automationTypes.ts`) và web client (`FishingPanel.tsx`).
2. Mở rộng `FISHERMAN_QUEST_FISH_MAP` trong `fishermanQuest.ts` để tự động nhận diện và câu cá cho các nhiệm vụ Thợ Câu yêu cầu Nhái (Nhiệm vụ 72, 75), Chàng hiu (Nhiệm vụ 76, 89, 97), Ếch (Nhiệm vụ 73, 88, 90, 94, 95), Sứa (Nhiệm vụ 77), Mực (Nhiệm vụ 78, 82, 91), Cá heo (Nhiệm vụ 85, 86, 93, 96).
3. Cập nhật tài liệu tham chiếu `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- Bổ sung tên chính xác cho ID 4508, 4509, 4510 vào từ điển `FISH_NAMES`:
  - `4508: 'Nhái'`
  - `4509: 'Chàng hiu'`
  - `4510: 'Ếch'` (thay thế cho `'Cá biển (4510)'`)
  - Bổ sung thêm các loài Bến Tàu có trong nhiệm vụ Thợ Câu: `4503: 'Cá voi trắng'`, `4511: 'Sứa'`, `4512: 'Lợn biển'`, `4513: 'Cá voi sát thủ'`, `4515: 'Cá heo'`, `4516: 'Mực'`.
- Đồng bộ `FISH_NAMES` ở 2 vị trí:
  - Backend: `avatar-web/server/src/session/automationTypes.ts`
  - Frontend: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`
- Cập nhật mapping nhiệm vụ `FISHERMAN_QUEST_FISH_MAP` trong `avatar-web/server/src/session/fishermanQuest.ts`:
  - `nhai`: `{ fishId: 4508, map: 27, ticketId: 4876 }`
  - `chang hiu`: `{ fishId: 4509, map: 27, ticketId: 4876 }`
  - `ech`: `{ fishId: 4510, map: 27, ticketId: 4876 }`
  - `sua`: `{ fishId: 4511, map: 27, ticketId: 4876 }`
  - `ca heo`: `{ fishId: 4515, map: 27, ticketId: 4876 }`
  - `muc`: `{ fishId: 4516, map: 27, ticketId: 4876 }`
- Cập nhật bảng tổng hợp ở `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`.

### 2.2. Out-of-Scope
- Không thay đổi logic kết nối socket hoặc thuật toán giải mini-game mũi tên.
- Không thay đổi schema DB SQLite (thống kê `avatar_daily_fishing_statistics` lưu `fish_id` dạng integer).

---

## 3. Thiết Kế Kiến Trúc & Danh Sách File

### 3.1. Danh Sách Files Liên Quan

| File | Đường dẫn | Vai trò |
|---|---|---|
| `automationTypes.ts` | `avatar-web/server/src/session/automationTypes.ts` | Cung cấp `FISH_NAMES` và `getFishName(id)` cho bot runtime & API thống kê |
| `FishingPanel.tsx` | `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Cung cấp `FISH_NAMES` và `formatFishName(id, name)` cho UI Web |
| `fishermanQuest.ts` | `avatar-web/server/src/session/fishermanQuest.ts` | Bảng ánh xạ tên tiếng Việt không dấu sang `{ fishId, map, ticketId }` |
| `danh-sach-cac-map-cau-ca-AvatarHD.md` | `docs/danh-sach-cac-map-cau-ca-AvatarHD.md` | Tài liệu tra cứu mapping các loại cá theo map |

### 3.2. Data Contracts Chi Tiết

#### A. `FISH_NAMES` (`automationTypes.ts` & `FishingPanel.tsx`)
```typescript
export const FISH_NAMES: Record<number, string> = {
  // Map 14: Hồ cá rô
  444: 'Cá rô',
  449: 'Cá lòng tong',
  450: 'Cá chép vàng',

  // Map 15: Hồ cá lóc
  451: 'Cá lóc',
  452: 'Cá nóc',
  453: 'Con cua',

  // Map 16: Hồ cá mập
  454: 'Cá chim',
  455: 'Cá đuối',
  456: 'Cá ngựa',
  457: 'Cá mập',

  // Map 27: Bến tàu / Biển Hawai
  4503: 'Cá voi trắng',
  4504: 'Cá lia thia',
  4505: 'Cá chép',
  4506: 'Cá hề',
  4507: 'Cá vàng',
  4508: 'Nhái',
  4509: 'Chàng hiu',
  4510: 'Ếch',
  4511: 'Sứa',
  4512: 'Lợn biển',
  4513: 'Cá voi sát thủ',
  4515: 'Cá heo',
  4516: 'Mực',
};
```

#### B. `FISHERMAN_QUEST_FISH_MAP` (`fishermanQuest.ts`)
```typescript
    // Map 27: Bến tàu / Biển Hawai (Vé câu bến tàu 4876)
    'ca lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'ca chep': { fishId: 4505, map: 27, ticketId: 4876 },
    'ca he': { fishId: 4506, map: 27, ticketId: 4876 },
    'he': { fishId: 4506, map: 27, ticketId: 4876 },
    'ca vang': { fishId: 4507, map: 27, ticketId: 4876 },
    'nhai': { fishId: 4508, map: 27, ticketId: 4876 },
    'chang hiu': { fishId: 4509, map: 27, ticketId: 4876 },
    'ech': { fishId: 4510, map: 27, ticketId: 4876 },
    'sua': { fishId: 4511, map: 27, ticketId: 4876 },
    'ca heo': { fishId: 4515, map: 27, ticketId: 4876 },
    'muc': { fishId: 4516, map: 27, ticketId: 4876 },
```

---

## 4. Verification Plan

1. **Typecheck & Build:**
   - Server: `npm --prefix avatar-web/server run typecheck`
   - Web: `npm --prefix avatar-web/web run build`
2. **Kiểm tra output hàm:**
   - `getFishName(4508)` trả về `'Nhái'`
   - `getFishName(4509)` trả về `'Chàng hiu'`
   - `getFishName(4510)` trả về `'Ếch'`
   - `resolveFishQuestTarget("Câu 500 con nhái - 0/500")` trả về `{ ok: true, fishId: 4508, map: 27, ticketId: 4876 }`
   - `resolveFishQuestTarget("Câu 500 con chàng hiu - 0/500")` trả về `{ ok: true, fishId: 4509, map: 27, ticketId: 4876 }`
   - `resolveFishQuestTarget("Câu 500 con ếch - 0/500")` trả về `{ ok: true, fishId: 4510, map: 27, ticketId: 4876 }`
