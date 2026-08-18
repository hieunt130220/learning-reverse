import { useEffect, useMemo, useRef, useState } from 'react';

import type { KitchenPlanEntry } from '../types.js';
import {
  DEFAULT_KITCHEN_SLOTS,
  KITCHEN_FOOD_CATALOG,
  applyKitchenPaint,
  summarizeKitchenPlan,
  type KitchenPaint,
} from './kitchenPlan.js';

export interface KitchenPlanEditorProps {
  title: string;
  entries: KitchenPlanEntry[];
  disabled: boolean;
  onChange(entries: KitchenPlanEntry[]): void;
}

function sameEntries(left: KitchenPlanEntry[], right: KitchenPlanEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const candidate = right[index];
    if (candidate === undefined) return false;
    return entry.slotIndex === candidate.slotIndex
      && entry.action === candidate.action
      && (entry.action !== 'cook'
        || (candidate.action === 'cook' && entry.recipeId === candidate.recipeId));
  });
}

function paintKey(paint: KitchenPaint): string {
  return paint.kind === 'cook' ? `cook:${paint.recipeId}` : paint.kind;
}

function entryKey(entry: KitchenPlanEntry | undefined): string {
  if (entry === undefined) return 'default';
  return entry.action === 'cook' ? `cook:${entry.recipeId}` : 'skip';
}

export function KitchenPlanEditor({
  title,
  entries,
  disabled,
  onChange,
}: KitchenPlanEditorProps) {
  const [paint, setPaint] = useState<KitchenPaint>({ kind: 'default' });
  const entriesRef = useRef(entries);
  const paintingRef = useRef(false);
  entriesRef.current = entries;
  const slotIndices = DEFAULT_KITCHEN_SLOTS;

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

  const foodById = useMemo(
    () => new Map(KITCHEN_FOOD_CATALOG.map((item) => [item.id, item])),
    [],
  );

  useEffect(() => {
    if (paint.kind === 'cook' && !foodById.has(paint.recipeId)) {
      setPaint({ kind: 'default' });
    }
  }, [paint, foodById]);

  const entriesBySlot = useMemo(
    () => new Map(entries.map((entry) => [entry.slotIndex, entry])),
    [entries],
  );

  const summary = useMemo(
    () => summarizeKitchenPlan(slotIndices, entries),
    [entries, slotIndices],
  );

  const commitPaint = (slotIndex: number) => {
    if (disabled) return;
    const next = applyKitchenPaint(entriesRef.current, slotIndex, paint);
    if (sameEntries(entriesRef.current, next)) return;
    entriesRef.current = next;
    onChange(next);
  };

  const commitElement = (element: Element | null, grid: HTMLDivElement) => {
    if (!paintingRef.current || element === null) return;
    const slot = element.closest<HTMLButtonElement>('[data-kitchen-slot-index]');
    if (slot === null || !grid.contains(slot)) return;
    const slotIndex = Number(slot.dataset.kitchenSlotIndex);
    if (Number.isInteger(slotIndex)) commitPaint(slotIndex);
  };

  const describeEntry = (entry: KitchenPlanEntry | undefined): string => {
    if (entry === undefined) return 'Mặc định';
    if (entry.action === 'skip') return 'Không nấu';
    return foodById.get(entry.recipeId)?.name ?? `Món #${entry.recipeId}`;
  };

  return (
    <details className="tree-plan-editor" open>
      <summary className="tree-plan-heading">{title}</summary>

      <div className="tree-plan-palette" aria-label="Chọn món để tô" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="tree-plan-palette-item tree-plan-palette-item--default"
          aria-pressed={paint.kind === 'default'}
          disabled={disabled}
          onClick={() => setPaint({ kind: 'default' })}
        >
          ◇ Mặc định
        </button>
        <button
          type="button"
          className="tree-plan-palette-item tree-plan-palette-item--skip"
          aria-pressed={paint.kind === 'skip'}
          disabled={disabled}
          onClick={() => setPaint({ kind: 'skip' })}
        >
          ⛔ Không nấu
        </button>
        {KITCHEN_FOOD_CATALOG.map((item) => (
          <button
            type="button"
            key={item.id}
            className="tree-plan-palette-item tree-plan-palette-item--seed"
            aria-pressed={paint.kind === 'cook' && paint.recipeId === item.id}
            disabled={disabled}
            onClick={() => setPaint({ kind: 'cook', recipeId: item.id })}
          >
            {item.name} <small>#{item.id}</small>
          </button>
        ))}
      </div>

      <div
        className="tree-plan-grid"
        role="grid"
        aria-label={title}
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
        {slotIndices.map((slotIndex) => {
          const entry = entriesBySlot.get(slotIndex);
          const stateKey = entryKey(entry);
          return (
            <button
              type="button"
              key={slotIndex}
              data-kitchen-slot-index={slotIndex}
              className={[
                'tree-plan-cell',
                `tree-plan-cell--${entry?.action ?? 'default'}`,
              ].filter(Boolean).join(' ')}
              aria-label={`Ô bếp ${slotIndex} — ${describeEntry(entry)}`}
              aria-pressed={stateKey === paintKey(paint)}
              disabled={disabled}
              onPointerDown={(event) => {
                if (event.button > 0 || event.isPrimary === false || disabled) return;
                event.preventDefault();
                paintingRef.current = true;
                commitPaint(slotIndex);
              }}
              onClick={() => commitPaint(slotIndex)}
            >
              <strong>Ô {slotIndex}</strong>
              <span>{describeEntry(entry)}</span>
            </button>
          );
        })}
      </div>

      <div className="tree-plan-summary" aria-label="Tóm tắt kế hoạch bếp">
        <span>◇ Mặc định: {summary.defaults}</span>
        <span>⛔ Không nấu: {summary.skipped}</span>
        {[...summary.recipes].map(([recipeId, count]) => {
          const item = foodById.get(recipeId);
          return (
            <span key={recipeId}>
              {item?.name ?? `Món #${recipeId}`} ×{count}
            </span>
          );
        })}
      </div>
    </details>
  );
}
