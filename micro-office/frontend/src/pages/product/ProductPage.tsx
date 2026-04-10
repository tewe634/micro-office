import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tabs, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../../api';
import { formatPaginationTotal, paginationLocale, uiText } from '../../constants/ui';

const productLineOptions = [
  { key: 'ABB', label: 'ABB' },
  { key: 'INVEX', label: 'INVEX' },
];

const abbStructureLevel1Options = [
  { value: 'DP', label: 'DP' },
  { value: 'HP', label: 'HP' },
  { value: 'SE', label: 'SE' },
  { value: '电机', label: '电机' },
  { value: '低压', label: '低压' },
  { value: '成套', label: '成套' },
];

const abbStructureLevel2Map: Record<string, { value: string; label: string }[]> = {
  SE: [
    { value: '服务产品', label: '服务产品' },
    { value: '服务业务', label: '服务业务' },
    { value: '电机服务', label: '电机服务' },
    { value: '保内服务', label: '保内服务' },
  ],
  电机: [
    { value: '高压电机', label: '高压电机' },
    { value: '低压电机', label: '低压电机' },
  ],
};

const noSecondLevelStructure = new Set(['低压', '成套']);

function getStructureLevel2Options(level1?: string) {
  if (!level1) return [];
  return abbStructureLevel2Map[level1] || [];
}

function getStructureLevel2Placeholder(level1?: string) {
  if (!level1) return '请先选择设计一级分类';
  if (noSecondLevelStructure.has(level1)) return '低压 / 成套不再继续拆分二级分类';
  if (level1 === 'DP' || level1 === 'HP') return '按已确认的图片口径填写 DP / HP 二级分类';
  return '请输入设计二级分类';
}

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
  const structureLevel1 = Form.useWatch('structureLevel1', form);

  const structureLevel2Options = useMemo(() => getStructureLevel2Options(structureLevel1), [structureLevel1]);
  const structureLevel2UsesSelect = structureLevel2Options.length > 0;
  const structureLevel2Disabled = !structureLevel1 || noSecondLevelStructure.has(structureLevel1);

  const load = async (options?: { current?: number; size?: number; filters?: any; productLine?: string }) => {
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
                {option.key === 'ABB' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="ABB 产品结构已按新口径预留分类字段，原始导入分类保留不动"
                    description={
                      <div style={{ lineHeight: 1.7 }}>
                        <div>一级分类：DP / HP / SE / 电机 / 低压 / 成套</div>
                        <div>SE 二级：服务产品 / 服务业务 / 电机服务 / 保内服务</div>
                        <div>电机二级：高压电机 / 低压电机</div>
                        <div>低压、成套不再继续拆二级；DP、HP 二级先按你确认的图片口径录入。</div>
                        <div>系列展示口径支持“多个产品合并一个系列”或“一个产品单独展示一个系列”。</div>
                      </div>
                    }
                  />
                ) : null}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
                  <Form
                    form={searchForm}
                    layout="inline"
                    style={{ display: 'flex', flex: '1 1 0', minWidth: 0, flexWrap: 'wrap', rowGap: 12, columnGap: 8 }}
                  >
                    <Form.Item name="categoryCode" label="物料类别"><Input placeholder="请输入物料类别" allowClear /></Form.Item>
                    <Form.Item name="code" label="物料号"><Input placeholder="请输入物料号" allowClear /></Form.Item>
                    <Form.Item name="name" label="物料名称"><Input placeholder="请输入物料名称" allowClear /></Form.Item>
                    <Form.Item name="structureLevel1" label="设计一级分类">
                      {option.key === 'ABB' ? (
                        <Select placeholder="请选择" allowClear style={{ width: 180 }} options={abbStructureLevel1Options} />
                      ) : (
                        <Input placeholder="请输入设计一级分类" allowClear />
                      )}
                    </Form.Item>
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
                      scroll={{ x: 2300, y: 'calc(100dvh - 540px)' }}
                      columns={[
                        { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                        { title: '物料号', dataIndex: 'code', width: 180, ellipsis: true },
                        { title: '物料名称', dataIndex: 'name', width: 180, ellipsis: true },
                        { title: '规格尺寸', dataIndex: 'spec', width: 220, ellipsis: true },
                        { title: '物料类别', dataIndex: 'categoryCode', width: 120, ellipsis: true },
                        { title: '原一级类别', dataIndex: 'categoryLevel1', width: 180, ellipsis: true },
                        { title: '原二级类别', dataIndex: 'categoryLevel2', width: 220, ellipsis: true },
                        { title: '原三级类别', dataIndex: 'categoryLevel3', width: 220, ellipsis: true },
                        { title: '设计一级分类', dataIndex: 'structureLevel1', width: 160, ellipsis: true },
                        { title: '设计二级分类', dataIndex: 'structureLevel2', width: 180, ellipsis: true },
                        { title: '系列展示口径', dataIndex: 'seriesDisplayName', width: 240, ellipsis: true },
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
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, 'structureLevel1')) {
              form.setFieldValue('structureLevel2', undefined);
            }
          }}
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

          <Divider>新产品结构</Divider>
          <Form.Item name="structureLevel1" label="设计一级分类">
            {activeLine === 'ABB' ? (
              <Select
                allowClear
                placeholder="请选择 ABB 设计一级分类"
                options={abbStructureLevel1Options}
              />
            ) : (
              <Input placeholder="请输入设计一级分类" />
            )}
          </Form.Item>
          <Form.Item
            name="structureLevel2"
            label="设计二级分类"
            extra={activeLine === 'ABB' && (structureLevel1 === 'DP' || structureLevel1 === 'HP')
              ? 'DP / HP 这里先按你确认的图片口径填写，后续可再收敛成固定选项。'
              : undefined}
          >
            {structureLevel2UsesSelect ? (
              <Select allowClear placeholder="请选择设计二级分类" options={structureLevel2Options} />
            ) : (
              <Input disabled={structureLevel2Disabled} placeholder={getStructureLevel2Placeholder(structureLevel1)} />
            )}
          </Form.Item>
          <Form.Item
            name="seriesDisplayName"
            label="系列展示口径"
            extra={activeLine === 'ABB' ? '支持多个产品并成一个系列，也支持一个产品单独作为一个系列展示。' : undefined}
          >
            <Input placeholder="例如：ACS580-01(R0-R8) / ABB软启动器" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
