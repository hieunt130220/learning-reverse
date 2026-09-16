# Thiết Kế — Tự động hoá "Đào gỗ & đá tại Khu ngoại ô" (AvatarHD 3.4.4)

> **Ngày:** 2026-09-16
> **Trạng thái:** Chờ user duyệt (User Review Gate — bước 1/3 theo `AGENTS.md`)
> **Spec liên quan:** `docs/protocol/npc-map-probe-evidence-2026-08-25.md`,
> `docs/Phân tích kỹ thuật giao thức  — Di chuyển Map & Tìm NPC trong AvatarHD.md`,
> `docs/superpowers/specs/2026-08-25-npc-map-catalog-probe-design.md`

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề
Người chơi muốn bot tự **đào gỗ và đá tại Khu ngoại ô** (thay vì tự tay chạm từng đối tượng). Hiện repo `learning-reverse` chỉ có automation cho **nông trại**, **câu cá** và **Tìm NPC**; **không có** bất kỳ code nào cho khu ngoại ô.

### 1.2 Nguyên nhân gốc rễ (kết quả điều tra 2026-09-16)
1. **`đào gỗ/đá` KHÔNG phải một hàm trong client.** Không tồn tại chuỗi `gỗ`, `đào`, `khai thác`, và `đá` (ngoài `đánh`) trong `avatar-re/il2cpp_out/stringliteral.json`; J2ME auto client cũng không có `gỗ`/`đào` (`tools/jar/all_src/*.java`). Nghĩa là **tên hành động ("Đào", "Chặt") và tên vật phẩm ("Gỗ", "Đá") do server cấp** qua menu runtime.
2. Đây là **luồng tương tác đối tượng map** (`ItemMapSpecial` có `idMenu[]` — `avatar-re/il2cpp_out/dump.cs:269127-269148`), chạy trong **Park handler 9**.
3. **Khu ngoại ô = roomID 17**, xác nhận bằng 2 nguồn độc lập:
   - CityMap TextAsset: node `8 | Ngoại ô | x=100 | y=100 | handler=9 | idToMap=17` (`docs/protocol/npc-map-probe-evidence-2026-08-25.md:36`)
   - J2ME auto client: `"ID 17: Khu ngo\u1ea1i \u00f4"` (`tools/jar/all_src/gs_0.java:3321`)
4. **Repo chưa vào được map 17**: `NATIVE_PARK_JOIN_POSITIONS` (`avatar-web/server/src/game/parkService.ts:68-82`) không có key `17`; `ParkService.doJoinPark` throw ngay (`parkService.ts:89-92`); `npc-map-probe.ts` còn siết cứng “chỉ map 5” (`tools/npc-map-probe.ts:168-179`).
5. **Chưa có bằng chứng wire** cho bước "chọn menu đào": opcode `-59`/`-61` đã verify static (`iladis --sum`: `doCommunicate @0x69D070 = -59 [Int]`, `doMenuOption @0x69C8B0 = -61 [Int,Byte,Byte]`) nhưng **chưa có capture live** cho `idMenu` của cây/đá và vật phẩm nhận về.

### 1.3 Nguyên tắc
Không hard-code bất kỳ `idMenu` hay item id nào khi chưa có capture live. Toàn bộ hằng số của tính năng này phải là **output của bước thu thập bằng chứng (Phase A/B)**, giống mô hình `VERIFIED_NPC_MAP_CATALOG` (`avatar-web/server/src/game/npcMapCatalog.ts`).

### 1.4 Mục tiêu cụ thể
| # | Mục tiêu | Tiêu chí hoàn thành |
|---|---|---|
| G1 | Vào được Khu ngoại ô | Join map 17 với toạ độ native `(100,100)`, nhận RX80/RX-34 hợp lệ |
| G2 | Liệt kê đối tượng + menu | In ra `specials[]` (id, name, type, idMenu[]) của map 17 mà **không** thay đổi trạng thái game |
| G3 | Chốt protocol "đào" | Capture được `-59`/`-61` → RX menu + RX nhận vật phẩm, ghi thành evidence doc |
| G4 | Tự động hoá có guard | Mode `auto_mining` chạy loop có giới hạn, tự dừng khi lỗi/bất thường |

---

## 2. Phạm vi (Scope)

### 2.1 In-scope
1. **Sửa namespace toạ độ** trong `parkService.ts`: thêm key `17` (Khu ngoại ô) và xử lý entry `8` đang bị hiểu sai namespace (xem D1 §3.5).
2. **Tool probe read-only mới** `avatar-web/server/src/tools/mining-probe.ts` (Phase A) để vào map 17 và liệt kê đối tượng/menu, có công tắc opt-in cho 2 bước ghi (`--open-menu`, `--select-menu`) với hard cap.
3. **Evidence doc** `docs/protocol/khu-ngoai-o-dao-go-da-evidence-YYYY-MM-DD.md` (Phase B) chứa schema đã chốt.
4. **Catalog + config + automation mode `auto_mining`** (Phase C) trong backend `avatar-web/server` (D4 §3.5).
5. **UI tối thiểu** (Phase C2, optional): panel bật/tắt + đếm số lần đào và số vật liệu nhận được, theo pattern `FindNpcPanel.tsx`.

### 2.2 Out-of-scope
- Không sửa `FarmService`, `FishingScr`/auto-fishing, `autoFindNpc`, `ShopCoordinator`, captcha.
- Không tự động **mua/bán/ghép** gỗ-đá (chỉ đào và đếm).
- Không xây nhà, không mua đồ nội thất ở Khu nhà ở (map 21) — khác feature.
- Không brute-force `idMenu` (không quét 0..255), không retry khi state không chắc chắn.
- Không tạo test cho tới khi user yêu cầu (theo `AGENTS.md`: không TDD).

### 2.3 Input / Output
- **Input (người dùng):** `account-id` có trong DB, map `17`, area (từ RX90 board list), tên/id đối tượng, key menu (`dig`/`chop`), số lần đào tối đa.
- **Output Phase A:** JSON redacted ra stdout (không hex toàn gói, không credential).
- **Output Phase B:** file markdown trong `docs/protocol/`.
- **Output Phase C:** mode automation như các mode hiện có, log qua WS, đếm số lần đào + item delta.

### 2.4 Edge cases bắt buộc xử lý
| # | Edge case | Hành vi yêu cầu |
|---|---|---|
| E1 | Area không có đối tượng (specials rỗng) | Báo “không có đối tượng”, **không** gửi `-59`, dừng sạch |
| E2 | Toạ độ/roomID chưa verify | Throw `chưa có tọa độ native đã verify cho map N`, không đoán |
| E3 | Server từ chối (dialog rate-limit/anti-spam) | Dừng loop, không resend; log lý do; respect `retryAfterMs` |
| E4 | Gửi `-61` xong không có RX vật phẩm | Đánh dấu `uncertain`, **không** gửi lại (tránh nhân đôi hành động) |
| E5 | Socket đóng giữa lượt đào | Hủy lượt, không tạo session thứ 2 (tránh đá phiên) |
| E6 | `avatar-web` đang chạy cùng account | Probe phải từ chối chạy (dùng guard `assertAvatarWebStopped` sẵn có) |
| E7 | `idMenu` capture được nhưng nhãn không chứa “Đào” | Không tự suy diễn; yêu cầu người dùng xác nhận id menu |
| E8 | Vật phẩm nhận về nằm ở section inventory khác (hạt/vật phẩm) | Decode đủ section, đối chiếu theo id, không chỉ section 1+2 |

### 2.5 Ràng buộc toàn cục
- Node.js + TypeScript ESM, `tsx` để chạy tool, không thêm dependency mới.
- Big-endian `Message`/`MyReader` theo `avatar-web/server/src/proto/`.
- Tôn trọng `AGENTS.md`: Spec → Plan → Code; **không TDD**; GitNexus `impact` trước khi sửa symbol, `detect_changes` trước commit.
- Mọi bước ghi (write opcode) phải nằm sau cờ opt-in và/hoặc env flag, mặc định **off**.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Hiện trạng code & hợp đồng đã biết (không đoán)

#### 3.1.1 Module liên quan và vai trò

| File | Vai trò trong thiết kế này |
|---|---|
| `avatar-web/server/src/game/parkService.ts` | Hằng số/opcode Park + `NATIVE_PARK_JOIN_POSITIONS` (**sửa**) |
| `avatar-web/server/src/game/farmService.ts` | Đã có `communicate()` = TX `-59` (`:69-71`), `doMenuOption()` = TX `-61` (`:74-80`) — **tái sử dụng, chỉ đổi tên/alias** |
| `avatar-web/server/src/game/client.ts` | `enterParkContext()` (`:718`), `joinPark()` (`:726`), `sendRaw()` (`:912`), `traffic[]` (`:415-433`), `inventory` (`:343`), `waitForWorldSnapshot`, `currentParkSnapshot`, dispatch `onMessage` (`case 80:1140`, `case -62:1308`, `case 70:1397`) (**sửa: thêm decode menu/vật phẩm**) |
| `avatar-web/server/src/game/worldData.ts` | Decoder strict `cmd -34` → `specials: MapSpecial[]` (đã có `id/name/type/imageIds/menuIds/x/y`) — **tái sử dụng nguyên trạng** |
| `avatar-web/server/src/tools/mining-probe.ts` | **Tạo mới** (Phase A) |
| `avatar-web/server/src/game/miningCatalog.ts` | **Tạo mới** (Phase C) — dữ liệu từ Phase B, pattern `npcMapCatalog.ts` |
| `avatar-web/server/src/autoMining.ts` | **Tạo mới** (Phase C) — loop use-case, pattern `autoFindNpc.ts` |
| `avatar-web/server/src/session/avatarSession.ts` | Thêm mode `auto_mining` cạnh `'auto_farm' \| 'find_npc' \| 'auto_fishing' \| 'auto_fisherman_quest'` (union ở `:96`, các nhánh `:1708`, `:1769`) |
| `avatar-web/server/src/db/index.ts` | Migration CHECK constraint `desired_mode` (`:41-80`) — **sửa** |
| `avatar-web/server/src/accounts/automationRepo.ts` | Persist mode + config JSON (**sửa**) |
| `avatar-web/server/src/session/routes.ts` | Validate mode khi `POST /:id/automation/start` (`:290-303`) (**sửa**) |
| `avatar-web/server/src/session/manager.ts` | Danh sách mode cần restart (`:244-248`, `:316`) (**sửa**) |
| `avatar-web/web/src/accounts/panels/MiningPanel.tsx` | **Tạo mới** (Phase C2, optional) |
| `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md` | **Tạo mới** ở Phase B |

#### 3.1.2 Opcode dùng trong luồng (đã verify static)

| Bước | cmd | Hàm native | Wire layout | Nguồn |
|---|---|---|---|---|
| Xin context Park | `-1` | `GlobalService.getHandler @0x69B674` | `i8 9` | `docs/Phân tích … Map & Tìm NPC.md:28` |
| Vào Khu ngoại ô | `80` | `ParkService.doJoinPark` | `i8 roomID=17`, `i8 boardID`, `i16 x=100`, `i16 y=100` | `:29`, `docs/protocol/npc-map-probe-evidence-2026-08-25.md:18` |
| Danh sách khu (read-only) | `90` | `ParkService.doRequestBoardList(sbyte)` | `i8 roomID` | `tools/npc-map-probe.ts:880-883` |
| **Chạm đối tượng** | **`-59`** | `GlobalService.doCommunicate @0x69D070` | `i32 idObj` | `iladis --sum` + `farmService.ts:69-71` |
| **Chọn menu (đào/chặt)** | **`-61`** | `GlobalService.doMenuOption @0x69C8B0` | `i32 id`, `i8 idMenu`, `i8 sub` | `iladis --sum` + `farmService.ts:74-80` |
| Menu server đẩy | `-101` | `ADD_MENU` | server → client (**chưa decode**) | `dump.cs:272989` |
| Hộp thoại/thông báo | `-62`, `-70`, `-71`, `-87` | `CUSTOM_TAB`, `TEXT_BOX`, `TEXT_BOX_SERVER`, `INFO_TEXT_BOX_SERVER` | đã có decoder `-62` (`client.ts:1308`) | `dump.cs:273043`… |
| Nhận vật phẩm | `-67`, `-17` | `UPDATE_CONTAINER`, `CONTAINER` | server → client | `dump.cs` |
| Đối tượng map (update) | `48` | `ITEM_MAP_SPECIAL` (mode 0/1 upsert, 2 remove) | `avatar-re/notes/... ;` `npc-map-probe.ts:526` | `docs/Phân tích … Map & Tìm NPC.md:14-20` |
| Kiểm tra kho | `70` | `INVENTORY` | — | `client.ts:1397` |
| Tên vật phẩm | `-7` | `GET_ITEM_INFO` | — | `dump.cs:273165` |

> **Ghi chú:** `ItemMapSpecial.idMenu[]` chính là danh sách menu server cấp cho đối tượng (`dump.cs:269137`). Nhãn hiển thị (ví dụ “Đào”) đến từ RX `-101`/`-61` do server gửi nên không thể tìm trong APK.

#### 3.1.3 Flow tổng thể

```text
[Phase A: mining-probe.ts]                       [Phase B]                [Phase C: auto_mining]
login ─► GET_HANDLER(9) ─► RX90 (board list)     evidence doc            join 17 ─► -59 obj ─► -61 dig
   └─► cmd 80 [17,area,100,100] ─► RX -34/80/48  ──────────────►          └─► wait RX -67/-17 ─► TX70 diff
        ├── in: specials[] (id,name,type,idMenu)  (menu id, item id)      └─► cooldown ► lặp (bounded)
        ├── opt-in: -59 → RX -101/-62/-70/-71
        └── opt-in: -61 → RX -67/-17 → TX70
```

### 3.2 Phase A — Tool bằng chứng read-only `mining-probe.ts`

**Triết lý:** probe là công cụ *bằng chứng*, không phải bot. Mặc định chỉ join + đọc. Hai bước ghi là opt-in, tối đa 1 lần/lần chạy, không retry, không loop.

#### 3.2.1 CLI

```bash
# Phase A1 (read-only, mặc định)
npx tsx src/tools/mining-probe.ts --account-id 2 --map 17 --area 0

# Phase A2 (opt-in, CHỈ sau khi user duyệt): mở menu 1 đối tượng
npx tsx src/tools/mining-probe.ts --account-id 2 --map 17 --area 0 --open-menu <objectId>

# Phase A3 (opt-in, CHỈ sau khi user duyệt): chọn 1 menu duy nhất
npx tsx src/tools/mining-probe.ts --account-id 2 --map 17 --area 0 \
  --open-menu <objectId> --select-menu <idMenu> --observe-inventory
```

| Flag | Bắt buộc | Nghĩa | Hard cap |
|---|---|---|---|
| `--account-id` | ✔ | account trong DB | phải tồn tại, `> 0` |
| `--map` | ✔ | roomID (17) | `-128..127`; phải có trong `NATIVE_PARK_JOIN_POSITIONS` |
| `--area` | ✔ | boardID | `-128..127` |
| `--open-menu` |  | gửi TX `-59 [i32 objectId]` **đúng 1 lần** | 1 |
| `--select-menu` |  | gửi TX `-61 [i32 objectId][i8 idMenu][i8 -1]` **đúng 1 lần**; yêu cầu `--open-menu` | 1 |
| `--observe-inventory` |  | gửi TX `70` trước/sau để tính delta vật phẩm | 2 |

Từ chối mọi key khác (`ALLOWED` set, pattern theo `npc-map-probe.ts:100`) ⇒ không có “candidate sweep”.

#### 3.2.2 Các phase trong 1 lần chạy

| Phase | Hành động | Kết quả in ra |
|---|---|---|
| `login` | `GameClient.login()` | status, không in credential |
| `park-context` | `client.enterParkContext()` (`-1[9]`), chờ handler | `{phase,dir,cmd,len}` |
| `board-list` | `client.sendRaw(90, [i8])` (read-only) | `boardCount`, `areas[]` dùng cho `--area` |
| `join` | `client.sendRaw(80, [i8 room, i8 area, i16 x, i16 y])` | `roomId/boardId/x/y`, `mapItemTypeCount`, `mapItemCount`, `specialCount`, `trailingBytes` |
| `specials` | Chụp window ~3s sau join (RX 48) | `specials[] = {id, name, type, imageCount, menuIds[]}` |
| `open-menu` (opt-in) | TX `-59` | `{dir:'TX',cmd:-59,len}`; RX menu: `menuEntries[] = {idMenu, caption}` |
| `select-menu` (opt-in) | TX `-61` | RX sau chọn: `dialogText` (rút gọn), `containerDelta[]`, `unknownRx[]` |
| `inventory` (opt-in) | TX `70` trước/sau | `itemDelta[] = {id, name?, before, after}` |
| `exit` | `logout()` trong `finally` | `sessionClosed`, `trafficSummary[]` |

#### 3.2.3 Quy tắc redaction (khác biệt có chủ đích so với `npc-map-probe`)

`npc-map-probe.ts` in **chỉ** `{phase,dir,cmd,len}` không đọc body. Với tính năng này, **không thể** xác định menu “Đào” nếu không đọc caption, nên spec này định nghĩa **whitelist**:

- **Được in:** `idMenu`, `caption` của RX `-101`/`-61`/`-62` (chuỗi menu/hộp thoại do server cấp), `specials[].name`, `itemDelta[].id`, `itemDelta[].name` (nếu server cấp), số lượng trước/sau.
- **Không được in:** username/password/IMEI/token, host/port, hex toàn bộ gói, mật khẩu nhà (`-75`), nội dung chat (`-36`, `85`), dữ liệu ảnh nhị phân.
- Caption bị cắt tối đa 120 ký tự, thay `\r?\n` bằng khoảng trắng.
- Nếu body RX `-101` không decode được theo schema ⇒ in `{cmd:-101, len, decode:'unknown'}` và **dừng** bước ghi (không đoán).

#### 3.2.4 Guard tái sử dụng (không viết lại)

| Guard | Nguồn đã có |
|---|---|
| Không cho chạy khi `avatar-web` đang phục vụ cùng account | `assertAvatarWebStopped()` — `tools/npc-map-probe.ts:181-200` |
| Chờ handler Park có timeout, có `abort` | `waitForParkHandlerResponse` — `tools/npc-map-probe.ts:869-871` |
| Chờ snapshot join có timeout | `waitForParkJoinResponse` — `tools/npc-map-probe.ts:887` |
| Capture RX 48 trong cửa sổ grace | `startMapSpecialCapture` — `tools/npc-map-probe.ts:580-590` |
| Cleanup `finally` + `logout()` | `tools/npc-map-probe.ts:921-936` |
| Cooldown chống anti-spam join | `PARK_JOIN_COOLDOWN_MS` — `avatarSession.ts:2522-2560` |

#### 3.2.5 Hợp đồng output (JSON, stdout)

```ts
export interface MiningProbeOutput {
  timestamp: string;
  requested: { accountId: number; map: number; area: number };
  join: {
    roomId: number; boardId: number; x: number; y: number;
    mapItemTypeCount: number | null;
    mapItemCount: number | null;
    specialCount: number | null;
    trailingBytes: number;
  };
  specials: Array<{
    id: number; name: string; type: number;
    imageCount: number; menuIds: number[];
  }>;
  openMenu?: { objectId: number; menuEntries: Array<{ idMenu: number; caption: string }> };
  selectMenu?: {
    objectId: number; idMenu: number;
    dialogs: string[];
    containerDelta: Array<{ id: number; before: number; after: number }>;
    unknownRx: Array<{ cmd: number; len: number }>;
  };
  trafficSummary: Array<{ phase: string; dir: 'TX' | 'RX'; cmd: number; len: number }>;
  events: Array<{ phase: string; event: string; retryAfterMs?: number }>;
  decode: 'ok' | 'partial' | 'error';
}
```

### 3.3 Phase B — Evidence doc (đầu vào duy nhất cho Phase C)

**File:** `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-16.md`

Bắt buộc chứa:

1. **Trạng thái** dạng `map17-verified; object-catalog=<n>; dig-menu-verified|pending; material-ids=[…]|pending`.
2. **Bảng đối tượng**: `id | name | type | idMenu[]` (từ `specials`).
3. **Bảng menu**: `idMenu | caption | tx | rx quan sát được | kết luận` (ví dụ `7 | "Đào" | -61 | -67 | đào gỗ`).
4. **Bảng vật phẩm**: `id | name (nếu có) | qty delta mỗi lần đào`.
5. **Hash/phiên bản**: APK SHA-256 (`401b17880bacd1270188bdfdbb8a3fa0f1ed6a78b6fd58d28c8780d639979f4e`), CityMap SHA-256 (`e3fc3c12…`), timestamp capture.
6. **Giới hạn bằng chứng**: chỉ area đã chạy, chỉ số lần đã chạy (≤1 lần ghi/phiên), không suy rộng cho map/area khác.

> Phase C **chỉ được implement khi** mục 3 (`dig-menu-verified`) và mục 4 (`material-ids`) đã có giá trị thực; nếu chưa, Phase C dừng ở trạng thái “protocol pending”.

### 3.4 Phase C — Tự động hoá production `auto_mining`

> Gate: **chỉ mở khi** evidence Phase B có `dig-menu-verified` và `material-ids` thực.

#### 3.4.1 Data contracts & interfaces

**`avatar-web/server/src/game/miningCatalog.ts` (tạo mới, dữ liệu copy từ evidence — không đoán):**

```ts
import type { NativeParkJoinPosition } from './parkService.js';

export interface MiningObject {
  id: number;            // id đối tượng trên map (ItemMapSpecial.id)
  name: string;          // tên do server cấp (vd "Gốc cây", "Mỏ đá")
  type: number;          // ItemMapSpecial.type
  menus: Readonly<Record<string, number>>; // key logic -> idMenu (vd { dig: 7, chop: 3 })
}

export interface MiningMaterial {
  id: number;            // id vật phẩm trong inventory/CONTAINER (vd gỗ/đá)
  name: string;
}

export interface MiningCatalog {
  map: 17;
  areas: readonly number[];      // chỉ các area đã capture trong Phase B
  join: NativeParkJoinPosition;  // { x: 100, y: 100 }
  objects: readonly MiningObject[];
  materials: readonly MiningMaterial[];
}

export const VERIFIED_MINING_CATALOG: Readonly<MiningCatalog> = Object.freeze({
  map: 17,
  areas: Object.freeze([]),       // điền sau Phase B; mảng rỗng = từ chối chạy
  join: Object.freeze({ x: 100, y: 100 }),
  objects: Object.freeze([]),
  materials: Object.freeze([]),
});
```

**`MiningConfig` (persist vào `mining_config_json` của `avatar_automation_state`):**

```ts
export interface MiningConfig {
  enabled: boolean;
  area: number;                  // 1 giá trị trong catalog.areas
  objectName?: string;           // match chính xác tên đối tượng; ưu tiên hơn objectId
  objectId?: number;
  menuKey: 'dig' | 'chop';       // key trong MiningObject.menus
  maxActionsPerCycle: number;    // cứng: tối đa hành động mỗi chu kỳ (mặc định 20)
  maxCycles: number;             // 0 = vô hạn cho tới khi user stop
  actionCooldownMs: number;      // mặc định 3000, tối thiểu 1500
  targetMaterialIds: number[];   // chỉ đếm các id này; hành động ngoài catalog = lỗi và dừng
}
```

**`MiningRuntime` (state bộ nhớ trong `avatarSession.ts`, push qua WS):**

```ts
export interface MiningRuntime {
  phase: 'idle' | 'joining' | 'opening' | 'digging' | 'waiting' | 'stopped' | 'error';
  startedAt: number | null;
  actionsDone: number;
  cyclesDone: number;
  materialsGained: Record<number, number>; // materialId -> tổng qty nhận trong phiên
  lastObjectId: number | null;
  lastError: string | null;
}
```

#### 3.4.2 Luồng 1 lượt đào (`autoMining.ts` — module mới)

```text
guard catalog.areas rỗng/object không match ⇒ dừng + báo "catalog chưa verify"
  └─► joinParkWithRetry(client, 17, area)                (reuse, cooldown chống anti-spam)
  └─► đọc snapshot: tìm object theo (objectId ?? match chính xác objectName)
      └── không thấy ⇒ chờ cooldown, thử lại N lần rồi dừng (không spam join)
  └─► farm.communicate(objectId)                          TX -59 [i32]
      └── chờ RX -101/-62/-70/-71 (timeout 6s); không có ⇒ dừng lượt
  └─► farm.doMenuOption(objectId, idMenu, -1)             TX -61 [i32][i8][i8]
      └── chờ RX -67/-17 (timeout 6s)
  └─► farm.getInventory() → đối chiếu delta theo targetMaterialIds
      ├── khớp ⇒ cộng materialsGained, cooldown, lượt tiếp theo
      ├── RX unknown cmd ⇒ log unknownRx, tiếp tục (không crash)
      └── không có RX vật phẩm ⇒ uncertain: dừng chu kỳ, KHÔNG gửi lại
```

Hard limit: ≤ `maxActionsPerCycle`/chu kỳ; ≥ `actionCooldownMs` giữa 2 lần ghi; TX `-59`/`-61` mỗi object ≤ 1/lượt; không retry tự động trên cùng object.

#### 3.4.3 Wiring mode mới (danh sách file phải chạm — cho AGENTS Plan)

| # | File | Thay đổi |
|---|---|---|
| 1 | `avatar-web/server/src/db/index.ts` | Migration CHECK constraint: thêm `'auto_mining'` + cột `mining_config_json TEXT` (pattern `:41-80`) |
| 2 | `avatar-web/server/src/session/automationTypes.ts` | Union mode + `MiningConfig` + `MiningRuntime` |
| 3 | `avatar-web/server/src/accounts/automationRepo.ts` | `setDesiredMode`/persist config (mở rộng giống `fishing_config_json`), allowlist ở `:316` |
| 4 | `avatar-web/server/src/session/routes.ts` | `POST /:id/automation/start` accept `'auto_mining'` (`:290-303`); thêm `MINING_DISABLED` guard theo pattern `FIND_NPC_DISABLED` (`:300-303`) |
| 5 | `avatar-web/server/src/session/avatarSession.ts` | Nhánh `auto_mining` cạnh `:1708/:1769`, runtime, WS log/push trạng thái |
| 6 | `avatar-web/server/src/session/manager.ts` | Danh sách mode cần restart (`:244-248`, `:316`) |
| 7 | `avatar-web/server/src/autoMining.ts` | Module loop (mới) |
| 8 | `avatar-web/server/src/game/miningCatalog.ts` | Catalog từ evidence (mới) |
| 9 | `avatar-web/server/src/game/parkService.ts` | Thêm `17: {x:100,y:100}` (D1); cân nhắc entry `8` (D1) |
| 10 | `avatar-web/server/src/game/client.ts` | Decoder RX `-101` (menu) và `-67`/`-17` (container delta) + emit event cho `autoMining` |
| 11 | `avatar-web/web/src/accounts/panels/MiningPanel.tsx` | UI tối thiểu (Phase C2, optional): toggle + counters |
| 12 | `.env.example`/README | `MINING_WRITE_ENABLED=false` mặc định (D4) |

#### 3.4.4 Safety guards (bắt buộc, không thương lượng)

1. `MINING_WRITE_ENABLED` (env, default `false`): mọi TX `-59`/`-61` trong production **chỉ** gửi khi flag này bật; chỉ đáng bật khi Phase B xong.
2. `MINING_DISABLED` kill-switch trong code (pattern `FIND_NPC_DISABLED` của `routes.ts`).
3. Stop tức thì khi: dialog từ chối E3, state uncertain E4, socket đóng E5, object biến mất, material ngoài `targetMaterialIds`.
4. Anti-cheat: reuse `PARK_JOIN_COOLDOWN_MS`; cooldown tối thiểu 1500ms giữa 2 lần ghi; không join dồn; một lượt duy nhất tại một thời điểm (không song song trên cùng account).
5. Không bao giờ mở phiên thứ 2 trên cùng account trong tool/macro (dùng session hiện có qua `/api` thay vì tạo `GameClient` mới).

### 3.5 Quyết định cần user duyệt (User Review Gate)

| # | Quyết định | Khuyến nghị trong spec | Nếu đổi |
|---|---|---|---|
| **D1** | Sửa namespace toạ độ Park | Thêm `17: {x:100,y:100}`; **xoá** entry `8` (vì `8` là CityMap node id = Ngoại ô, không phải roomID 8; J2ME list ID 8 = “Khu 4 con vịt”; không có caller nào dùng map 8) | Giữ `8` + comment cảnh báo nếu bạn lo rủi ro regression |
| **D2** | Gating các bước ghi Phase A | `--open-menu`/`--select-menu` opt-in, hard cap 1 lần ghi/lần chạy, mỗi bước cần approve riêng | Gộp A2+A3 vào 1 lần chạy (nhanh nhưng tăng rủi ro) |
| **D3** | Redaction | Whitelist đọc/in caption menu + item id/qty cho `-101/-61/-62/-70/-71` ở Phase A/B (§3.2.3) | Giữ chính sách cũ “chỉ cmd/len” ⇒ **không thể** chốt menu “Đào”, Phase C không làm được |
| **D4** | Cờ ghi production | `MINING_WRITE_ENABLED=false` mặc định; bật thủ công sau Phase B | Bật mặc định cho tiện (không khuyến nghị) |
| **D5** | Nguồn hằng số | Mọi id/menu/item chỉ lấy từ evidence doc; catalog rỗng = từ chối chạy | Cho phép nhập tay (không khuyến nghị — dễ ban tài khoản vì sai id) |
| **D6** | UI Phase C2 | `MiningPanel.tsx` tối thiểu (toggle + counters) | Bỏ UI, chỉ điều khiển qua API + log |

### 3.6 Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Anti-cheat (`detectHackTeleport`/`detectHackSpeed`) | Trung | Cooldown ≥1500ms, không spam, stop ngay khi dialog lạ (§2.4) |
| Server đổi `idMenu`/object mỗi phiên | Trung | Match theo tên + id; sai khớp ⇒ dừng (D5) |
| Đào không về vật phẩm (uncertain) | Trung | E4: dừng chu kỳ, không resend |
| Entry `8` phá vỡ caller chưa biết | Thấp | `grep` toàn repo trước khi xoá trong Phase Plan; `gitnexus_detect_changes` trước commit |
| Live probe đá phiên đang chạy | Cao | Guard `assertAvatarWebStopped` + chạy khi web dừng cùng account (§3.2.4) |

---

## 4. Verification Plan

1. **Static (mọi phase, không cần account live):**
   - `cd avatar-web/server && npm run typecheck && npm run build && npm test`
   - `gitnexus_impact` cho các symbol sửa: `NATIVE_PARK_JOIN_POSITIONS`, `ParkService.doJoinPark`, `avatarSession` mode wiring, `avatar_automation_state` migration.
2. **Phase A1 (read-only):** chạy probe `--map 17 --area 0` → `decode:'ok'`, `specialCount ≥ 0`, JSON đúng schema §3.2.5; không có TX nào ngoài `-1/90/80`.
3. **Phase A2/A3 (opt-in):** mỗi bước ≤1 lần ghi; `menuEntries` chứa caption tiếng Việt và `idMenu` khác nhau theo object; `itemDelta` hiển thị id + qty; log không rò credential.
4. **Phase B:** evidence doc đủ 6 mục §3.3; `dig-menu-verified` + `material-ids` là điều kiện mở Phase C.
5. **Phase C:** chạy bounded 5 lượt đào trên account test với `MINING_WRITE_ENABLED=true`; `actionsDone/materialsGained` đúng delta kho; stop/cancel idempotent; disconnect giữa chừng ⇒ không resend; `GET /api/accounts/:id/traffic` sạch (không còn cmd lạ).
6. **Regression:** các mode `auto_farm`/`find_npc`/`auto_fishing`/`auto_fisherman_quest` qua `npm test` + smoke boot; migration DB cũ vẫn lên được nhờ `addColumn`-style.
7. **Kết thúc:** `gitnexus_detect_changes()` chỉ chạm đúng file §3.4.3; chạy `npx gitnexus analyze` để refresh index.

---

## 5. Phụ lục bằng chứng điều tra (2026-09-16)

- Map Khu ngoại ô: `gs_0.java:3321` (“ID 17: Khu ngoại ô”), CityMap node 8 (`npc-map-probe-evidence-2026-08-25.md:36`), string `0x1B419E8`.
- `doMenuOption/doCommunicate`: `iladis` → `cmd 0xc3(-61) writes=[Int,Byte,Byte]`, `cmd 0xc5(-59) writes=[Int]`; `dump.cs:274576-274588` (`0x69C8B0`, `0x69D070`); port sẵn trong `farmService.ts:69-80`.
- `ItemMapSpecial` (`id/idMenu/type`): `dump.cs:269127-269148`; `ADD_MENU=-101` (`dump.cs:272989`).
- Không có `gỗ/đào/khai thác` trong string literal Unity và J2ME (chỉ `đá` dạng item trong auto client: `d_0.java:264`, `fi_0.java:74`, `an.java:66,369`).
