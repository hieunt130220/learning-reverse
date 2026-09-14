# Thiết Kế: Probe Vé Câu Cá Bến Tàu Map 27 (Tìm Chỗ Bán)

> **Ngày lập:** 2026-09-11
> **Trạng thái:** Chờ User Review
> **Chủ đề:** Tìm chỗ bán vé câu cá bến tàu sau lỗi `Bạn cần vé câu cá bến tàu để câu cá khu vực này`
> **Nguồn bằng chứng & Tham chiếu:**
> - Log thực tế: `TX45 → RX45 iss=false "Bạn cần vé câu cá bến tàu…"`, code dừng tại `avatarSession.ts:2550-2555`.
> - `automationTypes.ts:36-40` (`FISHING_TICKETS` chỉ có 458/459/460), `FishingSettingsPanel.tsx:37-38` (hint "NPC không bán").
> - Bot gốc `tools/jar/all_src/bs_0.java`: switch join (dòng 826-845) và switch mua vé (dòng 969-997) chỉ có `case 14/15/16`, không có `case 27`. Hằng số đã giải mã: `if[30]=458`, `if[32]=459`, `if[22]=460`, `if[27]=448` (mồi), `if[17]=13` (hub mua đồ).
> - `avatar-re/il2cpp_out/stringliteral.json` (12614 chuỗi): không có chuỗi "vé bến tàu"/"Hawai"+vé. Hai manh mối: `Quày vé` (`0x1B44348`), `SHOP ĐẶC BIỆT` (`0x1B44B38`).
> - `opcodes.ts:38`: `-74 → BUY_ITEM_EVENT` đã map label nhưng client chưa có hàm gọi.
> - Pattern probe đã có: `server/src/tools/fishing-probe.ts` (login/park/join/TX45/RX79), `npc-map-probe.ts` (decode RX80/RX48, `decodeMapSpecialUpdate`), `catalog-probe.ts`.
> - Doc nền: `docs/danh-sach-cac-map-cau-ca-AvatarHD.md` (§2.4), spec cũ `docs/superpowers/specs/2026-09-08-fishing-buy-config-design.md` (§2.2 out-of-scope Map 27).

---

## 1. Mục Tiêu & Bối Cảnh (Context & Goals)

### 1.1. Bối cảnh
Auto câu Map 27 bị server từ chối ngay tại `TX45 START_CAU_CA` vì thiếu vé bến tàu. Nhánh `FISHING_TICKETS[targetMap]` trả `undefined` nên bot dừng trước khi gửi bất kỳ lệnh mua nào — hành vi này là **chủ ý** (vé sự kiện, NPC Map 13 không bán), không phải bug. Ba nguồn độc lập (code avatar-web, bot gốc, binary game) đều đồng thuận: **chưa có chỗ bán nào được verify**.

### 1.2. Mục tiêu
Probe này trả lời đúng 3 câu, theo thứ tự ưu tiên:
1. **NPC nào ở Map 27 bán vé?** (liệt kê NPC + menu tại map 27 qua `RX80`/`RX48`/dialog `-40`).
2. **Mua bằng opcode nào?** (`-43 buyItemStack` như vé thường, `-74 BUY_ITEM_EVENT` như hàng sự kiện, hay menu NPC `-59/-61` như quest).
3. **`itemId` + `typeMoney` + giá chính xác** của vé bến tàu.

Probe **KHÔNG** sửa production code (`FISHING_TICKETS`, `executeParkPurchase`, UI). Kết quả probe là đầu vào cho một spec/plan tiếp theo ("bổ sung vé bến tàu vào auto-buy").

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- **Phase A (read-only):** join Map 27 → capture `RX80`, `RX48` specials (danh sách NPC), dialog `-40` ("Khu câu cá đặc biệt"), và exact string `RX45` rejection. Có gửi `TX45` (biết trước sẽ reject) chỉ để capture chuỗi lỗi chính xác — không tốn tài nguyên.
- **Phase B (best-effort, không mua):** thử `communicate (-59)` + `doMenuOption (-61)` lên NPC ở Map 27 **trong park context**, capture có `RX -61` menu trả về không. Gặp prompt mua/xác nhận → dừng NPC đó ngay, ghi nhận, không confirm.
- **Phase C (sweep mua có guard):** `buyItemStack` dải ID `461–475` tại Map 13, **pass xu (`typeMoney=1`) trước**; pass Lượng (`typeMoney=2`) chỉ chạy khi có flag `--allow-luong` (mặc định `false`).
- **Phase D (optional):** thử opcode `-74` với payload mirror `-43` (`i16 id, i32 num, i8 type`) trên tối đa 2 ID ứng viên, timeout ngắn, chỉ ghi `cmd/len` thô (schema `-74` chưa biết nên không decode sâu).
- Output JSON sanitized theo pattern `fishing-probe.ts` (metadata traffic/events, không password, không raw hex tài khoản).

### 2.2. Out-of-Scope
- Không sửa `FISHING_TICKETS`, `executeParkPurchase`, `automationTypes.ts`, UI, DB, revision.
- Không gửi `TX41` (quăng cần) / `TX43` (đáp án mini-game) — probe không câu.
- Không đụng hệ farm/shop-catalog (`cmd 76/103`) — khác hệ thống.
- Không nạp xu/lượng, không farm kiếm tiền.
- Không tạo test file (theo quy trình dự án: không TDD).

### 2.3. Input / Output
- **Input CLI** (key-value, không positional, theo pattern `fishing-probe.ts`):
  - `--account-id` (bắt buộc, int > 0), `--phase` (`a|b|c|d|all`, mặc định `a`),
  - `--output-dir` (bắt buộc), `--area` (mặc định `0`),
  - `--id-lo/--id-hi` (mặc định `461/475`), `--npc-id` (optional, bỏ qua Phase A discovery),
  - `--candidate-ids` (optional cho Phase D, vd `"461,463"`), `--allow-luong` (boolean flag, mặc định off).
- **Output** trong `--output-dir/pier-ticket/<timestamp>/`:
  - `evidence.json` (tổng hợp), `npc.json` (danh sách NPC Map 27), `buy-matrix.json` (ma trận kết quả sweep).

### 2.4. Edge cases
| Trường hợp | Xử lý |
|---|---|
| Web server đang chạy | Abort ngay (`assertAvatarWebStopped` pattern) |
| Xin handler Park 2 lần → socket đóng | `enterParkContext()` 1 lần duy nhất (guard sẵn trong client) |
| Map 27 join reject / area full | Thử area `0..2`, mỗi area 1 lần, ghi nhận, không retry vô hạn |
| Phase B gặp prompt mua | Dừng NPC đó, ghi nhận dialog, không gửi thêm menu option |
| Sweep mua **thành công ngoài ý muốn** (`itemId != -1`) | Dừng sweep ngay, ghi balance trước/sau từ `metrics` event, báo user, không chạy tiếp |
| `RX45` decode lỗi | Ghi `rawLen`, không crash |
| `-59/-61` trong park context không trả `RX -61` trong 5s | Kết luận "park NPC không dùng menu farm", đi tiếp Phase C/D (đây cũng là kết quả) |
| Rate-limit / timeout liên tiếp | Delay 1s giữa các lệnh sweep; abort phase sau 10 lỗi liên tiếp |

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1. Files / modules liên quan và vai trò
| File | Vai trò trong probe |
|---|---|
| **Create:** `avatar-web/server/src/tools/pier-ticket-probe.ts` | Probe duy nhất: parse CLI, 4 phase `runPhaseA/B/C/D`, helpers shared (`loginWithTimeout`, `waitUntilOnline`, `waitForParkHandlerResponse`, `assertAvatarWebStopped`) copy từ `fishing-probe.ts`. Không import `avatarSession`/automation runtime để tránh chu kỳ phụ thuộc |
| `server/src/game/client.ts` | Reuse `GameClient`: `login`, `enterParkContext`, `sendRaw`, events `message` / `dialog` / `park-buy-item` / `traffic` / `metrics` |
| `server/src/game/parkService.ts` | `NATIVE_PARK_JOIN_POSITIONS[27]` (`254,82` — trùng node 5, đã ghi chú trong code), payload `doBuyItemStack` (`i16 id, i32 num, i8 type`) |
| `server/src/game/farmService.ts` | `communicate(idUser)` (`-59`), `doMenuOption(idUser, menu, sub)` (`-61`) cho Phase B |
| `server/src/game/opcodes.ts` | Label `-74 BUY_ITEM_EVENT` (Phase D) |
| `server/src/proto/reader.ts` | `MyReader` decode `RX45` (`bool iss [+ utf error]`), `RX48` |
| `server/src/tools/npc-map-probe.ts` | Copy hàm `decodeMapSpecialUpdate` (mode `0/1` upsert: `i32 id, utf name, i32 x, i32 y, i8 type, images, state, menus`; mode `2` remove) vào probe — copy thay vì import để tool độc lập như các probe hiện tại |

### 3.2. Interfaces & data contracts
```ts
interface ProbeArgs {
  accountId: number; phase: 'a' | 'b' | 'c' | 'd' | 'all';
  outputDir: string; area: number;
  idLo: number; idHi: number; npcId?: number;
  candidateIds: number[]; allowLuong: boolean;
}
interface NpcEntry { id: number; name: string; x: number; y: number; type: number; menuCount: number; }
interface BuyCell {
  id: number; typeMoney: number;
  result: 'success' | 'rejected' | 'timeout';
  message?: string; price?: number; xuAfter?: number; luongAfter?: number;
}
interface Evidence {
  timestamp: string; accountId: number; phase: string;
  requested: { map: number; area: number };
  traffic: { phase: string; dir: 'TX' | 'RX'; cmd: number; len: number }[];
  events: { phase: string; event: string }[];
  rx45: { iss: boolean; error?: string } | null;
  dialog40: string[];
  npc: NpcEntry[];
  buyMatrix: BuyCell[];
}
```
- Kết quả mua đọc từ event `park-buy-item` (`client.ts:1173`): `{ itemId, price, typeMoney, message, xu, luong, luongKhoa }` — `itemId === -1` là từ chối.
- Balance trước/sau đọc từ event `metrics` (`{ xu, luong, luongKhoa }`).

### 3.3. Flow xử lý
```text
login → enterParkContext(9) ─┬─ Phase A: TX90(board-list 27) → TX80(join 27/area)
│                             │           → grace 3s (RX48/dialog-40) → TX45 → RX45 → TX44 reset
│                             ├─ Phase B: với mỗi NPC (hay --npc-id): TX-59 communicate
│                             │           → TX-61 menu 0..k (mỗi mục 1 lần, chờ RX-61 5s)
│                             │           → gặp prompt mua: DỪNG npc đó
│                             ├─ Phase C: TX80(join 13/0) → loop id [lo..hi]:
│                             │           sendRaw(-43,[i16 id,i32 1,i8 1]) → chờ park-buy-item 4s
│                             │           → success: DỪNG toàn sweep → báo cáo
│                             │           → hết pass xu: in tóm tắt, chỉ pass Lượng nếu --allow-luong
│                             └─ Phase D: sendRaw(-74, mirror -43) × ≤2 candidate → ghi cmd/len thô
└─ logout (mọi phase, finally)
```

### 3.4. Safety guards (ràng buộc bắt buộc khi implement)
1. `assertAvatarWebStopped` trước mọi phase.
2. Sweep mua: `num=1`, delay 1s giữa lệnh, `typeMoney=1` trước; pass `2` cần `--allow-luong` **và** user đã duyệt kết quả pass xu.
3. Dừng sweep ngay khi có `success` ngoài ý muốn; không tự mua thêm, không tự bán lại.
4. Phase B không confirm bất kỳ dialog mua nào.
5. Không gửi `TX41/TX43` trong probe này.

---

## 4. Verification Plan

1. **Typecheck:** `npx tsc --noEmit -p avatar-web/server` (hoặc lệnh typecheck tương đương của repo) — pass, không error mới.
2. **CLI khô (không login):** thiếu `--account-id` → báo lỗi; `--phase x` → báo lỗi; `--id-lo > --id-hi` → báo lỗi.
3. **Phase A thật** (đã dừng web server):
   `node --import tsx --env-file=.env src/tools/pier-ticket-probe.ts --account-id <id> --phase a --output-dir /tmp/pier-probe`
   Expect: `evidence.json` có `rx45.error` chứa "vé câu cá bến tàu", `dialog40` có "Khu câu cá đặc biệt", `npc[]` non-empty (liệt kê được NPC Map 27).
4. **Phase C pass xu:** `... --phase c --output-dir /tmp/pier-probe` → Expect (giả thuyết): `buyMatrix` toàn `rejected`, mỗi cell có `message` server; nếu có `success` → probe đã dừng đúng guard, báo cáo itemId cho user.
5. **Review thủ công** `evidence.json` + `npc.json` + `buy-matrix.json` trước khi quyết định spec tiếp theo (bổ sung `FISHING_TICKETS` / `executeParkPurchase`).
6. **GitNexus:** file probe mới, không sửa symbol nào → không cần `impact`; trước commit chạy `detect_changes({scope:"all"})` để xác nhận chỉ có 1 file mới.
