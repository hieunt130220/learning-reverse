# Thu hoạch và trồng lại theo xác nhận từng ô Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bỏ JOIN sau mỗi cây trên luồng thành công bằng xác nhận thu hoạch, làm đất và trồng đúng ô.

**Architecture:** GameClient giải mã ACK cây và phát sự kiện riêng cho snapshot JOIN. AutoFarm chờ trước khi gửi, xử lý tuần tự từng ô và chỉ chuyển bước sau ACK hoặc snapshot chứng minh trạng thái. Giữ đồng bộ cuối vòng; fallback đọc lại farm và kho khi kết quả không rõ.

**Tech Stack:** TypeScript, Node.js EventEmitter, Buffer, tsx, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-15-harvest-replant-ack-design.md` — user duyệt ngày 2026-09-15.

## Global Constraints

- Không TDD, không tạo test file. Chỉ chạy test sẵn có sau sửa production code; không sửa test files nếu chưa được yêu cầu.
- Giữ wire TX, kế hoạch cây, auto-buy, ngân sách, stepDelayMs, vật nuôi/bếp và API UI hiện có.
- Không dùng timeout hoặc ACK chỉ khớp command làm xác nhận cây thành công.
- Cmd 64 không có farm/request ID; không khẳng định correlation tuyệt đối và không retry cùng ô sau timeout trong lượt đó.
- Không ghi trạng thái care/vitality suy đoán vào farmState công khai. Dùng trạng thái thao tác cục bộ; UI lấy snapshot thật cuối vòng.
- Giữ unrelated dirty work: AGENTS.md, CLAUDE.md và spec/plan auto-buy hiện có. Kiểm tra lại git status trước mỗi commit.
- Chạy impact trước mỗi symbol thay đổi và báo blast radius; HIGH/CRITICAL phải báo trước khi sửa. Chạy detect_changes trước commit.
- Thực thi trực tiếp bằng executing-plans; không cần subagent. Chỉ commit allowlist của task sau kiểm tra, không push.
- Trước build/test: df -h và du -sh thư mục artifact task. Nếu cần probe tạo đúng một scratch bằng mktemp -d, ghi lại đường dẫn tuyệt đối; dọn sau khi không còn process dùng. Không build dist nếu typecheck đủ.
- Chưa chọn tài khoản/ô cho live; không tự chạy tool mặc định account 1. Báo riêng source verification và live acceptance.

### Task 1: Decode ACK cây và tách snapshot JOIN

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts` (thêm types/decoder cạnh FarmCell)
- Modify: `avatar-web/server/src/game/client.ts:1593-1604`, `:1670-1698`

**Interfaces:**
- Consumes: Buffer payload từ Message.getData(); layout trong farm.md và chữ ký dump.cs:280692,280698.
- Produces: HarvestReply, PlantReply, decodeHarvestReply, decodePlantReply; sự kiện `farm-harvest-reply`, `farm-plant-reply`, `farm-snapshot`.

- [x] **Step 1: Kiểm tra impact handler và đọc semantics packet.**

Query/context handler GameClient và decodeFarmData; impact symbol thực tế chứa switch. Đối chiếu index unsigned, seed signed (-1), big endian và idUser trong dump. Nếu payload thực tế khác layout, không chấp nhận packet đó; giữ fallback và ghi bằng chứng.

- [x] **Step 2: Thêm decoder có kiểm tra độ dài chính xác.**

```ts
export interface HarvestReply { cellIndex: number; quantity: number }
export interface PlantReply { idUser: number; cellIndex: number; seedId: number }
export function decodeHarvestReply(body: Buffer): HarvestReply | null {
  if (body.length !== 3) return null;
  return { cellIndex: body.readUInt8(0), quantity: body.readInt16BE(1) };
}
export function decodePlantReply(body: Buffer): PlantReply | null {
  if (body.length !== 6) return null;
  return { idUser: body.readInt32BE(0), cellIndex: body.readUInt8(4), seedId: body.readInt8(5) };
}
```

Payload chưa biết hoặc số lượng âm không hoàn tất thu hoạch; ghi log chẩn đoán, không dựng state. Số lượng 0 không tự suy ra thất bại khi protocol chưa chứng minh điều đó.

- [x] **Step 3: Tách case 64/66 và phát event sau decode.**

```ts
const reply = decodeHarvestReply(msg.getData());
if (reply && reply.quantity >= 0) this.emit('farm-harvest-reply', reply);
```

Cmd 66 dùng decodePlantReply rồi emit `farm-plant-reply`. Giữ log hex hiện có. Giữ case 53/54 nguyên hành vi. Trong case 69/61, sau decode thành công và cập nhật state, chỉ Cmd 69 với idFarm hợp lệ phát `farm-snapshot` mang snapshot; giữ `farm` cho consumer cũ. Không phát `farm-snapshot` từ Cmd 101 hoặc ACK.

- [x] **Step 4: Verify và commit.**

Run trong `avatar-web/server`: `npm run typecheck` và `node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts` sau xác nhận các file tồn tại. Expected: typecheck sạch, báo đúng số pass/fail. Probe decoder sau code bằng payload 2b00c0 → index 43, quantity 192; payload ngắn/dài → null; Cmd 66 seed ff → -1. Probe nằm trong scratch, không tạo test file repository.

Run GitNexus detect_changes staged; stage đúng farmData.ts và client.ts. Commit: `git commit -m "feat: decode farm tree acknowledgements"`.

### Task 2: Waiter có cleanup và phân biệt snapshot

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:468` (waitForReply)
- Modify: `avatar-web/server/src/autoFarm.ts:403`, `:482-552` và thêm private helper cạnh các waiter

**Interfaces:**
- Consumes: các event Task 1, AutoFarm.isCurrent(generation), client.status và status event.
- Produces:

```ts
type FarmWaitResult<T> =
  | { status: 'confirmed'; value: T }
  | { status: 'timeout' }
  | { status: 'cancelled' };
// private members trên AutoFarm:
// pendingFarmWaitCancels: Set<() => void>
// waitFarmEvent<T>(event: string, matches: (value: T) => boolean,
//   send: () => void, generation: number, timeoutMs: number): Promise<FarmWaitResult<T>>
// refreshFarmSnapshot(idFarm: number, generation: number): Promise<FarmWaitResult<FarmState>>
```

- [x] **Step 1: Impact stop, waitForReply, refreshInventory, enterFarmWithRetry.**

Báo callers và ảnh hưởng runSingleCycle/fishing handoff. Không đổi signature waitForReply public.

- [x] **Step 2: Sửa cleanup waiter chung.**

Trong waitForReply, gom settle(bool) có cờ settled, clearTimeout và removeListener('message', onReply) ở cả thành công/timeout; vẫn trả boolean và giữ semantics caller khác. Không đổi protocol vật nuôi.

- [x] **Step 3: Viết waitFarmEvent và nối stop.**

Helper đăng ký event + status listener, timer và callback cancel vào Set trước send. Handler chỉ resolve confirmed khi isCurrent(generation), client online và matches(value). Status rời online hoặc stop trả cancelled. Mọi settle gỡ event/status listener, timer và callback Set. Send throw cleanup rồi reject. stop gọi các cancel đang có trước chờ activeCycle; không để callback cũ hủy waiter generation mới.

```ts
const cleanup = () => {
  clearTimeout(timer);
  this.client.removeListener(event, onValue);
  this.client.removeListener('status', onStatus);
  this.pendingFarmWaitCancels.delete(cancel);
};
```

Các biến callback/timer phải khởi tạo đầy đủ trước gọi send, để fake client trả đồng bộ cũng an toàn. Không dùng polling interval để phát hiện stop.

- [x] **Step 4: Nối snapshot và kho.**

refreshFarmSnapshot gọi helper với event farm-snapshot, predicate snapshot.idFarm === idFarm, send enterFarm, timeout 5000. enterFarmWithRetry nghe farm-snapshot thay farm; giữ 3 lần thử, backoff 2200/4400 và dialog filtering; thêm cancellation cleanup, không retry khi cancelled. refreshInventory nhận generation, dùng waiter inventory với getInventory và timeout 5000; cập nhật toàn bộ call sites. Timeout kho phải báo lỗi, không trả như đã refresh thành công.

- [x] **Step 5: Verify và commit.**

Typecheck; chạy test client hiện có. Probe sau code trong scratch: ACK đồng bộ, sai predicate rồi đúng predicate, timeout, send throw, stop, status offline. Expected: listenerCount về baseline, không timer/waiter còn treo; Cmd 101 không resolve JOIN. Nếu fake test cũ chỉ emit farm, báo fixture không đáp ứng contract; không thêm nhánh fallback sang farm để làm test xanh.

detect_changes staged và commit allowlist client.ts/autoFarm.ts: `git commit -m "fix: clean up farm acknowledgement waits"`.

### Task 3: Chuyển vòng cây sang xác nhận từng bước

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:980-1110`, `:1461-1474`

**Interfaces:**
- Consumes: HarvestReply, PlantReply, FarmWaitResult, waitFarmEvent, refreshFarmSnapshot từ Task 1/2.
- Produces: cùng AutoFarm API/state public; luồng cây không JOIN giữa các ô khi ACK thành công.

- [x] **Step 1: Impact runCycle và đọc lại diff trước sửa.**

Giữ các thay đổi auto-buy ngoài task; lưu danh sách index/previousTreeId từ đầu vòng để không mất fallback giống cũ khi refresh thay object.

- [x] **Step 2: Thu hoạch với predicate đúng ô.**

```ts
const reply = await this.waitFarmEvent<HarvestReply>(
  'farm-harvest-reply',
  value => value.cellIndex === c.index && this.client.farmState?.idFarm === idFarm,
  () => this.client.farm.harvest(idFarm, c.index),
  generation, this.commandTimeoutMs,
);
```

Tăng sent khi thực sự send. Sau confirmed, giữ trạng thái cục bộ đã thu và bỏ care cũ. Sau cancelled ném AutoFarmStoppedError. Sau timeout dùng fallback Task 3 Step 4. Gỡ block JOIN sau từng harvest. Không dùng confirm(64) cho cây nữa.

- [x] **Step 3: Làm đất và trồng theo ACK riêng.**

Predicate Cmd 66: idUser === idFarm, cellIndex đúng ô, seedId đúng -1 hoặc hạt chọn. Chờ đăng ký trước send. Chỉ gửi trồng khi làm đất confirmed hoặc snapshot chứng minh idTree === -1. Seed plan/skip/knownSeeds/stock giữ như cũ. Trừ seedInventory sau confirmed; không retry trồng nếu timeout. Tick giữ sau từng lệnh và từng ô. Không mutate public farmState với time/vitality đoán.

- [x] **Step 4: Fallback theo từng bước.**

| Timeout ở bước | Sau snapshot mới đúng farm | Hành động |
|---|---|---|
| Thu | Ô tồn tại, time=-1 và còn gốc | Cho phép làm đất |
| Thu | Ô trống | Bỏ làm đất, có thể trồng theo plan |
| Thu | Cây vẫn còn hoặc ô thiếu | Bỏ ô, không phá cây |
| Làm đất | idTree=-1 | Cho phép trồng |
| Làm đất | Chưa trống/ô thiếu | Bỏ ô |
| Trồng | Bất kỳ trạng thái | Refresh kho, dựng lại seedInventory; ghi đối chiếu, không gửi lại |

Snapshot fallback timeout/cancel/wrong ownership: ngừng phát lệnh của vòng bằng lỗi rõ ràng, không đi tiếp bằng snapshot đầu vòng. Đây là cách bảo thủ để thực hiện yêu cầu kết thúc giai đoạn cây khi không còn state tin cậy. Nếu kho fallback timeout cũng dừng vòng. Đọc lại c từ snapshot mới bằng find(index), không tiếp tục dùng c cũ cho quyết định fallback. Không chăm sóc ô đã gửi harvest hoặc vừa gửi plant bằng cờ care cũ.

- [x] **Step 5: Đồng bộ cuối vòng đúng event.**

Thay waiter once('farm') cuối vòng bằng refreshFarmSnapshot(idFarm, generation). Timeout phải lưu lastError qua catch thay vì xóa và báo thành công. Không thêm JOIN cuối giai đoạn cây thứ hai; sử dụng cuối vòng đang có.

- [x] **Step 6: Verify và commit.**

Run `npm run typecheck`; `node --import tsx --test src/autoFarm.test.ts src/game/client.test.ts src/game/farmData.test.ts`. Báo mọi regression/fixture mismatch, không bỏ qua failure để tuyên bố pass. Probe hậu kiểm không tạo repo test file: 2 ô ACK thành công không JOIN ở giữa; sai index/seed không chuyển bước; timeout thu còn cây không clear; timeout plant không retry; stop không phát lệnh tiếp.

detect_changes staged; commit autoFarm.ts: `git commit -m "fix: replant crops after matching acknowledgements"`.

### Task 4: Chốt bằng chứng, tài liệu và cleanup

**Files:**
- Modify: `avatar-re/notes/farm.md`
- Modify: spec và plan của task để ghi trạng thái thực thi

**Interfaces:**
- Consumes: output kiểm tra Task 1–3, packet live chỉ khi có phiên/ô xác định.
- Produces: ghi chú phân biệt metadata/packet cũ/probe cục bộ/live hiện tại; báo cáo kết quả và giới hạn còn lại.

- [x] **Step 1: Ghi nguồn chứng minh layout.**

Ghi Cmd 64 index+quantity, Cmd 66 idUser+index+signed seed, source dump.cs/RVA; phân biệt -1 làm đất với seed thường. Không gọi metadata là live capture. Chỉ ghi số JOIN giảm đã quan sát trong probe; không tự ghi thời gian tiết kiệm.

- [x] **Step 2: Kiểm tra acceptance và phạm vi.**

Kiểm tra diff, checkbox plan, GitNexus detect_changes scope all. Nếu user cung cấp phiên/ô live thì đối chiếu 64 → 66(-1) → 66(seed), kho và snapshot cuối; nếu chưa có báo live chưa chạy. Không đăng nhập tài khoản mặc định bằng tool probe cũ. Không chạy lại test trên source không đổi chỉ để có kết quả final.

- [x] **Step 3: Commit tài liệu và index.**

Stage đúng farm.md và hai tài liệu task. detect_changes staged rồi `git commit -m "docs: record tree acknowledgement flow and verification"`. Sau commit đọc .gitnexus/meta.json; analyze giữ --embeddings khi count > 0. Kiểm tra dung lượng trước index, không khởi tạo cache mới không cần thiết.

- [x] **Step 4: Cleanup và bàn giao.**

Dọn đúng scratch tuyệt đối do task tạo khi process đã thoát; giữ bằng chứng failure cần thiết trong thư mục output bền vững và báo dung lượng. Chạy df -h, du -sh artifact giữ lại, git status --short. Báo commit, files, test counts, live boundary, dung lượng giải phóng thực tế; không tuyên bố cleanup nếu chưa làm.

## Trạng thái

User duyệt Plan; production đã triển khai trên branch `codex/harvest-replant-ack`.

### Kết quả thực thi 2026-09-15

- `8abfc9d1`: decoder, event ACK/snapshot và cleanup waitForReply.
- `8ac9754a`: waiter AutoFarm, cancellation, fallback và luồng cây. Task 2/3 gộp một commit AutoFarm để không giữ trạng thái trung gian đang dùng hai contract event; cleanup GameClient nằm cùng commit decoder.
- Typecheck exit 0. Test GameClient/farmData: 32 pass, 0 fail.
- Bộ 3 file hiện có chạy với `--test-timeout=1500`: 75 tests, 34 pass, 0 fail, 41 cancelled. Fixture AutoFarm chỉ emit farm và command thô, không phát farm-snapshot/typed ACK. Không sửa test file và không thêm compatibility fallback vào production chỉ để làm fixture qua. Bộ regression này chưa xanh; cần cập nhật fixture khi user cho phép sửa tests.
- Probe hậu kiểm: hai ô thành công có đúng JOIN đầu/cuối, không JOIN giữa ô; timeout thu không clear khi cây còn; timeout clear không trồng; timeout trồng không retry; AbortSignal dừng tại harvest; listener/timer cleanup, ACK đồng bộ, sai predicate, timeout, send throw, offline đều qua.
- GameClient probe dispatch packet 64/66 đúng; chỉ 69 phát snapshot, 61 không phát; 20 lần waitForReply thành công và một timeout đều trả listener count về baseline.
- GitNexus impact có ambiguous symbol lookup (runCycle/onMessage); đã đối chiếu class/file source, không coi kết quả chọn nhầm tên là bằng chứng symbol đúng. requestStop CRITICAL, GameClient HIGH đã được lưu ý. detect_changes staged chỉ chứa files trong scope; một số symbol bị graph gán theo vị trí dòng cũ.
- Không sửa UI, wire TX, test files, AGENTS.md hoặc CLAUDE.md. Nhánh tạo từ checkout đang có, giữ nguyên dirty docs của user.
- Chưa chạy live: chưa có tài khoản/ô/phiên được xác định. Không xác nhận protocol live hay đo tốc độ thật.
- Bằng chứng giữ tại `/Users/devios/.codex/visualizations/2026/09/15/01a0a426-aa22-7b32-a64c-92623ee2ce93/harvest-replant-evidence`: probe nguồn/kết quả, log test có cancelled, log 32 pass và typecheck.
- Các checkbox verify nghĩa là đã thực hiện và báo kết quả, không có nghĩa mọi test hoặc live acceptance đều pass. Live là giới hạn còn lại; không đánh dấu đã chạy live.

