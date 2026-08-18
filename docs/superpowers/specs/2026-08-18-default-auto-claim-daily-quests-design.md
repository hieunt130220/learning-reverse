# Thiết Kế Kỹ Thuật (Design Document): Mặc Định Tự Động Nhận Thưởng Nhiệm Vụ Hàng Ngày & Bỏ Cài Đặt Trên Web UI

## 1. Mục Tiêu & Bối Cảnh (Context & Goal)
- **Bối cảnh**: Hiện tại trong panel Cấu hình AutoFarm (`AutoFarmPanel.tsx`), có một khu vực cài đặt riêng mang tên `"🎯 Nhiệm vụ hàng ngày"` với một checkbox: `"Tự động nhận thưởng nhiệm vụ hoàn thành & mở rương quà"` (quản lý bởi biến `autoClaimDailyQuests`, ban đầu mặc định là `false`).
- **Vấn đề**: Người dùng mong muốn đơn giản hóa giao diện cấu hình và tự động hóa tối đa: tính năng tự động nhận thưởng nhiệm vụ hoàn thành và tự động mở rương quà mốc điểm năng động nên trở thành hành vi mặc định luôn chạy trong chu kỳ AutoFarm, không cần người dùng phải bấm tick chọn thủ công trên web nữa.
- **Mục tiêu**:
  1. Loại bỏ section cài đặt checkbox `"🎯 Nhiệm vụ hàng ngày"` trên Web UI (`AutoFarmPanel.tsx`).
  2. Đặt `autoClaimDailyQuests` trong engine AutoFarm phía backend (`autoFarm.ts`) mặc định luôn là `true` (hoặc chạy khi `cfg.autoClaimDailyQuests !== false`).
  3. Cập nhật các component, tests và contracts liên quan để đảm bảo không làm gãy dirty check, serialization hay test suite.

---

## 2. Phạm Vi (Scope)

### In-scope:
- **Web UI (`AutoFarmPanel.tsx`)**:
  - Gỡ bỏ section `🎯 Nhiệm vụ hàng ngày` và checkbox tương ứng.
  - Gỡ bỏ state `autoClaimDailyQuests` khỏi form hydration, dirty comparison, và payload lưu cấu hình `savePlan()`.
- **Web Tests (`AutoFarmPanel.test.tsx`)**:
  - Cập nhật test case kiểm tra payload `apiPut` không còn phụ thuộc vào `autoClaimDailyQuests: false`.
- **Backend AutoFarm Engine (`autoFarm.ts`)**:
  - Cập nhật `DEFAULT_AUTO_FARM_CONFIG` để `autoClaimDailyQuests: true`.
  - Đảm bảo trong mỗi vòng chạy `runCycle()`, nếu có nhiệm vụ hàng ngày đã hoàn thành hoặc rương mốc điểm đủ điều kiện mở (`canClaim && !isClaimed`), AutoFarm sẽ tự động gọi `claimDailyQuestReward()` và `claimDailyQuestBox()`.
- **Backend Config Validator (`autoConfig.ts`)**:
  - Giữ lại trường `autoClaimDailyQuests` trong schema validator (tùy chọn) để tương thích ngược với các bản ghi cấu hình cũ trong CSDL nếu có.

### Out-of-scope:
- Không thay đổi giao diện hiển thị danh sách nhiệm vụ tại `QuestsPanel.tsx` (tab Nhiệm vụ).
- Không thay đổi logic đổi nhiệm vụ (`changeDailyQuest`) hoặc luồng socket `-87`.

---

## 3. Thiết Kế Chi Tiết & Thay Đổi Mã Nguồn

### 3.1. Danh sách file thay đổi

| File | Vai trò | Nội dung thay đổi |
|---|---|---|
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Web UI | Xóa section `🎯 Nhiệm vụ hàng ngày`, xóa state và dirty check `autoClaimDailyQuests`. |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx` | Web Test | Cập nhật expectation của payload `apiPut` trong test. |
| `avatar-web/server/src/autoFarm.ts` | Backend AutoFarm | Đổi `DEFAULT_AUTO_FARM_CONFIG.autoClaimDailyQuests` thành `true`; sửa điều kiện kiểm tra thành `cfg.autoClaimDailyQuests !== false`. |

---

### 3.2. Chi tiết kỹ thuật

#### A. Backend (`avatar-web/server/src/autoFarm.ts`)
```typescript
// Trong DEFAULT_AUTO_FARM_CONFIG:
export const DEFAULT_AUTO_FARM_CONFIG: AutoFarmConfig = {
  // ...
  autoHarvestCook: true,
  autoClaimDailyQuests: true, // Mặc định luôn bật
  // ...
};

// Trong runCycle():
// ---- Tự động nhận thưởng nhiệm vụ hàng ngày & mở rương quà (Mặc định luôn bật) ------------
if (cfg.autoClaimDailyQuests !== false && !this.aborted) {
  if (!this.client.dailyQuestState) {
    this.client.farm.getDailyQuest(0);
    await tick();
  }

  const dq = this.client.dailyQuestState;
  if (dq) {
    // 1. Kiểm tra nhiệm vụ hoàn thành để nhận thưởng
    const claimableMissions = dq.missions.filter((m) => m.isDone);
    if (claimableMissions.length > 0) {
      this.client.farm.claimDailyQuestReward();
      sent += 1;
      note(`[nhiệm vụ] tự động nhận thưởng ${claimableMissions.length} nhiệm vụ hàng ngày đã hoàn thành`);
      await tick();
    }

    // 2. Kiểm tra mở rương mốc điểm
    const claimableBoxes = dq.boxes.filter((b) => b.canClaim && !b.isClaimed);
    if (claimableBoxes.length > 0) {
      for (const box of claimableBoxes) {
        this.client.farm.claimDailyQuestBox();
        sent += 1;
        note(`[nhiệm vụ] tự động mở rương quà mốc ${box.milestone} điểm`);
        await tick();
      }
    }
  }
}
```

#### B. Frontend (`avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`)
1. Bỏ `const [autoClaimDailyQuests, setAutoClaimDailyQuests] = useState(false);`
2. Bỏ `setAutoClaimDailyQuests(...)` trong `hydrateForm`.
3. Bỏ `autoClaimDailyQuests` khỏi `useMemo` tính `dirty`.
4. Bỏ `autoClaimDailyQuests` khỏi body của `apiPut` trong `savePlan()`.
5. Bỏ khối JSX HTML:
```tsx
<div className="setting-section">
  <h3>🎯 Nhiệm vụ hàng ngày</h3>
  <div className="row" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <label className="inline">
      <input
        type="checkbox"
        checked={autoClaimDailyQuests}
        onChange={(event) => setAutoClaimDailyQuests(event.target.checked)}
        style={{ width: 'auto' }}
      />
      Tự động nhận thưởng nhiệm vụ hoàn thành & mở rương quà
    </label>
  </div>
</div>
```

---

## 4. Verification Plan

### 4.1. Automated Verification
- Chạy toàn bộ test suite backend: `npm test --prefix avatar-web/server`
- Chạy test suite frontend: `npm test --prefix avatar-web/web` (hoặc `npx vitest run --prefix avatar-web/web`)
- Kiểm tra biên dịch TypeScript backend & frontend:
  - `npm run build --prefix avatar-web/server`
  - `npm run build --prefix avatar-web/web`

### 4.2. Manual Verification
- Mở panel cấu hình AutoFarm của tài khoản trên Web:
  - Xác nhận section `🎯 Nhiệm vụ hàng ngày` đã biến mất hoàn toàn, giao diện gọn gàng.
  - Các thao tác lưu kế hoạch cây, vật nuôi, nấu ăn vẫn hoạt động bình thường, không bị báo `có thay đổi chưa lưu` sai lệch.
- Khi AutoFarm chạy, nếu nhiệm vụ ngày đạt điều kiện nộp hoặc đủ điểm mở rương, hệ thống tự động nhận thưởng và ghi log `[nhiệm vụ] tự động nhận thưởng...` mà không cần bật cài đặt nào.
