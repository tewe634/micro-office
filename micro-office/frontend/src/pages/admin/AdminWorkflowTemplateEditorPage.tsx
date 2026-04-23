import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { WorkflowRelationType, WorkflowTemplatePackageNodePayload, WorkflowTemplateStatus } from '../../api';
import { workflowNodeFeatureApi, workflowTemplateApi } from '../../api';

type NodeItem = {
  id: string;
  package_id?: string;
  module_definition_id: string;
  parent_package_node_id: string | null;
  sort_order: number;
  display_name: string;
  hierarchy_level: number;
  relation_type: WorkflowRelationType;
  branch_group_key: string | null;
  branch_order: number | null;
  metaText: string;
  version?: number;
  node_type?: string | null;
};

type TreeNodeItem = NodeItem & { level: number };
type AddNodeMode = 'ROOT' | 'CHILD' | 'SIBLING' | 'PARALLEL';
type FeatureBindingInvalidItem = {
  moduleDefinitionId: string;
  code?: string;
  name?: string;
  status?: string;
  message?: string;
  references?: Array<Record<string, any>>;
};

function localId() {
  return `tmp-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function normalizeNode(item: any): NodeItem {
  return {
    id: String(item.id || localId()),
    package_id: item.package_id || item.packageId || undefined,
    module_definition_id: String(item.module_definition_id || item.moduleDefinitionId || ''),
    parent_package_node_id: item.parent_package_node_id || item.parentPackageNodeId || null,
    sort_order: Number(item.sort_order ?? item.sortOrder ?? 0),
    display_name: String(item.display_name || item.displayName || ''),
    hierarchy_level: Number(item.hierarchy_level ?? item.hierarchyLevel ?? 0),
    relation_type: (item.relation_type || item.relationType || 'SEQUENCE') as WorkflowRelationType,
    branch_group_key: item.branch_group_key || item.branchGroupKey || null,
    branch_order: item.branch_order ?? item.branchOrder ?? null,
    metaText: prettyJson(item.meta),
    version: item.version === undefined || item.version === null ? undefined : Number(item.version),
    node_type: item.node_type || item.nodeType || null,
  };
}

function buildNodeTree(nodes: NodeItem[]) {
  const childMap = new Map<string | null, NodeItem[]>();
  nodes.forEach((node) => {
    const parentId = node.parent_package_node_id || null;
    const list = childMap.get(parentId) || [];
    list.push(node);
    childMap.set(parentId, list);
  });

  const sortNodes = (list: NodeItem[]) =>
    [...list].sort((a, b) => {
      const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
      if (sortDiff !== 0) return sortDiff;
      const branchDiff = Number(a.branch_order ?? 0) - Number(b.branch_order ?? 0);
      if (branchDiff !== 0) return branchDiff;
      return a.id.localeCompare(b.id);
    });

  const ordered: TreeNodeItem[] = [];

  const walk = (parentId: string | null, level: number) => {
    const children = sortNodes(childMap.get(parentId) || []);
    children.forEach((node) => {
      ordered.push({ ...node, level });
      walk(node.id, level + 1);
    });
  };

  walk(null, 0);
  return ordered;
}

function groupTreeNodesByLevel(nodes: TreeNodeItem[]) {
  const layers = new Map<number, TreeNodeItem[]>();
  nodes.forEach((node) => {
    const list = layers.get(node.level) || [];
    list.push(node);
    layers.set(node.level, list);
  });
  return Array.from(layers.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, items]) => ({ level, items }));
}

function modeLabel(mode: AddNodeMode | null) {
  switch (mode) {
    case 'ROOT':
      return '添加第一层节点';
    case 'CHILD':
      return '添加子节点';
    case 'SIBLING':
      return '添加同层节点';
    case 'PARALLEL':
      return '添加并行节点';
    default:
      return '添加节点';
  }
}

export default function AdminWorkflowTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const packageId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packageDetail, setPackageDetail] = useState<any>(null);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [moduleKeyword, setModuleKeyword] = useState('');
  const [allModuleDefinitions, setAllModuleDefinitions] = useState<any[]>([]);
  const [moduleDefinitions, setModuleDefinitions] = useState<any[]>([]);
  const [nodeFeatureMap, setNodeFeatureMap] = useState<Map<string, any>>(new Map());
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [bindingInvalidItems, setBindingInvalidItems] = useState<FeatureBindingInvalidItem[]>([]);
  const [addNodeModalOpen, setAddNodeModalOpen] = useState(false);
  const [pendingAddMode, setPendingAddMode] = useState<AddNodeMode | null>(null);
  const [pendingAddTargetLevel, setPendingAddTargetLevel] = useState<number | null>(null);
  const [pendingModuleDefinitionId, setPendingModuleDefinitionId] = useState<string | undefined>();

  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const moduleDefinitionMap = useMemo(
    () => new Map(allModuleDefinitions.map((item) => [String(item.id), item])),
    [allModuleDefinitions],
  );
  const treeNodes = useMemo(() => buildNodeTree(nodes), [nodes]);

  const visibleLayeredNodes = useMemo(() => groupTreeNodesByLevel(treeNodes), [treeNodes]);
  const bindingInvalidMap = useMemo(
    () => new Map(bindingInvalidItems.map((item) => [String(item.moduleDefinitionId), item])),
    [bindingInvalidItems],
  );
  const moduleDefinitionIdsInNodes = useMemo(
    () =>
      Array.from(
        new Set(
          nodes
            .map((item) => String(item.module_definition_id || '').trim())
            .filter(Boolean),
        ),
      ),
    [nodes],
  );

  const filteredModuleDefinitions = useMemo(() => {
    const keyword = moduleKeyword.trim().toLowerCase();
    if (!keyword) return moduleDefinitions;
    return moduleDefinitions.filter((item) => {
      const text = `${item.name || ''} ${item.code || ''} ${item.node_type || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [moduleDefinitions, moduleKeyword]);

  const addableModuleDefinitions = useMemo(() => {
    const seen = new Set<string>();
    const recommendationFirst: any[] = [];
    recommendations.forEach((item) => {
      const moduleId = String(
        item.recommended_module_definition_id || item.recommendedModuleDefinitionId || item.module_definition_id || '',
      );
      if (!moduleId || seen.has(moduleId)) return;
      const module = moduleDefinitionMap.get(moduleId);
      if (module) {
        seen.add(moduleId);
        recommendationFirst.push(module);
      }
    });

    filteredModuleDefinitions.forEach((item) => {
      const idValue = String(item.id);
      if (!seen.has(idValue)) {
        seen.add(idValue);
        recommendationFirst.push(item);
      }
    });

    return recommendationFirst;
  }, [filteredModuleDefinitions, moduleDefinitionMap, recommendations]);

  const loadPackageDetail = async () => {
    if (!packageId) return;
    const response: any = await workflowTemplateApi.listPackages();
    const records = response.data || [];
    const detail = records.find((item: any) => String(item.id) === packageId);
    if (!detail) {
      throw new Error('模板包不存在');
    }
    setPackageDetail(detail);
  };

  const loadNodes = async () => {
    if (!packageId) return;
    const response: any = await workflowTemplateApi.listNodes(packageId);
    const records = response.data || [];
    const normalized = records.map(normalizeNode);
    setNodes(normalized);
    setSelectedNodeId(normalized[0]?.id || null);
  };

  const loadModuleDefinitions = async (params?: { nodeType?: string; roleKey?: string; positionKey?: string }) => {
    const response: any = await workflowTemplateApi.listModuleDefinitions(params);
    setModuleDefinitions(response.data || []);
  };

  const loadAllModuleDefinitions = async () => {
    const response: any = await workflowTemplateApi.listModuleDefinitions();
    setAllModuleDefinitions(response.data || []);
  };

  const loadNodeFeatures = async () => {
    const allRecords: any[] = [];
    let current = 1;
    const size = 200;

    while (true) {
      const response: any = await workflowNodeFeatureApi.list({ current, size });
      const payload = response.data;
      const records = Array.isArray(payload) ? payload : payload?.records || [];
      allRecords.push(...records);

      if (Array.isArray(payload)) {
        break;
      }

      const total = Number(payload?.total || 0);
      if (!records.length || allRecords.length >= total) {
        break;
      }
      current += 1;
    }

    setNodeFeatureMap(new Map(allRecords.map((item: any) => [String(item.id), item])));
  };

  const loadRecommendations = async () => {
    if (!selectedNode || !packageDetail) {
      setRecommendations([]);
      return;
    }
    const moduleDef = moduleDefinitionMap.get(selectedNode.module_definition_id);
    const response: any = await workflowTemplateApi.listRecommendations({
      sceneCategory: packageDetail.scene_category,
      currentModuleDefinitionId: selectedNode.module_definition_id || undefined,
      currentNodeType: moduleDef?.node_type || selectedNode.node_type || undefined,
    });
    setRecommendations(response.data || []);
  };

  const loadModuleFields = async (moduleDefinitionId?: string) => {
    if (!moduleDefinitionId) return;
    try {
      await workflowTemplateApi.listModuleFields(moduleDefinitionId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '字段契约加载失败');
    }
  };

  const loadPage = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPackageDetail(), loadNodes(), loadAllModuleDefinitions(), loadModuleDefinitions(), loadNodeFeatures()]);
    } catch (error: any) {
      message.error(error?.message || error?.response?.data?.message || '模板包加载失败');
      nav('/admin/workflow-templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (packageId) {
      void loadPage();
    }
  }, [packageId]);

  useEffect(() => {
    void loadModuleFields(selectedNode?.module_definition_id);
    void loadRecommendations();
  }, [selectedNode?.id, selectedNode?.module_definition_id, packageDetail?.scene_category, moduleDefinitionMap]);

  useEffect(() => {
    const run = async () => {
      if (!moduleDefinitionIdsInNodes.length) {
        setBindingInvalidItems([]);
        return;
      }
      try {
        const response: any = await workflowNodeFeatureApi.validateBindings(moduleDefinitionIdsInNodes);
        setBindingInvalidItems(response.data?.invalidItems || []);
      } catch (error: any) {
        message.error(error?.response?.data?.message || '节点功能绑定校验失败');
      }
    };

    void run();
  }, [moduleDefinitionIdsInNodes]);

  const openAddNodeModal = (mode: AddNodeMode, targetLevel: number) => {
    setPendingAddMode(mode);
    setPendingAddTargetLevel(targetLevel);
    setPendingModuleDefinitionId(undefined);
    setAddNodeModalOpen(true);
  };

  const closeAddNodeModal = () => {
    setAddNodeModalOpen(false);
    setPendingAddMode(null);
    setPendingAddTargetLevel(null);
    setPendingModuleDefinitionId(undefined);
  };

  const insertNodeAtLevel = (targetLevel: number, moduleDefinitionId?: string) => {
    const targetLayerItems = visibleLayeredNodes.find((layer) => layer.level === targetLevel)?.items || [];
    const previousLayerItems = visibleLayeredNodes.find((layer) => layer.level === targetLevel - 1)?.items || [];
    const lastTargetNode = targetLayerItems[targetLayerItems.length - 1];
    const lastPreviousNode = previousLayerItems[previousLayerItems.length - 1];

    let relationType: WorkflowRelationType = 'SEQUENCE';
    let baseParentId: string | null = null;
    let branchGroupKey: string | null = null;
    let branchOrder: number | null = null;

    if (targetLevel === 0) {
      baseParentId = null;
      if (targetLayerItems.length > 0) {
        relationType = 'PARALLEL';
        branchGroupKey = lastTargetNode?.branch_group_key || 'root-parallel';
        branchOrder = targetLayerItems.length;
      }
    } else if (targetLayerItems.length > 0 && lastTargetNode) {
      baseParentId = lastTargetNode.parent_package_node_id;
      relationType = 'PARALLEL';
      branchGroupKey = lastTargetNode.branch_group_key || `branch-${baseParentId || 'root'}`;
      branchOrder = targetLayerItems.length;
    } else if (lastPreviousNode) {
      baseParentId = lastPreviousNode.id;
      relationType = 'SEQUENCE';
    } else {
      message.warning('请先在前一层添加节点');
      return;
    }

    const moduleDefinition = moduleDefinitionId ? moduleDefinitionMap.get(moduleDefinitionId) : null;
    const newNode: NodeItem = {
      id: localId(),
      package_id: packageId || undefined,
      module_definition_id: moduleDefinitionId || '',
      parent_package_node_id: baseParentId,
      sort_order: nodes.length + 1,
      display_name: moduleDefinition?.name || '新节点',
      hierarchy_level: targetLevel,
      relation_type: relationType,
      branch_group_key: relationType === 'PARALLEL' ? branchGroupKey : null,
      branch_order: relationType === 'PARALLEL' ? branchOrder : null,
      metaText: prettyJson({}),
      version: moduleDefinition?.version === undefined ? undefined : Number(moduleDefinition.version),
      node_type: moduleDefinition?.node_type || null,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const confirmAddNode = () => {
    if (pendingAddTargetLevel === null) return;
    if (!pendingModuleDefinitionId) {
      message.warning('请先选择要加入的节点模块');
      return;
    }
    const nodeFeature = nodeFeatureMap.get(String(pendingModuleDefinitionId));
    if (nodeFeature?.status === 'DISABLED') {
      message.warning(`节点功能已停用，不能加入模板：${nodeFeature.name || pendingModuleDefinitionId}`);
      return;
    }
    insertNodeAtLevel(pendingAddTargetLevel, pendingModuleDefinitionId);
    closeAddNodeModal();
  };

  const validateNodes = (items: NodeItem[]) => {
    const errors: string[] = [];
    const idSet = new Set<string>();
    const nodeMap = new Map<string, NodeItem>();
    items.forEach((node) => {
      if (idSet.has(node.id)) errors.push(`节点 ID 重复：${node.id}`);
      idSet.add(node.id);
      nodeMap.set(node.id, node);
      if (!node.display_name.trim()) errors.push(`节点 ${node.id} display_name 不能为空`);
      if (!node.module_definition_id) errors.push(`节点 ${node.id} 缺少 module_definition_id`);
      if (!['SEQUENCE', 'PARALLEL'].includes(node.relation_type)) {
        errors.push(`节点 ${node.id} relation_type 非法`);
      }
      if (node.relation_type === 'PARALLEL') {
        if (!node.branch_group_key || node.branch_order === null || node.branch_order === undefined) {
          errors.push(`节点 ${node.id} 为并行节点时必须配置 branch_group_key 和 branch_order`);
        }
      }
      if (node.relation_type === 'SEQUENCE' && (node.branch_group_key || node.branch_order !== null)) {
        errors.push(`节点 ${node.id} 为顺序节点时不能配置并行分支字段`);
      }
    });

    items.forEach((node) => {
      if (node.parent_package_node_id && !nodeMap.has(node.parent_package_node_id)) {
        errors.push(`节点 ${node.id} 的 parent_package_node_id 不存在`);
      }
      let currentParent = node.parent_package_node_id;
      const path = new Set<string>([node.id]);
      while (currentParent) {
        if (path.has(currentParent)) {
          errors.push(`节点 ${node.id} 存在父子循环依赖`);
          break;
        }
        path.add(currentParent);
        currentParent = nodeMap.get(currentParent)?.parent_package_node_id || null;
      }
    });
    return errors;
  };

  const buildSaveNodesPayload = (): WorkflowTemplatePackageNodePayload[] => {
    const ordered = buildNodeTree(nodes);
    return ordered.map((node, index) => ({
      id: node.id,
      package_id: node.package_id || packageId || undefined,
      module_definition_id: node.module_definition_id,
      parent_package_node_id: node.parent_package_node_id || null,
      sort_order: index + 1,
      display_name: node.display_name.trim(),
      hierarchy_level: node.level,
      relation_type: node.relation_type,
      branch_group_key: node.relation_type === 'PARALLEL' ? node.branch_group_key || null : null,
      branch_order: node.relation_type === 'PARALLEL' ? Number(node.branch_order ?? 0) : null,
      meta: parseJson(node.metaText, `节点 ${node.display_name || node.id} meta`),
      version: node.version,
    }));
  };

  const sanitizeNodePayload = (items: WorkflowTemplatePackageNodePayload[]): WorkflowTemplatePackageNodePayload[] => {
    return items.map((node) => {
      const sanitized: WorkflowTemplatePackageNodePayload = {
        id: node.id,
        package_id: node.package_id,
        module_definition_id: String(node.module_definition_id || ''),
        parent_package_node_id: node.parent_package_node_id ?? null,
        sort_order: Number(node.sort_order || 0),
        display_name: String(node.display_name || ''),
        hierarchy_level: Number(node.hierarchy_level || 0),
        relation_type: node.relation_type,
        branch_group_key: node.branch_group_key ?? null,
        branch_order: node.branch_order ?? null,
        meta: node.meta ?? {},
        version: node.version,
      };
      return sanitized;
    });
  };

  const saveNodesOnly = async () => {
    if (!packageDetail) return;
    try {
      setSaving(true);
      const payload = buildSaveNodesPayload();
      const errors = validateNodes(payload.map(normalizeNode));
      setValidationErrors(errors);
      if (errors.length) {
        message.error('节点结构校验未通过，请先修复');
        return;
      }
      const bindingResponse: any = await workflowNodeFeatureApi.validateBindings(
        Array.from(new Set(payload.map((item) => String(item.module_definition_id || '').trim()).filter(Boolean))),
      );
      const invalidItems = bindingResponse.data?.invalidItems || [];
      setBindingInvalidItems(invalidItems);
      if (invalidItems.length) {
        message.error('存在 DISABLED 或缺失的节点功能，模板无法保存');
        return;
      }
      const sanitizedNodes = sanitizeNodePayload(payload);
      if (import.meta.env.DEV) {
        console.debug('[workflow-template] save nodes payload', { nodes: sanitizedNodes });
      }
      await workflowTemplateApi.saveNodes(packageDetail.id, sanitizedNodes);
      message.success('节点编排已保存，模板包信息未改动');
      await loadNodes();
    } catch (error: any) {
      message.error(error?.message || error?.response?.data?.message || '节点编排保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updatePackageStatus = async (status: WorkflowTemplateStatus) => {
    if (!packageDetail) return;
    try {
      await workflowTemplateApi.updatePackageStatus(packageDetail.id, status);
      setPackageDetail((prev: any) => ({ ...prev, status }));
      message.success(status === 'ACTIVE' ? '已启用（ACTIVE）' : '已停用（DISABLED）');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态切换失败');
    }
  };

  const canvasLayers = useMemo(() => {
    if (!visibleLayeredNodes.length) return [{ level: 0, items: [] as TreeNodeItem[] }];
    const lastLevel = visibleLayeredNodes[visibleLayeredNodes.length - 1]?.level ?? 0;
    return [...visibleLayeredNodes, { level: lastLevel + 1, items: [] as TreeNodeItem[] }];
  }, [visibleLayeredNodes]);
  const canvasContentWidth = useMemo(() => Math.max(canvasLayers.length * 278 + 24, 1200), [canvasLayers.length]);

  return (
    <div className="page-fill" style={{ gap: 10, minWidth: 0 }}>
      <Card className="page-card" bodyStyle={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12, gap: 12 }}>
        {loading ? null : packageDetail ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                minWidth: 0,
                flex: '0 0 auto',
                padding: '0 4px 2px',
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  minHeight: 32,
                  flex: 1,
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#111827',
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {packageDetail ? `工作流模板编排：${packageDetail.name}` : '工作流模板编排'}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  minHeight: 36,
                  flex: '0 0 auto',
                  marginTop: 0,
                }}
              >
                <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/admin/workflow-templates')}>
                  返回列表
                </Button>
                {packageDetail?.status === 'ACTIVE' ? (
                  <Button onClick={() => void updatePackageStatus('DISABLED')}>停用（DISABLED）</Button>
                ) : (
                  <Button onClick={() => void updatePackageStatus('ACTIVE')}>启用（ACTIVE）</Button>
                )}
                <Button type="primary" loading={saving} onClick={() => void saveNodesOnly()}>
                  保存整包节点
                </Button>
              </div>
            </div>

            {validationErrors.length ? (
              <Alert
                type="error"
                showIcon
                message="节点结构校验未通过"
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {validationErrors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                }
              />
            ) : null}

            {bindingInvalidItems.length ? (
              <Alert
                type="warning"
                showIcon
                message="当前模板包含不可绑定的节点功能"
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bindingInvalidItems.map((item) => (
                      <div key={item.moduleDefinitionId}>
                        {item.message || `节点功能不可绑定：${item.name || item.moduleDefinitionId}`}
                      </div>
                    ))}
                  </div>
                }
              />
            ) : null}

            <div
              style={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 12,
                borderRadius: 20,
                border: '1px solid #dbe3ef',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
              }}
            >
              <div
                className="workflow-template-editor__canvas-scroll"
                style={{
                  flex: 1,
                  height: '100%',
                  minHeight: 0,
                  minWidth: 0,
                  maxWidth: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  padding: '0 12px 8px',
                  scrollbarGutter: 'stable both-edges',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 18,
                    height: '100%',
                    minHeight: '100%',
                    alignItems: 'stretch',
                    width: canvasContentWidth,
                    minWidth: canvasContentWidth,
                    paddingRight: 24,
                  }}
                >
                  {canvasLayers.map((layer) => {
                    const addMode: AddNodeMode =
                      layer.level === 0
                        ? 'ROOT'
                        : layer.items.length > 0
                          ? 'PARALLEL'
                          : 'CHILD';
                    const addDisabled = layer.level > 0 && !canvasLayers.find((item) => item.level === layer.level - 1)?.items.length;
                    return (
                      <div
                        key={layer.level}
                        style={{
                          width: 260,
                          flex: '0 0 260px',
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: 0,
                          height: '100%',
                          gap: 10,
                          paddingInline: 4,
                          position: 'relative',
                        }}
                      >
                        <div style={{ position: 'relative', height: 20, marginBottom: 4 }}>
                          <div
                            style={{
                              position: 'absolute',
                              top: 10,
                              left: 0,
                              right: 0,
                              borderTop: '1px dashed #cbd5e1',
                            }}
                          />
                          <button
                            type="button"
                            disabled={addDisabled}
                            onClick={() => openAddNodeModal(addMode, layer.level)}
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              transform: 'translateX(-50%)',
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              border: '1px solid #cbd5e1',
                              background: addDisabled ? '#f8fafc' : '#fff',
                              color: addDisabled ? '#cbd5e1' : '#0f172a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: addDisabled ? 'not-allowed' : 'pointer',
                              padding: 0,
                              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)',
                            }}
                          >
                            <PlusOutlined style={{ fontSize: 10 }} />
                          </button>
                        </div>
                        {layer.level > 0 ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: -9,
                              top: 20,
                              bottom: 0,
                              borderLeft: '1px dashed #cbd5e1',
                            }}
                          />
                        ) : null}
                        <div
                          className="workflow-template-editor__layer-scroll"
                          style={{
                            flex: 1,
                            height: '100%',
                            minHeight: 0,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            padding: '4px 4px 40px',
                            scrollbarGutter: 'stable',
                            WebkitOverflowScrolling: 'touch',
                          }}
                        >
                          <Space direction="vertical" size={12} style={{ width: '100%', paddingBottom: 12 }}>
                            {layer.items.map((node) => {
                              const module = moduleDefinitionMap.get(node.module_definition_id);
                              const nodeFeature = nodeFeatureMap.get(String(node.module_definition_id));
                              const bindingIssue = bindingInvalidMap.get(String(node.module_definition_id));
                              const active = node.id === selectedNodeId;
                              return (
                                <div
                                  key={node.id}
                                  onClick={() => setSelectedNodeId(node.id)}
                                  style={{
                                    padding: 16,
                                    minHeight: 200,
                                    borderRadius: 18,
                                    border: active ? '2px solid #2563eb' : '1px solid #dbe3ef',
                                    background: active ? 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)' : '#fff',
                                    boxShadow: active ? '0 12px 28px rgba(37, 99, 235, 0.12)' : '0 8px 16px rgba(15, 23, 42, 0.05)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 700, whiteSpace: 'pre-line' }}>
                                    {node.display_name || '未命名节点'}
                                  </div>
                                  <div style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>
                                    {module?.name || node.module_definition_id || '未绑定模块'}
                                  </div>
                                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    <Tag color={nodeFeature?.status === 'ACTIVE' ? 'green' : 'default'}>
                                      {nodeFeature?.status || 'DISABLED'}
                                    </Tag>
                                    {module?.node_type ? <Tag>{module.node_type}</Tag> : null}
                                  </div>
                                  {bindingIssue ? (
                                    <div style={{ marginTop: 10, color: '#dc2626', fontSize: 12, lineHeight: 1.6 }}>
                                      {bindingIssue.message || '当前节点功能不可绑定'}
                                    </div>
                                  ) : null}
                                  <div style={{ marginTop: 14, color: '#94a3b8', fontSize: 12 }}>{node.id}</div>
                                </div>
                              );
                            })}
                            {!layer.items.length ? (
                              <div
                                style={{
                                  minHeight: 180,
                                  borderRadius: 16,
                                  border: '1px dashed #cbd5e1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#94a3b8',
                                  background: 'rgba(255,255,255,0.72)',
                                  textAlign: 'center',
                                  padding: 16,
                                }}
                              >
                                当前层还没有节点
                              </div>
                            ) : null}
                          </Space>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>
            </div>

            <Modal
              title={modeLabel(pendingAddMode)}
              open={addNodeModalOpen}
              onCancel={closeAddNodeModal}
              onOk={confirmAddNode}
              okText="加入画布"
              cancelText="取消"
              destroyOnHidden
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message={
                    pendingAddTargetLevel === 0
                      ? '加入后会进入第一列'
                      : `加入后会进入第 ${pendingAddTargetLevel! + 1} 列`
                  }
                />
                <Input
                  placeholder="搜索模块节点"
                  value={moduleKeyword}
                  onChange={(e) => setModuleKeyword(e.target.value)}
                />
                <div
                  style={{
                    maxHeight: 320,
                    overflow: 'auto',
                    padding: 4,
                    borderRadius: 12,
                    border: '1px solid #eef2f7',
                    background: '#f8fafc',
                  }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {addableModuleDefinitions.map((item) => {
                      const active = String(item.id) === String(pendingModuleDefinitionId || '');
                      const nodeFeature = nodeFeatureMap.get(String(item.id));
                      const disabled = nodeFeature?.status === 'DISABLED';
                      const matchedRecommendation = recommendations.find((recommendation) => {
                        const moduleId = String(
                          recommendation.recommended_module_definition_id ||
                            recommendation.recommendedModuleDefinitionId ||
                            recommendation.module_definition_id ||
                            '',
                        );
                        return moduleId === String(item.id);
                      });
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return;
                            setPendingModuleDefinitionId(String(item.id));
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
                            background: active ? 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)' : '#fff',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.56 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{item.name}</div>
                              <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>{item.code}</div>
                            </div>
                            <Space size={6}>
                              <Tag color={nodeFeature?.status === 'ACTIVE' ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                                {nodeFeature?.status || 'DISABLED'}
                              </Tag>
                              <Tag style={{ marginInlineEnd: 0 }}>{item.node_type || item.nodeType || 'MODULE'}</Tag>
                            </Space>
                          </div>
                          {matchedRecommendation ? (
                            <div style={{ marginTop: 8, color: '#1d4ed8', fontSize: 12 }}>
                              {matchedRecommendation.rule_note || matchedRecommendation.ruleNote || '规则推荐'}
                            </div>
                          ) : null}
                          {disabled ? (
                            <div style={{ marginTop: 8, color: '#dc2626', fontSize: 12 }}>
                              节点功能已停用，当前不可加入模板
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                    {!addableModuleDefinitions.length ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可选模块节点" />
                    ) : null}
                  </Space>
                </div>
              </Space>
            </Modal>
          </>
        ) : (
          <Empty description="模板包不存在" />
        )}
      </Card>
    </div>
  );
}
