import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Space, message, Popconfirm, Pagination } from 'antd';
import { productApi } from '../../api';
import FixedTablePage from '../../components/FixedTablePage';

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

  const load = async (options?: { current?: number; size?: number; filters?: any }) => {
    const nextCurrent = options?.current ?? current;
    const nextSize = options?.size ?? size;
    const nextFilters = options?.filters ?? filters;
    const r: any = await productApi.list({ current: nextCurrent, size: nextSize, ...nextFilters });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(nextCurrent);
    setSize(nextSize);
    if (options?.filters !== undefined) setFilters(nextFilters);
  };

  useEffect(() => {
    load();
  }, []);

  const onSearch = async () => {
    const nextFilters = searchForm.getFieldsValue();
    await load({ current: 1, size, filters: nextFilters });
  };

  const save = async (values: any) => {
    if (edit) {
      await productApi.update(edit.id, values);
    } else {
      await productApi.create(values);
    }
    message.success('保存成功');
    setModal(false);
    form.resetFields();
    setEdit(null);
    load({ current, size, filters });
  };

  return (
    <Card
      title="产品与服务"
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body">
        <FixedTablePage
          top={
            <div className="page-toolbar">
              <Form form={searchForm} layout="inline" style={{ flex: 1, rowGap: 12 }}>
                <Form.Item name="categoryCode" label="物料类别"><Input placeholder="请输入物料类别" allowClear /></Form.Item>
                <Form.Item name="code" label="物料号"><Input placeholder="请输入物料号" allowClear /></Form.Item>
                <Form.Item name="name" label="物料名称"><Input placeholder="请输入物料名称" allowClear /></Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={onSearch}>搜索</Button>
                </Form.Item>
              </Form>
              <div className="page-toolbar-right">
                <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button>
              </div>
            </div>
          }
          table={
            <Table
              dataSource={data}
              rowKey="id"
              pagination={false}
              sticky
              scroll={{ x: 1600, y: '100%' }}
              style={{ height: '100%' }}
              columns={[
                { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                { title: '物料号', dataIndex: 'code', width: 180 },
                { title: '物料名称', dataIndex: 'name', width: 180 },
                { title: '规格尺寸', dataIndex: 'spec', width: 220 },
                { title: '物料类别', dataIndex: 'categoryCode', width: 120 },
                { title: '一级类别名称', dataIndex: 'categoryLevel1', width: 180 },
                { title: '二级类别名称', dataIndex: 'categoryLevel2', width: 220 },
                { title: '三级类别名称', dataIndex: 'categoryLevel3', width: 220 },
                {
                  title: '操作',
                  width: 140,
                  fixed: 'right',
                  render: (_: any, r: any) => (
                    <Space>
                      <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
                      <Popconfirm title="确认删除？" onConfirm={async () => { await productApi.delete(r.id); message.success('已删除'); load({ current, size, filters }); }}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          }
          pagination={
            <Pagination
              current={current}
              pageSize={size}
              total={total}
              showSizeChanger
              showTotal={(t) => `共 ${t} 条`}
              onChange={(page, pageSize) => load({ current: page, size: pageSize, filters })}
            />
          }
        />
      </div>

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
