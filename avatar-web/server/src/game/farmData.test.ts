import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyFarmSlots, decodeFarmData, isCellRipe } from './farmData.js';
import { FARM_PACKET_69_HEX } from './farmData.fixture.js';

const packet = Buffer.from(FARM_PACKET_69_HEX, 'hex');

test('slot vật nuôi trống chỉ chiếm 1 byte sentinel, không có bản ghi theo sau', () => {
  const farm = decodeFarmData(packet);

  // Gói khai 16 SLOT, nhưng 4 slot đầu là -1 (4 con Rùa vừa bán) nên chỉ còn
  // 12 con thật. Người dùng xác nhận trong game: đúng 12 con.
  assert.equal(farm.animals.length, 12);
  assert.equal(farm.animalSlots.length, 16);
  assert.deepEqual(farm.animalSlots, Array.from({ length: 16 }, (_, i) => i));
  // Gói này: 12 con Gà (#50) đều ở slot 4–15, không con ao nào → mặc định 4 slot
  // ao đầu (0–3) theo quy ước, 12 slot chuồng còn lại (4–15).
  assert.deepEqual(farm.pondAnimalSlots, [0, 1, 2, 3]);
  assert.deepEqual(farm.barnAnimalSlots, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
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
  // Cờ bệnh: 3 con cúm, 7 con tiêu chảy (người dùng xác nhận có con đang bệnh).
  assert.equal(farm.animals.filter((a) => a.hasFlu).length, 3);
  assert.equal(farm.animals.filter((a) => a.hasDiarrhea).length, 7);
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

/**
 * Điều kiện chín ĐO ĐƯỢC trên farm thật, không suy đoán. Gói mẫu chụp lúc
 * 02:44:16 ngày 2026-08-13, cây trồng là Lúa (#6, `growMinutes = 48` — trường
 * này đơn vị GIỜ, xem `TreeInfo`), tức ngưỡng 48 × 60 = 2880 phút.
 *
 * Ba quan sát độc lập kẹp lấy ngưỡng:
 *   - ô 44 `time=2836` — thử thu, server IM LẶNG
 *   - ô 45 `time=2938` — thu được, server trả cmd 64 "Chúc mừng bạn đã nhận"
 *   - ô 41 `time=2697` lúc chụp; 638 phút sau (13:22) người dùng thấy nó đã chín
 *     trong game, lúc đó `time` = 3335
 * Ngưỡng nằm trong (2836, 2938] và 2880 rơi đúng vào khoảng đó.
 */
const LUA_GROW_HOURS = 48;

test('lúc chụp gói, chỉ ô 45 đủ thời gian lớn — khớp đúng thứ thu được trên server', () => {
  const farm = decodeFarmData(packet);
  const ripe = farm.cells.filter((c) => isCellRipe(c, LUA_GROW_HOURS)).map((c) => c.index);
  assert.deepEqual(ripe, [45]);
});

test('ngưỡng chín là mốc growHours × 60, không phải hervestPer', () => {
  const base = {
    index: 0, idTree: 6, vitalityPer: 100, hervestPer: 0,
    isArid: false, isWorm: false, isGrass: false,
  };
  // 2836 = ô 44 đã thử thu và server im lặng.
  assert.equal(isCellRipe({ ...base, time: 2836 }, LUA_GROW_HOURS), false);
  assert.equal(isCellRipe({ ...base, time: 2879 }, LUA_GROW_HOURS), false);
  assert.equal(isCellRipe({ ...base, time: 2880 }, LUA_GROW_HOURS), true);
  // 3335 = ô 41 tại thời điểm người dùng thấy nó chín trong game.
  assert.equal(isCellRipe({ ...base, time: 3335 }, LUA_GROW_HOURS), true);
});

test('ô trống hoặc vừa thu xong thì không chín dù thời gian lớn', () => {
  const grown = {
    index: 0, vitalityPer: 100, hervestPer: 0,
    isArid: false, isWorm: false, isGrass: false,
  };
  assert.equal(isCellRipe({ ...grown, idTree: -1, time: 9999 }, LUA_GROW_HOURS), false);
  assert.equal(isCellRipe({ ...grown, idTree: 6, time: -1 }, LUA_GROW_HOURS), false);
});

test('classifyFarmSlots: có con ao thật thì ranh giới là sau slot ao cao nhất', () => {
  // 20 slot, ao mở lên 5 slot: con ao (Rùa #59) ở slot 4 (slot 5 mới, chưa nuôi).
  const state = {
    animalSlots: Array.from({ length: 20 }, (_, i) => i),
    animals: [
      { index: 4, species: 59 },
      { index: 7, species: 50 },
    ],
  } as unknown as Parameters<typeof classifyFarmSlots>[0];
  classifyFarmSlots(state);
  assert.deepEqual(state.pondAnimalSlots, [0, 1, 2, 3, 4]);
  assert.deepEqual(state.barnAnimalSlots, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});

test('classifyFarmSlots: chưa có con ao nào thì mặc định 4 slot ao đầu', () => {
  const state = {
    animalSlots: Array.from({ length: 12 }, (_, i) => i),
    animals: [
      { index: 4, species: 50 },
      { index: 5, species: 50 },
    ],
  } as unknown as Parameters<typeof classifyFarmSlots>[0];
  classifyFarmSlots(state);
  assert.deepEqual(state.pondAnimalSlots, [0, 1, 2, 3]);
  assert.deepEqual(state.barnAnimalSlots, [4, 5, 6, 7, 8, 9, 10, 11]);
});

test('chưa có bảng cây thì không đoán bừa, chỉ tin hervestPer', () => {
  const base = {
    index: 0, idTree: 6, vitalityPer: 100,
    isArid: false, isWorm: false, isGrass: false,
  };
  // Không biết cây lớn bao lâu -> `time` lớn cỡ nào cũng không kết luận được.
  assert.equal(isCellRipe({ ...base, time: 9999, hervestPer: 0 }, undefined), false);
  assert.equal(isCellRipe({ ...base, time: 10, hervestPer: 20 }, undefined), true);
});
