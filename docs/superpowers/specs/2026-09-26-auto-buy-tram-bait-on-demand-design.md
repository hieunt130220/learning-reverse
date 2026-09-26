# Thiết Kế Tự Động Mua Mồi Cá Trâm Khi Server Yêu Cầu (On-Demand Tram Bait Purchase)

> **Ngày lập:** 2026-09-26  
> **Trạng thái:** Đã tự duyệt (User phê duyệt trước: "tự duyệt và hoàn thành công việc, không cần tôi xác nhận lại")  
> **Tác giả:** Claude Fable 5 & Devios  

---

## 1. Mục Tiêu & Bối Cảnh (Goal & Context)

### 1.1. Hiện trạng & Triệu chứng lỗi
Khi bot câu cá (ở chế độ `auto_fishing` hoặc `auto_fisherman_quest`) di chuyển vào khu vực câu cá đặc thù như Bến tàu (Map 27) hoặc các khu vực yêu cầu mồi đặc thù, nếu bot đang sử dụng mồi khác (ví dụ: Mồi cơm 443, Mồi trùng 447, Trứng kiến 448) hoặc cấu hình không tự mua mồi (`baitType: 0`), server sẽ từ chối bắt đầu câu với dialog:
```text
11:37:15 [câu cá] Server từ chối bắt đầu câu: Bạn cần sử dụng mồi câu cá trâm để câu cá trong khu vực này
```

Khi gặp lỗi này, logic hiện tại trong `avatarSession.ts`:
1. Phát hiện lỗi có từ khóa `'mồi'` -> gán `missingType = 'bait'`.
2. Gọi `executeParkPurchase(client, epoch, signal, 'bait')`.
3. Trong `executeParkPurchase`, code chỉ đọc `cfg.baitType` từ cấu hình hiện tại (`this.fishingConfig.config.baitType`):
   - Nếu `cfg.baitType <= 0` ("Không tự mua"), bot dừng ngay lập tức với lỗi: `Thiếu mồi câu nhưng cấu hình Không tự mua mồi — Dừng câu`.
   - Nếu `cfg.baitType > 0` (ví dụ Mồi cơm 443), bot di chuyển về Khu sinh thái (Map 13) và mua Mồi cơm!
   - Sau khi mua Mồi cơm xong, bot quay lại hồ câu mục tiêu và gửi lại `startFishing()`.
   - Server tiếp tục từ chối: `"Bạn cần sử dụng mồi câu cá trâm để câu cá trong khu vực này"`.
   - Vì `consecutiveFailures >= 1` (đã mua 1 lần mà vẫn bị từ chối cùng loại), bot dừng hoàn toàn với lỗi:
     `[câu cá] Dừng câu: Đã mua bait nhưng server vẫn từ chối: Bạn cần sử dụng mồi câu cá trâm để câu cá trong khu vực này`.

### 1.2. Yêu cầu của người dùng
> "Khi gặp lỗi yêu cầu mua mồi cá trâm thì phải mua mồi cá trâm dù đang config là loại mồi khác"

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-scope
1. **Phát hiện yêu cầu mồi câu cụ thể từ phản hồi Server**:
   - Thêm hàm phân tích nội dung thông báo lỗi từ server (`detectRequiredBaitId`), nhận diện chuỗi `"cá trâm"`, `"mồi câu cá trâm"`, `"mồi cá trâm"` để map về item ID `4875` (`Mồi câu cá trâm` trong `FISHING_BAITS`).
   - Mở rộng để nhận diện các loại mồi khác nếu server trả về cụ thể (Mồi cơm 443, Mồi trùng 447, Trứng kiến 448).
2. **Nâng cấp `executeParkPurchase`**:
   - Hỗ trợ tham số `overrideBaitId?: number`.
   - Khi có `overrideBaitId`, bỏ qua kiểm tra `cfg.baitType <= 0` và ưu tiên mua loại mồi được yêu cầu với số lượng cấu hình (`baitQuantity`, mặc định 50).
   - Log rõ ràng việc chuyển đổi loại mồi theo yêu cầu của server.
   - Sau khi mua thành công, cập nhật `this.fishingConfig.config.baitType` sang `overrideBaitId` và gọi `emitAutomation()` để đồng bộ trạng thái lên Web UI và hỗ trợ các lượt mua tự động tiếp theo khi hết mồi trong lúc quăng cần.
3. **Cập nhật các điểm gọi trong `startFishingSession` và `runFishingLoop`**:
   - Trong `startFishingSession`: trích xuất `requiredBaitId` khi `startResult.iss === false`, truyền vào `executeParkPurchase`.
   - Cải tiến `lastMissingKey`: phân biệt theo `bait:${targetBaitId}` thay vì chỉ theo `missingType: 'bait'`, giúp reset `consecutiveFailures` nếu đổi loại mồi cần mua, tránh bị dừng oan do `consecutiveFailures >= 1`.
   - Trong `runFishingLoop`: trích xuất `castRequiredBaitId` khi `castErrText` chứa lỗi mồi câu trong lúc quăng cần.

### Out-of-scope
- Không thay đổi bảng dữ liệu `FISHING_BAITS` trong `automationTypes.ts` (ID 4875 đã tồn tại chuẩn).
- Không can thiệp vào opcode hay mini-game giật cần.

---

## 3. Thiết Kế Kiến Trúc & Kỹ Thuật (Architecture & Technical Design)

### 3.1. Phân loại mồi câu trong hệ thống
Từ `avatar-web/server/src/session/automationTypes.ts`:
```typescript
export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
  { id: 4875, name: 'Mồi câu cá trâm', cost: '50 xu / mồi', typeMoney: 1 },
]);
```

### 3.2. Helper trích xuất ID mồi câu từ lỗi Server
```typescript
function detectRequiredBaitId(reason: string): number | null {
  const lower = reason.toLowerCase();
  if (lower.includes('cá trâm') || lower.includes('mồi câu cá trâm') || lower.includes('mồi cá trâm')) {
    return 4875; // Mồi câu cá trâm
  }
  if (lower.includes('trứng kiến')) {
    return 448; // Trứng kiến
  }
  if (lower.includes('mồi trùng') || lower.includes('trùng')) {
    return 447; // Mồi trùng
  }
  if (lower.includes('mồi cơm')) {
    return 443; // Mồi cơm
  }
  return null;
}
```

### 3.3. Xử lý trong `executeParkPurchase`
```typescript
private async executeParkPurchase(
  client: GameClient,
  epoch: number,
  signal: AbortSignal,
  missingType: 'ticket' | 'rod' | 'bait',
  overrideBaitId?: number,
): Promise<boolean> {
  ...
  } else if (missingType === 'bait') {
    const targetBaitId = overrideBaitId ?? cfg.baitType;
    if (targetBaitId <= 0) {
      const msg = 'Thiếu mồi câu nhưng cấu hình Không tự mua mồi';
      this.pushLog(`[câu cá] ${msg} — Dừng câu`);
      this.fishingRuntime.lastError = msg;
      return false;
    }
    const bait = FISHING_BAITS.find((b) => b.id === targetBaitId);
    if (!bait) {
      const msg = `Không tìm thấy loại mồi câu ID ${targetBaitId}`;
      this.pushLog(`[câu cá] ${msg} — Dừng câu`);
      this.fishingRuntime.lastError = msg;
      return false;
    }
    const quantity = Math.max(1, Math.min(cfg.baitQuantity || 50, 999));
    if (overrideBaitId && overrideBaitId !== cfg.baitType) {
      const currentBaitName = FISHING_BAITS.find((b) => b.id === cfg.baitType)?.name ?? `ID ${cfg.baitType}`;
      this.pushLog(`[câu cá] Server yêu cầu ${bait.name} (cấu hình hiện tại: ${currentBaitName}) — tự động chuyển sang mua ${bait.name} (×${quantity})…`);
    } else {
      this.pushLog(`[câu cá] Đang di chuyển sang Khu sinh thái (Map 13) để mua ${bait.name} (×${quantity})…`);
    }
  ...
  // Khi gửi mua thành công:
  this.pushLog(`[câu cá] Đã mua thành công ${bait.name} (x${quantity})`);
  if (overrideBaitId && this.fishingConfig.config.baitType !== overrideBaitId) {
    this.fishingConfig = {
      ...this.fishingConfig,
      config: {
        ...this.fishingConfig.config,
        baitType: overrideBaitId,
        baitQuantity: quantity,
      },
    };
    this.emitAutomation();
    this.pushLog(`[câu cá] Đã đồng bộ cấu hình mồi câu sang: ${bait.name}`);
  }
}
```

### 3.4. Xử lý trong `startFishingSession`
```typescript
let missingType: 'ticket' | 'rod' | 'bait' | null = null;
let requiredBaitId: number | null = null;

if (isMissingFishingTicketDialog(errText)) {
  missingType = 'ticket';
  this.pushLog(`[câu cá] Server từ chối vì thiếu vé câu: "${reason}"`);
} else if (errText.includes('mồi') || errText.includes('cá trâm')) {
  missingType = 'bait';
  requiredBaitId = detectRequiredBaitId(errText);
} else if (...) {
  missingType = 'rod';
}

if (missingType) {
  const missingKey = missingType === 'bait'
    ? `bait:${requiredBaitId ?? this.fishingConfig.config.baitType}`
    : missingType;

  if (missingKey !== lastMissingKey) {
    lastMissingKey = missingKey;
    consecutiveFailures = 0;
  }

  if (consecutiveFailures >= 1) {
    this.fishingRuntime.status = 'rejected';
    this.fishingRuntime.lastError = `Đã mua ${missingType} nhưng server vẫn từ chối: ${reason}`;
    this.pushLog(`[câu cá] Dừng câu: ${this.fishingRuntime.lastError}`);
    this.emitAutomation();
    return false;
  }

  const bought = await this.executeParkPurchase(
    client,
    epoch,
    signal,
    missingType,
    requiredBaitId ?? undefined,
  );
  if (bought) {
    consecutiveFailures++;
    continue;
  } ...
}
```

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

1. **Kiểm tra biên dịch tĩnh (Build check)**:
   - Chạy `npm run build` trong thư mục `avatar-web/server`.
   - Đảm bảo 0 lỗi TypeScript, 0 cảnh báo.
2. **Kiểm tra phân tích đồ thị GitNexus**:
   - Chạy `gitnexus_impact` trước khi sửa code.
   - Chạy `gitnexus_detect_changes` trước khi commit.
3. **Kiểm thử logic**:
   - Kiểm tra các mẫu chuỗi lỗi: `"Bạn cần sử dụng mồi câu cá trâm để câu cá trong khu vực này"` trích xuất đúng ID `4875`.
   - Kiểm tra `executeParkPurchase` xử lý đúng khi `cfg.baitType = 0` hoặc `443` nhưng `overrideBaitId = 4875`.
