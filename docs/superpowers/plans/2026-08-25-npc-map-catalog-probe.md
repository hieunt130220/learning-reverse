# NPC Map Catalog Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng probe read-only để lấy và giải mã catalog map của client AvatarHD bằng `REQUEST_CITY_MAP (-24)` trước khi kết luận mapping `map 5 / area 7`.

**Architecture:** Giữ toàn bộ thay đổi trong standalone `npc-map-probe.ts`. Probe sẽ login, chuyển context park, gửi đúng một `-24 [0]`, giải mã response vào một cấu trúc bounded/redacted và không gửi lệnh join/chọn khu khi catalog chưa được xác minh.

**Tech Stack:** TypeScript, Node.js `EventEmitter`, `Buffer`, `GameClient`/`Session` hiện có, npm server typecheck, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-25-npc-map-catalog-probe-design.md`

## Global Constraints

- Chỉ chỉnh `avatar-web/server/src/tools/npc-map-probe.ts`; không sửa `GameClient`, `ParkService`, `AutoFindNpc`, `AvatarSession`, API/WS/UI hoặc production catalog.
- Live invocation chỉ một lần với `--account-id 2 --map 5 --area 7`, sau khi user duyệt Plan và preflight xác nhận Avatar Web đã dừng.
- Request mới duy nhất là `cmd -24` body `[0]`; không gửi `cmd 80`, `-23`, `-21`, command NPC, retry, reconnect hoặc candidate sweep.
- Decode theo schema native bounded: `i8`, `i32 length + bytes`, `i32 length + i8 + bytes`, `i8 count`, repeat `i8 id`, `i16 idImg`, `u16+UTF-8 text`, `i8 x`, `i8 y`.
- Không serialize password, token, host/port, dialog text, packet body, raw bytes, hex hoặc `TrafficEntry.hex`.
- Không tạo test file vì user chưa yêu cầu test; không commit/push khi user chưa yêu cầu.

---

### Task 1: Bounded city-map catalog decoder

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (thêm type, cursor và decoder nội bộ sau các helper parse hiện có)

**Interfaces:**
- Consumes: `Buffer` body của `Session` message `command === -24`.
- Produces: `CityMapCatalog` dùng bởi flow probe và JSON output.

```ts
interface CityMapCatalogEntry {
  id: number;
  idImg: number;
  text: string;
  x: number;
  y: number;
}

interface CityMapCatalog {
  count: number;
  entries: CityMapCatalogEntry[];
  trailingBytes: number;
}
```

- [ ] **Step 1: Chạy impact trước khi sửa symbol hiện có**

Run GitNexus impact cho `runProbe`, `captureRelevantTraffic` và
`assertExpectedTraffic` nếu decoder được đặt cạnh hoặc dùng lại các symbol đó.
Nếu bất kỳ kết quả nào là HIGH/CRITICAL, dừng và báo blast radius trước khi
sửa; không tự mở rộng phạm vi.

- [ ] **Step 2: Thêm cursor bounds-checking và decoder**

Tạo helper nội bộ `decodeCityMapCatalog(body: Buffer): CityMapCatalog` với
cursor `offset` và các hàm `readI8`, `readI16`, `readI32`, `readU16`,
`readBytes`, `readUtf8`. Mỗi hàm phải kiểm tra đủ byte trước khi đọc; lỗi phải
ném `RedactedProbeError('catalog', message, offset)`.

Giải mã đúng thứ tự evidence native:

```text
readI8()                       // prefix marker, chỉ skip
readI32() -> n1; readBytes(n1)
readI32() -> n2
readI8()                       // prefix marker, chỉ skip
readBytes(n2)
readI8() -> count
repeat count:
  id = readI8()
  idImg = readI16()
  textLength = readU16(); text = readUtf8(textLength)
  x = readI8() * 16
  y = readI8() * 16
```

Áp dụng các giới hạn cố định: `n1` và `n2` trong `0..1_048_576`, `count` trong
`0..127`, `textLength` trong `0..4096`. Reject số âm/overflow, UTF-8 malformed,
entry thiếu field và trailing bytes âm; trả `trailingBytes = body.length - offset`
chỉ sau khi toàn bộ entry hợp lệ. Không trả partial catalog.

- [ ] **Step 3: Verify decoder source-level safety**

Run:

```bash
npm --prefix avatar-web/server run typecheck
git diff --check
```

Expected: typecheck exit `0`; `git diff --check` không in lỗi. Không tạo test
file hoặc dùng packet body thật làm fixture trong repository.

### Task 2: Catalog phase and one-shot request flow

**Files:**
- Modify: `avatar-web/server/src/tools/npc-map-probe.ts` (`ProbePhase`, traffic assertion, `runProbe`, output)

**Interfaces:**
- Consumes: `decodeCityMapCatalog`, `GameClient.sendRaw`, `client.session` message event, existing redacted event metadata.
- Produces: one `catalog` phase, one `TX -24 len=1`, optional parsed `CityMapCatalog`, and redacted success/failure JSON.

- [ ] **Step 1: Add catalog phase and strict traffic contract**

Mở rộng `ProbePhase` thành `'login' | 'park-context' | 'catalog'`. Giữ phase
`login`/`park-context` như hiện tại. Thay assertion join hiện có bằng contract:

```text
count(login, RX, -34) === 1
count(park-context, TX, -1, 1) === 1
count(catalog, TX, -24, 1) === 1
```

Không yêu cầu `cmd 80` hoặc `RX -34` ở catalog probe; catalog được xác minh
bởi `RX -24` và decoder hoàn chỉnh.

- [ ] **Step 2: Arm one-shot `-24` message waiter**

Thêm helper `waitForCityMapCatalog(client, signal, timeoutMs): Promise<CityMapCatalog>`
hoặc closure tương đương. Listener chỉ nhận `msg.command === -24`, gọi
`decodeCityMapCatalog(msg.getData())`, resolve một lần; decoder error reject qua
`RedactedProbeError`. Listener phải được tháo trên resolve, reject, timeout,
abort và trong `finally`; các command khác bị bỏ qua.

- [ ] **Step 3: Gửi đúng request chính thức sau context**

Sau `waitUntilOnline`, giữ `phase = 'park-context'`, gọi `client.enterParkContext()`
và sleep 2 giây như probe hiện tại. Chuyển `phase = 'catalog'`, arm waiter trước
khi gửi, rồi gửi đúng một lần:

```ts
client.sendRaw(-24, [{ t: 'i8', v: '0' }]);
```

Chờ catalog tối đa 5 giây. Không gọi `client.joinPark`, không retry và không
đổi `args.map`/`args.area`; hai giá trị chỉ nằm trong `requested` output để đối
chiếu thủ công.

- [ ] **Step 4: Xuất catalog redacted và cleanup**

Mở rộng `printRedactedEvidence` để ghi `catalog` gồm `count`, `entries` và
`trailingBytes`, cùng `requested`, traffic và events hiện có. Failure JSON chỉ
ghi metadata/error section; không ghi body/hex. Đảm bảo session message listener
được tháo trước `logout()` để cleanup local không tạo event giả.

### Task 3: Static verification and live evidence gate

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-npc-map-catalog-probe.md` (checklist evidence sau khi chạy)
- Do not modify: production catalog/evidence files until response mapping is proven

**Interfaces:**
- Consumes: probe implementation from Tasks 1–2 and current account database.
- Produces: one redacted live result for account 2 / map 5 / area 7, classified as `catalog observed` or `catalog pending`.

- [ ] **Step 1: Run static and GitNexus scope checks**

Run:

```bash
npm --prefix avatar-web/server run typecheck
git diff --check
npx gitnexus_detect_changes --scope all
```

Expected: typecheck and diff checks pass; GitNexus scope contains only the
probe plus this spec/plan, with no unexpected production symbols. If the
available GitNexus integration requires MCP instead of CLI, run the equivalent
`gitnexus_detect_changes({ scope: "all" })` call and record its risk.

- [ ] **Step 2: Static forbidden-output/opcode scan**

Run a targeted `rg` scan over `npc-map-probe.ts` and confirm the new output path
does not reference `entry.hex`, `.getData()` for serialization, `body`,
`password`, `token`, `host`, `port`, or dialog reason. Confirm the new live flow
contains `-24` only for the single catalog request and contains no new `80`,
`-23`, `-21`, sweep loop, retry or reconnect.

- [ ] **Step 3: Preflight and one exact live invocation**

Before running, verify `127.0.0.1:8787` is refused and no prior probe process is
running. Then run exactly:

```bash
node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
  --account-id 2 --map 5 --area 7
```

Do not retry if it times out or the session is rejected. The run is successful
for this plan only if the redacted output contains `TX -24 len=1`, an `RX -24`
traffic entry and a complete catalog decode with no trailing bytes. Otherwise
record the failure as `catalog pending`; do not create a production mapping.

- [ ] **Step 4: Classify evidence without inferring mapping**

If catalog entries are decoded, record the JSON output and static schema in the
existing plan notes without raw packet data. A matching numeric `id` is only a
`catalog candidate`; it is not proof that `map 5 / area 7` is a `cmd 80` pair or
`-23` pair. Create a new Spec/Plan before any follow-up selection/join command.

#### Live attempt 2026-08-25T02:24:34.232Z UTC

- Preflight: `127.0.0.1:8787` refused; no prior probe process.
- Invocation: one exact account `2`, requested `map=5`, `area=7`; runner exited
  after the catalog timeout.
- Positive traffic: login `RX -34 len=178`, park context `TX -1 len=1` and
  `RX -1 len=1`, catalog `TX -24 len=1`.
- Negative result: no RX packet after `TX -24` within 5 seconds; no catalog
  decode; mapping remains unverified. Do not create a production catalog.

## Rollback

Do not commit. If verification fails, preserve unrelated dirty/untracked files
and revert only the probe changes from this plan after inspecting `git diff`.
