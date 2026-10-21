# Thiết Kế: Thống Kê Tài Chính Câu Cá (Tích Luỹ) & Nút Bán Cá

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Bối cảnh
Hệ thống bot câu cá tự động (`avatar-web`) đã hỗ trợ quy trình khép kín: di chuyển vào hồ, tự mua vé, tự mua cần, tự mua mồi, câu cá (sử dụng mô hình ML), và tự bán cá (`banca`) khi rương đầy.
Hiện tại, giao diện tab **Câu Cá** (`FishingPanel.tsx`) mới chỉ thống kê về mặt số lượng sản lượng:
- Tổng số cá bắt được hôm nay.
- Cơ cấu cá theo từng loài trong ngày.
- Tỉ lệ giải captcha/mini-game của mô hình ML.

### 1.2. Vấn đề cần giải quyết
1. **Thiếu thống kê tài chính**: Người dùng không biết mình đã chi bao nhiêu tiền Xu cho việc mua mồi, mua vé hồ câu, mua cần câu, và đã thu về bao nhiêu tiền Xu từ việc bán cá. Không rõ việc câu cá đang có lãi hay lỗ (Net Profit / PnL).
2. **Thiếu nút bán cá chủ động**: Hiện tại bot chỉ bán cá tự động khi rương đầy trong vòng lặp câu cá. Người dùng muốn có một nút bấm trên web để bán toàn bộ cá trong rương ngay lập tức mà không cần chờ rương bị đầy hoặc không cần phải bật auto câu cá.
3. **Yêu cầu lưu trữ**: Dữ liệu tài chính cần được **lưu tích luỹ** (accumulated) bền vững trong cơ sở dữ liệu qua các phiên chạy, kèm khả năng đặt lại (reset) khi người dùng muốn bắt đầu kỳ theo dõi mới.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- **Thống kê chi phí mua vật phẩm câu cá (tính bằng Xu)**:
  - Tiền mua mồi (`spentBaitXu`): cộng dồn mỗi khi bot mua mồi thành công (Mồi cơm 5 xu, Mồi trùng 20 xu, Trứng kiến 30 xu, Mồi cá trâm 50 xu).
  - Tiền mua vé (`spentTicketXu`): cộng dồn mỗi khi bot mua vé thành công (Vé cá rô 1.000 xu, Vé cá lóc 10.000 xu, Vé bến tàu 12.000 xu).
  - Tiền mua cần (`spentRodXu`): cộng dồn mỗi khi bot mua cần thành công bằng xu (Cần tre 10.000 xu, Cần Lục Sĩ 20.000 xu).
- **Thống kê doanh thu bán cá (tính bằng Xu)**:
  - Tiền bán cá (`earnedFishXu`): cộng dồn số Xu nhận được khi bán cá (cả khi auto bán lúc rương đầy lẫn khi bấm nút bán thủ công).
- **Tính toán Lợi nhuận ròng (Net Profit / PnL)**:
  - `Net Profit = earnedFishXu - (spentBaitXu + spentTicketXu + spentRodXu)`.
- **Nút Bán tất cả cá**:
  - Nút bấm trực quan trên UI tab Câu cá.
  - Gửi yêu cầu bán toàn bộ cá trong rương thông qua lệnh `banca`.
  - Hiển thị kết quả bán (số lượt bán thành công, số Xu kiếm được).
- **Lưu trữ tích luỹ trong SQLite**:
  - Bảng mới `avatar_fishing_financial_statistics`.
  - Hỗ trợ API reset toàn bộ số liệu tài chính về 0.
- **Thời gian thực (Real-time updates)**:
  - Đưa dữ liệu tài chính vào `AutomationSnapshot` để UI tự động cập nhật qua WebSocket.

### 2.2. Out-of-Scope
- Vật phẩm mua bằng **Lượng** (Vé cá mập 2 Lượng, Cần sắt 25 Lượng, Cần Chuyên Gia 120 Lượng): do không phải đơn vị Xu chính thống trong tính toán lãi/lỗ thông thường, tạm thời chỉ ghi log, không cộng gộp vào trường Xu (hoặc chỉ thống kê riêng nếu mở rộng sau này).
- Tùy chọn lọc giữ lại từng con cá cụ thể khi bán: người dùng đã chốt bán toàn bộ cá trong rương.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh sách Module & File liên quan

| Module / File | Vai trò |
| --- | --- |
| `avatar-web/server/src/db/schema.sql` | Thêm bảng `avatar_fishing_financial_statistics` |
| `avatar-web/server/src/session/automationTypes.ts` | Khai báo kiểu `FishingFinancialStatistics`, mở rộng `AutomationSnapshot` |
| `avatar-web/server/src/accounts/fishingFinancialStatisticsRepo.ts` | Repository quản lý đọc, ghi tích luỹ chi phí/doanh thu và reset số liệu |
| `avatar-web/server/src/session/avatarSession.ts` | Tích hợp ghi nhận chi phí mua mồi/vé/cần, cập nhật doanh thu bán cá, thêm hàm `sellAllFish()` |
| `avatar-web/server/src/session/routes.ts` | Thêm route `POST /:id/fishing/sell` và `POST /:id/fishing/finance/reset` |
| `avatar-web/web/src/types.ts` | Cập nhật TypeScript types ở client |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Cập nhật UI theo **Phương án A**: Thẻ Tài Chính Câu Cá, 4 ô chỉ số, Lợi nhuận ròng, nút Bán cá, nút Reset |
| `avatar-web/web/src/styles/components.css` | Bổ sung styling cho thẻ tài chính và các badge lãi/lỗ |

---

### 3.2. Data Contracts & Database Schema

#### Bảng SQLite: `avatar_fishing_financial_statistics`
```sql
CREATE TABLE IF NOT EXISTS avatar_fishing_financial_statistics (
  account_id INTEGER PRIMARY KEY REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  spent_bait_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_bait_xu >= 0),
  spent_ticket_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_ticket_xu >= 0),
  spent_rod_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_rod_xu >= 0),
  earned_fish_xu INTEGER NOT NULL DEFAULT 0 CHECK (earned_fish_xu >= 0),
  updated_at INTEGER NOT NULL
);
```

#### TypeScript Types: `FishingFinancialStatistics`
```ts
export interface FishingFinancialStatistics {
  spentBaitXu: number;
  spentTicketXu: number;
  spentRodXu: number;
  earnedFishXu: number;
  netProfitXu: number; // = earnedFishXu - (spentBaitXu + spentTicketXu + spentRodXu)
  updatedAt: number | null;
}
```

Được nhúng vào `AutomationSnapshot`:
```ts
export interface AutomationSnapshot {
  // ... existing fields ...
  fishingFinancialStatistics?: FishingFinancialStatistics;
}
```

---

### 3.3. Luồng Xử Lý (Flows)

#### Flow 1: Ghi nhận Chi phí Mua Vật phẩm
1. Khi bot thực hiện mua vé thành công (`client.buyItemStack` vé):
   - Lấy giá vé theo map (`FISHING_TICKETS[map]`). Nếu mua bằng Xu (`typeMoney === 1`), gọi:
     `financeRepo.recordExpense(accountId, 'ticket', costXu)`.
2. Khi bot thực hiện mua cần câu thành công (`client.buyItem` cần):
   - Lấy giá cần theo cấu hình (`FISHING_RODS`). Nếu mua bằng Xu (`typeMoney === 1`), gọi:
     `financeRepo.recordExpense(accountId, 'rod', costXu)`.
3. Khi bot thực hiện mua mồi thành công (`client.buyItemStack` mồi):
   - Lấy đơn giá mồi (`FISHING_BAITS`). Tính tổng chi phí = `unitCost * quantity`. Gọi:
     `financeRepo.recordExpense(accountId, 'bait', totalCostXu)`.
4. Sau mỗi lần ghi, cập nhật snapshot và broadcast qua WebSocket để web hiển thị ngay lập tức.

#### Flow 2: Nút "Bán tất cả cá ngay" (`POST /:id/fishing/sell`)
1. User nhấn nút "🐟 Bán tất cả cá ngay" trên tab Câu Cá.
2. Web gửi request `POST /api/accounts/:id/fishing/sell`.
3. Server kiểm tra session tài khoản:
   - Nếu tài khoản không online: trả về HTTP 400 kèm thông báo `"Tài khoản cần kết nối game để bán cá"`.
   - Nếu đang thực hiện bán cá dở dang: trả về HTTP 409 `"Đang trong tiến trình bán cá"`.
4. Session thực thi hàm `sellAllFish(signal)`:
   - Nếu đang câu cá (trạng thái casting/hooked), gọi `client.cauCaXong()` để thu cần và dừng vòng câu an toàn.
   - Nếu nhân vật đang không ở map công viên/hồ câu (Map 13, 14, 15, 16, 27), tự động chuyển vào Khu sinh thái (Map 13) để lệnh `banca` có hiệu lực.
   - Lặp gửi chat `banca` và đợi phản hồi (`park-chat`, `dialog`, `metrics` xu tăng) tối đa 40 lượt hoặc đến khi hết cá.
   - Đếm số lượt bán thành công và tổng số xu thu được (`totalXuEarned`).
   - Ghi nhận doanh thu vào cơ sở dữ liệu:
     `financeRepo.recordRevenue(accountId, totalXuEarned)`.
   - Cập nhật snapshot automation và log phiên.
5. Server trả về `{ ok: true, soldCount, earnedXu, message }`.

#### Flow 3: Đặt lại thống kê (`POST /:id/fishing/finance/reset`)
1. User nhấn nút "↺ Reset" trên UI -> Xác nhận qua hộp thoại confirm.
2. Web gửi request `POST /api/accounts/:id/fishing/finance/reset`.
3. Server gọi `financeRepo.reset(accountId)`.
4. Cập nhật `AutomationSnapshot` và trả về kết quả mới.

---

### 3.4. Bảng Tra Cứu Giá Vật Phẩm (Lookup Catalog)

Dựa trên dữ liệu game AvatarHD đã kiểm chứng:
```ts
export const FISHING_TICKET_PRICES_XU: Record<number, number> = {
  14: 1000,   // Vé hồ cá rô
  15: 10000,  // Vé hồ cá lóc
  27: 12000,  // Vé bến tàu
};

export const FISHING_ROD_PRICES_XU: Record<number, number> = {
  442: 10000,  // Cần câu tre
  4874: 20000, // Cần câu Lục Sĩ
};

export const FISHING_BAIT_PRICES_XU: Record<number, number> = {
  443: 5,   // Mồi cơm
  447: 20,  // Mồi trùng
  448: 30,  // Trứng kiến
  4875: 50, // Mồi câu cá trâm
};
```
*Lưu ý an toàn*: Khi có thể đo được biến động `client.money` chính xác trước và sau khi mua/bán, ưu tiên sử dụng delta Xu thực tế từ server; nếu server lag không kịp gửi gói metrics thì fallback về giá niêm yết trong bảng catalog.

---

### 3.5. Giao Diện Người Dùng (UI Layout - Phương án A)

Trong `FishingPanel.tsx`, bổ sung một thẻ Card tài chính độc lập:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 💰 THỐNG KÊ TÀI CHÍNH CÂU CÁ (TÍCH LUỸ)     [🐟 Bán tất cả cá] [↺ Reset]│
├────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ │   MUA MỒI    │ │    MUA VÉ    │ │   MUA CẦN    │ │   TIỀN BÁN CÁ   │ │
│ │  -35.000 xu  │ │  -24.000 xu  │ │  -20.000 xu  │ │  +168.000 xu   │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Lợi nhuận ròng (Lãi / Lỗ): +89.000 xu       Tích luỹ qua các phiên │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### 4.1. Automated Tests
1. **Unit Test Repository (`fishingFinancialStatisticsRepo.test.ts`)**:
   - Khởi tạo mặc định trả về toàn bộ 0.
   - Test `recordExpense` cho từng loại `bait`, `ticket`, `rod` (cộng dồn chính xác, tính đúng `netProfitXu`).
   - Test `recordRevenue` khi bán cá (cộng dồn chính xác).
   - Test `reset` đưa tất cả về 0.
   - Xử lý safe integer và validation đầu vào.
2. **API Route Tests (`routes.test.ts`)**:
   - `POST /api/accounts/:id/fishing/sell` khi offline -> 400.
   - `POST /api/accounts/:id/fishing/finance/reset` -> 200, snapshot cập nhật.
3. **UI Component Tests (`FishingPanel.test.tsx`)**:
   - Render đúng các thẻ chỉ số tiền mồi, vé, cần, bán cá và lợi nhuận ròng.
   - Render nút bán cá, kiểm tra trigger gọi API và trạng thái loading khi bán.
   - Render nút reset và xác nhận.

### 4.2. Manual Verification
1. Chạy `npm run build` trên cả `server` và `web` đảm bảo không có lỗi TypeScript.
2. Khởi chạy server và kiểm tra giao diện web tab Câu Cá:
   - Thẻ Tài chính hiển thị đầy đủ, layout responsive trên cả mobile và desktop.
   - Bấm nút "Bán tất cả cá": kiểm tra log hiển thị tiến trình bán cá, thông báo kết quả.
   - Thử mua mồi/vé/cần hoặc bán cá: chỉ số tự động nhảy số theo thời gian thực mà không cần F5 trang.
