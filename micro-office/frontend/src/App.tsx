import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Empty } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import OrgPage from './pages/org/OrgPage';
import UserAndPositionPage from './pages/user/UserAndPositionPage';
import ObjectPage from './pages/object/ObjectPage';
import ProductPage from './pages/product/ProductPage';
import AdminPermissionPage from './pages/admin/AdminPermissionPage';
import { useAuthStore } from './store/auth';
import { uiText } from './constants/ui';

const appLocale = {
  ...zhCN,
  Pagination: {
    ...zhCN.Pagination,
    items_per_page: '条/页',
    jump_to: '跳至',
    jump_to_confirm: '确定',
    page: '页',
    prev_page: '上一页',
    next_page: '下一页',
    prev_5: '向前 5 页',
    next_5: '向后 5 页',
    prev_3: '向前 3 页',
    next_3: '向后 3 页',
    page_size: '页码',
  },
  Modal: {
    ...zhCN.Modal,
    okText: '确定',
    cancelText: '取消',
    justOkText: '知道了',
  },
  Popconfirm: {
    ...zhCN.Popconfirm,
    okText: '确定',
    cancelText: '取消',
  },
};

function HomeRedirect() {
  return <Navigate to="/org" replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function MenuRouteGuard({ menuKey, children }: { menuKey: string; children: React.ReactNode }) {
  const menus = useAuthStore(s => s.menus);
  const allowed = menuKey === '/org' || menus.includes(menuKey) || (menuKey.startsWith('/admin') && menus.includes('/admin'));
  if (!allowed) return <HomeRedirect />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider
      locale={appLocale}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          colorBgLayout: '#f6f8fb',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: '#e6ebf2',
          colorBorderSecondary: '#eef2f7',
          colorFillTertiary: '#f8fafc',
          borderRadius: 16,
          controlHeight: 40,
          fontSize: 14,
          boxShadowSecondary: '0 18px 40px rgba(15, 23, 42, 0.08)',
          boxShadowTertiary: '0 10px 24px rgba(15, 23, 42, 0.06)',
        },
      }}
      renderEmpty={() => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiText.appEmpty} />}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="org" element={<MenuRouteGuard menuKey="/org"><OrgPage /></MenuRouteGuard>} />
            <Route path="users" element={<MenuRouteGuard menuKey="/users"><UserAndPositionPage /></MenuRouteGuard>} />
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
