import { Router, type RequestHandler } from 'express';

import { makeRequireAuth, type AuthedRequest } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import type { SessionManager } from '../session/manager.js';
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
  type AvatarAccount,
} from './repo.js';

export interface AccountsDeps {
  db: Db;
  masterKey: Buffer;
  isProduction: boolean;
  sessions: SessionManager;
}

export interface AccountRequest extends AuthedRequest {
  account?: AvatarAccount;
}

/**
 * Nạp tài khoản theo `:id` VÀ theo `user_id` của người đang đăng nhập.
 *
 * Trả 404 chứ không 403 cho tài khoản của người khác: xác nhận "id này có tồn
 * tại" cũng là rò rỉ. Mọi route đụng vào `:id` phải đi qua đây.
 */
export function requireOwnedAccount(db: Db): RequestHandler {
  return (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
    const user = (req as AuthedRequest).user!;
    const account = getAccount(db, user.id, id);
    if (!account) return res.status(404).json({ error: 'không có tài khoản này' });
    (req as AccountRequest).account = account;
    next();
  };
}

export function accountsRouter(deps: AccountsDeps): Router {
  const { db, masterKey, isProduction, sessions } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));
  const owned = requireOwnedAccount(db);

  router.get('/', (req, res) => {
    const user = (req as AuthedRequest).user!;
    res.json(
      listAccounts(db, user.id).map((account) => ({
        ...account,
        runtime: sessions.snapshot(account.id),
      })),
    );
  });

  router.post('/', (req, res) => {
    const { label, gameUser, gamePass, host, port, device } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'thiếu nhãn' });
    }
    if (typeof gameUser !== 'string' || !gameUser.trim()) {
      return res.status(400).json({ error: 'thiếu tài khoản game' });
    }
    if (typeof gamePass !== 'string' || gamePass === '') {
      return res.status(400).json({ error: 'thiếu mật khẩu game' });
    }
    const user = (req as AuthedRequest).user!;
    res.json(
      createAccount(db, masterKey, {
        userId: user.id,
        label: label.trim(),
        gameUser: gameUser.trim(),
        gamePass,
        host: typeof host === 'string' && host.trim() ? host.trim() : undefined,
        port: port === undefined || port === '' ? undefined : Number(port),
        device: (device ?? undefined) as Partial<DeviceProfile> | undefined,
      }),
    );
  });

  router.patch('/:id', owned, (req, res) => {
    const user = (req as AuthedRequest).user!;
    const { label, gameUser, gamePass, host, port, device } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    const updated = updateAccount(db, masterKey, user.id, (req as AccountRequest).account!.id, {
      label: typeof label === 'string' ? label.trim() : undefined,
      gameUser: typeof gameUser === 'string' ? gameUser.trim() : undefined,
      // Chuỗi rỗng nghĩa là "không đổi" — repo đã xử lý, nhưng nói rõ ở đây để
      // đọc route là biết hợp đồng.
      gamePass: typeof gamePass === 'string' && gamePass !== '' ? gamePass : undefined,
      host: typeof host === 'string' && host.trim() ? host.trim() : undefined,
      port: port === undefined || port === '' ? undefined : Number(port),
      device: device === null ? null : (device as Partial<DeviceProfile> | undefined),
    });
    res.json(updated);
  });

  router.delete('/:id', owned, (req, res) => {
    const user = (req as AuthedRequest).user!;
    const id = (req as AccountRequest).account!.id;
    // Dừng phiên TRƯỚC: xoá bản ghi trước sẽ để lại một socket TCP không còn
    // tài khoản nào để đọc lại mật khẩu khi cần kết nối lại.
    sessions.destroy(id);
    deleteAccount(db, user.id, id);
    res.json({ ok: true });
  });

  return router;
}
