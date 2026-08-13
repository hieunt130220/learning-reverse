import type { ClientStatus } from '../types.js';

export const statusLabel: Record<ClientStatus, string> = {
  idle: 'chưa kết nối',
  connecting: 'đang kết nối',
  handshaking: 'đang bắt tay',
  'logging-in': 'đang đăng nhập',
  online: 'đang online',
  error: 'lỗi',
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>;
}
