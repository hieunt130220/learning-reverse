import crypto from 'node:crypto';
import http from 'node:http';

import type { Express } from 'express';

import { openDb, type Db } from './db/index.js';

/** DB trong RAM đã migrate — mỗi test một cái, không dọn dẹp gì thêm. */
export function newTestDb(): Db {
  return openDb(':memory:');
}

/** Khoá 32 byte cố định cho test không cần ngẫu nhiên. */
export const TEST_KEY = crypto.createHash('sha256').update('test-master-key').digest();

export interface TestResponse {
  status: number;
  body: any;
  /** Giá trị `set-cookie` thô, để khẳng định HttpOnly/SameSite. */
  cookies: string[];
}

export interface TestServer {
  url: string;
  close(): Promise<void>;
  /**
   * `fetch` giữ cookie giữa các lần gọi — mô phỏng một trình duyệt, vì luồng
   * đăng nhập rồi gọi API chỉ có nghĩa khi cookie được mang theo.
   */
  fetch(path: string, init?: RequestInit & { json?: unknown }): Promise<TestResponse>;
  /** Xoá cookie đang giữ — mô phỏng trình duyệt khác. */
  clearCookies(): void;
}

export async function startTestServer(app: Express): Promise<TestServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}`;
  const jar = new Map<string, string>();

  return {
    url,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
    clearCookies() {
      jar.clear();
    },
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers);
      if (init.json !== undefined) headers.set('content-type', 'application/json');
      if (jar.size > 0) {
        headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      const res = await fetch(`${url}${path}`, {
        ...init,
        headers,
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      });
      const cookies = res.headers.getSetCookie();
      for (const c of cookies) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const name = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        if (value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const text = await res.text();
      return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
        cookies,
      };
    },
  };
}
