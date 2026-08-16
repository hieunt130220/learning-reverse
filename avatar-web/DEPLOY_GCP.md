# Hướng dẫn Triển khai avatar-web lên Google Cloud Platform (GCP) Always Free (Miễn phí 24/7)

Tài liệu này hướng dẫn chi tiết từng bước cách triển khai ứng dụng `avatar-web` lên máy chủ ảo (VPS) **Google Cloud Platform (GCP)** sử dụng cấu hình **`e2-micro` Always Free (Miễn phí trọn đời)**. Sau khi hoàn tất, hệ thống sẽ chạy **auto-farm 24/7** liên tục trên server độc lập.

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

## ⚠️ ĐIỀU KIỆN QUAN TRỌNG ĐỂ ĐƯỢC MIỄN PHÍ TRỌN ĐỜI (ALWAYS FREE) TRÊN GCP

Để không bị tính phí sau khi hết thời hạn $300 credit dùng thử, bạn **BẮT BUỘC** phải tuân thủ đúng các thông số sau khi tạo máy ảo:

1. **Machine Type**: Chọn **`e2-micro`** (2 vCPU, 1 GB RAM).
2. **Khu vực (Region)**: Bắt buộc chọn 1 trong 3 khu vực tại Mỹ (US):
   * `us-central1` (Iowa)
   * `us-west1` (Oregon)
   * `us-east1` (South Carolina)
   *(Chọn khu vực khác như Singapore/Tokyo sẽ bị tính phí theo giờ)*.
3. **Ổ cứng (Boot Disk)**: Chọn loại **Standard persistent disk** có dung lượng **$\le$ 30 GB**.
4. **Băng thông mạng ra (Egress)**: Miễn phí 1 GB/tháng tới hầu hết các quốc gia (avatar-web chạy giao thức TCP nhẹ nên tiêu tốn cực ít băng thông).

---

## 📌 BƯỚC 1: Đăng ký Tài khoản Google Cloud Free Tier

1. Truy cập trang đăng ký: [Google Cloud Free Program](https://cloud.google.com/free)
2. Nhấn **Get started for free** và đăng nhập bằng tài khoản Google.
3. **Thiết lập thông tin thanh toán**:
   * **Quốc gia**: `Vietnam`.
   * **Loại tài khoản (Account type)**: Chọn **Cá nhân (Individual)**.
   * **Phương thức thanh toán**: Nhập thẻ Visa/Mastercard (Debit hoặc Credit vật lý có sẵn tối thiểu 50.000đ - 100.000đ để xác thực).
   * *Mẹo xử lý lỗi thanh toán `[OR_BACR2_31]`*: Nếu bị báo lỗi thẻ do dính hồ sơ doanh nghiệp cũ từ Google Ads, hãy truy cập [pay.google.com](https://pay.google.com) tạo một Hồ sơ thanh toán Cá nhân mới, hoặc sử dụng một tài khoản Gmail cá nhân mới hoàn toàn để đăng ký.
4. Sau khi hoàn tất, bạn sẽ được cấp quyền truy cập vào [GCP Console](https://console.cloud.google.com/).

---

## 📌 BƯỚC 2: Khởi tạo Máy chủ Compute Engine (`e2-micro`)

1. Truy cập trang quản lý máy ảo: [Compute Engine ➔ VM instances](https://console.cloud.google.com/compute/instances).
2. Nếu xuất hiện thông báo yêu cầu kích hoạt API, nhấn **Enable API** và đợi vài giây.
3. Nhấn nút **Create Instance** (Tạo phiên bản) và điền các thông số:
   * **Name**: `avatar-web-vps` (hoặc tên tùy thích).
   * **Region**: Chọn `us-central1` (Iowa), `us-west1` (Oregon), hoặc `us-east1` (South Carolina).
   * **Zone**: Chọn bất kỳ (ví dụ: `us-central1-a`).
   * **Machine configuration**:
     * Series: **`E2`**
     * Machine type: **`e2-micro`** (2 vCPU, 1 GB memory).
   * **Boot disk** (Nhấn nút **Change** để chỉnh sửa):
     * Operating system: **Ubuntu**
     * Version: **Ubuntu 22.04 LTS** hoặc **Ubuntu 24.04 LTS (x86/64)**
     * Boot disk type: **Standard persistent disk** *(Không chọn SSD để giữ miễn phí)*
     * Size: **30** GB
     * Nhấn **Select**.
   * **Firewall** (Tường lửa):
     * ✅ Tích chọn **Allow HTTP traffic** (Cho phép lưu lượng truy cập HTTP)
     * ✅ Tích chọn **Allow HTTPS traffic** (Cho phép lưu lượng truy cập HTTPS)
4. Nhấn nút **Create** ở cuối trang và đợi khoảng 30 - 60 giây để máy ảo khởi động.
5. Sao chép lại địa chỉ **External IP** (Public IP) của máy chủ vừa tạo.

---

## 📌 BƯỚC 3: Kết nối SSH & Tạo Swap RAM (Bắt buộc)

Do `e2-micro` chỉ có **1 GB RAM vật lý**, khi chạy lệnh biên dịch mã nguồn (`npm install` các module C++ như `better-sqlite3`, `argon2` và `vite build`), máy chủ sẽ rất dễ bị tràn RAM dẫn đến đơ hoặc bị hệ điều hành tắt tiến trình (OOM Kill). Vì vậy, **tạo 2GB Swap (RAM ảo) là bước bắt buộc**.

### 1. Kết nối SSH vào máy chủ
* **Cách đơn giản nhất**: Trên dòng Instance tại trang VM instances của GCP Console, nhấn nút **SSH**. Cửa sổ dòng lệnh Terminal sẽ bật lên ngay trên trình duyệt.

### 2. Tạo và kích hoạt Swap RAM 2GB
Chạy lần lượt các lệnh sau trên cửa sổ SSH:

```bash
# 1. Tạo file swap 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. Thiết lập tự kích hoạt Swap khi máy ảo khởi động lại
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Tinh chỉnh swapiness để hệ thống hoạt động mượt mà
sudo sysctl vm.swappiness=20
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf

# 4. Kiểm tra lại dung lượng RAM và Swap
free -h
```
*(Kết quả hiện `Swap: ~2.0Gi` là đã cấu hình thành công).*

---

## 📌 BƯỚC 4: Cài đặt Môi trường Hệ thống

Thực thi chuỗi lệnh sau để cập nhật hệ điều hành và cài đặt Node.js 20 LTS, công cụ biên dịch C++, PM2, Nginx và Certbot:

```bash
# Cập nhật danh sách gói và cài đặt công cụ cần thiết
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3 nginx certbot python3-certbot-nginx

# Cài đặt Node.js 20 LTS từ NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản Node và NPM
node -v   # Yêu cầu >= v20.x
npm -v

# Cài đặt công cụ quản lý tiến trình PM2 toàn cục
sudo npm install -g pm2
```

---

## 📌 BƯỚC 5: Clone Mã nguồn & Triển khai Ứng dụng

```bash
# 1. Tạo thư mục chứa web và gán quyền sở hữu
sudo mkdir -p /var/www/avatar-web
sudo chown -R $USER:$USER /var/www/avatar-web

# 2. Clone mã nguồn repo về máy chủ
git clone <URL_REPO_GITHUB_CUA_BAN> /var/www/avatar-web
cd /var/www/avatar-web

# 3. Cài đặt thư viện & Build Backend Server
cd /var/www/avatar-web/server
npm install
npm run build     # Biên dịch TypeScript sang JavaScript trong thư mục dist/

# 4. Cài đặt thư viện & Build Frontend Web UI
cd /var/www/avatar-web/web
npm install
npm run build     # Đóng gói giao diện tĩnh vào web/dist/
```

---

## 📌 BƯỚC 6: Cấu hình Môi trường (`.env`) & Chạy Backend với PM2

Tại thư mục `/var/www/avatar-web/server`:

1. **Khởi tạo khóa mã hóa `MASTER_KEY`**:
   ```bash
   cd /var/www/avatar-web/server
   npm run gen-key
   ```
   *Màn hình sẽ hiển thị 1 chuỗi Base64 32 bytes (Ví dụ: `w8A/x1...=`). Hãy copy lại chuỗi này.*

2. **Tạo và chỉnh sửa file `.env`**:
   ```bash
   nano /var/www/avatar-web/server/.env
   ```
   Dán nội dung cấu hình sau vào file:
   ```env
   NODE_ENV=production
   PORT=8787
   MASTER_KEY=DÁN_CHUỖI_BASE64_VỪA_GEN_VÀO_ĐÂY
   INVITE_CODE=MaMoiDangKyCuaBan123
   MAX_SESSIONS=20
   DB_PATH=/var/www/avatar-web/server/data/avatar-web.db
   ```
   *(Nhấn `Ctrl + O` ➔ `Enter` để lưu, sau đó nhấn `Ctrl + X` để thoát)*.

   > ⚠️ **LƯU Ý QUAN TRỌNG**: Hãy sao lưu chuỗi `MASTER_KEY` cất vào nơi an toàn. Mọi mật khẩu tài khoản game lưu trong database đều được mã hóa bằng khóa này. Nếu mất khóa, bạn sẽ không thể khôi phục lại mật khẩu trong DB.

3. **Khởi chạy Backend với PM2**:
   ```bash
   cd /var/www/avatar-web/server
   pm2 start dist/index.js --name "avatar-web"
   
   # Cấu hình khởi động cùng hệ thống khi VPS reboot
   pm2 startup
   # (Copy và chạy dòng lệnh sudo env PATH=... nếu PM2 yêu cầu trên màn hình)
   pm2 save
   ```

---

## 📌 BƯỚC 7: Cấu hình Tên miền, Nginx Reverse Proxy & SSL Miễn phí

### 1. Trỏ Tên miền về External IP của GCP
* Truy cập trang quản lý DNS của Domain (Cloudflare, Namecheap, TENTEN, PA Việt Nam,...).
* Tạo bản ghi **A Record**:
  * **Name / Host**: `avatar` (hoặc `@` nếu dùng domain gốc).
  * **Value / IPv4 Address**: Điền địa chỉ **External IP** của VM GCP.
  * *(Nếu dùng Cloudflare: Tạm thời tắt Proxy - để đám mây màu xám khi cấp chứng chỉ SSL lần đầu)*.

### 2. Cấu hình Nginx làm Reverse Proxy
Tạo file cấu hình virtual host mới:
```bash
sudo nano /etc/nginx/sites-available/avatar-web
```

Dán đoạn cấu hình sau (thay `avatar.domaincuaban.com` thành tên miền thật của bạn):

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
        
        # Giữ kết nối WebSocket không bị ngắt timeout
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Kích hoạt cấu hình Nginx:
```bash
# Xóa site default nếu cần
sudo rm -f /etc/nginx/sites-enabled/default

# Kích hoạt site avatar-web
sudo ln -s /etc/nginx/sites-available/avatar-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Cấp chứng chỉ SSL HTTPS (Let's Encrypt)
Chạy lệnh sau để Certbot tự động cấu hình SSL HTTPS:

```bash
sudo certbot --nginx -d avatar.domaincuaban.com
```
* Nhập địa chỉ Email của bạn ➔ Gõ `Y` để đồng ý điều khoản.
* Certbot sẽ tự động cài đặt chứng chỉ SSL và thiết lập chuyển hướng toàn bộ từ HTTP sang HTTPS an toàn.

---

## 🛠 Lệnh Quản lý, Bảo trì & Cập nhật thường dùng

* **Xem trạng thái ứng dụng**:
  ```bash
  pm2 status
  ```
* **Xem log thời gian thực**:
  ```bash
  pm2 logs avatar-web
  ```
* **Khởi động lại ứng dụng**:
  ```bash
  pm2 restart avatar-web
  ```
* **Cập nhật code khi có phiên bản mới**:
  ```bash
  cd /var/www/avatar-web
  git pull
  cd server && npm install && npm run build
  cd ../web && npm install && npm run build
  pm2 restart avatar-web
  ```
* **Sao lưu dữ liệu quan trọng**:
  * Database SQLite: `/var/www/avatar-web/server/data/avatar-web.db`
  * File cấu hình môi trường: `/var/www/avatar-web/server/.env`
