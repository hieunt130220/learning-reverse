# AutoFarm Step Delay 300ms — Design Document

## 1. Mục tiêu & Bối cảnh

### Bối cảnh

AutoFarm hiện nghỉ mặc định `700ms` giữa các bước xử lý đối tượng. Giá trị này được khai báo độc lập ở cấu hình mặc định phía server và cấu hình cố định do giao diện gửi lên. Nếu chỉ sửa một phía, giá trị còn lại có thể tiếp tục duy trì nhịp `700ms` tùy đường khởi tạo hoặc cập nhật cấu hình.

### Mục tiêu

Giảm nhịp nghỉ mặc định giữa các bước AutoFarm từ `700ms` xuống `300ms`, đồng thời giữ cấu hình server và giao diện đồng nhất.

## 2. Phạm vi (Scope)

### In-scope

- Đổi `DEFAULTS.stepDelayMs` trong `avatar-web/server/src/autoFarm.ts` từ `700` thành `300`.
- Đổi `FIXED_AUTO_CONFIG.stepDelayMs` trong `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` từ `700` thành `300`.
- Kiểm tra typecheck và các test hiện có liên quan sau khi sửa production code.

### Out-of-scope

- Không thay đổi cơ chế `sleep`, vị trí nghỉ hoặc thứ tự xử lý ô cây và vật nuôi.
- Không thay đổi `intervalMs`, `startDelayMs`, timeout protocol hoặc delay của tool thử nghiệm.
- Không sửa các giá trị `700` dùng làm timestamp fixture, CSS font weight, permission mode hoặc dữ liệu hex.
- Không thay đổi cấu trúc `AutoFarmConfig` hay API contract.
- Không tạo hoặc sửa test file vì user không yêu cầu trực tiếp.
- Không cập nhật tài liệu lịch sử mô tả hành vi `700ms` tại thời điểm thiết kế cũ.

### Input

- Luồng khởi tạo AutoFarm bằng cấu hình mặc định phía server.
- Luồng lưu/cập nhật cấu hình AutoFarm từ `AutoFarmPanel`.

### Output

- Cấu hình mới không truyền `stepDelayMs` dùng mặc định `300`.
- Cấu hình do giao diện gửi lên cố định `stepDelayMs: 300`.

### Edge cases

1. Cấu hình đã lưu chứa `stepDelayMs` khác vẫn được xử lý theo cơ chế merge hiện tại; thay đổi này không migration dữ liệu đã lưu.
2. Client cũ còn gửi `700` vẫn có thể giữ nhịp cũ; thay đổi chỉ bảo đảm server default và web hiện tại đồng nhất ở `300`.
3. Nhịp nhanh hơn làm tổng thời gian một vòng ngắn hơn nhưng không thay đổi số lượng hoặc thứ tự packet.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules liên quan

| File/module | Vai trò | Thay đổi |
|---|---|---|
| `avatar-web/server/src/autoFarm.ts` | Chứa cấu hình mặc định và orchestration AutoFarm | Đổi `DEFAULTS.stepDelayMs: 700` thành `300` |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Tạo cấu hình cố định gửi từ giao diện | Đổi `FIXED_AUTO_CONFIG.stepDelayMs: 700` thành `300` |

### Data contract

Không thêm hoặc sửa interface. Trường hiện có vẫn là:

```ts
stepDelayMs: number
```

Chỉ giá trị mặc định/fixed thay đổi:

```ts
stepDelayMs: 300
```

### Flow xử lý

```text
Server khởi tạo không có override ──► DEFAULTS.stepDelayMs = 300

Web lưu/cập nhật AutoFarm ──► FIXED_AUTO_CONFIG.stepDelayMs = 300
                           ──► server nhận cùng giá trị 300

AutoFarm xử lý từng đối tượng ──► giữ nguyên vị trí sleep
                               ──► nghỉ 300ms trước bước kế tiếp
```

### Tính tương thích

- Không thay đổi wire protocol hoặc response shape.
- Không thay đổi tên trường, kiểu dữ liệu hoặc validation hiện tại.
- Không migration cấu hình đã lưu và không ép các client phiên bản cũ dùng `300ms`.

## 4. Verification Plan

1. Trước khi sửa mỗi symbol production, chạy `gitnexus_impact` cho symbol tương ứng và cảnh báo nếu risk là HIGH/CRITICAL.
2. Sửa đúng hai giá trị production đã xác định, không thay đổi các số `700` không liên quan.
3. Chạy typecheck của server và web theo scripts hiện có trong project.
4. Chạy các test hiện có liên quan đến AutoFarm/config nếu project cung cấp lệnh phù hợp; không tạo test mới.
5. Tìm lại các khai báo `stepDelayMs: 700` trong production để bảo đảm không còn default web/server bị lệch.
6. Chạy `gitnexus_detect_changes({ scope: "all" })` để xác nhận phạm vi thay đổi chỉ gồm spec/plan và hai symbol dự kiến trước khi commit.
