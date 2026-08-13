# Thiết kế: nhịp nghỉ đều, thứ tự cây trước vật nuôi và log từng bước cho auto-farm

Ngày: 2026-08-13
Phạm vi: `avatar-web/server/src/autoFarm.ts`, `avatar-web/server/src/session/avatarSession.ts`

## 1. Bối cảnh

Một vòng auto-farm hiện chỉ nghỉ `stepDelayMs` sau mỗi lệnh **đã gửi**. Ô hoặc
con không có việc bị bỏ qua tức thì, nên nhịp phát lệnh lúc dày lúc thưa tùy
trạng thái nông trại. Thứ tự công việc cũng đan xen: hai vòng lặp ô nằm ở hai
đầu chu kỳ, bốn vòng lặp vật nuôi kẹp ở giữa. Nhật ký chỉ có `lastActions` của
vòng gần nhất, không mốc giờ, chỉ thấy được sau khi vòng chạy xong.

Thiết kế này ra đời trong lúc điều tra sự cố rớt kết nối. Bằng chứng đo được
ngày 2026-08-13 cho thấy phiên game chết sau 4–19 giây **cả khi auto chưa chạy**
(`kind=remote-end`, server gửi FIN trước, `im lặng 0ms`), nên auto-farm không
phải nguyên nhân và thiết kế này **không phải bản sửa sự cố đó**. Giá trị của nó
với việc điều tra là nhật ký có mốc giờ thật cho từng bước: lần rớt kế tiếp sẽ
chỉ ra chính xác lệnh cuối cùng trước khi server đóng kết nối.

## 2. Mục tiêu

1. Nhịp nghỉ áp cho mọi đối tượng được duyệt, kể cả khi không gửi lệnh nào.
2. Làm hết phần cây trồng rồi mới sang vật nuôi.
3. Mỗi ô và mỗi con chỉ được chạm đúng một lần trong một vòng.
4. Mỗi đối tượng đã duyệt sinh một dòng nhật ký có mốc giờ thật, chạy live.
5. Bỏ trần số lệnh mỗi vòng; một vòng làm hết việc đang tồn đọng.

## 3. Không thuộc phạm vi

- Không sửa nguyên nhân rớt kết nối; nguyên nhân chưa xác định.
- Không đổi opcode, gói tin hay bất kỳ hành vi giao thức nào.
- Không đổi REST API, schema SQLite hay hợp đồng WebSocket.
- Không đổi điều kiện quyết định (khi nào thu hoạch, khi nào bán, mua bao nhiêu).
- Không đụng `MacroRunner`, `GameClient` hay tầng `Session`.
- Không thêm jitter ngẫu nhiên vào nhịp nghỉ. Nhịp vẫn là hằng số `stepDelayMs`.

## 4. Quyết định thiết kế

| Câu hỏi | Quyết định |
|---|---|
| Trần `maxActionsPerCycle` | Bỏ hẳn |
| Trần `maxSellsPerCycle` | Giữ nguyên |
| Đơn vị nhịp nghỉ | Mỗi ô/con một nhịp, cộng một nhịp cho mỗi lệnh gửi |
| Thứ tự | Mua bù → toàn bộ cây → toàn bộ vật nuôi |
| Chiều duyệt vật nuôi | Index giảm dần |
| Đích của log | Nhật ký phiên (có mốc giờ, live) và `lastActions` |
| Độ chi tiết log | Mọi ô/con đã duyệt, kể cả "không có việc" |

## 5. Cấu trúc một vòng

```text
chuẩn bị   enterFarm → chờ gói farm
           getInventory → chờ kho
           (nếu bán vật nuôi và chưa có bảng) getTreeInfo → chờ
           dòng [quét] tổng kết và dòng [tắt] như hiện nay
           dòng [đo] bornTime như hiện nay
mua bù     giữ nguyên vị trí đầu tiên
cây        duyệt từng ô tăng dần:
             thu hoạch → trồng → tưới → nhổ cỏ → bắt sâu → bón phân
vật nuôi   duyệt từng con giảm dần:
             thu sản phẩm → chữa bệnh → cho ăn → bán
kết thúc   enterFarm làm mới nếu vòng có gửi ít nhất một lệnh
```

Hai vòng lặp ô hiện tại gộp làm một. Bốn vòng lặp vật nuôi gộp làm một.

Mua bù giữ nguyên vị trí trước hai giai đoạn vì các bước dùng vật phẩm phải có
hàng trong kho trước khi dùng. Bước làm mới cuối vòng giữ nguyên điều kiện hiện
tại: chỉ chạy khi đã gửi ít nhất một lệnh, vì tưới nước không được server đẩy
kèm `INFO_CELL`.

## 6. Nhịp nghỉ

Một hàm nội bộ `tick()` thay cho `await sleep(stepDelayMs)` rải rác:

```ts
const tick = async (): Promise<void> => {
  await sleep(cfg.stepDelayMs);
};
```

Gọi ở đúng hai chỗ:

- sau mỗi lệnh gửi đi;
- sau khi xử lý xong mỗi ô/con, kể cả không gửi lệnh nào.

`tick()` chỉ chờ, không kiểm tra cờ dừng. Việc kiểm tra `this.aborted` giữ nguyên
dạng hiện có: một lần ở đầu mỗi lượt lặp, để `stop()` cắt được vòng đang chạy.

Một ô gửi 2 lệnh tốn 3 nhịp. Một ô không có việc tốn 1 nhịp.

Hệ quả về thời lượng, tính với `stepDelayMs = 700` và 46 ô:

| Tình huống | Thời lượng một vòng |
|---|---|
| Nông trại rảnh hoàn toàn | ≈ 32 giây |
| Bận vừa | ≈ 60–90 giây |
| Tồn đọng nặng (46 ô × 4 lệnh) | có thể vượt 120 giây |

Vòng kế tiếp chỉ được hẹn giờ sau khi vòng hiện tại kết thúc, nên hai vòng không
bao giờ chồng nhau; `intervalMs` là khoảng nghỉ giữa hai vòng, không phải chu kỳ
cố định. Đây là hành vi sẵn có, thiết kế này không đổi.

## 7. Chiều duyệt vật nuôi

Giai đoạn vật nuôi duyệt index **giảm dần**.

Lý do là ràng buộc sẵn có của lệnh bán: `index` là vị trí trong mảng `animals`,
nên bán một con làm mọi con có index cao hơn tụt xuống 1. Duyệt từ index cao
xuống thấp thì việc bỏ phần tử phía sau không làm xê dịch phần tử phía trước, và
index đọc từ ảnh chụp đầu vòng luôn còn đúng — đúng cả khi server để lại chỗ
trống thay vì dồn mảng.

Thu sản phẩm, chữa bệnh và cho ăn không phụ thuộc thứ tự, nên áp cùng một chiều
duyệt cho cả giai đoạn là an toàn và giữ được đúng một vòng lặp. Cái giá là nhật
ký vật nuôi đi từ con cuối lên con đầu.

Quy tắc "còn sản phẩm chưa lấy thì để vòng sau mới bán" giữ nguyên và vẫn xét
trên ảnh chụp đầu vòng, nên việc thu sản phẩm ngay trước đó trong cùng lượt
không làm con vật đủ điều kiện bán sớm hơn một vòng.

## 8. Bỏ trần số lệnh

Xóa `maxActionsPerCycle` khỏi `AutoFarmConfig`, khỏi `DEFAULTS`, xóa biến đếm
`sent` dùng cho việc chặn, hàm `overBudget()`, mọi nhánh `if (overBudget()) break`
và dòng "đã đạt trần … lệnh/vòng".

Vẫn giữ một biến đếm số lệnh đã gửi để quyết định có làm mới farm cuối vòng hay
không — đó là mục đích khác, không phải để chặn.

`maxSellsPerCycle` giữ nguyên: bán là thao tác không lấy lại được, trần này là
chốt an toàn cho một quyết định sai chứ không phải chốt chống flood.

Cấu hình cũ đã lưu trong SQLite không chứa `maxActionsPerCycle`, và một khóa lạ
trong JSON gửi lên chỉ bị bỏ qua, nên không cần migrate.

## 9. Nhật ký từng bước

`AutoFarm` phát thêm một sự kiện:

```ts
this.emit('log', line);
```

`AvatarSession.wire()` nối nó vào bộ đệm log sẵn có, cùng khuôn với các listener
khác, kèm kiểm tra epoch để client cũ không ghi vào phiên mới:

```ts
this.auto!.on('log', (line: string) => {
  if (this.isCurrent(client, epoch)) this.pushLog(line);
});
```

`pushLog` đã gắn mốc giờ, cắt đệm ở 500 dòng và phát sự kiện `log` qua WebSocket,
nên panel Nhật ký nhận được ngay mà không cần đổi gì phía web.

Mỗi dòng đi đồng thời vào `actions` (tức `lastActions` của panel Tự động) và
sự kiện `log`, qua một hàm duy nhất. Một nguồn, hai nơi hiện, không có hai mức
chi tiết để lệch nhau.

Định dạng:

```text
[cây] ô 12: chín 100% -> thu hoạch
[cây] ô 13: hạn -> tưới #100
[cây] ô 14: không có việc
[vật nuôi] 3 (Gà): đói -> cho ăn #116
[vật nuôi] 2 (Gà): không có việc
```

Một ô làm nhiều việc thì các việc nằm chung một dòng, ngăn bằng dấu phẩy, vì một
dòng là một đối tượng đã duyệt.

Dòng được phát **sau khi** xử lý xong đối tượng đó, ngay trước nhịp nghỉ chuyển
sang đối tượng kế tiếp. Vì vậy khi mất kết nối giữa vòng, dòng cuối cùng trong
nhật ký là đối tượng cuối cùng đã xử lý xong, và đối tượng ngay sau nó trong thứ
tự duyệt là nghi can. Độ phân giải này bằng một đối tượng, tức 0,7–2,1 giây với
`stepDelayMs = 700`.

Với 46 ô cộng đàn vật nuôi, một vòng sinh khoảng 50 dòng. Đệm 500 dòng giữ được
khoảng 10 vòng gần nhất. Đây là đánh đổi đã chấp nhận để thấy được nhịp đi từng
bước.

## 10. Kiểm thử

Ba test đang khẳng định hành vi trần lệnh phải viết lại vì hành vi đó bị bỏ:
`vòng đầu tiên chỉ gửi tối đa maxActionsPerCycle lệnh dù tồn đọng nhiều ô` và hai
test cùng nhóm ở `autoFarm.test.ts`. Thay bằng test khẳng định một vòng làm hết
việc tồn đọng.

Test mới:

1. Thứ tự: mọi lệnh thuộc nhóm cây đứng trước mọi lệnh thuộc nhóm vật nuôi.
2. Một ô, một con chỉ xuất hiện đúng một lần trong danh sách lệnh của một vòng.
3. Nhịp nghỉ áp cả cho ô không có việc: trên một farm rảnh có N ô, khẳng định
   thời gian chạy một vòng ≥ N × `stepDelayMs`. Đây là cận dưới suy ra từ chính
   số nhịp nên không phụ thuộc tốc độ máy.
4. Vật nuôi duyệt giảm dần: với hai con đủ điều kiện bán, lệnh bán index cao
   phải đi trước index thấp.
5. Sự kiện `log` phát ra đúng một dòng cho mỗi ô và mỗi con đã duyệt.
6. `AvatarSession` đẩy dòng `log` của auto vào snapshot và bỏ qua dòng đến từ
   client đã bị thay thế.

`stepDelayMs` tối thiểu 300ms và nhịp nay áp cho mọi đối tượng, nên test phải
dùng farm nhỏ; một farm 46 ô trong test sẽ tốn hơn 14 giây.

## 11. Tiêu chí hoàn thành

- Một vòng trên farm tồn đọng gửi hết việc, không còn dòng "đã đạt trần".
- Mọi lệnh nhóm cây đứng trước mọi lệnh nhóm vật nuôi trong một vòng.
- Ô và con không có việc vẫn tốn đúng một nhịp nghỉ.
- Panel Nhật ký hiện một dòng có mốc giờ cho mỗi ô và mỗi con, chạy live.
- `maxSellsPerCycle` vẫn chặn đúng số con bán mỗi vòng.
- `npm test` và `npm run typecheck` trong `avatar-web/server` pass.
- Không có thay đổi nào trong `avatar-web/web`.
