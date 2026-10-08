# Spec: Công Cụ Giám Sát & Tự Động Tiếp Tục Session Codex Khi Hết Quota (codex-quota-monitor)

## Mục tiêu & Bối cảnh

### 1. Bối cảnh
- Khi làm việc với Codex CLI trong terminal Orca (`/Applications/Orca.app`), người dùng thường xuyên gặp lỗi chạm trần quota sử dụng (`usageLimitExceeded`).
- Turn bị lỗi kết thúc với thông báo:
  ```text
  You’ve hit your usage limit. Upgrade to Pro (...), visit ... or try again at 3:30 PM.
  ```
- Đồng thời, thông tin `resets_at` (epoch timestamp) được ghi lại trong file rollout JSONL tương ứng tại payload `token_count.rate_limits.primary.resets_at`.
- Hiện tại, người dùng phải tự canh giờ reset để quay lại Orca terminal gõ `"tiếp tục"`. Việc này làm gián đoạn luồng làm việc và tốn thời gian theo dõi thủ công.

### 2. Mục tiêu
- Xây dựng công cụ CLI / Daemon bằng Python (`tools/codex-quota-monitor/`):
  1. Tự động phát hiện các session Codex bị dừng do lỗi quota (`usageLimitExceeded`).
  2. Xác định chính xác thời điểm quota được mở lại (kết hợp epoch timestamp từ rollout và parser regex tin nhắn lỗi).
  3. Tự động kích hoạt lại session bằng cách gửi chuỗi `"tiếp tục\n"` vào app Orca qua AppleScript ngay khi đến giờ reset (+ buffer an toàn).
  4. Gửi macOS Notification cảnh báo người dùng.
  5. Quản lý trạng thái để tránh gửi lặp lại nhiều lần cho cùng một turn lỗi.

---

## Phạm vi (Scope)

### In-scope
1. **Truy vấn SQLite Codex**:
   - `~/.codex/thread_history_1.sqlite`: Lấy các turn mới nhất có trạng thái `failed` và `error_json` chứa `usageLimitExceeded`.
   - `~/.codex/state_5.sqlite`: Lấy metadata session (tiêu đề, CWD, đường dẫn file rollout `.jsonl`).
2. **Trích xuất thời điểm Reset Quota**:
   - Ưu tiên 1: Đọc ngược từ cuối file rollout `.jsonl` để lấy `rate_limits.primary.resets_at` hoặc `rate_limits.secondary.resets_at`.
   - Ưu tiên 2: Phân tích cú pháp regex trên chuỗi `message` trong `error_json` (ví dụ: `try again at 3:30 PM`, `try again at Aug 20th, 2026 10:36 AM`).
3. **Trigger App Orca (AppleScript)**:
   - Kích hoạt cửa sổ Orca (`tell application "Orca" to activate`).
   - Gửi phím `"tiếp tục"` kèm phím `Return` qua System Events.
   - Hỗ trợ chế độ `--dry-run` để test không can thiệp phím thật.
4. **State Tracking & Cooldown**:
   - Lưu trữ các `turn_id` đã được xử lý vào `~/.codex/quota_monitor_state.json`.
5. **Giao diện dòng lệnh (CLI)**:
   - `status`: Liệt kê các session đang bị quota block, thời gian reset và đếm ngược.
   - `watch`: Chạy vòng lặp daemon (poll định kỳ 60s, tự động lên lịch sleep tới mốc reset gần nhất).
   - `resume <thread_id>`: Cho phép trigger thủ công ngay lập tức.

### Out-of-scope
- Can thiệp vào binary nội bộ hoặc sửa đổi mã nguồn của Codex / Orca.
- Can thiệp vào các session của provider khác không phải ChatGPT / OpenAI Codex.

### Edge cases & Xử lý lỗi
- **Session đã có turn mới thành công**: Nếu sau turn lỗi đã có turn `completed` do người dùng gõ tay trước đó, bỏ qua không trigger lại.
- **Orca đang không chạy**: Gửi macOS Notification báo lỗi, không cố gọi AppleScript làm crash ứng dụng.
- **Nhiều session bị block cùng lúc**: Sắp xếp theo thứ tự reset sớm nhất; kích hoạt tuần tự cách nhau 3 giây để tránh nghẽn phím trong Orca.

---

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. Cấu trúc thư mục
```
tools/codex-quota-monitor/
├── __init__.py
├── db_reader.py          # Đọc SQLite thread_history_1 & state_5
├── reset_parser.py       # Trích xuất thời điểm reset từ JSONL & error message
├── orca_trigger.py       # Kích hoạt Orca qua AppleScript & gửi macOS notification
├── state_store.py        # Lưu turn_id đã xử lý vào quota_monitor_state.json
└── monitor.py            # CLI entrypoint (status, watch, resume)
```

### 2. Chi tiết các module

#### Module `db_reader.py`
- Kết nối `sqlite3.connect("file:~/.codex/thread_history_1.sqlite?mode=ro", uri=True)`.
- Query lấy turn cuối cùng của từng thread:
  ```sql
  WITH ranked_turns AS (
    SELECT thread_id, turn_id, status, error_json, started_at, completed_at,
           ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY rollout_ordinal DESC) as rn
    FROM thread_turns
  )
  SELECT r.thread_id, r.turn_id, r.status, r.error_json, r.started_at,
         t.title, t.cwd, t.rollout_path
  FROM ranked_turns r
  JOIN threads t ON t.id = r.thread_id
  WHERE r.rn = 1 AND r.status = 'failed' AND r.error_json LIKE '%usageLimitExceeded%';
  ```

#### Module `reset_parser.py`
- Hàm `get_reset_timestamp(rollout_path: str, error_message: str) -> Optional[datetime]`:
  1. Đọc 50 dòng cuối của `rollout_path` tìm `rate_limits`: nếu có `resets_at` > `now`, trả về datetime.
  2. Nếu không tìm thấy trong rollout, regex trên `error_message`:
     - Pattern thời gian trong ngày: `(?:at\s+)(\d{1,2}:\d{2}\s+(?:AM|PM))` -> parse giờ hôm nay hoặc ngày mai.
     - Pattern ngày đầy đủ: `(?:at\s+)([A-Z][a-z]{2}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}\s+\d{1,2}:\d{2}\s+(?:AM|PM))`.

#### Module `orca_trigger.py`
- Hàm `send_continue_to_orca(message: str = "tiếp tục") -> bool`:
  - Kiểm tra tiến trình `Orca` đang chạy: `pgrep -x "Orca"`.
  - Thực thi AppleScript:
    ```applescript
    tell application "Orca" to activate
    delay 0.5
    tell application "System Events"
        keystroke "tiếp tục"
        key code 36
    end tell
    ```
- Hàm `send_notification(title: str, text: str)`:
  - `display notification "..." with title "..."`.

#### Module `state_store.py`
- Lưu vào `~/.codex/quota_monitor_state.json`:
  ```json
  {
    "processed_turns": {
      "01a114a0-5f84-7d10-bd1e-2070dfa526c0": {
        "thread_id": "01a11444-9191-7b50-be5d-29bd62e4fc3d",
        "resumed_at": "2026-10-07T15:30:15Z",
        "status": "success"
      }
    }
  }
  ```

#### Module `monitor.py`
- Lệnh `status`: In bảng trạng thái gồm: `Thread ID`, `Title`, `Reset Time`, `Remaining Time`, `Action Status`.
- Lệnh `watch --buffer 15 --interval 60`:
  - Vòng lặp kiểm tra: nếu phát hiện session đến hạn reset + buffer (15s) và chưa xử lý -> kích hoạt `send_continue_to_orca`, ghi state, gửi notification.
  - Sleep thông minh: ngủ đến thời điểm reset gần nhất hoặc poll tối đa 60 giây.

---

## Kế hoạch kiểm thử (Verification Plan)

### Automated Checks
- Kiểm tra cú pháp và kiểu dữ liệu: `python3 -m py_compile tools/codex-quota-monitor/*.py`.
- Unit test parser `reset_parser.py` với các mẫu lỗi thực tế lấy từ database `thread_history_1.sqlite`.

### Manual Checks
1. Chạy `python3 tools/codex-quota-monitor/monitor.py status` để xác nhận đọc chính xác danh sách thread và thời gian reset hiện có trong lịch sử DB.
2. Test với cờ `--dry-run`: Chạy `python3 tools/codex-quota-monitor/monitor.py resume <thread_id> --dry-run` để kiểm tra luồng phát hiện và format lệnh mà không gửi phím thật.
3. Test trigger thực tế vào Orca khi người dùng đang mở một session sẵn sàng.
