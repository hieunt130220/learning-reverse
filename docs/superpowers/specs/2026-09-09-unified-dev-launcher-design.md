# Unified Dev Launcher Design Document

## Mục tiêu & Bối cảnh

### Vấn đề cần giải quyết
Hiện tại, để chạy đầy đủ hệ thống `avatar-web` phục vụ tính năng auto-farm và auto-câu cá trên máy local, lập trình viên phải mở thủ công 3 cửa sổ terminal riêng biệt:
1. `avatar-web/fishing-ml`: Dịch vụ AI suy luận Captcha câu cá (Python, Port 8080).
2. `avatar-web/server`: Backend Node.js API + WebSocket kết nối game (Port 8787).
3. `avatar-web/web`: Frontend React/Vite (Port 5173).

Nếu quên không khởi động service `fishing-ml`, hệ thống tự động fallback sang cơ chế random TX43 khiến giật hụt 100% cá, lãng phí mồi và tiền xu in-game. Việc quản lý 3 terminal riêng lẻ cũng gây bất tiện khi dừng hoặc khởi động lại (dễ sót tiến trình chạy ngầm làm chiếm dụng port).

### Mục tiêu
Cung cấp một script khởi chạy hợp nhất (`dev.sh`) cho phép:
- Khởi động đồng thời cả 3 dịch vụ chỉ với một lệnh duy nhất: `./dev.sh`.
- Gom toàn bộ log hiển thị trên 1 màn hình terminal, có tiền tố màu sắc rõ ràng phân biệt từng dịch vụ (`[ml]`, `[server]`, `[web]`).
- Tự động kiểm tra điều kiện môi trường trước khi chạy (Python venv, node_modules, .env, model frozen artifacts).
- Bắt tín hiệu ngắt (`Ctrl + C` / SIGINT / SIGTERM) để tắt sạch sẽ toàn bộ các tiến trình con, không để sót zombie process chiếm dụng port.

---

## Phạm vi (Scope)

### In-scope
- Tạo script thực thi `dev.sh` tại thư mục gốc repository `learning-reverse/dev.sh` và symlink hoặc wrapper tại `avatar-web/dev.sh`.
- Hỗ trợ cả macOS và Linux (POSIX-compliant bash/zsh).
- Kiểm tra các cổng 8080, 8787, 5173 trước khi khởi động; cảnh báo nếu cổng đã bị chiếm.
- Chạy 3 dịch vụ ở chế độ live development:
  - `fishing-ml`: `.venv/bin/python -m fishing_ml.inference_service ...`
  - `server`: `npm run dev` (sử dụng `tsx watch`)
  - `web`: `npm run dev` (sử dụng `vite`)
- Log streaming có gắn nhãn màu:
  - Cyan cho `[ml]`
  - Green cho `[server]`
  - Magenta cho `[web]`
  - Yellow/Red cho các thông báo quản trị của script launcher
- Dọn dẹp tiến trình an toàn khi nhận `SIGINT` (Ctrl+C), `SIGTERM`, hoặc khi một trong các service gặp lỗi thoát sớm.

### Out-of-scope
- Không thay đổi logic nghiệp vụ bên trong code của `server`, `web`, hay `fishing-ml`.
- Không thay thế quy trình triển khai PM2 trên production VPS (GCP).

---

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. Cấu trúc thư mục & Files liên quan

```text
/Users/devios/learning-reverse/
├── dev.sh                     # Script khởi chạy chính tại root
├── avatar-web/
│   ├── dev.sh -> ../dev.sh    # Symlink để chạy được từ bên trong avatar-web/
│   ├── fishing-ml/
│   │   ├── .venv/             # Python virtual environment
│   │   └── artifacts/...      # Model candidate đã frozen
│   ├── server/
│   │   ├── .env               # File biến môi trường backend
│   │   └── package.json       # Script npm run dev
│   └── web/
│       └── package.json       # Script npm run dev
```

### 2. Luồng xử lý của `dev.sh` (Execution Flow)

```text
                   [Bắt đầu: ./dev.sh]
                           │
                           ▼
          [1. Xác định Root Path & Chuyển CWD]
                           │
                           ▼
          [2. Pre-flight Check]
          ├── Kiểm tra Node.js & npm
          ├── Kiểm tra Python venv tại avatar-web/fishing-ml/.venv
          ├── Kiểm tra model frozen tại avatar-web/fishing-ml/artifacts/
          ├── Kiểm tra server/.env & node_modules
          └── Kiểm tra web/node_modules
                           │
                           ▼
          [3. Port Conflict Check (8080, 8787, 5173)]
          └── Nếu port đang bị chiếm: thông báo PID và hỏi/yêu cầu giải phóng
                           │
                           ▼
          [4. Đăng ký Trap Signal (INT, TERM, EXIT)]
          └── cleanup() -> kill -TERM -$PGID hoặc danh sách PIDs
                           │
                           ▼
          [5. Khởi chạy 3 Services song song]
          ├── (cd fishing-ml && python ...) | format_log "[ml]" (Cyan) &
          ├── (cd server && npm run dev)   | format_log "[server]" (Green) &
          └── (cd web && npm run dev)      | format_log "[web]" (Magenta) &
                           │
                           ▼
          [6. Wait loop & Monitor]
          └── Chờ tín hiệu kết thúc hoặc service bị crash
```

### 3. Cơ chế Signal Trap & Clean Shutdown

Một lỗi phổ biến khi viết script chạy nền bằng `&` là khi người dùng nhấn `Ctrl + C`, chỉ có script cha bị dừng, còn các tiến trình con (`node`, `python`, `vite`) vẫn sống ngầm và giữ các cổng `8080`, `8787`, `5173`.

**Giải pháp:**
- Script lưu lại PID của 3 tiến trình con: `PID_ML`, `PID_SERVER`, `PID_WEB`.
- Hàm `cleanup()` được đăng ký với `trap cleanup SIGINT SIGTERM EXIT`.
- Trong `cleanup()`, script gửi `kill -TERM` tới từng PID đã lưu. Nếu sau 2 giây tiến trình chưa dừng, thực hiện `kill -9`.
- Đảm bảo terminal được trả về trạng thái bình thường (`stty echo`).

### 4. Định dạng màu sắc Log (Color Prefixing)

Sử dụng hàm bash stream processor hoặc AWK/sed nhẹ để thêm prefix mà không làm mất màu sắc gốc của Vite/Node/Python:
- `[ml]     | <log>` (Cyan)
- `[server] | <log>` (Green)
- `[web]    | <log>` (Magenta)
- `[dev]    | <log>` (Bold White / Yellow cho launcher messages)

---

## Verification Plan

### Thủ công (Manual Verification)
1. **Kiểm tra quyền thực thi**: Chạy `test -x dev.sh` và `./dev.sh --help` hoặc khởi chạy.
2. **Kiểm tra khởi động đồng thời**:
   - Chạy `./dev.sh`.
   - Kiểm tra log hiển thị đồng thời cả 3 tiền tố `[ml]`, `[server]`, `[web]`.
   - Mở trình duyệt truy cập `http://localhost:5173` (Web UI hoạt động).
   - Kiểm tra `curl http://127.0.0.1:8080/infer` trả về HTTP 405 (ML service hoạt động).
   - Kiểm tra `curl http://127.0.0.1:8787/api/status` hoặc health endpoint (Server hoạt động).
3. **Kiểm tra Clean Shutdown (Ctrl + C)**:
   - Nhấn `Ctrl + C` trên terminal `dev.sh`.
   - Kiểm tra xem cả 3 tiến trình có thoát sạch không: `lsof -i :8080`, `lsof -i :8787`, `lsof -i :5173` phải trả về rỗng.
4. **Kiểm tra khả năng chạy từ thư mục `avatar-web/`**:
   - `cd avatar-web && ./dev.sh` hoạt động tương đương.
