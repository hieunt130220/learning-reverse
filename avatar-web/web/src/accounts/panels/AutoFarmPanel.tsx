import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AutoState, ItemInfo } from '../../types.js';

export function AutoFarmPanel({
  accountId,
  auto,
  items,
}: {
  accountId: number;
  auto: AutoState;
  items: ItemInfo[];
}) {
  const [seedId, setSeedId] = useState('');
  // 123/124 đối chiếu khớp giữa bảng vật phẩm và kho; 100 là hằng số cứng trong
  // FarmScr.resetAction, chưa kiểm chứng nên để trống mặc định.
  const [waterItemId, setWaterItemId] = useState('100');
  const [grassItemId, setGrassItemId] = useState('123');
  const [wormItemId, setWormItemId] = useState('124');
  const [harvest, setHarvest] = useState(true);
  const [harvestAnimals, setHarvestAnimals] = useState(true);
  const [feedAnimals, setFeedAnimals] = useState(true);
  const [healAnimals, setHealAnimals] = useState(true);
  const [fertilizeCells, setFertilizeCells] = useState(true);
  // Bán là thao tác KHÔNG lấy lại được -> mặc định tắt, người dùng phải tự bật.
  const [sellAnimals, setSellAnimals] = useState(false);
  // Heo 52 / Cá chép 54 / Rùa 59 — loài không có sản phẩm, nuôi lớn rồi bán.
  const [sellWhenGrown, setSellWhenGrown] = useState('52, 54, 59');
  const [maxSellsPerCycle, setMaxSellsPerCycle] = useState(3);
  const [autoBuy, setAutoBuy] = useState(false);
  const [buyBudgetXu, setBuyBudgetXu] = useState(5000);
  const [intervalSec, setIntervalSec] = useState(120);
  const [stepDelayMs, setStepDelayMs] = useState(700);
  const [err, setErr] = useState('');

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
  /** "52, 54, 59" -> [52, 54, 59]. Bỏ phần rác thay vì gửi NaN lên server. */
  const idList = (s: string) =>
    s
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x));

  async function start() {
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/start`, {
        seedId: num(seedId),
        waterItemId: num(waterItemId),
        grassItemId: num(grassItemId),
        wormItemId: num(wormItemId),
        harvest,
        harvestAnimals,
        feedAnimals,
        healAnimals,
        fertilizeCells,
        sellAnimals,
        sellWhenGrownSpecies: idList(sellWhenGrown),
        maxSellsPerCycle,
        autoBuy,
        buyBudgetXu,
        intervalMs: intervalSec * 1000,
        stepDelayMs,
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function stop() {
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/stop`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Tự động chăm sóc</h2>
      <p className="hint">
        Mỗi chu kỳ xin lại dữ liệu farm rồi hành động theo trạng thái thật của từng ô. Ô nào để trống
        thì việc đó bị tắt. <b>100</b> (tưới) và <b>123</b> (nhổ cỏ) đã kiểm chứng bằng gói thật;{' '}
        <b>124</b> (bắt sâu) mới suy từ tên vật phẩm, chưa thử được.
      </p>
      <p className="hint">
        Bật ở đây là ghi vào cơ sở dữ liệu: server tự bật lại tài khoản này sau khi khởi động lại,
        không cần mở trình duyệt.
      </p>
      <div className="row">
        <label className="inline">
          id hạt trồng lại
          <input value={seedId} onChange={(e) => setSeedId(e.target.value)} placeholder="tắt" />
        </label>
        <label className="inline">
          id tưới nước
          <input value={waterItemId} onChange={(e) => setWaterItemId(e.target.value)} placeholder="tắt" />
        </label>
      </div>
      <div className="row">
        <label className="inline">
          id thuốc cỏ
          <input value={grassItemId} onChange={(e) => setGrassItemId(e.target.value)} placeholder="tắt" />
        </label>
        <label className="inline">
          id thuốc sâu
          <input value={wormItemId} onChange={(e) => setWormItemId(e.target.value)} placeholder="tắt" />
        </label>
      </div>
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={harvest}
            onChange={(e) => setHarvest(e.target.checked)}
            style={{ width: 'auto' }}
          />
          thu hoạch ô đã chín
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={feedAnimals}
            onChange={(e) => setFeedAnimals(e.target.checked)}
            style={{ width: 'auto' }}
          />
          cho vật nuôi ăn
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={healAnimals}
            onChange={(e) => setHealAnimals(e.target.checked)}
            style={{ width: 'auto' }}
          />
          thuốc bổ khi máu &lt; 100
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={fertilizeCells}
            onChange={(e) => setFertilizeCells(e.target.checked)}
            style={{ width: 'auto' }}
          />
          bón phân khi sức sống &lt; 100
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={harvestAnimals}
            onChange={(e) => setHarvestAnimals(e.target.checked)}
            style={{ width: 'auto' }}
          />
          thu hoạch sản phẩm vật nuôi
        </label>
      </div>
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={sellAnimals}
            onChange={(e) => setSellAnimals(e.target.checked)}
            style={{ width: 'auto' }}
          />
          bán vật nuôi khi đã lớn
        </label>
        <label className="inline">
          loài bán khi lớn
          <input
            value={sellWhenGrown}
            onChange={(e) => setSellWhenGrown(e.target.value)}
            placeholder="không bán"
            disabled={!sellAnimals}
          />
        </label>
        <label className="inline">
          trần bán/vòng
          <input
            type="number"
            value={maxSellsPerCycle}
            onChange={(e) => setMaxSellsPerCycle(Number(e.target.value))}
            disabled={!sellAnimals}
          />
        </label>
      </div>
      {sellAnimals && (
        <p className="hint" style={{ color: '#d9a441' }}>
          ⚠ Bán vật nuôi là <b>không lấy lại được</b>. Chỉ bán con thuộc danh sách loài ở trên và đã
          lớn 100%; con còn sản phẩm chưa thu thì để lại vòng sau. Loài <b>có</b> sản phẩm (Gà 50, Bò
          51, Vịt 55) chưa bán theo tuổi thọ vì chưa biết <code>bornTime</code> đếm lên hay đếm
          xuống — mỗi vòng auto ghi một dòng <code>[đo]</code> vào nhật ký khi giá trị này đổi, đủ
          vài vòng là xác định được.
        </p>
      )}
      <div className="row">
        <label className="inline">
          <input
            type="checkbox"
            checked={autoBuy}
            onChange={(e) => setAutoBuy(e.target.checked)}
            style={{ width: 'auto' }}
          />
          tự mua khi thiếu (chỉ bằng xu)
        </label>
        <label className="inline">
          trần chi/vòng (xu)
          <input
            type="number"
            value={buyBudgetXu}
            onChange={(e) => setBuyBudgetXu(Number(e.target.value))}
          />
        </label>
        <label className="inline">
          chu kỳ (giây)
          <input
            type="number"
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
          />
        </label>
        <label className="inline">
          nghỉ giữa lệnh (ms)
          <input
            type="number"
            value={stepDelayMs}
            onChange={(e) => setStepDelayMs(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="row">
        <button onClick={() => void start()} disabled={auto.running}>
          Bật
        </button>
        <button className="ghost" onClick={() => void stop()} disabled={!auto.running}>
          Tắt
        </button>
        <span className="hint">
          {auto.running ? `đang chạy — vòng ${auto.cycle}` : 'đang tắt'}
          {auto.lastRun ? ` · lần cuối ${new Date(auto.lastRun).toLocaleTimeString()}` : ''}
        </span>
      </div>
      {auto.lastActions.length > 0 && (
        <div className="log" style={{ maxHeight: 120 }}>
          {auto.lastActions.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <p className="hint">vật phẩm: {items.map((i) => `${i.name} ${i.price}xu`).join(' · ')}</p>
      )}
      {(err || auto.lastError) && <p className="err">{err || auto.lastError}</p>}
    </section>
  );
}
