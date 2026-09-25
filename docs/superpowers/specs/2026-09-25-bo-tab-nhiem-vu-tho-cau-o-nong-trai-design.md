# Thiết Kế: Bỏ Tab Nhiệm Vụ Thợ Câu Tại Tab Nông Trại

> **Ngày:** 2026-09-25  
> **Chủ đề:** `bo-tab-nhiem-vu-tho-cau-o-nong-trai`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)

---

## 1. Mục Tiêu & Bối Cảnh

- **Vấn đề:** Hiện tại trong tab Nông Trại (`QuestsPanel.tsx` - Nhiệm vụ nông trại), có sub-tab **"🎣 Thợ Câu"**. Tuy nhiên, toàn bộ tiến độ và nhiệm vụ thợ câu đã được hiển thị đầy đủ, trực quan tại tab chính **"🎣 Câu cá"** (`FishingPanel.tsx`). Việc để sub-tab Thợ câu trong tab Nông trại gây trùng lặp và không đúng ngữ cảnh nông nghiệp.
- **Mục tiêu:**
  - Bỏ sub-tab **"🎣 Thợ Câu"** khỏi bảng Nhiệm Vụ Nông Trại (`QuestsPanel.tsx`).
  - Giữ lại 3 sub-tab phù hợp: ☀️ Hằng Ngày, 🐣 Tân Thủ, 🌾 Nhà Nông.
  - Giữ nguyên hiển thị nhiệm vụ thợ câu tại tab **"🎣 Câu cá"** (`FishingPanel.tsx`) và mode `auto_fisherman_quest` trên `StatusPanel.tsx`.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Frontend Refactoring (`QuestsPanel.tsx`):**
   - Bỏ `'fisherman'` khỏi kiểu `QuestTab`.
   - Xóa nút chuyển tab `🎣 Thợ Câu` trong `quests-tabs-nav`.
   - Xóa phần render `{activeTab === 'fisherman' && <ProgressQuestSection ... />}` trong `quests-tab-content`.
   - Dọn sạch các biến phụ thuộc `fisherman`, `completedFishermanCount`, `totalFishermanCount`.
2. **Cập nhật Unit Tests:**
   - Chạy test toàn bộ `avatar-web/web` để xác minh không ảnh hưởng tới các chức năng khác.

### 2.2 Out-of-Scope
- Không thay đổi `FishingPanel.tsx` (thẻ Nhiệm vụ Thợ Câu vẫn hoạt động bình thường trong tab Câu cá).
- Không thay đổi backend API hay auto runner `runFishermanQuestLoop`.

---

## 3. Thiết Kế Chi Tiết

### 3.1 File Sửa Đổi

| File | Vai trò | Thay đổi |
| :--- | :--- | :--- |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | Bảng nhiệm vụ nông trại | Bỏ sub-tab `fisherman`, chỉ giữ `daily`, `beginner`, `farmer`. |

---

## 4. Verification Plan

1. **Automated Tests:**
   - Chạy `cd avatar-web/web && npm test -- --run` đảm bảo 11/11 file test pass 100%.
2. **Manual Verification:**
   - Mở Drawer Vận hành -> Vào tab `Nông trại` -> Xem bảng `Nhiệm vụ Nông Trại`.
   - Xác nhận chỉ còn 3 tab: ☀️ Hằng Ngày, 🐣 Tân Thủ, 🌾 Nhà Nông (không còn tab 🎣 Thợ Câu).
   - Chuyển sang tab `🎣 Câu cá`, xác nhận khối "Nhiệm Vụ Thợ Câu" vẫn hiển thị đầy đủ tiến độ.
