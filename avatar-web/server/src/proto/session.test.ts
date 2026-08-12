import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { Session, type SessionCloseInfo } from './session.js';

async function listen(handler: (socket: net.Socket) => void): Promise<net.Server> {
  const server = net.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

function portOf(server: net.Server): number {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function nextClose(session: Session): Promise<SessionCloseInfo> {
  return new Promise((resolve) => session.once('closed', resolve));
}

test('peer gửi FIN được phân loại remote-end', async () => {
  const server = await listen((socket) => socket.end(Buffer.from([1, 0, 0])));
  const session = new Session();
  session.on('error', () => {});
  const closed = nextClose(session);
  await session.connect('127.0.0.1', portOf(server));
  const info = await closed;

  assert.equal(info.kind, 'remote-end');
  assert.equal(info.hadError, false);
  assert.ok(info.bytesRead >= 3);
  assert.ok(info.connectedAt);
  assert.ok(info.closedAt >= info.startedAt);
  assert.equal(info.lifetimeMs, info.closedAt - info.startedAt);
  await closeServer(server);
});

test('Session.close được phân loại local-close và chỉ phát closed một lần', async () => {
  const server = await listen(() => {});
  const session = new Session();
  const events: SessionCloseInfo[] = [];
  session.on('closed', (info) => events.push(info));
  await session.connect('127.0.0.1', portOf(server));
  session.close();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'local-close');
  assert.equal(events[0].hadError, false);
  await closeServer(server);
});

test('connect tới port đã đóng giữ socket-error metadata', async () => {
  const holder = await listen(() => {});
  const port = portOf(holder);
  await closeServer(holder);

  const session = new Session();
  const errors: Error[] = [];
  session.on('error', (err) => errors.push(err));
  const closed = nextClose(session);
  await assert.rejects(session.connect('127.0.0.1', port));
  const info = await closed;

  assert.equal(info.kind, 'socket-error');
  assert.equal(info.hadError, true);
  assert.ok(errors.length >= 1);
  assert.equal(info.error?.code, 'ECONNREFUSED');
  assert.equal(info.error?.syscall, 'connect');
});
