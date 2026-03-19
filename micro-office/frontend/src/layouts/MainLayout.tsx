import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TeamOutlined, UserOutlined, ContactsOutlined, ShoppingOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/auth';
import { useEffect, useState } from 'react';
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

  return (
    <Layout style={{ height: '100dvh', minHeight: '100dvh' }}>
      <Sider collapsible style={{ overflow: 'auto' }}>
        <div style={{ height: 32, margin: 16, color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>东华微办公</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={e => nav(e.key)}
        />
      </Sider>
      <Layout style={{ minHeight: 0 }}>
        <Header style={{ flex: '0 0 64px', background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#888', fontSize: 13 }}>您好，{userName}</span>
          <a onClick={() => { logout(); nav('/login'); }}>退出登录</a>
        </Header>
        <Content style={{ flex: 1, minHeight: 0, margin: 24, overflow: 'hidden', display: 'flex' }}>
          <div className="page-fill" style={{ flex: 1, minHeight: 0 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
