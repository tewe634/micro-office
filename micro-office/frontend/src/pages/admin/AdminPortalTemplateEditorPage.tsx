import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SortAscendingOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { objectApi, orgApi, portalBlockTemplateAdminApi, portalTemplateAdminApi, productApi, userApi } from '../../api';

const { Text } = Typography;

type OptionItem = {
  value: string;
  label: string;
};

type BlockTemplateSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  displayType: string;
  dataKey: string;
  label: string;
  meta?: Record<string, any>;
  actions?: Array<Record<string, any>>;
};

type EditorBlockRef = {
  id: string;
  blockTemplateId: string;
  sortOrder: number;
  enabled: boolean;
  overrideMeta: Record<string, any>;
  blockTemplate?: BlockTemplateSummary;
};

type EditorSection = {
  id: string;
  code: string;
  name: string;
  sectionType: string;
  sortOrder: number;
  meta: Record<string, any>;
  blockRefs: EditorBlockRef[];
};

type EditorTemplate = {
  id: string;
  code: string;
  name: string;
  templateType: string;
  roleKey?: string;
  positionId?: string;
  status: string;
  version: number;
  meta: Record<string, any>;
  sections: EditorSection[];
};

type PreviewEntityType = 'PERSON' | 'PRODUCT' | 'CUSTOMER_COMPANY' | 'SUPPLIER' | 'CARRIER' | 'BANK' | 'ORGANIZATION';

type PreviewSubjectOption = {
  value: string;
  label: string;
};

const previewEntityTypeOptions: OptionItem[] = [
  { value: 'PERSON', label: '人员' },
  { value: 'PRODUCT', label: '产品' },
  { value: 'CUSTOMER_COMPANY', label: '客户公司' },
  { value: 'SUPPLIER', label: '供应商' },
  { value: 'CARRIER', label: '承运商' },
  { value: 'BANK', label: '银行' },
  { value: 'ORGANIZATION', label: '组织' },
];

const previewEntityByTemplateType: Record<string, PreviewEntityType> = {
  PERSON_ROLE: 'PERSON',
  PRODUCT: 'PRODUCT',
  CUSTOMER_COMPANY: 'CUSTOMER_COMPANY',
  SUPPLIER: 'SUPPLIER',
  CARRIER: 'CARRIER',
  BANK: 'BANK',
  ORGANIZATION: 'ORGANIZATION',
};

function localId(prefix: string) {
  return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function asObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeBlockTemplate(item: any): BlockTemplateSummary {
  return {
    id: String(item?.id || ''),
    code: String(item?.code || ''),
    name: String(item?.name || ''),
    status: String(item?.status || 'DRAFT'),
    displayType: String(item?.displayType || ''),
    dataKey: String(item?.dataKey || ''),
    label: String(item?.label || ''),
    meta: asObject(item?.meta),
    actions: Array.isArray(item?.actions) ? item.actions : [],
  };
}

function normalizeBlockRef(item: any): EditorBlockRef {
  return {
    id: String(item?.id || localId('block-ref')),
    blockTemplateId: String(item?.blockTemplateId || item?.blockTemplate?.id || ''),
    sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : Number(item?.sortOrder || 0),
    enabled: item?.enabled !== false,
    overrideMeta: asObject(item?.overrideMeta),
    blockTemplate: item?.blockTemplate ? normalizeBlockTemplate(item.blockTemplate) : undefined,
  };
}

function normalizeSection(item: any): EditorSection {
  return {
    id: String(item?.id || localId('section')),
    code: String(item?.code || ''),
    name: String(item?.name || ''),
    sectionType: String(item?.sectionType || 'BLOCK'),
    sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : Number(item?.sortOrder || 0),
    meta: asObject(item?.meta),
    blockRefs: Array.isArray(item?.blockRefs) ? item.blockRefs.map(normalizeBlockRef) : [],
  };
}

function normalizeTemplate(detail: any): EditorTemplate {
  return {
    id: String(detail?.id || ''),
    code: String(detail?.code || ''),
    name: String(detail?.name || ''),
    templateType: String(detail?.templateType || 'PERSON_ROLE'),
    roleKey: detail?.roleKey || undefined,
    positionId: detail?.positionId || undefined,
    status: String(detail?.status || 'DRAFT'),
    version: typeof detail?.version === 'number' ? detail.version : Number(detail?.version || 1),
    meta: asObject(detail?.meta),
    sections: Array.isArray(detail?.sections) ? detail.sections.map(normalizeSection) : [],
  };
}

function readPreviewEntity(meta: Record<string, any>) {
  const previewEntity = asObject(meta?.previewEntity);
  return {
    entityType: typeof previewEntity.entityType === 'string' ? previewEntity.entityType : undefined,
    entityId: typeof previewEntity.entityId === 'string' ? previewEntity.entityId : undefined,
  };
}

function createEmptySection(index: number): EditorSection {
  const order = (index + 1) * 10;
  return {
    id: localId('section'),
    code: `SECTION_${index + 1}`,
    name: '',
    sectionType: 'BLOCK',
    sortOrder: order,
    meta: {},
    blockRefs: [],
  };
}

function buildPayload(detail: EditorTemplate) {
  return {
    code: detail.code.trim().toUpperCase(),
    name: detail.name.trim(),
    templateType: detail.templateType,
    roleKey: detail.templateType === 'PERSON_ROLE' ? detail.roleKey || null : null,
    status: detail.status,
    version: detail.version,
    meta: detail.meta,
    sections: detail.sections.map(section => ({
      id: section.id.startsWith('tmp-') ? undefined : section.id,
      code: section.code.trim().toUpperCase(),
      name: section.name.trim(),
      sectionType: section.sectionType || 'BLOCK',
      sortOrder: section.sortOrder,
      meta: section.meta,
      blockRefs: section.blockRefs.map(blockRef => ({
        id: blockRef.id.startsWith('tmp-') ? undefined : blockRef.id,
        blockTemplateId: blockRef.blockTemplateId,
        sortOrder: blockRef.sortOrder,
        enabled: blockRef.enabled,
        overrideMeta: blockRef.overrideMeta,
      })),
    })),
  };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [current] = next.splice(index, 1);
  next.splice(nextIndex, 0, current);
  return next;
}

function resequenceSections(sections: EditorSection[]) {
  return sections.map((section, index) => ({
    ...section,
    sortOrder: (index + 1) * 10,
    blockRefs: resequenceBlockRefs(section.blockRefs),
  }));
}

function resequenceBlockRefs(blockRefs: EditorBlockRef[]) {
  return blockRefs.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }));
}

function blockTemplateLabel(blockTemplate?: BlockTemplateSummary) {
  if (!blockTemplate) return '未关联块模板';
  return blockTemplate.label || blockTemplate.name || blockTemplate.code || '未命名块模板';
}

function sectionNameLinkedBlockId(section: EditorSection, templates: BlockTemplateSummary[]) {
  const linkedId = typeof section.meta?.linkedBlockTemplateId === 'string' ? section.meta.linkedBlockTemplateId : undefined;
  if (linkedId && templates.some(item => item.id === linkedId)) return linkedId;
  const matched = templates.find(item => blockTemplateLabel(item) === section.name || item.name === section.name || item.label === section.name);
  return matched?.id;
}

function findOptionLabel(options: OptionItem[], value?: string) {
  if (!value) return '-';
  return options.find(item => item.value === value)?.label || value;
}

export default function AdminPortalTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const [meta, setMeta] = useState<any>({});
  const [detail, setDetail] = useState<EditorTemplate | null>(null);
  const [availableBlockTemplates, setAvailableBlockTemplates] = useState<BlockTemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<PreviewSubjectOption[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [blockPickerBySection, setBlockPickerBySection] = useState<Record<string, string | undefined>>({});
  const [contractIssues, setContractIssues] = useState<string[]>([]);

  const templateTypeOptions: OptionItem[] = meta.templateTypes || [];
  const roleOptions: OptionItem[] = meta.roleKeys || [];
  const statusOptions: OptionItem[] = meta.statusOptions || [];
  const previewEntity = useMemo(() => readPreviewEntity(detail?.meta || {}), [detail?.meta]);
  const expectedPreviewEntityType = detail ? previewEntityByTemplateType[detail.templateType] : undefined;

  const validatePreviewEntityConsistency = (template: EditorTemplate) => {
    const preview = readPreviewEntity(template.meta);
    if (!preview.entityType) return null;
    const expectedType = previewEntityByTemplateType[template.templateType];
    if (!expectedType) return null;
    if (preview.entityType !== expectedType) {
      return `模板类型 ${template.templateType} 仅允许预览主体类型 ${expectedType}`;
    }
    return null;
  };

  const loadSubjectOptions = async (entityType?: string) => {
    if (!entityType) {
      setSubjectOptions([]);
      return;
    }
    setSubjectLoading(true);
    try {
      if (entityType === 'PERSON') {
        const response: any = await userApi.list();
        setSubjectOptions((response.data || []).map((item: any) => ({ value: String(item.id), label: `${item.name}${item.empNo ? ` (${item.empNo})` : ''}` })));
        return;
      }
      if (entityType === 'PRODUCT') {
        const response: any = await productApi.list({ current: 1, size: 200 });
        const records = response.data?.records || response.data || [];
        setSubjectOptions((records || []).map((item: any) => ({ value: String(item.id), label: `${item.name}${item.code ? ` (${item.code})` : ''}` })));
        return;
      }
      if (entityType === 'ORGANIZATION') {
        const response: any = await orgApi.list();
        setSubjectOptions((response.data || []).map((item: any) => ({ value: String(item.id), label: item.name })));
        return;
      }

      const objectType = entityType === 'CUSTOMER_COMPANY' ? 'CUSTOMER' : entityType;
      const response: any = await objectApi.page({ current: 1, size: 200, type: objectType });
      const records = response.data?.records || [];
      setSubjectOptions((records || []).map((item: any) => ({ value: String(item.id), label: item.name })));
    } catch (error: any) {
      message.error(error?.response?.data?.message || '预览主体加载失败');
      setSubjectOptions([]);
    } finally {
      setSubjectLoading(false);
    }
  };

  const loadPage = async (templateId: string) => {
    setLoading(true);
    try {
      const [metaResp, detailResp, blockResp] = await Promise.all([
        portalTemplateAdminApi.meta(),
        portalTemplateAdminApi.getTemplate(templateId),
        portalBlockTemplateAdminApi.listTemplates({ status: 'ACTIVE' }),
      ]);
      const rawDetail = detailResp.data || {};
      const normalized = normalizeTemplate(rawDetail);
      const issues: string[] = [];
      if (Array.isArray(rawDetail?.sections)) {
        rawDetail.sections.forEach((section: any, index: number) => {
          if (Array.isArray(section?.items) && section.items.length > 0) {
            issues.push(`分区 ${index + 1} 仍返回旧 items 结构；当前编辑器不会兼容展示，请由数据库/后端清理为 blockRefs。`);
          }
        });
      }
      setMeta(metaResp.data || {});
      setDetail(normalized);
      setAvailableBlockTemplates((blockResp.data || []).map(normalizeBlockTemplate));
      setContractIssues(issues);
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

  useEffect(() => {
    void loadSubjectOptions(previewEntity.entityType);
  }, [previewEntity.entityType]);

  const refreshDetail = async () => {
    if (id) {
      await loadPage(id);
    }
  };

  const updateDetail = (updater: (prev: EditorTemplate) => EditorTemplate) => {
    setDetail(prev => (prev ? updater(prev) : prev));
  };

  const saveTemplate = async () => {
    if (!detail?.id) return;
    const consistencyError = validatePreviewEntityConsistency(detail);
    if (consistencyError) {
      message.error(consistencyError);
      return;
    }
    try {
      setSaving(true);
      const resp: any = await portalTemplateAdminApi.updateTemplate(detail.id, buildPayload(detail));
      setDetail(normalizeTemplate(resp.data));
      message.success('模板已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '保存失败');
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

  const handleGoPreview = () => {
    if (!detail?.id) return;
    const consistencyError = validatePreviewEntityConsistency(detail);
    if (consistencyError) {
      message.error(consistencyError);
      return;
    }
    if (!previewEntity.entityType || !previewEntity.entityId) {
      message.warning('请先配置预览主体类型和预览主体');
      return;
    }
    const query = new URLSearchParams();
    query.set('entityType', previewEntity.entityType);
    query.set('entityId', previewEntity.entityId);
    nav(`/admin/portal-templates/${detail.id}/preview?${query.toString()}`);
  };

  const setPreviewMeta = (updates: { entityType?: string; entityId?: string }) => {
    updateDetail(prev => {
      const nextPreview = { ...asObject(prev.meta.previewEntity) };
      if (Object.prototype.hasOwnProperty.call(updates, 'entityType')) {
        if (updates.entityType) {
          nextPreview.entityType = updates.entityType;
        } else {
          delete nextPreview.entityType;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'entityId')) {
        if (updates.entityId) {
          nextPreview.entityId = updates.entityId;
        } else {
          delete nextPreview.entityId;
        }
      }
      const nextMeta = { ...prev.meta };
      if (nextPreview.entityType || nextPreview.entityId) {
        nextMeta.previewEntity = nextPreview;
      } else {
        delete nextMeta.previewEntity;
      }
      return { ...prev, meta: nextMeta };
    });
  };

  const availableBlockOptions = useMemo(() => availableBlockTemplates.map(item => ({
    value: item.id,
    label: `${blockTemplateLabel(item)} · ${item.code || item.dataKey}`,
  })), [availableBlockTemplates]);

  const sectionNameOptions = useMemo(() => availableBlockTemplates.map(item => ({
    value: item.id,
    label: `${blockTemplateLabel(item)} · ${item.code || item.dataKey}`,
  })), [availableBlockTemplates]);

  const templateTypeLabel = useMemo(
    () => findOptionLabel(templateTypeOptions, detail?.templateType),
    [detail?.templateType, templateTypeOptions],
  );

  const designSubjectLabel = useMemo(() => {
    if (!detail) return '-';
    if (detail.templateType === 'PERSON_ROLE') {
      return detail.positionId
        ? `岗位 · ${detail.meta.positionName || detail.positionId}`
        : `角色种子 · ${detail.roleKey || '未设置'}`;
    }
    return `对象类型 · ${templateTypeLabel}`;
  }, [detail, templateTypeLabel]);

  const statusColor = useMemo(() => {
    if (!detail) return 'default';
    return detail.status === 'ACTIVE' ? 'green' : detail.status === 'DRAFT' ? 'gold' : 'default';
  }, [detail]);

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        style={{ flex: 1, minHeight: 0 }}
        title={detail ? `模板装配设计：${detail.name}` : '模板装配设计'}
        extra={detail ? (
          <Space wrap>
            <Button onClick={() => nav('/admin/portal-templates')}>返回模板列表</Button>
            <Tag color={statusColor}>{detail.status}</Tag>
            <Button icon={<EyeOutlined />} onClick={handleGoPreview}>预览门户</Button>
            <Button onClick={() => void refreshDetail()}>重新加载</Button>
            <Button type="primary" loading={saving} onClick={() => void saveTemplate()}>保存模板</Button>
            <Popconfirm
              title={`确认删除模板「${detail.name}」？`}
              description="删除后模板下的分区与块引用会一并删除，且不可恢复。"
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
              {contractIssues.map(issue => (
                <Alert key={issue} type="warning" showIcon message="检测到旧结构残留" description={issue} />
              ))}

              <Card type="inner" title="模板基础信息">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板名称</div>
                    <Input value={detail.name} onChange={e => updateDetail(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板编码</div>
                    <Input value={detail.code} onChange={e => updateDetail(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>模板定义类型</div>
                    <Input value={templateTypeLabel} disabled />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>状态</div>
                    <Select style={{ width: '100%' }} value={detail.status} options={statusOptions} onChange={value => updateDetail(prev => ({ ...prev, status: value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>角色标识</div>
                    <Select
                      style={{ width: '100%' }}
                      allowClear
                      value={detail.roleKey}
                      options={roleOptions}
                      disabled={detail.templateType !== 'PERSON_ROLE' || Boolean(detail.positionId)}
                      onChange={value => updateDetail(prev => ({ ...prev, roleKey: value }))}
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>版本</div>
                    <InputNumber min={1} style={{ width: '100%' }} value={detail.version} onChange={value => updateDetail(prev => ({ ...prev, version: Number(value || 1) }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>设计主体</div>
                    <Input value={designSubjectLabel} disabled />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>预览主体类型</div>
                    <Select
                      style={{ width: '100%' }}
                      allowClear
                      value={previewEntity.entityType}
                      options={previewEntityTypeOptions}
                      onChange={value => setPreviewMeta({ entityType: value, entityId: undefined })}
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>预览主体</div>
                    <Select
                      style={{ width: '100%' }}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      loading={subjectLoading}
                      disabled={!previewEntity.entityType}
                      value={previewEntity.entityId}
                      options={subjectOptions}
                      placeholder={previewEntity.entityType ? '选择真实业务主体' : '先选择主体类型'}
                      onChange={value => setPreviewMeta({ entityId: value })}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: 12 }}>
                    {detail.positionId
                      ? '岗位模板仍按岗位设计；预览对象可在这里手工指定。'
                      : '对象模板与角色种子模板保留当前设计主体，同时允许手工指定预览主体。'}
                  </div>
                  <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: 12 }}>
                    {expectedPreviewEntityType ? `当前模板类型仅允许预览主体类型：${expectedPreviewEntityType}` : '当前模板类型未配置预览主体映射'}
                  </div>
                </div>
              </Card>

              <Card
                type="inner"
                title="分区装配"
                extra={<Button icon={<PlusOutlined />} onClick={() => updateDetail(prev => ({ ...prev, sections: resequenceSections([...prev.sections, createEmptySection(prev.sections.length)]) }))}>新增分区</Button>}
              >
                {!detail.sections.length ? (
                  <Empty description="当前模板还没有分区，请先新增分区并引用卡片块" />
                ) : detail.sections.map((section, sectionIndex) => {
                  const blockPickerValue = blockPickerBySection[section.id];
                  const linkedSectionNameBlockId = sectionNameLinkedBlockId(section, availableBlockTemplates);
                  const sectionNameSelectValue = linkedSectionNameBlockId || (section.name ? `__current__:${section.id}` : undefined);
                  const sectionNameSelectOptions = linkedSectionNameBlockId || !section.name
                    ? sectionNameOptions
                    : [{ value: `__current__:${section.id}`, label: `${section.name} · 当前已保存值` }, ...sectionNameOptions];
                  return (
                    <Card
                      key={section.id}
                      type="inner"
                      title={`分区 ${sectionIndex + 1}`}
                      style={{ marginBottom: 16 }}
                      extra={(
                        <Space wrap>
                          <Button
                            size="small"
                            icon={<UpOutlined />}
                            disabled={sectionIndex === 0}
                            onClick={() => updateDetail(prev => ({
                              ...prev,
                              sections: resequenceSections(moveItem(prev.sections, sectionIndex, -1)),
                            }))}
                          >
                            上移
                          </Button>
                          <Button
                            size="small"
                            icon={<DownOutlined />}
                            disabled={sectionIndex === detail.sections.length - 1}
                            onClick={() => updateDetail(prev => ({
                              ...prev,
                              sections: resequenceSections(moveItem(prev.sections, sectionIndex, 1)),
                            }))}
                          >
                            下移
                          </Button>
                          <Popconfirm
                            title={`确认删除分区「${section.name || `分区 ${sectionIndex + 1}`}」？`}
                            description="该分区下的块引用也会一并移除。"
                            okText="确认删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => updateDetail(prev => ({
                              ...prev,
                              sections: resequenceSections(prev.sections.filter((_, index) => index !== sectionIndex)),
                            }))}
                          >
                            <Button danger size="small">删除分区</Button>
                          </Popconfirm>
                        </Space>
                      )}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={{ marginBottom: 6 }}>分区编码</div>
                          <Input value={section.code} onChange={e => updateDetail(prev => ({
                            ...prev,
                            sections: prev.sections.map((item, index) => index === sectionIndex ? { ...item, code: e.target.value.toUpperCase() } : item),
                          }))} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 6 }}>分区名称</div>
                          <Select
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="label"
                            placeholder="从门户卡片管理中选择"
                            value={sectionNameSelectValue}
                            options={sectionNameSelectOptions}
                            onChange={value => {
                              if (String(value).startsWith('__current__:')) return;
                              const chosen = availableBlockTemplates.find(item => item.id === value);
                              if (!chosen) return;
                              updateDetail(prev => ({
                                ...prev,
                                sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                  ...item,
                                  name: blockTemplateLabel(chosen),
                                  meta: {
                                    ...item.meta,
                                    linkedBlockTemplateId: chosen.id,
                                  },
                                } : item),
                              }));
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 6 }}>分区类型</div>
                          <Input value="BLOCK" disabled />
                        </div>
                        <div>
                          <div style={{ marginBottom: 6 }}>排序</div>
                          <InputNumber min={0} style={{ width: '100%' }} value={section.sortOrder} onChange={value => updateDetail(prev => ({
                            ...prev,
                            sections: prev.sections.map((item, index) => index === sectionIndex ? { ...item, sortOrder: Number(value || 0) } : item),
                          }))} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <Space>
                          <SortAscendingOutlined />
                          <Text strong>块引用装配</Text>
                          <Text type="secondary">选择 ACTIVE 卡片块加入当前分区</Text>
                        </Space>
                        <Space wrap>
                          <Select
                            style={{ minWidth: 320 }}
                            showSearch
                            optionFilterProp="label"
                            value={blockPickerValue}
                            placeholder="选择一个 ACTIVE 卡片块"
                            options={availableBlockOptions.filter(option => !section.blockRefs.some(ref => ref.blockTemplateId === option.value))}
                            onChange={value => setBlockPickerBySection(prev => ({ ...prev, [section.id]: value }))}
                          />
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            disabled={!blockPickerValue}
                            onClick={() => {
                              const chosen = availableBlockTemplates.find(item => item.id === blockPickerValue);
                              if (!chosen) return;
                              updateDetail(prev => ({
                                ...prev,
                                sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                  ...item,
                                  blockRefs: resequenceBlockRefs([
                                    ...item.blockRefs,
                                    {
                                      id: localId('block-ref'),
                                      blockTemplateId: chosen.id,
                                      sortOrder: (item.blockRefs.length + 1) * 10,
                                      enabled: true,
                                      overrideMeta: {},
                                      blockTemplate: chosen,
                                    },
                                  ]),
                                } : item),
                              }));
                              setBlockPickerBySection(prev => ({ ...prev, [section.id]: undefined }));
                            }}
                          >
                            引用到本分区
                          </Button>
                        </Space>
                      </div>

                      {!section.blockRefs.length ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该分区还没有引用块" />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {section.blockRefs.map((blockRef, blockIndex) => {
                            const blockTemplate = blockRef.blockTemplate || availableBlockTemplates.find(item => item.id === blockRef.blockTemplateId);
                            return (
                              <Card key={blockRef.id} size="small" className="portal-block-ref-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
                                    <Space wrap>
                                      <Tag color={blockRef.enabled ? 'green' : 'default'}>{blockRef.enabled ? '启用中' : '已停用'}</Tag>
                                      <Tag>{blockTemplate?.displayType || 'UNKNOWN'}</Tag>
                                      <Tag>{blockTemplate?.dataKey || blockRef.blockTemplateId}</Tag>
                                    </Space>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                                      {blockTemplateLabel(blockTemplate)}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 12 }}>
                                      {blockTemplate?.code || blockRef.blockTemplateId}
                                    </div>
                                    <div style={{ color: '#475569', fontSize: 12 }}>
                                      该引用会沿用卡片块定义中的展示类型、数据键和动作配置，不在模板页内直接改写。
                                    </div>
                                  </div>

                                  <Space wrap align="center">
                                    <span style={{ color: '#64748b', fontSize: 12 }}>启用</span>
                                    <Switch
                                      size="small"
                                      checked={blockRef.enabled}
                                      onChange={checked => updateDetail(prev => ({
                                        ...prev,
                                        sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                          ...item,
                                          blockRefs: item.blockRefs.map((ref, refIndex) => refIndex === blockIndex ? { ...ref, enabled: checked } : ref),
                                        } : item),
                                      }))}
                                    />
                                    <Button
                                      size="small"
                                      icon={<UpOutlined />}
                                      disabled={blockIndex === 0}
                                      onClick={() => updateDetail(prev => ({
                                        ...prev,
                                        sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                          ...item,
                                          blockRefs: resequenceBlockRefs(moveItem(item.blockRefs, blockIndex, -1)),
                                        } : item),
                                      }))}
                                    >
                                      上移
                                    </Button>
                                    <Button
                                      size="small"
                                      icon={<DownOutlined />}
                                      disabled={blockIndex === section.blockRefs.length - 1}
                                      onClick={() => updateDetail(prev => ({
                                        ...prev,
                                        sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                          ...item,
                                          blockRefs: resequenceBlockRefs(moveItem(item.blockRefs, blockIndex, 1)),
                                        } : item),
                                      }))}
                                    >
                                      下移
                                    </Button>
                                    <Popconfirm
                                      title={`确认移除块「${blockTemplateLabel(blockTemplate)}」？`}
                                      description="移除后该模板分区将不再引用这个卡片块。"
                                      okText="确认移除"
                                      cancelText="取消"
                                      okButtonProps={{ danger: true }}
                                      onConfirm={() => updateDetail(prev => ({
                                        ...prev,
                                        sections: prev.sections.map((item, index) => index === sectionIndex ? {
                                          ...item,
                                          blockRefs: resequenceBlockRefs(item.blockRefs.filter((_, refIndex) => refIndex !== blockIndex)),
                                        } : item),
                                      }))}
                                    >
                                      <Button danger size="small" icon={<DeleteOutlined />}>移除</Button>
                                    </Popconfirm>
                                  </Space>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
