import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowNodeFeatureApi, type WorkflowNodeFeatureStatus } from '../../api';

const { Text } = Typography;

type FieldItem = {
  id?: string;
  fieldKey: string;
  label: string;
  dataType: string;
  required: boolean;
  fieldScope: 'INPUT' | 'OUTPUT';
  sortOrder: number;
  defaultValueText: string;
  validatorsText: string;
};

type BindingRule = {
  key: string;
  assigneesText: string;
};

type FeatureDetail = {
  id?: string;
  code: string;
  name: string;
  sourceModuleId?: string;
  sourceSystem: string;
  nodeType: string;
  version: number;
  sortOrder: number;
  positionKey?: string;
  roleKey?: string;
  status: WorkflowNodeFeatureStatus;
};

function jsonText(value: any) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonText(text: string, label: string) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function splitCsv(text: string) {
  return String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminWorkflowNodeFeatureEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const isCreate = !id || id === 'new';
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<FeatureDetail>({
    code: '',
    name: '',
    sourceSystem: 'MICRO_OFFICE',
    nodeType: '',
    version: 1,
    sortOrder: 100,
    positionKey: '',
    roleKey: '',
    status: 'DISABLED',
  });
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [positionBindings, setPositionBindings] = useState<BindingRule[]>([]);
  const [roleBindings, setRoleBindings] = useState<BindingRule[]>([]);
  const [defaultAssigneesText, setDefaultAssigneesText] = useState('');
  const [actionPermissionsText, setActionPermissionsText] = useState('');
  const [slaMinutes, setSlaMinutes] = useState<number | undefined>();
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number | undefined>();
  const [triggersText, setTriggersText] = useState('{\n  "onEnter": [],\n  "onComplete": []\n}');
  const [references, setReferences] = useState<any[]>([]);
  const [resolvedAssignment, setResolvedAssignment] = useState<any>(null);

  const inputFields = useMemo(() => fields.filter((item) => item.fieldScope === 'INPUT').sort((a, b) => a.sortOrder - b.sortOrder), [fields]);
  const outputFields = useMemo(() => fields.filter((item) => item.fieldScope === 'OUTPUT').sort((a, b) => a.sortOrder - b.sortOrder), [fields]);

  const loadPage = async () => {
    if (isCreate) return;
    try {
      const [detailResp, fieldsResp, behaviorResp, referenceResp]: any = await Promise.all([
        workflowNodeFeatureApi.detail(id!),
        workflowNodeFeatureApi.listFields(id!),
        workflowNodeFeatureApi.getBehaviors(id!),
        workflowNodeFeatureApi.references(id!),
      ]);

      const feature = detailResp.data || {};
      setDetail({
        id: feature.id,
        code: feature.code || '',
        name: feature.name || '',
        sourceModuleId: feature.sourceModuleId || '',
        sourceSystem: feature.sourceSystem || 'MICRO_OFFICE',
        nodeType: feature.nodeType || '',
        version: Number(feature.version || 1),
        sortOrder: Number(feature.sortOrder || 100),
        positionKey: feature.positionKey || '',
        roleKey: feature.roleKey || '',
        status: (feature.status || 'DISABLED') as WorkflowNodeFeatureStatus,
      });

      const contractFields = (fieldsResp.data || []).map((item: any) => ({
        id: item.id,
        fieldKey: item.fieldKey || '',
        label: item.label || '',
        dataType: item.dataType || 'string',
        required: Boolean(item.required),
        fieldScope: item.fieldScope === 'OUTPUT' ? 'OUTPUT' : 'INPUT',
        sortOrder: Number(item.sortOrder || 100),
        defaultValueText: item.defaultValue === undefined ? '' : JSON.stringify(item.defaultValue),
        validatorsText: JSON.stringify(item.schemaMeta?.validators || [], null, 2),
      }));
      setFields(contractFields);

      const behavior = behaviorResp.data?.behavior || {};
      const assignment = behavior.assignment || {};
      setPositionBindings(
        Object.entries(assignment.positionBindings || {}).map(([key, value]: any) => ({
          key,
          assigneesText: (value?.assignees || []).join(','),
        })),
      );
      setRoleBindings(
        Object.entries(assignment.roleBindings || {}).map(([key, value]: any) => ({
          key,
          assigneesText: (value?.assignees || []).join(','),
        })),
      );
      setDefaultAssigneesText((assignment.defaultAssignees || []).join(','));
      setActionPermissionsText((behavior.actionPermissions || []).join(','));
      setSlaMinutes(behavior.sla?.slaMinutes);
      setRemindBeforeMinutes(behavior.sla?.remindBeforeMinutes);
      setTriggersText(jsonText(behavior.triggers || { onEnter: [], onComplete: [] }));
      setResolvedAssignment(behaviorResp.data?.resolvedAssignment || null);
      setReferences(referenceResp.data?.items || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点功能加载失败');
      nav('/admin/workflow-node-features');
    }
  };

  useEffect(() => {
    void loadPage();
  }, [id]);

  const saveBase = async () => {
    const payload = {
      code: detail.code.trim(),
      name: detail.name.trim(),
      sourceModuleId: detail.sourceModuleId?.trim() || undefined,
      sourceSystem: detail.sourceSystem.trim() || 'MICRO_OFFICE',
      nodeType: detail.nodeType.trim(),
      version: Number(detail.version || 1),
      sortOrder: Number(detail.sortOrder || 100),
      positionKey: detail.positionKey?.trim() || undefined,
      roleKey: detail.roleKey?.trim() || undefined,
    };
    if (!payload.code || !payload.name || !payload.nodeType) {
      throw new Error('节点编码 / 节点名称 / 节点类型 不能为空');
    }
    if (isCreate) {
      const response: any = await workflowNodeFeatureApi.create(payload);
      return response.data;
    }
    const response: any = await workflowNodeFeatureApi.update(id!, payload);
    return response.data;
  };

  const saveFields = async (featureId: string) => {
    const payload = fields.map((item) => ({
      id: item.id,
      fieldKey: item.fieldKey.trim(),
      label: item.label.trim(),
      dataType: item.dataType,
      required: item.required,
      fieldScope: item.fieldScope,
      sortOrder: Number(item.sortOrder || 100),
      defaultValue: item.defaultValueText.trim() ? JSON.parse(item.defaultValueText) : null,
      schemaMeta: {
        validators: item.validatorsText.trim() ? JSON.parse(item.validatorsText) : [],
      },
    }));
    await workflowNodeFeatureApi.saveFields(featureId, payload);
  };

  const saveBehaviors = async (featureId: string) => {
    const toRuleMap = (items: BindingRule[]) =>
      items.reduce((acc, item) => {
        const key = item.key.trim();
        if (!key) return acc;
        acc[key] = { assignees: splitCsv(item.assigneesText) };
        return acc;
      }, {} as Record<string, { assignees: string[] }>);

    await workflowNodeFeatureApi.saveBehaviors(featureId, {
      assignment: {
        positionBindings: toRuleMap(positionBindings),
        roleBindings: toRuleMap(roleBindings),
        defaultAssignees: splitCsv(defaultAssigneesText),
      },
      sla: {
        slaMinutes: slaMinutes ?? null,
        remindBeforeMinutes: remindBeforeMinutes ?? null,
      },
      actionPermissions: splitCsv(actionPermissionsText),
      triggers: parseJsonText(triggersText, '触发配置'),
    });
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const savedFeature = await saveBase();
      const featureId = String(savedFeature.id || id);
      await saveFields(featureId);
      await saveBehaviors(featureId);
      if (detail.status !== (savedFeature.status || detail.status)) {
        await workflowNodeFeatureApi.updateStatus(featureId, detail.status);
      }
      message.success('节点功能已保存');
      if (isCreate) {
        nav(`/admin/workflow-node-features/${featureId}`);
        return;
      }
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: WorkflowNodeFeatureStatus) => {
    if (isCreate || !id) {
      setDetail((prev) => ({ ...prev, status }));
      return;
    }
    try {
      await workflowNodeFeatureApi.updateStatus(id, status);
      setDetail((prev) => ({ ...prev, status }));
      message.success(status === 'ACTIVE' ? '已启用（ACTIVE）' : '已停用（DISABLED）');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态切换失败');
    }
  };

  const addField = (fieldScope: 'INPUT' | 'OUTPUT') => {
    setFields((prev) => [
      ...prev,
      {
        fieldKey: '',
        label: '',
        dataType: 'string',
        required: false,
        fieldScope,
        sortOrder: prev.length + 100,
        defaultValueText: '',
        validatorsText: '[]',
      },
    ]);
  };

  const updateField = (index: number, updater: (field: FieldItem) => FieldItem) => {
    setFields((prev) => prev.map((item, idx) => (idx === index ? updater(item) : item)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addBinding = (type: 'position' | 'role') => {
    const next = { key: '', assigneesText: '' };
    if (type === 'position') {
      setPositionBindings((prev) => [...prev, next]);
      return;
    }
    setRoleBindings((prev) => [...prev, next]);
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title={isCreate ? '新建节点功能' : `编辑节点功能：${detail.name || detail.code || id}`}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/admin/workflow-node-features')}>
              返回列表
            </Button>
            {!isCreate ? (
              <Button icon={<ReloadOutlined />} onClick={() => void loadPage()}>
                重载
              </Button>
            ) : null}
            {detail.status === 'ACTIVE' ? (
              <Button onClick={() => void updateStatus('DISABLED')}>停用（DISABLED）</Button>
            ) : (
              <Button onClick={() => void updateStatus('ACTIVE')}>启用（ACTIVE）</Button>
            )}
            <Button type="primary" loading={saving} onClick={() => void saveAll()}>
              保存
            </Button>
          </Space>
        }
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}
      >
        <div className="page-card-scroll">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <Input value={detail.code} placeholder="节点编码" onChange={(e) => setDetail((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                <Input value={detail.name} placeholder="节点名称" onChange={(e) => setDetail((prev) => ({ ...prev, name: e.target.value }))} />
                <Input value={detail.nodeType} placeholder="节点类型" onChange={(e) => setDetail((prev) => ({ ...prev, nodeType: e.target.value.toUpperCase() }))} />
                <Input value={detail.sourceSystem} placeholder="来源系统" onChange={(e) => setDetail((prev) => ({ ...prev, sourceSystem: e.target.value.toUpperCase() }))} />
                <InputNumber min={1} style={{ width: '100%' }} value={detail.version} placeholder="版本" onChange={(value) => setDetail((prev) => ({ ...prev, version: Number(value || 1) }))} />
                <InputNumber min={0} style={{ width: '100%' }} value={detail.sortOrder} placeholder="排序值" onChange={(value) => setDetail((prev) => ({ ...prev, sortOrder: Number(value || 0) }))} />
                <Input value={detail.positionKey} placeholder="岗位标识" onChange={(e) => setDetail((prev) => ({ ...prev, positionKey: e.target.value }))} />
                <Input value={detail.roleKey} placeholder="角色标识" onChange={(e) => setDetail((prev) => ({ ...prev, roleKey: e.target.value }))} />
              </div>
              <div style={{ marginTop: 10 }}>
                <Tag color={detail.status === 'ACTIVE' ? 'green' : 'default'}>{detail.status}</Tag>
              </div>
            </Card>

            <Card
              size="small"
              title="字段契约"
              extra={
                <Space>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => addField('INPUT')}>
                    输入字段
                  </Button>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => addField('OUTPUT')}>
                    输出字段
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Text strong>输入字段</Text>
                  <Table
                    size="small"
                    rowKey={(_, index) => `input-${index}`}
                    pagination={false}
                    dataSource={inputFields}
                    locale={{ emptyText: '暂无输入字段' }}
                    columns={[
                      {
                        title: '字段键',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.fieldKey} onChange={(e) => updateField(index, (item) => ({ ...item, fieldKey: e.target.value }))} />;
                        },
                      },
                      {
                        title: '标签',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.label} onChange={(e) => updateField(index, (item) => ({ ...item, label: e.target.value }))} />;
                        },
                      },
                      {
                        title: '类型',
                        width: 120,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return (
                            <Select
                              value={row.dataType}
                              style={{ width: '100%' }}
                              options={['string', 'number', 'boolean', 'list', 'json'].map((item) => ({ value: item, label: item }))}
                              onChange={(value) => updateField(index, (field) => ({ ...field, dataType: value }))}
                            />
                          );
                        },
                      },
                      {
                        title: '必填',
                        width: 80,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Select style={{ width: '100%' }} value={row.required ? 'Y' : 'N'} options={[{ value: 'Y', label: '是' }, { value: 'N', label: '否' }]} onChange={(value) => updateField(index, (field) => ({ ...field, required: value === 'Y' }))} />;
                        },
                      },
                      {
                        title: '默认值',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.defaultValueText} onChange={(e) => updateField(index, (field) => ({ ...field, defaultValueText: e.target.value }))} />;
                        },
                      },
                      {
                        title: '校验规则',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          const validators = row.validatorsText.trim() ? row.validatorsText : '[]';
                          return <Input value={validators} onChange={(e) => updateField(index, (field) => ({ ...field, validatorsText: e.target.value }))} />;
                        },
                      },
                      {
                        title: '排序',
                        width: 90,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <InputNumber min={0} style={{ width: '100%' }} value={row.sortOrder} onChange={(value) => updateField(index, (field) => ({ ...field, sortOrder: Number(value || 0) }))} />;
                        },
                      },
                      {
                        title: '操作',
                        width: 72,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Button danger size="small" onClick={() => removeField(index)}>删</Button>;
                        },
                      },
                    ]}
                  />
                </div>

                <Divider style={{ margin: 0 }} />

                <div>
                  <Text strong>输出字段</Text>
                  <Table
                    size="small"
                    rowKey={(_, index) => `output-${index}`}
                    pagination={false}
                    dataSource={outputFields}
                    locale={{ emptyText: '暂无输出字段' }}
                    columns={[
                      {
                        title: '字段键',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.fieldKey} onChange={(e) => updateField(index, (item) => ({ ...item, fieldKey: e.target.value }))} />;
                        },
                      },
                      {
                        title: '标签',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.label} onChange={(e) => updateField(index, (item) => ({ ...item, label: e.target.value }))} />;
                        },
                      },
                      {
                        title: '类型',
                        width: 120,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return (
                            <Select
                              value={row.dataType}
                              style={{ width: '100%' }}
                              options={['string', 'number', 'boolean', 'list', 'json'].map((item) => ({ value: item, label: item }))}
                              onChange={(value) => updateField(index, (field) => ({ ...field, dataType: value }))}
                            />
                          );
                        },
                      },
                      {
                        title: '必填',
                        width: 80,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Select style={{ width: '100%' }} value={row.required ? 'Y' : 'N'} options={[{ value: 'Y', label: '是' }, { value: 'N', label: '否' }]} onChange={(value) => updateField(index, (field) => ({ ...field, required: value === 'Y' }))} />;
                        },
                      },
                      {
                        title: '默认值',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.defaultValueText} onChange={(e) => updateField(index, (field) => ({ ...field, defaultValueText: e.target.value }))} />;
                        },
                      },
                      {
                        title: '校验规则',
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Input value={row.validatorsText.trim() ? row.validatorsText : '[]'} onChange={(e) => updateField(index, (field) => ({ ...field, validatorsText: e.target.value }))} />;
                        },
                      },
                      {
                        title: '排序',
                        width: 90,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <InputNumber min={0} style={{ width: '100%' }} value={row.sortOrder} onChange={(value) => updateField(index, (field) => ({ ...field, sortOrder: Number(value || 0) }))} />;
                        },
                      },
                      {
                        title: '操作',
                        width: 72,
                        render: (_: unknown, row: FieldItem) => {
                          const index = fields.indexOf(row);
                          return <Button danger size="small" onClick={() => removeField(index)}>删</Button>;
                        },
                      },
                    ]}
                  />
                </div>
              </Space>
            </Card>

            <Card size="small" title="行为配置">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <Text strong>岗位优先指派</Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => addBinding('position')}>
                      增加岗位规则
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey={(_, index) => `position-${index}`}
                    pagination={false}
                    dataSource={positionBindings}
                    locale={{ emptyText: '暂无岗位指派规则' }}
                    columns={[
                      {
                        title: '岗位标识',
                        render: (_: unknown, row: BindingRule, index: number) => (
                          <Input value={row.key} onChange={(e) => setPositionBindings((prev) => prev.map((item, idx) => (idx === index ? { ...item, key: e.target.value } : item)))} />
                        ),
                      },
                      {
                        title: '指派人',
                        render: (_: unknown, row: BindingRule, index: number) => (
                          <Input placeholder="userA,userB" value={row.assigneesText} onChange={(e) => setPositionBindings((prev) => prev.map((item, idx) => (idx === index ? { ...item, assigneesText: e.target.value } : item)))} />
                        ),
                      },
                      {
                        title: '操作',
                        width: 72,
                        render: (_: unknown, __: BindingRule, index: number) => <Button danger size="small" onClick={() => setPositionBindings((prev) => prev.filter((_, idx) => idx !== index))}>删</Button>,
                      },
                    ]}
                  />
                </div>

                <div>
                  <Space style={{ marginBottom: 8 }}>
                    <Text strong>角色兜底</Text>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => addBinding('role')}>
                      增加角色规则
                    </Button>
                  </Space>
                  <Table
                    size="small"
                    rowKey={(_, index) => `role-${index}`}
                    pagination={false}
                    dataSource={roleBindings}
                    locale={{ emptyText: '暂无角色兜底规则' }}
                    columns={[
                      {
                        title: '角色标识',
                        render: (_: unknown, row: BindingRule, index: number) => (
                          <Input value={row.key} onChange={(e) => setRoleBindings((prev) => prev.map((item, idx) => (idx === index ? { ...item, key: e.target.value.toUpperCase() } : item)))} />
                        ),
                      },
                      {
                        title: '指派人',
                        render: (_: unknown, row: BindingRule, index: number) => (
                          <Input placeholder="userA,userB" value={row.assigneesText} onChange={(e) => setRoleBindings((prev) => prev.map((item, idx) => (idx === index ? { ...item, assigneesText: e.target.value } : item)))} />
                        ),
                      },
                      {
                        title: '操作',
                        width: 72,
                        render: (_: unknown, __: BindingRule, index: number) => <Button danger size="small" onClick={() => setRoleBindings((prev) => prev.filter((_, idx) => idx !== index))}>删</Button>,
                      },
                    ]}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Input value={defaultAssigneesText} placeholder="默认兜底指派 userA,userB" onChange={(e) => setDefaultAssigneesText(e.target.value)} />
                  <InputNumber min={0} style={{ width: '100%' }} value={slaMinutes} placeholder="SLA 时长（分钟）" onChange={(value) => setSlaMinutes(value === null ? undefined : Number(value))} />
                  <InputNumber min={0} style={{ width: '100%' }} value={remindBeforeMinutes} placeholder="提前提醒（分钟）" onChange={(value) => setRemindBeforeMinutes(value === null ? undefined : Number(value))} />
                </div>
                <Input value={actionPermissionsText} placeholder="动作白名单，逗号分隔" onChange={(e) => setActionPermissionsText(e.target.value)} />
                <Input.TextArea rows={5} value={triggersText} placeholder="触发配置(JSON)" onChange={(e) => setTriggersText(e.target.value)} />
                {resolvedAssignment ? (
                  <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                    <Text strong>解析预览</Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag color="blue">{resolvedAssignment.hitLevel || 'DEFAULT'}</Tag>
                      <Tag>{resolvedAssignment.hitKey || 'DEFAULT'}</Tag>
                      {(resolvedAssignment.assignees || []).map((item: string) => <Tag key={item}>{item}</Tag>)}
                    </div>
                  </div>
                ) : null}
              </Space>
            </Card>

            <Card size="small" title="模板引用关系">
              {references.length ? (
                <Table
                  size="small"
                  rowKey={(row) => `${row.templatePackageId}-${row.templateNodeId}`}
                  pagination={false}
                  dataSource={references}
                  columns={[
                    { title: '模板包', dataIndex: 'templatePackageName' },
                    { title: '模板状态', dataIndex: 'templatePackageStatus', render: (value: string) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value}</Tag> },
                    { title: '节点', dataIndex: 'displayName' },
                    { title: '关系', dataIndex: 'relationType' },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前节点功能尚未被模板引用" />
              )}
            </Card>
          </Space>
        </div>
      </Card>
    </div>
  );
}
