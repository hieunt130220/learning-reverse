# Codex Quota Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ CLI/Daemon giám sát các session Codex bị dừng do lỗi quota và tự động kích hoạt gửi lệnh `"tiếp tục"` vào app Orca khi quota được reset.

**Architecture:** Sử dụng Python 3 đọc dữ liệu SQLite từ `thread_history_1.sqlite` & `state_5.sqlite` trong chế độ read-only. Trích xuất thời điểm reset chính xác qua rollout JSONL hoặc regex lỗi, sau đó hẹn giờ tự động kích hoạt Orca qua AppleScript (`osascript`) và lưu state chống kích hoạt lặp.

**Tech Stack:** Python 3.13, SQLite3, AppleScript (`osascript`), JSON.

**Spec:** `docs/superpowers/specs/2026-10-08-codex-quota-monitor-design.md`

## Global Constraints
- Không ghi trực tiếp vào các database nội bộ của Codex; chỉ đọc với URI `file:path?mode=ro`.
- Không tạo các file test tự động theo quy định NO-TDD của project (chỉ verify bằng lệnh kiểm tra thực tế).
- Tuân thủ quy tắc GitNexus: chạy impact/detect_changes và commit từng task hoàn chỉnh.

---

### Task 1: Quản Lý State Xử Lý (`state_store.py`)

**Files:**
- Create: `tools/codex-quota-monitor/state_store.py`

**Interfaces:**
- Produces: `class StateStore`:
  - `is_turn_processed(turn_id: str) -> bool`
  - `mark_turn_processed(turn_id: str, thread_id: str, metadata: dict = None) -> None`
  - File lưu trữ: `~/.codex/quota_monitor_state.json`

- [x] **Step 1: Viết module `state_store.py`**
Tạo thư mục `tools/codex-quota-monitor` và file `state_store.py` hỗ trợ đọc/ghi file JSON an toàn, tự khởi tạo file rỗng nếu chưa tồn tại.

- [x] **Step 2: Kiểm tra chức năng**
Chạy: `python3 -c "from tools.codex_quota_monitor.state_store import StateStore; s = StateStore(); print(s.is_turn_processed('dummy'))"`
Expected: In ra `False` và file `~/.codex/quota_monitor_state.json` hợp lệ.

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/state_store.py && git commit -m "feat(quota-monitor): add StateStore module for tracking processed turns"`

---

### Task 2: Trích Xuất Thời Điểm Reset Quota (`reset_parser.py`)

**Files:**
- Create: `tools/codex-quota-monitor/reset_parser.py`

**Interfaces:**
- Consumes: `rollout_path: Optional[str]`, `error_message: str`
- Produces: `parse_reset_time(rollout_path: Optional[str], error_message: str) -> Optional[datetime]`

- [x] **Step 1: Viết module `reset_parser.py`**
Triển khai logic:
1. Đọc ngược 50-100 dòng cuối của file `rollout_path` (nếu tồn tại) tìm record `token_count` -> lấy `rate_limits.primary.resets_at` hoặc `rate_limits.secondary.resets_at`.
2. Fallback sang regex trên `error_message`:
   - Mẫu giờ: `(?:at\s+)(\d{1,2}:\d{2}\s+(?:AM|PM))`
   - Mẫu ngày đầy đủ: `(?:at\s+)([A-Z][a-z]{2}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}\s+\d{1,2}:\d{2}\s+(?:AM|PM))`
3. Trả về đối tượng `datetime` có timezone local.

- [x] **Step 2: Kiểm tra với các mẫu thực tế từ DB**
Chạy: `python3 -c "from tools.codex_quota_monitor.reset_parser import parse_reset_time; print(parse_reset_time(None, '... try again at 3:30 PM.'))"`
Expected: Trả về datetime ngày hiện tại lúc 15:30.

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/reset_parser.py && git commit -m "feat(quota-monitor): add reset time parser for rollout jsonl and error text"`

---

### Task 3: Truy Vấn Session Bị Quota Block Từ SQLite (`db_reader.py`)

**Files:**
- Create: `tools/codex-quota-monitor/db_reader.py`

**Interfaces:**
- Consumes: Đường dẫn `~/.codex/thread_history_1.sqlite` và `~/.codex/state_5.sqlite`
- Produces: `get_blocked_sessions() -> List[BlockedSession]`
  - `BlockedSession`: Dataclass chứa `thread_id`, `turn_id`, `title`, `cwd`, `rollout_path`, `error_message`, `failed_at`, `reset_time`

- [x] **Step 1: Viết module `db_reader.py`**
Kết nối SQLite ở chế độ read-only.
Thực hiện truy vấn SQL lấy turn mới nhất của từng thread bị lỗi `usageLimitExceeded`. Join với bảng `threads` trong `state_5.sqlite` qua `ATTACH DATABASE`.
Gọi `parse_reset_time()` để điền trường `reset_time`.

- [x] **Step 2: Kiểm tra truy vấn live**
Chạy: `python3 -c "from tools.codex_quota_monitor.db_reader import get_blocked_sessions; print(len(get_blocked_sessions()))"`
Expected: Trả về danh sách session bị block (dựa trên DB thực tế).

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/db_reader.py && git commit -m "feat(quota-monitor): add db reader for querying quota-blocked sessions"`

---

### Task 4: Kích Hoạt Orca & Gửi Thông Báo macOS (`orca_trigger.py`)

**Files:**
- Create: `tools/codex-quota-monitor/orca_trigger.py`

**Interfaces:**
- Produces:
  - `send_notification(title: str, message: str) -> None`
  - `trigger_orca_continue(message: str = "tiếp tục", dry_run: bool = False) -> bool`

- [x] **Step 1: Viết module `orca_trigger.py`**
1. `send_notification`: Dùng lệnh `osascript -e 'display notification ... with title ...'`.
2. `trigger_orca_continue`:
   - Kiểm tra `pgrep -x "Orca"`. Nếu Orca không chạy -> log warning và return False.
   - Nếu `dry_run=True`: log thông tin ra màn hình mà không gửi phím.
   - Nếu `dry_run=False`: Thực thi AppleScript activate Orca, delay 0.5s, keystroke `"tiếp tục"` và phím Enter (`key code 36`).

- [x] **Step 2: Kiểm tra với chế độ `--dry-run`**
Chạy: `python3 -c "from tools.codex_quota_monitor.orca_trigger import trigger_orca_continue; print(trigger_orca_continue(dry_run=True))"`
Expected: In thông báo Dry-run và trả về `True`.

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/orca_trigger.py && git commit -m "feat(quota-monitor): add orca trigger and notification module"`

---

### Task 5: Xây Dựng CLI & Daemon Loop (`monitor.py`, `__init__.py`)

**Files:**
- Create: `tools/codex-quota-monitor/__init__.py`
- Create: `tools/codex-quota-monitor/monitor.py`

**Interfaces:**
- CLI commands:
  - `python3 tools/codex-quota-monitor/monitor.py status`
  - `python3 tools/codex-quota-monitor/monitor.py resume <thread_id> [--dry-run]`
  - `python3 tools/codex-quota-monitor/monitor.py watch [--buffer-seconds 15] [--interval 30] [--dry-run]`

- [x] **Step 1: Viết module `monitor.py` và `__init__.py`**
1. Định nghĩa CLI bằng `argparse`.
2. Lệnh `status`: In bảng trạng thái hiển thị ID, Title, Giờ lỗi, Giờ Reset, Trạng thái đếm ngược.
3. Lệnh `resume`: Kích hoạt thủ công cho 1 thread id cụ thể.
4. Lệnh `watch`: Chạy vòng lặp kiểm tra:
   - Quét các session bị block qua `get_blocked_sessions()`.
   - Lọc bỏ các turn đã xử lý trong `StateStore`.
   - Với session đã tới giờ reset + buffer: gọi `trigger_orca_continue`, gửi notification, ghi state.
   - Tính toán thời gian sleep tối ưu tới mốc reset gần nhất (tối đa bằng `interval` giây).

- [x] **Step 2: Kiểm tra lệnh status và help**
Chạy: `python3 tools/codex-quota-monitor/monitor.py --help` và `python3 tools/codex-quota-monitor/monitor.py status`
Expected: Output sạch sẽ, bảng status hiển thị đúng thông tin.

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/__init__.py tools/codex-quota-monitor/monitor.py && git commit -m "feat(quota-monitor): add CLI entrypoint and watch daemon loop"`

---

### Task 6: Kiểm Tra Toàn Diện & Tạo Wrapper Thực Thi (`dev.sh` hoặc script tiện ích)

**Files:**
- Modify: `dev.sh` (hoặc tạo script executable `tools/codex-quota-monitor/run.sh`)

- [x] **Step 1: Cấp quyền thực thi và tạo script chạy nhanh**
Tạo file `tools/codex-quota-monitor/run.sh` với `chmod +x`.

- [x] **Step 2: Chạy thử toàn bộ các subcommands**
Chạy `status`, `resume --dry-run`, `watch --dry-run` trong 3 giây.
Expected: Toàn bộ hoạt động ổn định, không có lỗi runtime.

- [x] **Step 3: Commit**
`git add tools/codex-quota-monitor/run.sh && git commit -m "feat(quota-monitor): add executable runner script"`
