# Auto Sell In AutoFarm Cycle Design

## Mục tiêu và bối cảnh

Luồng sạp tự động hiện có hai lớp điều kiện độc lập với vòng AutoFarm:

1. `AutoFarm.runCycle()` chỉ gọi callback sạp khi có ít nhất một
   `autoSellRule`.
2. `AvatarSession` tiếp tục chặn callback bằng `autoSellIntervalMs`, mặc định
   600.000 ms (10 phút).

Do đó, một slot đã bán có thể tiếp tục hiển thị và không được thu khi danh sách
rule rỗng hoặc khi vòng AutoFarm chạy trước mốc throttle 10 phút. Trạng thái live
được kiểm tra ngày 24/08/2026 đã xác nhận tài khoản có
`autoSellProduce = true`, `autoSellRules = []`, slot Dưa Hấu ở trạng thái đã bán
nhưng không có transaction `auto-sell-collect:*` vì callback sạp chưa được chạy.

Người dùng đã chọn phạm vi **cả thu và đăng**: toàn bộ pha sạp tự động phải chạy
một lần trong mỗi vòng AutoFarm, giống các hành động AutoFarm khác. Pha này luôn
thu dọn trước, sau đó mới đăng bán theo rules nếu có. Không còn scheduler hoặc
throttle 10 phút riêng cho sạp.

Mục tiêu của thay đổi:

- khi `autoSellProduce` bật, gọi pha sạp đúng một lần trong mỗi vòng
  `AutoFarm.runCycle()`;
- luôn đồng bộ và thu slot đã bán/hết hạn, kể cả khi rules rỗng;
- nếu có rules, tiếp tục đăng bán trong cùng pha, sau bước thu dọn;
- bỏ ảnh hưởng runtime và điều khiển UI của chu kỳ 10 phút;
- tiếp tục dùng lane, transaction, timeout, idempotency, no-retry và
  reconciliation hiện có của `ShopCoordinator`.

Spec này thay thế hai contract cũ trong
`docs/superpowers/specs/2026-08-24-auto-sell-collect-shop-design.md`:

- “có ít nhất một `autoSellRule`” không còn là điều kiện để chạy pha sạp;
- `autoSellIntervalMs` không còn quyết định thời điểm chạy pha sạp.

Các contract an toàn còn lại của thiết kế cũ tiếp tục có hiệu lực.

## Phạm vi

### In scope

- Đổi gate trong `AutoFarm.runCycle()` để gọi `runAutoSellCycle` khi
  `autoSellProduce === true` và callback tồn tại.
- Chuẩn hóa rules truyền vào callback thành `cfg.autoSellRules ?? []`.
- Chạy toàn bộ `ShopCoordinator.runAutoSellCycle()` đúng một lần trong mỗi vòng
  AutoFarm: đồng bộ sạp, thu slot đã bán, rút slot hết hạn, rồi đăng bán theo
  rules còn hiệu lực.
- Xóa throttle dựa trên `lastAutoSellAt`/`autoSellIntervalMs` khỏi callback do
  `AvatarSession` cung cấp.
- Giữ `runId` riêng cho mỗi pha sạp để bảo toàn idempotency key.
- Xóa trường nhập “Chu kỳ kiểm tra” khỏi giao diện cấu hình Auto Sell.
- Giữ khả năng đọc và round-trip `autoSellIntervalMs` cũ để không làm hỏng
  config JSON đã lưu, nhưng coi field này là legacy và không dùng trong runtime.
- Với rules rỗng, hoàn tất pha thu dọn rồi kết thúc mà không tạo listing mới.

### Out of scope

- Tạo scheduler sạp độc lập hoặc thu sạp ngay khi nhận packet/event bán hàng.
- Thêm flag riêng như `autoCollectShop`.
- Migration để xóa `autoSellIntervalMs` khỏi toàn bộ bản ghi SQLite hiện có.
- Thay đổi wire format hay decoder cmd 103 sub-type 4.
- Thay đổi thuật toán chọn listing, giá, quantity, priority hoặc free-slot.
- Rút listing còn đang bán, tự mở slot hoặc tự làm mới chợ.
- Thay đổi thứ tự các hành động AutoFarm khác ngoài việc pha sạp không còn tự
  throttle.
- Tạo hay sửa test file khi người dùng chưa yêu cầu trực tiếp.
- Tự động thực hiện live game write trong verification nếu chưa có xác nhận tại
  thời điểm chạy.

## Input, output và behavior matrix

### Input

Luồng tiếp tục nhận các field hiện có:

```ts
interface AutoFarmConfig {
  autoSellProduce?: boolean;
  autoSellIntervalMs?: number; // legacy: accepted, persisted, ignored at runtime
  autoSellRules?: AutoSellRule[];
}
```

Callback không đổi interface:

```ts
runAutoSellCycle?: (
  rules: readonly AutoSellRule[],
  shouldStop: () => boolean,
) => Promise<AutoSellCycleResult>;
```

Không thêm input, API endpoint hay DB migration. `autoSellIntervalMs` có thể còn
tồn tại trong payload/config cũ, nhưng không được đọc để quyết định có chạy pha
sạp hay không.

### Behavior matrix

| `autoSellProduce` | `autoSellRules` | Hành vi trong mỗi vòng AutoFarm |
| --- | --- | --- |
| `false`/không có | mọi giá trị | Không gọi callback, không thu sạp, không đăng bán |
| `true` | `undefined` hoặc `[]` | Gọi callback với `[]`; thu slot đã bán/hết hạn; không đăng listing |
| `true` | có ít nhất một rule | Thu slot đã bán/hết hạn, rồi đăng bán theo rules trong cùng pha |

Mọi giá trị `autoSellIntervalMs`, gồm cả 600.000 ms cũ, cho cùng kết quả trong
bảng trên: không tạo thêm gate thời gian.

Policy write, trạng thái online, `shouldStop`, timeout và reconciliation tiếp tục
được kiểm tra trong `AvatarSession`/`ShopCoordinator` như hiện tại.

### Output

Không đổi `AutoSellCycleResult`:

```ts
interface AutoSellCycleResult {
  startedAt: number;
  completedAt: number;
  collectedSoldSlots: number;
  withdrawnExpiredSlots: number;
  listedLots: number;
  stopReason: AutoSellStopReason;
  rules: AutoSellRuleResult[];
}
```

Với rules rỗng và một pha thành công:

- `rules = []`;
- `listedLots = 0`;
- hai counter thu dọn phản ánh số slot được xác nhận thành công;
- `stopReason` giữ semantics hiện tại.

## Edge cases

- `autoSellRules` không tồn tại: truyền `[]`, không dereference `undefined`.
- Rules rỗng và không có slot cần thu: pha hoàn tất với mọi counter bằng `0`.
- Rules rỗng nhưng có slot đã bán/hết hạn: thu tuần tự như luồng hiện tại và
  không tạo transaction `list`.
- Rules có dữ liệu: thu dọn trước, tính free slots sau thu dọn, rồi đăng bán theo
  validation hiện tại.
- AutoFarm có interval vòng lặp riêng: pha sạp chạy theo chính interval đó,
  không cộng thêm delay 10 phút.
- Một vòng `AutoFarm.runCycle()` chỉ gọi callback sạp một lần; không tạo polling
  hoặc timer sạp phụ.
- Policy write tắt: coordinator trả summary zero; không gửi write.
- AutoFarm bị stop trước candidate: trả `stopped`, không bắt đầu packet mới.
- Timeout, mất kết nối, ACK sai hoặc reconciliation thiếu bằng chứng: giữ
  `unknown`/`uncertain-state`, không retry và không xử lý candidate tiếp theo.
- `autoSellProduce = false` với slot đã bán: không tự thu, giữ đúng ý nghĩa tắt
  tính năng.
- Config cũ có `autoSellIntervalMs`: vẫn parse/save được; giá trị không ảnh
  hưởng tần suất chạy pha sạp.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Các phương án đã cân nhắc

#### Phương án A — Pha sạp là một bước của mỗi vòng AutoFarm (chọn)

`AutoFarm.runCycle()` gọi `runAutoSellCycle(cfg.autoSellRules ?? [], ...)` khi
Auto Sell bật. `AvatarSession` không throttle theo thời gian; nó chỉ tạo `runId`
và chuyển pha sang `ShopCoordinator`.

Ưu điểm:

- khớp trực tiếp yêu cầu “chạy cùng luồng với AutoFarm như các hành động khác”;
- cả thu và đăng dùng cùng một nhịp, không có hai scheduler cạnh tranh;
- rules rỗng tự nhiên làm vòng listing chạy 0 lần nhưng vẫn thu dọn;
- tiếp tục dùng đúng lane và safety contract đã có.

Đánh đổi: tần suất đọc/ghi sạp tăng theo tần suất AutoFarm. Lane, stop guard và
reconciliation hiện có giới hạn việc chồng lấn; đây là tần suất người dùng đã
chọn.

#### Phương án B — Chỉ thu dọn mỗi vòng, đăng bán vẫn 10 phút (không chọn)

Giảm số lần thử đăng nhưng tạo hai nhịp thời gian trong cùng một tính năng và
không đúng lựa chọn “cả thu và đăng”.

#### Phương án C — Event-driven hoặc scheduler sạp riêng (không chọn)

Có thể giảm độ trễ nhưng thêm nguồn phát live write, trạng thái timer và nguy cơ
xung đột lane. Phạm vi lớn hơn yêu cầu.

### Files/modules liên quan

#### `avatar-web/server/src/autoFarm.ts`

Đổi gate của pha sạp từ “Auto Sell bật và có rules” thành “Auto Sell bật”:

```ts
if (cfg.autoSellProduce && this.options.runAutoSellCycle) {
  const result = await this.options.runAutoSellCycle(
    cfg.autoSellRules ?? [],
    () => this.aborted,
  );
}
```

Giữ vị trí hiện tại của block trong `runCycle`, log, `await tick()` và error
handling. Callback chỉ xuất hiện một lần nên pha sạp chạy đúng một lần trong mỗi
vòng AutoFarm.

#### `avatar-web/server/src/session/avatarSession.ts`

Trong callback `runAutoSellCycle`:

- bỏ đọc `cfg.autoSellIntervalMs`;
- bỏ so sánh `now - lastAutoSellAt`;
- bỏ summary “Chưa đến chu kỳ kiểm tra”;
- bỏ field runtime `lastAutoSellAt` nếu không còn caller;
- giữ tăng `autoSellRunSequence`, tạo `runId`, `requireShop()` và gọi
  `coordinator.runAutoSellCycle(...)`.

Callback không tự schedule và không tự retry.

#### `avatar-web/server/src/session/shopCoordinator.ts`

Không dự kiến sửa. `runAutoSellCycle([])` đã đồng bộ sạp, thu candidate đã
bán/hết hạn, xây free slots, chạy vòng rules 0 lần và trả
`listedLots = 0`.

#### `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`

Xóa state/effect/handler và control “Chu kỳ kiểm tra”. Editor chỉ còn cấu hình
bật/tắt và danh sách rules. Xóa prop interval khỏi contract riêng của editor.

#### `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`

Ngừng truyền `autoSellIntervalMs` và ngừng nhận patch interval từ
`AutoSellRulesEditor`. Tiếp tục giữ giá trị legacy trong draft/save round-trip
để payload cũ không bị thay đổi ngoài ý muốn; giá trị này không còn được hiển
thị hoặc dùng để schedule.

#### Config/API/DB compatibility

`autoSellIntervalMs` tiếp tục được parser, DTO và JSON config chấp nhận trong
thay đổi này. Điều đó tránh migration và tránh làm hỏng client/config cũ, nhưng
server runtime không tham chiếu field để throttle. Việc xóa hẳn field khỏi dữ
liệu lưu trữ là cleanup riêng ngoài scope.

### Data flow

```text
AutoFarm.runCycle
  -> thực hiện các pha AutoFarm theo thứ tự hiện có
  -> autoSellProduce bật?
      -> không: bỏ qua pha sạp
      -> có: runAutoSellCycle(autoSellRules ?? []) đúng một lần
           -> AvatarSession tạo runId, không kiểm tra interval 10 phút
           -> ShopCoordinator.runAutoSellCycle(rules)
                -> sync own-shop + price rules + produce
                -> thu slot isSale/isTimeOut trong lane
                -> rules rỗng: kết thúc, không tạo listing
                -> rules có dữ liệu: đăng theo rules hiện tại
           -> AutoFarm ghi summary, tick và tiếp tục kết thúc cycle
```

Không có `setInterval`, timestamp gate hoặc scheduler sạp riêng trong flow mới.

## Concurrency, error handling và transaction safety

- Không gửi cmd 103 trực tiếp từ `AutoFarm` hoặc UI.
- `ShopCoordinator` tiếp tục serialize toàn bộ pha trong lane
  `auto-sell-cycle`.
- `autoSellRunSequence` tiếp tục tạo `runId` riêng cho mỗi vòng đã vào pha sạp.
- Idempotency key thu sạp tiếp tục dùng
  `auto-sell-collect:<accountId>:<runId>:<slot>:<kind>`.
- Packet đã có thể tới server không được tự retry.
- Rules rỗng không thay đổi guard `writeEnabled`, epoch, online state,
  `shouldStop` hoặc shop channel blocked.
- Không có transaction `list` khi rules rỗng; chỉ có transaction `withdraw` cho
  candidate thực sự được xử lý.
- Bỏ throttle không được bỏ các delay/tick tuần tự đang bảo vệ những hành động
  trong một vòng AutoFarm.

## Impact analysis

Các symbol production dự kiến sửa:

- `AutoFarm.runCycle` trong `avatar-web/server/src/autoFarm.ts`;
- `AvatarSession.connect` và field `lastAutoSellAt` trong
  `avatar-web/server/src/session/avatarSession.ts`;
- component `AutoSellRulesEditor`;
- component `AutoFarmPanel` tại call site của editor.

Kết quả phân tích hiện có:

- Exact context của `AutoFarm.runCycle` cho thấy direct callers là
  `AutoFarm.start` và recursive scheduling của chính `runCycle`, đều trong cùng
  file.
- GitNexus `impact(target="runCycle")` chọn nhầm `MacroRunner.runCycle` vì trùng
  tên. Trước production edit phải dùng exact UID/context và graph query theo
  file; không dùng kết quả symbol nhầm làm bằng chứng.
- `AvatarSession.connect` được gọi bởi start/retry của session và tham gia nhiều
  flow kết nối, nên patch phải chỉ giới hạn ở callback sạp và field throttle.
- Impact cấp class cho `AutoFarm`, `AvatarSession` và
  `AutoSellRulesEditor` không trả cảnh báo HIGH/CRITICAL. JSX parent trực tiếp
  của editor là `AutoFarmPanel` theo source inspection.
- `ShopCoordinator.runAutoSellCycle`, wire protocol, API và DB schema không đổi
  contract.

Blast radius được đánh giá **MEDIUM**: thay đổi tần suất một live-write phase và
chạm cả server lẫn UI, nhưng không đổi protocol hay primitive giao dịch. Trước
mỗi production edit vẫn phải chạy lại impact cho exact symbol theo quy định
GitNexus và cảnh báo người dùng nếu kết quả mới là HIGH/CRITICAL.

## Verification Plan

### Static và automated verification

Không dùng TDD và không tạo/sửa test file vì người dùng chưa yêu cầu trực tiếp.
Sau khi production code hoàn tất:

1. Chạy typecheck, test hiện có và build của `avatar-web/server` theo scripts
   thực tế trong `package.json`.
2. Chạy test hiện có và build của `avatar-web/web` vì thay đổi UI contract.
3. Chạy `git diff --check`.
4. Rà source xác nhận call site dùng `cfg.autoSellRules ?? []`, không còn gate
   `rules.length > 0`, không còn runtime gate
   `autoSellIntervalMs`/`lastAutoSellAt`, và UI không còn control
   “Chu kỳ kiểm tra”.
5. Chạy `gitnexus_detect_changes({ scope: "all" })`; xác nhận chỉ các symbol và
   flow AutoFarm/Auto Sell/UI dự kiến bị ảnh hưởng.

### Verification hành vi không phát live write

Trong môi trường không nối game thật, dùng fake/stub callback hoặc harness tạm
không tạo test file để xác nhận:

1. `autoSellProduce = false`: callback không được gọi.
2. `autoSellProduce = true`, `autoSellRules = []`: callback được gọi đúng một
   lần trong một vòng với `[]`.
3. `autoSellProduce = true`, có rule: callback được gọi đúng một lần và nhận
   nguyên mảng rules.
4. Thay đổi `autoSellIntervalMs` không làm callback trả
   “Chưa đến chu kỳ kiểm tra”.
5. Rules rỗng tạo `listedLots = 0`; rules có dữ liệu vẫn đi qua thứ tự cleanup
   rồi listing.

### Verification UI đọc-only

1. Mở panel AutoFarm/Auto Sell.
2. Xác nhận không còn label/input “Chu kỳ kiểm tra”.
3. Xác nhận bật/tắt Auto Sell và editor rules vẫn hiển thị, lưu và hydrate như
   trước.
4. Xác nhận payload cũ có `autoSellIntervalMs` không làm UI lỗi.

### Live acceptance có kiểm soát

Live acceptance là bước riêng, chỉ chạy sau xác nhận tại thời điểm thực hiện vì
nó có thể gửi cmd 103 sub-type 4 và thay đổi trạng thái game:

1. Dùng tài khoản bật `autoSellProduce` với một slot `isSale = true` hoặc
   `isTimeOut = true`.
2. Chờ vòng AutoFarm kế tiếp; không cần chờ mốc 10 phút và không bấm `Rút` thủ
   công song song.
3. Xác nhận log có `[sạp tự động] bắt đầu kiểm tra sạp` đúng một lần trong vòng
   và có summary thu dọn/đăng bán.
4. Xác nhận transaction `withdraw` dùng idempotency key
   `auto-sell-collect:*` và có trạng thái được chứng minh; nếu thiếu bằng chứng,
   báo trung thực `unknown`.
5. Xác nhận own-shop không còn slot cũ đã bán/hết hạn.
6. Nếu rules rỗng, xác nhận không có transaction `list`; nếu có rules, xác nhận
   listing chỉ bắt đầu sau cleanup.

### Guard cho backend dev đang chạy

Checkout hiện tại có thể có backend `tsx watch` nối game thật. Để patch source
không vô tình hot-reload và kích hoạt pha sạp:

- implementation phải diễn ra trong worktree cô lập không được process live
  theo dõi; hoặc
- backend/AutoFarm live phải được người dùng chủ động dừng trước production
  edit.

Agent không tự dừng/bật AutoFarm, restart backend hoặc chấp nhận live write nếu
chưa có xác nhận phù hợp.

## Tiêu chí chấp nhận

- Khi `autoSellProduce = true`, toàn bộ pha cleanup rồi listing chạy đúng một
  lần trong mỗi vòng AutoFarm.
- Không còn gate hoặc delay riêng 10 phút trong runtime sạp.
- UI không còn hiển thị control “Chu kỳ kiểm tra”.
- Rules rỗng vẫn thu slot `isSale`/`isTimeOut` và không tạo listing.
- Rules có dữ liệu tiếp tục thu dọn trước rồi đăng bán trong cùng pha.
- `autoSellProduce = false` không tự thu hoặc đăng bán.
- Config cũ có `autoSellIntervalMs` vẫn được chấp nhận nhưng field không ảnh
  hưởng hành vi runtime.
- Stop, lane, timeout, idempotency, reconciliation và no-retry contract không
  đổi.
- Không đổi wire protocol hoặc DB schema; không tạo migration.
- Không có file test mới/sửa khi chưa được yêu cầu.
- Typecheck, test hiện có, build, UI read-only verification và diff check pass.
- Không phát live game write ngoài bước acceptance được xác nhận.
