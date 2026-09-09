# Thiết Kế Cơ Chế Tự Động Bán Cá Khi Rương Đầy (Auto Sell Fish - AvatarHD)

> **Ngày lập:** 2026-09-09  
> **Trạng thái:** Chờ User duyệt (Review Gate)  
> **Tác giả:** Claude Fable 5 & Devios  

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Hiện trạng & Vấn đề
Khi bot câu cá chạy trên môi trường production 24/7 tại các hồ câu (Map 14, 27...), nhân vật câu được cá sẽ dồn vào rương chứa đồ (tối đa 40 ô). Khi rương đầy, server AvatarHD từ chối cho quăng cần hoặc bắt đầu câu bằng các dialog:
- `"Rương đã đầy không thể câu thêm"`
- `"Rương của bạn đã đầy"`
- `"Hành trang đã đầy"`

Hiện tại trong `avatarSession.ts`, khi bắt gặp thông báo rương đầy, bot chỉ ghi log lỗi và dừng câu (`this.fishingRuntime.status = 'rejected'`). Điều này khiến bot không thể vận hành liên tục 24/7 tự động mà phải phụ thuộc vào người dùng đăng nhập vào game dọn rương thủ công.

### 1.2. Giải pháp kỹ thuật dựa trên Reverse Engineering
Từ dịch ngược binary ARM64 (`libil2cpp.so`) hàm `ParkService.chatToBoard` (`0x71AD98`) và mã nguồn máy khách Avatar J2ME (`tools/jar/all_src/bT.java:393` & bot câu cá huyền thoại `bs_0.java:771`):
1. **Lệnh chat in-game tích hợp sẵn (`banca`)**:
   - Trong khu vực hồ câu cá thuộc Park, người chơi không cần phải chạy bộ ra khỏi hồ câu để tìm NPC.
   - Chỉ cần gửi gói tin chat **`cmd 85` (`CMD_PARK_CHAT`)** với nội dung chuỗi `"banca"`, server Avatar sẽ tự động kiểm tra giỏ cá của nhân vật, bán cá lấy Xu và gửi thông báo xác nhận:  
     `"Bạn vừa bán một con cá [Tên cá] được [Số tiền] xu"` (hoặc trừ cá và cập nhật tiền `cmd -3`).
2. **Cơ chế phản ứng khi rương đầy (Reactive Selling)**:
   - Khi phát hiện rương đầy (tại `TX45 startFishing` hoặc `TX41 quanCau`), bot chuyển trạng thái sang `selling`, tự động gửi chuỗi lệnh `"banca"` kèm delay nhân văn để giải phóng rương.
   - Sau khi bán hết cá và rương trống, bot tiếp tục quăng cần câu cá mà không cần thoát phòng hay di chuyển map.

---

## 2. Phạm Vi (Scope)

### In-scope
1. **`parkService.ts`**:
   - Thêm hằng số opcode `CMD_PARK_CHAT = 85`.
   - Cài đặt hàm `chat(text: string, style?: number): void` gửi gói chat trong Park.
2. **`client.ts`**:
   - Bổ sung hàm ủy quyền `chatPark(text: string, style?: number): void`.
   - Bổ sung xử lý nhận gói `case 85:` trong `onMessage`: giải mã tin nhắn chat server gửi về (`idUser`, `text`), emit sự kiện `park-chat` và ghi log.
3. **`avatarSession.ts`**:
   - Mở rộng trạng thái `FishingStatus`: thêm `'selling'`.
   - Cài đặt hàm `executeSellFish(client: GameClient, epoch: number, signal: AbortSignal): Promise<boolean>`.
   - Tích hợp phát hiện dialog rương đầy tại cả 2 vị trí:
     - Khi gọi `startFishing` (`RX45`).
     - Khi quăng cần `quanCau` (`catchPromise`).
   - Tự động gọi `executeSellFish`, sau khi hoàn tất thì quay lại tiếp tục vòng lặp câu.
   - Bổ sung chốt chặn an toàn (Infinite Loop Guard) chống kẹt vòng lặp nếu bán không thành công.

### Out-of-scope
- Không can thiệp vào logic giải mini-game mũi tên (`TX43`, `ProductionInferenceClient`).
- Không thêm UI cấu hình phức tạp: cơ chế reactive tự động kích hoạt khi đầy rương, mặc định bật cùng auto fishing.
- Không can thiệp vào kho nông trại (`FarmState.produce`).

---

## 3. Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

### 3.1. Cấu trúc gói tin TX / RX Chat trong Park (Opcode 85)

#### Gói gửi TX 85 (`CMD_PARK_CHAT`):
```text
Opcode: 85 (i8)
Payload:
  utf     text     // Nội dung chat ("banca")
  i8      style    // Kiểu hiển thị / màu sắc (mặc định 0)
```

#### Gói nhận RX 85 (`CMD_PARK_CHAT`):
```text
Opcode: 85 (i8)
Payload:
  i32     idUser   // ID nhân vật gửi chat (-1 hoặc ID hệ thống nếu server thông báo)
  utf     text     // Nội dung tin nhắn (ví dụ: "Bạn vừa bán một con cá rô được 250 xu")
  [i8     style]   // Tùy chọn nếu còn byte
```

### 3.2. Sơ đồ xử lý (Execution Flow)

```text
[Vòng lặp Câu Cá]
       │
       ▼
Gửi TX45 / TX41
       │
       ▼
Server trả Dialog: "Rương đã đầy..."
       │
       ▼
Chuyển fishingRuntime.status = 'selling'
       │
       ▼
[Gọi executeSellFish()]
       │
       ├── Gửi client.cauCaXong() (kết thúc phiên câu dở nếu có)
       │
       ├── Vòng lặp gửi "banca":
       │     ├── Gửi client.chatPark("banca")
       │     ├── Lắng nghe:
       │     │     ├── Event 'park-chat' / 'dialog' ("Bạn vừa bán một con cá...", "không có cá")
       │     │     └── Event 'metrics' (Xu tăng)
       │     ├── Delay ngẫu nhiên: 800ms - 1200ms
       │     └── Kiểm tra điều kiện dừng:
       │           ├── Server báo hết cá để bán
       │           ├── Timeout 3s không còn phản hồi bán thêm
       │           └── Đạt trần an toàn 40 lần bán
       │
       ▼
Bán thành công?
  ├── Có  ──► Ghi log số cá đã bán & Xu thu được ──► Chờ 1.5s ──► Tiếp tục quăng cần
  └── Không ──► Ghi log cảnh báo ──► status = 'rejected' ──► Dừng câu an toàn
```

### 3.3. Chi tiết thuật toán `executeSellFish`

```typescript
private async executeSellFish(
  client: GameClient,
  epoch: number,
  signal: AbortSignal,
): Promise<boolean> {
  this.fishingRuntime.status = 'selling';
  this.emitAutomation();
  this.pushLog('[câu cá] Rương đầy cá — đang thực hiện tự động bán cá (chat banca)…');

  try {
    client.cauCaXong();
  } catch {
    /* bỏ qua */
  }
  await this.delayCancellable(1000, signal);

  let soldCount = 0;
  let totalXuEarned = 0;
  let consecutiveNoResponse = 0;
  const MAX_SELL_ATTEMPTS = 40; // Tối đa số ô rương

  for (let attempt = 1; attempt <= MAX_SELL_ATTEMPTS; attempt++) {
    if (signal.aborted || !this.isCurrent(client, epoch)) return false;

    let soldInThisTurn = false;
    let turnXuGained = 0;
    let noMoreFish = false;

    const startXu = client.money ?? 0;

    const sellTurnPromise = new Promise<void>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const cleanup = () => {
        client.removeListener('park-chat', onChat);
        client.removeListener('dialog', onDialog);
        client.removeListener('metrics', onMetrics);
        signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onChat = (evt: { idUser: number; text: string }) => {
        const lower = evt.text.toLowerCase();
        if (lower.includes('bán') && (lower.includes('cá') || lower.includes('xu'))) {
          soldInThisTurn = true;
          this.pushLog(`[câu cá] ${evt.text}`);
          finish();
        } else if (lower.includes('không có cá') || lower.includes('hết cá')) {
          noMoreFish = true;
          finish();
        }
      };

      const onDialog = (reason: string) => {
        const lower = reason.toLowerCase();
        if (lower.includes('không có cá') || lower.includes('hết cá')) {
          noMoreFish = true;
          finish();
        } else if (lower.includes('bán') && (lower.includes('cá') || lower.includes('xu'))) {
          soldInThisTurn = true;
          this.pushLog(`[câu cá] ${reason}`);
          finish();
        }
      };

      const onMetrics = (m: { xu: number }) => {
        if (m.xu > startXu) {
          soldInThisTurn = true;
          turnXuGained = m.xu - startXu;
          finish();
        }
      };

      const onAbort = () => finish();

      client.on('park-chat', onChat);
      client.on('dialog', onDialog);
      client.on('metrics', onMetrics);
      signal.addEventListener('abort', onAbort, { once: true });

      timer = setTimeout(() => finish(), 2500);
    });

    client.chatPark('banca');
    await sellTurnPromise;

    if (signal.aborted || !this.isCurrent(client, epoch)) return false;

    if (noMoreFish) {
      break;
    }

    if (soldInThisTurn) {
      soldCount++;
      totalXuEarned += turnXuGained;
      consecutiveNoResponse = 0;
      await this.delayCancellable(randomBetween(800, 1200), signal);
    } else {
      consecutiveNoResponse++;
      if (consecutiveNoResponse >= 2) {
        // Sau 2 lần không có phản hồi bán -> đã hết cá hoặc server bán gộp 1 lần
        break;
      }
      await this.delayCancellable(1000, signal);
    }
  }

  if (soldCount > 0) {
    this.pushLog(`[câu cá] Đã bán thành công ${soldCount} lượt cá (thu được ~${totalXuEarned} xu)! Rương đã trống.`);
    await this.delayCancellable(1500, signal);
    return true;
  }

  // Nếu không bán được con nào mà server vẫn báo rương đầy
  this.pushLog('[câu cá] Không thể bán cá qua lệnh banca hoặc rương không chứa cá');
  return false;
}
```

---

## 4. Kế Hoạch Kiểm Tra (Verification Plan)

### 4.1. Automated / Compile Checks
1. Kiểm tra TypeScript build trong `avatar-web/server`:
   `npm run build` không phát sinh bất kỳ lỗi cú pháp hay kiểu dữ liệu nào.
2. Kiểm tra GitNexus:
   - Chạy `gitnexus_impact` trên `chatPark`, `executeSellFish`, `runFishingLoop`.
   - Chạy `gitnexus_detect_changes` trước khi commit.

### 4.2. Manual / Live Verification
1. Đăng nhập tài khoản bot vào Map 14 (khu cá rô).
2. Khi nhân vật câu đến lúc rương đầy (hoặc cố tình làm đầy rương trước):
   - Quan sát log server: Bot bắt được dialog lỗi rương đầy.
   - Trạng thái chuyển sang `selling`.
   - Lệnh `chatPark('banca')` được gửi đi.
   - Nhận phản hồi bán cá từ server, số dư Xu tăng lên.
   - Bot tự động quay lại trạng thái `starting` / `casting` và câu tiếp thành công.
