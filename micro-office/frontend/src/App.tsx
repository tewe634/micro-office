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
          colorInfo: '#2563eb',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#dc2626',
          colorText: '#111827',
          colorTextSecondary: '#6b7280',
          colorBgLayout: '#f6f7fb',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorFillSecondary: '#f8fafc',
          colorFillTertiary: '#f3f4f6',
          colorBorder: '#e5e7eb',
          colorBorderSecondary: '#eef2f7',
          borderRadius: 12,
          controlHeight: 38,
          fontSize: 14,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          boxShadowSecondary: '0 12px 28px rgba(15, 23, 42, 0.08)',
          boxShadowTertiary: '0 8px 18px rgba(15, 23, 42, 0.05)',
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
