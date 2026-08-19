# Thiết kế: Tự Động Trồng Lại Cây Sau Thu Hoạch & Sửa Hiển Thị Ô Vừa Thu

## 1. Mục tiêu & Bối cảnh

### Hiện tượng lỗi
- Người dùng phản ánh sau khi thu hoạch cây (ví dụ ô 0 trồng Xoài), hệ thống AutoFarm không tự động trồng lại cây.
- Trên giao diện AssetsPanel, ô đất sau thu hoạch hiển thị:
  `Ô 0 — Xoài · đã trồng -1 phút/1440 · sức sống 100% · thu hoạch 100% · level 1 · cần: không`
  thay vì nhận diện là ô trống / cần trồng lại.

### Nguyên nhân gốc rễ (Root Cause)
1. **AutoFarm backend (`avatar-web/server/src/autoFarm.ts`)**:
   - Khi `AutoFarm` chạy bước thu hoạch (`if (harvest && cellRipe(c))`), `c.idTree = -1` bị gán đè trực tiếp trong bộ nhớ làm mất thông tin loại cây trước đó và làm hỏng dòng log tính `growHours.get(-1)`.
   - Khi xác định loại hạt cần trồng cho ô trống / ô vừa thu hoạch (`isCellSpent`), logic chỉ kiểm tra `plan?.seedId` hoặc cấu hình toàn cục `seedId`. Nếu người dùng không chỉ định cấu hình `seedId` cụ thể, `plannedSeedId` trở thành `undefined` dẫn đến AutoFarm bỏ qua không trồng cây.
   - Cần cơ chế fallback thông minh: Khi `treeCellPlan` và `cfg.seedId` không cấu hình, ô vừa thu hoạch sẽ tự động trồng lại đúng loại cây cũ (`c.idTree` trước đó, ví dụ Xoài #7) nếu cây đó thuộc catalog hạt giống đã biết (`knownSeeds`).
   - Bước tính nhu cầu mua hạt giống (`plannedSeedsToStock`) cũng cần bao gồm hạt giống của cây cũ để `autoBuy` tự mua bổ sung khi kho thiếu.
2. **Frontend UI (`avatar-web/web/src/accounts/panels/AssetsPanel.tsx`)**:
   - Hàm `cellNeeds` chỉ kiểm tra `if (c.idTree === -1) return ['trống']`. Khi server gửi ô vừa thu hoạch có `time === -1` và `idTree !== -1`, `isCellRipe` trả về `false`, khiến `cellNeeds` trả về mảng rỗng `[]` và hiển thị `cần: không`.
   - Lớp CSS của ô trên lưới (`AssetsPanel.tsx`) chỉ gán class `'empty'` khi `c.idTree === -1`, làm ô vừa thu hoạch không hiển thị viền ô trống.
   - Phần chi tiết ô (`cell-detail`) hiển thị `đã trồng -1 phút/1440` gây khó hiểu.

---

## 2. Phạm vi (Scope)

### In-scope
- **Backend**:
  - Sửa `AutoFarm.runCycle` trong [autoFarm.ts](file:///Users/devios/learning-reverse/avatar-web/server/src/autoFarm.ts):
    - Bảo toàn `previousTreeId = c.idTree` trước khi thu hoạch.
    - Fallback chọn hạt trồng: `plan.seedId` -> `cfg.seedId` -> `previousTreeId` (nếu hợp lệ trong `knownSeeds`).
    - Cập nhật tính toán `plannedSeedsToStock` và `plantingConfigured` theo logic fallback này.
    - Cập nhật trạng thái `c.idTree = plannedSeedId; c.time = 0; c.hervestPer = 0;` sau khi gửi lệnh trồng thành công.
- **Frontend**:
  - Sửa [AssetsPanel.tsx](file:///Users/devios/learning-reverse/avatar-web/web/src/accounts/panels/AssetsPanel.tsx):
    - Cập nhật `cellNeeds(c, trees)`: kiểm tra `if (c.idTree === -1 || c.time === -1) return ['trống']`.
    - Cập nhật ô lưới: gán `'empty'` khi `c.idTree === -1 || c.time === -1`.
    - Cập nhật hiển thị chi tiết khi `sel.time === -1`: hiển thị trạng thái `trống (vừa thu hoạch ...)` thay vì số phút âm `-1 phút`.

### Out-of-scope
- Không can thiệp vào định dạng gói tin socket (`cmd 64`, `cmd 66`).
- Không thay đổi cấu trúc database lưu trữ `AutoFarmConfig`.

### Edge Cases
1. **Ô trống từ đầu (`idTree === -1`) và không có `seedId`/`plan`**: Bỏ qua không trồng vì không biết trồng cây gì (đúng thiết kế).
2. **Cây vừa thu hoạch là cây không mua được bằng xu hoặc cây không có trong catalog**: Ghi log thông báo và bỏ qua.
3. **Kho hết hạt và `autoBuy = false`**: Báo thiếu hạt trong kho và không gửi lệnh trồng mù.

---

## 3. Thiết kế Kiến trúc & Giải pháp Kỹ thuật

### A. Luồng xử lý Backend (`AutoFarm.runCycle`)

```mermaid
flowchart TD
    A[Quét ô c trong farm.cells] --> B{Ô đã chín cellRipe?}
    B -- Có --> C[Gửi harvest cmd 64 & lưu previousTreeId = c.idTree]
    C --> D[Chờ farmSynced]
    B -- Không --> E{Ô trống hoặc vừa thu c.idTree == -1 || isCellSpent?}
    D --> E
    E -- Có --> F[Xác định plannedSeedId]
    F --> G[1. plan.seedId nếu có<br/>2. cfg.seedId nếu có<br/>3. previousTreeId nếu hợp lệ]
    G --> H{Có plannedSeedId & đủ hạt?}
    H -- Có --> I[Gửi plantSeed cmd 66 & cập nhật local c]
    H -- Không đủ hạt & autoBuy --> J[Đã mua ở bước trước hoặc log thiếu hạt]
    H -- Không có plannedSeedId --> K[Bỏ qua]
    E -- Không --> L[Chăm sóc ô: tưới, nhổ cỏ, bắt sâu]
```

### B. Danh sách Files & Vai trò

| File | Vai trò | Thay đổi |
|---|---|---|
| [autoFarm.ts](file:///Users/devios/learning-reverse/avatar-web/server/src/autoFarm.ts) | Backend AutoFarm Controller | Bảo toàn `previousTreeId`, fallback `plannedSeedId`, cập nhật `plannedSeedsToStock` và `plantingConfigured`. |
| [AssetsPanel.tsx](file:///Users/devios/learning-reverse/avatar-web/web/src/accounts/panels/AssetsPanel.tsx) | Frontend Farm Assets UI | Cập nhật `cellNeeds`, hiển thị ô trống / vừa thu hoạch `time === -1`, sửa `cần: không` thành `cần: trống`. |

---

## 4. Verification Plan

### Automated Verification
- Chạy unit tests cho `AssetsPanel.test.tsx` (frontend) để xác minh `cellNeeds` với ô `time = -1`.
- Chạy unit tests cho `autoFarm.test.ts` (backend) để đảm bảo không gãy các luồng harvest, plant, autoBuy.

### Manual Verification
- Kiểm tra trực quan trên panel AssetsPanel: ô `time = -1` hiển thị `cần: trống` và trạng thái rõ ràng.
- Kiểm tra `AutoFarm` chu kỳ thu hoạch -> tự động trồng lại cây (Xoài) trên cùng ô đất.
