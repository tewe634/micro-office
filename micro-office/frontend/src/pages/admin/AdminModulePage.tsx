import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { adminApi } from '../../api';

export default function AdminModulePage() {
  const [data, setData] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { const r: any = await adminApi.listModules(); setData(r.data || []); };
  useEffect(() => { load(); }, []);

  const save = async (values: any) => {
    if (edit) { await adminApi.updateModule(edit.id, values); } else { await adminApi.createModule(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); load();
  };

  return (
    <Card title="模块配置管理" extra={<Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增模块</Button>}>
      <Table dataSource={data} rowKey="id" columns={[
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '关键词', dataIndex: 'keyword' },
        { title: '模块名称', dataIndex: 'moduleName' },
        { title: '模块URL', dataIndex: 'moduleUrl', ellipsis: true },
        { title: '操作', render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
            <Popconfirm title="确认删除？" onConfirm={async () => { await adminApi.deleteModule(r.id); message.success('已删除'); load(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title={edit ? '编辑模块' : '新增模块'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="keyword" label="触发关键词" rules={[{ required: true }]}><Input placeholder="如：出差、合同、报销" /></Form.Item>
          <Form.Item name="moduleName" label="模块名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="moduleUrl" label="模块URL" rules={[{ required: true }]}><Input placeholder="https://..." /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
