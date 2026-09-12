# Design: Bỏ nút "Debug chuyên sâu" khỏi Drawer Vận hành Web

**Ngày:** 2026-09-08  
**Trạng thái:** Chờ duyệt (Pending Review)  
**Tác giả:** Claude  

---

## 1. Mục tiêu & Bối cảnh (Goal & Context)

### Vấn đề cần giải quyết
Hiện tại trên giao diện Web (`avatar-web`), trong Drawer Vận hành tài khoản (`AccountOperationsDrawer.tsx`), có một nút/link điều hướng:
```tsx
<Link className="btn-link drawer-debug-link" to={`/accounts/${account.id}/debug`} onClick={onOpenDebug}>
  Debug chuyên sâu →
</Link>
```
Nút này dẫn người dùng sang trang `/accounts/:id/debug` (`AccountDebugPage`), nơi cung cấp các công cụ can thiệp sâu vào packet và state. Đối với người dùng thông thường hoặc trong quá trình vận hành chuẩn, nút này không cần thiết hiển thị trực diện trên Drawer, dễ gây rối mắt hoặc bấm nhầm.

### Mục tiêu
- Loại bỏ hoàn toàn link/nút "Debug chuyên sâu →" khỏi Drawer Vận hành tài khoản.
- Giữ nguyên trang Debug (`AccountDebugPage`), component `DebugPanel`, và route `/accounts/:id/debug` trong hệ thống để khi cần debug kỹ thuật vẫn có thể truy cập trực tiếp qua URL.
- Dọn dẹp code thừa không còn dùng trong `AccountOperationsDrawer` (hàm `openDebug`, prop `onOpenDebug`).
- Cập nhật test liên quan để test suite tiếp tục pass trơn tru.

---

## 2. Phạm vi (Scope)

### In-Scope
- **`avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`**:
  - Gỡ bỏ thẻ `<Link className="btn-link drawer-debug-link" ...>Debug chuyên sâu →</Link>`.
  - Gỡ bỏ handler `openDebug`.
  - Gỡ bỏ prop `onOpenDebug` truyền từ `AccountOperationsDrawer` vào component `LoadedOperations`.
  - Giữ lại import `Link` vì vẫn đang dùng cho `<Link to="/accounts">Về dashboard</Link>` khi tài khoản không tồn tại.
- **`avatar-web/web/src/accounts/accountsRoutes.test.tsx`**:
  - Cập nhật case test kiểm tra dirty-guard (`test.each`): bỏ case click `link Debug` vì link này không còn xuất hiện trong Drawer; vẫn giữ các case test đóng Drawer qua nút Đóng, backdrop, Escape.
  - Vẫn giữ nguyên test `test('/accounts/:id/debug hiển thị Debug riêng và link về Vận hành')` để đảm bảo route debug hoạt động tốt khi vào trực tiếp.
- **`avatar-web/web/src/styles.css`**:
  - Xóa class `.drawer-debug-link` không còn sử dụng.

### Out-of-Scope
- Không xóa `AccountDebugPage.tsx`, `DebugPanel.tsx`, route `/accounts/:id/debug`.
- Không thay đổi hành vi của các panel khác trong Drawer (Trạng thái, Nông trại, Câu cá, Nhiệm vụ, Nấu ăn, Tài sản, Cửa hàng, Logs).
- Không sửa đổi backend API hay websocket endpoints.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Danh sách files liên quan
1. [AccountOperationsDrawer.tsx](avatar-web/web/src/accounts/AccountOperationsDrawer.tsx):
   - Xóa định nghĩa `openDebug`:
     ```ts
     // Xóa:
     const openDebug = (event: MouseEvent<HTMLAnchorElement>) => {
       event.preventDefault();
       if (canLeave()) navigate(`/accounts/${accountId}/debug`);
     };
     ```
   - Xóa prop `onOpenDebug={openDebug}` khi render `<LoadedOperations />`.
   - Xóa `onOpenDebug` khỏi interface props của `LoadedOperations`.
   - Xóa JSX hiển thị link `Debug chuyên sâu →`.
2. [styles.css](avatar-web/web/src/styles.css):
   - Xóa dòng định nghĩa style:
     ```css
     .drawer-debug-link { justify-self: start; margin-bottom: 20px; }
     ```
3. [accountsRoutes.test.tsx](avatar-web/web/src/accounts/accountsRoutes.test.tsx):
   - Cập nhật `test.each` dirty guard:
     ```ts
     test.each([
       ['nút Đóng', async () => userEvent.click(screen.getByRole('button', { name: 'Đóng' }))],
       ['backdrop', async () => {
         const backdrop = screen.getByRole('dialog', { name: 'Vận hành Farm chính' }).parentElement!;
         fireEvent.mouseDown(backdrop);
       }],
     ] as const)('%s dùng cùng dirty guard và thực hiện đúng đích sau khi chấp nhận', async (kind, leave) => {
       ...
     });
     ```

### Phân tích rủi ro & Tác động (Blast Radius)
- GitNexus impact analysis cho `openDebug` và `AccountOperationsDrawer`:
  - Risk: **LOW**.
  - Direct dependents ngoài file: 0.
  - Không ảnh hưởng đến các luồng logic (execution flows) khác.

---

## 4. Kế hoạch xác minh (Verification Plan)

### Automated Tests
Chạy test suite của web app để đảm bảo không có regression:
```bash
npm --prefix avatar-web/web test -- src/accounts/accountsRoutes.test.tsx
npm --prefix avatar-web/web run build
```

### Tiêu chí thành công (Success Criteria)
1. Giao diện Drawer vận hành không còn hiển thị "Debug chuyên sâu →".
2. Không còn warning/lỗi TypeScript (unused variable, prop mismatch).
3. Route `/accounts/:id/debug` vẫn compile và chạy được khi truy cập trực tiếp.
4. Tất cả các bài test trong `accountsRoutes.test.tsx` pass 100%.
