import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalTemplateAdminApi } from '../../api';

const { TextArea } = Input;

type OptionItem = {
  value: string;
  label: string;
};

type EditorAction = {
  id: string;
  actionType: string;
  targetSubjectType?: string;
  targetIdPath?: string;
  sessionType?: string;
  metaText: string;
};

type EditorItem = {
  id: string;
  itemKey: string;
  label: string;
  dataKey: string;
  displayType: string;
  sortOrder: number;
  metaText: string;
  actions: EditorAction[];
};

type EditorSection = {
  id: string;
  code: string;
  name: string;
  sectionType: string;
  sortOrder: number;
  metaText: string;
  items: EditorItem[];
};

type EditorTemplate = {
  id: string;
  code: string;
  name: string;
  templateType: string;
  roleKey?: string;
  status: string;
  version: number;
  metaText: string;
  sections: EditorSection[];
};

function localId(prefix: string) {
  return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function prettyJson(value: any) {
  return JSON.stringify(value || {}, null, 2);
}

function normalizeAction(action: any): EditorAction {
  return {
    id: action?.id || localId('action'),
    actionType: action?.actionType || 'switch_subject',
    targetSubjectType: action?.targetSubjectType || undefined,
    targetIdPath: action?.targetIdPath || undefined,
    sessionType: action?.sessionType || undefined,
    metaText: prettyJson(action?.meta),
  };
}

function normalizeItem(item: any): EditorItem {
  return {
    id: item?.id || localId('item'),
    itemKey: item?.itemKey || '',
    label: item?.label || '',
    dataKey: item?.dataKey || '',
    displayType: item?.displayType || 'CARD',
    sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : Number(item?.sortOrder || 0),
    metaText: prettyJson(item?.meta),
    actions: (item?.actions || []).map(normalizeAction),
  };
}

function normalizeSection(section: any): EditorSection {
  return {
    id: section?.id || localId('section'),
    code: section?.code || '',
    name: section?.name || '',
    sectionType: section?.sectionType || 'BLOCK',
    sortOrder: typeof section?.sortOrder === 'number' ? section.sortOrder : Number(section?.sortOrder || 0),
    metaText: prettyJson(section?.meta),
    items: (section?.items || []).map(normalizeItem),
  };
}

function normalizeTemplate(detail: any): EditorTemplate {
  return {
    id: detail?.id,
    code: detail?.code || '',
    name: detail?.name || '',
    templateType: detail?.templateType || 'PERSON_ROLE',
    roleKey: detail?.roleKey || undefined,
    status: detail?.status || 'DRAFT',
    version: typeof detail?.version === 'number' ? detail.version : Number(detail?.version || 1),
    metaText: prettyJson(detail?.meta),
    sections: (detail?.sections || []).map(normalizeSection),
  };
}

function parseJson(text: string, label: string) {
  const raw = (text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function buildPayload(detail: EditorTemplate) {
  return {
    code: detail.code,
    name: detail.name,
    templateType: detail.templateType,
    roleKey: detail.roleKey || null,
    status: detail.status,
    version: detail.version,
    meta: parseJson(detail.metaText, '模板 meta'),
    sections: detail.sections.map((section, sectionIndex) => ({
      id: section.id,
      code: section.code,
      name: section.name,
      sectionType: section.sectionType,
      sortOrder: section.sortOrder,
      meta: parseJson(section.metaText, `分区 ${sectionIndex + 1} meta`),
      items: section.items.map((item, itemIndex) => ({
        id: item.id,
        itemKey: item.itemKey,
        label: item.label,
        dataKey: item.dataKey,
        displayType: item.displayType,
        sortOrder: item.sortOrder,
        meta: parseJson(item.metaText, `展示项 ${sectionIndex + 1}-${itemIndex + 1} meta`),
        actions: item.actions.map((action, actionIndex) => ({
          id: action.id,
          actionType: action.actionType,
          targetSubjectType: action.targetSubjectType || null,
          targetIdPath: action.targetIdPath || null,
          sessionType: action.sessionType || null,
          meta: parseJson(action.metaText, `动作 ${sectionIndex + 1}-${itemIndex + 1}-${actionIndex + 1} meta`),
        })),
      })),
    })),
  };
}

function createEmptySection(): EditorSection {
  return {
    id: localId('section'),
    code: '',
    name: '',
    sectionType: 'BLOCK',
    sortOrder: 10,
    metaText: prettyJson({}),
    items: [],
  };
}

function createEmptyItem(): EditorItem {
  return {
    id: localId('item'),
    itemKey: '',
    label: '',
    dataKey: '',
    displayType: 'CARD',
    sortOrder: 10,
    metaText: prettyJson({}),
    actions: [],
  };
}

function createEmptyAction(): EditorAction {
  return {
    id: localId('action'),
    actionType: 'switch_subject',
    targetSubjectType: undefined,
    targetIdPath: undefined,
    sessionType: undefined,
    metaText: prettyJson({}),
  };
}

export default function AdminPortalTemplatePage() {
  const [meta, setMeta] = useState<any>({});
  const [positions, setPositions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [detail, setDetail] = useState<EditorTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const templateTypeOptions: OptionItem[] = meta.templateTypes || [];
  const roleOptions: OptionItem[] = meta.roleKeys || [];
  const statusOptions: OptionItem[] = meta.statusOptions || [];
  const sectionTypeOptions: OptionItem[] = meta.sectionTypes || [];
  const displayTypeOptions: OptionItem[] = meta.displayTypes || [];
  const actionTypeOptions: OptionItem[] = meta.actionTypes || [];
  const subjectTypeOptions: OptionItem[] = meta.subjectTypes || [];
  const sessionTypeOptions: OptionItem[] = meta.sessionTypes || [];

  const selectedSummary = useMemo(() => templates.find(item => item.id === selectedTemplateId), [templates, selectedTemplateId]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const [metaResp, positionResp, templateResp] = await Promise.all([
        portalTemplateAdminApi.meta(),
        portalTemplateAdminApi.positions(),
        portalTemplateAdminApi.listTemplates(),
      ]);
      setMeta(metaResp.data || {});
      setPositions(positionResp.data || []);
      const nextTemplates = templateResp.data || [];
      setTemplates(nextTemplates);
      if (selectedTemplateId && !nextTemplates.some((item: any) => item.id === selectedTemplateId)) {
        setSelectedTemplateId(undefined);
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (templateId: string) => {
    setDetailLoading(true);
    try {
      const resp: any = await portalTemplateAdminApi.getTemplate(templateId);
      setSelectedTemplateId(templateId);
      setDetail(normalizeTemplate(resp.data));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadDetail(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const refreshAll = async () => {
    await loadLists();
    if (selectedTemplateId) {
      await loadDetail(selectedTemplateId);
    }
  };

  const updateDetail = (updater: (prev: EditorTemplate) => EditorTemplate) => {
    setDetail(prev => (prev ? updater(prev) : prev));
  };

  const updateSection = (sectionIndex: number, updater: (section: EditorSection) => EditorSection) => {
    updateDetail(prev => ({
      ...prev,
      sections: prev.sections.map((section, index) => (index === sectionIndex ? updater(section) : section)),
    }));
  };

  const updateItem = (sectionIndex: number, itemIndex: number, updater: (item: EditorItem) => EditorItem) => {
    updateSection(sectionIndex, section => ({
      ...section,
      items: section.items.map((item, index) => (index === itemIndex ? updater(item) : item)),
    }));
  };

  const updateAction = (sectionIndex: number, itemIndex: number, actionIndex: number, updater: (action: EditorAction) => EditorAction) => {
    updateItem(sectionIndex, itemIndex, item => ({
      ...item,
      actions: item.actions.map((action, index) => (index === actionIndex ? updater(action) : action)),
    }));
  };

  const handleGenerate = async (positionId: string) => {
    const resp: any = await portalTemplateAdminApi.generateByPosition({ positionId });
    await loadLists();
    setSelectedTemplateId(resp.data?.id);
    setDetail(normalizeTemplate(resp.data));
    message.success('岗位模板已生成');
  };

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    const resp: any = await portalTemplateAdminApi.createTemplate({
      code: values.code,
      name: values.name,
      templateType: values.templateType,
      roleKey: values.templateType === 'PERSON_ROLE' ? values.roleKey || null : null,
      status: values.status || 'DRAFT',
      version: values.version || 1,
      meta: {},
      sections: [],
    });
    setCreateOpen(false);
    createForm.resetFields();
    await loadLists();
    setSelectedTemplateId(resp.data?.id);
    setDetail(normalizeTemplate(resp.data));
    message.success('模板已创建');
  };

  const handleSave = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      const payload = buildPayload(detail);
      const resp: any = await portalTemplateAdminApi.updateTemplate(detail.id, payload);
      setDetail(normalizeTemplate(resp.data));
      await loadLists();
      message.success('模板已保存');
    } catch (error: any) {
      message.error(error?.message || error?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detail?.id) return;
    await portalTemplateAdminApi.deleteTemplate(detail.id);
    message.success('模板已删除');
    setDetail(null);
    setSelectedTemplateId(undefined);
    await loadLists();
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Alert
        type="info"
        showIcon
        message="已按 mo_portal_templates / sections / items / item_actions 四层结构做成可编辑页。当前支持：按岗位生成模板、编辑模板基础信息、分区、展示项和动作。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, minHeight: 320, flex: '0 0 360px' }}>
        <Card
          className="page-card"
          title="按岗位生成模板"
          extra={<Button icon={<ReloadOutlined />} onClick={refreshAll}>刷新</Button>}
          bodyStyle={{ padding: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Spin spinning={loading}>
            <Table
              rowKey="positionId"
              size="small"
              pagination={{ pageSize: 8 }}
              dataSource={positions}
              scroll={{ x: 760, y: 240 }}
              columns={[
                {
                  title: '岗位',
                  dataIndex: 'positionName',
                  width: 180,
                  render: (_: any, row: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.positionName}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{row.positionCode || '-'}</div>
                    </div>
                  ),
                },
                {
                  title: '推荐种子',
                  width: 220,
                  render: (_: any, row: any) => (
                    <Space direction="vertical" size={2}>
                      {row.recommendedRole ? <Tag color="blue">{row.recommendedRole}</Tag> : <Tag>未推断</Tag>}
                      <span style={{ color: '#6b7280', fontSize: 12 }}>{row.seedTemplateName || '无匹配种子，生成空模板'}</span>
                    </Space>
                  ),
                },
                {
                  title: '已生成模板',
                  width: 220,
                  render: (_: any, row: any) => (
                    row.templateId
                      ? <Button type="link" style={{ paddingInline: 0 }} onClick={() => setSelectedTemplateId(row.templateId)}>{row.templateName}</Button>
                      : <span style={{ color: '#9ca3af' }}>未生成</span>
                  ),
                },
                {
                  title: '操作',
                  width: 120,
                  render: (_: any, row: any) => (
                    row.templateId
                      ? <Button size="small" onClick={() => setSelectedTemplateId(row.templateId)}>编辑</Button>
                      : <Button size="small" type="primary" onClick={() => handleGenerate(row.positionId)}>生成模板</Button>
                  ),
                },
              ]}
            />
          </Spin>
        </Card>

        <Card
          className="page-card"
          title="模板列表"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建空模板</Button>}
          bodyStyle={{ padding: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Spin spinning={loading}>
            <Table
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8 }}
              dataSource={templates}
              rowClassName={record => record.id === selectedTemplateId ? 'ant-table-row-selected' : ''}
              scroll={{ x: 860, y: 240 }}
              columns={[
                {
                  title: '模板',
                  width: 240,
                  render: (_: any, row: any) => (
                    <div>
                      <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => setSelectedTemplateId(row.id)}>{row.name}</Button>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{row.code}</div>
                    </div>
                  ),
                },
                {
                  title: '类型',
                  width: 120,
                  render: (_: any, row: any) => <Tag>{row.templateType}</Tag>,
                },
                {
                  title: '岗位',
                  width: 180,
                  render: (_: any, row: any) => row.positionName || '-',
                },
                {
                  title: '状态',
                  width: 100,
                  render: (_: any, row: any) => (
                    <Tag color={row.status === 'ACTIVE' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>{row.status}</Tag>
                  ),
                },
                {
                  title: '结构',
                  width: 160,
                  render: (_: any, row: any) => `${row.sectionCount}/${row.itemCount}/${row.actionCount}`,
                },
              ]}
            />
          </Spin>
        </Card>
      </div>

      <Card
        className="page-card"
        style={{ flex: 1, minHeight: 0 }}
        title={selectedSummary ? `编辑模板：${selectedSummary.name}` : '模板编辑器'}
        extra={detail ? (
          <Space>
            <Button onClick={() => { setSelectedTemplateId(undefined); setDetail(null); }}>返回列表</Button>
            <Button onClick={refreshAll}>重新加载</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>保存模板</Button>
            <Popconfirm title="确认删除当前模板？" okText="删除" cancelText="取消" onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        ) : null}
        bodyStyle={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Spin spinning={detailLoading} style={{ flex: 1, minHeight: 0 }}>
          {!detail ? (
            <div className="page-fill" style={{ justifyContent: 'center' }}>
              <Empty description="先查看上方模板列表，或从左上角按岗位生成模板" />
            </div>
          ) : (
            <div className="page-fill" style={{ gap: 16, overflow: 'auto', paddingRight: 4 }}>
              <Card type="inner" title="模板基础信息">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板名称</div>
                    <Input value={detail.name} onChange={e => updateDetail(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板编码</div>
                    <Input value={detail.code} onChange={e => updateDetail(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板类型</div>
                    <Select value={detail.templateType} options={templateTypeOptions} onChange={value => updateDetail(prev => ({ ...prev, templateType: value, roleKey: value === 'PERSON_ROLE' ? prev.roleKey : undefined }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>状态</div>
                    <Select value={detail.status} options={statusOptions} onChange={value => updateDetail(prev => ({ ...prev, status: value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>角色标识</div>
                    <Select allowClear value={detail.roleKey} options={roleOptions} disabled={detail.templateType !== 'PERSON_ROLE'} onChange={value => updateDetail(prev => ({ ...prev, roleKey: value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>版本</div>
                    <InputNumber min={1} style={{ width: '100%' }} value={detail.version} onChange={value => updateDetail(prev => ({ ...prev, version: Number(value || 1) }))} />
                  </div>
                  <div style={{ gridColumn: '1 / span 4' }}>
                    <div style={{ marginBottom: 6 }}>模板 Meta(JSON)</div>
                    <TextArea rows={6} value={detail.metaText} onChange={e => updateDetail(prev => ({ ...prev, metaText: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <Card
                type="inner"
                title="模板结构"
                extra={<Button icon={<PlusOutlined />} onClick={() => updateDetail(prev => ({ ...prev, sections: [...prev.sections, createEmptySection()] }))}>新增分区</Button>}
              >
                {!detail.sections.length ? (
                  <Empty description="当前模板还没有分区" />
                ) : detail.sections.map((section, sectionIndex) => (
                  <Card
                    key={section.id}
                    type="inner"
                    title={`分区 ${sectionIndex + 1}`}
                    style={{ marginBottom: 16 }}
                    extra={
                      <Popconfirm title="删除这个分区？" okText="删除" cancelText="取消" onConfirm={() => updateDetail(prev => ({ ...prev, sections: prev.sections.filter((_, index) => index !== sectionIndex) }))}>
                        <Button danger size="small">删除分区</Button>
                      </Popconfirm>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <div style={{ marginBottom: 6 }}>分区编码</div>
                        <Input value={section.code} onChange={e => updateSection(sectionIndex, current => ({ ...current, code: e.target.value.toUpperCase() }))} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>分区名称</div>
                        <Input value={section.name} onChange={e => updateSection(sectionIndex, current => ({ ...current, name: e.target.value }))} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>分区类型</div>
                        <Select value={section.sectionType} options={sectionTypeOptions} onChange={value => updateSection(sectionIndex, current => ({ ...current, sectionType: value }))} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>排序</div>
                        <InputNumber min={0} style={{ width: '100%' }} value={section.sortOrder} onChange={value => updateSection(sectionIndex, current => ({ ...current, sortOrder: Number(value || 0) }))} />
                      </div>
                      <div style={{ gridColumn: '1 / span 4' }}>
                        <div style={{ marginBottom: 6 }}>分区 Meta(JSON)</div>
                        <TextArea rows={4} value={section.metaText} onChange={e => updateSection(sectionIndex, current => ({ ...current, metaText: e.target.value }))} />
                      </div>
                    </div>

                    <Divider style={{ margin: '16px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <strong>展示项</strong>
                      <Button size="small" icon={<PlusOutlined />} onClick={() => updateSection(sectionIndex, current => ({ ...current, items: [...current.items, createEmptyItem()] }))}>新增展示项</Button>
                    </div>

                    {!section.items.length ? (
                      <Empty description="该分区暂无展示项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : section.items.map((item, itemIndex) => (
                      <Card
                        key={item.id}
                        type="inner"
                        title={`展示项 ${sectionIndex + 1}.${itemIndex + 1}`}
                        style={{ marginBottom: 12 }}
                        extra={
                          <Popconfirm title="删除这个展示项？" okText="删除" cancelText="取消" onConfirm={() => updateSection(sectionIndex, current => ({ ...current, items: current.items.filter((_, index) => index !== itemIndex) }))}>
                            <Button danger size="small">删除展示项</Button>
                          </Popconfirm>
                        }
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
                          <div>
                            <div style={{ marginBottom: 6 }}>itemKey</div>
                            <Input value={item.itemKey} onChange={e => updateItem(sectionIndex, itemIndex, current => ({ ...current, itemKey: e.target.value }))} />
                          </div>
                          <div>
                            <div style={{ marginBottom: 6 }}>名称</div>
                            <Input value={item.label} onChange={e => updateItem(sectionIndex, itemIndex, current => ({ ...current, label: e.target.value }))} />
                          </div>
                          <div>
                            <div style={{ marginBottom: 6 }}>dataKey</div>
                            <Input value={item.dataKey} onChange={e => updateItem(sectionIndex, itemIndex, current => ({ ...current, dataKey: e.target.value }))} />
                          </div>
                          <div>
                            <div style={{ marginBottom: 6 }}>展示类型</div>
                            <Select value={item.displayType} options={displayTypeOptions} onChange={value => updateItem(sectionIndex, itemIndex, current => ({ ...current, displayType: value }))} />
                          </div>
                          <div>
                            <div style={{ marginBottom: 6 }}>排序</div>
                            <InputNumber min={0} style={{ width: '100%' }} value={item.sortOrder} onChange={value => updateItem(sectionIndex, itemIndex, current => ({ ...current, sortOrder: Number(value || 0) }))} />
                          </div>
                          <div style={{ gridColumn: '1 / span 5' }}>
                            <div style={{ marginBottom: 6 }}>展示项 Meta(JSON)</div>
                            <TextArea rows={4} value={item.metaText} onChange={e => updateItem(sectionIndex, itemIndex, current => ({ ...current, metaText: e.target.value }))} />
                          </div>
                        </div>

                        <Divider style={{ margin: '16px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <strong>动作</strong>
                          <Button size="small" icon={<PlusOutlined />} onClick={() => updateItem(sectionIndex, itemIndex, current => ({ ...current, actions: [...current.actions, createEmptyAction()] }))}>新增动作</Button>
                        </div>

                        {!item.actions.length ? (
                          <Empty description="该展示项暂无动作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : item.actions.map((action, actionIndex) => (
                          <Card
                            key={action.id}
                            type="inner"
                            size="small"
                            title={`动作 ${sectionIndex + 1}.${itemIndex + 1}.${actionIndex + 1}`}
                            style={{ marginBottom: 12 }}
                            extra={
                              <Popconfirm title="删除这个动作？" okText="删除" cancelText="取消" onConfirm={() => updateItem(sectionIndex, itemIndex, current => ({ ...current, actions: current.actions.filter((_, index) => index !== actionIndex) }))}>
                                <Button danger size="small">删除动作</Button>
                              </Popconfirm>
                            }
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                              <div>
                                <div style={{ marginBottom: 6 }}>动作类型</div>
                                <Select value={action.actionType} options={actionTypeOptions} onChange={value => updateAction(sectionIndex, itemIndex, actionIndex, current => ({ ...current, actionType: value }))} />
                              </div>
                              <div>
                                <div style={{ marginBottom: 6 }}>目标主体类型</div>
                                <Select allowClear value={action.targetSubjectType} options={subjectTypeOptions} onChange={value => updateAction(sectionIndex, itemIndex, actionIndex, current => ({ ...current, targetSubjectType: value }))} />
                              </div>
                              <div>
                                <div style={{ marginBottom: 6 }}>targetIdPath</div>
                                <Input value={action.targetIdPath} onChange={e => updateAction(sectionIndex, itemIndex, actionIndex, current => ({ ...current, targetIdPath: e.target.value }))} />
                              </div>
                              <div>
                                <div style={{ marginBottom: 6 }}>sessionType</div>
                                <Select allowClear value={action.sessionType} options={sessionTypeOptions} onChange={value => updateAction(sectionIndex, itemIndex, actionIndex, current => ({ ...current, sessionType: value }))} />
                              </div>
                              <div style={{ gridColumn: '1 / span 4' }}>
                                <div style={{ marginBottom: 6 }}>动作 Meta(JSON)</div>
                                <TextArea rows={4} value={action.metaText} onChange={e => updateAction(sectionIndex, itemIndex, actionIndex, current => ({ ...current, metaText: e.target.value }))} />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </Card>
                    ))}
                  </Card>
                ))}
              </Card>
            </div>
          )}
        </Spin>
      </Card>

      <Modal
        title="新建空模板"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ templateType: 'PERSON_ROLE', status: 'DRAFT', version: 1 }}
        >
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="模板编码" rules={[{ required: true, message: '请输入模板编码' }]}>
            <Input placeholder="例如 POSITION_CEO" onChange={e => createForm.setFieldValue('code', String(e.target.value || '').toUpperCase())} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Form.Item name="templateType" label="模板类型" rules={[{ required: true, message: '请选择模板类型' }]}>
              <Select options={templateTypeOptions} />
            </Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() => (
                <Form.Item name="roleKey" label="角色标识">
                  <Select allowClear options={roleOptions} disabled={createForm.getFieldValue('templateType') !== 'PERSON_ROLE'} />
                </Form.Item>
              )}
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={statusOptions} />
            </Form.Item>
          </div>
          <Form.Item name="version" label="版本">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
