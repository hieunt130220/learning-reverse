# Hiển thị tên thật item trong yêu cầu nâng cấp — Design Spec

## Mục tiêu & Bối cảnh

Tab `Nâng Cấp` hiện hiển thị các yêu cầu type 7/9 bằng mã nội bộ, ví dụ `Thuốc #4704`.
Người dùng cần thấy tên item thực tế từ catalog game, ví dụ `Thuốc tăng trưởng`, để đối chiếu
đúng vật phẩm trong kho.

## Phạm vi

### In-scope

- Truyền catalog item/cây hiện có của `GameClient` vào decoder action=1.
- Resolve `idFarm` theo catalog trước khi fallback về tên nhóm hoặc `#id`.
- Giữ nguyên payload, progress, API contract và hành vi refresh hiện tại.
- Khi catalog chưa tải hoặc không chứa ID, dùng fallback ổn định, không làm decoder lỗi.

### Out-of-scope

- Thay đổi format cmd 104 hoặc cách tính `request`/`inStorage`.
- Sửa dữ liệu catalog game hoặc thêm mapping phỏng đoán cho ID chưa xác minh.
- Viết test files mới theo quy định NO TDD (chỉ kiểm tra sau khi code).

### Edge cases

- Catalog chưa sẵn sàng: hiển thị `Nông sản` / `Thuốc tăng trưởng` hoặc `#id` theo loại.
- Catalog có item trùng ID: dùng bản ghi đầu tiên.
- ID là `0` hoặc âm: không tra catalog, dùng fallback.

## Thiết kế kỹ thuật

- `avatar-web/server/src/game/progressQuests.ts`: mở rộng input decoder bằng context catalog;
  `getRequirementDisplayName` ưu tiên `items`, sau đó `trees`, rồi fallback.
- `avatar-web/server/src/game/client.ts`: tại handler cmd 104, truyền `this.trees` và `this.items`
  vào decoder; giữ signature public của client và state/API bất biến.

Flow:

```text
cmd 76 catalog -> GameClient.trees/items
cmd 104 action=1 -> decoder(context) -> displayName thật -> farmUpgradeRequirements -> UI
```

## Verification Plan

- Chạy typecheck/build server và web hiện có.
- Kiểm tra bằng payload action=1 với ID có trong catalog: tên hiển thị không còn `#id`.
- Kiểm tra payload khi catalog rỗng: decoder vẫn trả requirements và fallback đúng.
- Dùng GitNexus impact trước khi sửa symbol và detect_changes trước commit theo AGENTS.md.
