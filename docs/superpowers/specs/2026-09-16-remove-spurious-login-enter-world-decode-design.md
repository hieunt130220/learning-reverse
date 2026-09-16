# Loại bỏ lệnh parse `decodeEnterWorld` không hợp lệ trên gói LOGIN_SUCESS (cmd -34)

## Mục tiêu & Bối cảnh

### Bối cảnh
Khi tài khoản đăng nhập vào server Avatar, server gửi gói `cmd -34` (`LOGIN_SUCESS`). Giao diện nhật ký server liên tục xuất hiện dòng lỗi:
```text
decode enter-world lỗi tại players@30: players@30: cần 327 byte nhưng chỉ còn 237
```

### Nguyên nhân kỹ thuật
- Gói `cmd -34` là gói phản hồi thông tin tài khoản đăng nhập (flag, playerId, username, danh sách trang phục `SeriPart[]` có hạn sử dụng UTF, và số dư ví).
- Phân tích ARM64 disassembly tại `GlobalMessageHandler.onMessage @0x5E6980` cho thấy `cmd -34` không chứa danh sách người chơi hay bản đồ map.
- Gói map/thế giới thật sự là `cmd 80` (`AVATAR_JOIN_PARK`), đã được giải mã chính xác bằng `decodeParkJoinWorld` trong [client.ts:1148](avatar-web/server/src/game/client.ts#L1148).
- Tại [client.ts:1117-1125](avatar-web/server/src/game/client.ts#L1117-L1125), `client.ts` cố tình gọi `decodeEnterWorld(msg.getData())` trên `cmd -34`, dẫn đến việc đọc nhầm mảng `SeriPart[]` thành `nPlayer`, gây tràn độ dài UTF tại offset 30 và phát sinh lỗi vô nghĩa trong log.

---

## Phạm vi (Scope)

### In-scope
1. **`avatar-web/server/src/game/client.ts`**:
   - Loại bỏ khối `try/catch` gọi `decodeEnterWorld` trong `case -34`.
   - Gỡ bỏ import `decodeEnterWorld` không còn dùng trong `client.ts`.
2. **`avatar-web/server/src/game/worldData.ts`**:
   - Đánh dấu `@deprecated` trên `decodeEnterWorld` để làm rõ rằng các luồng map chuẩn đều dùng `decodeParkJoinWorld` (cmd 80).

### Out-of-scope
- Không can thiệp `decodeLoginSuccessMoney`, `decodeParkJoinWorld`, hay các sự kiện `money`, `login`, `status`.
- Không thay đổi hành vi của `waitForWorldSnapshot` (vẫn nhận `world-snapshot` từ cmd 80 bình thường).

---

## Thiết kế chi tiết

### Sửa đổi tại `case -34` trong `client.ts`
```typescript
      case -34: {
        // LOGIN_SUCESS
        try {
          const r = new MyReader(msg.getData());
          const isOK = r.readByte();
          const id = r.readInt();
          if (id > 0) {
            this.id = id;
            this.status = 'online';
            this.emit('status', this.status);
            this.emit('login', id);
            this.emit('log', `đăng nhập thành công (id = ${id}, flag = ${isOK})`);
            const wallet = decodeLoginSuccessMoney(msg.getData());
            if (wallet) {
              this.emit('money', {
                xu: wallet.xu,
                luong: wallet.luong,
                luongKhoa: wallet.luongKhoa,
              });
              this.emit(
                'log',
                `số dư login: xu=${wallet.xu} · lượng=${wallet.luong} · lượng khoá=${wallet.luongKhoa}`,
              );
            } else {
              this.emit('log', 'LOGIN_SUCESS không giải mã được số dư ví');
            }
            this.requestYourInfo(id);
          } else {
            this.emit('log', `đăng nhập không thành công (id = ${id})`);
          }
        } catch {
          this.emit('log', `LOGIN_SUCESS body lạ: ${msg.getData().toString('hex')}`);
        }
        break;
      }
```

---

## Verification Plan

1. **Typecheck & Tests**:
   ```bash
   cd avatar-web/server && npm run typecheck
   node --import tsx --test src/game/client.test.ts src/game/worldData.test.ts src/game/farmData.test.ts
   ```
2. **Kiểm tra nhật ký khi đăng nhập**:
   - Khi nhận `LOGIN_SUCESS`, in rõ số dư ví mà không còn dòng lỗi `decode enter-world lỗi tại players@30`.
