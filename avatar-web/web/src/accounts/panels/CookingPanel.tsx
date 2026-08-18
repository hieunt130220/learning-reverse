import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { CookingState, FoodRecipe, InventoryItem } from '../../types.js';

// Danh sách catalog mặc định đồng bộ khi chưa nhận được gói từ server
const FALLBACK_RECIPES: FoodRecipe[] = [
  { id: 0, name: 'Cơm', productID: 118, cookTimeMinutes: 30, level: 1, materials: [{ itemId: 6, count: 5 }] },
  { id: 1, name: 'Cơm trứng', productID: 117, cookTimeMinutes: 60, level: 1, materials: [{ itemId: 6, count: 5 }, { itemId: 50, count: 2 }] },
  { id: 2, name: 'Bánh trứng', productID: 116, cookTimeMinutes: 60, level: 2, materials: [{ itemId: 6, count: 5 }, { itemId: 50, count: 5 }] },
  { id: 3, name: 'Bánh sữa', productID: 119, cookTimeMinutes: 90, level: 2, materials: [{ itemId: 6, count: 5 }, { itemId: 51, count: 5 }] },
  { id: 4, name: 'Cơm gà', productID: 130, cookTimeMinutes: 120, level: 3, materials: [{ itemId: 6, count: 10 }, { itemId: 50, count: 5 }, { itemId: 1, count: 5 }] },
  { id: 5, name: 'Súp cà chua', productID: 131, cookTimeMinutes: 90, level: 2, materials: [{ itemId: 0, count: 10 }, { itemId: 50, count: 2 }] },
  { id: 6, name: 'Cá kho', productID: 132, cookTimeMinutes: 180, level: 3, materials: [{ itemId: 54, count: 2 }, { itemId: 44, count: 5 }] },
  { id: 7, name: 'Heo quay', productID: 133, cookTimeMinutes: 240, level: 4, materials: [{ itemId: 52, count: 1 }, { itemId: 44, count: 10 }] },
  { id: 8, name: 'Bánh kem', productID: 134, cookTimeMinutes: 180, level: 4, materials: [{ itemId: 6, count: 10 }, { itemId: 50, count: 5 }, { itemId: 51, count: 5 }, { itemId: 35, count: 5 }] },
  { id: 9, name: 'Thịt bò xào', productID: 135, cookTimeMinutes: 200, level: 4, materials: [{ itemId: 51, count: 2 }, { itemId: 44, count: 5 }] },
];

export function CookingPanel({
  accountId,
  cooking,
  foods,
  inventory,
}: {
  accountId: number;
  cooking?: CookingState;
  foods?: FoodRecipe[];
  inventory: InventoryItem[];
}) {
  const [busy, setBusy] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [showRecipes, setShowRecipes] = useState(false);

  const recipeCatalog = foods && foods.length > 0 ? foods : FALLBACK_RECIPES;

  const inventoryMap = new Map<number, number>();
  for (const item of inventory) {
    inventoryMap.set(item.id, (inventoryMap.get(item.id) ?? 0) + item.num);
  }

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

  const handleRefresh = async () => {
    setBusy(true);
    try {
      await apiPost(`/api/accounts/${accountId}/farm/cook/refresh`);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleCook = async (slot: number, recipeId: number) => {
    setBusy(true);
    try {
      await apiPost(`/api/accounts/${accountId}/farm/cook`, { slot, recipeId });
      setSelectedSlot(null);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleHarvest = async (slot: number) => {
    setBusy(true);
    try {
      await apiPost(`/api/accounts/${accountId}/farm/harvest-cook`, { slot });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSlot = async () => {
    if (!window.confirm('Mở thêm ô nấu ăn mới (tiêu tốn Xu/Lượng)?')) return;
    setBusy(true);
    try {
      await apiPost(`/api/accounts/${accountId}/farm/cook/open-slot`);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleOpenLastSlot = async () => {
    if (!window.confirm('Mở ô nấu ăn Master cuối cùng?')) return;
    setBusy(true);
    try {
      await apiPost(`/api/accounts/${accountId}/farm/cook/open-last-slot`);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const slots = cooking?.slots ?? [];
  const missions = cooking?.missions ?? [];

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Bếp nấu ăn</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="ghost" onClick={() => setShowRecipes(!showRecipes)}>
            {showRecipes ? 'Ẩn công thức' : 'Xem công thức'}
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={handleRefresh}>
            Làm mới bếp
          </button>
        </div>
      </div>

      <p className="hint">
        {cooking ? `${cooking.numSlot} ô bếp · ${slots.filter((s) => s.idFood !== -1).length} ô đang nấu · ${slots.filter((s) => s.isDone).length} ô chín` : 'Chưa có thông tin bếp'}
      </p>

      {/* Lưới các ô bếp */}
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
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
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

              <div style={{ marginTop: '0.5rem' }}>
                {isDone ? (
                  <button
                    type="button"
                    className="primary"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                    disabled={busy}
                    onClick={() => handleHarvest(slot.slot)}
                  >
                    Thu hoạch
                  </button>
                ) : isEmpty ? (
                  <button
                    type="button"
                    className="ghost"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                    disabled={busy}
                    onClick={() => setSelectedSlot(selectedSlot === slot.slot ? null : slot.slot)}
                  >
                    {selectedSlot === slot.slot ? 'Hủy' : 'Chọn nấu'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Nút mở thêm ô */}
        <div
          style={{
            border: '1px dashed var(--color-border, #ccc)',
            borderRadius: '6px',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '85px',
          }}
        >
          <button
            type="button"
            className="ghost"
            style={{ fontSize: '0.8rem' }}
            disabled={busy}
            onClick={handleOpenSlot}
          >
            + Mở thêm ô
          </button>
        </div>
      </div>

      {/* Form chọn món nấu cho ô đã chọn */}
      {selectedSlot !== null && (
        <div style={{ background: 'var(--color-bg-subtle, #f5f5f5)', padding: '0.75rem', borderRadius: '6px', margin: '0.75rem 0' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Nấu cho Ô #{selectedSlot + 1}:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(Number(e.target.value))}
              style={{ flex: 1, minWidth: '160px' }}
            >
              {recipeCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Lv.{r.level} · {r.cookTimeMinutes}p)
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => handleCook(selectedSlot, selectedRecipeId)}
            >
              Bắt đầu nấu
            </button>
          </div>
        </div>
      )}

      {/* Bảng công thức và nguyên liệu */}
      {showRecipes && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border, #eee)', paddingTop: '0.75rem' }}>
          <h3>Bảng công thức món ăn</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {recipeCatalog.map((r) => {
              const materialsStatus = r.materials.map((m) => {
                const countInBag = inventoryMap.get(m.itemId) ?? 0;
                const ok = countInBag >= m.count;
                return { ...m, countInBag, ok };
              });
              const canCook = materialsStatus.every((m) => m.ok);

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
                        Item #{m.itemId}: {m.countInBag}/{m.count}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nhiệm vụ mở ô bếp Master */}
      {missions.length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border, #eee)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Nhiệm vụ mở ô Master</h3>
            {cooking?.isReadyToOpen && !cooking?.isUnlocked && (
              <button type="button" className="primary" disabled={busy} onClick={handleOpenLastSlot}>
                Mở ô Master ngay
              </button>
            )}
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
