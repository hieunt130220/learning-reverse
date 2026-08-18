# Thiết kế: Triển khai CI/CD Tự động Deploy Server và Web khi Merge Main

- **Ngày tạo**: 2026-08-18
- **Trạng thái**: Chờ duyệt (Pending Review)
- **Phạm vi tác động**:
  - Tạo mới: `.github/workflows/deploy.yml`
  - Cập nhật: `avatar-web/DEPLOY.md`
  - Cập nhật: `avatar-web/DEPLOY_GCP.md`

---

## 1. Mục tiêu & Bối cảnh

### Bối cảnh
Dự án `learning-reverse` bao gồm cả backend Node.js (`avatar-web/server`) và frontend React/Vite (`avatar-web/web`). Hiện tại, việc triển khai lên máy chủ VPS (như Oracle Cloud Always Free hoặc Google Cloud Platform e2-micro) đang được thực hiện thủ công bằng cách SSH vào VPS, pull code, chạy build server và web, sau đó restart tiến trình PM2.

Quá trình thủ công này tốn thời gian, dễ quên các bước cài đặt hoặc build lại web khi có thay đổi code, và không tận dụng được cơ chế tự động hoá khi hoàn thành merge mã nguồn vào nhánh chính (`main`).

### Mục tiêu
- Tự động hóa 100% quá trình deploy lên máy chủ VPS mỗi khi có commit mới được push hoặc pull request được merge vào nhánh `main`.
- Hỗ trợ kích hoạt deploy thủ công (Manual Trigger via `workflow_dispatch`) trực tiếp từ giao diện GitHub Actions để chủ động deploy lại khi cần mà không phải tạo commit giả.
- Đảm bảo an toàn cho dữ liệu ứng dụng: Giữ nguyên file database SQLite (`avatar-web.db`), cấu hình bí mật `.env`, và không làm gián đoạn phiên hoạt động ngoài thời gian ngắn reload server.
- Cung cấp tài liệu hướng dẫn rõ ràng trong `DEPLOY.md` và `DEPLOY_GCP.md` giúp người dùng dễ dàng cấu hình SSH Key và GitHub Secrets.

---

## 2. Phạm vi thay đổi (Scope)

### Trong phạm vi (In-scope)
1. **GitHub Actions Workflow (`.github/workflows/deploy.yml`)**:
   - Thiết lập trigger khi có `push` vào nhánh `main` và `workflow_dispatch`.
   - Cấu hình concurrency để ngăn chặn xung đột nếu có nhiều commit được push liên tiếp (`concurrency: production`).
   - Sử dụng action `appleboy/ssh-action@v1.2.0` để kết nối SSH an toàn tới máy chủ VPS đích.
   - Viết kịch bản deploy thông minh:
     - Tự động nhận diện cấu trúc thư mục repo trên VPS (`avatar-web/server` hoặc `server`).
     - Kéo mã nguồn mới nhất (`git fetch origin main && git reset --hard origin/main`).
     - Cài đặt dependency & build Server TypeScript (`npm install && npm run build`).
     - Reload/Restart tiến trình PM2 (`avatar-web`) với biến môi trường mới nhất.
     - Cài đặt dependency & build Frontend Web UI (`npm install && npm run build`), đưa tệp tĩnh vào thư mục `dist/` để Nginx tự động phục vụ.
2. **Cập nhật Tài liệu Triển khai (`DEPLOY.md` & `DEPLOY_GCP.md`)**:
   - Thêm phần hướng dẫn cấu hình CI/CD tự động bằng GitHub Actions.
   - Hướng dẫn lấy/tạo cặp SSH Key, phân quyền trên VPS và cấu hình các Secrets trên GitHub Repo:
     - `SERVER_HOST`: Địa chỉ IP Public hoặc Domain VPS.
     - `SERVER_USER`: Tên người dùng SSH (ví dụ: `ubuntu`).
     - `SERVER_SSH_KEY`: Private SSH Key (nội dung file `.key` / `id_rsa`).
     - `SERVER_PORT`: Port SSH (tuỳ chọn, mặc định `22`).
     - `DEPLOY_PATH`: Đường dẫn thư mục cài đặt trên VPS (tuỳ chọn, mặc định `/var/www/avatar-web`).

### Ngoài phạm vi (Out-of-scope)
- Không thay đổi mã nguồn logic trong `server/src` hoặc `web/src`.
- Không thay đổi cấu trúc database SQLite hiện tại.
- Không cấu hình Docker / Kubernetes (giữ nguyên mô hình PM2 + Nginx hiện hữu).

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật chi tiết

### 3.1. Sơ đồ Luồng Hoạt động CI/CD

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant GH as GitHub Repo (main branch)
    participant GHA as GitHub Actions Runner
    participant VPS as Target VPS (PM2 + Nginx)

    Dev->>GH: Push / Merge code vào branch main
    GH->>GHA: Trigger Deploy Workflow (.github/workflows/deploy.yml)
    GHA->>VPS: SSH connection (appleboy/ssh-action)
    activate VPS
    VPS->>VPS: cd $DEPLOY_PATH (/var/www/avatar-web)
    VPS->>VPS: git fetch origin main && git reset --hard origin/main
    VPS->>VPS: Build Server: cd server && npm i && npm run build
    VPS->>VPS: Reload PM2: pm2 reload avatar-web --update-env
    VPS->>VPS: Build Web UI: cd web && npm i && npm run build
    VPS-->>GHA: Deploy script hoàn tất thành công (Exit 0)
    deactivate VPS
    GHA-->>GH: Báo trạng thái Workflow Success ✅
```

### 3.2. Cấu hình Chi tiết File `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production VPS

on:
  push:
    branches:
      - main
  workflow_dispatch:

# Giữ duy nhất 1 job deploy chạy tại một thời điểm, tránh race condition
concurrency:
  group: production_deployment
  cancel-in-progress: false

jobs:
  deploy:
    name: SSH Deploy to VPS
    runs-on: ubuntu-latest
    steps:
      - name: Executing remote SSH commands for deployment
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: ${{ secrets.SERVER_PORT || 22 }}
          script_stop: true
          envs: DEPLOY_PATH
          env:
            DEPLOY_PATH: ${{ secrets.DEPLOY_PATH || '/var/www/avatar-web' }}
          script: |
            set -e

            echo "========================================="
            echo "🚀 Bắt đầu quá trình tự động Deploy..."
            echo "========================================="

            # 1. Điều hướng tới thư mục chứa dự án
            TARGET_DIR="${DEPLOY_PATH:-/var/www/avatar-web}"
            if [ ! -d "$TARGET_DIR" ]; then
              echo "❌ Thư mục $TARGET_DIR không tồn tại trên máy chủ!"
              exit 1
            fi
            cd "$TARGET_DIR"

            # 2. Cập nhật mã nguồn mới nhất từ branch main
            echo "📥 Đang đồng bộ mã nguồn mới nhất từ origin/main..."
            git fetch origin main
            git reset --hard origin/main

            # Tự động phát hiện cấu trúc thư mục (monorepo root vs subpath)
            if [ -d "avatar-web/server" ]; then
              BASE_PATH="avatar-web"
            else
              BASE_PATH="."
            fi

            # 3. Triển khai Backend Server
            echo "📦 [1/2] Đang cập nhật Backend Server..."
            cd "$TARGET_DIR/$BASE_PATH/server"
            npm install
            npm run build

            # Reload lại tiến trình PM2 (hoặc start mới nếu chưa tồn tại)
            if pm2 list | grep -q "avatar-web"; then
              echo "🔄 Đang reload PM2 service avatar-web..."
              pm2 reload avatar-web --update-env
            else
              echo "▶️ Đang khởi động PM2 service avatar-web lần đầu..."
              pm2 start dist/index.js --name "avatar-web"
            fi
            pm2 save

            # 4. Triển khai Frontend Web UI
            echo "🎨 [2/2] Đang cập nhật Frontend Web UI..."
            cd "$TARGET_DIR/$BASE_PATH/web"
            npm install
            npm run build

            echo "========================================="
            echo "✅ Deploy hoàn tất thành công!"
            echo "========================================="
```

### 3.3. Bảo mật & Biến Môi trường (GitHub Secrets)

Để pipeline hoạt động, người dùng cần khai báo các GitHub Secrets tại **Settings ➔ Secrets and variables ➔ Actions**:

| Tên Secret | Bắt buộc | Mô tả | Ví dụ |
|---|---|---|---|
| `SERVER_HOST` | **Có** | IP Public hoặc Domain trỏ tới VPS | `123.45.67.89` hoặc `avatar.example.com` |
| `SERVER_USER` | **Có** | Tên user có quyền đăng nhập SSH | `ubuntu` |
| `SERVER_SSH_KEY` | **Có** | Nội dung file Private Key OpenSSH (bao gồm cả `-----BEGIN ...` và `-----END ...`) | `-----BEGIN RSA PRIVATE KEY-----...` |
| `SERVER_PORT` | Không | Cổng kết nối SSH (mặc định là 22 nếu không điền) | `22` |
| `DEPLOY_PATH` | Không | Đường dẫn thư mục repo trên máy chủ (mặc định `/var/www/avatar-web`) | `/var/www/avatar-web` |

### 3.4. Điểm mạnh về độ ổn định & xử lý lỗi (Resilience)

1. **`script_stop: true`**: Nếu bất kỳ bước nào trong script thất bại (ví dụ: `npm run build` bị lỗi do cú pháp TypeScript), script sẽ dừng ngay lập tức và đánh dấu GitHub Action FAILED, thông báo rõ cho người quản trị.
2. **`git reset --hard origin/main`**: Đảm bảo repository trên server luôn đồng bộ chính xác với `main`, không bị conflict bởi file sinh ra tạm thời trong quá trình chạy.
3. **An toàn dữ liệu**: Database `avatar-web.db` nằm trong `server/data/` và file `.env` nằm trong `server/.env` (đều thuộc `.gitignore`), nên `git reset --hard` không bao giờ làm mất database hay thông tin bảo mật.
4. **Zero-down PM2 reload**: Dùng `pm2 reload` thay vì `pm2 restart` giúp server reload nhanh và mượt mà.

---

## 4. Kế hoạch xác minh (Verification Plan)

### Kiểm tra tự động & Cú pháp
- Xác thực định dạng cú pháp YAML của file `.github/workflows/deploy.yml`.
- Xác nhận các script build (`npm run build`) của cả `server` và `web` chạy thành công ở local.

### Hướng dẫn kiểm tra thực tế sau khi cấu hình
1. Thêm các Secrets vào GitHub Repository Settings.
2. Vào tab **Actions** trên GitHub ➔ Chọn workflow **Deploy to Production VPS** ➔ Nhấn **Run workflow** (kiểm tra chạy thủ công).
3. Push một commit test lên `main` và kiểm tra pipeline tự động kích hoạt và kết thúc với trạng thái xanh (Success).
4. Kiểm tra trên website để xác nhận các tính năng mới đã được cập nhật.
