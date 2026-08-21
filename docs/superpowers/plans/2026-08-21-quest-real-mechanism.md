# Nhiệm Vụ Tân Thủ / Nhà Nông — Đồng bộ từ Hộp thoại NPC Thật — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị tiến trình Nhiệm Vụ Tân Thủ / Nhà Nông từ **dữ liệu server thật** (hộp thoại NPC Lái buôn, cmd -62/-81) thay vì dữ liệu mặc định / tự đánh "đã hoàn thành" theo farm level.

**Architecture:** Sửa `refreshProgressQuests()` gửi đúng chuỗi NPC (communicate(90) → doMenuOption(userID=35, 0, 0/1)); thêm handler cmd -62 (nhiệm vụ hiện tại, có tiến trình) và cmd -81 (danh sách) vào switch của `GameClient.onMessage`; bỏ logic `markQuestsCompletedForFarmLevel` tự đánh completed. `parseQuestDialogText` hiện có đã parse chuẩn payload cmd -62.

**Tech Stack:** TypeScript (server avatar-web), better-sqlite3, tsx. Không thêm dependency mới.

**Spec:** `docs/superpowers/specs/2026-08-21-quest-real-mechanism-design.md`

## Global Constraints
- Wire format `doMenuOption(idUser, idMenu, i)` = `writeInt(idUser).writeByte(idMenu).writeByte(i)` — đã verify, không đổi.
- Chỉ trong **farm handler** NPC quest phản hồi; `refreshProgressQuests` chỉ chạy khi đã vào farm (điều kiện hiện có).
- KHÔNG TDD: viết production code trước; test chỉ khi user yêu cầu.
- Chạy `impact()` trước khi sửa symbol; `detect_changes()` trước khi commit.
- Không sửa UI web (nằm ngoài scope).

## Task 1: Sửa `refreshProgressQuests` gửi đúng NPC quest

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:545-577`

**Interfaces:**
- Consumes: `this.farm.communicate(npcId)`, `this.farm.doMenuOption(uid, menu, opt)`, `this.getInfoUpgradeFarm(1)`
- Produces: gói cmd -62 (nhiệm vụ hiện tại) / cmd -81 (danh sách) từ server

- [ ] **Step 1: Thay chuỗi NPC -1 sai bằng NPC quest thật**
Thay khối từ `this.farm.communicate(-1)` … `doMenuOption(-1, 0, 0)` bằng:

```ts
// NPC quest trên private server: 90/91 → userID menu 35 (Nhiệm Vụ Nhà Nông),
// 95 → userID menu 38 (Nhiệm Vụ Thợ). userID lấy từ chính gói menu cmd -61.
const questNpc: Array<{ npcId: number; menuId: number }> = [
  { npcId: 90, menuId: 35 },   // Nhà Nông
  { npcId: 95, menuId: 38 },   // Thợ (cùng format)
];
for (const q of questNpc) {
  this.farm.communicate(q.npcId);
  await new Promise((r) => setTimeout(r, 450));
  this.farm.doMenuOption(q.menuId, 0, 0); // "Xem nhiệm vụ hiện tại" → cmd -62
  await new Promise((r) => setTimeout(r, 500));
  this.farm.doMenuOption(q.menuId, 0, 1); // "Xem danh sách nhiệm vụ" → cmd -81
  await new Promise((r) => setTimeout(r, 500));
}
```

- [ ] **Step 2: Kiểm tra verify**
Run: `npx tsx --env-file=.env /tmp/npc95.ts` (probe chứng minh cơ chế — nhưng đảm bảo client vẫn compile `npx tsc --noEmit`).
Expected: không lỗi type; server nhận được communicate(90) + doMenuOption(35, 0, 0/1).

- [ ] **Step 3: Commit**
`git commit -m "fix(quest): gửi chuỗi NPC quest thật (90/35, 95/38) thay vì id -1"`

## Task 2: Thêm handler cmd -62 (nhiệm vụ hiện tại)

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:663-716` (cạnh case -40/-88/-70/-77)
- Modify: `avatar-web/server/src/game/progressQuests.ts` (thêm export `parseCurrentQuestPacket` hoặc tái dùng `parseQuestDialogText` + helper decode `[i8 len][utf]`)

**Interfaces:**
- Consumes: `parseQuestDialogText(text)` (đã parse chuẩn payload -62)
- Produces: cập nhật `beginnerQuestState` / `farmerQuestState`, emit `'quests'`

- [ ] **Step 1: Thêm helper decode `[i8 len][utf]` trong progressQuests.ts**
```ts
/** cmd -62 / -81: byte 0 = 0x00 header, sau đó lặp [i8 len][utf8]. */
export function decodeLenPrefixedStrings(buf: Buffer, start = 1): string[] {
  const out: string[] = [];
  let o = start;
  while (o < buf.length) {
    const n = buf[o];
    if (o + 1 + n > buf.length) break;
    out.push(buf.toString('utf8', o + 1, o + 1 + n));
    o += 1 + n;
  }
  return out;
}
```
(thêm test-minimal hoặc để verify bằng probe /tmp trước khi commit)

- [ ] **Step 2: Thêm case -62 vào switch `onMessage`**
Sau case -88 (hoặc cạnh các case dialog), thêm:
```ts
case -62: { // CURRENT_QUEST — "Xem nhiệm vụ hiện tại" (NPC Lái buôn)
  try {
    const parts = decodeLenPrefixedStrings(msg.getData());
    const text = parts.find((s) => /nhiệm vụ hiện tại/i.test(s));
    if (!text) { this.emit('log', `cmd -62 không chứa nội dung quest: ${parts.map((p) => p.slice(0, 30)).join(' | ')}`); break; }
    const questState = parseQuestDialogText(text);
    if (questState) {
      if (questState.kind === 'beginner') this.beginnerQuestState = questState;
      else this.farmerQuestState = questState;
      this.emit('log', `cập nhật ${questState.title}: ${questState.conditions.map((c) => `${c.name} (${c.current}/${c.total})`).join(', ')}`);
      this.emit('quests');
    }
  } catch (err) {
    this.emit('log', `giải mã nhiệm vụ hiện tại lỗi: ${(err as Error).message}`);
  }
  break;
}
```

- [ ] **Step 3: Verify**
Run: probe gọi `refreshProgressQuests` (hoặc qua web `POST /api/accounts/2/quests/progress/refresh`) → log "cập nhật Nhiệm Vụ Nhà Nông - 1: Thu hoạch 200 cà chua (192/200), …".
Expected: `beginnerQuestState`/`farmerQuestState` có `source: 'game-dialog'`, tiến trình thật.

- [ ] **Step 4: Commit**
`git commit -m "feat(quest): handler cmd -62 — nhiệm vụ hiện tại từ NPC Lái buôn"`

## Task 3: Thêm handler cmd -81 (danh sách nhiệm vụ)

**Files:**
- Modify: `avatar-web/server/src/game/client.ts` (case -81)
- Modify: `avatar-web/server/src/game/progressQuests.ts` (parser danh sách)

**Interfaces:**
- Consumes: `decodeLenPrefixedStrings`
- Produces: `farmQuestCatalog` (phụ trợ, để log / dùng sau) — KHÔNG thay đổi `QuestOverviewState` (ngoài scope UI)

- [ ] **Step 1: Parser danh sách trong progressQuests.ts**
```ts
export interface QuestCatalogEntry { title: string; reward: string; }
export function parseQuestListPacket(buf: Buffer): QuestCatalogEntry[] {
  const parts = decodeLenPrefixedStrings(buf);
  const joined = parts.join('\n');
  const out: QuestCatalogEntry[] = [];
  const re = /Nhiệm Vụ[^\n]{0,60}?-\s*\d+[^\n]*\n?([^\n]*Phần Thưởng[^\n]*)/g;
  // đơn giản: tách từng mục theo ranh giới "\nNhiệm Vụ … - N"
  const entries = joined.split(/\n(?=Nhiệm Vụ)/);
  for (const e of entries) {
    const m = e.match(/Nhiệm Vụ.*/);
    if (!m) continue;
    const title = m[0];
    const reward = e.includes('Phần Thưởng') ? e.slice(e.indexOf('Phần Thưởng')) : '';
    out.push({ title, reward });
  }
  return out;
}
```

- [ ] **Step 2: Thêm case -81 trong switch**
```ts
case -81: { // QUEST_LIST — "Xem danh sách nhiệm vụ"
  try {
    const catalog = parseQuestListPacket(msg.getData());
    this.questCatalog = catalog;
    this.emit('log', `danh sách nhiệm vụ: ${catalog.length} quest (mẫu: ${catalog[0]?.title ?? '—'})`);
  } catch (err) {
    this.emit('log', `giải mã danh sách nhiệm vụ lỗi: ${(err as Error).message}`);
  }
  break;
}
```
Thêm field `questCatalog: QuestCatalogEntry[] = []` trong class GameClient (cạnh `beginnerQuestState`).

- [ ] **Step 3: Verify**
Run: probe / web refresh → log "danh sách nhiệm vụ: 108 quest".
Expected: `questCatalog.length > 0`, title đầu = "Nhiệm Vụ Nhà Nông - 1".

- [ ] **Step 4: Commit**
`git commit -m "feat(quest): handler cmd -81 — danh sách nhiệm vụ NPC"`

## Task 4: Bỏ logic tự đánh "Đã hoàn thành" theo farm level

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:495-507, 509-540`
- Modify: `avatar-web/server/src/game/progressQuests.ts` (giữ `markQuestCompleted`/`isQuestCompleted` nếu còn dùng; nếu không dùng nữa thì xóa)

**Interfaces:**
- Consumes: `beginnerQuestState`, `farmerQuestState`
- Produces: không còn tự đánh completed

- [ ] **Step 1: Bỏ gọi `markQuestsCompletedForFarmLevel` trong `syncProgressQuests`**
Sửa `syncProgressQuests()`: bỏ dòng `let changed = this.markQuestsCompletedForFarmLevel();` → `let changed = false;`.
Xóa method `markQuestsCompletedForFarmLevel()` (private, chỉ được gọi trong syncProgressQuests).

- [ ] **Step 2: Kiểm tra các nơi dùng `markQuestCompleted`/`isQuestCompleted`**
Grep toàn repo: nếu chỉ còn trong `markQuestsCompletedForFarmLevel` (đã xóa) và test, thì xóa `markQuestCompleted`/`isQuestCompleted` khỏi progressQuests.ts + import trong client.ts.
Expected: không còn `source: 'completed'` tự sinh.

- [ ] **Step 3: Verify**
Run: web → tab Tân Thủ/Nhà Nông → refresh → KHÔNG còn banner "Đã hoàn thành chuỗi nhiệm vụ" tự sinh; hiển thị tiến trình thật (nếu có dữ liệu server). account phu farmLevel=2 → quest vẫn hiển thị 192/200, không đánh completed.
Expected: `isQuestCompleted` không còn trả true do farmLevel.

- [ ] **Step 4: Commit**
`git commit -m "fix(quest): bỏ tự đánh 'đã hoàn thành' theo farm level — quest không liên quan cấp độ"`

## Task 5: Chạy detect_changes trước khi kết thúc

**Files:**
- Verify: toàn bộ thay đổi

- [ ] **Step 1: `detect_changes`**
Run: `detect_changes({scope: "compare", base_ref: "main"})`.
Expected: chỉ các symbol trong client.ts/progressQuests.ts bị ảnh hưởng (refreshProgressQuests, onMessage case -62/-81, syncProgressQuests), không có ảnh hưởng phụ.

- [ ] **Step 2: Verify live toàn diện**
Run: server + login web account phu → refresh quests → kiểm tra state.
Expected: farmer quest = "Nhiệm Vụ Nhà Nông - 1" với 192/200 cà chua (source game-dialog); Nâng Cấp tab vẫn hoạt động.

- [ ] **Step 3: Commit cuối (nếu có sửa sót)**
`git commit -m "chore(quest): verify cuối và dọn dẹp"`
