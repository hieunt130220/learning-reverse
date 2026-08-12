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
    harvestAnimal: (idFarm: number, index: number): void => {
      this.calls.push(`harvestAnimal:${index}`);
    },
    sellAnimal: (idFarm: number, iddb: number): void => {
      this.calls.push(`sellAnimal:${iddb}`);
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

/** Chạy đúng một vòng rồi dừng — dùng chung cho các test vật nuôi bên dưới. */
async function runOneCycle(
  client: FakeClient,
  cfg: Parameters<AutoFarm['start']>[0],
): Promise<AutoFarm> {
  const auto = new AutoFarm(client as unknown as GameClient);
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ stepDelayMs: 300, ...cfg });
  await done;
  auto.stop();
  return auto;
}

test('thu hoạch sản phẩm vật nuôi khi numEggOne > 0, bỏ qua con chưa có sản phẩm', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(0, { species: 50, numEggOne: 3 }), // Gà, có 3 trứng
      animal(1, { species: 59, numEggOne: 0 }), // Rùa, không có sản phẩm
      animal(2, { species: 51, numEggOne: 1 }), // Bò, có sữa
    ],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, harvestAnimals: true });

  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('harvestAnimal:')),
    ['harvestAnimal:0', 'harvestAnimal:2'],
  );
});

test('mặc định KHÔNG bán vật nuôi — bán là thao tác không đảo ngược', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, harvestPer: 100 })], // Rùa đã lớn hẳn
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false });

  assert.equal(
    client.calls.some((c) => c.startsWith('sellAnimal:')),
    false,
  );
});

test('bán loài không có sản phẩm khi đã lớn, giữ loài chưa lớn và loài có sản phẩm', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(0, { species: 59, harvestPer: 100 }), // Rùa lớn -> bán
      animal(1, { species: 52, harvestPer: 60 }), // Heo chưa lớn -> giữ
      animal(2, { species: 54, harvestPer: 100 }), // Cá chép lớn -> bán
      animal(3, { species: 50, harvestPer: 100 }), // Gà (có sản phẩm) -> giữ
    ],
    updatedAt: Date.now(),
  });
  const auto = await runOneCycle(client, { harvest: false, sellAnimals: true });

  const sells = client.calls.filter((c) => c.startsWith('sellAnimal:'));
  // Duyệt từ index CAO xuống THẤP: bán con sau không làm xê dịch index con trước.
  assert.deepEqual(sells, ['sellAnimal:2', 'sellAnimal:0']);
  assert.equal(
    auto.state().lastActions.some((a) => a.includes('chưa biết bornTime')),
    true,
    'phải báo rõ vì sao chưa bán loài có sản phẩm',
  );
});

test('không bán con còn sản phẩm chưa thu — để vòng sau thu xong mới bán', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, harvestPer: 100, numEggOne: 2 })],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, sellAnimals: true, harvestAnimals: true });

  assert.ok(client.calls.includes('harvestAnimal:0'), 'phải thu hoạch trước');
  assert.equal(
    client.calls.some((c) => c.startsWith('sellAnimal:')),
    false,
    'còn sản phẩm thì chưa được bán',
  );
});

test('trần maxSellsPerCycle chặn số con bán mỗi vòng', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: Array.from({ length: 6 }, (_, i) => animal(i, { species: 59, harvestPer: 100 })),
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, sellAnimals: true, maxSellsPerCycle: 2 });

  assert.equal(client.calls.filter((c) => c.startsWith('sellAnimal:')).length, 2);
});

test('bornTime đổi giữa 2 vòng thì ghi lại delta để xác định chiều đếm', async () => {
  const farmState: FarmState = {
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 50, bornTime: 990 })],
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  const cycle1 = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ harvest: false, intervalMs: 400, stepDelayMs: 300 });
  await cycle1;
  // Vòng đầu chưa có mốc so sánh nên không ghi gì.
  assert.equal(
    auto.state().lastActions.some((a) => a.includes('[đo]')),
    false,
  );

  // Server đếm ngược 60 đơn vị trước vòng sau.
  farmState.animals[0]!.bornTime = 930;
  const cycle2 = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 1) resolve();
    }),
  );
  await cycle2;
  auto.stop();

  const probe = auto.state().lastActions.find((a) => a.includes('[đo]')) ?? '';
  assert.ok(probe, 'phải ghi lại thay đổi bornTime');
  assert.ok(probe.includes('990 -> 930'), `thiếu giá trị trước/sau: ${probe}`);
  assert.ok(probe.includes('-60'), `thiếu dấu delta: ${probe}`);
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
