# Fishing Activity Reward Dialog Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng nhận diện các dạng thông báo phần thưởng hoạt động/sự kiện câu cá ("Bạn thu hoạch được...", "từ hoạt động câu cá", "Số lượng X/Y") để bot không dừng auto câu cá.

**Architecture:** Nâng cấp hàm `isRewardDialog` trong `avatar-web/server/src/game/client.ts` với các từ khóa nhận quà bổ sung ("thu hoạch được", "nhặt được", "kiếm được", "từ hoạt động") và regex nhận diện giới hạn vật phẩm sự kiện `/số lượng\s*\d+\s*\/\s*\d+/i`, kết hợp các guard từ chối lỗi phủ định ("không thể", "không được", "thất bại", "chưa thể").

**Tech Stack:** TypeScript, Node.js (avatar-web backend)

**Spec:** `docs/superpowers/specs/2026-09-10-fishing-activity-reward-dialog-expansion-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa hàm và `gitnexus_detect_changes` trước khi commit.
- KHÔNG thực hiện TDD: không tạo file test trước khi viết code theo quy định của CLAUDE.md.
- Đảm bảo typecheck `npm run build` trong `avatar-web/server` thành công 0 lỗi.

---

### Task 1: Nâng cấp hàm `isRewardDialog` trong `avatar-web/server/src/game/client.ts`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:176-193`

**Interfaces:**
- Consumes: `text: string`
- Produces: `isRewardDialog(text: string): boolean` (mở rộng nhận diện "thu hoạch được", "từ hoạt động", và regex "số lượng X/Y")

- [x] **Step 1: Cập nhật hàm `isRewardDialog` trong `client.ts`**
  Thay thế implementation của `isRewardDialog`:
  ```typescript
  /**
   * Kiểm tra xem một dialog từ server có phải là thông báo phần thưởng / sự kiện / hoạt động hay không.
   */
  export function isRewardDialog(text: string): boolean {
    const normalized = text.trim().toLowerCase();

    // Nếu chứa từ khóa phủ định hoặc lỗi -> chắc chắn không phải nhận thưởng
    if (
      normalized.includes('không thể')
      || normalized.includes('không được')
      || normalized.includes('thất bại')
      || normalized.includes('chưa thể')
    ) {
      return false;
    }

    // 1. Chúc mừng
    if (normalized.includes('chúc mừng')) return true;

    // 2. Động từ nhận/thu hoạch vật phẩm
    if (
      normalized.includes('thu hoạch được')
      || normalized.includes('nhận được')
      || normalized.includes('nhặt được')
      || normalized.includes('kiếm được')
    ) {
      return true;
    }

    // 3. Có từ khóa phần thưởng
    if (normalized.includes('phần thưởng')) return true;

    // 4. Nhận từ hoạt động (ví dụ: "từ hoạt động câu cá", "từ hoạt động...")
    if (normalized.includes('từ hoạt động')) return true;

    // 5. Mẫu đếm giới hạn sự kiện trong ngày (ví dụ: "Số lượng 1/40", "Số lượng 1/50")
    if (/số lượng\s*\d+\s*\/\s*\d+/i.test(normalized)) {
      return true;
    }

    return false;
  }
  ```

- [x] **Step 2: Kiểm tra biên dịch TypeScript**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công 0 lỗi.

- [x] **Step 3: Kiểm tra phạm vi thay đổi bằng GitNexus**
  Run: `gitnexus_detect_changes({scope: "unstaged"})`
  Expected: Chỉ file `client.ts` thay đổi trong phạm vi mong đợi.

- [x] **Step 4: Commit**
  Run: `git add avatar-web/server/src/game/client.ts`
  Run: `git commit -m "fix(fishing): expand isRewardDialog to detect activity harvest and event limit patterns"`
