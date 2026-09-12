# Đăng xuất tài khoản game khi bấm Dừng tự động Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ngắt kết nối và gửi lệnh logout tài khoản game khi người dùng bấm dừng tự động (automation stop).

**Architecture:** Bổ sung lời gọi `this.stop()` vào cuối hàm `AvatarSession.stopAutomation()` sau khi đã dừng các runner automation. Việc này kích hoạt chu trình teardown sạch sẽ (`client.logout()`, `client.close()`, hủy các timer chu kỳ/retry, đưa `status` về `'idle'`). Cập nhật unit test tương ứng trong `avatarSession.test.ts` để xác nhận hành vi mới.

**Tech Stack:** TypeScript, Node.js, WebSocket, EventEmitter, Node Test Runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-09-09-logout-on-stop-automation-design.md`

## Global Constraints
- Không áp dụng TDD (không viết test trước; code production trước rồi cập nhật/chạy test verify sau theo CLAUDE.md).
- Không phá vỡ giao thức socket hoặc làm rò rỉ listener: `this.stop()` tự động giải phóng listener và đóng socket an toàn.
- Đảm bảo tính idempotent: `this.stop()` có thể được gọi an toàn ngay cả khi client đã offline trước đó.
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_detect_changes()` trước khi commit.

---

### Task 1: Ngắt kết nối game trong `AvatarSession.stopAutomation()`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:438-446`

**Interfaces:**
- Consumes: `this.switchAutomationMode(...)`, `this.stop()` trong `AvatarSession`.
- Produces: `stopAutomation(): Promise<void>` ngắt kết nối game sau khi chuyển mode về `off`.

- [x] **Step 1: Thêm `this.stop()` vào `AvatarSession.stopAutomation()`**

Trong [avatar-web/server/src/session/avatarSession.ts](avatar-web/server/src/session/avatarSession.ts):
```ts
  async stopAutomation(): Promise<void> {
    await this.switchAutomationMode({
      desiredMode: 'off',
      findNpcConfig: this.findNpcConfig,
      fishingConfig: this.fishingConfig,
      location: this.automationLocation,
    });
    this.stop();
  }
```

- [x] **Step 2: Kiểm tra test suite phát hiện đúng sự thay đổi hành vi**

Run: `node --import tsx --test "avatar-web/server/src/session/avatarSession.test.ts"`
Expected: Test case cũ `stopAutomation tắt desiredConnected nhưng giữ kết nối game` bị FAIL vì status hiện tại là `'idle'` thay vì `'online'`.

- [x] **Step 3: Kiểm tra GitNexus trước khi commit**

Run: `gitnexus_detect_changes({scope: "unstaged"})`
Expected: Chỉ thay đổi symbol `AvatarSession.stopAutomation` trong file `avatar-web/server/src/session/avatarSession.ts`.

- [x] **Step 4: Commit thay đổi production code**

```bash
git add avatar-web/server/src/session/avatarSession.ts
git commit -m "feat(server): logout game account when stopping automation"
```

---

### Task 2: Cập nhật unit test trong `avatarSession.test.ts` & chạy toàn diện kiểm thử

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.test.ts:279-290`

**Interfaces:**
- Consumes: `harness` từ `avatarSession.test.ts`, `h.session.stopAutomation()`.
- Produces: Test case xác thực `status === 'idle'`, `desiredConnected === false` và `clients[0].closed === true`.

- [x] **Step 1: Cập nhật test case trong `avatarSession.test.ts`**

Sửa test case tại dòng 279-290 trong [avatar-web/server/src/session/avatarSession.test.ts](avatar-web/server/src/session/avatarSession.test.ts):
```ts
test('stopAutomation tắt desiredConnected và ngắt kết nối game (logout)', async () => {
  const h = harness({ autoConfig: { intervalMs: 321 } });
  await h.session.startAuto({ intervalMs: 321 });
  assert.equal(h.session.snapshot().desiredConnected, true);
  assert.equal(h.session.status, 'online');

  await h.session.stopAutomation();

  assert.equal(h.session.snapshot().desiredConnected, false);
  assert.equal(h.session.snapshot().automation?.desiredMode, 'off');
  assert.equal(h.session.status, 'idle', 'dừng automation phải ngắt kết nối game');
  assert.equal(h.clients[0].logoutCount, 1, 'client phải được gọi logout');
});
```

- [x] **Step 2: Chạy toàn bộ server test suite**

Run: `npm --prefix avatar-web/server test`
Expected: Tất cả 274 tests đều PASS, 0 fail.

- [x] **Step 3: Chạy web test suite để đảm bảo tính tương thích UI**

Run: `npm --prefix avatar-web/web test`
Expected: Tất cả 75 tests đều PASS, 0 fail.

- [x] **Step 4: Kiểm tra GitNexus trước khi commit**

Run: `gitnexus_detect_changes({scope: "unstaged"})`
Expected: Chỉ thay đổi file `avatar-web/server/src/session/avatarSession.test.ts`.

- [x] **Step 5: Commit cập nhật test**

```bash
git add avatar-web/server/src/session/avatarSession.test.ts
git commit -m "test(server): verify game account disconnect on stopAutomation"
```
