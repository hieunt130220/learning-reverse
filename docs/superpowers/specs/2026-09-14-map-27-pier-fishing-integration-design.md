# Thiết Kế: Tích Hợp Cấu Hình & Tự Động Mua Vật Phẩm Câu Cá Bến Tàu (Map 27) — Web & Bot Runtime

> **Ngày lập:** 2026-09-14  
> **Trạng thái:** Chờ User Review (Dự thảo thiết kế chi tiết)  
> **Chủ đề:** Tích hợp bộ catalog Bến Tàu (Vé câu bến tàu, Cần Lục Sĩ, Cần Chuyên Gia, Mồi cá trâm) vào hệ thống cấu hình web và bot auto-buy `avatarSession`.  
> **Nguồn bằng chứng & Tham chiếu:**  
> - Bằng chứng probe live thành công `RX -19 OPEN_SHOP` ngày 2026-09-14 (`/tmp/pier-probe/shop-catalog/evidence-1789359844251.json`):
>   - `typeShop = 11`, `nameShop = "Bến Tàu"`, `count = 4`
>   - `itemId = 4874`: Cần Câu Lục Sĩ (20.000 xu, `typeMoney = 1`)
>   - `itemId = 4879`: Cần Câu Chuyên Gia (120 Lượng, `typeMoney = 2`)
>   - `itemId = 4875`: Mồi Câu Cá Trâm (50 xu / mồi, `typeMoney = 1`)
>   - `itemId = 4876`: Vé Câu Bến Tàu (12.000 xu, `typeMoney = 1`)
> - Xác minh lệnh mua thực tế ngày 2026-09-14: `buyItemStack(4875, 1, 1)` (TX -43) tại Map 13 trừ 50 xu thành công, nhận dialog `Bạn đã mua 1 Mồi Câu Cá Trâm thành công`.
> - Code hiện tại: `automationTypes.ts`, `types.ts`, `FishingSettingsPanel.tsx`, `avatarSession.ts`.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
Trước đây, khi người dùng chọn chế độ auto câu cá tại **Map 27 (Bến tàu / Đảo Hawai)**:
1. Server game yêu cầu nhân vật phải có **Vé Câu Bến Tàu** mới cho phép bắt đầu câu (`TX45` $\rightarrow$ `RX45 iss=false` kèm thông báo `"Bạn cần vé câu cá bến tàu để câu cá khu vực này"`).
2. Khi `avatarSession.ts` phát hiện lỗi thiếu vé, nó tra cứu bảng `FISHING_TICKETS[27]`. Do lúc đó chưa xác minh được `itemId` và chỗ bán, bảng này trả về `undefined`, dẫn đến bot dừng câu với thông báo:  
   `[câu cá] Map 27 cần vé sự kiện riêng, NPC không bán — Dừng câu`.
3. Trên giao diện Web (`FishingSettingsPanel.tsx`), gợi ý vé câu của Map 27 đang hiển thị text tạm thời: `"Bến tàu cần vé sự kiện riêng, NPC không bán"`.
4. Danh mục cần câu và mồi câu trên Web và backend hiện chỉ có các loại hồ thường (Cần tre 442, Cần sắt 445, Cần VIP 446; Mồi cơm 443, Mồi trùng 447, Trứng kiến 448), thiếu các trang bị chuyên dụng cho Bến Tàu (Cần Lục Sĩ, Cần Chuyên Gia, Mồi cá trâm).

### 1.2. Mục tiêu
1. **Backend & Automation Types (`automationTypes.ts`):**
   - Bổ sung **Map 27** vào `FISHING_TICKETS` với `id: 4876`, tên `"Vé câu bến tàu"`, giá `"12.000 xu (hạn 3 ngày)"`, `typeMoney: 1`.
   - Bổ sung **Cần Câu Lục Sĩ** (`4874`, 20.000 xu, `typeMoney: 1`) và **Cần Câu Chuyên Gia** (`4879`, 120 Lượng, `typeMoney: 2`) vào `FISHING_RODS`.
   - Bổ sung **Mồi Câu Cá Trâm** (`4875`, 50 xu / mồi, `typeMoney: 1`) vào `FISHING_BAITS`.
2. **Frontend Types & UI (`types.ts`, `FishingSettingsPanel.tsx`):**
   - Đồng bộ các hằng số `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS` sang `types.ts` của client React.
   - Cập nhật hàm `getTicketHint(27)` trong `FishingSettingsPanel.tsx` để hiển thị đúng: `"Tự mua Vé câu bến tàu (12.000 xu)"`.
   - Các dropdown chọn Cần câu và Mồi câu trên Web tự động hiển thị thêm Cần Lục Sĩ, Cần Chuyên Gia (có badge cảnh báo Lượng), và Mồi cá trâm.
3. **Bot Runtime Coordinator (`avatarSession.ts`):**
   - Khi bot câu tại Map 27 bị từ chối do thiếu vé câu bến tàu (`isMissingFishingTicketDialog`), bot tự động chuyển trạng thái `buying`, di chuyển sang Map 13 (Khu sinh thái), gửi lệnh mua `Vé câu bến tàu` (`ID 4876`, 12.000 xu), rồi quay lại Map 27 tiếp tục câu mượt mà mà không dừng giữa chừng.
   - Khi cấu hình Cần câu Lục Sĩ / Chuyên Gia hoặc Mồi cá trâm, bot tự động mua đúng ID tương ứng khi thiếu đồ.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- **Dữ liệu danh mục vật phẩm:**
  - `FISHING_TICKETS`:
    - Thêm Map 27: `{ id: 4876, name: 'Vé câu bến tàu', cost: '12.000 xu (hạn 3 ngày)', typeMoney: 1 }`.
  - `FISHING_RODS`:
    - Thêm: `{ id: 4874, name: 'Cần câu Lục Sĩ', cost: '20.000 xu', typeMoney: 1 }`.
    - Thêm: `{ id: 4879, name: 'Cần câu Chuyên Gia', cost: '120 Lượng', typeMoney: 2 }`.
  - `FISHING_BAITS`:
    - Thêm: `{ id: 4875, name: 'Mồi câu cá trâm', cost: '50 xu / mồi', typeMoney: 1 }`.
- **Giao diện Web:**
  - Đồng bộ `types.ts` ở frontend.
  - Cập nhật `getTicketHint` ở `FishingSettingsPanel.tsx`.
  - Đảm bảo dropdown chọn Cần câu Chuyên Gia (120 Lượng) kích hoạt cảnh báo tiêu hao Lượng trực quan (`warning`) giống Cần sắt và Cần VIP.
- **Bot Runtime:**
  - Đảm bảo `avatarSession.ts` xử lý `missingType === 'ticket'` khi `targetMap === 27` hoàn toàn tự động theo flow đã có của Map 14, 15, 16.
  - Bảo lưu cơ chế an toàn: nếu mua 1 lần mà server vẫn từ chối (vd hết xu), bot dừng và ghi log lý do rõ ràng.

### 2.2. Out-of-Scope
- Không thay đổi thuật toán giải mini-game mũi tên ML Phase 2/3 (đã hoạt động tốt trên Map 27 với delay 20s-25s).
- Không tự động nạp Lượng nếu người dùng chọn mua Cần Chuyên Gia nhưng tài khoản không đủ Lượng.
- Không sửa đổi schema SQLite database vì cấu hình lưu dưới dạng JSON (`fishing_config_json`), chỉ mang các trường số `map`, `rodType`, `baitType`, `autoBuyTicket` đã tương thích hoàn toàn.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan & Vai Trò

| File | Đường dẫn | Vai trò |
|---|---|---|
| `automationTypes.ts` | `avatar-web/server/src/session/automationTypes.ts` | Định nghĩa backend `FISHING_TICKETS[27]`, thêm cần 4874, 4879 và mồi 4875. |
| `types.ts` | `avatar-web/web/src/types.ts` | Đồng bộ bảng hằng số `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS` cho frontend. |
| `FishingSettingsPanel.tsx` | `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx` | Cập nhật gợi ý vé câu Map 27 và render các option mới. |
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Đảm bảo log, chuỗi thông báo và kiểm tra `FISHING_TICKETS[targetMap]` vận hành trơn tru với Map 27. |

### 3.2. Chi Tiết Thay Đổi Data Contracts

#### A. Backend `automationTypes.ts`
```typescript
export const FISHING_TICKETS: Readonly<Record<number, { id: number; name: string; cost: string; typeMoney: number }>> = Object.freeze({
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
  27: { id: 4876, name: 'Vé câu bến tàu', cost: '12.000 xu (hạn 3 ngày)', typeMoney: 1 },
});

export const FISHING_RODS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 4874, name: 'Cần câu Lục Sĩ', cost: '20.000 xu', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 4879, name: 'Cần câu Chuyên Gia', cost: '120 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
]);

export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
  { id: 4875, name: 'Mồi câu cá trâm', cost: '50 xu / mồi', typeMoney: 1 },
]);
```

#### B. Frontend `FishingSettingsPanel.tsx`
Cập nhật `getTicketHint`:
```typescript
function getTicketHint(mapId: number): string {
  switch (mapId) {
    case 14:
      return 'Tự mua Vé cá rô (1.000 xu)';
    case 15:
      return 'Tự mua Vé cá lóc (10.000 xu)';
    case 16:
      return 'Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng';
    case 27:
      return 'Tự mua Vé câu bến tàu (12.000 xu)';
    default:
      return FISHING_TICKETS[mapId]
        ? `Tự mua ${FISHING_TICKETS[mapId].name}`
        : 'Bản đồ này không có vé bán tại NPC';
  }
}
```

### 3.3. Flow Xử Lý Tự Động Mua Vé Bến Tàu (`avatarSession.ts`)

```text
[Nhân vật ở Map 27 Area 0]
       │
       ▼
Gửi TX 45 (START_CAU_CA)
       │
       ▼
Server phản hồi RX 45: iss=false ("Bạn cần vé câu cá bến tàu để câu cá khu vực này")
       │
       ▼
isMissingFishingTicketDialog(errText) === true
       │
       ▼
missingType = 'ticket'
       │
       ▼
Tra cứu FISHING_TICKETS[27] -> Vé câu bến tàu (ID 4876, typeMoney=1)
       │
       ▼
Đổi status sang 'buying', ghi log:
"Đang di chuyển sang Khu sinh thái (Map 13) để mua Vé câu bến tàu…"
       │
       ▼
Di chuyển sang Map 13 Khu 0 (joinParkWithRetry)
       │
       ▼
Gửi TX -43 buyItemStack(4876, 1, 1)
       │
       ▼
Server trừ 12.000 xu (RX -3), gửi dialog thành công (RX -40)
       │
       ▼
Ghi log: "Đã mua thành công Vé câu bến tàu"
       │
       ▼
Quay lại Map 27 Khu 0 (joinParkWithRetry)
       │
       ▼
Gửi lại TX 45 (START_CAU_CA) -> Server chấp nhận (iss=true)
       │
       ▼
Bắt đầu chu trình quăng cần (TX 41) câu cá bình thường!
```

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### 4.1. Automated Verification
1. **Kiểm tra TypeScript (typecheck):**
   - Server: `npm --prefix avatar-web/server run typecheck` $\rightarrow$ đảm bảo exit code 0.
   - Frontend: `npm --prefix avatar-web/web run build` $\rightarrow$ đảm bảo bundle build thành công, không lỗi type.
2. **Kiểm tra GitNexus Impact:**
   - Chạy `gitnexus_impact` trên `FISHING_TICKETS`, `FISHING_RODS`, `FISHING_BAITS` trước khi chỉnh sửa.

### 4.2. Manual / Live Verification
1. **UI Web Verification:**
   - Mở tab Cài đặt Câu cá của tài khoản:
   - Chọn bản đồ: "Bến tàu / Đảo Hawai (Map 27)".
   - Xác nhận checkbox "Tự động mua vé": hiển thị gợi ý `"Tự mua Vé câu bến tàu (12.000 xu)"`.
   - Mở dropdown Cần câu: kiểm tra hiển thị "Cần câu Lục Sĩ (20.000 xu)" và "Cần câu Chuyên Gia (120 Lượng)".
   - Mở dropdown Mồi câu: kiểm tra hiển thị "Mồi câu cá trâm (50 xu / mồi)".
   - Bấm "Lưu cấu hình", reload trang, đảm bảo cấu hình đã lưu bền vững.
2. **Live Bot Auto-Buy Verification:**
   - Chạy bot với tài khoản test (#3) ở chế độ câu cá Map 27 khi chưa có vé bến tàu.
   - Quan sát log realtime trên web:
     1. `[câu cá] Server từ chối vì thiếu vé câu: "Bạn cần vé câu cá bến tàu để câu cá khu vực này"`
     2. `[câu cá] Đang di chuyển sang Khu sinh thái (Map 13) để mua Vé câu bến tàu…`
     3. `[câu cá] Đã mua thành công Vé câu bến tàu`
     4. `[câu cá] Vào map 27 khu 0 thành công`
     5. `[câu cá] Bắt đầu câu cá (START_CAU_CA)` $\rightarrow$ chuyển sang `casting` thành công.
