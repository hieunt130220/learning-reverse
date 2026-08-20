# Hiển Thị Đúng Nhiệm Vụ Hiện Tại Từ Dialog NPC

## 1. Mục Tiêu & Bối Cảnh

Trang quản trị cần hiển thị đúng nhiệm vụ hiện tại mà game trả về trong dialog NPC Lái buôn, thay vì suy luận từ số lượng vật phẩm/vật nuôi đang tồn tại trong nông trại. Trạng thái hiện tại được người dùng xác nhận là:

```text
Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 1:
- Trồng 6 cây hoa hồng  - 0/6
```

Tab Tân Thủ phải hiển thị `Nhiệm Vụ Tân Thủ 1`, `Bước 1`, `0/1 điều kiện` và `Trồng 6 cây hoa hồng: 0 / 6 (0%)`.

## 2. Phạm Vi

### In-scope

- Xác định và giữ một snapshot nhiệm vụ hiện tại được parse từ dialog NPC/server cho từng chuỗi `beginner` và `farmer`.
- Trong lúc phiên chưa trả dialog, hiển thị fallback Tân Thủ 1 do người dùng xác nhận (`Trồng 6 cây hoa hồng - 0/6`); dialog thật mới nhất luôn có quyền ghi đè fallback.
- Parse ổn định tiêu đề, bước, điều kiện dạng `current/total`, điều kiện `Xong` và phần thưởng.
- UI ưu tiên snapshot dialog mới nhất khi hiển thị tab tương ứng; trạng thái thiếu dữ liệu vẫn có nút tải lại.
- Sau thao tác làm mới, UI chỉ kết thúc trạng thái bận khi snapshot mới đã được phát ra hoặc request thất bại rõ ràng.

### Out-of-scope

- Không đếm `farmState`, inventory, produce hoặc số lượng vật nuôi để ghi đè `current`, `total` hay `isDone`.
- Không thay đổi protocol/game action ngoài luồng lấy dialog nhiệm vụ.
- Không tạo test file trong task này; kiểm tra production code bằng build và kiểm tra thủ công theo Verification Plan.

### Edge cases

- Dialog không có nhiệm vụ hợp lệ: giữ snapshot cũ; khi chưa có snapshot, dùng fallback đã được người dùng xác nhận, không suy diễn từ farm.
- Dialog có `-Xong`, `- Xong`, `- Hoàn thành`: coi điều kiện hoàn tất và suy ra `current = total` từ số lượng trong tên nếu có.
- Dialog trả về trễ hoặc trả về chuỗi khác loại: không gán nhầm sang chuỗi nhiệm vụ khác.
- Điều kiện `current > total`: hiển thị tối đa 100% nhưng giữ dữ liệu server để không làm mất thông tin.

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### Modules liên quan

| File/module | Vai trò |
|---|---|
| `avatar-web/server/src/game/progressQuests.ts` | Contract, parser dialog và hàm bảo toàn dữ liệu authoritative từ server. |
| `avatar-web/server/src/game/client.ts` | Gửi request NPC, nhận dialog, cập nhật đúng quest state và phát event `quests`. |
| `avatar-web/server/src/session/avatarSession.ts` | Đưa quest snapshot mới nhất vào account snapshot/API. |
| `avatar-web/web/src/accounts/accountRuntime.ts` | Nhận event/snapshot và cập nhật state phía web. |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | Render nhiệm vụ hiện tại, tiến độ từng điều kiện và refresh state. |

### Data contract

```ts
type ProgressQuestCondition = {
  name: string;
  current: number;
  total: number;
  isDone: boolean;
};

type ProgressQuestChain = {
  kind: 'beginner' | 'farmer';
  title: string;
  step: number | null;
  conditions: ProgressQuestCondition[];
  rewards: ProgressQuestReward[];
  source: 'game-dialog' | 'game-packet' | 'default';
  updatedAt: number;
};
```

### Flow

```text
NPC dialog -> parseQuestDialogText -> validate kind/title/conditions
    -> update beginnerQuestState or farmerQuestState
    -> emit quests -> account snapshot -> QuestsPanel
```

`syncQuestStateWithFarm` chỉ trả lại quest đã parse, không sử dụng farm data để tính lại tiến độ. Mỗi dialog hợp lệ chỉ cập nhật chain cùng `kind`; response không xác định loại phải bị bỏ qua hoặc giữ nguyên state. Request `OPEN_INFO_FARM` dùng body `type=1`, vì biến thể `type=3 + idType` không trả response trên server hiện tại.

## 4. Verification Plan

- Chạy `npm run build` trong `avatar-web/server` và `avatar-web/web`.
- Mở account trên web, tải lại nhiệm vụ và xác nhận tab Tân Thủ khớp dialog game: `Trồng 6 cây hoa hồng`, `0/6`, `0/1 điều kiện`, đúng tiêu đề `Nhiệm Vụ Tân Thủ 1` và bước `1`.
- Thay đổi số lượng gà/cá trong farm nhưng không nhận dialog mới; xác nhận tiến độ UI không tự đổi.
- Nhận dialog mới sau khi hoàn tất một điều kiện; xác nhận chỉ chain tương ứng cập nhật và UI phản ánh snapshot mới nhất.
