# Thiết Kế Kiến Trúc — Tích Hợp Chức Năng Khai Thác Gỗ / Đá Vào Web Auto (AvatarHD 3.4.4)

> **Ngày:** 2026-09-17  
> **Chủ đề:** `tich-hop-khai-thac-go-da-web-auto`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)  
> **Tài liệu tham chiếu:**  
> - `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`  
> - `docs/superpowers/specs/2026-09-17-probe-khai-thac-go-da-design.md`  
> - `docs/superpowers/plans/2026-09-17-probe-khai-thac-go-da.md`  

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Bối Cảnh
Sau các lượt dịch ngược mã máy native ARM64 trong `libil2cpp.so` và thực nghiệm probe trực tiếp trên server game Avatar HD 3.4.4, chúng ta đã xác minh chính xác 100% cơ chế khai thác tài nguyên:
1. **Khu Khai Thác Đá (`Room 26`):** Thực chất là mỏ **Kim Cương**, chứa 4 thực thể `ItemMapSpecial` (ID: `2000000028..2000000031`), khai thác ra **Kim Cương Trắng** với trữ lượng 3000 đơn vị/mỏ.
2. **Khu Khai Thác Gỗ (`Room 22`):** Là khu rừng gồm 10 khu vực (`Area 0..9`) chứa các thực thể **THÂN CÂY KHÔ** (ID: `2000000002..2000000027`), khai thác ra **Củi Khô** với trữ lượng 4000 đơn vị/cây. Đặc biệt tại **Khu 5** có NPC **Thợ Rèn** (ID: `2000000115`).
3. **Giao thức tương tác khai thác:**
   - Sử dụng lệnh **`TX 48 [i8 type = 3, i32 objectId, i8 menuIndex]`** (gọi từ `GlobalService.doItemSpecial`).
   - Server phản hồi hộp thoại **`RX -40`** mang chuỗi thông điệp UTF-8: tên đối tượng, tên tài nguyên thu hoạch và sản lượng còn lại/tối đa (vd: `KIM CƯƠNG Thu hoạch : Kim Cương Trắng Sản lượng : 3000/3000`).

### 1.2 Mục Tiêu Cụ Thể
Tích hợp tính năng tự động khai thác tài nguyên thành một hệ thống hoàn chỉnh trong ứng dụng `avatar-web`:
- Cho phép người dùng cấu hình mục tiêu khai thác: chỉ đào Kim Cương, chỉ chặt Củi Khô, hoặc tự động tuần tra cả 2 bản đồ.
- Tự động quét các mỏ/cây trong khu, tự động chuyển khu (`Area`) khi mỏ cạn sản lượng.
- Cơ chế bảo vệ an toàn: Dừng và cảnh báo khi thiếu/hỏng công cụ hoặc cạn kiệt năng lượng/sức khỏe.
- Hiển thị bảng điều khiển trực quan trên giao diện Web với cập nhật realtime qua WebSocket.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Data Model & DB Persistence:**
   - Mở rộng `AutomationMode` bổ sung `'auto_mining'`.
   - Bổ sung cấu hình `MiningConfig` và trạng thái `MiningRuntimeState`.
   - Lưu cấu hình vào bảng `automations` (`mining_config_json`) trong SQLite.
2. **Backend Runner (`AutoMiningRunner`):**
   - Quản lý vòng đời khai thác: Chuyển handler, join room mục tiêu, định vị và quét thực thể `ItemMapSpecial`.
   - Thực thi chuỗi gửi `TX 48`, lắng nghe `RX -40`, `RX 48`, `RX 70`.
   - Phân tích phản hồi để phát hiện hết sản lượng, thiếu cuốc hoặc hết năng lượng.
   - Quản lý cooldown ngẫu nhiên 2500ms - 3500ms chống spam/phát hiện bot.
3. **REST API & WebSocket Realtime:**
   - Endpoints lấy trạng thái, bật/tắt mode, xem và lưu cấu hình khai thác.
   - Broadcast sự kiện `mining_state_updated` xuống Web client.
4. **Frontend UI:**
   - Bổ sung Tab điều khiển **⛏️ Khai thác** (`MiningPanel.tsx`) trong `AccountOperationsDrawer`.
   - Card hiển thị trạng thái khai thác realtime: Tên mỏ, sản lượng mỏ (thanh progress bar), số lượt đã thu hoạch, vị trí map/area.
   - Form tùy chọn: Loại tài nguyên mục tiêu, khu xuất phát, tự động đổi khu.

### 2.2 Out-of-Scope
- Chưa tự động mua/sửa cuốc chim tại NPC Thợ Rèn (giai đoạn 1 ưu tiên dừng an toàn khi thiếu công cụ theo lựa chọn của người dùng).
- Chưa tự động ăn đồ ăn từ kho khi cạn năng lượng.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Files Liên Quan

| Module / File | Vai trò | Thay đổi |
| :--- | :--- | :--- |
| `avatar-web/server/src/session/automationTypes.ts` | Contracts chung | Thêm `auto_mining` vào `AutomationMode`, thêm `MiningConfig`, `MiningRuntimeState`. |
| `avatar-web/server/src/accounts/automationRepo.ts` | Lưu trữ DB | Thêm các hàm đọc/ghi `mining_config_json` trong bảng `automations`. |
| `avatar-web/server/src/mining/autoMining.ts` | Core Mining Runner | **Tạo mới:** Lớp `AutoMiningRunner` quản lý toàn bộ logic state machine khai thác. |
| `avatar-web/server/src/session/avatarSession.ts` | Session Coordinator | Gắn `AutoMiningRunner` vào vòng đời session, quản lý kích hoạt mode. |
| `avatar-web/server/src/session/routes.ts` | REST API | Thêm các routes cấu hình và điều khiển khai thác. |
| `avatar-web/server/src/ws.ts` | WebSocket Hub | Hỗ trợ broadcast sự kiện `mining_state_updated`. |
| `avatar-web/web/src/types.ts` | Frontend Type Definitions | Bổ sung types cho cấu hình và runtime state khai thác. |
| `avatar-web/web/src/accounts/panels/MiningPanel.tsx` | Giao diện UI | **Tạo mới:** Bảng điều khiển tab khai thác gỗ/đá. |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer Console | Thêm tab `mining` vào danh sách tab console. |

---

### 3.2 Data Contracts

#### A. Cấu hình Khai Thác (`MiningConfig`)
```typescript
export type MiningTarget = 'diamond' | 'wood' | 'patrol';

export interface MiningConfig {
  readonly target: MiningTarget;              // 'diamond': Room 26, 'wood': Room 22, 'patrol': cả hai
  readonly startArea: number;                 // Khu bắt đầu (0..9)
  readonly switchAreaWhenDepleted: boolean;   // Tự động chuyển khu khi mỏ cạn
  readonly maxAreasToScan: number;            // Giới hạn số khu tuần tra (mặc định 10)
  readonly delayBetweenActionsMs: number;     // Khoảng cách giữa các lượt đào (2500 - 3500ms)
}

export const DEFAULT_MINING_CONFIG: MiningConfig = Object.freeze({
  target: 'diamond',
  startArea: 0,
  switchAreaWhenDepleted: true,
  maxAreasToScan: 10,
  delayBetweenActionsMs: 3000,
});
```

#### B. Trạng thái Runtime (`MiningRuntimeState`)
```typescript
export type MiningStatus = 
  | 'idle'
  | 'navigating'        // Đang di chuyển vào map
  | 'scanning_nodes'    // Đang tìm mỏ còn sản lượng
  | 'mining'            // Đang đào/chặt
  | 'switching_area'    // Đang chuyển khu do cạn tài nguyên
  | 'paused_no_tool'    // Tạm dừng do thiếu/hỏng cuốc chim
  | 'paused_low_energy' // Tạm dừng do hết năng lượng
  | 'stopped';          // Đã dừng hoàn toàn

export interface MiningRuntimeState {
  readonly status: MiningStatus;
  readonly currentMap: number | null;         // 22 hoặc 26
  readonly currentArea: number | null;        // 0..9
  readonly currentNodeId: number | null;      // ID đối tượng đang khai thác
  readonly currentNodeName: string | null;    // "KIM CƯƠNG" hoặc "THÂN CÂY KHÔ"
  readonly resourceName: string | null;       // "Kim Cương Trắng" hoặc "Củi Khô"
  readonly remainingCapacity: number | null;  // Sản lượng còn lại
  readonly maxCapacity: number | null;        // Sản lượng tối đa (3000 hoặc 4000)
  readonly sessionHarvestCount: number;       // Số lần khai thác thành công
  readonly lastMessage: string | null;        // Thông điệp text phản hồi từ server
}
```

---

### 3.3 State Machine & Thuật Toán Điều Phối (`AutoMiningRunner`)

1. **Khởi tạo & Di chuyển:**
   - Gửi `TX -1 [9]` chuyển sang ngữ cảnh Park.
   - Xác định map mục tiêu dựa theo cấu hình:
     - `diamond` $\rightarrow$ `Room 26` (tọa độ spawn `x=250, y=45` gần mỏ 0).
     - `wood` $\rightarrow$ `Room 22` (tọa độ spawn `x=100, y=100`, ưu tiên bắt đầu từ `Area 1`).
     - `patrol` $\rightarrow$ Bắt đầu bằng `Room 26`, sau khi hết chuyển sang `Room 22`.
   - Gửi `TX 80 [roomId, area, x, y]`.
2. **Quét & Lựa chọn Mỏ:**
   - Đọc payload `RX 80` lấy danh sách các đối tượng `ItemMapSpecial`.
   - Loại trừ NPC (như Thợ Rèn type 0), chỉ chọn các đối tượng tài nguyên `type = 2` có menu `[1207, 1220]`.
3. **Thực thi Khai Thác:**
   - Gửi lệnh: **`TX 48 [i8 3, i32 objectId, i8 0]`** (chọn menu index 0 = menu 1207).
   - Đón nhận phản hồi trong 5000ms:
     - Bắt `RX -40` giải mã UTF-8:
       - Nếu chứa `"Sản lượng : X/Y"`: Cập nhật trữ lượng còn lại. Nếu $X > 0$, tiếp tục vòng lặp sau khoảng nghỉ `delayBetweenActionsMs + Jitter(0..500ms)`.
       - Nếu $X = 0$ hoặc thông báo hết quặng: Đánh dấu mỏ đã cạn, chuyển sang mỏ tiếp theo trong danh sách.
       - Nếu chứa từ khóa lỗi công cụ (`"cuốc"`, `"hỏng"`, `"cần có cuốc"`, `"rìu"`): Chuyển trạng thái `paused_no_tool`, dừng vòng lặp, gửi thông báo cảnh báo.
       - Nếu chứa từ khóa năng lượng (`"sức khỏe"`, `"năng lượng"`, `"nghỉ ngơi"`): Chuyển trạng thái `paused_low_energy`, dừng vòng lặp.
     - Lắng nghe `RX 70` (cập nhật hành trang kho đồ).
4. **Chuyển Khu (Area Hopping):**
   - Khi tất cả mỏ trong khu hiện tại đều cạn sản lượng:
     - Nếu `switchAreaWhenDepleted = true`: Tăng `area = (area + 1) % maxAreasToScan`.
     - Với Room 22: Bỏ qua Khu 0 (vì Khu 0 là sảnh nghỉ không có cây).
     - Gửi `TX 80 [roomId, newArea, x, y]`, nghỉ 2000ms và lặp lại chu trình.
5. **Dừng An Toàn (Teardown):**
   - Khi nhận lệnh dừng từ người dùng: Gửi `TX 80 [17, 0, 100, 100]` đưa nhân vật trở về Map 17 an toàn trước khi chuyển `activeMode = 'off'`.

---

### 3.4 REST API Specification

- `GET /api/accounts/:id/session/automation`
  - Bổ sung `mining`: `MiningRuntimeState` và `miningConfig`: `MiningConfig` vào response object.
- `POST /api/accounts/:id/session/automation/mode`
  - Cho phép body: `{ "mode": "auto_mining" }` để kích hoạt hoặc `{ "mode": "off" }` để dừng.
- `GET /api/accounts/:id/session/automation/mining/config`
  - Trả về cấu hình `MiningConfig` lưu trong DB.
- `PUT /api/accounts/:id/session/automation/mining/config`
  - Cập nhật các trường cấu hình của tài khoản vào DB.

---

### 3.5 Giao Diện Người Dùng (`MiningPanel.tsx`)

1. **Thanh Header Điều Khiển:**
   - Nút Switch to: Bật/Tắt Auto Khai Thác.
   - Badge trạng thái trực quan với màu sắc theo từng trạng thái (Đang đào: Xanh lá; Đang đổi khu: Vàng; Thiếu cuốc/năng lượng: Đỏ; Dừng: Xám).
2. **Thẻ Tiến Độ Khai Thác (Active Node Card):**
   - Vị trí: `Room 26 (Mỏ Đá & Kim Cương) - Khu 0` hoặc `Room 22 (Rừng Cây Ngoại Ô) - Khu 1`.
   - Mục tiêu: `KIM CƯƠNG` $\rightarrow$ Thu hoạch: `Kim Cương Trắng`.
   - Thanh Progress Bar: Hiển thị trực quan sản lượng còn lại `X / Y` (kèm % còn lại).
   - Số lần khai thác thành công: Đếm số lượt đào thành công trong phiên.
   - Hộp thoại tin nhắn cuối cùng nhận được từ server.
3. **Form Cài Đặt Khai Thác:**
   - Chọn mục tiêu: Radio/Select `💎 Kim Cương Trắng (Room 26)` | `🪵 Củi Khô (Room 22)` | `🔄 Tuần Tra Cả Hai`.
   - Checkbox: `Tự động chuyển khu khi mỏ cạn`.
   - Chọn khu vực bắt đầu: `Khu 0..9`.
   - Nút "Lưu Cài Đặt".

---

## 4. Kế Hoạch Kiểm Tra (Verification Plan)

1. **Kiểm tra Biên dịch & Typecheck:**
   ```bash
   cd avatar-web/server && npm run typecheck
   cd avatar-web/web && npm run build
   ```
2. **Kiểm tra REST API qua curl:**
   - Lưu cấu hình khai thác mới:
     ```bash
     curl -X PUT http://127.0.0.1:3000/api/accounts/3/session/automation/mining/config \
       -H "Content-Type: application/json" \
       -d '{"target":"diamond","startArea":0,"switchAreaWhenDepleted":true}'
     ```
   - Bật mode `auto_mining`:
     ```bash
     curl -X POST http://127.0.0.1:3000/api/accounts/3/session/automation/mode \
       -H "Content-Type: application/json" \
       -d '{"mode":"auto_mining"}'
     ```
3. **Kiểm tra Vận Hành Khai Thác Thực Tế:**
   - Quan sát bot tự động join Room 26 khu 0.
   - Gửi lệnh đào mỏ `2000000028`, nhận `RX -40` chứa chuỗi sản lượng.
   - Quan sát WebSocket phát sự kiện `mining_state_updated` lên giao diện Web.
   - Thử nghiệm tắt bot: Bot dừng vòng lặp và quay về Map 17 an toàn.
