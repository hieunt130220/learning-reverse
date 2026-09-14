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
  { id: 27, name: 'Bến tàu / Đảo Hawai (Map 27 - Yêu cầu Lv 10+)' },
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
      return 'Tự mua Vé câu bến tàu (12.000 xu) - Cần cấp độ câu cá ≥ 10';
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
    <section className="card fishing-form">
      <h2>Cấu hình câu cá tự động</h2>
      <p className="hint">
        Cấu hình này điều khiển bot tự động di chuyển đến hồ chỉ định, mua cần/mồi/vé phù hợp và quăng cần câu.
      </p>

      {/* ─── Cấu hình hồ câu ─── */}
      <div className="setting-section fishing-form-section">
        <h3>Cấu hình hồ câu</h3>

        <div className="fishing-form-stack">
          <div className="fishing-form-field">
            <label className="fishing-form-label">Khu vực câu:</label>
            <select
              value={selectedMap}
              onChange={(e) => setSelectedMap(Number(e.target.value))}
              disabled={isFishing}
            >
              {FISHING_MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="fishing-form-grid2">
            <div className="fishing-form-field">
              <label className="fishing-form-label">Khu vực (Area 0-15):</label>
              <input
                type="number"
                min={0}
                max={15}
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
                disabled={isFishing}
              />
            </div>

            <div className="fishing-form-field">
              <label className="fishing-form-label">Delay giữa các lần quăng (ms):</label>
              <input
                type="number"
                min={1000}
                step={500}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                disabled={isFishing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Cấu hình mua vật phẩm tự động ─── */}
      <div className="setting-section fishing-form-section">
        <h3>Cấu hình mua vật phẩm tự động</h3>

        <div className="fishing-form-stack">
          {/* 1. Vé câu */}
          <div className="fishing-ticket-control">
            <label className={`fishing-ticket-label${isFishing ? ' disabled' : ''}`}>
              <input
                type="checkbox"
                checked={autoBuyTicket}
                onChange={(e) => setAutoBuyTicket(e.target.checked)}
                disabled={isFishing}
              />
              <span>Tự động mua vé câu theo hồ</span>
            </label>
            <div className={`fishing-ticket-hint${selectedMap === 16 ? ' warning' : ''}`}>
              {getTicketHint(selectedMap)}
            </div>
          </div>

          {/* 2. Cần câu */}
          <div className="fishing-form-field">
            <div className="fishing-form-checkrow">
              <label className="fishing-form-label">Cần câu:</label>
              {isRodLuong && (
                <span className="fishing-form-warn-badge">
                  ⚠️ Tiêu Lượng
                </span>
              )}
            </div>
            <select
              value={rodType}
              onChange={(e) => setRodType(Number(e.target.value))}
              disabled={isFishing}
            >
              {FISHING_RODS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.cost ? ` - ${r.cost}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Mồi câu & Số lượng */}
          <div className="fishing-form-grid2">
            <div className="fishing-form-field">
              <label className="fishing-form-label">Mồi câu:</label>
              <select
                value={baitType}
                onChange={(e) => setBaitType(Number(e.target.value))}
                disabled={isFishing}
              >
                {FISHING_BAITS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.cost ? ` - ${b.cost}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="fishing-form-field">
              <label className="fishing-form-label">Số lượng mồi mua mỗi lần:</label>
              <input
                type="number"
                min={1}
                max={200}
                value={baitQuantity}
                onChange={(e) => setBaitQuantity(Number(e.target.value))}
                onBlur={() => setBaitQuantity((prev) => Math.max(1, Math.min(200, Number(prev) || 50)))}
                disabled={isFishing}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Nút Lưu Cấu Hình ─── */}
      <div className="row tree-plan-save-row fishing-form-save">
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
          <span className="fishing-form-saved">
            Đã lưu cấu hình thành công!
          </span>
        )}
        {saveError && (
          <span className="err">{saveError}</span>
        )}
      </div>

      {isFishing && (
        <p className="hint fishing-form-warn">
          ⚠️ Đang trong trạng thái câu cá. Vui lòng dừng câu cá ở tab "Câu cá" trước khi lưu thay đổi cấu hình.
        </p>
      )}
    </section>
  );
}
