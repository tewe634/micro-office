import { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/auth';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.login(values);
      setAuth(res.data.token, res.data.userId, res.data.role);
      nav('/workbench');
    } catch { message.error('登录失败'); }
    setLoading(false);
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.register(values);
      setAuth(res.data.token, res.data.userId, res.data.role);
      message.success('注册成功');
      nav('/workbench');
    } catch { message.error('注册失败'); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 420 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>微办公论坛</h2>
        <Tabs centered items={[
          { key: 'login', label: '登录', children: (
            <Form onFinish={onLogin} layout="vertical">
              <Form.Item name="email" label="邮箱" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
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
