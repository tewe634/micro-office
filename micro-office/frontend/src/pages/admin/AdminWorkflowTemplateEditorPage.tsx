import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  WorkflowNodeDesignSummary,
  WorkflowTemplateFieldDefinition,
  WorkflowTemplateInputMapping,
  WorkflowTemplateInputMappingFieldTree,
  WorkflowTemplateInputMappingOptionsResponse,
  WorkflowTemplateInputMappingOptionNode,
  WorkflowTemplateInputMappingTargetType,
  WorkflowTemplateNodeGraph,
  WorkflowTemplateNodeGraphResponse,
  WorkflowTemplatePackageSummary,
  WorkflowTemplateStatus,
} from '../../api';
import { workflowNodeDesignApi, workflowTemplateApi } from '../../api';
import { formatWorkflowNodeTypeLabel } from '../../constants/ui';

type NodeDesignLookup = Record<string, WorkflowNodeDesignSummary>;

type InputMappingDraft = {
  id?: string;
  targetType: WorkflowTemplateInputMappingTargetType;
  targetRef: string;
  targetPath: string;
  sourcePath: string;
  sortOrder: number;
  status: WorkflowTemplateStatus;
  meta?: Record<string, any>;
  version?: number;
};

type FieldPathOption = {
  value: string;
  label: string;
  fieldType?: string;
};

type FieldTreeNode = WorkflowTemplateInputMappingOptionNode & {
  children?: FieldTreeNode[];
};

type MappingTableRow = InputMappingDraft & {
  originalIndex: number;
};

function readNodeGraph(detail: WorkflowTemplatePackageSummary | null): WorkflowTemplateNodeGraph {
  const raw = detail?.meta?.nodeGraph;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((layer): layer is unknown[] => Array.isArray(layer))
    .map((layer) => layer.map((nodeId) => String(nodeId || '')).filter(Boolean))
    .filter((layer) => layer.length > 0);
}

function normalizeNodeLookup(list: WorkflowNodeDesignSummary[]) {
  return list.reduce<NodeDesignLookup>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

function flattenNodeGraph(nodeGraph: WorkflowTemplateNodeGraph) {
  return nodeGraph.flat();
}

function cloneGraph(nodeGraph: WorkflowTemplateNodeGraph) {
  return nodeGraph.map((layer) => [...layer]);
}

function normalizeMappingDraft(item: Partial<WorkflowTemplateInputMapping>, fallbackTargetRef = ''): InputMappingDraft {
  return {
    id: item.id,
    targetType: item.targetType === 'SUBFLOW_INPUT' ? 'SUBFLOW_INPUT' : 'NODE_INPUT',
    targetRef: String(item.targetRef || fallbackTargetRef || ''),
    targetPath: String(item.targetPath || ''),
    sourcePath: String(item.sourcePath || ''),
    sortOrder: Number(item.sortOrder ?? 100),
    status: item.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    meta: item.meta && typeof item.meta === 'object' ? item.meta : undefined,
    version: typeof item.version === 'number' ? item.version : undefined,
  };
}

function createMappingDraft(targetRef: string, targetType: WorkflowTemplateInputMappingTargetType, sortOrder: number): InputMappingDraft {
  return {
    targetType,
    targetRef,
    targetPath: '',
    sourcePath: '',
    sortOrder,
    status: 'ACTIVE',
  };
}

function appendFieldDefinitionPathOptions(
  options: FieldPathOption[],
  visited: Set<string>,
  item: WorkflowTemplateFieldDefinition,
  labelPrefix?: string,
) {
  const pushOption = (value: string, label: string, fieldType?: string) => {
    if (!value || visited.has(value)) return;
    visited.add(value);
    options.push({ value, label, fieldType });
  };

  const appendSubFields = (prefix: string, fieldName: string, subFields: any[], inList: boolean) => {
    subFields.forEach((subField) => {
      const subFieldKey = String(subField?.fieldKey || '').trim();
      if (!subFieldKey) return;
      const nextValue = inList ? `${prefix}[].${subFieldKey}` : `${prefix}.${subFieldKey}`;
      const nextLabel = `${fieldName} / ${String(subField?.name || subFieldKey)}`;
      pushOption(nextValue, nextLabel, String(subField?.fieldType || 'string'));
    });
  };

  const fieldKey = String(item.fieldKey || '').trim();
  if (!fieldKey) return;
  const labelBase = labelPrefix ? `${labelPrefix} / ${item.name}` : `${item.name}`;
  pushOption(fieldKey, labelBase, item.fieldType);
  const listSubFields = Array.isArray(item.meta?.listSubFields) ? item.meta?.listSubFields : [];
  if (item.fieldType === 'json') {
    pushOption(`${fieldKey}.key`, `${labelBase} / 子字段`, item.fieldType);
  }
  if (item.fieldType === 'list') {
    if (!listSubFields.length) {
      return;
    }
    if (listSubFields.length) {
      appendSubFields(fieldKey, labelBase, listSubFields, true);
    }
  }
}

function buildFieldPathOptions(fieldDefinitions: WorkflowTemplateFieldDefinition[]) {
  const options: FieldPathOption[] = [];
  const visited = new Set<string>();

  fieldDefinitions
    .filter((item) => item.enabled)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100) || a.fieldKey.localeCompare(b.fieldKey, 'zh-CN'))
    .forEach((item) => appendFieldDefinitionPathOptions(options, visited, item));

  return options;
}

function buildCurrentNodeFieldDomainPathOptions(
  node: WorkflowNodeDesignSummary | null | undefined,
  fieldDefinitions: WorkflowTemplateFieldDefinition[],
) {
  const options: FieldPathOption[] = [];
  const visited = new Set<string>();
  const definitionMap = new Map(fieldDefinitions.map((item) => [item.fieldKey, item] as const));

  const appendFromConfiguredFields = (
    fields: WorkflowNodeDesignSummary['inputFields'] | WorkflowNodeDesignSummary['outputFields'],
    labelPrefix: string,
  ) => {
    (Array.isArray(fields) ? fields : [])
      .slice()
      .sort((a, b) => Number(a.displayOrder ?? 100) - Number(b.displayOrder ?? 100))
      .forEach((field) => {
        const fieldKey = String(field.fieldKey || '').trim();
        if (!fieldKey) return;
        const definition = definitionMap.get(fieldKey);
        if (definition) {
          appendFieldDefinitionPathOptions(options, visited, definition, labelPrefix);
          return;
        }
        const label = field.displayName || field.label || fieldKey;
        if (!visited.has(fieldKey)) {
          visited.add(fieldKey);
          options.push({ value: fieldKey, label: `${labelPrefix} / ${label}` });
        }
      });
  };

  appendFromConfiguredFields(node?.inputFields, '当前节点输入');
  appendFromConfiguredFields(node?.outputFields, '当前节点输出');

  return options;
}

function buildNodeTargetPathOptions(node?: WorkflowNodeDesignSummary | null) {
  const inputFields = Array.isArray(node?.inputFields) ? node?.inputFields : [];
  return inputFields
    .slice()
    .sort((a, b) => Number(a.displayOrder ?? 100) - Number(b.displayOrder ?? 100))
    .map((field) => ({
      value: String(field.fieldKey || ''),
      label: `${field.displayName || field.label || field.fieldKey}`,
    }))
    .filter((item) => item.value);
}

function buildSubflowTargetPathOptions(node?: WorkflowNodeDesignSummary | null) {
  const recommendations = Array.isArray(node?.recommendedTemplates) ? node?.recommendedTemplates : [];
  if (!recommendations.length) {
    return [{ value: 'subflow_input.key', label: 'subflow_input.key' }];
  }
  return recommendations
    .filter((item) => item.enabled !== false)
    .sort((a, b) => Number(a.displayOrder ?? 100) - Number(b.displayOrder ?? 100))
    .map((item) => {
      const workflowId = String(item.recommendedWorkflowTemplateId || '').trim();
      const workflowName = item.recommendedWorkflowTemplateName || workflowId || '子工作流';
      return {
        value: `${workflowId || 'subflow'}.input.key`,
        label: `${workflowName} / input.key`,
      };
    })
    .filter((item) => item.value);
}

function flattenFieldTreeNodes(nodes: FieldTreeNode[]) {
  const options: FieldPathOption[] = [];

  const walk = (items: FieldTreeNode[]) => {
    items.forEach((item) => {
      const label = String(item.labelPath || item.label || item.path || '').trim();
      const value = String(item.path || '').trim();
      if (value && label) {
        options.push({ value, label, fieldType: item.fieldType });
      }
      if (Array.isArray(item.children) && item.children.length) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return options;
}

function normalizeFieldTree(tree?: WorkflowTemplateInputMappingFieldTree | null) {
  const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
  return flattenFieldTreeNodes(nodes as FieldTreeNode[]);
}

export default function AdminWorkflowTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const packageId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [savingNodeGraph, setSavingNodeGraph] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [packageDetail, setPackageDetail] = useState<WorkflowTemplatePackageSummary | null>(null);
  const [nodeGraph, setNodeGraph] = useState<WorkflowTemplateNodeGraph>([]);
  const [nodeDesignOptions, setNodeDesignOptions] = useState<WorkflowNodeDesignSummary[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<WorkflowTemplateFieldDefinition[]>([]);
  const [inputMappings, setInputMappings] = useState<InputMappingDraft[]>([]);
  const [inputMappingOptions, setInputMappingOptions] = useState<WorkflowTemplateInputMappingOptionsResponse | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [insertMode, setInsertMode] = useState<'serial' | 'parallel'>('serial');
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodeLookup = useMemo(() => normalizeNodeLookup(nodeDesignOptions), [nodeDesignOptions]);
  const selectedLayer = selectedLayerIndex === null ? null : nodeGraph[selectedLayerIndex] || null;
  const selectedNode = selectedNodeId ? nodeLookup[selectedNodeId] || null : null;
  const usedNodeIds = useMemo(() => new Set(flattenNodeGraph(nodeGraph)), [nodeGraph]);
  const selectedNodeMappingOptions = useMemo(() => {
    const nodeOptions = Array.isArray(inputMappingOptions?.nodeOptions) ? inputMappingOptions?.nodeOptions : [];
    return nodeOptions.find((item) => item.nodeId === selectedNodeId) || null;
  }, [inputMappingOptions, selectedNodeId]);
  const workflowFieldPathOptions = useMemo(() => {
    // Use upstream node output fields instead of global field dictionary
    const upstreamTrees = Array.isArray(selectedNodeMappingOptions?.upstreamNodeOutputFieldTrees)
      ? selectedNodeMappingOptions?.upstreamNodeOutputFieldTrees
      : [];
    const backendOptions = upstreamTrees.flatMap((item) => {
      const treeOptions = normalizeFieldTree(item.fieldTree);
      return treeOptions.map((option) => ({
        ...option,
        label: item.nodeName ? `${item.nodeName} / ${option.label}` : option.label,
      }));
    });
    return backendOptions.length ? backendOptions : buildFieldPathOptions(fieldDefinitions);
  }, [fieldDefinitions, selectedNodeMappingOptions]);
  const currentNodeFieldPathOptions = useMemo(() => {
    const backendOptions = normalizeFieldTree(selectedNodeMappingOptions?.currentNodeInputOutputFieldTree);
    return backendOptions.length ? backendOptions : buildCurrentNodeFieldDomainPathOptions(selectedNode, fieldDefinitions);
  }, [fieldDefinitions, selectedNode, selectedNodeMappingOptions]);
  const currentNodeInputTargetPathOptions = useMemo(() => {
    const backendOptions = normalizeFieldTree(selectedNodeMappingOptions?.currentNodeInputFieldTree);
    return backendOptions.length ? backendOptions : buildNodeTargetPathOptions(selectedNode);
  }, [selectedNode, selectedNodeMappingOptions]);
  const currentSubflowTargetPathOptions = useMemo(() => {
    const subflowTrees = Array.isArray(selectedNodeMappingOptions?.subflowInputFieldTrees)
      ? selectedNodeMappingOptions?.subflowInputFieldTrees
      : [];
    const backendOptions = subflowTrees.flatMap((item) => {
      const treeOptions = normalizeFieldTree(item.fieldTree);
      return treeOptions.map((option) => ({
        ...option,
        label: item.templateName ? `${item.templateName} / ${option.label}` : option.label,
      }));
    });
    return backendOptions.length ? backendOptions : buildSubflowTargetPathOptions(selectedNode);
  }, [selectedNode, selectedNodeMappingOptions]);

  const availableNodeOptions = useMemo(
    () =>
      nodeDesignOptions
        .filter((item) => item.status === 'ACTIVE')
        .filter((item) => !usedNodeIds.has(item.id))
        .map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })),
    [nodeDesignOptions, usedNodeIds],
  );

  const loadNodeDesignOptions = async () => {
    const response: any = await workflowNodeDesignApi.list({ status: 'ACTIVE' });
    const next = Array.isArray(response.data) ? response.data : response.data?.records || [];
    setNodeDesignOptions(next);
    return next as WorkflowNodeDesignSummary[];
  };

  const loadFieldDefinitions = async () => {
    const response: any = await workflowTemplateApi.listFieldDefinitions({ enabled: true });
    const next = Array.isArray(response.data) ? response.data : response.data?.records || [];
    setFieldDefinitions(next);
    return next as WorkflowTemplateFieldDefinition[];
  };

  const loadPage = async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const [detailResponse, graphResponse, mappingResponse, mappingOptionsResponse] = await Promise.all([
        workflowTemplateApi.getPackage(packageId),
        workflowTemplateApi.getNodeGraph(packageId),
        workflowTemplateApi.listInputMappings(packageId),
        workflowTemplateApi.getInputMappingOptions(packageId),
        loadFieldDefinitions(),
      ]);
      const detail = (detailResponse as any).data;
      if (!detail) throw new Error('工作流模板不存在');
      const graphData: WorkflowTemplateNodeGraphResponse | undefined = (graphResponse as any)?.data;
      const nextGraph = Array.isArray(graphData?.nodeGraph) ? graphData.nodeGraph : readNodeGraph(detail);
      const graphDefinitions = Array.isArray(graphData?.nodeDefinitions) ? graphData.nodeDefinitions : [];
      const rawMappings = Array.isArray((mappingResponse as any)?.data)
        ? (mappingResponse as any).data
        : (mappingResponse as any)?.data?.records || [];
      const mappingOptions = (mappingOptionsResponse as any)?.data || null;

      setPackageDetail(detail);
      setNodeGraph(nextGraph);
      setInputMappings(rawMappings.map((item: WorkflowTemplateInputMapping) => normalizeMappingDraft(item)));
      setInputMappingOptions(mappingOptions);

      const optionItems = await loadNodeDesignOptions();
      const existing = normalizeNodeLookup(optionItems);
      graphDefinitions.forEach((item) => {
        existing[item.id] = {
          ...existing[item.id],
          ...item,
        };
      });
      const mergedNodeDefinitions = Object.values(existing);
      setNodeDesignOptions(mergedNodeDefinitions);
      setSelectedLayerIndex((current) => {
        if (!nextGraph.length) return null;
        if (current === null) return 0;
        return nextGraph[current] ? current : 0;
      });
      setSelectedNodeId((current) => {
        if (current && mergedNodeDefinitions.find((item) => item.id === current) && flattenNodeGraph(nextGraph).includes(current)) {
          return current;
        }
        const firstNodeId = nextGraph[0]?.[0];
        return firstNodeId || null;
      });
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

  useEffect(() => {
    if (!selectedLayer?.length) return;
    if (!selectedNodeId || !selectedLayer.includes(selectedNodeId)) {
      setSelectedNodeId(selectedLayer[0]);
    }
  }, [selectedLayer, selectedNodeId]);

  const openSelector = async (mode: 'serial' | 'parallel') => {
    setInsertMode(mode);
    setSelectedNodeIds([]);
    setSelectorOpen(true);
    setSelectorLoading(true);
    try {
      await loadNodeDesignOptions();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点定义列表加载失败');
    } finally {
      setSelectorLoading(false);
    }
  };

  const appendNodeSelection = () => {
    if (!selectedNodeIds.length) {
      setSelectorOpen(false);
      return;
    }
    const baseIndex = nodeGraph.length;
    const nextSelectedNodeId = selectedNodeIds[0] || null;
    setNodeGraph((prev) => {
      const next = cloneGraph(prev);
      if (insertMode === 'parallel') {
        next.push(selectedNodeIds);
      } else {
        selectedNodeIds.forEach((nodeId) => next.push([nodeId]));
      }
      return next;
    });
    setSelectedLayerIndex(baseIndex);
    setSelectedNodeId(nextSelectedNodeId);
    setSelectorOpen(false);
    setSelectedNodeIds([]);
  };

  const removeLayer = (layerIndex: number) => {
    const removedNodeIds = nodeGraph[layerIndex] || [];
    setNodeGraph((prev) => prev.filter((_, index) => index !== layerIndex));
    setInputMappings((prev) => prev.filter((item) => !removedNodeIds.includes(item.targetRef)));
    setSelectedLayerIndex((prev) => {
      if (prev === null) return null;
      if (prev === layerIndex) return null;
      if (prev > layerIndex) return prev - 1;
      return prev;
    });
    setSelectedNodeId((prev) => (prev && removedNodeIds.includes(prev) ? null : prev));
  };

  const moveLayer = (layerIndex: number, offset: -1 | 1) => {
    setNodeGraph((prev) => {
      const target = layerIndex + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = cloneGraph(prev);
      const [current] = next.splice(layerIndex, 1);
      next.splice(target, 0, current);
      return next;
    });
    setSelectedLayerIndex((prev) => {
      if (prev === null) return prev;
      if (prev === layerIndex) return layerIndex + offset;
      if (prev === layerIndex + offset) return layerIndex;
      return prev;
    });
  };

  const removeNodeFromLayer = (layerIndex: number, nodeId: string) => {
    const currentLayer = nodeGraph[layerIndex] || [];
    const nextLayerSelection = currentLayer.filter((item) => item !== nodeId);
    setNodeGraph((prev) => {
      const next = cloneGraph(prev);
      next[layerIndex] = next[layerIndex].filter((item) => item !== nodeId);
      return next.filter((layer) => layer.length > 0);
    });
    setInputMappings((prev) => prev.filter((item) => item.targetRef !== nodeId));
    setSelectedLayerIndex((prev) => {
      if (prev === null) return null;
      if (prev === layerIndex && nextLayerSelection.length === 0) return null;
      return prev;
    });
    setSelectedNodeId((prev) => {
      if (prev !== nodeId) return prev;
      return nextLayerSelection[0] || null;
    });
  };

  const saveNodeGraph = async () => {
    if (!packageDetail) return;
    try {
      setSavingNodeGraph(true);
      await workflowTemplateApi.saveNodeGraph(packageDetail.id, nodeGraph);
      message.success('nodeGraph 已保存');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'nodeGraph 保存失败');
    } finally {
      setSavingNodeGraph(false);
    }
  };

  const saveInputMappings = async () => {
    if (!packageDetail) return;
    const activeMappings = inputMappings.filter((item) => item.status !== 'DISABLED');
    const invalidMapping = activeMappings.find((item) => !item.targetRef || !item.targetPath.trim() || !item.sourcePath.trim());
    if (invalidMapping) {
      message.error('请补全输入映射的来源路径与目标路径');
      return;
    }
    try {
      setSavingMappings(true);
      await workflowTemplateApi.saveInputMappings(
        packageDetail.id,
        inputMappings.map((item, index) => ({
          id: item.id,
          targetType: item.targetType,
          targetRef: item.targetRef,
          targetPath: item.targetPath.trim(),
          sourcePath: item.sourcePath.trim(),
          sortOrder: Number(item.sortOrder ?? (index + 1) * 10),
          status: item.status,
          meta: item.meta,
          version: item.version,
        })),
      );
      message.success('输入映射已保存');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '输入映射保存失败');
    } finally {
      setSavingMappings(false);
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

  const updateNodeMappings = (nodeId: string, updater: (items: InputMappingDraft[]) => InputMappingDraft[]) => {
    setInputMappings((prev) => {
      const related = prev.filter((item) => item.targetRef === nodeId);
      const rest = prev.filter((item) => item.targetRef !== nodeId);
      return [...rest, ...updater(related)].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
    });
  };

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
                  <Button type="primary" loading={savingNodeGraph} onClick={() => void saveNodeGraph()}>
                    保存 nodeGraph
                  </Button>
                </Space>
              </div>

              <Row gutter={12} align="stretch" style={{ marginTop: 12 }}>
                <Col xs={24} xl={14}>
                  <Card
                    title="工作流编排"
                    extra={
                      <Space wrap>
                        <Button icon={<PlusOutlined />} onClick={() => void openSelector('serial')}>
                          追加串行节点
                        </Button>
                        <Button icon={<PlusOutlined />} onClick={() => void openSelector('parallel')}>
                          追加并行组
                        </Button>
                      </Space>
                    }
                  >
                    {!nodeGraph.length ? (
                      <Empty description="当前工作流还没有 nodeGraph，先从节点库中选择节点。" />
                    ) : (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {nodeGraph.map((layer, layerIndex) => {
                          const active = layerIndex === selectedLayerIndex;
                          return (
                            <Card
                              key={`layer-${layerIndex}`}
                              size="small"
                              hoverable
                              onClick={() => {
                                setSelectedLayerIndex(layerIndex);
                                setSelectedNodeId(layer[0] || null);
                              }}
                              style={{
                                borderColor: active ? '#1677ff' : undefined,
                                boxShadow: active ? '0 0 0 1px rgba(22,119,255,0.12)' : undefined,
                              }}
                              title={
                                <Space wrap>
                                  <Tag color="blue">第 {layerIndex + 1} 层</Tag>
                                  <Tag color={layer.length > 1 ? 'purple' : 'default'}>
                                    {layer.length > 1 ? '并行组' : '串行节点'}
                                  </Tag>
                                </Space>
                              }
                              extra={
                                <Space>
                                  <Button disabled={layerIndex === 0} onClick={(event) => {
                                    event.stopPropagation();
                                    moveLayer(layerIndex, -1);
                                  }}
                                  >
                                    上移
                                  </Button>
                                  <Button disabled={layerIndex === nodeGraph.length - 1} onClick={(event) => {
                                    event.stopPropagation();
                                    moveLayer(layerIndex, 1);
                                  }}
                                  >
                                    下移
                                  </Button>
                                  <Popconfirm
                                    title="删除层级"
                                    description={`确定删除第 ${layerIndex + 1} 层吗？`}
                                    okText="删除"
                                    cancelText="取消"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => removeLayer(layerIndex)}
                                  >
                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()} />
                                  </Popconfirm>
                                </Space>
                              }
                            >
                              <Space wrap size={[8, 8]}>
                                {layer.map((nodeId) => {
                                  const node = nodeLookup[nodeId];
                                  const selected = selectedNodeId === nodeId;
                                  return (
                                    <Tag
                                      key={nodeId}
                                      color={selected ? 'blue' : node ? 'processing' : 'error'}
                                      style={{ padding: '4px 8px', cursor: 'pointer' }}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedLayerIndex(layerIndex);
                                        setSelectedNodeId(nodeId);
                                      }}
                                    >
                                      {node ? `${node.name} (${node.code})` : `未装配节点 ${nodeId}`}
                                    </Tag>
                                  );
                                })}
                              </Space>
                            </Card>
                          );
                        })}
                      </Space>
                    )}
                  </Card>
                </Col>

                <Col xs={24} xl={10}>
                  {selectedLayer && selectedNode ? (
                    <Card
                      title={`节点详情：${selectedNode.name}`}
                      extra={
                        <Button type="primary" loading={savingMappings} onClick={() => void saveInputMappings()}>
                          保存输入映射
                        </Button>
                      }
                    >
                      <Tabs
                        items={[
                          {
                            key: 'node',
                            label: '节点信息',
                            children: (
                              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Space wrap>
                                  <Tag>{selectedNode.code || selectedNode.id}</Tag>
                                  {selectedNode.nodeType ? <Tag>{formatWorkflowNodeTypeLabel(selectedNode.nodeType)}</Tag> : null}
                                  {selectedNode.status ? <Tag color={selectedNode.status === 'ACTIVE' ? 'green' : 'default'}>{selectedNode.status === 'ACTIVE' ? '启用' : '停用'}</Tag> : null}
                                </Space>
                                {selectedLayer.length > 1 ? <Tag color="purple">当前节点位于并行组</Tag> : <Tag>当前节点位于串行层</Tag>}
                                <Popconfirm
                                  title="移出当前层"
                                  description={`确定将节点“${selectedNode.name || selectedNode.id}”从当前层移除吗？`}
                                  okText="移除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => removeNodeFromLayer(Number(selectedLayerIndex), selectedNode.id)}
                                >
                                  <Button type="link" danger style={{ paddingInline: 0 }}>
                                    从当前层移除
                                  </Button>
                                </Popconfirm>
                              </Space>
                            ),
                          },
                          {
                            key: 'mapping',
                            label: '输入映射',
                            children: (
                              <WorkflowInputMappingPanel
                                node={selectedNode}
                                packageDetail={packageDetail}
                                workflowFieldPathOptions={workflowFieldPathOptions}
                                currentNodeFieldPathOptions={currentNodeFieldPathOptions}
                                currentNodeInputTargetPathOptions={currentNodeInputTargetPathOptions}
                                currentSubflowTargetPathOptions={currentSubflowTargetPathOptions}
                                mappings={inputMappings.filter((item) => item.targetRef === selectedNode.id)}
                                onChange={(nextMappings) => updateNodeMappings(selectedNode.id, () => nextMappings)}
                              />
                            ),
                          },
                        ]}
                      />
                    </Card>
                  ) : selectedLayer ? (
                    <Card>
                      <Empty description="请选择一个节点" />
                    </Card>
                  ) : (
                    <Card>
                      <Empty description="请选择一个层级" />
                    </Card>
                  )}
                </Col>
              </Row>
            </>
          ) : null}
        </div>
      </Card>

      <Modal
        title={insertMode === 'parallel' ? '选择并行组节点' : '选择串行节点'}
        open={selectorOpen}
        onOk={appendNodeSelection}
        onCancel={() => setSelectorOpen(false)}
        confirmLoading={selectorLoading}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="请选择节点设计库中的节点"
            value={selectedNodeIds}
            onChange={(value) => setSelectedNodeIds(value as string[])}
            options={availableNodeOptions}
            optionFilterProp="label"
            showSearch
          />
        </Space>
      </Modal>
    </div>
  );
}

function WorkflowInputMappingPanel({
  node,
  packageDetail,
  workflowFieldPathOptions,
  currentNodeFieldPathOptions,
  currentNodeInputTargetPathOptions,
  currentSubflowTargetPathOptions,
  mappings,
  onChange,
}: {
  node: WorkflowNodeDesignSummary;
  packageDetail: WorkflowTemplatePackageSummary;
  workflowFieldPathOptions: FieldPathOption[];
  currentNodeFieldPathOptions: FieldPathOption[];
  currentNodeInputTargetPathOptions: FieldPathOption[];
  currentSubflowTargetPathOptions: FieldPathOption[];
  mappings: InputMappingDraft[];
  onChange: (nextMappings: InputMappingDraft[]) => void;
}) {
  const subflowCapable = Boolean(packageDetail.allowCreateAsSubflow);

  const updateMapping = (index: number, patch: Partial<InputMappingDraft>) => {
    onChange(mappings.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addMapping = (targetType: WorkflowTemplateInputMappingTargetType) => {
    const nextSortOrder = (mappings.length + 1) * 10;
    onChange([...mappings, createMappingDraft(node.id, targetType, nextSortOrder)]);
  };

  const deleteMapping = (index: number) => {
    onChange(mappings.filter((_, itemIndex) => itemIndex !== index));
  };

  const activeNodeMappings = mappings.filter((item) => item.targetType === 'NODE_INPUT');
  const activeSubflowMappings = mappings.filter((item) => item.targetType === 'SUBFLOW_INPUT');
  const nodeMappingRows = activeNodeMappings.map((item) => ({
    ...item,
    originalIndex: mappings.indexOf(item),
  }));
  const subflowMappingRows = activeSubflowMappings.map((item) => ({
    ...item,
    originalIndex: mappings.indexOf(item),
  }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        本版只支持 workflow 整体字段到节点输入的映射，不提供输出映射，也不提供节点对节点映射。
      </Typography.Paragraph>

      <Card
        size="small"
        title="普通节点输入映射"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => addMapping('NODE_INPUT')}>
            新增映射
          </Button>
        }
      >
        {activeNodeMappings.length ? (
          <MappingTable
            rows={nodeMappingRows}
            workflowFieldPathOptions={workflowFieldPathOptions}
            targetPathOptions={currentNodeInputTargetPathOptions}
            onChange={updateMapping}
            onDelete={deleteMapping}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前节点还没有 workflow -> node input 映射" />
        )}
      </Card>

      <Card
        size="small"
        title="子工作流输入映射"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => addMapping('SUBFLOW_INPUT')}>
            新增映射
          </Button>
        }
      >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          SUBFLOW_INPUT 当前先支持编排层配置与存储。来源字段已收口为当前节点输入/输出字段域；严格校验仍依赖“节点实际选中的子工作流模板”事实源。
      </Typography.Paragraph>
        {!subflowCapable ? <Tag color="gold">当前工作流模板未标记为允许创建子流程，仍可先配置映射。</Tag> : null}
        {activeSubflowMappings.length ? (
          <MappingTable
            rows={subflowMappingRows}
            workflowFieldPathOptions={currentNodeFieldPathOptions}
            targetPathOptions={currentSubflowTargetPathOptions}
            onChange={updateMapping}
            onDelete={deleteMapping}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前节点还没有 workflow -> subflow input 映射" />
        )}
      </Card>
    </Space>
  );
}

function MappingTable({
  rows,
  workflowFieldPathOptions,
  targetPathOptions,
  onChange,
  onDelete,
}: {
  rows: MappingTableRow[];
  workflowFieldPathOptions: FieldPathOption[];
  targetPathOptions: Array<{ value: string; label: string }>;
  onChange: (index: number, patch: Partial<InputMappingDraft>) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(row, index) => row.id || `${row.targetType}-${row.targetRef}-${index}`}
      dataSource={rows}
      scroll={{ x: 920 }}
      columns={[
        {
          title: '来源',
          width: 340,
          render: (_: unknown, row: MappingTableRow) => (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder="选择中文来源路径"
                value={row.sourcePath || undefined}
                options={workflowFieldPathOptions}
                onChange={(value) => onChange(row.originalIndex, { sourcePath: String(value || '') })}
              />
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  来源编码路径
                </Typography.Text>
                <Input
                  readOnly
                  value={row.sourcePath}
                  placeholder="选择后自动回显编码路径"
                />
              </div>
            </Space>
          ),
        },
        {
          title: '目标',
          width: 340,
          render: (_: unknown, row: MappingTableRow) => (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                style={{ width: '100%' }}
                placeholder="选择中文目标路径"
                value={row.targetPath || undefined}
                options={targetPathOptions}
                onChange={(value) => onChange(row.originalIndex, { targetPath: String(value || '') })}
              />
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  目标编码路径
                </Typography.Text>
                <Input
                  readOnly
                  value={row.targetPath}
                  placeholder="选择后自动回显编码路径"
                />
              </div>
            </Space>
          ),
        },
        {
          title: '排序',
          width: 90,
          render: (_: unknown, row: MappingTableRow) => (
            <InputNumber
              min={0}
              precision={0}
              style={{ width: '100%' }}
              value={row.sortOrder}
              onChange={(value) => onChange(row.originalIndex, { sortOrder: Number(value ?? 0) })}
            />
          ),
        },
        {
          title: '状态',
          width: 110,
          render: (_: unknown, row: MappingTableRow) => (
            <Select
              style={{ width: '100%' }}
              value={row.status}
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'DISABLED', label: '停用' },
              ]}
              onChange={(value) => onChange(row.originalIndex, { status: value as WorkflowTemplateStatus })}
            />
          ),
        },
        {
          title: '操作',
          width: 80,
          render: (_: unknown, row: MappingTableRow) => (
            <Button type="link" danger onClick={() => onDelete(row.originalIndex)}>
              删除
            </Button>
          ),
        },
      ]}
    />
  );
}
