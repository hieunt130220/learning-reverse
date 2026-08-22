# Auto Sell Farm Produce Design

## Mục tiêu và bối cảnh

Avatar Web đã có hai luồng độc lập:

- Auto Farm chăm sóc cây trồng, vật nuôi, bếp và nhiệm vụ theo chu kỳ.
- Sạp hỗ trợ đồng bộ kho/sạp, đăng bán thủ công, transaction, idempotency, timeout và reconciliation qua `ShopCoordinator`.

Mục tiêu của thay đổi này là bổ sung một giai đoạn Auto Sell vào luồng Auto Farm. Người dùng cấu hình loại nông sản, số lượng mỗi lô và giá bán; khi đến hạn, Auto Farm yêu cầu `ShopCoordinator` tự đăng các lô phù hợp lên sạp.

Auto Sell không có scheduler riêng và không chạy khi Auto Farm đang tắt. Thiết kế phải tái sử dụng các guard an toàn của sạp hiện có, tránh để Auto Farm trực tiếp quản lý cmd 103, revision hoặc trạng thái giao dịch không chắc chắn.

## Phạm vi

### In scope

- Thêm công tắc Auto Sell vào cấu hình Auto Farm.
- Một khoảng kiểm tra chung cho mỗi tài khoản:
  - đơn vị cấu hình trên UI là phút;
  - mặc định 10 phút;
  - tối thiểu 5 phút.
- Danh sách quy tắc bán có thứ tự ưu tiên. Mỗi quy tắc gồm:
  - `itemId`: loại nông sản;
  - `quantity`: số lượng của một lô;
  - `price`: giá giữ nguyên ngữ nghĩa và đơn vị của protocol game.
- Mỗi `itemId` chỉ xuất hiện trong một quy tắc.
- Chỉ đăng một lô khi kho có ít nhất đủ `quantity`; không đăng lô nhỏ hơn.
- Với từng quy tắc, đăng lặp nhiều lô liên tiếp đến khi:
  - kho không đủ cho lô tiếp theo;
  - sạp hết slot trống;
  - Auto Farm được yêu cầu dừng;
  - hoặc phát sinh lỗi buộc phải dừng lượt.
- Duyệt quy tắc từ trên xuống. Quy tắc ưu tiên cao có thể dùng hết các slot trống.
- Không tự mở slot.
- Đồng bộ sạp, price rules và kho trước mỗi lượt Auto Sell.
- Reconciliation sau từng lô bằng cơ chế ShopCoordinator hiện có.
- Lưu mỗi lô vào lịch sử transaction sạp hiện có.
- Ghi kết quả Auto Sell vào log và `lastActions` của Auto Farm.
- Khi sửa cấu hình trong lúc Auto Farm chạy, bản mới áp dụng từ chu kỳ Auto Farm kế tiếp.

### Out of scope

- Tự bán khi Auto Farm đang tắt.
- Kích hoạt bán ngay sau mỗi lần thu hoạch.
- Một scheduler Auto Sell độc lập với Auto Farm.
- Tự điều chỉnh giá theo thị trường.
- Tự mở hoặc mua thêm slot sạp.
- Duy trì tổng số lượng mục tiêu trên sạp.
- Luân phiên công bằng giữa các quy tắc.
- Nhiều quy tắc cho cùng một `itemId`.
- Tự rút listing cũ hoặc listing hết hạn.
- Dashboard hoặc lịch sử riêng cho Auto Sell.
- Thay đổi wire format của cmd 103.
- Tạo test file mới nếu người dùng không yêu cầu trực tiếp.

## Input, output và edge cases

### Input cấu hình

```ts
export interface AutoSellRule {
  itemId: number;
  quantity: number;
  price: number;
}

export interface AutoFarmConfig {
  // Các trường hiện có.
  autoSellProduce: boolean;
  autoSellIntervalMs: number;
  autoSellRules: AutoSellRule[];
}
```

Ràng buộc:

- `autoSellProduce` mặc định `false`.
- `autoSellIntervalMs` mặc định `600_000` và không nhỏ hơn `300_000`.
- `autoSellRules` mặc định `[]`.
- `itemId` là số nguyên trong `[0, 32_767]`.
- `quantity` và `price` là số nguyên trong `[1, 2_147_483_647]`.
- Không có hai rule cùng `itemId`.
- Thứ tự phần tử trong mảng là thứ tự ưu tiên và phải được giữ nguyên khi normalize/lưu/tải.

### Output một lượt Auto Sell

API nội bộ trả một summary độc lập với chi tiết protocol:

```ts
export type AutoSellStopReason =
  | 'completed'
  | 'no-free-slot'
  | 'stopped'
  | 'uncertain-state';

export interface AutoSellRuleResult {
  itemId: number;
  listedLots: number;
  listedQuantity: number;
  skippedReason?: string;
}

export interface AutoSellCycleResult {
  startedAt: number;
  completedAt: number;
  listedLots: number;
  stopReason: AutoSellStopReason;
  rules: AutoSellRuleResult[];
}
```

Tên type có thể được điều chỉnh cho phù hợp convention khi lập plan, nhưng contract phải giữ đủ các dữ liệu trên để Auto Farm ghi log mà không cần đọc nội bộ transaction.

### Edge cases

- Auto Sell bật nhưng không có rule: bỏ qua, không phát lệnh sạp.
- Chưa đến hạn: bỏ qua, không đồng bộ sạp/kho.
- Rule không còn price rule: ghi lỗi cục bộ cho rule và chuyển tiếp.
- Giá ngoài khoảng hiện hành: ghi lỗi cục bộ và chuyển tiếp.
- Kho thiếu hàng: ghi trạng thái chờ đủ và chuyển tiếp.
- Sạp không còn slot: dừng lượt, không tự mở slot.
- Snapshot/revision thay đổi ngoài dự kiến: dừng lượt để đồng bộ ở lần sau.
- Timeout, mất kết nối, ACK không khớp hoặc reconciliation thiếu bằng chứng: dừng lượt với `uncertain-state`, không tự gửi lại lô.
- Người dùng dừng Auto Farm giữa giao dịch: hoàn tất ACK/reconciliation hoặc timeout cho giao dịch đã gửi; không bắt đầu lô tiếp theo.
- Logout/reconnect giữa các chu kỳ Auto Farm: mốc lần chạy được giữ tại `AvatarSession`, nên interval Auto Sell không bị reset khi instance `AutoFarm` được tạo lại.
- Server restart: mốc thời gian runtime mất; Auto Sell được coi là đến hạn ở cuối chu kỳ Auto Farm đầu tiên, sau đó vẫn đồng bộ đầy đủ trước khi gửi lệnh.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Hướng được chọn

Dùng `ShopCoordinator` làm chủ toàn bộ lượt Auto Sell. Auto Farm chỉ giữ lịch chạy và gọi một dependency cấp cao. Không để Auto Farm trực tiếp gửi cmd 103 hoặc gọi tuần tự các API đăng bán thủ công.

Lý do:

- `ShopCoordinator` đã có queue, minimum send interval, timeout, revision guard, transaction, idempotency và reconciliation.
- Logic Auto Farm không phải biết chi tiết protocol sạp.
- Có thể khóa toàn bộ lượt bán trong một lane, ngăn thao tác thủ công chen giữa hai lô.
- Mọi listing vẫn đi qua cùng một đường an toàn và lịch sử transaction.

### Modules và vai trò

#### `avatar-web/server/src/autoFarm.ts`

- Khai báo `AutoSellRule` và các trường cấu hình mới.
- Normalize giá trị mặc định và giới hạn interval.
- Mở rộng options/dependency của `AutoFarm` bằng callback cấp cao, ví dụ:

```ts
runAutoSellCycle?: (
  rules: readonly AutoSellRule[],
  shouldStop: () => boolean,
) => Promise<AutoSellCycleResult>;
```

- Ở cuối `runCycle()`, sau cây/vật nuôi/bếp/nhiệm vụ và trước refresh cuối chu kỳ/cycle-complete, yêu cầu dependency kiểm tra deadline rồi chạy Auto Sell nếu đến hạn.
- Ghi summary vào `actions` và log.
- Không tự tạo slot, transaction, revision hoặc packet.

#### `avatar-web/server/src/session/shopCoordinator.ts`

- Thêm public API nội bộ `runAutoSellCycle(...)`.
- Tạo lane độc quyền bao trọn lượt Auto Sell.
- Đồng bộ own shop, price rules và produce ở đầu lượt.
- Validate rule bằng dữ liệu hiện hành.
- Chọn các slot trống trong `0..numSlot-1`.
- Duyệt rule theo thứ tự và đăng lặp từng rule.
- Tái sử dụng request/ACK/reconciliation hiện có cho mỗi listing.
- Tạo transaction `list` cho từng lô với idempotency key xác định.
- Cho phép giao dịch do lane automation tạo ra, nhưng vẫn từ chối request thủ công khi automation đang chạy.
- Phân loại lỗi cục bộ và lỗi trạng thái không chắc chắn.

Logic chạy listing hiện có nên được tách thành primitive nội bộ có thể `await`, thay vì gọi public `createListing()` rồi polling transaction. Primitive phải duy trì cùng transition transaction và reconciliation như luồng thủ công.

#### `avatar-web/server/src/session/avatarSession.ts`

- Giữ `lastAutoSellAt` xuyên qua các lần teardown/reconnect trong cùng tiến trình server.
- Truyền callback cấp cao vào `AutoFarm`; callback kiểm tra deadline bằng mốc của session rồi gọi `ShopCoordinator.runAutoSellCycle()` khi đến hạn.
- Cập nhật `lastAutoSellAt` ngay khi lượt đã thực sự bắt đầu đồng bộ, kể cả lượt không đăng được lô nào.
- Không chứa thuật toán duyệt rule.
- Bảo đảm `onAutoCycleComplete()` chỉ chạy sau khi giai đoạn Auto Sell kết thúc.
- Hành vi logout/reconnect hiện tại giữ nguyên; teardown chỉ diễn ra sau toàn bộ cycle.

#### `avatar-web/server/src/accounts/autoConfig.ts`

- Thêm parser cho `autoSellProduce`, `autoSellIntervalMs`, `autoSellRules`.
- Validate bounds và duplicate `itemId`.
- Giữ nguyên thứ tự rule; không sort theo `itemId`.
- Dùng envelope cấu hình hiện tại, không đổi schema DB.

#### `avatar-web/web/src/types.ts`

- Thêm DTO tương ứng cho `AutoSellRule` và các trường cấu hình.
- Nếu UI cần summary runtime, chỉ thêm type khi backend thực sự expose; phiên bản đầu dùng log/`lastActions`.

#### `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`

- Thêm state draft cho bật/tắt, interval và ordered rules.
- Hydrate từ config đã lưu.
- Đưa các trường mới vào dirty comparison và payload `savePlan()`.
- Cập nhật validator client để chấp nhận keys mới và kiểm tra cấu trúc rule.
- Giữ draft khi revision conflict giống các kế hoạch hiện tại.

#### Component editor mới

Tạo component tập trung, ví dụ `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`, để tránh tiếp tục làm `AutoFarmPanel.tsx` phình to. Component chịu trách nhiệm:

- bật/tắt Auto Sell;
- interval phút;
- thêm/sửa/xóa rule;
- nút lên/xuống;
- chặn item trùng;
- hiển thị min/max price hiện hành;
- callback trả ordered rule array cho panel cha.

Component nhận danh mục item và price rules qua props; không tự gọi API.

### Nguồn danh mục nông sản trên UI

Danh sách có thể chọn là giao của:

- nông sản từng xuất hiện trong produce snapshot;
- item có price rule hiện hành.

Tên item dùng mapping catalog hiện có từ cây, item, vật nuôi và foods. Quy tắc đã lưu vẫn hiển thị nếu item tạm thời không có trong kho; thiếu hàng chỉ làm runtime chờ lượt sau.

Nếu chưa có price rules, UI không cho thêm rule mới và hướng dẫn người dùng kết nối/đồng bộ sạp. Rule đã lưu không bị xóa tự động.

### Data flow

```text
AutoFarmPanel
  -> PUT /api/accounts/:id/auto/config
  -> normalizeAutoConfig + revision guard
  -> config JSON hiện có
  -> AvatarSession.updateAutoConfig
  -> AutoFarm.queueConfig
  -> đầu cycle kế tiếp áp dụng config
  -> cuối cycle kiểm tra autoSellIntervalMs
  -> ShopCoordinator.runAutoSellCycle
       -> sync own shop + price rules + produce
       -> rule 1: list lặp đến khi thiếu hàng/hết slot
       -> rule 2...
       -> transaction + ACK + reconciliation cho từng lô
  -> AutoFarm log + lastActions
  -> cycle-complete
  -> AvatarSession logout/chờ cycle kế tiếp theo config hiện có
```

### Thời điểm chạy

Auto Sell chạy ở cuối chu kỳ Auto Farm, sau các phase làm thay đổi nông sản và trước `cycle-complete`. Lựa chọn này bảo đảm:

- Nông sản vừa thu hoạch trong cycle có thể được nhìn thấy khi ShopCoordinator sync lại kho.
- Không chen cmd 103 vào giữa thao tác cây, vật nuôi, bếp hoặc nhiệm vụ.
- `AvatarSession` không logout trước khi transaction kết thúc.

Mốc `lastAutoSellAt` thuộc `AvatarSession` và được cập nhật khi một lượt đã thực sự bắt đầu đồng bộ, kể cả lượt không đăng được lô nào. Không cập nhật mốc nếu Auto Sell tắt, không có rule, hoặc chưa đến hạn. Nhờ đó `logoutAfterCycle` có thể teardown và tạo lại `AutoFarm` mà không làm Auto Sell chạy lại sớm.

## Thuật toán Auto Sell

1. Auto Farm xác nhận Auto Sell bật, có rule và đã đến hạn.
2. ShopCoordinator chiếm lane độc quyền. Nếu sạp đang bận, lượt không chen hàng một cách mù; lỗi conflict được ghi và kết thúc an toàn.
3. Đồng bộ tuần tự:
   - own shop snapshot;
   - price rules;
   - produce snapshot.
4. Xây danh sách slot trống từ snapshot own shop.
5. Với từng rule theo thứ tự:
   1. Nếu được yêu cầu dừng, kết thúc với `stopped`.
   2. Validate bounds và price rule hiện hành.
   3. Nếu validation cục bộ lỗi, ghi `skippedReason` rồi chuyển rule kế tiếp.
   4. Trong khi còn slot và kho hiện hành có ít nhất `quantity`:
      - chọn slot trống đầu tiên;
      - tạo transaction listing và idempotency key xác định;
      - gửi `addItemToShop`;
      - chờ ACK;
      - sync own shop, price rules và produce;
      - xác nhận slot và lượng kho;
      - cập nhật summary từ snapshot mới;
      - kiểm tra stop flag trước lô kế tiếp.
6. Nếu hết slot, dừng với `no-free-slot`.
7. Nếu duyệt hết rule, trả `completed`.
8. Nếu gặp lỗi trạng thái không chắc chắn, dừng với `uncertain-state`; không gửi thêm lô.

## Idempotency và transaction

Mỗi lô là một transaction `list` riêng để giữ lịch sử và trạng thái reconciliation hiện có.

Idempotency key phải xác định, không dùng random timestamp, và đủ khác nhau giữa các lô. Dạng khuyến nghị:

```text
auto-sell:<accountId>:<runId>:<ruleIndex>:<lotIndex>
```

`runId` là sequence tăng đơn điệu do `AvatarSession` giữ trong runtime và tăng khi một lượt Auto Sell bắt đầu; nó không phụ thuộc `AutoFarm.cycle`, vì cycle bị reset sau teardown/reconnect. Nếu server restart sau khi đã gửi nhưng trước khi hoàn tất, transaction hiện có vẫn ở trạng thái `unknown` và được reconcile theo cơ chế của ShopCoordinator. Lượt đầu sau restart phải sync/reconcile trước; runId mới phải được kết hợp với connection epoch hoặc một định danh session mới để không trùng idempotency key đã lưu. Không tự gửi lại key/lô của lượt cũ.

## Error handling và concurrency

### Lỗi cục bộ

Các lỗi dưới đây chỉ bỏ qua rule hiện tại:

- cấu hình rule sai bounds;
- duplicate item bị phát hiện từ dữ liệu legacy hoặc payload không qua UI;
- không có price rule hiện hành;
- giá ngoài min/max;
- item không còn được bán;
- kho không đủ một lô.

Thiếu hàng là trạng thái bình thường, không phải lỗi toàn cycle.

### Lỗi dừng toàn bộ lượt

- timeout sau khi có thể đã gửi packet;
- mất kết nối;
- ACK không khớp request;
- reconciliation không đủ bằng chứng;
- decode protocol lỗi;
- channel cmd 103 bị blocked;
- revision hoặc snapshot thay đổi bất ngờ;
- lỗi không thể xác định giao dịch đã tác động lên server hay chưa.

Sau lỗi này, không gửi thêm listing và không tự retry lô. Lượt sau phải sync đầy đủ trước khi ra quyết định.

### Khóa đồng thời

- Lane Auto Sell bao trọn toàn bộ lượt.
- Request sạp thủ công trong lúc lane chạy trả `OPERATION_CONFLICT`.
- Auto Farm chờ lane kết thúc trước khi emit `cycle-complete`.
- Stop Auto Farm không hủy packet đã gửi; giao dịch hiện tại đi đến ACK/reconciliation hoặc timeout, sau đó không bắt đầu lô mới.

## Thiết kế giao diện

Thêm section `🧺 Tự động đưa nông sản lên sạp` trong màn hình Auto Farm:

- checkbox/công tắc `Tự động bán trên sạp`;
- input `Chu kỳ kiểm tra (phút)`, mặc định 10, min 5;
- ordered rule editor;
- mỗi rule có select nông sản, quantity, price, nút lên, xuống và xóa;
- nút `Thêm quy tắc`;
- dùng chung nút `Lưu kế hoạch`.

Client validation:

- interval là số nguyên >= 5;
- item không trùng;
- quantity/price là số nguyên dương trong int32;
- giá nằm trong min/max đang biết;
- không thêm rule mới khi chưa có price rules.

Server luôn validate lại và là nguồn sự thật.

Ví dụ log:

```text
[sạp] đăng 4 lô Cà chua, mỗi lô 100, giá 50
[sạp] Khoai tây: thiếu hàng (30/50), chờ lượt sau
[sạp] hết 5/5 slot, dừng lượt bán
```

## Khả năng tương thích và migration

- Không cần migration DB vì Auto Farm config đã lưu dưới dạng JSON envelope.
- Cấu hình cũ thiếu các key mới được normalize thành Auto Sell tắt, interval mặc định và rules rỗng.
- Không thay đổi API đăng bán thủ công hay wire format cmd 103.
- Không thay đổi ý nghĩa trường `price`.
- Policy `shop.writeEnabled` và `liveAccountAllowed` vẫn áp dụng cho Auto Sell. Nếu policy không cho ghi, lượt Auto Sell ghi lý do và không gửi lệnh.

## Verification Plan

### Automated verification

Production code được viết trước; không dùng TDD. Do người dùng chưa yêu cầu tạo test mới, implementation không tạo test file mới. Chạy các kiểm tra hiện có:

1. Server typecheck/build.
2. Web typecheck/build.
3. Các test hiện có liên quan:
   - Auto Farm;
   - parser/lưu cấu hình Auto Farm;
   - AvatarSession và cycle completion;
   - ShopCoordinator transaction/reconciliation;
   - route cấu hình tài khoản.
4. Xác nhận normalize/parser bằng các test hiện có hoặc kiểm tra tích hợp phù hợp:
   - chấp nhận config hợp lệ;
   - từ chối duplicate item;
   - từ chối interval dưới 5 phút;
   - từ chối quantity/price ngoài giới hạn;
   - từ chối key/cấu trúc lạ;
   - giữ nguyên thứ tự rule qua save/load.
5. Trước khi sửa mỗi symbol, chạy GitNexus impact theo quy định project.
6. Trước commit, chạy `detect_changes({ scope: "compare", base_ref: "main" })` và kiểm tra affected flows.

### Manual verification

1. Kết nối tài khoản và đồng bộ sạp để có own shop, price rules và produce.
2. Bật Auto Sell, đặt chu kỳ 10 phút, tạo ít nhất hai rule và lưu.
3. Đổi thứ tự rule rồi tải lại trang; xác nhận thứ tự được giữ.
4. Bật Auto Farm.
5. Xác nhận trước deadline không phát lệnh Auto Sell.
6. Khi đến hạn:
   - đồng bộ own shop, price rules và kho trước;
   - rule đầu đăng lặp khi đủ hàng và còn slot;
   - chỉ chuyển rule sau khi rule đầu thiếu hàng;
   - không đăng lô nhỏ hơn quantity;
   - dừng khi hết slot;
   - không mở slot.
7. Đối chiếu mỗi transaction với slot và lượng kho sau listing.
8. Xác nhận transaction xuất hiện trong lịch sử sạp và summary xuất hiện trong Auto Farm log/`lastActions`.
9. Tắt Auto Farm; xác nhận không còn lượt Auto Sell độc lập.
10. Sửa cấu hình khi Auto Farm đang chạy; xác nhận bản mới áp dụng từ chu kỳ farm kế tiếp.
11. Dừng Auto Farm giữa một lượt; xác nhận giao dịch đã gửi hoàn tất/timeout và không có lô tiếp theo.
12. Mô phỏng timeout hoặc mất kết nối; xác nhận trạng thái `unknown`/`uncertain-state`, không tự retry và lượt dừng.
13. Bật `logoutAfterCycle`; xác nhận logout chỉ xảy ra sau khi Auto Sell kết thúc.

## Tiêu chí chấp nhận

- Người dùng cấu hình được bật/tắt, interval và ordered rules trên UI Auto Farm.
- Cấu hình được lưu bền vững và giữ nguyên thứ tự.
- Auto Sell chỉ chạy trong Auto Farm và chỉ khi đến hạn.
- Rule ưu tiên cao được đăng lặp đến khi thiếu hàng hoặc hết slot.
- Không đăng lô thiếu, không mở slot và không điều chỉnh giá.
- Mọi listing có transaction, ACK và reconciliation.
- Lỗi cục bộ không chặn rule sau; lỗi trạng thái không chắc chắn dừng lượt và không retry.
- Không có thao tác sạp thủ công chen vào lane Auto Sell.
- Auto Farm stop/logout không cắt ngang giao dịch đã gửi.
- Build/typecheck và các test hiện có liên quan hoàn tất theo kết quả được báo trung thực.
