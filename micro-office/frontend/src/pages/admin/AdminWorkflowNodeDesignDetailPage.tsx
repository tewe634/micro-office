import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  WorkflowNodeFieldSavePayload,
  WorkflowTemplateFieldDefinition,
  WorkflowTemplateNodeRecommendationPayload,
  WorkflowTemplatePackageSummary,
} from '../../api';
import { workflowNodeDesignApi, workflowTemplateApi } from '../../api';

function normalizeRecommendation(item: Partial<WorkflowTemplateNodeRecommendationPayload>): WorkflowTemplateNodeRecommendationPayload {
  return {
    recommendedWorkflowTemplateId: String(item.recommendedWorkflowTemplateId || ''),
    recommendedWorkflowTemplateName: item.recommendedWorkflowTemplateName || undefined,
    recommendedWorkflowTemplateStatus: item.recommendedWorkflowTemplateStatus || undefined,
    reason: item.reason || undefined,
    displayOrder: Number(item.displayOrder ?? 100),
    enabled: item.enabled !== false,
  };
}

function createFieldDraft(sortOrder: number): WorkflowNodeFieldSavePayload {
  return {
    fieldKey: '',
    required: false,
    readOnly: false,
    sortOrder,
  };
}

export default function AdminWorkflowNodeDesignDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const nodeId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<WorkflowTemplateFieldDefinition[]>([]);
  const [workflowTemplateOptions, setWorkflowTemplateOptions] = useState<WorkflowTemplatePackageSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();

  const loadSharedOptions = async () => {
    const [fieldResponse, packageResponse]: any = await Promise.all([
      workflowTemplateApi.listFieldDefinitions({ enabled: true }),
      workflowTemplateApi.listPackages(),
    ]);
    setFieldDefinitions(Array.isArray(fieldResponse.data) ? fieldResponse.data : fieldResponse.data?.records || []);
    setWorkflowTemplateOptions(Array.isArray(packageResponse.data) ? packageResponse.data : packageResponse.data?.records || []);
  };

  const loadDetail = async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const response: any = await workflowNodeDesignApi.detail(nodeId);
      const next = response.data || null;
      setDetail(next);
      form.setFieldsValue({
        moduleDefinitionId: next?.moduleDefinitionId,
        name: next?.name,
        code: next?.code,
        nodeType: next?.nodeType,
        version: next?.version ?? 1,
      });
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点详情加载失败');
      nav('/admin/workflow-node-designs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadSharedOptions(), loadDetail()]);
  }, [nodeId]);

  const fieldOptions = useMemo(
    () => fieldDefinitions
      .filter((item) => item.enabled)
      .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
      .map((item) => ({ value: item.fieldKey, label: `${item.name} (${item.fieldKey})` })),
    [fieldDefinitions],
  );

  const packageOptions = useMemo(
    () => workflowTemplateOptions.map((item) => ({ value: item.id, label: item.name })),
    [workflowTemplateOptions],
  );

  const handleSaveBase = async () => {
    if (!detail) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await workflowNodeDesignApi.update(detail.id, {
        moduleDefinitionId: values.moduleDefinitionId || undefined,
        name: values.name,
        code: values.code,
        nodeType: values.nodeType,
        version: values.version ?? detail.version ?? 1,
      });
      message.success('节点基础信息已保存');
      setEditMode(false);
      await loadDetail();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || '节点基础信息保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveFields = async (fieldScope: 'INPUT' | 'OUTPUT', fields: WorkflowNodeFieldSavePayload[]) => {
    if (!detail) return;
    setSaving(true);
    try {
      const payload = fields
        .filter((item) => item.fieldKey)
        .map((item) => ({
          id: item.id,
          fieldScope,
          fieldKey: item.fieldKey,
          label: item.label || undefined,
          dataType: item.dataType || undefined,
          required: Boolean(item.required),
          readOnly: Boolean(item.readOnly),
          sortOrder: Number(item.sortOrder ?? 100),
          defaultValue: item.defaultValue,
          schemaMeta: item.schemaMeta,
        }));
      if (fieldScope === 'INPUT') {
        await workflowNodeDesignApi.saveInputFields(detail.id, payload);
      } else {
        await workflowNodeDesignApi.saveOutputFields(detail.id, payload);
      }
      message.success(fieldScope === 'INPUT' ? '输入字段已保存' : '输出字段已保存');
      await loadDetail();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '字段保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveRecommendations = async (recommendations: WorkflowTemplateNodeRecommendationPayload[]) => {
    if (!detail) return;
    setSaving(true);
    try {
      await workflowNodeDesignApi.saveRecommendations(detail.id, recommendations);
      message.success('推荐模板已保存');
      await loadDetail();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '推荐模板保存失败');
    } finally {
      setSaving(false);
    }
  };

  const renderFieldTab = (fieldScope: 'INPUT' | 'OUTPUT') => {
    const isInput = fieldScope === 'INPUT';
    const initial = Array.isArray(isInput ? detail?.inputFields : detail?.outputFields)
      ? (isInput ? detail.inputFields : detail.outputFields).map((item: any) => ({
          id: item.id,
          fieldKey: item.fieldKey,
          label: item.displayName || item.label,
          dataType: item.dataType,
          required: Boolean(item.required),
          readOnly: isInput ? Boolean(item.readOnly) : Boolean(item.allowWriteBackParent),
          sortOrder: Number(item.displayOrder ?? item.sortOrder ?? 100),
        }))
      : [];

    return (
      <FieldConfigEditor
        key={`${detail?.id || 'none'}-${fieldScope}`}
        loading={saving}
        fieldScope={fieldScope}
        fieldOptions={fieldOptions}
        initialFields={initial}
        onSave={saveFields}
      />
    );
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card
        loading={loading}
        title={detail ? `节点详情：${detail.name || detail.code || detail.id}` : '节点详情'}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/admin/workflow-node-designs')}>
              返回列表
            </Button>
            {editMode ? (
              <>
                <Button onClick={() => {
                  setEditMode(false);
                  form.setFieldsValue({
                    moduleDefinitionId: detail?.moduleDefinitionId,
                    name: detail?.name,
                    code: detail?.code,
                    nodeType: detail?.nodeType,
                    version: detail?.version ?? 1,
                  });
                }}
                >
                  取消
                </Button>
                <Button type="primary" loading={saving} onClick={() => void handleSaveBase()}>
                  保存基础信息
                </Button>
              </>
            ) : (
              <Button type="primary" onClick={() => setEditMode(true)}>
                编辑基础信息
              </Button>
            )}
          </Space>
        }
      >
        {detail ? (
          <Tabs
            items={[
              {
                key: 'base',
                label: '基础信息',
                children: (
                  <Form form={form} layout="vertical" disabled={!editMode}>
                    <Form.Item name="moduleDefinitionId" label="模块定义 ID">
                      <Input maxLength={64} placeholder="可选" />
                    </Form.Item>
                    <Form.Item name="name" label="节点名称" rules={[{ required: true, message: '请输入节点名称' }]}>
                      <Input maxLength={64} />
                    </Form.Item>
                    <Form.Item name="code" label="节点编码" rules={[{ required: true, message: '请输入节点编码' }]}>
                      <Input maxLength={64} />
                    </Form.Item>
                    <Form.Item name="nodeType" label="节点类型" rules={[{ required: true, message: '请输入节点类型' }]}>
                      <Input maxLength={64} />
                    </Form.Item>
                    <Form.Item name="version" label="版本号">
                      <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Space wrap>
                      <Tag color={detail.status === 'ACTIVE' ? 'green' : 'default'}>
                        {detail.status === 'ACTIVE' ? '启用' : '停用'}
                      </Tag>
                      <Tag>{detail.code}</Tag>
                    </Space>
                  </Form>
                ),
              },
              { key: 'input', label: '输入字段', children: renderFieldTab('INPUT') },
              { key: 'output', label: '输出字段', children: renderFieldTab('OUTPUT') },
              {
                key: 'recommend',
                label: '推荐模板',
                children: (
                  <RecommendationEditor
                    key={`${detail.id}-recommend`}
                    loading={saving}
                    packageOptions={packageOptions}
                    initialItems={Array.isArray(detail.recommendedTemplates) ? detail.recommendedTemplates.map(normalizeRecommendation) : []}
                    onSave={saveRecommendations}
                  />
                ),
              },
            ]}
          />
        ) : null}
      </Card>
    </Space>
  );
}

function FieldConfigEditor({
  fieldScope,
  fieldOptions,
  initialFields,
  loading,
  onSave,
}: {
  fieldScope: 'INPUT' | 'OUTPUT';
  fieldOptions: Array<{ value: string; label: string }>;
  initialFields: WorkflowNodeFieldSavePayload[];
  loading: boolean;
  onSave: (fieldScope: 'INPUT' | 'OUTPUT', fields: WorkflowNodeFieldSavePayload[]) => Promise<void>;
}) {
  const [fields, setFields] = useState<WorkflowNodeFieldSavePayload[]>(initialFields);

  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  const isInput = fieldScope === 'INPUT';

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Table
        size="small"
        pagination={false}
        rowKey={(_, index) => `${fieldScope}-${index}`}
        dataSource={fields}
        columns={[
          {
            title: '字段',
            render: (_: unknown, row: WorkflowNodeFieldSavePayload, index: number) => (
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                value={row.fieldKey || undefined}
                options={fieldOptions}
                onChange={(value) => setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, fieldKey: String(value || '') } : item))}
              />
            ),
          },
          {
            title: '显示名称',
            render: (_: unknown, row: WorkflowNodeFieldSavePayload, index: number) => (
              <Input
                value={row.label ?? undefined}
                onChange={(event) => setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
              />
            ),
          },
          {
            title: '排序',
            width: 100,
            render: (_: unknown, row: WorkflowNodeFieldSavePayload, index: number) => (
              <InputNumber
                min={1}
                precision={0}
                style={{ width: '100%' }}
                value={row.sortOrder}
                onChange={(value) => setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: Number(value || 1) } : item))}
              />
            ),
          },
          {
            title: '必填',
            width: 90,
            render: (_: unknown, row: WorkflowNodeFieldSavePayload, index: number) => (
              <Switch
                checked={Boolean(row.required)}
                onChange={(checked) => setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, required: checked } : item))}
              />
            ),
          },
          {
            title: isInput ? '只读' : '回写父流程',
            width: 120,
            render: (_: unknown, row: WorkflowNodeFieldSavePayload, index: number) => (
              <Switch
                checked={Boolean(row.readOnly)}
                onChange={(checked) => setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, readOnly: checked } : item))}
              />
            ),
          },
          {
            title: '操作',
            width: 80,
            render: (_: unknown, _row: WorkflowNodeFieldSavePayload, index: number) => (
              <Button type="link" danger onClick={() => setFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>删除</Button>
            ),
          },
        ]}
      />
      <Space>
        <Button icon={<PlusOutlined />} onClick={() => setFields((prev) => [...prev, createFieldDraft(prev.length + 1)])}>
          {isInput ? '添加输入字段' : '添加输出字段'}
        </Button>
        <Button type="primary" loading={loading} onClick={() => void onSave(fieldScope, fields)}>
          保存{isInput ? '输入' : '输出'}字段
        </Button>
      </Space>
    </Space>
  );
}

function RecommendationEditor({
  packageOptions,
  initialItems,
  loading,
  onSave,
}: {
  packageOptions: Array<{ value: string; label: string }>;
  initialItems: WorkflowTemplateNodeRecommendationPayload[];
  loading: boolean;
  onSave: (items: WorkflowTemplateNodeRecommendationPayload[]) => Promise<void>;
}) {
  const [items, setItems] = useState<WorkflowTemplateNodeRecommendationPayload[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Table
        size="small"
        pagination={false}
        rowKey={(_, index) => `recommend-${index}`}
        dataSource={items}
        columns={[
          {
            title: '推荐模板',
            width: 320,
            render: (_: unknown, row: WorkflowTemplateNodeRecommendationPayload, index: number) => (
              <Select
                showSearch
                style={{ width: '100%' }}
                optionFilterProp="label"
                value={row.recommendedWorkflowTemplateId || undefined}
                options={packageOptions}
                onChange={(value) => setItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, recommendedWorkflowTemplateId: String(value || '') } : item))}
              />
            ),
          },
          {
            title: '推荐原因',
            width: 520,
            render: (_: unknown, row: WorkflowTemplateNodeRecommendationPayload, index: number) => (
              <Input
                value={row.reason ?? undefined}
                onChange={(event) => setItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
              />
            ),
          },
          {
            title: '排序',
            width: 100,
            render: (_: unknown, row: WorkflowTemplateNodeRecommendationPayload, index: number) => (
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                value={row.displayOrder}
                onChange={(value) => setItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, displayOrder: Number(value || 0) } : item))}
              />
            ),
          },
          {
            title: '启用',
            width: 100,
            render: (_: unknown, row: WorkflowTemplateNodeRecommendationPayload, index: number) => (
              <Switch
                checked={row.enabled}
                onChange={(checked) => setItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: checked } : item))}
              />
            ),
          },
          {
            title: '操作',
            width: 80,
            render: (_: unknown, _row: WorkflowTemplateNodeRecommendationPayload, index: number) => (
              <Button type="link" danger onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>删除</Button>
            ),
          },
        ]}
        scroll={{ x: 1120 }}
      />
      <Space>
        <Button icon={<PlusOutlined />} onClick={() => setItems((prev) => [...prev, normalizeRecommendation({ enabled: true })])}>
          添加推荐模板
        </Button>
        <Button type="primary" loading={loading} onClick={() => void onSave(items)}>
          保存推荐模板
        </Button>
      </Space>
    </Space>
  );
}
