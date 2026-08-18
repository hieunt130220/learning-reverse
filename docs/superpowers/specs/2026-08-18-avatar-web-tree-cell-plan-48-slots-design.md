# Thiết kế: Cấu hình kế hoạch cây trồng 48 ô cố định không phụ thuộc cache game

**Ngày tạo:** 2026-08-18  
**Trạng thái:** Chờ phê duyệt (Pending Review)  
**Phạm vi:** `avatar-web` (Web frontend & Server API/Validation)

---

## 1. Mục tiêu & Bối cảnh

### 1.1. Bối cảnh
Trước đây, phần cấu hình kế hoạch trồng cây theo từng ô (`TreeCellPlanEditor`) phụ thuộc vào dữ liệu cache `profile.cellIndices` và `profile.seedCatalog` được đồng bộ từ server game:
- Nếu tài khoản mới tạo hoặc chưa kết nối vào game, `profile.cellIndices` rỗng `[]`, giao diện bị khóa (`disabled`), hiển thị thông báo *"Chưa có cache ô farm. Hãy kết nối tài khoản trước khi lập kế hoạch"*.
- Khi lưu cấu hình lên server, API yêu cầu bắt buộc tài khoản phải có cache ô đất (`farm-profile-required`) và chỉ cho phép lưu các `cellIndex` thuộc `profile.cellIndices`.

Tương tự như các phần cấu hình khác đã được cải tiến (chuồng vật nuôi 20 slot, hồ cá 10 slot, ô bếp 10 slot), người dùng cần có thể chủ động cấu hình kế hoạch 48 ô đất bất kỳ lúc nào ngay trên web mà không phải chờ vào game lấy cache.

### 1.2. Mục tiêu
1. **Giao diện Web:**
   - Luôn hiển thị đầy đủ 48 ô đất (`Ô 0` đến `Ô 47`) trong `TreeCellPlanEditor`.
   - Cho phép người dùng chọn trạng thái (*Mặc định*, *Không trồng*, *Hạt giống*) và tô/chỉnh sửa 48 ô mà không bị khóa khi chưa có cache.
   - Bảng hạt giống luôn sẵn sàng từ danh mục hạt mặc định 26 loại cây (nếu cache server chưa có).
   - Xóa bỏ các cảnh báo và trạng thái chặn thao tác do thiếu cache ô đất.
2. **Server Backend:**
   - Cho phép lưu và cập nhật `treeCellPlan` cho các ô từ 0 đến 47 mà không bắt buộc tài khoản phải có cache `cellIndices`.
   - Bỏ lỗi `farm-profile-required` và `seed-catalog-required` khi lưu cấu hình.
   - Kiểm tra tính hợp lệ: `cellIndex` nằm trong khoảng 0–47, `seedId` hợp lệ.

---

## 2. Phạm vi (Scope)

### In-scope
- **Web Frontend (`avatar-web/web`):**
  - Cập nhật `treeCellPlan.ts`:
    - Khai báo hằng số `TREE_CELL_COUNT = 48` và `DEFAULT_TREE_CELL_SLOTS = Array.from({ length: 48 }, (_, i) => i)`.
    - Cung cấp `DEFAULT_SEED_CATALOG` gồm 26 loại hạt cây cơ bản và mở rộng.
    - Cập nhật hàm `summarizeTreePlan` và `invalidTreePlanEntries` hoạt động trên danh sách 48 ô cố định.
  - Cập nhật `TreeCellPlanEditor.tsx`:
    - Render 48 ô đất từ `DEFAULT_TREE_CELL_SLOTS` (hoặc prop `cellIndices` nếu truyền vào).
    - Palette chọn hạt dùng `profile.seedCatalog` nếu có, fallback sang `DEFAULT_SEED_CATALOG`.
    - Loại bỏ điều kiện khóa `editorLocked` do thiếu `cellIndices`.
    - Loại bỏ các dòng cảnh báo thiếu cache ô farm.
  - Cập nhật `AutoFarmPanel.tsx` để đồng bộ hiển thị.
  - Cập nhật unit test frontend: `TreeCellPlanEditor.test.tsx`, `treeCellPlan.test.ts`, `AutoFarmPanel.test.tsx`.
- **Server Backend (`avatar-web/server`):**
  - Cập nhật `server/src/session/routes.ts`:
    - Hàm `validateProfile`: Không throw `farm-profile-required` hoặc `seed-catalog-required`.
    - Kiểm tra `cellIndex` hợp lệ (0 <= index < 48).
    - Kiểm tra `seedId` hợp lệ (thuộc danh mục hạt đã biết).
  - Cập nhật `server/src/accounts/repo.ts`:
    - Đồng bộ `validateProfile` trong `enableAutoWithConfigPatch`.
  - Cập nhật `server/src/accounts/autoConfig.ts`:
    - Đồng bộ `validateAutoConfigProfile` hỗ trợ 48 ô và seed catalog.
  - Cập nhật unit test backend: `routes.test.ts`, `repo.test.ts`, `autoConfig.test.ts`.

### Out-of-scope
- Không thay đổi logic chạy engine của `autoFarm.ts` khi gửi lệnh trồng cây trong game (engine đã sẵn sàng nhận diện theo `cellIndex` của farm thực tế).
- Không sửa đổi cấu trúc dữ liệu lưu trong cơ sở dữ liệu SQLite (`treeCellPlan` vẫn là mảng `{ cellIndex, action, seedId? }`).

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Danh mục hạt và 48 ô đất cố định
Avatar farm có tối đa 48 ô đất (chỉ số `0` đến `47`).

```typescript
export const TREE_CELL_COUNT = 48;
export const DEFAULT_TREE_CELL_SLOTS = Array.from({ length: TREE_CELL_COUNT }, (_, i) => i);
```

Danh mục hạt mặc định 26 loại (`DEFAULT_SEED_CATALOG`) gồm 11 loại hạt xu gốc và 15 loại hạt mở rộng (id 0–10, 30–32, 34–36, 39, 41–48, 111).

### 3.2. Luồng xử lý giao diện (`TreeCellPlanEditor`)
1. **Khởi tạo danh sách ô:**
   - Dùng `slotIndices = DEFAULT_TREE_CELL_SLOTS` (48 ô: 0..47).
2. **Khởi tạo bảng hạt:**
   - `seeds = profile.seedCatalog.length > 0 ? profile.seedCatalog : DEFAULT_SEED_CATALOG`.
3. **Hiển thị lưới:**
   - Hiển thị 48 ô đất dưới dạng lưới (Grid 48 ô) có thể click hoặc kéo rê chuột/chạm để tô nhanh kế hoạch (*Mặc định*, *Không trồng*, *Trồng cây X*).
4. **Tóm tắt kế hoạch:**
   - Tính toán số ô mặc định, số ô không trồng, số ô trồng từng loại hạt trên tổng số 48 ô.

### 3.3. Luồng xử lý lưu cấu hình trên Server
1. Client gửi `PUT /api/accounts/:id/auto/config` kèm `treeCellPlan`.
2. Server gọi `validateProfile`:
   - Kiểm tra mọi `cellIndex` trong plan thỏa mãn `0 <= cellIndex < 48`.
   - Kiểm tra `seedId` (với action `seed`) nằm trong danh mục hạt hợp lệ (`DEFAULT_SEED_CATALOG` + hạt cache nếu có).
   - Lưu vào SQLite và đồng bộ phiên làm việc của tài khoản (nếu đang chạy).

---

## 4. Verification Plan

### 4.1. Automated Verification (Tests)
Chạy toàn bộ test suite của client và server để đảm bảo không có regression:
- Server tests: `npm test` trong `avatar-web/server`
  - `autoConfig.test.ts`
  - `repo.test.ts`
  - `routes.test.ts`
- Web tests: `npm test` trong `avatar-web/web`
  - `treeCellPlan.test.ts`
  - `TreeCellPlanEditor.test.tsx`
  - `AutoFarmPanel.test.tsx`

### 4.2. Manual Verification
1. Mở giao diện web ở tài khoản chưa từng kết nối hoặc tài khoản mới:
   - Phần **🌱 Cây trồng** hiển thị đầy đủ 48 ô đất (Ô 0 đến Ô 47).
   - Không còn thông báo bị khóa hay yêu cầu kết nối game.
   - Bảng hạt hiển thị đầy đủ các loại hạt giống mặc định.
2. Thao tác tô màu cây trồng trên các ô (ví dụ: Ô 0 -> Ô 5 chọn Lúa, Ô 6 chọn Không trồng, các ô còn lại Mặc định).
3. Bấm **Lưu cấu hình**: Cấu hình được lưu thành công lên server mà không gặp lỗi validation.
