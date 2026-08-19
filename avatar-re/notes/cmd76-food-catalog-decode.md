# Cmd 76 Food Catalog Decode Evidence

## APK/binary evidence

`avatar-re/il2cpp_out/dump.cs` xác nhận class `Food` có các trường wire tương ứng:

```text
i16 ID
UTF text
i16 productID
i16 cookTime
i16 numMaterials
repeat numMaterials: i16 materialId, i16 numberMaterial
i8 level
```

Điểm nạp catalog là `FarmData.readTreeInfo`; APK không chứa giá trị công thức cố định
để trích xuất tĩnh. Giá trị tên, ID thành phẩm, thời gian và nguyên liệu phải lấy từ
phần catalog động của packet `GET_TREE_INFO` (Cmd 76).

## Runtime rule

`avatar-web/server/src/game/farmData.ts::decodeFoodCatalog` chỉ chấp nhận một block
`Food[]` đọc tuần tự hoàn chỉnh từ raw packet. Nó không còn chuyển tên món thành công
thức từ `KNOWN_FOOD_REFERENCE` hoặc `DEFAULT_FOOD_CATALOG`.

Nếu packet thiếu block hoặc bị truncate, decoder trả `undefined`; `GameClient` giữ
catalog rỗng/not-ready và phát log cảnh báo. Raw packet/traffic capture không bị ghi đè.

## Packet account 2 đã xác minh

Probe ngày 2026-08-19 nhận Cmd 76 dài `13.336` byte. Block công thức bắt đầu ở
offset `6547` (decimal), có `35` record. Record đầu:

```text
id=1, name=Bánh Trứng, productID=205, cookTime=120, materials=(50,50),(6,2000), level=1
```

Record cuối:

```text
id=35, name=Thịt Kho Trứng, productID=302, cookTime=180,
materials=(301,1000),(282,5),(50,500),(212,5), level=7
```

Các số lượng lớn như `1000`, `2000`, `5000` là giá trị wire nguyên gốc và được giữ
nguyên, không tự chia tỷ lệ khi chưa có bằng chứng từ packet kho.

## Verification limit

Raw capture tạm được lưu ngoài repo tại `/private/tmp/avatar-cmd76-account2.hex`; không
đưa credential hay packet vào git.
