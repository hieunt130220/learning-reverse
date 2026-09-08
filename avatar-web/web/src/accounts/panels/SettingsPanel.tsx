import { useState } from 'react';

import type { AccountWithRuntime, AutomationSnapshot, SessionSnapshot } from '../../types.js';
import { AutoFarmPanel } from './AutoFarmPanel.js';
import { FishingSettingsPanel } from './FishingSettingsPanel.js';

export interface SettingsPanelProps {
  account: AccountWithRuntime;
  snapshot?: SessionSnapshot | null;
  automation?: AutomationSnapshot;
  onPlanDirtyChange(dirty: boolean): void;
  onFishingDirtyChange?(dirty: boolean): void;
  onAutomationChange?(loaded: AutomationSnapshot): void;
  onChanged?(): void;
}

type SettingsSubTab = 'farm' | 'fishing';

export function SettingsPanel({
  account,
  snapshot,
  automation,
  onPlanDirtyChange,
  onFishingDirtyChange,
  onAutomationChange,
  onChanged,
}: SettingsPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('farm');

  const isFishingDesired = automation?.desiredMode === 'auto_fishing';
  const isFishingActive = automation?.activeMode === 'auto_fishing';
  const isFishing = isFishingDesired || isFishingActive;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <nav className="settings-tabs-nav" role="tablist" aria-label="Cài đặt tự động">
        <button
          type="button"
          role="tab"
          id="settings-tab-farm"
          aria-controls="settings-panel-farm"
          aria-selected={activeSubTab === 'farm'}
          className={`settings-tab-btn ${activeSubTab === 'farm' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('farm')}
        >
          🌾 Nông trại
        </button>
        <button
          type="button"
          role="tab"
          id="settings-tab-fishing"
          aria-controls="settings-panel-fishing"
          aria-selected={activeSubTab === 'fishing'}
          className={`settings-tab-btn ${activeSubTab === 'fishing' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('fishing')}
        >
          🎣 Câu cá
        </button>
      </nav>

      <div
        id="settings-panel-farm"
        role="tabpanel"
        aria-labelledby="settings-tab-farm"
        className="settings-tab-slot"
        hidden={activeSubTab !== 'farm'}
      >
        <AutoFarmPanel
          accountId={account.id}
          foods={snapshot?.foods}
          trees={snapshot?.trees}
          animals={snapshot?.animals}
          items={snapshot?.items}
          shop={snapshot?.shop}
          produce={snapshot?.produce}
          onPlanDirtyChange={onPlanDirtyChange}
        />
      </div>

      <div
        id="settings-panel-fishing"
        role="tabpanel"
        aria-labelledby="settings-tab-fishing"
        className="settings-tab-slot"
        hidden={activeSubTab !== 'fishing'}
      >
        <FishingSettingsPanel
          accountId={account.id}
          automation={automation}
          isFishing={isFishing}
          onAutomationChange={onAutomationChange}
          onChanged={onChanged}
          onDirtyChange={onFishingDirtyChange}
        />
      </div>
    </div>
  );
}
