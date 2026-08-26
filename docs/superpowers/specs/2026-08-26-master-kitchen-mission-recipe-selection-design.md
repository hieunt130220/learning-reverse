# Master Kitchen Mission Recipe Selection — Design Document

> **Spec:** `docs/superpowers/specs/2026-08-26-master-kitchen-mission-recipe-selection-design.md`
> **Implementation:** `avatar-web/server/src/autoFarm.ts`

## 1. Mục tiêu & Bối cảnh

### Bối cảnh

Trong cooking phase của Auto Farm, khi `prioritizeCookingMissions` được bật, logic hiện tại tìm nhiệm vụ mở bếp Master chưa hoàn thành đầu tiên rồi chọn công thức tương ứng. Việc kiểm tra nguyên liệu chỉ diễn ra sau khi đã chọn công thức. Nếu món đầu tiên thiếu nguyên liệu, ô bếp bị bỏ qua dù một nhiệm vụ chưa hoàn thành khác có món đang đủ nguyên liệu.

### Mục tiêu

Khi chọn món theo nhiệm vụ mở bếp Master, quét toàn bộ nhiệm vụ chưa hoàn thành theo thứ tự server trả về và chọn món đầu tiên có công thức hợp lệ, đồng thời đủ nguyên liệu tại thời điểm xử lý ô bếp.

## 2. Phạm vi (Scope)

### In-scope

- Thay đổi nhánh chọn món theo `prioritizeCookingMissions` trong cooking phase của `AutoFarm.runCycle`.
- Xét tất cả nhiệm vụ thỏa `!mission.isDone && mission.numCook < mission.numNeed`.
- Bỏ qua nhiệm vụ không có công thức tương ứng trong catalog động.
- Bỏ qua món nhiệm vụ không đủ nguyên liệu và tiếp tục xét nhiệm vụ kế tiếp.
- Giữ nguyên thứ tự ưu tiên tổng thể và thứ tự nhiệm vụ do server cung cấp.
- Giữ nguyên cơ chế trừ nguyên liệu ảo sau khi quyết định nấu để các ô trong cùng vòng không tranh chấp nguyên liệu.

### Out-of-scope

- Không thay đổi UI, REST API, WebSocket, cấu hình hoặc packet protocol.
- Không thay đổi data contract của `CookingState`, `SlotMission`, `FoodRecipe` hoặc `AutoFarmConfig`.
- Không sắp xếp hay tối ưu nhiệm vụ theo thời gian nấu, mức độ hoàn thành hoặc số nguyên liệu.
- Không thay đổi hành vi của kế hoạch món riêng từng ô, `defaultRecipeId`, hoặc fallback món đầu tiên trong catalog.
- Không thay đổi logic thu hoạch và bán món chín.
- Không tạo test file mới vì user không yêu cầu viết test.

### Input

- `cookState.missions`: danh sách nhiệm vụ bếp theo thứ tự server trả về.
- `foodCatalog`: catalog công thức động nhận từ Cmd 76.
- `availableMaterials`: số nguyên liệu còn khả dụng trong vòng hiện tại, tổng hợp từ Cmd 70 section 3 và section 4.

### Output

- `targetRecipe` là công thức của nhiệm vụ chưa hoàn thành đầu tiên đang đủ nguyên liệu.
- Nếu không có món nhiệm vụ phù hợp, flow tiếp tục sang `defaultRecipeId`, rồi fallback `foodCatalog[0]` khi `autoCook` bật.

### Edge cases

- Danh sách nhiệm vụ rỗng: bỏ qua nhánh mission và giữ fallback hiện tại.
- Nhiệm vụ đã hoàn thành hoặc đã đủ `numNeed`: không được xét.
- `idFood` của nhiệm vụ không tồn tại trong catalog động: bỏ qua và xét nhiệm vụ kế tiếp.
- Công thức tồn tại nhưng thiếu một hoặc nhiều nguyên liệu: bỏ qua và xét nhiệm vụ kế tiếp.
- Nhiều món nhiệm vụ đều đủ nguyên liệu: chọn món xuất hiện trước trong `cookState.missions`.
- Sau khi một ô chọn món và trừ nguyên liệu ảo, ô kế tiếp phải đánh giá lại toàn bộ danh sách mission bằng lượng nguyên liệu còn lại.
- Kế hoạch món riêng của ô vẫn có ưu tiên cao hơn mission; nếu món riêng được tìm thấy thì không scan mission.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules liên quan

| File/module | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/autoFarm.ts` | Điều phối cooking phase, chọn công thức và kiểm tra nguyên liệu | Sửa logic chọn món mission để xét khả năng nấu trước khi chọn |
| `avatar-web/server/src/game/farmData.ts` | Khai báo `CookingState`, `SlotMission`, `FoodRecipe` và decode Cmd 91/Cmd 76 | Không thay đổi |
| `avatar-web/server/src/game/farmService.ts` | Gửi packet Cmd 91 để nấu | Không thay đổi |

### Thứ tự ưu tiên sau thay đổi

```text
Kế hoạch món riêng của ô
        ↓ nếu không có công thức
Quét các nhiệm vụ Master chưa hoàn thành
        ↓ chọn món đầu tiên đủ nguyên liệu
Món mặc định từ defaultRecipeId
        ↓ nếu không có công thức
Món đầu tiên trong catalog khi autoCook bật
```

### Thuật toán

Logic kiểm tra đủ nguyên liệu được dùng ngay trong bước scan mission:

```ts
const hasMaterials = (recipe: FoodRecipe): boolean =>
  recipe.materials.every(
    (material) => (availableMaterials.get(material.itemId) ?? 0) >= material.count,
  );

if (!targetRecipe && cfg.prioritizeCookingMissions && cookState.missions.length > 0) {
  for (const mission of cookState.missions) {
    if (mission.isDone || mission.numCook >= mission.numNeed) continue;

    const recipe = foodCatalog.find((food) => food.id === mission.idFood);
    if (!recipe || !hasMaterials(recipe)) continue;

    targetRecipe = recipe;
    break;
  }
}
```

Sau khi hoàn tất bước chọn món, guard kiểm tra nguyên liệu hiện có vẫn được giữ cho mọi nguồn lựa chọn (`cookingSlotPlan`, mission, `defaultRecipeId`, catalog fallback). Guard này bảo vệ các nhánh không phải mission và tránh gửi packet nếu trạng thái nguyên liệu không phù hợp.

### Data flow

1. Auto Farm refresh bếp bằng Cmd 91 sub-type 0.
2. Cooking phase dựng `availableMaterials` từ snapshot kho hiện tại.
3. Với mỗi ô có thể nấu, hệ thống áp dụng thứ tự ưu tiên.
4. Tại nhánh mission, hệ thống scan danh sách và chỉ chốt công thức khi đủ nguyên liệu.
5. Guard chung xác nhận nguyên liệu một lần nữa.
6. Hệ thống trừ nguyên liệu trên bản đồ tạm.
7. `farm.cook(slot, recipeId)` gửi Cmd 91 sub-type 1.
8. Ô tiếp theo scan lại missions với lượng nguyên liệu tạm còn lại.

### Error handling và logging

- Không thêm loại lỗi mới.
- Nhiệm vụ thiếu catalog hoặc thiếu nguyên liệu được xem là không khả dụng, không làm dừng cooking phase.
- Nếu không có mission nào khả dụng và fallback cuối cùng cũng thiếu nguyên liệu, log thiếu nguyên liệu hiện tại vẫn được sử dụng.
- Không ghi một log thiếu nguyên liệu cho từng mission bị bỏ qua để tránh làm nhiễu log mỗi vòng; log chỉ phản ánh món cuối cùng được chọn nhưng không thể nấu theo guard chung.

## 4. Verification Plan

### Automated verification hiện có

Sau khi sửa production code:

1. Chạy typecheck/build của server theo script hiện có trong workspace.
2. Chạy bộ test hiện có liên quan Auto Farm nếu repository đã có, nhưng không tạo test mới.
3. Chạy `gitnexus_detect_changes({ scope: "all" })` trước khi hoàn tất hoặc commit để xác nhận phạm vi chỉ tác động cooking selection trong `AutoFarm.runCycle`.

### Manual/code-path verification

Đối chiếu các trường hợp:

1. Mission A thiếu nguyên liệu, Mission B đủ nguyên liệu → chọn B.
2. Mission A không có recipe trong Cmd 76, Mission B đủ nguyên liệu → chọn B.
3. Mission A và B đều đủ → chọn A theo thứ tự server.
4. Không mission nào đủ, `defaultRecipeId` đủ → chọn món mặc định.
5. Không mission nào đủ, không có món mặc định, `autoCook` bật → thử món đầu catalog theo hành vi hiện tại.
6. Ô có plan món cụ thể → plan vẫn thắng mission.
7. Ô được đánh dấu `skip` → không chọn mission hoặc fallback.
8. Hai ô cùng có thể nấu nhưng nguyên liệu chỉ đủ cho một món → ô sau scan lại với số lượng đã trừ và không tranh chấp nguyên liệu.

## 5. Tiêu chí hoàn thành

- Không còn dùng `find(...)` để chốt nhiệm vụ chưa hoàn thành đầu tiên trước khi xét nguyên liệu.
- Mỗi ô scan toàn bộ mission chưa hoàn thành cho đến khi tìm được món đủ nguyên liệu hoặc hết danh sách.
- Thứ tự ưu tiên ngoài nhánh mission không thay đổi.
- Packet Cmd 91 và các data contract không thay đổi.
- Production code typecheck/build thành công và phạm vi GitNexus khớp dự kiến.
