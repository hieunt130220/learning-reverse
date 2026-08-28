# Fishing Data Crawler — Design Document

- **Ngày:** 2026-08-28
- **Trạng thái:** Chờ user duyệt
- **Nguồn protocol:** `avatar-re/notes/fishing.md`
- **Phạm vi:** Mở rộng `fishing-probe.ts` thành crawler loop tự động thu thập ≥200 batch RX79 cho ML training dataset (Giai đoạn A).

## 1. Mục tiêu & Bối cảnh

Pipeline ML câu cá (`avatar-web/fishing-ml`) cần **200 batch** (≥1.000 labeled `arrImgNew`) để huấn luyện model matching ảnh. Hiện tại:

- `fishing-probe.ts` đã có khả năng: login → vào Park → join map → gửi TX45 → nhận RX79 → lưu **1 batch** rồi thoát.
- `saveCanCauBatch()` trong `fishingDecode.ts` đã production-ready: validate PNG 75×75, SHA-256, manifest schema v1, atomic write.
- **Chưa có batch nào** trong `data/raw/` — dataset hoàn toàn trống.

**Vấn đề:** Probe hiện tại chỉ capture đúng 1 batch rồi thoát. Để thu thập 200 batch, cần loop tự động theo đúng protocol fishing:

```text
TX45 (doStartFishing) → RX45 (iss=true) → TX41 (doQuanCau) → RX79 (CAN_CAU + ảnh)
  → lưu batch (KHÔNG TX43) → TX44 (doCauCaXong) → delay → lặp lại
```

Mỗi vòng kết thúc bằng TX44 (`doCauCaXong`) để server biết client đóng màn câu cá, rồi delay trước khi bắt đầu vòng mới.

## 2. Phạm vi (Scope)

### 2.1 In-scope

- Mở rộng `fishing-probe.ts` thêm mode `--crawl` loop liên tục.
- Loop: TX45 → chờ RX45 → TX41 → chờ RX79 → `saveCanCauBatch()` → TX44 → delay → lặp.
- Dừng khi đạt `--target 200` batch thành công hoặc quá 50 lỗi liên tiếp.
- Progress log mỗi batch: `[42/200] batchId=probe_xxx img=6 new=5 (3.2s)`.
- Graceful shutdown khi SIGINT/SIGTERM: đợi batch hiện tại ghi xong rồi thoát.
- Output dir mặc định `avatar-web/fishing-ml/data/raw/`.
- Delay giữa các vòng mặc định 2000ms (`--delay-ms`), tối thiểu 1000ms.
- Thống kê cuối cùng: tổng batch, tổng ảnh, thời gian, tỷ lệ lỗi.

### 2.2 Out-of-scope

- **Không gửi TX43** (không submit đáp án) — chỉ capture offline (Giai đoạn A).
- Không gán nhãn tự động.
- Không multi-account/multi-map.
- Không retry login nếu bị kick (fail fast, user chạy lại).
- Không viết test files trừ khi user yêu cầu.

### 2.3 Input, output và edge cases

**Input CLI:**
```bash
npx tsx src/tools/fishing-probe.ts \
  --account-id 1 --map 5 --area 0 \
  --output-dir ../fishing-ml/data/raw \
  --crawl --target 200 --delay-ms 2000
```

**Output:** 200 batch directories trong `data/raw/`, mỗi batch có cấu trúc:
```text
data/raw/<batchId>/
├── manifest.json
├── img/0.png ... img/N.png
└── new/0.png ... new/M.png
```

**Edge cases:**

| Tình huống | Hành vi |
|---|---|
| RX45 `iss=false` (không được phép câu) | Log error reason, delay 5s, thử lại. Sau 10 lần liên tục → abort |
| RX79 timeout (10s không nhận) | Gửi TX44 kết thúc vòng, tăng error counter, thử lại |
| PNG hỏng/sai kích thước | `saveCanCauBatch()` throw → skip batch, tăng error counter |
| `batchId` collision | Gần không thể (timestamp + random hex), nếu xảy ra → skip, tăng error |
| Socket đóng bất ngờ | Abort toàn bộ, in thống kê, exit code 1 |
| SIGINT/SIGTERM | Đợi batch hiện tại ghi xong, in thống kê, exit code 0 |
| 50 lỗi liên tiếp | Abort — có thể server ban hoặc lỗi nghiêm trọng |
| Không có `arrImgNew` (legacy RX79) | Skip batch (ineligible), tăng skip counter |

## 3. Kiến trúc & Giải pháp Kỹ thuật

### 3.1 Thay đổi duy nhất: `fishing-probe.ts`

Không tạo file mới. Mở rộng `fishing-probe.ts` hiện có:

- Thêm 3 CLI flags: `--crawl`, `--target N`, `--delay-ms N`.
- Khi `--crawl` bật → thay thế single-batch logic bằng crawler loop.
- Khi không có `--crawl` → giữ nguyên hành vi probe hiện tại (backward compatible).

### 3.2 Crawler loop pseudo-code

```typescript
// Phase "fishing-crawl" thay thế "fishing-test" khi --crawl
let saved = 0;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 50;

while (saved < target && consecutiveErrors < MAX_CONSECUTIVE_ERRORS && !shuttingDown) {
  // 1. TX45 → chờ RX45 (start fishing)
  sendRaw(45, []);
  const startResult = await waitForRx45(8_000); // 8s timeout
  if (!startResult.iss) {
    log(`start rejected: ${startResult.error}`);
    consecutiveErrors++;
    await delay(5_000);
    continue;
  }

  // 2. TX41 → quăng cần
  sendRaw(41, []);

  // 3. Chờ RX79 CAN_CAU
  const payload = await waitForRx79(10_000); // 10s timeout
  if (!payload || !payload.imagesNew?.length) {
    // Timeout hoặc legacy batch → kết thúc vòng
    sendRaw(44, []); // TX44 đóng màn
    consecutiveErrors++;
    await delay(delayMs);
    continue;
  }

  // 4. Lưu batch (immutable, atomic)
  try {
    const batch = await saveCanCauBatch(payload, { outputDir, tag: 'crawl', map, area });
    saved++;
    consecutiveErrors = 0;
    log(`[${saved}/${target}] ${batch.batchId} img=${batch.imageCount} new=${batch.imageNewCount}`);
  } catch (error) {
    consecutiveErrors++;
    log(`save error: ${error.message}`);
  }

  // 5. TX44 → đóng màn câu cá (bắt buộc để server reset state)
  sendRaw(44, []);

  // 6. Delay trước vòng mới
  await delay(delayMs);
}
```

### 3.3 Protocol flow tuân thủ

Dựa trên `avatar-re/notes/fishing.md` đã verified:

```text
Vòng N:
  client → TX45 (doStartFishing, body rỗng)
  server → RX45 (START_CAU_CA: bool iss [+ utf error])
  
  [nếu iss=true:]
    client → TX41 (doQuanCau, body rỗng)
    server → RX41 (QUANG_CAU: i32 idUser) — broadcast, bỏ qua
    server → RX79 (CAN_CAU: arrImg + arrImgNew)
    
    → Capture & save batch
    → KHÔNG TX43 (không submit đáp án)
    
    client → TX44 (doCauCaXong, body rỗng)
    server → RX44 (CAU_CA_XONG: i32 idUser) — bỏ qua
  
  [delay --delay-ms]
  
  → Vòng N+1
```

**Lưu ý quan trọng:**
- TX43 (doFinishFishing) bị bỏ qua **có chủ đích** — server vẫn gửi RX44 kết thúc vòng.
- TX44 (doCauCaXong) BẮT BUỘC gửi để server reset state câu cá, nếu không vòng sau TX45 sẽ bị reject.
- RX46 (STATUS_FISH) và RX-111 (INFO_FISH) có thể đến bất kỳ lúc nào, bỏ qua trong crawler.

### 3.4 Graceful shutdown

```typescript
let shuttingDown = false;
process.on('SIGINT', () => { shuttingDown = true; });
process.on('SIGTERM', () => { shuttingDown = true; });

// Trong loop: kiểm tra shuttingDown trước mỗi vòng mới
// Không interrupt giữa saveCanCauBatch() — đợi ghi xong
```

### 3.5 Thống kê cuối

```json
{
  "totalSaved": 187,
  "totalSkipped": 3,
  "totalErrors": 5,
  "totalElapsedMs": 1234567,
  "avgBatchMs": 6600,
  "map": 5,
  "area": 0,
  "outputDir": "avatar-web/fishing-ml/data/raw"
}
```

## 4. Ràng buộc

- `ParkService.NATIVE_PARK_JOIN_POSITIONS` hiện chỉ có map 5 (`{x:254, y:82}`). Crawler dùng map 5 là an toàn nhất.
- Fishing spec nói map 14 area 0 là khu cá rô live-verify, nhưng `NATIVE_PARK_JOIN_POSITIONS` chưa có entry cho map 14. Nếu cần map 14, phải bổ sung coordinates trước — **out-of-scope cho crawler này**.
- Delay tối thiểu 1000ms để tránh rate limit server.
- Tag batch là `crawl` (thay vì `probe`) để phân biệt nguồn gốc.

## 5. Verification Plan

Vì project không dùng TDD, verification thực hiện bằng chạy thực tế:

1. **Dry run 5 batches:**
   ```bash
   npx tsx src/tools/fishing-probe.ts \
     --account-id 1 --map 5 --area 0 \
     --output-dir /tmp/fishing-crawl-test \
     --crawl --target 5 --delay-ms 2000
   ```
   - Xác nhận 5 thư mục batch trong output dir.
   - Mỗi batch có `manifest.json` hợp lệ, `img/*.png` và `new/*.png`.
   - PNG đúng 75×75, SHA-256 khớp manifest.

2. **Backward compat:** Chạy probe mode (không `--crawl`) vẫn hoạt động như cũ.

3. **SIGINT test:** Chạy `--target 10`, Ctrl+C giữa chừng → batch cuối ghi xong, thống kê in ra.

4. **Import test:** Sau khi crawl xong, chạy `fishing-import --source <output> --raw-root data/raw` để verify batches importable.

## 6. User Review Gate

Sau khi user duyệt Spec này → tạo Implementation Plan:
```text
docs/superpowers/plans/2026-08-28-fishing-data-crawler.md
```
