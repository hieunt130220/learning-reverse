# Thiết Kế Khắc Phục Lỗi Mất Kết Nối (Server Im Lặng) & Treo Auto Câu Cá Sau Reconnect (-34 Timeout)

> **Ngày lập:** 2026-09-09  
> **Trạng thái:** Chờ User Review (User Review Gate)  
> **Tài liệu liên quan:**
> - `docs/superpowers/specs/2026-09-08-fix-fishing-start-timeout-map-join-design.md`
> - `avatar-web/server/src/game/client.ts`
> - `avatar-web/server/src/session/avatarSession.ts`
> - `avatar-web/server/src/game/parkService.ts`

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Hiện tượng lỗi từ Production Log
Khi hệ thống chạy auto câu cá (`auto_fishing`) trên production, xuất hiện chuỗi lỗi nghiêm trọng sau:

```text
14:18:45 [câu cá] đang quăng cần…
14:19:32 [câu cá] đang quăng cần…
14:20:18 [câu cá] đang quăng cần…
14:20:50 server im lặng 124s — đóng socket để kết nối lại
14:20:50 thử kết nối lại sau 10s (lần 1)
14:20:50 mất kết nối: local-close 27.0.14.120:19129, sống 220009ms, rx=2587679B tx=352B, trạng thái=online, im lặng 124017ms
14:20:56 [câu cá] lỗi vòng lặp: chưa kết nối
14:21:00 đã kết nối 27.0.14.120:19129, xin khóa...
14:21:00 đã nhận khóa, gửi thông tin client
14:21:00 server phản hồi getServerLoginInfo — giải mã hai chiều OK
14:21:01 [điểm danh] đang gửi yêu cầu báo danh…
14:21:01 đăng nhập thành công — id nhân vật = 1005161
14:21:01 số dư login: xu=909682 · lượng=0 · lượng khoá=342
14:21:03 [câu cá] đang di chuyển vào map 14 (khu vực 0)…
14:21:03 [câu cá] handler context hiện tại: 10 — gửi enterParkContext
14:21:03 danh sách nhiệm vụ: 108 quest (mẫu: Nhiệm Vụ Nhà Nông - 1)
14:21:04 [câu cá] gửi TX90 board-list request cho map 14
14:21:04 [câu cá] nhận RX90 — gửi joinPark(14, 0)
14:21:04 cập nhật Nhiệm Vụ Tân Thủ 1: Trồng 6 cây hoa hồng (0/6)
14:21:05 cập nhật Nhiệm Vụ Thợ Câu - 10: Câu 30 con cá rô (30/30), Câu 30 con cá lòng tong (30/30), Câu 30 con cá chim (10/30)
14:21:10 [câu cá] hết giờ chờ gói enter-world (-34)
14:22:48 tiền: +0 (loại 1) -> xu=909682 lượng=0 khóa=342
14:24:04 [chat park] 138177303: autocauca.io.vn
```

Sau mốc `14:21:10`, bot câu cá dừng hoàn toàn và không bao giờ tự phục hồi, mặc dù socket vẫn sống và nhân vật vẫn đứng trong công viên (nhận được tin nhắn chat park ở `14:24:04`).

---

### 1.2. Kết quả điều tra nguyên nhân gốc rễ (Root Cause Investigation)

Hệ thống gặp phải **3 nguyên nhân gốc rễ** cộng hưởng lẫn nhau:

#### Nguyên nhân 1: Xung đột ngữ cảnh (Context Conflict) giữa Farm Sync và Auto Fishing sau Reconnect
- Khi kết nối lại và đăng nhập thành công (`onOnline`), session gọi `syncFarmAfterOnline(client, epoch)`.
- Hàm `syncFarmAfterOnline` gọi `client.enterFarm()`, ép `currentHandlerContext` sang `HANDLER_FARM` (10).
- Khi gói 69 (JOIN farm) trả về, nó kích hoạt `refreshProgressQuests()`, gửi dồn dập 5 request NPC Lái buôn (`communicate(90)`, `doMenuOption(...)`) kéo dài 2-3 giây.
- Trong khi đó, `resumeDesiredAutomation` đồng thời khởi động `runFishingLoop()`.
- `runFishingLoop` cố gắng chuyển sang Park (`enterParkContext()`, handler 9), gửi `TX 90`, rồi gửi `TX 80 (joinPark)`.
- Việc spam đồng thời các lệnh Farm và Park khiến server Avatar quá tải / nghẽn luồng xử lý hoặc rate-limit, làm rơi hoặc trễ gói `RX 80`.

#### Nguyên nhân 2: `runFishingLoop` thiếu cơ chế Retry và bị Fatal Exit khi Timeout
- `runFishingLoop` không sử dụng hàm `joinParkWithRetry` (vốn đã có cooldown chống spam 2.2s và retry 3 lần kèm backoff).
- `runFishingLoop` chỉ chờ duy nhất 1 lần `waitForWorldSnapshot` với timeout 6000ms.
- Khi hết 6000ms, nó quăng lỗi `hết giờ chờ gói enter-world (-34)`. Khối `catch` set `this.fishingRuntime.status = 'rejected'` và **`return` kết thúc vĩnh viễn**, không có bất kỳ cơ chế thử lại hay reconnect vòng lặp.
- Thông báo lỗi trong `client.ts:681` bị hardcode là `(-34)` thay vì phản ánh đúng việc chờ gói vào map `RX 80`.
- Hơn nữa, nếu server phản hồi `"Bạn đã ở trong khu vực muốn chuyển đến"` (`PARK_ALREADY_IN_AREA_DIALOG`), hàm `waitForWorldSnapshot` lại kiểm tra `cached = this.latestParkSnapshot`. Do vừa reconnect nên `latestParkSnapshot` bị `undefined`, dẫn đến việc bỏ qua dialog hợp lệ này và vẫn đếm hết 6s để quăng lỗi timeout!

#### Nguyên nhân 3: Cơ chế Keep-Alive gửi sai Opcode trong ngữ cảnh Park khiến Watchdog đóng kết nối
- Trong `GameClient.startKeepAlive()`, nhịp giữ kết nối gửi định kỳ `this.farm.getInventory()` (CMD 70).
- Khi nhân vật ở trong Công viên / Hồ câu cá (`currentHandlerContext === HANDLER_PARK`), handler phía server là `ParkHandler`, hoàn toàn **không xử lý CMD 70** của nông trại. Server lẳng lặng vứt bỏ gói này mà không trả lời.
- Nếu không có cá cắn câu và trong phòng không có người chat/di chuyển, socket không nhận được bất kỳ byte nào từ server suốt 120 giây.
- `silenceWatchdog` (ngưỡng 120s) kích hoạt, ngỡ rằng kết nối bị đứt ngầm nên chủ động đóng socket (`local-close`, `server im lặng 124s`).
- Trong vòng lặp câu cá, nếu cá không cắn trong 35s (`catchResult === false`), bot vẫn gửi `client.cauCaXong()` (CMD 44). Lệnh này báo server kết thúc phiên câu (đứng dậy), nhưng vòng sau lại quăng cần (`TX 41`) mà không gọi lại `startFishing` (`TX 45`), khiến server ngó lơ các lệnh sau đó, đẩy socket vào trạng thái im lặng tuyệt đối.

---

## 2. Phạm Vi Giải Pháp (Scope)

### 2.1. Trong phạm vi (In-Scope)

1. **Ngăn chặn triệt để xung đột ngữ cảnh Farm Sync khi đang bật Auto Fishing:**
   - Mở rộng hàm kiểm tra quyền sở hữu ngữ cảnh `parkOwnsOrTargetsContext()` bao gồm cả `find_npc` và `auto_fishing`.
   - Chặn `syncFarmAfterOnline` không được chạy nếu mode mong muốn là `auto_fishing`.
   - Chặn các API hoặc thao tác gọi `enterFarm()` / `refreshFarmProfile()` khi session đang trong ngữ cảnh Park.

2. **Chuẩn hóa và tái sử dụng `joinParkWithRetry` trong `runFishingLoop`:**
   - Đưa bước gửi `TX 90` (board-list request) tích hợp mượt mà hoặc thực hiện trước `joinParkWithRetry`.
   - Thay thế toàn bộ đoạn code join map một lần (one-shot) trong `runFishingLoop` bằng `joinParkWithRetry` có sẵn (cooldown 2.2s, retry 3 lần, xử lý backoff).
   - Khi `joinParkWithRetry` thất bại cả 3 lần: không dừng vĩnh viễn mà có thể restart loop sau một khoảng nghỉ, hoặc ghi nhận lỗi rõ ràng.

3. **Sửa lỗi xử lý Snapshot trong `GameClient.waitForWorldSnapshot`:**
   - Khi server trả về `PARK_ALREADY_IN_AREA_DIALOG` ("Bạn đã ở trong khu vực muốn chuyển đến"), cho phép resolve thành công ngay lập tức kể cả khi `this.latestParkSnapshot` là `undefined` (tạo snapshot mặc định với `roomId = expected.map, boardId = expected.area`).
   - Sửa thông điệp lỗi timeout: nếu có `expected`, báo rõ `hết giờ chờ vào map ${expected.map} khu ${expected.area} (RX80)`, tránh gây hiểu lầm thành gói login (-34).

4. **Sửa cơ chế Keep-Alive cho phù hợp với ngữ cảnh Park:**
   - Trong `startKeepAlive()`: nếu `currentHandlerContext === HANDLER_PARK`, gửi gói toàn cục `this.requestYourInfo()` (`CMD -94`) thay vì `this.farm.getInventory()` (`CMD 70`).
   - Gói `CMD -94` luôn được server trả lời ở mọi ngữ cảnh, giúp `this.lastRxAt` được cập nhật liên tục mỗi 45s, triệt tiêu lỗi `server im lặng 124s` giả mạo.

5. **Sửa vòng lặp quăng cần khi cá không cắn (No-bite / Miss):**
   - Nếu `catchResult === false` (hết 35s không cắn, hoặc giật hụt): gửi `cauCaXong()` để dọn dẹp state rồi quay lại `startFishing` (`outerLoop`), đảm bảo session câu cá luôn hợp lệ trên server.

### 2.2. Ngoài phạm vi (Out-of-Scope)
- Không thay đổi model ML giải captcha/mini-game.
- Không thay đổi cấu trúc bảng cơ sở dữ liệu.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh sách file thay đổi

| File | Vai trò thay đổi |
|---|---|
| `avatar-web/server/src/game/client.ts` | Sửa `startKeepAlive` để gửi `-94` khi ở Park; sửa `waitForWorldSnapshot` chấp nhận dialog "đã ở khu vực" khi cache rỗng và sửa thông báo timeout RX80. |
| `avatar-web/server/src/session/avatarSession.ts` | Tạo `parkOwnsOrTargetsContext()`, chặn farm sync khi auto câu cá, áp dụng `joinParkWithRetry` trong `runFishingLoop`, xử lý reset vòng câu khi không dính cá. |

---

### 3.2. Chi tiết kỹ thuật từng module

#### A. Cải tiến `GameClient` (`client.ts`)

1. **Keep-Alive đa ngữ cảnh (`startKeepAlive`):**
```typescript
  private startKeepAlive(intervalMs = 45_000): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.status !== 'online') return this.stopKeepAlive();
      try {
        if (this.currentHandlerContext === HANDLER_PARK) {
          // Ngữ cảnh Park: CMD -94 (Global) luôn có phản hồi, CMD 70 (Farm) bị bỏ qua
          this.requestYourInfo();
        } else {
          // Ngữ cảnh Farm / Main: CMD 70 (getInventory)
          this.farm.getInventory();
        }
      } catch {
        this.stopKeepAlive();
      }
    }, intervalMs);
  }
```

2. **Chấp nhận Dialog khu vực ngay cả khi Cache Snapshot rỗng (`waitForWorldSnapshot`):**
```typescript
      const onSameArea = (reason: string): void => {
        if (!expected || reason.trim() !== PARK_ALREADY_IN_AREA_DIALOG) return;
        cleanup();
        const cached = this.latestParkSnapshot;
        if (cached && cached.roomId === expected.map && cached.boardId === expected.area) {
          this.emit(
            'log',
            `Park snapshot cache: server xác nhận đã ở map ${expected.map} khu ${expected.area}`,
          );
          resolve(cloneParkSnapshot(cached));
        } else {
          // Server xác nhận nhân vật đã ở đúng map/khu, tạo snapshot tối thiểu
          const synSnap: EnterWorldSnapshot = {
            playerId: this.playerId ?? 0,
            roomId: expected.map,
            boardId: expected.area,
            x: 0,
            y: 0,
            specials: [],
            totalBytes: 0,
            trailingBytes: 0,
          };
          this.latestParkSnapshot = synSnap;
          this.emit(
            'log',
            `Server xác nhận nhân vật đã ở map ${expected.map} khu ${expected.area} (chấp nhận dialog)`,
          );
          resolve(synSnap);
        }
      };
```

3. **Thông báo lỗi timeout chính xác:**
```typescript
      timer = setTimeout(() => {
        cleanup();
        const msg = expected
          ? `hết giờ chờ vào map ${expected.map} khu ${expected.area} (RX80)`
          : 'hết giờ chờ gói enter-world (-34)';
        reject(new Error(msg));
      }, timeoutMs);
```

---

#### B. Cải tiến `AvatarSession` (`avatarSession.ts`)

1. **Thống nhất kiểm tra quyền sở hữu ngữ cảnh Park:**
```typescript
  private fishingOwnsOrTargetsContext(): boolean {
    return this.desiredMode === 'auto_fishing'
      || this.activeMode === 'auto_fishing'
      || this.fishingAbortController !== undefined;
  }

  private parkOwnsOrTargetsContext(): boolean {
    return this.findNpcOwnsOrTargetsContext() || this.fishingOwnsOrTargetsContext();
  }
```
Cập nhật `assertFarmContextAvailable()` và `onOnline()` sử dụng `parkOwnsOrTargetsContext()`. Khi `auto_fishing` được bật, `syncFarmAfterOnline` sẽ bị hủy bỏ, ngăn chặn hoàn toàn việc gửi CMD 69 và bão quest dialog.

2. **Dùng `joinParkWithRetry` trong `runFishingLoop`:**
Thay thế đoạn `try { pendingSnapshot = ...; client.joinPark(...); }` bằng:
```typescript
    // Gửi TX90 (board list request) trước khi vào map
    this.pushLog(`[câu cá] gửi TX90 board-list request cho map ${map}`);
    await this.requestBoardList(client, map, signal);

    if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;

    try {
      await this.joinParkWithRetry(client, map, area, signal, epoch);
    } catch (err) {
      if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
      const msg = (err as Error).message;
      this.fishingRuntime.status = 'rejected';
      this.fishingRuntime.lastError = msg;
      this.pushLog(`[câu cá] vào map thất bại: ${msg}`);
      this.emitAutomation();
      return;
    }
```

3. **Xử lý chu kỳ câu cá khi không cắn hoặc sổng cá:**
Nếu `catchResult === false`:
- Gửi `client.cauCaXong()` để đồng bộ trạng thái về idle.
- Chờ 1s và `continue outerLoop` để gọi lại `startFishing` (`TX 45`), tránh tình trạng quăng cần trên session đã chết.

---

## 4. Kế Hoạch Kiểm Tra (Verification Plan)

1. **Kiểm tra biên dịch & Type check:**
   - `npm run build -w avatar-web/server` không có lỗi.
2. **Kiểm tra Unit Test hiện có:**
   - Chạy test suite `avatar-web/server` để đảm bảo không làm gãy các luồng auto-farm, shopCoordinator, và find-npc.
3. **Xác minh thực tế trên tài khoản live:**
   - Kích hoạt `auto_fishing` trên tài khoản 3.
   - Thử nghiệm mô phỏng disconnect / reconnect để xác minh:
     - Không có log `syncFarmAfterOnline` hay log cập nhật quest NPC làm phiền luồng vào map câu cá.
     - `TX 90` và `RX 80` hoàn thành mượt mà, không gặp lỗi `hết giờ chờ gói enter-world (-34)`.
     - Nhịp keepalive `-94` duy trì kết nối ổn định, không bị `server im lặng 124s`.
     - Nếu câu hụt/timeout, bot tự reset và bắt đầu lại lượt câu mới thành công.
