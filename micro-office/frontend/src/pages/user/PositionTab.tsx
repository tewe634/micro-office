import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { positionApi } from '../../api';

export default function PositionTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async (c = current, s = size) => {
    const r: any = await positionApi.list({ current: c, size: s });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(c);
    setSize(s);
  };

  useEffect(() => { load(1, 20); }, []);

  const save = async (values: any) => {
    if (edit) await positionApi.update(edit.id, values);
    else await positionApi.create(values);
    message.success('保存成功');
    setModal(false);
    setEdit(null);
    form.resetFields();
    load(1, size);
  };

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增岗位</Button>
      </div>

      <Table
        dataSource={data}
        rowKey="id"
        pagination={{
          current,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => load(page, pageSize),
        }}
        scroll={{ y: 'calc(100vh - 64px - 48px - 24px - 24px - 24px - 56px - 16px - 56px)' }}
        columns={[
          { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
          { title: '岗位名称', dataIndex: 'name' },
          { title: '编码', dataIndex: 'code', width: 220 },
          { title: '操作', width: 140, render: (_: any, r: any) => (
            <Space>
              <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={async () => { await positionApi.delete(r.id); message.success('已删除'); load(1, size); }}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          )},
        ]}
      />

      <Modal title={edit ? '编辑岗位' : '新增岗位'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
