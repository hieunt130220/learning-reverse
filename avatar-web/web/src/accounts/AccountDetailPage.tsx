import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiGet } from '../api.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import type { AccountWithRuntime, SessionSnapshot } from '../types.js';
import { StatusBadge } from './AccountsPage.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { AutoFarmPanel } from './panels/AutoFarmPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

type Tab = 'van-hanh' | 'debug';

export function AccountDetailPage() {
  const accountId = Number(useParams().id);
  const [account, setAccount] = useState<AccountWithRuntime | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('van-hanh');
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    try {
      const list = await apiGet<AccountWithRuntime[]>('/api/accounts');
      const found = list.find((a) => a.id === accountId) ?? null;
      setAccount(found);
      setSnap(found?.runtime ?? null);
      setErr(found ? '' : 'không có tài khoản này');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [accountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Trang chi tiết là nơi duy nhất cần sự kiện nặng (log, gói tin, farm). Đăng ký
  // khi vào, huỷ khi rời — nếu không thì mở một tab là mọi tab đều gánh traffic.
  useEffect(() => {
    if (!Number.isInteger(accountId)) return;
    subscribeAccounts([accountId]);
    return () => subscribeAccounts([]);
  }, [accountId]);

  useEffect(
    () =>
      onWsMessage((msg) => {
        if (msg.accountId !== accountId) return;
        if (msg.type === 'snapshot') return setSnap(msg.payload);
        setSnap((s) => {
          if (!s) return s;
          switch (msg.type) {
            case 'status':
              return { ...s, status: msg.payload };
            case 'auto':
              return { ...s, auto: msg.payload };
            case 'macro':
              return { ...s, macro: msg.payload };
            case 'farm':
              return { ...s, farm: msg.payload };
            case 'inventory':
              return { ...s, inventory: msg.payload };
            case 'money':
              return { ...s, money: msg.payload.balance ?? s.money };
            case 'trees':
              return {
                ...s,
                trees: msg.payload.trees ?? [],
                items: msg.payload.items ?? [],
                animals: msg.payload.animals ?? [],
              };
            case 'log':
              return { ...s, logs: [...s.logs.slice(-499), msg.payload] };
            case 'traffic':
              return { ...s, traffic: [...s.traffic.slice(-299), msg.payload] };
            default:
              return s;
          }
        });
      }),
    [accountId],
  );

  if (err) {
    return (
      <div className="app">
        <p className="err">{err}</p>
        <Link to="/accounts">← về danh sách</Link>
      </div>
    );
  }
  if (!account) return <p className="hint" style={{ padding: 24 }}>đang tải…</p>;

  return (
    <div className="app">
      <header>
        <Link to="/accounts">←</Link>
        <h1>{account.label}</h1>
        <StatusBadge status={snap?.status ?? 'idle'} />
      </header>

      <div className="tabs">
        <button
          className={tab === 'van-hanh' ? 'tab active' : 'tab'}
          onClick={() => setTab('van-hanh')}
        >
          Vận hành
        </button>
        <button className={tab === 'debug' ? 'tab active' : 'tab'} onClick={() => setTab('debug')}>
          Debug
        </button>
      </div>

      {tab === 'van-hanh' && (
        <div className="cols">
          <div className="col">
            <StatusPanel
              accountId={accountId}
              snap={snap}
              gameUser={account.gameUser}
              onChanged={() => void reload()}
            />
            <AutoFarmPanel
              accountId={accountId}
              auto={snap?.auto ?? { running: false, cycle: 0, lastActions: [] }}
              items={snap?.items ?? []}
            />
          </div>
          <div className="col">
            <AssetsPanel
              accountId={accountId}
              farm={snap?.farm ?? null}
              inventory={snap?.inventory ?? []}
              trees={snap?.trees ?? []}
              animals={snap?.animals ?? []}
            />
            <LogPanel logs={snap?.logs ?? []} />
          </div>
        </div>
      )}

      {tab === 'debug' && <p className="hint">tab Debug — sẽ có ở task sau</p>}
    </div>
  );
}
