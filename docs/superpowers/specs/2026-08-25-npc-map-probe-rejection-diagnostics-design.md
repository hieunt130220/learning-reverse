# NPC Map Probe Sanitized Rejection Diagnostics Design

## Mục tiêu & Bối cảnh

Probe phase-aware hiện đã chứng minh luồng login và context, nhưng sau `TX cmd 80` chỉ nhận `RX -40 len=54` và không nhận snapshot `RX -34`. `GameClient` xử lý `-40` như dialog chung và chỉ phát thêm sự kiện `temporary-rejection` khi text khớp nhóm tài khoản đang đăng nhập, đăng nhập quá nhanh hoặc quá tải. Probe hiện cố ý không đọc body/text nên chưa phân biệt được server đang throttle hay trả một dialog khác.

Mục tiêu của thay đổi là bổ sung phân loại sự kiện đã chuẩn hóa, đủ để quyết định bước điều tra tiếp theo mà không in packet body, text dialog, credential hoặc token.

## Phạm vi

### In-scope

- Mở rộng CLI probe `avatar-web/server/src/tools/npc-map-probe.ts` để thu thập event metadata theo cùng ba phase `login`, `park-context`, `join`.
- Ghi nhận các event an toàn:
  - `dialog`: chỉ ghi event đã xảy ra, không đọc hoặc serialize payload text.
  - `temporary-rejection`: chỉ ghi `retryAfterMs`, không ghi `reason`.
  - `status`: chỉ ghi giá trị `ClientStatus`.
  - `closed`: chỉ ghi `SessionCloseKind` và `hadError`; không ghi host, port, error message hoặc byte counters.
- Đưa mảng event metadata redacted vào cả success JSON và failure JSON cùng với traffic metadata hiện có.
- Giữ nguyên CLI args, một account/session, một `enterParkContext()`, một `joinPark(map, area)`, timeout snapshot 5 giây và cleanup `finally`.

### Out-of-scope

- Không đọc, decode, hash, truncate, log hoặc serialize text của `dialog`/`temporary-rejection`.
- Không sửa `GameClient`, `ParkService`, `AutoFindNpc`, `AvatarSession`, API/WS/UI, decoder enter-world hoặc catalog.
- Không gửi `-23`, `-21`, opcode tương tác NPC, range map/khu, retry hoặc candidate sweep.
- Không chạy live probe mới trong thay đổi này nếu chưa có ủy quyền riêng cho đúng account/map/area sau khi code được verify.
- Không tạo evidence hoặc `npcMapCatalog.ts`; kết quả `RX -40` vẫn chỉ là protocol investigation.
- Không tạo test file vì user không yêu cầu test; chỉ typecheck và static safety verification.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules

- `avatar-web/server/src/tools/npc-map-probe.ts`: sở hữu phase state, listener registration/removal, redacted event metadata và JSON output.
- `avatar-web/server/src/game/client.ts`: chỉ sử dụng các event contract hiện có; không chỉnh sửa implementation.
- `avatar-web/server/src/proto/session.ts`: chỉ sử dụng type `SessionCloseKind`/event `closed`; không chỉnh sửa implementation.

### Data contracts

Giữ `ProbePhase` và `TxRxMetadata` hiện có. Thêm contract nội bộ của probe:

```ts
type ProbeEventKind = 'dialog' | 'temporary-rejection' | 'status' | 'closed';

interface ProbeEventMetadata {
  phase: ProbePhase;
  event: ProbeEventKind;
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseKind;
  hadError?: boolean;
}
```

Mỗi field được ghi chỉ khi thuộc event tương ứng. Không có field `reason`, text, body, hex, host, port, error, timestamp nội bộ hoặc số byte.

### Event flow

```text
listener attach (trước getAccountById/login)
  -> phase login
  -> phase park-context; enterParkContext(); sleep 2s
  -> phase join; arm snapshot wait; joinPark(map, area)
       -> traffic RX -40
       -> dialog event (payload bỏ qua)
       -> temporary-rejection event (chỉ retryAfterMs nếu có)
       -> status/closed event metadata nếu phát sinh
  -> success/failure JSON: traffic + events redacted
  -> remove all listeners
  -> logout + db.close()
```

Listener `dialog` nhận callback không tham số để không đọc payload. Listener `temporary-rejection` chỉ lấy số `retryAfterMs`. Listener `status` lấy enum status. Listener `client.session` trên `closed` chỉ lấy `kind` và `hadError`; phải tháo listener trước `logout()` để local cleanup không bị hiểu là server rejection.

### Phân loại kết quả

- Có `dialog` và `temporary-rejection`: đánh dấu live result có dấu hiệu throttle/concurrent-login; dùng `retryAfterMs` để người vận hành biết cooldown tối thiểu.
- Có `dialog` nhưng không có `temporary-rejection`: `-40` là dialog chung chưa được phân loại; không kết luận map/khu sai.
- Có `closed` với `remote-end`/`socket-error` trước timeout: ghi nhận server/socket đã đóng theo metadata an toàn.
- Không có event bổ sung: giữ kết luận hiện tại là timeout sau `join/TX 80`.

Không tự động retry hoặc đổi lệnh theo bất kỳ phân loại nào; mọi bước protocol tiếp theo phải quay lại Spec review.

## Verification Plan

1. Chạy GitNexus impact trước khi sửa các symbol `runProbe`, `captureRelevantTraffic`, `assertExpectedTraffic`; dừng nếu risk HIGH/CRITICAL.
2. Chạy `npm --prefix avatar-web/server run typecheck`.
3. Static scan probe không có `entry.hex`, `.getData()`, `body`, `reason`, `host`, `port`, `password`, `MASTER_KEY`, `cookie`, `token` trong output/event serialization; xác nhận không có opcode cấm.
4. Chạy `git diff --check` và `gitnexus_detect_changes(scope="all")`; chỉ chấp nhận probe + spec/plan liên quan.
5. Live run chỉ khi user cấp lại account/map/area và cho phép một invocation; kiểm tra output chỉ có các field contract trên. Không tạo catalog/evidence từ run này.

## Safety & Rollback

- Thay đổi chỉ nằm trong standalone diagnostic CLI; không ảnh hưởng runner production nếu CLI không được gọi.
- Nếu output có text/body hoặc listener đọc payload ngoài contract, dừng và revert riêng phần diagnostics trước khi chạy live.
- Không commit hoặc push nếu user chưa yêu cầu; giữ nguyên dirty files/untracked `avatar-jar/` hiện có.
