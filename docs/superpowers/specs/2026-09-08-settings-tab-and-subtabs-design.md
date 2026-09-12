# Đổi tên tab Tự động thành Cài đặt & Phân tách Sub-tabs Nông trại / Câu cá — Design Document

## 1. Mục tiêu & Bối cảnh

Hiện tại trên giao diện Web (`AccountOperationsDrawer`):
- Tab **"Tự động"** đang chứa toàn bộ cấu hình tự động nông trại (trồng trọt, vật nuôi chuồng, vật nuôi hồ, nấu bếp, bán sạp).
- Tab **"Câu cá"** đang gộp cả phần vận hành thời gian thực (nút Bắt đầu/Dừng, nhiệm vụ Thợ Câu, thống kê cá đã bắt/vừa bắt) lẫn phần cấu hình tham số (*Cấu hình hồ câu*, *Cấu hình mua vật phẩm tự động*).

Sự phân bố này làm tab "Câu cá" bị dài và phân tán, đồng thời chưa có một trung tâm quản lý cấu hình thống nhất cho toàn bộ các module tự động.

**Mục tiêu thay đổi**:
1. Đổi tên tab **"Tự động"** thành **"Cài đặt"** trong Drawer điều hướng.
2. Trong tab **"Cài đặt"**, tạo 2 tab nhỏ (sub-tabs):
   - **Nông trại**: Chứa toàn bộ các phần cấu hình tự động nông trại hiện tại (`AutoFarmPanel`).
   - **Câu cá**: Chứa phần *Cấu hình hồ câu* và *Cấu hình mua vật phẩm tự động* tách từ `FishingPanel`.
3. Tối ưu tab **"Câu cá"** chính bên ngoài Drawer: Trở thành bảng điều khiển vận hành thuần túy (Bắt đầu/Dừng câu cá, Nhiệm vụ Thợ Câu, Thống kê cá bắt được theo thời gian thực), kèm chỉ dẫn liên kết sang tab Cài đặt.

---

## 2. Phạm vi (Scope)

### In-scope
- Cập nhật danh sách tab trong `AccountOperationsDrawer.tsx`: đổi ID/nhãn từ `['autofarm', 'Tự động']` thành `['settings', 'Cài đặt']`.
- Tạo component `SettingsPanel.tsx` (`avatar-web/web/src/accounts/panels/SettingsPanel.tsx`) quản lý 2 sub-tabs:
  - `farm` (nhãn: `🌾 Nông trại`)
  - `fishing` (nhãn: `🎣 Câu cá`)
- Tạo component `FishingSettingsPanel.tsx` (`avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx`):
  - Form *Cấu hình hồ câu* (chọn Map, Area, Delay quăng cần).
  - Form *Cấu hình mua vật phẩm tự động* (checkbox tự mua vé, chọn loại cần câu, loại mồi câu, số lượng mồi mua).
  - Nút *Lưu Cấu Hình*, xử lý dirty state, hiển thị thông báo thành công hoặc lỗi (conflict revision, API error).
- Tinh giản `FishingPanel.tsx`:
  - Di dời form cấu hình sang `FishingSettingsPanel.tsx`.
  - Giữ nguyên phần Header (trạng thái + nút Bắt đầu/Dừng), Nhiệm vụ Thợ Câu, và Metrics thống kê cá.
  - Thêm ghi chú/link điều hướng nhanh sang tab Cài đặt khi người dùng cần chỉnh thông số.
- Cập nhật styles CSS cần thiết cho sub-tab navigation của `SettingsPanel`.
- Cập nhật các test liên quan trong `avatar-web/web/src/accounts/accountsRoutes.test.tsx` để khớp với tên tab mới "Cài đặt".

### Out-of-scope
- Không thay đổi bất kỳ logic backend, API contract, hoặc DTO nào (`/api/accounts/:id/automation/config`, `/api/accounts/:id/automation/fishing/config`).
- Không thay đổi logic chạy auto farm hoặc auto fishing trên server.
- Không thay đổi cấu trúc cơ sở dữ liệu lưu trữ cấu hình.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Cấu trúc Component

```text
AccountOperationsDrawer
│
├── nav.drawer-tabbar (Mobile)
│   ├── [Trạng thái]
│   ├── [Cài đặt]   <-- Đổi từ [Tự động]
│   ├── [Câu cá]    <-- Vận hành thuần túy
│   ├── [Nhiệm vụ]
│   ├── [Nấu ăn]
│   ├── [Tài sản]
│   ├── [Sạp]
│   └── [Log]
│
├── div.drawer-panels
│   ├── StatusPanel
│   │
│   ├── SettingsPanel (id="drawer-panel-settings")
│   │   ├── nav.settings-subtabs
│   │   │   ├── button.active [🌾 Nông trại]
│   │   │   └── button [🎣 Câu cá]
│   │   │
│   │   ├── [Tab Nông trại]: AutoFarmPanel
│   │   │   ├── Cây trồng
│   │   │   ├── Vật nuôi chuồng
│   │   │   ├── Vật nuôi hồ
│   │   │   ├── Bếp nấu ăn tự động
│   │   │   ├── Tự động đưa nông sản lên sạp
│   │   │   └── Nút Lưu kế hoạch
│   │   │
│   │   └── [Tab Câu cá]: FishingSettingsPanel
│   │       ├── Cấu hình hồ câu (Map, Area, Delay)
│   │       ├── Cấu hình mua vật phẩm tự động (Vé, Cần, Mồi, Số lượng)
│   │       └── Nút Lưu Cấu Hình
│   │
│   ├── FishingPanel (id="drawer-panel-fishing")
│   │   ├── Header: Trạng thái + Bắt đầu/Dừng câu
│   │   ├── Fisherman Quest Card (Nhiệm vụ Thợ Câu + Làm mới)
│   │   ├── Live Metrics (Tổng cá đã bắt, Cá vừa bắt, Map/Khu)
│   │   └── Hint: "Để đổi hồ câu hoặc mồi, hãy vào tab Cài đặt > Câu cá"
│   │
│   └── ... các panel khác giữ nguyên
```

### 3.2 Data Contracts & Props

#### Component `SettingsPanel.tsx`:
```ts
interface SettingsPanelProps {
  account: AccountWithRuntime;
  snapshot?: AccountRuntimeSnapshot | null;
  automation?: AutomationSnapshot;
  onPlanDirtyChange(dirty: boolean): void;
  onFishingDirtyChange?(dirty: boolean): void;
  onAutomationChange?(loaded: AutomationSnapshot): void;
  onReloadRequested?(): void;
}
```
State nội bộ:
```ts
type SettingsSubTab = 'farm' | 'fishing';
const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('farm');
```

#### Component `FishingSettingsPanel.tsx`:
```ts
interface FishingSettingsPanelProps {
  accountId: number;
  automation?: AutomationSnapshot;
  isFishing?: boolean;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
  onChanged?(): void;
  onDirtyChange?(dirty: boolean): void;
}
```
- Quản lý form state: `selectedMap`, `area`, `delayMs`, `autoBuyTicket`, `rodType`, `baitType`, `baitQuantity`.
- So sánh `isDirty` với `automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG`.
- Xử lý lưu cấu hình thông qua `PUT /api/accounts/:id/automation/fishing/config`.
- Thông báo lỗi/thành công và conflict revision (status 409).

#### Component `FishingPanel.tsx`:
- Nhận props như hiện tại nhưng không còn chứa logic form input của config.
- Chỉ hiển thị:
  - Header với trạng thái câu và nút Bắt đầu / Dừng câu cá.
  - Card Nhiệm Vụ Thợ Câu (`quests?.fisherman`).
  - Thẻ thống kê: Tổng cá đã bắt, Cá vừa bắt được, Map/Khu vực.
  - Khi người dùng nhấn "Bắt đầu câu cá", nếu bot chưa chạy, kích hoạt `POST /api/accounts/:id/automation/start` với `{ mode: 'auto_fishing' }`.

### 3.3 Điều hướng & Dirty State Guard

Trong `AccountOperationsDrawer.tsx`:
```ts
const [dirtySources, setDirtySources] = useState({ farm: false, findNpc: false, fishing: false });
const anyDirty = dirtySources.farm || dirtySources.findNpc || dirtySources.fishing;
```
Khi người dùng sửa đổi cấu hình ở cả Nông trại lẫn Câu cá mà chưa lưu, việc đóng Drawer (`beforeunload` hoặc bấm nút đóng) sẽ hiện cảnh báo xác nhận để tránh mất dữ liệu.

### 3.4 Giao diện & Styling

Thêm CSS class cho thanh chuyển sub-tab trong `styles.css`:
```css
.settings-tabs-nav {
  display: flex;
  gap: 6px;
  background: #161b22;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--line);
  margin-bottom: 12px;
}

.settings-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-tab-btn:hover {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.05);
}

.settings-tab-btn.active {
  background: #21262d;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
```

---

## 4. Verification Plan

### 4.1 Automated Tests
- Cập nhật test case trong `avatar-web/web/src/accounts/accountsRoutes.test.tsx`:
  - Đổi selector từ `screen.getByRole('tab', { name: 'Tự động' })` thành `screen.getByRole('tab', { name: 'Cài đặt' })`.
- Chạy toàn bộ test suite frontend:
  ```bash
  npm --prefix avatar-web/web test -- --run
  ```
- Kiểm tra build frontend:
  ```bash
  npm --prefix avatar-web/web run build
  ```

### 4.2 Manual Verification
1. Mở drawer tài khoản:
   - Kiểm tra thanh tab hiển thị "Cài đặt" thay vì "Tự động".
   - Bấm vào tab "Cài đặt": hiển thị 2 sub-tab `🌾 Nông trại` và `🎣 Câu cá`.
2. Kiểm tra sub-tab `🌾 Nông trại`:
   - Hiển thị đầy đủ kế hoạch cây trồng, vật nuôi chuồng, vật nuôi hồ, bếp nấu ăn, bán nông sản.
   - Thử sửa kế hoạch, kiểm tra dirty state và lưu kế hoạch thành công.
3. Kiểm tra sub-tab `🎣 Câu cá`:
   - Hiển thị Cấu hình hồ câu và Cấu hình mua vật phẩm tự động.
   - Thử thay đổi map/khu vực/mồi câu, kiểm tra cảnh báo dirty state và bấm nút Lưu Cấu Hình.
4. Kiểm tra tab `Câu cá` ngoài Drawer:
   - Giao diện gọn gàng với Header (Bắt đầu/Dừng câu), Nhiệm vụ Thợ Câu, và Metrics thống kê.
   - Không còn form cấu hình trùng lặp.
