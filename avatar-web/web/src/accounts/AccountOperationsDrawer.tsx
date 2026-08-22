import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { AccountWithRuntime } from '../types.js';
import { useMediaQuery } from '../useMediaQuery.js';
import { useAccounts } from './AccountsProvider.js';
import { useAccountRuntime } from './useAccountRuntime.js';
import { useDialogFocus } from './useDialogFocus.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { AutoFarmPanel } from './panels/AutoFarmPanel.js';
import { CookingPanel } from './panels/CookingPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { QuestsPanel } from './panels/QuestsPanel.js';
import { ShopPanel } from './panels/ShopPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

const PANEL_TABS = [
  ['status', 'Trạng thái'],
  ['autofarm', 'Tự động'],
  ['quests', 'Nhiệm vụ'],
  ['cooking', 'Nấu ăn'],
  ['assets', 'Tài sản'],
  ['shop', 'Sạp'],
  ['logs', 'Log'],
] as const;
type PanelId = (typeof PANEL_TABS)[number][0];

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
  const [planDirty, setPlanDirty] = useState(false);
  const canLeave = () => !planDirty || window.confirm('Kế hoạch cây chưa lưu. Bỏ thay đổi?');
  const close = () => {
    if (canLeave()) navigate('/accounts');
  };
  useDialogFocus({ open: true, containerRef: dialogRef, initialFocusRef: closeRef, onClose: close });

  useEffect(() => {
    if (!planDirty) return;
    const blockUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnload);
    return () => window.removeEventListener('beforeunload', blockUnload);
  }, [planDirty]);

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
            account={account}
            reload={reload}
            onPlanDirtyChange={setPlanDirty}
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
  onOpenDebug,
}: {
  account: AccountWithRuntime;
  reload(): Promise<void>;
  onPlanDirtyChange(dirty: boolean): void;
  onOpenDebug(event: MouseEvent<HTMLAnchorElement>): void;
}) {
  const snapshot = useAccountRuntime(account.id, account.runtime);
  const isMobile = useMediaQuery('(max-width: 679px)');
  const [activePanel, setActivePanel] = useState<PanelId>('status');
  const visible = (id: PanelId) => !isMobile || activePanel === id;

  return (
    <>
      {isMobile && (
        <nav className="drawer-tabbar" role="tablist" aria-label="Các mục vận hành">
          {PANEL_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activePanel === id}
              className={activePanel === id ? 'active' : ''}
              onClick={() => setActivePanel(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="drawer-panels">
        <div className="drawer-panel-slot" hidden={!visible('status')}>
          <StatusPanel accountId={account.id} snap={snapshot} gameUser={account.gameUser} onChanged={() => void reload()} />
        </div>
        <div className="drawer-panel-slot" hidden={!visible('autofarm')}>
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
        <div className="drawer-panel-slot" hidden={!visible('quests')}>
          <QuestsPanel
            accountId={account.id}
            quests={snapshot?.quests ?? null}
          />
        </div>
        <div className="drawer-panel-slot" hidden={!visible('cooking')}>
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
        <div className="drawer-panel-slot" hidden={!visible('assets')}>
          <AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} produce={snapshot?.farmProduce ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} items={snapshot?.items ?? []} />
        </div>
        <div className="drawer-panel-slot" hidden={!visible('shop')}>
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
        <div className="drawer-panel-slot" hidden={!visible('logs')}>
          <LogPanel logs={snapshot?.logs ?? []} />
        </div>
        <Link className="btn-link drawer-debug-link" to={`/accounts/${account.id}/debug`} onClick={onOpenDebug}>
          Debug chuyên sâu →
        </Link>
      </div>
    </>
  );
}
