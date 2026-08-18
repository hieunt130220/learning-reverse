# Fix Daily Quest Request Opcode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa lỗi gửi sai sub_type trong các phương thức của FarmService sang cmd -87, lưu và hiển thị `missionScoreReward`, mở rộng danh mục nông sản mặc định để web hiển thị chính xác 100% dữ liệu nhiệm vụ hàng ngày từ server game.

**Architecture:** Cập nhật `FarmService` gửi `writeByte(4)` cho cả 4 hành động Daily Quest theo đúng ARM64 RVA `0x6a2008`; cập nhật `farmData.ts` để đọc `score_nhiemvu` và mở rộng `KNOWN_PRODUCE_NAME_MAP`; cập nhật `types.ts` và `QuestsPanel.tsx` để render badge điểm thưởng năng động `+${daily.missionScoreReward} ⭐`.

**Tech Stack:** TypeScript, Node.js, React, WebSockets, REST API

**Spec:** `docs/superpowers/specs/2026-08-18-fix-daily-quest-request-opcode-design.md`

## Global Constraints
- Tuân thủ quy trình GitNexus: kiểm tra impact trước khi sửa và detect changes trước khi commit.
- KHÔNG thực hiện TDD (không tạo file test, đi thẳng vào production code theo quy định của AGENTS.md).
- Không phá vỡ các opcode và luồng khác của FarmService hay GameClient.

---

### Task 1: Sửa Sub-Type `cmd -87` trong `FarmService`

**Files:**
- Modify: `avatar-web/server/src/game/farmService.ts:248-268`

**Interfaces:**
- Consumes: `Session.send(Message)`
- Produces: `FarmService.getDailyQuest()`, `FarmService.changeDailyQuest()`, `FarmService.claimDailyQuestReward()`, `FarmService.claimDailyQuestBox()` gửi đúng `sub_type = 4`

- [x] **Step 1: Cập nhật các phương thức Daily Quest trong `farmService.ts`**

Trong file `avatar-web/server/src/game/farmService.ts`, thay thế đoạn code từ dòng 248 đến 268 bằng:

```typescript
  // ---- nhiệm vụ hàng ngày (cmd -87, byte đầu = sub-type 4) ----------------
  /** getDailyQuest — sub-type 4, type 0 = SHOW @0x6a2008 */
  getDailyQuest(type = 0): void {
    this.send(-87, (m) => m.writer!.writeByte(4).writeByte(type));
  }

  /** changeDailyQuest — type 1 = CHANGE */
  changeDailyQuest(): void {
    this.send(-87, (m) => m.writer!.writeByte(4).writeByte(1));
  }

  /** claimDailyQuestReward — type 2 = DONE */
  claimDailyQuestReward(): void {
    this.send(-87, (m) => m.writer!.writeByte(4).writeByte(2));
  }

  /** claimDailyQuestBox — type 3 = GETBOX */
  claimDailyQuestBox(): void {
    this.send(-87, (m) => m.writer!.writeByte(4).writeByte(3));
  }
```

- [x] **Step 2: Kiểm tra biên dịch TypeScript phía Server**

Run: `npm run build --prefix avatar-web/server`
Expected: Biên dịch thành công 0 lỗi.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/game/farmService.ts
git commit -m "fix(game): fix daily quest send sub-type to 4 in FarmService"
```

---

### Task 2: Bổ Sung `missionScoreReward` và Mở Rộng `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:1789-1875, 1996-2055`

**Interfaces:**
- Consumes: Buffer gói tin từ game server, `DEFAULT_SEED_CATALOG`
- Produces: `DailyQuestState.missionScoreReward`, `KNOWN_PRODUCE_NAME_MAP` đầy đủ tên nông sản

- [x] **Step 1: Cập nhật interface `DailyQuestState` và `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`**

Trong `avatar-web/server/src/game/farmData.ts`:
1. Thêm `missionScoreReward?: number;` vào `interface DailyQuestState`.
2. Bổ sung các ID nông sản/hạt giống phổ biến vào `KNOWN_PRODUCE_NAME_MAP`:
```typescript
export interface DailyQuestState {
  score: number;
  maxScore: number;
  boxDone: number;
  boxes: DailyBoxMilestone[];
  missions: DailyMissionItem[];
  missionScoreReward?: number;
  rewards: DailyRewardItem[];
  typeMoneyChange: number;
  moneyChange: number;
  canChange: boolean;
  updatedAt: number;
}
```

Mở rộng `KNOWN_PRODUCE_NAME_MAP`:
```typescript
export const KNOWN_PRODUCE_NAME_MAP: Record<number, string> = {
  0: 'Cà chua',
  1: 'Cà rốt',
  2: 'Dứa',
  3: 'Dưa hấu',
  4: 'Đậu nành',
  5: 'Hoa hồng',
  6: 'Lúa',
  7: 'Xoài',
  8: 'Thanh long',
  9: 'Hoa hướng dương',
  10: 'Hoa tulip',
  11: 'Ớt',
  12: 'Xoài',
  13: 'Táo',
  14: 'Khế',
  15: 'Hoa cúc',
  16: 'Thanh long',
  30: 'Bắp',
  31: 'Nha đam',
  32: 'Cà tím',
  34: 'Tỏi',
  35: 'Dâu tây',
  36: 'Chuối',
  39: 'Cúc chuồn chuồn',
  41: 'Bí ngô',
  42: 'Khoai tây',
  43: 'Dưa leo',
  44: 'Ớt',
  45: 'Cải thảo',
  46: 'Nhân sâm',
  47: 'Hoa tam giác mạch',
  48: 'Cây dừa',
  50: 'Trứng gà',
  51: 'Sữa bò',
  52: 'Trứng vịt',
  53: 'Thịt heo',
  54: 'Cá chép',
  55: 'Lông cừu',
  56: 'Sữa dê',
  57: 'Mật ong',
  58: 'Thịt trâu',
  59: 'Rùa / Ba ba',
  60: 'Cua',
  61: 'Tôm',
  111: 'Ớt hiểm',
  120: 'Thuốc cúm',
  121: 'Thuốc tiêu chảy',
  122: 'Thuốc bổ',
  123: 'Phân bón cao cấp',
  124: 'Thuốc trừ sâu',
  125: 'Thuốc diệt cỏ',
  126: 'Thức ăn gia súc',
};
```

- [x] **Step 2: Lưu `missionScoreReward` trong `decodeDailyQuestPacket`**

Trong `decodeDailyQuestPacket` (nhánh `subAction === 0 || subAction === 1`):
```typescript
      // Đọc điểm thưởng của chuỗi nhiệm vụ (score_nhiemvu @0xAF78C8)
      let missionScoreReward = 0;
      if (r.available() >= 4) {
        missionScoreReward = r.readInt();
      }
```
Và trả về trong `state`:
```typescript
      return {
        action: subAction,
        state: {
          score: curScore,
          maxScore: 100,
          boxDone,
          boxes,
          missions,
          missionScoreReward,
          rewards,
          typeMoneyChange,
          moneyChange,
          canChange: typeMoneyChange >= 0,
          updatedAt: Date.now(),
        },
      };
```

Trong nhánh `subAction === 2`:
```typescript
      return {
        action: subAction,
        state: {
          score,
          maxScore: 100,
          boxDone,
          boxes: current?.boxes ?? boxes,
          missions: current?.missions ?? [],
          missionScoreReward: current?.missionScoreReward,
          rewards: rewards.length > 0 ? rewards : (current?.rewards ?? []),
          typeMoneyChange: -1,
          moneyChange: 0,
          canChange: false,
          updatedAt: Date.now(),
        },
      };
```

- [x] **Step 3: Kiểm tra biên dịch TypeScript phía Server**

Run: `npm run build --prefix avatar-web/server`
Expected: Biên dịch thành công 0 lỗi.

- [x] **Step 4: Commit**

```bash
git add avatar-web/server/src/game/farmData.ts
git commit -m "feat(game): add missionScoreReward and expand KNOWN_PRODUCE_NAME_MAP in farmData"
```

---

### Task 3: Cập Nhật Web Types và Render Điểm Thưởng trên `QuestsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/types.ts:146-160`
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx:197-280`

**Interfaces:**
- Consumes: `DailyQuestState.missionScoreReward`
- Produces: Web UI hiển thị đầy đủ điểm thưởng năng động `+${daily.missionScoreReward} ⭐`

- [x] **Step 1: Cập nhật `DailyQuestState` trong `avatar-web/web/src/types.ts`**

```typescript
export interface DailyQuestState {
  score: number;
  maxScore: number;
  boxDone: number;
  boxes: DailyBoxMilestone[];
  missions: DailyMissionItem[];
  missionScoreReward?: number;
  rewards: DailyRewardItem[];
  typeMoneyChange: number;
  moneyChange: number;
  canChange: boolean;
  updatedAt: number;
}
```

- [x] **Step 2: Cập nhật hiển thị trong `QuestsPanel.tsx`**

Trong `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`, tại phần `daily.rewards`:
```tsx
                {/* Phần thưởng hàng ngày */}
                {(daily.rewards.length > 0 || (daily.missionScoreReward !== undefined && daily.missionScoreReward > 0)) && (
                  <div className="daily-rewards-block">
                    <span className="label-caption">Phần thưởng khi hoàn thành:</span>
                    <div className="rewards-pill-group">
                      {daily.missionScoreReward !== undefined && daily.missionScoreReward > 0 && (
                        <span className="reward-pill reward-pill--star">
                          ⭐ +{daily.missionScoreReward} điểm năng động
                        </span>
                      )}
                      {daily.rewards.map((r, i) => (
                        <span key={i} className="reward-pill">
                          {r.name}: +{r.amount.toLocaleString('vi-VN')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
```

- [x] **Step 3: Kiểm tra biên dịch TypeScript phía Web**

Run: `npm run build --prefix avatar-web/web`
Expected: Vite build thành công không có lỗi.

- [x] **Step 4: Commit**

```bash
git add avatar-web/web/src/types.ts avatar-web/web/src/accounts/panels/QuestsPanel.tsx
git commit -m "feat(web): display mission score reward in QuestsPanel"
```

---

### Task 4: Kiểm Tra Xác Minh Toàn Bộ Hệ Thống (Verification)

**Files:**
- N/A

- [x] **Step 1: Khởi động lại hoặc reload server/client và kiểm tra kết nối tài khoản**
- [x] **Step 2: Kiểm tra dữ liệu nhiệm vụ hàng ngày được nạp chính xác từ game**
Run: Gọi API `/api/accounts/:id/quests` hoặc mở web xem panel Nhiệm vụ
Expected: Trả về trạng thái `daily` đầy đủ các trường `score`, `boxes`, `missions` (với Dâu tây, Hoa hồng và số lượng tương ứng từ kho), `rewards` và `missionScoreReward`.
