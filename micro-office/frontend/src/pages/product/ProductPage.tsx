import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { productApi } from '../../api';

export default function ProductPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState<any>({});
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const load = async (extra?: any) => {
    const params = { current, size, ...filters, ...extra };
    const r: any = await productApi.list(params);
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    if (extra?.current) setCurrent(extra.current);
    if (extra?.size) setSize(extra.size);
  };

  useEffect(() => { load(); }, [current, size]);

  const onSearch = async () => {
    const values = searchForm.getFieldsValue();
    setFilters(values);
    const r: any = await productApi.list({ current: 1, size, ...values });
    setCurrent(1);
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
  };

  const save = async (values: any) => {
    if (edit) { await productApi.update(edit.id, values); } else { await productApi.create(values); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEdit(null); load();
  };

  return (
    <Card
      title="产品与服务"
      extra={<Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button>}
    >
      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="categoryCode" label="物料类别"><Input placeholder="请输入物料类别" allowClear /></Form.Item>
        <Form.Item name="code" label="物料号"><Input placeholder="请输入物料号" allowClear /></Form.Item>
        <Form.Item name="name" label="物料名称"><Input placeholder="请输入物料名称" allowClear /></Form.Item>
        <Form.Item>
          <Button type="primary" onClick={onSearch}>搜索</Button>
        </Form.Item>
      </Form>

      <Table
        dataSource={data}
        rowKey="id"
        pagination={{
          current,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => {
            setCurrent(page);
            setSize(pageSize);
          },
        }}
        columns={[
          { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
          { title: '物料号', dataIndex: 'code', width: 180 },
          { title: '物料名称', dataIndex: 'name', width: 180 },
          { title: '规格尺寸', dataIndex: 'spec', width: 220 },
          { title: '物料类别', dataIndex: 'categoryCode', width: 120 },
          { title: '一级类别名称', dataIndex: 'categoryLevel1', width: 180 },
          { title: '二级类别名称', dataIndex: 'categoryLevel2', width: 220 },
          { title: '三级类别名称', dataIndex: 'categoryLevel3', width: 220 },
          { title: '操作', width: 140, fixed: 'right', render: (_: any, r: any) => (
            <Space>
              <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={async () => { await productApi.delete(r.id); message.success('已删除'); load(); }}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          )},
        ]}
        scroll={{ x: 1600 }}
      />

      <Modal title={edit ? '编辑产品' : '新增产品'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="code" label="物料号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="物料名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="spec" label="规格尺寸"><Input /></Form.Item>
          <Form.Item name="categoryCode" label="物料类别"><Input /></Form.Item>
          <Form.Item name="categoryLevel1" label="一级类别名称"><Input /></Form.Item>
          <Form.Item name="categoryLevel2" label="二级类别名称"><Input /></Form.Item>
          <Form.Item name="categoryLevel3" label="三级类别名称"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
