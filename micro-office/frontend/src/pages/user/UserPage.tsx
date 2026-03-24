import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd';
import { userApi, orgApi, positionApi } from '../../api';
import { formatRoleLabel, uiText } from '../../constants/ui';

const roleColorMap: Record<string, string> = { ADMIN: 'red', HR: 'purple', SALES: 'cyan', PURCHASE: 'geekblue', FINANCE: 'gold', BIZ: 'orange', TECH: 'lime', WAREHOUSE: 'volcano', IT: 'magenta', PRODUCTION: 'green', STAFF: 'default' };

export default function UserPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [filterOrg, setFilterOrg] = useState<number>();
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const loadUsers = async () => { const r: any = await userApi.list(filterOrg); setUsers(r.data || []); };
  const loadOrgs = async () => { const r: any = await orgApi.list(); setOrgs(r.data || []); };
  const loadPositions = async () => {
    const r: any = await positionApi.list();
    setPositions(r.data || []);
  };
  const loadRoles = async () => { const r: any = await userApi.lookups(); setRoles(r.data?.roles || []); };

  useEffect(() => { loadOrgs(); loadPositions(); loadRoles(); }, []);
  useEffect(() => { loadUsers(); }, [filterOrg]);

  const save = async (values: any) => {
    if (edit) { await userApi.update(edit.id, values); } else { await userApi.create(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); loadUsers();
  };

  const orgName = (id: number | null) => orgs.find(o => o.id === id)?.name || '-';
  const posName = (id: number | null) => positions.find(p => p.id === id)?.name || '-';

  const openEdit = (r: any) => {
    setEdit(r);
    form.setFieldsValue({ ...r, extraPositionIds: r.extraPositionIds || [] });
    setModal(true);
  };

  return (
    <Card title="人员管理" styles={{ body: { padding: 0 } }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }} extra={
      <Space>
        <Select allowClear placeholder="按组织筛选" style={{ width: 160 }}
          options={orgs.map(o => ({ value: o.id, label: o.name }))}
          onChange={v => setFilterOrg(v)} />
        <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增人员</Button>
      </Space>
    }>
      <div style={{ padding: 24, paddingBottom: 0 }} />
      <div style={{ flex: 1, minHeight: 0, padding: 24, paddingTop: 0 }}>
      <Table dataSource={users} rowKey="id" showSorterTooltip={false}
        scroll={{ y: 'calc(100vh - 64px - 48px - 24px - 24px - 24px - 56px - 16px - 56px)' }}
        columns={[
        { title: '序号', key: 'index', width: 60, sorter: (_a: any, _b: any) => 0, render: (_: any, __: any, index: number) => index + 1 },
        { title: '工号', dataIndex: 'empNo', width: 110, sorter: (a: any, b: any) => parseInt((a.empNo||'').replace(/\D/g,''))||0 - (parseInt((b.empNo||'').replace(/\D/g,''))||0) },
        { title: '姓名', dataIndex: 'name', width: 80 },
        { title: '邮箱', dataIndex: 'email', width: 180 },
        { title: '手机', dataIndex: 'phone', width: 120 },
        { title: '角色', dataIndex: 'role', width: 90, render: (v: string) => <Tag color={roleColorMap[v] || 'default'}>{formatRoleLabel(v, roles.find(r => r.code === v)?.name)}</Tag> },
        { title: '所属组织', dataIndex: 'orgId', width: 100, render: (v: number) => v ? <Tag color="blue">{orgName(v)}</Tag> : '-' },
        { title: '主岗位', dataIndex: 'primaryPositionId', width: 100, render: (v: number) => v ? <Tag color="green">{posName(v)}</Tag> : '-' },
        { title: '辅助岗位', dataIndex: 'extraPositionIds', render: (ids: number[]) =>
          ids?.length ? ids.map(id => <Tag key={id} color="orange">{posName(id)}</Tag>) : '-'
        },
        { title: '操作', width: 140, render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
            <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await userApi.delete(r.id); message.success('已删除'); loadUsers(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />
      </div>

      <Modal okText="确定" cancelText="取消" title={edit ? '编辑人员' : '新增人员'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={520}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          {!edit && <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>}
          {!edit && <Form.Item name="password" label="密码" extra="不填默认123456"><Input.Password /></Form.Item>}
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder="不选则根据岗位自动推导" options={roles.map((r: any) => ({ value: r.code, label: formatRoleLabel(r.code, r.name) }))} />
          </Form.Item>
          <Form.Item name="orgId" label="所属组织">
            <Select allowClear placeholder="选择组织" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="primaryPositionId" label="主岗位">
            <Select allowClear placeholder="选择岗位" options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item
            name="extraPositionIds"
            label="辅助岗位（可多选）"
            extra="辅助岗位会出现在人员门户的岗位切换中，可用于多岗位门户测试。"
          >
            <Select mode="multiple" allowClear placeholder="选择辅助岗位"
              options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="hiredAt" label="入职日期"><Input placeholder="2026-01-01" /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
