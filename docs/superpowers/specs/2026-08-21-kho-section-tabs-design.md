# Spec: Tách section Kho riêng với 2 tab — Nông sản / Vật phẩm & Hạt giống

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Trong `FarmSection` (`AssetsPanel.tsx`), dòng kho được hiển thị lẫn vào panel
  **Nông trại**: `kho: Xoài × 6 Thanh long × 6 ... #121 × 1 [làm mới kho] [tải bảng cây]`. Vừa
  lộn xộn, vừa không phân biệt được **nông sản** (sản phẩm thu hoạch: Xoài, Thanh long, Hoa tulip,
  Nho...) với **vật phẩm/hạt giống** (thuốc, thức ăn, hạt... như #121 Thuốc tiêu chảy).
- **Mục tiêu**:
  - **Bỏ** dòng kho khỏi `FarmSection`.
  - Tách thành **section `Kho` riêng** (1 thẻ card) có **2 tab**:
    - Tab **Nông sản**: các vật phẩm có id nằm trong bảng cây (`TreeInfo`) — nông sản thu hoạch.
    - Tab **Vật phẩm & Hạt giống**: các vật phẩm còn lại (tên lấy từ bảng vật phẩm `ItemInfo`).
  - Giữ 2 nút `làm mới kho` + `tải bảng cây` trong section Kho.

## Phạm vi (Scope)
- **In-scope**:
  - `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`: bỏ dòng kho trong `FarmSection`; thêm
    component `KhoSection` với 2 tab; thêm prop `items: ItemInfo[]` cho `AssetsPanel`.
  - `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`: truyền `items={snapshot?.items ?? []}`
    vào `AssetsPanel`.
  - Docs spec + plan.
- **Out-of-scope**:
  - Không đổi server, type, API, cách lấy inventory.
  - Không đổi `FarmSection` (lưới ô) ngoài việc bỏ dòng kho.
  - Không viết test mới (user không yêu cầu).

## Thiết kế kiến trúc & Giải pháp kỹ thuật
### 1. Phân loại inventory
- **Nông sản**: `id` có trong `trees` (bảng cây) — đúng với dữ liệu thật (Xoài, Thanh long,
  Hoa tulip, Nho là id cây trồng; chip hiện tại đã đặt tên qua `treeName`).
- **Vật phẩm & Hạt giống**: mọi id còn lại, tên lấy từ `items` (bảng vật phẩm), fallback `#id`
  (ví dụ `#121` = Thuốc tiêu chảy).

### 2. Component `KhoSection`
```tsx
type KhoTab = 'nong-san' | 'vat-pham';

function KhoSection({
  accountId,
  inventory,
  trees,
  items,
}: {
  accountId: number;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
}) {
  const [tab, setTab] = useState<KhoTab>('nong-san');
  const isProduce = (id: number) => trees.some((t) => t.id === id);
  const treeName = (id: number) => trees.find((t) => t.id === id)?.name ?? `#${id}`;
  const itemName = (id: number) => items.find((i) => i.id === id)?.name ?? treeName(id);
  const rows = tab === 'nong-san'
    ? inventory.filter((it) => isProduce(it.id))
    : inventory.filter((it) => !isProduce(it.id));
  const name = tab === 'nong-san' ? treeName : itemName;

  return (
    <section className="card">
      <h2>Kho</h2>
      <div className="tabs">
        <button type="button" className={tab === 'nong-san' ? 'tab active' : 'tab'}
          onClick={() => setTab('nong-san')}>Nông sản</button>
        <button type="button" className={tab === 'vat-pham' ? 'tab active' : 'tab'}
          onClick={() => setTab('vat-pham')}>Vật phẩm & Hạt giống</button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">trống</p>
      ) : (
        <div className="row">
          {rows.map((it) => (
            <span key={it.id} className="chip">{name(it.id)} × {it.num}</span>
          ))}
        </div>
      )}
      <div className="row">
        <button className="ghost" onClick={() => void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getInventory', args: [] })}>
          làm mới kho
        </button>
        <button className="ghost" onClick={() => void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getTreeInfo', args: [] })}>
          tải bảng cây
        </button>
      </div>
    </section>
  );
}
```
- Reuse class `tabs`/`tab`/`tab.active` (đã có sẵn trong `styles.css`, dùng ở `DebugPanel`).

### 3. Kết nối
- `AssetsPanel` nhận thêm `items: ItemInfo[]`, render:
  `<FarmSection … /> <KhoSection … /> <AnimalSection … />`
- `AccountOperationsDrawer` truyền `items={snapshot?.items ?? []}`.

## Verification Plan
- Chạy `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run` — không lỗi, 72/72 pass.
- Trên `http://localhost:5173/accounts/2`: panel Nông trại không còn dòng kho; có card **Kho**
  với 2 tab; tab Nông sản liệt kê Xoài/Thanh long/Hoa tulip/Nho; tab Vật phẩm & Hạt giống liệt kê
  #121... (tên nếu có); nút `làm mới kho`/`tải bảng cây` hoạt động.
