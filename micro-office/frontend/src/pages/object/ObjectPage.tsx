import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm } from 'antd';
import { objectApi } from '../../api';
import { useAuthStore } from '../../store/auth';

const allTypeOptions = [
  { value: 'CUSTOMER', label: '客户' },
  { value: 'SUPPLIER', label: '供应商' },
  { value: 'CARRIER', label: '承运商' },
  { value: 'BANK', label: '银行' },
  { value: 'THIRD_PARTY_PAY', label: '第三方支付' },
  { value: 'OTHER', label: '其他' },
];

// 角色可见的对象类型
const roleTypeMap: Record<string, string[] | null> = {
  SALES: ['CUSTOMER'],
  PURCHASE: ['SUPPLIER'],
  FINANCE: ['BANK'],
  ADMIN: null, // null = 全部
};

export default function ObjectPage() {
  const role = useAuthStore(s => s.role);
  const allowedTypes = roleTypeMap[role || ''] ?? null;
  const typeOptions = allowedTypes ? allTypeOptions.filter(o => allowedTypes.includes(o.value)) : allTypeOptions;

  const [data, setData] = useState<any[]>([]);
  const defaultType = typeOptions.length === 1 ? typeOptions[0].value : undefined;
  const [filterType, setFilterType] = useState<string | undefined>(defaultType);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    const r: any = await objectApi.list(filterType);
    let list = r.data || [];
    // 前端也过滤一下，防止后端没过滤
    if (allowedTypes) list = list.filter((o: any) => allowedTypes.includes(o.type));
    setData(list);
  };
  useEffect(() => { load(); }, [filterType]);

  const save = async (values: any) => {
    if (edit) { await objectApi.update(edit.id, values); } else { await objectApi.create(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); load();
  };

  return (
    <Card title="外部对象管理" extra={
      <Space>
        {typeOptions.length > 1 && (
          <Select allowClear placeholder="按类型筛选" options={typeOptions} style={{ width: 150 }} onChange={v => setFilterType(v)} />
        )}
        <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); if (defaultType) form.setFieldsValue({ type: defaultType }); setModal(true); }}>新增</Button>
      </Space>
    }>
      <Table dataSource={data} rowKey="id" columns={[
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '类型', dataIndex: 'type', render: (v: string) => allTypeOptions.find(o => o.value === v)?.label },
        { title: '名称', dataIndex: 'name' },
        { title: '联系人', dataIndex: 'contact' },
        { title: '电话', dataIndex: 'phone' },
        { title: '操作', render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
            <Popconfirm title="确认删除？" onConfirm={async () => { await objectApi.delete(r.id); message.success('已删除'); load(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑对象' : '新增对象'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions} disabled={typeOptions.length === 1} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
