export interface WsMessage {
  type: string;
  accountId: number;
  payload: any;
}

type Listener = (msg: WsMessage) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let subscribed: number[] = [];
let reconnectTimer: number | undefined;

/**
 * Một kết nối WS dùng chung cho cả ứng dụng. Mở mỗi trang một socket thì mỗi
 * lần đổi route là một lần bắt tay lại, và server phải nhân bản mọi sự kiện.
 */
export function connectWs(): void {
  if (socket && socket.readyState <= WebSocket.OPEN) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  socket = ws;

  ws.onopen = () => sendSubscribe();
  ws.onmessage = (ev) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    for (const fn of listeners) fn(msg);
  };
  ws.onclose = () => {
    socket = null;
    // Server restart hoặc mạng chớp — thử lại, đừng bắt người dùng F5.
    if (reconnectTimer === undefined) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connectWs();
      }, 3000);
    }
  };
}

function sendSubscribe(): void {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ op: 'subscribe', accountIds: subscribed }));
}

/** Đặt lại danh sách tài khoản đang mở trang chi tiết. Mảng rỗng = chỉ nhận sự kiện nhẹ. */
export function subscribeAccounts(ids: number[]): void {
  subscribed = ids;
  sendSubscribe();
}

export function onWsMessage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
