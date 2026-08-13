import { useEffect, useState } from 'react';

import type { SessionSnapshot } from '../types.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import { reduceAccountRuntime } from './accountRuntime.js';

/**
 * Chỉ nơi nào đang thực sự xem một tài khoản mới đăng ký sự kiện nặng (log, gói
 * tin, farm). Mount thì subscribe đúng id đó, unmount thì trả về mảng rỗng.
 */
export function useAccountRuntime(
  accountId: number,
  initialSnapshot: SessionSnapshot | null,
): SessionSnapshot | null {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    subscribeAccounts([accountId]);
    const removeListener = onWsMessage((message) => {
      setSnapshot((current) => reduceAccountRuntime(accountId, current, message));
    });

    return () => {
      removeListener();
      subscribeAccounts([]);
    };
    // `initialSnapshot` cố tình đứng ngoài deps: provider vẫn vá status/auto vào
    // danh sách, và reset theo object mới sẽ xoá log/traffic đã tích luỹ ở đây.
    // Snapshot mới thật sự đến qua event `snapshot`.
  }, [accountId]);

  return snapshot;
}
