# Thiết Kế: Đồng Bộ Tiến Trình Nhiệm Vụ Nông Trại Với Dữ Liệu Thực Tế Nông Trại (Vật Nuôi, Nông Sản, Ô Đất)

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Người dùng đã mua 2 con cá chép trong nông trại (hoặc mua gà, mở đất, v.v.), nhưng trên giao diện web (Tab **🐣 Tân Thủ** - Nhiệm Vụ Tân Thủ 2), tiến trình điều kiện:
- `📌 Mua 2 con cá chép` vẫn hiển thị `0 / 2 (0%)`
- `📌 Mua 5 con gà` hiển thị `0 / 5 (0%)`

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Cause)
1. **Dữ liệu khởi tạo và hộp thoại NPC trả về văn bản tĩnh:**
   - Trạng thái mặc định `DEFAULT_BEGINNER_QUEST_STATE` khởi tạo `current: 0, total: 2` cho cá chép và `current: 0, total: 5` cho gà.
   - Khi bot tương tác với NPC Lái buôn (`Cmd -40 / -88`), máy chủ game trả về chuỗi văn bản mẫu của nhiệm vụ (ví dụ: `- Mua 5 con gà  - 0/5\n- Mua 2 con cá chép  - 0/2`). Hàm `parseQuestDialogText` bóc tách chuỗi này và ghi đè `current = 0`.
2. **Thiếu cơ chế đồng bộ tiến độ từ FarmState & Kho:**
   - Khi người chơi mua vật nuôi (2 cá chép species 54, gà species 50), dữ liệu vật nuôi thực tế được lưu chính xác trong `client.farmState.animals`.
   - Nông sản thu hoạch được lưu trong `client.produce` và `client.inventory`.
   - Số ô đất được lưu trong `client.farmState.cells`.
   - Tuy nhiên, hệ thống **chưa từng có logic đối chiếu/đồng bộ** giữa danh sách điều kiện nhiệm vụ (`beginnerQuestState`, `farmerQuestState`) với trạng thái thực tế của nông trại (`farmState.animals`, `produce`, `inventory`, `cells`).

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Xây dựng hàm `syncQuestStateWithFarm(quest, farmState, inventory, produce)`:
     - Tự động nhận diện từ khóa trong tên điều kiện nhiệm vụ (ví dụ: `cá chép` -> species 54, `gà` -> species 50, `vịt` -> species 55, `bò` -> species 51, `heo/lợn` -> species 52, `cừu` -> species 56, `trâu` -> species 58, `rùa/ba ba` -> species 59, `thỏ` -> species 61, `dê` -> species 60, `ô đất` -> `cells.length`, nông sản trong kho `produce/inventory`).
     - Tính toán số lượng thực tế hiện có: `derivedCurrent`.
     - Cập nhật an toàn không làm giảm tiến độ: `current = Math.min(cond.total, Math.max(cond.current, derivedCurrent))` và `isDone = current >= cond.total`.
2. **`avatar-web/server/src/game/client.ts`**:
   - Thêm phương thức `syncProgressQuests()` trong `GameClient`.
   - Tự động gọi `syncProgressQuests()` và phát sinh event `quests` khi:
     - Nhận gói dữ liệu nông trại (`Cmd 69 / 61`).
     - Nhận gói kho đồ & nông sản (`Cmd 70`).
     - Nhận phản hồi nhiệm vụ từ server (`Cmd 104`, `Cmd -40`, `Cmd -88`, `Cmd -70`, `Cmd -77`, `Cmd -38`, `Cmd -39`).
3. **`avatar-web/server/src/session/avatarSession.ts`**:
   - Trong `getQuestOverview()`: Đảm bảo gọi `syncProgressQuests()` trước khi trả kết quả về cho Web API / Frontend.

### Out-of-Scope:
- Không thay đổi cấu trúc dữ liệu wire protocol (không sửa các hàm gửi nhận socket cơ bản).
- Không ảnh hưởng đến logic AutoFarm nuôi/trồng.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

### 3.1. Ánh Xạ Vật Nuôi & Nông Sản Trong `progressQuests.ts`

Bảng quy chuẩn nhận diện loài vật nuôi từ tên điều kiện tiếng Việt:
- `cá chép` / `ca chep` -> Species 54 (`POND`)
- `rùa` / `rua` / `ba ba` -> Species 59 (`POND`)
- `gà` / `ga` (không chứa từ `trứng`) -> Species 50 (`BARN`)
- `vịt` / `vit` (không chứa từ `trứng`) -> Species 55 (`BARN`)
- `bò` / `bo` (không chứa từ `sữa`) -> Species 51 (`BARN`)
- `heo` / `lợn` / `lon` (không chứa từ `thịt`) -> Species 52 (`BARN`)
- `cừu` / `cuu` (không chứa từ `lông`) -> Species 56 (`BARN`)
- `trâu` / `trau` (không chứa từ `thịt`) -> Species 58 (`BARN`)
- `thỏ` / `tho` -> Species 61 (`BARN`)
- `dê` / `de` (không chứa từ `sữa`) -> Species 60 (`BARN`)
- `chó` / `cho` -> Species 53 (`BARN`)
- `mèo` / `meo` -> Species 57 (`BARN`)
- `ô đất` / `o dat` / `mở đất` -> `farmState.cells.length`

Bảng nhận diện nông sản từ kho (`produce` & `inventory`):
- `cà chua` -> ID 206 hoặc ID 0
- `cà rốt` -> ID 205 hoặc ID 1
- `trứng gà` -> ID 50
- `sữa bò` -> ID 51
- `thịt heo` -> ID 52
- `trứng vịt` -> ID 55
- `lông cừu` -> ID 56
- `thịt trâu` -> ID 58

### 3.2. Hàm Đồng Bộ `syncQuestStateWithFarm`

```typescript
export function syncQuestStateWithFarm(
  quest: ProgressQuestChain | null,
  farmState: FarmState | null,
  inventory?: InventoryItem[] | null,
  produce?: InventoryItem[] | null,
): ProgressQuestChain | null {
  if (!quest || !quest.conditions || quest.conditions.length === 0) return quest;

  let hasChanged = false;
  const newConditions = quest.conditions.map((cond) => {
    const nameLower = cond.name.toLowerCase();
    let derivedCount: number | null = null;

    // 1. Kiểm tra vật nuôi trong FarmState
    if (farmState?.animals) {
      if (nameLower.includes('cá chép') || nameLower.includes('ca chep')) {
        derivedCount = farmState.animals.filter((a) => a.species === 54).length;
      } else if (nameLower.includes('rùa') || nameLower.includes('rua') || nameLower.includes('ba ba')) {
        derivedCount = farmState.animals.filter((a) => a.species === 59).length;
      } else if ((nameLower.includes('gà') || nameLower.includes('ga')) && !nameLower.includes('trứng') && !nameLower.includes('trung')) {
        derivedCount = farmState.animals.filter((a) => a.species === 50).length;
      } else if ((nameLower.includes('vịt') || nameLower.includes('vit')) && !nameLower.includes('trứng') && !nameLower.includes('trung')) {
        derivedCount = farmState.animals.filter((a) => a.species === 55).length;
      } else if ((nameLower.includes('bò') || nameLower.includes('bo')) && !nameLower.includes('sữa') && !nameLower.includes('sua')) {
        derivedCount = farmState.animals.filter((a) => a.species === 51).length;
      } else if ((nameLower.includes('heo') || nameLower.includes('lợn') || nameLower.includes('lon')) && !nameLower.includes('thịt') && !nameLower.includes('thit')) {
        derivedCount = farmState.animals.filter((a) => a.species === 52).length;
      } else if ((nameLower.includes('cừu') || nameLower.includes('cuu')) && !nameLower.includes('lông') && !nameLower.includes('long')) {
        derivedCount = farmState.animals.filter((a) => a.species === 56).length;
      } else if ((nameLower.includes('trâu') || nameLower.includes('trau')) && !nameLower.includes('thịt') && !nameLower.includes('thit')) {
        derivedCount = farmState.animals.filter((a) => a.species === 58).length;
      } else if (nameLower.includes('thỏ') || nameLower.includes('tho')) {
        derivedCount = farmState.animals.filter((a) => a.species === 61).length;
      }
    }

    // 2. Kiểm tra ô đất
    if (farmState?.cells && (nameLower.includes('ô đất') || nameLower.includes('o dat') || nameLower.includes('mở đất'))) {
      derivedCount = farmState.cells.length;
    }

    // 3. Kiểm tra nông sản trong kho
    const allStock = [...(produce ?? []), ...(inventory ?? [])];
    if (nameLower.includes('cà chua') || nameLower.includes('ca chua')) {
      const stock = allStock.filter((i) => i.id === 206 || i.id === 0).reduce((sum, i) => sum + i.num, 0);
      if (stock > 0) derivedCount = Math.max(derivedCount ?? 0, stock);
    } else if (nameLower.includes('cà rốt') || nameLower.includes('ca rot')) {
      const stock = allStock.filter((i) => i.id === 205 || i.id === 1).reduce((sum, i) => sum + i.num, 0);
      if (stock > 0) derivedCount = Math.max(derivedCount ?? 0, stock);
    }

    if (derivedCount !== null) {
      const newCurrent = Math.min(cond.total, Math.max(cond.current, derivedCount));
      const newIsDone = newCurrent >= cond.total;
      if (newCurrent !== cond.current || newIsDone !== cond.isDone) {
        hasChanged = true;
        return {
          ...cond,
          current: newCurrent,
          isDone: newIsDone,
        };
      }
    }
    return cond;
  });

  if (!hasChanged) return quest;

  return {
    ...quest,
    conditions: newConditions,
    updatedAt: Date.now(),
  };
}
```

---

## 4. Verification Plan

### Automated / Unit Verification:
- Tạo test case trong `server/src/game/progressQuests.test.ts` kiểm thử:
  1. `syncQuestStateWithFarm` khi có 2 cá chép trong `farmState.animals`: điều kiện `Mua 2 con cá chép` từ 0/2 chuyển thành 2/2 (`isDone: true`).
  2. `syncQuestStateWithFarm` khi có 5 gà: điều kiện `Mua 5 con gà` từ 0/5 chuyển thành 5/5 (`isDone: true`).
  3. Đảm bảo tiến trình không bị lùi về 0 nếu farm bán con hoặc nông sản đã tiêu thụ.
- Chạy toàn bộ test suite: `npm test` trong `avatar-web/server`.
- Build TypeScript server & web: `npm run build`.

### Manual Verification:
- Kiểm tra hiển thị trên web: Tab **🐣 Tân Thủ** hiển thị đúng tiến độ `2 / 2 (100%)` cho 2 cá chép và tích xanh `✅`.
