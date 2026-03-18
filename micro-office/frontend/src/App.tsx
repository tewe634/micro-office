import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import OrgPage from './pages/org/OrgPage';
import UserPage from './pages/user/UserPage';
import ObjectPage from './pages/object/ObjectPage';
import ProductPage from './pages/product/ProductPage';
import AdminPermissionPage from './pages/admin/AdminPermissionPage';
import { useAuthStore } from './store/auth';

const defaultRouteOrder = ['/workbench', '/org', '/users', '/objects', '/products', '/admin/permissions'];

function HomeRedirect() {
  const menus = useAuthStore(s => s.menus);
  const first = defaultRouteOrder.find(route => menus.includes(route) || (route === '/admin/permissions' && menus.includes('/admin')));
  return <Navigate to={first || '/objects'} replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function MenuRouteGuard({ menuKey, children }: { menuKey: string; children: React.ReactNode }) {
  const menus = useAuthStore(s => s.menus);
  const allowed = menus.includes(menuKey) || (menuKey.startsWith('/admin') && menus.includes('/admin'));
  if (!allowed) return <HomeRedirect />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="org" element={<MenuRouteGuard menuKey="/org"><OrgPage /></MenuRouteGuard>} />
            <Route path="users" element={<MenuRouteGuard menuKey="/users"><UserPage /></MenuRouteGuard>} />
            <Route path="objects" element={<MenuRouteGuard menuKey="/objects"><ObjectPage /></MenuRouteGuard>} />
            <Route path="products" element={<MenuRouteGuard menuKey="/products"><ProductPage /></MenuRouteGuard>} />
            <Route path="admin" element={<MenuRouteGuard menuKey="/admin"><Navigate to="/admin/permissions" replace /></MenuRouteGuard>} />
            <Route path="admin/permissions" element={<MenuRouteGuard menuKey="/admin/permissions"><AdminPermissionPage /></MenuRouteGuard>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
