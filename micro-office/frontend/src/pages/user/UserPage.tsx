import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd';
import { userApi, orgApi, positionApi } from '../../api';

const roleColorMap: Record<string, string> = { ADMIN: 'red', HR: 'purple', SALES: 'cyan', PURCHASE: 'geekblue', FINANCE: 'gold', BIZ: 'orange', TECH: 'lime', WAREHOUSE: 'volcano', IT: 'magenta', PRODUCTION: 'green', STAFF: 'default' };

export default function UserPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [filterOrg, setFilterOrg] = useState<number>();
  const [modal, setModal] = useState(false);
  const [pwdModal, setPwdModal] = useState<{ open: boolean; userId: number | null; name: string }>({ open: false, userId: null, name: '' });
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const loadUsers = async () => { const r: any = await userApi.list(filterOrg); setUsers(r.data || []); };
  const loadOrgs = async () => { const r: any = await orgApi.list(); setOrgs(r.data || []); };
  const loadPositions = async () => { const r: any = await positionApi.list(); setPositions(r.data || []); };
  const loadRoles = async () => { const r: any = await userApi.lookups(); setRoles(r.data?.roles || []); };

  useEffect(() => { loadOrgs(); loadPositions(); loadRoles(); }, []);
  useEffect(() => { loadUsers(); }, [filterOrg]);

  const save = async (values: any) => {
    if (edit) { await userApi.update(edit.id, values); } else { await userApi.create(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); loadUsers();
  };

  const changePwd = async (values: any) => {
    if (!pwdModal.userId) return;
    await userApi.update(pwdModal.userId, { password: values.password });
    message.success('密码修改成功'); setPwdModal({ open: false, userId: null, name: '' }); pwdForm.resetFields();
  };

  const orgName = (id: number | null) => orgs.find(o => o.id === id)?.name || '-';
  const posName = (id: number | null) => positions.find(p => p.id === id)?.name || '-';

  const openEdit = (r: any) => {
    setEdit(r);
    form.setFieldsValue({ ...r, extraPositionIds: r.extraPositionIds || [] });
    setModal(true);
  };

  return (
    <Card title="人员管理" extra={
      <Space>
        <Select allowClear placeholder="按组织筛选" style={{ width: 160 }}
          options={orgs.map(o => ({ value: o.id, label: o.name }))}
          onChange={v => setFilterOrg(v)} />
        <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增人员</Button>
      </Space>
    }>
      <Table dataSource={users} rowKey="id" columns={[
        { title: 'ID', dataIndex: 'id', width: 50 },
        { title: '姓名', dataIndex: 'name', width: 80 },
        { title: '邮箱', dataIndex: 'email', width: 180 },
        { title: '手机', dataIndex: 'phone', width: 120 },
        { title: '角色', dataIndex: 'role', width: 90, render: (v: string) => <Tag color={roleColorMap[v] || 'default'}>{roles.find(r => r.code === v)?.name || v}</Tag> },
        { title: '所属组织', dataIndex: 'orgId', width: 100, render: (v: number) => v ? <Tag color="blue">{orgName(v)}</Tag> : '-' },
        { title: '主岗位', dataIndex: 'primaryPositionId', width: 100, render: (v: number) => v ? <Tag color="green">{posName(v)}</Tag> : '-' },
        { title: '辅助岗位', dataIndex: 'extraPositionIds', render: (ids: number[]) =>
          ids?.length ? ids.map(id => <Tag key={id} color="orange">{posName(id)}</Tag>) : '-'
        },
        { title: '操作', width: 200, render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
            <Button size="small" onClick={() => { setPwdModal({ open: true, userId: r.id, name: r.name }); pwdForm.resetFields(); }}>改密码</Button>
            <Popconfirm title="确认删除？" onConfirm={async () => { await userApi.delete(r.id); message.success('已删除'); loadUsers(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑人员' : '新增人员'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={520}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          {!edit && <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>}
          {!edit && <Form.Item name="password" label="密码" extra="不填默认123456"><Input.Password /></Form.Item>}
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder="不选则根据岗位自动推导" options={roles.map((r: any) => ({ value: r.code, label: r.name }))} />
          </Form.Item>
          <Form.Item name="orgId" label="所属组织">
            <Select allowClear placeholder="选择组织" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="primaryPositionId" label="主岗位">
            <Select allowClear placeholder="选择岗位" options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="extraPositionIds" label="辅助岗位（可多选）">
            <Select mode="multiple" allowClear placeholder="选择辅助岗位"
              options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="hiredAt" label="入职日期"><Input placeholder="2026-01-01" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`修改密码 - ${pwdModal.name}`} open={pwdModal.open}
        onCancel={() => setPwdModal({ open: false, userId: null, name: '' })} onOk={() => pwdForm.submit()}>
        <Form form={pwdForm} onFinish={changePwd} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirm" label="确认密码" dependencies={['password']}
            rules={[{ required: true }, ({ getFieldValue }) => ({
              validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject('两次密码不一致'); }
            })]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
