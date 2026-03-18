import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tabs, Tag } from 'antd';
import { objectApi, userApi } from '../../api';

const allTypeOptions = [
  { value: 'CUSTOMER', label: '客户' },
  { value: 'SUPPLIER', label: '供应商' },
  { value: 'CARRIER', label: '承运商' },
  { value: 'BANK', label: '银行' },
  { value: 'THIRD_PARTY_PAY', label: '第三方支付' },
  { value: 'OTHER', label: '其他' },
];

function ObjectTable({ type, orgs, users }: { type: string; orgs: any[]; users: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [filterOrg, setFilterOrg] = useState<string | undefined>();
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [form] = Form.useForm();

  const load = async () => {
    const r: any = await objectApi.list(type, filterOrg, filterDept);
    setData((r.data || []).filter((o: any) => o.type === type));
  };
  useEffect(() => { load(); }, [type, filterOrg, filterDept]);

  const save = async (values: any) => {
    const payload = { ...values, type };
    if (edit) { await objectApi.update(edit.id, payload); } else { await objectApi.create(payload); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); load();
  };

  const orgName = (id: string) => orgs.find(o => o.id === id)?.name || '-';
  const userName = (id: string) => users.find(u => u.id === id)?.name || '-';

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="筛选所属组织" style={{ width: 160 }} onChange={setFilterOrg}
          options={orgs.map(o => ({ value: o.id, label: o.name }))} />
        <Select allowClear placeholder="筛选所属部门" style={{ width: 160 }} onChange={setFilterDept}
          options={orgs.map(o => ({ value: o.id, label: o.name }))} />
        <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>
          新增{allTypeOptions.find(o => o.value === type)?.label}
        </Button>
      </Space>
      <Table dataSource={data} rowKey="id" showSorterTooltip={false} columns={[
        { title: '序号', key: 'index', width: 60, render: (_: any, __: any, index: number) => index + 1 },
        { title: '名称', dataIndex: 'name' },
        { title: '联系人', dataIndex: 'contact' },
        { title: '电话', dataIndex: 'phone' },
        { title: '行业', dataIndex: 'industry' },
        { title: '所属组织', dataIndex: 'orgId', width: 100, render: (v: string) => v ? <Tag color="blue">{orgName(v)}</Tag> : '-' },
        { title: '所属部门', dataIndex: 'deptId', width: 120, render: (v: string) => v ? <Tag color="purple">{orgName(v)}</Tag> : '-' },
        { title: '负责人', dataIndex: 'ownerId', width: 90, render: (v: string) => v ? <Tag color="green">{userName(v)}</Tag> : '-' },
        { title: '操作', width: 140, render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
            <Popconfirm title="确认删除？" onConfirm={async () => { await objectApi.delete(r.id); message.success('已删除'); load(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑' : '新增'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="industry" label="行业"><Input /></Form.Item>
          <Form.Item name="orgId" label="所属组织">
            <Select allowClear placeholder="选择组织" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="deptId" label="所属部门">
            <Select allowClear placeholder="选择部门" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="ownerId" label="负责人">
            <Select allowClear showSearch placeholder="选择负责人" optionFilterProp="label"
              options={users.map(u => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function ObjectPage() {
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    userApi.me().then((r: any) => {
      const types = r.data?.objectTypes || [];
      if (types.length === 0 && r.data?.role === 'ADMIN') {
        setObjectTypes(allTypeOptions.map(o => o.value));
      } else {
        setObjectTypes(types);
      }
    });
    userApi.lookups().then((r: any) => {
      setOrgs(r.data?.orgs || []);
      setUsers(r.data?.users || []);
    }).catch(() => {});
  }, []);

  const visibleTypes = allTypeOptions.filter(o => objectTypes.includes(o.value));

  if (visibleTypes.length === 0) {
    return <Card title="外部对象管理"><p style={{ color: '#888' }}>您当前岗位没有可查看的外部对象类型，请联系管理员配置。</p></Card>;
  }

  return (
    <Card title="外部对象管理">
      <Tabs items={visibleTypes.map(t => ({
        key: t.value,
        label: t.label,
        children: <ObjectTable type={t.value} orgs={orgs} users={users} />,
      }))} />
    </Card>
  );
}
