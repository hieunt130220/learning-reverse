import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

import { AddAccountModal } from './AddAccountModal.js';

const api = vi.hoisted(() => ({ apiPost: vi.fn() }));
vi.mock('../api.js', () => api);

function Harness({ reload = vi.fn().mockResolvedValue(undefined) }: { reload?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở thêm tài khoản</button>
      <AddAccountModal open={open} onClose={() => setOpen(false)} reload={reload} />
    </>
  );
}

test('mở modal, focus Nhãn, Escape đóng và trả focus về trigger', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Mở thêm tài khoản' });
  await user.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Thêm tài khoản' })).toBeInTheDocument();
  expect(screen.getByLabelText('Nhãn')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('API lỗi giữ modal và dữ liệu đã nhập', async () => {
  api.apiPost.mockRejectedValue(new Error('không tạo được'));
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  await user.type(screen.getByLabelText('Nhãn'), 'Farm mới');
  await user.type(screen.getByLabelText('Tài khoản game'), 'avatar02');
  await user.type(screen.getByLabelText('Mật khẩu game'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Thêm' }));
  expect(await screen.findByText('không tạo được')).toBeInTheDocument();
  expect(screen.getByLabelText('Nhãn')).toHaveValue('Farm mới');
});

test('thành công đóng modal, reset form và reload đúng một lần', async () => {
  api.apiPost.mockResolvedValue({ id: 2 });
  const reload = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<Harness reload={reload} />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  await user.type(screen.getByLabelText('Nhãn'), 'Farm mới');
  await user.type(screen.getByLabelText('Tài khoản game'), 'avatar02');
  await user.type(screen.getByLabelText('Mật khẩu game'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Thêm' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.apiPost).toHaveBeenCalledWith('/api/accounts', {
    label: 'Farm mới', gameUser: 'avatar02', gamePass: 'secret',
  });
  expect(reload).toHaveBeenCalledOnce();
});

test('Tab không thoát ra ngoài modal', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Mở thêm tài khoản' }));
  const close = screen.getByRole('button', { name: 'Đóng' });
  close.focus();
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  expect(screen.getByRole('button', { name: 'Thêm' })).toHaveFocus();
});
