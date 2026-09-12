# Status Tab Automation Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tập trung việc chọn, bắt đầu và dừng Auto Farm/Auto Fishing tại `StatusPanel`, khóa lựa chọn trong lúc automation hoạt động, và giữ `FishingPanel` đồng bộ dưới dạng màn hình trạng thái.

**Architecture:** `StatusPanel` sở hữu mode lựa chọn cục bộ và gửi mọi mutation qua API automation thống nhất. `LoadedOperations` tiếp tục sở hữu `AutomationSnapshot` dùng chung và nhận snapshot trả về từ `StatusPanel`; `FishingPanel` chỉ đọc snapshot đó và dùng chung formatter trạng thái câu cá.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, REST helpers `apiGet`/`apiPost`/`apiPut`, runtime snapshot qua WebSocket.

**Spec:** `docs/superpowers/specs/2026-09-10-status-tab-automation-controls-design.md`

## Global Constraints

- Chỉ sửa production code trong ba file: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`, `avatar-web/web/src/accounts/panels/FishingPanel.tsx`, `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`.
- Không sửa backend, routing, database, game client, vòng lặp farm/câu cá hoặc ML mini-game.
- Không tạo hoặc chỉnh sửa file test; không dùng TDD. Chỉ chạy build và kiểm tra thủ công có mục tiêu.
- UI copy phải dùng chính xác **Auto Farm**, **Auto Fishing**, **Bắt đầu**, **Dừng Auto**.
- `autoActive` là true khi `desiredMode !== 'off'`, `activeMode !== 'off'`, hoặc `transitionState === 'switching'`.
- Khi `autoActive` hoặc mutation đang gửi, cả hai checkbox phải disabled. Không có đường UI nào chuyển mode trực tiếp khi automation đang active.
- Nút **Bắt đầu** disabled khi `autoActive` hoặc mutation đang gửi. Nút **Dừng Auto** enabled đúng khi `autoActive && !mutationBusy`, kể cả lúc `switching`.
- Start luôn gọi `POST /api/accounts/:id/automation/start` với `{ mode: 'auto_farm' | 'auto_fishing' }`; stop luôn gọi `POST /api/accounts/:id/automation/stop` với `{}`.
- Không thay đổi checkbox cấu hình `logoutAfterCycle`.
- Trước khi sửa mỗi symbol, chạy GitNexus impact upstream. Nếu kết quả HIGH/CRITICAL, dừng và báo user trước khi sửa.
- Trước mỗi lượt build, chạy `df -h /Users/devios/learning-reverse` và `du -sh /Users/devios/learning-reverse/avatar-web/web/dist 2>/dev/null || true`; không build nếu còn dưới 15 GiB.
- Giữ nguyên các file bẩn không liên quan: `README.md`, spec/plan `fishing-event-reward-dialog-handling`, và mọi thay đổi user phát sinh trong lúc thực thi.
- Không commit khi chưa có ủy quyền commit rõ ràng. Nếu được ủy quyền, chỉ stage allowlist đã duyệt và phải chạy `gitnexus_detect_changes({ scope: 'staged' })` trước commit.

---

### Task 1: Chuyển `FishingPanel` thành màn hình trạng thái chỉ đọc

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:1-189`

**Interfaces:**
- Consumes: `automation?: AutomationSnapshot`, `automation.fishingRuntime?: FishingRuntimeState`, `account?.runtime?.status`.
- Produces: `export function formatFishingStatus(isFishing: boolean, status?: FishingRuntimeState['status'], accountStatus?: string): string` để `StatusPanel` dùng cùng mapping; `FishingPanel` không còn gửi start/stop mutation.

- [x] **Step 1: Chạy impact analysis trước khi sửa**

Run qua GitNexus MCP:

```text
gitnexus_impact({ target: "FishingPanel", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "formatFishingStatus", direction: "upstream", repo: "learning-reverse" })
```

Expected: ghi lại risk, direct callers và affected processes. Nếu HIGH/CRITICAL thì dừng trước khi edit.

- [x] **Step 2: Export formatter và để formatter nhận trạng thái desired-or-active**

Trong `FishingPanel.tsx`, đổi formatter thành export và đặt tên tham số theo ý nghĩa mới:

```ts
export function formatFishingStatus(
  isFishing: boolean,
  status?: FishingRuntimeState['status'],
  accountStatus?: string,
): string {
  if (!isFishing && (!status || status === 'idle')) {
    return 'Đang tắt';
  }

  switch (status) {
    case 'moving':
      return 'Đang di chuyển vào hồ câu';
    case 'buying':
      return 'Đang đi mua vật phẩm câu cá tại Khu sinh thái (Map 13)…';
    case 'selling':
      return 'Rương đầy, đang tự động bán cá (banca)…';
    case 'starting':
      return 'Đang gửi yêu cầu câu (TX45)…';
    case 'casting':
      return 'Đang quăng cần, chờ cá cắn…';
    case 'hooked':
      return 'Cá cắn câu! ML đang giải mini-game…';
    case 'caught':
      return 'Đã bắt được cá!';
    case 'rejected':
      return 'Server từ chối câu';
    case 'resting':
      return 'Đang nghỉ giữa vòng quăng cần';
    case 'idle':
    default:
      if (isFishing) {
        return accountStatus === 'online'
          ? 'Đang chuẩn bị vào hồ…'
          : 'Đang chờ kết nối game…';
      }
      return 'Đang tắt';
  }
}
```

- [x] **Step 3: Bỏ mutation control khỏi `FishingPanel`**

Thực hiện chính xác các thay đổi sau:

- Đổi import API từ `import { apiPost, ApiError }` thành `import { apiPost }` vì refresh quest vẫn cần `apiPost`.
- Giữ `onAutomationChange?` trong `FishingPanelProps` tạm thời để call site hiện tại vẫn type-check; bỏ nó khỏi destructuring của component. Task 3 sẽ xóa prop chuyển tiếp này khỏi interface và Drawer.
- Xóa `const [loading, setLoading] = useState(false)`.
- Xóa toàn bộ `handleToggle`.
- Giữ `isFishing = isFishingDesired || isFishingActive` và gọi formatter bằng `isFishing`:

```tsx
<strong>
  {formatFishingStatus(isFishing, fishingState?.status, account?.runtime?.status)}
</strong>
```

- Xóa button **Bắt đầu câu cá / Dừng câu cá** khỏi header. Header chỉ còn tiêu đề, trạng thái và suffix `Đang chuyển chế độ…` khi `isSwitching`.
- Giữ nguyên `error`, `refreshingQuest`, `handleRefreshQuest`, runtime error, quest UI và phần nội dung còn lại.

- [x] **Step 4: Kiểm tra TypeScript/build sau thay đổi độc lập**

Run:

```bash
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/web/dist 2>/dev/null || true
cd /Users/devios/learning-reverse/avatar-web/web && npm run build
```

Expected: dung lượng trống từ 15 GiB trở lên; `tsc -b` và Vite build thành công; không còn reference tới `loading`, `handleToggle` hoặc `ApiError` trong `FishingPanel.tsx`.

- [x] **Step 5: Commit gate**

Nếu chưa được user ủy quyền commit: không stage/commit, chỉ ghi nhận Task 1 hoàn tất trong plan.

Nếu đã được ủy quyền commit, stage đúng file Task 1, kiểm tra staged diff và chạy GitNexus trước commit:

```bash
git add avatar-web/web/src/accounts/panels/FishingPanel.tsx
git diff --cached --name-only
git diff --cached --check
```

Run `gitnexus_detect_changes({ scope: 'staged', repo: 'learning-reverse' })`, rồi mới commit:

```bash
git commit -m "refactor(avatar-web): centralize fishing automation controls"
```

---

### Task 2: Xây bộ điều khiển mode và strict lock trong `StatusPanel`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:1-194`

**Interfaces:**
- Consumes: `AutomationSnapshot`, `automation.fishingRuntime`, `formatFishingStatus(...)`, `automationMutationBusy`.
- Produces: optional callback `onAutomationChange?(snapshot: AutomationSnapshot): void`; controlled `selectedMode: 'auto_farm' | 'auto_fishing'`; start/stop response synchronization.

- [x] **Step 1: Chạy impact analysis cho mọi symbol sẽ sửa**

Run qua GitNexus MCP:

```text
gitnexus_impact({ target: "StatusPanel", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "startAuto", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "stopAuto", direction: "upstream", repo: "learning-reverse" })
```

Expected: ghi lại risk và d=1 dependents. Nếu HIGH/CRITICAL thì dừng trước khi edit.

- [x] **Step 2: Bổ sung imports, callback và selected mode**

Imports:

```ts
import { apiGet, apiPost, apiPut, ApiError } from '../../api.js';
import { formatFishingStatus } from './FishingPanel.js';
```

Thêm callback vào destructuring và prop type:

```ts
onAutomationChange,

onAutomationChange?(snapshot: AutomationSnapshot): void;
```

Giữ `automationSupported?: boolean` trong prop type như prop tương thích tạm thời, nhưng không destructure hoặc dùng nó. Task 3 sẽ xóa prop này và call site sau khi Drawer được nối callback mới.

Thêm state và đồng bộ chỉ khi snapshot đang chỉ ra một mode Status có thể chọn:

```ts
type StatusAutomationMode = 'auto_farm' | 'auto_fishing';

const [selectedMode, setSelectedMode] = useState<StatusAutomationMode>('auto_farm');

useEffect(() => {
  const snapshotMode = automation?.desiredMode !== 'off'
    ? automation?.desiredMode
    : automation?.activeMode;
  if (snapshotMode === 'auto_farm' || snapshotMode === 'auto_fishing') {
    setSelectedMode(snapshotMode);
  }
}, [automation?.desiredMode, automation?.activeMode]);
```

Khi snapshot off hoặc active mode là `find_npc`, effect không đổi lựa chọn cục bộ.

- [x] **Step 3: Thay logic active/disable bằng contract strict**

Xóa `supportsAutomation`, `legacyAutoActive`, `farmStable` và nhánh endpoint `/auto/start`/`/auto/stop`. Dùng:

```ts
const automation = automationProp ?? snap?.automation;
const autoActive = Boolean(
  automation
    && (
      automation.desiredMode !== 'off'
      || automation.activeMode !== 'off'
      || automation.transitionState === 'switching'
    ),
);
const mutationBusy = autoAction !== null || automationMutationBusy;
const controlsLocked = autoActive || mutationBusy;
const progressMode = automation?.activeMode !== 'off'
  ? automation?.activeMode
  : automation?.desiredMode;
```

Không dùng `automationSwitching` để disable riêng nút stop.

- [x] **Step 4: Gửi start/stop theo selected mode và đồng bộ snapshot response**

Thay hai handlers bằng logic dưới đây:

```ts
async function startAuto() {
  if (autoActive || mutationBusy) return;
  setAutoAction('start');
  onAutomationMutationBusyChange(true);
  setAutoErr('');
  try {
    const loaded = await apiPost<AutomationSnapshot>(
      `/api/accounts/${accountId}/automation/start`,
      { mode: selectedMode },
    );
    if (loaded) onAutomationChange?.(loaded);
    onChanged();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const loaded = (error.body as { snapshot?: AutomationSnapshot })?.snapshot;
      if (loaded) onAutomationChange?.(loaded);
      onChanged();
    } else {
      setAutoErr((error as Error).message);
    }
  } finally {
    setAutoAction(null);
    onAutomationMutationBusyChange(false);
  }
}

async function stopAuto() {
  if (!autoActive || mutationBusy) return;
  setAutoAction('stop');
  onAutomationMutationBusyChange(true);
  setAutoErr('');
  try {
    const loaded = await apiPost<AutomationSnapshot>(
      `/api/accounts/${accountId}/automation/stop`,
      {},
    );
    if (loaded) onAutomationChange?.(loaded);
    onChanged();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const loaded = (error.body as { snapshot?: AutomationSnapshot })?.snapshot;
      if (loaded) onAutomationChange?.(loaded);
      onChanged();
    } else {
      setAutoErr((error as Error).message);
    }
  } finally {
    setAutoAction(null);
    onAutomationMutationBusyChange(false);
  }
}
```

- [x] **Step 5: Thêm hai controlled checkbox và đổi action labels**

Thay row action hiện tại bằng cấu trúc sau, giữ style phù hợp với các row/inline control đang có:

```tsx
<div className="row" role="group" aria-label="Chọn chế độ tự động">
  <label className="inline">
    <input
      type="checkbox"
      checked={selectedMode === 'auto_farm'}
      disabled={controlsLocked}
      onChange={() => setSelectedMode('auto_farm')}
    />
    Auto Farm
  </label>
  <label className="inline">
    <input
      type="checkbox"
      checked={selectedMode === 'auto_fishing'}
      disabled={controlsLocked}
      onChange={() => setSelectedMode('auto_fishing')}
    />
    Auto Fishing
  </label>
</div>
<div className="row">
  <button
    onClick={() => void startAuto()}
    disabled={autoActive || mutationBusy}
  >
    {autoAction === 'start' ? 'Đang bắt đầu…' : 'Bắt đầu'}
  </button>
  <button
    className="ghost"
    onClick={() => void stopAuto()}
    disabled={!autoActive || mutationBusy}
  >
    {autoAction === 'stop' ? 'Đang dừng…' : 'Dừng Auto'}
  </button>
</div>
```

Không cho handler checkbox tạo trạng thái cả hai unchecked: click checkbox đang chọn chỉ set lại cùng mode.

- [x] **Step 6: Hiển thị hint theo mode thực tế**

Tạo text từ `progressMode` và nối transition suffix:

```ts
const automationProgress = (() => {
  if (!automation || progressMode === 'off') return 'automation đang tắt';
  if (progressMode === 'auto_fishing') {
    return `câu cá: ${formatFishingStatus(
      true,
      automation.fishingRuntime?.status,
      snap?.status,
    )}`;
  }
  if (progressMode === 'auto_farm') {
    return auto.running
      ? `auto farm đang chạy — vòng ${auto.cycle}`
      : 'auto farm đang chờ kết nối / vòng tiếp theo';
  }
  return `automation ${progressMode} đang hoạt động — hãy dừng trước khi đổi mode`;
})();

const transitionHint = automation?.transitionState === 'switching'
  ? ` · đang chuyển ${automation.activeMode} → ${automation.desiredMode}`
  : '';
```

Render `automationProgress` và `transitionHint`. Chỉ nối `auto.lastRun` khi `progressMode === 'auto_farm'`. Giữ nguyên các hint/error farm sync, retry và session bên dưới.

- [x] **Step 7: Kiểm tra build sau thay đổi `StatusPanel`**

Run:

```bash
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/web/dist 2>/dev/null || true
cd /Users/devios/learning-reverse/avatar-web/web && npm run build
```

Expected: build thành công; TypeScript chấp nhận callback optional và prop compatibility tạm thời; không còn `/auto/start`, `/auto/stop`, `farmStable`, `supportsAutomation` hoặc `automationSwitching` trong `StatusPanel.tsx`.

- [x] **Step 8: Commit gate**

Nếu chưa được user ủy quyền commit: không stage/commit.

Nếu đã được ủy quyền, stage đúng hai file đang tham gia contract formatter/controller, kiểm tra rồi chạy GitNexus detect changes:

```bash
git add avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/accounts/panels/FishingPanel.tsx
git diff --cached --name-only
git diff --cached --check
```

Run `gitnexus_detect_changes({ scope: 'staged', repo: 'learning-reverse' })`, rồi mới commit:

```bash
git commit -m "feat(avatar-web): add status automation mode controls"
```

---

### Task 3: Nối snapshot owner trong Drawer và xác minh acceptance matrix

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:102-247`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:7-25`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx:11-18`
- Modify: `docs/superpowers/plans/2026-09-10-status-tab-automation-controls.md` (đánh dấu checkbox đã hoàn tất)

**Interfaces:**
- Consumes: `handleAutomationChange(loaded: AutomationSnapshot): void` và optional callback được tạo ở Task 2.
- Produces: `StatusPanel` cập nhật `fetchedAutomation` ngay sau mutation; loại bỏ props chuyển tiếp `automationSupported` và `FishingPanel.onAutomationChange` không còn dùng.

- [x] **Step 1: Chạy impact analysis trước khi sửa Drawer**

Run qua GitNexus MCP:

```text
gitnexus_impact({ target: "LoadedOperations", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "handleAutomationChange", direction: "upstream", repo: "learning-reverse" })
gitnexus_impact({ target: "handleAutomationCapabilityChange", direction: "upstream", repo: "learning-reverse" })
```

Expected: ghi lại risk và d=1 dependents; dừng nếu HIGH/CRITICAL.

- [x] **Step 2: Truyền callback mutation vào `StatusPanel`**

Trong call site `StatusPanel`, thêm:

```tsx
onAutomationChange={handleAutomationChange}
```

Giữ `onChanged` gọi cả `reload()` và `refreshAutomation()` để REST response được xác nhận lại bằng nguồn hiện hành.

- [x] **Step 3: Xóa state capability chỉ phục vụ legacy Status fallback**

Xóa:

```ts
const [automationSupported, setAutomationSupported] = useState<boolean | undefined>();
```

Trong `refreshAutomation`, giữ fetch và `setFetchedAutomation(snap)` nhưng xóa `setAutomationSupported(true)`.

Đổi callback capability thành:

```ts
const handleAutomationCapabilityChange = useCallback((
  supported: boolean,
  loaded?: AutomationSnapshot,
) => {
  if (loaded) setFetchedAutomation(loaded);
  else if (!supported) setFetchedAutomation(undefined);
}, []);
```

Callback vẫn được truyền cho `FindNpcPanel`, vì panel đó còn contract capability riêng.

- [x] **Step 4: Xóa hai props chuyển tiếp**

> **Implementation ruling:** `FishingPanel.onAutomationChange` và Drawer forwarding đã được xóa. Riêng `StatusPanel.automationSupported?:` được giữ lại dưới dạng optional prop deprecation/compatibility type và hoàn toàn không được đọc, vì test cũ vẫn nằm trong TypeScript build nhưng yêu cầu task không cho phép chỉnh test. Không khôi phục legacy endpoint hoặc capability state.

- Xóa `automationSupported={snapshot?.automation ? true : automationSupported}` khỏi call site `StatusPanel`.
- Xóa `automationSupported?: boolean` khỏi prop type `StatusPanel`.
- Xóa `onAutomationChange={handleAutomationChange}` khỏi call site `FishingPanel`.
- Xóa `onAutomationChange?(snapshot: AutomationSnapshot): void` khỏi `FishingPanelProps`.

Sau bước này, chỉ `StatusPanel` sở hữu mutation callback; `FishingPanel` chỉ đọc `automation`.

- [x] **Step 5: Chạy static checks và build cuối**

Run:

```bash
cd /Users/devios/learning-reverse
git diff --check
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/web/dist 2>/dev/null || true
cd /Users/devios/learning-reverse/avatar-web/web && npm run build
```

Expected: `git diff --check` không có output; còn ít nhất 15 GiB; `tsc -b` và Vite build thành công không lỗi TypeScript/JSX.

- [ ] **Step 6: Kiểm tra thủ công acceptance matrix**

> **Residual gap:** Flow farm/fishing, payload start/stop, single-choice, strict lock và khôi phục mode đã được kiểm tra live trên account local 3. Snapshot transient `switching` và active `find_npc` chưa có app-rendered evidence vì không có fixture/bridge an toàn và account không có find-npc config; xem ledger SDD trong execution record của task.

Chạy web UI theo script dev hiện có và kiểm tra đúng tám trường hợp:

1. Snapshot off: Auto Farm checked mặc định; Auto Fishing unchecked; **Bắt đầu** enabled; **Dừng Auto** disabled.
2. Click Auto Fishing: Auto Fishing checked và Auto Farm tự unchecked.
3. Start fishing: request `POST /api/accounts/:id/automation/start` có body `{ mode: 'auto_fishing' }`; hai checkbox khóa ngay.
4. Tab Câu cá: header phản ánh `fishingRuntime.status`, có switching hint khi phù hợp và không còn nút start/stop.
5. Stop: request `POST /api/accounts/:id/automation/stop` có body `{}`; khi snapshot off, hai checkbox mở khóa.
6. Start farm: request body `{ mode: 'auto_farm' }`; hint hiện vòng farm và last-run chỉ cho farm.
7. Snapshot có desired/active non-off hoặc switching: cả hai checkbox và **Bắt đầu** disabled; **Dừng Auto** enabled khi không có mutation request.
8. Snapshot `find_npc` active: checkbox/start bị khóa, hint nêu mode khác, **Dừng Auto** enabled.

Ghi rõ trường hợp nào đã được kiểm tra bằng UI/network thực tế; không gọi build là manual hoặc live acceptance.

- [x] **Step 7: Rà soát phạm vi và artifact**

Run:

```bash
cd /Users/devios/learning-reverse
git status --short
git diff -- avatar-web/web/src/accounts/panels/StatusPanel.tsx avatar-web/web/src/accounts/panels/FishingPanel.tsx avatar-web/web/src/accounts/AccountOperationsDrawer.tsx
git diff --check
df -h /Users/devios/learning-reverse
du -sh /Users/devios/learning-reverse/avatar-web/web/dist 2>/dev/null || true
```

Expected: production diff chỉ nằm trong ba file allowlist; các file bẩn có trước vẫn nguyên vẹn. Nếu `dist` không tồn tại trước task và do task tạo, dọn đúng đường dẫn tuyệt đối sau khi xác nhận không có process dùng; nếu `dist` đã tồn tại hoặc ownership không rõ, giữ nguyên và báo dung lượng thay vì xóa.

- [x] **Step 8: Pre-commit GitNexus và commit gate**

Luôn chạy scope review trên uncommitted production changes:

```text
gitnexus_detect_changes({ scope: "unstaged", repo: "learning-reverse" })
```

Nếu chưa được user ủy quyền commit: dừng tại đây, báo build/manual evidence và danh sách file thay đổi.

Nếu user đã ủy quyền commit, stage đúng allowlist sau và không dùng `git add .`:

```bash
git add \
  avatar-web/web/src/accounts/panels/StatusPanel.tsx \
  avatar-web/web/src/accounts/panels/FishingPanel.tsx \
  avatar-web/web/src/accounts/AccountOperationsDrawer.tsx \
  docs/superpowers/specs/2026-09-10-status-tab-automation-controls-design.md \
  docs/superpowers/plans/2026-09-10-status-tab-automation-controls.md
git diff --cached --name-only
git diff --cached --stat
git diff --cached --check
```

Run `gitnexus_detect_changes({ scope: 'staged', repo: 'learning-reverse' })`. Expected: chỉ các symbol/UI flow thuộc Status/Fishing/Drawer và hai tài liệu được duyệt. Sau đó commit:

```bash
git commit -m "feat(avatar-web): centralize automation controls in status tab"
```
