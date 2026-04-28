import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Empty, Flex, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { userApi } from './api';
import { isTokenExpired, useAuthStore } from './store/auth';
import { uiText } from './constants/ui';
import { buildAllowedMenus, canAccessMenu, resolveAdminHomePath, resolveHomePath } from './constants/routes';

const MainLayout = lazy(() => import('./layouts/MainLayout'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const OrgPage = lazy(() => import('./pages/org/OrgPage'));
const ObjectPage = lazy(() => import('./pages/object/ObjectPage'));
const ProductPage = lazy(() => import('./pages/product/ProductPage'));
const AdminPermissionPage = lazy(() => import('./pages/admin/AdminPermissionPage'));
const AdminSalesCollabPage = lazy(() => import('./pages/admin/AdminSalesCollabPage'));
const AdminWorkflowNodeFeaturePage = lazy(() => import('./pages/admin/AdminWorkflowNodeFeaturePage'));
const AdminWorkflowNodeFeatureEditorPage = lazy(() => import('./pages/admin/AdminWorkflowNodeFeatureEditorPage'));
const AdminPortalBlockTemplatePage = lazy(() => import('./pages/admin/AdminPortalBlockTemplatePage'));
const AdminPortalBlockTemplateEditorPage = lazy(() => import('./pages/admin/AdminPortalBlockTemplateEditorPage'));
const AdminPortalTemplatePage = lazy(() => import('./pages/admin/AdminPortalTemplatePage'));
const AdminPortalTemplateEditorPage = lazy(() => import('./pages/admin/AdminPortalTemplateEditorPage'));
const AdminPortalTemplatePreviewPage = lazy(() => import('./pages/admin/AdminPortalTemplatePreviewPage'));
const AdminWorkflowTemplatePage = lazy(() => import('./pages/admin/AdminWorkflowTemplatePage'));
const AdminWorkflowTemplateEditorPage = lazy(() => import('./pages/admin/AdminWorkflowTemplateEditorPage'));
const AdminDailyEntryPage = lazy(() => import('./pages/admin/AdminDailyEntryPage'));
const PortalPage = lazy(() => import('./pages/portal/PortalPage'));

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

function PageFallback() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100dvh', width: '100%' }}>
      <Spin size="large" />
    </Flex>
  );
}

function HomeRedirect() {
  const menus = useAuthStore(s => s.menus);
  return <Navigate to={resolveHomePath(menus)} replace />;
}

function AdminRouteRedirect() {
  const menus = useAuthStore(s => s.menus);
  return <Navigate to={resolveAdminHomePath(menus)} replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const isAuthReady = useAuthStore(s => s.isAuthReady);
  if (!isAuthReady) return <PageFallback />;
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function MenuRouteGuard({ menuKey, children }: { menuKey: string; children: React.ReactNode }) {
  const menus = useAuthStore(s => s.menus);
  const allowedMenus = buildAllowedMenus(menus);
  const allowed = canAccessMenu(menuKey, allowedMenus);
  if (!allowed) return <HomeRedirect />;
  return <>{children}</>;
}

function LoginRoute() {
  const token = useAuthStore(s => s.token);
  const isAuthReady = useAuthStore(s => s.isAuthReady);
  if (!isAuthReady) return <PageFallback />;
  return token ? <HomeRedirect /> : <LoginPage />;
}

export default function App() {
  const token = useAuthStore(s => s.token);
  const isAuthReady = useAuthStore(s => s.isAuthReady);
  const setProfile = useAuthStore(s => s.setProfile);
  const markAuthReady = useAuthStore(s => s.markAuthReady);
  const logout = useAuthStore(s => s.logout);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      if (!token) {
        if (!isAuthReady) markAuthReady();
        return;
      }
      if (isAuthReady) return;
      if (isTokenExpired(token)) {
        logout();
        return;
      }
      try {
        const me: any = await userApi.me();
        if (cancelled) return;
        setProfile({
          userId: me.data?.id ?? null,
          name: me.data?.name ?? null,
          role: me.data?.role ?? null,
          menus: me.data?.menus || [],
          objectTypes: me.data?.objectTypes || [],
        });
      } catch (error: any) {
        if (cancelled) return;
        if (error?.response?.status === 401) {
          logout();
          return;
        }
        markAuthReady();
      }
    };

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [token, isAuthReady, markAuthReady, setProfile, logout]);

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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route index element={<HomeRedirect />} />
              <Route path="org" element={<MenuRouteGuard menuKey="/org"><OrgPage /></MenuRouteGuard>} />
              <Route path="users" element={<MenuRouteGuard menuKey="/users"><Navigate to="/org?tab=users" replace /></MenuRouteGuard>} />
              <Route path="users/:id/portal" element={<MenuRouteGuard menuKey="/users"><Navigate to="/org?tab=users" replace /></MenuRouteGuard>} />
              <Route path="users/:id/portal/details/:detailSection" element={<MenuRouteGuard menuKey="/users"><Navigate to="/org?tab=users" replace /></MenuRouteGuard>} />
              <Route path="objects" element={<MenuRouteGuard menuKey="/objects"><ObjectPage /></MenuRouteGuard>} />
              <Route path="objects/:id/portal" element={<MenuRouteGuard menuKey="/objects"><PortalPage entityType="objects" /></MenuRouteGuard>} />
              <Route path="products" element={<MenuRouteGuard menuKey="/products"><ProductPage /></MenuRouteGuard>} />
              <Route path="products/:id/portal" element={<MenuRouteGuard menuKey="/products"><PortalPage entityType="products" /></MenuRouteGuard>} />
              <Route path="admin" element={<MenuRouteGuard menuKey="/admin"><AdminRouteRedirect /></MenuRouteGuard>} />
              <Route path="admin/permissions" element={<MenuRouteGuard menuKey="/admin/permissions"><AdminPermissionPage /></MenuRouteGuard>} />
              <Route path="admin/sales-collab" element={<MenuRouteGuard menuKey="/admin/sales-collab"><AdminSalesCollabPage /></MenuRouteGuard>} />
              <Route path="admin/workflow-node-features" element={<MenuRouteGuard menuKey="/admin/workflow-node-features"><AdminWorkflowNodeFeaturePage /></MenuRouteGuard>} />
              <Route path="admin/workflow-node-features/:id" element={<MenuRouteGuard menuKey="/admin/workflow-node-features"><AdminWorkflowNodeFeatureEditorPage /></MenuRouteGuard>} />
              <Route path="admin/portal-block-templates" element={<MenuRouteGuard menuKey="/admin/portal-block-templates"><AdminPortalBlockTemplatePage /></MenuRouteGuard>} />
              <Route path="admin/portal-block-templates/:id" element={<MenuRouteGuard menuKey="/admin/portal-block-templates"><AdminPortalBlockTemplateEditorPage /></MenuRouteGuard>} />
              <Route path="admin/workflow-templates" element={<MenuRouteGuard menuKey="/admin/workflow-templates"><AdminWorkflowTemplatePage /></MenuRouteGuard>} />
              <Route path="admin/workflow-templates/:id" element={<MenuRouteGuard menuKey="/admin/workflow-templates"><AdminWorkflowTemplateEditorPage /></MenuRouteGuard>} />
              <Route path="admin/daily-entries" element={<MenuRouteGuard menuKey="/admin/daily-entries"><AdminDailyEntryPage /></MenuRouteGuard>} />
              <Route path="admin/portal-templates" element={<MenuRouteGuard menuKey="/admin/portal-templates"><AdminPortalTemplatePage /></MenuRouteGuard>} />
              <Route path="admin/portal-templates/:id/preview" element={<MenuRouteGuard menuKey="/admin/portal-templates"><AdminPortalTemplatePreviewPage /></MenuRouteGuard>} />
              <Route path="admin/portal-templates/:id" element={<MenuRouteGuard menuKey="/admin/portal-templates"><AdminPortalTemplateEditorPage /></MenuRouteGuard>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}
