# Thiết Kế — Truy vết 3 cổng map con tại Khu ngoại ô (map 17) qua Map-Link (AvatarHD 3.4.4)

> **Ngày:** 2026-09-17
> **Trạng thái:** Chờ user duyệt (User Review Gate — bước 1/3 theo `AGENTS.md`)
> **Spec liên quan:** `docs/superpowers/specs/2026-09-16-dao-go-da-khu-ngoai-o-design.md`,
> `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md`

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề
Map 17 (Khu ngoại ô) là **hub trống**: rescan live ngày 2026-09-17 (account 3, `TX -1/90/80` read-only) tái xác nhận `20/20 khu, specialCount = 0, mapMarker = 0, specials = [], RX 48 = []` (`/tmp/probe17-scan.json`, `decode: no-specials-any-area`).
User xác nhận gameplay thật: **vào map 17 có 3 cổng dẫn vào 3 map con, trong đó 1 map đào gỗ, 1 map đào đá**.
Bot không cần "đi bộ qua cổng" — bot cần **`(roomID, x, y)` của từng map con** để `cmd 80` join thẳng (đúng mô hình `bd.java` fast-travel của J2ME).

### 1.2 Kết quả điều tra static ngày 2026-09-17 (đã verify, không đoán)
1. **Opcode map/tile đã lộ tên** trong `avatar-web/server/src/game/opcodes.ts`:
   - `-22 REQUEST_TILE_MAP` (`:88`), `-73 GET_TILE_MAP` (`:39`),
     `-51 KICK_OUT_HOME / DOWNLOAD_DATA` (`:61`), `-11 MAP_ITEM` (`:99`), `-10 MAP_ITEM_TYPE` (`:100`).
   - Repo `avatar-web` **chưa xử lý RX nào** trong các opcode trên (`client.ts` không có `case -22/-73/-51`).
2. **Bảng opcode J2ME đã giải mã xong** (`tools/jar/all_src/er_0.java:47-75` → `do[0..25]`):
   `do[1]=-14, do[2]=-15, do[3]=-16, do[5]=-40, do[6]=-41, do[10]=-24 (REQUEST_CITY_MAP),
   do[11]=-46, do[13]=-74, do[15]=-65, do[16]=-66, do[17]=-67, do[18]=-69,
   do[19]=-70, do[20]=-71, do[21]=-75, do[23]=-80, do[24]=-84, do[25]=-104`.
   - `er_0.do(short s)` = `cmd -80` + body `i32` (`er_0.java:156-160`); J2ME `ac_0.if(short)` gọi nó khi cache-miss (`ac_0.java:322-328`).
   - J2ME `ac_0.do(Vector,...)` (`ac_0.java:418-608`) là luồng version-check 5 version int (`avatarVs`: `int/if/new/for/try`) + descriptor `ht`, gọi `er_0.do().for(ht.if)` / `fv_0.do().for(s2)` cho entry hết hạn, rồi lưu RMS (`avatarTileMap`, `avatarMapItemType`, `avatarMapType`).
3. **Unity client có hệ LinkMap riêng** (thấy tên trong `global-metadata.dat` của `AvatarHD_3.4.4_APKPure.apk`):
   `getPosLinkMap`, `getLinkMap`, `getPosNewMap:`, `getPosTypeMap`, `downloadMapLink`,
   `loadmap posCanMove mapId:`, `loadmap wmap:`, `loadMapItemType`, `loadMapItem`, `paintRockMap`,
   `T_SLUM`, `T_ROCK`, `KHU_NGOAI_O`, `sound/snd_effect_dao_dat`.
   → Cổng = tile LinkMap phía client (vị trí + dest mapID), **không nằm trong snapshot `RX 80`** — khớp hub trống.
4. **Ứng viên map đá duy nhất:** `T_ROCK = 88` (`docs/danh-sach-tat-ca-cac-map-AvatarHD.md:199`).
   Map gỗ và map thứ 3 **chưa có ID** trong repo — cấm bịa.

### 1.3 Khoảng trống & rào cản (nói thẳng)
- **Chưa biết:** payload `TX -22`, layout `RX -73/-51`, cách mã hóa dest mapID trong LinkMap, ID map gỗ/map thứ 3.
- **Blocked:** `avatar-re/il2cpp_out/` (dump.cs/script.json) không tồn tại local; `avatar-jar/*.jar` đã bị xóa khỏi working tree (`git status` báo `D`, chỉ còn `tools/jar/all_src/`); Il2CppDumper không có sẵn; GitNexus MCP tools không có trong session này (chỉ tạo file mới, không sửa symbol cũ → blast radius ~0).
- **Live:** account duy nhất `id 3`; login lần 1 fail `RX -35`, lần 2-3 OK. Cấm retry dồn (rate-limit).

### 1.4 Mục tiêu cụ thể
| # | Mục tiêu | Tiêu chí hoàn thành |
|---|---|---|
| G1 | Chốt dest roomID 3 map con (gỗ/đá/+1) | Mỗi ID có 1 bằng chứng live (join OK `RX 80 room/dest` hoặc LinkMap decode) hoặc ghi rõ `unverified` |
| G2 | Chốt tọa độ join `(x,y)` từng map con | `RX 80` response `x/y` khớp request, không đoán |
| G3 | Chốt tọa độ 3 cổng trong hub 17 (nếu lấy được) | Từ LinkMap decode hoặc `mapItemType` positions, có `(x,y)` + dest tương ứng |
| G4 | Không khóa/ban account, không spam | Mọi phiên ≤ giới hạn TX đã duyệt, cooldown ≥2000ms giữa join, dừng ngay khi dialog lạ/rate-limit |

---

## 2. Phạm vi (Scope)

### 2.1 In-scope
1. **Tool probe mới** `avatar-web/server/src/tools/maplink-probe.ts` (read-only mặc định; các bước ghi là opt-in, mỗi bước ≤1 lần ghi/phiên, mỗi bước cần approve riêng của user).
2. **Static bổ sung có giới hạn:** decode tiếp bảng `fv_0.do[]` + kiểu field class `ht` (`tools/jar/all_src/`) để suy ra shape request **mirror từ call site J2ME** (không phát minh shape mới).
3. **Evidence doc** `docs/protocol/khu-ngoai-o-cong-map-con-evidence-YYYY-MM-DD.md` với bảng cổng (mục 3.3).
4. Tái sử dụng nguyên trạng: `GameClient.login/enterParkContext/sendRaw` (`client.ts:718/726/912`), guard `assertAvatarWebStopped`, cooldown `AREA_SCAN_COOLDOWN_MS`, decoder prefix `RX 80`.

### 2.2 Out-of-scope
- Không sweep roomID hàng loạt (không quét `0..127`), không brute-force `idMenu`, không retry khi state không chắc chắn.
- Không đụng `FarmService`, auto-fishing, `auto_mining`, shop, captcha.
- Không mua/bán/ghép gỗ-đá; chỉ xác định cổng + join verify.
- Không viết test (theo `AGENTS.md`: không TDD; chỉ viết khi user yêu cầu).
- Không commit/push (GitNexus `detect_changes` không chạy được trong session này → để file uncommitted cho user quyết).

### 2.3 Input / Output
- **Input:** `account-id` trong DB, cờ opt-in từng bước ghi (`--probe-room`, `--mirror-tile-request`), cooldown.
- **Output:** JSON redacted ra stdout + file evidence markdown. Không in credential/host/hex/chat.

### 2.4 Edge cases bắt buộc
| # | Edge case | Hành vi yêu cầu |
|---|---|---|
| E1 | Login fail (`RX -35`/timeout) | Dừng sạch, **không retry trong cùng ngày** nếu đã fail 1 lần trước đó |
| E2 | Join room ứng viên bị từ chối/không có `RX 80` | Ghi `unverified`, join về map 17, dừng (không thử room khác trong cùng phiên) |
| E3 | Server trả dialog rate-limit/anti-spam | Dừng loop, không resend, log lý do |
| E4 | `RX -73/-51` về nhưng không decode được | In `{cmd, len, decode:'unknown'}`, không đoán layout, dừng bước đó |
| E5 | Socket đóng giữa chừng | Hủy lượt, không mở session thứ 2 |
| E6 | `avatar-web` đang chạy cùng account | Từ chối chạy (guard sẵn có) |

### 2.5 Ràng buộc toàn cục
- Node.js + TypeScript ESM, `tsx`, không thêm dependency.
- Big-endian `Message`/`MyReader` theo `avatar-web/server/src/proto/`.
- Mọi hằng số room/dest chỉ lấy từ evidence live hoặc bảng đã decode — mảng rỗng = từ chối chạy.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Module liên quan và vai trò
| File | Vai trò |
|---|---|
| `avatar-web/server/src/tools/maplink-probe.ts` | **Tạo mới** — probe LinkMap/map-con (reuse khung `mining-probe.ts`: parseArgs strict, traffic whitelist, redaction) |
| `avatar-web/server/src/game/client.ts` | Tái sử dụng `login`, `enterParkContext`, `sendRaw`, `waitForWorldSnapshot` — **không sửa** (trừ khi cần decoder `-73`, sẽ nêu riêng ở Plan) |
| `avatar-web/server/src/game/parkService.ts` | Tái sử dụng `NATIVE_PARK_JOIN_POSITIONS[17] = (100,100)` — **không sửa** |
| `tools/jar/all_src/fv_0.java`, `ht` (trong `fj`/`ac_0`) | Decode static bổ sung (read-only phân tích) |
| `docs/protocol/khu-ngoai-o-cong-map-con-evidence-*.md` | **Tạo mới** ở cuối |

### 3.2 Các bước live (mỗi bước 1 phiên riêng, mỗi bước cần approve riêng)
- **B0 (read-only, mặc định):** login → `-1[9]` → `90[17]` → `80[17,area,100,100]` 1 khu → assert hub vẫn trống (khẳng định lại baseline). Whitelist TX: `-1/90/80` (+ `-94` nội bộ client).
- **B1 (1 write duy nhất):** `--probe-room 88` → `80[88,0,100,100]` → chờ `RX 80` 7s → ghi `room/board/x/y` response (hoặc timeout = `unverified`) → join về `80[17,0,100,100]` → logout. Tổng TX ghi thêm: ≤2.
- **B2 (mirror, chỉ khi static xong):** gửi **đúng 1 shape** đã mirror từ call site J2ME đã decode (ví dụ `er_0.do(short)` = `-80[i32]` — nhưng `-80` trong Unity là `GET_IMG_ICON`, nên B2 **chỉ chạy khi tìm được shape tile-request đúng nghĩa**; nếu không, B2 chuyển thành capture-only và kết thúc điều tra static).
- **B3 (dự phòng):** chỉ khi user cung cấp tên map con trong game (gỗ/đá/+1) → đối chiếu tên với catalog để suy ID ứng viên cho B1-style test. Không đoán ID từ tên gần đúng.

### 3.3 Schema evidence bắt buộc
```text
map17-hub: reverified-empty; boardCount=20
gates: [{ index, x, y, destRoom, destName, via: 'linkmap-decode|join-verify', status: verified|unverified }]
submaps: [{ room, name, joinX, joinY, contains: 'go|da|unknown', status }]
trafficSummary[] (phase,dir,cmd,len) + hash APK/CityMap + timestamp + accountId
```

### 3.4 Safety guards (không thương lượng)
1. Mỗi phiên ≤ số TX ghi đã duyệt (B0: 0; B1: ≤2); cooldown ≥2000ms giữa join; 1 lượt tại 1 thời điểm.
2. Kill-switch: dialog lạ/`RX -35`/socket đóng → dừng + logout, không resend.
3. Redaction whitelist: chỉ in dest roomID, tọa độ, tên map do server cấp (cắt 120 ký tự); cấm credential/host/hex/chat/ảnh.
4. Không chạy khi `avatar-web` phục vụ cùng account; không chạy 2 phiên cùng lúc.

---

## 4. Verification Plan
1. **Static:** `npm run typecheck && npm run build`; `git status` chỉ có file mới (`maplink-probe.ts`, evidence) — không sửa file cũ.
2. **B0:** `decode` hub `empty`, traffic đúng whitelist `-1/90/80`.
3. **B1:** hoặc `room/board=88/x` khớp response (verified), hoặc timeout sạch + join về 17 OK (unverified, không thử thêm).
4. **B2:** chỉ pass khi shape gửi đi mirror 1-1 từ call site đã decode; ngược lại ghi `tile-request-shape: unknown` và dừng.
5. **Evidence:** đủ schema §3.3 mới coi là xong; thiếu dest ID nào thì ghi `pending`, không lấp số.

---

## 5. Quyết định cần user duyệt (User Review Gate)
| # | Quyết định | Khuyến nghị | Nếu đổi |
|---|---|---|---|
| D1 | Khôi phục `avatar-jar/*.jar` đã xóa (`git checkout -- avatar-jar/`) để trích tile map J2ME | **Khôi phục** (cần cho decode tile/link J2ME) | Bỏ qua J2ME, chỉ dùng Unity live |
| D2 | Chạy B1: 1 lần join room 88 (+ join về) | **Chạy** (rủi ro thấp, đảo ngược được) | Để 88 mãi `unverified` |
| D3 | Chạy B2 mirror tile-request | Chỉ chạy khi static chốt được shape đúng nghĩa | Kết thúc ở B1 + chờ tên map từ user |
| D4 | User cung cấp tên 3 map con trong game | **Rất nên** (shortcut 0 rủi ro: đối chiếu tên → ID) | Bỏ qua, đi đường live thuần túy |
