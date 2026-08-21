# Spec: Mặc định đóng các khối kế hoạch (Tree, Animal, Kitchen Plan Editors)

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Hiện tại trong giao diện bảng điều khiển Nông trại (`AutoFarmPanel`), các khối biên tập kế hoạch gồm:
  1. *Kế hoạch cây theo ô* (`TreeCellPlanEditor`)
  2. *Kế hoạch vật nuôi chuồng theo slot* (`AnimalPlanEditor` - Barn)
  3. *Kế hoạch vật nuôi hồ theo slot* (`AnimalPlanEditor` - Pond)
  4. *Kế hoạch món nấu theo ô bếp* (`KitchenPlanEditor`)
  đang được gắn thuộc tính `open` cố định trên thẻ `<details className="tree-plan-editor" open>`, khiến tất cả các khối này tự động mở rộng khi tải trang.
- **Mục tiêu**: Thay đổi hành vi mặc định của tất cả các khối kế hoạch này thành **đóng (collapsed)** khi mở trang để giao diện gọn gàng, người dùng chỉ mở khi cần chỉnh sửa chi tiết.

## Phạm vi (Scope)
- **In-scope**:
  - `avatar-web/web/src/accounts/TreeCellPlanEditor.tsx`: Bỏ thuộc tính `open` mặc định (hoặc hỗ trợ prop `defaultOpen?: boolean` với mặc định là `false`).
  - `avatar-web/web/src/accounts/AnimalPlanEditor.tsx`: Bỏ thuộc tính `open` mặc định (hoặc hỗ trợ prop `defaultOpen?: boolean` với mặc định là `false`).
  - `avatar-web/web/src/accounts/KitchenPlanEditor.tsx`: Bỏ thuộc tính `open` mặc định (hoặc hỗ trợ prop `defaultOpen?: boolean` với mặc định là `false`).
  - Cập nhật các unit test liên quan nếu cần để đảm bảo test suite chạy chính xác.
- **Out-of-scope**:
  - Không thay đổi logic xử lý kế hoạch, cơ chế tô vẽ (palette / pointer events), hay API lưu/tải dữ liệu kế hoạch.
  - Không thay đổi styling CSS của summary / grid.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. Thay đổi Component Props & Render
Trong 3 component:
1. `TreeCellPlanEditor`:
   - Thêm prop `defaultOpen?: boolean` vào `TreeCellPlanEditorProps` (mặc định: `false`).
   - Thẻ `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>` (hoặc bỏ `open` khi `defaultOpen` là falsy để trình duyệt giữ trạng thái đóng mặc định).
2. `AnimalPlanEditor`:
   - Thêm prop `defaultOpen?: boolean` vào `AnimalPlanEditorProps` (mặc định: `false`).
   - Thẻ `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>`.
3. `KitchenPlanEditor`:
   - Thêm prop `defaultOpen?: boolean` vào `KitchenPlanEditorProps` (mặc định: `false`).
   - Thẻ `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>`.

### 2. Hành vi người dùng (User Experience)
- Khi vào tab "Cấu hình nông trại", các mục:
  - `▶ Kế hoạch cây theo ô`
  - `▶ Kế hoạch vật nuôi chuồng theo slot`
  - `▶ Kế hoạch vật nuôi hồ theo slot`
  - `▶ Kế hoạch món nấu theo ô bếp`
  đều ở trạng thái đóng (`collapsed`), hiển thị icon tam giác đóng (`▶`).
- Người dùng click vào tiêu đề / summary sẽ mở rộng mục tương ứng để xem lưới ô và palette cấu hình.

## Verification Plan
- Chạy toàn bộ test suite frontend: `npm --prefix avatar-web/web test`
- Đảm bảo kiểm tra các test tương tác với plan editor (ví dụ `TreeCellPlanEditor.test.tsx`, `AutoFarmPanel.test.tsx`, `accountsRoutes.test.tsx`).
