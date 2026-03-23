import { Layout, Menu, Button, Dropdown, Modal, Form, Input, Space, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  TeamOutlined,
  UserOutlined,
  ContactsOutlined,
  ShoppingOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LockOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { authApi, userApi } from '../api';
import { useAuthStore } from '../store/auth';
import { useMemo, useState } from 'react';

const { Header, Sider, Content } = Layout;

const menuDefs: Record<string, { icon: React.ReactNode; label: string }> = {
  '/org': { icon: <TeamOutlined />, label: '组织架构' },
  '/users': { icon: <UserOutlined />, label: '人员管理' },
  '/objects': { icon: <ContactsOutlined />, label: '外部对象' },
  '/products': { icon: <ShoppingOutlined />, label: '产品服务' },
  '/admin/permissions': { icon: <SettingOutlined />, label: '权限配置' },
};

const pageTitles: Record<string, string> = {
  '/org': '公司整体组织架构',
  '/users': '人员管理',
  '/objects': '外部对象管理',
  '/products': '产品与服务',
  '/admin/permissions': '权限配置',
};

const menuOrder = ['/org', '/users', '/objects', '/products'];

const adminChildren = [
  { key: '/admin/permissions', label: '权限配置' },
];

function resolveSelectedKey(pathname: string) {
  if (pathname.startsWith('/admin')) return pathname.startsWith('/admin/permissions') ? '/admin/permissions' : '/admin';
  if (pathname.startsWith('/users')) return '/users';
  if (pathname.startsWith('/objects')) return '/objects';
  if (pathname.startsWith('/products')) return '/products';
  if (pathname.startsWith('/org')) return '/org';
  return pathname;
}

function resolvePageTitle(pathname: string) {
  if (/^\/users\/[^/]+\/portal$/.test(pathname)) return '人员门户';
  if (/^\/objects\/[^/]+\/portal$/.test(pathname)) return '外部对象门户';
  if (/^\/products\/[^/]+\/portal$/.test(pathname)) return '产品门户';
  return pageTitles[pathname] || '东华微办公';
}

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const logout = useAuthStore(s => s.logout);
  const userMenus = useAuthStore(s => s.menus);
  const userName = useAuthStore(s => s.name);
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  const baseMenus: string[] = ['/org'];

  const allowedMenus = useMemo(() => [...new Set([...baseMenus, ...userMenus])], [userMenus]);

  const menuItems = menuOrder
    .filter(key => allowedMenus.includes(key) && menuDefs[key])
    .map(key => ({ key, icon: menuDefs[key].icon, label: menuDefs[key].label }));

  if (allowedMenus.includes('/admin')) {
    menuItems.push({
      key: '/admin',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: adminChildren,
    } as any);
  }

  const selectedKeys = [resolveSelectedKey(loc.pathname)];
  const openKeys = loc.pathname.startsWith('/admin') ? ['/admin'] : [];
  const currentTitle = resolvePageTitle(loc.pathname);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      nav('/login', { replace: true });
    } catch (error) {
      if ((error as any)?.response?.status === 401) {
        logout();
        nav('/login', { replace: true });
        return;
      }
      message.error('退出登录失败，请重试');
    }
  };

  const handleChangePassword = async (values: any) => {
    await userApi.changeMyPassword(values.password);
    message.success('密码修改成功');
    setPasswordModalOpen(false);
    passwordForm.resetFields();
  };

  const settingsItems = useMemo(() => ([
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: '修改密码',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ]), []);

  return (
    <Layout style={{ height: '100dvh', minHeight: '100dvh' }}>
      <Sider
        collapsed={collapsed}
        collapsible
        trigger={null}
        width={220}
        style={{ overflow: 'hidden', background: '#f5f6f8', borderRight: '1px solid #e5e7eb' }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Button
            type="text"
            shape="circle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(v => !v)}
            style={{
              position: 'absolute',
              top: 16,
              right: 12,
              zIndex: 20,
              color: '#4b5563',
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
              border: '1px solid #e5e7eb',
            }}
          />

          <div
            style={{
              height: 64,
              padding: collapsed ? '16px 12px' : '16px 48px 16px 16px',
              color: '#111827',
              fontWeight: 'bold',
              fontSize: collapsed ? 14 : 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {collapsed ? '东华' : '东华微办公'}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={selectedKeys}
              defaultOpenKeys={openKeys}
              items={menuItems}
              onClick={e => nav(e.key)}
            />
          </div>

          <div style={{ padding: collapsed ? '12px 8px 16px' : '12px 12px 16px' }}>
            <Dropdown
              trigger={['click']}
              placement="topRight"
              menu={{
                items: settingsItems,
                onClick: ({ key }) => {
                  if (key === 'change-password') {
                    setPasswordModalOpen(true);
                    passwordForm.resetFields();
                  }
                  if (key === 'logout') {
                    handleLogout();
                  }
                },
              }}
            >
              <Button
                type="text"
                icon={<SettingOutlined />}
                style={{
                  width: '100%',
                  height: 40,
                  color: '#4b5563',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 8,
                  paddingInline: collapsed ? 0 : 12,
                }}
              >
                {!collapsed ? '设置' : null}
              </Button>
            </Dropdown>
          </div>
        </div>
      </Sider>

      <Layout style={{ minHeight: 0 }}>
        <Header
          style={{
            flex: '0 0 64px',
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{currentTitle}</div>
          <Space size={12}>
            <span style={{ color: '#888', fontSize: 13 }}>您好，{userName || ''}</span>
          </Space>
        </Header>

        <Content style={{ flex: 1, minHeight: 0, margin: 24, overflow: 'hidden', display: 'flex' }}>
          <div className="page-fill" style={{ flex: 1, minHeight: 0 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Modal
        okText="确定"
        cancelText="取消"
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
        width={420}
      >
        <Form form={passwordForm} onFinish={handleChangePassword} layout="vertical">
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, min: 6, message: '密码至少6位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
