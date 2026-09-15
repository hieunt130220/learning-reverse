# Map Pier Fish to Fisherman Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung các loại cá Bến Tàu (Map 27) vào bộ giải mục tiêu nhiệm vụ Thợ Câu (`FISHERMAN_QUEST_FISH_MAP`) và log thông tin vé bến tàu trong `avatarSession.ts`.

**Architecture:** Mở rộng từ điển `FISHERMAN_QUEST_FISH_MAP` trong `fishermanQuest.ts` với các alias không dấu của 4 loài cá Bến Tàu ánh xạ tới Map 27 và vé 4876. Thêm log thông báo vé bến tàu trong `avatarSession.ts`.

**Tech Stack:** TypeScript, Node.js (ESM)

**Spec:** `docs/superpowers/specs/2026-09-15-map-pier-fish-to-fisherman-quest-design.md`

## Global Constraints
- KHÔNG thực hiện TDD: Không viết test trước, không tạo test files trừ khi user yêu cầu rõ ràng.
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit.
- Chạy `typecheck` sau khi chỉnh sửa để đảm bảo không lỗi type.

---

### Task 1: Mở Rộng `FISHERMAN_QUEST_FISH_MAP` Trong `fishermanQuest.ts`

**Files:**
- Modify: `avatar-web/server/src/session/fishermanQuest.ts:12-31`

**Interfaces:**
- Consumes: Không
- Produces: `FISHERMAN_QUEST_FISH_MAP` bổ sung mapping cá Bến Tàu (4504, 4505, 4506, 4507)

- [x] **Step 1: Chạy impact analysis cho `FISHERMAN_QUEST_FISH_MAP`**

Gọi `impact({target: "FISHERMAN_QUEST_FISH_MAP", direction: "upstream"})`
Expected: callers chỉ gồm `resolveFishQuestTarget`.

- [x] **Step 2: Cập nhật `FISHERMAN_QUEST_FISH_MAP` trong `fishermanQuest.ts`**

Bổ sung các dòng mapping cho Bến Tàu:
```typescript
    // Map 27: Bến tàu / Biển Hawai (Vé câu bến tàu 4876)
    'ca lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'ca chep': { fishId: 4505, map: 27, ticketId: 4876 },
    'ca he': { fishId: 4506, map: 27, ticketId: 4876 },
    'he': { fishId: 4506, map: 27, ticketId: 4876 },
    'ca vang': { fishId: 4507, map: 27, ticketId: 4876 },
```

- [x] **Step 3: Kiểm tra resolve target bằng node script**

Run:
```bash
node --import tsx/esm -e '
import { resolveFishQuestTarget } from "./avatar-web/server/src/session/fishermanQuest.js";
console.log("lia thia:", resolveFishQuestTarget("Thu hoạch 5 con cá lia thia - 0/5"));
console.log("ca chep:", resolveFishQuestTarget("Thu hoạch 3 con cá chép - 0/3"));
console.log("chep vang:", resolveFishQuestTarget("Thu hoạch 5 con cá chép vàng - 0/5"));
console.log("ca he:", resolveFishQuestTarget("Thu hoạch 5 con cá hề - 0/5"));
console.log("ca vang:", resolveFishQuestTarget("Thu hoạch 5 con cá vàng - 0/5"));
'
```
Expected:
- `lia thia`: `map: 27, fishId: 4504, ticketId: 4876`
- `ca chep`: `map: 27, fishId: 4505, ticketId: 4876`
- `chep vang`: `map: 14, fishId: 450, ticketId: 458` (vẫn đúng Map 14)
- `ca he`: `map: 27, fishId: 4506, ticketId: 4876`
- `ca vang`: `map: 27, fishId: 4507, ticketId: 4876`

---

### Task 2: Cập Nhật Log Vé Map 27 Trong `avatarSession.ts`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:2457-2459`

**Interfaces:**
- Consumes: `resolved.map`
- Produces: Log rõ ràng khi câu nhiệm vụ tại Bến Tàu

- [x] **Step 1: Bổ sung log vé bến tàu trong `avatarSession.ts`**

Tại dòng 2457, sau dòng:
```typescript
if (resolved.map === 16) this.pushLog('[thợ câu] map 16 dùng vé Lượng (2 Lượng/vé 460).');
```
Thêm:
```typescript
if (resolved.map === 27) this.pushLog('[thợ câu] map 27 dùng vé bến tàu (12.000 xu/vé 4876).');
```

- [x] **Step 2: Typecheck server**

Run: `npm --prefix avatar-web/server run typecheck`
Expected: Exit code 0, không có lỗi.

---

### Task 3: GitNexus Verification & Commit

**Files:**
- Modify: `avatar-web/server/src/session/fishermanQuest.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

- [x] **Step 1: Chạy GitNexus `detect_changes`**

Gọi `detect_changes({scope: "all"})`
Expected: Chỉ ảnh hưởng các symbol liên quan.

- [x] **Step 2: Commit thay đổi**

```bash
git add avatar-web/server/src/session/fishermanQuest.ts avatar-web/server/src/session/avatarSession.ts docs/superpowers/specs/2026-09-15-map-pier-fish-to-fisherman-quest-design.md docs/superpowers/plans/2026-09-15-map-pier-fish-to-fisherman-quest.md
git commit -m "feat(fisherman-quest): map pier fish species to Map 27 quest targets"
```
