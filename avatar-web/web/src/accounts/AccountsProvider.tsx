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

  // `status`, `auto`, `farm-sync` và metrics là sự kiện nhẹ, server đẩy về
  // không cần subscribe — đủ để các card tự cập nhật mà không phải hỏi lại API.
  useEffect(
    () =>
      onWsMessage((message) => {
        if (message.type === 'auto-disabled') {
          // Server tự tắt auto (sai mật khẩu game) — trạng thái DB đã đổi, hỏi lại.
          void reload();
          return;
        }
        if (
          message.type !== 'status'
          && message.type !== 'desired-connected'
          && message.type !== 'auto'
          && message.type !== 'farm-sync'
          && message.type !== 'metrics'
        ) return;
        setAccounts((current) =>
          current.map((account) => {
            if (account.id !== message.accountId || !account.runtime) return account;
            if (message.type === 'status') {
              return { ...account, runtime: { ...account.runtime, status: message.payload } };
            }
            if (message.type === 'desired-connected') {
              return {
                ...account,
                runtime: {
                  ...account.runtime,
                  desiredConnected: Boolean(message.payload),
                },
              };
            }
            if (message.type === 'auto') {
              return { ...account, runtime: { ...account.runtime, auto: message.payload } };
            }
            if (message.type === 'farm-sync') {
              return { ...account, runtime: { ...account.runtime, farmSync: message.payload } };
            }
            return {
              ...account,
              runtime: {
                ...account.runtime,
                xu: message.payload.xu ?? account.runtime.xu,
                money: message.payload.xu ?? account.runtime.money,
                luong: message.payload.luong ?? account.runtime.luong,
                luongKhoa: message.payload.luongKhoa ?? account.runtime.luongKhoa,
                playerLevel: message.payload.playerLevel ?? account.runtime.playerLevel,
                farmLevel: message.payload.farmLevel ?? account.runtime.farmLevel,
                metricsSyncedAt: message.payload.syncedAt ?? account.runtime.metricsSyncedAt,
              },
            };
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
