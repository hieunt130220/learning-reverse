import type { SessionSnapshot } from '../types.js';
import type { WsMessage } from '../ws.js';

/**
 * Gộp một sự kiện WebSocket vào snapshot đang hiển thị. Hàm thuần để drawer và
 * trang Debug dùng chung một cách xử lý, thay vì mỗi trang chép lại một switch.
 */
export function reduceAccountRuntime(
  accountId: number,
  current: SessionSnapshot | null,
  message: WsMessage,
): SessionSnapshot | null {
  if (message.accountId !== accountId) return current;
  if (message.type === 'snapshot') return message.payload as SessionSnapshot;
  // Event lẻ chỉ vá một trường; chưa có snapshot thì không đủ dữ liệu để dựng.
  if (!current) return current;

  switch (message.type) {
    case 'status':
      return { ...current, status: message.payload };
    case 'auto':
      return { ...current, auto: message.payload };
    case 'macro':
      return { ...current, macro: message.payload };
    case 'farm':
      return { ...current, farm: message.payload };
    case 'farm-sync':
      return { ...current, farmSync: message.payload };
    case 'inventory':
      return { ...current, inventory: message.payload };
    case 'money':
      return { ...current, money: message.payload.balance ?? current.money };
    case 'trees':
      return {
        ...current,
        trees: message.payload.trees ?? [],
        items: message.payload.items ?? [],
        animals: message.payload.animals ?? [],
      };
    case 'cooking':
      return { ...current, cooking: message.payload };
    case 'log':
      return { ...current, logs: [...current.logs.slice(-499), message.payload] };
    case 'traffic':
      return { ...current, traffic: [...current.traffic.slice(-299), message.payload] };
    default:
      return current;
  }
}
