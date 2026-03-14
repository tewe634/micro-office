import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import PortalPage from './pages/portal/PortalPage';
import WorkbenchPage from './pages/workbench/WorkbenchPage';
import ThreadListPage from './pages/thread/ThreadListPage';
import ThreadDetailPage from './pages/thread/ThreadDetailPage';
import OrgPage from './pages/org/OrgPage';
import UserPage from './pages/user/UserPage';
import ObjectPage from './pages/object/ObjectPage';
import ProductPage from './pages/product/ProductPage';
import TaskPoolPage from './pages/taskpool/TaskPoolPage';
import ClockPage from './pages/clock/ClockPage';
import AdminModulePage from './pages/admin/AdminModulePage';
import AdminTemplatePage from './pages/admin/AdminTemplatePage';
import AdminPermissionPage from './pages/admin/AdminPermissionPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { useAuthStore } from './store/auth';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/portal" />} />
            <Route path="portal" element={<PortalPage />} />
            <Route path="workbench" element={<WorkbenchPage />} />
            <Route path="threads" element={<ThreadListPage />} />
            <Route path="threads/:id" element={<ThreadDetailPage />} />
            <Route path="org" element={<OrgPage />} />
            <Route path="users" element={<UserPage />} />
            <Route path="objects" element={<ObjectPage />} />
            <Route path="products" element={<ProductPage />} />
            <Route path="taskpool" element={<TaskPoolPage />} />
            <Route path="clock" element={<ClockPage />} />
            <Route path="admin" element={<Navigate to="/admin/permissions" />} />
            <Route path="admin/permissions" element={<AdminPermissionPage />} />
            <Route path="admin/modules" element={<AdminModulePage />} />
            <Route path="admin/templates" element={<AdminTemplatePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
