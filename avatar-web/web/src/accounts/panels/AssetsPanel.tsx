import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AnimalInfo, FarmAnimal, FarmCell, FarmState, InventoryItem, TreeInfo } from '../../types.js';

/**
 * Ô đã chín chưa — giữ ĐÚNG điều kiện của server (`isCellRipe` trong
 * `server/src/game/farmData.ts`), đừng để hai bên lệch nhau.
 *
 * `time` đếm LÊN, là số phút kể từ lúc trồng, nên điều kiện cũ `time === 0`
 * chỉ đúng trong đúng một phút đầu sau khi trồng — tức UI **không bao giờ**
 * báo ô nào chín. Tín hiệu thật là đủ thời gian lớn: `time >= growHours × 60`,
 * với `growHours` là `TreeInfo.growMinutes` (trường đặt sai tên, đơn vị GIỜ).
 * `hervestPer` thường bằng 0 kể cả trên ô chín nên chỉ dùng làm tín hiệu đủ.
 */
export function isCellRipe(c: FarmCell, trees: TreeInfo[]): boolean {
  if (c.idTree === -1 || c.time === -1) return false;
  if (c.hervestPer > 0) return true;
  const growHours = trees.find((t) => t.id === c.idTree)?.growMinutes;
  if (growHours === undefined) return false;
  return c.time >= growHours * 60;
}

export function cellNeeds(c: FarmCell, trees: TreeInfo[]): string[] {
  if (c.idTree === -1) return ['trống'];
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('cỏ');
  if (c.isWorm) n.push('sâu');
  if (isCellRipe(c, trees)) n.push('thu hoạch');
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
        <p className="hint">Chưa có dữ liệu nông trại. Hãy kết nối tài khoản.</p>
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
            const needs = cellNeeds(c, trees);
            const cls = [
              'cell',
              c.idTree === -1 ? 'empty' : '',
              isCellRipe(c, trees) ? 'ready' : '',
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
              {' '}· đã trồng {sel.time} phút
              {(() => {
                const need = trees.find((t) => t.id === sel.idTree)?.growMinutes;
                return need === undefined ? '' : `/${need * 60}`;
              })()}
              {' '}· sức sống {sel.vitalityPer}% · thu hoạch {sel.hervestPer}%
              {sel.level !== undefined && ` · level ${sel.level}`}
            </>
          )}
          <div className="hint">cần: {cellNeeds(sel, trees).join(', ') || 'không'}</div>
        </div>
      )}
    </section>
  );
}

function AnimalSection({ farm, catalog }: { farm: FarmState | null; catalog: AnimalInfo[] }) {
  const [selected, setSelected] = useState<FarmAnimal | null>(null);
  const name = (sp: number) => catalog.find((a) => a.id === sp)?.name ?? `#${sp}`;
  if (!farm || farm.animals.length === 0) return null;
  const hungry = farm.animals.filter((a) => a.hunger).length;
  const needsCare = (animal: FarmAnimal) => animal.hunger || animal.hasFlu || animal.hasDiarrhea;
  const isReady = (animal: FarmAnimal) => animal.harvestPer > 0 || animal.numEggOne > 0;
  const statusText = (animal: FarmAnimal) => {
    const statuses: string[] = [];
    if (animal.hunger) statuses.push('đói');
    if (animal.hasFlu) statuses.push('cúm');
    if (animal.hasDiarrhea) statuses.push('tiêu chảy');
    if (isReady(animal)) statuses.push('có thể thu hoạch');
    return statuses.join(', ') || 'bình thường';
  };

  return (
    <section className="card">
      <h2>Vật nuôi</h2>
      <p className="hint">
        {farm.animals.length} con · {hungry} đang đói · mỗi ô là một IDDB.
      </p>
      <div className="grid">
        {farm.animals.map((animal) => {
          const cls = [
            'cell',
            needsCare(animal) ? 'care' : '',
            isReady(animal) ? 'ready' : '',
            selected?.index === animal.index ? 'sel' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={animal.index}
              type="button"
              className={cls}
              onClick={() => setSelected(animal)}
              title={`${name(animal.species)} · ${statusText(animal)}`}
            >
              <span className="idx">{animal.index}</span>
              <span className="tree">{name(animal.species)}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="cell-detail">
          <b>IDDB {selected.index}</b> — {name(selected.species)} · máu {selected.health} · thu hoạch{' '}
          {selected.harvestPer}% · sản phẩm {selected.numEggOne}
          <div className="hint">trạng thái: {statusText(selected)}</div>
        </div>
      )}
    </section>
  );
}
