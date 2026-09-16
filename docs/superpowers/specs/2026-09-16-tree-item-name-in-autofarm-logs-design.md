# Hiển thị tên cây trồng và vật phẩm thay vì ID trong nhật ký AutoFarm

## Mục tiêu & Bối cảnh

### Bối cảnh
Sau khi tinh gọn nhật ký theo 3 pha, nhật ký AutoFarm vẫn còn hiển thị ID thô dạng số cho cây trồng và vật phẩm:
- `[cây] ô 0: trồng #2`
- `[cây] ô X: tưới #100, nhổ cỏ #123, bắt sâu #124`
- `mua #2 ×24 (~1320 xu)`
- `Nông sản #6: đăng 2 lô`

### Vấn đề cần giải quyết
Người dùng khó theo dõi trực quan khi phải nhớ ID số tương ứng với cây hay vật phẩm gì. Cần chuyển đổi toàn bộ hiển thị ID thô sang tên tiếng Việt chuẩn (`Khóm/Dứa`, `Cà chua`, `Thuốc diệt cỏ`, `Thức ăn gia súc`...).

---

## Phạm vi (Scope)

### In-scope
1. **Pha 1 & Pha 3 Cây trồng (`autoFarm.ts`)**:
   - Thu hoạch: `[cây] ô X: thu hoạch <Tên cây> (+Y), làm đất` (nếu có cây).
   - Gieo hạt: `[cây] ô X: trồng <Tên cây>` (thay cho `trồng #${plannedSeedId}`).
   - Cảnh báo hạt: `[cây] ô X: bỏ qua — thiếu hạt <Tên cây> trong kho` và `bỏ qua hạt <Tên cây> (#id) — không có trong catalog cây`.
   - Chăm sóc ô: `tưới`, `nhổ cỏ`, `bắt sâu`, `bón phân` (loại bỏ các số hiệu nội bộ `#100`, `#123`, `#124`).

2. **Tự mua hạt / vật phẩm (`autoBuy` trong `autoFarm.ts`)**:
   - `mua <Tên> ×<số lượng> (~<giá> xu)` thay cho `mua #${id}`.
   - `dừng mua <Tên>: vượt trần ...` và `bỏ mua <Tên>: chưa biết giá`.

3. **Vật nuôi & Bán nông sản (`autoFarm.ts`)**:
   - `cho ăn <Tên thức ăn>` thay cho `cho ăn #${food}`.
   - `chữa bệnh (Thuốc cúm & Thuốc tiêu chảy)` thay cho `#120 & #121`.
   - Bán nông sản: `<Tên nông sản>: đăng X lô` thay cho `Nông sản #${r.itemId}`.

4. **Bổ sung từ điển fallback (`farmData.ts`)**:
   - Thêm ID `100` (`Bình nước`) và `112` (`Phân bón siêu cấp`) vào `KNOWN_PRODUCE_NAME_MAP` để hàm `getProduceOrItemName` luôn có tên fallback ngay cả khi mảng `items` rỗng.

### Out-of-scope
- Giữ nguyên logic vận hành 3 pha, thời gian nghỉ giữa các lệnh, điều kiện thu hoạch và giao thức mạng.
- Không tạo thêm file test mới (tuân thủ quy tắc No TDD).

---

## Thiết kế chi tiết & Format thay đổi

### 1. Hàm phân giải tên
Sử dụng hàm sẵn có `getProduceOrItemName(id, this.client.trees, this.client.items)` từ `farmData.ts`.
Tạo helper nội bộ gọn gàng trong `AutoFarm`:
```ts
private itemName(id: number): string {
  return getProduceOrItemName(id, this.client.trees, this.client.items);
}
```

### 2. Format nhật ký chi tiết

| Vị trí | Log cũ | Log mới |
|---|---|---|
| **Thu hoạch** | `[cây] ô 0: thu hoạch (+41), làm đất` | `[cây] ô 0: thu hoạch Khóm (+41), làm đất` |
| **Trồng cây** | `[cây] ô 0: trồng #2` | `[cây] ô 0: trồng Khóm` |
| **Thiếu hạt** | `[cây] ô 0: bỏ qua — thiếu hạt #2 trong kho` | `[cây] ô 0: bỏ qua — thiếu hạt Khóm trong kho` |
| **Không có hạt** | `[cây] ô 0: bỏ qua hạt #999 — không có trong catalog` | `[cây] ô 0: bỏ qua hạt #999 — không có trong catalog cây` |
| **Chăm sóc ô** | `[cây] ô 0: tưới #100, nhổ cỏ #123, bắt sâu #124` | `[cây] ô 0: tưới, nhổ cỏ, bắt sâu` |
| **Mua hàng** | `mua #2 ×24 (~1320 xu)` | `mua Khóm ×24 (~1320 xu)` |
| **Cho ăn** | `cho ăn #118` | `cho ăn Thức ăn gia súc` |
| **Chữa bệnh** | `chữa bệnh (#120 & #121)` | `chữa bệnh (Thuốc cúm & Thuốc tiêu chảy)` |
| **Bán nông sản** | `  - Nông sản #6: đăng 2 lô (2000 sản phẩm)` | `  - Lúa: đăng 2 lô (2000 sản phẩm)` |

---

## Verification Plan

1. **Static Analysis & Typecheck**:
   ```bash
   cd avatar-web/server && npm run typecheck
   ```
2. **Regression Tests**:
   ```bash
   cd avatar-web/server && node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts src/autoFarm.test.ts
   ```
3. **Pre-commit Audit**:
   Chạy `gitnexus_impact` trên các symbol liên quan và `gitnexus_detect_changes` trước khi commit.
