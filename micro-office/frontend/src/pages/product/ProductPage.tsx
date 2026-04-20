import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Divider, Form, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tabs, message } from 'antd';
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
  DP: [
    { value: 'ACS55/150/310/355', label: 'ACS55/150/310/355' },
    { value: 'ACS180', label: 'ACS180' },
    { value: 'ACS280', label: 'ACS280' },
    { value: 'ACS380', label: 'ACS380' },
    { value: 'ACS380E', label: 'ACS380E' },
    { value: 'ACS510', label: 'ACS510' },
    { value: 'ACP510', label: 'ACP510' },
    { value: 'ACM510', label: 'ACM510' },
    { value: 'ACS530', label: 'ACS530' },
    { value: 'ACH531', label: 'ACH531' },
    { value: 'ACQ531', label: 'ACQ531' },
    { value: 'ACS550', label: 'ACS550' },
    { value: 'ACH550/ACH580/ACQ580', label: 'ACH550/ACH580/ACQ580' },
    { value: 'ACS580-01/04 (R0-R11)', label: 'ACS580-01/04 (R0-R11)' },
    { value: 'ACS580-07', label: 'ACS580-07' },
    { value: 'ACS800-11/31', label: 'ACS800-11/31' },
    { value: 'ACS880-01/04(R1-R11)', label: 'ACS880-01/04(R1-R11)' },
    { value: 'ACS880-11/31/14/34', label: 'ACS880-11/31/14/34' },
    { value: 'Servo (Controller+Driver+Motor)', label: 'Servo (Controller+Driver+Motor)' },
    { value: 'AC500/AC500-eco/HMI', label: 'AC500/AC500-eco/HMI' },
    { value: 'External Options/DP Others', label: 'External Options/DP Others' },
  ],
  HP: [
    { value: 'ACS580MV', label: 'ACS580MV' },
    { value: 'ACS800-67', label: 'ACS800-67' },
    { value: 'ACS800-67 LC', label: 'ACS800-67 LC' },
    { value: 'ACS800-77 LC', label: 'ACS800-77 LC' },
    { value: 'ACS800-87 LC', label: 'ACS800-87 LC' },
    { value: 'ACS800/860/880 MD(Module&Cabinet)', label: 'ACS800/860/880 MD(Module&Cabinet)' },
    { value: 'ACS800/880-07/ACS880-07C/ACS880-07XT', label: 'ACS800/880-07/ACS880-07C/ACS880-07XT' },
    { value: 'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES880', label: 'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES880' },
    { value: 'ACS800/ACS880-17/37/SD-LC', label: 'ACS800/ACS880-17/37/SD-LC' },
    { value: 'ACS880-87 LC', label: 'ACS880-87 LC' },
    { value: 'ACS1000/ACS2000/5000A', label: 'ACS1000/ACS2000/5000A' },
    { value: 'ACS1000Ex/ACS2000Ex', label: 'ACS1000Ex/ACS2000Ex' },
    { value: 'ACS5000W/6080/LCI', label: 'ACS5000W/6080/LCI' },
    { value: 'LCI', label: 'LCI' },
    { value: 'DC Drive products', label: 'DC Drive products' },
    { value: 'HPD Others(Options and Packages)', label: 'HPD Others(Options and Packages)' },
    { value: 'Packaging', label: 'Packaging' },
    { value: 'PCS6000 Wind', label: 'PCS6000 Wind' },
    { value: 'Wind Service', label: 'Wind Service' },
    { value: 'Windmill', label: 'Windmill' },
  ],
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

const invexStructureLevel1Options = [
  { value: '自主', label: '自主' },
  { value: '贴牌', label: '贴牌' },
  { value: '服务', label: '服务' },
  { value: '成套', label: '成套' },
  { value: '外购', label: '外购' },
];

const structureLevel1OptionsMap: Record<string, { value: string; label: string }[]> = {
  ABB: abbStructureLevel1Options,
  INVEX: invexStructureLevel1Options,
};

const structureLevel2OptionsMap: Record<string, Record<string, { value: string; label: string }[]>> = {
  ABB: abbStructureLevel2Map,
  INVEX: {},
};

const noSecondLevelStructureByLine: Record<string, Set<string>> = {
  ABB: new Set(['低压', '成套']),
  INVEX: new Set(invexStructureLevel1Options.map(item => item.value)),
};

const ALL_STRUCTURE_TAB_KEY = '__ALL__';

function getStructureLevel1Options(productLine?: string) {
  if (!productLine) return [];
  return structureLevel1OptionsMap[productLine] || [];
}

function usesStructureTabs(productLine?: string) {
  return getStructureLevel1Options(productLine).length > 0;
}

function getStructureLevel2Options(productLine?: string, level1?: string) {
  if (!productLine || !level1) return [];
  return structureLevel2OptionsMap[productLine]?.[level1] || [];
}

function getStructureLevel2Placeholder(productLine?: string, level1?: string) {
  if (!level1) return '请先选择一级分类';
  if (noSecondLevelStructureByLine[productLine || '']?.has(level1)) return '该一级分类暂无二级分类';
  return '请选择或输入二级分类';
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
  const [activeStructureLevel1Tab, setActiveStructureLevel1Tab] = useState(ALL_STRUCTURE_TAB_KEY);
  const [activeStructureLevel2Tab, setActiveStructureLevel2Tab] = useState(ALL_STRUCTURE_TAB_KEY);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const formProductLine = Form.useWatch('productLine', form) || activeLine;
  const structureLevel1 = Form.useWatch('structureLevel1', form);

  const structureLevel1Options = useMemo(() => getStructureLevel1Options(formProductLine), [formProductLine]);
  const structureLevel2Options = useMemo(() => getStructureLevel2Options(formProductLine, structureLevel1), [formProductLine, structureLevel1]);
  const structureLevel2UsesSelect = structureLevel2Options.length > 0;
  const structureLevel2Disabled = !structureLevel1 || Boolean(noSecondLevelStructureByLine[formProductLine]?.has(structureLevel1));
  const activeStructureLevel2Options = useMemo(
    () => getStructureLevel2Options(activeLine, activeStructureLevel1Tab === ALL_STRUCTURE_TAB_KEY ? undefined : activeStructureLevel1Tab),
    [activeLine, activeStructureLevel1Tab],
  );

  const load = async (options?: {
    current?: number;
    size?: number;
    filters?: any;
    productLine?: string;
    structureLevel1Tab?: string;
    structureLevel2Tab?: string;
  }) => {
    const nextCurrent = options?.current ?? current;
    const nextSize = options?.size ?? size;
    const nextFilters = options?.filters ?? filters;
    const nextLine = options?.productLine ?? activeLine;
    const nextStructureLevel1Tab = options?.structureLevel1Tab ?? activeStructureLevel1Tab;
    const nextStructureLevel2Tab = options?.structureLevel2Tab ?? activeStructureLevel2Tab;
    const nextStructureLevel1 = nextStructureLevel1Tab === ALL_STRUCTURE_TAB_KEY ? undefined : nextStructureLevel1Tab;
    const nextStructureLevel2Options = getStructureLevel2Options(nextLine, nextStructureLevel1);
    const structureParams = usesStructureTabs(nextLine)
      ? {
          structureLevel1: nextStructureLevel1,
          structureLevel2: nextStructureLevel2Options.length > 0 && nextStructureLevel2Tab !== ALL_STRUCTURE_TAB_KEY ? nextStructureLevel2Tab : undefined,
        }
      : {};
    const r: any = await productApi.list({ current: nextCurrent, size: nextSize, productLine: nextLine, ...nextFilters, ...structureParams });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(nextCurrent);
    setSize(nextSize);
    if (options?.filters !== undefined) setFilters(nextFilters);
  };

  useEffect(() => {
    const resetStructureLevel1Tab = ALL_STRUCTURE_TAB_KEY;
    const resetStructureLevel2Tab = ALL_STRUCTURE_TAB_KEY;
    setActiveStructureLevel1Tab(resetStructureLevel1Tab);
    setActiveStructureLevel2Tab(resetStructureLevel2Tab);
    load({ current: 1, size, filters: {}, productLine: activeLine, structureLevel1Tab: resetStructureLevel1Tab, structureLevel2Tab: resetStructureLevel2Tab });
  }, [activeLine]);

  const onSearch = async () => {
    const nextFilters = searchForm.getFieldsValue();
    await load({ current: 1, size, filters: nextFilters, productLine: activeLine });
  };

  const onTabChange = (key: string) => {
    setActiveLine(key);
    setFilters({});
    setActiveStructureLevel1Tab(ALL_STRUCTURE_TAB_KEY);
    setActiveStructureLevel2Tab(ALL_STRUCTURE_TAB_KEY);
    searchForm.resetFields();
  };

  const onStructureLevel1TabChange = async (key: string) => {
    const nextStructureLevel2Tab = ALL_STRUCTURE_TAB_KEY;
    setActiveStructureLevel1Tab(key);
    setActiveStructureLevel2Tab(nextStructureLevel2Tab);
    await load({ current: 1, size, filters, productLine: activeLine, structureLevel1Tab: key, structureLevel2Tab: nextStructureLevel2Tab });
  };

  const onStructureLevel2TabChange = async (key: string) => {
    setActiveStructureLevel2Tab(key);
    await load({ current: 1, size, filters, productLine: activeLine, structureLevel1Tab: activeStructureLevel1Tab, structureLevel2Tab: key });
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

    const initialValues: Record<string, string> = { productLine: activeLine };
    if (usesStructureTabs(activeLine) && activeStructureLevel1Tab !== ALL_STRUCTURE_TAB_KEY) {
      initialValues.structureLevel1 = activeStructureLevel1Tab;
    }
    if (
      usesStructureTabs(activeLine)
      && initialValues.structureLevel1
      && getStructureLevel2Options(activeLine, initialValues.structureLevel1).length > 0
      && activeStructureLevel2Tab !== ALL_STRUCTURE_TAB_KEY
    ) {
      initialValues.structureLevel2 = activeStructureLevel2Tab;
    }

    form.setFieldsValue(initialValues);
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
                {usesStructureTabs(option.key) ? (
                  <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: '0 12px' }}>
                    <Tabs
                      activeKey={activeStructureLevel1Tab}
                      onChange={onStructureLevel1TabChange}
                      items={[
                        { key: ALL_STRUCTURE_TAB_KEY, label: '全部' },
                        ...getStructureLevel1Options(option.key).map(item => ({ key: item.value, label: item.label })),
                      ]}
                    />
                    {activeStructureLevel2Options.length > 0 ? (
                      <Tabs
                        size="small"
                        activeKey={activeStructureLevel2Tab}
                        onChange={onStructureLevel2TabChange}
                        items={[
                          { key: ALL_STRUCTURE_TAB_KEY, label: '全部' },
                          ...activeStructureLevel2Options.map(item => ({ key: item.value, label: item.label })),
                        ]}
                      />
                    ) : null}
                  </div>
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

          <Divider>产品分类</Divider>
          <Form.Item name="structureLevel1" label="一级分类">
            {structureLevel1Options.length > 0 ? (
              <Select
                style={{ width: '100%' }}
                allowClear
                placeholder="请选择一级分类"
                options={structureLevel1Options}
              />
            ) : (
              <Input placeholder="请输入一级分类" />
            )}
          </Form.Item>
          <Form.Item name="structureLevel2" label="二级分类">
            {structureLevel2UsesSelect ? (
              <Select style={{ width: '100%' }} allowClear placeholder="请选择二级分类" options={structureLevel2Options} />
            ) : (
              <Input disabled={structureLevel2Disabled} placeholder={getStructureLevel2Placeholder(formProductLine, structureLevel1)} />
            )}
          </Form.Item>
          <Form.Item name="seriesDisplayName" label="系列展示口径">
            <Input placeholder="请输入系列展示名称" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
