#!/usr/bin/env bash
# ==============================================================================
# Unified Dev Launcher for avatar-web
# Khởi chạy đồng thời:
#   1. AI Fishing ML Service (Python port 8080)
#   2. Backend Server (Node.js port 8787)
#   3. Web UI (Vite port 5173)
# ==============================================================================

set -uo pipefail

# Định vị thư mục gốc của repository (tuân theo và resolve symlink nếu chạy từ avatar-web/dev.sh)
TARGET="${BASH_SOURCE[0]}"
while [[ -L "$TARGET" ]]; do
  DIR="$(cd -P "$(dirname "$TARGET")" && pwd)"
  TARGET="$(readlink "$TARGET")"
  [[ $TARGET != /* ]] && TARGET="$DIR/$TARGET"
done
ROOT_DIR="$(cd -P "$(dirname "$TARGET")" && pwd)"

# Bảng màu ANSI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log_dev()     { printf "%b%s%b %s\n" "${BOLD}${YELLOW}" "[launcher]" "${RESET}" "$1"; }
log_success() { printf "%b%s%b %s\n" "${BOLD}${GREEN}"  "[launcher]" "${RESET}" "$1"; }
log_error()   { printf "%b%s%b %s\n" "${BOLD}${RED}"    "[launcher ERROR]" "${RESET}" "$1" >&2; }

format_stream() {
  local prefix="$1"
  local color="$2"
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf "%b%s%b %s\n" "${color}" "${prefix}" "${RESET}" "${line}"
  done
}

# ------------------------------------------------------------------------------
# 1. Pre-flight Checks
# ------------------------------------------------------------------------------
log_dev "Đang kiểm tra môi trường..."

# Node.js & npm
if ! command -v node >/dev/null 2>&1; then
  log_error "Node.js chưa được cài đặt. Vui lòng cài đặt Node.js (>= 18)."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  log_error "npm chưa được cài đặt."
  exit 1
fi

# Python venv cho fishing-ml
PYTHON_BIN="$ROOT_DIR/avatar-web/fishing-ml/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  log_error "Không tìm thấy Python virtualenv tại: avatar-web/fishing-ml/.venv"
  log_dev "Vui lòng khởi tạo bằng lệnh:"
  echo "  cd avatar-web/fishing-ml"
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install torch --index-url https://download.pytorch.org/whl/cpu"
  echo "  pip install -e ."
  exit 1
fi

# Model frozen directory
FROZEN_DIR="$ROOT_DIR/avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen"
if [[ ! -d "$FROZEN_DIR" ]]; then
  log_error "Không tìm thấy thư mục model frozen tại: $FROZEN_DIR"
  exit 1
fi

# Backend .env
if [[ ! -f "$ROOT_DIR/avatar-web/server/.env" ]]; then
  log_error "Không tìm thấy file avatar-web/server/.env"
  log_dev "Vui lòng tạo file avatar-web/server/.env (tham khảo DEPLOY.md hoặc chạy npm run gen-key)."
  exit 1
fi

# Node modules
if [[ ! -d "$ROOT_DIR/avatar-web/server/node_modules" ]]; then
  log_dev "Đang cài đặt dependencies cho avatar-web/server..."
  (cd "$ROOT_DIR/avatar-web/server" && npm install)
fi

if [[ ! -d "$ROOT_DIR/avatar-web/web/node_modules" ]]; then
  log_dev "Đang cài đặt dependencies cho avatar-web/web..."
  (cd "$ROOT_DIR/avatar-web/web" && npm install)
fi

# ------------------------------------------------------------------------------
# 2. Dọn dẹp các cổng bị chiếm dụng trước khi chạy (8080, 8787, 5173)
# Chỉ tìm các tiến trình đang MỞ CỔNG LẮNG NGHE (LISTEN), tránh nhầm outbound client
# ------------------------------------------------------------------------------
PORTS=(8080 8787 5173)
for port in "${PORTS[@]}"; do
  existing_pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$existing_pids" ]]; then
    log_dev "Cổng $port đang được lắng nghe bởi PID: $existing_pids. Đang giải phóng..."
    # Thử dừng qua pm2 nếu có tiến trình pm2 fishing-ml
    if command -v npx >/dev/null 2>&1; then
      npx pm2 stop fishing-ml >/dev/null 2>&1 || true
    fi
    for pid in $existing_pids; do
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 0.5
    remaining=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "$remaining" ]]; then
      for pid in $remaining; do
        kill -9 "$pid" 2>/dev/null || true
      done
    fi
  fi
done

# ------------------------------------------------------------------------------
# 3. Quản lý vòng đời tiến trình con & Clean Shutdown Trap
# ------------------------------------------------------------------------------
CHILD_PIDS=()

cleanup() {
  # Ngắt trap ngay để tránh loop
  trap - INT TERM EXIT
  echo ""
  log_dev "Đang nhận tín hiệu dừng — giải phóng toàn bộ tiến trình con..."

  # 1. Dọn dẹp trực tiếp các tiến trình đang mở cổng (LISTEN)
  for port in "${PORTS[@]}"; do
    local pids
    pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      for p in $pids; do
        kill -TERM "$p" 2>/dev/null || true
      done
    fi
  done

  # 2. Dừng các pipes nền
  for pid in "${CHILD_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  sleep 0.5

  # 3. Force kill nếu còn sót
  for port in "${PORTS[@]}"; do
    local rem
    rem=$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
    if [[ -n "$rem" ]]; then
      for p in $rem; do
        kill -9 "$p" 2>/dev/null || true
      done
    fi
  done

  for pid in "${CHILD_PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null || true
  done

  log_success "Đã dừng hoàn toàn tất cả các dịch vụ. Cổng mạng đã được giải phóng."
  exit 0
}

trap cleanup INT TERM EXIT

# ------------------------------------------------------------------------------
# 4. Khởi chạy đồng thời 3 dịch vụ
# ------------------------------------------------------------------------------
echo "======================================================================"
printf "%b%s%b\n" "${BOLD}${GREEN}" "  AVATAR-WEB UNIFIED DEV ENVIRONMENT" "${RESET}"
echo "======================================================================"

# 1. AI Fishing ML Service (Port 8080)
log_dev "1/3 Khởi động AI Fishing ML Service trên cổng 8080..."
(
  cd "$ROOT_DIR/avatar-web/fishing-ml" || exit 1
  exec env PYTHONUNBUFFERED=1 "$PYTHON_BIN" -m fishing_ml.inference_service \
    --host 127.0.0.1 --port 8080 \
    --frozen-dir "$FROZEN_DIR"
) 2>&1 | format_stream "[ml]    |" "${CYAN}" &
CHILD_PIDS+=($!)

# 2. Backend Server (Port 8787)
log_dev "2/3 Khởi động Backend Server trên cổng 8787..."
(
  cd "$ROOT_DIR/avatar-web/server" || exit 1
  exec npm run dev
) 2>&1 | format_stream "[server]|" "${GREEN}" &
CHILD_PIDS+=($!)

# 3. Web UI (Port 5173)
log_dev "3/3 Khởi động Web UI trên cổng 5173..."
(
  cd "$ROOT_DIR/avatar-web/web" || exit 1
  exec npm run dev
) 2>&1 | format_stream "[web]   |" "${MAGENTA}" &
CHILD_PIDS+=($!)

# Đợi ngắn và thông báo trạng thái
sleep 2
log_success "Tất cả 3 dịch vụ đã được khởi chạy thành công!"
echo ""
printf "  %b%-14s%b %s\n" "${BOLD}${MAGENTA}" "Web UI:"       "${RESET}" "http://localhost:5173"
printf "  %b%-14s%b %s\n" "${BOLD}${GREEN}"   "Backend API:"   "${RESET}" "http://localhost:8787"
printf "  %b%-14s%b %s\n" "${BOLD}${CYAN}"    "AI Inference:"  "${RESET}" "http://127.0.0.1:8080"
echo ""
log_dev "Nhấn [Ctrl + C] bất kỳ lúc nào để dừng đồng thời tất cả dịch vụ."
echo "----------------------------------------------------------------------"

# Vòng lặp chờ tín hiệu tức thì (responsive to INT/TERM)
while true; do
  sleep 1 &
  wait $! 2>/dev/null || true
done
