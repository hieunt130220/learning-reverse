# Thiết Kế: Đồng Bộ Tiến Trình Cá Chép & Tự Động Làm Mới Hộp Thoại Nhiệm Vụ

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Trên giao diện web hiển thị:
- `📌 Mua 5 con gà 0 / 5 (0%)`
- `📌 Mua 2 con cá chép 0 / 2 (0%)`

Trong khi trong game thực tế:
- `📌 Mua 5 con gà  - 0/5`
- `✅ Mua 2 con cá chép  -Xong` (Đã mua 2 con cá chép trong ao)

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Cause)
1. **Chưa tự động gọi `refreshProgressQuests()` khi vào nông trại:**
   - Khi bot đăng nhập và vào nông trại (`Cmd 69`), bot tự động tải cây (`getTreeInfo`), bếp (`getCook`), nhiệm vụ ngày (`getDailyQuest`), nhưng **chưa gọi** `refreshProgressQuests()` để tương tác với NPC Lái buôn (`Cmd -59 / -61`).
   - Do đó, biến `beginnerQuestState` bị giữ nguyên giá trị khởi tạo `DEFAULT_BEGINNER_QUEST_STATE` (`0/5 gà`, `0/2 cá chép`).
2. **`syncQuestStateWithFarm` bị vô hiệu hóa hoàn toàn:**
   - Ở commit trước, `syncQuestStateWithFarm` bị biến thành hàm rỗng. Do đó khi bot nhận dữ liệu `farmState` (chứa 2 con cá chép `species: 54` trong ao), tiến trình `Mua 2 con cá chép` không được cập nhật thành `2/2`.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Khôi phục đồng bộ an toàn trong `syncQuestStateWithFarm`:
     - Đồng bộ số lượng cá chép trong ao (`farmState.animals.filter(a => a.species === 54).length`). Nếu có 2 cá chép -> `current = 2`, `isDone = true`.
     - Đồng bộ rùa (`species === 59`).
     - **Không** tự đếm gà trong chuồng để tránh làm sai lệch điều kiện `Mua 5 con gà (0/5)`.
2. **`avatar-web/server/src/game/client.ts`**:
   - Khi nhận dữ liệu nông trại (`Cmd 69 / 61`), tự động kích hoạt `void this.refreshProgressQuests()` để tương tác NPC Lái buôn lấy hộp thoại mới nhất.
   - Khi gọi `syncProgressQuests()`, cập nhật ngay `beginnerQuestState` và `farmerQuestState` từ `farmState`.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

### 3.1. `progressQuests.ts`
```typescript
export function syncQuestStateWithFarm(
  quest: ProgressQuestChain | null | undefined,
  farmState?: FarmState | null | undefined,
  inventory?: readonly InventoryItem[] | null,
  produce?: readonly InventoryItem[] | null,
): ProgressQuestChain | null {
  if (!quest || !quest.conditions || quest.conditions.length === 0) return quest ?? null;

  let hasChanged = false;
  const newConditions = quest.conditions.map((cond) => {
    const nameLower = cond.name.toLowerCase();
    let derivedCount: number | null = null;

    // Đồng bộ cá chép (ao cá) trong FarmState
    if (farmState?.animals) {
      if (nameLower.includes('cá chép') || nameLower.includes('ca chep')) {
        derivedCount = farmState.animals.filter((a) => a.species === 54).length;
      } else if (nameLower.includes('rùa') || nameLower.includes('rua') || nameLower.includes('ba ba')) {
        derivedCount = farmState.animals.filter((a) => a.species === 59).length;
      }
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

### 3.2. `client.ts`
Trong `onMessage` (case 69 / 61):
```typescript
// Tự động làm mới nhiệm vụ tiến trình qua NPC Lái buôn khi vào farm
void this.refreshProgressQuests();
```

---

## 4. Verification Plan

### Automated Tests:
- Chạy `npm test` trong `avatar-web/server` -> 100% pass.
- Chạy `npm run build` trong `avatar-web/server` và `avatar-web/web` -> 100% pass.

### Manual Verification:
- Kết quả hiển thị:
  - `📌 Mua 5 con gà: 0 / 5 (0%)`
  - `✅ Mua 2 con cá chép: 2 / 2 (100%)`
  - Tab Tân Thủ: `1/2 điều kiện`.
