# Thiết Kế Khắc Phục Lỗi "Hết Giờ Chờ Bắt Đầu Câu" Khi Quay Lại Farm Sau 30 Phút Câu Cá

> **Ngày lập:** 2026-09-12  
> **Trạng thái:** Chờ User duyệt (User Review Gate)  
> **Tác giả:** Claude Fable 5 & Devios  
> **Topic:** Khắc phục lỗi `Server từ chối bắt đầu câu: hết giờ chờ bắt đầu câu` khi chu kỳ nông trại định kỳ (30 phút) trong Auto Fishing hoàn tất và quay trở lại hồ câu cá  
> **Tài liệu liên quan:**  
> - `docs/superpowers/specs/2026-09-10-auto-fishing-periodic-farm-design.md`  
> - `docs/superpowers/specs/2026-09-08-fix-fishing-start-timeout-map-join-design.md`  
> - `avatar-web/server/src/session/avatarSession.ts`  
> - `avatar-web/server/src/game/client.ts`  

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Hiện tượng lỗi từ Production Log
Trong quá trình vận hành chế độ tự động câu cá (`auto_fishing`) kèm tính năng làm nông trại định kỳ sau mỗi 30 phút (`FISHING_FARM_INTERVAL_MS = 1_800_000`), sau khi bot tạm dừng câu cá để chạy chu kỳ nông trại và quay trở lại khu vực câu cá (Map 14, khu vực 0), hệ thống gặp lỗi timeout fatal:

```text
20:21:01 [câu cá] Server từ chối bắt đầu câu: hết giờ chờ bắt đầu câu
```

Hậu quả:
1. `startFishingSession` coi đây là lỗi từ chối vĩnh viễn (`fatal rejection`), lập tức đánh dấu `status = 'rejected'` và trả về `false`.
2. `prepareFishingAtPark` trả về `false`.
3. `serviceDueFishingFarm` trả về `'stop'`.
4. Toàn bộ tiến trình Auto Fishing dừng hoạt động vĩnh viễn (`Fatal Exit`), bot không tiếp tục câu cá và cũng không bao giờ quay lại farm lần sau.

---

### 1.2. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Sau khi đối chiếu mã nguồn hiện tại (`avatarSession.ts`, `client.ts`, `autoFarm.ts`), kiểm tra lịch sử commit và kiến trúc giao thức server AvatarHD:

1. **Không kết thúc phiên câu cá (`cauCaXong`) trước khi chuyển sang Nông Trại:**
   - Khi hết 30 phút câu cá, `this.fishingFarmDue` được kích hoạt và hàm `serviceDueFishingFarm` được gọi.
   - `serviceDueFishingFarm` gọi trực tiếp `runFishingFarmCycle`, chuyển handler sang Farm (`GET_HANDLER 10`) mà **hoàn toàn không gửi lệnh `client.cauCaXong()` (CMD 44)**.
   - Khi đó, trên server Avatar, nhân vật vẫn đang ở trạng thái ngồi câu hoặc session câu cá trong `ParkHandler` bị treo lơ lửng (dangling state).
   - Khi bot làm xong farm và quay lại Park (Map 14), bot gửi `TX 45 (startFishing)` để xin bắt đầu câu. Server Avatar thấy nhân vật đã ở trạng thái câu hoặc session câu cũ chưa kết thúc hợp lệ nên **lặng lẽ bỏ qua `TX 45` (silent drop)**, không gửi về bất kỳ gói phản hồi `RX 45` hay `dialog` nào.

2. **Dữ liệu snapshot Park cũ không được dọn dẹp khi vào Farm (`Stale latestParkSnapshot`):**
   - Trong `GameClient`, thuộc tính `latestParkSnapshot` chỉ được xóa khi socket đóng (`on('closed')`). Khi gọi `enterFarm()`, `latestParkSnapshot` vẫn lưu map 14 khu vực 0.
   - Khi quay lại Park, hàm `waitForWorldSnapshot` có thể nhận dialog `"Bạn đã ở trong khu vực muốn chuyển đến"` (`PARK_ALREADY_IN_AREA_DIALOG`) và ngộ nhận rằng nhân vật đã đồng bộ xong vị trí, hoàn tất giả mạo thay vì chờ một snapshot `RX 80` thật từ server.

3. **`startFishingSession` hoàn toàn thiếu cơ chế Retry khi Timeout:**
   - Trong `startFishingSession` (`avatarSession.ts:2907-2954`), bot gửi `TX 45` và chờ trong 8000ms qua `rx45Promise`.
   - Nếu server bận xử lý sau khi chuyển context hoặc packet bị trễ/drop, timer 8s kích hoạt và trả về `error: 'hết giờ chờ bắt đầu câu'`.
   - Khối xử lý lỗi sau đó chỉ phân loại cho: rương đầy cá (`banca`), thiếu vé câu (`ticket`), thiếu cần (`rod`), thiếu mồi (`bait`).
   - Lỗi `'hết giờ chờ bắt đầu câu'` bị rơi xuống nhánh cuối:
     ```typescript
     this.fishingRuntime.status = 'rejected';
     this.fishingRuntime.lastError = reason;
     this.emitAutomation();
     return false;
     ```
   - Không có bất kỳ lần thử lại nào (0 retry). Việc một thao tác mạng bị timeout 8s biến thành lỗi fatal làm dừng toàn bộ bot là thiết kế thiếu khả năng chịu lỗi (fault-intolerant).

---

## 2. Phạm Vi Giải Pháp (Scope)

### 2.1. In-Scope

1. **Dọn dẹp phiên câu cá trước khi chuyển sang Farm trong `serviceDueFishingFarm`:**
   - Gửi `client.cauCaXong()` (CMD 44) kèm delay chờ xác nhận/ổn định trước khi kích hoạt `runFishingFarmCycle`.
   - Đảm bảo nhân vật đã đứng dậy khỏi ghế câu và server giải phóng trạng thái câu cá trước khi chuyển handler context sang 10 (Farm).

2. **Reset `latestParkSnapshot` khi vào Farm:**
   - Thêm phương thức `clearParkSnapshot()` trong `GameClient` và gọi khi `enterFarm()` để loại bỏ snapshot rác của Map Park trước đó.

3. **Bổ sung cơ chế Retry thông minh (Smart Retry) cho `startFishingSession` khi Timeout:**
   - Khi `startResult.error` là `'hết giờ chờ bắt đầu câu'`, không dừng bot ngay lập tức mà cho phép thử lại tối đa 3 lần:
     - **Lần 1 (Retry 1):** Ghi log cảnh báo, gửi `client.cauCaXong()` để giải phóng trạng thái kẹt trên server, chờ backoff 1.5s, rồi gửi lại `client.startFishing()`.
     - **Lần 2 (Retry 2):** Gửi `client.cauCaXong()`, gọi lại `enterFishingPark` để force đồng bộ lại map 14 và nhận lại snapshot `RX 80` từ server (chờ delay đồng bộ 3s), sau đó gửi lại `client.startFishing()`.
     - **Lần 3 (Retry 3):** Nếu sau 3 lần vẫn timeout hoàn toàn thì mới báo lỗi fatal `rejected`.

4. **Bổ sung lớp phục hồi dự phòng trong `serviceDueFishingFarm`:**
   - Sau khi xong farm, nếu `prepareFishingAtPark` trả về `false`, thực hiện cứu vãn 1 lần bằng cách reset context Park và thử lại `prepareFishingAtPark` trước khi quyết định dừng (`stop`).

### 2.2. Out-of-Scope
- Không thay đổi logic quăng cần (`TX 41`), nhận cá (`RX 79`) hay máy giải captcha ML.
- Không thay đổi logic mua mồi/vé/cần hay chu kỳ 30 phút của nông trại.

---

## 3. Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

### 3.1. Danh Sách Files Thay Đổi

| File | Vai trò | Thay đổi cụ thể |
|---|---|---|
| `avatar-web/server/src/game/client.ts` | Quản lý kết nối & giao thức game | Bổ sung phương thức `clearParkSnapshot()` và gọi tự động trong `enterFarm()` |
| `avatar-web/server/src/session/avatarSession.ts` | Điều phối session & automation loops | 1. Thêm `client.cauCaXong()` trước khi chạy farm trong `serviceDueFishingFarm`<br>2. Bổ sung retry loop cho timeout trong `startFishingSession`<br>3. Bổ sung retry cứu vãn trong `serviceDueFishingFarm` khi quay lại Park |

---

### 3.2. Luồng Xử Lý Chi Tiết (Flow Diagram)

```text
[Hết 30 phút câu cá: fishingFarmDue = true]
                    │
                    ▼
[serviceDueFishingFarm]
  ├── 1. Gửi client.cauCaXong() (CMD 44) để server đóng phiên câu
  ├── 2. Delay 800ms ổn định
  ├── 3. Chạy runFishingFarmCycle('periodic')
  │       ├── client.enterFarm() -> xóa latestParkSnapshot, gửi GET_HANDLER 10
  │       └── Thực thi thu hoạch, tưới cây, cho ăn...
  ├── 4. Đã xong farm -> Chuyển sang prepareFishingAtPark
  │       ├── enterFishingPark:
  │       │     ├── client.enterParkContext() (GET_HANDLER 9)
  │       │     ├── Gửi TX 90 (board list request) -> chờ RX 90
  │       │     ├── joinParkWithRetry(14, 0) -> nhận snapshot RX 80 thật
  │       │     └── Chờ delay 3000ms server đồng bộ
  │       └── startFishingSession:
  │             ├── Gửi client.startFishing() (TX 45) -> chờ RX 45 tối đa 8s
  │             │
  │             ├── [Trường hợp thành công RX 45]: Bắt đầu quăng cần tiếp!
  │             │
  │             └── [Trường hợp Timeout 8s "hết giờ chờ bắt đầu câu"]:
  │                   ├── Lần 1: Log retry, gửi cauCaXong(), delay 1.5s, thử lại TX 45
  │                   ├── Lần 2: Log retry, gửi cauCaXong(), re-enter map 14, thử lại TX 45
  │                   └── Lần 3: Nếu vẫn timeout -> mới báo rejected dừng
```

---

### 3.3. Chi Tiết Code Triển Khai Dự Kiến

#### 1. Trong `client.ts`: Thêm `clearParkSnapshot` và reset trong `enterFarm`
```typescript
  clearParkSnapshot(): void {
    this.latestParkSnapshot = undefined;
  }

  enterFarm(idFarm?: number): void {
    this.latestParkSnapshot = undefined; // Đảm bảo không giữ snapshot cũ của Park
    if (this.currentHandlerContext !== HANDLER_FARM) {
      this.currentHandlerContext = HANDLER_FARM;
      const m = Message.create(-1);
      m.writer!.writeByte(HANDLER_FARM);
      this.session.send(m);
    } else {
      const targetId = idFarm ?? this.farmState?.idFarm ?? this.playerId ?? 0;
      this.farm.joinFarm(targetId);
    }
  }
```

#### 2. Trong `avatarSession.ts`: Kết thúc phiên câu trước khi vào farm
```typescript
  private async serviceDueFishingFarm(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<'continue-fishing' | 'stop'> {
    if (!this.fishingFarmDue) return 'continue-fishing';
    this.fishingChallengeGeneration += 1;
    this.fishingFarmDue = false;

    // Kết thúc phiên câu cá hiện tại trước khi chuyển sang Farm để server không giữ trạng thái ngồi câu
    this.pushLog('[câu cá] Tạm dừng câu cá, đứng dậy để làm nông trại định kỳ…');
    try { client.cauCaXong(); } catch { /* bỏ qua */ }
    await this.delayCancellable(800, signal);

    const outcome = await this.runFishingFarmCycle(
      'periodic',
      client,
      generation,
      epoch,
      signal,
    );
    if (outcome === 'cancelled' || outcome === 'reconnect') return 'stop';
    if (
      signal.aborted
      || !this.isCurrent(client, epoch)
      || !this.isAutomationGenerationCurrent(generation)
      || this.desiredMode !== 'auto_fishing'
    ) {
      return 'stop';
    }

    this.pushLog('[câu cá] Đã xong farm, quay lại khu câu cá...');
    this.fishingFarmPhase = 'returning-to-park';
    let ok = await this.prepareFishingAtPark(client, generation, epoch, signal);
    if (!ok) {
      this.pushLog('[câu cá] Lần đầu vào lại khu câu cá sau farm chưa sẵn sàng — thử lại lần 2…');
      await this.delayCancellable(2000, signal);
      ok = await this.prepareFishingAtPark(client, generation, epoch, signal);
    }
    if (!ok) return 'stop';
    this.fishingFarmPhase = 'fishing';
    this.scheduleFishingFarm(generation, epoch);
    return 'continue-fishing';
  }
```

#### 3. Trong `avatarSession.ts`: Cơ chế Timeout Retry trong `startFishingSession`
```typescript
    let consecutiveFailures = 0;
    let lastMissingType: 'ticket' | 'rod' | 'bait' | null = null;
    let timeoutRetries = 0;
    const MAX_TIMEOUT_RETRIES = 2;

    // ── Vòng lặp chờ startFishing thành công ──
    while (true) {
      // ... kiểm tra signal abort / current ...
      
      this.fishingRuntime.status = 'starting';
      this.emitAutomation();

      // ... rx45Promise (8000ms timeout) ...
      client.startFishing();
      const startResult = await rx45Promise;

      // ... kiểm tra signal abort ...

      if (!startResult.iss) {
        const reason = startResult.error ?? 'server từ chối bắt đầu câu';
        const errText = reason.toLowerCase();
        this.pushLog(`[câu cá] Server từ chối bắt đầu câu: ${reason}`);

        // Xử lý timeout
        if (errText.includes('hết giờ chờ bắt đầu câu')) {
          if (timeoutRetries < MAX_TIMEOUT_RETRIES) {
            timeoutRetries++;
            this.pushLog(`[câu cá] Hết giờ chờ bắt đầu câu (lần ${timeoutRetries}/${MAX_TIMEOUT_RETRIES}) — reset phiên câu và thử lại…`);
            try { client.cauCaXong(); } catch { /* bỏ qua */ }
            await this.delayCancellable(1500 * timeoutRetries, signal);
            if (timeoutRetries >= 2) {
              // Lần 2: Re-enter map để force đồng bộ lại world snapshot từ đầu
              await this.enterFishingPark(client, generation, epoch, signal);
            }
            continue;
          }
        }

        // Xử lý rương đầy, mua vé, mồi, cần ... (giữ nguyên logic hiện tại)
        // ...
      }

      break; // Thành công!
    }
```

---

## 4. Verification Plan

### 4.1. Static & Typecheck Verification
- Chạy `npm run typecheck` trên `avatar-web/server` để đảm bảo toàn bộ types và method signatures hoàn toàn khớp.
- Kiểm tra `git diff` để đảm bảo không có code thừa hoặc vi phạm conventions.

### 4.2. Unit & Integration Verification
- Chạy test suite hiện có của `avatar-web/server` (`npm test`) để xác nhận không gây regression cho các luồng session, farm và fishing khác.
- Kiểm tra các branch logic:
  1. Timeout retry đếm đúng số lần và reset với `cauCaXong()`.
  2. Snapshot Park bị xóa khi gọi `enterFarm()`.
  3. Khi `serviceDueFishingFarm` gọi, `cauCaXong()` được gọi trước khi chạy farm cycle.

### 4.3. GitNexus Change Verification
- Chạy `gitnexus_detect_changes({ scope: "all" })` để kiểm tra ảnh hưởng đồ thị trước khi commit.
