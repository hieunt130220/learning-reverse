import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { AutoFarm } from './autoFarm.js';
import { ITEM_GRASS, ITEM_TONIC, ITEM_WATER } from './game/farmData.js';
import type { GameClient } from './game/client.js';
import type { FarmAnimal, FarmCell, FarmState } from './game/farmData.js';

function cell(index: number, overrides: Partial<FarmCell> = {}): FarmCell {
  return {
    index,
    idTree: 0,
    time: 0,
    vitalityPer: 100,
    hervestPer: 0,
    isArid: false,
    isWorm: false,
    isGrass: false,
    ...overrides,
  };
}

function animal(index: number, overrides: Partial<FarmAnimal> = {}): FarmAnimal {
  return {
    index,
    species: 50,
    bornTime: 0,
    health: 100,
    harvestPer: 0,
    numEggOne: 0,
    hunger: false,
    flag20: false,
    flag21: false,
    ...overrides,
  };
}

/**
 * GameClient giả: đủ bề mặt để `AutoFarm` chạy một vòng thật, không mở socket
 * nào. `enterFarm`/`getInventory` tự phát lại 'farm'/'inventory' ở microtask
 * kế tiếp, giống hành vi thật (server trả lời gần như ngay).
 */
class FakeClient extends EventEmitter {
  status = 'online';
  farmState: FarmState;
  inventory: { id: number; num: number }[] = [];
  items: { id: number; price: number }[] = [];
  readonly calls: string[] = [];

  readonly farm = {
    getInventory: (): void => {
      this.calls.push('getInventory');
      queueMicrotask(() => this.emit('inventory', this.inventory));
    },
    useItem: (idFarm: number, index: number, idItem: number): void => {
      this.calls.push(`useItem:${index}:${idItem}`);
    },
    harvest: (idFarm: number, index: number): void => {
      this.calls.push(`harvest:${index}`);
    },
    buyItem: (id: number, num: number): void => {
      this.calls.push(`buy:${id}x${num}`);
    },
    plantSeed: (): void => {
      this.calls.push('plantSeed');
    },
  };

  constructor(farmState: FarmState) {
    super();
    this.farmState = farmState;
  }

  enterFarm(): void {
    this.calls.push('enterFarm');
    queueMicrotask(() => this.emit('farm', this.farmState));
  }
}

function manyAridCells(n: number): FarmCell[] {
  return Array.from({ length: n }, (_, i) => cell(i, { isArid: true }));
}

test('vòng đầu tiên chỉ gửi tối đa maxActionsPerCycle lệnh dù tồn đọng nhiều ô', async () => {
  const farmState: FarmState = { idFarm: 1, cells: manyAridCells(40), animals: [], updatedAt: Date.now() };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  // start() gọi stop() nội bộ trước — phát 'state' {cycle:0} ngay lập tức.
  // Chờ vòng thật (cycle > 0) hoàn tất, không phải sự kiện dọn dẹp đó.
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, maxActionsPerCycle: 5, stepDelayMs: 300 });
  await done;

  const waterCalls = client.calls.filter((c) => c.startsWith(`useItem:`) && c.endsWith(`:${ITEM_WATER}`));
  assert.equal(waterCalls.length, 5);
  assert.equal(auto.state().lastActions.some((a) => a.includes('trần 5 lệnh/vòng')), true);
  auto.stop(); // dọn timer 2 phút cho vòng kế tiếp — không thì test process không thoát được
});

test('không tồn đọng thì không bị trần chặn', async () => {
  const farmState: FarmState = {
    idFarm: 1,
    cells: [cell(0, { isArid: true }), cell(1)],
    animals: [],
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  // start() gọi stop() nội bộ trước — phát 'state' {cycle:0} ngay lập tức.
  // Chờ vòng thật (cycle > 0) hoàn tất, không phải sự kiện dọn dẹp đó.
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, maxActionsPerCycle: 20, stepDelayMs: 300 });
  await done;

  const waterCalls = client.calls.filter((c) => c.startsWith('useItem:') && c.endsWith(`:${ITEM_WATER}`));
  assert.equal(waterCalls.length, 1);
  assert.equal(auto.state().lastActions.some((a) => a.includes('trần')), false);
  auto.stop();
});

test('stop() giữa vòng không bị trần lệnh ghi đè — vẫn dừng ngay, không có lần thử sau', async () => {
  const farmState: FarmState = { idFarm: 1, cells: manyAridCells(10), animals: [], updatedAt: Date.now() };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  auto.start({ waterItemId: ITEM_WATER, harvest: false, maxActionsPerCycle: 100, stepDelayMs: 300 });
  // Để vòng chạy một chút (đã gửi vài lệnh) rồi dừng giữa chừng.
  await new Promise((r) => setTimeout(r, 350));
  auto.stop();
  assert.equal(auto.state().running, false);

  const callsAtStop = client.calls.length;
  assert.ok(callsAtStop > 0, 'phải đã gửi ít nhất một lệnh trước khi dừng');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(client.calls.length, callsAtStop, 'không gửi thêm lệnh nào sau stop()');
});

test('thu hoạch/trồng/chữa bệnh không bị việc chăm sóc ô (nhổ cỏ) chiếm hết trần lệnh', async () => {
  // Ô chín cần thu hoạch, ô trống cần trồng, rồi một loạt ô cần nhổ cỏ —
  // trước fix, nhổ cỏ nằm trước thu hoạch/trồng trong vòng lặp nên chiếm hết
  // maxActionsPerCycle, khiến thu hoạch/trồng/chữa bệnh không bao giờ chạy.
  const farmState: FarmState = {
    idFarm: 1,
    cells: [
      cell(0, { idTree: 5, time: 0 }), // sẵn sàng thu hoạch
      cell(1, { idTree: -1 }), // trống, cần trồng
      // time: 100 (chưa chín) để không lẫn vào điều kiện thu hoạch.
      ...Array.from({ length: 5 }, (_, i) => cell(2 + i, { isGrass: true, time: 100 })),
    ],
    animals: [animal(0, { health: 80 })], // thiếu 20 máu = 1 liều thuốc bổ
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({
    harvest: true,
    seedId: 5,
    healAnimals: true,
    minHealth: 100,
    grassItemId: ITEM_GRASS,
    maxActionsPerCycle: 3, // đúng bằng thu hoạch(1) + trồng(1) + 1 liều thuốc bổ(1)
    stepDelayMs: 300,
  });
  await done;

  assert.ok(client.calls.includes('harvest:0'), 'phải thu hoạch ô 0');
  assert.ok(client.calls.includes('plantSeed'), 'phải trồng lại ô trống');
  assert.ok(
    client.calls.includes(`useItem:0:${ITEM_TONIC}`),
    'phải chữa bệnh cho vật nuôi 0',
  );
  assert.equal(
    client.calls.some((c) => c.endsWith(`:${ITEM_GRASS}`)),
    false,
    'nhổ cỏ phải nhường chỗ cho thu hoạch/trồng/chữa bệnh khi hết trần lệnh',
  );
  auto.stop();
});
