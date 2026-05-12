import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  WorkflowNodeDesignSummary,
  WorkflowTemplateNodeGraph,
  WorkflowTemplateNodeGraphResponse,
  WorkflowTemplatePackageSummary,
  WorkflowTemplateStatus,
} from '../../api';
import { workflowNodeDesignApi, workflowTemplateApi } from '../../api';
import { formatWorkflowNodeTypeLabel } from '../../constants/ui';

type NodeDesignLookup = Record<string, WorkflowNodeDesignSummary>;

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

export default function AdminWorkflowTemplateEditorPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const packageId = String(id || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [packageDetail, setPackageDetail] = useState<WorkflowTemplatePackageSummary | null>(null);
  const [nodeGraph, setNodeGraph] = useState<WorkflowTemplateNodeGraph>([]);
  const [nodeDesignOptions, setNodeDesignOptions] = useState<WorkflowNodeDesignSummary[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [insertMode, setInsertMode] = useState<'serial' | 'parallel'>('serial');
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);

  const nodeLookup = useMemo(() => normalizeNodeLookup(nodeDesignOptions), [nodeDesignOptions]);

  const selectedLayer = selectedLayerIndex === null ? null : nodeGraph[selectedLayerIndex] || null;

  const usedNodeIds = useMemo(() => new Set(flattenNodeGraph(nodeGraph)), [nodeGraph]);

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

  const loadPage = async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const [detailResponse, graphResponse]: any = await Promise.all([
        workflowTemplateApi.getPackage(packageId),
        workflowTemplateApi.getNodeGraph(packageId),
      ]);
      const detail = detailResponse.data;
      if (!detail) throw new Error('工作流模板不存在');
      const graphData: WorkflowTemplateNodeGraphResponse | undefined = graphResponse?.data;
      const nextGraph = Array.isArray(graphData?.nodeGraph) ? graphData.nodeGraph : readNodeGraph(detail);
      const graphDefinitions = Array.isArray(graphData?.nodeDefinitions) ? graphData.nodeDefinitions : [];
      setPackageDetail(detail);
      setNodeGraph(nextGraph);
      const optionItems = await loadNodeDesignOptions();
      const existing = normalizeNodeLookup(optionItems);
      graphDefinitions.forEach((item) => {
        existing[item.id] = item;
      });
      setNodeDesignOptions(Object.values(existing));
      setSelectedLayerIndex((current) => {
        if (!nextGraph.length) return null;
        if (current === null) return 0;
        return nextGraph[current] ? current : 0;
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
    setNodeGraph((prev) => {
      const next = cloneGraph(prev);
      if (insertMode === 'parallel') {
        next.push(selectedNodeIds);
      } else {
        selectedNodeIds.forEach((nodeId) => next.push([nodeId]));
      }
      return next;
    });
    setSelectedLayerIndex(() => {
      const baseIndex = nodeGraph.length;
      return baseIndex;
    });
    setSelectorOpen(false);
    setSelectedNodeIds([]);
  };

  const removeLayer = (layerIndex: number) => {
    setNodeGraph((prev) => prev.filter((_, index) => index !== layerIndex));
    setSelectedLayerIndex((prev) => {
      if (prev === null) return null;
      if (prev === layerIndex) return null;
      if (prev > layerIndex) return prev - 1;
      return prev;
    });
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
    setNodeGraph((prev) => {
      const next = cloneGraph(prev);
      next[layerIndex] = next[layerIndex].filter((item) => item !== nodeId);
      return next.filter((layer) => layer.length > 0);
    });
    setSelectedLayerIndex((prev) => {
      if (prev === null) return null;
      const layer = nodeGraph[layerIndex] || [];
      if (prev === layerIndex && layer.length <= 1) return null;
      return prev;
    });
  };

  const saveNodeGraph = async () => {
    if (!packageDetail) return;
    try {
      setSaving(true);
      await workflowTemplateApi.saveNodeGraph(packageDetail.id, nodeGraph);
      message.success('nodeGraph 已保存');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'nodeGraph 保存失败');
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
                  <Button type="primary" loading={saving} onClick={() => void saveNodeGraph()}>
                    保存 nodeGraph
                  </Button>
                </Space>
              </div>

              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="当前工作流页只负责引用节点并编辑 nodeGraph。"
                description="外层数组表示串行层级，内层数组表示同层并行节点；读取与保存均走 /node-graph 专用接口，工作流页不再提交节点定义字段。"
              />

              <Row gutter={12} align="stretch" style={{ marginTop: 12 }}>
                <Col xs={24} lg={16}>
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
                              onClick={() => setSelectedLayerIndex(layerIndex)}
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
                                  return (
                                    <Tag key={nodeId} color={node ? 'processing' : 'error'} style={{ padding: '4px 8px' }}>
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

                <Col xs={24} lg={8}>
                  {selectedLayer ? (
                    <Card title={`层级详情：第 ${Number(selectedLayerIndex) + 1} 层`}>
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Alert
                          type="info"
                          showIcon
                          message={selectedLayer.length > 1 ? '当前层为并行组' : '当前层为串行节点'}
                          description={selectedLayer.length > 1 ? '这一层中的多个节点会并行渲染。' : '单元素层级表示一个串行节点。'}
                        />
                        {selectedLayer.map((nodeId) => {
                          const node = nodeLookup[nodeId];
                          return (
                            <Card key={nodeId} size="small" title={node?.name || nodeId}>
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Space wrap>
                                  <Tag>{node?.code || nodeId}</Tag>
                                  {node?.nodeType ? <Tag>{formatWorkflowNodeTypeLabel(node.nodeType)}</Tag> : null}
                                  {node?.status ? <Tag color={node.status === 'ACTIVE' ? 'green' : 'default'}>{node.status === 'ACTIVE' ? '启用' : '停用'}</Tag> : null}
                                </Space>
                                <Popconfirm
                                  title="移出当前层"
                                  description={`确定将节点“${node?.name || nodeId}”从当前层移除吗？`}
                                  okText="移除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => removeNodeFromLayer(Number(selectedLayerIndex), nodeId)}
                                >
                                  <Button type="link" danger style={{ paddingInline: 0 }}>
                                    从当前层移除
                                  </Button>
                                </Popconfirm>
                              </Space>
                            </Card>
                          );
                        })}
                      </Space>
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
          <Alert
            type="info"
            showIcon
            message={insertMode === 'parallel' ? '将当前选择写入同一层' : '将每个选择按顺序写成独立层'}
            description={
              insertMode === 'parallel'
                ? '例如选择 2 个节点，会形成 [[A,B]] 这样的并行组。'
                : '例如选择 2 个节点，会形成 [[A],[B]] 这样的串行结构。'
            }
          />
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
