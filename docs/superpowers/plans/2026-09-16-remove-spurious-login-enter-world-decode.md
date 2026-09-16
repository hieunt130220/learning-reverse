# Loại bỏ lệnh parse `decodeEnterWorld` ở case -34 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ bỏ lệnh gọi `decodeEnterWorld` trên gói `cmd -34` (LOGIN_SUCESS) trong `client.ts` để loại bỏ dòng lỗi `decode enter-world lỗi tại players@30`.

**Architecture:** Gỡ bỏ khối `try/catch` gọi `decodeEnterWorld` trong `case -34` của `GameClient.onMessage`. Đánh dấu `@deprecated` hàm `decodeEnterWorld` trong `worldData.ts`. Gói map thế giới thật sự (cmd 80) tiếp tục dùng `decodeParkJoinWorld`.

**Tech Stack:** TypeScript, Node.js.

**Spec:** `docs/superpowers/specs/2026-09-16-remove-spurious-login-enter-world-decode-design.md`

## Global Constraints

- Không TDD, không tạo test file mới. Chạy test suite sẵn có sau khi sửa.
- Giữ nguyên toàn bộ logic đăng nhập, xử lý số dư ví (`decodeLoginSuccessMoney`) và luồng map cmd 80 (`decodeParkJoinWorld`).
- Chạy `gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit.

---

### Task 1: Gỡ bỏ `decodeEnterWorld` trong `client.ts` và deprecate trong `worldData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:70-76, 1115-1127`
- Modify: `avatar-web/server/src/game/worldData.ts:130-135`

**Interfaces:**
- Consumes: `msg.getData()`, `decodeLoginSuccessMoney`, `requestYourInfo`
- Produces: `GameClient` đăng nhập thành công sạch sẽ, không còn lỗi `decode enter-world lỗi tại players@30`

- [x] **Step 1: Impact analysis `decodeEnterWorld` và `onMessage`.**
Run:
```bash
gitnexus_impact({target: "decodeEnterWorld", direction: "upstream", repo: "learning-reverse"})
```

- [x] **Step 2: Sửa `client.ts` và `worldData.ts`.**
Trong `client.ts`:
- Bỏ import `decodeEnterWorld`.
- Xoá khối gọi `decodeEnterWorld`:
```ts
<<<<
            // Decoder chạy trên body độc lập; lỗi decode KHÔNG được ảnh hưởng status online.
            try {
              const snap = decodeEnterWorld(msg.getData());
              this.emit('world-snapshot', snap);
            } catch (err) {
              const section = (err as { section?: string }).section ?? '?';
              const offset = (err as { offset?: number }).offset ?? -1;
              this.emit('log', `decode enter-world lỗi tại ${section}@${offset}: ${(err as Error).message}`);
              this.emit('world-snapshot-error', err);
            }
====
>>>>
```

Trong `worldData.ts`:
Thêm comment JSDoc `@deprecated` cho `decodeEnterWorld`.

- [x] **Step 3: Verify toàn diện & Commit.**
Run:
```bash
cd avatar-web/server && npm run typecheck && node --import tsx --test src/game/client.test.ts src/game/worldData.test.ts src/game/farmData.test.ts
```
Expected: Typecheck sạch, tests pass.
Run: `gitnexus_detect_changes({scope: "staged"})`.
Commit: `git commit -m "fix(game): remove invalid enter-world decode call on login success packet"`
