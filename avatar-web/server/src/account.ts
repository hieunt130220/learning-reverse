import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tài khoản test đọc từ `avatar-web/account`, một dòng `user/pass`.
 *
 * ⚠ File này chứa mật khẩu dạng rõ. Nó nằm ngoài thư mục server và không được
 * phục vụ qua HTTP; đừng commit nếu sau này khởi tạo git.
 */
const ACCOUNT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../account',
);

export interface Account {
  user: string;
  pass: string;
}

export function readAccount(): Account | null {
  try {
    const raw = fs.readFileSync(ACCOUNT_FILE, 'utf8').trim();
    const i = raw.indexOf('/');
    if (i <= 0) return null;
    return { user: raw.slice(0, i).trim(), pass: raw.slice(i + 1).trim() };
  } catch {
    return null;
  }
}

/** Server mặc định — chỉ .120 xử lý đăng nhập, xem notes/protocol.md. */
export const DEFAULT_SERVER = { host: '27.0.14.120', port: 19129 };
