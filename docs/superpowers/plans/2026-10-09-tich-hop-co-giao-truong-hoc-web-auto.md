# Tích Hợp Chế Độ Tự Động Trả Lời Cô Giáo Trường Học (Map 6) Vào Web Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp chế độ tự động trả lời câu hỏi cô giáo (Map 6 Trường học) vào web auto, hỗ trợ chọn lớp Tiếng Anh/Tiếng Việt, xoay vòng board thông minh khi đầy phòng, tự động quay lại chế độ nông trại khi đạt đủ mục tiêu câu đúng (mặc định 0 = không giới hạn), và hiển thị số câu đúng gọn gàng trên UI.

**Architecture:** Mở rộng `AutomationMode` với `'auto_school'`, lưu cấu hình `school_config_json` trong SQLite. Xây dựng `AutoSchoolRunner` độc lập trong `server/src/school/autoSchool.ts` sử dụng bộ từ điển offline 1.217 từ EN và 703 câu VN. Tích hợp với `AvatarSession` để tự động chuyển mode về `auto_farm` khi xong, và cập nhật Frontend với modal `SchoolConfigModal.tsx` cùng status panel trực quan.

**Tech Stack:** TypeScript, Node.js (ESM), Express.js, SQLite (better-sqlite3), React, CSS Tokens.

**Spec:** `docs/superpowers/specs/2026-10-09-tich-hop-co-giao-truong-hoc-web-auto-design.md`

## Global Constraints
- Tuân thủ quy tắc Superpowers: Không viết test trước code (No TDD), chỉ viết test khi được yêu cầu.
- Tuân thủ quy tắc GitNexus: chạy `impact` trước khi sửa file cốt lõi, chạy `detect_changes` trước khi commit.
- Giữ vững quy tắc quản lý bộ nhớ: kiểm tra `df -h` trước/sau khi build, dọn dẹp file tạm trong `/tmp`.

---

### Task 1: Backend Schema, Types & DB Migration

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts`
- Modify: `avatar-web/server/src/db/schema.sql`
- Modify: `avatar-web/server/src/db/index.ts:50-85`
- Modify: `avatar-web/server/src/accounts/automationRepo.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: `AutomationMode` hiện có
- Produces: `SchoolSubject`, `SchoolConfig`, `DEFAULT_SCHOOL_CONFIG`, `SchoolRuntimeState`, `idleSchoolRuntime`

- [x] **Step 1: Cập nhật `automationTypes.ts`**
Thêm `'auto_school'` vào `AutomationMode`.
Thêm các định nghĩa:
```ts
export type SchoolSubject = 'en' | 'vi';

export interface SchoolConfig {
  readonly subject: SchoolSubject;
  readonly targetWins: number; // 0 = không giới hạn
  readonly returnToFarm: boolean; // mặc định true
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = Object.freeze({
  subject: 'en',
  targetWins: 0,
  returnToFarm: true,
});

export interface StoredSchoolConfigState {
  revision: number;
  config: SchoolConfig;
}

export interface SchoolRuntimeState {
  readonly phase: 'idle' | 'moving' | 'waiting_students' | 'answering' | 'finished';
  readonly subject: SchoolSubject;
  readonly currentMap: number | null;
  readonly currentArea: number | null;
  readonly correctCount: number;
  readonly targetWins: number;
  readonly lastQuestion: string | null;
  readonly lastAnswer: string | null;
  readonly lastWinner: string | null;
  readonly lastError: string | null;
}

export function idleSchoolRuntime(): SchoolRuntimeState {
  return {
    phase: 'idle',
    subject: 'en',
    currentMap: null,
    currentArea: null,
    correctCount: 0,
    targetWins: 0,
    lastQuestion: null,
    lastAnswer: null,
    lastWinner: null,
    lastError: null,
  };
}
```
Bổ sung `schoolRuntime?: SchoolRuntimeState;` và `schoolConfig?: SchoolConfig;` vào `AutomationSnapshot`.

- [x] **Step 2: Cập nhật SQLite schema và migration trong `server/src/db/`**
- Trong `server/src/db/schema.sql`:
  Thêm `'auto_school'` vào check constraint của `desired_mode` trong bảng `avatar_automation_state`.
  Thêm cột `school_config_json TEXT` vào bảng `avatar_automation_state`.
- Trong `server/src/db/index.ts`:
  Thêm điều kiện `!stateTable.sql.includes('auto_school')` vào khối migration bảng `avatar_automation_state`. Cập nhật câu lệnh CREATE TABLE mới có `auto_school` và `school_config_json`.

- [x] **Step 3: Cập nhật `automationRepo.ts`**
Thêm helper `normalizeSchoolConfig(input: unknown): SchoolConfig` và `defaultSchoolConfig()`.
Cập nhật `AutomationRow` thêm `school_config_json: string | null`.
Cập nhật `getAutomationState`, `upsertAutomationDesiredMode`, và thêm hàm `setSchoolConfig(db, accountId, config)`.

- [x] **Step 4: Cập nhật `web/src/types.ts`**
Đồng bộ các định nghĩa type mới sang frontend `avatar-web/web/src/types.ts`.

- [x] **Step 5: Verify & Build Type Check**
Chạy: `cd avatar-web/server && npm run build`
Expected: Biên dịch server thành công không lỗi type.

---

### Task 2: REST API Endpoints Cho Cấu Hình Trường Học

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts`

**Interfaces:**
- Consumes: `automationRepo.ts` (`setSchoolConfig`, `getAutomationState`)
- Produces: API `GET /api/accounts/:id/automation/school/config` và `PUT /api/accounts/:id/automation/school/config`

- [x] **Step 1: Đăng ký các endpoints trong `server/src/session/routes.ts`**
```ts
router.get('/accounts/:id/automation/school/config', requireAuth, (req, res) => {
  const accountId = Number(req.params.id);
  // Đọc từ automationRepo, trả về { revision, config }
});

router.put('/accounts/:id/automation/school/config', requireAuth, (req, res) => {
  const accountId = Number(req.params.id);
  // Validate bằng normalizeSchoolConfig, lưu vào DB, thông báo avatarSession nếu đang chạy
});
```

- [x] **Step 2: Verify Endpoints**
Chạy: `cd avatar-web/server && npm run build`
Expected: Không có lỗi biên dịch.

---

### Task 3: Xây Dựng Auto School Runner (`server/src/school/autoSchool.ts`)

**Files:**
- Create: `avatar-web/server/src/school/autoSchool.ts`

**Interfaces:**
- Consumes: `GameClient`, `NATIVE_PARK_JOIN_POSITIONS[6]`, `teacher-dict-en.json`, `teacher-dict-vi.json`
- Produces: Class `AutoSchoolRunner`

- [x] **Step 1: Khởi tạo module `autoSchool.ts`**
- Nạp sẵn bộ từ điển tiếng Anh (`teacher-dict-en.json` - 1.217 từ) và tiếng Việt (`teacher-dict-vi.json` - 703 câu) vào bộ nhớ.
- Tạo class `AutoSchoolRunner` nhận `(client: GameClient, config: SchoolConfig, deps: AutoSchoolRunnerDeps)`.
- Triển khai logic xoay vòng Board (Board Fallback Rotation):
  - Tiếng Anh: Bắt đầu từ `board = 0`. Nếu không nhận được phản hồi phòng trong 10s hoặc bị đẩy ra, tự động thử tiếp `board = 2, 4, 6...` (tối đa 20 board).
  - Tiếng Việt: Bắt đầu từ `board = 1`. Tương tự, nếu không vào được thử tiếp `board = 3, 5, 7...`.
- Triển khai xử lý sự kiện `park-chat` (`cmd 85`):
  - Kiểm tra ID người gửi: `2000000336` (Cô Anh) hoặc `2000000337` (Cô Việt).
  - Bóc tách câu hỏi và tra từ điển:
    - Tiếng Anh: tách theo `" - "` -> tra `dictEn[q]` -> `client.chatPark(answer)`.
    - Tiếng Việt: so khớp `prefix` / `suffix` từ `dictVi` -> `client.chatPark(answer)`.
  - Bắt kết quả thắng:
    - Lắng nghe tin nhắn chúc mừng của cô giáo và game dialog nhận cuốc (`"Bạn thu hoạch được 1 cuốc từ hoạt động trả lời cô giáo..."`) -> Tăng `correctCount`.
    - Cập nhật runtime state lên `deps.onStateChange`.
    - Kiểm tra điều kiện dừng: nếu `config.targetWins > 0 && correctCount >= config.targetWins` -> gọi `deps.onRequestStop('finished', 'Đã đạt đủ số câu thắng mục tiêu')`.
  - Triển khai passive auto-learning: bóc tách đáp án cô giáo công bố -> nạp động vào từ điển.
- Triển khai hàm `stop()` để dọn dẹp event listeners an toàn.

- [x] **Step 2: Verify Runner Logic**
Chạy: `cd avatar-web/server && npm run build`
Expected: File `autoSchool.ts` biên dịch chuẩn TypeScript.

---

### Task 4: Tích Hợp Runner Vào `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `AutoSchoolRunner`, `SchoolConfig`, `SchoolRuntimeState`
- Produces: Quản lý vòng đời `auto_school` trong `AvatarSession`

- [x] **Step 1: Thêm state và dependencies trong `AvatarSession`**
- Thêm thuộc tính `private schoolConfig: SchoolConfig = DEFAULT_SCHOOL_CONFIG;`
- Thêm thuộc tính `private schoolRuntime: SchoolRuntimeState = idleSchoolRuntime();`
- Thêm thuộc tính `private schoolRunner: AutoSchoolRunner | null = null;`
- Khởi tạo `schoolConfig` từ database lúc session nạp cấu hình.

- [x] **Step 2: Tích hợp Start / Stop và Auto-Switching**
- Trong phương thức `switchAutomationMode`:
  - Thêm nhánh xử lý `desiredMode === 'auto_school'`.
  - Khởi tạo `this.schoolRunner = new AutoSchoolRunner(this.client, this.schoolConfig, { ... })`.
  - Trong callback `onRequestStop`:
    ```ts
    onRequestStop: (_reason, message) => {
      if (message) this.pushLog(`[trường học] ${message}`);
      if (this.schoolConfig.returnToFarm) {
        this.pushLog('[trường học] chuyển sang chế độ tự động nông trại.');
        void this.switchAutomationMode({
          desiredMode: 'auto_farm',
          ...
        });
      } else {
        void this.stopAutomation();
      }
    }
    ```
- Dừng `this.schoolRunner?.stop()` khi session dừng hoặc đổi sang mode khác.
- Đưa `schoolRuntime` và `schoolConfig` vào `getAutomationSnapshot()`.

- [x] **Step 3: Verify AvatarSession**
Chạy: `cd avatar-web/server && npm run build`
Expected: Server biên dịch thành công.

---

### Task 5: Xây Dựng Giao Diện Web UI

**Files:**
- Create: `avatar-web/web/src/accounts/SchoolConfigModal.tsx`
- Modify: `avatar-web/web/src/accounts/AccountStatus.tsx`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`

**Interfaces:**
- Consumes: `SchoolConfig`, `SchoolRuntimeState`, API endpoints
- Produces: Modal popup cấu hình, nút chọn mode `🎓 Trường học`, hiển thị tiến độ số câu đúng

- [x] **Step 1: Tạo `SchoolConfigModal.tsx`**
- Xây dựng component popup modal kế thừa chuẩn UI (`useDialogFocus`, phím ESC, overlay).
- Cho phép lựa chọn:
  - Môn học: Radio chọn `Lớp Tiếng Anh` (Board chẵn) hoặc `Lớp Tiếng Việt` (Board lẻ).
  - Số câu thắng mục tiêu: Input số nguyên, mặc định `0` (gợi ý: `0 = không giới hạn, hoặc nhập 10 để nhận đủ 10 cuốc/ngày`).
  - Checkbox: "Quay lại chế độ Nông trại sau khi hoàn thành" (mặc định tích chọn).
- Nút "Hủy" và "Bắt đầu".
- Khi bấm "Bắt đầu": gọi PUT lưu cấu hình -> gọi POST start auto với `mode: 'auto_school'` -> đóng modal và callback cập nhật snapshot.

- [x] **Step 2: Cập nhật `AccountStatus.tsx`**
Thêm nhãn hiển thị cho mode `auto_school`:
```ts
auto_school: 'Trường học',
```

- [x] **Step 3: Cập nhật `StatusPanel.tsx`**
- Thêm `'auto_school'` vào `StatusAutomationMode`.
- Thêm nút chọn chế độ `🎓 Trường học`:
  ```tsx
  <button
    type="button"
    className={`automation-mode-button${selectedMode === 'auto_school' ? ' active' : ''}`}
    aria-pressed={selectedMode === 'auto_school'}
    disabled={controlsLocked}
    onClick={() => setSelectedMode('auto_school')}
  >
    🎓 Trường học
  </button>
  ```
- Trong hàm `startAuto()`:
  - Nếu `selectedMode === 'auto_school'`: mở `setShowSchoolModal(true)` để hiển thị `SchoolConfigModal`.
- Trong hàm tính toán `automationProgress`:
  - Hiển thị gọn gàng theo yêu cầu:
    ```tsx
    if (progressMode === 'auto_school') {
      const s = automation.schoolRuntime;
      const subName = s?.subject === 'en' ? 'Lớp Tiếng Anh' : 'Lớp Tiếng Việt';
      const boardStr = s?.currentArea !== null && s?.currentArea !== undefined ? ` (Khu ${s.currentArea})` : '';
      const targetStr = s?.targetWins && s.targetWins > 0 ? `/${s.targetWins}` : '';
      return `trường học: ${subName}${boardStr} · Đúng: ${s?.correctCount ?? 0}${targetStr} câu`;
    }
    ```

- [x] **Step 4: Verify Frontend Build**
Chạy: `cd avatar-web/web && npm run build`
Expected: Frontend build thành công không có lỗi type/linter.

---

### Task 6: Kiểm Thử Hoàn Thiện & Xác Minh Toàn Diện

**Files:**
- Đảm bảo toàn bộ project build sạch sẽ và chạy thử nghiệm live.

- [x] **Step 1: Kiểm tra build cả server và web**
Run:
`cd /Users/devios/learning-reverse/avatar-web/server && npm run build`
`cd /Users/devios/learning-reverse/avatar-web/web && npm run build`
Expected: Cả 2 project biên dịch không lỗi (0 errors).

- [x] **Step 2: Chạy kiểm thử tự động trả lời cô giáo**
Chạy live test và kiểm tra xoay vòng board nếu board 0 đầy.
Expected: Bot kết nối, trả lời đúng câu hỏi, cập nhật số câu đúng, và tự động chuyển về `auto_farm` khi xong.

- [x] **Step 3: Phân tích thay đổi qua GitNexus và dọn dẹp**
Chạy `detect_changes` của GitNexus để đảm bảo không có tác dụng phụ ngoài ý muốn.
Dọn dẹp file tạm, kiểm tra `df -h`.
