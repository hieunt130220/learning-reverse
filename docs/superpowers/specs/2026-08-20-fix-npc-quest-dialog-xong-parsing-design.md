# Thiết Kế: Sửa Lỗi Phân Giải Hộp Thoại Nhiệm Vụ Khi Đã Hoàn Thành (-Xong)

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Hình ảnh chụp trực tiếp từ game Avatar HD của người chơi:
Khi người chơi đã mua 2 con cá chép và nói chuyện với NPC Lái buôn (`Cmd -40 / -88`), máy chủ trả về hộp thoại:
```text
Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
- Mua 5 con gà  - 0/5
- Mua 2 con cá chép  -Xong

Phần Thưởng:
- 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
```

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Cause)
Trong `parseQuestDialogText` (`avatar-web/server/src/game/progressQuests.ts`):
- Parser chỉ dùng 1 regex duy nhất: `/^(.*?)\s*-\s*(\d+)\s*\/\s*(\d+)$/`.
- Khi dòng điều kiện có hậu tố `-Xong` (hoặc `- Xong`, `- Hoàn thành`), regex trên **không khớp**.
- Mã nguồn rơi vào nhánh fallback:
  ```typescript
  } else if (clean) {
    conditions.push({
      name: clean, // -> 'Mua 2 con cá chép  -Xong'
      current: 0,  // -> Bị ép về 0!
      total: 1,
      isDone: false, // -> Bị ép về false!
    });
  }
  ```
- Dẫn đến: Tên điều kiện bị dính chữ `-Xong`, tiến trình hiển thị `0 / 1 (0%)` và trạng thái chưa hoàn thành trên web.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Nâng cấp bộ phân giải `parseQuestDialogText`:
     - Nhận diện mẫu điều kiện hoàn thành: `^(.*?)\s*-\s*(?:xong|hoàn thành|done)\s*$` (không phân biệt hoa thường).
     - Bóc tách đúng tên điều kiện gốc sạch sẽ (loại bỏ `-Xong`).
     - Tự động trích xuất số lượng mục tiêu `total` từ tên điều kiện (ví dụ: `Mua 2 con cá chép` -> `total = 2`, `Thu hoạch 200 cà chua` -> `total = 200`, mặc định 1).
     - Thiết lập `current = total` và `isDone = true`.
     - Chuẩn hoá các trường hợp định dạng `- 0/5`, `- 0 / 5`, `- 2/2`.

### Out-of-Scope:
- Không thay đổi các parser khác.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

```typescript
for (const line of condPart.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('-')) continue;
  const clean = trimmed.replace(/^-\s*/, '');

  // 1. Kiểm tra trường hợp đã hoàn thành: ví dụ "Mua 2 con cá chép  -Xong" hoặc "Thu hoạch 200 cà chua - Hoàn thành"
  const doneMatch = /^(.*?)\s*-\s*(?:xong|hoàn thành|hoan thanh|done)\s*$/i.exec(clean);
  if (doneMatch) {
    const name = doneMatch[1].trim();
    // Trích xuất số lượng mục tiêu từ tên nếu có số
    const numMatch = /\b(\d+)\b/.exec(name);
    const total = numMatch ? parseInt(numMatch[1], 10) : 1;
    conditions.push({
      name,
      current: total,
      total,
      isDone: true,
    });
    continue;
  }

  // 2. Kiểm tra trường hợp tiến độ phân số: ví dụ "Mua 5 con gà  - 0/5" hoặc "Thu hoạch 200 cà chua - 50/200"
  const m = /^(.*?)\s*-\s*(\d+)\s*\/\s*(\d+)$/.exec(clean);
  if (m) {
    const name = m[1].trim();
    const current = parseInt(m[2], 10);
    const total = parseInt(m[3], 10);
    conditions.push({
      name,
      current,
      total,
      isDone: current >= total,
    });
    continue;
  }

  // 3. Fallback cho các điều kiện khác
  if (clean) {
    conditions.push({
      name: clean,
      current: 0,
      total: 1,
      isDone: false,
    });
  }
}
```

---

## 4. Verification Plan

### Automated Tests:
- Chạy test kiểm thử `parseQuestDialogText` với chuỗi hộp thoại thực tế:
  ```text
  Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
  - Mua 5 con gà  - 0/5
  - Mua 2 con cá chép  -Xong

  Phần Thưởng:
  - 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
  ```
  Xác minh:
  - Condition 0: `name = 'Mua 5 con gà'`, `current = 0`, `total = 5`, `isDone = false`.
  - Condition 1: `name = 'Mua 2 con cá chép'`, `current = 2`, `total = 2`, `isDone = true`.
- Chạy `npm test` trong `avatar-web/server` -> Pass 100%.
- Chạy `npm run build` trong `avatar-web/server` và `avatar-web/web` -> Pass 100%.
