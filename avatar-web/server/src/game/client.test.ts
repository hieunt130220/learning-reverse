import test from 'node:test';
import assert from 'node:assert/strict';

import { Message } from '../proto/message.js';
import { MyWriter } from '../proto/writer.js';
import { GameClient, parseTemporaryLoginRejection } from './client.js';
import { FARM_PACKET_69_HEX } from './farmData.fixture.js';

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

test('parse thông báo tài khoản đang đăng nhập hoặc quá tải', () => {
  assert.equal(
    parseTemporaryLoginRejection('Tài khoản này đang đăng nhập. Xin hãy thử đăng nhập lại.')?.retryAfterMs,
    10_000,
  );
  assert.equal(
    parseTemporaryLoginRejection('Hệ thống quá tải, xin vui lòng thử lại sau.')?.retryAfterMs,
    10_000,
  );
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

test('INFO_ANIMAL cập nhật đúng con theo số slot, không theo vị trí mảng', () => {
  const client = new GameClient();
  client.session.emit('message', Message.fromData(69, Buffer.from(FARM_PACKET_69_HEX, 'hex')));

  // Gói mẫu có 4 slot trống đầu tiên, nên con ở slot 4 nằm ở vị trí mảng 0.
  // Đánh theo vị trí mảng là ghi nhầm sang slot 8.
  const body = new MyWriter()
    .writeByte(4) // slot
    .writeByte(50)
    .writeInt(2853)
    .writeByte(55) // máu tụt sau khi bị bệnh
    .writeByte(100)
    .writeByte(0)
    .writeBoolean(false)
    .writeBoolean(false)
    .writeBoolean(false)
    .getData();
  client.session.emit('message', Message.fromData(101, body));

  const animals = client.farmState!.animals;
  assert.equal(animals.find((a) => a.index === 4)?.health, 55);
  assert.equal(animals.find((a) => a.index === 8)?.health, 100);
  assert.equal(animals.length, 12);
});

test('waitForReply true khi gói cmd về trong hạn', async () => {
  const client = new GameClient();
  const pending = client.waitForReply(65, 500);
  client.session.emit('message', Message.fromData(65, Buffer.from([0, 0, 0])));
  assert.equal(await pending, true);
});

test('waitForReply false khi server im lặng hết thời gian', async () => {
  const client = new GameClient();
  assert.equal(await client.waitForReply(66, 30), false);
});
