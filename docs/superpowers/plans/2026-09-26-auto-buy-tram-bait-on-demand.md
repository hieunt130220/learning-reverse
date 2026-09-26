# Auto-Buy Tram Bait On-Demand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động mua Mồi câu cá trâm (ID 4875) khi server Avatar từ chối bắt đầu câu với thông báo yêu cầu mồi cá trâm, ngay cả khi cấu hình hiện tại đang chọn loại mồi khác hoặc không tự mua mồi.

**Architecture:** Bổ sung hàm nhận diện mồi câu cụ thể (`detectRequiredBaitId`) từ chuỗi lỗi của server. Mở rộng `executeParkPurchase` để nhận `overrideBaitId`, ghi đè loại mồi câu mục tiêu và tự động đồng bộ lại cấu hình bot sang mồi cá trâm sau khi mua thành công. Cập nhật `startFishingSession` và `runFishingLoop` để truyền mồi ghi đè và cải tiến key theo dõi lỗi liên tiếp.

**Tech Stack:** TypeScript (Node.js), Socket/Binary Game Protocol, EventEmitter, GitNexus

**Spec:** `docs/superpowers/specs/2026-09-26-auto-buy-tram-bait-on-demand-design.md`

## Global Constraints
- Không sửa schema hay cấu trúc dữ liệu `FISHING_BAITS` sẵn có trong `automationTypes.ts`.
- Mọi tham số mới phải là optional để đảm bảo backward compatibility tuyệt đối.
- Tuân thủ quy tắc GitNexus: chạy impact trước khi sửa và detect_changes trước khi commit.
- Không viết test files (tuân thủ quy định No TDD trong `CLAUDE.md`).

---

### Task 1: Bổ sung helper `detectRequiredBaitId` và nâng cấp `executeParkPurchase`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Produces: `detectRequiredBaitId(reason: string): number | null`
- Modifies: `executeParkPurchase(client: GameClient, epoch: number, signal: AbortSignal, missingType: 'ticket' | 'rod' | 'bait', overrideBaitId?: number): Promise<boolean>`

- [x] **Step 1: Khai báo helper `detectRequiredBaitId`**
Bổ sung hàm helper `detectRequiredBaitId` trong `avatar-web/server/src/game/client.ts`:
```typescript
export function detectRequiredBaitId(reason: string): number | null {
  const normalized = reason.trim().toLowerCase();
  if (
    normalized.includes('cá trâm')
    || normalized.includes('mồi câu cá trâm')
    || normalized.includes('mồi cá trâm')
  ) {
    return 4875; // Mồi câu cá trâm
  }
  if (normalized.includes('trứng kiến')) {
    return 448; // Trứng kiến
  }
  if (normalized.includes('mồi trùng') || normalized.includes('trùng')) {
    return 447; // Mồi trùng
  }
  if (normalized.includes('mồi cơm')) {
    return 443; // Mồi cơm
  }
  return null;
}
```

- [x] **Step 2: Nâng cấp `executeParkPurchase` để hỗ trợ `overrideBaitId`**
Cập nhật signature và body của `executeParkPurchase`:
1. Thêm tham số `overrideBaitId?: number`.
2. Khi `missingType === 'bait'`:
   - Xác định `targetBaitId = overrideBaitId ?? cfg.baitType`.
   - Nếu `targetBaitId <= 0` -> dừng câu (nhưng nếu có `overrideBaitId` hợp lệ như 4875 thì sẽ không bị chặn bởi `cfg.baitType <= 0`).
   - Log rõ ràng khi mua theo yêu cầu từ server (`Server yêu cầu ${bait.name} (cấu hình hiện tại: ...)`).
   - Mua `bait.id` với `quantity`.
   - Sau khi mua thành công: nếu `overrideBaitId` khác cấu hình hiện tại, cập nhật `this.fishingConfig.config.baitType = overrideBaitId` và gọi `this.emitAutomation()`.

- [x] **Step 3: Kiểm tra biên dịch**
Run: `npm --prefix avatar-web/server run build`
Expected: Biên dịch thành công, không có lỗi TypeScript.

---

### Task 2: Tích hợp phát hiện lỗi và gọi `overrideBaitId` trong `startFishingSession` và `runFishingLoop`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `detectRequiredBaitId`, `executeParkPurchase`

- [x] **Step 1: Cập nhật `startFishingSession`**
1. Đổi biến `lastMissingType` thành `lastMissingKey: string | null = null`.
2. Trong nhánh xử lý `!startResult.iss`:
   - Kiểm tra `errText.includes('mồi') || errText.includes('cá trâm')` -> gán `missingType = 'bait'`.
   - Lấy `requiredBaitId = detectRequiredBaitId(errText)`.
   - Xây dựng `missingKey = missingType === 'bait' ? `bait:${requiredBaitId ?? this.fishingConfig.config.baitType}` : missingType`.
   - Nếu `missingKey !== lastMissingKey`, gán `lastMissingKey = missingKey` và reset `consecutiveFailures = 0`.
   - Truyền `requiredBaitId ?? undefined` vào `this.executeParkPurchase(client, epoch, signal, missingType, requiredBaitId ?? undefined)`.

- [x] **Step 2: Cập nhật `runFishingLoop`**
Trong nhánh bắt dialog lỗi lúc quăng cần:
- Khi `castErrText.includes('mồi') || castErrText.includes('cá trâm')`:
  - Gán `castMissingType = 'bait'`.
  - Lấy `castRequiredBaitId = detectRequiredBaitId(castErrText)`.
- Truyền `castRequiredBaitId ?? undefined` vào `this.executeParkPurchase(client, epoch, signal, castMissingType, castRequiredBaitId ?? undefined)`.

- [x] **Step 3: Kiểm tra biên dịch & GitNexus check**
Run: `npm --prefix avatar-web/server run build`
Expected: Build thành công.
Run: `detect_changes({scope: "all"})`
Expected: Phân tích diff an toàn, không có lỗi.

---

### Task 3: Commit và hoàn tất tài liệu

**Files:**
- Modify: `docs/superpowers/plans/2026-09-26-auto-buy-tram-bait-on-demand.md`

- [x] **Step 1: Đánh dấu hoàn thành toàn bộ các tasks trong file plan**
- [x] **Step 2: Commit các thay đổi với message chuẩn**
`git commit -m "feat(fishing): auto buy tram bait on demand when required by server"`
