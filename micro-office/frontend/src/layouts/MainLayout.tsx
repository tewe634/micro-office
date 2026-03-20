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
import { useAuthStore } from '../store/auth';
import { useEffect, useMemo, useState } from 'react';
import { userApi } from '../api';

const { Header, Sider, Content } = Layout;

const menuDefs: Record<string, { icon: React.ReactNode; label: string }> = {
  '/org': { icon: <TeamOutlined />, label: '组织架构' },
  '/users': { icon: <UserOutlined />, label: '人员管理' },
  '/objects': { icon: <ContactsOutlined />, label: '外部对象' },
  '/products': { icon: <ShoppingOutlined />, label: '产品服务' },
};

const menuOrder = ['/org', '/users', '/objects', '/products'];

const adminChildren = [
  { key: '/admin/permissions', label: '权限配置' },
];

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const logout = useAuthStore(s => s.logout);
  const setRole = useAuthStore(s => s.setRole);
  const setMenus = useAuthStore(s => s.setMenus);
  const storedMenus = useAuthStore(s => s.menus);
  const [allowedMenus, setAllowedMenus] = useState<string[]>(storedMenus);
  const [userName, setUserName] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  const baseMenus: string[] = ['/org'];

  useEffect(() => {
    userApi.me().then((r: any) => {
      if (r.data?.role) setRole(r.data.role);
      if (r.data?.name) setUserName(r.data.name);
      if (r.data?.menus) {
        const merged = [...new Set([...baseMenus, ...r.data.menus])];
        setMenus(merged);
        setAllowedMenus(merged);
      }
    });
  }, []);

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

  const selectedKeys = [loc.pathname];
  const openKeys = loc.pathname.startsWith('/admin') ? ['/admin'] : [];

  const handleLogout = () => {
    logout();
    nav('/login');
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
        style={{ overflow: 'hidden' }}
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
              color: '#001529',
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
              border: '1px solid #f0f0f0',
            }}
          />

          <div
            style={{
              height: 64,
              padding: collapsed ? '16px 12px' : '16px 48px 16px 16px',
              color: '#fff',
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
              theme="dark"
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
                  color: '#fff',
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
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Space size={12}>
            <span style={{ color: '#888', fontSize: 13 }}>您好，{userName}</span>
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
