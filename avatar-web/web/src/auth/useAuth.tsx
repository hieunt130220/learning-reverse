import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { apiGet, apiPost } from '../api.js';
import { connectWs } from '../ws.js';
import type { AuthUser } from '../types.js';

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, inviteCode: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await apiGet<AuthUser>('/api/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // WS chỉ mở sau khi đã có phiên — server đóng ngay kết nối không xác thực.
  useEffect(() => {
    if (user) connectWs();
  }, [user]);

  const value: AuthValue = {
    user,
    loading,
    async login(email, password) {
      setUser(await apiPost<AuthUser>('/api/auth/login', { email, password }));
    },
    async register(email, password, inviteCode) {
      setUser(await apiPost<AuthUser>('/api/auth/register', { email, password, inviteCode }));
    },
    async logout() {
      await apiPost('/api/auth/logout');
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}

/** Bọc mọi route cần đăng nhập. Chưa đăng nhập thì đá về /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="hint" style={{ padding: 24 }}>đang tải…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
