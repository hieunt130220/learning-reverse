# AvatarHD Maze Pathfinding & Auto Navigation Design

> **Ngày lập:** 2026-09-16  
> **Topic:** `maze-pathfinding`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Mê cung Map 28 trong Avatar HD mở vào 20h45 Thứ 3 và Thứ 5. Trong bản đồ, tường mê cung là vật cản không thể đi xuyên (`tile type = 4`), và các rương kho báu (`ItemMapSpecial`) nằm rải rác ở các ngóc ngách.

Hiện tại, công cụ `maze-probe.ts` đã bắt được danh sách rương tĩnh qua snapshot `RX 80`. Tuy nhiên, để tự động mở rương và nhặt quà, nhân vật cần:
1. Xác định vị trí xuất phát `(x, y)` từ gói `RX 80` (mặc định vào map là `57, 209`).
2. Tìm đường đi ngắn nhất (Pathfinding) tránh tường vật cản từ vị trí avatar tới vị trí rương mục tiêu.
3. Gửi chuỗi gói tin di chuyển **`TX 84`** (`ParkService.doMove`) theo lộ trình đường đi.
4. Khi đến gần rương (< 36px), tự động gửi **`TX 48`** mở rương, và nếu quà rơi sàn (`RX 47 subType 0`) thì tiếp tục bước tới nhặt bằng **`TX 47 subType 11`**.

---

## 2. Phạm Vi (Scope)

### In-Scope
- Module thuật toán tìm đường: `avatar-web/server/src/game/mazePathfinding.ts`.
- Lưới bản đồ Mê cung (Tile Grid 24×24 pixel, kích thước ma trận `wMap × hMap`).
- Tích hợp điều hướng vào `maze-probe.ts` qua cờ `--auto-navigate`:
  - Chọn rương gần nhất hoặc rương theo ID được chỉ định.
  - Tạo danh sách waypoints qua thuật toán A* / BFS.
  - Gửi `TX 84` nhịp nhàng (mỗi bước cách nhau 200–300ms mô phỏng bước đi tự nhiên).
  - Tự động kích hoạt mở rương `TX 48` và nhặt quà `TX 47`.

### Out-of-Scope
- Không can thiệp sang bản đồ Kim Tự Tháp Ai Cập (Map 33-44).
- Không can thiệp sang auto nông trại hoặc auto câu cá.
- Không tạo test files mới (tuân thủ nguyên tắc KHÔNG TDD trong `CLAUDE.md`).

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Giao Thức Mạng Di Chuyển & Nhặt Quà

| Hành động | Opcode | Chi tiết Payload |
|---|---|---|
| **Di chuyển Avatar** | **`TX 84`** | `[i16 x][i16 y][i8 direct]` (`0=Phải, 1=Xuống, 2=Trái, 3=Lên`) |
| **Broadcast vị trí người khác** | **`RX 84`** | `[i32 idPlayer][i16 x][i16 y][i8 direct]` |
| **Mở rương kho báu** | **`TX 48`** | `[i8 3][i32 idRương][i8 actionIndex 0]` |
| **Server xoá rương** | **`RX 48`** | `[i8 2][i32 idRương]` |
| **Vật phẩm rơi sàn** | **`RX 47 subType 0`** | `[i8 0][i8 typeDrop][i16 idDrop][i32 idGift][i32 idPlayer][i16 xDrop][i16 yDrop]` |
| **Nhặt quà rơi sàn** | **`TX 47 subType 11`** | `[i8 11][i32 idGift]` (`ParkService.doGift` @ `0x71C4EC`) |

### 3.2 Kiến Trúc Module `mazePathfinding.ts`

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface PathfindingResult {
  reachable: boolean;
  distance: number;
  waypoints: Point[];
}

export class MazeNavigator {
  /**
   * Tìm đường từ điểm A tới điểm B trên ma trận chướng ngại vật tile 24px.
   */
  findPath(start: Point, target: Point, collisionGrid: boolean[][]): PathfindingResult;

  /**
   * Tính hướng di chuyển (0=Right, 1=Down, 2=Left, 3=Up) giữa 2 điểm liền kề.
   */
  getDirection(from: Point, to: Point): number;
}
```

---

## 4. Verification Plan

1. **Kiểm tra biên dịch & tính toàn vẹn:**
   ```bash
   npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build
   ```
2. **Kiểm thử Pathfinding offline:**
   - Chạy script kiểm tra thuật toán A* với ma trận mê cung mẫu, xác nhận né tường và tìm ra đường đi ngắn nhất.
3. **Kiểm thử tích hợp trên `maze-probe.ts`:**
   - Chạy probe ngoài giờ mở cửa (xác nhận cờ `--auto-navigate` không gây lỗi crash khi map đóng).
   - Sẵn sàng kích hoạt tự động chạy vào 20h45 tối Thứ 5.
