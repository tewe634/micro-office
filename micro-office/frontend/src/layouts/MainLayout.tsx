import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, AppstoreOutlined, TeamOutlined, UserOutlined, ContactsOutlined, ShoppingOutlined, InboxOutlined, ClockCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/auth';
import { useEffect } from 'react';
import { userApi } from '../api';

const { Header, Sider, Content } = Layout;

// role → 可见菜单 key 映射
const roleMenuMap: Record<string, string[]> = {
  ADMIN:    ['/workbench', '/threads', '/taskpool', '/org', '/users', '/objects', '/products', '/clock', '/admin'],
  HR:       ['/workbench', '/threads', '/taskpool', '/org', '/users', '/products', '/clock'],
  SALES:    ['/workbench', '/threads', '/taskpool', '/objects', '/products', '/clock'],
  PURCHASE: ['/workbench', '/threads', '/taskpool', '/objects', '/products', '/clock'],
  FINANCE:  ['/workbench', '/threads', '/taskpool', '/objects', '/products', '/clock'],
  STAFF:    ['/workbench', '/threads', '/taskpool', '/products', '/clock'],
};

const allMenuItems = [
  { key: '/workbench', icon: <HomeOutlined />, label: '工作台' },
  { key: '/threads', icon: <AppstoreOutlined />, label: '工作列表' },
  { key: '/taskpool', icon: <InboxOutlined />, label: '任务池' },
  { key: '/org', icon: <TeamOutlined />, label: '组织架构' },
  { key: '/users', icon: <UserOutlined />, label: '人员管理' },
  { key: '/objects', icon: <ContactsOutlined />, label: '外部对象' },
  { key: '/products', icon: <ShoppingOutlined />, label: '产品服务' },
  { key: '/clock', icon: <ClockCircleOutlined />, label: '打卡' },
  { key: '/admin', icon: <SettingOutlined />, label: '系统管理' },
];

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const logout = useAuthStore(s => s.logout);
  const role = useAuthStore(s => s.role);
  const setRole = useAuthStore(s => s.setRole);

  // 刷新时如果没有 role，从后端获取
  useEffect(() => {
    if (!role) {
      userApi.me().then((r: any) => { if (r.data?.role) setRole(r.data.role); });
    }
  }, []);

  const allowed = roleMenuMap[role || 'STAFF'] || roleMenuMap.STAFF;
  const menuItems = allMenuItems.filter(m => allowed.includes(m.key));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ height: 32, margin: 16, color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>微办公</div>
        <Menu theme="dark" selectedKeys={[loc.pathname]} items={menuItems} onClick={e => nav(e.key)} />
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
