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
  onChange = vi.fn(),
}: {
  initialEntries?: TreeCellPlanEntry[];
  farmProfile?: FarmProfileDto;
  onChange?: (entries: TreeCellPlanEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initialEntries);
  return (
    <TreeCellPlanEditor
      profile={farmProfile}
      entries={entries}
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
    render(<ControlledEditor onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Hoa hồng/ }));
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
    render(<ControlledEditor onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Không trồng/ }));
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
    render(<ControlledEditor onChange={onChange} />);
    const firstCell = screen.getByRole('button', { name: /Ô 2/ });
    const secondCell = screen.getByRole('button', { name: /Ô 7/ });
    const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    const elementFromPoint = vi.fn(() => secondCell);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    });

    try {
      await user.click(screen.getByRole('button', { name: /Không trồng/ }));
      fireEvent.pointerDown(firstCell, { button: 0, isPrimary: true });
      // Touch implicit pointer capture keeps the PointerEvent target on firstCell.
      // The coordinates now sit above secondCell, so elementFromPoint must choose it.
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

  test('không có cache ô thì khóa editor và nút đồng bộ vẫn hoạt động', async () => {
    const onRefresh = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
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
        refreshing={false}
        onChange={onChange}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText(/chưa có cache ô farm/i)).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mặc định/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Không trồng/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Kết nối và đồng bộ farm/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('cache ô không có catalog vẫn sửa Default và Skip nhưng không cho chọn hạt mới', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledEditor farmProfile={profile([4, 21], [])} onChange={onChange} />);

    expect(screen.getByText(/catalog hạt chưa có trong cache/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^◇ Mặc định$/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Không trồng/ })).toBeEnabled();
    // Cache trống vẫn có default catalog — kiểm tra hạt KHÔNG có trong default (11) bị ẩn.
    expect(screen.queryByRole('button', { name: /Cây khế/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Không trồng/ }));
    await user.click(screen.getByRole('button', { name: /Ô 21/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 21, action: 'skip' }]);

    await user.click(screen.getByRole('button', { name: /^◇ Mặc định$/ }));
    await user.click(screen.getByRole('button', { name: /Ô 21/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test('đổi sang profile không có catalog vẫn giữ palette default của tài khoản trước', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const entries: TreeCellPlanEntry[] = [{ cellIndex: 2, action: 'skip' }];
    const { rerender } = render(
      <TreeCellPlanEditor
        profile={profile([2])}
        entries={entries}
        disabled={false}
        refreshing={false}
        onChange={onChange}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Hoa hồng/ }));
    rerender(
      <TreeCellPlanEditor
        profile={profile([2], [])}
        entries={entries}
        disabled={false}
        refreshing={false}
        onChange={onChange}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Ô 2/ }));

    // Default catalog vẫn cho phép chọn Hoa hồng — kế hoạch ghi hạt #6.
    expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 2, action: 'seed', seedId: 6 }]);
  });

  test('cache đầy đủ hiện timestamp cache, cảnh báo entry hỏng và tóm tắt kế hoạch', () => {
    render(
      <ControlledEditor
        farmProfile={profile([2, 7, 19])}
        initialEntries={[
          { cellIndex: 2, action: 'seed', seedId: 999 },
          { cellIndex: 7, action: 'skip' },
          { cellIndex: 99, action: 'seed', seedId: 6 },
        ]}
      />,
    );

    expect(screen.getByText(/Dữ liệu cache, không phải trực tiếp/i)).toBeInTheDocument();
    expect(screen.getByText(/Cache ô:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cache hạt:/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/2 mục kế hoạch không khớp cache/i);
    expect(screen.getByRole('button', { name: /Ô 2/ })).toHaveClass('tree-plan-cell--invalid');
    expect(screen.getByText(/Ô 99.*không có trong cache/i)).toHaveClass(
      'tree-plan-invalid-entry',
    );
    expect(screen.getByText(/Mặc định: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Không trồng: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Hạt không hợp lệ #999: 1/)).toBeInTheDocument();
  });
});
