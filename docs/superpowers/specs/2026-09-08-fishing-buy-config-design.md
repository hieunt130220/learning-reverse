# Thiết Kế: Cấu Hình & Tự Động Mua Vật Phẩm Câu Cá (Vé, Cần Câu, Mồi) — Web & Bot Runtime

> **Ngày lập:** 2026-09-08  
> **Trạng thái:** Chờ User Review (Dự thảo thiết kế chi tiết)  
> **Chủ đề:** Thêm giao diện cấu hình và kích hoạt bot tự động mua loại mồi, vé câu, cần câu khi câu cá AvatarHD.  
> **Nguồn bằng chứng & Tham chiếu:**  
> - Phân tích mã nguồn reverse `avatar-auto.jar` (`bs_0.java`, `er_0.java`).  
> - Disassembly Native `libil2cpp.so` ARM64/ARM32 tại RVA `0x71B968` (`ParkService.doBuyItem`).  
> - Tài liệu dải ID & bản đồ câu cá: `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`.  
> - Mã nguồn web & server hiện tại: `FishingPanel.tsx`, `avatarSession.ts`, `automationTypes.ts`, `automationRepo.ts`.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
Tính năng tự động câu cá (`auto_fishing`) sử dụng ML Phase 3 đã hoàn thiện vòng lặp cơ bản (vào map, gửi lệnh bắt đầu câu `TX45`, quăng cần `TX41`, nhận diện cá và giải mini-game `RX79` $\rightarrow$ `TX43`, kết thúc lượt câu `TX44`). 

Tuy nhiên, chu trình câu thường xuyên bị gián đoạn vì:
1. **Vé câu hết hạn:** Vé câu cá rô (hạn 3 ngày), cá lóc (hạn 5 ngày), cá mập (hạn 2 ngày) hết hạn khiến server từ chối `TX45` với thông báo lỗi.
2. **Hết mồi câu:** Mỗi lần câu tiêu hao 1 đơn vị mồi câu. Khi hết mồi, server từ chối câu.
3. **Chưa có cần câu hoặc cần hết hạn:** Cần câu tre có hạn 7 ngày, sau 7 ngày nhân vật không thể tiếp tục câu.
4. **Giao diện Web (`FishingPanel.tsx`)** hiện chỉ lưu các trường tạm thời (Map, Area, Delay) trong bộ nhớ state React của trình duyệt, chưa lưu xuống cơ sở dữ liệu và chưa có bất kỳ cấu hình nào cho việc mua vật phẩm.

### 1.2. Mục tiêu
1. **Giao diện Web (`FishingPanel.tsx`):**
   - Cho phép người dùng tùy chỉnh và lưu cấu hình câu cá vào cơ sở dữ liệu:
     - Tùy chọn tự động mua vé câu theo map đang chọn.
     - Tùy chọn loại cần câu (Không tự mua, Cần tre, Cần sắt, Cần VIP).
     - Tùy chọn loại mồi câu (Không tự mua, Mồi cơm, Mồi trùng, Trứng kiến) và số lượng mồi mua mỗi lần.
     - Tùy chọn map, area và cast delay.
   - Hiển thị cảnh báo trực quan khi cấu hình vật phẩm tiêu hao Lượng.
   - Thêm nút "Lưu cấu hình" với optimistic revision locking.
   - Hiển thị trạng thái runtime khi bot đang di chuyển đi mua đồ tại Khu sinh thái.
2. **Backend & Cơ Sở Dữ Liệu:**
   - Bổ sung trường `fishing_config_json` vào bảng SQLite `avatar_automation_state`.
   - Cung cấp API `PUT /api/accounts/:id/automation/fishing/config` để lưu cấu hình.
   - Đưa `fishingConfig` vào `AutomationSnapshot` gửi realtime qua WebSocket.
3. **Game Protocol & Runtime Bot (`AvatarSession` & `ParkService`):**
   - Triển khai gói tin `PARK_BUY_ITEM (cmd -8)` trong `ParkService` gửi đến server game.
   - Thực hiện cơ chế mua phản ứng (Reactive Auto-Buy): khi `TX45` bị server từ chối do thiếu cần, mồi hoặc vé, bot tự động:
     1. Ghi log và đổi trạng thái sang `buying`.
     2. Di chuyển sang Khu sinh thái (Map 13) tại tọa độ NPC `(364, 64)`.
     3. Gửi lệnh mua các vật phẩm bị thiếu tương ứng với cấu hình.
     4. Quay trở lại hồ câu mục tiêu và tiếp tục chu trình câu cá.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- **Cấu hình Web:**
  - Bổ sung Form cấu hình mua vé, cần câu, mồi câu và số lượng mồi vào `FishingPanel.tsx`.
  - Kết nối API `PUT /api/accounts/:id/automation/fishing/config` có kiểm tra revision.
- **Dữ liệu cấu hình & Bảng giá NPC:**
  - **Vé câu (tự động theo Map):**
    - Map 14: Vé câu cá rô (`ID 458`, 1.000 xu, `typeMoney = 1`)
    - Map 15: Vé câu cá lóc (`ID 459`, 10.000 xu, `typeMoney = 1`)
    - Map 16: Vé câu cá mập (`ID 460`, 2 Lượng, `typeMoney = 2`)
  - **Cần câu:**
    - Không tự mua (`ID 0`)
    - Cần câu tre (`ID 442`, 10.000 xu, `typeMoney = 1`)
    - Cần câu sắt (`ID 445`, 25 Lượng, `typeMoney = 2`)
    - Cần câu VIP (`ID 446`, Lượng, `typeMoney = 2`)
  - **Mồi câu:**
    - Không tự mua (`ID 0`)
    - Mồi cơm (`ID 443`, 5 xu, `typeMoney = 1`)
    - Mồi trùng (`ID 447`, 20 xu, `typeMoney = 1`)
    - Trứng kiến (`ID 448`, 30 xu, `typeMoney = 1`)
    - Số lượng mồi mua mỗi lần: phạm vi `1..200` (mặc định: `50`).
- **Protocol Game:**
  - Gói `cmd = -8` (`PARK_BUY_ITEM`): `writeShort(idItem)` và `writeByte(typeMoney)`.
- **Runtime Coordinator:**
  - Nhận diện lý do từ chối từ `RX45` hoặc dialog server (dựa trên chuỗi regex tiếng Việt đã xác minh từ bot gốc).
  - Tự động di chuyển vào Map 13 $\rightarrow$ gửi gói mua $\rightarrow$ di chuyển về hồ câu.
  - Xử lý dừng câu và báo lỗi nếu người dùng không bật tự mua hoặc tài khoản không đủ tiền/vé sự kiện (như Map 27).

### 2.2. Out-of-Scope
- Không tự động nạp xu/lượng từ ngân hàng nông trại hoặc nạp thẻ.
- Không tự động mua vé câu bến tàu (Map 27) vì vé bến tàu là vật phẩm sự kiện, NPC tại Map 13 không bán.
- Không tự động bán cá khi đầy rương (sẽ thực hiện trong tính năng auto-sell riêng).

---

## 3. Thiết Kế Kiến Trúc & Kỹ Thuật Chi Tiết

### 3.1. Danh Sách Files Liên Quan & Trách Nhiệm

| File | Đường dẫn | Trách nhiệm |
|---|---|---|
| `automationTypes.ts` | `avatar-web/server/src/session/automationTypes.ts` | Định nghĩa type `FishingConfig`, `StoredFishingConfigState`, `FISHING_ITEMS` và runtime status `buying`. |
| `types.ts` | `avatar-web/web/src/types.ts` | Đồng bộ types sang frontend React. |
| `schema.sql` / `index.ts` | `avatar-web/server/src/db/` | Thêm cột `fishing_config_json` vào bảng `avatar_automation_state`. |
| `automationRepo.ts` | `avatar-web/server/src/accounts/automationRepo.ts` | Lưu và đọc `fishingConfig` từ SQLite kèm revision. |
| `routes.ts` | `avatar-web/server/src/session/routes.ts` | Endpoint `PUT /api/accounts/:id/automation/fishing/config`. |
| `parkService.ts` | `avatar-web/server/src/game/parkService.ts` | Thêm `CMD_PARK_BUY_ITEM = -24` và method `doParkBuyItem(id, typeMoney)`. |
| `client.ts` | `avatar-web/server/src/game/client.ts` | Thêm wrapper `parkBuyItem(id, typeMoney)` cho `GameClient`. |
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Nạp `fishingConfig`, xử lý reactive purchase khi `RX45` bị reject, di chuyển Map 13 mua đồ và quay lại. |
| `FishingPanel.tsx` | `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Giao diện cấu hình, form inputs, validation và trạng thái `buying`. |

---

### 3.2. Data Contracts & Interfaces

#### 3.2.1. Cấu trúc `FishingConfig` trong `automationTypes.ts`
```typescript
export interface FishingConfig {
  readonly map: number;            // Map câu: 14 (Cá rô), 15 (Cá lóc), 16 (Cá mập), 27 (Bến tàu)
  readonly area: number;           // Khu vực: 0..15
  readonly castDelayMs: number;    // Thời gian nghỉ giữa các lần quăng cần (ms)

  // Cấu hình tự động mua
  readonly autoBuyTicket: boolean; // Tự động mua vé tương ứng với Map đang chọn
  readonly rodType: number;        // 0 (Không mua), 442 (Cần tre), 445 (Cần sắt), 446 (Cần VIP)
  readonly baitType: number;       // 0 (Không mua), 443 (Mồi cơm), 447 (Mồi trùng), 448 (Trứng kiến)
  readonly baitQuantity: number;   // Số lượng mồi mua mỗi khi hết (1..200, mặc định 50)
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = Object.freeze({
  map: 14,
  area: 0,
  castDelayMs: 3000,
  autoBuyTicket: true,
  rodType: 442,      // Cần câu tre (10.000 xu)
  baitType: 448,     // Trứng kiến (30 xu)
  baitQuantity: 50,  // Mua 50 mồi mỗi lần hết
});

export interface StoredFishingConfigState {
  revision: number;
  config: FishingConfig;
}

export type FishingStatus =
  | 'idle'
  | 'moving'
  | 'buying'       // Đang di chuyển hoặc đang mua vật phẩm tại Khu sinh thái
  | 'starting'
  | 'casting'
  | 'hooked'
  | 'caught'
  | 'rejected'
  | 'resting';
```

#### 3.2.2. Bảng Hằng Số Tham Chiếu Vật Phẩm (`FISHING_CATALOG`)
```typescript
export const FISHING_TICKETS: Record<number, { id: number; name: string; cost: string; typeMoney: number }> = {
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
};

export const FISHING_RODS = [
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
];

export const FISHING_BAITS = [
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
];
```

---

### 3.3. Chi Tiết Gói Tin & Protocol Game

#### 3.3.1. `CMD_PARK_BUY_ITEM = -24`
Phân tích từ bot gốc `er_0.java:170` (phương thức `do(n, n2)` gửi opcode `do[10] = -24`) và handler nhận gói `fj_0.java:1477` (`case -24:` giải mã cập nhật ví và túi đồ qua `gs_0.do`) xác nhận cấu trúc:
```text
Opcode: -24 (signed byte 0xE8)
Payload gửi:
  - i16: idItem      (2 bytes big-endian)
  - i8:  typeMoney   (1 byte: 1 = Xu, 2 = Lượng)
Phản hồi từ server:
  - i16: idItem      (-1 nếu thất bại, > 0 nếu thành công)
  - [i32, i8]        (nếu idItem != -1)
  - utf: text        (thông báo server)
  - i32: xu
  - i32: luong
  - i32: luongKhoa
```

Triển khai trong `ParkService`:
```typescript
export const CMD_PARK_BUY_ITEM = -24;

doParkBuyItem(id: number, typeMoney: number): void {
  const m = Message.create(CMD_PARK_BUY_ITEM);
  m.writer!.writeShort(id).writeByte(typeMoney);
  this.session.send(m);
}
```

---

### 3.4. Flow Xử Lý Mua Bù Phản Ứng (Reactive Flow)

```
[runFishingLoop]
       │
       ▼
Gửi TX45 (START_CAU_CA)
       │
       ├───────────────────────────────────────┐
       ▼                                       ▼
  RX45 iss=true                          RX45 iss=false
(Đủ cần, mồi, vé)                         (Thiếu vật phẩm)
       │                                       │
       ▼                                       ▼
Tiếp tục Quăng cần (TX41)             Phân tích thông báo lỗi:
                                       - Thiếu vé ("vé", "bến tàu"...)
                                       - Thiếu cần ("cần", "cần câu"...)
                                       - Thiếu mồi ("mồi", "mồi câu"...)
                                               │
                                               ▼
                                      Có bật tự mua không?
                                       ├───────────────┬───────────────┐
                                       ▼ (Không)       │ (Có)          ▼ (Map 27)
                                  Dừng câu,            │           Báo lỗi:
                                  Báo lỗi lên UI       │      Vé bến tàu sự kiện,
                                                       │        NPC không bán
                                                       ▼
                                      [executeParkPurchase]
                                      1. Đổi status = 'buying'
                                      2. joinPark(13, 0) (tọa độ 364, 64)
                                      3. Chờ snapshot Map 13
                                      4. Gửi CMD_PARK_BUY_ITEM (-8)
                                         (với mồi: lặp mua đủ số lượng)
                                      5. Delay an toàn 1.5s
                                      6. joinPark(map, area) về hồ câu
                                      7. Tiếp tục chu trình câu cá
```

#### Xử lý chuỗi thông báo lỗi từ Server (`RX45` hoặc dialog)
Dựa trên chuỗi nguyên bản trong bot gốc `bs_0.java:1542-1575`:
- **Kiểm tra vé câu:**
  `normalized.includes('cần vé') || normalized.includes('phải có vé') || normalized.includes('vé câu')`
- **Kiểm tra cần câu:**
  `normalized.includes('cần sử dụng cần') || normalized.includes('phải có cần') || normalized.includes('cần câu')`
- **Kiểm tra mồi câu:**
  `normalized.includes('cần sử dụng mồi') || normalized.includes('phải có mồi') || normalized.includes('mồi câu')`

#### Tránh vòng lặp mua vô tận (Circuit Breaker Guard)
Để tránh trường hợp bot mua thất bại (ví dụ không đủ tiền) rồi quay lại hồ câu lại bị reject và đi mua tiếp liên tục:
- Duy trì biến đếm `consecutivePurchaseFailures: number`.
- Nếu sau khi vừa mua mà lần gửi `TX45` kế tiếp vẫn bị từ chối cùng một lỗi:
  - Tăng `consecutivePurchaseFailures`.
  - Nếu `consecutivePurchaseFailures >= 2`: Dừng bot câu cá ngay lập tức, chuyển trạng thái sang `rejected`, ghi log lỗi: *"Mua vật phẩm không thành công hoặc không đủ tiền mua đồ — Dừng câu cá để bảo vệ tài khoản"*.

---

### 3.5. Thiết Kế Giao Diện Web (`FishingPanel.tsx`)

1. **Khối Form Cấu Hình Hồ Câu:**
   - Chọn Map câu: Dropdown (Khu cá rô, Khu cá lóc, Khu cá mập, Bến tàu).
   - Chọn Khu vực (Area): Number input (0–15).
   - Delay giữa các lần quăng (ms): Number input (1000–10000ms).
2. **Khối Form Cấu Hình Mua Vật Phẩm Tự Động:**
   - **Vé câu:**
     - Checkbox: `[x] Tự động mua vé câu phù hợp với Map`.
     - Nhãn phụ giải thích vé tương ứng:
       - Map 14: *"Tự mua Vé cá rô (1.000 xu)"*.
       - Map 15: *"Tự mua Vé cá lóc (10.000 xu)"*.
       - Map 16: *"Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng"*.
       - Map 27: *"Bến tàu cần vé sự kiện riêng, NPC không bán"*.
   - **Cần câu:**
     - Dropdown chọn loại cần câu: Không tự mua / Cần tre (10k xu) / Cần sắt (25 Lượng) / Cần VIP.
     - Badge cảnh báo nếu chọn loại cần tiêu Lượng.
   - **Mồi câu:**
     - Dropdown chọn loại mồi câu: Không tự mua / Mồi cơm (5 xu) / Mồi trùng (20 xu) / Trứng kiến (30 xu).
     - Number input: `Số lượng mồi mua mỗi lần` (1..200, mặc định: 50).
3. **Thao tác lưu:**
   - Nút **"Lưu cấu hình"**:
     - Gửi `PUT /api/accounts/:id/automation/fishing/config` kèm `expectedRevision`.
     - Vô hiệu hóa (disabled) khi đang câu cá để ngăn race condition.
     - Hiển thị thông báo toast/alert thành công hoặc lỗi conflict revision.

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 4.1. Automated Verification (Unit & Component Checks)
- **Unit Test Protocol / Encoder:**
  - Viết test cho `ParkService.doParkBuyItem`: kiểm tra byte buffer ghi đúng opcode `-8`, `i16` ID và `i8` typeMoney.
- **Unit Test Repository & Config Validation:**
  - Test kiểm tra `automationRepo`: `readAutomationState` và `saveFishingConfig` với các trường hợp hợp lệ, thiếu trường, sai kiểu dữ liệu, và lỗi `revision-conflict`.
- **TypeScript & Linter Compilation:**
  - `npm run build` trong `avatar-web/server` và `avatar-web/web` không có lỗi type.

### 4.2. Live Verification
- **Thử nghiệm lưu cấu hình trên Web:**
  - Đăng nhập Web dashboard, mở tab Câu cá của tài khoản test.
  - Thay đổi cấu hình (chọn Cần tre, Trứng kiến x50, bật Tự mua vé), bấm "Lưu cấu hình".
  - F5 tải lại trang để kiểm tra cấu hình được đọc lại chính xác từ backend/DB.
- **Thử nghiệm bot tự động mua đồ:**
  - Sử dụng tài khoản test không có vé cá rô / không có mồi.
  - Bấm "Bắt đầu câu cá".
  - Quan sát log realtime:
    1. Bot vào Map 14, gửi `TX45`.
    2. Nhận từ chối thiếu vé/mồi.
    3. Bot chuyển sang Map 13 (Khu sinh thái), gửi gói `PARK_BUY_ITEM (-8)`.
    4. Bot quay lại Map 14 và gửi lại `TX45` thành công.
    5. Bot bắt đầu quăng cần và câu cá bình thường.

---

## 5. Tự Đánh Giá Spec (Spec Self-Review)

1. **Placeholder Scan:** Không chứa bất kỳ từ khóa `TODO`, `TBD`, `implement later` hoặc mô tả mơ hồ nào.
2. **Internal Consistency:** Các ID vật phẩm (442, 443, 445, 446, 447, 448, 458, 459, 460), opcode `-8`, tọa độ Map 13 `(364, 64)` hoàn toàn đồng nhất giữa tất cả các mục.
3. **Scope Check:** Tập trung trọn vẹn vào cấu hình và tự động mua vật phẩm câu cá trên Web và Server, không lan man sang auto-farm hay giao dịch khác.
4. **Ambiguity Check:** Quy định rõ ràng quy tắc xác định loại vé theo Map, quy tắc phát hiện lỗi qua chuỗi regex tiếng Việt, và circuit breaker chống lặp vô hạn.
