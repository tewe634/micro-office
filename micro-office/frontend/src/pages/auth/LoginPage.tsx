import { useState } from 'react';
import { Form, Input, Button, Card, message, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authApi, userApi } from '../../api';
import { applyApiFormErrors, getApiErrorMessage } from '../../api/error';
import { useAuthStore } from '../../store/auth';
import { resolveHomePath } from '../../constants/routes';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const nav = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const setProfile = useAuthStore(s => s.setProfile);
  const markAuthReady = useAuthStore(s => s.markAuthReady);
  const logout = useAuthStore(s => s.logout);

  const completeLogin = async (authData: { token: string; userId: string; role: string }) => {
    setAuth(authData.token, authData.userId, authData.role);
    try {
      const me: any = await userApi.me();
      const menus = me.data?.menus || [];
      setProfile({
        userId: me.data?.id ?? authData.userId,
        name: me.data?.name ?? null,
        role: me.data?.role ?? authData.role,
        menus,
        objectTypes: me.data?.objectTypes || [],
      });
      return resolveHomePath(menus);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        logout();
        throw error;
      }
      setProfile({
        userId: authData.userId,
        role: authData.role,
        menus: [],
        objectTypes: [],
      });
      markAuthReady();
      return resolveHomePath([]);
    }
  };

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.login(values);
      const homePath = await completeLogin(res.data);
      nav(homePath, { replace: true });
    } catch (error: any) {
      if (!applyApiFormErrors(loginForm, error)) {
        message.error(getApiErrorMessage(error, '登录失败，请检查手机号/邮箱或密码'));
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      const res: any = await authApi.register(values);
      const homePath = await completeLogin(res.data);
      message.success('注册成功');
      nav(homePath, { replace: true });
    } catch (error: any) {
      if (!applyApiFormErrors(registerForm, error)) {
        message.error(getApiErrorMessage(error, '注册失败'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-shell--with-footer">
      <Card className="auth-card">
        <h2 className="auth-title">东华办公自动化系统</h2>
        <Tabs centered items={[
          { key: 'login', label: '登录', children: (
            <Form form={loginForm} onFinish={onLogin} layout="vertical">
              <Form.Item name="email" label="手机号/邮箱" rules={[{ required: true }]}><Input placeholder="请输入手机号或邮箱" /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password placeholder="请输入密码" /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
            </Form>
          )},
          { key: 'register', label: '注册', children: (
            <Form form={registerForm} onFinish={onRegister} layout="vertical">
              <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
              <Form.Item name="phone" label="手机号"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
            </Form>
          )},
        ]} />
      </Card>
      <div className="auth-footer-record">备案号：浙ICP备17052976号</div>
    </div>
  );
}
