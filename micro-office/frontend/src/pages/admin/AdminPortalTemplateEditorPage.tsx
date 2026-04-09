import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
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

export default function AdminPortalTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const [meta, setMeta] = useState<any>({});
  const [detail, setDetail] = useState<EditorTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const templateTypeOptions: OptionItem[] = meta.templateTypes || [];
  const roleOptions: OptionItem[] = meta.roleKeys || [];
  const statusOptions: OptionItem[] = meta.statusOptions || [];
  const sectionTypeOptions: OptionItem[] = meta.sectionTypes || [];
  const displayTypeOptions: OptionItem[] = meta.displayTypes || [];
  const actionTypeOptions: OptionItem[] = meta.actionTypes || [];
  const subjectTypeOptions: OptionItem[] = meta.subjectTypes || [];
  const sessionTypeOptions: OptionItem[] = meta.sessionTypes || [];

  const loadPage = async (templateId: string) => {
    setLoading(true);
    try {
      const [metaResp, detailResp] = await Promise.all([
        portalTemplateAdminApi.meta(),
        portalTemplateAdminApi.getTemplate(templateId),
      ]);
      setMeta(metaResp.data || {});
      setDetail(normalizeTemplate(detailResp.data));
    } catch (error: any) {
      message.error(error?.response?.data?.message || '模板加载失败');
      nav('/admin/portal-templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      void loadPage(id);
    }
  }, [id]);

  const refreshDetail = async () => {
    if (id) {
      await loadPage(id);
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

  const handleSave = async () => {
    if (!detail?.id) return;
    try {
      setSaving(true);
      const payload = buildPayload(detail);
      const resp: any = await portalTemplateAdminApi.updateTemplate(detail.id, payload);
      setDetail(normalizeTemplate(resp.data));
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
    nav('/admin/portal-templates');
  };

  const statusColor = useMemo(() => {
    if (!detail) return 'default';
    return detail.status === 'ACTIVE' ? 'green' : detail.status === 'DRAFT' ? 'gold' : 'default';
  }, [detail]);

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Alert
        type="info"
        showIcon
        message="模板编辑子页面"
        description="当前页只负责编辑单个模板。返回上一页可查看岗位生成模板和模板列表。"
      />

      <Card
        className="page-card"
        style={{ flex: 1, minHeight: 0 }}
        title={detail ? `编辑模板：${detail.name}` : '模板编辑'}
        extra={detail ? (
          <Space wrap>
            <Button onClick={() => nav('/admin/portal-templates')}>返回模板列表</Button>
            <Tag color={statusColor}>{detail.status}</Tag>
            <Button onClick={() => void refreshDetail()}>重新加载</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>保存模板</Button>
            <Popconfirm
              title={`确认删除模板「${detail.name}」？`}
              description="删除后，模板下的分区、展示项和动作会一并删除，且不可恢复。"
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDelete()}
            >
              <Button danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        ) : null}
        bodyStyle={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        {loading ? (
          <div className="page-fill" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <div className="page-fill" style={{ justifyContent: 'center' }}>
            <Empty description="模板不存在或正在加载" />
          </div>
        ) : (
          <div className="page-card-scroll" style={{ paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
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
                      <Popconfirm
                        title={`确认删除分区「${section.name || `分区 ${sectionIndex + 1}`}」？`}
                        description="该分区下的展示项和动作也会一并移除。"
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => updateDetail(prev => ({ ...prev, sections: prev.sections.filter((_, index) => index !== sectionIndex) }))}
                      >
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
                          <Popconfirm
                            title={`确认删除展示项「${item.label || item.itemKey || `${sectionIndex + 1}.${itemIndex + 1}`}」？`}
                            description="该展示项下的动作也会一并移除。"
                            okText="确认删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => updateSection(sectionIndex, current => ({ ...current, items: current.items.filter((_, index) => index !== itemIndex) }))}
                          >
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
                              <Popconfirm
                                title={`确认删除动作「${action.actionType || `${sectionIndex + 1}.${itemIndex + 1}.${actionIndex + 1}`}」？`}
                                description="删除后该展示项将不再触发这个动作配置。"
                                okText="确认删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                onConfirm={() => updateItem(sectionIndex, itemIndex, current => ({ ...current, actions: current.actions.filter((_, index) => index !== actionIndex) }))}
                              >
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
          </div>
        )}
      </Card>
    </div>
  );
}
