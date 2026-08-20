import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

import type { FarmProfileDto, TreeCellPlanEntry } from '../types.js';
import { TreeCellPlanEditor } from './TreeCellPlanEditor.js';

function profile(
  cellIndices: number[],
  seedCatalog: FarmProfileDto['seedCatalog'] = [
    { id: 6, name: 'Hoa hồng', growMinutes: 90, value: 240 },
    { id: 11, name: 'Cà chua', growMinutes: 30, value: 80 },
  ],
): FarmProfileDto {
  return {
    farmId: 17,
    cellIndices,
    barnAnimalSlots: [],
    pondAnimalSlots: [],
    seedCatalog,
    cellsObservedAt: 1_775_680_200_000,
    seedsObservedAt: 1_775_680_260_000,
    updatedAt: 1_775_680_260_000,
  };
}

function ControlledEditor({
  initialEntries = [],
  farmProfile = profile([2, 7, 19]),
  cellIndices,
  onChange = vi.fn(),
}: {
  initialEntries?: TreeCellPlanEntry[];
  farmProfile?: FarmProfileDto;
  cellIndices?: number[];
  onChange?: (entries: TreeCellPlanEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initialEntries);
  return (
    <TreeCellPlanEditor
      profile={farmProfile}
      entries={entries}
      cellIndices={cellIndices}
      disabled={false}
      refreshing={false}
      onChange={(next) => {
        onChange(next);
        setEntries(next);
      }}
      onRefresh={vi.fn()}
    />
  );
}

describe('TreeCellPlanEditor', () => {
  test('click và keyboard áp palette đang chọn mà không phát onChange trùng', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledEditor onChange={onChange} cellIndices={[2, 7, 19]} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn trạng thái để tô' }), 'seed:6');
    await user.click(screen.getByRole('button', { name: /Ô 2/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 2, action: 'seed', seedId: 6 }]);

    screen.getByRole('button', { name: /Ô 7/ }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith([
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'seed', seedId: 6 },
    ]);

    await user.click(screen.getByRole('button', { name: /Ô 7/ }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test('pointer paint tô các ô thật không liền nhau và dừng ở pointerup', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledEditor onChange={onChange} cellIndices={[2, 7, 19]} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn trạng thái để tô' }), 'skip');
    fireEvent.pointerDown(screen.getByRole('button', { name: /Ô 2/ }), {
      button: 0,
      isPrimary: true,
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Ô 2/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.pointerOver(screen.getByRole('button', { name: /Ô 7/ }));
    fireEvent.pointerOver(screen.getByRole('button', { name: /Ô 19/ }));
    fireEvent.pointerUp(window);

    expect(onChange).toHaveBeenLastCalledWith([
      { cellIndex: 2, action: 'skip' },
      { cellIndex: 7, action: 'skip' },
      { cellIndex: 19, action: 'skip' },
    ]);

    const callsAfterPointerUp = onChange.mock.calls.length;
    fireEvent.pointerOver(screen.getByRole('button', { name: /Ô 7/ }));
    fireEvent.pointerOver(screen.getByRole('button', { name: /Ô 19/ }));
    expect(onChange).toHaveBeenCalledTimes(callsAfterPointerUp);
    expect(screen.queryByRole('button', { name: /Ô 48/ })).not.toBeInTheDocument();
  });

  test('pointer capture vẫn tô ô nằm dưới tọa độ chạm bằng hit-test', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledEditor onChange={onChange} cellIndices={[2, 7, 19]} />);
    const firstCell = screen.getByRole('button', { name: /Ô 2/ });
    const secondCell = screen.getByRole('button', { name: /Ô 7/ });
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    const elementFromPoint = vi.fn(() => secondCell);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    });

    try {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn trạng thái để tô' }), 'skip');
      fireEvent.pointerDown(firstCell, { button: 0, isPrimary: true });
      const pointerMove = createEvent.pointerMove(firstCell, { isPrimary: true });
      Object.defineProperties(pointerMove, {
        clientX: { value: 70 },
        clientY: { value: 20 },
      });
      fireEvent(firstCell, pointerMove);
      fireEvent.pointerUp(window);

      expect(elementFromPoint).toHaveBeenCalledWith(70, 20);
      expect(onChange).toHaveBeenLastCalledWith([
        { cellIndex: 2, action: 'skip' },
        { cellIndex: 7, action: 'skip' },
      ]);

      const callsAfterPointerUp = onChange.mock.calls.length;
      fireEvent(firstCell, pointerMove);
      expect(elementFromPoint).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(callsAfterPointerUp);
    } finally {
      if (originalElementFromPoint === undefined) {
        Reflect.deleteProperty(document, 'elementFromPoint');
      } else {
        Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
      }
    }
  });

  test('không có cache profile thì editor vẫn hiển thị đầy đủ 48 ô và seed catalog mặc định', async () => {
    const onChange = vi.fn();
    render(
      <TreeCellPlanEditor
        profile={{
          farmId: null,
          cellIndices: [],
          barnAnimalSlots: [],
          pondAnimalSlots: [],
          seedCatalog: [],
          cellsObservedAt: null,
          seedsObservedAt: null,
          updatedAt: null,
        }}
        entries={[]}
        disabled={false}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ô 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ô 47/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ô 48/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^◇ Mặc định$/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /⛔ Không trồng/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Lúa/ })).toBeInTheDocument();
  });

  test('cache không có catalog vẫn có đầy đủ hạt từ DEFAULT_SEED_CATALOG và tô màu ô được', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledEditor farmProfile={profile([4, 21], [])} onChange={onChange} />);

    expect(screen.getByRole('option', { name: /^◇ Mặc định$/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Không trồng/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Lúa/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn trạng thái để tô' }), 'skip');
    await user.click(screen.getByRole('button', { name: /Ô 21/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 21, action: 'skip' }]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn trạng thái để tô' }), 'default');
    await user.click(screen.getByRole('button', { name: /Ô 21/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test('cảnh báo entry hỏng và tóm tắt kế hoạch', () => {
    render(
      <ControlledEditor
        farmProfile={profile([2, 7, 19])}
        initialEntries={[
          { cellIndex: 2, action: 'seed', seedId: 9999 },
          { cellIndex: 7, action: 'skip' },
          { cellIndex: 99, action: 'seed', seedId: 6 },
        ]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/2 mục kế hoạch không khớp danh mục/i);
    expect(screen.getByRole('button', { name: /^Ô 2 —/ })).toHaveClass('tree-plan-cell--invalid');
    expect(screen.getByText(/Ô 99.*không hợp lệ/i)).toHaveClass('tree-plan-invalid-entry');
    expect(screen.getByText(/Mặc định: 46/)).toBeInTheDocument();
    expect(screen.getByText(/Không trồng: 1/)).toBeInTheDocument();
  });
});
