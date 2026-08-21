import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AnimalInfo, FarmAnimal, FarmCell, FarmState, InventoryItem, ItemInfo, TreeInfo } from '../../types.js';
import { fmtDuration, parseAnimalSpec } from '../animalSpec.js';
import { ANIMAL_PRODUCT_NAMES } from './CookingPanel.js';

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
  if (c.idTree === -1 || c.time === -1) return ['trống'];
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
  produce,
  trees,
  animals,
  items,
}: {
  accountId: number;
  farm: FarmState | null;
  inventory: InventoryItem[];
  produce: InventoryItem[];
  trees: TreeInfo[];
  animals: AnimalInfo[];
  items: ItemInfo[];
}) {
  return (
    <>
      <FarmSection farm={farm} trees={trees} />
      <KhoSection
        accountId={accountId}
        inventory={inventory}
        produce={produce}
        trees={trees}
        items={items}
        animals={animals}
      />
      <AnimalSection farm={farm} catalog={animals} />
    </>
  );
}

type KhoTab = 'nong-san' | 'vat-pham';

function KhoSection({
  accountId,
  inventory,
  produce,
  trees,
  items,
  animals,
}: {
  accountId: number;
  inventory: InventoryItem[];
  produce: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
}) {
  const [tab, setTab] = useState<KhoTab>('nong-san');
  const itemNames = new Map<number, string>();
  for (const item of items) itemNames.set(item.id, item.name);
  for (const tree of trees) itemNames.set(tree.id, tree.name);
  for (const animal of animals) itemNames.set(animal.id, animal.name);
  for (const [id, name] of Object.entries(ANIMAL_PRODUCT_NAMES)) itemNames.set(Number(id), name);
  const name = (id: number) => itemNames.get(id) ?? `#${id}`;
  const rows = tab === 'nong-san' ? produce : inventory;

  return (
    <section className="card">
      <h2>Kho</h2>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'nong-san' ? 'tab active' : 'tab'}
          onClick={() => setTab('nong-san')}
        >
          Nông sản
        </button>
        <button
          type="button"
          className={tab === 'vat-pham' ? 'tab active' : 'tab'}
          onClick={() => setTab('vat-pham')}
        >
          Vật phẩm & Hạt giống
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">trống</p>
      ) : (
        <div className="row">
          {rows.map((it) => (
            <span key={it.id} className="chip">
              {name(it.id)} × {it.num}
            </span>
          ))}
        </div>
      )}
      <div className="row">
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
    </section>
  );
}

function FarmSection({ farm, trees }: { farm: FarmState | null; trees: TreeInfo[] }) {
  const [sel, setSel] = useState<FarmCell | null>(null);
  const treeName = (id: number) => trees.find((t) => t.id === id)?.name ?? `#${id}`;

  const planted = farm?.cells.filter((c) => c.idTree !== -1 && c.time !== -1).length ?? 0;
  const ready = farm?.cells.filter((c) => isCellRipe(c, trees)).length ?? 0;
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

      {farm && (
        <div className="grid">
          {farm.cells.map((c) => {
            const needs = cellNeeds(c, trees);
            const isEmpty = c.idTree === -1 || c.time === -1;
            const cls = [
              'cell',
              isEmpty ? 'empty' : '',
              isCellRipe(c, trees) ? 'ready' : '',
              c.isArid || c.isGrass || c.isWorm ? 'care' : '',
              sel?.index === c.index ? 'sel' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button key={c.index} className={cls} onClick={() => setSel(c)} title={needs.join(', ')}>
                <span className="idx">{c.index}</span>
                {!isEmpty && <span className="tree">{treeName(c.idTree)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div className="cell-detail">
          <b>Ô {sel.index}</b> — {sel.idTree === -1 || sel.time === -1 ? 'trống' : treeName(sel.idTree)}
          {sel.idTree !== -1 && sel.time !== -1 && (
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
          {sel.time === -1 && sel.idTree !== -1 && (
            <span> (vừa thu hoạch {treeName(sel.idTree)})</span>
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
  const specOf = (animal: FarmAnimal) =>
    parseAnimalSpec(catalog.find((a) => a.id === animal.species)?.desc ?? '');
  // "Đã lớn" tính theo `bornTime` (phút kể từ lúc sinh) so với `Thời gian lớn` trong
  // desc — KHÔNG dùng `harvestPer`: đo trên server thật thấy harvestPer = 100 ngay cả
  // khi con vật chưa đủ tuổi lớn (khớp logic bán trong autoFarm.ts).
  const isGrown = (animal: FarmAnimal) => {
    const growMinutes = specOf(animal).growMinutes;
    return growMinutes !== undefined && animal.bornTime >= growMinutes;
  };
  const isReady = (animal: FarmAnimal) =>
    specOf(animal).hasProduct ? animal.numEggOne > 0 : isGrown(animal);
  const statusText = (animal: FarmAnimal) => {
    const statuses: string[] = [];
    if (animal.hunger) statuses.push('đói');
    if (animal.hasFlu) statuses.push('cúm');
    if (animal.hasDiarrhea) statuses.push('tiêu chảy');
    if (specOf(animal).hasProduct) {
      if (animal.numEggOne > 0) statuses.push('có thể thu hoạch');
      else if (isGrown(animal)) statuses.push('đã lớn');
    } else if (isGrown(animal)) {
      statuses.push('đã lớn');
    }
    return statuses.join(', ') || 'bình thường';
  };
  const timeText = (animal: FarmAnimal): string | undefined => {
    const s = specOf(animal);
    if (s.hasProduct && s.lifeMinutes !== undefined) {
      return `còn sống ${fmtDuration(s.lifeMinutes - animal.bornTime)}`;
    }
    if (!s.hasProduct && s.growMinutes !== undefined) {
      const remaining = s.growMinutes - animal.bornTime;
      return remaining > 0 ? `còn ${fmtDuration(remaining)} đến lúc lớn` : 'đã lớn';
    }
    if (s.lifeMinutes !== undefined) {
      return `còn sống ${fmtDuration(s.lifeMinutes - animal.bornTime)}`;
    }
    return undefined;
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
          <b>{selected.index}</b> — {name(selected.species)} · máu {selected.health}
          {specOf(selected).hasProduct && (
            <> · thu hoạch {selected.harvestPer}% · sản phẩm {selected.numEggOne}</>
          )}
          <div className="hint">trạng thái: {statusText(selected)}</div>
          {timeText(selected) && <div className="hint">⏳ {timeText(selected)}</div>}
        </div>
      )}
    </section>
  );
}
