# Thiết Kế Kiến Trúc — Tự Động Thử Lại và Chuyển Sang Auto Farm Khi Auto Câu Cá & Nhiệm Vụ Thợ Câu Gặp Lỗi

> **Ngày:** 2026-10-09  
> **Chủ đề:** `fishing-auto-retry-fallback`  
> **Trạng thái:** Đã duyệt thiết kế sơ bộ — Chờ User Review Spec (User Review Gate — Bước 1/3 theo CLAUDE.md)  
> **Tài liệu tham chiếu:**  
> - `docs/superpowers/specs/2026-08-26-auto-fishing-design.md`  
> - `docs/superpowers/specs/2026-09-11-auto-fisherman-quest-design.md`  
> - `docs/superpowers/specs/2026-09-23-fix-fisherman-quest-target-switch-design.md`  
> - `docs/superpowers/specs/2026-10-09-auto-mining-fallback-to-farm-when-no-tool-design.md`  
> - `avatar-web/server/src/session/avatarSession.ts`  

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Bối Cảnh
Hiện tại trong hệ thống `avatar-web`, hai chế độ tự động liên quan đến câu cá gồm:
1. `auto_fishing`: Tự động câu cá liên tục theo cấu hình hồ/khu vực/loại mồi.
2. `auto_fisherman_quest`: Tự động nhận diện nhiệm vụ Thợ Câu, chọn cá & map tương ứng, tiến hành câu cho đến khi hoàn thành điều kiện rồi chuyển sang nhiệm vụ tiếp theo.

Trong quá trình vận hành thực tế, phiên câu cá có thể bị dừng do nhiều lỗi khách quan từ phía server game hoặc trạng thái tài khoản:
- Vào map câu cá thất bại (lỗi handshake RX90, lỗi mạng, hoặc server từ chối joinPark sau số lần thử lại).
- Server từ chối lệnh bắt đầu câu `TX45 startFishing` (ví dụ: hết tiền xu mua mồi, hết vé vào hồ 16/27 hoặc lỗi mua vé, lỗi dialog server).
- Rương cá bị đầy nhưng bán cá tại Lái Buôn thất bại.
- Nhận dialog bất thường không thể tiếp tục câu (`fishingRuntime.status = 'rejected'`).
- Với nhiệm vụ thợ câu: tên cá trong nhiệm vụ không nhận diện được map/loại cá, hoặc vòng lặp câu cá bên dưới bị chết nhưng vòng ngoài `runFishermanQuestLoop` không phát hiện được nên bị treo (stuck) vĩnh viễn ở trạng thái chờ.

Khi các lỗi trên xảy ra, hiện tại auto chỉ dừng lại và ghi log lỗi, nhân vật đứng im tại map hoặc sảnh chờ mà không có cơ chế tự phục hồi, cũng không chuyển sang làm việc khác (như chăm sóc nông trại).

### 1.2 Mục Tiêu Cụ Thể
1. **Tự động thử lại tối đa 3 lần:** Khi gặp bất kỳ lỗi nào khiến vòng lặp câu cá hoặc nhiệm vụ thợ câu bị dừng, tự động khởi động lại chế độ đó từ đầu tối đa 3 lần (`MAX_FISHING_RETRIES = 3`).
2. **Dừng auto trước khi thử lại:** Khi phát hiện lỗi cần retry, **bắt buộc phải dừng toàn bộ tiến trình auto hiện tại trước** (`await this.stopActiveAutomation(generation)`): hủy các AbortController, dọn dẹp các timer/runner, gửi `client.cauCaXong()`, hủy lịch hẹn periodic farm. Sau đó nghỉ 5 giây rồi mới khởi động lại từ đầu (`startDesiredAutomation`) kèm log thông báo rõ ràng (`[câu cá] / [thợ câu] Gặp lỗi dừng câu: <lý do>. Đã dừng auto, khởi động lại từ đầu (lần X/3) sau 5s...`).
3. **Reset bộ đếm retry hợp lý:** Khi câu thành công (bắt được cá) hoặc nhiệm vụ thợ câu có tiến triển, hoặc người dùng chủ động chuyển/bật/tắt mode, bộ đếm retry sẽ được đặt lại về 0.
4. **Fallback sang `auto_farm`:** Nếu đã thử lại 3 lần mà vẫn tiếp tục gặp lỗi khiến dừng câu, ghi log thông báo và tự động chuyển sang chế độ tự động nông trại (`auto_farm`) thông qua `switchAutomationMode`.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Quản lý Session (`avatar-web/server/src/session/avatarSession.ts`):**
   - Thêm thuộc tính `fishingRetryCount: number = 0` và hằng số tĩnh `MAX_FISHING_RETRIES = 3`.
   - Tạo phương thức điều phối lỗi tập trung: `handleFishingFailure(client, generation, epoch, reason, mode)`.
   - Bắt các trường hợp lỗi khiến dừng câu trong `startFishingLoop` khi ở chế độ `auto_fishing`:
     - `prepareFishingAtPark` trả về `false` (không phải do abort/offline).
     - `startFishingSession` trả về `false` (server từ chối start, mua mồi thất bại).
     - Vòng lặp quăng cần gặp lỗi dialog lạ hoặc bán cá thất bại dẫn tới `fishingRuntime.status === 'rejected'`.
     - Vòng lặp quăng cần bị văng exception (`catch (err)`).
   - Phát hiện lỗi trong `runFishermanQuestLoop` khi ở chế độ `auto_fisherman_quest`:
     - Kiểm tra nếu `this.fishingRuntime.status === 'rejected'` trong chu kỳ chờ tiến độ để kịp thời bắt lỗi từ vòng câu cá con.
     - Lỗi phân giải cá nhiệm vụ (`!resolved.ok`).
     - Lỗi exception trong vòng lặp quest (`catch (err)` trong `startFishermanQuestLoop`).
   - Xử lý chuyển chế độ sang `auto_farm` khi `fishingRetryCount >= 3`.
   - Reset `fishingRetryCount = 0` khi:
     - Nhận sự kiện câu được cá `fishing-success-result`.
     - Đồng bộ tiến độ nhiệm vụ thợ câu thành công/hoàn thành.
     - Người dùng chủ động chuyển hoặc bật tắt mode qua `switchAutomationMode`.

### 2.2 Out-of-Scope
- Không thay đổi giao diện người dùng (UI) vì cơ chế retry và fallback diễn ra hoàn toàn tự động ở backend session coordinator.
- Không can thiệp vào cơ chế ngắt kết nối mạng / socket disconnect (đã do hệ thống reconnect của `AvatarSession` phụ trách).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Files Liên Quan

| File | Vai Trò | Chi Tiết Thay Đổi |
| :--- | :--- | :--- |
| `avatar-web/server/src/session/avatarSession.ts` | Session Coordinator | Thêm `fishingRetryCount`, `MAX_FISHING_RETRIES`, phương thức `handleFishingFailure`, phát hiện lỗi dừng câu trong cả 2 mode `auto_fishing` và `auto_fisherman_quest`, chuyển mode sang `auto_farm` sau 3 lần lỗi. |

### 3.2 Luồng Hoạt Động (Flow Diagram)

```
[Chế độ: auto_fishing HOẶC auto_fisherman_quest]
                       │
                       ▼
       Phát hiện lỗi khiến dừng câu?
       (status === 'rejected' HOẶC phase === 'stopped' HOẶC throw error)
                       │
         ┌─────────────┴─────────────┐
         │ Có                        │ Không (hoạt động bình thường)
         ▼                           ▼
[Kiểm tra điều kiện hợp lệ]     [Câu được cá / có tiến triển quest]
- !signal.aborted?                   │
- desiredMode trùng khớp?            ▼
- client.status === 'online'?   [Reset fishingRetryCount = 0]
- generation/epoch hiện tại?
         │
         ▼
fishingRetryCount < 3?
  ├── ĐÚNG (< 3):
  │     1. fishingRetryCount += 1
  │     2. Log: "[mode] Gặp lỗi dừng câu: <reason>. Dừng auto, khởi động lại từ đầu (lần X/3) sau 5s..."
  │     3. GỌI DỪNG AUTO TRƯỚC: await this.stopActiveAutomation(generation)
  │     4. Sleep 5s (sleepAbortable)
  │     5. Khởi động lại: await this.startDesiredAutomation(client, generation, epoch)
  │
  └── SAI (>= 3):
        1. Log: "[mode] Đã thử lại 3 lần thất bại do lỗi <reason>. Chuyển sang chế độ tự động nông trại."
        2. fishingRetryCount = 0
        3. Gọi switchAutomationMode({ desiredMode: 'auto_farm', ... })
```

### 3.3 Chi Tiết Cài Đặt Tại `avatarSession.ts`

#### 1. Định nghĩa thuộc tính và hằng số
```typescript
private fishingRetryCount = 0;
private static readonly MAX_FISHING_RETRIES = 3;
```

#### 2. Xử lý thất bại tập trung `handleFishingFailure`
```typescript
private async handleFishingFailure(
  client: GameClient,
  generation: number,
  epoch: number,
  reason: string,
  mode: 'auto_fishing' | 'auto_fisherman_quest',
): Promise<void> {
  if (
    !this.isAutomationGenerationCurrent(generation)
    || !this.isCurrent(client, epoch)
    || client.status !== 'online'
    || this.desiredMode !== mode
  ) {
    return;
  }

  const modeTag = mode === 'auto_fishing' ? '[câu cá]' : '[thợ câu]';

  if (this.fishingRetryCount < AvatarSession.MAX_FISHING_RETRIES) {
    this.fishingRetryCount += 1;
    this.pushLog(
      `${modeTag} Gặp lỗi khiến dừng câu: ${reason}. Đã dừng auto, khởi động lại từ đầu (lần ${this.fishingRetryCount}/${AvatarSession.MAX_FISHING_RETRIES}) sau 5s...`,
    );

    // BẮT BUỘC DỪNG AUTO TRƯỚC: abort mọi controller, hủy timer/farm schedule, gửi cauCaXong()
    await this.stopActiveAutomation(generation);

    await this.sleepAbortable(5_000, new AbortController().signal);

    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.isCurrent(client, epoch)
      || client.status !== 'online'
      || this.desiredMode !== mode
    ) {
      return;
    }

    this.pushLog(`${modeTag} Bắt đầu khởi động lại chế độ từ đầu (lần ${this.fishingRetryCount})...`);
    this.fishingRuntime.status = 'idle';
    this.fishingRuntime.lastError = null;

    // Khởi động lại mode từ đầu thông qua startDesiredAutomation
    await this.startDesiredAutomation(client, generation, epoch);
  } else {
    this.pushLog(
      `${modeTag} Đã thử lại ${AvatarSession.MAX_FISHING_RETRIES} lần nhưng vẫn gặp lỗi ("${reason}"). Chuyển sang chế độ tự động nông trại.`,
    );
    this.fishingRetryCount = 0;
    this.fishingRuntime.status = 'idle';
    this.fishingRuntime.lastError = null;

    void this.switchAutomationMode({
      desiredMode: 'auto_farm',
      findNpcConfig: this.findNpcConfig,
      fishingConfig: this.fishingConfig,
      miningConfig: this.miningConfig,
      mazeConfig: this.mazeConfig,
      schoolConfig: this.schoolConfig,
      location: this.automationLocation,
    });
  }
}
```

#### 3. Bắt lỗi trong `startFishingLoop`
Trong `startFishingLoop`:
```typescript
void (async () => {
  let failureReason: string | null = null;
  try {
    await this.runFishingLoop(client, generation, epoch, abort.signal);
  } catch (err) {
    failureReason = (err as Error).message;
    if (
      !abort.signal.aborted
      && this.fishingAbortController === abort
      && this.isAutomationGenerationCurrent(generation)
      && this.isCurrent(client, epoch)
    ) {
      this.pushLog(`[câu cá] lỗi vòng lặp: ${failureReason}`);
    }
  } finally {
    if (this.fishingAbortController === abort) {
      this.cancelFishingFarmSchedule();
      this.fishingAbortController = undefined;
    }
  }

  // Nếu vòng lặp dừng do lỗi và đang ở chế độ auto_fishing (không phải do user abort hay disconnect)
  if (
    !abort.signal.aborted
    && this.desiredMode === 'auto_fishing'
    && this.isAutomationGenerationCurrent(generation)
    && this.isCurrent(client, epoch)
    && client.status === 'online'
  ) {
    if (this.fishingRuntime.status === 'rejected' || failureReason !== null) {
      const reason = failureReason ?? this.fishingRuntime.lastError ?? 'Lỗi không xác định';
      void this.handleFishingFailure(client, generation, epoch, reason, 'auto_fishing');
    }
  }
})();
```

#### 4. Bắt lỗi trong `runFishermanQuestLoop` & `startFishermanQuestLoop`
- Trong vòng lặp chờ tiến độ `for (;;)` của `runFishermanQuestLoop`:
  ```typescript
  // Nếu vòng lặp câu cá bị lỗi dừng lại (status === 'rejected')
  if (this.fishingRuntime.status === 'rejected') {
    const reason = this.fishingRuntime.lastError ?? 'Vòng lặp câu cá bị từ chối';
    this.pushLog(`[thợ câu] phát hiện vòng lặp câu cá bị lỗi: ${reason}`);
    this.updateFishermanQuest({ phase: 'stopped', lastError: reason });
    this.emitAutomation();
    throw new Error(reason);
  }
  ```
- Nếu `!resolved.ok` (không nhận diện được cá):
  ```typescript
  if (!resolved.ok) {
    const message = `Không nhận diện được cá "${resolved.unknownName}" trong quest "${quest.title}"`;
    this.pushLog(`[thợ câu] ${message}, kích hoạt thử lại/fallback.`);
    this.updateFishermanQuest({ phase: 'stopped', lastError: message });
    this.emitAutomation();
    throw new Error(message);
  }
  ```
- Trong `startFishermanQuestLoop`:
  Khi `runFishermanQuestLoop` kết thúc hoặc bị throw error, nếu `!abort.signal.aborted` và `desiredMode === 'auto_fisherman_quest'`, kích hoạt `this.handleFishingFailure(..., 'auto_fisherman_quest')`.

#### 5. Reset `fishingRetryCount`
- Reset khi có cá cắn câu và câu thành công:
  Tại sự kiện `client.on('fishing-success-result')`:
  ```typescript
  this.fishingRetryCount = 0;
  ```
- Reset khi nhiệm vụ thợ câu có tiến độ mới:
  Tại `runFishermanQuestLoop`:
  ```typescript
  if (freshCondAfterSync.current > next.current) {
    this.fishingRetryCount = 0;
  }
  ```
- Reset khi chuyển chế độ qua `switchAutomationMode`:
  ```typescript
  this.fishingRetryCount = 0;
  ```

---

## 4. Kế Hoạch Kiểm Tra (Verification Plan)

### 4.1 Automated Tests
1. Chạy bộ unit test hiện có của `avatarSession`:
   ```bash
   cd avatar-web/server && npm test -- src/session/avatarSession.test.ts
   ```
   Kỳ vọng: Toàn bộ 275 tests đều PASS.
2. Kiểm tra biên dịch TypeScript toàn dự án:
   ```bash
   cd avatar-web/server && npm run build
   ```
   Kỳ vọng: Không có lỗi type check nào.

### 4.2 Manual Verification Trực Tiếp
1. **Kiểm tra retry câu cá khi lỗi:**
   - Kích hoạt `auto_fishing` ở tài khoản không có vé/không đủ tiền hoặc giả lập lỗi dialog `rejected`.
   - Quan sát log phiên: Session ghi log thử lại lần 1/3, lần 2/3, lần 3/3 với khoảng nghỉ 5s.
   - Sau lần 3 vẫn lỗi: Session ghi log chuyển sang `auto_farm` và `activeMode` chuyển thành `auto_farm`.
2. **Kiểm tra reset đếm:**
   - Khi câu thành công 1 con cá, kiểm tra `fishingRetryCount` trở về 0.
3. **Kiểm tra thợ câu:**
   - Thử nghiệm trên `auto_fisherman_quest`, khi gặp cá không hỗ trợ hoặc lỗi vào map, vòng lặp thợ câu tự khởi động lại từ đầu, sau 3 lần tự chuyển sang `auto_farm`.
