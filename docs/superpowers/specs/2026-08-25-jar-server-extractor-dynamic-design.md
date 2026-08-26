# Spec: jarServerExtractor — Resolve server game của avatar-auto.jar từ kênh động

**Ngày:** 2026-08-25
**Vấn đề liên quan:** `captcha-collector.ts` đang nối vào sai server (27.0.14.120:19129 — server của APK AvatarHD) thay vì server thật mà `avatar-auto.jar` sử dụng.

---

## 1. Mục tiêu & Bối cảnh

### Vấn đề
`avatar-web/server/src/game/jarServerExtractor.ts` hiện **hardcode** `27.0.14.120:19129` và claim sai trong comment rằng endpoint này "đã được reverse từ bytecode bx.class/aC.class".

Sự thật đã xác minh ngày 2026-08-25:
- Bytecode thật (`bx.java:704`) build `"socket://<host>:<port>"` từ mảng server list **tải động lúc runtime**, không hardcode trong jar.
- Payload config live tại `http://chip.vcdn.io.vn/avatar/full/` (XOR key `NguyenHuuQuyet`, format DataInputStream) trả về:
  - Group **"Xứ Sở Diệu Kỳ"** → server **"Thành Phố Hoàn Mỹ" — host `112.213.85.102`, port `19128`**
- `27.0.14.x:19129` là hệ máy chủ riêng của **APK AvatarHD** — một world khác, DB nhân vật riêng biệt.

### Hệ quả hiện tại
Chạy `captcha-collector.ts` không truyền `--host/--port` sẽ đăng nhập nhầm sang server APK → tài khoản hệ JAR không dùng được / sai dữ liệu.

### Mục tiêu
`jarServerExtractor` phải resolve endpoint **đúng theo cơ chế của jar**: đọc base URL config từ resource `normal/lg.png` bên trong jar → fetch payload động → giải mã → parse server list → trả về endpoint.

---

## 2. Phạm vi

### In-scope
1. Viết lại `jarServerExtractor.ts`:
   - Đọc entry `normal/lg.png` từ file jar (parse ZIP central directory thủ công + `zlib.inflateRawSync` — **không thêm dependency mới**).
   - Giải mã lg.png: XOR key `NguyenHuuQuyet`, format bảng resource br_0 (`count`, lặp `[nameLen byte, name(XOR), u16 dataLen]…`, blob XOR cuối file) → lấy entry `u.png`.
   - `u.png` là Base64 text dạng `0=...|1=...|2=<base-url>|3=...|4=...` → lấy giá trị key `2` làm config URL.
   - HTTP GET config URL (global `fetch`, timeout 10s) → XOR giải mã payload → parse DataInputStream:
     - `byte case` (chỉ xử lý `case = 1`)
     - `readUTF × 3` (bỏ qua nội dung)
     - `byte groupCount`; mỗi group: `byte serverCount`, `readUTF groupName`; mỗi server: `readUTF name`, `readUTF host`, `readInt port`
   - Trả về endpoint của server đầu tiên trong group đầu tiên.
   - Cache kết quả thành công ra đĩa (`server/data/jar-server-cache.json`, kèm `fetchedAt`); khi fetch lỗi nhưng cache còn tươi (< 24h) → dùng cache; hết hạn/không có cache → throw error tiếng Việt rõ ràng, hướng dẫn truyền `--host/--port`.
2. Cập nhật caller `captcha-collector.ts`:
   - `await` API mới; xoá import `DEFAULT_GAME_SERVER` không dùng (line 18).
   - Giữ nguyên ưu tiên: `--host/--port` CLI > dynamic resolve.
3. Xoá comment sai ("reverse từ bx.class/aC.class là 27.0.14.120:19129") thay bằng mô tả đúng cơ chế.

### Out-of-scope
- Không đổi `DEFAULT_GAME_SERVER` trong `config.ts` (vẫn đúng cho thế giới APK mà `accounts/repo.ts` dùng).
- Không đổi logic login/protocol của `GameClient`.
- Không thêm test mới (user không yêu cầu).
- Không thêm npm dependency.
- Không chọn server theo tên group/tên server (luôn lấy phần tử đầu; mở rộng sau nếu cần).

### Input / Output
- **Input:** đường dẫn jar tuỳ chọn (`--jar`), mặc định tự tìm `avatar-jar/avatar-auto.jar` như cũ.
- **Output:** `{ host: string, port: number, source: string }` — `source` mô tả nguồn thật, ví dụ `dynamic config (chip.vcdn.io.vn) → Xứ Sở Diệu Kỳ / Thành Phố Hoàn Mỹ`.

### Edge cases phải xử lý
| Trường hợp | Hành vi |
|---|---|
| Không tìm thấy jar | Bỏ qua bước đọc base URL, dùng fallback URL hardcoded `http://chip.vcdn.io.vn/avatar/full/` |
| lg.png/u.png hỏng hoặc thiếu | Như trên |
| Fetch timeout / lỗi mạng | Dùng cache < 24h; không có cache hợp lệ → throw error có hướng dẫn |
| `case != 1` hoặc parse lệch format | Coi như payload lỗi → nhánh cache/throw như trên |
| Group rỗng / host rỗng | Bỏ qua group đó; không còn group hợp lệ → throw |

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files liên quan
| File | Vai trò | Hành động |
|---|---|---|
| `avatar-web/server/src/game/jarServerExtractor.ts` | Resolve endpoint | Viết lại |
| `avatar-web/server/src/tools/captcha-collector.ts` | Caller duy nhất (line 15, 248) | Sửa call site + xoá dead import |
| `avatar-web/server/data/jar-server-cache.json` | Cache last-known-good | Tạo lúc runtime |

### Interfaces
```ts
// jarServerExtractor.ts
export interface GameServerEndpoint {
  host: string;
  port: number;
  source: string;
}

export declare function resolveJarGameServer(opts?: {
  jarPath?: string;
  timeoutMs?: number; // mặc định 10_000
}): Promise<GameServerEndpoint>;
```

API đổi từ sync `getGameServerFromJar()` sang async `resolveJarGameServer()` — bắt buộc vì có network I/O. Blast radius đã xác minh bằng grep: chỉ 1 caller (`captcha-collector.ts:248`), không có file test tham chiếu → **rủi ro THẤP**.

### Flow xử lý
```
captcha-collector (không --host/--port)
  └─> resolveJarGameServer()
        ├─ 1. Tìm jar (getDefaultJarPath — giữ nguyên logic hiện tại)
        ├─ 2. ZIP-parse central directory → đọc bytes 'normal/lg.png'
        │      (entry stored → dùng nguyên; deflated → zlib.inflateRawSync)
        ├─ 3. XOR 'NguyenHuuQuyet' → parse bảng br_0 → entry 'u.png'
        ├─ 4. Base64 decode u.png → map key=value (split '|', split '=' đầu tiên)
        │      → configUrl = value['2']  (fallback: http://chip.vcdn.io.vn/avatar/full/)
        ├─ 5. fetch(configUrl, AbortSignal.timeout) → bytes
        ├─ 6. XOR 'NguyenHuuQuyet' → parse DataInputStream (case=1, server list)
        ├─ 7. Ghi cache JSON {host, port, groupName, serverName, fetchedAt}
        └─ 8. return endpoint
```

### An toàn
- Toàn bộ bước parse bọc try/catch riêng; lỗi parse không làm crash process — luôn đi tới nhánh cache/throw có kiểm soát.
- Timeout fetch mặc định 10s, không retry tự động (caller có thể chạy lại).
- KHÔNG bao giờ fall-back âm thầm sang `27.0.14.120:19129` — đây chính là gốc rễ bug (nối nhầm world).

---

## 4. Verification Plan

1. **Typecheck:** `npm run typecheck` (trong `avatar-web/server`) — pass.
2. **Smoke test resolver:** chạy snippet tsx gọi `resolveJarGameServer()` và in kết quả — kỳ vọng:
   - `host === '112.213.85.102'`, `port === 19128`
   - `source` chứa "Xứ Sở Diệu Kỳ" và "Thành Phố Hoàn Mỹ"
3. **Kiểm tra cache:** file `server/data/jar-server-cache.json` được ghi đúng schema.
4. **Kiểm tra nhánh offline:** ngắt URL (đổi DNS/hosts hoặc truyền jarPath không tồn tại + block network) — kỳ vọng dùng cache khi còn tươi, throw error rõ ràng khi không có cache.
5. **Chạy thật collector:** `npm run captcha:collect -- --user <tk> --pass <mk> --count 1` (không truyền `--host/--port`) — log dòng "Bắt đầu kết nối máy chủ" phải hiển thị `112.213.85.102:19128` và source động.
6. **GitNexus detect_changes** trước khi commit để xác nhận scope thay đổi đúng 2 file nguồn.
