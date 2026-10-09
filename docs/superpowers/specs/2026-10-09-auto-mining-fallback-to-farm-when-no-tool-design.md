# Thiết Kế Kiến Trúc — Tự Động Quay Lại Mode Farm Khi Hết Cuốc Khai Thác Gỗ/Đá

> **Ngày:** 2026-10-09  
> **Chủ đề:** `auto-mining-fallback-to-farm-when-no-tool`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)  
> **Tài liệu tham chiếu:**  
> - `docs/superpowers/specs/2026-09-17-tich-hop-khai-thac-go-da-web-auto-design.md`  
> - `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`  
> - `avatar-web/server/src/mining/autoMining.ts`  
> - `avatar-web/server/src/session/avatarSession.ts`  

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Bối Cảnh
Hiện tại tính năng tự động khai thác gỗ/đá (`auto_mining`) trong `avatar-web` hoạt động độc lập qua `AutoMiningRunner`. Khi nhân vật bị gãy cuốc, hết cuốc hoặc thiếu cuốc/rìu trong quá trình khai thác:
1. `AutoMiningRunner` phát hiện thông báo lỗi từ game dialog `RX -40`, đặt `status = 'paused_no_tool'` và dừng vòng lặp runner (`this.running = false`).
2. Tuy nhiên, `AutoMiningRunner` **không có callback thông báo** (`onRequestStop`) về `AvatarSession`.
3. Do đó, `AvatarSession` vẫn giữ nguyên trạng thái `desiredMode = 'auto_mining'` và `activeMode = 'auto_mining'`, nhân vật đứng im tại map khai thác (Room 26 hoặc Room 22), không tự động chuyển về chế độ nông trại (`auto_farm`) để tiếp tục chu kỳ chăm sóc cây trồng và vật nuôi.
4. Nhận diện thông báo hết cuốc hiện tại cần được chuẩn hóa để bắt chính xác từ khóa `"hết cuốc"` theo yêu cầu người dùng.

### 1.2 Mục Tiêu Cụ Thể
1. Thêm callback `onRequestStop(reason, message)` vào `AutoMiningRunnerDeps` để runner thông báo về session khi kết thúc hoặc tạm dừng do thiếu công cụ (`reason = 'no_tool'`).
2. Nhận diện chính xác thông điệp chứa từ khóa `"hết cuốc"` từ server.
3. Thêm tùy chọn `returnToFarm?: boolean` (mặc định `true`) vào cấu hình khai thác `MiningConfig`.
4. Trong `AvatarSession`, khi nhận được sự kiện `no_tool` và `returnToFarm !== false`, tự động gọi `switchAutomationMode` chuyển sang `auto_farm`.
5. Bổ sung checkbox điều khiển `Tự động quay về Nông trại khi hết cuốc` trên giao diện modal bắt đầu khai thác (`MiningTargetModal.tsx`).

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Contracts & Types (`automationTypes.ts`, `types.ts`):**
   - Thêm `returnToFarm?: boolean` vào `MiningConfig` (mặc định `true` trong `DEFAULT_MINING_CONFIG`).
2. **Runner Khai Thác (`autoMining.ts`):**
   - Mở rộng `AutoMiningRunnerDeps`:
     ```typescript
     export interface AutoMiningRunnerDeps {
       accountId: number;
       onStateChange?: (state: MiningRuntimeState) => void;
       onRequestStop?: (reason: 'no_tool' | 'low_energy' | 'depleted' | 'error' | 'stopped', message?: string) => void;
       onLog?: (message: string) => void;
     }
     ```
   - Nhận diện thông điệp hết cuốc: Kiểm tra chuỗi chứa `"hết cuốc"` (theo yêu cầu người dùng: `text.toLowerCase().includes('hết cuốc')` hoặc `/hết cuốc/i.test(text)`).
   - Khi phát hiện `"hết cuốc"`, cập nhật status `'paused_no_tool'` và kích hoạt `onRequestStop?.('no_tool', dialog)`.
3. **Quản Lý Session (`avatarSession.ts`):**
   - Truyền `onRequestStop` khi khởi tạo `AutoMiningRunner`.
   - Nếu `reason === 'no_tool'` và `this.miningConfig.config.returnToFarm !== false`, ghi log `[khai thác] hết cuốc/công cụ, chuyển sang chế độ tự động nông trại.` và gọi `switchAutomationMode({ desiredMode: 'auto_farm', ... })`.
4. **Giao Diện Frontend (`MiningTargetModal.tsx`):**
   - Bổ sung state `returnToFarm` (mặc định `true`).
   - Thêm checkbox `Tự động quay về Nông trại khi hết cuốc` tương tự như `SchoolConfigModal.tsx`.
   - Lưu cấu hình và áp dụng khi người dùng bấm bắt đầu.

### 2.2 Out-of-Scope
- Tự động di chuyển đến NPC Thợ Rèn (Khu 5 Room 22) để mua/sửa cuốc chim (sẽ phát triển ở giai đoạn sau nếu cần).

---

## 3. Thiết Kế Chi Tiết & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Files Liên Quan

| File | Vai trò | Chi tiết thay đổi |
| :--- | :--- | :--- |
| `avatar-web/server/src/session/automationTypes.ts` | Data Contracts (Server) | Thêm `returnToFarm?: boolean` vào `MiningConfig` & `DEFAULT_MINING_CONFIG`. |
| `avatar-web/web/src/types.ts` | Data Contracts (Client) | Thêm `returnToFarm?: boolean` vào `MiningConfig`. |
| `avatar-web/server/src/mining/autoMining.ts` | Core Runner | Thêm `onRequestStop` vào deps, cải tiến nhận diện hết/gãy cuốc, gọi `onRequestStop` khi `no_tool`. |
| `avatar-web/server/src/session/avatarSession.ts` | Session Coordinator | Gắn `onRequestStop` cho `miningRunner`, chuyển mode sang `auto_farm` khi hết cuốc. |
| `avatar-web/web/src/accounts/MiningTargetModal.tsx` | Web UI Modal | Bổ sung checkbox `returnToFarm` và lưu cấu hình khi kích hoạt auto. |

### 3.2 Nhận Diện Chuỗi Phản Hồi Hết Cuốc (`isNoToolDialog`)

Theo yêu cầu chuẩn xác từ người dùng, chỉ bắt từ khóa `"hết cuốc"`:

```typescript
export function isNoToolDialog(text: string): boolean {
  return /hết cuốc/i.test(text);
}
```

Chuỗi thỏa điều kiện:
- Bất kỳ thông báo nào từ server có chứa cụm `"hết cuốc"` (không phân biệt hoa/thường).

### 3.3 Luồng Chuyển Đổi Về Auto Farm

```
[Khai thác: Gửi menuIndex 1] ──► Nhận RX -40 Dialog
                                        │
                                        ▼
                           isNoToolDialog(dialog)?
                           ├── Không: Tiếp tục chu trình khai thác
                           └── Có:
                                1. Cập nhật status = 'paused_no_tool'
                                2. runner.running = false
                                3. Gọi deps.onRequestStop?.('no_tool', dialog)
                                        │
                                        ▼
                            AvatarSession.onRequestStop
                                        │
                                        ▼
                     miningConfig.returnToFarm !== false?
                     ├── false: Dừng auto, ghi log tạm dừng.
                     └── true:
                          1. Ghi log "[khai thác] hết cuốc, chuyển sang auto farm."
                          2. Gọi switchAutomationMode({ desiredMode: 'auto_farm', ... })
                          3. Session tự động đưa nhân vật vào Nông Trại qua enterFarm
```

---

## 4. Verification Plan

1. **Unit Testing / Code Verification:**
   - Kiểm tra hàm `isNoToolDialog` với danh sách các mẫu câu thực tế và biên kiểm tra: gãy cuốc, hết cuốc, không có cuốc, cuốc hỏng, thiếu cuốc...
   - Kiểm tra luồng `onRequestStop` trong `autoMining.ts` khi gặp dialog thiếu cuốc.
   - Kiểm tra xử lý `onRequestStop` trong `avatarSession.ts` chuyển đổi sang `auto_farm`.
2. **Type Checking & Build:**
   - `npm run build` trên `avatar-web/server` (TypeScript clean, không có type error).
   - `npm run build` trên `avatar-web/web` (Vite build thành công).
