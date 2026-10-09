# Thiết Kế: Tích Hợp Chế Độ Tự Động Trả Lời Cô Giáo Trường Học (Map 6) Vào Web Auto

> **Ngày:** 2026-10-09  
> **Chủ đề:** `tich-hop-co-giao-truong-hoc-web-auto`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)

---

## 1. Mục Tiêu & Bối Cảnh

- **Bối cảnh:**
  - Hoạt động trả lời câu hỏi của Cô Giáo Tiếng Anh & Tiếng Việt tại Trường học (Map 6) trong AvatarHD mang lại phần thưởng giá trị (1 cuốc/câu trả lời đúng, tối đa 10 cuốc/ngày cho hoạt động nông trại).
  - Protocol mạng đã được reverse-engineering và probe thực nghiệm thành công:
    - Map 6, toạ độ native `(264, 157)`.
    - Board chẵn (`board % 2 == 0`): Cô Giáo Tiếng Anh (NPC `2000000336`).
    - Board lẻ (`board % 2 == 1`): Cô Giáo Tiếng Việt (NPC `2000000337`).
    - Giao tiếp 100% qua opcode chat phòng `cmd 85` (`PARK_CHAT`).
  - Toàn bộ ngân hàng câu hỏi offline đã được trích xuất hoàn chỉnh từ JAR `Avatar_ChipMix_Full_build13.jar`:
    - 1.217 từ vựng Tiếng Anh (`teacher-dict-en.json`).
    - 703 câu ca dao / tục ngữ Tiếng Việt (`teacher-dict-vi.json`).
- **Mục tiêu:**
  1. Thêm chế độ tự động mới `auto_school` (Trường học / Cô giáo) vào hệ thống `avatar-web`.
  2. Cho phép người dùng cấu hình:
     - Môn học: Tiếng Anh (`en`) hoặc Tiếng Việt (`vi`).
     - Số câu thắng mục tiêu (`targetWins`): **Mặc định là `0`** (không giới hạn, cắm liên tục; hoặc nhập số dương cụ thể ví dụ `10`).
     - Tự động quay lại chế độ Nông trại (`returnToFarm: true`) khi đạt đủ số câu thắng mục tiêu (nếu `targetWins > 0`).
  3. Cơ chế tự động tìm và chuyển Board (Board Fallback Rotation):
     - Tiếng Anh dùng các board chẵn (`0, 2, 4, 6...`).
     - Tiếng Việt dùng các board lẻ (`1, 3, 5, 7...`).
     - Nếu không vào được Board 0 hoặc 1 (phòng đầy, lỗi kết nối, hoặc phòng không có hoạt động), bot tự động xoay vòng sang các board kế tiếp cùng tính chất chẵn/lẻ.
  4. Xây dựng giao diện web:
     - Nút chọn mode `🎓 Trường học` trong `StatusPanel.tsx`.
     - Popup modal `SchoolConfigModal.tsx` để chọn môn học và số câu thắng khi nhấn "Bắt đầu".
     - Hiển thị gọn gàng số câu trả lời đúng trên Web UI.
  5. Tự động chuyển mode về `auto_farm` khi đã đạt mục tiêu câu đúng được chỉ định.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Backend Contracts & Database:**
   - Bổ sung `auto_school` vào `AutomationMode` trong `session/automationTypes.ts` và `accounts/automationRepo.ts`.
   - Định nghĩa `SchoolConfig` (`subject: 'en' | 'vi'`, `targetWins: number`, `returnToFarm: boolean`) và `SchoolRuntimeState`.
   - Cập nhật database SQLite bảng `automation_profiles`: thêm cột `school_config_json TEXT`.
   - Thêm REST API endpoint:
     - `GET /api/accounts/:id/automation/school/config`
     - `PUT /api/accounts/:id/automation/school/config`
2. **Backend Runner (`server/src/school/autoSchool.ts`):**
   - Tạo runner `AutoSchoolRunner` độc lập, quản lý kết nối vào Map 6, chọn board tương ứng với môn học (Board 0 cho Tiếng Anh, Board 1 cho Tiếng Việt).
   - Lắng nghe sự kiện `park-chat` (`cmd 85`), tra cứu từ điển và gửi đáp án qua `client.chatPark(answer)`.
   - Đếm số câu thắng (`winsCount`) qua tin nhắn chúc mừng của cô giáo và game dialog nhận cuốc.
   - Khi đạt đủ `targetWins`: báo `onRequestStop('finished', 'Đã hoàn thành số câu thắng mục tiêu')`.
   - Hỗ trợ cơ chế tự học bị động (Passive Auto-Learning) lưu vào file từ điển khi cô giáo công bố đáp án.
3. **Session Coordinator Integration (`session/avatarSession.ts`):**
   - Quản lý vòng đời `schoolRunner`: khởi động khi `desiredMode === 'auto_school'`, dừng an toàn khi chuyển mode.
   - Xử lý callback `onRequestStop`: nếu `returnToFarm === true` thì tự động chuyển sang `auto_farm`.
4. **Frontend UI (`avatar-web/web`):**
   - Cập nhật `types.ts` đồng bộ với backend schema.
   - Thêm nút mode `🎓 Trường học` trong thanh chọn chế độ của `StatusPanel.tsx`.
   - Tạo modal `SchoolConfigModal.tsx` (chọn môn học, nhập số câu thắng, checkbox quay lại nông trại).
   - Hiển thị runtime card / status line cho `auto_school` trên `StatusPanel.tsx`.

### 2.2 Out-of-Scope
- Không thay đổi các mode automation hiện có (`auto_farm`, `auto_fishing`, `auto_mining`, `auto_maze`, `find_npc`).
- Không tạo solver dịch thuật bên thứ 3 (sử dụng 100% bộ từ điển offline đã trích xuất từ JAR kết hợp passive learning).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Files & Modules

| File | Module | Vai trò / Thay đổi |
| :--- | :--- | :--- |
| `server/src/session/automationTypes.ts` | Server Core | Thêm `auto_school` vào `AutomationMode`, định nghĩa `SchoolConfig`, `SchoolRuntimeState`, `idleSchoolRuntime`. |
| `server/src/accounts/automationRepo.ts` | DB Repo | Thêm validate `normalizeSchoolConfig`, lưu/đọc `school_config_json` từ SQLite. |
| `server/src/school/autoSchool.ts` | **Tạo mới** | Bộ điều phối tự động trả lời cô giáo (Map 6 Board 0/1, tra từ điển, gửi chat, theo dõi thắng cuộc). |
| `server/src/session/avatarSession.ts` | Session | Tích hợp khởi chạy `AutoSchoolRunner`, xử lý chuyển sang `auto_farm` khi kết thúc. |
| `server/src/session/routes.ts` | API Routes | Đăng ký route GET/PUT `/api/accounts/:id/automation/school/config`. |
| `web/src/types.ts` | Web Types | Đồng bộ các types `SchoolConfig`, `SchoolRuntimeState`, `StoredSchoolConfigState`. |
| `web/src/accounts/AccountStatus.tsx` | Web Status | Thêm badge/chip hiển thị mode `auto_school` (`🎓 Trường học`). |
| `web/src/accounts/SchoolConfigModal.tsx` | **Tạo mới** | Modal chọn môn học (Anh/Việt), số câu thắng, và tùy chọn quay lại nông trại. |
| `web/src/accounts/panels/StatusPanel.tsx` | Web UI | Thêm nút `🎓 Trường học`, hiển thị popup khi bấm Bắt đầu, render tiến độ câu hỏi/đáp án. |

---

### 3.2 Data Contracts & Interfaces

#### 1. Cấu hình (`SchoolConfig`)
```ts
export type SchoolSubject = 'en' | 'vi';

export interface SchoolConfig {
  readonly subject: SchoolSubject;   // 'en' (Board chẵn) hoặc 'vi' (Board lẻ)
  readonly targetWins: number;       // Số câu thắng mục tiêu (mặc định 0 = không giới hạn)
  readonly returnToFarm: boolean;    // Quay lại auto_farm sau khi đạt targetWins (mặc định true)
}

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = Object.freeze({
  subject: 'en',
  targetWins: 0,
  returnToFarm: true,
});
```

#### 2. Trạng thái thực thi (`SchoolRuntimeState`)
```ts
export interface SchoolRuntimeState {
  readonly phase: 'idle' | 'moving' | 'answering' | 'finished';
  readonly subject: SchoolSubject;
  readonly currentMap: number | null;
  readonly currentArea: number | null;
  readonly correctCount: number;     // Số câu trả lời đúng
  readonly targetWins: number;       // 0 = vô hạn
  readonly lastQuestion: string | null;
  readonly lastAnswer: string | null;
  readonly lastWinner: string | null;
  readonly lastError: string | null;
}
```

#### 3. Cơ chế Xoay Vòng Board (Board Fallback Rotation)
- Map 6 có dải board từ 0 đến N (mặc định kiểm tra 0..20).
- Tiếng Anh: Bắt đầu từ `board = 0`. Nếu không vào được (bị đầy phòng, không nhận gói phản hồi board hoặc không có cô giáo sau 15s), tự động tăng `board = (board + 2) % 20`.
- Tiếng Việt: Bắt đầu từ `board = 1`. Nếu không vào được, tự động tăng `board = ((board - 1 + 2) % 20) + 1` (duyệt qua 1, 3, 5, 7, 9...).
- Luôn đảm bảo giữ đúng tính chẵn / lẻ theo quy định của game để không bị vào nhầm môn học.

---

### 3.3 Luồng Hoạt Động (Execution Flow)

```
[User trên Web UI]
       │
       ▼ Chọn mode "🎓 Trường học" và bấm "Bắt đầu"
[Mở SchoolConfigModal]
       │
       ▼ User chọn: Môn học (Anh/Việt) + Số câu thắng (mặc định 0) + Quay lại nông trại (Checked)
[Lưu cấu hình qua PUT /api/.../school/config]
       │
       ▼ Gọi POST /api/.../automation/start { mode: 'auto_school' }
[AvatarSession khởi chạy AutoSchoolRunner]
       │
       ├─► 1. Chuyển context Park (GET_HANDLER 9)
       ├─► 2. Join Map 6:
       │      - Tiếng Anh: Board 0 (nếu lỗi/đầy/không có cô giáo -> Board 2, 4, 6...)
       │      - Tiếng Việt: Board 1 (nếu lỗi/đầy/không có cô giáo -> Board 3, 5, 7...)
       ├─► 3. Lắng nghe RX 85:
       │      - Cô giáo phát câu hỏi -> Tra từ điển -> Gửi TX 85 ngay trong 0ms.
       │      - Nhận dialog nhận cuốc / chúc mừng thắng cuộc -> correctCount++.
       │      - Cập nhật SchoolRuntimeState lên WebSocket để UI hiển thị số câu đúng.
       │
       ▼ correctCount >= targetWins (khi targetWins > 0)
[AutoSchoolRunner gọi onRequestStop('finished')]
       │
       ▼ AvatarSession bắt callback onRequestStop
[AvatarSession tự động gọi switchAutomationMode({ desiredMode: 'auto_farm' })]
       │
       ▼ Chuyển sang Nông trại (enterFarm) và tiếp tục chu kỳ chăm sóc cây/vật nuôi!
```

### 3.4 Hiển Thị Trên Web UI
- Tại `StatusPanel.tsx`: Khi mode là `auto_school`, status line hiển thị súc tích:
  ```text
  trường học: Lớp Tiếng Anh (Khu 0) · Đúng: 3 câu
  ```
  Nếu có `targetWins > 0`:
  ```text
  trường học: Lớp Tiếng Anh (Khu 0) · Đúng: 3/10 câu
  ```
- Không nhồi nhét text rườm rà, tập trung hiển thị chính xác số câu đúng theo yêu cầu.

```
[User trên Web UI]
       │
       ▼ Chọn mode "🎓 Trường học" và bấm "Bắt đầu"
[Mở SchoolConfigModal]
       │
       ▼ User chọn: Môn học (Anh/Việt) + Số câu thắng (10) + Quay lại nông trại (Checked)
[Lưu cấu hình qua PUT /api/.../school/config]
       │
       ▼ Gọi POST /api/.../automation/start { mode: 'auto_school' }
[AvatarSession khởi chạy AutoSchoolRunner]
       │
       ├─► 1. Chuyển context Park (GET_HANDLER 9)
       ├─► 2. Join Map 6 (Board 0 nếu Tiếng Anh, Board 1 nếu Tiếng Việt)
       ├─► 3. Lắng nghe RX 85:
       │      - Cô giáo phát câu hỏi -> Tra từ điển -> Gửi TX 85 ngay trong 0ms.
       │      - Nhận dialog nhận cuốc / chúc mừng thắng cuộc -> winsCount++.
       │      - Cập nhật SchoolRuntimeState lên WebSocket để UI hiển thị.
       │
       ▼ winsCount >= targetWins (hoặc đạt giới hạn)
[AutoSchoolRunner gọi onRequestStop('finished')]
       │
       ▼ AvatarSession bắt callback onRequestStop
[AvatarSession tự động gọi switchAutomationMode({ desiredMode: 'auto_farm' })]
       │
       ▼ Chuyển sang Nông trại (enterFarm) và tiếp tục chu kỳ chăm sóc cây/vật nuôi!
```

---

## 4. Xử Lý Các Trường Hợp Đặc Biệt (Edge Cases)

1. **Phòng chưa đủ người (Lớp Tiếng Việt):**
   - Cô giáo Tiếng Việt yêu cầu tối thiểu người chơi trong phòng: `"Chúng ta cùng đợi các bạn đến đông đủ..."`.
   - Runner chuyển phase sang `'waiting_students'`, giữ kết nối và chờ cho đến khi có người vào để bắt đầu.
2. **Không có trong từ điển:**
   - Nếu gặp từ mới chưa có trong từ điển: không đoán mò bừa bãi tránh spam.
   - Khi cô giáo công bố đáp án (`"Đáp án của câu hỏi X là Y"`): runner tự động học từ mới và ghi vào file JSON.
3. **Mất kết nối / Reconnect:**
   - `AvatarSession` tự động giữ `desiredMode: 'auto_school'` và số `winsCount` đã tích lũy trong ngày, reconnect và tiếp tục vòng đố.
4. **Không muốn quay lại nông trại:**
   - Nếu `returnToFarm === false`, runner dừng lại ở trạng thái `idle` và tắt auto sau khi hoàn thành.

---

## 5. Kế Hoạch Kiểm Tra (Verification Plan)

1. **Unit / Integration Logic Test:**
   - Kiểm tra load/save từ điển Tiếng Anh (1.217 từ) và Tiếng Việt (703 câu).
   - Kiểm tra hàm khớp câu hỏi tiếng Việt (prefix/suffix matching).
2. **REST API Test:**
   - `curl -X GET /api/accounts/1/automation/school/config` -> trả về cấu hình mặc định.
   - `curl -X PUT /api/accounts/1/automation/school/config` -> cập nhật thành công và tăng revision.
3. **End-to-End Test với Tài Khoản Thật:**
   - Kích hoạt mode `auto_school` (subject: `en`, targetWins: 1).
   - Quan sát bot vào Map 6 Board 0, trả lời đúng 1 câu, nhận 1 cuốc.
   - Kiểm tra hệ thống tự động switch mode sang `auto_farm` và bắt đầu chăm sóc nông trại.
4. **Kiểm tra Frontend Build:**
   - Chạy `npm run build` trên cả `server` và `web` đảm bảo không có lỗi TypeScript hay cú pháp.
