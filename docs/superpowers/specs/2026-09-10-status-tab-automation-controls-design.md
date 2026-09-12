# Thiết Kế Bộ Điều Khiển Automation Tại Tab Trạng Thái

> **Ngày lập:** 2026-09-10
> **Trạng thái:** Chờ User Review (User Review Gate)

## 1. Mục Tiêu & Bối Cảnh

`StatusPanel` hiện chỉ có thể khởi động `auto_farm`, trong khi `FishingPanel` sở hữu một nút riêng để khởi động hoặc dừng `auto_fishing`. Hai đường điều khiển tách rời khiến người dùng không có một nơi duy nhất để chọn mode và có thể yêu cầu chuyển thẳng từ farm sang fishing mà không dừng mode hiện tại trước.

Thay đổi này tập trung quyền điều khiển automation tại tab **Trạng thái**:

- Luôn có đúng một lựa chọn cục bộ trong hai checkbox **Auto Farm** và **Auto Fishing**.
- Nút **Bắt đầu** khởi động mode đang chọn qua endpoint automation thống nhất.
- Nút **Dừng Auto** dừng toàn bộ automation.
- Khi bất kỳ automation nào đang được yêu cầu, đang chạy hoặc đang chuyển trạng thái, cả hai checkbox bị khóa cứng. Người dùng phải dừng automation trước khi đổi mode.
- Tab **Câu cá** tiếp tục hiển thị runtime câu cá từ snapshot dùng chung, kể cả khi câu cá được khởi động ở tab **Trạng thái**, nhưng không còn là một đường điều khiển mode thứ hai.

## 2. Phạm Vi

### 2.1. In-scope

- `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
  - Thêm hai checkbox single-choice và state mode được chọn.
  - Đổi nhãn nút thành **Bắt đầu** và **Dừng Auto**.
  - Gọi `POST /api/accounts/:id/automation/start` với `auto_farm` hoặc `auto_fishing` theo lựa chọn.
  - Gọi `POST /api/accounts/:id/automation/stop` để dừng.
  - Áp dụng chính xác các điều kiện disable và hiển thị tiến trình theo mode thực tế.
  - Chuyển snapshot trả về từ mutation lên owner chung để các panel cập nhật ngay.
- `avatar-web/web/src/accounts/panels/FishingPanel.tsx`
  - Giữ phần hiển thị trạng thái/runtime/nhiệm vụ câu cá.
  - Bỏ nút start/stop câu cá tại header để không còn đường chuyển mode trái với quy tắc khóa.
  - Cho phép `StatusPanel` dùng chung formatter trạng thái câu cá và bảo đảm formatter xét cả desired mode lẫn active mode.
- `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
  - Truyền callback cập nhật `AutomationSnapshot` dùng chung vào `StatusPanel`.
  - Không thay đổi cơ chế nhận snapshot từ REST/WebSocket hiện có.

### 2.2. Out-of-scope

- Không sửa backend, API routing, database, `GameClient`, vòng lặp farm/câu cá hoặc ML mini-game.
- Không thêm mode mới và không thay đổi contract `AutomationSnapshot`.
- Không thay đổi phần cấu hình **Đăng xuất sau khi chạy xong 1 vòng**.
- Không refactor layout, tab navigation hoặc các panel không liên quan.
- Không tạo hoặc chỉnh sửa file test theo ràng buộc của yêu cầu; verification dùng build và kiểm tra thủ công có mục tiêu.
- Không commit nếu chưa có yêu cầu/ủy quyền commit riêng.

## 3. Phương Án Đã Cân Nhắc

### 3.1. Khuyến nghị: điều khiển tập trung tại `StatusPanel`

`StatusPanel` sở hữu lựa chọn mode cục bộ và toàn bộ start/stop actions. `LoadedOperations` vẫn là owner của snapshot automation dùng chung; snapshot trả về từ start/stop được đẩy lên bằng callback. `FishingPanel` chỉ đọc snapshot và hiển thị runtime.

Ưu điểm: một nguồn điều khiển duy nhất, thực thi được quy tắc “dừng trước khi đổi mode”, thay đổi nhỏ và không cần state toàn cục mới. Đây là phương án được chọn.

### 3.2. Nâng lựa chọn mode lên `LoadedOperations`

Drawer có thể sở hữu cả snapshot lẫn mode được chọn rồi truyền xuống các panel. Cách này đồng bộ được mọi panel nhưng tạo state dùng chung không cần thiết vì chỉ `StatusPanel` được phép chọn mode.

### 3.3. Giữ nút điều khiển ở cả `StatusPanel` và `FishingPanel`

Cả hai panel có thể dùng chung busy state và cùng áp dụng điều kiện khóa. Tuy nhiên vẫn tồn tại hai nguồn hành động, tăng nguy cơ lệch nhãn/disable/error handling và làm mờ yêu cầu bộ điều khiển chung tại tab Trạng thái. Phương án này không được chọn.

## 4. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 4.1. Nguồn dữ liệu và quyền sở hữu state

`LoadedOperations` tiếp tục hợp nhất:

1. `snapshot.automation` đến từ runtime/WebSocket.
2. `fetchedAutomation` đến từ REST hoặc kết quả mutation.
3. Giá trị `automation = fetchedAutomation ?? snapshot?.automation` được truyền cho cả `StatusPanel` và `FishingPanel`.

`StatusPanel` bổ sung callback:

```ts
onAutomationChange?(snapshot: AutomationSnapshot): void;
```

Sau start/stop thành công, panel gọi callback với snapshot response trước khi yêu cầu `onChanged()` refresh dữ liệu. Với lỗi HTTP `409` có kèm `body.snapshot`, panel cũng cập nhật snapshot authoritative và refresh, giống cơ chế hiện có tại `FishingPanel`.

Không tạo automation store hoặc context mới.

### 4.2. Mode có thể chọn

State cục bộ chỉ nhận hai giá trị:

```ts
type StatusAutomationMode = 'auto_farm' | 'auto_fishing';
const [selectedMode, setSelectedMode] = useState<StatusAutomationMode>('auto_farm');
```

Quy tắc khởi tạo/đồng bộ:

1. Lần đầu render của một account, mặc định là `auto_farm`.
2. Khi snapshot cho biết automation đang active, đồng bộ checkbox theo `desiredMode` nếu đó là `auto_farm` hoặc `auto_fishing`; nếu desired là `off`, dùng `activeMode` nếu active là một trong hai mode này.
3. Khi snapshot chuyển về hoàn toàn `off` sau lệnh stop, giữ lựa chọn cuối cùng thay vì tự reset. Người dùng có thể giữ mode cũ hoặc chọn mode kia trước lần start kế tiếp.
4. Nếu mode đang active là `find_npc`, không ánh xạ nó thành farm/fishing. Lựa chọn cục bộ hiện có vẫn được giữ nhưng cả hai checkbox bị khóa; hint nêu automation đang chạy mode khác và người dùng chỉ có thể bấm **Dừng Auto**.
5. Hai checkbox là controlled inputs. Click checkbox nào sẽ đặt `selectedMode` thành mode đó; click lại checkbox đang chọn không tạo trạng thái “không chọn mode”. Vì vậy luôn có đúng một checkbox được chọn.

### 4.3. Xác định automation đang hoạt động

Giá trị duy nhất dùng cho strict lock:

```ts
const autoActive = Boolean(
  automation
  && (
    automation.desiredMode !== 'off'
    || automation.activeMode !== 'off'
    || automation.transitionState === 'switching'
  )
);
```

Không dùng riêng `farmStable` để quyết định quyền thao tác. Trạng thái legacy `auto.running` vẫn có thể được dùng để hiển thị tiến trình farm, nhưng không được dùng để cho phép chuyển trực tiếp giữa hai endpoint automation mới.

### 4.4. Ma trận disable

`mutationBusy` gồm `autoAction !== null` hoặc `automationMutationBusy` từ Drawer.

| Control | Enabled khi | Disabled khi |
|---|---|---|
| Checkbox Auto Farm | `!autoActive && !mutationBusy` | Auto active hoặc mutation đang gửi |
| Checkbox Auto Fishing | `!autoActive && !mutationBusy` | Auto active hoặc mutation đang gửi |
| Bắt đầu | `!autoActive && !mutationBusy` | Auto active hoặc mutation đang gửi |
| Dừng Auto | `autoActive && !mutationBusy` | Auto off hoặc mutation đang gửi |

`transitionState === 'switching'` đã làm `autoActive === true`. Vì vậy **Bắt đầu** và checkbox luôn bị khóa khi switching, còn **Dừng Auto** vẫn được phép để người dùng yêu cầu dừng tiến trình, miễn là không có request khác đang gửi. Không thêm điều kiện disable riêng chỉ vì switching cho nút stop.

### 4.5. Request flow

Khởi động:

```text
Người dùng chọn mode khi auto đang off
  → Bắt đầu
  → khóa checkbox và action bằng mutationBusy
  → POST /api/accounts/:id/automation/start
       body: { mode: selectedMode }
  → cập nhật snapshot dùng chung từ response
  → refresh account/automation
  → mở lại action theo snapshot mới
```

Dừng:

```text
autoActive === true
  → Dừng Auto
  → POST /api/accounts/:id/automation/stop body {}
  → cập nhật snapshot dùng chung từ response
  → refresh account/automation
  → khi snapshot hoàn toàn off, mở khóa hai checkbox và Bắt đầu
```

Status controls luôn dùng endpoint `/automation/start` và `/automation/stop`; nhánh fallback `/auto/start` và `/auto/stop` không còn được dùng tại `StatusPanel`, vì fallback không nhận mode `auto_fishing` và không đáp ứng contract mục tiêu.

### 4.6. Hint tiến trình

Mode đang thực thi để hiển thị tiến trình được xác định bằng `activeMode` nếu khác `off`; nếu chưa có active mode thì dùng `desiredMode`. Điều này tránh hiển thị tiến trình của mode đích quá sớm trong lúc switching.

- `auto_farm`: hiển thị vòng hiện tại từ `snap.auto.cycle`, trạng thái đang chạy/chờ vòng kế tiếp và `lastRun` như hiện tại.
- `auto_fishing`: hiển thị chuỗi tiếng Việt từ formatter dùng chung dựa trên `automation.fishingRuntime?.status` và trạng thái kết nối account.
- `switching`: bổ sung thông tin đang chuyển từ `activeMode` sang `desiredMode`.
- `find_npc` hoặc mode ngoài hai lựa chọn của Status controls: nêu rõ mode hiện tại và yêu cầu dừng trước khi chọn farm/fishing.
- `off`: nêu automation đang tắt.

Formatter câu cá trong `FishingPanel.tsx` được export để hai panel dùng cùng một mapping, tránh hai bộ diễn giải runtime bị lệch. `FishingPanel` gọi formatter với `isFishingDesired || isFishingActive`, nên trường hợp active vẫn là fishing trong lúc desired đã thay đổi vẫn phản ánh runtime câu cá chính xác.

### 4.7. Đồng bộ `FishingPanel`

Header `FishingPanel` giữ tiêu đề và dòng trạng thái nhưng bỏ nút **Bắt đầu câu cá / Dừng câu cá** cùng mutation handler tương ứng. Panel tiếp tục:

- Đọc `automation.desiredMode`, `automation.activeMode`, `automation.transitionState` và `automation.fishingRuntime` từ snapshot chung.
- Hiển thị trạng thái câu cá khi desired hoặc active mode là `auto_fishing`.
- Hiển thị “Đang chuyển chế độ…” khi switching.
- Giữ nguyên refresh quest, lỗi quest/runtime và toàn bộ nội dung nghiệp vụ còn lại.

Việc bỏ nút là cần thiết để người dùng không thể chuyển trực tiếp từ `auto_farm` sang `auto_fishing` qua tab Câu cá trong khi checkbox tại tab Trạng thái đang bị khóa.

## 5. Error Handling & Edge Cases

1. **Double click hoặc click chéo:** busy state được đặt trước khi gửi request; các checkbox và nút còn lại khóa đến khi request kết thúc.
2. **Snapshot đến trong lúc request:** `autoActive` được tính lại từ snapshot authoritative; lựa chọn được đồng bộ với desired/active mode nếu automation đang active.
3. **Start trả `409`:** nếu response chứa snapshot, cập nhật snapshot chung và refresh; không tự gửi request chuyển mode lần hai.
4. **Lỗi mạng/5xx:** hiển thị lỗi tại `StatusPanel`, giải phóng busy state; lựa chọn mode của người dùng được giữ để có thể thử lại.
5. **Stop khi switching:** cho phép gửi stop vì switching được coi là active; server tiếp tục là nơi tuần tự hóa state machine.
6. **Automation snapshot chưa tải:** mặc định chọn Auto Farm, cho phép gửi endpoint automation hiện hành; response/refresh sau đó cung cấp snapshot authoritative.
7. **Mode `find_npc` đang active:** khóa cả hai checkbox và nút start; chỉ cho phép stop, không tự chuyển sang farm/fishing.
8. **Desired và active khác nhau:** checkbox phản ánh desired mode có thể chọn, hint tiến trình phản ánh active mode và nêu chuyển đổi.

## 6. Files/Modules & Thay Đổi Dự Kiến

| File | Vai trò | Thay đổi dự kiến |
|---|---|---|
| `avatar-web/web/src/accounts/panels/StatusPanel.tsx` | Bộ điều khiển automation trung tâm | Mode state, checkbox, strict disable, start/stop endpoint, response/409 sync, hint theo farm/fishing |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Hiển thị runtime câu cá | Export formatter, xét desired hoặc active, bỏ mutation button/handler |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Owner snapshot dùng chung | Truyền `handleAutomationChange` vào `StatusPanel`; bỏ `automationSupported` state/prop và các setter chỉ phục vụ fallback cũ của Status, nhưng giữ callback capability cho `FindNpcPanel` bằng cách cập nhật/xóa `fetchedAutomation` trực tiếp |

Không có file production nào khác được sửa.

## 7. Verification Plan

### 7.1. Static checks

- Chạy `git diff --check` trên các file được phép.
- Chạy build client từ `avatar-web/web`:

```bash
npm run build
```

Kỳ vọng: `tsc -b` và Vite build hoàn tất, không có lỗi TypeScript/JSX.

### 7.2. Kiểm tra thủ công có mục tiêu

1. Khi snapshot off: Auto Farm được chọn mặc định; Auto Fishing không được chọn; checkbox và **Bắt đầu** enabled; **Dừng Auto** disabled.
2. Click Auto Fishing: Auto Fishing checked, Auto Farm unchecked.
3. Click **Bắt đầu**: network request là `POST /automation/start` với `{ mode: 'auto_fishing' }`; cả hai checkbox bị khóa ngay.
4. Mở tab Câu cá: trạng thái phản ánh `fishingRuntime.status` từ cùng snapshot, không có nút riêng để đổi mode.
5. Click **Dừng Auto**: network request là `POST /automation/stop`; sau snapshot off, checkbox mở khóa.
6. Chọn Auto Farm rồi start: request body là `{ mode: 'auto_farm' }`; hint hiển thị vòng farm.
7. Với desired/active khác `off` hoặc transition `switching`: cả hai checkbox và **Bắt đầu** đều disabled; **Dừng Auto** enabled nếu không có mutation đang gửi.
8. Với `find_npc` active: không thể chọn farm/fishing hoặc start; có thể stop.

### 7.3. GitNexus và phạm vi thay đổi

- Trước khi sửa production code, chạy lại `gitnexus_impact` cho mọi symbol thực tế sẽ sửa, gồm ít nhất `StatusPanel`, `startAuto`, `stopAuto`, `FishingPanel`, formatter trạng thái câu cá và `LoadedOperations`.
- Nếu có risk HIGH/CRITICAL, dừng và báo người dùng trước khi sửa.
- Trước mọi commit được user cho phép, chạy `gitnexus_detect_changes({ scope: 'staged' })` và xác nhận chỉ ba file production trong allowlist cùng tài liệu đã duyệt bị ảnh hưởng.

## 8. Acceptance Mapping

| Acceptance criterion | Thiết kế đáp ứng |
|---|---|
| Hai checkbox Auto Farm/Auto Fishing | State hai giá trị và controlled checkbox tại StatusPanel |
| Single-choice | Mọi click đặt một mode; không có trạng thái cả hai unchecked |
| Nhãn Bắt đầu/Dừng Auto | Hai action duy nhất tại StatusPanel |
| Payload đúng theo lựa chọn | `/automation/start` nhận `{ mode: selectedMode }` |
| Khóa checkbox khi active | `autoActive || mutationBusy` |
| Stop rồi mở khóa | Snapshot off làm `autoActive=false` |
| Hint farm/fishing đúng runtime | Chọn progress mode và formatter fishing dùng chung |
| FishingPanel đồng bộ | Đọc snapshot owner chung, callback cập nhật response ngay |
| Build không lỗi | `npm run build` tại `avatar-web/web` |

## 9. Quyết Định Chốt Cho Implementation Plan

- `StatusPanel` là nơi duy nhất start/stop `auto_farm` và `auto_fishing`.
- `FishingPanel` không giữ nút start/stop automation.
- Không cho chuyển mode bằng một lệnh start mới khi `autoActive`; bắt buộc stop trước.
- Checkbox bị khóa cả khi auto active lẫn khi mutation đang gửi.
- Stop được phép trong `switching` nếu không có request khác đang gửi.
- Snapshot mutation được đẩy ngay vào state dùng chung rồi mới refresh bổ sung.
- Không thêm/chỉnh test file; build và manual verification là bằng chứng nghiệm thu trong phạm vi yêu cầu.
