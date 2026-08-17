import { useEffect, useMemo, useRef, useState } from 'react';

import type { FarmProfileDto, TreeCellPlanEntry } from '../types.js';
import {
  applyTreePaint,
  invalidTreePlanEntries,
  summarizeTreePlan,
  type TreePaint,
} from './treeCellPlan.js';

export interface TreeCellPlanEditorProps {
  profile: FarmProfileDto;
  entries: TreeCellPlanEntry[];
  disabled: boolean;
  refreshing?: boolean;
  onChange(entries: TreeCellPlanEntry[]): void;
  onRefresh?(): void;
}

function sameEntries(left: TreeCellPlanEntry[], right: TreeCellPlanEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const candidate = right[index];
    if (candidate === undefined) return false;
    return entry.cellIndex === candidate.cellIndex
      && entry.action === candidate.action
      && (entry.action !== 'seed'
        || (candidate.action === 'seed' && entry.seedId === candidate.seedId));
  });
}

function paintKey(paint: TreePaint): string {
  return paint.kind === 'seed' ? `seed:${paint.seedId}` : paint.kind;
}

function entryKey(entry: TreeCellPlanEntry | undefined): string {
  if (entry === undefined) return 'default';
  return entry.action === 'seed' ? `seed:${entry.seedId}` : 'skip';
}

function cachedTime(value: number | null): string {
  return value === null ? 'chưa có' : new Date(value).toLocaleString('vi-VN');
}

export function TreeCellPlanEditor({
  profile,
  entries,
  disabled,
  refreshing,
  onChange,
  onRefresh,
}: TreeCellPlanEditorProps) {
  const [paint, setPaint] = useState<TreePaint>({ kind: 'default' });
  const entriesRef = useRef(entries);
  const paintingRef = useRef(false);
  entriesRef.current = entries;

  useEffect(() => {
    const stopPainting = () => {
      paintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
    };
  }, []);

  // Catalog hạt lấy từ cache seedCatalog — nguồn là bảng cây thật trong cửa
  // hàng (gói 76), không còn fallback tĩnh nữa.
  const seeds = useMemo(
    () => [...profile.seedCatalog].sort(
      (left, right) => left.name.localeCompare(right.name, 'vi') || left.id - right.id,
    ),
    [profile.seedCatalog],
  );

  useEffect(() => {
    if (paint.kind === 'seed' && !seeds.some((seed) => seed.id === paint.seedId)) {
      setPaint({ kind: 'default' });
    }
  }, [paint, seeds]);
  const entriesByCell = useMemo(
    () => new Map(entries.map((entry) => [entry.cellIndex, entry])),
    [entries],
  );
  const invalidEntries = useMemo(
    () => invalidTreePlanEntries(profile, entries),
    [entries, profile],
  );
  const invalidKnownCells = useMemo(() => {
    const knownCells = new Set(profile.cellIndices);
    return new Set(
      invalidEntries
        .filter((entry) => knownCells.has(entry.cellIndex))
        .map((entry) => entry.cellIndex),
    );
  }, [invalidEntries, profile.cellIndices]);
  const unknownCellEntries = useMemo(() => {
    const knownCells = new Set(profile.cellIndices);
    return invalidEntries.filter((entry) => !knownCells.has(entry.cellIndex));
  }, [invalidEntries, profile.cellIndices]);
  const summary = useMemo(
    () => summarizeTreePlan(profile.cellIndices, entries),
    [entries, profile.cellIndices],
  );
  const seedById = useMemo(
    () => new Map(seeds.map((seed) => [seed.id, seed])),
    [seeds],
  );

  const hasCells = profile.cellIndices.length > 0;
  const editorLocked = disabled || !hasCells;

  const commitPaint = (cellIndex: number) => {
    if (editorLocked) return;
    const next = applyTreePaint(entriesRef.current, cellIndex, paint);
    if (sameEntries(entriesRef.current, next)) return;
    entriesRef.current = next;
    onChange(next);
  };

  const commitElement = (element: Element | null, grid: HTMLDivElement) => {
    if (!paintingRef.current || element === null) return;
    const cell = element.closest<HTMLButtonElement>('[data-tree-cell-index]');
    if (cell === null || !grid.contains(cell)) return;
    const cellIndex = Number(cell.dataset.treeCellIndex);
    if (Number.isInteger(cellIndex)) commitPaint(cellIndex);
  };

  const describeEntry = (entry: TreeCellPlanEntry | undefined): string => {
    if (entry === undefined) return 'Mặc định';
    if (entry.action === 'skip') return 'Không trồng';
    return seedById.get(entry.seedId)?.name ?? `Hạt #${entry.seedId} không còn trong cache`;
  };

  return (
    <details className="tree-plan-editor" open>
      <summary className="tree-plan-heading">Kế hoạch cây theo ô</summary>

      {!hasCells && (
        <p className="tree-plan-guidance">
          Chưa có cache ô farm. Hãy kết nối tài khoản trước khi lập kế hoạch.
        </p>
      )}
      {hasCells && profile.seedCatalog.length === 0 && (
        <p className="tree-plan-guidance">
          Catalog hạt chưa có trong cache. Bạn vẫn có thể chọn Mặc định hoặc Không trồng; các override
          hạt cũ tiếp tục hiển thị bằng id.
        </p>
      )}

      <div className="tree-plan-palette" aria-label="Chọn trạng thái để tô">
        <button
          type="button"
          className="tree-plan-palette-item tree-plan-palette-item--default"
          aria-pressed={paint.kind === 'default'}
          disabled={editorLocked}
          onClick={() => setPaint({ kind: 'default' })}
        >
          ◇ Mặc định
        </button>
        <button
          type="button"
          className="tree-plan-palette-item tree-plan-palette-item--skip"
          aria-pressed={paint.kind === 'skip'}
          disabled={editorLocked}
          onClick={() => setPaint({ kind: 'skip' })}
        >
          ⛔ Không trồng
        </button>
        {seeds.map((seed) => (
          <button
            type="button"
            key={seed.id}
            className="tree-plan-palette-item tree-plan-palette-item--seed"
            aria-pressed={paint.kind === 'seed' && paint.seedId === seed.id}
            disabled={editorLocked}
            onClick={() => setPaint({ kind: 'seed', seedId: seed.id })}
          >
            🌱 {seed.name} <small>#{seed.id}</small>
          </button>
        ))}
      </div>

      {hasCells && (
        <div
          className="tree-plan-grid"
          role="grid"
          aria-label="Kế hoạch cho các ô farm"
          onPointerOver={(event) => {
            commitElement(event.target as Element, event.currentTarget);
          }}
          onPointerMove={(event) => {
            if (!paintingRef.current) return;
            commitElement(
              document.elementFromPoint(event.clientX, event.clientY),
              event.currentTarget,
            );
          }}
        >
          {profile.cellIndices.map((cellIndex) => {
            const entry = entriesByCell.get(cellIndex);
            const stateKey = entryKey(entry);
            const invalid = invalidKnownCells.has(cellIndex);
            return (
              <button
                type="button"
                key={cellIndex}
                data-tree-cell-index={cellIndex}
                className={[
                  'tree-plan-cell',
                  `tree-plan-cell--${entry?.action ?? 'default'}`,
                  invalid ? 'tree-plan-cell--invalid' : '',
                ].filter(Boolean).join(' ')}
                aria-label={`Ô ${cellIndex} — ${describeEntry(entry)}${invalid ? ' — không hợp lệ' : ''}`}
                aria-pressed={stateKey === paintKey(paint)}
                disabled={disabled}
                onPointerDown={(event) => {
                  if (event.button > 0 || event.isPrimary === false || editorLocked) return;
                  event.preventDefault();
                  paintingRef.current = true;
                  commitPaint(cellIndex);
                }}
                onClick={() => commitPaint(cellIndex)}
              >
                <strong>Ô {cellIndex}</strong>
                <span>{describeEntry(entry)}</span>
                {invalid && <span className="tree-plan-cell-warning">⚠ Không hợp lệ</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="tree-plan-summary" aria-label="Tóm tắt kế hoạch">
        <span>◇ Mặc định: {summary.defaults}</span>
        <span>⛔ Không trồng: {summary.skipped}</span>
        {[...summary.seeds].map(([seedId, count]) => {
          const seed = seedById.get(seedId);
          return (
            <span key={seedId}>
              🌱 {seed?.name ?? `Hạt không hợp lệ #${seedId}`}: {count}
            </span>
          );
        })}
      </div>

      {invalidEntries.length > 0 && (
        <div className="tree-plan-invalid" role="alert">
          <strong>⚠ {invalidEntries.length} mục kế hoạch không khớp cache.</strong>
          {unknownCellEntries.map((entry) => (
            <span className="tree-plan-invalid-entry" key={`unknown:${entry.cellIndex}`}>
              Ô {entry.cellIndex} không có trong cache
              {entry.action === 'seed' ? ` · hạt #${entry.seedId}` : ''}
            </span>
          ))}
        </div>
      )}
    </details>
  );
}
