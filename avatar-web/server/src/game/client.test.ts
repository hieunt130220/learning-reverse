import test from 'node:test';
import assert from 'node:assert/strict';

import { Message } from '../proto/message.js';
import { MyWriter } from '../proto/writer.js';
import { GameClient, parseTemporaryLoginRejection } from './client.js';

function incomingUtf(command: number, text: string): Message {
  return Message.fromData(command, new MyWriter().writeUTF(text).getData());
}

test('parse số giây từ thông báo đăng nhập lại', () => {
  assert.deepEqual(
    parseTemporaryLoginRejection('Hệ thống quá tải. Vui lòng đăng nhập lại sau 10s'),
    {
      reason: 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 10s',
      retryAfterMs: 10_000,
    },
  );
});

test('đăng nhập quá nhanh không có số dùng tối thiểu 10 giây', () => {
  assert.equal(
    parseTemporaryLoginRejection('Bạn đang đăng nhập quá nhanh. Vui lòng chờ')?.retryAfterMs,
    10_000,
  );
  assert.equal(parseTemporaryLoginRejection('Bảo trì lúc 22h'), null);
});

test('gói -40 phát temporary-rejection có cấu trúc', () => {
  const client = new GameClient();
  const events: unknown[] = [];
  client.on('temporary-rejection', (value) => events.push(value));
  client.session.emit(
    'message',
    incomingUtf(-40, 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 30s'),
  );
  assert.deepEqual(events, [
    {
      reason: 'Hệ thống quá tải. Vui lòng đăng nhập lại sau 30s',
      retryAfterMs: 30_000,
    },
  ]);
});

test('close metadata được log mà không có credential', () => {
  const client = new GameClient();
  client.status = 'online';
  const logs: string[] = [];
  client.on('log', (line) => logs.push(line));
  client.session.emit('closed', {
    kind: 'remote-end',
    hadError: false,
    host: '27.0.14.120',
    port: 19129,
    startedAt: 1_000,
    connectedAt: 1_100,
    closedAt: 2_200,
    lastDataAt: 1_900,
    lifetimeMs: 1_200,
    bytesRead: 256,
    bytesWritten: 128,
  });
  assert.match(logs.at(-1) ?? '', /remote-end/);
  assert.match(logs.at(-1) ?? '', /27\.0\.14\.120:19129/);
  assert.match(logs.at(-1) ?? '', /1200ms/);
  assert.match(logs.at(-1) ?? '', /rx=256B/);
  assert.match(logs.at(-1) ?? '', /trạng thái=online/);
  assert.doesNotMatch(logs.join('\n'), /password|gamePass|LOGIN_ACC/);
});

test('traffic của LOGIN_ACC tiếp tục ẩn body', () => {
  const client = new GameClient();
  const traffic: Array<{ hex: string }> = [];
  client.on('traffic', (entry) => traffic.push(entry));
  client.session.emit('traffic', 'tx', -33, Buffer.from('mat-khau', 'utf8'));
  assert.equal(traffic[0].hex, '<đã ẩn>');
});
