# Thiết kế mua bù vật nuôi theo quota và sức chứa

## Mục tiêu và bối cảnh

Kế hoạch vật nuôi hiện được lưu dưới dạng các entry theo `slotIndex`, với UI chuồng hiển thị 20 vị trí logic và UI hồ hiển thị 10 vị trí logic. Tuy nhiên, `slotIndex` trong kế hoạch không luôn trùng với index vật lý của vật nuôi trong gói farm. Sức chứa thực tế cũng có thể nhỏ hơn số vị trí mà UI cho phép cấu hình.

Thuật toán hiện tại coi mỗi `slotIndex` trong kế hoạch là một slot vật lý, bỏ qua entry nếu `farm.animals` đã có con mang cùng index và thử mua cho từng index còn trống. Cách hiểu này làm kết quả mua phụ thuộc sai vào index vật lý. Ví dụ kế hoạch logic `5 Gà → 5 Vịt → 5 Gà`, chuồng chỉ chứa 10 con và đang có 5 Vịt thì hành vi đúng là mua bù 5 Gà, không phải đối chiếu từng index.

Mục tiêu của thay đổi là:

- Giữ nguyên UI, API, cấu trúc cấu hình và dữ liệu SQLite hiện có.
- Diễn giải kế hoạch vật nuôi thành quota theo loài trong phần đầu tương ứng với sức chứa thực tế của từng nhóm.
- Mua bù theo số lượng loài đang thiếu, không quan tâm index vật lý hoặc thứ tự hiện tại của từng con.
- Không bán hoặc thay thế con dư/sai loài trong giai đoạn mua.

## Phạm vi

### In scope

- Thay thuật toán mua vật nuôi trong `AutoFarm` từ đối chiếu slot vật lý sang quota theo loài.
- Tính quota riêng cho hồ và chuồng.
- Giới hạn phần kế hoạch có hiệu lực theo sức chứa thực tế của nhóm.
- Đếm vật nuôi hiện có theo loài và theo nhóm hồ/chuồng.
- Mua số lượng còn thiếu trong giới hạn chỗ trống.
- Giữ thứ tự ưu tiên mua theo lần xuất hiện đầu tiên của loài trong phần kế hoạch có hiệu lực.
- Dừng mua nhóm hiện tại khi server từ chối; sau đó tiếp tục task AutoFarm kế tiếp như hành vi hiện tại.
- Cập nhật log để phản ánh quota, loài và tiến độ mua thay vì slot vật lý.
- Cập nhật các test hiện có sau khi production code hoàn thành, nhằm kiểm tra thuật toán mới.

### Out of scope

- Không thay đổi UI editor, số ô logic mặc định hoặc cách tô kế hoạch.
- Không thay đổi DTO, REST API, parser cấu hình hoặc schema SQLite.
- Không migration, xóa hoặc viết lại entry cũ nằm ngoài sức chứa hiện tại.
- Không sắp xếp lại vật nuôi đang có.
- Không bán vật nuôi dư hoặc sai quota để lấy chỗ.
- Không thay đổi logic bán, thu hoạch, cho ăn, chữa bệnh hoặc chăm sóc cây.
- Không thay đổi cách giải mã hoặc phân loại slot hồ/chuồng trong `farmData.ts`.
- Không thêm test file mới; chỉ cập nhật test hiện có vì phạm vi đã có coverage trực tiếp.

## Input và output

### Input

Mỗi nhóm nhận các dữ liệu sau:

- Kế hoạch logic:
  - Hồ: `cfg.pondAnimalPlan`.
  - Chuồng: `cfg.barnAnimalPlan`.
- Sức chứa thực tế:
  - Hồ: `farm.pondAnimalSlots.length`.
  - Chuồng: `farm.barnAnimalSlots.length`.
- Danh sách vật nuôi hiện tại: `farm.animals`.
- Catalog loài vật từ `client.animals`, chỉ dùng để ghi tên trong log.

### Output hành vi

- Danh sách lệnh `buyAnimal(speciesId, SHOP_XU)` được gửi theo quota còn thiếu và số chỗ trống.
- Không truyền slot vào protocol vì lệnh mua hiện tại chỉ nhận `speciesId` và `typeBuy`.
- Mỗi lệnh mua thành công cập nhật bộ đếm cục bộ để lệnh kế tiếp trong cùng vòng dùng trạng thái mới.
- Khi server từ chối hoặc timeout, ngừng mua nhóm đó.

## Ngữ nghĩa kế hoạch

`slotIndex` trong `AnimalPlanEntry` là **vị trí logic trong kế hoạch**, không phải index vật lý của vật nuôi trên server.

Với sức chứa `capacity`, phần kế hoạch có hiệu lực gồm các entry thỏa:

```text
0 <= slotIndex < capacity
```

Các entry được xét theo `slotIndex` tăng dần.

- Entry `breed` đóng góp một đơn vị vào quota của `speciesId`.
- Entry `skip` chiếm vị trí logic nhưng không tạo quota.
- Vị trí không có entry không tạo quota.
- Entry có `slotIndex >= capacity` được giữ nguyên trong DB nhưng chưa có hiệu lực.
- Khi sức chứa tăng, các entry kế tiếp tự động có hiệu lực mà không cần migration.

Ví dụ:

```text
Kế hoạch: 0–4 Gà, 5–9 Vịt, 10–14 Gà
Sức chứa chuồng: 10
Quota hiệu lực: Gà 5, Vịt 5
```

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Files và vai trò

#### `avatar-web/server/src/autoFarm.ts`

Thay giai đoạn `MUA VẬT NUÔI THEO KẾ HOẠCH` bằng thuật toán quota. Phần chờ phản hồi mua thành công/thất bại tiếp tục dùng các event `money`, `dialog`, `farm` và timeout hiện tại.

#### `avatar-web/server/src/autoFarm.test.ts`

Sau khi production code hoàn thành, cập nhật các test mua vật nuôi hiện có để xác minh quota, sức chứa, số lượng hiện tại, thứ tự mua và trường hợp server từ chối.

#### Files không thay đổi

- `avatar-web/web/src/accounts/animalPlan.ts`
- `avatar-web/web/src/accounts/AnimalPlanEditor.tsx`
- `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- `avatar-web/server/src/accounts/autoConfig.ts`
- Database schema và dữ liệu `auto_config_json`

### Data contracts nội bộ

Mỗi nhóm mua được biểu diễn về mặt logic bởi:

```ts
interface AnimalPurchaseGroup {
  name: 'ao' | 'chuồng';
  plan: AnimalPlanEntry[];
  capacity: number;
  currentAnimals: FarmAnimal[];
}
```

Không bắt buộc tạo interface export mới; implementation có thể dùng object/tuple cục bộ nếu phù hợp phong cách hiện tại.

Quota có hai phần:

- `orderedSpecies`: danh sách species theo lần xuất hiện đầu tiên trong prefix hiệu lực.
- `targetBySpecies`: `Map<number, number>` chứa số lượng mục tiêu.

Trạng thái hiện tại:

- `currentBySpecies`: `Map<number, number>` chứa số con hiện có của từng loài trong nhóm.
- `remainingCapacity = max(0, capacity - currentAnimals.length)`.

### Phân nhóm vật nuôi hiện có

Sử dụng phân loại species đã có trong domain:

- Hồ: species `54` (Cá chép), `59` (Rùa).
- Chuồng: các species vật nuôi còn lại.

Implementation phải tái sử dụng helper phân loại hiện có nếu helper đó đã được export. Nếu chưa có helper phù hợp được export, thêm hoặc export helper nhỏ tại module domain hiện có thay vì lặp bảng species không nhất quán trong nhiều nơi. Việc sửa symbol/helper phải tuân thủ impact analysis trước khi edit.

Một con hiện có ngoài quota vẫn được tính vào `currentAnimals.length` và chiếm sức chứa, nhưng không làm giảm quota của loài khác.

### Thuật toán

Với từng nhóm, theo thứ tự hồ trước, chuồng sau:

1. Nếu không có kế hoạch hoặc `capacity <= 0`, không mua nhóm đó.
2. Sắp xếp plan theo `slotIndex` tăng dần.
3. Lọc entry có `slotIndex` nguyên, không âm và nhỏ hơn `capacity`.
4. Với entry `breed`:
   - tăng `targetBySpecies[speciesId]`;
   - nếu là lần xuất hiện đầu tiên, thêm species vào `orderedSpecies`.
5. Phân loại `farm.animals` để lấy các con thuộc nhóm.
6. Đếm `currentBySpecies`.
7. Tính `remainingCapacity = max(0, capacity - currentAnimals.length)`.
8. Với từng species trong `orderedSpecies`:
   - `missing = max(0, target - current)`;
   - `toBuy = min(missing, remainingCapacity)`;
   - gửi `toBuy` lệnh mua tuần tự.
9. Sau mỗi lần mua thành công:
   - tăng `currentBySpecies[speciesId]`;
   - giảm `remainingCapacity`;
   - cập nhật trạng thái farm cục bộ theo cách không giả định slot logic bằng slot vật lý.
10. Dừng nhóm khi:
    - `remainingCapacity === 0`;
    - mọi quota đã đủ;
    - AutoFarm bị abort;
    - server từ chối hoặc timeout.
11. Sau khi xử lý hồ, chuyển sang chuồng; sau khi xử lý chuồng, tiếp tục task AutoFarm kế tiếp.

### Cập nhật trạng thái cục bộ sau khi mua

Không được tạo `FarmAnimal` giả bằng `index = slotIndex` logic như implementation hiện tại.

Nguồn xác nhận ưu tiên:

1. Nếu event `farm` cung cấp `client.farmState` mới, dùng danh sách thật từ state đó cho việc đếm tiếp.
2. Nếu chỉ nhận event trừ tiền mà chưa có farm state mới, cập nhật **bộ đếm quota cục bộ** và `remainingCapacity` cho vòng mua hiện tại; không chèn animal giả với index suy đoán vào `farm.animals`.

Điều này tránh tái tạo chính lỗi đồng nhất index logic với index vật lý.

### Thứ tự mua

Thứ tự nhóm:

1. Hồ.
2. Chuồng.

Trong mỗi nhóm, thứ tự species là lần xuất hiện đầu tiên trong prefix kế hoạch có hiệu lực.

Ví dụ:

```text
Plan hiệu lực: Gà, Gà, Vịt, Gà, Vịt
Quota: Gà 3, Vịt 2
Thứ tự mua: Gà trước, Vịt sau
```

### Xử lý phản hồi server

Giữ cơ chế hiện tại:

- `money` với `delta < 0`: thành công.
- Event `farm` cho thấy số con tăng: thành công.
- `dialog`: thất bại với lý do server.
- Timeout: thất bại.

Khi thất bại:

- không gửi thêm lệnh mua trong cùng nhóm;
- ghi log lý do;
- không rollback các lần mua trước đó đã thành công;
- tiếp tục các task sau của vòng AutoFarm.

### Logging

Log không dùng cụm “slot N” cho hành động mua vì slot logic không phải slot vật lý.

Các log cần thể hiện:

- Tóm tắt nhóm: sức chứa, số con hiện có và quota theo loài.
- Mỗi lần mua: nhóm, tên loài, lần mua thứ mấy trên tổng số cần bù.
- Khi hết chỗ nhưng quota chưa đủ: ghi rõ nhóm đã đầy và phần quota còn thiếu.
- Khi server từ chối: nhóm, loài đang mua và lý do.
- Khi không cần mua: quota đã đủ hoặc không còn quota có hiệu lực.

Ví dụ:

```text
kế hoạch chuồng: sức chứa 10, hiện có 4, quota Gà 5 / Vịt 5
mua bù vật nuôi chuồng: Gà 1/2
mua bù vật nuôi chuồng: Gà 2/2
mua bù vật nuôi chuồng: Vịt 1/4
```

## Luồng xử lý

```text
farm state + config
        │
        ├── nhóm hồ: capacity + plan + current pond species
        │      └── prefix theo capacity → quota → thiếu → mua tuần tự
        │
        └── nhóm chuồng: capacity + plan + current barn species
               └── prefix theo capacity → quota → thiếu → mua tuần tự
```

## Edge cases

### Kế hoạch dài hơn sức chứa

Chỉ các entry có `slotIndex < capacity` tạo quota. Phần còn lại nằm nguyên trong DB và tự có hiệu lực khi mở rộng sức chứa.

### Kế hoạch có lỗ hoặc `skip`

Lỗ và `skip` không tạo quota nhưng vẫn giữ vị trí logic. Không dồn các entry phía sau về trước.

Ví dụ capacity 3:

```text
slot 0: Gà
slot 1: skip
slot 2: Vịt
slot 3: Gà
```

Quota hiệu lực là `Gà 1, Vịt 1`; entry slot 3 chưa có hiệu lực.

### Đang có đúng quota nhưng sai thứ tự vật lý

Không mua. Thuật toán chỉ so sánh số lượng theo loài.

### Đang có loài dư

Loài dư vẫn chiếm chỗ. Không bán hoặc thay thế.

Ví dụ quota `5 Gà + 5 Vịt`, capacity 10, hiện có `7 Vịt`:

- thiếu 5 Gà;
- chỉ còn 3 chỗ;
- mua tối đa 3 Gà;
- không bán 2 Vịt dư.

### Tổng quota nhỏ hơn sức chứa

Chỉ mua đến quota, để trống phần sức chứa không được kế hoạch yêu cầu.

### Tổng số con hiện có vượt capacity suy ra

Đặt `remainingCapacity = 0`, không mua. Ghi log trạng thái bất thường nếu cần, không cố sửa dữ liệu.

### Species không có trong catalog tên

Vẫn mua theo `speciesId`; log dùng fallback `loài #<id>`.

### Server từ chối giữa chừng

Giữ các lần mua thành công trước đó, dừng nhóm hiện tại và tiếp tục task kế tiếp.

### Farm state không cập nhật ngay sau event tiền

Dựa vào bộ đếm cục bộ trong vòng mua để tránh gửi thừa; không tạo animal giả với index suy đoán.

## Các ví dụ chấp nhận

### Ví dụ 1: đủ Vịt, thiếu Gà

```text
Plan: 5 Gà, 5 Vịt, 5 Gà
Capacity: 10
Current: 5 Vịt
Effective quota: 5 Gà, 5 Vịt
Result: mua 5 Gà
```

### Ví dụ 2: thiếu cả hai loài

```text
Plan: 5 Gà, 5 Vịt, 5 Gà
Capacity: 10
Current: 3 Gà, 1 Vịt
Effective quota: 5 Gà, 5 Vịt
Result: mua 2 Gà, sau đó mua 4 Vịt
```

### Ví dụ 3: loài dư chiếm chỗ

```text
Plan: 5 Gà, 5 Vịt
Capacity: 10
Current: 7 Vịt
Result: mua 3 Gà; không bán Vịt dư
```

### Ví dụ 4: quota đã đủ

```text
Plan: 5 Gà, 5 Vịt
Capacity: 10
Current: 5 Gà, 5 Vịt
Result: không mua
```

### Ví dụ 5: prefix có skip

```text
Plan: slot 0–3 Gà, slot 4 skip, slot 5–9 Vịt, slot 10 Gà
Capacity: 10
Effective quota: 4 Gà, 5 Vịt
Result: chỉ mua bù theo quota 4/5; slot 10 chưa có hiệu lực
```

## Verification Plan

### Automated

Sau khi production code hoàn thành, cập nhật `avatar-web/server/src/autoFarm.test.ts` để kiểm tra tối thiểu:

1. Capacity 10, plan `5 Gà + 5 Vịt + 5 Gà`, current `5 Vịt` → gọi mua Gà đúng 5 lần.
2. Cùng plan, current `3 Gà + 1 Vịt` → mua Gà 2 lần rồi Vịt 4 lần.
3. Current có loài dư làm chỗ trống nhỏ hơn số thiếu → chỉ mua đến khi hết capacity.
4. Quota đã đủ nhưng index vật lý không khớp vị trí logic → không mua.
5. Entry ngoài capacity không tạo quota.
6. `skip` trong prefix không bị dồn và không tạo quota.
7. Hồ được xử lý trước chuồng.
8. Server từ chối một lần mua → không gửi thêm lệnh cho nhóm đó và vẫn kết thúc vòng đúng cách.
9. Thành công chỉ qua event tiền, farm state chưa cập nhật → không gửi vượt quota/capacity.

Chạy các lệnh kiểm tra theo scripts hiện có trong `avatar-web/server/package.json`; implementation plan sẽ ghi chính xác command sau khi đọc scripts.

### Manual

Với tài khoản hiện tại:

1. Giữ nguyên DB/UI kế hoạch chuồng `5 Gà → 6 Vịt → các Gà còn lại` hoặc chỉnh thành ví dụ `5 Gà → 5 Vịt → 5 Gà`.
2. Đồng bộ farm để xác nhận capacity chuồng thực tế.
3. Bật AutoFarm và quan sát log quota.
4. Xác nhận số lệnh mua theo số con thiếu của từng loài, không theo index vật lý.
5. Xác nhận không có log “mua slot N” và không mua entry ngoài prefix capacity.
6. Chạy vòng tiếp theo và xác nhận không mua thêm khi quota đã đủ.

## Ràng buộc an toàn

- Phải chạy GitNexus impact analysis cho mọi function/class/method sẽ sửa trước khi edit production code.
- Nếu impact là HIGH hoặc CRITICAL, phải cảnh báo người dùng trước khi sửa.
- Không viết test trước production code và không dùng TDD workflow, theo quy định repo.
- Trước commit phải chạy `gitnexus_detect_changes` với phạm vi phù hợp.
- Không commit nếu người dùng chưa yêu cầu commit.
