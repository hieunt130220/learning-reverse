/**
 * Probe vào nông trại của bạn bè (Friend Farm Probe):
 * - Nếu có `--friend <id>`: Chỉ thăm và chăm sóc farm của người bạn đó.
 * - Nếu không có `--friend`: Tự động lặp qua tất cả bạn bè trong FriendList và chăm sóc cây trồng + vật nuôi.
 *
 * Các hành động chăm sóc:
 * - Cây trồng:
 *   + Hạn (isArid): Tưới nước (item 100 - miễn phí)
 *   + Sâu (isWorm): Diệt sâu (item 124 - Thuốc trừ sâu 5 xu, tự mua nếu thiếu)
 *   + Cỏ (isGrass): Nhổ cỏ (item 123 - Thuốc diệt cỏ 5 xu, tự mua nếu thiếu)
 * - Vật nuôi:
 *   + Đói (hunger): Cho ăn theo loài (item 116..119, 1 xu/gói, tự mua nếu thiếu)
 *   + Máu yếu (health < 100): Dùng thuốc bổ (item 122 - 25 xu)
 *
 * Chạy:
 *   npx tsx --env-file=.env src/tools/friend-farm-probe.ts
 *   npx tsx --env-file=.env src/tools/friend-farm-probe.ts --friend 136784552
 *   npx tsx --env-file=.env src/tools/friend-farm-probe.ts --dry-run
 */

import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import { loadConfig } from '../config.js';
import { FarmState } from '../game/farmData.js';

interface FriendEntry {
  id: number;
  name: string;
  level: number;
  parts: number[];
}

function decodeFriendList(buf: Buffer): FriendEntry[] {
  const r = new MyReader(buf);
  const count = r.readShort();
  const friends: FriendEntry[] = [];
  for (let i = 0; i < count; i++) {
    const id = r.readInt();
    const name = r.readUTF();
    const level = r.readInt();
    const numParts = r.readByte();
    const parts: number[] = [];
    for (let j = 0; j < numParts; j++) {
      parts.push(r.readShort());
    }
    friends.push({ id, name, level, parts });
  }
  return friends;
}

function getAnimalFoodId(species: number): number | null {
  // 50 Gà, 55 Vịt -> 117
  if (species === 50 || species === 55) return 117;
  // 51 Bò, 52 Heo, 56 Cừu, 58 Trâu, 60 Dê, 61 Thỏ -> 118
  if ([51, 52, 56, 58, 60, 61].includes(species)) return 118;
  // 54 Cá chép, 59 Rùa -> 116
  if (species === 54 || species === 59) return 116;
  // 53 Chó, 57 Mèo -> 119
  if (species === 53 || species === 57) return 119;
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);

  const args = process.argv.slice(2);
  const accArgIndex = args.indexOf('--account');
  const accountId = accArgIndex >= 0 ? Number(args[accArgIndex + 1]) : 1;

  const friendArgIndex = args.indexOf('--friend');
  const specifiedFriendId = friendArgIndex >= 0 ? Number(args[friendArgIndex + 1]) : null;

  const dryRun = args.includes('--dry-run');

  const row = getAccountById(db, accountId);
  if (!row) throw new Error(`Account #${accountId} not found in DB`);
  const pass = readGamePass(db, cfg.masterKey, accountId);

  console.log(`\n=== AUTO CHĂM SÓC NÔNG TRẠI BẠN BÈ ===`);
  console.log(`Tài khoản #${accountId} (${row.gameUser}) -> Server ${row.host}:${row.port}${dryRun ? ' [CHẾ ĐỘ XEM TRƯỚC --DRY-RUN]' : ''}`);

  const client = new GameClient();

  // Bắt packet log ngắn gọn
  client.session.on('message', (msg: Message) => {
    const data = msg.getData();
    if (msg.command === -40 || msg.command === -39) {
      try {
        const r = new MyReader(data);
        console.log(`   [SERVER DIALOG] "${r.readUTF()}"`);
      } catch {}
    } else if (msg.command === 65) {
      try {
        const r = new MyReader(data);
        const index = r.readByte();
        const idItem = r.readShort();
        console.log(`   [RX 65] Dùng item thành công: cell/iddb=${index}, itemId=${idItem}`);
      } catch {}
    } else if (msg.command === 100) {
      try {
        const r = new MyReader(data);
        const index = r.readByte();
        console.log(`   [RX 100] Cập nhật ô #${index}!`);
      } catch {}
    } else if (msg.command === 101) {
      try {
        const r = new MyReader(data);
        const index = r.readByte();
        console.log(`   [RX 101] Cập nhật con vật #${index}!`);
      } catch {}
    }
  });

  const onlinePromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Login timeout 10s')), 10000);
    client.on('status', (s) => {
      if (s === 'online') {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  await client.login({
    host: row.host,
    port: row.port,
    user: row.gameUser,
    pass,
  });
  await onlinePromise;
  console.log(`✓ Đăng nhập thành công! Player ID: ${client.playerId}`);
  await sleep(1500);

  // 1. Lấy danh sách bạn bè
  console.log(`\n--- BƯỚC 1: Lấy danh sách bạn bè (TX -48) ---`);
  const friendListPromise = new Promise<FriendEntry[]>((resolve) => {
    const onMsg = (msg: Message) => {
      if (msg.command === -48) {
        client.session.removeListener('message', onMsg);
        resolve(decodeFriendList(msg.getData()));
      }
    };
    client.session.on('message', onMsg);
  });

  client.session.send(Message.create(-48));
  const allFriends = await friendListPromise;
  console.log(`✓ Tìm thấy ${allFriends.length} người bạn trong danh sách:`);
  for (const f of allFriends) {
    console.log(`  - [ID: ${f.id}] "${f.name}" (level ${f.level})`);
  }

  // 2. Vào Farm Context (Farm của mình trước)
  console.log(`\n--- BƯỚC 2: Vào Farm context (GET_HANDLER 10) ---`);
  const myFarmPromise = new Promise<FarmState>((resolve) => {
    client.once('farm', (f) => resolve(f));
  });
  client.enterFarm();
  const myFarm = await myFarmPromise;
  console.log(`✓ Đã vào Farm context! Farm của mình: idFarm=${myFarm.idFarm}, ${myFarm.cells.length} ô đất`);

  // Xin kho đồ
  const invPromise = new Promise<void>((resolve) => {
    client.once('inventory', () => resolve());
    client.farm.getInventory();
  });
  await Promise.race([invPromise, sleep(2500)]);
  console.log(`  Kho hiện tại: ${client.inventory.map((i) => `#${i.id}×${i.num}`).join(', ') || 'Rỗng'}`);

  // Helper đảm bảo có item
  const localInventory = new Map<number, number>();
  for (const it of client.inventory) {
    localInventory.set(it.id, it.num);
  }

  async function ensureItemLocal(itemId: number, label: string): Promise<boolean> {
    const cur = localInventory.get(itemId) ?? 0;
    if (cur > 0) {
      localInventory.set(itemId, cur - 1);
      return true;
    }
    if (dryRun) {
      console.log(`    [DRY-RUN] Cần mua 1 ${label} (#${itemId}) giá xu`);
      return true;
    }
    console.log(`    >> Hết ${label} (#${itemId}), tiến hành mua 1 chiếc từ shop...`);
    client.farm.buyItem(itemId, 1, 1);
    await sleep(1000);
    return true;
  }

  // 3. Xác định danh sách bạn bè cần thăm
  const targetFriends = specifiedFriendId
    ? allFriends.filter((f) => f.id === specifiedFriendId)
    : allFriends;

  if (specifiedFriendId && targetFriends.length === 0) {
    // Nếu bạn bè không nằm trong friendlist nhưng truyền id trực tiếp
    targetFriends.push({ id: specifiedFriendId, name: `User ${specifiedFriendId}`, level: 0, parts: [] });
  }

  if (targetFriends.length === 0) {
    console.log(`Không tìm thấy bạn bè nào để thăm farm.`);
    client.session.close();
    return;
  }

  console.log(`\n--- BƯỚC 3: Bắt đầu chăm sóc nông trại của ${targetFriends.length} người bạn ---`);

  interface FriendReport {
    id: number;
    name: string;
    watered: number;
    weeded: number;
    wormsRemoved: number;
    animalsFed: number;
    animalsTreated: number;
  }
  const reports: FriendReport[] = [];

  for (let idx = 0; idx < targetFriends.length; idx++) {
    const friend = targetFriends[idx];
    console.log(`\n======================================================`);
    console.log(`[${idx + 1}/${targetFriends.length}] THĂM NÔNG TRẠI: "${friend.name}" (ID: ${friend.id})`);
    console.log(`======================================================`);

    const friendReport: FriendReport = {
      id: friend.id,
      name: friend.name,
      watered: 0,
      weeded: 0,
      wormsRemoved: 0,
      animalsFed: 0,
      animalsTreated: 0,
    };

    const friendFarmPromise = new Promise<FarmState>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout 8s chờ farm ${friend.name}`)), 8000);
      const onFarm = (f: FarmState) => {
        if (f.idFarm === friend.id) {
          clearTimeout(timer);
          client.removeListener('farm', onFarm);
          resolve(f);
        }
      };
      client.on('farm', onFarm);
    });

    client.farm.joinFarm(friend.id);

    try {
      const farm = await friendFarmPromise;
      console.log(`✓ Đã vào farm của ${friend.name}: ${farm.cells.length} ô đất, ${farm.animals.length} vật nuôi`);

      // A. Chăm sóc ô đất
      for (const cell of farm.cells) {
        if (cell.idTree === -1) continue; // Ô trống bỏ qua

        // 1. Tưới nước (isArid)
        if (cell.isArid) {
          console.log(`  - Ô #${cell.index} (cây #${cell.idTree}): Đất khô -> Tưới nước`);
          if (!dryRun) {
            client.farm.useItem(friend.id, cell.index, 100); // 100 = nước
            await sleep(400);
          }
          friendReport.watered++;
        }

        // 2. Diệt cỏ (isGrass)
        if (cell.isGrass) {
          console.log(`  - Ô #${cell.index} (cây #${cell.idTree}): Có cỏ mọc -> Dùng thuốc diệt cỏ (#123)`);
          const ok = await ensureItemLocal(123, 'Thuốc diệt cỏ');
          if (ok && !dryRun) {
            client.farm.useItem(friend.id, cell.index, 123);
            await sleep(400);
          }
          friendReport.weeded++;
        }

        // 3. Bắt sâu (isWorm)
        if (cell.isWorm) {
          console.log(`  - Ô #${cell.index} (cây #${cell.idTree}): Có sâu cắn -> Dùng thuốc trừ sâu (#124)`);
          const ok = await ensureItemLocal(124, 'Thuốc trừ sâu');
          if (ok && !dryRun) {
            client.farm.useItem(friend.id, cell.index, 124);
            await sleep(400);
          }
          friendReport.wormsRemoved++;
        }
      }

      // B. Chăm sóc vật nuôi
      for (const animal of farm.animals) {
        // 1. Cho ăn (hunger)
        if (animal.hunger) {
          const foodId = getAnimalFoodId(animal.species);
          if (foodId) {
            console.log(`  - Con #${animal.index} (loài ${animal.species}): Đói bụng -> Cho ăn thức ăn #${foodId}`);
            const ok = await ensureItemLocal(foodId, `Thức ăn loài ${animal.species}`);
            if (ok && !dryRun) {
              client.farm.useItem(friend.id, animal.index, foodId);
              await sleep(400);
            }
            friendReport.animalsFed++;
          }
        }

        // 2. Chữa bệnh / tiêm thuốc bổ nếu máu giảm (health < 100)
        if (animal.health < 100) {
          console.log(`  - Con #${animal.index} (loài ${animal.species}): Máu ${animal.health}/100 -> Tiêm thuốc bổ (#122)`);
          const ok = await ensureItemLocal(122, 'Thuốc bổ');
          if (ok && !dryRun) {
            client.farm.useItem(friend.id, animal.index, 122);
            await sleep(400);
          }
          friendReport.animalsTreated++;
        }
      }

      const totalCare =
        friendReport.watered +
        friendReport.weeded +
        friendReport.wormsRemoved +
        friendReport.animalsFed +
        friendReport.animalsTreated;

      if (totalCare === 0) {
        console.log(`  -> Nông trại của ${friend.name} hoàn toàn khoẻ mạnh, không cần chăm sóc gì thêm.`);
      } else {
        console.log(
          `  -> Đã chăm sóc: ${friendReport.watered} tưới nước, ${friendReport.weeded} nhổ cỏ, ` +
            `${friendReport.wormsRemoved} bắt sâu, ${friendReport.animalsFed} cho ăn, ${friendReport.animalsTreated} chữa bệnh.`,
        );
      }

      reports.push(friendReport);
      await sleep(1500);
    } catch (e: any) {
      console.error(`✗ Lỗi khi chăm sóc farm của ${friend.name}:`, e.message);
    }
  }

  // 4. Rời nông trại bạn bè về farm của mình
  console.log(`\n--- BƯỚC 4: Rời nông trại bạn bè, về lại Farm của mình ---`);
  client.farm.joinFarm(client.playerId!);
  await sleep(1500);

  // 5. Tổng kết
  console.log(`\n================ BẢNG TỔNG KẾT CHĂM SÓC ================`);
  for (const r of reports) {
    console.log(
      `* [${r.name}]: Tưới=${r.watered}, Cỏ=${r.weeded}, Sâu=${r.wormsRemoved}, Cho ăn=${r.animalsFed}, Thuốc bổ=${r.animalsTreated}`,
    );
  }
  console.log(`========================================================`);

  client.session.close();
  console.log(`✓ Hoàn thành tất cả công việc. Ngắt kết nối.`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
