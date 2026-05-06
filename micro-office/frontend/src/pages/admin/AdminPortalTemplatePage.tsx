import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import {
  AppstoreAddOutlined,
  BlockOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { portalBlockTemplateAdminApi, portalTemplateAdminApi } from '../../api';
import FixedTablePage from '../../components/FixedTablePage';
import { formatPaginationTotal, paginationLocale } from '../../constants/ui';

type CreatePreset = {
  title: string;
  templateType: string;
  defaultCodePrefix: string;
  defaultName: string;
};

const objectCreatePresets: CreatePreset[] = [
  { title: '新建客户模板', templateType: 'CUSTOMER_COMPANY', defaultCodePrefix: 'CUSTOMER_PORTAL', defaultName: '客户门户模板' },
  { title: '新建供应商模板', templateType: 'SUPPLIER', defaultCodePrefix: 'SUPPLIER_PORTAL', defaultName: '供应商门户模板' },
  { title: '新建承运商模板', templateType: 'CARRIER', defaultCodePrefix: 'CARRIER_PORTAL', defaultName: '承运商门户模板' },
  { title: '新建银行模板', templateType: 'BANK', defaultCodePrefix: 'BANK_PORTAL', defaultName: '银行门户模板' },
  { title: '新建产品模板', templateType: 'PRODUCT', defaultCodePrefix: 'PRODUCT_PORTAL', defaultName: '产品门户模板' },
  { title: '新建组织模板', templateType: 'ORGANIZATION', defaultCodePrefix: 'ORG_PORTAL', defaultName: '组织门户模板' },
];

function nextSuggestedCode(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return `${prefix}_${stamp}`;
}

export default function AdminPortalTemplatePage() {
  const nav = useNavigate();
  const [meta, setMeta] = useState<any>({});
  const [positions, setPositions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [blockTemplates, setBlockTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<CreatePreset | null>(null);
  const [createForm] = Form.useForm();
  const positionTableHostRef = useRef<HTMLDivElement | null>(null);
  const templateTableHostRef = useRef<HTMLDivElement | null>(null);
  const [positionTableScrollY, setPositionTableScrollY] = useState(320);
  const [templateTableScrollY, setTemplateTableScrollY] = useState(320);
  const [positionPage, setPositionPage] = useState(1);
  const [templatePage, setTemplatePage] = useState(1);
  const pageSize = 10;

  const statusOptions = useMemo(() => meta.statusOptions || [], [meta]);
  const templateTypeOptions = useMemo(() => meta.templateTypes || [], [meta]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const [metaResp, positionResp, templateResp, blockResp] = await Promise.all([
        portalTemplateAdminApi.meta(),
        portalTemplateAdminApi.positions(),
        portalTemplateAdminApi.listTemplates(),
        portalBlockTemplateAdminApi.listTemplates(),
      ]);
      setMeta(metaResp.data || {});
      const nextPositions = positionResp.data || [];
      const nextTemplates = templateResp.data || [];
      setPositions(nextPositions);
      setTemplates(nextTemplates);
      setBlockTemplates(blockResp.data || []);
      setPositionPage(prev => {
        const totalPages = Math.max(1, Math.ceil(nextPositions.length / pageSize));
        return Math.min(prev, totalPages);
      });
      setTemplatePage(prev => {
        const totalPages = Math.max(1, Math.ceil(nextTemplates.length / pageSize));
        return Math.min(prev, totalPages);
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLists();
  }, []);

  useEffect(() => {
    const syncHeight = (element: HTMLDivElement | null, setter: (value: number) => void) => {
      if (!element) return undefined;

      const update = () => {
        const next = Math.max(element.clientHeight - 96, 220);
        setter(next);
      };

      update();
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    };

    const disposePosition = syncHeight(positionTableHostRef.current, setPositionTableScrollY);
    const disposeTemplate = syncHeight(templateTableHostRef.current, setTemplateTableScrollY);

    return () => {
      disposePosition?.();
      disposeTemplate?.();
    };
  }, []);

  const handleGenerate = async (positionId: string) => {
    const resp: any = await portalTemplateAdminApi.generateByPosition({ positionId });
    await loadLists();
    message.success('岗位模板已生成，已跳转到装配页');
    if (resp.data?.id) {
      nav(`/admin/portal-templates/${resp.data.id}`);
    }
  };

  const openCreateModal = (preset: CreatePreset) => {
    setCreatePreset(preset);
    createForm.setFieldsValue({
      name: preset.defaultName,
      code: nextSuggestedCode(preset.defaultCodePrefix),
      templateType: preset.templateType,
      status: 'DRAFT',
      version: 1,
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createPreset) return;
    const values = await createForm.validateFields();
    const resp: any = await portalTemplateAdminApi.createTemplate({
      code: values.code,
      name: values.name,
      templateType: createPreset.templateType,
      roleKey: null,
      status: values.status || 'DRAFT',
      version: values.version || 1,
      meta: {
        creationEntry: 'OBJECT_TEMPLATE_QUICK_START',
        businessTemplateType: createPreset.templateType,
      },
      sections: [],
    });
    setCreateOpen(false);
    setCreatePreset(null);
    createForm.resetFields();
    await loadLists();
    message.success('客户&对象模板已创建，已跳转到装配页');
    if (resp.data?.id) {
      nav(`/admin/portal-templates/${resp.data.id}`);
    }
  };

  const pagedPositions = useMemo(() => {
    const start = (positionPage - 1) * pageSize;
    return positions.slice(start, start + pageSize);
  }, [positions, positionPage]);

  const pagedTemplates = useMemo(() => {
    const start = (templatePage - 1) * pageSize;
    return templates.slice(start, start + pageSize);
  }, [templates, templatePage]);

  const activeBlockCount = blockTemplates.filter(item => item.status === 'ACTIVE').length;
  const referencedBlockCount = blockTemplates.filter(item => Number(item.referenceCount || 0) > 0).length;
  const createPresetLabel = createPreset
    ? (templateTypeOptions.find((item: any) => item.value === createPreset.templateType)?.label || createPreset.templateType)
    : '';

  return (
    <div className="page-fill" style={{ gap: 16, minWidth: 0, overflowX: 'hidden', overflowY: 'auto', paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, minWidth: 0 }}>
        <Card
          className="page-card"
          title="按岗位生成模板"
          extra={<Button icon={<ReloadOutlined />} onClick={() => void loadLists()}>刷新</Button>}
          style={{ minWidth: 0 }}
          bodyStyle={{ padding: 12, minWidth: 0 }}
        >
          <Space direction="vertical" size={6} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>按岗位一键生成岗位门户模板</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>人员模板按岗位设计，生成后进入模板装配设计页继续引用卡片块。</div>
          </Space>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Statistic title="岗位数" value={positions.length} />
            <Statistic title="已生成岗位模板" value={positions.filter(item => item.templateId).length} />
            <Statistic title="待生成岗位模板" value={positions.filter(item => !item.templateId).length} />
          </div>
        </Card>

        <Card
          className="page-card"
          title="卡片块定义"
          extra={<Button type="primary" icon={<BlockOutlined />} onClick={() => nav('/admin/portal-block-templates')}>进入卡片块定义</Button>}
          style={{ minWidth: 0 }}
          bodyStyle={{ padding: 12, minWidth: 0 }}
        >
          <Space direction="vertical" size={6} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>先定义卡片块，再在模板设计页引用装配</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>这里管理块的名称、展示类型、数据键、标题和动作，是模板设计的正式资产入口。</div>
          </Space>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Statistic title="块模板总数" value={blockTemplates.length} />
            <Statistic title="ACTIVE 块模板" value={activeBlockCount} />
            <Statistic title="已被引用" value={referencedBlockCount} />
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 16, flex: 1, minWidth: 0, minHeight: 0, alignItems: 'start', overflowX: 'hidden' }}>
        <Card
          className="page-card"
          title="模板装配设计入口"
          style={{ height: 'auto', minWidth: 0 }}
          bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
        >
          <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <Space direction="vertical" size={6}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>客户&对象模板新建</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>客户&对象模板按定义对象类型创建，创建时先确定模板定义类型，再进入装配设计。</div>
            </Space>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
              {objectCreatePresets.map(preset => (
                <Button key={preset.templateType} icon={<AppstoreAddOutlined />} onClick={() => openCreateModal(preset)}>
                  {preset.title}
                </Button>
              ))}
            </div>
          </div>

          <Card
            className="portal-position-generation-card"
            type="inner"
            title="按岗位生成模板"
            extra={<Button type="link" icon={<TeamOutlined />} onClick={() => positionTableHostRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看岗位列表</Button>}
            style={{ minWidth: 0 }}
            bodyStyle={{ padding: 0, minHeight: 0, minWidth: 0 }}
          >
            <div ref={positionTableHostRef} style={{ minHeight: 0, minWidth: 0 }}>
              <Spin spinning={loading}>
                <FixedTablePage
                  table={(
                    <Table
                      rowKey="positionId"
                      size="small"
                      pagination={false}
                      dataSource={pagedPositions}
                      scroll={{ x: 780, y: positionTableScrollY }}
                      columns={[
                        {
                          title: '岗位',
                          dataIndex: 'positionName',
                          width: 190,
                          render: (_: any, row: any) => <div style={{ fontWeight: 600 }}>{row.positionName}</div>,
                        },
                        {
                          title: '推荐模板',
                          width: 220,
                          render: (_: any, row: any) => row.recommendedRole ? <Tag color="blue">{row.recommendedRole}</Tag> : <Tag>未推断</Tag>,
                        },
                        {
                          title: '当前模板',
                          width: 220,
                          render: (_: any, row: any) => (
                            row.templateId ? (
                              <Button type="link" style={{ paddingInline: 0 }} onClick={() => nav(`/admin/portal-templates/${row.templateId}`)}>
                                {row.templateName}
                              </Button>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>未生成</span>
                            )
                          ),
                        },
                        {
                          title: '操作',
                          width: 140,
                          render: (_: any, row: any) => (
                            row.templateId ? (
                              <Button size="small" onClick={() => nav(`/admin/portal-templates/${row.templateId}`)}>进入装配</Button>
                            ) : (
                              <Button size="small" type="primary" onClick={() => void handleGenerate(row.positionId)}>生成模板</Button>
                            )
                          ),
                        },
                      ]}
                    />
                  )}
                  pagination={(
                    <Pagination
                      current={positionPage}
                      pageSize={pageSize}
                      total={positions.length}
                      locale={paginationLocale}
                      onChange={setPositionPage}
                      showSizeChanger={false}
                      showTotal={(total) => formatPaginationTotal(total)}
                    />
                  )}
                />
              </Spin>
            </div>
          </Card>
        </Card>

        <Card
          className="page-card"
          title="模板列表"
          style={{ height: 'auto', minHeight: 560, minWidth: 0 }}
          extra={<Button icon={<BlockOutlined />} onClick={() => nav('/admin/portal-block-templates')}>查看卡片块定义</Button>}
          bodyStyle={{ padding: 12, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div ref={templateTableHostRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Spin spinning={loading} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
              <FixedTablePage
                table={(
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={pagedTemplates}
                    scroll={{ x: 920, y: templateTableScrollY }}
                    columns={[
                      {
                        title: '模板',
                        width: 260,
                        render: (_: any, row: any) => (
                          <div>
                            <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => nav(`/admin/portal-templates/${row.id}`)}>
                              {row.name}
                            </Button>
                            <div style={{ color: '#6b7280', fontSize: 12 }}>{row.code}</div>
                          </div>
                        ),
                      },
                      {
                        title: '类型',
                        width: 140,
                        render: (_: any, row: any) => <Tag>{row.templateType}</Tag>,
                      },
                      {
                        title: '岗位/角色',
                        width: 180,
                        render: (_: any, row: any) => row.positionName || row.roleKey || '-',
                      },
                      {
                        title: '状态',
                        width: 100,
                        render: (_: any, row: any) => (
                          <Tag color={row.status === 'ACTIVE' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>{row.status}</Tag>
                        ),
                      },
                      {
                        title: '装配结构',
                        width: 180,
                        render: (_: any, row: any) => `${row.sectionCount || 0} 个分区 / ${row.blockRefCount || 0} 个块引用`,
                      },
                      {
                        title: '操作',
                        width: 120,
                        render: (_: any, row: any) => (
                          <Button size="small" type="primary" onClick={() => nav(`/admin/portal-templates/${row.id}`)}>进入装配</Button>
                        ),
                      },
                    ]}
                  />
                )}
                pagination={(
                  <Pagination
                    current={templatePage}
                    pageSize={pageSize}
                    total={templates.length}
                    locale={paginationLocale}
                    onChange={setTemplatePage}
                    showSizeChanger={false}
                    showTotal={(total) => formatPaginationTotal(total)}
                  />
                )}
              />
            </Spin>
          </div>
        </Card>
      </div>

      <Modal
        title={createPreset?.title || '新建客户&对象模板'}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreatePreset(null);
          createForm.resetFields();
        }}
        onOk={() => void handleCreate()}
        okText="创建并进入装配"
        cancelText="取消"
        width={560}
      >
        <Form form={createForm} layout="vertical" initialValues={{ status: 'DRAFT', version: 1 }}>
          <Form.Item label="定义对象类型">
            <Input value={createPresetLabel} disabled />
          </Form.Item>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="模板编码" rules={[{ required: true, message: '请输入模板编码' }]}>
            <Input onChange={e => createForm.setFieldValue('code', String(e.target.value || '').toUpperCase())} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
              <Select style={{ width: '100%' }} options={statusOptions} />
            </Form.Item>
            <Form.Item name="version" label="版本">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
