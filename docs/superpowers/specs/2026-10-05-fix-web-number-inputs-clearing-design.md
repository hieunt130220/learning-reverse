# Thiết kế sửa lỗi không xoá được chữ trên các ô input số (Web UI)

## 1. Mục tiêu & Bối cảnh
- **Vấn đề**: Hiện tại trên giao diện Web (`avatar-web`), người dùng không thể xoá sạch ký tự trong các ô input số (`type="number"`). Khi ấn phím Backspace để xoá ký tự cuối cùng, ô nhập liệu lập tức tự nhảy ngược về giá trị mặc định (như `1`, `8`, `19`, `30`) hoặc bị kẹt số `0` (không thể xoá số `0` để gõ số khác). Ngoài ra, một số ô không cho phép nhập số `0` do điều kiện `|| defaultValue`.
- **Nguyên nhân cốt lõi**:
  1. Sử dụng `parseInt(e.target.value, 10) || defaultVal` trực tiếp trong handler `onChange`: Khi xoá hết chữ, `e.target.value === ""` dẫn đến `parseInt` trả về `NaN`, kích hoạt fallback về `defaultVal` ngay lập tức. Nếu người dùng nhập số `0`, `0 || defaultVal` cũng kích hoạt fallback về `defaultVal`.
  2. Sử dụng `Number(e.target.value)` trực tiếp trong handler `onChange` gán vào state kiểu `number`: Khi xoá hết chữ, `Number("") === 0`, làm state chuyển thành `0`. Input nhận `value={0}` nên luôn hiển thị `0`, người dùng bấm xoá tiếp vẫn bị kẹt ở `0`.

## 2. Phạm vi (Scope)

### In-scope
Sửa toàn bộ 10 ô input bị ảnh hưởng trên 3 component:
1. **`FindNpcPanel.tsx` (5 ô input)**:
   - *Từ Map (`fromMap`)*: min 0, max 100, default 1.
   - *Đến Map (`toMap`)*: min 0, max 100, default 8.
   - *Từ Khu (`fromBoard`)*: min 0, max 50, default 0.
   - *Đến Khu (`toBoard`)*: min 0, max 50, default 19.
   - *Thời gian nghỉ giữa vòng quét (`cycleDelaySeconds`)*: min 5, max 3600, default 30.
2. **`FishingSettingsPanel.tsx` (3 ô input)**:
   - *Khu vực (`area`)*: min 0, max 15, default 0.
   - *Delay giữa các lần quăng (`delayMs`)*: min 1000, step 500, default 1000.
   - *Số lượng mồi mua (`baitQuantity`)*: min 1, max 200, default 50.
3. **`DebugPanel.tsx` (2 ô input)**:
   - *Tham số macro (`ActionRow args`)*: các đối số số học của macro action.
   - *Mã opcode (`Gói tự do cmd`)*: default 42.

### Out-of-scope
- Các ô input văn bản (email, password, search, tên NPC, invite code) đã xử lý đúng chuỗi rỗng `""`.
- Ô input trong `ShopPanel.tsx` và `AutoSellRulesEditor.tsx` đã dùng state kiểu `string` nên không bị lỗi này.
- Backend API validation không đổi.

### Edge Cases
1. **Người dùng xoá sạch ô input**: Ô input hiển thị rỗng `""`, con trỏ nhấp nháy, không bị kẹt `0` hay nhảy số.
2. **Người dùng nhập số `0`**: Chấp nhận giá trị `0` nếu nằm trong dải hợp lệ (ví dụ: `fromBoard=0`, `fromMap=0`, `area=0`).
3. **Người dùng rời ô input (`onBlur`) khi đang để trống**: Tự động khôi phục về giá trị mặc định hợp lệ hoặc clamp giá trị trong khoảng `[min, max]`.
4. **Submit / Lưu khi có ô đang để trống**: Chuẩn hoá (sanitize) về giá trị mặc định hợp lệ trước khi gửi API để không phát sinh request lỗi.

---

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### Nguyên tắc thiết kế
- Cho phép state của các trường số lưu trữ giá trị `number | ''` trong quá trình người dùng đang nhập liệu.
- `onChange`:
  - Nếu `e.target.value === ''`, set state thành `''`.
  - Nếu có giá trị, parse số nguyên / số thực: nếu là số hợp lệ (`!isNaN`), set state thành số đó.
- `onBlur`:
  - Kiểm tra nếu giá trị là `''` hoặc `isNaN`, fallback về giá trị mặc định.
  - Áp dụng clamp `Math.max(min, Math.min(max, value))` để đảm bảo giá trị hợp lệ khi rời ô.
- Khi Lưu (Save / Submit):
  - Sanitize toàn bộ các trường `''` về giá trị mặc định trước khi đóng gói payload API.

### Chi tiết thay đổi từng file

#### 1. `FindNpcPanel.tsx`
- Type `FindNpcDraft`: mở rộng numeric fields cho phép `number | ''`.
  ```ts
  type FindNpcDraft = Omit<FindNpcConfig, 'fromMap' | 'toMap' | 'fromBoard' | 'toBoard' | 'cycleDelaySeconds'> & {
    fromMap?: number | '';
    toMap?: number | '';
    fromBoard?: number | '';
    toBoard?: number | '';
    cycleDelaySeconds?: number | '';
  };
  ```
- Handler chung cho number input:
  ```ts
  const handleNumberChange = (field: keyof FindNpcDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraft((prev) => ({
      ...prev,
      [field]: val === '' ? '' : parseInt(val, 10),
    }));
  };
  const handleNumberBlur = (field: keyof FindNpcDraft, defaultVal: number, min: number, max: number) => () => {
    setDraft((prev) => {
      const cur = prev[field];
      const num = typeof cur === 'number' && !isNaN(cur) ? cur : defaultVal;
      return {
        ...prev,
        [field]: Math.max(min, Math.min(max, num)),
      };
    });
  };
  ```
- Cập nhật hàm `save()`: Sanitize `fromMap`, `toMap`, `fromBoard`, `toBoard`, `cycleDelaySeconds` sang `number` trước khi gửi lên `apiPut`.
- Cập nhật `isConfigEqual()`: So sánh an toàn khi field có thể là `''`.

#### 2. `FishingSettingsPanel.tsx`
- Thay đổi kiểu state:
  ```ts
  const [area, setArea] = useState<number | ''>(initialConfig.area ?? DEFAULT_FISHING_CONFIG.area);
  const [delayMs, setDelayMs] = useState<number | ''>(initialConfig.castDelayMs ?? DEFAULT_FISHING_CONFIG.castDelayMs);
  const [baitQuantity, setBaitQuantity] = useState<number | ''>(initialConfig.baitQuantity ?? DEFAULT_FISHING_CONFIG.baitQuantity);
  ```
- Bổ sung `onBlur` và cập nhật `onChange`:
  - `onChange`: nếu `e.target.value === ''` thì set `''`, ngược lại `parseInt(e.target.value, 10)`.
  - `onBlur`:
    - `area`: nếu `''` về default `0`, clamp `[0, 15]`.
    - `delayMs`: nếu `''` về default `1000`, clamp `min: 1000`.
    - `baitQuantity`: nếu `''` về default `50`, clamp `[1, 200]`.
- Cập nhật `handleSaveConfig`: normalize sang kiểu `number` trước khi gửi API.

#### 3. `DebugPanel.tsx`
- Trong `ActionRow`:
  - Đổi state `args`: `useState<(number | '')[]>`.
  - `onChange`: `next[i] = e.target.value === '' ? '' : Number(e.target.value)`.
  - `onBlur`: nếu `args[i] === ''`, khôi phục về `def.args[i]?.default ?? 0`.
  - Khi chạy action: convert `args` thành `number[]` (`v === '' ? def : Number(v)`).
- Trong `FreePacketSection` (gói tự do):
  - Đổi state `cmd`: `useState<number | ''>(42)`.
  - `onChange`: `e.target.value === '' ? '' : Number(e.target.value)`.
  - `onBlur`: nếu `cmd === ''`, khôi phục về `42`.
  - Khi gửi: lấy `cmd === '' ? 42 : Number(cmd)`.

---

## 4. Verification Plan

### Manual Verification
1. Chạy frontend dev server hoặc kiểm tra build: `npm run build` trong thư mục `avatar-web/web`.
2. Mở tab FindNpc:
   - Click vào ô "Từ Map", bấm Backspace xoá hết -> Ô phải rỗng hoàn toàn, không tự nhảy số.
   - Nhập `0` -> Ô hiển thị đúng `0`.
   - Click ra ngoài -> Nếu ô rỗng thì khôi phục về default `1`.
   - Lặp lại cho "Đến Map", "Từ Khu", "Đến Khu", "Thời gian nghỉ".
3. Mở tab Cài đặt Câu cá:
   - Xoá hết ô "Khu vực" -> Ô rỗng, không bị kẹt số `0`.
   - Xoá hết ô "Delay" và "Số lượng mồi" -> Ô rỗng.
   - Click ra ngoài -> Khôi phục về dải hợp lệ.
4. Mở tab Debug:
   - Thử xoá hết ô input cmd và các tham số macro -> Ô rỗng, không tự reset.
