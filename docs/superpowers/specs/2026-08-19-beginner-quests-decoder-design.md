# Giải mã nhiệm vụ Tân Thủ và Nhà Nông từ game

## Mục tiêu và bối cảnh

Web hiện chỉ giải mã **Nhiệm Vụ Hằng Ngày** từ `Cmd -87 / sub 4`. Hai ảnh đối chiếu cho thấy **Nhiệm Vụ Tân Thủ** và **Nhiệm Vụ Nhà Nông** là hai chuỗi tiến trình khác: mỗi bước có nhiều điều kiện bằng văn bản, tiến độ riêng và phần thưởng riêng.

Kết luận cũ cho rằng không có packet riêng là sai. Phân tích IL2CPP mới xác định màn hình này đi qua `FarmService.getInfoUpgradeFarm(...)`, dùng `Cmd 104 (OPEN_INFO_FARM)`; nhánh phản hồi `action = 3` chứa danh sách điều kiện kiểu `MissionInfo`.

Mục tiêu là thu thập packet thật, xác nhận cách phân biệt hai chuỗi, rồi bổ sung decoder và API/UI để web hiển thị đầy đủ danh sách Tân Thủ và Nhà Nông mà không trộn với nhiệm vụ hằng ngày.

## Phạm vi

### Trong phạm vi

- Gửi yêu cầu `Cmd 104` bằng đúng framing/protocol hiện có của game client.
- Thu thập và lưu tạm raw request/response để xác nhận các biến thể `type`, `idType` và `screenType`.
- Giải mã tên điều kiện, tiến độ hiện tại/tổng và phần thưởng của từng bước.
- Xác nhận mapping Tân Thủ/Nhà Nông bằng payload thật và màn hình trên cùng tài khoản.
- Lưu state riêng cho `beginner`, `farmer` và `daily`.
- Cung cấp snapshot/API và UI ba nhóm tách biệt.

### Ngoài phạm vi

- Tự động làm hoặc nhận thưởng nhiệm vụ.
- Hardcode danh sách từ ảnh chụp hoặc đoán các bước chưa quan sát được.
- Thay đổi decoder/hành vi của nhiệm vụ hằng ngày.
- Tạo test file; chỉ thêm test nếu người dùng yêu cầu trực tiếp.
- Commit thay đổi khi chưa được người dùng yêu cầu.

## Bằng chứng reverse engineering

### Luồng yêu cầu

`FarmService.getInfoUpgradeFarm(type, idType = -1)` tạo message:

```text
i8   cmd = 104
i8   type
i8   idType       // chỉ có khi idType != -1
```

Các request phải được gửi tuần tự để response luôn gắn được với request đang chờ; không suy luận loại nhiệm vụ chỉ từ thứ tự response.

### Luồng phản hồi danh sách nhiệm vụ

`GlobalMessageHandler.openInfoUpgradeFarm(Message)` đọc byte `action`. Với `action = 3`, schema tĩnh quan sát được là:

```text
i8   action = 3
i8   screenType
i16  currentImageId
i16  nextImageId
i16  rewardCount
repeat rewardCount:
  i8   rewardType
  ...  trường có điều kiện theo rewardType của UpgradeInfo
  i32  amount
  i32  value
i16  missionCount
repeat missionCount:
  utf  name
  i32  current
  i32  total
```

`MissionInfo` trong IL2CPP có `name`, `numMiss`, `totalMiss`, `isDone`. Đây là cấu trúc phù hợp với các dòng như “Thu hoạch 200 cà chua - 0/200” và “Mua 5 con gà - 0/5”; Daily Quest hiện tại chỉ mang `idItem + numRequired`, nên không thể biểu diễn trực tiếp dữ liệu này.

Schema phần thưởng có nhánh theo `rewardType`; decoder production chỉ được triển khai sau khi raw packet thật chứng minh đầy đủ số byte của từng loại gặp được. Mỗi lần decode phải kiểm tra `remainingBytes === 0`; nếu còn dư hoặc thiếu byte, giữ raw payload và báo trạng thái `unsupported`, không trả dữ liệu đoán.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### 1. Capture và xác nhận mapping

- Bổ sung probe có giới hạn vào game client để thử các request hợp lệ của `Cmd 104` theo tuần tự.
- Ghi raw request/response vào `/private/tmp`, không ghi token, mật khẩu hoặc thông tin đăng nhập.
- Đối chiếu payload với màn hình game trên cùng tài khoản.
- Chỉ gán `screenType/type/idType` thành `beginner` hoặc `farmer` khi ít nhất một payload thật của mỗi loại khớp đồng thời tên bước, điều kiện và phần thưởng. Mapping chưa xác nhận phải được báo là `unknown`.

### 2. Data contracts

```ts
type ProgressQuestKind = 'beginner' | 'farmer'

type ProgressQuestCondition = {
  name: string
  current: number
  total: number
  isDone: boolean
}

type ProgressQuestReward = {
  type: number
  amount: number
  value: number
  extra?: number
  displayName?: string
}

type ProgressQuestChain = {
  kind: ProgressQuestKind
  screenType: number
  title: string
  step: number | null
  conditions: ProgressQuestCondition[]
  rewards: ProgressQuestReward[]
  source: 'game-packet'
  updatedAt: number
}
```

`step` chỉ được tách từ tiêu đề khi định dạng thực tế có hậu tố số; nếu không, giữ `null` và bảo toàn nguyên văn `title`.

### 3. Decoder và session state

- Tạo decoder riêng cho `Cmd 104`; không gắn logic này vào handler Daily Quest.
- Handler định tuyến theo `action`; chỉ `action = 3` cập nhật quest-chain state.
- State của account chứa ba miền độc lập: daily, beginner và farmer.
- Payload lỗi, mapping chưa biết hoặc reward type chưa hỗ trợ không được ghi đè snapshot hợp lệ gần nhất.

### 4. API và UI

- Snapshot/API trả riêng `beginnerQuests` và `farmerQuests`; không dùng danh sách hardcode hiện có làm fallback.
- UI hiển thị ba khu vực: Hằng Ngày, Tân Thủ, Nhà Nông.
- Mỗi chuỗi hiển thị tiêu đề/bước hiện tại, từng điều kiện `current/total`, trạng thái hoàn thành và phần thưởng đã decode.
- Khi chưa capture được dữ liệu, UI nói rõ “chưa nhận dữ liệu từ game”, không hiển thị dữ liệu mẫu như dữ liệu thật.

## Files/modules dự kiến

- `avatar-web/server/src/game/protocol.ts`: hằng số command và cấu trúc đọc/ghi liên quan.
- `avatar-web/server/src/game/client.ts`: request tuần tự, handler `Cmd 104`, state và capture có kiểm soát.
- `avatar-web/server/src/game/farmData.ts` hoặc module decoder mới: chuyển packet đã xác thực thành data contract; loại bỏ vai trò fallback của danh sách hardcode.
- `avatar-web/server/src/index.ts`: expose snapshot/API mới nếu cần.
- `avatar-web/web/src/**`: render hai nhóm nhiệm vụ tiến trình riêng với daily.

Tên file/module cuối cùng sẽ được chốt trong Implementation Plan sau khi rà soát symbol và blast radius bằng GitNexus.

## Edge cases và an toàn

- Response đến trễ hoặc khác request đang chờ: giữ `unknown`, không gán nhầm chuỗi.
- `missionCount`/`rewardCount` âm, vượt giới hạn hợp lý hoặc payload bị cắt: từ chối toàn bộ packet.
- UTF lỗi, số âm bất hợp lệ hoặc `current > total`: giữ raw packet để chẩn đoán và không cập nhật state.
- Reward trùng trong UI phải được bảo toàn cho đến khi raw payload chứng minh đó là lỗi hiển thị hay hai phần thưởng thực sự.
- Không log credential; capture chỉ chứa cmd, tham số request và payload body.
- Daily Quest phải tiếp tục hoạt động độc lập nếu `Cmd 104` không được server hỗ trợ.

## Verification Plan

1. Capture tối thiểu một response thật cho Tân Thủ và một response thật cho Nhà Nông trên cùng phiên bản game.
2. Lưu bằng chứng request tuple `(type, idType)` ↔ `screenType` ↔ nội dung màn hình cho từng loại.
3. Decode packet và xác nhận đọc hết payload (`remainingBytes === 0`).
4. So sánh tên bước, từng điều kiện, tiến độ và phần thưởng với màn hình game trên cùng tài khoản.
5. Kiểm tra snapshot/API trả hai chuỗi riêng và không dùng hardcode fallback.
6. Chạy typecheck/build server và web; kiểm tra thủ công UI ba nhóm.
7. Xác nhận luồng Daily Quest hiện tại không đổi.
8. Chạy `git diff --check` và `gitnexus_detect_changes()` trước khi đề xuất commit.

## Tiêu chí hoàn thành

- Có raw evidence và mapping đã xác nhận cho cả Tân Thủ lẫn Nhà Nông.
- Danh sách hiển thị trên web đến từ packet game thật, gồm điều kiện, tiến độ và phần thưởng.
- Hai loại mới tách biệt nhau và tách biệt với nhiệm vụ hằng ngày.
- Không còn fallback hardcode giả làm dữ liệu runtime.
- Không tự động thực hiện/nhận thưởng và không làm lộ dữ liệu đăng nhập.
