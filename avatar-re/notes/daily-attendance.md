# Daily Attendance Protocol

## APK identity and artifacts

- Native artifact: `avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so`
- Format: stripped ARM64 ELF; Build ID `f81b2f451aedba60b8779bc0ae5cbeff33d32b02`.
- SHA-256: `542cf8a05129debaa3137311db69065413d124189d9dad93ba50e359aca8df9d`.
- `stringliteral.json` has no case-insensitive match for `daily.*reward`, `reward.*login`, `getRewardDailyLogin`, or `RewardLogin`.

## UI and native symbols

- `mResources.getRewardDailyLogin`: `dump.cs:271475`, field offset `0xDA8`.
- `mResources.RewardLogin`: `dump.cs:271476`, field offset `0xDB0`.
- `DailyRewardScr.IActionGetReward.perform`: `dump.cs:278084-278085`; `script.json:357549-357553`; decimal `7844036`, RVA `0x77B0C4`.
- `DailyRewardScr.setInfo(MyVector list, string time)`: RVA `0x8ACEBC`.
- `DailyRewardScr.switchToMe()`: RVA `0x8AD544`.
- `DailyRewardScr.init()`: RVA `0x8AD1C0`.
- Stored item fields: `id:int/i32`, `idIcon:int/i32`, `num:int/i32`, `isGet:bool`, `isCanGet:bool` (`dump.cs:278095-278099`). The constructor parameter `icon` is `short/i16` (`dump.cs:278107-278108`), but it is converted and stored in the `int/i32` `idIcon` field; constructor parameter width is not the stored-field width or a verified wire width.

## Claim TX static call path

Trace from RVA `0x77B0C4`. Reproducible native range: `/usr/bin/objdump -d --start-address=0x77b0c4 --stop-address=0x77b1c4 avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so` (stop is the next method, `IActionGetReward..ctor`):

1. `0x77B104` -> `DailyRewardScr.gI` (`0x8ACD3C`).
2. `0x77B120-0x77B12C` loads `listReward` at offset `0x50` -> `MyVector.size` (`0xB5607C`).
3. Loop: `0x77B13C` -> `gI`; `0x77B144` reloads list; `0x77B154` -> `MyVector.elementAt` (`0xB56058`).
4. `0x77B188` reads byte offset `0x1D`, matching `isCanGet`.
5. If nonzero, `0x77B190-0x77B198` loads a static object -> `Out.println` (`0xB571AC`).
6. Loop continues.

No service method, `Message..ctor`, `myWriter.write*`, or `Session_ME.sendMessage` occurs in this body. `pktsig.py` prints no signature. The static `Out.println` argument could not be named and is not treated as a command. Claim sender chain is unresolved.

## State-query TX static call path

`switchToMe` (`0x8AD544`) exact method range was inspected with `/usr/bin/objdump -d --start-address=0x8ad544 --stop-address=0x8ad630 avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so` (stop is next method, `paint`). It has no resolved service, `Message..ctor`, writer, or sender call. The tail branch at `0x8AD62C` targets unnamed helper `0x56F1B4`. State-query TX is unresolved.

## RX handler static call path

`xrefs.py` reports zero direct ARM64 `BL`/`B` call sites for both `setInfo` and `switchToMe`. `setInfo` exact method range was inspected with `/usr/bin/objdump -d --start-address=0x8acebc --stop-address=0x8ad1c0 avatar-re/apk_extracted/lib/arm64-v8a/libil2cpp.so` (stop is next method, `init`). `setInfo` calls `init` at `0x8ACF48` but contains no `myReader.read*`. No exact RX handler or reader order/width was recovered.

## Candidate wire contract — awaiting packet verification

**Đã thay bằng contract xác minh qua live probe (xem Packet evidence):**

| Direction | Command | Ordered fields | Confidence |
|---|---:|---|---|
| Claim TX | -61 (MENU_OPTION) | `i32 userID=21`, `i8 menuIndex=0`, `i8 subIndex=0` — cần `communicate(90)` ngay trước | ✅ live 2 runs |
| State-query TX | không tồn tại | menu báo danh chỉ có mục claim; trạng thái trả về trong chính dialog claim | ✅ |
| RX result | -40 (dialog chung) | `utf text` tiếng Việt, phân loại theo regex ở dưới | ✅ live cả 2 ca |

Lưu ý: userID 21 nằm cùng họ với các chuỗi quest đã biết (19 Tân Thủ, 35 Nhà Nông, 38 Thợ Câu, 20 Tháng 7, 46 Tiền Sử).

## Production gate

PRODUCTION GATE: PASS

Claim TX (doMenuOption(21,0,0) sau communicate(90)) và cả hai semantics claimed / already-claimed
đều được xác minh bằng packet thật trên server game ngày 26/08 (2 runs). Production code PHẢI dùng
đúng literal này và phân loại result theo regex ghi ở mục Packet evidence.

## Capture matrix A–E

- A: Open screen before claiming; capture request/full response.
- B: Claim available reward; capture request/success response.
- C: Reopen after claim; capture claimed state.
- D: Attempt already-claimed/not-eligible claim; capture failure.
- E: Compare another account/day eligibility state to locate changing IDs, counters, timestamps.

## Packet evidence

### Bước ngoặt: "Báo danh hàng ngày" là mục menu NPC do SERVER gửi

- `DailyRewardScr` (setInfo/switchToMe/gI) **không có bất kỳ caller BL nào trong toàn bộ libil2cpp.so** (đã quét full disassembly map qua script.json) → màn hình này là dead code trong build APK 3.4.4.
- Menu cmd -61 là text SERVER gửi (xem `notes/quest-discovery.md` §3), nên "Báo danh hàng ngày" là mục menu của NPC Lái buôn với một userID riêng — giống hệt cơ chế quest Tân Thủ (19)/Nhà Nông (35).

### Live probe qua avatar-web GameClient (2026-08-26)

Probe: `communicate(90)` + sweep `doMenuOption(uid, 0, 0)` uid 1..30, bắt dialog cmd -40 kèm attribution uid.

**TX đã xác minh:**

```text
cmd -61 body: writeInt(21).writeByte(0).writeByte(0)
→ userID = 21 chính là "Báo danh hàng ngày"
```

**RX đã xác minh (cmd -40, `utf text`):**

| Ca | Ngày | Text server |
|---|---|---|
| Claim lần 1 trong ngày (lần đầu tiên) | 26/08 run 1 | "Chúc mừng bạn đã báo danh lần đầu tiên trong ngày thành công. Bạn nhận được phần quà cấp 1 đó là 1 thẻ quay số miễn phí và Thun Nữ 30 ngày. Bạn sẽ nhận được điểm chuyên cần nếu báo danh đủ 2 lần trong ngày, mỗi lần cách nhau 8 giờ" |
| Already-claimed (lần 2 cùng ngày) | 26/08 run 3 | "Bạn đã báo danh lần đầu trong ngày hôm nay. Vui lòng quay lại sau 7 giờ 44 phút 27 giây để báo danh lần 2 và nhận điểm chuyên cần nhé" |

Quan sát thêm:

- Server cho phép báo danh **2 lần/ngày**, cách nhau ≥ 8 giờ; đủ 2 lần mới có điểm chuyên cần.
- Phần thưởng là text mô tả trong dialog; KHÔNG thấy gói reward cấu trúc riêng (ví/kho thay đổi qua các gói UPDATE_MONEY/-3 và inventory 70 thông thường nếu quà là xu/item).
- Các dialog khác xuất hiện khi sweep: uid 7/8 (chế độ tin nhắn, mã giới thiệu), uid 18 (kim cương), uid 22 (rương cấp), uid 30 (thành tích) — không nhầm với báo danh.
- Không retry: mỗi claim chỉ gửi đúng một doMenuOption; server tự chặn theo giờ.

### Cách phân loại result

- `claimed`: text khớp `/báo danh.*thành công/i`
- `already-claimed`: text khớp `/đã báo danh/i`
- khác: `rejected` với reason = text gốc.

## Semantic result mapping

Đã xác minh bằng packet thật ở bảng trên: claimed và already-claimed đều trả về qua cmd -40 dạng văn bản tiếng Việt; không có mã lỗi cấu trúc.

## Reward/state evidence

- UI receives `MyVector list` and `string time`.
- Reward item stored fields include `id:int/i32`, `idIcon:int/i32`, `num:int/i32`, `isGet:bool`, and `isCanGet:bool`; only the constructor's incoming `icon` parameter is `short/i16`.
- Claim action iterates items and gates on `isCanGet` offset `0x1D`.
- C# field types are not asserted as wire widths without direct reader calls.

## Unresolved fields

- Exact claim service method, command, and payload.
- State-query command and payload.
- RX dispatcher/handler and reader order.
- Static string passed to `Out.println`.
- Potential metadata/interface/delegate/reflection or unmapped paths missed by direct xrefs.
- Semantic codes and state transitions.
- Capstone `iladis.py` unavailable: no existing environment contained Capstone; system `python3` raised `ModuleNotFoundError`; no dependencies were installed. `/usr/bin/objdump` plus `script.json` resolution was used as fallback.

## Production gate (kết luận cuối)

PRODUCTION GATE: PASS — xem mục "Production gate" ở trên; mục BLOCKED cũ dưới đây chỉ là lịch sử static phase trước khi có packet.

<details><summary>Lịch sử: static phase (đã superseded)</summary>

PRODUCTION GATE: BLOCKED
Reason: packet matrix A–E has not yet verified claim success and already-claimed responses.

</details>
