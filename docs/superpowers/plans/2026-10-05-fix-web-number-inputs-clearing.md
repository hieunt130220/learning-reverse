# Sửa Lỗi Không Xoá Được Chữ Trên Các Ô Input Số (Web UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép xoá sạch chữ và nhập số 0 trên toàn bộ 10 ô input số thuộc 3 panel trên web (`FindNpcPanel`, `FishingSettingsPanel`, `DebugPanel`), đồng thời tự động khôi phục giá trị mặc định / clamp dải số khi người dùng rời ô input (`onBlur`).

**Architecture:** Cập nhật state nội bộ của các ô input số thành `number | ''` để nhận giá trị chuỗi rỗng `""` khi người dùng xoá sạch ký tự. Thêm `onBlur` để clamp và fallback về giá trị mặc định khi ô bị bỏ trống lúc rời tiêu điểm. Chuẩn hoá dữ liệu (sanitize) về `number` trước khi gửi request API.

**Tech Stack:** React 18, TypeScript, Vite

**Spec:** `docs/superpowers/specs/2026-10-05-fix-web-number-inputs-clearing-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `impact` trước khi sửa và `detect_changes` trước khi commit.
- KHÔNG dùng TDD: không tạo file test mới, chỉ kiểm tra typecheck và build.
- Đảm bảo toàn bộ 10 ô input:
  1. Xoá được hết chữ (về ô rỗng), không bị kẹt `0` hay tự nhảy số khi đang xoá.
  2. Nhập được số `0` nếu nằm trong dải `[min, max]`.
  3. `onBlur` tự động đưa về default nếu đang để trống, và clamp trong khoảng `[min, max]`.
  4. Submit/Save payload luôn là kiểu `number` hợp lệ.

---

### Task 1: Sửa 5 ô input số trong `FindNpcPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FindNpcPanel.tsx`

**Interfaces:**
- Consumes: `FindNpcConfig`, `DEFAULT_FIND_NPC_CONFIG`, `StoredFindNpcConfigState`
- Produces: State `draft` hỗ trợ `number | ''` cho 5 trường số (`fromMap`, `toMap`, `fromBoard`, `toBoard`, `cycleDelaySeconds`) với `onBlur` validation và sanitization khi lưu.

- [x] **Step 1: Định nghĩa type `FindNpcDraft` và sửa helper `isConfigEqual`**
Tại `avatar-web/web/src/accounts/panels/FindNpcPanel.tsx`:
Thêm type alias `FindNpcDraft`:
```typescript
type FindNpcDraft = Omit<FindNpcConfig, 'fromMap' | 'toMap' | 'fromBoard' | 'toBoard' | 'cycleDelaySeconds'> & {
  fromMap?: number | '';
  toMap?: number | '';
  fromBoard?: number | '';
  toBoard?: number | '';
  cycleDelaySeconds?: number | '';
};
```
Cập nhật `isConfigEqual(a: FindNpcDraft, b: FindNpcConfig): boolean`:
```typescript
function isConfigEqual(a: FindNpcDraft, b: FindNpcConfig): boolean {
  const aFromMap = a.fromMap === '' ? DEFAULT_FIND_NPC_CONFIG.fromMap : (a.fromMap ?? 1);
  const aToMap = a.toMap === '' ? DEFAULT_FIND_NPC_CONFIG.toMap : (a.toMap ?? 8);
  const aFromBoard = a.fromBoard === '' ? DEFAULT_FIND_NPC_CONFIG.fromBoard : (a.fromBoard ?? 0);
  const aToBoard = a.toBoard === '' ? DEFAULT_FIND_NPC_CONFIG.toBoard : (a.toBoard ?? 19);
  const aCycleDelay = a.cycleDelaySeconds === '' ? DEFAULT_FIND_NPC_CONFIG.cycleDelaySeconds : (a.cycleDelaySeconds ?? 30);

  return (
    a.npcName === b.npcName &&
    aFromMap === (b.fromMap ?? 1) &&
    aToMap === (b.toMap ?? 8) &&
    aFromBoard === (b.fromBoard ?? 0) &&
    aToBoard === (b.toBoard ?? 19) &&
    (a.stopOnMaxQuantity ?? true) === (b.stopOnMaxQuantity ?? true) &&
    aCycleDelay === (b.cycleDelaySeconds ?? 30)
  );
}
```

- [x] **Step 2: Cập nhật state `draft`, handlers `onChange`/`onBlur` và hàm `save()`**
Đổi state:
```typescript
const [draft, setDraft] = useState<FindNpcDraft>({ ...DEFAULT_FIND_NPC_CONFIG, ...serverConfig.config });
```
Thêm helpers xử lý số:
```typescript
const handleNumberChange = (field: keyof FindNpcDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = e.target.value;
  setDraft((prev) => ({
    ...prev,
    [field]: val === '' ? '' : parseInt(val, 10),
  }));
  setError('');
};

const handleNumberBlur = (field: keyof FindNpcDraft, defaultVal: number, min: number, max: number) => () => {
  setDraft((prev) => {
    const cur = prev[field];
    const num = typeof cur === 'number' && !isNaN(cur) ? cur : defaultVal;
    return {
      ...prev,
      [field]: Math.max(min, Math.min(max, num)),
    };
  });
};
```
Cập nhật trong `save()`:
```typescript
const sanitizedConfig: FindNpcConfig = {
  ...submittedDraft,
  npcName: submittedDraft.npcName.trim(),
  fromMap: typeof submittedDraft.fromMap === 'number' && !isNaN(submittedDraft.fromMap) ? submittedDraft.fromMap : DEFAULT_FIND_NPC_CONFIG.fromMap,
  toMap: typeof submittedDraft.toMap === 'number' && !isNaN(submittedDraft.toMap) ? submittedDraft.toMap : DEFAULT_FIND_NPC_CONFIG.toMap,
  fromBoard: typeof submittedDraft.fromBoard === 'number' && !isNaN(submittedDraft.fromBoard) ? submittedDraft.fromBoard : DEFAULT_FIND_NPC_CONFIG.fromBoard,
  toBoard: typeof submittedDraft.toBoard === 'number' && !isNaN(submittedDraft.toBoard) ? submittedDraft.toBoard : DEFAULT_FIND_NPC_CONFIG.toBoard,
  cycleDelaySeconds: typeof submittedDraft.cycleDelaySeconds === 'number' && !isNaN(submittedDraft.cycleDelaySeconds) ? submittedDraft.cycleDelaySeconds : DEFAULT_FIND_NPC_CONFIG.cycleDelaySeconds,
};
```
Truyền `config: sanitizedConfig` vào `apiPut`.

- [x] **Step 3: Cập nhật 5 thẻ `<input>` trong JSX của `FindNpcPanel.tsx`**
1. "Từ Map":
```tsx
<input
  id="find-npc-from-map"
  type="number"
  min={0}
  max={100}
  style={{ width: '100%' }}
  value={draft.fromMap ?? ''}
  onChange={handleNumberChange('fromMap')}
  onBlur={handleNumberBlur('fromMap', 1, 0, 100)}
/>
```
2. "Đến Map":
```tsx
<input
  id="find-npc-to-map"
  type="number"
  min={0}
  max={100}
  style={{ width: '100%' }}
  value={draft.toMap ?? ''}
  onChange={handleNumberChange('toMap')}
  onBlur={handleNumberBlur('toMap', 8, 0, 100)}
/>
```
3. "Từ Khu (Board)":
```tsx
<input
  id="find-npc-from-board"
  type="number"
  min={0}
  max={50}
  style={{ width: '100%' }}
  value={draft.fromBoard ?? ''}
  onChange={handleNumberChange('fromBoard')}
  onBlur={handleNumberBlur('fromBoard', 0, 0, 50)}
/>
```
4. "Đến Khu (Board)":
```tsx
<input
  id="find-npc-to-board"
  type="number"
  min={0}
  max={50}
  style={{ width: '100%' }}
  value={draft.toBoard ?? ''}
  onChange={handleNumberChange('toBoard')}
  onBlur={handleNumberBlur('toBoard', 19, 0, 50)}
/>
```
5. "Thời gian nghỉ giữa các vòng quét":
```tsx
<input
  id="find-npc-cycle-delay"
  type="number"
  min={5}
  max={3600}
  style={{ width: '120px' }}
  value={draft.cycleDelaySeconds ?? ''}
  onChange={handleNumberChange('cycleDelaySeconds')}
  onBlur={handleNumberBlur('cycleDelaySeconds', 30, 5, 3600)}
/>
```

- [x] **Step 4: Kiểm tra build**
Run: `npm --prefix avatar-web/web run build`
Expected: Build thành công không có lỗi TypeScript.

---

### Task 2: Sửa 3 ô input số trong `FishingSettingsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx`

**Interfaces:**
- Consumes: `DEFAULT_FISHING_CONFIG`, `FishingConfig`
- Produces: Các state `area`, `delayMs`, `baitQuantity` chấp nhận `number | ''` kèm `onBlur` và sanitize khi lưu.

- [x] **Step 1: Cập nhật kiểu state cho 3 trường số**
Tại `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx`:
```typescript
const [area, setArea] = useState<number | ''>(initialConfig.area ?? DEFAULT_FISHING_CONFIG.area);
const [delayMs, setDelayMs] = useState<number | ''>(initialConfig.castDelayMs ?? DEFAULT_FISHING_CONFIG.castDelayMs);
const [baitQuantity, setBaitQuantity] = useState<number | ''>(initialConfig.baitQuantity ?? DEFAULT_FISHING_CONFIG.baitQuantity);
```

- [x] **Step 2: Cập nhật hàm `handleSaveConfig`**
Chuẩn hoá các trường số trước khi gửi API:
```typescript
const resolvedArea = typeof area === 'number' && !isNaN(area) ? Math.max(0, Math.min(15, area)) : DEFAULT_FISHING_CONFIG.area;
const resolvedDelayMs = typeof delayMs === 'number' && !isNaN(delayMs) ? Math.max(1000, delayMs) : DEFAULT_FISHING_CONFIG.castDelayMs;
const resolvedBaitQuantity = typeof baitQuantity === 'number' && !isNaN(baitQuantity) ? Math.max(1, Math.min(200, baitQuantity)) : DEFAULT_FISHING_CONFIG.baitQuantity;
```
Dùng các biến `resolved*` để gửi vào body API `apiPut('/api/accounts/${accountId}/automation/fishing/config')`.

- [x] **Step 3: Cập nhật 3 ô `<input>` trong JSX**
1. "Khu vực":
```tsx
<input
  type="number"
  min={0}
  max={15}
  value={area}
  onChange={(e) => setArea(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
  onBlur={() => {
    if (area === '' || isNaN(Number(area))) setArea(DEFAULT_FISHING_CONFIG.area);
    else setArea(Math.max(0, Math.min(15, Number(area))));
  }}
  disabled={isFishing}
/>
```
2. "Delay giữa các lần quăng":
```tsx
<input
  type="number"
  min={1000}
  step={500}
  value={delayMs}
  onChange={(e) => setDelayMs(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
  onBlur={() => {
    if (delayMs === '' || isNaN(Number(delayMs))) setDelayMs(DEFAULT_FISHING_CONFIG.castDelayMs);
    else setDelayMs(Math.max(1000, Number(delayMs)));
  }}
  disabled={isFishing}
/>
```
3. "Số lượng mồi mua mỗi lần":
```tsx
<input
  type="number"
  min={1}
  max={200}
  value={baitQuantity}
  onChange={(e) => setBaitQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
  onBlur={() => {
    if (baitQuantity === '' || isNaN(Number(baitQuantity))) setBaitQuantity(DEFAULT_FISHING_CONFIG.baitQuantity);
    else setBaitQuantity(Math.max(1, Math.min(200, Number(baitQuantity))));
  }}
  disabled={isFishing}
/>
```

- [x] **Step 4: Kiểm tra build**
Run: `npm --prefix avatar-web/web run build`
Expected: Build thành công không có lỗi TypeScript.

---

### Task 3: Sửa 2 ô input số trong `DebugPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/DebugPanel.tsx`

**Interfaces:**
- Consumes: `ActionDef`, `runAction`
- Produces: Ô input tham số macro và ô input `cmd` tự do cho phép xoá rỗng `''`.

- [x] **Step 1: Cập nhật `ActionRow`**
Đổi state `args`:
```typescript
const [args, setArgs] = useState<(number | '')[]>(def.args.map((a) => a.default ?? 0));
```
Cập nhật `run()`:
```typescript
const finalArgs = args.map((arg, idx) => (arg === '' || isNaN(Number(arg)) ? def.args[idx]?.default ?? 0 : Number(arg)));
await runAction(def.name, finalArgs);
```
Cập nhật JSX input:
```tsx
<input
  type="number"
  value={args[i]}
  onChange={(e) => {
    const next = [...args];
    next[i] = e.target.value === '' ? '' : Number(e.target.value);
    setArgs(next);
  }}
  onBlur={() => {
    if (args[i] === '' || isNaN(Number(args[i]))) {
      const next = [...args];
      next[i] = def.args[i]?.default ?? 0;
      setArgs(next);
    }
  }}
/>
```

- [x] **Step 2: Cập nhật `FreePacketSection` cho ô `cmd`**
Đổi state `cmd`:
```typescript
const [cmd, setCmd] = useState<number | ''>(42);
```
Cập nhật `send()`:
```typescript
const finalCmd = cmd === '' || isNaN(Number(cmd)) ? 42 : Number(cmd);
```
Cập nhật JSX ô `cmd`:
```tsx
<input
  type="number"
  value={cmd}
  onChange={(e) => setCmd(e.target.value === '' ? '' : Number(e.target.value))}
  onBlur={() => {
    if (cmd === '' || isNaN(Number(cmd))) setCmd(42);
  }}
/>
```

- [x] **Step 3: Kiểm tra build & test toàn bộ**
Run: `npm --prefix avatar-web/web run build && npm --prefix avatar-web/web run test`
Expected: Build thành công và toàn bộ 11 test suites (76 tests) pass.

---

### Task 4: Chạy GitNexus analysis và Commit

- [x] **Step 1: Phân tích Git changes qua GitNexus**
Chạy `detect_changes({scope: "all"})` để đảm bảo không có tác động ngoài ý muốn.

- [x] **Step 2: Commit**
`git commit -m "fix(web): allow clearing text and typing 0 in numeric inputs"`
