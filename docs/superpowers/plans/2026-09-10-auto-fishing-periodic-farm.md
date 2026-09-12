# Auto Fishing Periodic Farm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Chạy một chu kỳ Auto Farm ngay khi Auto Fishing bắt đầu và lặp lại sau mỗi 30 phút, chỉ handoff tại ranh giới câu cá an toàn rồi tự quay lại Park tiếp tục câu.

**Architecture:** `AvatarSession` là coordinator duy nhất, giữ nguyên `desiredMode/activeMode = auto_fishing`, sở hữu scheduler one-shot, parent/child AbortController và các phase nội bộ. `AutoFarm` cung cấp Promise chạy đúng một cycle có hủy/quiescence; fishing loop chỉ chuyển sang Farm sau khi cast/challenge và TX44 đã settle, sau đó chạy lại Park/resource preflight hiện có.

**Tech Stack:** TypeScript 5.7, Node.js EventEmitter/AbortController/timers, `GameClient`, `AutoFarm`, GitNexus CLI/MCP, Node test runner hiện có.

**Spec:** `docs/superpowers/specs/2026-09-10-auto-fishing-periodic-farm-design.md`

## Global Constraints

- Chỉ sửa production source `avatar-web/server/src/session/avatarSession.ts` và `avatar-web/server/src/autoFarm.ts`.
- Không sửa database migration, frontend UI, `.env`, Dockerfile hoặc `package.json`.
- Không tạo test file, không viết test trước production code và không dùng TDD.
- Dùng `lastAutoConfig` mới nhất; object rỗng hoặc config validation lỗi phải skip có warning, không làm dừng Auto Fishing.
- Interval production cố định `1_800_000` ms; hard timeout mỗi farm cycle là `120_000` ms.
- Không để Farm và Park/fishing phát packet đồng thời trên cùng live client.
- Timer callback chỉ đánh dấu farm đến hạn và wake safe rest; không trực tiếp gửi packet hoặc start AutoFarm.
- Park return phải tái sử dụng `joinParkWithRetry()` và preflight mua/kiểm tra rương, vé, cần, mồi hiện có.
- Stop, mode change, disconnect, teardown và permanent failure phải clear timer, tháo listener, abort child farm/fishing và chặn continuation cũ bằng generation/epoch/identity guard.
- Nếu farm timeout mà không quiesce trong cleanup grace, teardown client cũ và reconnect; không quay lại fishing trên client còn runner farm cũ.
- Trước khi sửa mỗi symbol, chạy `gitnexus_impact` upstream trên repo `learning-reverse`; nếu HIGH/CRITICAL thì báo user và dừng trước khi edit.
- Trước mọi commit, chạy `gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })` và kiểm tra chỉ có symbol/flow dự kiến.
- Không đăng nhập game hoặc chạy live probe khi chưa có quyền cụ thể cho account/map/area.
- Giữ nguyên các thay đổi không liên quan đang có trong `AGENTS.md` và `CLAUDE.md`; không stage chúng.
- Trước build/test hoặc artifact lớn, chạy `df -h` và `du -sh` trên artifact task; không tạo build mới nếu dung lượng dưới ngưỡng dự án. Chỉ dùng một scratch/cache do task sở hữu và cleanup bằng allowlist tuyệt đối.

---

### Task 1: Thêm AutoFarm one-cycle Promise và enter-Farm retry có giới hạn

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1-221`
- Modify: `avatar-web/server/src/autoFarm.ts:280-470`
- Modify: `avatar-web/server/src/autoFarm.ts:1340-1420`

**Interfaces:**
- Consumes: `AutoFarmConfig`, `AutoFarmState`, `AutoFarm.start()`, `AutoFarm.stop()`, `AutoFarm.runCycle()`, `AutoFarmClient` EventEmitter-compatible API.
- Produces: `AutoFarm.runSingleCycle(cfg: Partial<AutoFarmConfig>, options?: { signal?: AbortSignal }): Promise<AutoFarmState>`; private bounded `enterFarmWithRetry(generation: number): Promise<FarmState>` used by `runCycle()`.

- [x] **Step 1: Chạy impact analysis trước khi sửa `AutoFarm` và các method hiện có**

Run through GitNexus:

```text
gitnexus_impact({ target: "AutoFarm", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "start", direction: "upstream", repo: "learning-reverse", maxDepth: 3 })
gitnexus_impact({ target: "stop", direction: "upstream", repo: "learning-reverse", maxDepth: 3 })
gitnexus_impact({ target: "runCycle", direction: "upstream", repo: "learning-reverse", maxDepth: 3 })
```

Expected: xác định direct callers gồm `AvatarSession`, tool/harness hoặc existing tests; không sửa nếu có HIGH/CRITICAL chưa được báo user. Nếu tên `start`/`stop` ambiguous, chạy `gitnexus_context` lấy UID trong `avatar-web/server/src/autoFarm.ts`, rồi impact theo target/UID mà tool hỗ trợ.

- [x] **Step 2: Mở rộng contract EventEmitter của `AutoFarmClient` và khai báo option one-cycle**

Thêm `on()` vào `AutoFarmClient` vì enter-Farm retry cần listener dialog song song với listener farm:

```ts
on(eventName: string | symbol, listener: (...args: any[]) => void): this;
once(eventName: string | symbol, listener: (...args: any[]) => void): this;
removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
```

Khai báo contract gần `AutoFarmOptions`:

```ts
export interface AutoFarmSingleCycleOptions {
  signal?: AbortSignal;
}

const FARM_ENTRY_MAX_ATTEMPTS = 3;
const FARM_ENTRY_COOLDOWN_MS = 2_200;
const FARM_ENTRY_TIMEOUT_MS = 5_000;
```

Import `isInformationalDialog` từ `./game/client.js` để dialog nhiệm vụ/phần thưởng/đã ở khu vực không bị phân loại nhầm là rejection. Xác minh import không tạo circular runtime dependency; `game/client.ts` hiện không import `autoFarm.ts`.

- [x] **Step 3: Thêm `runSingleCycle()` với listener cleanup và cooperative abort**

Đặt method public sau `start()`:

```ts
async runSingleCycle(
  cfg: Partial<AutoFarmConfig>,
  options: AutoFarmSingleCycleOptions = {},
): Promise<AutoFarmState> {
  const { signal } = options;
  if (signal?.aborted) throw new AutoFarmStoppedError();

  return await new Promise<AutoFarmState>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      this.removeListener('cycle-complete', onComplete);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const onComplete = (state: AutoFarmState): void => {
      finish(() => resolve(state));
    };
    const onAbort = (): void => {
      void this.stop().then(
        () => finish(() => reject(new AutoFarmStoppedError())),
        (error: unknown) => finish(() => reject(error)),
      );
    };

    this.on('cycle-complete', onComplete);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      this.start(cfg);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
```

Giữ semantics `start()` hiện có. Không resolve trước `cycle-complete`, không để abort listener tồn tại sau settle và không gọi scheduler/logout của `AvatarSession`.

- [x] **Step 4: Thêm `enterFarmWithRetry()` và thay one-shot enter ở đầu `runCycle()`**

Helper phải arm cả `farm`, `dialog` và timeout trước khi gửi `enterFarm()`; cleanup tất cả listener/timer ở mọi nhánh:

```ts
private async enterFarmWithRetry(generation: number): Promise<FarmState> {
  let lastError = 'không nhận được dữ liệu farm';
  for (let attempt = 1; attempt <= FARM_ENTRY_MAX_ATTEMPTS; attempt += 1) {
    this.assertCurrent(generation);
    if (attempt > 1) {
      await this.wait(FARM_ENTRY_COOLDOWN_MS * (attempt - 1));
      this.assertCurrent(generation);
    }

    try {
      const farm = await new Promise<FarmState>((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        let settled = false;
        const cleanup = (): void => {
          if (timer) clearTimeout(timer);
          this.client.removeListener('farm', onFarm);
          this.client.removeListener('dialog', onDialog);
        };
        const settle = (action: () => void): void => {
          if (settled) return;
          settled = true;
          cleanup();
          action();
        };
        const onFarm = (): void => {
          const snapshot = this.client.farmState;
          if (!snapshot) return;
          settle(() => resolve(snapshot));
        };
        const onDialog = (reason: string): void => {
          if (isInformationalDialog(reason)) return;
          settle(() => reject(new Error(`server từ chối vào farm: ${reason}`)));
        };

        this.client.on('farm', onFarm);
        this.client.on('dialog', onDialog);
        timer = setTimeout(
          () => settle(() => reject(new Error('hết giờ chờ dữ liệu farm'))),
          FARM_ENTRY_TIMEOUT_MS,
        );
        this.client.enterFarm();
      });
      this.assertCurrent(generation);
      return farm;
    } catch (error) {
      this.assertCurrent(generation);
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < FARM_ENTRY_MAX_ATTEMPTS) {
        this.emit(
          'log',
          `[nông trại] vào farm bị chặn (${lastError}) — thử lại sau ${(FARM_ENTRY_COOLDOWN_MS * attempt / 1000).toFixed(1)}s…`,
        );
      }
    }
  }
  throw new Error(`${lastError} (đã thử ${FARM_ENTRY_MAX_ATTEMPTS} lần)`);
}
```

Trong `runCycle()`, thay Promise `fresh` + `this.client.enterFarm()` + đọc `this.client.farmState` bằng:

```ts
const farm = await this.enterFarmWithRetry(generation);
guard();
```

Không retry các farm action có side effect; retry chỉ áp dụng bước chuyển context/lấy snapshot đầu cycle.

- [x] **Step 5: Kiểm tra typecheck và focused existing tests sau production code**

Trước lệnh tạo artifact:

```bash
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/server/dist 2>/dev/null || true
```

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm run typecheck
node --import tsx --test src/autoFarm.test.ts
```

Expected: typecheck exit 0; existing AutoFarm tests pass. Không sửa/tạo test file nếu failure chỉ phản ánh contract fake client thiếu `on`; cập nhật production interface/usage sao cho EventEmitter-compatible fake hiện có tiếp tục compile.

- [x] **Step 6: Kiểm tra GitNexus scope trước commit**

Run through GitNexus:

```text
gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })
```

Expected: changed symbols chỉ thuộc `AutoFarm`/`AutoFarmClient` và docs đã duyệt; không có flow ngoài AutoFarm lifecycle ngoài blast radius đã báo.

- [x] **Step 7: Commit Task 1 khi execution đã được user cho phép commit**

```bash
git add avatar-web/server/src/autoFarm.ts
git commit -m "feat(fishing): add cancellable single farm cycle"
```

Không stage `AGENTS.md`, `CLAUDE.md`, Spec hoặc Plan trong commit source này.

---

### Task 2: Thêm coordinator state, scheduler và cleanup vào AvatarSession

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:70-190`
- Modify: `avatar-web/server/src/session/avatarSession.ts:242-305`
- Modify: `avatar-web/server/src/session/avatarSession.ts:1363-1388`
- Modify: `avatar-web/server/src/session/avatarSession.ts:1638-1753`

**Interfaces:**
- Consumes: `AutoFarm.runSingleCycle(...)` từ Task 1; `AvatarSession` timer injection (`setTimeoutFn`, `clearTimeoutFn`); generation/epoch/client guards hiện có.
- Produces: private `FishingFarmPhase`, `FishingFarmCycleOutcome`, `scheduleFishingFarm()`, `cancelFishingFarmSchedule()`, `waitForFishingRestOrFarmDue()`, `runFishingFarmCycle()` và `restartAfterStuckFishingFarm()`.

- [x] **Step 1: Chạy impact analysis trước khi sửa lifecycle symbols**

Run through GitNexus:

```text
gitnexus_impact({ target: "AvatarSession", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "stopActiveAutomation", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "onDisconnected", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "teardown", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "failPermanently", direction: "upstream", repo: "learning-reverse" })
```

Expected: lifecycle callers/processes được ghi nhận; dừng và báo user trước edit nếu HIGH/CRITICAL.

- [x] **Step 2: Khai báo constants, phase/outcome types và state fields**

Thêm gần các constant automation:

```ts
const FISHING_FARM_INTERVAL_MS = 1_800_000;
const FISHING_FARM_TIMEOUT_MS = 120_000;
const FISHING_FARM_CLEANUP_GRACE_MS = 10_000;

type FishingFarmPhase =
  | 'idle'
  | 'initial-farm'
  | 'moving-to-park'
  | 'fishing'
  | 'farm-due'
  | 'periodic-farm'
  | 'returning-to-park'
  | 'stopping';

type FishingFarmCycleOutcome = 'completed' | 'skipped' | 'cancelled' | 'reconnect';
```

Thêm fields cạnh `fishingAbortController`:

```ts
private fishingFarmPhase: FishingFarmPhase = 'idle';
private fishingFarmTimer?: NodeJS.Timeout;
private fishingFarmDue = false;
private fishingFarmAbortController?: AbortController;
private fishingFarmWake?: () => void;
```

- [x] **Step 3: Cài scheduler one-shot và cleanup idempotent**

Thêm helper private cạnh `startFishingLoop()`:

```ts
private scheduleFishingFarm(generation: number, epoch: number): void {
  if (this.fishingFarmTimer) this.clearTimeoutFn(this.fishingFarmTimer);
  this.fishingFarmDue = false;
  this.fishingFarmTimer = this.setTimeoutFn(() => {
    this.fishingFarmTimer = undefined;
    if (
      !this.isAutomationGenerationCurrent(generation)
      || epoch !== this.connectionEpoch
      || this.desiredMode !== 'auto_fishing'
      || this.fishingAbortController?.signal.aborted !== false
    ) return;
    this.fishingFarmDue = true;
    this.fishingFarmPhase = 'farm-due';
    const wake = this.fishingFarmWake;
    this.fishingFarmWake = undefined;
    wake?.();
  }, FISHING_FARM_INTERVAL_MS);
  this.fishingFarmTimer.unref?.();
}

private cancelFishingFarmSchedule(): void {
  if (this.fishingFarmTimer) this.clearTimeoutFn(this.fishingFarmTimer);
  this.fishingFarmTimer = undefined;
  this.fishingFarmDue = false;
  const wake = this.fishingFarmWake;
  this.fishingFarmWake = undefined;
  wake?.();
  this.fishingFarmAbortController?.abort();
  this.fishingFarmAbortController = undefined;
  this.fishingFarmPhase = 'idle';
}
```

Không arm timer trong callback; timer kế chỉ được arm sau khi Park preflight hoàn tất trở lại.

- [x] **Step 4: Thêm safe-rest wake primitive**

Implement helper chỉ dùng ở khoảng nghỉ giữa casts, không thay `delayCancellable()` dùng cho challenge/preflight:

```ts
private waitForFishingRestOrFarmDue(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || this.fishingFarmDue) { resolve(); return; }
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    const cleanup = (): void => {
      if (timer) this.clearTimeoutFn(timer);
      signal.removeEventListener('abort', onAbort);
      if (this.fishingFarmWake === onWake) this.fishingFarmWake = undefined;
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onAbort = (): void => finish();
    const onWake = (): void => finish();
    this.fishingFarmWake = onWake;
    signal.addEventListener('abort', onAbort, { once: true });
    timer = this.setTimeoutFn(finish, ms);
  });
}
```

Mỗi thời điểm chỉ có một safe rest waiter. Trước khi gán waiter mới, resolve waiter cũ nếu tồn tại để không leak resolver.

- [x] **Step 5: Cài `runFishingFarmCycle()` với config gate, timeout và child AbortController**

Method signature cố định:

```ts
private async runFishingFarmCycle(
  kind: 'initial' | 'periodic',
  client: GameClient,
  generation: number,
  epoch: number,
  parentSignal: AbortSignal,
): Promise<FishingFarmCycleOutcome>
```

Algorithm bắt buộc:

```ts
const config = { ...this.lastAutoConfig };
if (Object.keys(config).length === 0) {
  this.pushLog('[nông trại] Bỏ qua chu kỳ kèm Auto Fishing: chưa có cấu hình Auto Farm đã lưu.');
  return 'skipped';
}
if (parentSignal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') {
  return 'cancelled';
}

this.fishingFarmPhase = kind === 'initial' ? 'initial-farm' : 'periodic-farm';
if (kind === 'periodic') {
  this.pushLog('[câu cá] Tạm dừng để chạy chu kỳ nông trại định kỳ...');
}
this.pushLog('[nông trại] Bắt đầu chu kỳ kèm Auto Fishing...');
```

Sau đó:

1. Tạo child controller; parent abort phải abort child qua listener `{ once: true }`.
2. Lưu identity `this.fishingFarmAbortController = child`.
3. Gọi `auto.runSingleCycle({ ...config, startDelayMs: 0, logoutAfterCycle: false }, { signal: child.signal })` để initial farm thật sự bắt đầu ngay và không dùng logout policy của Auto Farm độc lập.
4. Arm hard timeout bằng `this.setTimeoutFn` trước khi await.
5. `Promise.race` cycle với timeout marker; attach rejection handler cho cycle promise ngay khi tạo để không sinh unhandled rejection nếu timeout thắng.
6. Khi cycle hoàn tất: `await auto.stop()` để activeCycle clear/quiesce, return `completed` dù state có `lastError`; log warning nếu `lastError` có giá trị.
7. Khi validation/start lỗi trước timeout: log `[nông trại] Bỏ qua chu kỳ kèm Auto Fishing: cấu hình không hợp lệ: <message>.`, `await auto.stop()`, return `skipped`.
8. Khi parent abort: return `cancelled` sau quiescence, không log timeout.
9. Khi hard timeout: abort child, race `auto.stop()` với cleanup grace 10 giây. Nếu stop thắng, log timeout và return `completed` để Park resume; nếu grace thắng, gọi recovery Step 6 và return `reconnect`.
10. Trong `finally`, clear hard-timeout handle, tháo parent abort listener và chỉ xóa controller nếu identity còn trùng child.

- [x] **Step 6: Cài recovery khi farm không quiesce**

Thêm:

```ts
private restartAfterStuckFishingFarm(reason: string): void {
  this.pushLog(`[nông trại] ${reason}; đóng phiên cũ để tránh race packet và kết nối lại...`);
  this.activeMode = 'off';
  this.teardown();
  this.emitAutomation();
  this.emit('status', 'idle');
  if (this.wanted && !this.permanentlyFailed && this.desiredMode === 'auto_fishing') {
    this.scheduleRetry(this.connectionEpoch);
  }
}
```

Không set `desiredMode = 'off'`. `teardown()` invalidates generation/epoch và detach old client trước khi reconnect.

- [x] **Step 7: Gắn cleanup vào mọi lifecycle exit**

Sửa theo thứ tự:

- `stopActiveAutomation()`: gọi `cancelFishingFarmSchedule()` trước `await this.auto?.stop()` và trước abort parent fishing controller.
- `failPermanently()`: gọi cleanup trước fire-and-forget `auto.stop()`.
- `onDisconnected()`: gọi cleanup và abort/xóa `fishingAbortController` ngay khi disconnect, trước reset `activeMode`; vẫn giữ `desiredMode` để retry resume.
- `teardown()`: gọi cleanup trước abort parent fishing controller; helper idempotent nên được phép gọi lại.
- `stop()` tiếp tục đi qua teardown nhưng gọi cleanup trực tiếp trước teardown để timer không còn cửa chạy trong phần teardown đồng bộ.

Ở `onDisconnected()` tăng `fishingChallengeGeneration` để inference cũ không gửi TX43 sau socket drop.

- [x] **Step 8: Chạy typecheck sau khi coordinator skeleton hoàn tất**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm run typecheck
```

Expected: exit 0; helper signatures khớp Task 1, không mở rộng DTO/frontend types.

- [x] **Step 9: Kiểm tra GitNexus scope trước commit**

Run through GitNexus:

```text
gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })
```

Expected: `AvatarSession` lifecycle plus Task 1 AutoFarm changes; không có frontend/database/config flow.

- [x] **Step 10: Commit Task 2 khi được phép**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(fishing): schedule periodic farm handoffs"
```

Không stage file ngoài scope.

---

### Task 3: Tích hợp initial/periodic handoff vào fishing loop và quay lại Park

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1491-1544`
- Modify: `avatar-web/server/src/session/avatarSession.ts:1755-1775`
- Modify: `avatar-web/server/src/session/avatarSession.ts:2279-2701`

**Interfaces:**
- Consumes: coordinator methods từ Task 2; `joinParkWithRetry()`, `executeParkPurchase()`, `executeSellFish()`, `delayCancellable()`, `fishingChallengeGeneration` và Park/startFishing flow hiện có.
- Produces: Auto Fishing lifecycle có initial farm, periodic safe checkpoint, reusable Park preflight và continuation sau farm.

- [x] **Step 1: Chạy impact analysis trước khi sửa fishing symbols**

Run through GitNexus:

```text
gitnexus_impact({ target: "startDesiredAutomation", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "startFishingLoop", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "runFishingLoop", direction: "upstream", repo: "learning-reverse" })
```

Expected: direct callers và affected processes được ghi nhận; HIGH/CRITICAL phải báo user trước edit.

- [x] **Step 2: Giữ mode semantics và khởi động lifecycle duy nhất**

Trong nhánh `auto_fishing` của `startDesiredAutomation()`:

- Giữ attendance và current checks hiện có.
- Set `activeMode = 'auto_fishing'` đúng một lần.
- Gọi `startFishingLoop(client, generation, epoch)`; không đổi `desiredMode` sang `auto_farm` ở bất kỳ phase nào.

Trong `startFishingLoop()`:

- Gọi `cancelFishingFarmSchedule()` trước khi thay parent controller cũ.
- Tạo một parent AbortController mới và capture identity.
- `finally` phải cleanup scheduler/child farm nếu controller identity còn current; không cleanup lifecycle mới thay thế nó.

- [x] **Step 3: Tách Park preflight thành helper có thể gọi lại**

Extract phần từ đầu `runFishingLoop()` đến sau `startFishing()` thành helper private:

```ts
private async prepareFishingAtPark(
  client: GameClient,
  generation: number,
  epoch: number,
  signal: AbortSignal,
): Promise<boolean>
```

Helper phải giữ nguyên thứ tự và behavior hiện có:

1. Set runtime `moving`, current map/area và log.
2. `enterParkContext()` + cancellable 800 ms.
3. Arm/chờ board-list RX90 tối đa 3 giây, tháo listener khi settle/abort.
4. `joinParkWithRetry(client, map, area, signal, epoch)`.
5. Chờ sync 3 giây.
6. Vòng `startFishing()` RX45; nếu rương đầy gọi `executeSellFish()`, nếu thiếu ticket/rod/bait gọi `executeParkPurchase()`, và retry theo guards hiện có.
7. Return `true` chỉ khi RX45 `iss=true`; return `false` khi cancelled/stale/terminal rejection.

Không nhân đôi hoặc rút gọn resource handling hiện có. Mọi timer/listener mới trong RX90/RX45 phải cleanup khi signal abort.

- [x] **Step 4: Đưa initial farm vào trước Park preflight**

Đầu `runFishingLoop()`:

```ts
const initialFarm = await this.runFishingFarmCycle(
  'initial', client, generation, epoch, signal,
);
if (initialFarm === 'cancelled' || initialFarm === 'reconnect') return;
if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;

this.fishingFarmPhase = 'moving-to-park';
if (!(await this.prepareFishingAtPark(client, generation, epoch, signal))) return;
this.fishingFarmPhase = 'fishing';
this.scheduleFishingFarm(generation, epoch);
```

Config rỗng/invalid đi qua outcome `skipped` và vẫn vào Park.

- [x] **Step 5: Thêm safe checkpoint trước cast mới và sau TX44 settle**

Tại đầu mỗi cast iteration, trước log `đang quăng cần` và `client.quanCau()`, kiểm tra `fishingFarmDue`. Sau `donePromise`/no-bite reset/dialog reset cũng kiểm tra lại.

Gom handoff vào helper local/private có shape:

```ts
private async serviceDueFishingFarm(
  client: GameClient,
  generation: number,
  epoch: number,
  signal: AbortSignal,
): Promise<'continue-fishing' | 'stop'>
```

Algorithm:

```text
if !fishingFarmDue -> continue-fishing
invalidate fishingChallengeGeneration
ensure cauCaXong has been sent for any open fishing session
await the existing bounded fishing-done settlement when applicable
clear fishingFarmDue
await runFishingFarmCycle('periodic', ...)
if cancelled/reconnect -> stop
log "[câu cá] Đã xong farm, quay lại khu câu cá..."
set phase returning-to-park
await prepareFishingAtPark(...)
if false -> stop
set phase fishing
scheduleFishingFarm(generation, epoch)
return continue-fishing
```

Không gọi `cauCaXong()` hai lần cho success path: truyền vào helper thông tin session đã được finalize hoặc đặt checkpoint sau đúng block `donePromise`. Với no-bite/dialog path, gửi TX44/reset hiện có trước checkpoint.

- [x] **Step 6: Thay safe rest bằng wake-aware rest**

Chỉ thay hai khoảng nghỉ an toàn giữa cast:

- micro-break sau số catches;
- `config.castDelayMs + restJitter`.

Dùng `waitForFishingRestOrFarmDue()` thay `delayCancellable()` ở hai vị trí đó. Giữ `delayCancellable()` cho perception, Park cooldown, buy/sell và post-catch delay vì timer không được cắt ngang các thao tác đó.

Ngay sau wake-aware rest, kiểm tra parent signal và gọi safe checkpoint trước cast mới.

- [x] **Step 7: Bảo toàn finally và trạng thái runtime**

`runFishingLoop()` `finally` phải:

- Chỉ gửi best-effort `cauCaXong()` nếu client/epoch còn current và online.
- Không ghi log “đã dừng” trong periodic handoff; log stop thuộc `stopActiveAutomation()`.
- Set `fishingFarmPhase = 'idle'` chỉ khi lifecycle/controller identity vẫn current hoặc parent đã kết thúc.
- Không đổi `rejected` thành `idle` như behavior hiện tại.
- Không arm timer khi Park preflight hoặc return-to-Park thất bại.

- [x] **Step 8: Chạy typecheck, focused existing tests và diff check**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm run typecheck
node --import tsx --test src/session/avatarSession.test.ts src/autoFarm.test.ts
cd /Users/devios/learning-reverse
git diff --check -- avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/autoFarm.ts
```

Expected: typecheck exit 0; focused existing tests pass; diff-check không có whitespace error. Không tạo/chỉnh test file trong task này.

- [x] **Step 9: Audit thủ công các interleaving bắt buộc**

Đọc diff và chứng minh từng case bằng control flow/generation checks:

```text
start -> initial farm -> Park -> cast
timer during cast -> catch/challenge/TX44 settle -> farm -> Park -> cast
timer during safe rest -> wake -> farm
stop during farm -> child abort -> AutoFarm quiesce -> no Park return
mode change during farm -> old generation inert -> new mode starts after stopActiveAutomation
disconnect during cast/farm -> timer/controller/listener cleanup -> desired mode preserved for reconnect
farm timeout -> cooperative stop; stuck cleanup -> old client teardown before reconnect
empty/invalid lastAutoConfig -> warning -> fishing continues
```

Expected: không có đường nào cho farm và Park packet send overlap; timer cũ không re-arm lifecycle mới.

- [x] **Step 10: Kiểm tra GitNexus scope trước commit**

Run through GitNexus:

```text
gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })
```

Expected: chỉ AutoFarm + AvatarSession symbols/flows và docs liên quan; mọi d=1 caller từ impact đã được giữ tương thích.

- [x] **Step 11: Commit Task 3 khi được phép**

```bash
git add avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/autoFarm.ts
git commit -m "feat(fishing): run periodic farm between catches"
```

Nếu hai file không còn thay đổi chưa commit sau Tasks 1-2, không tạo empty commit.

---

### Task 4: Verification tổng, cleanup artifact và bàn giao

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-auto-fishing-periodic-farm.md` (chỉ tick checkbox theo bằng chứng thực tế)
- Verify only: `avatar-web/server/src/session/avatarSession.ts`
- Verify only: `avatar-web/server/src/autoFarm.ts`

**Interfaces:**
- Consumes: toàn bộ implementation Tasks 1-3.
- Produces: bằng chứng typecheck/build/test hiện có, GitNexus change scope, cleanup report và danh sách live acceptance còn mở.

- [x] **Step 1: Kiểm tra dung lượng và xác định artifact ownership trước build**

Run:

```bash
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/server/dist 2>/dev/null || true
```

Expected: đủ dung lượng theo `AGENTS.md`. Ghi lại size `dist` trước build; không xóa nếu ownership không thuộc task.

- [x] **Step 2: Chạy server typecheck và build một lần trên source cuối**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm run typecheck
npm run build
```

Expected: cả hai exit 0. Không chạy lại cùng matrix nếu source không đổi.

- [x] **Step 3: Chạy existing focused tests rồi quyết định có cần full suite**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
node --import tsx --test src/session/avatarSession.test.ts src/autoFarm.test.ts
```

Expected: toàn bộ focused tests hiện có pass. Chỉ chạy `npm test` nếu focused failure, source thay đổi để xử lý failure, hoặc reviewer yêu cầu full regression; nếu chạy, báo riêng count/result full suite.

- [x] **Step 4: Chạy static scope verification cuối**

Run:

```bash
cd /Users/devios/learning-reverse
git diff --check
git status --short
git diff -- avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/autoFarm.ts
```

Run through GitNexus:

```text
gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })
```

Expected: chỉ hai production files và hai Superpowers docs của feature; `AGENTS.md`/`CLAUDE.md` vẫn là thay đổi unrelated, không stage/modify thêm.

- [x] **Step 5: Self-check acceptance không live**

Xác nhận từ source/diff và log strings:

```text
[nông trại] Bắt đầu chu kỳ kèm Auto Fishing...
[câu cá] Tạm dừng để chạy chu kỳ nông trại định kỳ...
[câu cá] Đã xong farm, quay lại khu câu cá...
```

Xác nhận constant interval `1_800_000`, timeout `120_000`, config-empty guard, child abort cleanup, Park re-entry và no-overlap invariants. Ghi rõ live 30-minute acceptance vẫn chưa chạy nếu chưa có quyền account/map/area.

- [x] **Step 6: Cleanup artifact do task sở hữu**

Nếu task tạo mới `avatar-web/server/dist` và đã xác minh đây không phải artifact dùng chung/có trước task, dọn bằng allowlist đường dẫn tuyệt đối. Nếu `dist` đã tồn tại trước task hoặc ownership không rõ, giữ nguyên và báo rõ; không xóa bằng glob.

Sau cleanup:

```bash
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/server/dist 2>/dev/null || true
```

Expected: báo dung lượng trước/sau, chính xác artifact nào đã dọn hoặc giữ lại.

- [x] **Step 7: Commit docs khi user cho phép đưa Spec/Plan vào lịch sử**

Trước commit, chạy lại:

```text
gitnexus_detect_changes({ scope: "all", repo: "learning-reverse" })
```

Sau đó chỉ stage docs liên quan:

```bash
git add docs/superpowers/specs/2026-09-10-auto-fishing-periodic-farm-design.md \
  docs/superpowers/plans/2026-09-10-auto-fishing-periodic-farm.md
git commit -m "docs(fishing): document periodic farm scheduler"
```

- [x] **Step 8: Bàn giao kết quả và ranh giới acceptance**

Báo riêng:

- source files/commits đã tạo;
- GitNexus impact/detect-changes risk và affected flows;
- focused tests, optional full suite, typecheck/build từng mục với result/count thật;
- live acceptance đã chạy hay chưa, account/map/area nào được cấp quyền;
- cleanup đã thực hiện, dung lượng giải phóng và artifact còn giữ;
- không tuyên bố hoàn tất live 30-minute behavior nếu chỉ có build/test/static evidence.

## Plan Review Gate

Chưa thực thi production code. User phải duyệt Plan này trước khi bắt đầu Task 1. Khi được duyệt, chọn một trong hai cách thực thi:

1. `superpowers:subagent-driven-development` — mỗi task do worker riêng thực hiện và review giữa các task.
2. `superpowers:executing-plans` — thực thi inline theo từng task với checkpoint.
