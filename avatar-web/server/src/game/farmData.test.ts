import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyFarmSlots, decodeFarmData, isCellRipe, decodeAllTreeInfo, parseAnimalSpec, decodeInventory, decodeLoginSuccessMoney, decodeMoney, decodeCreCharacter } from './farmData.js';
import { MyWriter } from '../proto/writer.js';
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

test('decodeAllTreeInfo rút đúng thông tin cây trồng mở rộng', () => {
  const str = Buffer.from('Dưa Leo', 'utf8');
  const buf = Buffer.alloc(8000);
  buf.writeUInt16BE(0, 0); // 0 cây xu

  const duaLeoPos = 5500;
  buf.writeUInt8(43, duaLeoPos - 3);
  buf.writeUInt16BE(str.length, duaLeoPos - 2);
  str.copy(buf, duaLeoPos);
  const attrStart = duaLeoPos + str.length;
  buf.writeInt16BE(2, attrStart); // s(0) = 2 giờ lớn
  buf.writeInt16BE(10, attrStart + 2); // s(1) = 10
  buf.writeInt16BE(50, attrStart + 10);

  const trees = decodeAllTreeInfo(buf);
  const duaLeo = trees.find((t) => t.name === 'Dưa Leo');
  assert.ok(duaLeo);
  assert.equal(duaLeo.growMinutes, 2);
  assert.equal(duaLeo.category, 'premium');
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

test('parseAnimalSpec: parse đúng chu kỳ sản phẩm từ desc', () => {
  const gaDesc = 'Thời gian lớn : 1 ngày - Bán : 950 xu - Sản phẩm : 20 trứng gà sau mỗi 6 giờ - Thời gian sống: 7 ngày';
  const gaSpec = parseAnimalSpec(gaDesc);
  assert.equal(gaSpec.growMinutes, 1440);
  assert.equal(gaSpec.lifeMinutes, 10080);
  assert.equal(gaSpec.productCycleMinutes, 360);
  assert.equal(gaSpec.hasProduct, true);

  const deDesc = 'Thời gian lớn : 1 ngày - Bán : 1200 xu - Sản phẩm : 40 sữa sau mỗi 4 giờ - Thời gian sống: 10 ngày';
  const deSpec = parseAnimalSpec(deDesc);
  assert.equal(deSpec.productCycleMinutes, 240);
  assert.equal(deSpec.hasProduct, true);

  const cuuDesc = 'Thời gian lớn : 2 ngày - Bán : 1500 xu - Sản phẩm : 20 lông sau mỗi 12 giờ - Thời gian sống: 10 ngày';
  const cuuSpec = parseAnimalSpec(cuuDesc);
  assert.equal(cuuSpec.productCycleMinutes, 720);
  assert.equal(cuuSpec.hasProduct, true);

  const heoDesc = 'Thời gian lớn : 2 ngày - Bán : 800 xu - Không  có sản phẩm - Thời gian sống: 20 ngày';
  const heoSpec = parseAnimalSpec(heoDesc);
  assert.equal(heoSpec.productCycleMinutes, undefined);
  assert.equal(heoSpec.hasProduct, false);
});

test('decodeInventory: giải mã hạt, vật phẩm và xu từ 12 byte đuôi gói 70', () => {
  // Gói 70 mẫu: 1 loại hạt (#6 x 45), 1 loại vật phẩm (#123 x 99), 2 section sau rỗng, đuôi 12 byte chứa xu = 473574 (0x000737e6)
  const buf = Buffer.alloc(1 + 6 + 1 + 6 + 1 + 1 + 12);
  let pos = 0;
  // Section 1 (hạt): 1 loại
  buf.writeInt8(1, pos++);
  buf.writeInt16BE(6, pos); pos += 2;
  buf.writeInt32BE(45, pos); pos += 4;
  // Section 2 (vật phẩm): 1 loại
  buf.writeInt8(1, pos++);
  buf.writeInt16BE(123, pos); pos += 2;
  buf.writeInt32BE(99, pos); pos += 4;
  // Section 3 (nông sản): 0 loại
  buf.writeInt8(0, pos++);
  // Section 4: 0 loại
  buf.writeInt8(0, pos++);
  // Đuôi 12 byte: i32 xu = 473574, farmLevel = 15, perLvFarm = 50, levelStore = 2, capacityStore = 500
  buf.writeInt32BE(473574, pos); pos += 4;
  buf.writeInt16BE(15, pos); pos += 2;
  buf.writeInt8(50, pos++);
  buf.writeInt8(2, pos++);
  buf.writeInt32BE(500, pos); pos += 4;

  const inv = decodeInventory(buf);
  assert.equal(inv.seeds.length, 1);
  assert.deepEqual(inv.seeds[0], { id: 6, num: 45 });
  assert.equal(inv.items.length, 1);
  assert.deepEqual(inv.items[0], { id: 123, num: 99 });
  assert.equal(inv.xu, 473574);
  assert.equal(inv.farmLevel, 15);
  assert.equal(inv.perLvFarm, 50);
  assert.equal(inv.levelStore, 2);
  assert.equal(inv.capacityStore, 500);
});

test('decodeLoginSuccessMoney: lấy xu, lượng mở và lượng khoá từ gói -34 thật', () => {
  // Gói LOGIN_SUCESS bắt được sau login tài khoản #1. Các danh sách chức năng
  // trong phần trước ví có count động; decoder phải đi qua chúng trước khi đọc
  // 3 i32 tiền ở handler GlobalMessageHandler.
  const body = Buffer.from(
    '01000f5669000a596575616e686c696e680b02146500000860650000173d64001b4e67c3a0792068e1babf742068e1baa16e203a382d392d32303236173c64001b4e67c3a0792068e1babf742068e1baa16e203a382d392d32303236005664001c4e67c3a0792068e1babf742068e1baa16e203a31382d382d323032360004650000173a64001b4e67c3a0792068e1babf742068e1baa16e203a382d392d32303236024f3c001c4e67c3a0792068e1babf742068e1baa16e203a32362d382d32303236006a65000011ff64001b4e67c3a0792068e1babf742068e1baa16e203a342d392d3230323601ba39001c4e67c3a0792068e1babf742068e1baa16e203a32312d382d323032360121440002e4936100543f1100000151ff2ae701000c4368e1bba963206ec4836e67000202005c000a54c3a0692078e1bb897504d8000024000948e1bab96e2048c3b204480101010021ffff010000000000000000000000015101ffff0000ffff0000ffffffffffff',
    'hex',
  );

  assert.deepEqual(decodeLoginSuccessMoney(body), {
    xu: 189_587,
    luong: 0,
    luongKhoa: 337,
  });
});

test('decodeMoney: gói -3 dạng ngắn 3 trường (delta, type, balance) theo farm.md', () => {
  // Gói thật trong farm.md: fffffffb 01 000737e1 = delta -5, type 1 (xu), còn 473569.
  const w = new MyWriter();
  w.writeInt(-5);
  w.writeByte(1);
  w.writeInt(473_569);

  const m = decodeMoney(w.getData());
  assert.equal(m.delta, -5);
  assert.equal(m.type, 1);
  assert.equal(m.xu, 473_569);
  // Gói ngắn chỉ mang đúng loại tiền `type`; các loại còn lại là chưa biết.
  assert.equal(m.luong, undefined);
  assert.equal(m.luongKhoa, undefined);
  assert.equal(m.balance, 473_569);
});

test('decodeMoney: gói ngắn type 2 không ghi đè xu về 0', () => {
  // Mua bằng lượng chỉ đẩy số dư lượng (type 2), không kèm số dư xu.
  // Các trường khác phải là undefined để consumer không ghi đè sai.
  const w = new MyWriter();
  w.writeInt(-10);
  w.writeByte(2);
  w.writeInt(1_234); // số dư lượng mở hiện tại

  const m = decodeMoney(w.getData());
  assert.equal(m.type, 2);
  assert.equal(m.luong, 1_234);
  assert.equal(m.xu, undefined, 'xu không được ép về 0 khi gói không mang nó');
  assert.equal(m.luongKhoa, undefined);
  assert.equal(m.balance, 1_234);
});

test('decodeMoney: gói ngắn type 3 chỉ mang lượng khoá', () => {
  const w = new MyWriter();
  w.writeInt(50);
  w.writeByte(3);
  w.writeInt(337);

  const m = decodeMoney(w.getData());
  assert.equal(m.luongKhoa, 337);
  assert.equal(m.xu, undefined);
  assert.equal(m.luong, undefined);
  assert.equal(m.balance, 337);
});

test('decodeMoney: gói -3 dạng đủ 5 trường gán xu, lượng mở và lượng khoá', () => {
  const w = new MyWriter();
  w.writeInt(-20);
  w.writeByte(2);
  w.writeInt(500_000);   // xu
  w.writeInt(1_234);     // lượng mở
  w.writeInt(337);       // lượng khoá

  const m = decodeMoney(w.getData());
  assert.equal(m.delta, -20);
  assert.equal(m.type, 2);
  assert.equal(m.xu, 500_000);
  assert.equal(m.luong, 1_234);
  assert.equal(m.luongKhoa, 337);
  // Tương thích ngược: type 2 là lượng mở.
  assert.equal(m.balance, 1_234);
});

test('decodeCreCharacter: giải mã gói -5 với xu, lượng mở và lượng khoá', () => {
  // Layout đã xác minh từ handler CRE_CHARACTER @0x5ed598:
  // id, name, gender(byte), nPart(byte)+parts×i16, xu(setMoney), luong(setGold),
  // skip(+0x2c), luongKhoa(+0x90).
  const w = new MyWriter();
  w.writeInt(42);            // id
  w.writeUTF('devios');      // name
  w.writeByte(0);            // gender
  w.writeByte(2);            // nPart
  w.writeShort(101);         // part
  w.writeShort(202);         // part
  w.writeInt(189_587);       // xu
  w.writeInt(0);             // lượng mở
  w.writeInt(123);           // +0x2c (bỏ qua)
  w.writeInt(337);           // lượng khoá

  const c = decodeCreCharacter(w.getData());
  assert.ok(c, 'nhân vật phải decode được');
  assert.equal(c!.id, 42);
  assert.equal(c!.name, 'devios');
  assert.equal(c!.xu, 189_587);
  assert.equal(c!.luong, 0);
  assert.equal(c!.luongKhoa, 337);
});

test('decodeCreCharacter: phần trang phục nhiều items vẫn lấy đúng ví', () => {
  const w = new MyWriter();
  w.writeInt(7);
  w.writeUTF('nv');
  w.writeByte(1);
  w.writeByte(3);            // 3 bộ phận
  w.writeShort(10);
  w.writeShort(20);
  w.writeShort(30);
  w.writeInt(500_000);       // xu
  w.writeInt(12_345);        // lượng mở
  w.writeInt(0);             // skip
  w.writeInt(1);             // lượng khoá

  const c = decodeCreCharacter(w.getData());
  assert.ok(c);
  assert.equal(c!.xu, 500_000);
  assert.equal(c!.luong, 12_345);
  assert.equal(c!.luongKhoa, 1);
});

test('decodeCreCharacter: id <= 0 trả null — không nhầm gói lạ thành nhân vật', () => {
  const w = new MyWriter();
  w.writeInt(-1);
  assert.equal(decodeCreCharacter(w.getData()), null);
});

test('decodeCreCharacter: body thiếu trường ví không tràn buffer, fallback về 0', () => {
  const w = new MyWriter();
  w.writeInt(7);
  w.writeUTF('ab');
  w.writeByte(0);
  w.writeByte(0);            // 0 bộ phận
  w.writeInt(100);           // xu
  // thiếu lượng / skip / lượng khoá

  const c = decodeCreCharacter(w.getData());
  assert.ok(c);
  assert.equal(c!.xu, 100);
  assert.equal(c!.luong, 0);
  assert.equal(c!.luongKhoa, 0);
});
