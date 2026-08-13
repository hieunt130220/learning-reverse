import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { apiGet } from '../api.js';
import type { AccountWithRuntime } from '../types.js';
import { onWsMessage } from '../ws.js';

export interface AccountsContextValue {
  accounts: AccountWithRuntime[];
  loading: boolean;
  error: string;
  reload(): Promise<void>;
}

const AccountsContext = createContext<AccountsContextValue | null>(null);

/**
 * Route cha của cả dashboard, drawer và Debug. Giữ danh sách ở đây thì mở/đóng
 * drawer không phải gọi lại `GET /api/accounts` chỉ để dựng lại nền phía sau.
 */
export function AccountsProvider() {
  const [accounts, setAccounts] = useState<AccountWithRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setAccounts(await apiGet<AccountWithRuntime[]>('/api/accounts'));
      setError('');
    } catch (cause) {
      // Giữ nguyên danh sách cũ: mất mạng một nhịp không đáng làm trống dashboard.
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void reload(), [reload]);

  // `status` và `auto` là sự kiện nhẹ, server đẩy về không cần subscribe — đủ để
  // các card tự cập nhật mà không phải hỏi lại API.
  useEffect(
    () =>
      onWsMessage((message) => {
        if (message.type === 'auto-disabled') {
          // Server tự tắt auto (sai mật khẩu game) — trạng thái DB đã đổi, hỏi lại.
          void reload();
          return;
        }
        if (message.type !== 'status' && message.type !== 'auto') return;
        setAccounts((current) =>
          current.map((account) => {
            if (account.id !== message.accountId || !account.runtime) return account;
            return message.type === 'status'
              ? { ...account, runtime: { ...account.runtime, status: message.payload } }
              : { ...account, runtime: { ...account.runtime, auto: message.payload } };
          }),
        );
      }),
    [reload],
  );

  const value = useMemo(
    () => ({ accounts, loading, error, reload }),
    [accounts, loading, error, reload],
  );

  return (
    <AccountsContext.Provider value={value}>
      <Outlet />
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const context = useContext(AccountsContext);
  if (!context) throw new Error('useAccounts phải nằm trong AccountsProvider');
  return context;
}
