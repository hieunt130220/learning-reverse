# Thiết Kế Tích Hợp Tự Động Câu Cá Vào Web (Auto Fishing Web Integration Design)

> **Ngày lập:** 2026-09-08  
> **Trạng thái:** Chờ User Review  
> **Tài liệu liên quan:**
> - `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`
> - `docs/superpowers/specs/2026-09-07-fishing-phase-3-production-automation-design.md`
> - `avatar-re/notes/fishing.md`
> - `avatar-web/server/src/session/avatarSession.ts`

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Bối cảnh
- **Giai đoạn trước (Phase 3)**: Đã hoàn thiện toàn bộ core engine giải mini-game câu cá tự động (ML Inference Client, fail-closed `autoDecision`, mã hóa `TX 43` thành công). Khi có sự kiện `RX 79` (cá cắn câu), server đã tự giải và gửi `TX 43` chính xác.
- **Vấn đề hiện tại**: Hệ thống chạy nền (`AvatarSession`) hiện chỉ có 2 chế độ tự động: `auto_farm` (chăm sóc nông trại) và `find_npc` (tìm NPC). Nhân vật không tự di chuyển đến khu vực câu cá, không quăng cần, dẫn tới server game không bao giờ phát `RX 79` (cá cắn câu).
- **Giao diện Web (`avatar-web/web`)**: Chưa có tab hoặc nút điều khiển chuyên biệt cho việc câu cá, chưa hiển thị trạng thái và thống kê câu cá cho người dùng.

### 1.2. Mục tiêu
1. Mở rộng chế độ tự động của tài khoản với mode mới: `auto_fishing` (Tự động câu cá).
2. Xây dựng **Vòng lặp câu cá tự động (Fishing Runner Loop)** trong `AvatarSession` với map mặc định là **Khu cá rô (Map ID 14)**.
3. Bổ sung giao diện trực quan trên Web (Tab "Câu cá" trong Drawer quản lý tài khoản): cho phép Bật/Tắt, chọn Map (mặc định ID 14), chọn Khu vực (Area), chỉnh delay giữa các lần quăng cần, xem trạng thái theo thời gian thực và lịch sử cá câu được.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope (Trong phạm vi)
1. **Frontend (`avatar-web/web`)**:
   - Thêm tab `[ 'fishing', 'Câu cá' ]` vào `AccountOperationsDrawer`.
   - Cung cấp form cấu hình câu cá:
     - Map câu cá (mặc định: `Map 14 - Khu cá rô`; hỗ trợ thêm Map 15, 16, 27).
     - Khu vực (Area): mặc định `0` (hoặc số bất kỳ từ 0–15).
     - Delay giữa 2 lần quăng cần: mặc định `3000ms` (3 giây).
   - Nút bật/tắt chế độ `auto_fishing`.
   - Dashboard trạng thái: hiển thị trạng thái hiện tại (Đang vào map / Đang câu / Cá cắn câu / Đã bắt được cá / Tạm dừng), số lượng cá câu thành công, loài cá gần nhất.
2. **Backend Protocol & Client (`avatar-web/server`)**:
   - Mở rộng `ParkService`:
     - `doStartFishing()`: Gửi opcode `TX 45` (bắt đầu câu).
     - `doQuanCau()`: Gửi opcode `TX 41` (quăng cần).
     - `doCauCaXong()`: Gửi opcode `TX 44` (kết thúc vòng câu, reset state server).
   - `GameClient`:
     - Bắt `RX 45` (`START_CAU_CA`): phân tích `iss: boolean` và `error?: string` (ví dụ thiếu vé, thiếu cần).
     - Bắt `RX 41` (`QUANG_CAU`): phát sự kiện xác nhận quăng cần thành công.
     - Bắt `RX 43` (`CAU_THANH_CONG`): lấy `idFish` và phát sự kiện bắt cá thành công.
     - Bắt `RX 44` (`CAU_CA_XONG`): phát sự kiện đóng vòng câu.
3. **Backend Runner (`AvatarSession`)**:
   - Thêm `desiredMode: 'auto_fishing'` vào `AutomationMode`.
   - Chu trình vòng lặp câu cá:
     - Bước 1: Vào ngữ cảnh Park (`GlobalService.getHandler(9)`).
     - Bước 2: Join vào Map câu (`ParkService.doJoinPark(mapId, areaId)`).
     - Bước 3: Gửi `TX 45 (doStartFishing)` ➜ Chờ `RX 45`. Nếu bị từ chối (ví dụ thiếu vé/cần), ghi log và tạm dừng chu kỳ.
     - Bước 4: Gửi `TX 41 (doQuanCau)` để quăng cần ➜ Chờ `RX 79`.
     - Bước 5: Khi nhận `RX 79`, bộ giải Phase 3 tự động suy luận ML và gửi `TX 43`.
     - Bước 6: Nhận `RX 43` (thông tin cá bắt được) ➜ Ghi log ➜ Gửi `TX 44 (doCauCaXong)`.
     - Bước 7: Chờ khoảng nghỉ (delay: 3s) rồi lặp lại từ Bước 3.
   - Quản lý vòng đời: Dừng ngay khi user tắt (`desiredMode = 'off'`) hoặc chuyển sang `auto_farm`.

### 2.2. Out-of-Scope (Chưa thực hiện trong giai đoạn này)
1. Tự động mua vé, cần câu, mồi câu từ NPC (người dùng tự chuẩn bị sẵn vé và cần câu trong hòm đồ).
2. Tự động bán cá vào sạp hoặc NPC.
3. Huấn luyện lại model ML hay thay đổi cấu trúc matcher Phase 2.

---

## 3. Thiết Kế Chi Tiết & Luồng Xử Lý (Detailed Architecture & Flow)

### 3.1. Luồng Giao Thức (Sequence Diagram)

```text
[Web UI]              [AvatarSession]            [GameClient / Park]          [Avatar Server]
   |                        |                             |                          |
   |-- Bật Auto Fishing --->|                             |                          |
   |   (Map 14, Area 0)     |                             |                          |
   |                        |-- enterParkContext() ------>|-- GET_HANDLER(-1, 9) --->|
   |                        |                             |<-- ACK (-1, 9) ----------|
   |                        |-- doJoinPark(14, 0) ------->|-- CMD 80 (Join 14,0) --->|
   |                        |                             |<-- RX 80 ----------------|
   |                        |                             |                          |
   |                        |====== FISHING LOOP BEGIN ==============================|
   |                        |-- doStartFishing() -------->|-- TX 45 ---------------->|
   |                        |                             |<-- RX 45 (iss=true) -----|
   |                        |-- doQuanCau() ------------->|-- TX 41 ---------------->|
   |                        |                             |<-- RX 41 (idUser) -------|
   |                        |                             |                          |
   |                        |                             |<-- RX 79 (Cá cắn câu) ---|
   |                        |<-- event: fishing-challenge-|                          |
   |                        |-- makeAutoDecision(ML) ---->|                          |
   |                        |-- finishFishing(answers) -->|-- TX 43 (answers) ------>|
   |                        |                             |<-- RX 43 (idUser, idFish)|
   |<-- Log: Bắt được cá -- |<-- event: fishing-success --|                          |
   |                        |-- doCauCaXong() ----------->|-- TX 44 ---------------->|
   |                        |                             |<-- RX 44 (idUser) -------|
   |                        |-- Chờ delay (3000ms) -------|                          |
   |                        |====== FISHING LOOP REPEAT =============================|
```

### 3.2. Data Contracts & Interfaces

#### A. Cấu hình Fishing Config
```ts
export interface FishingConfig {
  map: number;       // Mặc định: 14 (Khu cá rô)
  area: number;      // Mặc định: 0
  castDelayMs: number; // Mặc định: 3000ms
}
```

#### B. Mở rộng `AutomationMode`
```ts
export type AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing';
```

#### C. Runtime Snapshot (`FishingRuntimeState`)
```ts
export interface FishingRuntimeState {
  status: 'idle' | 'moving' | 'starting' | 'casting' | 'hooked' | 'caught' | 'rejected' | 'resting';
  totalCatches: number;
  lastFishId: number | null;
  lastError: string | null;
  currentMap: number;
  currentArea: number;
}
```

---

## 4. Danh Sách Files Liên Quan (File Modifications)

| File | Vai trò | Thay đổi |
| :--- | :--- | :--- |
| `avatar-web/server/src/game/parkService.ts` | Giao thức Park | Bổ sung `doStartFishing()`, `doQuanCau()`, `doCauCaXong()`, bổ sung tọa độ map 15, 16, 27 vào `NATIVE_PARK_JOIN_POSITIONS`. |
| `avatar-web/server/src/game/client.ts` | GameClient dispatch | Bắt `RX 45`, `RX 41`, `RX 43`, `RX 44` và emit các event tương ứng. |
| `avatar-web/server/src/session/automationTypes.ts` | Type định nghĩa mode | Thêm `'auto_fishing'` vào `AutomationMode`. |
| `avatar-web/server/src/session/avatarSession.ts` | Trình điều phối phiên | Cài đặt vòng lặp `runFishingCycle()` và xử lý chuyển mode `auto_fishing`. |
| `avatar-web/server/src/accounts/automationRepo.ts` | Lưu trữ cấu hình | Hỗ trợ lưu `desired_mode = 'auto_fishing'` và config câu cá vào SQLite. |
| `avatar-web/web/src/types.ts` | Type cho Frontend | Khai báo `'auto_fishing'`, `FishingConfig`, `FishingRuntimeState`. |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer tài khoản | Thêm tab `['fishing', 'Câu cá']`. |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | UI Panel câu cá | Giao diện điều khiển câu cá: nút bật/tắt, chọn map (14 mặc định), area, delay, live metrics. |

---

## 5. Xử Lý Các Trường Hợp Biên (Edge Cases & Safety Guards)

1. **Bị Server từ chối câu (`RX 45 iss=false`)**:
   - *Nguyên nhân*: Hết vé câu, chưa trang bị cần câu, hoặc hết mồi.
   - *Xử lý*: Ghi log lỗi rõ ràng (ví dụ: `"Server từ chối câu: Bạn cần vé câu cá rô"`), chuyển trạng thái sang `rejected`, tạm dừng 10s trước khi thử lại hoặc gửi thông báo dừng để tránh spam gói tin gây khoá tài khoản.
2. **Mất kết nối giữa chu kỳ câu**:
   - Khi socket ngắt, `AvatarSession` huỷ bỏ toàn bộ timeout và promise đang chờ. Khi tự động kết nối lại (reconnect), nếu `desiredMode === 'auto_fishing'`, phiên sẽ tự động di chuyển lại vào Map 14 và tiếp tục vòng lặp.
3. **Người dùng bấm Dừng (Stop / Mode Off)**:
   - Ngắt ngay lập tức vòng lặp câu, gửi `TX 44` dọn dẹp nếu đang dở dang và giải phóng tài nguyên.

---

## 6. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

1. **TypeScript Typecheck**:
   - Chạy `npm run typecheck` trên cả `avatar-web/server` và `avatar-web/web` đảm bảo 0 lỗi kiểu dữ liệu.
2. **Kiểm tra End-to-End thực tế**:
   - Mở giao diện Web tại `http://localhost:5173`, chọn tài khoản thử nghiệm.
   - Chuyển sang tab **"Câu cá"**, kiểm tra giá trị mặc định là **Khu cá rô (Map 14)**, Khu vực **0**.
   - Bấm **"Bắt đầu câu cá"**:
     - Kiểm tra log trên Web ghi nhận: Đang chuyển vào Map 14 ➜ Đã vào Map 14 ➜ Bắt đầu câu ➜ Quăng cần.
     - Khi cá cắn câu: Kiểm tra ML giải mini-game trong <50ms ➜ Gửi TX 43 ➜ Nhận thông tin cá bắt được (`idFish`) ➜ Đóng vòng và nghỉ giữa vòng.
   - Bấm **"Dừng câu cá"**: Xác nhận vòng lặp kết thúc ngay lập tức.
