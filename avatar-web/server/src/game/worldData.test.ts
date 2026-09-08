import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeParkJoinWorld } from './worldData.js';

test('decodeParkJoinWorld: giải mã park trống không có người chơi và mapMarker = -1', () => {
  // buffer:
  // roomId = 13 (i8) -> 1 byte
  // boardId = 0 (i8) -> 1 byte
  // x = 364 (i16) -> 2 bytes
  // y = 64 (i16) -> 2 bytes
  // playerCount = 0 (i8) -> 1 byte
  // mapMarker = -1 (0xFFFF, i16) -> 2 bytes
  // tổng = 9 bytes
  const buf = Buffer.alloc(9);
  let offset = 0;
  buf.writeInt8(13, offset++);
  buf.writeInt8(0, offset++);
  buf.writeInt16BE(364, offset); offset += 2;
  buf.writeInt16BE(64, offset); offset += 2;
  buf.writeInt8(0, offset++);
  buf.writeInt16BE(-1, offset); offset += 2;

  const snap = decodeParkJoinWorld(buf, 100);
  assert.equal(snap.roomId, 13);
  assert.equal(snap.boardId, 0);
  assert.equal(snap.x, 364);
  assert.equal(snap.y, 64);
  assert.equal(snap.playerId, 100);
});

test('decodeParkJoinWorld: giải mã park có người chơi kèm 17-byte player state tail', () => {
  // roomId = 14 (i8), boardId = 1 (i8), x = 460 (i16), y = 97 (i16)
  // playerCount = 1 (i8)
  // p0: id = 12345 (i32)
  // name = "test" (utf: 2 bytes len + 4 bytes)
  // partCount = 1 (i8), partId = 442 (i16)
  // state tail = 17 bytes (10 fields 15 bytes + idTitle 2 bytes)
  // mapMarker = -1 (0xFFFF, i16)
  const pName = Buffer.from('test', 'utf8');
  const size = 1 + 1 + 2 + 2 + 1 + (4 + 2 + pName.length + 1 + 2 + 17) + 2;
  const buf = Buffer.alloc(size);
  let offset = 0;

  buf.writeInt8(14, offset++);
  buf.writeInt8(1, offset++);
  buf.writeInt16BE(460, offset); offset += 2;
  buf.writeInt16BE(97, offset); offset += 2;

  buf.writeInt8(1, offset++); // 1 player
  buf.writeInt32BE(12345, offset); offset += 4;
  buf.writeUInt16BE(pName.length, offset); offset += 2;
  pName.copy(buf, offset); offset += pName.length;
  buf.writeInt8(1, offset++); // 1 part
  buf.writeInt16BE(442, offset); offset += 2;

  // 17 bytes player state tail
  offset += 17;

  // mapMarker = -1
  buf.writeInt16BE(-1, offset); offset += 2;

  const snap = decodeParkJoinWorld(buf, 12345);
  assert.equal(snap.roomId, 14);
  assert.equal(snap.boardId, 1);
  assert.equal(snap.x, 460);
  assert.equal(snap.y, 97);
  assert.equal(snap.playerId, 12345);
});

test('decodeParkJoinWorld: giải mã park có nhiều người chơi liên tiếp không bị lệch offset', () => {
  const p0Name = Buffer.from('player0', 'utf8');
  const p1Name = Buffer.from('player1', 'utf8');
  const player0Size = 4 + 2 + p0Name.length + 1 + 2 + 17;
  const player1Size = 4 + 2 + p1Name.length + 1 + 2 + 17;
  const size = 1 + 1 + 2 + 2 + 1 + player0Size + player1Size + 2;
  const buf = Buffer.alloc(size);
  let offset = 0;

  buf.writeInt8(13, offset++); // roomId
  buf.writeInt8(0, offset++);  // boardId
  buf.writeInt16BE(364, offset); offset += 2;
  buf.writeInt16BE(64, offset); offset += 2;

  buf.writeInt8(2, offset++); // 2 players

  // Player 0
  buf.writeInt32BE(1001, offset); offset += 4;
  buf.writeUInt16BE(p0Name.length, offset); offset += 2;
  p0Name.copy(buf, offset); offset += p0Name.length;
  buf.writeInt8(1, offset++); // 1 part
  buf.writeInt16BE(442, offset); offset += 2;
  offset += 17; // tail

  // Player 1
  buf.writeInt32BE(1002, offset); offset += 4;
  buf.writeUInt16BE(p1Name.length, offset); offset += 2;
  p1Name.copy(buf, offset); offset += p1Name.length;
  buf.writeInt8(1, offset++); // 1 part
  buf.writeInt16BE(443, offset); offset += 2;
  offset += 17; // tail

  buf.writeInt16BE(-1, offset); offset += 2; // mapMarker = -1

  const snap = decodeParkJoinWorld(buf, 1001);
  assert.equal(snap.roomId, 13);
  assert.equal(snap.boardId, 0);
  assert.equal(snap.x, 364);
  assert.equal(snap.y, 64);
  assert.equal(snap.playerId, 1001);
});

test('decodeParkJoinWorld: không sập khi danh sách player bị cắt cụt, vẫn giữ tọa độ snapshot', () => {
  // Snapshot có roomId/boardId/coords hợp lệ nhưng phần player bị cắt cụt
  const buf = Buffer.alloc(12);
  let offset = 0;
  buf.writeInt8(13, offset++);
  buf.writeInt8(0, offset++);
  buf.writeInt16BE(364, offset); offset += 2;
  buf.writeInt16BE(64, offset); offset += 2;
  buf.writeInt8(5, offset++); // Khai báo 5 player nhưng buffer hết
  buf.writeInt32BE(1001, offset); offset += 4;

  const snap = decodeParkJoinWorld(buf, 1001);
  assert.equal(snap.roomId, 13);
  assert.equal(snap.boardId, 0);
  assert.equal(snap.x, 364);
  assert.equal(snap.y, 64);
});
