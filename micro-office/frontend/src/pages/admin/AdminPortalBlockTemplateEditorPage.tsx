import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Popconfirm, Select, Space, Spin, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  portalBlockTemplateAdminApi,
  portalTemplateAdminApi,
  type PortalBlockTemplateActionPayload,
  type PortalBlockTemplatePayload,
  type PortalBlockTemplateStatus,
} from '../../api';

const { TextArea } = Input;

type EditorAction = {
  id: string;
  actionType: string;
  targetSubjectType?: string;
  targetIdPath?: string;
  sessionType?: string;
  metaText: string;
};

type EditorBlockTemplate = {
  id?: string;
  code: string;
  name: string;
  status: PortalBlockTemplateStatus;
  displayType: string;
  dataKey: string;
  label: string;
  metaText: string;
  actions: EditorAction[];
};

function localId(prefix: string) {
  return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function prettyJson(value: any) {
  return JSON.stringify(value || {}, null, 2);
}

function parseJson(text: string, label: string) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function normalizeAction(action: any): EditorAction {
  return {
    id: action?.id || localId('action'),
    actionType: action?.actionType || 'open_workbench_session',
    targetSubjectType: action?.targetSubjectType || undefined,
    targetIdPath: action?.targetIdPath || undefined,
    sessionType: action?.sessionType || undefined,
    metaText: prettyJson(action?.meta),
  };
}

function normalizeTemplate(detail?: any): EditorBlockTemplate {
  return {
    id: detail?.id,
    code: detail?.code || '',
    name: detail?.name || '',
    status: detail?.status || 'DRAFT',
    displayType: detail?.displayType || 'LIST',
    dataKey: detail?.dataKey || '',
    label: detail?.label || '',
    metaText: prettyJson(detail?.meta),
    actions: Array.isArray(detail?.actions) ? detail.actions.map(normalizeAction) : [],
  };
}

function createEmptyAction(): EditorAction {
  return {
    id: localId('action'),
    actionType: 'open_workbench_session',
    targetSubjectType: undefined,
    targetIdPath: undefined,
    sessionType: undefined,
    metaText: prettyJson({}),
  };
}

function buildPayload(detail: EditorBlockTemplate): PortalBlockTemplatePayload {
  return {
    code: detail.code.trim().toUpperCase(),
    name: detail.name.trim(),
    status: detail.status,
    displayType: detail.displayType,
    dataKey: detail.dataKey.trim(),
    label: detail.label.trim(),
    meta: parseJson(detail.metaText, '卡片块 meta'),
    actions: detail.actions.map((action): PortalBlockTemplateActionPayload => ({
      id: action.id.startsWith('tmp-') ? undefined : action.id,
      actionType: action.actionType,
      targetSubjectType: action.targetSubjectType || null,
      targetIdPath: action.targetIdPath || null,
      sessionType: action.sessionType || null,
      meta: parseJson(action.metaText, `动作 ${action.actionType || action.id} meta`),
    })),
  };
}

export default function AdminPortalBlockTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const isCreate = !id || id === 'new';
  const [meta, setMeta] = useState<any>({});
  const [detail, setDetail] = useState<EditorBlockTemplate | null>(null);
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayTypeOptions = useMemo(() => meta.displayTypes || [], [meta]);
  const actionTypeOptions = useMemo(() => meta.actionTypes || [], [meta]);
  const subjectTypeOptions = useMemo(() => meta.subjectTypes || [], [meta]);
  const sessionTypeOptions = useMemo(() => meta.sessionTypes || [], [meta]);
  const statusOptions = useMemo(() => ([
    { value: 'DRAFT', label: 'DRAFT' },
    { value: 'ACTIVE', label: 'ACTIVE' },
    { value: 'INACTIVE', label: 'INACTIVE' },
  ]), []);

  const loadPage = async () => {
    setLoading(true);
    try {
      const metaResp: any = await portalTemplateAdminApi.meta();
      setMeta(metaResp.data || {});
      if (isCreate) {
        setDetail(normalizeTemplate({ code: 'MESSAGE_CENTER', name: '消息中心', label: '消息中心', dataKey: 'message_center', displayType: 'LIST' }));
        setReferences([]);
        return;
      }
      const [detailResp, refResp] = await Promise.all([
        portalBlockTemplateAdminApi.getTemplate(id!),
        portalBlockTemplateAdminApi.references(id!).catch(() => ({ data: [] })),
      ]);
      setDetail(normalizeTemplate(detailResp.data));
      setReferences(refResp.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '卡片块加载失败');
      nav('/admin/portal-block-templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [id]);

  const updateDetail = (updater: (prev: EditorBlockTemplate) => EditorBlockTemplate) => {
    setDetail((prev) => (prev ? updater(prev) : prev));
  };

  const save = async () => {
    if (!detail) return;
    try {
      setSaving(true);
      const payload = buildPayload(detail);
      const resp: any = isCreate
        ? await portalBlockTemplateAdminApi.createTemplate(payload)
        : await portalBlockTemplateAdminApi.updateTemplate(detail.id!, payload);
      message.success(isCreate ? '卡片块已创建' : '卡片块已保存');
      if (resp.data?.id && resp.data?.id !== id) {
        nav(`/admin/portal-block-templates/${resp.data.id}`);
        return;
      }
      setDetail(normalizeTemplate(resp.data));
    } catch (error: any) {
      message.error(error?.message || error?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title={detail ? `${isCreate ? '新建' : '编辑'}卡片块：${detail.name || detail.code || '未命名卡片块'}` : '卡片块编辑'}
        extra={(
          <Space wrap>
            <Button onClick={() => nav('/admin/portal-block-templates')}>返回列表</Button>
            {detail ? <Tag color={detail.status === 'ACTIVE' ? 'green' : detail.status === 'DRAFT' ? 'gold' : 'default'}>{detail.status}</Tag> : null}
            <Button onClick={() => void loadPage()}>重新加载</Button>
            <Button type="primary" loading={saving} onClick={() => void save()}>保存卡片块</Button>
          </Space>
        )}
        bodyStyle={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        {loading ? (
          <div className="page-fill" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <Empty description="卡片块不存在或正在加载" />
        ) : (
          <div className="page-card-scroll" style={{ paddingRight: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card type="inner" title="基础信息">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>卡片块编码</div>
                    <Input value={detail.code} onChange={(e) => updateDetail((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>卡片块名称</div>
                    <Input value={detail.name} onChange={(e) => updateDetail((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>状态</div>
                    <Select style={{ width: '100%' }} value={detail.status} options={statusOptions} onChange={(value) => updateDetail((prev) => ({ ...prev, status: value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>展示类型</div>
                    <Select style={{ width: '100%' }} value={detail.displayType} options={displayTypeOptions} onChange={(value) => updateDetail((prev) => ({ ...prev, displayType: value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>数据键</div>
                    <Input value={detail.dataKey} onChange={(e) => updateDetail((prev) => ({ ...prev, dataKey: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>标题</div>
                    <Input value={detail.label} onChange={(e) => updateDetail((prev) => ({ ...prev, label: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ marginBottom: 6 }}>卡片块 Meta(JSON)</div>
                    <TextArea rows={6} value={detail.metaText} onChange={(e) => updateDetail((prev) => ({ ...prev, metaText: e.target.value }))} />
                  </div>
                </div>
              </Card>

              <Card
                type="inner"
                title="动作列表"
                extra={<Button size="small" icon={<PlusOutlined />} onClick={() => updateDetail((prev) => ({ ...prev, actions: [...prev.actions, createEmptyAction()] }))}>新增动作</Button>}
              >
                {!detail.actions.length ? (
                  <Empty description="当前卡片块暂无动作" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : detail.actions.map((action, index) => (
                  <Card
                    key={action.id}
                    type="inner"
                    size="small"
                    title={`动作 ${index + 1}`}
                    style={{ marginBottom: 12 }}
                    extra={(
                      <Popconfirm
                        title="确认删除该动作？"
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => updateDetail((prev) => ({ ...prev, actions: prev.actions.filter((_, actionIndex) => actionIndex !== index) }))}
                      >
                        <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    )}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                      <div>
                        <div style={{ marginBottom: 6 }}>动作类型</div>
                        <Select
                          style={{ width: '100%' }}
                          value={action.actionType}
                          options={actionTypeOptions}
                          onChange={(value) => updateDetail((prev) => ({
                            ...prev,
                            actions: prev.actions.map((item, actionIndex) => (actionIndex === index ? { ...item, actionType: value } : item)),
                          }))}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>目标主体类型</div>
                        <Select
                          style={{ width: '100%' }}
                          allowClear
                          value={action.targetSubjectType}
                          options={subjectTypeOptions}
                          onChange={(value) => updateDetail((prev) => ({
                            ...prev,
                            actions: prev.actions.map((item, actionIndex) => (actionIndex === index ? { ...item, targetSubjectType: value } : item)),
                          }))}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>目标 ID 路径</div>
                        <Input
                          value={action.targetIdPath}
                          onChange={(e) => updateDetail((prev) => ({
                            ...prev,
                            actions: prev.actions.map((item, actionIndex) => (actionIndex === index ? { ...item, targetIdPath: e.target.value } : item)),
                          }))}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 6 }}>会话类型</div>
                        <Select
                          style={{ width: '100%' }}
                          allowClear
                          value={action.sessionType}
                          options={sessionTypeOptions}
                          onChange={(value) => updateDetail((prev) => ({
                            ...prev,
                            actions: prev.actions.map((item, actionIndex) => (actionIndex === index ? { ...item, sessionType: value } : item)),
                          }))}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ marginBottom: 6 }}>动作 Meta(JSON)</div>
                        <TextArea
                          rows={4}
                          value={action.metaText}
                          onChange={(e) => updateDetail((prev) => ({
                            ...prev,
                            actions: prev.actions.map((item, actionIndex) => (actionIndex === index ? { ...item, metaText: e.target.value } : item)),
                          }))}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </Card>

              <Card type="inner" title="引用信息">
                {!references.length ? (
                  <Empty description="当前卡片块暂无引用或后端尚未返回引用信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {references.map((item, index) => (
                      <div key={item.id || `${item.templateId || 'ref'}-${index}`} style={{ padding: 12, border: '1px solid #eef2f7', borderRadius: 12 }}>
                        <div style={{ fontWeight: 700 }}>{item.templateName || item.templateCode || '未命名模板'}</div>
                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                          {item.sectionName || item.sectionCode || '未命名分区'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
