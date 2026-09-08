import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { apiGet } from '../api.js';
import type { AccountWithRuntime, AutomationSnapshot } from '../types.js';
import { useMediaQuery } from '../useMediaQuery.js';
import { useAccounts } from './AccountsProvider.js';
import { useAccountRuntime } from './useAccountRuntime.js';
import { useDialogFocus } from './useDialogFocus.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { AutoFarmPanel } from './panels/AutoFarmPanel.js';
import { CookingPanel } from './panels/CookingPanel.js';
import { FindNpcPanel } from './panels/FindNpcPanel.js';
import { FishingPanel } from './panels/FishingPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { QuestsPanel } from './panels/QuestsPanel.js';
import { ShopPanel } from './panels/ShopPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

const PANEL_TABS = [
  ['status', 'Trạng thái'],
  ['autofarm', 'Tự động'],
  ['fishing', 'Câu cá'],
  ['find_npc', 'Tìm NPC'],
  ['quests', 'Nhiệm vụ'],
  ['cooking', 'Nấu ăn'],
  ['assets', 'Tài sản'],
  ['shop', 'Sạp'],
  ['logs', 'Log'],
] as const;
type PanelId = (typeof PANEL_TABS)[number][0];

const FIND_NPC_TAB_HIDDEN = true;

const VISIBLE_TABS = PANEL_TABS.filter(
  ([id]) => !(id === 'find_npc' && FIND_NPC_TAB_HIDDEN),
) as Array<(typeof PANEL_TABS)[number]>;

export function AccountOperationsDrawer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const accountId = Number(id);
  const { accounts, loading, reload } = useAccounts();
  const account = Number.isInteger(accountId) && accountId > 0
    ? accounts.find((item) => item.id === accountId)
    : undefined;
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dirtySources, setDirtySources] = useState({ farm: false, findNpc: false });
  const anyDirty = dirtySources.farm || dirtySources.findNpc;
  const setFarmDirty = useCallback((dirty: boolean) => {
    setDirtySources((current) => current.farm === dirty ? current : { ...current, farm: dirty });
  }, []);
  const setFindNpcDirty = useCallback((dirty: boolean) => {
    setDirtySources((current) => current.findNpc === dirty ? current : { ...current, findNpc: dirty });
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

  const openDebug = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (canLeave()) navigate(`/accounts/${accountId}/debug`);
  };

  return (
    <div className="dialog-backdrop dialog-backdrop--drawer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <aside ref={dialogRef} className="account-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="dialog-heading">
          <div><p className="eyebrow">VẬN HÀNH</p><h2 id="drawer-title">{account ? `Vận hành ${account.label}` : 'Vận hành tài khoản'}</h2></div>
          <button ref={closeRef} type="button" className="ghost" onClick={close} aria-label="Đóng">×</button>
        </header>
        {loading ? <p className="hint">đang tải…</p> : account ? (
          <LoadedOperations
            key={account.id}
            account={account}
            reload={reload}
            onPlanDirtyChange={setFarmDirty}
            onFindNpcDirtyChange={setFindNpcDirty}
            onOpenDebug={openDebug}
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
  onFindNpcDirtyChange,
  onOpenDebug,
}: {
  account: AccountWithRuntime;
  reload(): Promise<void>;
  onPlanDirtyChange(dirty: boolean): void;
  onFindNpcDirtyChange(dirty: boolean): void;
  onOpenDebug(event: MouseEvent<HTMLAnchorElement>): void;
}) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  const isMobile = useMediaQuery('(max-width: 679px)');
  const [activePanel, setActivePanel] = useState<PanelId>('status');
  const [automationMutationBusy, setAutomationMutationBusy] = useState(false);
  const [automationSupported, setAutomationSupported] = useState<boolean | undefined>();
  const [fetchedAutomation, setFetchedAutomation] = useState<AutomationSnapshot | undefined>();
  const panelsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const visible = (id: PanelId) => !isMobile || activePanel === id;

  useEffect(() => {
    if (snapshot?.automation) {
      setFetchedAutomation(snapshot.automation);
    }
  }, [snapshot?.automation]);

  const automation = fetchedAutomation ?? snapshot?.automation;

  const refreshAutomation = useCallback(async () => {
    try {
      const snap = await apiGet<AutomationSnapshot>(`/api/accounts/${account.id}/automation`);
      setFetchedAutomation(snap);
      setAutomationSupported(true);
    } catch {
      // Bỏ qua lỗi mạng khi load tự động ngầm
    }
  }, [account.id]);

  useEffect(() => {
    void refreshAutomation();
  }, [refreshAutomation]);

  const handleAutomationChange = useCallback((loaded: AutomationSnapshot) => {
    setFetchedAutomation(loaded);
    setAutomationSupported(true);
  }, []);

  const handleAutomationCapabilityChange = useCallback((supported: boolean, loaded?: AutomationSnapshot) => {
    setAutomationSupported(supported);
    if (loaded) setFetchedAutomation(loaded);
    else if (!supported) setFetchedAutomation(undefined);
  }, []);
  const selectPanel = (id: PanelId) => {
    setActivePanel(id);
    if (panelsRef.current) panelsRef.current.scrollTop = 0;
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + offset + VISIBLE_TABS.length) % VISIBLE_TABS.length;
    const [nextPanel] = VISIBLE_TABS[nextIndex];
    selectPanel(nextPanel);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="drawer-operations">
      {isMobile && (
        <nav className="drawer-tabbar" role="tablist" aria-label="Các mục vận hành">
          {VISIBLE_TABS.map(([id, label], index) => (
            <button
              key={id}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`drawer-tab-${id}`}
              type="button"
              role="tab"
              aria-controls={`drawer-panel-${id}`}
              aria-selected={activePanel === id}
              tabIndex={activePanel === id ? 0 : -1}
              className={activePanel === id ? 'active' : ''}
              onClick={() => selectPanel(id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div ref={panelsRef} className="drawer-panels">
        <div id="drawer-panel-status" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-status' : undefined} hidden={!visible('status')}>
          <StatusPanel
            accountId={account.id}
            snap={snapshot}
            automation={automation}
            automationSupported={snapshot?.automation ? true : automationSupported}
            gameUser={account.gameUser}
            onChanged={() => {
              void reload();
              void refreshAutomation();
            }}
            automationMutationBusy={automationMutationBusy}
            onAutomationMutationBusyChange={setAutomationMutationBusy}
          />
        </div>
        <div id="drawer-panel-autofarm" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-autofarm' : undefined} hidden={!visible('autofarm')}>
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
        <div id="drawer-panel-fishing" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-fishing' : undefined} hidden={!visible('fishing')}>
          <FishingPanel
            account={account}
            automation={automation}
            quests={snapshot?.quests ?? null}
            onAutomationChange={handleAutomationChange}
            onChanged={() => {
              void reload();
              void refreshAutomation();
            }}
          />
        </div>
        {!FIND_NPC_TAB_HIDDEN && (
          <div id="drawer-panel-find_npc" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-find_npc' : undefined} hidden={!visible('find_npc')}>
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
        <div id="drawer-panel-quests" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-quests' : undefined} hidden={!visible('quests')}>
          <QuestsPanel
            accountId={account.id}
            quests={snapshot?.quests ?? null}
          />
        </div>
        <div id="drawer-panel-cooking" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-cooking' : undefined} hidden={!visible('cooking')}>
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
        <div id="drawer-panel-assets" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-assets' : undefined} hidden={!visible('assets')}>
          <AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} produce={snapshot?.farmProduce ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} items={snapshot?.items ?? []} />
        </div>
        <div id="drawer-panel-shop" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-shop' : undefined} hidden={!visible('shop')}>
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
        <div id="drawer-panel-logs" className="drawer-panel-slot" role={isMobile ? 'tabpanel' : undefined} aria-labelledby={isMobile ? 'drawer-tab-logs' : undefined} hidden={!visible('logs')}>
          <LogPanel logs={snapshot?.logs ?? []} />
        </div>
        <Link className="btn-link drawer-debug-link" to={`/accounts/${account.id}/debug`} onClick={onOpenDebug}>
          Debug chuyên sâu →
        </Link>
      </div>
    </div>
  );
}
