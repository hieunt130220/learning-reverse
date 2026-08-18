# Sạp mua bán nông sản trong nông trại AvatarHD

**Tác giả:** Manus AI  
**Phạm vi:** APK `AvatarHD_3.4.4_APKPure.apk`, mã IL2CPP đã khôi phục và mã máy chủ trong dự án `learning-reverse`.  
**Ngày tổng hợp:** 17/08/2026.

## 1. Xác định đúng game và tên tính năng

Game trong dự án là **AvatarHD**, package Android `com.TeaM.Avatar`, còn được giới thiệu công khai với tên **Avatar 2** của TeaMobi. Trang Google Play mô tả đây là game nông trại có tính năng mua bán cây trồng và hàng hóa tươi sống với hàng xóm, bạn bè thông qua “siêu thị của riêng bạn” [1]. Trang TeaMobi/Gomobi cũng mô tả cùng một mô hình: người chơi trồng trọt, chăn nuôi và mua bán hàng hóa với người chơi khác [2].

Trong phạm vi mã game, cần phân biệt ba khái niệm dễ bị gọi chung là “sạp”:

| Thành phần | Vai trò | Định danh trong mã | Có phải sạp người chơi không? |
|---|---|---|---|
| **Cửa hàng farm** | Mua hạt giống, vật nuôi, phân bón, thức ăn và thuốc để vận hành nông trại | `FarmScr.doOpenCuaHang()`, `BUY_ITEM=68` | Không; đây là cửa hàng hệ thống |
| **Kho hàng** | Lưu nông sản và vật phẩm sau khi thu hoạch | `FarmScr.goKhoHang()`, `getInventory()` | Không; đây là kho |
| **Siêu thị/sạp cá nhân** | Đăng nông sản để người chơi khác mua, hoặc mua hàng từ sạp khác | `ShopScr`, `AddItemShop`, `OPEN_SHOP_FARM=103` | **Có; đây là tính năng người dùng đang hỏi** |

Vì vậy, “sạp mua bán nông sản trong nông trại” chính xác nhất là **gian hàng cá nhân trong Siêu thị**, không phải `MarketScr`. Lớp `MarketScr` trong bản khôi phục chỉ là một màn hình chuyển tiếp rất mỏng (`setInfo`, `init`, `paint`, `update`, `close`); phần logic sạp thực tế nằm ở `ShopScr` và `AddItemShop` [6].

## 2. Sạp dùng để làm gì?

Theo tài liệu công khai, Siêu thị là nơi người chơi mua bán hoặc trao đổi nông sản; các giao dịch dùng **XU**. Nguồn hướng dẫn về AvatarHD ghi rõ phiên bản được khảo sát chỉ cho phép **bán nông sản** trong Siêu thị, một loại nông sản có thể được đăng với các mức giá và số lượng khác nhau [3]. Điều này phù hợp với cấu trúc mã: mỗi mặt hàng của sạp có `Id`, `num`, `price`, `name`, cờ `isSale`, cờ hết hạn `isTimeOut`, `IdShop` và `verShop` [6].

Mô hình chức năng có thể tóm tắt như sau:

> **Thu hoạch → nông sản vào kho → đăng nông sản lên một slot của sạp → người chơi khác mua → hàng bị trừ khỏi sạp và XU được xử lý bởi máy chủ.**

Sạp là một **marketplace giữa người chơi**, còn Cửa hàng farm là nơi mua vật phẩm từ hệ thống. Hai luồng này sử dụng các lệnh mạng khác nhau và không nên gộp thành một chức năng.

## 3. Các thao tác chính của sạp

| Thao tác | Ý nghĩa nghiệp vụ | Lệnh trong dự án | Dữ liệu gửi chính |
|---|---|---|---|
| Mở/xem sạp | Mở sạp của mình hoặc sạp người khác | Cmd `103`, sub-type mở | `type`, `step`, `idItem` |
| Mở khóa slot | Mua/mở thêm ô bán | Cmd `103`, sub-type `2` | `type` |
| Đăng hàng | Đưa nông sản từ kho vào slot | Cmd `103`, sub-type `3` | `slot`, `idItem`, `num`, `price` |
| Mua từ sạp | Người mua chọn hàng của sạp khác | Cmd `103`, sub-type `5` | `idShop`, `idItem` hoặc version slot |
| Lấy hàng về | Chủ sạp rút mặt hàng chưa bán | Cmd `103`, sub-type `4` | `slot` |
| Làm mới sạp | Yêu cầu cập nhật/làm mới trạng thái sạp | Cmd `103`, sub-type `7` | Không có payload thêm |
| Lấy danh sách hàng | Yêu cầu danh sách slot/mặt hàng | Cmd `103`, sub-type `8` | Không có payload thêm |

Các chữ ký tương ứng trong mã máy chủ của dự án là `openShop(type, step, idItem)`, `unlockShopSlot(type)`, `addItemToShop(slot, idItem, num, price)`, `takeItemBack(slot)`, `buyFromShop(idShop, idItem)`, `refreshShop()` và `getShopItems()` [5]. Cmd `103` là một lệnh ghép; byte đầu tiên là sub-type, vì vậy không nên phân tích nó như một giao dịch đơn lẻ.

## 4. Cấu trúc một mặt hàng trong sạp

Lớp `ShopScr.ItemShop` cho thấy một slot hàng có các trường sau:

| Trường | Kiểu | Ý nghĩa có thể xác định |
|---|---:|---|
| `Id` | `short` | ID vật phẩm/nông sản |
| `num` | `int` | Số lượng đang đăng hoặc còn lại |
| `price` | `int` | Giá niêm yết |
| `name` | `string` | Tên hiển thị |
| `isSale` | `bool` | Slot đang có hàng được bán |
| `isTimeOut` | `bool` | Hàng/slot đã hết thời gian |
| `IdShop` | `int` | ID sạp của người bán |
| `verShop` | `short` | Phiên bản hàng/sạp dùng khi mua |

`ShopScr` còn có `numSlot`, trạng thái sạp của chính mình (`isMyShop`), cờ có thể mở slot (`isCanOpenSlot`), thông tin làm mới (`timeRefesh`, `priceRefesh`) và giá làm mới (`priceRefesh`). Các phương thức `addSlot`, `openSlotInfo`, `addNewItem`, `removeItem`, `setRefesh` và `refeshShop` cho thấy sạp được tổ chức theo **slot**, chứ không phải một kho bán không giới hạn [6].

## 5. Quy trình sử dụng đề xuất trong game

### Đăng bán nông sản

Người chơi trước hết phải có nông sản trong kho. Nông sản có thể được tạo ra từ thu hoạch cây hoặc thu hoạch sản phẩm vật nuôi; trong `FarmScr` có các hàm `addProductTree`, `addProductAnimal`, `onHarvestTree` và `onHarvestAnimal` [6]. Sau đó, người chơi mở Siêu thị/gian hàng của mình, chọn một slot, chọn sản phẩm, nhập số lượng và giá, rồi xác nhận đăng bán. Payload đăng bán là `slot + idItem + num + price`.

Nên kiểm tra trước ba điều kiện: số lượng trong kho phải đủ, giá phải nằm trong giới hạn máy chủ chấp nhận, và slot phải còn trống hoặc đã được mở khóa. Mã giao diện có lớp `AddItemShop.ListItemShop` với `minPrice` và `maxPrice`, cho thấy giao diện có khả năng giữ giới hạn giá tối thiểu/tối đa; tuy nhiên bản dump hiện tại chưa khôi phục được đầy đủ bảng giới hạn cụ thể cho từng nông sản [6].

### Mua từ sạp khác

Người mua mở danh sách hàng, chọn sản phẩm, xem số lượng và giá, rồi gửi yêu cầu mua có `idShop` và định danh mặt hàng/phiên bản. Việc có `verShop` trong `ItemShop` cho thấy máy chủ dùng phiên bản slot để tránh mua nhầm một mặt hàng đã bị thay đổi hoặc đã bán hết. Sau khi mua, hàng phải được máy chủ cộng vào kho người mua và XU phải được trừ từ tài khoản người mua.

### Rút hàng chưa bán

Chủ sạp dùng thao tác lấy hàng về theo `slot`. Đây là luồng riêng với bán trực tiếp từ kho; không nên gọi lệnh `SELL_ITEM=67` nếu mục đích chỉ là rút một mặt hàng khỏi gian hàng.

### Làm mới và mở slot

Sạp có trạng thái thời gian làm mới và giá làm mới. Mã giao diện có cả trạng thái `isCanRefesh` và `isCanOpenSlot`, do đó số slot, thời gian chờ và chi phí có thể phụ thuộc tài khoản hoặc dữ liệu máy chủ. Giá cụ thể của mở slot và làm mới chưa được xác định chắc chắn từ các tệp hiện có.

## 6. Phân biệt với bán trực tiếp và Cửa hàng farm

### Bán trực tiếp từ kho

`FarmScr` có `IActionSellProduct` và `doSellProduct(short idItem, int num)`. Lệnh client-to-server là **Cmd `67 SELL_ITEM` với `i16 idItem + i32 num`** [4]. Đây là bán trực tiếp cho hệ thống, không phải đăng một slot để người chơi khác mua. Phản hồi thành công có dữ liệu tiền bán và số dư hiện tại; mã phản hồi được ghi nhận là `SELL_ITEM` với các trường số nguyên và ID item [4].

### Mua vật phẩm tại Cửa hàng farm

Cửa hàng farm dùng **Cmd `68 BUY_ITEM`** với `i16 id + i8 số lượng + i8 loại shop/tiền`. Đo thực tế trong ghi chú dự án xác nhận `typeShop=1` là **XU**; `typeShop=2` là một loại tiền khác chưa được xác định đầy đủ và không nên tự động sử dụng [4].

Danh mục vật phẩm farm đã giải mã được trong `shop-catalog.json` gồm 11 mặt hàng:

| ID | Vật phẩm | Giá XU đã xác nhận |
|---:|---|---:|
| 111 | Phân bón trung cấp | 7 |
| 112 | Phân bón siêu cấp | 10 |
| 116 | Thức ăn thủy sản | 1 |
| 117 | Thức ăn gia cầm | 1 |
| 118 | Thức ăn gia súc | 1 |
| 119 | Thức ăn cho chó | 1 |
| 120 | Thuốc cúm | 10 |
| 121 | Thuốc tiêu chảy | 10 |
| 122 | Thuốc bổ | 25 |
| 123 | Thuốc diệt cỏ | 5 |
| 124 | Thuốc trừ sâu | 5 |

Danh mục dữ liệu farm hiện có 27 loại cây, gồm 11 cây nhóm XU và 16 cây nhóm cao cấp, cùng 12 loại vật nuôi [7]. Tuy nhiên, trường `value` trong catalog chưa được chứng minh hoàn toàn là giá bán nông sản trên Siêu thị; bộ giải mã hiện tại mới chắc chắn trích được thời gian sinh trưởng, giá trị thuộc bản ghi cây và ảnh giai đoạn. Không nên dùng trực tiếp `value` làm giá bán người chơi nếu chưa đối chiếu thêm gói dữ liệu giao dịch.

## 7. Nguồn nông sản có thể đưa lên sạp

Mã farm đã xác nhận hai nhóm nguồn chính:

| Nguồn | Cách tạo sản phẩm | Ghi chú |
|---|---|---|
| Cây trồng | `onHarvestTree` → `addProductTree` | Thu hoạch cây rồi chuyển vào kho/sản phẩm |
| Vật nuôi | `onHarvestAnimal` → `addProductAnimal` | Chỉ một số loài tạo sản phẩm định kỳ |

Các mô tả vật nuôi trong dữ liệu farm ghi nhận nhóm có sản phẩm gồm gà, bò, vịt, cừu và dê. Ví dụ: gà tạo trứng, bò tạo sữa, vịt tạo trứng, cừu tạo lông và dê tạo sữa; heo, cá chép, rùa, chó và một số vật nuôi khác không tạo sản phẩm định kỳ hoặc có vai trò khác [4]. Đây là nguồn nông sản đầu vào của kho; danh sách ID sản phẩm cuối cùng và toàn bộ giá bán trên Siêu thị vẫn chưa được khôi phục trọn vẹn.

## 8. Phí và các điểm chưa thể kết luận chắc chắn

Trong metadata chuỗi của game có hai thông báo liên quan đến đăng hàng: `addItemShop_sendPriceWith10precentFee` và `addItempShop_sendPriceWithFreeFee` [6]. Điều này cho thấy game có ít nhất hai nhánh thông báo về **phí 10%** và **miễn phí**, nhưng bản dump hiện tại chưa chỉ ra chắc chắn điều kiện chọn nhánh nào. Vì vậy, kết luận an toàn là: **cơ chế phí tồn tại trong client, còn đối tượng chịu phí và điều kiện áp dụng phải xác minh bằng giao dịch thử hoặc phân tích sâu hơn mã native/server**.

Các điểm còn thiếu dữ liệu gồm giá tối thiểu/tối đa theo từng nông sản, phí mở slot, thời gian hết hạn chính xác, cách máy chủ xử lý tiền khi giao dịch thành công, bảng ID sản phẩm thu hoạch hoàn chỉnh và ý nghĩa đầy đủ của `type`, `step`, `verShop`. Những mục này không nên suy đoán chỉ từ tên trường.

## 9. Kết luận thực hành

Nếu mục tiêu là sử dụng đúng tính năng trong game, hãy hiểu “sạp” là **Siêu thị/gian hàng cá nhân**: thu hoạch và đưa nông sản vào kho, mở gian hàng, chọn slot, nhập số lượng và giá, đăng bán bằng XU; người chơi khác có thể mua, còn hàng chưa bán có thể rút về. Nếu chỉ muốn đổi nông sản lấy tiền ngay, dùng **bán trực tiếp Cmd 67**, không dùng luồng sạp. Nếu muốn mua phân bón, thuốc, thức ăn hoặc hạt giống, dùng **Cửa hàng farm**, không dùng Siêu thị.

Nếu mục tiêu là tiếp tục reverse-engineer hoặc hoàn thiện tính năng trong dự án, ưu tiên tiếp theo là bắt gói cmd `103` trong một phiên giao dịch thật để ghi lại: phản hồi khi mở sạp, cấu trúc từng slot, phản hồi đăng bán, phản hồi mua hàng, thời điểm trừ/cộng XU và điều kiện áp dụng phí 10%. Đây là phần duy nhất còn cần dữ liệu động để biến bản đồ tĩnh hiện tại thành đặc tả hoàn chỉnh.

## References

[1]: https://play.google.com/store/apps/details?id=com.TeaM.Avatar&hl=vi "AvatarHD — Google Play"

[2]: https://gomobi.vn/home/game/Avatar-2-11.html "Avatar 2 — TeaMobi/Gomobi"

[3]: https://download.com.vn/avatar-for-android-39473 "AvatarHD cho Android 3.4.4 — Download.com.vn"

[4]: `avatar-re/notes/farm.md` — ghi chú giao thức farm, lệnh mua/bán, dữ liệu cây và vật nuôi trong dự án.

[5]: `avatar-web/server/src/game/farmService.ts` — các phương thức client/server cho cmd 103 và cmd 68.

[6]: `avatar-re/notes/assembly-csharp.cs` — các lớp `FarmScr`, `ShopScr`, `ShopScr.ItemShop`, `AddItemShop`, `MarketScr` và chuỗi giao diện đã khôi phục.

[7]: `avatar-web/server/shop-catalog.json` — catalog cây trồng, vật phẩm và vật nuôi được crawl từ gói dữ liệu farm.

> **Lưu ý phiên bản:** Các kết luận nội bộ dựa trên APK và mã của phiên bản 3.4.4 trong dự án. Giao diện, giá, phí, số slot và luật giao dịch có thể thay đổi theo dữ liệu máy chủ hoặc bản cập nhật mới hơn.
