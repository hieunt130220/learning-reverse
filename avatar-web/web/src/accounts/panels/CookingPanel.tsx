import { useState } from 'react';

import type { AnimalInfo, CookingState, FoodRecipe, InventoryItem, ItemInfo, TreeInfo } from '../../types.js';

// Danh sách catalog mặc định khi chưa nhận được gói từ server (35 món chuẩn)
const FALLBACK_RECIPES: FoodRecipe[] = [
  { id: 1, name: 'Bánh Trứng', productID: 116, cookTimeMinutes: 60, level: 2, iconId: 205, materials: [{ itemId: 6, count: 5 }, { itemId: 50, count: 5 }] },
  { id: 2, name: 'Bánh sữa', productID: 119, cookTimeMinutes: 90, level: 2, iconId: 206, materials: [{ itemId: 6, count: 5 }, { itemId: 51, count: 5 }] },
  { id: 3, name: 'Cơm', productID: 118, cookTimeMinutes: 30, level: 1, iconId: 207, materials: [{ itemId: 6, count: 5 }] },
  { id: 4, name: 'Cơm Trứng', productID: 117, cookTimeMinutes: 60, level: 1, iconId: 208, materials: [{ itemId: 6, count: 5 }, { itemId: 50, count: 2 }] },
  { id: 5, name: 'Cơm Cà rốt', productID: 125, cookTimeMinutes: 60, level: 1, iconId: 209, materials: [{ itemId: 6, count: 5 }, { itemId: 1, count: 5 }] },
  { id: 6, name: 'Nước ép trái cây', productID: 126, cookTimeMinutes: 60, level: 1, iconId: 210, materials: [{ itemId: 7, count: 10 }, { itemId: 51, count: 5 }] },
  { id: 7, name: 'Gỏi Xoài', productID: 127, cookTimeMinutes: 60, level: 1, iconId: 211, materials: [{ itemId: 10, count: 5 }, { itemId: 44, count: 2 }] },
  { id: 8, name: 'Sữa Chua', productID: 128, cookTimeMinutes: 60, level: 1, iconId: 212, materials: [{ itemId: 51, count: 5 }] },
  { id: 9, name: 'Trái cây dầm', productID: 129, cookTimeMinutes: 90, level: 2, iconId: 213, materials: [{ itemId: 35, count: 5 }, { itemId: 51, count: 5 }] },
  { id: 10, name: 'Tinh dầu hướng dương', productID: 136, cookTimeMinutes: 90, level: 2, iconId: 214, materials: [{ itemId: 5, count: 10 }] },
  { id: 11, name: 'Nước Hoa', productID: 137, cookTimeMinutes: 120, level: 2, iconId: 216, materials: [{ itemId: 4, count: 10 }, { itemId: 5, count: 5 }] },
  { id: 12, name: 'Sữa Chua Trái Cây', productID: 138, cookTimeMinutes: 120, level: 2, iconId: 217, materials: [{ itemId: 128, count: 5 }, { itemId: 35, count: 5 }] },
  { id: 13, name: 'Trái cây dĩa', productID: 139, cookTimeMinutes: 90, level: 2, iconId: 218, materials: [{ itemId: 10, count: 5 }, { itemId: 7, count: 5 }] },
  { id: 14, name: 'Kem Tươi', productID: 140, cookTimeMinutes: 90, level: 2, iconId: 262, materials: [{ itemId: 51, count: 5 }, { itemId: 50, count: 5 }] },
  { id: 15, name: 'Trái Cây Ly', productID: 141, cookTimeMinutes: 90, level: 2, iconId: 219, materials: [{ itemId: 35, count: 5 }, { itemId: 10, count: 5 }] },
  { id: 16, name: 'Nước ép dưa hấu', productID: 142, cookTimeMinutes: 60, level: 1, iconId: 272, materials: [{ itemId: 7, count: 10 }] },
  { id: 17, name: 'Phô Mai', productID: 143, cookTimeMinutes: 120, level: 2, iconId: 273, materials: [{ itemId: 51, count: 10 }] },
  { id: 18, name: 'Khoai Tây Chiên', productID: 144, cookTimeMinutes: 90, level: 2, iconId: 274, materials: [{ itemId: 43, count: 10 }] },
  { id: 19, name: 'Bắp Chiên Bơ', productID: 145, cookTimeMinutes: 90, level: 2, iconId: 275, materials: [{ itemId: 37, count: 10 }] },
  { id: 20, name: 'Tương Cà Chua', productID: 146, cookTimeMinutes: 90, level: 2, iconId: 281, materials: [{ itemId: 0, count: 10 }] },
  { id: 21, name: 'Tương ớt', productID: 147, cookTimeMinutes: 90, level: 2, iconId: 287, materials: [{ itemId: 44, count: 10 }] },
  { id: 22, name: 'Heo quay ngũ vị', productID: 284, cookTimeMinutes: 120, level: 1, iconId: 284, materials: [{ itemId: 282, count: 3 }, { itemId: 286, count: 500 }, { itemId: 6, count: 2000 }] },
  { id: 23, name: 'Cá chép om dưa', productID: 285, cookTimeMinutes: 120, level: 1, iconId: 285, materials: [{ itemId: 283, count: 1 }, { itemId: 286, count: 1000 }, { itemId: 0, count: 5000 }] },
  { id: 24, name: 'Gà Luộc', productID: 277, cookTimeMinutes: 30, level: 1, iconId: 277, materials: [{ itemId: 276, count: 1 }] },
  { id: 25, name: 'Gà bó xôi', productID: 278, cookTimeMinutes: 90, level: 1, iconId: 278, materials: [{ itemId: 277, count: 1 }, { itemId: 50, count: 500 }, { itemId: 6, count: 3000 }] },
  { id: 26, name: 'Baba om chuối', productID: 280, cookTimeMinutes: 90, level: 1, iconId: 280, materials: [{ itemId: 279, count: 1 }, { itemId: 249, count: 1000 }, { itemId: 286, count: 1000 }] },
  { id: 27, name: 'Tinh Thể Dưa Hấu', productID: 290, cookTimeMinutes: 1440, level: 1, iconId: 290, materials: [{ itemId: 272, count: 10 }] },
  { id: 28, name: 'Gà Đóng Hộp', productID: 291, cookTimeMinutes: 1440, level: 1, iconId: 291, materials: [{ itemId: 277, count: 20 }] },
  { id: 29, name: 'Bánh Xèo', productID: 256, cookTimeMinutes: 120, level: 6, iconId: 256, materials: [{ itemId: 282, count: 10 }, { itemId: 50, count: 800 }, { itemId: 6, count: 3000 }] },
  { id: 30, name: 'Trà Hoa Cúc', productID: 292, cookTimeMinutes: 90, level: 1, iconId: 292, materials: [{ itemId: 266, count: 1000 }, { itemId: 289, count: 500 }] },
  { id: 31, name: 'Thịt Trâu Gác Bếp', productID: 296, cookTimeMinutes: 90, level: 2, iconId: 296, materials: [{ itemId: 295, count: 3 }] },
  { id: 32, name: 'Vịt Quay Lá Mắc Mật', productID: 298, cookTimeMinutes: 120, level: 4, iconId: 298, materials: [{ itemId: 297, count: 3 }, { itemId: 286, count: 500 }, { itemId: 6, count: 2000 }, { itemId: 204, count: 1000 }] },
  { id: 33, name: 'Mì Ramen Thượng Hạng', productID: 299, cookTimeMinutes: 120, level: 4, iconId: 299, materials: [{ itemId: 6, count: 1000 }, { itemId: 50, count: 500 }, { itemId: 51, count: 200 }, { itemId: 282, count: 2 }] },
  { id: 34, name: 'Khoai tây đóng hộp', productID: 300, cookTimeMinutes: 1440, level: 1, iconId: 300, materials: [{ itemId: 271, count: 2000 }] },
  { id: 35, name: 'Thịt Kho Trứng', productID: 302, cookTimeMinutes: 180, level: 7, iconId: 302, materials: [{ itemId: 301, count: 1000 }, { itemId: 282, count: 5 }, { itemId: 50, count: 500 }, { itemId: 212, count: 5 }] },
];

export const ANIMAL_PRODUCT_NAMES: Record<number, string> = {
  50: 'Trứng gà',
  51: 'Sữa bò',
  52: 'Thịt heo',
  54: 'Cá chép',
  55: 'Thịt vịt',
  57: 'Thịt trâu',
  59: 'Thịt ba ba',
};

export function CookingPanel({
  cooking,
  foods,
  items,
  trees,
  animals,
  produce,
  cookingMaterials,
}: {
  cooking?: CookingState;
  foods?: FoodRecipe[];
  items: ItemInfo[];
  trees: TreeInfo[];
  animals: AnimalInfo[];
  /** Nông sản thu được (Cmd70 section 3) — chứa Trứng gà #50, Sữa bò #51... */
  produce?: InventoryItem[];
  /** Nguyên liệu đặc biệt cho bếp (Cmd70 section 4) — gà nguyên con, mai rùa... */
  cookingMaterials?: InventoryItem[];
}) {
  const [showRecipes, setShowRecipes] = useState(false);

  // Ưu tiên catalog động từ Cmd76 (có khi có session live). Khi chưa load
  // (tài khoản idle / chưa kết nối), dùng FALLBACK_RECIPES để UI vẫn hiển thị
  // danh sách món thay vì trắng hoàn toàn.
  const recipeCatalog = foods && foods.length > 0 ? foods : FALLBACK_RECIPES;
  const materialCountMap = new Map<number, number>();
  // Nguyên liệu bếp chỉ đến từ nông sản section 3 và vật phẩm đặc biệt section 4.
  // Không lấy inventory vì section 1 chứa hạt có ID trùng nông sản (vd. #4 Nho).
  for (const item of [...(produce ?? []), ...(cookingMaterials ?? [])]) {
    materialCountMap.set(item.id, (materialCountMap.get(item.id) ?? 0) + item.num);
  }
  const itemNames = new Map<number, string>();
  for (const item of items) itemNames.set(item.id, item.name);
  for (const tree of trees) itemNames.set(tree.id, tree.name);
  for (const animal of animals) itemNames.set(animal.id, animal.name);
  for (const [id, name] of Object.entries(ANIMAL_PRODUCT_NAMES)) itemNames.set(Number(id), name);

  const recipeName = (id: number) => recipeCatalog.find((r) => r.id === id)?.name ?? `Món #${id}`;

  const formatSeconds = (sec: number) => {
    if (sec <= 0) return 'Đã chín';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}p`;
    }
    return `${m}p ${s}s`;
  };

  const slots = cooking?.slots ?? [];
  const missions = cooking?.missions ?? [];

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bếp nấu ăn</h2>
        <button type="button" className="ghost" onClick={() => setShowRecipes(!showRecipes)}>
          {showRecipes ? 'Ẩn công thức' : 'Xem công thức'}
        </button>
      </div>

      <p className="hint">
        {cooking ? `${cooking.numSlot} ô bếp · ${slots.filter((s) => s.idFood !== -1).length} ô đang nấu · ${slots.filter((s) => s.isDone).length} ô chín` : 'Chưa có thông tin bếp'}
      </p>
      {recipeCatalog.length === 0 && (
        <p className="hint">Đang chờ dữ liệu công thức từ máy chủ (Cmd 76).</p>
      )}

      {/* Lưới các ô bếp — chỉ hiển thị trạng thái */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', margin: '0.75rem 0' }}>
        {slots.map((slot) => {
          const isEmpty = slot.idFood === -1;
          const isDone = slot.isDone || (!isEmpty && slot.remainTime <= 0);
          return (
            <div
              key={slot.slot}
              style={{
                border: '1px solid var(--color-border, #ccc)',
                borderRadius: '6px',
                padding: '0.5rem',
                backgroundColor: isDone ? 'rgba(76, 175, 80, 0.1)' : isEmpty ? 'transparent' : 'rgba(33, 150, 243, 0.05)',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Ô #{slot.slot + 1}</div>
              {isEmpty ? (
                <div style={{ color: 'var(--color-muted, #888)', margin: '0.35rem 0' }}>Trống</div>
              ) : (
                <>
                  <div style={{ fontSize: '0.9rem', margin: '0.2rem 0', fontWeight: 500 }}>
                    {recipeName(slot.idFood)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: isDone ? 'green' : 'var(--color-muted, #666)' }}>
                    {formatSeconds(slot.remainTime)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Bảng công thức và nguyên liệu */}
      {showRecipes && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border, #eee)', paddingTop: '0.75rem' }}>
          <h3>Bảng công thức món ăn</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {recipeCatalog.map((r) => {
              const materialsStatus = r.materials.map((m) => {
                const countInBag = materialCountMap.get(m.itemId) ?? 0;
                const ok = countInBag >= m.count;
                return { ...m, countInBag, ok };
              });

              return (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--color-border, #ddd)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {r.icon && (
                        <img
                          src={r.icon}
                          alt=""
                          style={{ width: 28, height: 28, objectFit: 'contain' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <span>{r.name}</span>
                    </span>
                    <span className="hint">Lv.{r.level} · {r.cookTimeMinutes} phút</span>
                  </div>
                  <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {materialsStatus.map((m, idx) => (
                      <span
                        key={idx}
                        style={{
                          color: m.ok ? 'inherit' : 'red',
                          fontSize: '0.8rem',
                          background: m.ok ? 'rgba(0,0,0,0.03)' : 'rgba(255,0,0,0.08)',
                          padding: '0.1rem 0.3rem',
                          borderRadius: '3px',
                        }}
                      >
                        {(() => {
                          const name = itemNames.get(m.itemId);
                          return name ? `${name} #${m.itemId}:` : `#${m.itemId}:`;
                        })()} {m.countInBag}/{m.count}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nhiệm vụ mở ô bếp Master — chỉ hiển thị tiến độ */}
      {missions.length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border, #eee)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Nhiệm vụ mở ô Master</h3>
            {cooking?.isUnlocked && <span style={{ color: 'green', fontWeight: 'bold' }}>Đã mở khóa</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
            {missions.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{recipeName(m.idFood)}:</span>
                <span style={{ color: m.isDone ? 'green' : 'inherit', fontWeight: m.isDone ? 'bold' : 'normal' }}>
                  {m.numCook} / {m.numNeed} {m.isDone ? '✓' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
