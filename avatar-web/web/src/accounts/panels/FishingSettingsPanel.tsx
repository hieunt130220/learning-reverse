import { useEffect, useState } from 'react';

import { apiPut, ApiError } from '../../api.js';
import {
  DEFAULT_FISHING_CONFIG,
  FISHING_BAITS,
  FISHING_RODS,
  FISHING_TICKETS,
  type AutomationSnapshot,
  type FishingConfig,
} from '../../types.js';

export interface FishingSettingsPanelProps {
  accountId: number;
  automation?: AutomationSnapshot;
  isFishing?: boolean;
  onAutomationChange?(snapshot: AutomationSnapshot): void;
  onChanged?(): void;
  onDirtyChange?(dirty: boolean): void;
}

export const FISHING_MAPS = [
  { id: 14, name: 'Khu cá rô (Map 14 - Mặc định)' },
  { id: 15, name: 'Khu cá lóc (Map 15)' },
  { id: 16, name: 'Khu cá mập (Map 16)' },
  { id: 27, name: 'Bến tàu / Đảo Hawai (Map 27)' },
];

function getTicketHint(mapId: number): string {
  switch (mapId) {
    case 14:
      return 'Tự mua Vé cá rô (1.000 xu)';
    case 15:
      return 'Tự mua Vé cá lóc (10.000 xu)';
    case 16:
      return 'Tự mua Vé cá mập (2 Lượng) ⚠️ Tiêu Lượng';
    case 27:
      return 'Bến tàu cần vé sự kiện riêng, NPC không bán';
    default:
      return FISHING_TICKETS[mapId]
        ? `Tự mua ${FISHING_TICKETS[mapId].name}`
        : 'Bản đồ này không có vé bán tại NPC';
  }
}

export function FishingSettingsPanel({
  accountId,
  automation,
  isFishing = false,
  onAutomationChange,
  onChanged,
  onDirtyChange,
}: FishingSettingsPanelProps) {
  const initialConfig = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG;

  const [selectedMap, setSelectedMap] = useState<number>(initialConfig.map ?? DEFAULT_FISHING_CONFIG.map);
  const [area, setArea] = useState<number>(initialConfig.area ?? DEFAULT_FISHING_CONFIG.area);
  const [delayMs, setDelayMs] = useState<number>(initialConfig.castDelayMs ?? DEFAULT_FISHING_CONFIG.castDelayMs);
  const [autoBuyTicket, setAutoBuyTicket] = useState<boolean>(initialConfig.autoBuyTicket ?? DEFAULT_FISHING_CONFIG.autoBuyTicket);
  const [rodType, setRodType] = useState<number>(initialConfig.rodType ?? DEFAULT_FISHING_CONFIG.rodType);
  const [baitType, setBaitType] = useState<number>(initialConfig.baitType ?? DEFAULT_FISHING_CONFIG.baitType);
  const [baitQuantity, setBaitQuantity] = useState<number>(initialConfig.baitQuantity ?? DEFAULT_FISHING_CONFIG.baitQuantity);

  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const currentSavedConfig = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG;
  const isDirty = (
    selectedMap !== (currentSavedConfig.map ?? DEFAULT_FISHING_CONFIG.map) ||
    area !== (currentSavedConfig.area ?? DEFAULT_FISHING_CONFIG.area) ||
    delayMs !== (currentSavedConfig.castDelayMs ?? DEFAULT_FISHING_CONFIG.castDelayMs) ||
    autoBuyTicket !== (currentSavedConfig.autoBuyTicket ?? DEFAULT_FISHING_CONFIG.autoBuyTicket) ||
    rodType !== (currentSavedConfig.rodType ?? DEFAULT_FISHING_CONFIG.rodType) ||
    baitType !== (currentSavedConfig.baitType ?? DEFAULT_FISHING_CONFIG.baitType) ||
    baitQuantity !== (currentSavedConfig.baitQuantity ?? DEFAULT_FISHING_CONFIG.baitQuantity)
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const cfg = automation?.fishingConfig?.config ?? DEFAULT_FISHING_CONFIG;
    setSelectedMap(cfg.map);
    setArea(cfg.area);
    setDelayMs(cfg.castDelayMs);
    setAutoBuyTicket(cfg.autoBuyTicket);
    setRodType(cfg.rodType);
    setBaitType(cfg.baitType);
    setBaitQuantity(cfg.baitQuantity);
    setSaveSuccess(false);
    setSaveError('');
  }, [accountId, automation?.fishingConfig?.revision]);

  const handleSaveConfig = async (): Promise<boolean> => {
    if (!accountId || savingConfig || isFishing) return false;
    setSavingConfig(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const payload = {
        expectedRevision: automation?.fishingConfig?.revision ?? 0,
        config: {
          map: selectedMap,
          area,
          castDelayMs: delayMs,
          autoBuyTicket,
          rodType,
          baitType,
          baitQuantity,
        },
      };

      const result = await apiPut<{
        revision: number;
        config: FishingConfig;
        application: string;
      }>(`/api/accounts/${accountId}/automation/fishing/config`, payload);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);

      if (automation && onAutomationChange) {
        onAutomationChange({
          ...automation,
          fishingConfig: {
            revision: result.revision,
            config: result.config,
          },
        });
      }
      onChanged?.();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as {
          code?: string;
          current?: { revision: number; config: FishingConfig };
          error?: string;
        } | undefined;
        setSaveError(
          body?.error || 'Xung đột phiên bản: cấu hình đã được cập nhật từ nơi khác. Vui lòng thử lại.',
        );
        if (body?.current && automation && onAutomationChange) {
          onAutomationChange({
            ...automation,
            fishingConfig: body.current,
          });
        }
      } else {
        setSaveError((err as Error).message);
      }
      return false;
    } finally {
      setSavingConfig(false);
    }
  };

  const selectedRod = FISHING_RODS.find((r) => r.id === rodType);
  const isRodLuong = selectedRod?.typeMoney === 2;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2>Cấu hình câu cá tự động</h2>
      <p className="hint">
        Cấu hình này điều khiển bot tự động di chuyển đến hồ chỉ định, mua cần/mồi/vé phù hợp và quăng cần câu.
      </p>

      {/* ─── Cấu hình hồ câu ─── */}
      <div className="setting-section">
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--accent)' }}>Cấu hình hồ câu</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
        </div>
      </div>

      {/* ─── Cấu hình mua vật phẩm tự động ─── */}
      <div className="setting-section">
        <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--accent)' }}>Cấu hình mua vật phẩm tự động</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* 1. Vé câu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: isFishing ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={autoBuyTicket}
                onChange={(e) => setAutoBuyTicket(e.target.checked)}
                disabled={isFishing}
                style={{ cursor: isFishing ? 'not-allowed' : 'pointer' }}
              />
              <span>Tự động mua vé câu theo hồ</span>
            </label>
            <div
              style={{
                fontSize: '0.8rem',
                color: selectedMap === 16 ? '#e3b341' : 'var(--muted)',
                marginLeft: '1.4rem',
              }}
            >
              {getTicketHint(selectedMap)}
            </div>
          </div>

          {/* 2. Cần câu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Cần câu:</label>
              {isRodLuong && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(210, 153, 34, 0.15)',
                    color: '#e3b341',
                    border: '1px solid rgba(210, 153, 34, 0.4)',
                    fontWeight: 500,
                  }}
                >
                  ⚠️ Tiêu Lượng
                </span>
              )}
            </div>
            <select
              value={rodType}
              onChange={(e) => setRodType(Number(e.target.value))}
              disabled={isFishing}
              style={{
                padding: '0.4rem 0.6rem',
                background: '#1d2430',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}
            >
              {FISHING_RODS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.cost ? ` - ${r.cost}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Mồi câu & Số lượng */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Mồi câu:</label>
              <select
                value={baitType}
                onChange={(e) => setBaitType(Number(e.target.value))}
                disabled={isFishing}
                style={{
                  padding: '0.4rem 0.6rem',
                  background: '#1d2430',
                  color: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                }}
              >
                {FISHING_BAITS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.cost ? ` - ${b.cost}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Số lượng mồi mua mỗi lần:</label>
              <input
                type="number"
                min={1}
                max={200}
                value={baitQuantity}
                onChange={(e) => setBaitQuantity(Number(e.target.value))}
                onBlur={() => setBaitQuantity((prev) => Math.max(1, Math.min(200, Number(prev) || 50)))}
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
        </div>
      </div>

      {/* ─── Nút Lưu Cấu Hình ─── */}
      <div className="row tree-plan-save-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void handleSaveConfig()}
          disabled={isFishing || savingConfig || !accountId || !isDirty}
        >
          {savingConfig ? 'Đang lưu…' : 'Lưu Cấu Hình'}
        </button>
        {isDirty && !savingConfig && (
          <span className="hint">(Có thay đổi chưa lưu)</span>
        )}
        {saveSuccess && (
          <span style={{ color: 'var(--ok)', fontSize: '0.85rem', fontWeight: 500 }}>
            Đã lưu cấu hình thành công!
          </span>
        )}
        {saveError && (
          <span className="err">{saveError}</span>
        )}
      </div>

      {isFishing && (
        <p className="hint" style={{ color: '#e3b341', margin: 0 }}>
          ⚠️ Đang trong trạng thái câu cá. Vui lòng dừng câu cá ở tab "Câu cá" trước khi lưu thay đổi cấu hình.
        </p>
      )}
    </section>
  );
}
