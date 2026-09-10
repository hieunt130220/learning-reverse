# Auto Fishing Periodic Farm Design

> **Ngày lập:** 2026-09-10  
> **Trạng thái:** Chờ User Review (User Review Gate)  
> **Phạm vi source:** `avatar-web/server/src/session/avatarSession.ts`, `avatar-web/server/src/autoFarm.ts`

## 1. Mục tiêu và bối cảnh

Auto Fishing hiện giữ nhân vật trong Park (map câu 13/14) suốt vòng lặp, còn `AutoFarm` cần chuyển handler và vị trí sang nông trại. Hai runner không thể phát packet đồng thời trên cùng `GameClient` mà không gây xung đột context, dialog rate-limit hoặc race khi chuyển map.

Thiết kế này bổ sung một coordinator trong `AvatarSession` để:

1. Chạy đúng một chu kỳ farm bằng `lastAutoConfig` trước khi vào khu câu cá.
2. Sau khi quay lại câu, đặt lịch một lượt farm mới mỗi 30 phút.
3. Khi timer đến hạn, không cắt ngang cú giật cá/thử thách đang xử lý; chỉ chuyển sang farm tại checkpoint an toàn giữa hai lượt câu.
4. Chờ một chu kỳ farm hoàn tất bằng Promise có timeout và hủy hợp tác.
5. Sau farm, dùng lại toàn bộ preflight hiện có của `runFishingLoop()` để vào Park, kiểm tra/mua bù vé, cần, mồi và tiếp tục câu.
6. Dọn timer, listener, AbortController và runner khi người dùng dừng, đổi mode, teardown hoặc phiên ngắt kết nối.

## 2. Hiện trạng đã khảo sát

### 2.1. `AvatarSession`

- `desiredMode` là ý định bền vững của người dùng; `activeMode` là mode đang chạy. `switchAutomationMode()` tuần tự hóa việc dừng mode cũ và khởi động mode mới.
- `startDesiredAutomation()` hiện đặt `activeMode = 'auto_fishing'` rồi gọi `startFishingLoop()`.
- `startFishingLoop()` sở hữu một `fishingAbortController`; `runFishingLoop()` hiện tự vào Park, chạy preflight, bắt đầu câu và lặp quăng cần vô hạn.
- Một lượt cá chỉ thật sự kết thúc an toàn sau khi kết quả quăng cần đã settle, delay hậu xử lý hoàn tất, `client.cauCaXong()` (TX44) được gửi và `fishing-done` hoặc timeout của nó đã settle.
- `handleFishingChallenge()` chạy bất đồng bộ ngoài thân loop và dùng `fishingChallengeGeneration` để chặn kết quả ML cũ gửi TX43 sau khi context đã thay đổi.
- `joinParkWithRetry()` đã có cooldown 2,2 giây, tối đa ba lần thử và backoff chống spam dialog. Luồng quay lại Park phải tái sử dụng helper này.
- `autoCycleTimer` hiện chỉ phục vụ mode `auto_farm`; không được tái sử dụng cho lịch farm của Auto Fishing vì callback của nó phụ thuộc `desiredMode === 'auto_farm'` và có thể logout/teardown session.
- `onDisconnected()` hiện dừng `AutoFarm` nhưng chưa hủy ngay fishing controller. Thiết kế mới phải gom cleanup để disconnect hủy toàn bộ coordinator ngay lập tức trong khi vẫn giữ `desiredMode = 'auto_fishing'` cho lần reconnect sau.

### 2.2. `AutoFarm`

- Session tạo `AutoFarm` với `continuous: false`; mỗi lần `start()` chỉ chạy một cycle và phát `cycle-complete`.
- `stop()` tăng generation, xóa timer và chờ `activeCycle` quiesce. Đây là nền tảng phù hợp cho graceful cancellation, nhưng caller hiện phải tự ghép listener `cycle-complete` với `start()`.
- `start()` chuẩn hóa và validate config qua `makeConfig()`, nhưng không trả Promise hoàn tất cycle.
- Các bước chờ phản hồi farm đã có timeout cục bộ, song một cycle đầy đủ vẫn cần hard timeout ở tầng session để không giữ Auto Fishing vô hạn.
- Giá trị config chưa từng lưu trong repository được biểu diễn bằng object rỗng `{}`. Do đó `{}` phải được xem là “không có `lastAutoConfig` đã lưu” đối với tính năng kèm farm, dù `AutoFarm` có thể áp default để chạy được.

### 2.3. GitNexus

- Repository được bind: `learning-reverse`.
- Index tại commit `dd9708a5726ee29d8de1d1903a73c828d8e57a6a`, trùng HEAD lúc khảo sát nên không stale.
- Graph nhận diện `AvatarSession`, `AutoFarm`, `startFishingLoop()` và `runFishingLoop()`, nhưng không dựng execution process hữu ích cho loop câu cá; thiết kế vì vậy dựa thêm vào đọc trực tiếp source và lifecycle handlers.
- Chưa chạy `gitnexus_impact` trong bước Spec vì chưa sửa production symbol. Impact bắt buộc sẽ chạy cho từng method/class dự kiến sửa ngay trước Bước 3.

## 3. Phạm vi

### 3.1. In scope

- Điều phối initial farm và farm định kỳ 30 phút trong lifecycle Auto Fishing.
- State machine nội bộ, one-shot scheduler, graceful checkpoint và cơ chế wake khỏi khoảng nghỉ giữa hai lượt câu.
- Promise/hook chạy đúng một AutoFarm cycle, hỗ trợ AbortSignal và đảm bảo listener được tháo.
- Retry/cooldown có giới hạn khi chuyển vào Farm; tái sử dụng `joinParkWithRetry()` khi quay về Park.
- Hard timeout cho farm cycle và đường recovery không cho farm cũ chạy song song với fishing mới.
- Cleanup tại stop automation, đổi mode, disconnect, teardown và permanent failure.
- Log rõ ba giai đoạn farm kèm theo Auto Fishing.

### 3.2. Out of scope

- Database migration hoặc thay đổi schema/persistence.
- Frontend UI, DTO/WebSocket contract hoặc thêm trạng thái hiển thị mới.
- `.env`, Dockerfile, `package.json` hoặc cấu hình hạ tầng.
- Thay đổi ML inference, protocol giải thử thách cá, logic bán cá hoặc chính sách hành động farm.
- Cho phép Auto Fishing và AutoFarm chạy packet đồng thời.
- Tạo test file mới hoặc áp dụng TDD. Verification chỉ dùng kiểm tra tĩnh, build/typecheck, test hiện có và manual/live acceptance khi được user cấp quyền riêng.

## 4. Các phương án kiến trúc

### Phương án A — Session-owned coordinator + AutoFarm one-cycle Promise (khuyến nghị)

`AvatarSession` giữ nguyên `desiredMode/activeMode = auto_fishing`, điều khiển các phase con và là chủ sở hữu duy nhất của timer/AbortController. `AutoFarm` cung cấp API Promise chạy một cycle để session có thể await, timeout và cancel rõ ràng.

Ưu điểm:

- Không làm sai ý nghĩa persisted mode.
- Một nơi duy nhất quyết định lúc nào được chuyển context.
- Không để timer tự phát packet giữa lúc đang giật cá.
- Dễ chứng minh cleanup, timeout và không overlap.
- Tái sử dụng toàn bộ logic farm và fishing preflight hiện có.

Nhược điểm: cần refactor nhỏ `runFishingLoop()` thành các chặng có checkpoint và thêm API one-cycle trong `AutoFarm`.

### Phương án B — Tạm gọi `switchAutomationMode(auto_farm)` rồi chuyển lại `auto_fishing`

Phương án này tái sử dụng public mode transition nhưng làm `desiredMode` dao động theo phase nội bộ, dễ bị persist nhầm, kích hoạt scheduler/logout của AutoFarm và xung đột với request stop/change mode của user. Không chọn.

### Phương án C — Logout/reconnect ở mỗi lượt farm

Tách context bằng connection mới sẽ cô lập mạnh hơn, nhưng tăng login traffic, kéo dài downtime câu cá, tương tác phức tạp với retry/rejection và không cần thiết khi chuyển handler trên cùng connection thành công. Chỉ dùng teardown/reconnect như đường recovery cuối cùng nếu farm đã timeout mà không quiesce. Không chọn làm luồng chính.

## 5. Thiết kế được chọn

### 5.1. State machine nội bộ

Không mở rộng DTO `FishingRuntimeState` vì file type/UI nằm ngoài scope. `AvatarSession` giữ phase private để kiểm soát chuyển tiếp:

```text
START_AUTO_FISHING
        |
        v
INITIAL_FARM  -- no/invalid config --> RETURN_TO_PARK
        | completed / bounded failure
        v
RETURN_TO_PARK --> FISHING
                      |
             30-minute timer marks due
                      v
                 FARM_DUE
                      |
          finish current cast/challenge + TX44
                      v
               PERIODIC_FARM
                      |
       completed / bounded failure / recovery
                      v
                RETURN_TO_PARK --> FISHING

STOP / MODE CHANGE / DISCONNECT / TEARDOWN
        --> STOPPING --> clear timer + abort child work + await quiescence
```

Các phase dự kiến: `idle`, `initial-farm`, `moving-to-park`, `fishing`, `farm-due`, `periodic-farm`, `returning-to-park`, `stopping`. Phase là implementation detail, không persist.

Invariant:

- Tối đa một fishing lifecycle cho mỗi `automationGeneration`.
- Tối đa một AutoFarm cycle kèm theo lifecycle đó.
- Timer callback không gửi packet và không gọi `AutoFarm.start()`; nó chỉ đánh dấu `farmDue` và đánh thức loop nếu đang nghỉ an toàn.
- Chỉ phase `initial-farm` hoặc `periodic-farm` được phép gửi packet farm.
- Chỉ phase `moving-to-park`, `returning-to-park` hoặc `fishing` được phép gửi packet Park/fishing.
- Mọi continuation phải kiểm tra parent signal, generation, epoch, client identity, online status và `desiredMode === 'auto_fishing'` trước khi gửi packet.

### 5.2. Scheduler 30 phút

Thêm constant private:

```ts
const FISHING_FARM_INTERVAL_MS = 1_800_000;
```

Thêm tài nguyên do session sở hữu:

- `fishingFarmTimer?: NodeJS.Timeout`
- `fishingFarmDue: boolean`
- `fishingFarmAbortController?: AbortController`
- một wake resolver/promise private để cắt ngắn khoảng nghỉ giữa hai cast khi timer đến hạn, nhưng không abort parent fishing lifecycle.

Dùng recursive one-shot `setTimeout`, không dùng `setInterval`:

1. Initial farm chạy trước khi vào Park.
2. Sau khi initial farm kết thúc/bị bỏ qua và loop đã sẵn sàng câu, arm timer 30 phút.
3. Timer fire: set `fishingFarmDue = true`, clear handle hiện tại, resolve wake signal và không arm timer mới.
4. Sau lượt farm định kỳ kết thúc và Park preflight thành công trở lại, reset due rồi arm một timer 30 phút mới.

Cách này không tạo backlog hoặc hai farm cycle chồng nhau nếu một cycle kéo dài. Khoảng 30 phút được tính từ lúc Auto Fishing đã quay lại hoạt động sau lượt farm trước, thay vì tính cả thời gian nhân vật đang ở Farm.

### 5.3. Graceful pause của fishing loop

`runFishingLoop()` được tách logic ở mức private helper hoặc vòng ngoài để có thể quay lại bước Park preflight sau farm mà không nhân đôi code.

Checkpoint được phép handoff:

1. Trước khi gửi `client.quanCau()` cho một cast mới.
2. Sau khi cast hiện tại đã settle và `client.cauCaXong()`/`fishing-done` đã settle.
3. Sau khi một lỗi/no-bite đã reset session câu bằng `cauCaXong()`.

Không handoff khi:

- đang chờ cá cắn;
- đang chạy ML/per-key delay của `handleFishingChallenge()`;
- đang chờ `fishing-success-result`;
- kết quả cá đã về nhưng TX44 chưa settle.

Khi `farmDue` xuất hiện trong một cast, loop tiếp tục hoàn thành cast đó. Ngay trước khi rời Park, tăng `fishingChallengeGeneration` để mọi quyết định ML trễ trở thành inert, gửi/hoàn tất TX44 nếu cần, rồi mới chạy farm. Nếu timer đến trong khoảng nghỉ an toàn, wake signal kết thúc riêng delay nghỉ để farm sớm; parent `fishingAbortController` không bị abort.

### 5.4. AutoFarm one-cycle contract

`AutoFarm` bổ sung một API Promise công khai, tên cuối cùng sẽ được khóa trong Plan, với contract tương đương:

```ts
runSingleCycle(
  cfg: Partial<AutoFarmConfig>,
  options?: { signal?: AbortSignal },
): Promise<AutoFarmState>
```

Contract:

- Chỉ chấp nhận khi client online và không có cycle trước đang chạy/dừng.
- Chuẩn hóa/validate config bằng cùng `makeConfig()` như `start()`.
- Chạy đúng một cycle trên instance `continuous: false`.
- Resolve bằng state phát tại `cycle-complete`.
- Nếu signal abort: request stop, tháo listener, await `activeCycle` quiesce rồi reject bằng lỗi hủy nhận diện được.
- Nếu start/validation lỗi: tháo listener và reject đồng bộ thành Promise rejection; không làm crash fishing lifecycle.
- Luôn tháo listener `cycle-complete` và `abort` ở mọi nhánh resolve/reject.
- Không tự thay đổi `desiredMode`, `activeMode`, không tự logout và không tự đặt lịch cycle kế.

`start()` hiện có vẫn giữ semantics cho Auto Farm độc lập. Phần khởi chạy cycle dùng chung sẽ được gom nội bộ để tránh hai implementation khác nhau.

### 5.5. Config eligibility và cập nhật config

Trước mỗi initial/periodic cycle, `AvatarSession` lấy snapshot mới nhất của `lastAutoConfig`.

- Nếu object không có own key (`Object.keys(lastAutoConfig).length === 0`): xem là chưa từng lưu cấu hình, ghi warning và bỏ qua cycle.
- Nếu có key nhưng `AutoFarm` validation từ chối: ghi warning chứa message an toàn, bỏ qua cycle và tiếp tục Auto Fishing.
- Không thay `lastAutoConfig` bằng default và không persist gì trong scheduler.
- Nếu user cập nhật config trong lúc đang câu, cycle kế tiếp dùng config mới.
- Nếu config đổi giữa một cycle đang chạy, cycle hiện tại giữ snapshot đã bắt đầu; config mới chỉ áp dụng lượt sau để tránh thay policy giữa chừng.

Log tối thiểu:

```text
[nông trại] Bỏ qua chu kỳ kèm Auto Fishing: chưa có cấu hình Auto Farm đã lưu.
[nông trại] Bỏ qua chu kỳ kèm Auto Fishing: cấu hình không hợp lệ: <reason>.
```

### 5.6. Chuyển context Farm và Park

#### Sang Farm

AutoFarm cycle dùng bước enter-farm có retry giới hạn thay cho one-shot mù:

- Tối đa 3 lần.
- Mỗi lần arm listener phản hồi farm/dialog trước khi gửi `client.enterFarm()`.
- Cooldown tối thiểu 2,2 giây giữa hai lần; backoff lần sau 2,2 giây rồi 4,4 giây.
- Dialog thông tin/phần thưởng không được xem là lỗi chuyển map.
- Temporary/rate-limit dialog hoặc timeout farm snapshot mới được retry.
- Lỗi terminal được ghi lại và kết thúc cycle có kiểm soát; không spam thêm packet.

Helper retry phải dùng sleep có thể hủy và kiểm tra AutoFarm generation trước mỗi send.

#### Quay lại Park

Sau farm bình thường hoặc lỗi đã quiesce:

1. Ghi `[câu cá] Đã xong farm, quay lại khu câu cá...`.
2. Chạy lại toàn bộ Park preflight hiện có: `enterParkContext`, board-list TX90, `joinParkWithRetry(map, area)`, cooldown và xác nhận world snapshot.
3. Chạy lại `startFishing()`; logic hiện có tự kiểm tra/bổ sung vé, cần, mồi và xử lý rương đầy trước khi cast tiếp.

Không cache giả định rằng vật phẩm trước farm vẫn còn hợp lệ.

### 5.7. Timeout, lỗi và recovery

Thêm hard timeout cho mỗi farm cycle ở tầng `AvatarSession`. Giá trị cụ thể sẽ là constant có tên, mặc định thiết kế **120.000 ms (2 phút)**: đủ lớn cho nhiều hành động farm có delay nhưng hữu hạn. Đây là safety ceiling, không phải interval.

Khi timeout:

1. Abort `fishingFarmAbortController`.
2. Yêu cầu `AutoFarm.stop()` và chờ cycle quiesce.
3. Nếu quiesce trong cleanup grace: ghi warning, quay lại Park và tiếp tục câu.
4. Nếu cleanup grace cũng hết hạn: tuyệt đối không chạy fishing trên cùng client trong khi farm cũ có thể còn continuation. Teardown connection/epoch hiện tại và đi qua cơ chế reconnect sẵn có với `desiredMode = 'auto_fishing'`. AutoFarm cũ chỉ còn tham chiếu client đã logout/detach và generation đã bị invalidated.

Các lỗi farm không được đổi user mode sang `off`. Chỉ lỗi login/permanent failure hiện có mới dùng policy hiện hành của session.

Nếu quay lại Park thất bại sau retry hiện có, giữ behavior fail/reconnect phù hợp với session, không khởi động một farm khác ngay lập tức. Timer chỉ được arm lại sau khi Auto Fishing thực sự trở lại Park để tránh vòng farm/retry liên tục.

### 5.8. Cleanup và race guards

Tạo một helper cleanup idempotent trong `AvatarSession`, ví dụ `cancelFishingFarmSchedule()`:

- clear `fishingFarmTimer` nếu có;
- reset `fishingFarmDue`;
- resolve và xóa wake resolver;
- abort rồi xóa `fishingFarmAbortController`;
- không tự gửi packet.

Helper này phải được gọi từ mọi đường kết thúc ownership:

- `stopActiveAutomation()` trước khi await runner shutdown;
- `stop()`/`stopAutomation()` thông qua stop path chung;
- `onDisconnected()` ngay khi epoch rớt;
- `teardown()`;
- `failPermanently()`.

Thứ tự stop:

1. Invalid generation/challenge generation để chặn send mới.
2. Clear scheduler/wake và abort child farm.
3. Abort fishing lifecycle.
4. Await `AutoFarm.stop()` quiesce ở các async transition path.
5. Chỉ gửi `cauCaXong()` nếu client/epoch còn current và online.

Callback timer và Promise completion phải capture generation/epoch/controller identity. Callback cũ không được reset state hoặc arm timer cho lifecycle mới.

## 6. Data flow

### 6.1. Bắt đầu Auto Fishing

```text
switchAutomationMode(auto_fishing)
  -> stopActiveAutomation()
  -> login/attendance
  -> activeMode = auto_fishing
  -> startFishingLoop(parent AbortController)
      -> validate lastAutoConfig
      -> runSingleCycle(initial, child AbortController, hard timeout)
      -> enter Park with retry
      -> startFishing + resource preflight
      -> arm 30-minute one-shot timer
      -> cast loop
```

### 6.2. Farm định kỳ

```text
timer fires
  -> farmDue = true
  -> wake safe rest only
  -> current cast/challenge continues
  -> catch result + TX44 settle
  -> invalidate late challenge generation
  -> log pause
  -> runSingleCycle(periodic, child AbortController, hard timeout)
  -> stop/quiesce AutoFarm
  -> log return
  -> enter Park with retry
  -> startFishing + resource preflight
  -> arm next 30-minute timer
```

## 7. Logging

Các mốc bắt buộc, dùng đúng prefix để UI hiện tại nhận qua log WebSocket mà không cần sửa frontend:

```text
[nông trại] Bắt đầu chu kỳ kèm Auto Fishing...
[câu cá] Tạm dừng để chạy chu kỳ nông trại định kỳ...
[câu cá] Đã xong farm, quay lại khu câu cá...
```

Bổ sung log warning cho skip config, validation error, farm timeout, retry chuyển Farm, cleanup timeout và reconnect recovery. Không log secret, raw packet hoặc dữ liệu cấu hình nhạy cảm.

## 8. Files/modules và trách nhiệm

| File | Vai trò hiện tại | Thay đổi dự kiến |
|---|---|---|
| `avatar-web/server/src/session/avatarSession.ts` | Sở hữu session lifecycle, automation modes, fishing loop, Park retry | Thêm coordinator state/timer/controllers; initial + periodic handoff; graceful checkpoints; timeout/recovery; cleanup ở stop/disconnect/teardown; log phase. |
| `avatar-web/server/src/autoFarm.ts` | Thực thi các hành động farm và phát `cycle-complete` | Thêm Promise one-cycle có AbortSignal; gom start logic dùng chung; enter-Farm retry/cooldown có giới hạn; bảo đảm listener/cycle quiescence. |

Không file nào khác được sửa trong production scope.

## 9. Edge cases

- Không có config đã lưu: skip initial/periodic farm, Auto Fishing vẫn chạy; timer kế tiếp vẫn được đặt để config mới có thể có hiệu lực sau đó.
- Config invalid: log warning, không crash, không đổi mode.
- Timer fire lúc đang vào Park/startFishing/mua đồ: đánh dấu due; handoff tại checkpoint trước cast đầu tiên hoặc sau thao tác hiện tại đã settle, không xen packet farm vào preflight.
- Timer fire lúc đang giải challenge: hoàn thành challenge/catch/TX44 trước.
- Timer fire nhiều lần: one-shot + boolean due nên coalesce thành đúng một cycle.
- User bấm stop đúng lúc timer fire: generation/signal check làm callback cũ inert; cleanup không arm lại timer.
- User đổi mode khi farm đang chạy: abort farm, await quiescence rồi mới start mode mới.
- Disconnect khi farm/câu đang chạy: hủy ngay timer/controllers/listeners; reconnect tạo lifecycle mới từ đầu và không tái sử dụng callback epoch cũ.
- Farm timeout nhưng stop quiesce được: tiếp tục câu sau warning.
- Farm timeout và không quiesce: teardown/reconnect, không dùng chung client với runner cũ.
- Park join bị dialog rate-limit: helper hiện có retry/backoff; không tạo timer farm mới trước khi Park đã phục hồi.
- `lastAutoConfig.logoutAfterCycle = true`: bị bỏ qua đối với farm kèm Auto Fishing; API one-cycle không dùng scheduler/logout của mode Auto Farm độc lập.

## 10. Verification plan

### 10.1. Trước khi sửa production code

- Chạy `gitnexus_impact({ target, direction: "upstream", repo: "learning-reverse" })` cho từng symbol sẽ sửa, tối thiểu:
  - `AvatarSession.startDesiredAutomation`
  - `AvatarSession.startFishingLoop`
  - `AvatarSession.runFishingLoop`
  - `AvatarSession.stopActiveAutomation`
  - `AvatarSession.onDisconnected`
  - `AvatarSession.teardown`
  - `AutoFarm.start`
  - `AutoFarm.stop`
  - `AutoFarm.runCycle`
- Báo user trước khi sửa nếu bất kỳ impact nào ở mức HIGH/CRITICAL.

### 10.2. Static/build verification

Không tạo test file mới và không test-first.

- `git diff --check`
- Chạy typecheck/build hiện có của server bằng script đã có trong repository; không sửa `package.json`.
- Chạy các test suite hiện có liên quan `avatarSession` và `autoFarm` sau production code để bắt regression; không thêm test nếu user chưa yêu cầu rõ.
- Chỉ mở rộng sang full existing server suite khi focused suite có thay đổi/failure cần xác minh hoặc plan đã quy định rõ.

Trước build/test lớn phải tuân thủ quản lý dung lượng của `AGENTS.md`: `df -h`, `du -sh` artifact task, không bắt đầu nếu dưới ngưỡng, dùng một scratch/cache thuộc task và cleanup allowlist trước khi kết thúc.

### 10.3. Behavioral verification không live

Qua log/instrumentation hiện có hoặc harness tạm thời không commit, xác minh:

- Initial farm diễn ra trước packet vào Park.
- Timer chỉ set due, không phát packet.
- Timer fire giữa cast không cắt TX43/TX44; farm chỉ bắt đầu sau safe checkpoint.
- Không có hai `runSingleCycle()` overlap.
- Sau farm, flow đi lại qua `enterParkContext` -> TX90 -> `joinParkWithRetry` -> `startFishing`.
- Stop/mode change/disconnect xóa timer, listener và abort cả fishing lẫn child farm.
- Callback của epoch/generation cũ không thể arm timer hoặc phát packet.

### 10.4. Live acceptance

Không tự đăng nhập tài khoản game hoặc chạy live probe nếu user chưa cấp quyền cụ thể cho account/map/area.

Khi được cấp quyền, dùng một tài khoản test và interval rút ngắn chỉ qua dependency/timer injection trong harness hoặc thay đổi tạm không commit; production constant vẫn là 1.800.000 ms. Xác minh:

1. Start Auto Fishing: log initial farm, nhận farm snapshot, hoàn thành đúng một cycle, sau đó vào map câu.
2. Farm định kỳ: timer đến hạn trong lúc đang có cá; cá hiện tại hoàn tất rồi mới chuyển Farm.
3. Sau farm: nhận lại world snapshot map 13/14, `startFishing` kiểm tra vé/cần/mồi và cast tiếp.
4. Stop/disconnect ở từng phase: không còn packet farm/fishing hoặc log phase mới từ lifecycle cũ.
5. Không xuất hiện dialog spam do chuyển map dồn dập.

## 11. Acceptance criteria mapping

| Tiêu chí | Cơ chế đáp ứng |
|---|---|
| Initial Auto Farm trước khi câu | Phase `initial-farm` chạy trước Park preflight; config rỗng/invalid được skip có log. |
| Mỗi 30 phút farm một lượt | One-shot scheduler 1.800.000 ms, re-arm sau khi quay lại Park, không overlap. |
| Đợi cá hiện tại hoàn tất | `farmDue` chỉ được xử lý tại checkpoint sau catch/challenge và TX44 settle. |
| Farm xong quay lại câu, kiểm tra tài nguyên | Tái sử dụng toàn bộ Park/startFishing/resource-preflight hiện có. |
| Log rõ từng phase | Ba log bắt buộc cùng warning/recovery logs. |
| Stop/disconnect sạch | Parent/child AbortController, clear timer/wake/listener, generation/epoch guards và await quiescence. |
| Không deadlock khi farm kẹt | Hard timeout 120s; cooperative stop; teardown/reconnect nếu cleanup không quiesce. |
| Chống spam packet chuyển map | Enter-Farm retry có cooldown/backoff và Park dùng `joinParkWithRetry()` hiện có. |

## 12. User Review Gate

Spec này là checkpoint Bước 1. Chưa tạo Implementation Plan và chưa sửa production code. Sau khi user duyệt Spec, bước tiếp theo mới là tạo:

`docs/superpowers/plans/2026-09-10-auto-fishing-periodic-farm.md`

theo chuẩn bite-sized tasks, rồi dừng ở Plan Review Gate trước khi implement.
