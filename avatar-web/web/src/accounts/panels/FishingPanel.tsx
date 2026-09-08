import { useState } from 'react';

import { apiPost } from '../../api.js';
import type {
  AccountWithRuntime,
  AutomationSnapshot,
  FishingRuntimeState,
} from '../../types.js';

interface FishingPanelProps {
  account?: AccountWithRuntime;
  automation?: AutomationSnapshot;
  onChanged?(): void;
}

const FISHING_MAPS = [
  { id: 14, name: 'Khu cá rô (Map 14 - Mặc định)' },
  { id: 15, name: 'Khu cá lóc (Map 15)' },
  { id: 16, name: 'Khu cá mập (Map 16)' },
  { id: 27, name: 'Bến tàu / Đảo Hawai (Map 27)' },
];

function formatFishingStatus(status?: FishingRuntimeState['status']): string {
  switch (status) {
    case 'moving':
      return 'Đang di chuyển vào hồ câu';
    case 'starting':
      return 'Đang gửi yêu cầu câu (TX45)…';
    case 'casting':
      return 'Đang quăng cần, chờ cá cắn…';
    case 'hooked':
      return 'Cá cắn câu! ML đang giải mini-game…';
    case 'caught':
      return 'Đã bắt được cá!';
    case 'rejected':
      return 'Server từ chối câu';
    case 'resting':
      return 'Đang nghỉ giữa vòng quăng cần';
    case 'idle':
    default:
      return 'Đang tắt';
  }
}

export function FishingPanel({
  account,
  automation,
  onChanged,
}: FishingPanelProps) {
  const accountId = account?.id;
  const isFishingDesired = automation?.desiredMode === 'auto_fishing';
  const isFishingActive = automation?.activeMode === 'auto_fishing';
  const isFishing = isFishingDesired || isFishingActive;
  const isSwitching = automation?.transitionState === 'switching';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMap, setSelectedMap] = useState(14);
  const [area, setArea] = useState(0);
  const [delayMs, setDelayMs] = useState(3000);

  const fishingState = automation?.fishingRuntime;

  const handleToggle = async () => {
    if (!accountId || loading || isSwitching) return;
    setLoading(true);
    setError('');

    try {
      if (isFishing) {
        await apiPost(`/api/accounts/${accountId}/automation/stop`, {});
      } else {
        await apiPost(`/api/accounts/${accountId}/automation/start`, {
          mode: 'auto_fishing',
        });
      }
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {/* ─── Header & Action Button ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: '#1d2430',
          borderRadius: '8px',
          border: '1px solid var(--line)',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Tự Động Câu Cá (Phase 3 ML)</h3>
          <p className="hint" style={{ margin: '0.2rem 0 0 0' }}>
            Trạng thái: <strong>{formatFishingStatus(fishingState?.status)}</strong>
            {isSwitching && ' · Đang chuyển chế độ…'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || isSwitching || !accountId}
          style={{
            padding: '0.5rem 1.25rem',
            fontWeight: 600,
            cursor: loading || isSwitching ? 'not-allowed' : 'pointer',
            background: isFishing ? '#b83a3a' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
          }}
        >
          {loading ? 'Đang xử lý…' : isFishing ? 'Dừng câu cá' : 'Bắt đầu câu cá'}
        </button>
      </div>

      {error && <p className="err" style={{ margin: 0 }}>{error}</p>}
      {fishingState?.lastError && (
        <p className="err" style={{ margin: 0 }}>
          Lỗi câu gần nhất: {fishingState.lastError}
        </p>
      )}

      {/* ─── Live Metrics & Status ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Tổng cá đã bắt</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ok)', marginTop: '0.2rem' }}>
            {fishingState?.totalCatches ?? 0}
          </div>
        </div>

        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Cá vừa bắt được</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d2a8ff', marginTop: '0.2rem' }}>
            {fishingState?.lastFishId ? `ID ${fishingState.lastFishId}` : '—'}
          </div>
        </div>

        <div style={{ padding: '0.75rem', background: '#12161d', borderRadius: '6px', border: '1px solid var(--line)' }}>
          <div className="hint" style={{ fontSize: '0.8rem' }}>Map / Khu vực</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f0f6fc', marginTop: '0.4rem' }}>
            Map {fishingState?.currentMap ?? selectedMap} / Khu {fishingState?.currentArea ?? area}
          </div>
        </div>
      </div>

      {/* ─── Configuration Form ─── */}
      <div
        style={{
          padding: '1rem',
          background: '#12161d',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Cấu hình hồ câu</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Khu vực câu:</label>
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(Number(e.target.value))}
            disabled={isFishing}
            style={{
              padding: '0.4rem 0.6rem',
              background: '#1d2430',
              color: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '4px',
            }}
          >
            {FISHING_MAPS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Khu vực (Area 0-15):</label>
            <input
              type="number"
              min={0}
              max={15}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Delay giữa các lần quăng (ms):</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        <p className="hint" style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem' }}>
          💡 Lưu ý: Map mặc định là <strong>Khu cá rô (ID 14)</strong>. Vui lòng chuẩn bị sẵn cần câu và vé câu cá
          (ID 458) trong hành trang trước khi bắt đầu.
        </p>
      </div>
    </div>
  );
}
