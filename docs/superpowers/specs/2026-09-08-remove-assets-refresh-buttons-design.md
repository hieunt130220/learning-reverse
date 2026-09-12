# Design: Bỏ 2 nút "làm mới kho" và "tải bảng cây" trong tab Tài sản

**Ngày:** 2026-09-08  
**Trạng thái:** Chờ duyệt (Pending Review)  
**Tác giả:** Claude  

---

## 1. Mục tiêu & Bối cảnh (Goal & Context)

### Vấn đề cần giải quyết
Hiện tại trên tab **Tài sản** (`AssetsPanel.tsx`), trong phần hiển thị Kho (`KhoSection`), có 2 nút bấm thủ công:
- Nút `"làm mới kho"` gọi action `getInventory`
- Nút `"tải bảng cây"` gọi action `getTreeInfo`

Các dữ liệu này hiện nay đã được backend đồng bộ và cung cấp định kỳ qua runtime snapshot / websocket cho frontend. Việc để 2 nút bấm này trong UI không còn cần thiết, chiếm diện tích và có thể gây nhầm lẫn khi người dùng thao tác.

### Mục tiêu
- Xóa bỏ 2 nút `"làm mới kho"` và `"tải bảng cây"` (cùng thẻ bọc `<div className="row">`) khỏi `KhoSection` trong `AssetsPanel.tsx`.
- Dọn dẹp import `apiPost` không còn dùng trong `AssetsPanel.tsx`.
- Dọn dẹp prop `accountId` không còn dùng trong `KhoSection` (và có thể giữ `accountId` tùy chọn trong `AssetsPanel` để đảm bảo tương thích ngược hoặc dọn dẹp sạch).
- Đảm bảo ứng dụng compile sạch sẽ và toàn bộ test suite pass 100%.

---

## 2. Phạm vi (Scope)

### In-Scope
- **`avatar-web/web/src/accounts/panels/AssetsPanel.tsx`**:
  - Xóa 2 nút `"làm mới kho"` và `"tải bảng cây"`.
  - Xóa import `apiPost` từ `../../api.js`.
  - Xóa prop `accountId` trong `KhoSection`.
  - Giữ `accountId?: number` trong props của `AssetsPanel` để không làm vỡ các caller hiện tại, hoặc loại bỏ an toàn.
- **Kiểm thử**:
  - Chạy `AssetsPanel.test.tsx` và full web test suite.
  - Chạy build Vite TypeScript.

### Out-of-Scope
- Không thay đổi logic hiển thị tabs (`Nông sản`, `Vật phẩm & Hạt giống`) hay cách render danh sách item chips trong `KhoSection`.
- Không thay đổi `FarmSection` hay `AnimalSection`.
- Không thay đổi server actions `getInventory`, `getTreeInfo` trên backend.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Danh sách files liên quan
1. [AssetsPanel.tsx](avatar-web/web/src/accounts/panels/AssetsPanel.tsx):
   - Xóa `import { apiPost } from '../../api.js';`.
   - Trong `KhoSection`:
     - Xóa `accountId` khỏi prop list và interface type.
     - Xóa khối JSX:
       ```tsx
       <div className="row">
         <button
           className="ghost"
           onClick={() =>
             void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getInventory', args: [] })
           }
         >
           làm mới kho
         </button>
         <button
           className="ghost"
           onClick={() =>
             void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getTreeInfo', args: [] })
           }
         >
           tải bảng cây
         </button>
       </div>
       ```
   - Trong `AssetsPanel`:
     - Khi gọi `<KhoSection ... />`, bỏ prop `accountId={accountId}`.

### Phân tích rủi ro & Tác động (Blast Radius)
- GitNexus impact analysis cho `AssetsPanel`:
  - Risk: **LOW**.
  - Direct dependents: 0.
  - Không ảnh hưởng đến các luồng thực thi dữ liệu nông trại hoặc websocket.

---

## 4. Kế hoạch xác minh (Verification Plan)

### Automated Tests
```bash
npm --prefix avatar-web/web test -- src/accounts/panels/AssetsPanel.test.tsx
npm --prefix avatar-web/web test -- --run
npm --prefix avatar-web/web run build
```

### Tiêu chí thành công (Success Criteria)
1. Trong tab Tài sản (mục Kho), không còn xuất hiện 2 nút "làm mới kho" và "tải bảng cây".
2. Không còn import thừa `apiPost` trong `AssetsPanel.tsx`.
3. Toàn bộ test suite web pass 100%.
4. Vite build thành công không có lỗi TypeScript.
