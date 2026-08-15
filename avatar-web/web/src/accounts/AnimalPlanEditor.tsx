import { useEffect, useMemo, useRef, useState } from 'react';

import type { AnimalPlanEntry } from '../types.js';
import {
  AnimalPaint,
  AnimalSpeciesInfo,
  applyAnimalPaint,
  DEFAULT_ANIMAL_SLOTS,
  summarizeAnimalPlan,
} from './animalPlan.js';

export interface AnimalPlanEditorProps {
  title: string;
  catalog: AnimalSpeciesInfo[];
  slotIndices?: number[];
  entries: AnimalPlanEntry[];
  disabled: boolean;
  onChange(entries: AnimalPlanEntry[]): void;
}

function sameEntries(left: AnimalPlanEntry[], right: AnimalPlanEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const candidate = right[index];
    if (candidate === undefined) return false;
    return entry.slotIndex === candidate.slotIndex
      && entry.action === candidate.action
      && (entry.action !== 'breed'
        || (candidate.action === 'breed' && entry.speciesId === candidate.speciesId));
  });
}

function paintKey(paint: AnimalPaint): string {
  return paint.kind === 'breed' ? `breed:${paint.speciesId}` : paint.kind;
}

function entryKey(entry: AnimalPlanEntry | undefined): string {
  if (entry === undefined) return 'default';
  return entry.action === 'breed' ? `breed:${entry.speciesId}` : 'skip';
}

export function AnimalPlanEditor({
  title,
  catalog,
  slotIndices = DEFAULT_ANIMAL_SLOTS,
  entries,
  disabled,
  onChange,
}: AnimalPlanEditorProps) {
  const [paint, setPaint] = useState<AnimalPaint>({ kind: 'default' });
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

  const speciesById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );

  useEffect(() => {
    if (paint.kind === 'breed' && !speciesById.has(paint.speciesId)) {
      setPaint({ kind: 'default' });
    }
  }, [paint, speciesById]);

  const entriesBySlot = useMemo(
    () => new Map(entries.map((entry) => [entry.slotIndex, entry])),
    [entries],
  );

  const summary = useMemo(
    () => summarizeAnimalPlan(slotIndices, entries),
    [entries, slotIndices],
  );

  const commitPaint = (slotIndex: number) => {
    if (disabled) return;
    const next = applyAnimalPaint(entriesRef.current, slotIndex, paint);
    if (sameEntries(entriesRef.current, next)) return;
    entriesRef.current = next;
    onChange(next);
  };

  const commitElement = (element: Element | null, grid: HTMLDivElement) => {
    if (!paintingRef.current || element === null) return;
    const slot = element.closest<HTMLButtonElement>('[data-animal-slot-index]');
    if (slot === null || !grid.contains(slot)) return;
    const slotIndex = Number(slot.dataset.animalSlotIndex);
    if (Number.isInteger(slotIndex)) commitPaint(slotIndex);
  };

  const describeEntry = (entry: AnimalPlanEntry | undefined): string => {
    if (entry === undefined) return 'Mặc định';
    if (entry.action === 'skip') return 'Không nuôi';
    const spec = speciesById.get(entry.speciesId);
    return spec ? `${spec.icon ?? ''} ${spec.name}`.trim() : `Loài #${entry.speciesId}`;
  };

  return (
    <details className="tree-plan-editor" open>
      <summary className="tree-plan-heading">{title}</summary>

      <div className="tree-plan-palette" aria-label="Chọn loài để tô" style={{ marginTop: 10 }}>
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
          ⛔ Không nuôi
        </button>
        {catalog.map((item) => (
          <button
            type="button"
            key={item.id}
            className="tree-plan-palette-item tree-plan-palette-item--seed"
            aria-pressed={paint.kind === 'breed' && paint.speciesId === item.id}
            disabled={disabled}
            onClick={() => setPaint({ kind: 'breed', speciesId: item.id })}
          >
            {item.icon ?? '🐣'} {item.name} <small>#{item.id}</small>
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
              data-animal-slot-index={slotIndex}
              className={[
                'tree-plan-cell',
                `tree-plan-cell--${entry?.action ?? 'default'}`,
              ].filter(Boolean).join(' ')}
              aria-label={`Slot ${slotIndex} — ${describeEntry(entry)}`}
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
              <strong>Slot {slotIndex}</strong>
              <span>{describeEntry(entry)}</span>
            </button>
          );
        })}
      </div>

      <div className="tree-plan-summary" aria-label="Tóm tắt kế hoạch vật nuôi">
        <span>◇ Mặc định: {summary.defaults}</span>
        <span>⛔ Không nuôi: {summary.skipped}</span>
        {[...summary.species].map(([speciesId, count]) => {
          const item = speciesById.get(speciesId);
          return (
            <span key={speciesId}>
              {item?.icon ?? '🐣'} {item?.name ?? `Loài #${speciesId}`}: {count}
            </span>
          );
        })}
      </div>
    </details>
  );
}
