# Hướng dẫn Triển khai avatar-web lên Oracle Cloud Always Free (Miễn phí 24/7)

Tài liệu này hướng dẫn chi tiết từng bước cách triển khai ứng dụng `avatar-web` lên máy chủ ảo (VPS) miễn phí trọn đời của **Oracle Cloud Always Free**. Sau khi hoàn tất, hệ thống sẽ chạy **auto-farm 24/7** liên tục trên server độc lập mà không cần treo máy cá nhân.

---

## 🏗 Sơ đồ Kiến trúc Triển khai (Production Architecture)

```text
Trình duyệt (HTTPS / WSS)
       │
       ▼
Nginx (Cổng 80/443 - Reverse Proxy + SSL Let's Encrypt)
       │
       ├── Web Static Files (phục vụ /var/www/avatar-web/web/dist)
       └── Proxy REST API & WS ──► Node.js Server (Port 8787 / 127.0.0.1)
                                        │
                                        ├── SQLite Database (server/data/avatar-web.db)
                                        └── Outbound TCP (27.0.14.120:19129) ──► Game Server Avatar
```

---

## 📌 BƯỚC 1: Đăng ký Tài khoản Oracle Cloud Always Free

1. Truy cập trang đăng ký: [Oracle Cloud Free Tier Registration](https://www.oracle.com/cloud/free/)
2. Nhấn **Start for free**.
3. **Điền thông tin tài khoản**:
   * **Country**: Chọn `Vietnam`.
   * **Home Region**: ⚠️ **Rất quan trọng!** Chọn khu vực gần Việt Nam như **Singapore (`ap-singapore-1`)**, **Tokyo (`ap-tokyo-1`)**, hoặc **Seoul (`ap-seoul-1`)**. *Home Region không thể thay đổi sau khi tạo tài khoản.*
4. **Xác minh số điện thoại & Thẻ Visa/Mastercard**:
   * Cần chuẩn bị thẻ Visa/Mastercard (Debit hoặc Credit) có sẵn khoảng **1 - 2 USD** (~30.000đ - 50.000đ).
   * Oracle sẽ tạo 1 giao dịch tạm giữ tiền để xác minh thẻ thật, sau đó **hoàn lại tiền ngay lập tức**.
5. Kiểm tra email xác nhận tài khoản kích hoạt thành công (từ vài phút đến vài giờ).

---

## 📌 BƯỚC 2: Khởi tạo Máy chủ (Compute Instance)

1. Đăng nhập [Oracle Cloud Console](https://cloud.oracle.com/).
2. Vào menu `Compute` ➔ `Instances` ➔ Nhấn **Create Instance**.
3. **Thiết lập thông số Instance**:
   * **Name**: Đặt tên bất kỳ (ví dụ: `avatar-web-vps`).
   * **Image and shape**:
     * **Image**: Chọn **Canonical Ubuntu 22.04 LTS** hoặc **24.04 LTS**.
     * **Shape**:
       * *Khuyên dùng*: **Ampere (ARM)** ➔ `VM.Standard.A1.Flex` ➔ Cấu hình **1 OCPU / 6 GB RAM** (nền tảng Ampere miễn phí tối đa 4 OCPU / 24GB RAM).
       * *Dự phòng*: **AMD (x86)** ➔ `VM.Standard.E2.1.Micro` (1 OCPU / 1 GB RAM).
   * **Networking**: Giữ mặc định (tự động tạo VCN và Public IP).
   * **Add SSH keys**:
     * Chọn **Generate a key pair for me** ➔ Nhấn **Save private key** để tải file `.key` về máy tính (file này dùng để truy cập SSH vào VPS).
   * **Boot volume**: Giữ mặc định 47GB (Always Free hỗ trợ tối đa 200GB miễn phí).
4. Nhấn **Create** và chờ 1-2 phút cho đến khi trạng thái chuyển sang **Running**.
5. Copy lại địa chỉ **Public IP Address** của Instance.

---

## 📌 BƯỚC 3: Cấu hình Firewall (Ingress Rules) trên Oracle Dashboard

Mặc định Oracle Cloud sẽ khóa toàn bộ các cổng kết nối từ bên ngoài vào ngoại trừ cổng SSH (22). Cần mở cổng HTTP (80) và HTTPS (443):

1. Trong trang thông tin chi tiết Instance ➔ Tìm mục **Primary VNIC** ➔ Nhấn vào **Subnet**.
2. Click chọn **Default Security List for...**
3. Tại phần **Ingress Rules**, nhấn **Add Ingress Rules**:
   * **Source CIDR**: `0.0.0.0/0`
   * **IP Protocol**: `TCP`
   * **Destination Port Range**: `80,443`
   * **Description**: `Allow HTTP HTTPS`
4. Nhấn **Add Ingress Rules**.

---

## 📌 BƯỚC 4: Kết nối SSH & Cấu hình Firewall trên VPS

### 1. Kết nối SSH vào VPS

* **Linux / MacOS Terminal**:
  ```bash
  chmod 400 /path/to/your-private-key.key
  ssh -i /path/to/your-private-key.key ubuntu@<PUBLIC_IP_VPS>
  ```
* **Windows**: Dùng ứng dụng **PuTTY** hoặc **MobaXterm** (chọn Auth bằng file `.key` / `.ppk` với user `ubuntu`).

### 2. Mở cổng trên `iptables` của Ubuntu Oracle

Ubuntu trên Oracle Cloud có bộ quy tắc firewall `iptables` riêng chặn các truy cập cổng vào ngoại trừ port 22. Chạy các lệnh sau để mở:

```bash
# Mở port 80 & 443 trên iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# Cài đặt iptables-persistent để lưu quy tắc sau khi reboot VPS
sudo apt update
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## 📌 BƯỚC 5: Cài đặt Môi trường hệ thống

Chạy chuỗi lệnh sau trên SSH terminal để cài đặt Node.js 20 LTS, các thư cụ biên dịch C++ (dành cho `better-sqlite3`, `argon2`), PM2 và Nginx:

```bash
# Cập nhật hệ thống & cài đặt công cụ biên dịch
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3 nginx certbot python3-certbot-nginx

# Cài đặt Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản Node
node -v   # Yêu cầu >= v20.x
npm -v

# Cài đặt PM2 toàn cục
sudo npm install -g pm2
```

---

## 📌 BƯỚC 6: Clone Code & Triển khai ứng dụng

```bash
# 1. Clone nguồn mã về /var/www/
cd /var/www
sudo git clone <URL_REPO_GITHUB_CUA_BAN> avatar-web
sudo chown -R ubuntu:ubuntu /var/www/avatar-web
cd avatar-web

# 2. Build Backend Server
cd server
npm install
npm run build     # Biên dịch TypeScript ra dist/

# 3. Build Frontend Web UI
cd ../web
npm install
npm run build     # Tạo các tệp tĩnh trong web/dist/
```

### Thiết lập File Cấu hình Môi trường (`.env`)

Tại thư mục `/var/www/avatar-web/server`:

1. **Khởi tạo `MASTER_KEY`**:
   ```bash
   cd /var/www/avatar-web/server
   npm run gen-key
   ```
   *Màn hình sẽ hiển thị 1 chuỗi Base64 32 bytes (Ví dụ: `aBCdEF...=`). Hãy sao chép chuỗi này.*

2. **Tạo file `.env`**:
   ```bash
   nano .env
   ```
   **Dán nội dung sau vào file (thay chuỗi key và mã mời đăng ký của bạn):**
   ```env
   NODE_ENV=production
   PORT=8787
   MASTER_KEY=DÁN_CHUỖI_BASE64_VỪA_GEN_VÀO_ĐÂY
   INVITE_CODE=MaMoiDangKyCuaBan123
   MAX_SESSIONS=20
   DB_PATH=/var/www/avatar-web/server/data/avatar-web.db
   ```
   *(Nhấn `Ctrl + O` ➔ `Enter` để lưu, `Ctrl + X` để thoát)*.

   > ⚠️ **LƯU Ý QUAN TRỌNG**: Bạn **BẮT BUỘC SAO LƯU** `MASTER_KEY` cất vào nơi an toàn. Nếu mất khoá này, toàn bộ mật khẩu tài khoản game lưu trong Database SQLite sẽ **không thể giải mã lại được**!

3. **Khởi chạy Service Backend bằng PM2**:
   ```bash
   cd /var/www/avatar-web/server
   pm2 start dist/index.js --name "avatar-web"
   
   # Cấu hình tự khởi động ứng dụng cùng hệ thống khi VPS restart
   pm2 startup
   # (Sao chép & thực thi lệnh được PM2 gợi ý trên màn hình nếu có)
   pm2 save
   ```

---

## 📌 BƯỚC 7: Cấu hình Tên miền (Domain) & Reverse Proxy Nginx + SSL

### 1. Trỏ Tên miền về IP VPS Oracle
* Truy cập trang quản lý DNS của Tên miền (Cloudflare, Namecheap, TENTEN,...).
* Tạo bản ghi **A Record**:
  * **Host / Name**: `avatar` (hoặc `@` nếu dùng domain chính).
  * **IPv4 Address**: Nhập địa chỉ **Public IP của VPS Oracle**.

### 2. Cấu hình Nginx làm Reverse Proxy

Tạo tệp cấu hình mới:
```bash
sudo nano /etc/nginx/sites-available/avatar-web
```

Dán đoạn cấu hình Nginx bên dưới (thay `avatar.domaincuaban.com` thành tên miền thật của bạn):

```nginx
server {
    listen 80;
    server_name avatar.domaincuaban.com;

    # 1. Phục vụ Web UI Static Files
    root /var/www/avatar-web/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Reverse Proxy REST API
    location /api/ {
        proxy_pass http://127.0.0.1:8787/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Reverse Proxy WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:8787/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Đảm bảo kết nối WebSocket không bị ngắt timeout
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Kích hoạt site và nạp lại cấu hình Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/avatar-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Cấp chứng chỉ HTTPS (SSL Let's Encrypt) bằng Certbot

```bash
sudo certbot --nginx -d avatar.domaincuaban.com
```
* Nhập Email của bạn ➔ Gõ `Y` đồng ý điều khoản.
* Certbot sẽ tự động cài chứng chỉ SSL và thiết lập chuyển hướng toàn bộ từ HTTP sang HTTPS.

---

## 📌 BƯỚC 8: Thiết lập CI/CD Tự động Triển khai (GitHub Actions)

Dự án đã được tích hợp sẵn file cấu hình GitHub Actions tại `.github/workflows/deploy.yml`. Mỗi khi bạn **push hoặc merge code vào nhánh `main`**, hệ thống sẽ tự động SSH vào VPS, pull code mới, build cả Server + Web và reload lại ứng dụng.

### 1. Thêm Secrets trên GitHub Repository

1. Mở trang repository của bạn trên GitHub.
2. Vào **Settings** ➔ **Secrets and variables** ➔ **Actions**.
3. Nhấn **New repository secret** và thêm lần lượt các Secret sau:

| Tên Secret | Bắt buộc | Mô tả | Giá trị ví dụ |
|---|---|---|---|
| `SERVER_HOST` | **Bắt buộc** | Địa chỉ Public IP hoặc Domain của VPS Oracle | `123.45.67.89` hoặc `avatar.domaincuaban.com` |
| `SERVER_USER` | **Bắt buộc** | Tên user đăng nhập SSH trên VPS | `ubuntu` |
| `SERVER_SSH_KEY` | **Bắt buộc** | Toàn bộ nội dung file Private Key SSH (`.key` / `.pem` / `id_rsa`) | Copy toàn bộ từ `-----BEGIN ...` đến `-----END ...` |
| `SERVER_PORT` | Không | Cổng SSH | `22` (mặc định) |
| `DEPLOY_PATH` | Không | Đường dẫn thư mục cài đặt trên VPS | `/var/www/avatar-web` (mặc định) |

> 💡 **Mẹo lấy nội dung SSH Key trên máy cá nhân**:
> - Nếu bạn dùng file key tải từ Oracle Cloud: Mở file `.key` bằng TextEdit / Notepad rồi copy toàn bộ nội dung dán vào secret `SERVER_SSH_KEY`.
> - Hoặc chạy lệnh: `cat /duong/dan/toi/oracle-key.key`

### 2. Kích hoạt và Kiểm tra Deploy

* **Tự động**: Mỗi khi có commit mới merge vào nhánh `main`, GitHub Actions sẽ tự chạy.
* **Thủ công**: Vào tab **Actions** trên GitHub ➔ Chọn workflow **Deploy to Production VPS** ➔ Nhấn **Run workflow** ➔ Chọn nhánh `main` ➔ Nhấn **Run workflow**.
* Xem trực tiếp log deploy trên giao diện GitHub Actions để xác nhận server và web đã được cập nhật thành công.

---

## 🛠 Lệnh Bảo trì & Cập nhật thường dùng

* **Xem trạng thái ứng dụng Node.js**:
  ```bash
  pm2 status
  ```
* **Xem log ứng dụng theo thời gian thực**:
  ```bash
  pm2 logs avatar-web
  ```
* **Khởi động lại ứng dụng**:
  ```bash
  pm2 restart avatar-web
  ```
* **Cập nhật thủ công (khi không dùng CI/CD)**:
  ```bash
  cd /var/www/avatar-web
  git pull
  cd server && npm install && npm run build
  cd ../web && npm install && npm run build
  pm2 restart avatar-web
  ```
* **Sao lưu dữ liệu quan trọng**:
  * File SQLite Database: `/var/www/avatar-web/server/data/avatar-web.db`
  * File cấu hình môi trường: `/var/www/avatar-web/server/.env`
