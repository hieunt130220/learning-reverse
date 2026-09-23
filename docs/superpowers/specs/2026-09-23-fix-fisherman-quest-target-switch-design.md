# Thiết Kế: Sửa Lỗi Tự Động Cập Nhật Nhiệm Vụ Mới và Chuyển Map Trong Auto Thợ Câu

> **Ngày lập:** 2026-09-23  
> **Trạng thái:** Chờ User Review (Spec Gate)  
> **Chủ đề:** Khắc phục lỗi chế độ `auto_fisherman_quest` không tự động nhận biết nhiệm vụ mới (ví dụ từ bước 21 sang 22) và không chuyển map câu cá, vẫn đứng ở map cũ câu tiếp.

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh & Hiện tượng lỗi
- Người dùng bật chế độ **Auto Làm Nhiệm Vụ Thợ Câu** (`auto_fisherman_quest`).
- Sau khi hoàn thành nhiệm vụ trước (Bước 21: Câu 100 con cua tại Map 15), hệ thống chuyển sang nhiệm vụ tiếp theo (Bước 22: Câu 100 con cá vàng + 200 con cá rô).
- Giao diện web hiển thị chính xác:
  ```text
  🎣 Nhiệm Vụ Thợ Câu - 22
  Bước 22
  0/2 điều kiện
  🐟 Câu 100 con cá vàng: 0 / 100 (0%)
  🐟 Câu 200 con cá rô: 0 / 200 (0%)
  ```
- Tuy nhiên bot **không tự chuyển map** sang Map 27 (cá vàng) hay Map 14 (cá rô), mà vẫn đứng ở Map 15 câu tiếp.
- Log server ghi nhận:
  ```text
  13:27:54 hộp thoại (-62): tiêu đề="Cá" · nội dung="...Đã câu được một con Cá Nóc...Trị giá: 80 xu"
  13:27:54 [câu cá] bắt được Cá nóc (ID 452)! (Hôm nay: 414)
  13:27:54 [câu cá] bắt được Cá nóc (không phải mục tiêu quest Câu 100 con cua).
  ```
  $\rightarrow$ Bot vẫn đang thực hiện mục tiêu cũ `"Câu 100 con cua"` của nhiệm vụ 21.

### 1.2. Phân tích nguyên nhân gốc rễ (Root Cause)

1. **Vòng lặp chờ trong `runFishermanQuestLoop` (`avatarSession.ts:2634-2637`) bị chặn không kiểm tra trạng thái bộ nhớ**:
   ```typescript
   const runtime = this.fishermanQuestRuntime;
   if (runtime.needed > 0 && runtime.caught >= runtime.needed) break;
   const dueCount = runtime.caught - syncedCaught >= 5;
   const dueTime = this.now() - lastSyncAt >= 180_000;
   if (!dueCount && !dueTime) continue;
   ```
   - Khi nhiệm vụ 21 đã xong trên server, ở Map 15 bot câu trúng Cá Nóc (ID 452) $\rightarrow$ không phải Cua (ID 453) nên `runtime.caught` không tăng.
   - `dueCount` (= false) và `dueTime` (< 180s = false) khiến lệnh `continue` bỏ qua toàn bộ phần kiểm tra `client.fishermanQuestState`.
   - Trong suốt 3 phút (180s), bot hoàn toàn không đọc lại dữ liệu nhiệm vụ dù `client.fishermanQuestState` trong RAM đã sang bước 22.

2. **`refreshProgressQuests` bị gọi dạng fire-and-forget không await (`avatarSession.ts:465-469`)**:
   - `avatarSession.refreshProgressQuests()` khai báo kiểu `void` và gọi `void this.client.refreshProgressQuests()`.
   - `client.refreshProgressQuests()` tốn ít nhất $500\text{ms} + 4 \times (450\text{ms} + 500\text{ms}) = 4.300\text{ms}$ để hoàn thành chuỗi tương tác NPC Lái buôn (Tân Thủ, Nhà Nông, Thợ Câu).
   - Trong khi đó, `runFishermanQuestLoop` chỉ `await this.sleepAbortable(4000, signal)` chạy song song. Sau 4s, lệnh hỏi Thợ Câu (`doMenuOption(38, 0, 0)`) thậm chí chưa kịp gửi xong hoặc gói `-62` chưa kịp về tới client. Vòng lặp đọc trúng dữ liệu cũ.

3. **Thiếu cơ chế Wake-up theo sự kiện (`Event-driven Wake`)**:
   - Khi server gửi hộp thoại cập nhật nhiệm vụ mới (cmd `-24`, `-32`, `-26`, `-62`) hoặc khi người dùng bấm **🔄 Làm mới**, `client` kích hoạt event `'quests'`.
   - `AvatarSession` chỉ emit `'quests'` lên web UI mà không thông báo cho `runFishermanQuestLoop`.
   - Vòng lặp đang ngủ trong `sleepAbortable(10_000)` không được đánh thức ngay lập tức để chuyển mục tiêu.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- `avatar-web/server/src/session/avatarSession.ts`:
  - Thêm cơ chế đánh thức vòng lặp Thợ Câu khi có event `'quests'`.
  - Cập nhật `refreshProgressQuests()` trả về `Promise<void>` để có thể `await` hoàn tất.
  - Sửa vòng lặp chờ trong `runFishermanQuestLoop`:
    - Kiểm tra ngay `client.fishermanQuestState` ở đầu mỗi chu kỳ thức dậy (ngay cả chu kỳ 10s hoặc khi bị đánh thức bởi event `'quests'`).
    - Nếu `fresh.title !== quest.title` hoặc `fresh.step !== quest.step`, break ngay lập tức để chuyển sang nhiệm vụ mới.
    - Nếu điều kiện hiện tại (`next.name`) đã `isDone` hoặc `current >= total`, break ngay lập tức.
    - Truyền cờ `force: true` khi yêu cầu sync chủ động để không bị chặn bởi rate-limit 5s của client.
  - Sau khi `break` khỏi mục tiêu cũ: hủy dứt điểm phiên câu cũ trước khi bắt đầu phiên câu mới.
- `avatar-web/server/src/game/client.ts`:
  - Đảm bảo `refreshProgressQuests(force = false)` quản lý Promise chuẩn, cho phép caller `await` trọn vẹn chu kỳ gửi/nhận.

### 2.2. Out-of-Scope
- Không thay đổi mapping cá trong `fishermanQuest.ts`.
- Không thay đổi logic quăng cần, câu cá, bán cá (`runFishingLoop`).
- Không thay đổi giao diện web frontend.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Danh Sách Files Liên Quan
| File | Đường dẫn | Vai trò |
|---|---|---|
| `avatarSession.ts` | `avatar-web/server/src/session/avatarSession.ts` | Điều phối `runFishermanQuestLoop`, quản lý trạng thái runtime quest, bắt event và chuyển map |
| `client.ts` | `avatar-web/server/src/game/client.ts` | Gửi gói tin hỏi NPC Lái buôn, xử lý gói `-62` và kích hoạt event `'quests'` |

### 3.2. Chi Tiết Thay Đổi Logic

#### 1. Đổi `refreshProgressQuests` sang Promise có thể `await`
Trong `avatarSession.ts`:
```typescript
async refreshProgressQuests(force = false): Promise<void> {
  if (this.client?.status === 'online') {
    await this.client.refreshProgressQuests(force);
  }
}
```

#### 2. Thêm cơ chế Wake-up khi nhận event `quests`
Trong `avatarSession.ts`:
```typescript
private fishermanQuestWake?: () => void;

private wakeFishermanQuest(): void {
  const wake = this.fishermanQuestWake;
  this.fishermanQuestWake = undefined;
  wake?.();
}
```
Tại listener `client.on('quests', ...)`:
```typescript
client.on('quests', () => {
  if (this.isCurrent(client, epoch)) {
    this.emit('quests', this.getQuestOverview());
    this.wakeFishermanQuest(); // Đánh thức vòng lặp Thợ Câu nếu đang chờ
  }
});
```

#### 3. Hàm ngủ có thể bị đánh thức bởi abort hoặc quest update
```typescript
private sleepOrQuestWake(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = () => {
      if (timer) this.clearTimeoutFn(timer);
      signal.removeEventListener('abort', onDone);
      if (this.fishermanQuestWake === onDone) {
        this.fishermanQuestWake = undefined;
      }
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    signal.addEventListener('abort', onDone, { once: true });
    this.fishermanQuestWake = onDone;
    timer = this.setTimeoutFn(onDone, ms);
  });
}
```

#### 4. Tối ưu vòng lặp chờ trong `runFishermanQuestLoop`
```typescript
for (;;) {
  await this.sleepOrQuestWake(5_000, signal);
  if (!alive()) return;

  // 1. KIỂM TRA NGAY TRONG BỘ NHỚ RAM (Zero Latency)
  const fresh = client.fishermanQuestState;
  if (!fresh || fresh.title !== quest.title || fresh.step !== quest.step) {
    this.pushLog(`[thợ câu] phát hiện nhiệm vụ thay đổi (${quest.title} → ${fresh?.title ?? 'mới'}), chuyển mục tiêu…`);
    break;
  }
  const freshCond = fresh.conditions.find((c) => c.name === next.name);
  if (!freshCond || freshCond.isDone || freshCond.current >= freshCond.total) {
    this.pushLog(`[thợ câu] điều kiện "${next.name}" đã hoàn thành trên server (${freshCond?.current ?? 0}/${freshCond?.total ?? next.total}).`);
    break;
  }

  // 2. KIỂM TRA TIẾN ĐỘ LOCAL VỪA ĐỦ
  const runtime = this.fishermanQuestRuntime;
  if (runtime.needed > 0 && runtime.caught >= runtime.needed) {
    this.pushLog(`[thợ câu] đã câu đủ ${runtime.caught}/${runtime.needed} ${runtime.targetFishName} theo bộ đếm local.`);
    break;
  }

  // 3. ĐỒNG BỘ ĐỊNH KỲ VỚI SERVER (SYNC)
  const dueCount = runtime.caught - syncedCaught >= 5;
  const dueTime = this.now() - lastSyncAt >= 60_000; // Giảm từ 180s xuống 60s
  if (!dueCount && !dueTime) continue;

  this.updateFishermanQuest({ phase: 'syncing' });
  this.emitAutomation();
  await this.refreshProgressQuests(true); // force = true, await hoàn tất
  await this.sleepAbortable(1000, signal); // Đệm 1s chờ server phản hồi gói cuối
  if (!alive()) return;

  lastSyncAt = this.now();
  syncedCaught = this.fishermanQuestRuntime.caught;

  const freshAfterSync = client.fishermanQuestState;
  if (!freshAfterSync || freshAfterSync.title !== quest.title || freshAfterSync.step !== quest.step) {
    this.pushLog(`[thợ câu] sau đồng bộ: nhiệm vụ đã chuyển sang ${freshAfterSync?.title ?? 'mới'}.`);
    break;
  }
  const freshCondAfterSync = freshAfterSync.conditions.find((c) => c.name === next.name);
  if (!freshCondAfterSync || freshCondAfterSync.isDone || freshCondAfterSync.current >= freshCondAfterSync.total) {
    this.pushLog(`[thợ câu] server xác nhận hoàn thành "${next.name}".`);
    break;
  }
  if (freshCondAfterSync.current > next.current) {
    this.pushLog(`[thợ câu] tiến độ server: ${freshCondAfterSync.current}/${freshCondAfterSync.total}.`);
  }
  this.updateFishermanQuest({ phase: 'fishing' });
  this.emitAutomation();
}
```

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### 4.1. Kiểm Tra Biên Dịch Type (Type Check)
- Chạy: `npm run build` trong `avatar-web/server`.
- Đảm bảo không có lỗi TypeScript liên quan đến kiểu trả về `Promise<void>` hay các tham số `force`.

### 4.2. Kiểm Tra Thủ Công Logic (Scenario Verification)
1. **Kịch bản chuyển bước nhiệm vụ (21 $\rightarrow$ 22)**:
   - Mô phỏng/kích hoạt tài khoản đang ở nhiệm vụ 21.
   - Khi nhiệm vụ 21 hoàn thành, quan sát log:
     - `[thợ câu] phát hiện nhiệm vụ thay đổi...` kích hoạt ngay lập tức.
     - Bot hủy vòng câu cua ở Map 15.
     - Bot scan lại, nhận diện nhiệm vụ 22: `"Câu 100 con cá vàng"` $\rightarrow$ map 27.
     - Bot di chuyển sang Map 27, mua vé bến tàu và bắt đầu câu cá vàng.
2. **Kịch bản bấm nút 🔄 Làm mới từ web**:
   - Khi bot đang câu, người dùng bấm nút làm mới trên UI.
   - Listener `client.on('quests')` kích hoạt `wakeFishermanQuest()`.
   - Vòng lặp thức dậy ngay trong vòng 1s, kiểm tra lại dữ liệu mới nhất mà không phải chờ 180s.
