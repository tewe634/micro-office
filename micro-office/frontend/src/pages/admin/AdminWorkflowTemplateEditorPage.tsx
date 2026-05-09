import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
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
  WorkflowNodeFeatureSummary,
  WorkflowTemplateNodeFieldConfigPayload,
  WorkflowTemplateNodeRecommendationPayload,
  WorkflowTemplatePackageNodePayload,
  WorkflowTemplatePackageSummary,
  WorkflowTemplateStatus,
} from '../../api';
import { workflowNodeFeatureApi, workflowTemplateApi } from '../../api';
import { formatWorkflowNodeTypeLabel } from '../../constants/ui';

type NodeEditorItem = WorkflowTemplatePackageNodePayload;

function localId() {
  return `tmp-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortNodes(nodes: NodeEditorItem[]) {
  return [...nodes].sort((a, b) => {
    const diff = (a.sequence || 0) - (b.sequence || 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function normalizeField(item: any): WorkflowTemplateNodeFieldConfigPayload {
  return {
    fieldKey: String(item?.fieldKey || ''),
    label: item?.label || item?.displayName || undefined,
    dataType: item?.dataType || undefined,
    sortOrder: Number(item?.sortOrder ?? item?.displayOrder ?? 100),
    description: item?.description || undefined,
    fieldScope: item?.fieldScope || undefined,
    capabilityDerived: Boolean(item?.capabilityDerived),
    displayName: item?.displayName || undefined,
    displayOrder: Number(item?.displayOrder ?? item?.sortOrder ?? 100),
    required: Boolean(item?.required),
    readOnly: item?.readOnly === undefined ? undefined : Boolean(item.readOnly),
    allowWriteBackParent: item?.allowWriteBackParent === undefined ? undefined : Boolean(item.allowWriteBackParent),
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

function normalizeNode(item: any): NodeEditorItem {
  return {
    id: String(item.id || localId()),
    templateId: item.templateId || item.template_id || undefined,
    moduleDefinitionId: item.moduleDefinitionId || item.module_definition_id || undefined,
    moduleDefinitionCode: item.moduleDefinitionCode || undefined,
    moduleDefinitionName: item.moduleDefinitionName || undefined,
    moduleDefinitionStatus: item.moduleDefinitionStatus || undefined,
    capabilityBound: Boolean(item.capabilityBound),
    name: String(item.name || ''),
    code: String(item.code || ''),
    nodeType: String(item.nodeType || item.node_type || 'TASK'),
    sequence: Number(item.sequence ?? 1),
    isMainPath: item.isMainPath !== false,
    allowAppendNextNode: Boolean(item.allowAppendNextNode),
    allowDeriveSubflow: Boolean(item.allowDeriveSubflow),
    inputFields: Array.isArray(item.inputFields) ? item.inputFields.map(normalizeField) : [],
    outputFields: Array.isArray(item.outputFields) ? item.outputFields.map(normalizeField) : [],
    recommendedTemplates: Array.isArray(item.recommendedTemplates) ? item.recommendedTemplates.map(normalizeRecommendation) : [],
  };
}

function mergeModuleDefinitionOptions(
  nodes: NodeEditorItem[],
  remoteItems: WorkflowNodeFeatureSummary[],
): WorkflowNodeFeatureSummary[] {
  const map = new Map<string, WorkflowNodeFeatureSummary>();
  remoteItems.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });
  nodes.forEach((node) => {
    if (!node.moduleDefinitionId || map.has(node.moduleDefinitionId)) return;
    map.set(node.moduleDefinitionId, {
      id: node.moduleDefinitionId,
      code: node.moduleDefinitionCode || '',
      name: node.moduleDefinitionName || node.moduleDefinitionId,
      nodeType: node.nodeType || 'TASK',
      status: node.moduleDefinitionStatus || 'DISABLED',
    });
  });
  return Array.from(map.values());
}

function buildCapabilityFields(rawFields: any[], fieldScope: 'INPUT' | 'OUTPUT', previousOutputOverrides: Map<string, boolean>) {
  return rawFields
    .filter((item) => (item.fieldScope === 'OUTPUT' ? 'OUTPUT' : 'INPUT') === fieldScope)
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.fieldKey || '').localeCompare(String(b.fieldKey || '')))
    .map((item) => ({
      fieldKey: String(item.fieldKey || ''),
      label: item.label || undefined,
      dataType: item.dataType || undefined,
      required: Boolean(item.required),
      readOnly: fieldScope === 'INPUT' ? Boolean(item.readOnly) : undefined,
      allowWriteBackParent: fieldScope === 'OUTPUT' ? Boolean(previousOutputOverrides.get(String(item.fieldKey || ''))) : undefined,
      sortOrder: Number(item.sortOrder || 100),
      description: item.schemaMeta?.description || undefined,
      fieldScope,
      capabilityDerived: true,
      displayName: item.label || undefined,
      displayOrder: Number(item.sortOrder || 100),
    }));
}

function capabilityOptionLabel(item: WorkflowNodeFeatureSummary) {
  return `${item.name} · ${item.code} · ${formatWorkflowNodeTypeLabel(item.nodeType)}`;
}

export default function AdminWorkflowTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const packageId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bindingNodeId, setBindingNodeId] = useState<string | null>(null);
  const [packageDetail, setPackageDetail] = useState<WorkflowTemplatePackageSummary | null>(null);
  const [nodes, setNodes] = useState<NodeEditorItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowTemplateOptionsSource, setWorkflowTemplateOptionsSource] = useState<WorkflowTemplatePackageSummary[]>([]);
  const [moduleDefinitions, setModuleDefinitions] = useState<WorkflowNodeFeatureSummary[]>([]);

  const selectedNode = useMemo(
    () => sortNodes(nodes).find((item) => item.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const moduleDefinitionMap = useMemo(() => {
    const map = new Map<string, WorkflowNodeFeatureSummary>();
    moduleDefinitions.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [moduleDefinitions]);

  const workflowTemplateOptions = useMemo(() => {
    return [...workflowTemplateOptionsSource]
      .sort((a, b) => {
        const sortDiff = (a.sortOrder ?? 100) - (b.sortOrder ?? 100);
        if (sortDiff !== 0) return sortDiff;
        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      })
      .map((item) => ({
        value: item.id,
        label: item.name,
      }));
  }, [workflowTemplateOptionsSource]);

  const moduleDefinitionOptions = useMemo(() => {
    return [...moduleDefinitions]
      .sort((a, b) => {
        const statusDiff = a.status === b.status ? 0 : a.status === 'ACTIVE' ? -1 : 1;
        if (statusDiff !== 0) return statusDiff;
        const typeDiff = String(a.nodeType || '').localeCompare(String(b.nodeType || ''));
        if (typeDiff !== 0) return typeDiff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
      })
      .map((item) => ({
        value: item.id,
        label: capabilityOptionLabel(item),
      }));
  }, [moduleDefinitions]);

  const loadPage = async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const [detailResponse, nodesResponse, packagesResponse, moduleDefinitionsResponse]: any = await Promise.all([
        workflowTemplateApi.getPackage(packageId),
        workflowTemplateApi.listNodes(packageId),
        workflowTemplateApi.listPackages(),
        workflowNodeFeatureApi.list({ current: 1, size: 200 }),
      ]);
      const detail = detailResponse.data;
      if (!detail) {
        throw new Error('工作流模板不存在');
      }
      const normalizedNodes = sortNodes((nodesResponse.data || []).map(normalizeNode));
      const moduleDefinitionRecords = Array.isArray(moduleDefinitionsResponse.data)
        ? moduleDefinitionsResponse.data
        : moduleDefinitionsResponse.data?.records || [];

      setPackageDetail(detail);
      setNodes(normalizedNodes);
      setSelectedNodeId((current) => normalizedNodes.find((item) => item.id === current)?.id || normalizedNodes[0]?.id || null);
      setWorkflowTemplateOptionsSource((packagesResponse.data || []).filter((item: WorkflowTemplatePackageSummary) => item.id !== detail.id));
      setModuleDefinitions(mergeModuleDefinitionOptions(normalizedNodes, moduleDefinitionRecords));
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

  const updateNode = (nodeId: string, updater: (node: NodeEditorItem) => NodeEditorItem) => {
    setNodes((prev) => sortNodes(prev.map((node) => (node.id === nodeId ? updater(node) : node))));
  };

  const addNode = () => {
    const nextSequence = Math.max(0, ...nodes.map((item) => item.sequence || 0)) + 1;
    const node: NodeEditorItem = {
      id: localId(),
      templateId: packageId || undefined,
      moduleDefinitionId: undefined,
      moduleDefinitionCode: undefined,
      moduleDefinitionName: undefined,
      moduleDefinitionStatus: undefined,
      capabilityBound: false,
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

  const handleModuleDefinitionChange = async (nodeId: string, moduleDefinitionId?: string) => {
    const currentNode = nodes.find((item) => item.id === nodeId);
    if (!currentNode) return;

    if (!moduleDefinitionId) {
      updateNode(nodeId, (node) => ({
        ...node,
        moduleDefinitionId: undefined,
        moduleDefinitionCode: undefined,
        moduleDefinitionName: undefined,
        moduleDefinitionStatus: undefined,
        capabilityBound: false,
      }));
      return;
    }

    const matched = moduleDefinitionMap.get(moduleDefinitionId);
    const previousOutputOverrides = new Map<string, boolean>();
    currentNode.outputFields.forEach((field) => {
      previousOutputOverrides.set(field.fieldKey, Boolean(field.allowWriteBackParent));
    });

    try {
      setBindingNodeId(nodeId);
      const response: any = await workflowNodeFeatureApi.listFields(moduleDefinitionId);
      const rawFields = Array.isArray(response.data) ? response.data : [];
      const inputFields = buildCapabilityFields(rawFields, 'INPUT', previousOutputOverrides);
      const outputFields = buildCapabilityFields(rawFields, 'OUTPUT', previousOutputOverrides);

      updateNode(nodeId, (node) => ({
        ...node,
        moduleDefinitionId,
        moduleDefinitionCode: matched?.code || node.moduleDefinitionCode,
        moduleDefinitionName: matched?.name || node.moduleDefinitionName,
        moduleDefinitionStatus: matched?.status || node.moduleDefinitionStatus,
        capabilityBound: true,
        inputFields,
        outputFields,
      }));
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点模板字段加载失败');
    } finally {
      setBindingNodeId((current) => (current === nodeId ? null : current));
    }
  };

  const updateOutputAllowWriteBack = (nodeId: string, fieldKey: string, checked: boolean) => {
    updateNode(nodeId, (node) => ({
      ...node,
      outputFields: node.outputFields.map((item) =>
        item.fieldKey === fieldKey ? { ...item, allowWriteBackParent: checked } : item,
      ),
    }));
  };

  const saveNodes = async () => {
    if (!packageDetail) return;
    try {
      setSaving(true);
      const payload = sortNodes(nodes).map((node, index) => ({
        ...node,
        sequence: index + 1,
        moduleDefinitionId: node.moduleDefinitionId || undefined,
        inputFields: node.moduleDefinitionId
          ? []
          : (node.inputFields || []).map((field, fieldIndex) => ({
              fieldKey: field.fieldKey,
              displayName: field.displayName ?? field.label ?? undefined,
              displayOrder: Number(field.displayOrder ?? field.sortOrder ?? fieldIndex + 1),
              required: Boolean(field.required),
              readOnly: field.readOnly === undefined ? undefined : Boolean(field.readOnly),
            })),
        outputFields: (node.outputFields || []).map((field, fieldIndex) => ({
          fieldKey: field.fieldKey,
          displayName: field.displayName ?? field.label ?? undefined,
          displayOrder: Number(field.displayOrder ?? field.sortOrder ?? fieldIndex + 1),
          required: Boolean(field.required),
          allowWriteBackParent: Boolean(field.allowWriteBackParent),
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

  const selectedModuleDefinition = selectedNode?.moduleDefinitionId ? moduleDefinitionMap.get(selectedNode.moduleDefinitionId) : null;
  const selectedModuleStatus = selectedNode?.moduleDefinitionStatus || selectedModuleDefinition?.status || undefined;
  const selectedModuleCode = selectedNode?.moduleDefinitionCode || selectedModuleDefinition?.code || undefined;
  const selectedModuleName = selectedNode?.moduleDefinitionName || selectedModuleDefinition?.name || undefined;
  const selectedCapabilityLabel = selectedNode?.moduleDefinitionId ? (selectedModuleDefinition ? capabilityOptionLabel(selectedModuleDefinition) : selectedModuleName || selectedNode.moduleDefinitionId) : undefined;

  return (
    <div className="page-fill" style={{ gap: 12, minWidth: 0, overflow: 'hidden' }}>
      <Card className="page-card" bodyStyle={{ padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="page-card-scroll" style={{ padding: 12, paddingRight: 8 }}>
          {loading ? null : packageDetail ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {packageDetail.name}
                </Typography.Title>
                <Space size={8} wrap style={{ marginTop: 8 }}>
                  <Tag>{packageDetail.code}</Tag>
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

            <Row gutter={12} align="stretch">
              <Col xs={24} lg={10}>
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
                        const moduleItem = node.moduleDefinitionId ? moduleDefinitionMap.get(node.moduleDefinitionId) : null;
                        const moduleName = node.moduleDefinitionName || moduleItem?.name;
                        const moduleStatus = node.moduleDefinitionStatus || moduleItem?.status;
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
                              <Tag>{formatWorkflowNodeTypeLabel(node.nodeType)}</Tag>
                              {moduleName ? <Tag color="cyan">{moduleName}</Tag> : <Tag>未选择节点模板</Tag>}
                              {moduleStatus ? <Tag color={moduleStatus === 'ACTIVE' ? 'green' : 'default'}>{moduleStatus}</Tag> : null}
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

              <Col xs={24} lg={14}>
                {selectedNode ? (
                  <Card title={`节点配置：${selectedNode.name || selectedNode.code || selectedNode.id}`}>
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <Card size="small" title="节点模板来源">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <div>
                            <div style={{ marginBottom: 6 }}>选择节点模板</div>
                            <Select
                              showSearch
                              allowClear
                              optionFilterProp="label"
                              style={{ width: '100%' }}
                              placeholder="请选择节点管理中的节点模板"
                              value={selectedNode.moduleDefinitionId || undefined}
                              options={moduleDefinitionOptions}
                              loading={bindingNodeId === selectedNode.id}
                              onChange={(value) => void handleModuleDefinitionChange(selectedNode.id, value || undefined)}
                            />
                          </div>
                          <Space wrap>
                            {selectedCapabilityLabel ? <Tag color="cyan">{selectedCapabilityLabel}</Tag> : null}
                            {selectedModuleCode ? <Tag>{selectedModuleCode}</Tag> : null}
                            {selectedModuleStatus ? <Tag color={selectedModuleStatus === 'ACTIVE' ? 'green' : 'default'}>{selectedModuleStatus}</Tag> : null}
                          </Space>
                          <Typography.Text type="secondary">
                            节点输入/输出字段模板统一在“节点管理”维护；流程编辑页只维护当前流程中的流转配置与输出回写策略。
                          </Typography.Text>
                        </Space>
                      </Card>

                      <Card size="small" title="模板流转配置">
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
                        </Space>
                      </Card>

                      <Card size="small" title="节点模板字段（只读展示）">
                        <Space direction="vertical" size={16} style={{ width: '100%' }}>
                          <div>
                            <Typography.Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                              输入字段能力
                            </Typography.Title>
                            {selectedNode.inputFields.length ? (
                              <Table
                                size="small"
                                rowKey={(row) => `input-${row.fieldKey}`}
                                pagination={false}
                                dataSource={selectedNode.inputFields}
                                columns={[
                                  {
                                    title: '字段',
                                    render: (_: unknown, row: WorkflowTemplateNodeFieldConfigPayload) => (
                                      <div>
                                        <Space wrap>
                                          <Tag>{row.fieldKey}</Tag>
                                          {row.label ? <Tag color="blue">{row.label}</Tag> : null}
                                          {row.dataType ? <Tag>{row.dataType}</Tag> : null}
                                          {row.required ? <Tag color="red">必填</Tag> : <Tag>非必填</Tag>}
                                          {row.readOnly ? <Tag color="gold">只读</Tag> : null}
                                        </Space>
                                        {row.description ? (
                                          <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>{row.description}</div>
                                        ) : null}
                                      </div>
                                    ),
                                  },
                                ]}
                              />
                            ) : (
                              <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={selectedNode.moduleDefinitionId ? '该节点模板暂无输入字段' : '当前节点未选择节点模板'}
                              />
                            )}
                          </div>

                          <Divider style={{ margin: 0 }} />

                          <div>
                            <Typography.Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                              输出字段能力与流转回写配置
                            </Typography.Title>
                            {selectedNode.outputFields.length ? (
                              <Table
                                size="small"
                                rowKey={(row) => `output-${row.fieldKey}`}
                                pagination={false}
                                dataSource={selectedNode.outputFields}
                                columns={[
                                  {
                                    title: '能力字段',
                                    render: (_: unknown, row: WorkflowTemplateNodeFieldConfigPayload) => (
                                      <div>
                                        <Space wrap>
                                          <Tag>{row.fieldKey}</Tag>
                                          {row.label ? <Tag color="blue">{row.label}</Tag> : null}
                                          {row.dataType ? <Tag>{row.dataType}</Tag> : null}
                                          {row.required ? <Tag color="red">必填</Tag> : <Tag>非必填</Tag>}
                                        </Space>
                                        {row.description ? (
                                          <div style={{ marginTop: 6, color: '#666', fontSize: 12 }}>{row.description}</div>
                                        ) : null}
                                      </div>
                                    ),
                                  },
                                  {
                                    title: '允许回写父流程',
                                    width: 180,
                                    render: (_: unknown, row: WorkflowTemplateNodeFieldConfigPayload) => (
                                      <Switch
                                        checked={Boolean(row.allowWriteBackParent)}
                                        onChange={(checked) => updateOutputAllowWriteBack(selectedNode.id, row.fieldKey, checked)}
                                      />
                                    ),
                                  },
                                ]}
                              />
                            ) : (
                              <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={selectedNode.moduleDefinitionId ? '该节点模板暂无输出字段' : '当前节点未选择节点模板'}
                              />
                            )}
                          </div>
                        </Space>
                      </Card>

                      <Card size="small" title="推荐工作流模板">
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {(selectedNode.recommendedTemplates || []).map((item, index) => (
                            <Card key={`recommendation-${index}`} size="small">
                              <Row gutter={8}>
                                <Col xs={24} md={8}>
                                  <div style={{ marginBottom: 6 }}>推荐工作流模板</div>
                                  <Select
                                    value={item.recommendedWorkflowTemplateId || undefined}
                                    placeholder="请选择目标工作流模板"
                                    showSearch
                                    optionFilterProp="label"
                                    options={workflowTemplateOptions}
                                    onChange={(value) =>
                                      updateNode(selectedNode.id, (node) => ({
                                        ...node,
                                        recommendedTemplates: node.recommendedTemplates.map((current, itemIndex) =>
                                          itemIndex === index
                                            ? { ...current, recommendedWorkflowTemplateId: String(value || '') }
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
                      </Card>
                    </Space>
                  </Card>
                ) : (
                  <Card>
                    <Empty description="请选择一个模板节点" />
                  </Card>
                )}
              </Col>
            </Row>
          </>
        ) : null}
        </div>
      </Card>
    </div>
  );
}
