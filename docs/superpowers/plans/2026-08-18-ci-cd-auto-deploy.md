# CI/CD Tự động Deploy Server và Web khi Merge Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập pipeline CI/CD GitHub Actions tự động kết nối SSH và deploy ứng dụng Server + Web lên VPS khi merge/push vào branch `main`, cùng với tài liệu hướng dẫn cấu hình Secrets chi tiết.

**Architecture:** Sử dụng GitHub Actions workflow với `appleboy/ssh-action@v1.2.0` để SSH vào máy chủ VPS đích, đồng bộ code mới nhất từ nhánh `main`, thực thi cài đặt và build cho cả Server (Node.js/TypeScript) và Web (Vite/React), tự động reload service PM2 và đưa bản build web mới nhất vào thư mục phục vụ của Nginx.

**Tech Stack:** GitHub Actions, YAML, Bash, SSH, PM2, Node.js, Nginx

**Spec:** `docs/superpowers/specs/2026-08-18-ci-cd-auto-deploy-design.md`

## Global Constraints
- Tuân thủ nghiêm ngặt quy tắc Không TDD (không tạo test files mới trừ khi được yêu cầu; không vi phạm test hiện hữu).
- Giữ nguyên cấu trúc dữ liệu SQLite và file `.env` trên máy chủ (được bảo vệ qua `.gitignore`).
- Hỗ trợ cả trigger tự động khi push/merge vào `main` lẫn trigger thủ công `workflow_dispatch`.
- Tự động nhận diện cấu trúc thư mục repo trên máy chủ (`avatar-web/server` hoặc `server`).

---

### Task 1: Tạo GitHub Actions Workflow `deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: GitHub Secrets (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PORT`, `DEPLOY_PATH`)
- Produces: GitHub Actions deployment pipeline trên nhánh `main`.

- [ ] **Step 1: Tạo file `.github/workflows/deploy.yml`**
Tạo file cấu hình workflow với nội dung chi tiết:
```yaml
name: Deploy to Production VPS

on:
  push:
    branches:
      - main
  workflow_dispatch:

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

            # Tự động phát hiện cấu trúc thư mục
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

- [ ] **Step 2: Xác thực cú pháp YAML**
Kiểm tra tính hợp lệ của file `.github/workflows/deploy.yml`.

- [ ] **Step 3: Commit**
```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): add GitHub Actions SSH auto-deployment workflow"
```

---

### Task 2: Cập nhật Tài liệu Triển khai (`DEPLOY.md` & `DEPLOY_GCP.md`)

**Files:**
- Modify: `avatar-web/DEPLOY.md`
- Modify: `avatar-web/DEPLOY_GCP.md`

**Interfaces:**
- Produces: Hướng dẫn cấu hình GitHub Secrets và vận hành CI/CD trong tài liệu.

- [ ] **Step 1: Cập nhật `avatar-web/DEPLOY.md`**
Bổ sung mục `BƯỚC 8: Thiết lập CI/CD Tự động Deploy (GitHub Actions)` với:
- Giới thiệu cơ chế tự động deploy khi merge/push vào branch `main`.
- Bảng danh sách Secrets cần thêm vào GitHub Repository (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PORT`, `DEPLOY_PATH`).
- Hướng dẫn từng bước copy Private SSH Key và thêm vào **Settings ➔ Secrets and variables ➔ Actions**.
- Hướng dẫn kích hoạt chạy thử nghiệm từ tab **Actions** trên GitHub.

- [ ] **Step 2: Cập nhật `avatar-web/DEPLOY_GCP.md`**
Bổ sung mục `BƯỚC 8: Thiết lập CI/CD Tự động Deploy (GitHub Actions)` tương tự, lưu ý thêm về Swap RAM trên máy ảo `e2-micro` khi build qua SSH.

- [ ] **Step 3: Commit**
```bash
git add avatar-web/DEPLOY.md avatar-web/DEPLOY_GCP.md
git commit -m "docs: add GitHub Actions CI/CD setup guide to DEPLOY and DEPLOY_GCP docs"
```

---

### Task 3: Xác thực Build & Kiểm tra Toàn diện

**Files:**
- Modify: Không có

- [ ] **Step 1: Kiểm tra build local của Server**
Run: `npm run build` trong `avatar-web/server`
Expected: Biên dịch TypeScript thành công, copy schema.sql vào dist/.

- [ ] **Step 2: Kiểm tra build local của Web**
Run: `npm run build` trong `avatar-web/web`
Expected: Vite build thành công, tạo thư mục `web/dist/`.

- [ ] **Step 3: Tổng kết & Kiểm tra Git Status**
Xác nhận toàn bộ các thay đổi sạch sẽ, đúng chuẩn.
