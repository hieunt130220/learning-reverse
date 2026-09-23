import type { AutomationMode, ClientStatus } from '../types.js';

export const statusLabel: Record<ClientStatus, string> = {
  idle: 'chưa kết nối',
  connecting: 'đang kết nối',
  handshaking: 'đang bắt tay',
  'logging-in': 'đang đăng nhập',
  online: 'đang online',
  error: 'lỗi',
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status]}</span>;
}

const MODE_LABEL: Record<AutomationMode, string> = {
  off: 'Tắt',
  auto_farm: 'Nông trại',
  auto_fishing: 'Câu cá',
  find_npc: 'Tìm NPC',
  auto_fisherman_quest: 'Nhiệm vụ thợ câu',
  auto_mining: 'Khai thác',
  auto_maze: 'Mê cung',
};

export function automationModeLabel(mode: AutomationMode): string {
  return MODE_LABEL[mode];
}

export function ModeChip({
  automation,
  fallbackActive,
}: {
  automation?: { desiredMode: AutomationMode; activeMode: AutomationMode; transitionState: 'stable' | 'switching' };
  fallbackActive?: boolean;
}) {
  if (automation?.transitionState === 'switching') {
    return (
      <span className="mode-chip mode-chip--switching">
        chuyển {automationModeLabel(automation.activeMode)} → {automationModeLabel(automation.desiredMode)}
      </span>
    );
  }
  const mode = automation
    ? automation.desiredMode !== 'off'
      ? automation.desiredMode
      : automation.activeMode
    : fallbackActive
      ? 'auto_farm'
      : 'off';
  if (mode === 'off') {
    return <span className="mode-chip mode-chip--off">Tắt</span>;
  }
  const tone = mode === 'auto_fishing' || mode === 'auto_fisherman_quest' ? 'fishing' : 'farm';
  return <span className={`mode-chip mode-chip--${tone}`}>{automationModeLabel(mode)}</span>;
}
