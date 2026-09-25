# Chest Password Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm cấu hình truyền mật khẩu rương qua CLI argument và biến môi trường cho `chest-probe.ts` và `use-item-probe.ts`, hỗ trợ mở rương có mật khẩu để kiểm tra thông tin vật phẩm theo chuẩn wire protocol game Avatar.

**Architecture:** Sử dụng opcode `-87` (`CUSTOM_CHEST`) với subCmd `8` và subCmd2 `0`, đóng gói `writeUTF("")` (mật khẩu hành trang) và `writeUTF(chestPass)` (mật khẩu rương) theo hàm `GlobalService.doSendPassOpenChest` giải mã từ `libil2cpp.so`. Khi server yêu cầu mật khẩu (`subCmd2 === 3`), probe tự động gửi mật khẩu được cấu hình để mở rương và in danh sách vật phẩm.

**Tech Stack:** TypeScript, Node.js (tsx), SQLite, binary socket messaging (`Message`, `MyReader`).

**Spec:** `docs/superpowers/specs/2026-09-25-chest-password-probe-design.md`

## Global Constraints
- Tuân thủ quy định **KHÔNG TDD** của dự án (không viết unit test file, tập trung vào code production và manual/type verification).
- Phải chạy kiểm tra tác động bằng GitNexus trước khi sửa và kiểm tra thay đổi trước khi commit.
- Kết thúc commit message bằng:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: Cập nhật `chest-probe.ts` hỗ trợ cấu hình mật khẩu rương

**Files:**
- Modify: `avatar-web/server/src/tools/chest-probe.ts:40-265`

**Interfaces:**
- Consumes: `process.argv[3]`, `process.env.CHEST_PASS`, `Message.create(-87)`, `MyReader`
- Produces: Hàm `sendChestPass(pass: string)` và xử lý phản hồi `subCmd2 === 3`, `subCmd2 === 4`, `subCmd2 === 0` có mật khẩu

- [ ] **Step 1: Khai báo nhận tham số `chestPass` và hàm `sendChestPass`**
Cập nhật `avatar-web/server/src/tools/chest-probe.ts`:
```ts
const chestPass = (process.argv[3] ?? process.env.CHEST_PASS ?? '').trim();

function sendChestPass(pass: string) {
  console.log(`>>> [TX -87] Gửi mật khẩu rương "${pass ? '******' : '(trống)'}" (subCmd=8, subCmd2=0)...`);
  const msg = Message.create(-87);
  msg.writer!.writeByte(8);
  msg.writer!.writeByte(0);
  msg.writer!.writeUTF('');
  msg.writer!.writeUTF(pass);
  client.session.send(msg);
}
```

- [ ] **Step 2: Cập nhật xử lý sự kiện RX -87 cho `subCmd2 === 3` và `subCmd2 === 4`**
Trong handler `msg.command === -87`:
```ts
} else if (subCmd2 === 3) {
  console.log(`  🔒 RƯƠNG ĐÃ ĐƯỢC CÀI MẬT KHẨU!`);
  if (chestPass) {
    sendChestPass(chestPass);
  } else {
    console.log(`  ⚠️ Chưa cấu hình mật khẩu rương. Hãy truyền tham số: npx tsx --env-file=.env src/tools/chest-probe.ts ${accountId} <mat_khau_ruong>`);
  }
} else if (subCmd2 === 4) {
  const flag = r.readByte();
  let msgText = '';
  if (flag === 1) {
    msgText = r.readUTF();
  }
  console.log(`  ⚠️ Phản hồi từ rương (subCmd2=4): flag=${flag} msg="${msgText}"`);
  if (flag === 0 || msgText.toLowerCase().includes('mật khẩu')) {
    console.log(`  ❌ Mật khẩu rương không chính xác!`);
  }
}
```

- [ ] **Step 3: Cập nhật bước gửi `reqChestItems` ban đầu**
Thay thế đoạn gửi `reqChestItems` rỗng:
```ts
if (chestPass) {
  sendChestPass(chestPass);
} else {
  console.log('>>> [TX -87] Gửi yêu cầu mở danh sách item trong rương đồ (subCmd=8, subCmd2=0)...');
  const reqChestItems = Message.create(-87);
  reqChestItems.writer!.writeByte(8);
  reqChestItems.writer!.writeByte(0);
  client.session.send(reqChestItems);
}
```

- [ ] **Step 4: Kiểm tra biên dịch**
Run: `npm run build` trong `avatar-web/server`
Expected: Biên dịch thành công, không phát sinh lỗi TypeScript.

- [ ] **Step 5: Commit**
```bash
git add avatar-web/server/src/tools/chest-probe.ts
git commit -m "feat(probe): add chest password support to chest-probe

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cập nhật `use-item-probe.ts` hỗ trợ cấu hình mật khẩu rương và mở rương kiểm tra

**Files:**
- Modify: `avatar-web/server/src/tools/use-item-probe.ts:20-160`

**Interfaces:**
- Consumes: `process.argv[5]`, `process.env.CHEST_PASS`, `Message.create(-87)`
- Produces: Mở rương kiểm tra trước khi sử dụng item

- [ ] **Step 1: Khai báo nhận tham số `chestPass`**
Cập nhật `avatar-web/server/src/tools/use-item-probe.ts`:
```ts
const chestPass = (process.argv[5] ?? process.env.CHEST_PASS ?? '').trim();

function sendChestPass(pass: string) {
  console.log(`>>> [TX -87] Gửi mật khẩu rương để kiểm tra (subCmd=8, subCmd2=0)...`);
  const msg = Message.create(-87);
  msg.writer!.writeByte(8);
  msg.writer!.writeByte(0);
  msg.writer!.writeUTF('');
  msg.writer!.writeUTF(pass);
  client.session.send(msg);
}
```

- [ ] **Step 2: Thêm listener xử lý `msg.command === -87` (`CUSTOM_CHEST`)**
Bổ sung vào `client.session.on('message', ...)`:
```ts
if (msg.command === -87) {
  try {
    const r = new MyReader(data);
    const subCmd = r.readByte();
    if (subCmd === 8) {
      const subCmd2 = r.readByte();
      if (subCmd2 === 0) {
        const countBox = r.readShort();
        console.log(`\n  --- 📦 KIỂM TRA RƯƠNG ĐỒ (count: ${countBox}) ---`);
        for (let i = 0; i < countBox; i++) {
          const index = r.readShort();
          const id = r.readShort();
          const date = r.readUTF();
          const info = resolvePartInfo(id);
          console.log(`    [Slot ${String(index).padStart(2, ' ')}] ID: ${String(id).padStart(4, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Hạn: "${date}"`);
        }
        const countInven = r.readShort();
        for (let i = 0; i < countInven; i++) {
          r.readShort(); // index
          r.readShort(); // id
          r.readUTF();   // date
        }
        r.readShort(); // discarded
        const slot = r.readShort();
        const maxSlot = r.readShort();
        console.log(`  --- ℹ️ Ô rương: ${slot}/${maxSlot} ---\n`);
      } else if (subCmd2 === 3) {
        console.log(`  🔒 Rương có mật khẩu.`);
        if (chestPass) {
          sendChestPass(chestPass);
        } else {
          console.log(`  ℹ️ Không truyền chestPass, bỏ qua mở rương kiểm tra.`);
        }
      } else if (subCmd2 === 4) {
        const flag = r.readByte();
        let msgText = '';
        if (flag === 1) msgText = r.readUTF();
        console.log(`  ⚠️ Phản hồi rương: flag=${flag} msg="${msgText}"`);
      }
    }
  } catch (err) {
    console.error('  Lỗi giải mã CUSTOM_CHEST trong use-item-probe:', err);
  }
}
```

- [ ] **Step 3: Bổ sung bước yêu cầu kiểm tra rương trước khi đọc `CONTAINER`**
Sau khi login xong (sau `await sleep(3000)`):
```ts
console.log('>>> [TX -87] Gửi yêu cầu kiểm tra rương đồ (subCmd=8, subCmd2=3)...');
const reqChestInfo = Message.create(-87);
reqChestInfo.writer!.writeByte(8);
reqChestInfo.writer!.writeByte(3);
client.session.send(reqChestInfo);

await sleep(2000);
```

- [ ] **Step 4: Kiểm tra biên dịch**
Run: `npm run build` trong `avatar-web/server`
Expected: Biên dịch thành công, không phát sinh lỗi TypeScript.

- [ ] **Step 5: Commit**
```bash
git add avatar-web/server/src/tools/use-item-probe.ts
git commit -m "feat(probe): add chest password support and chest inspection to use-item-probe

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Toàn bộ kiểm tra & hoàn thiện (Verification & Polish)

**Files:**
- Readonly verification: `avatar-web/server/src/tools/chest-probe.ts`, `avatar-web/server/src/tools/use-item-probe.ts`

- [ ] **Step 1: Chạy build toàn dự án**
Run: `npm run build` trong `avatar-web/server`
Expected: Build thành công không có warning/error.

- [ ] **Step 2: Chạy git status và git diff kiểm tra tính toàn vẹn**
Run: `git status`
Expected: Working tree clean sau khi các commit đã được hoàn thành.
