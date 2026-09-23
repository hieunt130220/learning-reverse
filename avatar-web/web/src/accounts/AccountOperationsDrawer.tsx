import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { apiGet } from '../api.js';
import type { AccountWithRuntime, AutomationSnapshot } from '../types.js';
import { useMediaQuery } from '../useMediaQuery.js';
import { useAccounts } from './AccountsProvider.js';
import { useAccountRuntime } from './useAccountRuntime.js';
import { useDialogFocus } from './useDialogFocus.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { CookingPanel } from './panels/CookingPanel.js';
import { FindNpcPanel } from './panels/FindNpcPanel.js';
import { FishingPanel } from './panels/FishingPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { MazePanel } from './panels/MazePanel.js';
import { MiningPanel } from './panels/MiningPanel.js';
import { QuestsPanel } from './panels/QuestsPanel.js';
import { SettingsPanel } from './panels/SettingsPanel.js';
import { ShopPanel } from './panels/ShopPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

const PANEL_TABS = [
  ['status', 'Trạng thái'],
  ['settings', 'Cài đặt'],
  ['fishing', '🎣 Câu cá'],
  ['mining', '⛏️ Khai thác'],
  ['maze', '🗝️ Mê cung'],
  ['find_npc', 'Tìm NPC'],
  ['quests', 'Nhiệm vụ'],
  ['cooking', 'Nấu ăn'],
  ['assets', 'Tài sản'],
  ['shop', 'Sạp'],
  ['logs', 'Log'],
] as const;
type PanelId = (typeof PANEL_TABS)[number][0];

export interface PanelGroup {
  id: string;
  label: string;
  panels: PanelId[];
}

export const PANEL_GROUPS: PanelGroup[] = [
  { id: 'operations', label: 'Vận hành', panels: ['status', 'settings'] },
  { id: 'farm', label: 'Nông trại', panels: ['quests', 'cooking'] },
  { id: 'fishing', label: '🎣 Câu cá', panels: ['fishing'] },
  { id: 'mining', label: '⛏️ Khai thác', panels: ['mining'] },
  { id: 'maze', label: '🗝️ Mê cung', panels: ['maze'] },
  { id: 'assets', label: 'Tài sản', panels: ['assets', 'shop'] },
  { id: 'logs', label: 'Log', panels: ['logs'] },
];

const PANEL_TO_GROUP = new Map<PanelId, string>(
  PANEL_GROUPS.flatMap((g) => g.panels.map((p): [PanelId, string] => [p, g.id])),
);

export const DESKTOP_CONSOLE_GROUPS = [
  { id: 'operations', label: 'Vận hành & Cài đặt', icon: '⚡', hotkey: '1' },
  { id: 'farm', label: 'Nông trại & Bếp', icon: '🌱', hotkey: '2' },
  { id: 'fishing', label: '🎣 Câu cá', icon: '🎣', hotkey: '3' },
  { id: 'mining', label: '⛏️ Khai thác', icon: '⛏️', hotkey: '4' },
  { id: 'maze', label: '🗝️ Mê cung', icon: '🗝️', hotkey: '5' },
  { id: 'assets', label: 'Tài sản & Sạp', icon: '🎒', hotkey: '6' },
  { id: 'logs', label: 'Nhật ký Log', icon: '📟', hotkey: '7' },
] as const;

const FIND_NPC_TAB_HIDDEN = true;

export function AccountOperationsDrawer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const accountId = Number(id);
  const { accounts, loading, reload } = useAccounts();
  const isMobile = useMediaQuery('(max-width: 679px)');
  const account = Number.isInteger(accountId) && accountId > 0
    ? accounts.find((item) => item.id === accountId)
    : undefined;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dirtySources, setDirtySources] = useState({ farm: false, findNpc: false, fishing: false });
  const anyDirty = dirtySources.farm || dirtySources.findNpc || dirtySources.fishing;
  const setFarmDirty = useCallback((dirty: boolean) => {
    setDirtySources((current) => current.farm === dirty ? current : { ...current, farm: dirty });
  }, []);
  const setFindNpcDirty = useCallback((dirty: boolean) => {
    setDirtySources((current) => current.findNpc === dirty ? current : { ...current, findNpc: dirty });
  }, []);
  const setFishingDirty = useCallback((dirty: boolean) => {
    setDirtySources((current) => current.fishing === dirty ? current : { ...current, fishing: dirty });
  }, []);
  const canLeave = () => !anyDirty || window.confirm('Có thay đổi chưa lưu. Bỏ thay đổi?');
  const close = () => {
    if (canLeave()) navigate('/accounts');
  };
  useDialogFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose: close });

  useEffect(() => {
    if (!anyDirty) return;
    const blockUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnload);
    return () => window.removeEventListener('beforeunload', blockUnload);
  }, [anyDirty]);

  return (
    <div className="dialog-backdrop dialog-backdrop--drawer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <aside
        ref={dialogRef}
        className={isMobile ? 'account-drawer' : 'account-drawer account-drawer--console'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {!isMobile ? (
          <header className="console-topbar">
            <div className="console-account-meta">
              <div className="console-account-avatar">🧑‍🌾</div>
              <div className="console-account-info">
                <div className="console-account-title-row">
                  <h2 id="drawer-title">{account ? `Vận hành ${account.label}` : 'Vận hành tài khoản'}</h2>
                  {account?.runtime?.status && (
                    <span className={`badge ${account.runtime.status === 'online' ? 'badge--online' : 'badge--busy'}`}>
                      {account.runtime.status}
                    </span>
                  )}
                </div>
                {account?.gameUser && (
                  <div className="console-account-sub">
                    <span>Nhân vật: <strong>{account.gameUser}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className="console-header-actions">
              <button ref={closeRef} type="button" className="ghost" onClick={close} aria-label="Đóng">✕ Đóng</button>
            </div>
          </header>
        ) : (
          <header className="dialog-heading">
            <div><p className="eyebrow">VẬN HÀNH</p><h2 id="drawer-title">{account ? `Vận hành ${account.label}` : 'Vận hành tài khoản'}</h2></div>
            <button ref={closeRef} type="button" className="ghost" onClick={close} aria-label="Đóng">×</button>
          </header>
        )}
        {loading ? <p className="hint">đang tải…</p> : account ? (
          <LoadedOperations
            key={account.id}
            account={account}
            reload={reload}
            onPlanDirtyChange={setFarmDirty}
            onFishingDirtyChange={setFishingDirty}
            onFindNpcDirtyChange={setFindNpcDirty}
          />
        ) : (
          <div className="drawer-empty"><p className="err">không có tài khoản này</p><Link to="/accounts">Về dashboard</Link></div>
        )}
      </aside>
    </div>
  );
}

/** Tách riêng vì hook runtime chỉ được gọi khi đã chắc chắn có account. */
function LoadedOperations({
  account,
  reload,
  onPlanDirtyChange,
  onFishingDirtyChange,
  onFindNpcDirtyChange,
}: {
  account: AccountWithRuntime;
  reload(): Promise<void>;
  onPlanDirtyChange(dirty: boolean): void;
  onFishingDirtyChange(dirty: boolean): void;
  onFindNpcDirtyChange(dirty: boolean): void;
}) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  const isMobile = useMediaQuery('(max-width: 679px)');
  const [activePanel, setActivePanel] = useState<PanelId>('status');
  const [automationMutationBusy, setAutomationMutationBusy] = useState(false);
  const [fetchedAutomation, setFetchedAutomation] = useState<AutomationSnapshot | undefined>();
  const automationRefreshGeneration = useRef(0);
  const panelsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeGroup = PANEL_TO_GROUP.get(activePanel) ?? 'operations';
  const groupPanels = (groupId: string): PanelId[] =>
    PANEL_GROUPS.find((g) => g.id === groupId)?.panels ?? [];
  const visible = (id: PanelId) =>
    (PANEL_TO_GROUP.get(id) ?? '') === activeGroup;
  const selectPanel = (id: PanelId) => {
    setActivePanel(id);
    const firstPanel = groupPanels(PANEL_TO_GROUP.get(id) ?? '')[0];
    if (id === firstPanel) {
      if (panelsRef.current) panelsRef.current.scrollTop = 0;
    } else {
      requestAnimationFrame(() => {
        document.getElementById(`drawer-panel-${id}`)?.scrollIntoView();
      });
    }
  };
  const selectGroup = (groupId: string) => {
    const first = groupPanels(groupId)[0];
    if (first) selectPanel(first);
  };

  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= PANEL_GROUPS.length) {
        selectGroup(PANEL_GROUPS[num - 1].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  useEffect(() => {
    if (snapshot?.automation) {
      automationRefreshGeneration.current += 1;
      setFetchedAutomation(snapshot.automation);
    }
  }, [snapshot?.automation]);

  const automation = fetchedAutomation ?? snapshot?.automation;

  const refreshAutomation = useCallback(async () => {
    const generation = ++automationRefreshGeneration.current;
    try {
      const snap = await apiGet<AutomationSnapshot>(`/api/accounts/${account.id}/automation`);
      if (automationRefreshGeneration.current !== generation) return;
      setFetchedAutomation(snap);
    } catch {
      // Bỏ qua lỗi mạng khi load tự động ngầm
    }
  }, [account.id]);

  useEffect(() => {
    void refreshAutomation();
  }, [refreshAutomation]);

  const handleAutomationChange = useCallback((loaded: AutomationSnapshot) => {
    automationRefreshGeneration.current += 1;
    setFetchedAutomation(loaded);
  }, []);

  const handleAutomationCapabilityChange = useCallback((supported: boolean, loaded?: AutomationSnapshot) => {
    if (loaded) {
      automationRefreshGeneration.current += 1;
      setFetchedAutomation(loaded);
    } else if (!supported) {
      automationRefreshGeneration.current += 1;
      setFetchedAutomation(undefined);
    }
  }, []);
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + offset + PANEL_GROUPS.length) % PANEL_GROUPS.length;
    selectGroup(PANEL_GROUPS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const panelSlots = (
    <>
      <div id="drawer-panel-status" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('status')}` : undefined} hidden={!visible('status')}>
        <StatusPanel
          accountId={account.id}
          snap={snapshot}
          automation={automation}
          gameUser={account.gameUser}
          onChanged={() => {
            void reload();
            void refreshAutomation();
          }}
          onAutomationChange={handleAutomationChange}
          automationMutationBusy={automationMutationBusy}
          onAutomationMutationBusyChange={setAutomationMutationBusy}
        />
      </div>
      <div id="drawer-panel-settings" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('settings')}` : undefined} hidden={!visible('settings')}>
        <SettingsPanel
          account={account}
          snapshot={snapshot}
          automation={automation}
          onPlanDirtyChange={onPlanDirtyChange}
          onFishingDirtyChange={onFishingDirtyChange}
          onAutomationChange={handleAutomationChange}
          onChanged={() => {
            void reload();
            void refreshAutomation();
          }}
        />
      </div>
      <div id="drawer-panel-fishing" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('fishing')}` : undefined} hidden={!visible('fishing')}>
        <FishingPanel
          account={account}
          automation={automation}
          quests={snapshot?.quests ?? null}
          onChanged={() => {
            void reload();
            void refreshAutomation();
          }}
          onSelectSettingsTab={() => selectPanel('settings')}
        />
      </div>
      <div id="drawer-panel-mining" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('mining')}` : undefined} hidden={!visible('mining')}>
        <MiningPanel
          account={account}
          automation={automation}
          onChanged={() => {
            void reload();
            void refreshAutomation();
          }}
          onAutomationChange={handleAutomationChange}
        />
      </div>
      <div id="drawer-panel-maze" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('maze')}` : undefined} hidden={!visible('maze')}>
        <MazePanel
          account={account}
          automation={automation}
          onChanged={() => {
            void reload();
            void refreshAutomation();
          }}
          onAutomationChange={handleAutomationChange}
        />
      </div>
      {!FIND_NPC_TAB_HIDDEN && (
        <div id="drawer-panel-find_npc" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('find_npc')}` : undefined} hidden={!visible('find_npc')}>
          <FindNpcPanel
            accountId={account.id}
            automation={automation}
            onDirtyChange={onFindNpcDirtyChange}
            automationMutationBusy={automationMutationBusy}
            onAutomationMutationBusyChange={setAutomationMutationBusy}
            onAutomationCapabilityChange={handleAutomationCapabilityChange}
          />
        </div>
      )}
      <div id="drawer-panel-quests" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('quests')}` : undefined} hidden={!visible('quests')}>
        <QuestsPanel
          accountId={account.id}
          quests={snapshot?.quests ?? null}
        />
      </div>
      <div id="drawer-panel-cooking" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('cooking')}` : undefined} hidden={!visible('cooking')}>
        <CookingPanel
          cooking={snapshot?.cooking}
          foods={snapshot?.foods}
          items={snapshot?.items ?? []}
          trees={snapshot?.trees ?? []}
          animals={snapshot?.animals ?? []}
          produce={snapshot?.farmProduce ?? []}
          cookingMaterials={snapshot?.cookingMaterials ?? []}
        />
      </div>
      <div id="drawer-panel-assets" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('assets')}` : undefined} hidden={!visible('assets')}>
        <AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} produce={snapshot?.farmProduce ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} items={snapshot?.items ?? []} />
      </div>
      <div id="drawer-panel-shop" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('shop')}` : undefined} hidden={!visible('shop')}>
        <ShopPanel
          accountId={account.id}
          accountName={account.label}
          online={snapshot?.status === 'online'}
          shop={snapshot?.shop}
          produce={snapshot?.produce}
          trees={snapshot?.trees ?? []}
          animals={snapshot?.animals ?? []}
          items={snapshot?.items ?? []}
          foods={snapshot?.foods ?? []}
        />
      </div>
      <div id="drawer-panel-logs" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? `drawer-tab-${PANEL_TO_GROUP.get('logs')}` : undefined} hidden={!visible('logs')}>
        <LogPanel logs={snapshot?.logs ?? []} />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="drawer-operations">
        <nav className="drawer-tabbar" role="tablist" aria-label="Các mục vận hành">
          {PANEL_GROUPS.map((group, index) => (
            <button
              key={group.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`drawer-tab-${group.id}`}
              type="button"
              role="tab"
              aria-controls={group.panels.map((p) => `drawer-panel-${p}`).join(' ')}
              aria-selected={activeGroup === group.id}
              tabIndex={activeGroup === group.id ? 0 : -1}
              className={activeGroup === group.id ? 'active' : ''}
              onClick={() => selectGroup(group.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {group.label}
            </button>
          ))}
        </nav>
        <div ref={panelsRef} className="drawer-panels">
          {panelSlots}
        </div>
      </div>
    );
  }

  return (
    <div className="console-container">
      <div className="console-body">
        <aside className="console-sidebar" aria-label="Menu vận hành desktop">
          <div>
            <div className="console-nav-title">Phân hệ vận hành</div>
            <ul className="console-nav-menu">
              {DESKTOP_CONSOLE_GROUPS.map((group) => (
                <li key={group.id} className={`console-nav-item ${activeGroup === group.id ? 'active' : ''}`}>
                  <button
                    type="button"
                    onClick={() => selectGroup(group.id)}
                    aria-current={activeGroup === group.id ? 'page' : undefined}
                  >
                    <div className="console-nav-label-wrap">
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                    </div>
                    <span className="console-nav-hotkey">{group.hotkey}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="console-sidebar-footer">
            💡 Phím <strong>1–6</strong> để chuyển nhanh
          </div>
        </aside>
        <div ref={panelsRef} className="console-canvas">
          {panelSlots}
        </div>
      </div>
      <footer className="console-bottom-ticker">
        <div className="console-ticker-log">
          <span className="console-ticker-dot"></span>
          <span>Sẵn sàng • Đang xem: <strong>{DESKTOP_CONSOLE_GROUPS.find((g) => g.id === activeGroup)?.label}</strong></span>
        </div>
        <div>
          <button
            type="button"
            className="ghost"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => selectGroup('logs')}
          >
            Nhật ký gói tin (Phím 6)
          </button>
        </div>
      </footer>
    </div>
  );
}
