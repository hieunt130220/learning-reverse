# Amendment: Xác nhận làm đất và tối ưu luồng thu hoạch — trồng lại AutoFarm

## Mục tiêu & Bối cảnh

### Vấn đề hiện tại
Trong phiên triển khai trước (`2026-09-15-harvest-replant-ack-design.md`), hệ thống đã giải mã thành công ACK thu hoạch (Cmd 64) và ACK trồng hạt (Cmd 66). Tuy nhiên, AutoFarm vẫn phát sinh 24 lần JOIN farm (Cmd 69) trong một chu kỳ thu hoạch 24 ô, kéo dài thời gian xử lý lên tới ~93 giây.

Nguyên nhân cốt lõi từ log thực nghiệm (`pasted-text.txt`) và phân tích mã máy client (`libil2cpp.so`):
1. **Không tồn tại ACK riêng cho thao tác làm đất (clearCell)**:
   - Thiết kế trước giả định server sẽ gửi Cmd 66 với `idSeed === -1` để xác nhận làm đất.
   - Nhưng thân hàm client gốc `FarmScr$$onHarvestTree` (RVA `0x63B08C`) và `FarmScr$$onPlantSeed` (RVA `0x63AB28`) chứng minh client gốc gửi `doPlantSeed(idFarm, indexCell, -1)` ngay sau khi nhận Cmd 64 rồi lập tức cập nhật trạng thái local sang đất trống (`idTree = -1`, `status = 2`), hoàn toàn **không chờ ACK nào từ server**.
   - Phía server xử lý `clearCell` như thao tác cập nhật database và **không bao giờ gửi Cmd 66 (seed=-1) hay Cmd 100**.
2. **Hậu quả của giả định sai**:
   - Waiter `plantCommand(-1)` trong `autoFarm.ts` chờ `farm-plant-reply` với `seedId === -1` trong 2.500 ms.
   - Cả 24 ô đều bị timeout (24 × 2.5s = 60s lãng phí).
   - Mỗi lần timeout kích hoạt fallback `refreshFarmSnapshot()` (gửi Cmd 69 JOIN để đọc lại farm). Kết quả snapshot trả về cho thấy ô đó thực tế **đã trống** (`47/48 ô có cây`), chứng minh server đã thực hiện lệnh làm đất thành công từ trước.
   - Dòng log `[cây] ô X: cây #2 -> thu hoạch xác nhận, làm đất xác nhận, trồng #2 xác nhận` gây hiểu lầm nghiêm trọng: dù làm đất bị timeout và phải fallback bằng JOIN, code vẫn ghi "làm đất xác nhận", che giấu điểm nghẽn.

### Mục tiêu amendment
1. **Loại bỏ chờ ACK ảo cho thao tác làm đất**: Không tạo waiter chờ Cmd 66 seed=-1.
2. **Quy trình 3 pha (Harvest & Clear → Snapshot Gate → Replant)**:
   - Pha 1: Thu hoạch tuần tự các ô chín có ACK Cmd 64; gửi ngay lệnh `clearCell` cho từng ô thu thành công.
   - Pha 2: Đồng bộ đúng **1 lần snapshot farm** (Cmd 69) duy nhất cho cả cụm ô vừa làm đất, đóng vai trò Verification Gate xác nhận các ô đã thực sự trống trên server.
   - Pha 3: Gieo hạt tuần tự cho các ô đã được snapshot xác nhận trống, mỗi lệnh trồng chờ đúng ACK Cmd 66.
3. **Phân biệt rạch ròi thuật ngữ**:
   - "Xác nhận qua ACK" (Per-cell ACK): Chỉ dùng cho Cmd 64 (thu hoạch) và Cmd 66 seed>=0 (trồng).
   - "Xác nhận qua Snapshot" (State-driven confirmation): Dùng cho làm đất / dọn cây cũ.
4. **Hiệu năng mục tiêu**: Với 24 ô chín, số lần JOIN giảm từ 24 lần xuống đúng **1 lần**; thời gian xử lý từ ~93 giây giảm xuống còn ~3–5 giây; kho nông sản và số lượng hạt giống khớp tuyệt đối.

---

## Bằng chứng kỹ thuật & Đối chiếu Protocol

### 1. Bằng chứng từ Client Disassembly (`libil2cpp.so`)
- **`FarmScr$$onHarvestTree` (RVA `0x63B08C`, dòng lệnh `0x63b2e4 - 0x63b364`)**:
  ```arm
  0063b2f0  str    w8, [x22, #0x44]       // cell.idTree = -1 (cập nhật ô đất trống local)
  0063b2f4  strb   w9, [x22, #0x5c]       // cell.hervestPer = 100
  0063b2fc  bl     FarmService$$gI        // Lấy singleton FarmService
  0063b328  mov    w3, #-1                // idSeed = -1 (làm đất)
  0063b330  mov    w2, w19                // indexCell
  0063b33c  ldr    w1, [x8, #8]           // idFarm
  0063b340  bl     FarmService$$doPlantSeed // Gửi TX Cmd 66: idFarm, indexCell, -1
  0063b364  b      #0x63bd34              // Nhảy thẳng sang FarmScr$$setInfoCell(indexCell)
  ```
  Client gốc không hề có handler chờ phản hồi cho `doPlantSeed(-1)`.
- **`FarmScr$$onPlantSeed` (RVA `0x63AB28`, dòng lệnh `0x63ac4c - 0x63ac60`)**:
  ```arm
  0063ac4c  ldr    x8, [x0, #0xb8]
  0063ac50  mov    w1, w19                // w19 = idSeed từ packet RX 66
  0063ac58  ldr    x0, [x8, #0x18]        // seed list trong inventory
  0063ac5c  bl     Item$$getItemByList    // Tìm item hạt giống
  0063ac60  cbz    x0, #0x63b010          // Nếu idSeed == -1 -> NULL -> nhảy tới 0x63b010
  // Tại 0x63b010: gọi Out$$logError và return ngay, không cập nhật ô đất!
  ```
  Nếu server gửi Cmd 66 với `idSeed = -1`, client gốc sẽ báo lỗi `logError`. Điều này chứng tỏ server chưa từng và không bao giờ gửi Cmd 66 với seed = -1.
- **`FarmMsgHandler$$onMessage` (RVA `0x634068`)**:
  - Cmd 64 -> `FarmScr$$onHarvestTree` (đọc byte indexCell, short quantity).
  - Cmd 66 -> `FarmScr$$onPlantSeed` (đọc int idUser, byte indexCell, byte idSeed).
  - Cmd 100 -> `FarmMsgHandler$$readInfoCell` (chỉ gửi sau Cmd 65 `doUsingItem`).
  - Không có opcode nào khác đại diện cho ACK làm đất.

### 2. Bằng chứng từ Live Traffic (`pasted-text.txt`)
- Cả 24 ô thu hoạch (ô 0 đến ô 23):
  - Nhận Cmd 64 ngay sau khi gửi (ví dụ ô 0: `15:57:22 server trả lời cmd 64: 000037`).
  - Không có Cmd 66 seed=-1, không có Cmd 100.
  - Sau 2.500 ms timeout: `làm đất chưa xác nhận — đồng bộ lại`.
  - Client gửi `enterFarm()`, server trả Cmd 69: farm có `47 ô có cây` (tức ô 0 đã thực sự trống trên server).
  - Client gửi `plantSeed(seed=2)`, server lập tức trả Cmd 66: `000f56690002`.

---

## Phạm vi (Scope)

### In-Scope
1. **Tái cấu trúc vòng lặp cây trồng trong `avatar-web/server/src/autoFarm.ts`**:
   - **Pha 1 (Thu hoạch & Làm đất tuần tự)**:
     - Với mỗi ô chín: Gửi lệnh thu hoạch, chờ ACK Cmd 64 (`farm-harvest-reply`).
     - Khi nhận ACK Cmd 64 hợp lệ: Gửi ngay lệnh làm đất `clearCell(idFarm, cellIndex)`. Đánh dấu ô đang chờ xác nhận làm đất (`pendingClearCells.add(cellIndex)`). Không tạo waiter chờ Cmd 66 seed=-1.
     - Áp dụng `stepDelayMs` giữa các ô như bình thường.
   - **Pha 2 (Đồng bộ Snapshot xác nhận đất trống)**:
     - Nếu có ô đã gửi làm đất: Thực hiện đúng **1 lần** `refreshFarmSnapshot(idFarm, generation)`.
     - Duyệt snapshot mới nhận: Chỉ những ô có `idTree === -1` mới được chuyển sang danh sách "đất sạch đã xác nhận" (`confirmedClearedCells`).
     - Nếu có ô nào vẫn còn `idTree !== -1`, cảnh báo và bỏ qua ô đó, tuyệt đối không gieo hạt đè lên.
   - **Pha 3 (Gieo hạt lại & Chăm sóc)**:
     - Với các ô nằm trong `confirmedClearedCells`: Duyệt theo kế hoạch hạt (`planByCell` hoặc `seedId`), gửi `plantSeed(idFarm, cellIndex, targetSeedId)` và chờ ACK Cmd 66 (`farm-plant-reply`).
     - Khi nhận ACK Cmd 66: Cập nhật trừ hạt giống trong kho cục bộ.
     - Sau đó tiếp tục các bước chăm sóc (tưới nước, bắt sâu, nhổ cỏ, bón phân) cho các ô cần thiết theo quy trình sẵn có.
2. **Chuẩn hóa thông điệp nhật ký (Logging)**:
   - Thu hoạch: `[cây] ô X: thu hoạch xác nhận qua ACK (+Y sản phẩm)`
   - Làm đất: `[cây] ô X: đã gửi làm đất (chờ xác nhận snapshot)`
   - Cổng xác nhận snapshot: `[nông trại] snapshot xác nhận K ô đất trống sẵn sàng trồng`
   - Gieo hạt: `[cây] ô X: trồng #Z xác nhận qua ACK`
   - Tuyệt đối không ghi `làm đất xác nhận` khi chưa qua snapshot.
3. **Cập nhật tài liệu kỹ thuật**:
   - Cập nhật `avatar-re/notes/farm.md` ghi nhận phát hiện reverse engineering về RVA `0x63B08C`, `0x63AB28` và hành vi server đối với `clearCell`.

### Out-of-Scope
- Không thay đổi cấu trúc decoder trong `farmData.ts` hay các event emitter trong `client.ts`.
- Không thay đổi wire protocol gửi lên server (`harvest`, `clearCell`, `plantSeed`).
- Không sửa logic mua hạt tự động (`autoBuy`), vật nuôi (`animal`), bếp nấu (`cooking`), UI web.
- Không viết test file mới, không sử dụng TDD.

---

## Thiết kế chi tiết & Luồng xử lý (Architecture & Data Flow)

### Sơ đồ luồng mới

```text
[Bắt đầu vòng Farm]
        │
        ▼
[Snapshot đầu vòng] ──> Xác định danh sách ô chín (ripeCells) & ô trống sẵn có
        │
        ▼
[PHA 1: Thu hoạch & Làm đất tuần tự]
   For each ô chín:
      ├── Gửi harvest(idFarm, cell) ──> Chờ ACK Cmd 64 (timeout 2500ms)
      │      ├── Timeout/Lỗi ──> Ghi log, bỏ qua ô này, KHÔNG gửi clearCell
      │      └── ACK Confirmed ──> Ghi log "thu hoạch xác nhận qua ACK"
      │                             Gửi clearCell(idFarm, cell)
      │                             Đưa ô vào danh sách `pendingClearedCells`
      └── Nghỉ stepDelayMs
        │
        ▼
[PHA 2: Snapshot Verification Gate]
   Có ô trong `pendingClearedCells`?
      ├── KHÔNG ──> Chuyển thẳng sang Pha 3
      └── CÓ ──> Gửi enterFarm() (Cmd 69) ──> Chờ 1 full snapshot
             ├── Đối chiếu từng ô trong `pendingClearedCells` với snapshot mới:
             │      ├── Snapshot có idTree === -1 ──> Đưa vào `readyToPlantCells`
             │      └── Snapshot có idTree !== -1 ──> Cảnh báo "làm đất chưa sạch", loại bỏ
             └── Cập nhật farmState = snapshot mới
        │
        ▼
[PHA 3: Gieo hạt & Chăm sóc]
   For each ô trong `readyToPlantCells` (và các ô trống từ trước):
      ├── Tính plannedSeedId theo cấu hình/kho
      ├── Gửi plantSeed(idFarm, cell, plannedSeedId) ──> Chờ ACK Cmd 66
      │      ├── Timeout ──> Đồng bộ kho cuối vòng, không gieo lại ô này
      │      └── ACK Confirmed ──> Trừ kho cục bộ, log "trồng #Z xác nhận qua ACK"
      └── Nghỉ stepDelayMs
   Chăm sóc các ô còn lại (tưới, nhổ cỏ, bắt sâu, bón phân)
        │
        ▼
[Snapshot & Kho cuối vòng]
```

### Xử lý Timeout, Lỗi và Ngoại lệ (Safety Guards)

1. **Thu hoạch timeout**:
   - Nếu chờ Cmd 64 quá 2.500 ms: Đánh dấu không rõ trạng thái thu hoạch.
   - **Tuyệt đối không gửi lệnh `clearCell`**: Tránh nguy cơ phá nhầm cây chưa thu hoạch thành công.
   - Bỏ qua ô này trong chu kỳ hiện tại.
2. **Snapshot Pha 2 timeout / lỗi**:
   - Nếu lệnh `enterFarm()` ở Pha 2 bị timeout hoặc disconnect:
   - Dừng ngay giai đoạn gieo hạt trong chu kỳ này; không dùng dữ liệu cũ để gieo hạt mù.
   - Quăng lỗi kiểm soát hoặc chờ chu kỳ tiếp theo để tái đồng bộ an toàn.
3. **Trồng hạt timeout**:
   - Nếu chờ Cmd 66 quá 2.500 ms: Không gửi lại lệnh gieo hạt vào cùng ô trong chu kỳ đó.
   - Đánh dấu cần đồng bộ lại kho (`this.refreshInventory`) để tránh tính sai số hạt còn lại.
4. **Thay đổi phiên / Ngắt kết nối / Chuyển Farm (`idFarm`)**:
   - Luôn kiểm tra `guard()` và `isCurrent(generation)`.
   - Nếu tài khoản disconnect hoặc `farmState.idFarm` thay đổi khác với farm đang xử lý: Hủy toàn bộ waiter đang chờ, gỡ listener và dừng vòng ngay lập tức (`AutoFarmStoppedError`).
5. **Giữ nguyên ngân sách và hạt giống**:
   - Nếu kho hết hạt giống đã định: Ghi log bỏ qua ô, không cố gieo hạt bừa.

---

## Files ảnh hưởng

| File | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/autoFarm.ts` | Điều phối AutoFarm | Tách luồng cây thành 3 pha: Thu & dọn -> Snapshot Gate -> Trồng & chăm sóc. Chuẩn hóa log xác nhận. |
| `avatar-re/notes/farm.md` | Tài liệu giao thức | Bổ sung phân tích RVA `0x63B08C` / `0x63AB28` và xác nhận thực nghiệm về việc server không có ACK cho `clearCell`. |
| `docs/superpowers/specs/2026-09-15-harvest-replant-ack-design.md` | Spec gốc | Ghi chú tham chiếu sang Amendment này. |

---

## Verification Plan

### 1. Automated Verification
- **Typecheck**:
  Chạy tại `avatar-web/server`:
  ```bash
  npm run typecheck
  ```
  Yêu cầu: Không có lỗi TypeScript.
- **Regression Tests**:
  Chạy các unit test hiện có liên quan:
  ```bash
  node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts
  ```
  Yêu cầu: Tất cả các test case đều pass (không sửa đổi test file).

### 2. Protocol & Performance Verification (Đối chiếu tiêu chí nghiệm thu)
- **Kiểm tra số lần JOIN**:
  - Với một vòng thu hoạch N ô chín (ví dụ N = 24 ô):
  - Kỳ vọng: Chỉ phát sinh đúng **1 lần JOIN** ở Pha 2 để xác nhận đất trống, thay vì N lần JOIN như trước.
  - Tổng thời gian xử lý thu hoạch và gieo hạt cho 24 ô giảm từ ~93s xuống còn dưới 5s (chỉ tốn N × 2 roundtrip ACK ~30ms + 1 roundtrip snapshot ~100ms + các khoảng nghỉ `stepDelayMs`).
- **Kiểm tra tính an toàn**:
  - Khi ô chưa được snapshot xác nhận là trống (`idTree !== -1`): Không có bất kỳ lệnh `plantSeed` nào được bắn ra cho ô đó.
  - Kho hạt giống và kho nông sản cuối vòng khớp chính xác với số lượng thu và trồng thực tế.
- **Kiểm tra tính chuẩn xác của log**:
  - Log hiển thị rõ ràng: `thu hoạch xác nhận qua ACK`, `snapshot xác nhận N ô đất trống`, `trồng #Z xác nhận qua ACK`.
  - Không còn dòng log gây nhầm lẫn `làm đất xác nhận` khi không có ACK wire.
