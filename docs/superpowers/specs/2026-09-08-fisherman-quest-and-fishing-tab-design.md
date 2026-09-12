# Thiết Kế: Nhiệm Vụ Thợ Câu & Tích Hợp Tab Câu Cá

> **Ngày tạo:** 2026-09-08  
> **Trạng thái:** Chờ User duyệt (Pending Review)  
> **Tác giả:** AI Assistant & nguyentrunghieu  

---

## 1. Mục Tiêu & Bối Cảnh

### Vấn đề cần giải quyết
Hiện tại, `avatar-web` đã có hệ thống quản lý nhiệm vụ nông trại (Nhiệm Vụ Hằng Ngày, Nhiệm Vụ Tân Thủ `userID = 19`, Nhiệm Vụ Nhà Nông `userID = 35`), cùng hệ thống tự động câu cá sử dụng Machine Learning (Phase 3 ML trong tab Câu cá).

Tuy nhiên, chuỗi **Nhiệm Vụ Thợ Câu** (`userID = 38`) trong game AvatarHD:
1. Chưa được truy vấn tự động từ NPC Lái buôn/Luffy (`userID = 38` qua `cmd -62`).
2. Type hệ thống (`ProgressQuestKind`) chỉ hỗ trợ `'beginner' | 'farmer'`. Khi parser nhận được nhiệm vụ Thợ Câu, nó bị gán nhầm thành `'farmer'` và có nguy cơ ghi đè lên `farmerQuestState`.
3. Giao diện Web:
   - Panel **Nhiệm Vụ** (`QuestsPanel.tsx`) chưa có tab hiển thị chuỗi Thợ Câu.
   - Panel **Câu Cá** (`FishingPanel.tsx`) hoạt động độc lập, người dùng không thể biết nhiệm vụ Thợ Câu đang yêu cầu câu loại cá nào và tiến độ bao nhiêu ngay khi đang vận hành auto câu cá.

### Mục tiêu
- Mở rộng giao thức game client để tự động lấy và giải mã chuỗi Nhiệm Vụ Thợ Câu từ NPC Lái buôn (`userID = 38`).
- Bổ sung tab **"🎣 Thợ Câu"** đầy đủ trong panel Nhiệm Vụ (`QuestsPanel.tsx`).
- Tích hợp trực tiếp thẻ trạng thái **Nhiệm Vụ Thợ Câu** vào panel Câu Cá (`FishingPanel.tsx`), cho phép theo dõi nhanh tiến độ loại cá cần câu và làm mới nhiệm vụ ngay tại chỗ.

---

## 2. Phạm Vi (Scope)

### In-scope
1. **Mở rộng Data Contract**:
   - `ProgressQuestKind` bổ sung `'fisherman'`.
   - `QuestOverviewState` bổ sung trường `fisherman: ProgressQuestChain | null`.
   - Cập nhật cả server (`progressQuests.ts`, `farmData.ts`) và client web (`types.ts`).
2. **Parser & Protocol GameClient**:
   - Cập nhật `parseStepFromTitle` và `parseQuestDialogText` trong `progressQuests.ts` để nhận diện chuỗi `Thợ Câu` / `câu cá`.
   - Cập nhật `GameClient`: thêm `fishermanQuestState`, sửa `refreshProgressQuests()` để gửi truy vấn `communicate(90)` $\rightarrow$ `doMenuOption(38, 0, 0)`, định tuyến kết quả `cmd -62` và các dialog liên quan.
   - Cập nhật `AvatarSession.getQuestOverview()` để truyền `fisherman`.
3. **Giao diện Web**:
   - `QuestsPanel.tsx`: Thêm tab `"🎣 Thợ Câu"`, thanh tiến trình, hiển thị điều kiện & phần thưởng.
   - `AccountOperationsDrawer.tsx`: Truyền dữ liệu `quests` vào `FishingPanel`.
   - `FishingPanel.tsx`: Thêm widget hiển thị nhiệm vụ Thợ Câu hiện tại kèm nút bấm làm mới tiến trình.

### Out-of-scope
- Không tự động thay đổi bản đồ câu (`selectedMap`) dựa trên loại cá của nhiệm vụ (sẽ phát triển trong tương lai nếu cần).
- Không tự động trả/nhận nhiệm vụ Thợ Câu khi hoàn thành (chỉ hiển thị tiến trình nhận từ server).
- Không can thiệp vào mô hình suy luận ML câu cá (Phase 3 inference service).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh sách Files & Modules liên quan

| File | Vai trò | Thay đổi chính |
|---|---|---|
| `avatar-web/server/src/game/progressQuests.ts` | Parser nhiệm vụ tiến trình | Thêm `'fisherman'` vào `ProgressQuestKind`, cập nhật regex nhận diện tiêu đề và bước nhiệm vụ, thêm `DEFAULT_FISHERMAN_QUEST_STATE`. |
| `avatar-web/server/src/game/farmData.ts` | Type dữ liệu nông trại & quest | Thêm `fisherman: ProgressQuestChain \| null` vào `QuestOverviewState`. |
| `avatar-web/server/src/game/client.ts` | Client giao thức game | Thêm `fishermanQuestState`, gửi `doMenuOption(38, 0, 0)` trong `refreshProgressQuests()`, phân luồng `cmd -62`. |
| `avatar-web/server/src/session/avatarSession.ts` | Quản lý session server | Bổ sung `fisherman` vào `getQuestOverview()` và snapshot runtime. |
| `avatar-web/web/src/types.ts` | Frontend Type Definitions | Thêm `'fisherman'` vào `ProgressQuestKind` và `fisherman` vào `QuestOverviewState`. |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | Panel Nhiệm vụ | Thêm tab `"🎣 Thợ Câu"`, badge đếm, render tiến trình & phần thưởng. |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Panel Câu cá | Hiển thị widget tiến trình nhiệm vụ Thợ Câu kèm nút làm mới. |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer điều khiển chính | Truyền snapshot `quests` vào `FishingPanel`. |

---

### 3.2. Data Contracts & Interfaces

#### Mở rộng `ProgressQuestKind`
```ts
export type ProgressQuestKind = 'beginner' | 'farmer' | 'fisherman';
```

#### Mở rộng `QuestOverviewState`
```ts
export interface QuestOverviewState {
  daily: DailyQuestState | null;
  beginner: ProgressQuestChain | null;
  farmer: ProgressQuestChain | null;
  fisherman: ProgressQuestChain | null;
  upgradeRequirements: FarmUpgradeRequirements | null;
  source: 'live' | 'cached' | 'none';
  updatedAt: number;
}
```

#### Cập nhật Parser `parseQuestDialogText`
```ts
const titleMatch = /(?:nhiệm vụ hiện tại của bạn là nhiệm vụ:)?\s*([^\n:]+):/i.exec(text);
const title = titleMatch ? titleMatch[1].trim() : 'Nhiệm Vụ Nhà Nông - 1';
const isBeginner = /tân thủ/i.test(title);
const isFisherman = /thợ câu|câu cá/i.test(title);
const kind: ProgressQuestKind = isBeginner ? 'beginner' : isFisherman ? 'fisherman' : 'farmer';
```

---

### 3.3. Luồng Xử Lý (Sequence Flow)

```
[Web UI / Auto Timer]
       │
       ▼
POST /api/accounts/:id/quests/progress/refresh
       │
       ▼
GameClient.refreshProgressQuests()
       │
       ├─► 1. OPEN_INFO_FARM (cmd 104) ──► Cập nhật Nâng cấp
       ├─► 2. communicate(90) + doMenuOption(35, 0, 0) ──► RX -62 ──► farmerQuestState
       ├─► 3. communicate(90) + doMenuOption(35, 0, 1) ──► RX -81 ──► questCatalog
       ├─► 4. communicate(90) + doMenuOption(19, 0, 0) ──► RX -62 ──► beginnerQuestState
       └─► 5. communicate(90) + doMenuOption(38, 0, 0) ──► RX -62 ──► fishermanQuestState
                                                                        │
                                                                        ▼
                                                             parseQuestDialogText()
                                                                        │
                                                                        ▼
                                                             kind: 'fisherman'
                                                             emit('quests')
                                                                        │
                                            ┌───────────────────────────┴───────────────────────────┐
                                            ▼                                                       ▼
                                 QuestsPanel (Tab Thợ Câu)                               FishingPanel (Widget Thợ Câu)
```

---

### 3.4. Thiết Kế Giao Diện (UI/UX)

#### Trong `QuestsPanel.tsx`:
- Thanh tab gồm: `☀️ Hằng Ngày` | `🐣 Tân Thủ` | `🌾 Nhà Nông` | `🎣 Thợ Câu`.
- Badge: Hiển thị số điều kiện hoàn thành (ví dụ `1/2`).
- Nội dung: Tương tự tab Nhà Nông/Tân Thủ, hiển thị danh sách điều kiện (ví dụ: `- Câu 10 con cá rô: 4/10`), thanh tiến trình phần trăm màu accent, và phần thưởng (Xu, Exp...).

#### Trong `FishingPanel.tsx`:
- Ngay phía trên các thẻ thống kê (Metrics), hiển thị một thẻ:
  - Header: **🎣 Nhiệm Vụ Thợ Câu** kèm nút icon `🔄 Làm mới`.
  - Nếu chưa có dữ liệu: hiển thị nút "Tải nhiệm vụ từ NPC".
  - Nếu có dữ liệu: hiển thị Tiêu đề (ví dụ: `Nhiệm Vụ Thợ Câu 1`), danh sách từng loại cá cần câu kèm số lượng `current / total`, trạng thái `Hoàn thành` (màu xanh lá) nếu đạt.

---

## 4. Kế Hoạch Kiểm Tra (Verification Plan)

### 4.1. Kiểm thử Tĩnh & Biên Dịch
- Chạy `npm run build` trong cả `avatar-web/server` và `avatar-web/web` để xác minh không có lỗi type TypeScript.
- GitNexus: Kiểm tra `gitnexus_impact` trước khi sửa các symbol `parseQuestDialogText`, `getQuestOverview`, `refreshProgressQuests`.

### 4.2. Kiểm thử Runtime & Live Server
1. Chạy hoặc khởi động lại server dev `avatar-web`.
2. Kiểm tra API:
   - Gửi yêu cầu `POST /api/accounts/:id/quests/progress/refresh`.
   - Kiểm tra phản hồi `GET /api/accounts/:id/quests`: Xác nhận trường `fisherman` có dữ liệu hợp lệ (`kind: 'fisherman'`, `title`, `conditions`, `rewards`).
3. Kiểm tra Frontend:
   - Mở giao diện Web, chọn một tài khoản đang online.
   - Chuyển vào tab **Nhiệm vụ** $\rightarrow$ bấm tab con **"🎣 Thợ Câu"**: Kiểm tra render đúng tên nhiệm vụ, các điều kiện và phần thưởng.
   - Chuyển vào tab **Câu cá**: Kiểm tra thẻ widget **Nhiệm Vụ Thợ Câu** xuất hiện rõ ràng, hiển thị đúng tiến trình và nút làm mới hoạt động trơn tru.
