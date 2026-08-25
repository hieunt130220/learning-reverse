# Skip Care Actions on Ripe Cell — Design Document

> **Spec:** `docs/superpowers/specs/2026-08-25-skip-care-on-ripe-cell-design.md`
> **Liên quan code:** `avatar-web/server/src/autoFarm.ts` (GIAI ĐOẠN CÂY trong `AutoFarm.runCycle`)

## 1. Mục tiêu & Bối cảnh

### Bối cảnh
Vòng tự động (`AutoFarm.runCycle`) xử lý từng ô cây theo thứ tự: thu hoạch ô chín → làm đất → trồng lại → **rồi vẫn chạy tiếp 4 bước chăm sóc** (tưới #100 / nhổ cỏ #123 / bắt sâu #124 / bón phân #112) dựa trên trạng thái `isArid`/`isGrass`/`isWorm`/`vitalityPer` đọc từ ảnh chụp đầu vòng — tức trạng thái của **cây cũ vừa bị thu bỏ**.

Hệ quả:
- Lãng phí vật phẩm (phân bón #112 giá xu) và lệnh gửi lên server vô nghĩa.
- Log `[cây] ô N: chín ... -> thu hoạch, làm đất, trồng #x, hạn, cỏ, sâu, sức sống 73 -> tưới, nhổ cỏ, bắt sâu, bón phân` gây nhiễu: người dùng nhìn vào tưởng bot chăm sóc cây đã bị hạ.
- Trạng thái ô sau thu hoạch thay đổi hoàn toàn (cây mới trồng), mọi tín hiệu care của cây cũ không còn ý nghĩa.

### Mục tiêu
Ô nào **đi qua nhánh thu hoạch** trong vòng này thì **bỏ qua toàn bộ các bước chăm sóc** (tưới/nhổ cỏ/bắt sâu/bón phân) của ô đó trong cùng vòng. Cây non mới trồng sẽ được chăm sóc ở các chu kỳ quét kế tiếp, khi dữ liệu farm được xin lại.

## 2. Phạm vi (Scope)

### In-scope
- Sửa logic trong GIAI ĐOẠN CÂY của `AutoFarm.runCycle`: đánh dấu ô đã thu hoạch → skip 4 bước care.
- Cập nhật log `[cây] ô N:` để phản ánh việc bỏ qua care (thêm ghi chú "bỏ qua chăm sóc" khi có care bị skip).
- Thêm test unit cho hành vi mới (user có bộ test sẵn, giữ nguyên phong cách node:test + assert).

### Out-of-scope
- Không đổi thứ tự giai đoạn khác (mua bù, vật nuôi, bếp, nhiệm vụ).
- Không đổi điều kiện chín `isCellRipe`, không đụng `farmData.ts` (trừ khi cần thêm helper thuần túy — hiện không cần).
- Không đổi config/UI/web layer.
- KHÔNG TDD — theo CLAUDE.md: chỉ thêm test sau khi code production hoàn thành.

## 3. Thiết kế kỹ thuật

### Files liên quan
| File | Vai trò |
|---|---|
| `avatar-web/server/src/autoFarm.ts` | Sửa GIAI ĐOẠN CÂY trong `runCycle`: thêm flag `harvestedThisCell` |
| `avatar-web/server/src/autoFarm.test.ts` | Thêm test case mới cho hành vi skip-care |

### Flow xử lý mới (pseudo-diff)

```
for (const c of farm.cells) {
  let harvested = false;                       // NEW
  if (harvest && cellRipe(c)) {
    harvest → confirm(64) → tick → sync farm
    harvested = true;                          // NEW
  }
  if (trống/spent/đã-thu) { làm đất? → trồng }   // giữ nguyên
  ...
  if (!harvested) {                             // NEW guard duy nhất
    if (isArid)  tưới
    if (isGrass) nhổ cỏ
    if (isWorm)  bắt sâu
    if (fertilizeCells && vitalityPer < min) bón phân
  }
}
```

### Điểm mấu chốt

1. **Một flag cục bộ `harvested`** đặt ngay sau khối `if (harvest && cellRipe(c))` — bao trùm cả 4 bước care phía dưới, kể cả trường hợp ô chín nhưng `plannedSeedId === undefined` (không replant): vẫn phải skip care vì ô đang rỗng/không còn cây để chăm.
2. **Không đụng bước "làm đất"**: ô chín mà vẫn còn idTree cũ (spent) thì clearCell vẫn chạy như cũ — đó là phần của nhánh thu hoạch→trồng lại, không phải "care".
3. **Log rõ ràng**: khi `harvested && did.length > 0`, dòng note thêm `, bỏ qua chăm sóc` để người dùng thấy bot cố ý bỏ qua chứ không phải lỗi im lặng.
4. **minVitality mặc định = 100**: flag này cũng chặn luôn việc bón phân vào ô vừa trồng lại (vitalityPer của ảnh chụp cũ < 100 gần như chắc chắn). Đây là hiệu ứng mong muốn — cây non không cần phân ngay trong cùng vòng với lúc thu hoạch.

### Edge cases
- **Ô chín nhưng `seedId` chưa cấu hình & kho hết hạt**: ô đi qua nhánh thu hoạch → `harvested=true` → skip care. Đúng mong muốn: ô rỗng thì không có gì để chăm.
- **Ô spent (time=-1) từ vòng trước** nhưng KHÔNG qua nhánh thu hoạch: vẫn nhận care bình thường nếu có cây... thực tế ô spent không có cây sống → `idTree !== -1` nhưng time=-1; các bước care dựa trên `isArid/isGrass/isWorm` — nếu server trả true cho ô spent thì bot vẫn chăm (giữ nguyên hành vi hiện tại, không mở rộng scope).
- **`harvest: false` trong config**: nhánh thu hoạch không chạy → không flag → care chạy như cũ. Hành vi cũ giữ nguyên cho ai tắt thu hoạch.

## 4. Verification Plan

### Automated
1. `npm run typecheck` pass.
2. `npm test` (node --test) pass, gồm:
   - Các test cũ không vỡ (đặc biệt test "một vòng làm hết việc tồn đọng" dùng ô `time=100` NON-chín nên không bị ảnh hưởng bởi flag — care vẫn chạy đủ 24 lệnh).
   - Test mới: ô chín (time ≥ growHours×60) + isArid + isGrass + isWorm + vitality thấp → chỉ thấy `harvest`, `clearCell`, `plantSeed`, **KHÔNG** có useItem nào cho ô đó.
   - Test mới: ô non (chưa chín) có isArid → vẫn được tưới như cũ.
   - Test mới: ô chín nhưng `harvest: false` → vẫn được tưới (hành vi cũ).

### Manual (server thật)
1. Chạy auto farm trên tài khoản thật, chờ tới khi có ô Lúa (48h) chín.
2. Xem log `[cây] ô N: ... -> thu hoạch, làm đất, trồng #6, bỏ qua chăm sóc`.
3. Kho không giảm phân bón/tưới khi thu hoạch.
