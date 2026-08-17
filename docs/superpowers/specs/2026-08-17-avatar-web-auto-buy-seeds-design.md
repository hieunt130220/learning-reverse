# Thiết kế: Tự mua hạt giống khi auto trồng mà kho hết hạt

Ngày: 2026-08-17
Phạm vi: `avatar-web/server`, engine `AutoFarm` (`avatar-web/server/src/autoFarm.ts`)

## 1. Bối cảnh và nguồn bằng chứng

Triệu chứng: bật auto trồng cây, kho hết hạt → bot **không mua hạt**, các ô trống
bị bỏ qua và log "bỏ qua — thiếu hạt #N trong kho".

Bằng chứng từ code (`AutoFarm.runCycle`):

- `makeConfig` (dòng ~1088–1092) ép `autoBuy: true` và
  `buyBudgetXu: Number.MAX_SAFE_INTEGER` — tự mua **luôn bật** ở runtime.
- Bước "Tính nhu cầu vật phẩm" (dòng ~505–530) chỉ gom: thức ăn, thuốc bổ/cúm/tiêu
  chảy, phân bón, thuốc diệt cỏ/trừ sâu — **không có hạt giống**.
- Vòng mua bù (dòng ~539–570) chỉ mua những id có trong `need` → hạt giống không
  bao giờ được mua.
- Giai đoạn cây (dòng ~707–750): `seedInventory` đọc từ `this.client.inventory`;
  ô trống mà `seedInventory <= 0` thì bỏ qua ("thiếu hạt"), không mua.

Bằng chứng từ protocol (`avatar-re/notes/farm.md` dòng 506–539):

- Sau `doBuyItem` (cmd 68), server **KHÔNG tự đẩy gói 70 INVENTORY** — chỉ trả
  `-3 UPDATE_MONEY`, echo 68 và dialog -40 "Bạn đã mua vật phẩm thành công."
- Cảnh báo "Bẫy khi tự mua": kho chỉ có sau khi nhận gói 70; phải xin lại kho và
  chờ phản hồi trước khi quyết định mua (đã có ở đầu vòng, dòng ~385–394).

Bằng chứng về giá hạt:

- Bảng vật phẩm (gói 76, `decodeItemCatalog`) chỉ có 11 món tiêu dùng
  (id 111–124) — đối chiếu `avatar-web/server/shop-catalog.json` → **hạt giống
  không nằm trong bảng này**, nên vòng mua hiện tại sẽ in "bỏ mua #N: chưa biết giá".
- Giá hạt = trường `value` trong bảng cây (`TreeInfo.value` / `CachedSeed.value`):
  khớp giữa `shop-catalog.json` (trees) và `DEFAULT_SEED_CATALOG` (vd Cà chua 25,
  Lúa 240).
- Hạt mua bằng xu = id **0–10** (`category: 'xu'`); hạt cao cấp = id **30–48**
  (`category: 'premium'`) — loại tiền `typeShop=2` chưa xác định, **không tự mua**.

## 2. Mục tiêu

1. Khi tự mua bật (luôn bật ở runtime), thiếu hạt cho các ô sẽ trống / sắp thu
   hoạch trong vòng → mua bù hạt bằng xu (`typeShop = 1`) đúng số thiếu, vẫn tôn
   trọng `maxBuyPerItem` và `buyBudgetXu`.
2. Sau khi mua, xin lại kho và chờ gói 70 → giai đoạn trồng **cùng vòng** thấy hạt
   vừa mua và trồng đủ các ô trống.
3. Chỉ tự mua hạt xu (0–10); hạt cao cấp (30–48) không tự mua vì chưa rõ loại tiền.
4. Không đổi cấu hình / không đổi UI / không sửa protocol.

## 3. Không thuộc phạm vi

- Mua hạt cao cấp (30–48) hoặc mua bằng loại tiền 2.
- Sửa `decodeItemCatalog`, `TreeInfo`, DB schema, profile cache.
- UI panel Tự động (không có toggle mới; `autoBuy` đã luôn bật phía server).
- Bán hạt / bán nông sản / sạp.
- Edge case có sẵn: kho **rỗng hoàn toàn** (chưa đọc được gói 70) → tự mua bị
  bỏ qua với note "chưa đọc được kho" — giữ nguyên hành vi an toàn hiện có.

## 4. Thiết kế kiến trúc & giải pháp kỹ thuật

### 4.1. Files liên quan

| File | Vai trò |
|---|---|
| `avatar-web/server/src/autoFarm.ts` | Sửa `AutoFarm.runCycle`: bổ sung nhu cầu hạt, giá hạt, làm mới kho sau khi mua; thêm helper private `refreshInventory()` |
| `avatar-web/server/src/accounts/defaultSeedCatalog.ts` | Thêm export hằng `XU_SEED_IDS` (id hạt mua bằng xu) |
| `avatar-web/server/src/autoFarm.test.ts` | Cập nhật 1 test hiện có đang khẳng định "không mua hạt" cho khớp hành vi mới; `FakeClient.buyItem` mô phỏng server cộng hàng vào kho |

### 4.2. Thay đổi trong `AutoFarm.runCycle`

1. **Hoist `planByCell` + `knownSeeds`** lên trước bước tính nhu cầu (hiện đang
   khai báo ở giai đoạn cây, dòng ~706–709) để dùng chung cho cả tính nhu cầu và
   trồng cây. Không đổi định nghĩa.

2. **Bổ sung nhu cầu hạt** ngay sau khối tính nhu cầu vật phẩm hiện có:

   ```
   for c in farm.cells:
     plannedSeedId = planByCell[c].seedId  nếu plan là 'seed', ngược lại cfg.seedId
     bỏ qua nếu: plan 'skip' | plannedSeedId undefined | không trong knownSeeds
                 | không phải hạt xu (XU_SEED_IDS / category cây != 'premium')
     sẽ_trống = c.idTree == -1  hoặc  (harvest && cellRipe(c))
     nếu sẽ_trống: want(plannedSeedId)
   ```

   - Điều kiện mirror đúng giai đoạn trồng: chỉ đếm ô thật sự được trồng trong
     vòng (ô đang trống, hoặc ô chín sẽ thu hoạch khi `harvest` bật).
   - Ô có plan `skip` / hạt ngoài catalog / hạt cao cấp → không mua.

3. **Giá hạt trong vòng mua** (thay dòng tra `client.items` duy nhất):

   ```
   price = client.items.find(id)?.price
         ?? client.trees.find(id)?.value        // hạt xu: value = giá xu
         ?? DEFAULT_SEED_CATALOG.find(id)?.value // fallback khi chưa có bảng cây
   ```

4. **Làm mới kho sau khi mua**: tách helper private

   ```
   refreshInventory(): getInventory() + chờ 'inventory' (timeout 5s)
   ```

   - Dùng ở đầu vòng (thay đoạn lặp dòng ~385–394) và sau vòng mua khi
     `spent > 0` (thay `if (spent > 0) await tick();`).
   - Lý do bắt buộc: server không tự đẩy gói 70 sau mua; nếu không làm mới, giai
     đoạn trồng vẫn đọc `client.inventory` cũ (0 hạt) → vừa mua xong vừa bỏ qua
     trồng, lỗi không được chữa dứt điểm.

### 4.3. Hằng số mới

Trong `defaultSeedCatalog.ts`:

```ts
/** 11 hạt trồng bằng xu (typeShop = 1), id 0–10. Hạt cao cấp (30–48) chưa xác
 *  định loại tiền (`typeShop = 2`) nên không tự mua. */
export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
```

### 4.4. Thay đổi test

- Test `'không thay cây đang mọc và không trồng khi kho chỉ còn một hạt'`
  (`autoFarm.test.ts:315`): hành vi mới khi `autoBuy: true` là mua bù 1 hạt
  (`buy:5x1`) rồi trồng tiếp cả 2 ô trống — cập nhật assertion và đổi tên cho
  khớp ngữ nghĩa ("tự mua bù hạt thiếu rồi trồng tiếp").
- `FakeClient.buyItem`: cộng dồn số lượng vào `this.inventory` (giả lập server
  cấp hàng), để lần `getInventory` sau đó phản ánh hàng vừa mua.
- Không tạo test file mới, không thêm test case — theo AGENTS.md, chỉ viết test
  khi user yêu cầu trực tiếp.

## 5. Verification Plan

1. `timeout 240 node --import tsx --test src/autoFarm.test.ts` (server) → xanh.
2. `npm test` (server) và typecheck (`tsc --noEmit`) → xanh.
3. `git diff --check` không báo lỗi whitespace.
4. Smoke test thật (nếu có tài khoản thử): kho hết hạt, bật auto trồng → log vòng
   hiện `mua #6 ×N (~N×240 xu)` rồi `trồng #6 ô ...`; không dùng tài khoản thật
   ngoài phạm vi user cho phép.
5. GitNexus `detect_changes` trước khi commit.

## 6. Impact analysis (GitNexus)

- Phiên này **không có MCP GitNexus** và index `.gitnexus` cũ hơn HEAD 10 commit
  (indexed `fcb4d5e`, HEAD `a1ddacd`) → theo tiền lệ spec 08-13: ghi rõ giới hạn
  và cross-reference trực tiếp source/tests.
- Symbol sửa: `AutoFarm.runCycle` (private — chỉ gọi từ `start()` và timer nội
  bộ), thêm `AutoFarm.refreshInventory` (private, mới), thêm export `XU_SEED_IDS`
  (mới, không đổi symbol cũ).
- Caller duy nhất của `AutoFarm`: `avatar-web/server/src/session/avatarSession.ts:333-334`.
  Cấu hình / REST / WebSocket / UI không đổi.
- Test ảnh hưởng: 1 test trong `autoFarm.test.ts` (cập nhật); session tests dùng
  AutoFarm giả (harness `autos[0]`) → không ảnh hưởng.
- Kết luận: **risk LOW** (< 5 symbols, 1 execution flow).
