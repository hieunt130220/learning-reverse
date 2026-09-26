import { Navigate, Route, Routes } from 'react-router-dom';

import { AccountDebugPage } from './accounts/AccountDebugPage.js';
import { AccountOperationsDrawer } from './accounts/AccountOperationsDrawer.js';
import { AccountsDashboardPage } from './accounts/AccountsDashboardPage.js';
import { AccountsProvider } from './accounts/AccountsProvider.js';
import { LoginPage } from './auth/LoginPage.js';
import { RegisterPage } from './auth/RegisterPage.js';
import { AuthProvider, RequireAuth } from './auth/useAuth.js';
import { MonitoringPage } from './admin/MonitoringPage.js';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/monitoring" element={<RequireAuth><MonitoringPage /></RequireAuth>} />
        {/* Ba route tài khoản dùng chung một provider: đóng/mở drawer không phải
            nạp lại danh sách chỉ để dựng lại dashboard phía sau. */}
        <Route path="/accounts" element={<RequireAuth><AccountsProvider /></RequireAuth>}>
          <Route element={<AccountsDashboardPage />}>
            <Route index element={<></>} />
            <Route path=":id" element={<AccountOperationsDrawer />} />
          </Route>
          <Route path=":id/debug" element={<AccountDebugPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </AuthProvider>
  );
}
