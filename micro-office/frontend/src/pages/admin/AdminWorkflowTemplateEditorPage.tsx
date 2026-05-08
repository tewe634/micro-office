import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  WorkflowTemplateFieldDefinition,
  WorkflowTemplateNodeFieldConfigPayload,
  WorkflowTemplateNodeRecommendationPayload,
  WorkflowTemplatePackageNodePayload,
  WorkflowTemplatePackageSummary,
  WorkflowTemplateStatus,
} from '../../api';
import { workflowTemplateApi } from '../../api';

type NodeEditorItem = WorkflowTemplatePackageNodePayload;

type FieldDefinitionFormValues = {
  fieldKey: string;
  name: string;
  fieldType: string;
  description?: string;
  enabled?: boolean;
  sensitive?: boolean;
  groupKey?: string;
  displayOrder?: number;
};

const fieldTypeOptions = [
  { label: '字符串', value: 'string' },
  { label: '长文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '布尔值', value: 'boolean' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: '列表', value: 'list' },
  { label: 'JSON', value: 'json' },
];

function localId() {
  return `tmp-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNode(item: any): NodeEditorItem {
  return {
    id: String(item.id || localId()),
    templateId: item.templateId || item.template_id || undefined,
    name: String(item.name || ''),
    code: String(item.code || ''),
    nodeType: String(item.nodeType || item.node_type || 'TASK'),
    sequence: Number(item.sequence ?? 1),
    isMainPath: item.isMainPath !== false,
    allowAppendNextNode: Boolean(item.allowAppendNextNode),
    allowDeriveSubflow: Boolean(item.allowDeriveSubflow),
    inputFields: Array.isArray(item.inputFields) ? item.inputFields : [],
    outputFields: Array.isArray(item.outputFields) ? item.outputFields : [],
    recommendedTemplates: Array.isArray(item.recommendedTemplates) ? item.recommendedTemplates : [],
    version: item.version === undefined || item.version === null ? undefined : Number(item.version),
  };
}

function sortNodes(nodes: NodeEditorItem[]) {
  return [...nodes].sort((a, b) => {
    const diff = (a.sequence || 0) - (b.sequence || 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function normalizeFieldConfig(
  item: Partial<WorkflowTemplateNodeFieldConfigPayload>,
  allowWriteBackParent: boolean,
): WorkflowTemplateNodeFieldConfigPayload {
  return {
    fieldKey: String(item.fieldKey || ''),
    displayName: item.displayName || undefined,
    displayOrder: Number(item.displayOrder ?? 100),
    required: Boolean(item.required),
    readOnly: allowWriteBackParent ? undefined : Boolean(item.readOnly),
    allowWriteBackParent: allowWriteBackParent ? Boolean(item.allowWriteBackParent) : undefined,
  };
}

function normalizeRecommendation(item: Partial<WorkflowTemplateNodeRecommendationPayload>): WorkflowTemplateNodeRecommendationPayload {
  return {
    recommendedWorkflowTemplateId: String(item.recommendedWorkflowTemplateId || ''),
    reason: item.reason || undefined,
    displayOrder: Number(item.displayOrder ?? 100),
    enabled: item.enabled !== false,
  };
}

export default function AdminWorkflowTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const packageId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packageDetail, setPackageDetail] = useState<WorkflowTemplatePackageSummary | null>(null);
  const [nodes, setNodes] = useState<NodeEditorItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<WorkflowTemplateFieldDefinition[]>([]);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [editingField, setEditingField] = useState<WorkflowTemplateFieldDefinition | null>(null);
  const [fieldForm] = Form.useForm<FieldDefinitionFormValues>();

  const selectedNode = useMemo(
    () => sortNodes(nodes).find((item) => item.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const fieldOptions = useMemo(() => {
    return fieldDefinitions
      .filter((item) => item.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.fieldKey.localeCompare(b.fieldKey))
      .map((item) => ({
        value: item.fieldKey,
        label: `${item.fieldKey} · ${item.name}`,
      }));
  }, [fieldDefinitions]);

  const loadPage = async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const [detailResponse, nodesResponse, fieldDefinitionsResponse]: any = await Promise.all([
        workflowTemplateApi.getPackage(packageId),
        workflowTemplateApi.listNodes(packageId),
        workflowTemplateApi.listFieldDefinitions(),
      ]);
      const detail = detailResponse.data;
      if (!detail) {
        throw new Error('工作流模板不存在');
      }
      const normalizedNodes = sortNodes((nodesResponse.data || []).map(normalizeNode));
      setPackageDetail(detail);
      setNodes(normalizedNodes);
      setSelectedNodeId((current) => normalizedNodes.find((item) => item.id === current)?.id || normalizedNodes[0]?.id || null);
      setFieldDefinitions(fieldDefinitionsResponse.data || []);
    } catch (error: any) {
      message.error(error?.message || error?.response?.data?.message || '工作流模板详情加载失败');
      nav('/admin/workflow-templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [packageId]);

  const openCreateFieldModal = () => {
    setEditingField(null);
    fieldForm.resetFields();
    fieldForm.setFieldsValue({ enabled: true, sensitive: false, displayOrder: 100, fieldType: 'string' });
    setFieldModalOpen(true);
  };

  const openEditFieldModal = (record: WorkflowTemplateFieldDefinition) => {
    setEditingField(record);
    fieldForm.setFieldsValue({
      fieldKey: record.fieldKey,
      name: record.name,
      fieldType: record.fieldType,
      description: record.description || undefined,
      enabled: record.enabled,
      sensitive: record.sensitive,
      groupKey: record.groupKey || undefined,
      displayOrder: record.displayOrder,
    });
    setFieldModalOpen(true);
  };

  const closeFieldModal = () => {
    setFieldModalOpen(false);
    setEditingField(null);
    fieldForm.resetFields();
  };

  const saveFieldDefinition = async () => {
    try {
      const values = await fieldForm.validateFields();
      setFieldSaving(true);
      if (editingField) {
        await workflowTemplateApi.updateFieldDefinition(editingField.fieldKey, values);
        message.success('全局字段定义已更新');
      } else {
        await workflowTemplateApi.createFieldDefinition(values);
        message.success('全局字段定义已创建');
      }
      closeFieldModal();
      const response: any = await workflowTemplateApi.listFieldDefinitions();
      setFieldDefinitions(response.data || []);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || '全局字段定义保存失败');
    } finally {
      setFieldSaving(false);
    }
  };

  const deleteFieldDefinition = async (fieldKey: string) => {
    try {
      await workflowTemplateApi.deleteFieldDefinition(fieldKey);
      message.success(`字段 ${fieldKey} 已删除`);
      const response: any = await workflowTemplateApi.listFieldDefinitions();
      setFieldDefinitions(response.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '字段删除失败');
    }
  };

  const updateNode = (nodeId: string, updater: (node: NodeEditorItem) => NodeEditorItem) => {
    setNodes((prev) => sortNodes(prev.map((node) => (node.id === nodeId ? updater(node) : node))));
  };

  const addNode = () => {
    const nextSequence = Math.max(0, ...nodes.map((item) => item.sequence || 0)) + 1;
    const node: NodeEditorItem = {
      id: localId(),
      templateId: packageId || undefined,
      name: `节点 ${nextSequence}`,
      code: `NODE_${nextSequence}`,
      nodeType: 'TASK',
      sequence: nextSequence,
      isMainPath: true,
      allowAppendNextNode: false,
      allowDeriveSubflow: false,
      inputFields: [],
      outputFields: [],
      recommendedTemplates: [],
      version: 1,
    };
    setNodes((prev) => sortNodes([...prev, node]));
    setSelectedNodeId(node.id);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((prev) => {
      const next = prev.filter((item) => item.id !== nodeId).map((item, index) => ({ ...item, sequence: index + 1 }));
      setSelectedNodeId((current) => (current === nodeId ? next[0]?.id || null : current));
      return next;
    });
  };

  const saveNodes = async () => {
    if (!packageDetail) return;
    try {
      setSaving(true);
      const payload = sortNodes(nodes).map((node, index) => ({
        ...node,
        sequence: index + 1,
        inputFields: (node.inputFields || []).map((field, fieldIndex) => ({
          ...normalizeFieldConfig(field, false),
          displayOrder: Number(field.displayOrder ?? fieldIndex + 1),
        })),
        outputFields: (node.outputFields || []).map((field, fieldIndex) => ({
          ...normalizeFieldConfig(field, true),
          displayOrder: Number(field.displayOrder ?? fieldIndex + 1),
        })),
        recommendedTemplates: (node.recommendedTemplates || []).map((item, recommendationIndex) => ({
          ...normalizeRecommendation(item),
          displayOrder: Number(item.displayOrder ?? recommendationIndex + 1),
        })),
      }));
      await workflowTemplateApi.saveNodes(packageDetail.id, payload);
      message.success('模板节点配置已保存');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '模板节点保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updatePackageStatus = async (status: WorkflowTemplateStatus) => {
    if (!packageDetail) return;
    try {
      await workflowTemplateApi.updatePackageStatus(packageDetail.id, status);
      setPackageDetail((prev) => (prev ? { ...prev, status } : prev));
      message.success(status === 'ACTIVE' ? '已启用（ACTIVE）' : '已停用（DISABLED）');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态切换失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 12, minWidth: 0 }}>
      <Card className="page-card" bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? null : packageDetail ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {packageDetail.name}
                </Typography.Title>
                <Space size={8} wrap style={{ marginTop: 8 }}>
                  <Tag>{packageDetail.code}</Tag>
                  <Tag>版本 {packageDetail.version || 1}</Tag>
                  <Tag color={packageDetail.status === 'ACTIVE' ? 'green' : 'default'}>
                    {packageDetail.status === 'ACTIVE' ? '启用' : '停用'}
                  </Tag>
                  {packageDetail.allowCreateAsNormal ? <Tag color="blue">普通流程</Tag> : null}
                  {packageDetail.allowCreateAsSubflow ? <Tag color="gold">子流程</Tag> : null}
                </Space>
              </div>
              <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/admin/workflow-templates')}>
                  返回列表
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadPage()}>
                  重载
                </Button>
                {packageDetail.status === 'ACTIVE' ? (
                  <Button onClick={() => void updatePackageStatus('DISABLED')}>停用</Button>
                ) : (
                  <Button onClick={() => void updatePackageStatus('ACTIVE')}>启用</Button>
                )}
                <Button type="primary" loading={saving} onClick={() => void saveNodes()}>
                  保存模板节点
                </Button>
              </Space>
            </div>

            <Alert
              type="info"
              showIcon
              message="模板管理边界"
              description="此页面只管理工作流模板、模板节点、节点输入输出字段、是否允许派生子流程，以及可选推荐模板；不暴露运行时实例、聊天群、父子实例关系等概念。"
            />

            <Row gutter={12} align="stretch">
              <Col xs={24} lg={10}>
                <Card
                  title="全局字段定义"
                  extra={
                    <Space>
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadPage()}>
                        刷新
                      </Button>
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreateFieldModal}>
                        新建字段
                      </Button>
                    </Space>
                  }
                  bodyStyle={{ padding: 0 }}
                >
                  <Table
                    rowKey="fieldKey"
                    dataSource={[...fieldDefinitions].sort((a, b) => a.displayOrder - b.displayOrder || a.fieldKey.localeCompare(b.fieldKey))}
                    pagination={false}
                    size="small"
                    scroll={{ y: 360 }}
                    columns={[
                      {
                        title: '字段',
                        dataIndex: 'fieldKey',
                        render: (_: any, row: WorkflowTemplateFieldDefinition) => (
                          <div>
                            <div style={{ fontWeight: 700 }}>{row.fieldKey}</div>
                            <div style={{ color: '#666', fontSize: 12 }}>{row.name}</div>
                          </div>
                        ),
                      },
                      { title: '类型', dataIndex: 'fieldType', width: 90 },
                      {
                        title: '状态',
                        dataIndex: 'enabled',
                        width: 90,
                        render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>,
                      },
                      {
                        title: '操作',
                        key: 'action',
                        width: 140,
                        render: (_: any, row: WorkflowTemplateFieldDefinition) => (
                          <Space size={4}>
                            <Button type="link" size="small" onClick={() => openEditFieldModal(row)}>
                              编辑
                            </Button>
                            <Popconfirm
                              title="删除字段定义"
                              description={`确定删除字段 ${row.fieldKey} 吗？`}
                              okText="删除"
                              cancelText="取消"
                              okButtonProps={{ danger: true }}
                              onConfirm={() => void deleteFieldDefinition(row.fieldKey)}
                            >
                              <Button type="link" size="small" danger>
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Col>

              <Col xs={24} lg={14}>
                <Card
                  title="模板节点"
                  extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={addNode}>
                      添加节点
                    </Button>
                  }
                >
                  {!nodes.length ? (
                    <Empty description="当前模板还没有节点，先添加一个默认节点" />
                  ) : (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {sortNodes(nodes).map((node) => {
                        const active = node.id === selectedNodeId;
                        return (
                          <Card
                            key={node.id}
                            size="small"
                            hoverable
                            onClick={() => setSelectedNodeId(node.id)}
                            style={{
                              borderColor: active ? '#1677ff' : undefined,
                              boxShadow: active ? '0 0 0 1px rgba(22,119,255,0.12)' : undefined,
                            }}
                            title={
                              <Space>
                                <Tag color="blue">{node.sequence}</Tag>
                                <span>{node.name || '未命名节点'}</span>
                              </Space>
                            }
                            extra={
                              <Popconfirm
                                title="删除模板节点"
                                description={`确定删除节点“${node.name || node.code || node.id}”吗？`}
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                onConfirm={() => deleteNode(node.id)}
                              >
                                <Button type="text" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            }
                          >
                            <Space wrap>
                              <Tag>{node.code}</Tag>
                              <Tag>{node.nodeType}</Tag>
                              {node.isMainPath ? <Tag color="green">主链路</Tag> : <Tag>非主链路</Tag>}
                              {node.allowAppendNextNode ? <Tag color="gold">可追加后续节点</Tag> : null}
                              {node.allowDeriveSubflow ? <Tag color="purple">可派生子流程</Tag> : null}
                            </Space>
                          </Card>
                        );
                      })}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>

            {selectedNode ? (
              <Card title={`节点配置：${selectedNode.name || selectedNode.code || selectedNode.id}`}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>节点名称</div>
                      <Input
                        value={selectedNode.name}
                        onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, name: event.target.value }))}
                        maxLength={64}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>节点编码</div>
                      <Input
                        value={selectedNode.code}
                        onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, code: event.target.value.toUpperCase() }))}
                        maxLength={64}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>节点类型</div>
                      <Input
                        value={selectedNode.nodeType}
                        onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, nodeType: event.target.value.toUpperCase() }))}
                        maxLength={64}
                      />
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>顺序</div>
                      <InputNumber
                        min={1}
                        precision={0}
                        style={{ width: '100%' }}
                        value={selectedNode.sequence}
                        onChange={(value) => updateNode(selectedNode.id, (node) => ({ ...node, sequence: Number(value || 1) }))}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>版本</div>
                      <InputNumber
                        min={1}
                        precision={0}
                        style={{ width: '100%' }}
                        value={selectedNode.version || 1}
                        onChange={(value) => updateNode(selectedNode.id, (node) => ({ ...node, version: Number(value || 1) }))}
                      />
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ marginBottom: 6 }}>主链路</div>
                      <Switch
                        checked={selectedNode.isMainPath}
                        onChange={(checked) => updateNode(selectedNode.id, (node) => ({ ...node, isMainPath: checked }))}
                      />
                    </Col>
                  </Row>

                  <Space wrap>
                    <Checkbox
                      checked={selectedNode.allowAppendNextNode}
                      onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, allowAppendNextNode: event.target.checked }))}
                    >
                      允许实例内追加后续节点
                    </Checkbox>
                    <Checkbox
                      checked={selectedNode.allowDeriveSubflow}
                      onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, allowDeriveSubflow: event.target.checked }))}
                    >
                      允许从该节点派生子工作流
                    </Checkbox>
                  </Space>

                  <Divider style={{ margin: 0 }} />

                  <Typography.Title level={5} style={{ margin: 0 }}>
                    节点输入字段
                  </Typography.Title>
                  <Form layout="vertical">
                    <Form.List
                      name="inputFields"
                      initialValue={selectedNode.inputFields}
                    >
                      {() => (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {(selectedNode.inputFields || []).map((field, index) => (
                            <Card key={`input-${index}`} size="small">
                              <Row gutter={8}>
                                <Col xs={24} md={8}>
                                  <div style={{ marginBottom: 6 }}>字段 key</div>
                                  <Select
                                    showSearch
                                    value={field.fieldKey}
                                    options={fieldOptions}
                                    onChange={(value) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        inputFields: node.inputFields.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, fieldKey: value } : item,
                                        ),
                                      }))
                                    }
                                  />
                                </Col>
                                <Col xs={24} md={6}>
                                  <div style={{ marginBottom: 6 }}>展示名称</div>
                                  <Input
                                    value={field.displayName ?? undefined}
                                    onChange={(event) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        inputFields: node.inputFields.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, displayName: event.target.value } : item,
                                        ),
                                      }))
                                    }
                                  />
                                </Col>
                                <Col xs={24} md={4}>
                                  <div style={{ marginBottom: 6 }}>排序</div>
                                  <InputNumber
                                    min={0}
                                    precision={0}
                                    style={{ width: '100%' }}
                                    value={field.displayOrder}
                                    onChange={(value) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        inputFields: node.inputFields.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, displayOrder: Number(value || 0) } : item,
                                        ),
                                      }))
                                    }
                                  />
                                </Col>
                                <Col xs={24} md={4}>
                                  <div style={{ marginBottom: 6 }}>必填</div>
                                  <Switch
                                    checked={field.required}
                                    onChange={(checked) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        inputFields: node.inputFields.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, required: checked } : item,
                                        ),
                                      }))
                                    }
                                  />
                                </Col>
                                <Col xs={24} md={2}>
                                  <div style={{ marginBottom: 6 }}>只读</div>
                                  <Switch
                                    checked={Boolean(field.readOnly)}
                                    onChange={(checked) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        inputFields: node.inputFields.map((item, itemIndex) =>
                                          itemIndex === index ? { ...item, readOnly: checked } : item,
                                        ),
                                      }))
                                    }
                                  />
                                </Col>
                              </Row>
                              <Button
                                type="link"
                                danger
                                style={{ paddingInline: 0, marginTop: 8 }}
                                onClick={() =>
                                  updateNode(selectedNode.id, (node) => ({
                                    ...node,
                                    inputFields: node.inputFields.filter((_, itemIndex) => itemIndex !== index),
                                  }))
                                }
                              >
                                删除输入字段
                              </Button>
                            </Card>
                          ))}
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() =>
                              updateNode(selectedNode.id, (node) => ({
                                ...node,
                                inputFields: [...node.inputFields, normalizeFieldConfig({}, false)],
                              }))
                            }
                          >
                            添加输入字段
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                  </Form>

                  <Divider style={{ margin: 0 }} />

                  <Typography.Title level={5} style={{ margin: 0 }}>
                    节点输出字段
                  </Typography.Title>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {(selectedNode.outputFields || []).map((field, index) => (
                      <Card key={`output-${index}`} size="small">
                        <Row gutter={8}>
                          <Col xs={24} md={8}>
                            <div style={{ marginBottom: 6 }}>字段 key</div>
                            <Select
                              showSearch
                              value={field.fieldKey}
                              options={fieldOptions}
                              onChange={(value) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  outputFields: node.outputFields.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, fieldKey: value } : item,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={6}>
                            <div style={{ marginBottom: 6 }}>展示名称</div>
                            <Input
                              value={field.displayName ?? undefined}
                              onChange={(event) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  outputFields: node.outputFields.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, displayName: event.target.value } : item,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={4}>
                            <div style={{ marginBottom: 6 }}>排序</div>
                            <InputNumber
                              min={0}
                              precision={0}
                              style={{ width: '100%' }}
                              value={field.displayOrder}
                              onChange={(value) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  outputFields: node.outputFields.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, displayOrder: Number(value || 0) } : item,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={3}>
                            <div style={{ marginBottom: 6 }}>必填</div>
                            <Switch
                              checked={field.required}
                              onChange={(checked) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  outputFields: node.outputFields.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, required: checked } : item,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={3}>
                            <div style={{ marginBottom: 6 }}>允许回写父流程</div>
                            <Switch
                              checked={Boolean(field.allowWriteBackParent)}
                              onChange={(checked) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  outputFields: node.outputFields.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, allowWriteBackParent: checked } : item,
                                  ),
                                }))
                              }
                            />
                          </Col>
                        </Row>
                        <Button
                          type="link"
                          danger
                          style={{ paddingInline: 0, marginTop: 8 }}
                          onClick={() =>
                            updateNode(selectedNode.id, (node) => ({
                              ...node,
                              outputFields: node.outputFields.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          删除输出字段
                        </Button>
                      </Card>
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() =>
                        updateNode(selectedNode.id, (node) => ({
                          ...node,
                          outputFields: [...node.outputFields, normalizeFieldConfig({}, true)],
                        }))
                      }
                    >
                      添加输出字段
                    </Button>
                  </Space>

                  <Divider style={{ margin: 0 }} />

                  <Typography.Title level={5} style={{ margin: 0 }}>
                    推荐工作流模板
                  </Typography.Title>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {(selectedNode.recommendedTemplates || []).map((item, index) => (
                      <Card key={`recommendation-${index}`} size="small">
                        <Row gutter={8}>
                          <Col xs={24} md={8}>
                            <div style={{ marginBottom: 6 }}>推荐模板 ID</div>
                            <Input
                              value={item.recommendedWorkflowTemplateId}
                              placeholder="填写目标工作流模板 ID"
                              onChange={(event) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  recommendedTemplates: node.recommendedTemplates.map((current, itemIndex) =>
                                    itemIndex === index
                                      ? { ...current, recommendedWorkflowTemplateId: event.target.value }
                                      : current,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={9}>
                            <div style={{ marginBottom: 6 }}>推荐原因</div>
                            <Input
                              value={item.reason ?? undefined}
                              onChange={(event) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  recommendedTemplates: node.recommendedTemplates.map((current, itemIndex) =>
                                    itemIndex === index ? { ...current, reason: event.target.value } : current,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={3}>
                            <div style={{ marginBottom: 6 }}>排序</div>
                            <InputNumber
                              min={0}
                              precision={0}
                              style={{ width: '100%' }}
                              value={item.displayOrder}
                              onChange={(value) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  recommendedTemplates: node.recommendedTemplates.map((current, itemIndex) =>
                                    itemIndex === index ? { ...current, displayOrder: Number(value || 0) } : current,
                                  ),
                                }))
                              }
                            />
                          </Col>
                          <Col xs={24} md={4}>
                            <div style={{ marginBottom: 6 }}>启用</div>
                            <Switch
                              checked={item.enabled}
                              onChange={(checked) =>
                                updateNode(selectedNode.id, (node) => ({
                                  ...node,
                                  recommendedTemplates: node.recommendedTemplates.map((current, itemIndex) =>
                                    itemIndex === index ? { ...current, enabled: checked } : current,
                                  ),
                                }))
                              }
                            />
                          </Col>
                        </Row>
                        <Button
                          type="link"
                          danger
                          style={{ paddingInline: 0, marginTop: 8 }}
                          onClick={() =>
                            updateNode(selectedNode.id, (node) => ({
                              ...node,
                              recommendedTemplates: node.recommendedTemplates.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          删除推荐配置
                        </Button>
                      </Card>
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() =>
                        updateNode(selectedNode.id, (node) => ({
                          ...node,
                          recommendedTemplates: [...node.recommendedTemplates, normalizeRecommendation({ enabled: true })],
                        }))
                      }
                    >
                      添加推荐模板
                    </Button>
                  </Space>
                </Space>
              </Card>
            ) : null}
          </>
        ) : null}
      </Card>

      <Modal
        title={editingField ? '编辑全局字段定义' : '新建全局字段定义'}
        open={fieldModalOpen}
        onCancel={closeFieldModal}
        onOk={() => void saveFieldDefinition()}
        confirmLoading={fieldSaving}
        destroyOnClose
      >
        <Form<FieldDefinitionFormValues> form={fieldForm} layout="vertical">
          <Form.Item
            name="fieldKey"
            label="字段 key"
            rules={[
              { required: true, message: '请输入字段 key' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '字段 key 仅支持小写字母、数字与下划线，且必须字母开头' },
            ]}
          >
            <Input disabled={Boolean(editingField)} />
          </Form.Item>
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fieldType" label="字段类型" rules={[{ required: true, message: '请选择字段类型' }]}>
            <Select options={fieldTypeOptions} />
          </Form.Item>
          <Form.Item name="description" label="字段说明">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="groupKey" label="分组标识">
            <Input />
          </Form.Item>
          <Form.Item name="displayOrder" label="排序值">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sensitive" label="敏感字段" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
