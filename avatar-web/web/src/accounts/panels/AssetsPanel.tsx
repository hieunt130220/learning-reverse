import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AnimalInfo, FarmCell, FarmState, InventoryItem, TreeInfo } from '../../types.js';

export function cellNeeds(c: FarmCell): string[] {
  if (c.idTree === -1) return ['trống'];
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('cỏ');
  if (c.isWorm) n.push('sâu');
  if (c.time === 0) n.push('thu hoạch');
  return n;
}

export function AssetsPanel({
  accountId,
  farm,
  inventory,
  trees,
  animals,
}: {
  accountId: number;
  farm: FarmState | null;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  animals: AnimalInfo[];
}) {
  return (
    <>
      <FarmSection accountId={accountId} farm={farm} inventory={inventory} trees={trees} />
      <AnimalSection farm={farm} catalog={animals} />
    </>
  );
}

function FarmSection({
  accountId,
  farm,
  inventory,
  trees,
}: {
  accountId: number;
  farm: FarmState | null;
  inventory: InventoryItem[];
  trees: TreeInfo[];
}) {
  const [sel, setSel] = useState<FarmCell | null>(null);
  const treeName = (id: number) => trees.find((t) => t.id === id)?.name ?? `#${id}`;

  const planted = farm?.cells.filter((c) => c.idTree !== -1).length ?? 0;
  const ready = farm?.cells.filter((c) => c.idTree !== -1 && c.time === 0).length ?? 0;
  const care = farm?.cells.filter((c) => c.isArid || c.isGrass || c.isWorm).length ?? 0;

  return (
    <section className="card">
      <h2>Nông trại</h2>
      {farm ? (
        <p className="hint">
          farm #{farm.idFarm} · {farm.cells.length} ô · {planted} có cây · {ready} chờ thu ·{' '}
          {care} cần chăm
        </p>
      ) : (
        <p className="hint">Bấm "Vào nông trại / làm mới" ở khung Trạng thái sau khi đã kết nối.</p>
      )}

      {inventory.length > 0 && (
        <div className="row">
          <span className="hint">kho:</span>
          {inventory.map((it) => (
            <span key={it.id} className="chip">
              {treeName(it.id)} × {it.num}
            </span>
          ))}
          <button
            className="ghost"
            onClick={() =>
              void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getInventory', args: [] })
            }
          >
            làm mới kho
          </button>
          <button
            className="ghost"
            onClick={() =>
              void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getTreeInfo', args: [] })
            }
          >
            tải bảng cây
          </button>
        </div>
      )}

      {farm && (
        <div className="grid">
          {farm.cells.map((c) => {
            const needs = cellNeeds(c);
            const cls = [
              'cell',
              c.idTree === -1 ? 'empty' : '',
              c.time === 0 && c.idTree !== -1 ? 'ready' : '',
              c.isArid || c.isGrass || c.isWorm ? 'care' : '',
              sel?.index === c.index ? 'sel' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button key={c.index} className={cls} onClick={() => setSel(c)} title={needs.join(', ')}>
                <span className="idx">{c.index}</span>
                {c.idTree !== -1 && <span className="tree">{treeName(c.idTree)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div className="cell-detail">
          <b>Ô {sel.index}</b> — {sel.idTree === -1 ? 'trống' : treeName(sel.idTree)}
          {sel.idTree !== -1 && (
            <>
              {' '}· còn {sel.time}s · sức sống {sel.vitalityPer}% · thu hoạch {sel.hervestPer}%
              {sel.level !== undefined && ` · level ${sel.level}`}
            </>
          )}
          <div className="hint">cần: {cellNeeds(sel).join(', ') || 'không'}</div>
        </div>
      )}
    </section>
  );
}

function AnimalSection({ farm, catalog }: { farm: FarmState | null; catalog: AnimalInfo[] }) {
  const name = (sp: number) => catalog.find((a) => a.id === sp)?.name ?? `#${sp}`;
  if (!farm || farm.animals.length === 0) return null;
  const hungry = farm.animals.filter((a) => a.hunger).length;

  return (
    <section className="card">
      <h2>Vật nuôi</h2>
      <p className="hint">
        {farm.animals.length} con · {hungry} đang đói. Địa chỉ hoá bằng vị trí trong danh sách (= IDDB).
      </p>
      <div className="log" style={{ maxHeight: 260 }}>
        {farm.animals.map((a) => (
          <div key={a.index} className={a.hunger ? 'care' : ''}>
            <b>#{a.index}</b> {name(a.species)} · máu {a.health} · thu hoạch {a.harvestPer}% · trứng{' '}
            {a.numEggOne}
            {a.hunger && <span style={{ color: '#d9a441' }}> · ĐÓI</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
