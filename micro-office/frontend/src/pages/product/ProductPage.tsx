import { useEffect, useState } from 'react';
import { Button, Card, Divider, Form, Input, Modal, Pagination, Popconfirm, Space, Table, Tabs, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../../api';
import { formatPaginationTotal, paginationLocale, uiText } from '../../constants/ui';

const productLineOptions = [
  { key: 'ABB', label: 'ABB' },
  { key: 'INVEX', label: 'INVEX' },
];

export default function ProductPage() {
  const nav = useNavigate();
  const [activeLine, setActiveLine] = useState('ABB');
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState<any>({});
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const load = async (options?: {
    current?: number;
    size?: number;
    filters?: any;
    productLine?: string;
  }) => {
    const nextCurrent = options?.current ?? current;
    const nextSize = options?.size ?? size;
    const nextFilters = options?.filters ?? filters;
    const nextLine = options?.productLine ?? activeLine;
    const r: any = await productApi.list({ current: nextCurrent, size: nextSize, productLine: nextLine, ...nextFilters });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(nextCurrent);
    setSize(nextSize);
    if (options?.filters !== undefined) setFilters(nextFilters);
  };

  useEffect(() => {
    load({ current: 1, size, filters: {}, productLine: activeLine });
  }, [activeLine]);

  const onSearch = async () => {
    const nextFilters = searchForm.getFieldsValue();
    await load({ current: 1, size, filters: nextFilters, productLine: activeLine });
  };

  const onTabChange = (key: string) => {
    setActiveLine(key);
    setFilters({});
    searchForm.resetFields();
  };

  const save = async (values: any) => {
    const payload = {
      ...values,
      productLine: edit?.productLine || activeLine,
    };

    if (edit) {
      await productApi.update(edit.id, payload);
    } else {
      await productApi.create(payload);
    }
    message.success('保存成功');
    setModal(false);
    form.resetFields();
    setEdit(null);
    load({ current, size, filters, productLine: activeLine });
  };

  const openCreate = () => {
    setEdit(null);
    form.resetFields();
    form.setFieldsValue({ productLine: activeLine });
    setModal(true);
  };

  const openEdit = (record: any) => {
    setEdit(record);
    form.setFieldsValue(record);
    setModal(true);
  };

  return (
    <Card
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body">
        <Tabs
          className="page-tabs"
          activeKey={activeLine}
          onChange={onTabChange}
          items={productLineOptions.map(option => ({
            key: option.key,
            label: option.label,
            children: (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
                  <Form
                    form={searchForm}
                    layout="inline"
                    style={{ display: 'flex', flex: '1 1 0', minWidth: 0, flexWrap: 'wrap', rowGap: 12, columnGap: 8 }}
                  >
                    <Form.Item name="categoryCode" label="物料类别"><Input placeholder="请输入物料类别" allowClear /></Form.Item>
                    <Form.Item name="code" label="物料号"><Input placeholder="请输入物料号" allowClear /></Form.Item>
                    <Form.Item name="name" label="物料名称"><Input placeholder="请输入物料名称" allowClear /></Form.Item>
                    <Form.Item name="seriesDisplayName" label="系列展示口径"><Input placeholder="请输入系列展示口径" allowClear /></Form.Item>
                    <Form.Item>
                      <Button type="primary" onClick={onSearch}>搜索</Button>
                    </Form.Item>
                  </Form>

                  <Button type="primary" onClick={openCreate} style={{ marginLeft: 'auto', flex: '0 0 auto', position: 'relative', right: '40px' }}>新增</Button>
                </div>

                <div
                  className="product-page__table-frame"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div className="product-page__table-inner" style={{ flex: 1, minHeight: 0, padding: '12px 12px 12px 12px', overflow: 'hidden' }}>
                    <Table
                      dataSource={data}
                      rowKey="id"
                      pagination={false}
                      tableLayout="fixed"
                      scroll={{ x: 1700, y: 'calc(100dvh - 560px)' }}
                      columns={[
                        { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                        { title: '物料号', dataIndex: 'code', width: 180, ellipsis: true },
                        { title: '物料名称', dataIndex: 'name', width: 180, ellipsis: true },
                        { title: '规格尺寸', dataIndex: 'spec', width: 220, ellipsis: true },
                        { title: '物料类别', dataIndex: 'categoryCode', width: 120, ellipsis: true },
                        { title: '原一级类别', dataIndex: 'categoryLevel1', width: 180, ellipsis: true },
                        { title: '原二级类别', dataIndex: 'categoryLevel2', width: 220, ellipsis: true },
                        { title: '原三级类别', dataIndex: 'categoryLevel3', width: 220, ellipsis: true },
                        { title: '一级分类', dataIndex: 'structureLevel1', width: 160, ellipsis: true },
                        { title: '二级分类', dataIndex: 'structureLevel2', width: 180, ellipsis: true },
                        { title: '系列展示口径', dataIndex: 'seriesDisplayName', width: 220, ellipsis: true },
                        {
                          title: '操作',
                          width: 200,
                          fixed: 'right',
                          render: (_: any, r: any) => (
                            <Space size={6} wrap>
                              <Button size="small" onClick={() => nav(`/products/${r.id}/portal`)}>门户</Button>
                              <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
                              <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await productApi.delete(r.id); message.success('已删除'); load({ current, size, filters, productLine: activeLine }); }}>
                                <Button size="small" danger>删除</Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </div>

                  <div
                    className="product-page__pagination-wrap"
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      padding: '8px 16px 12px',
                      borderTop: '1px solid #f0f0f0',
                      background: '#fff',
                    }}
                  >
                    <Pagination
                      locale={paginationLocale}
                      current={current}
                      pageSize={size}
                      total={total}
                      showSizeChanger
                      showTotal={(t) => formatPaginationTotal(t)}
                      onChange={(page, pageSize) => load({ current: page, size: pageSize, filters, productLine: activeLine })}
                    />
                  </div>
                </div>
              </div>
            ),
          }))}
        />
      </div>

      <Modal
        okText="确定"
        cancelText="取消"
        width={720}
        title={edit ? '编辑产品' : '新增产品'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={save}
          layout="vertical"
        >
          <Form.Item name="productLine" hidden><Input /></Form.Item>
          <Form.Item name="code" label="物料号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="物料名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="spec" label="规格尺寸"><Input /></Form.Item>
          <Form.Item name="categoryCode" label="物料类别"><Input /></Form.Item>

          <Divider>原始导入分类</Divider>
          <Form.Item name="categoryLevel1" label="原一级类别名称"><Input /></Form.Item>
          <Form.Item name="categoryLevel2" label="原二级类别名称"><Input /></Form.Item>
          <Form.Item name="categoryLevel3" label="原三级类别名称"><Input /></Form.Item>

          <Divider>产品分类</Divider>
          <Form.Item name="structureLevel1" label="一级分类"><Input /></Form.Item>
          <Form.Item name="structureLevel2" label="二级分类"><Input /></Form.Item>
          <Form.Item name="seriesDisplayName" label="系列展示口径"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
