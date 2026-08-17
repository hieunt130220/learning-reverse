import type http from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import { getAccount } from './accounts/repo.js';
import { authenticateCookieHeader } from './auth/middleware.js';
import type { Db } from './db/index.js';
import type { SessionManager } from './session/manager.js';

/**
 * Sự kiện nhẹ: đẩy cho mọi client của chủ sở hữu, kể cả khi họ đang ở trang
 * danh sách — đó là thứ làm cho bảng trạng thái tự cập nhật.
 * Mọi sự kiện khác là nặng (traffic, log, farm, inventory…) và chỉ tới client
 * đang mở trang chi tiết của đúng tài khoản đó.
 */
export const LIGHT_EVENTS = new Set(['status', 'auto', 'auto-disabled', 'farm-sync']);

export interface WsHub {
  broadcast(userId: number, accountId: number, type: string, payload: unknown): void;
  clientCount(): number;
  close(): void;
}

interface Client {
  ws: WebSocket;
  userId: number;
  subscriptions: Set<number>;
}

export function attachWebSocket(
  server: http.Server,
  deps: { db: Db; sessions: SessionManager },
): WsHub {
  const { db, sessions } = deps;
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<Client>();

  const send = (ws: WebSocket, type: string, accountId: number, payload: unknown) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type, accountId, payload }));
    } catch {
      /* client đang đóng — bỏ qua */
    }
  };

  wss.on('connection', (ws, req) => {
    // WS không đi qua middleware Express; xác thực bằng chính cookie đó.
    const user = authenticateCookieHeader(db, req.headers.cookie);
    if (!user) return ws.close(4401, 'chưa đăng nhập');

    const client: Client = { ws, userId: user.id, subscriptions: new Set() };
    clients.add(client);

    ws.on('message', (raw) => {
      let msg: { op?: string; accountIds?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.op !== 'subscribe' || !Array.isArray(msg.accountIds)) return;

      client.subscriptions.clear();
      for (const value of msg.accountIds) {
        const id = Number(value);
        // Kiểm quyền ở đây nữa: không dựa vào việc giao diện không hiển thị id lạ.
        if (!Number.isInteger(id) || !getAccount(db, client.userId, id)) continue;
        client.subscriptions.add(id);
        send(ws, 'snapshot', id, sessions.snapshot(id));
      }
    });

    ws.on('error', () => ws.close());
    ws.on('close', () => clients.delete(client));
  });

  return {
    broadcast(userId, accountId, type, payload) {
      const light = LIGHT_EVENTS.has(type);
      for (const c of clients) {
        if (c.userId !== userId) continue;
        if (!light && !c.subscriptions.has(accountId)) continue;
        send(c.ws, type, accountId, payload);
      }
    },
    clientCount() {
      return clients.size;
    },
    close() {
      for (const c of clients) c.ws.close();
      clients.clear();
      wss.close();
    },
  };
}
