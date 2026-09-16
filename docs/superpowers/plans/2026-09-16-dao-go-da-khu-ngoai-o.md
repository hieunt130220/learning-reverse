# Tự động hoá "Đào gỗ & đá tại Khu ngoại ô" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động hoá đào gỗ/đá tại Khu ngoại ô (map 17): join đúng map, mở menu đối tượng, chọn menu đào, đếm vật liệu — có guard chống anti-cheat và uncertainty.

**Architecture:** 3-wave: (A) sửa namespace toạ độ Park + tool probe read-only mới; (B) live capture có gate để chốt `idMenu`/item id, ghi evidence; (C) automation mode `auto_mining` tái sử dụng `communicate(-59)`/`doMenuOption(-61)`, inventory decode và `joinParkWithRetry` hiện có.

**Tech Stack:** TypeScript 5.7 (ESM, `tsx`), Node.js, React 18, better-sqlite3, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-16-dao-go-da-khu-ngoai-o-design.md`

## Global Constraints
- KHÔNG TDD: không tạo file test mới trừ khi user yêu cầu; chỉ chạy test hiện có.
- GitNexus: `gitnexus_impact(target, upstream)` trước khi sửa symbol hiện có; `gitnexus_detect_changes()` trước mỗi commit; `npx gitnexus analyze` sau commit cuối.
- Không placeholder: không `TODO/TBD`, mọi id/menu/item chỉ lấy từ evidence live, không hard-code số liệu chưa verify.
- Live gate: Task 3/4/6/13 cần account live + approve riêng; KHÔNG chạy unattended; không tạo session thứ 2 cùng account.
- Redaction: không in credential/host/hex toàn gói; chỉ in nội dung trong whitelist của Spec §3.2.3.
- Write discipline: mọi TX `-59`/`-61` production chỉ khi `MINING_WRITE_ENABLED=true`; probe opt-in hard cap 1 lần ghi/run.
- Lệnh verify chuẩn: `cd avatar-web/server && npm run typecheck && npm run build && npm test`.

---

### Task 1: Sửa namespace toạ độ Park (thêm map 17, xoá entry `8` nhầm namespace)

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:53-82`

**Interfaces:**
- Consumes: evidence CityMap (`docs/protocol/npc-map-probe-evidence-2026-08-25.md:36`), J2ME map list (`tools/jar/all_src/gs_0.java:3321`).
- Produces: `NATIVE_PARK_JOIN_POSITIONS[17] = {x:100, y:100}` dùng cho `doJoinPark` và probe.

- [x] **Step 1: Impact analysis**
  Run: `gitnexus_impact({target: "NATIVE_PARK_JOIN_POSITIONS", direction: "upstream"})` và `gitnexus_impact({target: "ParkService.doJoinPark", direction: "upstream"})`
  Expected: callers là `client.joinPark` + probe; không có caller nào dùng map 8 (kiểm chứng thêm bằng grep).
- [x] **Step 2: Verify zero caller của map 8**
  Run: `grep -rn "joinPark(8\|, 8)\|NATIVE_PARK_JOIN_POSITIONS\[8" avatar-web/server/src avatar-web/web/src`
  Expected: không có kết quả sử dụng.
- [x] **Step 3: Sửa bảng toạ độ**
  Trong `NATIVE_PARK_JOIN_POSITIONS`: xoá dòng `8: Object.freeze({ x: 100, y: 100 }),`; thêm `17: Object.freeze({ x: 100, y: 100 }),`. Sửa comment header: thay `8: Ngoại ô (100, 100)` thành `8: node CityMap "Ngoại ô" → roomID 17; roomID 8 chưa verify`; thêm `17: Ngoại ô (100, 100) — roomID verify từ CityMap node 8 (e3fc3c12…) + J2ME "ID 17: Khu ngoại ô"`.
- [x] **Step 4: Verify**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: PASS. Run: `gitnexus_detect_changes({scope: "all"})` — Expected: chỉ chạm `parkService.ts`.
- [x] **Step 5: Commit**
  `git commit -m "feat(park): add verified join position for map 17 (Ngoại ô), drop mis-keyed node-8 entry"`

---

### Task 2: Tạo tool probe read-only `mining-probe.ts` (Phase A1)

**Files:**
- Create: `avatar-web/server/src/tools/mining-probe.ts`

**Interfaces:**
- Consumes: `GameClient` (`client.ts`: `enterParkContext:718`, `sendRaw:912`, `waitForWorldSnapshot`, events `traffic`/`world-snapshot`/`dialog`/`temporary-rejection`/`status`/`closed`), `NATIVE_PARK_JOIN_POSITIONS` (Task 1), `getAccountById`/`readGamePass`/`loadConfig`/`openDb` (pattern `npc-map-probe.ts:2-14, 850-863`).
- Produces: stdout JSON theo Spec §3.2.5 (`requested/join/specials/trafficSummary/events/decode`).

- [x] **Step 1: Viết tool**
  Khung giống `npc-map-probe.ts` nhưng tối giản: `parseArgs` với `ALLOWED={'--account-id','--map','--area'}`; `resolveNativeJoinPosition(map)` tra `NATIVE_PARK_JOIN_POSITIONS[map]` (throw khi thiếu); `assertAvatarWebStopped`-tương đương để tránh đá phiên; sequence `enterParkContext()` → `sendRaw(90,[i8 map])` → `sendRaw(80,[i8 map,i8 area,i16 x,i16 y])` → `waitForWorldSnapshot(signal, 7_000, {map, area})`; trong lúc chờ thu `traffic` metadata `{dir,cmd,len}`; đọc `specials[]={id,name,type,imageCount,menuIds[]}` từ snapshot (re-use decoder `decodeParkJoinWorld` qua client, không tự parse). Không có flag ghi nào ở task này.
- [x] **Step 2: Verify**
  Run: `cd avatar-web/server && npx tsx src/tools/mining-probe.ts --account-id 0`
  Expected: JSON lỗi `cli` (account-id phải > 0), exit code 1, không hề mở socket. Run: `npm run typecheck` — Expected: PASS.
- [x] **Step 3: Commit**
  `git commit -m "feat(probe): add read-only mining-probe for map 17 object enumeration"`

---

### Task 3 (LIVE GATE): Chạy probe A1 tại Khu ngoại ô, ghi bằng chứng đối tượng

**Files:**
- Modify: `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md` (tạo mới — phần bảng đối tượng)

**Interfaces:**
- Consumes: Task 1 + Task 2, account live do user chỉ định.
- Produces: `join` + `specials[]` + traffic summary (Spec §3.3 mục 1–2, 5–6).

- [x] **Step 1: Xin approve live riêng**
  Cần: account id + xác nhận web đã dừng với account đó. Không tự động tiếp tục nếu thiếu.
- [x] **Step 2: Chạy read-only**
  Run: `cd avatar-web/server && npx tsx src/tools/mining-probe.ts --account-id <N> --map 17 --area 0`
  Expected: `decode:'ok'`, `join.roomId/boardId = 17/0`, traffic chỉ chứa TX `-1/90/80`, `specials` liệt kê tên + `menuIds[]`; không có TX `-59`/`-61` nào.
- [x] **Step 3: Ghi evidence**
  Điền `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md` §1–2, §5–6 (mục 3–4 ghi `pending`).
- [x] **Step 4: Commit**
  `git commit -m "docs(protocol): khu ngoại ô map 17 object catalog (read-only probe)"`

### Task 4: Thêm flag opt-in `--open-menu`/`--select-menu`/`--observe-inventory` cho probe

**Files:**
- Modify: `avatar-web/server/src/tools/mining-probe.ts`

**Interfaces:**
- Consumes: `farm.communicate(id)` (TX `-59`, `farmService.ts:69-71`), `farm.doMenuOption(id, menu, -1)` (TX `-61`, `farmService.ts:74-80`), decode inventory hiện có (`client.ts:1397-1430`).
- Produces: `openMenu` + `selectMenu` trong stdout JSON (Spec §3.2.5).

- [x] **Step 1: Viết flag ghi có gate**
  Mở rộng `ALLOWED` với 3 flag; `--select-menu` yêu cầu `--open-menu`, `--observe-inventory` tự động gửi thêm TX `70` trước/sau. Mỗi lần chạy gửi tối đa 1 TX `-59` và 1 TX `-61`, không retry, không loop; sau ghi chờ RX tối đa 6s rồi logout trong `finally`. Caption đọc theo Spec §3.2.3 (whitelist + cắt 120 ký tự, thay newline bằng khoảng trắng).
- [x] **Step 2: Verify (không cần live)**
  Run: `cd avatar-web/server && npx tsx src/tools/mining-probe.ts --account-id 0 --map 17 --area 0 --select-menu 7`
  Expected: JSON lỗi `cli` (thiếu `--open-menu` / account không hợp lệ) trước khi mở socket; `npm run typecheck` PASS.
- [x] **Step 3: Commit**
  `git commit -m "feat(probe): add gated --open-menu/--select-menu write flags (1 write per run)"`

### Task 5: Decode RX menu/vật phẩm trong `GameClient` (phục vụ probe + automation)

**Files:**
- Modify: `avatar-web/server/src/game/client.ts` (`onMessage` switch, cạnh `case -62:1308` và `case 70:1397`)

**Interfaces:**
- Consumes: RX `-101` (ADD_MENU), RX `-67` (UPDATE_CONTAINER), RX `-17` (CONTAINER).
- Produces: event `menu` (`{entries:[{idMenu, caption}]}`), event `container-update` (`{items:[{id, num}]}`), traffic metadata đầy đủ cho `routes.ts:702` (`/:id/traffic`).

- [x] **Step 1: Impact analysis**
  Run: `gitnexus_impact({target: "onMessage", direction: "upstream"})`
  Expected: callers là socket dispatch + probe/session listener; ghi rõ `direct callers` phải retest (`client.test.ts`, probe, session).
- [x] **Step 2: Thêm decode theo schema từng-phase**
  `case -101`: đọc tối thiểu `utf caption` + `idMenu`; decode lỗi ⇒ log `decode menu lỗi` + vẫn push traffic metadata, không throw, không emit `menu`. `case -67`/`-17`: decode danh sách `{id, num}` reuse helper của `decodeInventory`; decode lỗi ⇒ log + không cập nhật `inventory`. Không đổi `default: break` (`client.ts:1812`).
- [x] **Step 3: Verify**
  Run: `cd avatar-web/server && npm run typecheck && npm test`
  Expected: toàn bộ test hiện có PASS (`client.test.ts`, `farmData.test.ts`, `worldData.test.ts`).
- [x] **Step 4: Commit**
  `git commit -m "feat(client): decode RX -101 menu and -67/-17 container updates"`

### Task 6 (LIVE GATE): Capture menu đào + item gỗ/đá, chốt evidence

**Files:**
- Modify: `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md` (điền mục 3–4 + chốt trạng thái)

**Interfaces:**
- Consumes: Task 3–5, object id do user chọn từ bảng Task 3.
- Produces: `menuEntries` + `containerDelta`/`itemDelta` → `dig-menu-verified`, `material-ids`.

- [ ] **Step 1: Xin approve live riêng cho bước ghi (A2)**
  Trình bày object id dự kiến, chỉ mở menu, chưa chọn. Không chạy nếu chưa approve.
- [ ] **Step 2: Chạy A2**
  Run: `npx tsx src/tools/mining-probe.ts --account-id <N> --map 17 --area <A> --open-menu <objId>`
  Expected: đúng 1 TX `-59`; `menuEntries` có ≥1 entry có caption tiếng Việt; TX `-61` count = 0.
- [ ] **Step 3: Xin approve live riêng cho bước ghi (A3)**
  Trình bày `idMenu` dự kiến + caption đối chiếu Spec §E7. Không chạy nếu chưa approve.
- [ ] **Step 4: Chạy A3**
  Run: thêm `--select-menu <idMenu> --observe-inventory`
  Expected: đúng 1 TX `-61`; có RX menu/dialog/container; `itemDelta` hiển thị id + qty; ghi lại toàn bộ vào evidence doc (mục 3–4 + trạng thái `dig-menu-verified`/`material-ids`).

### Task 7: Tạo `miningCatalog.ts` + `MiningConfig`/`MiningRuntime` types từ evidence

**Files:**
- Create: `avatar-web/server/src/game/miningCatalog.ts`
- Modify: `avatar-web/server/src/session/automationTypes.ts` (union `AutomationMode` + thêm `MiningConfig`, `MiningRuntime`, `DEFAULT_MINING_CONFIG`)

**Interfaces:**
- Consumes: evidence doc Task 6 (mảng rỗng nếu `pending`); pattern `npcMapCatalog.ts` + `FishingConfig`/`DEFAULT_FISHING_CONFIG` trong `automationTypes.ts`.
- Produces: `VERIFIED_MINING_CATALOG`, `MiningConfig`, `DEFAULT_MINING_CONFIG` (Spec §3.4.1).

- [ ] **Step 1: Viết catalog + types**
  `miningCatalog.ts` export đúng interface Spec §3.4.1 với dữ liệu copy nguyên văn từ evidence (không cộng thêm area/object/menu nào). `automationTypes.ts`: thêm `'auto_mining'` vào `AutomationMode`; thêm `MiningConfig` (`area`, `objectName?`, `objectId?`, `menuKey:'dig'|'chop'`, `maxActionsPerCycle=20`, `maxCycles=0`, `actionCooldownMs=3000` với floor 1500, `targetMaterialIds`), `DEFAULT_MINING_CONFIG`, `MiningRuntime` (`phase:'idle'|...`, `actionsDone`, `cyclesDone`, `materialsGained`, `lastObjectId`, `lastError`).
- [ ] **Step 2: Verify**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: PASS. Run: `gitnexus_detect_changes({scope: "all"})` — Expected: chỉ 2 file trên.
- [ ] **Step 3: Commit**
  `git commit -m "feat(mining): add verified catalog + config/runtime types from evidence"`

### Task 8: Migration DB + persist config mining

**Files:**
- Modify: `avatar-web/server/src/db/index.ts` (`:39-80`), `avatar-web/server/src/accounts/automationRepo.ts` (`setDesiredMode`, `listDesiredAutomation`, `rowToState`, config JSON pattern `find_npc_config_json`/`fishing_config_json`)

**Interfaces:**
- Consumes: `AutomationMode` có `'auto_mining'`, `MiningConfig` (Task 7).
- Produces: `desired_mode='auto_mining'` persist được + `mining_config_json` load/save + `listDesiredAutomation` include mode mới.

- [ ] **Step 1: Impact analysis**
  Run: `gitnexus_impact({target: "setDesiredMode", direction: "upstream"})` và `gitnexus_impact({target: "listDesiredAutomation", direction: "upstream"})`
  Expected: callers là `repo.ts`, `routes.ts`, `manager.ts`; liệt kê để retest.
- [ ] **Step 2: Migration + repo**
  Thêm `addColumn("... ADD COLUMN mining_config_json TEXT")`; mở rộng điều kiện rebuild CHECK khi thiếu `'auto_mining'` trong `stateTable.sql` (pattern `:47`, thêm cột vào CREATE TABLE + INSERT...SELECT); `setDesiredMode` giữ nguyên logic (chỉ thêm mode vào union); `listDesiredAutomation` WHERE thêm `'auto_mining'` + SELECT `mining_config_json`; `rowToState` parse `miningConfig {revision, config}` fallback `DEFAULT_MINING_CONFIG`.
- [ ] **Step 3: Verify**
  Run: `cd avatar-web/server && npm run typecheck && npm test`
  Expected: PASS. Run migration smoke: mở DB mới + DB copy cũ (chưa có cột/`auto_mining` trong CHECK): `openDb` thành công, `setDesiredMode(db, id, 'auto_mining')` + đọc lại đúng; không mất dữ liệu mode cũ.

### Task 9: Module `autoMining.ts` — loop 1 lượt đào có guard

**Files:**
- Create: `avatar-web/server/src/autoMining.ts`

**Interfaces:**
- Consumes: `AutoMiningClient` hẹp (`enterParkContext`, `joinPark`, `waitForWorldSnapshot`, `farm.communicate`, `farm.doMenuOption`, `farm.getInventory`, events `menu`/`container-update`/`dialog`/`inventory`/`closed`), `VERIFIED_MINING_CATALOG` (Task 7), `MiningConfig`, `onProgress` gửi `MiningRuntime` lên session/WS.
- Produces: class `AutoMining` (`start/stop`, epoch, `runOneDig()`, `stopOnUncertain()`), log `[đào] ...` cho session.

- [ ] **Step 1: Viết module theo flow Spec §3.4.2**
  Guard mở đầu: catalog `areas` rỗng/object không match/menuKey không có trong `menus` ⇒ dừng + lỗi `catalog chưa verify`. Mỗi lượt: `joinParkWithRetry`-tương đương (cooldown ≥2s) → snapshot `specials[]` tìm object (`objectId` hoặc match chính xác `objectName` sau normalize NFC/trim/lowercase `vi`, pattern `autoFindNpc.ts:50-53`) → `communicate(objectId)` chờ `menu` 6s → `doMenuOption(objectId, menus[menuKey], -1)` chờ `container-update` 6s → `getInventory()` đối chiếu delta theo `targetMaterialIds` → cập nhật `materialsGained`. Mọi `dialog`/timeout/unknown ⇒ terminal stop của lượt, uncertain ⇒ stop toàn bộ (không resend). Hard limit `maxActionsPerCycle`; cooldown `max(actionCooldownMs, 1500)`.
- [ ] **Step 2: Verify**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: PASS (chưa cần live — Task 13 mới chạy live).
- [ ] **Step 3: Commit**
  `git commit -m "feat(mining): add AutoMining loop with catalog guards and uncertainty stop"`

### Task 10: Wiring mode `auto_mining` vào session/routes/manager + flag `MINING_WRITE_ENABLED`

**Files:**
- Modify: `avatar-web/server/src/config.ts` (`shopPolicy`-style: thêm `miningWriteEnabled` từ `MINING_WRITE_ENABLED`, pattern `config.ts:37-39,110-112`), `avatar-web/server/src/session/featureFlags.ts` (thêm `MINING_DISABLED = true`, pattern `FIND_NPC_DISABLED`), `avatar-web/server/src/session/routes.ts` (`:290-303`), `avatar-web/server/src/session/avatarSession.ts` (union `:96`, nhánh `:1708/:1769`, runtime), `avatar-web/server/src/session/manager.ts` (`:244-248`, `:316`), `.env.example`, `README.md` (mục env)

**Interfaces:**
- Consumes: `AutoMining` (Task 9), `MiningConfig`/`MiningRuntime` (Task 7).
- Produces: `POST /:id/automation/start {mode:'auto_mining'}` hoạt động + stop idempotent + WS push `MiningRuntime`.

- [ ] **Step 1: Config + flag**
  `config.ts`: thêm `miningWriteEnabled: envFlag(env.MINING_WRITE_ENABLED)` và lan xuống session context. `featureFlags.ts`: `export const MINING_DISABLED = true;`. `AutoMining` và session chỉ gửi `-59`/`-61` khi `miningWriteEnabled && !MINING_DISABLED`; ngược lại từ chối với log `mining write bị khoá`.
- [ ] **Step 2: Wiring mode**
  `routes.ts`: accept `'auto_mining'` trong `start` (`:293`) + guard 503 `mining-disabled` khi `MINING_DISABLED` + yêu cầu `miningConfig` đã lưu (pattern `find-npc-name-required` `:310-321`: yêu cầu `objectName/objectId` + `menuKey` + catalog chứa area/object). `avatarSession.ts`: nhánh desired/active `auto_mining` (start/stop/epoch giống pattern farm/find_npc), `manager.ts`: thêm vào danh sách restart.
- [ ] **Step 3: Verify**
  Run: `cd avatar-web/server && npm run typecheck && npm test && npm run build`
  Expected: PASS toàn bộ; kiểm tra behavior: start khi `MINING_DISABLED=true` ⇒ 503; start thiếu config ⇒ 400; start không chạm `-59`/`-61` khi `MINING_WRITE_ENABLED` unset (dùng `/:id/traffic`).
- [ ] **Step 4: Commit**
  `git commit -m "feat(mining): wire auto_mining mode with write guard and kill-switch"`

### Task 11: UI tối thiểu `MiningPanel.tsx` (Phase C2, optional)

**Files:**
- Create: `avatar-web/web/src/accounts/panels/MiningPanel.tsx`
- Modify: nơi render panel theo account mode (pattern của `FindNpcPanel.tsx`), API client web cho start/stop + lưu `MiningConfig`

**Interfaces:**
- Consumes: `MiningConfig`, `MiningRuntime` qua REST/WS hiện có; `VERIFIED_MINING_CATALOG` để render dropdown area/object/menuKey cố định.
- Produces: toggle bật/tắt + hiển thị `phase/actionsDone/materialsGained/lastError`.

- [ ] **Step 1: Viết panel**
  Form chỉ nhận giá trị trong catalog (area select, object select theo `objects[].name`, menuKey `dig|chop`, `maxActionsPerCycle`, `actionCooldownMs` floor 1500); nút start gọi `POST /:id/automation/start {mode:'auto_mining'}` sau khi đã lưu config; nút stop idempotent; hiển thị counters + `lastError`; không cho sửa `areas/objects/materials` (read-only từ catalog).
- [ ] **Step 2: Verify**
  Run: `cd avatar-web/web && npm run build` (+ test panel nếu web có script test)
  Expected: build PASS; chưa cần live.
- [ ] **Step 3: Commit**
  `git commit -m "feat(web): add MiningPanel for auto_mining (catalog-bound inputs)"`

### Task 12: Regression + detect-changes toàn scope

**Files:**
- (không code) kiểm tra + commit nếu còn diff

**Interfaces:**
- Consumes: toàn bộ thay đổi Task 1–11.
- Produces: repo xanh + scope đúng.

- [ ] **Step 1: Chạy bộ verify chuẩn**
  Run: `cd avatar-web/server && npm run typecheck && npm run build && npm test`; `cd ../web && npm run build`
  Expected: PASS toàn bộ; không có test mới được tạo (kiểm tra `git status` không có `*.test.*` mới).
- [ ] **Step 2: Kiểm tra scope**
  Run: `gitnexus_detect_changes({scope: "all"})`
  Expected: chỉ các file đã liệt kê ở Task 1,2,4,5,7–11 + spec/plan/evidence; không có file lạ (đặc biệt `*.db`, `.env`, packet hex).
- [ ] **Step 3: Commit nếu còn diff + refresh index**
  `git commit -m "chore(mining): final verification and scope check"` nếu còn diff. Sau đó Run: `npx gitnexus analyze`
  Expected: index fresh, không cảnh báo stale.

### Task 13 (LIVE GATE): Chạy bounded 5 lượt đào + nghiệm thu

**Files:**
- Modify: `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md` (phụ lục kết quả live run)

**Interfaces:**
- Consumes: Task 1–12 hoàn tất, `MINING_WRITE_ENABLED=true` (user bật), `MINING_DISABLED=false` (đổi trong code + restart).
- Produces: `actionsDone=5`, `materialsGained` đúng delta kho, traffic sạch.

- [ ] **Step 1: Xin approve live cuối**
  Trình bày config đầy đủ (account/area/object/menu/maxActions=5/cooldown), xác nhận `MINING_DISABLED=false` có chủ đích. Không chạy nếu chưa approve.
- [ ] **Step 2: Chạy bounded run**
  Qua UI/API: lưu config → `POST /:id/automation/start {mode:'auto_mining'}` → quan sát log `[đào]`, WS `MiningRuntime`, `GET /api/accounts/:id/traffic`
  Expected: đúng 5 lượt; mỗi lượt có đúng 1 TX `-59` + 1 TX `-61` (tổng ≤10 write); `materialsGained` khớp delta `itemDelta`; không có write thừa; stop idempotent.
- [ ] **Step 3: Ghi phụ lục evidence + commit**
  Ghi kết quả (số lượt, delta, bất thường nếu có) vào evidence doc.
  `git commit -m "docs(protocol): bounded 5-dig live run results (map 17)"`
- [ ] **Step 4: Đóng Plan**
  Đánh dấu tất cả checkbox `- [x]` trong Plan này, commit Plan cuối cùng:
  `git commit -m "docs(plan): complete dao-go-da-khu-ngoai-o implementation plan"`