# Sync Lượng & Lượng Khoá Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động truy vấn và giải mã thông tin tài khoản đầy đủ (Xu, Lượng mở, Lượng khoá, Level) qua gói `-8` từ game server để hiển thị chính xác số dư `0 lượng` và `337 lượng khoá` trên Web UI.

**Architecture:** Mở rộng decoder giao thức game để hỗ trợ gói `-8` (`PLAYER_PROFILE`), thêm hàm `requestPlayerProfile` trong `GameClient` để gửi yêu cầu lấy thông tin người chơi khi đăng nhập thành công (`LOGIN_SUCESS -34`) và khi refresh farm. Khi nhận phản hồi `-8`, `GameClient` cập nhật `money`, `playerLevel`, `luong`, `luongKhoa` và phát event `metrics` để `AvatarSession` lưu vào SQLite và phát WebSocket về UI.

**Tech Stack:** TypeScript, Node.js, SQLite (better-sqlite3), React, WebSocket.

**Spec:** `docs/superpowers/specs/2026-08-18-sync-luong-khoa-profile-design.md`

## Global Constraints
- Tuân thủ quy tắc Superpowers và AGENTS.md (No TDD: không viết test trước code, không tạo file test mới trừ khi được yêu cầu).
- Không phá vỡ các trường và giao thức hiện có.
- Xử lý an toàn với `available()` khi đọc gói nhị phân tránh `Buffer overflow` nếu server trả về payload ngắn hơn.

---

### Task 1: Thêm `decodePlayerProfile` vào `farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts`

**Interfaces:**
- Consumes: `MyReader`
- Produces: `DecodedPlayerProfile`, `decodePlayerProfile(body: Buffer): DecodedPlayerProfile | null`

- [x] **Step 1: Viết interface và hàm `decodePlayerProfile` trong `farmData.ts`**
```ts
export interface DecodedPlayerProfile {
  id: number;
  name: string;
  xu: number;
  playerLevel: number;
  luong: number;
  luongKhoa: number;
  exp: number;
}

/**
 * Giải mã gói thông tin hồ sơ nhân vật (cmd -8 PLAYER_PROFILE):
 * Gửi bởi server sau khi client gọi GlobalService.requestInfoOf(playerId).
 * Thứ tự byte @0x5ec02c: i32 id, utf name, i32 xu, i16 playerLevel, i32 luong, i32 luongKhoa, i32 exp, ...
 */
export function decodePlayerProfile(body: Buffer): DecodedPlayerProfile | null {
  const r = new MyReader(body);
  const id = r.readInt();
  if (id <= 0) return null;
  const name = r.readUTF();
  const xu = r.available() >= 4 ? r.readInt() : 0;
  const playerLevel = r.available() >= 2 ? r.readShort() : 0;
  const luong = r.available() >= 4 ? r.readInt() : 0;
  const luongKhoa = r.available() >= 4 ? r.readInt() : 0;
  const exp = r.available() >= 4 ? r.readInt() : 0;
  return { id, name, xu, playerLevel, luong, luongKhoa, exp };
}
```

- [x] **Step 2: Export `DecodedPlayerProfile` và `decodePlayerProfile`**

---

### Task 2: Cập nhật `GameClient` (`client.ts`) và `AvatarSession` (`avatarSession.ts`)

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `decodePlayerProfile`, `Message`, `AvatarSession`
- Produces: `requestPlayerProfile(idUser?: number)`, handler `case -8:` trong `onMessage`, auto-sync trong `refreshFarmProfile`

- [x] **Step 1: Thêm phương thức `requestPlayerProfile` vào `GameClient`**
```ts
  requestPlayerProfile(idUser?: number): void {
    const target = idUser ?? this.playerId;
    if (target === undefined) throw new Error('chưa có playerId, không gửi được requestPlayerProfile');
    const m = Message.create(-8);
    m.writer!.writeInt(target);
    this.session.send(m);
  }
```

- [x] **Step 2: Thêm `case -8:` vào `switch (msg.command)` trong `onMessage`**
```ts
      case -8: {
        // PLAYER_PROFILE — thông tin hồ sơ nhân vật đầy đủ (xu, level, luong, luongKhoa)
        try {
          const profile = decodePlayerProfile(msg.getData());
          if (profile && (this.playerId === undefined || profile.id === this.playerId)) {
            if (profile.xu >= 0) this.money = profile.xu;
            if (profile.playerLevel >= 0) this.playerLevel = profile.playerLevel;
            if (profile.luong >= 0) this.luong = profile.luong;
            if (profile.luongKhoa >= 0) this.luongKhoa = profile.luongKhoa;
            this.emit('metrics', {
              xu: profile.xu,
              luong: profile.luong,
              luongKhoa: profile.luongKhoa,
              playerLevel: profile.playerLevel,
            });
            this.emit(
              'log',
              `thông tin người chơi: ${profile.name} (id=${profile.id}) · level=${profile.playerLevel} · xu=${profile.xu} · lượng=${profile.luong} · lượng khoá=${profile.luongKhoa}`,
            );
          }
        } catch (err) {
          this.emit('log', `giải mã thông tin người chơi lỗi: ${(err as Error).message}`);
        }
        break;
      }
```

- [x] **Step 3: Kích hoạt `requestPlayerProfile(id)` khi đăng nhập thành công (`case -34`) và khi refresh farm profile**

---

### Task 3: Xác minh & Kiểm thử (Verification & Build)

**Files:**
- Modify: Không tạo file mới

- [x] **Step 1: Chạy test suite hiện tại của server**
Run: `npm --prefix avatar-web/server test`
Expected: Toàn bộ unit tests logic pass.

- [x] **Step 2: Kiểm tra build TypeScript của server và web**
Run: `npm --prefix avatar-web/server run build`
Run: `npm --prefix avatar-web/web run build`
Expected: Build thành công không có lỗi kiểu (0 errors).
