# NPC Map Probe Diagnostics — Design Specification

## 1. Mục tiêu & Bối cảnh

Điều chỉnh probe `npc-map-probe.ts` để phân biệt rõ ba phase live (`login`, `park-context`, `join`) và cung cấp metadata traffic redacted khi probe không nhận được snapshot `cmd -34` sau `cmd 80`.

Hai lần probe gần nhất đã cho kết quả: login vượt `waitUntilOnline`, gửi đúng `TX -1` và `TX 80`, nhưng cả `Map 5 – Khu 7` lẫn `Map 2 – Khu 6` đều không nhận `RX -34` mới trong 5 giây. Probe hiện chỉ gắn listener traffic sau login và chỉ giữ các command liên quan, nên failure không cho biết server im lặng hay trả command khác.

Spec này chỉ mở rộng khả năng quan sát của CLI probe. Nó không xác minh mapping mới, không tạo catalog, không đổi runner Find NPC và không tự chuyển sang `-23`.

## 2. Phạm vi

### In-scope

- Sửa `avatar-web/server/src/tools/npc-map-probe.ts` để gắn traffic listener trước login.
- Gắn phase cho từng metadata entry:
  - `login`: từ lúc listener được gắn đến khi `waitUntilOnline` thành công;
  - `park-context`: từ sau login đến khi hoàn tất `enterParkContext()` và delay 2 giây;
  - `join`: từ lúc arm snapshot wait đến khi `joinPark(map, area)` hoàn tất hoặc timeout.
- Lưu và in chỉ `{ phase, dir, cmd, len }`; không lưu/in body, hex, game user, password, `MASTER_KEY`, cookie hay token.
- Giữ một session, một lần `enterParkContext`, một lần `joinPark`, local health preflight, timeout 5 giây và cleanup `finally`.
- Kiểm tra traffic theo phase:
  - `login`: đúng một `RX -34` để chứng minh client đã online;
  - `park-context`: đúng một `TX -1` với body length 1;
  - `join`: đúng một `TX 80` với body length 2 và đúng một `RX -34` mới để đủ điều kiện evidence.
- Failure vẫn in metadata redacted của tất cả phase để phân biệt im lặng, login/park error command hoặc response ngoài dự kiến.

### Out-of-scope

- Không thêm `--map-range`, `--area-range`, retry tự động, candidate generator hoặc nhiều session.
- Không gửi `SELECTED_MINI_MAP (-23)`, `REQUEST_JOIN_ANY (-21)`, NPC interaction, combat, reward hoặc command chưa được duyệt.
- Không sửa `GameClient`, `AutoFindNpc`, `SessionManager`, API/WS/UI hoặc catalog production.
- Không tạo evidence document/catalog khi join phase thiếu `RX -34` hoặc decoder không đạt strict contract.
- Không thêm test file mới trong task này; user chưa yêu cầu viết test. Verification dùng typecheck, static scan và một probe live được ủy quyền.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Data contract

```ts
type ProbePhase = 'login' | 'park-context' | 'join';

interface TxRxMetadata {
  phase: ProbePhase;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}
```

`captureProbeTraffic(metadata, phase, entry)` sẽ append metadata cho mọi command trong ba phase. Hàm không đọc `entry.hex`; vì vậy command nhạy cảm vẫn chỉ xuất hiện dưới dạng direction, opcode và length.

### 3.2. Flow

```text
loadConfig
  -> assertAvatarWebStopped
  -> openDb + GameClient
  -> phase = login; attach traffic listener
  -> loginWithTimeout + waitUntilOnline
  -> phase = park-context; enterParkContext; sleep(2000)
  -> phase = join; arm waitForDecodedSnapshot; joinPark(map, area)
  -> await new RX -34 + strict decode
  -> assert phase counts
  -> print redacted evidence
  -> abort + remove listeners + logout + close DB
```

`waitForDecodedSnapshot` vẫn chỉ chấp nhận snapshot mới phát sau khi listener được arm; không dùng lại snapshot login để giả làm snapshot join. Như vậy output tách được `RX -34` login khỏi `RX -34` sau `cmd 80` và không biến snapshot cũ thành bằng chứng map/khu.

### 3.3. Error handling & safety

- Nếu login không online, failure output gồm traffic login đã thu được nhưng không tiết lộ body.
- Nếu join timeout, failure output gồm toàn bộ metadata login/context/join và section `snapshot`, offset `-1`, message redacted hiện tại.
- Nếu phase count sai, failure section `traffic` nêu phase/opcode/count không khớp; không retry.
- `finally` luôn abort snapshot wait, gỡ listener, logout client và đóng SQLite.
- Probe chỉ chạy khi Avatar Web local không trả response; health check vẫn bind `127.0.0.1`.

### 3.4. Files & trách nhiệm

- `avatar-web/server/src/tools/npc-map-probe.ts`: thêm `ProbePhase`, phase state, capture metadata mọi command và phase-aware assertion/output.
- `docs/superpowers/plans/2026-08-25-npc-map-probe-diagnostics.md`: plan triển khai, verification và live gate.
- Không tạo/sửa catalog hoặc evidence production trong change này.

## 4. Verification Plan

1. Chạy `npm --prefix avatar-web/server run typecheck`.
2. Static scan source probe để xác nhận không in `entry.hex`, body buffer, password, `MASTER_KEY` hoặc credential fields; chỉ gọi `enterParkContext`, `joinPark`, `waitForWorldSnapshot`, `login/logout`.
3. Chạy `git diff --check` và `gitnexus_detect_changes(scope="all")`; expected chỉ ảnh hưởng tool probe và docs plan/spec.
4. Với Avatar Web đã dừng và một account/map/area được user ủy quyền, chạy đúng một invocation probe. Thành công chỉ khi output có:
   - `login/RX/-34` đúng một;
   - `park-context/TX/-1` đúng một;
   - `join/TX/80` đúng một;
   - `join/RX/-34` đúng một;
   - strict decoder `ok`, `playerId > 0`, `trailingBytes = 0` hoặc giá trị ổn định đã review.
5. Nếu vẫn timeout hoặc phase count sai, dừng ở `protocol investigation pending`; không tạo evidence/catalog và không thử cặp khác trong cùng task.

## 5. Delivery gate

Spec này không cho phép claim map/area đã verified. Chỉ output phase-aware redacted metadata sau implementation; catalog/evidence vẫn cần một probe thành công và một review gate riêng theo `2026-08-24-auto-find-npc-design.md`.
