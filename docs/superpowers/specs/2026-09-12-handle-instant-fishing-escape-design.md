# Thiết Kế Xử Lý Cá Chạy Mất Tiêu / Giật Hụt Khi Câu Cá

> **Ngày lập:** 2026-09-12  
> **Trạng thái:** Chờ User Review  
> **Tài liệu liên quan:** `docs/superpowers/plans/2026-09-10-auto-fishing-periodic-farm.md`, `docs/superpowers/specs/2026-09-12-daily-fishing-statistics-design.md`

## 1. Mục tiêu & bối cảnh

Video thực tế từ game (`ScreenRecording_09-10-2026 13-57-38_1.mp4`, 60fps) ghi lại một lượt câu:

1. Server gửi RX 79 (CAN_CAU) → client hiển thị thanh minigame mũi tên.
2. Chỉ sau ~580ms (frame 138 → 173), server **chủ động kết thúc lượt câu bằng thất bại**: RX 43 (CAU_THANH_CONG) với `idFish = -1` (game bay chữ "Trật rồi! :(").
3. Ngay sau đó server gửi dialog opcode -40: **"Cá đã chạy mất tiêu rồi"**.
4. Người chơi không kịp và không cần giải minigame.

Ba lỗi hiện tại trong `avatar-web/server/src/session/avatarSession.ts`:

### Lỗi 1 — Race condition gửi phím lạc nhịp (late TX 43)

`handleFishingChallenge` (dòng ~3409) nhận RX 79 và ngủ mô phỏng người thật
(`FISHING_HUMAN_TIMING`: perception 700–1200ms + per_key 300–520ms/phím,
tổng 2.5s–4.3s). Server đã gửi `idFish = -1` sau 580ms nhưng **không ai hủy
pending challenge solver**: `fishingChallengeGeneration` chỉ tăng ở `stop()`,
`failPermanently()`, `onDisconnected()`, `teardown()`, `serviceDueFishingFarm()`
và khi RX 79 mới đến. Solver thức dậy 2–3s sau vẫn đi qua Pre-Send Gate
(dòng 3465: `this.fishingChallengeGeneration !== challengeGen` — false vì
generation không đổi), gửi TX 43 muộn màng ngoài luồng.

### Lỗi 2 — Crash / Dừng auto do dialog sổng cá

Dialog "Cá đã chạy mất tiêu rồi" (opcode -40) **không được
`isInformationalDialog` lọc** (không khớp bất kỳ mục nào trong
`isInformationalDialog`), nên `catchPromise` trong `runFishingLoop` resolve với
nội dung dialog → rơi vào nhánh fallback (dòng 3223-3227):

```ts
// Dialog không nhận diện được — dừng câu
this.fishingRuntime.status = 'rejected';
this.fishingRuntime.lastError = catchResult;
...
return; // DỪNG HẲN AUTO CÂU CÁ
```

### Lỗi 3 — Sai trạng thái UI khi sổng cá

Trong `client.on('fishing-success-result')` (dòng 1114-1117), khi `idFish < 0`:

```ts
this.fishingRuntime.status = 'rejected';
this.fishingRuntime.lastError = `Giật hụt / sổng cá (${ev.idFish})`;
```

Đây chỉ là một lượt câu trượt bình thường (vòng lặp tự reset và quăng tiếp),
không phải lỗi fatal — UI web bị đỏ oan.

## 2. Phạm vi

### 2.1. In-scope

- Cơ chế hủy hiệu lực pending challenge solver: method
  `cancelPendingFishingChallenge()` (bump `fishingChallengeGeneration`),
  gọi khi nhận `fishing-success-result` (thành công hoặc thất bại), khi
  dialog sổng cá, và trước mỗi lần quăng cần mới.
- Nhận diện dialog cá chạy mất / sổng cá trong `runFishingLoop`: log, hủy
  solver, `cauCaXong`, delay 1s, kiểm tra farm, `startFishingSession`,
  `continue` vòng lặp — KHÔNG `return`, KHÔNG set `status = 'rejected'`.
- Trong `fishing-success-result`: `idFish < 0` chỉ log, giữ nguyên
  `fishingRuntime.status` (vòng lặp tự set `casting` ở lượt mới), không set
  `lastError`, không set `rejected`.
- Compile sạch: `npm run build -w avatar-web/server`.

### 2.2. Out-of-scope

- Sửa protocol, opcode, `GameClient`, ML/inference, `isInformationalDialog`
  (dialog sổng cá được xử lý chủ động trong `runFishingLoop`, không thêm vào
  danh sách bỏ qua).
- Sửa web frontend, snapshot contract, `FishingRuntimeState` type.
- Thay đổi timing mô phỏng người thật (`FISHING_HUMAN_TIMING`) — chỉ đảm bảo
  giải pháp chặn được TX 43 khi lượt đã kết thúc.
- Tạo/sửa test files.

## 3. Input, output và trường hợp biên

### 3.1. Sự kiện đầu vào

```ts
// GameClient emit — fish-challenge (RX 79)
interface CanCauPayload { idUser: number; /* ... */ }

// GameClient emit — fishing-success-result (RX 43)
interface FishingSuccessResult { idUser: number; idFish: number }

// GameClient emit — dialog (opcode -40)
type DialogReason = string;
```

### 3.2. Luồng mong muốn khi cá chạy mất

```
RX 79 ──> handleFishingChallenge ──> solver ngủ (2.5–4.3s)
RX 43 (idFish = -1) ──> fishing-success-result handler:
                          ├─ cancelPendingFishingChallenge()   [gen++]
                          ├─ log "giật hụt / sổng cá" (KHÔNG rejected)
                          └─ emitAutomation()
Dialog -40 "Cá đã chạy mất tiêu rồi" ──> onCastDialog ──> nhánh mới:
                          ├─ log
                          ├─ cancelPendingFishingChallenge()   [gen++]
                          ├─ try { client.cauCaXong(); } catch {}
                          ├─ delayCancellable(1000)
                          ├─ fishingFarmDue? → serviceDueFishingFarm
                          ├─ startFishingSession(...)
                          └─ continue  (KHÔNG return, KHÔNG rejected)
Solver cũ thức dậy ──> Pre-Send Gate: generation ≠ challengeGen ──> return
```

### 3.3. Các trường hợp biên

| Tình huống | Trước | Sau |
| --- | --- | --- |
| RX 43 `idFish >= 0` (bắt được cá) | solver pending có thể gửi TX 43 sau khi server đã chốt | `cancelPendingFishingChallenge()` ở đầu handler chặn solver |
| RX 43 `idFish = -1` (sổng cá) | `status = 'rejected'`, UI đỏ | chỉ log, giữ status, vòng lặp tự reset |
| Dialog -40 "Cá đã chạy mất tiêu rồi" | fallback "không nhận diện" → `return`, dừng hẳn auto | nhánh mới: log + cancel + cauCaXong + delay 1s + startFishingSession + `continue` |
| Solver thức dậy muộn (generation đã bump) | gửi TX 43 lạc nhịp | Pre-Send Gate chặn (không cần await thêm) |
| Lượt câu timeout 35s (`catchResult === false`) | reset phiên | như cũ + solver hủy bởi cancel trước `quanCau()` |
| Farm định kỳ tới giữa xử lý sổng cá | — | nhánh `fishingFarmDue` như các nhánh reset khác |

### 3.4. Thứ tự từ khóa nhận diện dialog

Trong nhánh `typeof catchResult === 'string'` của `runFishingLoop`, chèn nhánh
sổng cá **sau** nhánh rương đầy (cần bán cá trước) và **trước** nhánh
`castMissingType` (cần mua vé/mồi/cần). Từ khóa khớp (lowercase):
`'chạy mất'`, `'sổng cá'`, `'trật rồi'` — dialog thực tế
"Cá đã chạy mất tiêu rồi" chứa `'chạy mất'`.

## 4. Kiến trúc & giải pháp kỹ thuật

### 4.1. Files liên quan

| File | Vai trò |
| --- | --- |
| `avatar-web/server/src/session/avatarSession.ts` | Toàn bộ thay đổi (1 file) |

### 4.2. Method mới — `cancelPendingFishingChallenge()`

```ts
/**
 * Hủy hiệu lực mọi pending fishing challenge solver: bump generation để
 * Pre-Send Gate trong handleFishingChallenge chặn TX 43 khi lượt câu đã
 * kết thúc (RX 43 thành công/thất bại, dialog sổng cá, hoặc quăng cần mới).
 */
private cancelPendingFishingChallenge(): void {
  this.fishingChallengeGeneration += 1;
}
```

Tái sử dụng cơ chế generation đã có (đồng bộ, không cần await, không rò rỉ
timer; solver đang ngủ trong `delayCancellable` sẽ wake bình thường nhưng bị
chặn bởi gate đồng bộ ngay sau đó).

### 4.3. Các điểm gọi

| Điểm gọi | Vị trí | Lý do |
| --- | --- | --- |
| Đầu `client.on('fishing-success-result')` sau guard `idUser` | dòng ~1090 | Kết quả RX 43 (dù ≥ 0 hay < 0) chốt lượt câu — solver không còn cần TX 43 |
| Nhánh dialog sổng cá mới trong `runFishingLoop` | dòng ~3193 | Server đã chủ động kết thúc lượt bằng dialog |
| Ngay trước `client.quanCau()` trong vòng while | dòng ~3119 | Lượt câu mới bắt đầu, solver của lượt cũ phải chết |

Điểm gọi "trước `quanCau()`" phủ mọi đường kết thúc lượt không đi qua RX 43
(timeout 35s, dialog khác, farm) và phòng trường hợp RX 43 của lượt trước về
muộn sau khi vòng lặp đã quăng tiếp.

Lưu ý an toàn chuỗi sự kiện: RX 43 → cancel → server chưa gửi RX 79 mới →
challenge mới chưa tồn tại → không có solver mới bị hủy nhầm. RX 79 mới sẽ
`++this.fishingChallengeGeneration` tạo gen mới như cũ.

### 4.4. Thay đổi `fishing-success-result` handler

```ts
// Đầu handler, sau guard idUser:
this.cancelPendingFishingChallenge();

if (ev.idFish >= 0) {
  // ...giữ nguyên (totalCatches, stats, status = 'caught')
} else {
  // Lượt trượt bình thường — không phải lỗi fatal. Vòng lặp runFishingLoop
  // sẽ reset qua catchResult === false (RX 43 của chính vòng lặp) hoặc
  // nhánh dialog sổng cá; không set status='rejected', không set lastError.
  this.pushLog(`[câu cá] giật hụt hoặc sổng cá (mã ${ev.idFish}) — lượt này không bắt được cá`);
}
this.emitAutomation();
```

### 4.5. Nhánh mới trong `runFishingLoop` (sau rương đầy, trước castMissingType)

```ts
// Dialog cá chạy mất / sổng cá / trật rồi — server tự chốt lượt hỏng,
// chỉ cần reset phiên và quăng cần tiếp, KHÔNG dừng auto.
if (
  castErrText.includes('chạy mất')
  || castErrText.includes('sổng cá')
  || castErrText.includes('trật rồi')
) {
  this.pushLog(`[câu cá] ${catchResult} — bỏ qua, quăng cần tiếp…`);
  this.cancelPendingFishingChallenge();
  try { client.cauCaXong(); } catch { /* bỏ qua */ }
  await this.delayCancellable(1000, signal);
  if (this.fishingFarmDue) {
    const action = await this.serviceDueFishingFarm(client, generation, epoch, signal);
    if (action === 'stop') return;
    continue;
  }
  if (!(await this.startFishingSession(client, generation, epoch, signal))) return;
  continue;
}
```

## 5. Verification Plan

1. `npm run build -w avatar-web/server` — TypeScript compile sạch (bắt buộc).
2. Text search xác nhận các điểm gọi `cancelPendingFishingChallenge` đúng vị
   trí (3 điểm) và không còn `status = 'rejected'` trong nhánh `idFish < 0`.
3. `git diff --check` — không whitespace error.
4. GitNexus index đã biết stale + CLI rebuild fail (`@ladybugdb/core`
   node-gyp `spawnSync /bin/sh ENOENT`) + MCP tool báo input-validation error:
   chạy `impact`/`detect_changes` theo quy trình, ghi nhận cảnh báo, bù bằng
   text search (danh sách gọi/định nghĩa ở mục 3 của 4.2–4.5) và
   `git diff --name-only` trước mỗi commit.
5. Manual (user, có video làm chuẩn): chạy auto_fishing ở hồ — lượt sổng cá
   phải log "bỏ qua, quăng cần tiếp…", không có TX 43 lạc nhịp trong traffic,
   UI không đỏ, vòng lặp tiếp tục.