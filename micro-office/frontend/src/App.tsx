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
  return token ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="org" element={<OrgPage />} />
            <Route path="users" element={<UserPage />} />
            <Route path="objects" element={<ObjectPage />} />
            <Route path="products" element={<ProductPage />} />
            <Route path="admin" element={<Navigate to="/admin/permissions" />} />
            <Route path="admin/permissions" element={<AdminPermissionPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
