import { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi, userApi } from '../../api';
import { useAuthStore } from '../../store/auth';

const defaultRouteOrder = ['/workbench', '/org', '/users', '/objects', '/products', '/admin/permissions'];
const resolveHomePath = (menus: string[]) => defaultRouteOrder.find(route => menus.includes(route) || (route === '/admin/permissions' && menus.includes('/admin'))) || '/objects';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const setMenus = useAuthStore(s => s.setMenus);
  const setObjectTypes = useAuthStore(s => s.setObjectTypes);

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.login(values);
      setAuth(res.data.token, res.data.userId, res.data.role);
      const me: any = await userApi.me();
      const menus = me.data?.menus || [];
      const objectTypes = me.data?.objectTypes || [];
      setMenus(menus);
      setObjectTypes(objectTypes);
      nav(resolveHomePath(menus));
    } catch {
      message.error('登录失败，请检查手机号/邮箱或密码');
    }
    setLoading(false);
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.register(values);
      setAuth(res.data.token, res.data.userId, res.data.role);
      const me: any = await userApi.me();
      const menus = me.data?.menus || [];
      const objectTypes = me.data?.objectTypes || [];
      setMenus(menus);
      setObjectTypes(objectTypes);
      message.success('注册成功');
      nav(resolveHomePath(menus));
    } catch { message.error('注册失败'); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 420 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>东华微办公</h2>
        <Tabs centered items={[
          { key: 'login', label: '登录', children: (
            <Form onFinish={onLogin} layout="vertical">
              <Form.Item name="email" label="手机号/邮箱" rules={[{ required: true }]}><Input placeholder="请输入手机号或邮箱" /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password placeholder="请输入密码" /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
            </Form>
          )},
          { key: 'register', label: '注册', children: (
            <Form onFinish={onRegister} layout="vertical">
              <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
              <Form.Item name="phone" label="手机号"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
            </Form>
          )},
        ]} />
      </Card>
    </div>
  );
}
