# Thiết Kế Sửa Lỗi Tự Mua Thêm Vé Câu Cá Khi Trong Rương Đã Có Vé (AvatarHD)

> **Ngày lập:** 2026-09-12  
> **Trạng thái:** Chờ User duyệt (Review Gate)  
> **Tác giả:** Claude Fable 5 & Devios  
> **Topic:** Khắc phục lỗi nhận diện sai thông báo dẫn đến việc tự động mua thừa vé câu cá dù trong rương nhân vật đã có vé hợp lệ  

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Vấn đề cần giải quyết
Trong quá trình vận hành tự động câu cá (`auto_fishing`), người dùng ghi nhận hiện tượng:
**Trong rương nhân vật đã có sẵn vé câu cá (ví dụ Vé câu cá rô còn hạn sử dụng) nhưng bot vẫn di chuyển sang Map 13 để mua thêm vé câu mới.**

Hậu quả:
1. Lãng phí tiền tệ trong game (1.000 xu cho vé cá rô, 10.000 xu cho vé cá lóc, 2 Lượng cho vé cá mập).
2. Tốn nhiều slot rương đồ nếu mua nhiều vé.
3. Làm gián đoạn chu trình câu cá liên tục do bot phải rời hồ câu về Map 13 rồi quay lại hồ câu.

### 1.2. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

Sau khi điều tra mã nguồn hiện tại kết hợp đối chiếu với mã nguồn gốc của bot Java (`bs_0.java`, `fj_0.java`) và native disassembly `libil2cpp.so` của AvatarHD:

1. **Khớp từ khóa quá lỏng lẻo (`includes('vé')`) gây Dương Tính Giả (False Positive):**
   - Tại `avatar-web/server/src/session/avatarSession.ts` (cả ở dòng 2980 trong `startFishingSession` và dòng 3235 trong `runFishingLoop`), logic kiểm tra lỗi hiện tại là:
     ```typescript
     if (errText.includes('vé') || errText.includes('bến tàu')) {
       missingType = 'ticket';
     }
     ```
   - Trong game Avatar, từ `"vé"` xuất hiện trong rất nhiều ngữ cảnh không liên quan đến việc thiếu vé câu cá:
     - Hộp thoại nhận thưởng sự kiện / quay số / minigame: *"Bạn nhận được vé quay số may mắn"*, *"Vé sự kiện"*, *"Vé đổi quà"*, *"Vé xem phim"*,...
     - Các thông báo hệ thống / kênh thế giới có chữ "vé".
   - Khi một hộp thoại chứa từ `"vé"` được server gửi về trong lúc câu cá mà không khớp các pattern của `isRewardDialog`, hàm `onDialog` (hoặc `onCastDialog`) thu nhận nó như một lỗi từ chối, `errText.includes('vé')` trả về `true` $\rightarrow$ bot đánh dấu `missingType = 'ticket'` và kích hoạt chu trình đi mua vé mới ngay lập tức.

2. **Kích hoạt mua vé ngay trong vòng lặp quăng cần (`runFishingLoop`):**
   - Tại dòng 3234–3262 của `avatarSession.ts`, hàm `onCastDialog` lắng nghe phản hồi của server sau lệnh quăng cần (`TX 41 quanCau`).
   - Khi nhân vật đã vượt qua `startFishingSession` (đã gửi `TX 45` và server trả về `RX 45 iss=true`), điều đó chứng minh nhân vật **đã có vé câu hợp lệ**. Vé câu cá trong Avatar có hạn dùng 2–5 ngày, không bị tiêu hao hay mất đi sau từng lượt quăng cần.
   - Việc đặt nhánh `castMissingType = 'ticket'` ngay trong vòng lặp quăng cần khiến bất kỳ thông báo nào từ server có chứa chữ `"vé"` đều có thể kích hoạt hành động rời hồ câu để mua vé thừa.

3. **Mã nguồn bot Avatar gốc (`bs_0.java`) kiểm tra cụm từ chính xác:**
   - Đối chiếu với bot `avatar-auto.jar` tại dòng 200 của `bs_0.java`:
     ```java
     if (!bs_0.for(string.indexOf("cần vé câu"), if[0]) || bs_0.if(string.indexOf("phải có vé"), if[0])) {
         // Chỉ kích hoạt mua vé khi có cụm từ "cần vé câu" hoặc "phải có vé"
         this.for = if[11]; // Chuyển sang trạng thái mua vé
     }
     ```
   - Server AvatarHD khi thực sự từ chối vì thiếu vé sẽ gửi chuỗi có cấu trúc:
     - `"Bạn cần vé câu cá rô để câu cá khu vực này"`
     - `"Bạn cần vé câu cá lóc để câu cá khu vực này"`
     - `"Bạn cần vé câu cá mập để câu cá khu vực này"`
     - `"Bạn cần vé câu cá bến tàu để câu cá khu vực này"`
     - Hoặc chuỗi chứa `"cần vé câu"`, `"phải có vé"`.

---

## 2. Phạm Vi Thay Đổi (Scope)

### 2.1. In-Scope
1. **Xây dựng helper kiểm tra thiếu vé câu chuẩn xác (`isMissingFishingTicketDialog`):**
   - Định nghĩa hàm helper kiểm tra thông báo từ chối thiếu vé câu cá dựa trên cụm từ chính xác (`"cần vé câu"`, `"phải có vé"`, `"vé câu cá"`, `"cần vé câu cá"`), loại bỏ hoàn toàn việc match từ `"vé"` đơn độc.
2. **Refactor logic phân loại lỗi trong `startFishingSession`:**
   - Thay thế `errText.includes('vé') || errText.includes('bến tàu')` bằng helper `isMissingFishingTicketDialog`.
   - Ghi log chi tiết lý do từ chối từ server trước khi tiến hành đi mua vé để người dùng dễ theo dõi.
3. **Loại bỏ nhánh tự mua vé trong vòng lặp quăng cần (`runFishingLoop`):**
   - Trong `runFishingLoop`, khi `catchResult` là chuỗi dialog lỗi, chỉ xử lý:
     - Hết mồi câu (`bait`): di chuyển mua mồi.
     - Cần câu hỏng/thiếu cần (`rod`): di chuyển mua cần nếu cấu hình cho phép.
     - Rương cá đầy: tự động chat `banca` bán cá.
   - Không kích hoạt mua vé trong `runFishingLoop`. Nếu vé hết hạn giữa chừng, lượt quăng cần thất bại, bot sẽ gọi lại `startFishingSession` ở chu kỳ sau và `startFishingSession` sẽ xử lý việc mua vé đúng chuẩn handshake.

### 2.2. Out-of-Scope
- Không can thiệp vào cấu trúc lưu trữ `FISHING_TICKETS` hay opcode `buyItemStack (-43)`.
- Không can thiệp vào máy giải ML captcha câu cá hay luồng quăng cần / giật cần.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Thay Đổi

| File | Vị trí | Vai trò & Thay đổi |
|---|---|---|
| `avatar-web/server/src/game/client.ts` | Thêm helper | Xuất hàm `isMissingFishingTicketDialog(text: string): boolean` |
| `avatar-web/server/src/session/avatarSession.ts` | `startFishingSession` (~dòng 2980) | Sử dụng `isMissingFishingTicketDialog` thay cho `includes('vé')` |
| `avatar-web/server/src/session/avatarSession.ts` | `runFishingLoop` (~dòng 3235) | Loại bỏ `castMissingType = 'ticket'`, chuyển sang delegate cho `startFishingSession` |

### 3.2. Chi Tiết Cụ Thể

#### 1. Helper `isMissingFishingTicketDialog` trong `client.ts`
```typescript
/**
 * Kiểm tra xem một dialog từ chối từ server có phải do nhân vật thiếu vé câu cá hay không.
 * Cần kiểm tra cụm từ chính xác để tránh bắt nhầm các dialog nhận thưởng vé sự kiện, vé quay số, vé số...
 */
export function isMissingFishingTicketDialog(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  // Server AvatarHD thường trả về:
  // "Bạn cần vé câu cá rô để câu cá khu vực này"
  // "Bạn cần vé câu cá lóc để câu cá khu vực này"
  // "Bạn cần vé câu cá bến tàu để câu cá khu vực này"
  // Hoặc các biến thể bot jar: "cần vé câu", "phải có vé"
  if (
    normalized.includes('cần vé câu')
    || normalized.includes('phải có vé')
    || normalized.includes('vé câu cá')
    || (normalized.includes('vé') && normalized.includes('khu vực này'))
    || (normalized.includes('vé') && normalized.includes('bến tàu'))
  ) {
    return true;
  }
  return false;
}
```

#### 2. Cập nhật `startFishingSession` trong `avatarSession.ts`
```typescript
let missingType: 'ticket' | 'rod' | 'bait' | null = null;
if (isMissingFishingTicketDialog(errText)) {
  missingType = 'ticket';
  this.pushLog(`[câu cá] Server thông báo thiếu vé: "${reason}"`);
} else if (errText.includes('mồi')) {
  missingType = 'bait';
} else if (
  errText.includes('cần câu')
  || errText.includes('sử dụng cần')
  || errText.includes('phải có cần')
  || errText.includes('cần tre')
  || errText.includes('cần sắt')
) {
  missingType = 'rod';
}
```

#### 3. Cập nhật `runFishingLoop` trong `avatarSession.ts`
Khi đang trong cast loop, nếu server trả về dialog trong lúc quăng cần:
- Chỉ bắt `bait` và `rod`.
- Nếu dialog báo thiếu vé (trường hợp cực hiếm: vé vừa hết hạn đúng giây này), ta log thông báo và gọi `client.cauCaXong()`, rồi để chu trình kết thúc lượt câu chuyển về `startFishingSession` xử lý mua vé đúng quy trình thay vì can thiệp đột ngột giữa lúc quăng cần.

```typescript
let castMissingType: 'rod' | 'bait' | null = null;
if (castErrText.includes('mồi')) {
  castMissingType = 'bait';
} else if (
  castErrText.includes('cần câu')
  || castErrText.includes('sử dụng cần')
  || castErrText.includes('phải có cần')
  || castErrText.includes('cần tre')
  || castErrText.includes('cần sắt')
) {
  castMissingType = 'rod';
} else if (isMissingFishingTicketDialog(castErrText)) {
  this.pushLog(`[câu cá] Vé câu đã hết hạn trong lúc câu: "${catchResult}" — kết thúc lượt để mua lại vé mới…`);
  try { client.cauCaXong(); } catch { /* bỏ qua */ }
  await this.delayCancellable(1000, signal);
  if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
  continue;
}
```

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 4.1. Automated Verification (Typecheck & Build)
- Chạy `npm run build` trong thư mục `avatar-web/server`.
- Đảm bảo toàn bộ code TypeScript biên dịch thành công, không có lỗi type hoặc broken imports.

### 4.2. GitNexus Impact & Graph Consistency Check
- Chạy `gitnexus_impact` trên `startFishingSession` và `isMissingFishingTicketDialog`.
- Chạy `gitnexus_detect_changes` trước khi commit để đảm bảo không làm đứt gãy execution flow.

### 4.3. Unit / Logic Verification
- Kiểm tra các mẫu chuỗi thông báo:
  - `"Bạn nhận được 1 vé quay số may mắn"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `false` (không kích hoạt mua vé).
  - `"Bạn nhận được vé sự kiện"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `false`.
  - `"Bạn cần vé câu cá rô để câu cá khu vực này"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `true` (kích hoạt mua vé).
  - `"Bạn cần vé câu cá lóc để câu cá khu vực này"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `true`.
  - `"Bạn cần vé câu cá bến tàu để câu cá khu vực này"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `true`.
  - `"Phải có vé câu mới được vào câu"` $\rightarrow$ `isMissingFishingTicketDialog` trả về `true`.
