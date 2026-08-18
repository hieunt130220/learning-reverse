# Fix Lỗi Hiển Thị Nhiệm Vụ Hàng Ngày Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi phân giải sai opcode `cmd -87` và logic fallback của Daily Quest, đảm bảo dữ liệu nhiệm vụ hàng ngày và điểm năng động phản ánh chính xác 100% từ máy chủ game Avatar.

**Architecture:** Giới hạn phạm vi phân giải của gói `cmd -87` trong `GameClient` chỉ áp dụng cho `sub_type = 4` (Daily Quest) theo chuẩn phân rã jump-table tại RVA `0x5ED07C`, loại bỏ việc tự ý gán điểm `100/100` và `0x1f` rương trong `decodeDailyQuestPacket`, cập nhật hiển thị banner rỗng linh hoạt trong `QuestsPanel.tsx`, và tự động đồng bộ lại nhiệm vụ sau khi nhận thưởng.

**Tech Stack:** TypeScript, Node.js, Express, React, Vite, Socket Networking.

**Spec:** `docs/superpowers/specs/2026-08-18-fix-daily-quest-display-design.md`

## Global Constraints
- **Protocol Strictness**: Opcode `-87` có byte đầu tiên `sub_type = 4` là gói Daily Quest duy nhất. `sub_type = 1` là server info, `sub_type = 2` là custom chest, `sub_type = 3` là avatar info.
- **No Mock State Overwrite**: Decoder tuyệt đối không tự ý giả lập điểm `100` hoặc mặt nạ rương `0x1F` khi nhận phản hồi nhận thưởng (`subAction = 2`).
- **Tuân thủ quy tắc Project**: Không thực hiện TDD (không tạo test files khi user không yêu cầu). Thực thi trực tiếp code production.

---

### Task 1: Sửa Router Phân Giải Gói Tin `cmd -87` trong `GameClient`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:527-556`

**Interfaces:**
- Consumes: `decodeDailyQuestPacket(data, current, inventory, produce, catalog)` từ `farmData.ts`
- Produces: `GameClient.dailyQuestState` được bảo vệ, chỉ cập nhật khi nhận đúng gói `sub_type = 4`

- [x] **Step 1: Cập nhật điều kiện lọc `case -87:` trong `client.ts`**
  - Đổi điều kiện từ `data[0] === 2 || data[0] === 4` thành `data[0] === 4`.
  - Phân loại rõ `data[0] === 2` là phản hồi `CUSTOM_CHEST` và ghi log debug/bỏ qua, không gọi sang `decodeDailyQuestPacket`.
  - Khi nhận `res` với `res.action === 2` (phản hồi nhận thưởng hoàn tất chuỗi nhiệm vụ), tự động gọi `this.farm.getDailyQuest(0)` để lấy danh sách nhiệm vụ và điểm năng động mới nhất từ server.

```typescript
      case -87: {
        // INFO_TEXT_BOX_SERVER:
        // - sub_type = 1: phản hồi getServerLoginInfo (@0x5ED0B4)
        // - sub_type = 2: CUSTOM_CHEST / Part data (@0x5F18D8)
        // - sub_type = 3: LoadMap.getAvatar avatar update (@0x5F1368)
        // - sub_type = 4: DAILY_QUEST (DailyQuestScr.dailyQuestMessage @0xAF7664)
        const data = msg.getData();
        if (data.length > 0 && data[0] === 4) {
          try {
            const res = decodeDailyQuestPacket(
              data.subarray(1),
              this.dailyQuestState,
              this.inventory,
              this.produce,
              { trees: this.trees, items: this.items },
            );
            if (res) {
              this.dailyQuestState = res.state;
              this.emit('quests', this.dailyQuestState);
              this.emit(
                'log',
                `nhiệm vụ ngày: ${res.state.score}/${res.state.maxScore} ⭐ · ${res.state.missions.length} nhiệm vụ (${res.state.missions.filter((m) => m.isDone).length} xong)`,
              );
              // Nếu vừa nhận thưởng nhiệm vụ (subAction = 2), làm mới lại nhiệm vụ ngày từ server
              if (res.action === 2) {
                try {
                  this.farm.getDailyQuest(0);
                } catch {
                  /* bỏ qua */
                }
              }
            }
          } catch (err) {
            this.emit('log', `giải mã nhiệm vụ ngày lỗi: ${(err as Error).message}`);
          }
        } else if (data.length > 0 && data[0] === 1) {
          this.emit('log', 'server phản hồi getServerLoginInfo — giải mã hai chiều OK');
        } else if (data.length > 0 && data[0] === 2) {
          // Gói tin CUSTOM_CHEST - không phải DailyQuest
        }
        break;
      }
```

- [x] **Step 2: Kiểm tra biên dịch TypeScript phía Server**
Run: `npm run build` trong `avatar-web/server`
Expected: Biên dịch không có lỗi cú pháp.

---

### Task 2: Loại Bỏ Logic Giả Lập Dữ Liệu Trong `decodeDailyQuestPacket`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:2057-2115`

**Interfaces:**
- Consumes: Gói tin buffer từ server, `current?: DailyQuestState | null`
- Produces: `DailyQuestState` giữ đúng `score` và `boxDone` thực tế

- [x] **Step 1: Sửa nhánh `subAction === 2` trong `decodeDailyQuestPacket`**
  - Không tự gán `score = 100` hoặc `boxDone = 0x1f`.
  - Giữ nguyên `current?.score ?? 0` và `current?.boxDone ?? 0`.
  - Giữ nguyên `current?.boxes` (hoặc tính toán dựa trên `boxDone` và `score` thực tế).

```typescript
    // subAction = 2 (DONE / NHẬN THƯỞNG NHIỆM VỤ HOÀN TẤT)
    if (subAction === 2) {
      const rewards: DailyRewardItem[] = [];
      if (r.available() > 0) {
        const nReward = r.readByte();
        for (let i = 0; i < nReward; i++) {
          if (r.available() < 1) break;
          const type = r.readByte();
          let itemId: number | undefined;
          if ((type === 4 || type === 5) && r.available() >= 2) {
            itemId = r.readShort();
          }
          let amount = 1;
          if (r.available() >= 4) {
            amount = r.readInt();
          }
          rewards.push({
            type,
            name: getRewardTypeName(type, itemId, catalog?.items),
            amount,
            itemId,
          });
        }
      }
      const score = current?.score ?? 0;
      const boxDone = current?.boxDone ?? 0;
      const MILESTONES = [20, 40, 60, 80, 100];
      const boxes: DailyBoxMilestone[] = MILESTONES.map((m, idx) => {
        const isClaimed = (boxDone & (1 << idx)) !== 0;
        return {
          milestone: m,
          isClaimed,
          canClaim: !isClaimed && score >= m,
        };
      });
      return {
        action: subAction,
        state: {
          score,
          maxScore: 100,
          boxDone,
          boxes: current?.boxes ?? boxes,
          missions: current?.missions ?? [],
          rewards: rewards.length > 0 ? rewards : (current?.rewards ?? []),
          typeMoneyChange: -1,
          moneyChange: 0,
          canChange: false,
          updatedAt: Date.now(),
        },
      };
    }
```

- [x] **Step 2: Kiểm tra biên dịch TypeScript phía Server**
Run: `npm run build` trong `avatar-web/server`
Expected: Build thành công không có lỗi type.

---

### Task 3: Cập Nhật Banner Thông Báo Rỗng Trong `QuestsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/QuestsPanel.tsx:212-223`

**Interfaces:**
- Consumes: `daily: DailyQuestState`
- Produces: Giao diện hiển thị banner phân biệt giữa đã hoàn tất 100 điểm vs chưa có nhiệm vụ

- [x] **Step 1: Sửa điều kiện render banner danh sách nhiệm vụ rỗng trong `QuestsPanel.tsx`**

```tsx
                {daily.missions.length === 0 ? (
                  <div className="daily-completed-banner">
                    <span className="banner-icon">{daily.score >= daily.maxScore ? '🎉' : '📋'}</span>
                    <div className="banner-text">
                      {daily.score >= daily.maxScore ? (
                        <>
                          <h5>Đã hoàn thành toàn bộ nhiệm vụ hôm nay!</h5>
                          <p>
                            Tài khoản đã hoàn tất nhiệm vụ hàng ngày và tích luỹ 100/100 ⭐ điểm năng động.
                            Nhiệm vụ mới sẽ được máy chủ làm mới vào ngày mai.
                          </p>
                        </>
                      ) : (
                        <>
                          <h5>Chưa có danh sách nhiệm vụ cần làm</h5>
                          <p>
                            Tài khoản hiện chưa có nhiệm vụ nào trong chuỗi hoặc đang chờ máy chủ làm mới.
                            Bạn có thể nhấn nút "Làm mới" ở góc trên để tải lại dữ liệu mới nhất.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
```

- [x] **Step 2: Kiểm tra build TypeScript phía Web**
Run: `npm run build` trong `avatar-web/web`
Expected: Build Vite thành công.

---

### Task 4: Kiểm Tra Toàn Diện và Xác Minh Thực Tế

**Files:**
- Test / Verify các luồng dữ liệu

- [x] **Step 1: Khởi chạy build cả repo và kiểm tra lỗi lint**
Run: `npm run build` ở cả `avatar-web/server` và `avatar-web/web`
Expected: Tất cả đều build thành công không có lỗi.

- [x] **Step 2: Xác minh hoạt động với tài khoản thật**
  - Mở web, vào mục Vận hành $\rightarrow$ Nhiệm vụ $\rightarrow$ Hàng ngày.
  - Nhấn nút "Làm mới": Điểm năng động và các mốc rương hiển thị chuẩn theo đúng dữ liệu server.
