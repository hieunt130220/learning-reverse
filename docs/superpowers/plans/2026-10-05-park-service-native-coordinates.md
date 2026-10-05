# ParkService Native Coordinates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung toạ độ native đã xác minh cho các map 2, 6, 8, 10, 11, 12 vào `NATIVE_PARK_JOIN_POSITIONS` trong `parkService.ts`.

**Architecture:** Mở rộng bảng tra cứu `NATIVE_PARK_JOIN_POSITIONS` trong `avatar-web/server/src/game/parkService.ts` với các cặp `(x, y)` native chính xác từ TextAsset `CityMap` và logic fast-travel J2ME, giúp `ParkService.doJoinPark` hỗ trợ đầy đủ các phân khu công viên mà không throw runtime error.

**Tech Stack:** TypeScript, Node.js, GitNexus.

**Spec:** `docs/superpowers/specs/2026-10-05-park-service-native-coordinates-design.md`

## Global Constraints

- Tuân thủ quy tắc KHÔNG TDD theo `CLAUDE.md`: Không tạo file test mới, chỉ verify typecheck và run test suite hiện có.
- Tuân thủ GitNexus: Chạy `impact` trước khi sửa file, chạy `detect_changes` trước khi commit.

---

### Task 1: Bổ sung toạ độ native cho map 2, 6, 8, 10, 11, 12

**Files:**
- Modify: `avatar-web/server/src/game/parkService.ts:87-104`

**Interfaces:**
- Consumes: Toạ độ native từ Spec `docs/superpowers/specs/2026-10-05-park-service-native-coordinates-design.md`.
- Produces: `NATIVE_PARK_JOIN_POSITIONS` hoàn chỉnh chứa các key `2`, `6`, `8`, `10`, `11`, `12`.

- [x] **Step 1: Chạy GitNexus impact analysis**
Run: `mcp__gitnexus__impact({target: "NATIVE_PARK_JOIN_POSITIONS", direction: "upstream"})`
Expected: Kiểm tra các caller và blast radius trước khi sửa.

- [x] **Step 2: Cập nhật `NATIVE_PARK_JOIN_POSITIONS` trong `avatar-web/server/src/game/parkService.ts`**
Thay thế đoạn khai báo `NATIVE_PARK_JOIN_POSITIONS` bằng:
```typescript
export const NATIVE_PARK_JOIN_POSITIONS: Readonly<Record<number, NativeParkJoinPosition>> =
  Object.freeze({
    0: Object.freeze({ x: 254, y: 82 }), // Công viên trung tâm (LoadMap.T_PARK = 0)
    1: Object.freeze({ x: 473, y: 100 }),
    2: Object.freeze({ x: 168, y: 157 }), // Khu đấu giá cũ (LoadMap.T_PARK_2 = 2)
    3: Object.freeze({ x: 236, y: 280 }),
    4: Object.freeze({ x: 452, y: 250 }),
    5: Object.freeze({ x: 254, y: 82 }),
    6: Object.freeze({ x: 264, y: 157 }), // Khu cô giáo (LoadMap.T_PARK_6 = 6)
    7: Object.freeze({ x: 524, y: 423 }),
    8: Object.freeze({ x: 264, y: 157 }), // Khu 4 con vịt (LoadMap.T_PARK_8 = 8)
    9: Object.freeze({ x: 236, y: 280 }),
    10: Object.freeze({ x: 336, y: 181 }), // Cổng sảnh cưới / Lễ đường (LoadMap.T_CONG_SANH_CUOI = 10)
    11: Object.freeze({ x: 254, y: 82 }),  // Công viên (LoadMap.T_PARK_PATH = 11 / CityMap node 5)
    12: Object.freeze({ x: 594, y: 156 }), // Công viên mở rộng / Khu trống (LoadMap.T_PARK_ADVANCED = 12)
    13: Object.freeze({ x: 364, y: 64 }),
    14: Object.freeze({ x: 460, y: 97 }),
    15: Object.freeze({ x: 36, y: 97 }),
    16: Object.freeze({ x: 324, y: 157 }),
    17: Object.freeze({ x: 100, y: 100 }),
    27: Object.freeze({ x: 254, y: 82 }),
    28: Object.freeze({ x: 57, y: 209 }),
  });
```

- [x] **Step 3: Kiểm tra Typecheck và Test suite hiện tại**
Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run test`
Expected: 0 errors, all existing tests pass.

- [x] **Step 4: Chạy GitNexus detect_changes**
Run: `mcp__gitnexus__detect_changes({scope: "all"})`
Expected: Chỉ duy nhất `parkService.ts` thay đổi trong source code.

- [x] **Step 5: Commit thay đổi**
Run: `git commit -m "feat(park): add native join coordinates for maps 2, 6, 8, 10, 11, 12"`
Expected: Commit thành công với attribution.
