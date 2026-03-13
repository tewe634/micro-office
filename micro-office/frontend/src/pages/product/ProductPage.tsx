import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm } from 'antd';
import { productApi } from '../../api';

export default function ProductPage() {
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { const r: any = await productApi.list(); setData(r.data || []); };
  useEffect(() => { load(); }, []);

  const save = async (values: any) => {
    if (edit) { await productApi.update(edit.id, values); } else { await productApi.create(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); load();
  };

  return (
    <Card title="产品与服务" extra={<Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button>}>
      <Table dataSource={data} rowKey="id" columns={[
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '名称', dataIndex: 'name' },
        { title: '编码', dataIndex: 'code' },
        { title: '规格', dataIndex: 'spec' },
        { title: '价格', dataIndex: 'price' },
        { title: '操作', render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
            <Popconfirm title="确认删除？" onConfirm={async () => { await productApi.delete(r.id); message.success('已删除'); load(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑产品' : '新增产品'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="spec" label="规格"><Input /></Form.Item>
          <Form.Item name="price" label="价格"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="parentId" label="上级产品ID"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
