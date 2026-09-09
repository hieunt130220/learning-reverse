# Unified Dev Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cung cấp script thực thi `dev.sh` để khởi chạy đồng thời cả 3 dịch vụ (`fishing-ml`, `server`, `web`) trên máy local với log màu phân biệt và cơ chế dọn dẹp tiến trình an toàn khi tắt (Ctrl+C).

**Architecture:** Tạo script bash/zsh POSIX-compliant tại thư mục gốc repository kết hợp kiểm tra pre-flight môi trường (Python venv, model artifact, node_modules, cổng mạng). Script chạy song song 3 tiến trình nền trong subshell, gắn nhãn màu cho stdout/stderr của từng service, và đăng ký signal trap (SIGINT/SIGTERM/EXIT) để tiêu diệt sạch các tiến trình con bằng process group kill nhằm giải phóng cổng mạng triệt để.

**Tech Stack:** Bash/Zsh, POSIX utilities (lsof, kill, trap), Python 3.12 venv, Node.js, Vite.

**Spec:** `docs/superpowers/specs/2026-09-09-unified-dev-launcher-design.md`

## Global Constraints
- Không viết test files trừ khi user yêu cầu rõ ràng (tuân thủ nguyên tắc KHÔNG TDD trong CLAUDE.md).
- Script phải tương thích cả macOS (Darwin) và Linux (Ubuntu/Debian).
- Tuyệt đối không để sót tiến trình con giữ cổng 8080, 8787, 5173 khi người dùng bấm Ctrl + C.
- Không chỉnh sửa hay phá vỡ code nghiệp vụ hiện tại của server, web, hay fishing-ml.

---

### Task 1: Tạo script khởi chạy chính `dev.sh` tại thư mục gốc

**Files:**
- Create: `/Users/devios/learning-reverse/dev.sh`

**Interfaces:**
- Consumes:
  - `avatar-web/fishing-ml/.venv/bin/python`
  - `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen`
  - `avatar-web/server/package.json` (`npm run dev`)
  - `avatar-web/web/package.json` (`npm run dev`)
- Produces:
  - Script thực thi `./dev.sh` khởi động đồng thời 3 service kèm tiền tố màu và signal handler.

- [x] **Step 1: Tạo nội dung script `dev.sh`**
- [x] **Step 2: Cấp quyền thực thi cho `dev.sh`**
Run: `chmod +x /Users/devios/learning-reverse/dev.sh`
Expected: Script có cờ thực thi `+x`.

---

### Task 2: Tạo liên kết tượng trưng (Symlink) tại `avatar-web/dev.sh`

**Files:**
- Create: `/Users/devios/learning-reverse/avatar-web/dev.sh` (symlink hoặc wrapper)

**Interfaces:**
- Consumes:
  - `/Users/devios/learning-reverse/dev.sh`
- Produces:
  - Cho phép người dùng chạy `./dev.sh` từ thư mục `avatar-web/`.

- [x] **Step 1: Tạo symlink tương đối**
Run: `ln -sf ../dev.sh /Users/devios/learning-reverse/avatar-web/dev.sh`
Expected: Symlink `avatar-web/dev.sh -> ../dev.sh` được tạo thành công.

- [x] **Step 2: Xác nhận symlink trỏ đúng**
Run: `ls -la /Users/devios/learning-reverse/avatar-web/dev.sh`
Expected: Hiển thị liên kết trỏ về `../dev.sh`.

---

### Task 3: Xác minh hoạt động toàn diện của launcher

**Files:**
- Test: Chạy thử trực tiếp `./dev.sh`

**Interfaces:**
- Consumes:
  - `./dev.sh`
- Produces:
  - Báo cáo kết quả khởi chạy, bắt request và clean shutdown.

- [x] **Step 1: Kiểm tra pre-flight check khi cổng bị chiếm (hoặc chạy PM2)**
Kiểm tra xem script có phát hiện các tiến trình đang chạy trên cổng 8080/8787/5173 không.

- [x] **Step 2: Tắt các tiến trình đơn lẻ cũ (PM2 fishing-ml, background tsx/vite cũ nếu có)**
Dừng các tiến trình cũ để chuẩn bị môi trường sạch cho launcher.
Run:
```bash
npx pm2 stop fishing-ml 2>/dev/null || true
```

- [x] **Step 3: Chạy thử nghiệm ngắn `./dev.sh` trong background và kiểm tra các endpoint**
Khởi động `./dev.sh` trong vài giây, kiểm tra:
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/infer` (Mong đợi: 405 Method Not Allowed)
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/status` (Mong đợi: 200 hoặc JSON phản hồi)
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173` (Mong đợi: 200)

- [x] **Step 4: Kiểm tra Clean Shutdown**
Gửi `kill -INT` tới tiến trình `./dev.sh`.
Kiểm tra lại `lsof -i :8080`, `lsof -i :8787`, `lsof -i :5173`.
Expected: Tất cả 3 cổng đều được giải phóng hoàn toàn, không còn tiến trình nào tồn tại.
