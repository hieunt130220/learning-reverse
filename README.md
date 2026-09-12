# AvatarHD Reverse Engineering & Automation Suite (`learning-reverse`)

Hệ sinh thái mã nguồn mở toàn diện phục vụ nghiên cứu, phân tích kỹ thuật, dịch ngược (reverse engineering) và tự động hóa game di động **AvatarHD** (`com.TeaM.Avatar` - TeaMobi). Dự án bao gồm từ việc bóc tách mã máy Unity IL2CPP, giải mã giao thức nhị phân TCP socket, xây dựng web client headless chạy 24/7, cho tới ứng dụng Deep Learning (PyTorch) để giải captcha và nhận diện hình ảnh cho minigame câu cá theo thời gian thực.

---

## 📑 Mục lục

1. [Kiến trúc Tổng thể (System Architecture)](#-kiến-trúc-tổng-thể-system-architecture)
2. [Cấu trúc Thư mục Monorepo](#-cấu-trúc-thư-mục-monorepo)
3. [Bắt đầu nhanh (Quickstart)](#-bắt-đầu-nhanh-quickstart)
4. [Chi tiết các Phân hệ Chính](#-chi-tiết-các-phân-hệ-chính)
   - [1. avatar-web (Headless Web Client & Automation)](#1-avatar-web-headless-web-client--automation)
   - [2. fishing-ml (AI Thị giác Máy tính cho Câu cá)](#2-fishing-ml-ai-thị-giác-máy-tính-cho-câu-cá)
   - [3. captcha-solver (Nhận diện Captcha CRNN + CTC)](#3-captcha-solver-nhận-diện-captcha-crnn--ctc)
   - [4. avatar-re (Môi trường Dịch ngược Unity IL2CPP)](#4-avatar-re-môi-trường-dịch-ngược-unity-il2cpp)
   - [5. avatar-jar & tools (Bot J2ME & Bytecode Patching)](#5-avatar-jar--tools-bot-j2me--bytecode-patching)
5. [Cấu hình Biến Môi trường](#-cấu-hình-biến-môi-trường)
6. [Triển khai Production (CI/CD)](#-triển-khai-production-cicd)
7. [Tài liệu Kỹ thuật & Nghiên cứu Giao thức](#-tài-liệu-kỹ-thuật--nghiên-cứu-giao-thức)
8. [Quy chuẩn Phát triển](#-quy-chuẩn-phát-triển)

---

## 🏛 Kiến trúc Tổng thể (System Architecture)

Trình duyệt không thể mở kết nối TCP socket thô trực tiếp tới máy chủ game. Do đó, hệ thống sử dụng kiến trúc Backend Gateway làm trung gian điều phối, kết hợp với các microservices suy luận AI ngoài băng (out-of-band inference services):

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT / TRÌNH DUYỆT                              │
│         React + Vite + Tailwind CSS Dashboard (Mobile-first, WebSocket)          │
└────────────────────────▲────────────────────────────────────▲────────────────────┘
                         │ HTTPS (REST API)                   │ WSS (Realtime Logs)
                         ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         AVATAR-WEB BACKEND (Node.js/TS)                          │
│                                Cổng dịch vụ: 8787                                │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ REST Controller & WebSocket Gateway                                        │  │
│  │ SQLite Database (Users, Auth Tokens, Accounts Encrypted with Master Key)   │  │
│  │ SessionManager: Map<accountId, AvatarSession>                              │  │
│  │ Auto-Farm Engine (Trồng, Chăm sóc, Thu hoạch, Bếp nấu, Kho hàng, Sạp bán) │  │
│  │ Auto-Fishing Orchestrator (Mua vé, Mua mồi, Câu cá, Bán cá)               │  │
│  │ NPC Quests Tracker (Tân Thủ, Nhà Nông, Thợ Câu qua dialog NPC Lái buôn)    │  │
│  └───────────────────▲──────────────────────────────────────▲─────────────────┘  │
└──────────────────────┼──────────────────────────────────────┼────────────────────┘
                       │                                      │
         HTTP POST /predict                           HTTP POST /solve
       (Frames RX79 40x40 RGBA)                    (Captchas 100x15 Alpha)
                       │                                      │
                       ▼                                      ▼
        ┌──────────────────────────────┐       ┌──────────────────────────────┐
        │     FISHING-ML SERVICE       │       │    CAPTCHA-SOLVER SERVICE    │
        │      Python / FastAPI        │       │       Python / PyTorch       │
        │         Cổng: 8080           │       │          Cổng: 8643          │
        │  PyTorch Deep CNN (Siamese)  │       │  PyTorch CRNN + CTC Decoder  │
        │     Inference CPU < 15ms     │       │     Inference CPU < 25ms     │
        └──────────────────────────────┘       └──────────────────────────────┘
                       │
                       │ Outbound TCP Socket (Mã hóa Rolling XOR song công)
                       ▼
        ┌──────────────────────────────┐
        │      AVATAR GAME SERVER      │
        │      IP: 27.0.14.120:19129   │
        └──────────────────────────────┘
```

---

## 📂 Cấu trúc Thư mục Monorepo

| Thư mục / File | Vai trò |
|---|---|
| `dev.sh` | **Unified Dev Launcher** — Một lệnh khởi động đồng thời cả 3 service (ML, Backend, Web UI). |
| `avatar-web/` | Nền tảng điều khiển web: Backend Node.js, Frontend React và Service ML câu cá. |
| ├── `server/` | Node.js + TypeScript headless client, REST API, SQLite, TCP Socket client tới game. |
| ├── `web/` | Web Dashboard React 18, Vite, Tailwind CSS, hỗ trợ responsive di động. |
| └── `fishing-ml/` | Service suy luận AI thị giác máy tính cho minigame câu cá (PyTorch CPU). |
| `captcha-solver/` | Hệ thống giải mã captcha chữ Avatar 100x15 bằng mô hình CRNN + CTC (PyTorch). |
| `avatar-re/` | Không gian làm việc dịch ngược APK AvatarHD: IL2CPP dumps, Frida scripts, Jadx, Ghidra headers. |
| `avatar-jar/` | Các bản build JAR J2ME auto truyền thống chạy qua MicroEmulator / điện thoại cổ. |
| `tools/` | Các công cụ bổ trợ (bytecode patcher cho JAR, script phân tích). |
| `docs/` | Toàn bộ tài liệu phân tích kỹ thuật: giao thức opcode, nhiệm vụ NPC, cơ chế sạp hàng, bản đồ câu cá. |
| `.github/workflows/` | CI/CD pipeline tự động deploy lên VPS qua SSH khi push vào nhánh `main`. |

---

## ⚡ Bắt đầu nhanh (Quickstart)

### 1. Yêu cầu Tiên quyết (Prerequisites)
- **Node.js**: Phiên bản 18 trở lên & `npm`.
- **Python**: Phiên bản 3.10 hoặc 3.12 (khuyên dùng Python CPU).
- **Virtualenv / uv**: Quản lý môi trường ảo Python độc lập.

### 2. Khởi tạo môi trường lần đầu

#### A. Cấu hình Backend & Web UI
```bash
# 1. Cài đặt dependencies cho Backend Server
cd avatar-web/server
npm install

# 2. Tạo Master Key mã hóa mật khẩu & file .env
npm run gen-key
# Sao chép MASTER_KEY được in ra màn hình và cấu hình file .env:
cat <<EOF > .env
PORT=8787
NODE_ENV=development
MASTER_KEY=<DÁN_KEY_VỪA_TẠO_VÀO_ĐÂY>
INVITE_CODE=AVATAR2026
DB_PATH=server/data/avatar-web.db
SHOP_READ_ENABLED=true
SHOP_WRITE_ENABLED=true
EOF

# 3. Cài đặt dependencies cho Frontend
cd ../web
npm install
cd ../..
```

#### B. Khởi tạo Python venv cho Fishing ML
```bash
cd avatar-web/fishing-ml
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -e .
deactivate
cd ../..
```

#### C. Khởi tạo Python venv cho Captcha Solver (Tùy chọn nếu cần giải captcha JAR)
```bash
cd captcha-solver
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-runtime.txt
deactivate
cd ..
```

### 3. Chạy môi trường Development (Chỉ với 1 lệnh)

Tại thư mục gốc của repository, chạy file script launcher hợp nhất:

```bash
./dev.sh
```

Script sẽ tự động:
1. Kiểm tra môi trường (Node.js, npm, Python virtualenv, mô hình AI frozen, file `.env`).
2. Tự động tìm và giải phóng các tiến trình đang chiếm dụng các cổng mạng `8080`, `8787`, `5173`.
3. Khởi chạy song song cả 3 dịch vụ với prefix màu sắc trực quan:
   - **`[ml]`** : AI Fishing ML Service trên `http://127.0.0.1:8080`
   - **`[server]`** : Backend Node.js trên `http://127.0.0.1:8787`
   - **`[web]`** : Web UI trên `http://localhost:5173`
4. Quản lý vòng đời tiến trình sạch sẽ (Clean Shutdown): Khi nhấn `Ctrl + C`, toàn bộ tiến trình con và cổng mạng sẽ được dọn dẹp triệt để.

Truy cập `http://localhost:5173`, đăng ký tài khoản với mã mời `AVATAR2026` và thêm tài khoản game để sử dụng!

---

## 🛠 Chi tiết các Phân hệ Chính

### 1. `avatar-web` (Headless Web Client & Automation)
Được viết bằng TypeScript hiện đại, phân hệ này đóng vai trò thay thế hoàn toàn app game Avatar trên điện thoại:
- **Giao thức mạng nhị phân chuẩn xác**: Kết nối trực tiếp vào `27.0.14.120:19129`, thực hiện handshake trao đổi khóa mã hóa (`Cmd -27`), duy trì phiên với hai con trỏ giải mã độc lập `curR` và `curW` (Rolling XOR).
- **Hệ thống Quản lý Phiên (SessionManager)**: Duy trì đồng thời nhiều tài khoản game độc lập trong cùng một tiến trình Node.js, tự động kết nối lại khi mất mạng (với exponential backoff và anti-storm).
- **Tính năng Tự động hóa Nông trại (Auto-Farm 24/7)**:
  - Tự động cày đất, tưới nước, diệt sâu/cỏ, bón phân, thu hoạch nông sản.
  - Tự động gieo hạt theo kế hoạch (hỗ trợ quy hoạch từng ô đất riêng biệt lên tới 48 ô).
  - Tự động mua hạt giống khi thiếu, tự động chăm sóc và bán vật nuôi (gà, bò, cá) theo hạn mức cấu hình.
  - Tự động nấu ăn theo công thức bếp trưởng, tự động bán thức ăn thành phẩm vào kho nông sản.
  - Tự động điểm danh hàng ngày qua NPC Lái Buôn (`uid: 21`).
- **Tích hợp Sạp mua bán nông sản (Cmd 103)**: Tra cứu sạp công cộng, niêm yết bán hàng, rút tiền sạp, mua nông sản giá tốt từ người chơi khác.
- **Theo dõi Chuỗi Nhiệm vụ NPC**: Tự động parse dialog từ NPC Lái buôn (`Cmd -40 / -62 / -81`) để đồng bộ tiến độ 3 chuỗi nhiệm vụ chính: *Tân Thủ*, *Nhà Nông*, và *Thợ Câu*.

### 2. `fishing-ml` (AI Thị giác Máy tính cho Câu cá)
Tự động hóa hoàn toàn tính năng câu cá trong game AvatarHD — nơi game sử dụng cơ chế hình ảnh chống bot:
- **Cơ chế**: Game gửi các gói tin `RX 79` chứa mảng byte hình ảnh (kích thước 40x40 pixel) hiển thị con trỏ cá và thanh giật cần.
- **Kiến trúc mạng**: Sử dụng mạng CNN trích xuất đặc trưng hình ảnh kết hợp đối sánh độ tương đồng (Photometric + Geometric Embedding, vector 128 chiều) với độ trễ cực thấp (< 15ms trên CPU).
- **Dịch vụ suy luận (Inference Service)**: Xây dựng trên nền tảng FastAPI/Uvicorn, tải mô hình tối ưu đã đóng băng (`frozen`), cung cấp endpoint `POST /predict` cho Backend Node.js gọi trực tiếp.
- **Vòng tuần hoàn câu cá khép kín**:
  `Tự động di chuyển vào map câu` ➔ `Mua vé câu` ➔ `Mua mồi câu thích hợp` ➔ `Thả cần` ➔ `AI nhận diện cá cắn câu` ➔ `Giật cần chính xác` ➔ `Tự động bán cá cho NPC khi đầy rương`.

### 3. `captcha-solver` (Nhận diện Captcha CRNN + CTC)
Bộ giải mã captcha ký tự hiển thị trong game Avatar:
- **Đặc thù captcha**: Ảnh định dạng PNG kích thước **100x15 RGBA**, chữ hiển thị bằng kênh alpha (kênh RGB hoàn toàn đen), nhãn dạng `sốĐtừ` (ví dụ: `1Đnai`, `2Đbay`).
- **Kiến trúc mô hình**: **CRNN** (Convolutional Recurrent Neural Network) kết hợp lớp **CTC Loss** (Connectionist Temporal Classification), huấn luyện hoàn toàn bằng PyTorch.
- **Pipeline hoàn chỉnh**:
  - `label_tool.py`: Web tool phục vụ con người gán nhãn dataset nhanh qua trình duyệt.
  - `src/train.py`: Huấn luyện mô hình với data augmentation (biến dạng, nhiễu alpha).
  - `solver_server.py`: API Server (port 8643) phục vụ giải mã captcha tức thì cho cả web client và các bản bot JAR qua HTTP POST.

### 4. `avatar-re` (Môi trường Dịch ngược Unity IL2CPP)
Không gian làm việc dịch ngược phiên bản APK gốc `AvatarHD_3.4.4_APKPure.apk` (Engine Unity IL2CPP 64-bit):
- **Cấu trúc bóc tách (`il2cpp_out/`)**:
  - `dump.cs`: File kết xuất C# dung lượng gần 10MB chứa toàn bộ khai báo 5947 classes, methods, struct và fields của game.
  - `DummyDll/`: Thư viện assembly `.dll` khôi phục để mở bằng **dnSpy / ILSpy**.
  - `il2cpp.h` & `script.json`: Cung cấp cấu trúc dữ liệu và tên hàm chuẩn cho **IDA Pro / Ghidra**.
- **Hooking động qua Frida (`frida_scripts/`)**:
  - `agent.ts`: Sử dụng `frida-il2cpp-bridge` để hook trực tiếp vào các hàm native C# trong `libil2cpp.so` theo tên lớp/hàm mà không cần hardcode offset bộ nhớ.
  - `bypass.js`: Script vượt cơ chế kiểm tra Root và SSL Pinning trên thiết bị Android/Emulator.

### 5. `avatar-jar` & `tools` (Bot J2ME & Bytecode Patching)
Hỗ trợ tương thích ngược cho người dùng chạy bản bot Java (.JAR) truyền thống trên PC (MicroEmulator) hoặc Android (J2ME Loader):
- `tools/jar/patch_jar.py`: Script can thiệp bytecode Java, sửa đổi URL máy chủ giải captcha gốc thành URL của `captcha-solver` local hoặc production:
  ```bash
  # Patch trỏ về production resolver:
  python3 tools/jar/patch_jar.py \
    --url https://avt3xauto.duckdns.org/api/solver/ \
    --out avatar-jar/avatar-auto-production.jar
  ```

---

## ⚙️ Cấu hình Biến Môi trường

Các cấu hình cốt lõi nằm trong file `avatar-web/server/.env`:

| Tên biến | Kiểu dữ liệu | Mặc định | Ý nghĩa & Mô tả |
|---|---|---|---|
| `PORT` | Number | `8787` | Cổng lắng nghe của Backend Server. |
| `NODE_ENV` | String | `development` | Môi trường chạy (`development` hoặc `production`). |
| `MASTER_KEY` | String (Base64) | *(Bắt buộc)* | Khóa bí mật 32-byte AES dùng để mã hóa mật khẩu tài khoản game trong DB. Tạo qua `npm run gen-key`. |
| `INVITE_CODE` | String | *(Bắt buộc)* | Mã mời yêu cầu khi người dùng mới đăng ký tài khoản web. |
| `MAX_SESSIONS` | Number | `20` | Số lượng tài khoản game tối đa được phép kết nối đồng thời. |
| `DB_PATH` | String | `server/data/avatar-web.db` | Đường dẫn lưu trữ file SQLite database. |
| `SHOP_READ_ENABLED` | Boolean | `false` | Bật/tắt tính năng xem danh sách sạp hàng nông sản. |
| `SHOP_WRITE_ENABLED` | Boolean | `false` | Master gate cho phép đăng bán, hủy bán hàng sạp. |
| `SHOP_PURCHASE_ENABLED`| Boolean | `false` | Cho phép bot tự động mua nông sản từ sạp người chơi khác. |
| `FISHING_SHADOW_ENABLED` | Boolean | `false` | Bật chế độ shadow test cho AI câu cá (chỉ gửi log, không giật cần). |

---

## 🚀 Triển khai Production (CI/CD)

Hệ thống được thiết kế để vận hành 24/7 bền bỉ trên máy chủ Linux (Ubuntu 22.04 / 24.04 LTS), tối ưu hóa hoàn hảo cho các gói VPS miễn phí trọn đời (**Oracle Cloud Always Free Ampere ARM** hoặc **Google Cloud e2-micro**):

1. **Tự động hóa CI/CD**:
   - Khi có commit mới được merge vào nhánh `main`, GitHub Actions (`.github/workflows/deploy.yml`) sẽ kích hoạt.
   - Kết nối SSH an toàn tới máy chủ production, tự động `git pull`, build lại frontend, kiểm tra dependencies và restart các process thông qua PM2.
2. **Quản lý tiến trình qua PM2**:
   - `avatar-web-server`: Điều phối web và kết nối TCP game.
   - `fishing-ml`: Dịch vụ suy luận câu cá Python.
   - `captcha-solver`: Dịch vụ giải mã captcha.
3. **Nginx Reverse Proxy & SSL**:
   - Cấu hình Nginx đứng trước phục vụ file tĩnh của Frontend React, đồng thời reverse proxy cổng 80/443 (Let's Encrypt SSL) về Backend `8787` và solver `8643`.

*Chi tiết từng bước triển khai vui lòng tham khảo:*
- [Hướng dẫn triển khai Oracle Cloud Always Free](avatar-web/DEPLOY.md)
- [Hướng dẫn triển khai Google Cloud Platform (GCP) e2-micro](avatar-web/DEPLOY_GCP.md)

---

## 📚 Tài liệu Kỹ thuật & Nghiên cứu Giao thức

Thư mục `docs/` chứa các tài liệu phân tích kỹ thuật chuyên sâu được đúc kết trong quá trình reverse engineering:
- **Giao thức Câu cá**: Cơ chế opcode `Cmd 45, 41, 79, 43, 44` và giải mã ảnh phao câu.
- **Nhiệm vụ Nông trại & NPC**: Bóc tách dialog NPC Lái Buôn (`Cmd -40 / -62 / -81`) cho 3 chuỗi nhiệm vụ: [docs/Giai-ma-he-thong-nhiem-vu-nong-trai-AvatarHD.md](docs/Giai-ma-he-thong-nhiem-vu-nong-trai-AvatarHD.md).
- **Sạp hàng Nông sản**: Phân tích kỹ thuật lệnh `Cmd 103`: [docs/Sạp mua bán nông sản trong nông trại AvatarHD.md](docs/Sạp mua bán nông sản trong nông trại AvatarHD.md).
- **Bản đồ & Tọa độ Di chuyển**: Bản đồ các khu vực câu cá và tọa độ NPC: [docs/danh-sach-cac-map-cau-ca-AvatarHD.md](docs/danh-sach-cac-map-cau-ca-AvatarHD.md).
- **Giao thức Báo danh Hàng ngày**: Cơ chế nhận thưởng điểm danh qua NPC.

---

## 🛡 Quy chuẩn Phát triển

Dự án áp dụng hệ thống quản lý mã nguồn và trí tuệ code tự động:
- **GitNexus Code Intelligence**: Repository được lập chỉ mục đầy đủ với hơn 12.000 symbols và 300 luồng thực thi (execution flows). Trước khi chỉnh sửa bất kỳ hàm/module nào, bắt buộc kiểm tra bán kính ảnh hưởng (`impact`) để đảm bảo không làm gián đoạn luồng vận hành mạng.
- **Quy trình Phát triển Superpowers**: Áp dụng quy chuẩn kỹ thuật nghiêm ngặt nhằm đảm bảo tính ổn định và kiểm thử thực tế của toàn bộ tính năng tự động hóa.

---

*Dự án được xây dựng phục vụ mục đích nghiên cứu khoa học, kỹ thuật dịch ngược phần mềm và tự động hóa thử nghiệm.*
