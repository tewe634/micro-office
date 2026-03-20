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
  '/admin/permissions': { icon: <SettingOutlined />, label: '权限配置' },
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
  const currentTitle = menuDefs[loc.pathname]?.label || '东华微办公';
  const userInitial = (userName || '我').trim().charAt(0) || '我';

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
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        theme="light"
        collapsed={collapsed}
        collapsedWidth={84}
        collapsible
        trigger={null}
        width={236}
      >
        <div className="app-sider__inner">
          <Button
            className="app-collapse-button"
            type="text"
            shape="circle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(v => !v)}
          />

          <div className={`app-brand${collapsed ? ' is-collapsed' : ''}`}>
            <div className="app-brand__mark">微</div>
            {!collapsed ? (
              <div className="app-brand__meta">
                <div className="app-brand__title">东华微办公</div>
                <div className="app-brand__subtitle">简单、清晰、好用</div>
              </div>
            ) : null}
          </div>

          <div className="app-menu-wrap">
            <Menu
              className="app-menu"
              theme="light"
              mode="inline"
              selectedKeys={selectedKeys}
              defaultOpenKeys={openKeys}
              items={menuItems}
              onClick={e => nav(e.key)}
            />
          </div>

          <div className="app-settings-wrap">
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
              <Button className="app-settings-button" type="text" icon={<SettingOutlined />}>
                {!collapsed ? '设置' : null}
              </Button>
            </Dropdown>
          </div>
        </div>
      </Sider>

      <Layout className="app-main">
        <Header className="app-header">
          <div className="app-header__title">
            <div className="app-header__heading">{currentTitle}</div>
            <div className="app-header__caption">AI 风格极简工作台</div>
          </div>
          <Space size={12}>
            <div className="app-user-chip">
              <span className="app-user-chip__avatar">{userInitial}</span>
              <span className="app-user-chip__text">{userName || '当前用户'}</span>
            </div>
          </Space>
        </Header>

        <Content className="app-content">
          <div className="page-fill app-content__inner">
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
