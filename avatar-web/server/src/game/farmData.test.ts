import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeFarmData } from './farmData.js';
import { FARM_PACKET_69_HEX } from './farmData.fixture.js';

const packet = Buffer.from(FARM_PACKET_69_HEX, 'hex');

test('slot vật nuôi trống chỉ chiếm 1 byte sentinel, không có bản ghi theo sau', () => {
  const farm = decodeFarmData(packet);

  // Gói khai 16 SLOT, nhưng 4 slot đầu là -1 (4 con Rùa vừa bán) nên chỉ còn
  // 12 con thật. Người dùng xác nhận trong game: đúng 12 con.
  assert.equal(farm.animals.length, 12);
});

test('vật nuôi giữ số slot làm index, không dồn mảng sau khi bán', () => {
  const farm = decodeFarmData(packet);

  // Server giữ chỗ trống chứ không dồn mảng, và `index` trong lệnh bán/cho ăn
  // là số slot. Dồn lại ở client là bắn lệnh nhầm con.
  assert.deepEqual(
    farm.animals.map((a) => a.index),
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  );
});

test('đọc đúng trường của vật nuôi sau slot trống', () => {
  const farm = decodeFarmData(packet);

  // Cả 12 con đều là Gà (#50) full máu — khớp những gì người dùng thấy trong game.
  assert.deepEqual([...new Set(farm.animals.map((a) => a.species))], [50]);
  assert.deepEqual([...new Set(farm.animals.map((a) => a.health))], [100]);
  assert.deepEqual([...new Set(farm.animals.map((a) => a.harvestPer))], [100]);
  assert.equal(
    farm.animals.every((a) => !a.hunger),
    true,
  );
  // Cờ bệnh: 7 con f20, 10 con f21 (người dùng xác nhận có con đang bệnh).
  assert.equal(farm.animals.filter((a) => a.flag20).length, 3);
  assert.equal(farm.animals.filter((a) => a.flag21).length, 7);
});

test('sau vật nuôi, phần đuôi khớp đúng nCell byte level rồi hết gói', () => {
  const farm = decodeFarmData(packet);

  // Đây là bằng chứng khoá cho toàn bộ bố cục: lệch một byte ở phần vật nuôi
  // là 46 con số này vỡ ngay.
  assert.equal(farm.cells.length, 46);
  assert.deepEqual(
    farm.cells.map((c) => c.level),
    new Array(46).fill(1),
  );
  assert.equal(farm.tailHex, 'ffffffff000001');
});
