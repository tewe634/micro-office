import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, AppstoreOutlined, TeamOutlined, UserOutlined, ContactsOutlined, ShoppingOutlined, InboxOutlined, ClockCircleOutlined, SettingOutlined, IdcardOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/auth';
import { useEffect, useState } from 'react';
import { userApi } from '../api';

const { Header, Sider, Content } = Layout;

const menuDefs: Record<string, { icon: React.ReactNode; label: string }> = {
  '/portal': { icon: <IdcardOutlined />, label: '个人门户' },
  '/workbench': { icon: <HomeOutlined />, label: '工作台' },
  '/threads': { icon: <AppstoreOutlined />, label: '工作列表' },
  '/taskpool': { icon: <InboxOutlined />, label: '任务池' },
  '/org': { icon: <TeamOutlined />, label: '组织架构' },
  '/users': { icon: <UserOutlined />, label: '人员管理' },
  '/objects': { icon: <ContactsOutlined />, label: '外部对象' },
  '/products': { icon: <ShoppingOutlined />, label: '产品服务' },
  '/clock': { icon: <ClockCircleOutlined />, label: '打卡' },
  '/dashboard': { icon: <BarChartOutlined />, label: '数据汇总' },
};

// 菜单顺序
const menuOrder = ['/portal', '/workbench', '/threads', '/taskpool', '/org', '/users', '/objects', '/products', '/clock', '/dashboard'];

const adminChildren = [
  { key: '/admin/permissions', label: '权限配置' },
  { key: '/admin/modules', label: '模块配置' },
  { key: '/admin/templates', label: '流程模板' },
];

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const logout = useAuthStore(s => s.logout);
  const role = useAuthStore(s => s.role);
  const setRole = useAuthStore(s => s.setRole);
  const setMenus = useAuthStore(s => s.setMenus);
  const storedMenus = useAuthStore(s => s.menus);
  const [allowedMenus, setAllowedMenus] = useState<string[]>(storedMenus);

  useEffect(() => {
    userApi.me().then((r: any) => {
      if (r.data?.role) setRole(r.data.role);
      if (r.data?.menus) { setMenus(r.data.menus); setAllowedMenus(r.data.menus); }
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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ height: 32, margin: 16, color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>微办公</div>
        <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} defaultOpenKeys={openKeys}
          items={menuItems} onClick={e => nav(e.key)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#888', fontSize: 13 }}>{role || ''}</span>
          <a onClick={() => { logout(); nav('/login'); }}>退出登录</a>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
