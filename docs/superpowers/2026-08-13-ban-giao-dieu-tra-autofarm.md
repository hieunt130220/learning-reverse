# Bàn giao: auto-farm và điều tra rớt kết nối — 2026-08-13

Ghi cho phiên làm việc kế tiếp. Nhánh: `feat/avatar-web-dashboard-drawer`.

## 1. Đã xong và đã commit

| Commit | Nội dung |
|---|---|
| `9925e6e` | Spec nhịp nghỉ / thứ tự / log |
| `644d887` | Kế hoạch triển khai |
| `7790243` | `AutoFarm` phát sự kiện `log`, `AvatarSession` nối vào `pushLog` |
| `d46ecd6` | Bỏ `maxActionsPerCycle`; giữ `maxSellsPerCycle` |
| `e6541c5` | Gộp hai vòng lặp ô thành giai đoạn cây, nhịp nghỉ cho cả ô rảnh |
| `b6039a3` | Gộp bốn vòng lặp vật nuôi thành một lượt duyệt index giảm dần |

Trước đó cùng nhánh: `236b5d4` dashboard card + drawer cho `avatar-web/web`.

Kiểm chứng: server `npm test` 159/159 pass, `npm run typecheck` pass. Quan sát phiên
thật xác nhận nhịp 701/702ms, mỗi ô một dòng log, cây trước vật nuôi, vật nuôi giảm dần.

Phụ phẩm: việc gộp vòng lặp sửa một lỗi có sẵn — trước đây bán chạy trước rồi
chữa/cho ăn duyệt lại từ ảnh chụp cũ, nên sau một lần bán các lệnh sau trỏ nhầm con.

## 2. Thay đổi TẠM còn trong worktree, chưa commit

Phải gỡ hoặc chuyển thành bản sửa thật:

- `session/avatarSession.ts` — `console.log` trong `pushLog` (đẩy nhật ký ra stdout).
- `game/client.ts` — `console.log` dump hex gói 69.
- `autoFarm.ts` — cờ `REFRESH_AT_END = false` tắt bước `enterFarm` cuối vòng.

⚠ Worktree còn có **công việc song song của phiên khác** (`accounts/autoConfig.ts`,
`accounts/farmProfileRepo.ts`, `db/schema.sql`, và một refactor lớn của `autoFarm.ts`
thêm `AutoFarmClient` + `treeCellPlan`). **Không được ghi đè.**

## 3. Phát hiện lớn nhất: giải mã gói 69 lệch 4 byte

Phần vật nuôi dùng **cùng quy ước với ô đất**: 1 byte id, `-1` = slot trống, không có
bản ghi theo sau. `farmData.ts` đọc `species` bằng `readUnsignedByte()` mà **thiếu nhánh
kiểm tra -1**, nên nuốt byte sentinel làm dữ liệu và lệch toàn bộ phần sau.

Bố cục thật, đo trên gói 572 byte của tài khoản `0979198175`:

```
0    i32 idFarm = 1005161
4    i8  nCell = 46
5    46 × ô:  i8 idTree (-1 = trống, chỉ 1 byte)
             i16 time, i8 vitalityPer, i8 hervestPer, 3 × bool
366  i8  nAnimal = 16          ← số SLOT, không phải số con
367  ff ff ff ff               ← 4 slot trống (4 con rùa đã bán)
371  12 × 11 byte:  i8 species, i32 bornTime, i8 health,
                    i8 harvestPer, i8 numEggOne, bool hunger, bool f20, bool f21
503  đuôi: i8 2, i8 2, 7 × i16, 46 × i8 level, ffffffff 000001
```

Bằng chứng khoá: sau 12 bản ghi, phần đuôi cho ra **đúng 46 byte level** cho 46 ô rồi
hết gói. Lệch một byte là con số đó vỡ.

| | Code hiện tại | Sau khi sửa | Người dùng xác nhận trong game |
|---|---|---|---|
| loài | 255, 0, 46 | 50 (Gà) cả 12 con | — |
| máu | 0 | 100 | full máu ✓ |
| số con | 16 | 12 | 4 slot trống = 4 rùa đã bán ✓ |
| f20 / f21 | rác | 7 con / 10 con | đang bị bệnh ✓ |

Server **giữ chỗ trống chứ không dồn mảng** sau khi bán ⇒ `index` trong lệnh là số slot.

Gói hex mẫu nằm trong log phiên (`HEX69 …`); nếu cần bắt lại thì thêm tạm dòng dump ở
`GameClient.onMessage` cho `msg.command === 69`.

## 4. Việc còn mở, theo thứ tự đề xuất

1. ~~**Sửa decode 4 byte**~~ — ✅ XONG (chưa commit, xem §7).
2. **Thuốc đúng bệnh** — `flag20`/`flag21` được giải mã rồi **không nơi nào dùng**.
   Bảng vật phẩm: `#120 Thuốc cúm`, `#121 Thuốc tiêu chảy`, `#122 Thuốc bổ`.
   Auto chỉ biết `máu < minHealth → #122`, nên bắn thuốc bổ vào con full máu đang bệnh
   và ăn 60 lần `"Không cần thuốc bổ"` mỗi vòng. Ánh xạ f20→120, f21→121 **chưa kiểm chứng**.
3. **Điều kiện thu hoạch** — cả 46 ô đều `hervestPer = 0`, nhưng ô 45 (`time=2938`) thu
   được còn ô 44 (`time=2836`) thì không. Lúa `growMinutes=48` (đơn vị **giờ** → 2880
   phút) khớp cả hai. Giả thuyết: `time >= growMinutes × 60`. Cần thu thử ô 45 để chốt.
4. **Mua bù vật nuôi sau khi bán** (yêu cầu mới). `farmService.buyAnimal(idAnimal, typeBuy)`
   đã có sẵn (cmd 51) nhưng auto chưa gọi. Ba ẩn số: `typeBuy` có cùng quy ước `1 = xu`
   không, giá vật nuôi lấy ở đâu (bảng loài không có giá; có `requestPriceAnimal` nhưng
   gói trả về chưa giải mã), mua loài nào với trần chi bao nhiêu.
5. **Trồng lại** — không phải lỗi code: config thiếu `seedId` nên bị tắt. Điền id hạt
   trong panel là xong.

## 5. Điều tra rớt kết nối — chưa xong

Triệu chứng: phiên game chết đều đặn, server game **chủ động gửi FIN** (`kind=remote-end`),
`trạng thái=online`. Backoff kẹt ở nấc đầu (~10s) vì `onOnline()` đặt `retries = 0` ngay
khi chạm online, nên một phiên sống 4 giây vẫn bị tính là thành công.

Đã loại bằng bằng chứng:

- **Dồn lệnh quá nhanh** — 150 lệnh trong 110 giây không hề gì.
- **`tsx watch` nạp lại / 6 tiến trình mồ côi** — đã kill sạch, vẫn chết.
- **`enterFarm` lần thứ hai** — bỏ bước làm mới cuối vòng thì phiên sống 114s → 163s và
  điểm chết dời đi, nhưng vẫn chết ⇒ chưa đủ.

Hai chữ ký cái chết khác nhau:

| | `im lặng` | Bối cảnh |
|---|---|---|
| A (2 mẫu) | 0ms / 7ms | server trả lời `enterFarm` lần 2 rồi FIN tức thì |
| B (1 mẫu) | 28250ms | 28 giây sau trao đổi cuối, giữa lúc nghỉ |

**Phép đối chứng chưa ai chạy:** một phiên **không bật auto** sống được bao lâu? Notes cũ
ghi 361 giây với keep-alive 45s nhưng đo bằng tool riêng, không qua backend này. Nếu phiên
không-auto cũng chết ở 2–3 phút thì auto-farm vô can và phải tìm ở tầng kết nối.

Cách chạy: bấm **Kết nối** trong UI, **giữ auto tắt**, rồi đo. `auto_enabled` hiện = 0
trong DB nên `bootstrap()` không tự nối tài khoản nào.

## 6. Đã làm ở phiên 2026-08-13 (chiều) — decode gói 69

Làm theo TDD: test đỏ trước bằng gói thật, rồi mới sửa. **Chưa commit.**

| File | Thay đổi |
|---|---|
| `game/farmData.fixture.ts` | MỚI — gói 572 byte thật, kèm xuất xứ |
| `game/farmData.test.ts` | MỚI — 4 test, đều đỏ trước khi sửa |
| `game/farmData.ts` | Nhánh `species === -1`; đọc `readByte` có dấu; slot trống bị bỏ qua nhưng `index` giữ nguyên số slot |
| `game/client.ts` | `INFO_ANIMAL` tra bằng `find(a => a.index === …)` thay cho `animals[a.index]` |
| `game/client.test.ts` | Test cho đúng chỗ đó — đỏ trước khi sửa |
| `tools/farm-diag.ts` | Hai chỗ đọc lại theo vị trí mảng, sửa theo |
| `autoFarm.ts` | CHỈ sửa comment sai, không đụng logic |

Kiểm chứng: 65/65 pass trên `farmData`, `client`, `autoFarm`, `avatarSession`; `npm run typecheck` pass.

**Hệ quả cần nhớ:** `FarmAnimal.index` là **số slot**, không phải vị trí trong mảng.
Hai số này lệch nhau ngay khi farm từng bán con nào. Tra bằng `find`, đừng `animals[i]`.

Đính chính §3: bảng cũ ghi f20/f21 là "7 con / 10 con". Đếm lại trên chính gói đó thì
đúng ra là **3 con f20, 7 con f21** — số cũ lấy từ lần đọc còn lệch.

⚠ `session/routes.test.ts` **treo** (không kết thúc) nên `npm test` cả suite chạy không
xong. Không phải do thay đổi này: file đó không đụng `animals`/`farmState`, và
`session/routes.ts`, `manager.ts` cùng test của chúng đang được **phiên khác sửa dở**
ngay lúc đó. Chạy cả suite lại sau khi phiên kia xong.

## 7. Môi trường

- Server dev đang chạy bằng `npm run dev` do phiên trước khởi động, log đổ ra file tạm.
  Đã dọn 6 supervisor `tsx watch` mồ côi từ hôm trước (chúng phớt lờ SIGTERM, phải `kill -9`).
- Index GitNexus đang stale — chạy `node .gitnexus/run.cjs analyze` khi cần.
