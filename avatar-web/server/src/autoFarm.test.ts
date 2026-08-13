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
  /** Bảng vật nuôi (cmd 76) — `desc` là nguồn tuổi lớn/tuổi thọ. */
  animals: { id: number; name: string; desc: string }[] = [
    { id: 50, name: 'Gà', desc: 'Thời gian lớn : 1 ngày - Sản phẩm : 20 trứng gà sau mỗi 6 giờ - Thời gian sống: 7 ngày' },
    { id: 52, name: 'Heo', desc: 'Thời gian lớn : 2 ngày - Không  có sản phẩm - Thời gian sống: 20 ngày' },
    { id: 59, name: 'Rùa', desc: 'Thời gian lớn : 1 ngày - Không có sản phẩm - Thời gian sống: 15 ngày' },
  ];
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
    getTreeInfo: (): void => {
      this.calls.push('getTreeInfo');
      queueMicrotask(() => this.emit('trees', { animals: this.animals }));
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

test('một vòng làm hết việc tồn đọng, không còn trần lệnh', async () => {
  // 6 ô × 4 việc (tưới, nhổ cỏ, bắt sâu, bón phân) = 24 lệnh, vượt trần mặc
  // định cũ là 20. Ít hơn 20 lệnh thì test xanh sẵn và không chứng minh được gì.
  const farmState: FarmState = {
    idFarm: 1,
    cells: Array.from({ length: 6 }, (_, i) =>
      cell(i, { idTree: 5, time: 100, isArid: true, isGrass: true, isWorm: true, vitalityPer: 50 }),
    ),
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
  auto.start({
    harvest: false,
    waterItemId: ITEM_WATER,
    grassItemId: ITEM_GRASS,
    wormItemId: 124,
    fertilizeCells: true,
    minVitality: 100,
    stepDelayMs: 300,
    startDelayMs: 0,
  });
  await done;
  // Dừng TRƯỚC khi assert: assert hỏng sẽ ném, và timer 2 phút của vòng kế tiếp
  // còn sống thì test runner treo thay vì báo lỗi.
  auto.stop();

  assert.equal(
    client.calls.filter((c) => c.startsWith('useItem:')).length,
    24,
    'phải làm hết 24 việc trong một vòng, không bị cắt ở 20',
  );
  assert.equal(
    auto.state().lastActions.some((a) => a.includes('trần')),
    false,
    'không còn dòng báo đạt trần lệnh',
  );
});

test('stop() giữa vòng vẫn dừng ngay, không có lần thử sau', async () => {
  const farmState: FarmState = { idFarm: 1, cells: manyAridCells(4), animals: [], updatedAt: Date.now() };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  // Để vòng chạy một chút (đã gửi vài lệnh) rồi dừng giữa chừng.
  await new Promise((r) => setTimeout(r, 350));
  auto.stop();
  assert.equal(auto.state().running, false);

  const callsAtStop = client.calls.length;
  assert.ok(callsAtStop > 0, 'phải đã gửi ít nhất một lệnh trước khi dừng');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(client.calls.length, callsAtStop, 'không gửi thêm lệnh nào sau stop()');
});

test('startDelayMs hoãn vòng đầu để phiên kịp ổn định, stop() trong lúc chờ thì không chạy', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true })],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 400 });

  // Chưa tới hạn: chưa được gửi gì cả.
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(client.calls, [], 'không được bắn lệnh trước khi hết startDelayMs');

  await new Promise((r) => setTimeout(r, 600));
  assert.ok(client.calls.includes('enterFarm'), 'hết hạn thì phải chạy vòng đầu');
  auto.stop();

  // Dừng trong lúc còn đang chờ thì vòng đầu không bao giờ chạy.
  const c2 = new FakeClient({ idFarm: 1, cells: [], animals: [], updatedAt: Date.now() });
  const a2 = new AutoFarm(c2 as unknown as GameClient);
  a2.start({ harvest: false, stepDelayMs: 300, startDelayMs: 5000 });
  a2.stop();
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(c2.calls, [], 'stop() lúc đang chờ phải huỷ luôn vòng đầu');
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
  auto.start({ stepDelayMs: 300, startDelayMs: 0, ...cfg });
  await done;
  auto.stop();
  return auto;
}

test('chỉ thu hoạch ô có hervestPer > 0, không đụng ô non và ô vừa thu (time=-1)', async () => {
  // Số liệu lấy nguyên từ farm thật: `time` đếm LÊN (phút kể từ lúc trồng) nên
  // ô `time=501` vẫn còn non, còn ô 43 `time=2978 hervestPer=20` mới thu được.
  // Ô vừa thu xong mang `time=-1 hervestPer=100` và server từ chối thu lại.
  const client = new FakeClient({
    idFarm: 1,
    cells: [
      cell(0, { idTree: 6, time: 501, hervestPer: 0 }), // non — server bỏ qua
      cell(1, { idTree: 6, time: 2978, hervestPer: 20 }), // chín thật
      cell(2, { idTree: 6, time: -1, hervestPer: 100 }), // vừa thu, đừng bắn lại
      cell(3, { idTree: 6, time: 415, hervestPer: 0 }), // non
    ],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = await runOneCycle(client, { harvest: true });

  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('harvest:')),
    ['harvest:1'],
  );
  assert.ok(
    auto.state().lastActions.some((a) => a.includes('1 chín')),
    `dòng [quét] phải đếm đúng 1 ô chín: ${JSON.stringify(auto.state().lastActions)}`,
  );
});

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

  // Giai đoạn vật nuôi duyệt index giảm dần để lệnh bán không trỏ nhầm con.
  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('harvestAnimal:')),
    ['harvestAnimal:2', 'harvestAnimal:0'],
  );
});

test('mặc định KHÔNG bán vật nuôi — bán là thao tác không đảo ngược', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, bornTime: 99999 })], // Rùa đã quá tuổi lớn
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false });

  assert.equal(
    client.calls.some((c) => c.startsWith('sellAnimal:')),
    false,
  );
});

test('bán loài không sản phẩm khi đã quá tuổi lớn, giữ con chưa lớn', async () => {
  // Tuổi lớn lấy từ desc: Rùa 1 ngày = 1440 phút, Heo 2 ngày = 2880 phút.
  // `bornTime` là số phút đã sống (đo được: đếm lên +1 mỗi 60 giây).
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(0, { species: 59, bornTime: 1836 }), // Rùa 1,3 ngày > 1 ngày -> bán
      animal(1, { species: 52, bornTime: 1000 }), // Heo 0,7 ngày < 2 ngày -> giữ
      animal(2, { species: 59, bornTime: 100 }), // Rùa còn non -> giữ
      animal(3, { species: 52, bornTime: 4000 }), // Heo 2,8 ngày > 2 ngày -> bán
    ],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, sellAnimals: true });

  // Duyệt từ index CAO xuống THẤP: bán con sau không xê dịch index con trước.
  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('sellAnimal:')),
    ['sellAnimal:3', 'sellAnimal:0'],
  );
});

test('loài có sản phẩm chỉ bán khi đã sống quá nearDeathRatio của tuổi thọ', async () => {
  // Gà: tuổi thọ 7 ngày = 10080 phút; ngưỡng 0,9 -> 9072 phút.
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(0, { species: 50, bornTime: 2220 }), // 1,5 ngày — còn lâu, giữ
      animal(1, { species: 50, bornTime: 9500 }), // 6,6 ngày — gần hết đời, bán
    ],
    updatedAt: Date.now(),
  });
  const auto = await runOneCycle(client, { harvest: false, sellAnimals: true });

  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('sellAnimal:')),
    ['sellAnimal:1'],
  );
  assert.ok(
    auto.state().lastActions.some((a) => a.includes('gần hết đời')),
    'phải ghi rõ lý do bán',
  );
});

test('không có bảng vật nuôi thì KHÔNG bán con nào', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, bornTime: 99999 })],
    updatedAt: Date.now(),
  });
  client.animals = []; // server chưa trả bảng loài
  client.farm.getTreeInfo = (): void => {
    client.calls.push('getTreeInfo');
  }; // không phát 'trees'
  const auto = await runOneCycle(client, { harvest: false, sellAnimals: true });

  assert.equal(
    client.calls.some((c) => c.startsWith('sellAnimal:')),
    false,
    'thiếu tuổi lớn/tuổi thọ thì thà bỏ lỡ còn hơn bán nhầm',
  );
  assert.ok(auto.state().lastActions.some((a) => a.includes('chưa có bảng vật nuôi')));
});

test('không bán con còn sản phẩm chưa thu — để vòng sau thu xong mới bán', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, bornTime: 99999, numEggOne: 2 })],
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
    animals: Array.from({ length: 6 }, (_, i) => animal(i, { species: 59, bornTime: 99999 })),
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

test('mỗi dòng ghi vào lastActions cũng phát ra sự kiện log', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true })],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));

  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  assert.ok(logs.length > 0, 'phải phát ít nhất một dòng log');
  assert.deepEqual(logs, auto.state().lastActions, 'log và lastActions phải cùng một nguồn');
});


test('ô không có việc vẫn tốn một nhịp nghỉ', async () => {
  // 4 ô rỗng việc: cận dưới 4 × 300ms. Không đo cận trên để khỏi phụ thuộc máy.
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0), cell(1), cell(2), cell(3)],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );

  const startedAt = Date.now();
  auto.start({ harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();
  const elapsed = Date.now() - startedAt;

  assert.ok(elapsed >= 4 * 300, `vòng phải nghỉ ít nhất 4 nhịp, đo được ${elapsed}ms`);
});

test('mỗi ô đã duyệt sinh đúng một dòng log, kể cả ô không có việc', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true }), cell(1)],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  // Đúng một dòng cho mỗi ô cũng là bằng chứng mỗi ô chỉ được chạm một lượt:
  // hai vòng lặp ô cũ sẽ sinh hai dòng cho cùng một ô.
  const cellLines = logs.filter((l) => l.startsWith('[cây] '));
  assert.equal(cellLines.length, 2, `mỗi ô một dòng: ${JSON.stringify(cellLines)}`);
  assert.ok(cellLines[0].includes('ô 0:') && cellLines[0].includes('tưới'), cellLines[0]);
  assert.ok(cellLines[1].includes('ô 1: không có việc'), cellLines[1]);
});

test('làm hết cây rồi mới tới vật nuôi', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true }), cell(1, { isArid: true })],
    animals: [animal(0, { hunger: true }), animal(1, { hunger: true })],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, waterItemId: ITEM_WATER, feedAnimals: true });

  const useItems = client.calls.filter((c) => c.startsWith('useItem:'));
  const isWater = useItems.map((c) => c.endsWith(`:${ITEM_WATER}`));
  const lastWater = isWater.lastIndexOf(true);
  const firstFood = isWater.indexOf(false);
  assert.ok(lastWater >= 0 && firstFood >= 0, `thiếu lệnh: ${JSON.stringify(useItems)}`);
  assert.ok(lastWater < firstFood, `mọi lệnh cây phải đứng trước lệnh vật nuôi: ${JSON.stringify(useItems)}`);
});

test('mỗi con đã duyệt sinh đúng một dòng log, kể cả con không có việc', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 50, hunger: true }), animal(1, { species: 50 })],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ harvest: false, feedAnimals: true, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  const lines = logs.filter((l) => l.startsWith('[vật nuôi] '));
  assert.equal(lines.length, 2, `mỗi con một dòng: ${JSON.stringify(lines)}`);
  assert.ok(lines[0].includes('1 (Gà): không có việc'), lines[0]);
  assert.ok(lines[1].includes('0 (Gà)') && lines[1].includes('cho ăn'), lines[1]);
});

test('không tốn thuốc và thức ăn cho con sắp bán', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, bornTime: 99999, health: 20, hunger: true })],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, {
    harvest: false,
    sellAnimals: true,
    healAnimals: true,
    feedAnimals: true,
    minHealth: 100,
  });

  assert.ok(client.calls.includes('sellAnimal:0'), 'phải bán con đã quá tuổi lớn');
  assert.equal(
    client.calls.some((c) => c.startsWith('useItem:')),
    false,
    'con đã bán thì không chữa bệnh, không cho ăn',
  );
});
