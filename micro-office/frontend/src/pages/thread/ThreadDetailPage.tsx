import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Timeline, Tag, Input, Button, List, Modal, Radio, Space, message, Select, Descriptions, Popconfirm, Drawer } from 'antd';
import { LockOutlined, MessageOutlined, LinkOutlined, UserAddOutlined } from '@ant-design/icons';
import { threadApi, nodeApi, userApi, objectApi, productApi } from '../../api';

const statusMap: Record<string, { color: string; text: string }> = {
  IN_PROGRESS: { color: 'processing', text: '进行中' },
  COMPLETED: { color: 'success', text: '已完成' },
  VOIDED: { color: 'default', text: '已作废' },
  PENDING_NEXT: { color: 'warning', text: '待处理' },
  CANCELLED: { color: 'error', text: '已取消' },
};

export default function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [completeModal, setCompleteModal] = useState<{ open: boolean; nodeId: number | null }>({ open: false, nodeId: null });
  const [nextAction, setNextAction] = useState('DEFER');
  const [assignUserId, setAssignUserId] = useState<number>();
  const [customNodeName, setCustomNodeName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  // Node detail drawer
  const [drawerNode, setDrawerNode] = useState<any>(null);
  const [nodeDetail, setNodeDetail] = useState<any>(null);
  const [msgText, setMsgText] = useState('');
  // Add node
  const [addNodeModal, setAddNodeModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeAssignee, setNewNodeAssignee] = useState<number>();
  // Reference
  const [refModal, setRefModal] = useState(false);
  const [refType, setRefType] = useState('THREAD');
  const [refItems, setRefItems] = useState<any[]>([]);
  const [refId, setRefId] = useState<number>();

  const load = async () => {
    const tid = Number(id);
    const t: any = await threadApi.get(tid);
    setThread(t.data);
    setNodes(t.data.nodes || []);
  };

  useEffect(() => { load(); userApi.list().then((r: any) => setUsers(r.data || [])).catch(() => {}); }, [id]);

  const openNodeDetail = async (node: any) => {
    if (!node.canView) { message.warning('无权查看此节点详情'); return; }
    setDrawerNode(node);
    try {
      const r: any = await nodeApi.get(node.id);
      setNodeDetail(r.data);
    } catch { message.error('无权查看'); setDrawerNode(null); }
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !drawerNode) return;
    await nodeApi.addMessage(drawerNode.id, { content: msgText });
    setMsgText('');
    const r: any = await nodeApi.get(drawerNode.id);
    setNodeDetail(r.data);
  };

  const handleComplete = async () => {
    if (!completeModal.nodeId) return;
    await nodeApi.complete(completeModal.nodeId, { nextAction, assignToUserId: assignUserId, customNodeName: customNodeName || undefined });
    setCompleteModal({ open: false, nodeId: null });
    setNextAction('DEFER'); setAssignUserId(undefined); setCustomNodeName('');
    message.success('节点已完成');
    load();
  };

  const handleAddNode = async () => {
    if (!newNodeName.trim()) return;
    const lastNode = nodes[nodes.length - 1];
    await nodeApi.create(Number(id), { name: newNodeName, ownerId: newNodeAssignee, prevNodeId: lastNode?.id });
    setAddNodeModal(false); setNewNodeName(''); setNewNodeAssignee(undefined);
    message.success('节点已添加');
    load();
  };

  const handleAssign = async (nodeId: number, userId: number) => {
    await nodeApi.assign(nodeId, userId);
    message.success('已指派');
    load();
  };

  const openRefModal = async (_nodeId: number) => {
    setRefModal(true);
    setRefType('THREAD');
    setRefId(undefined);
    // Load reference items based on type
    loadRefItems('THREAD');
  };

  const loadRefItems = async (type: string) => {
    setRefType(type);
    try {
      if (type === 'THREAD') { const r: any = await threadApi.list(); setRefItems((r.data || []).map((t: any) => ({ id: t.id, label: t.title }))); }
      else if (type === 'OBJECT') { const r: any = await objectApi.list(); setRefItems((r.data || []).map((o: any) => ({ id: o.id, label: `[${o.type}] ${o.name}` }))); }
      else if (type === 'PRODUCT') { const r: any = await productApi.list(); setRefItems((r.data || []).map((p: any) => ({ id: p.id, label: `${p.name}` }))); }
    } catch { setRefItems([]); }
  };

  const addRef = async () => {
    if (!drawerNode || !refId) return;
    const item = refItems.find(i => i.id === refId);
    await nodeApi.addReference(drawerNode.id, { refType: refType, refId: refId, refLabel: item?.label });
    setRefModal(false);
    const r: any = await nodeApi.get(drawerNode.id);
    setNodeDetail(r.data);
    message.success('关联已添加');
  };

  if (!thread) return null;

  return (
    <Row gutter={24}>
      <Col span={16}>
        <Card title={thread.title} extra={<Space>
          <Tag color={statusMap[thread.status]?.color}>{statusMap[thread.status]?.text || thread.status}</Tag>
          {thread.status === 'ACTIVE' && (
            <Popconfirm title="确认取消此工作流？" onConfirm={async () => { await threadApi.update(Number(id), { status: 'CANCELLED' }); message.success('已取消'); load(); }}>
              <Button size="small" danger>取消工作流</Button>
            </Popconfirm>
          )}
        </Space>}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="创建人">{thread.creator_name}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(thread.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            {thread.object_name && <Descriptions.Item label="关联对象"><Tag color="orange">{thread.object_type}</Tag> {thread.object_name}</Descriptions.Item>}
            {thread.product_name && <Descriptions.Item label="关联产品">{thread.product_name}</Descriptions.Item>}
          </Descriptions>
          {thread.content && <p style={{ marginTop: 12 }}>{thread.content}</p>}
        </Card>
      </Col>

      <Col span={8}>
        <Card title="流程节点" extra={
          thread.status === 'ACTIVE' && <Button size="small" type="primary" icon={<UserAddOutlined />} onClick={() => setAddNodeModal(true)}>添加节点</Button>
        }>
          <Timeline items={nodes.map((n: any) => ({
            color: statusMap[n.status]?.color || 'gray',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{n.name}</strong>
                  <Tag color={statusMap[n.status]?.color}>{statusMap[n.status]?.text}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {n.owner_name ? `处理人: ${n.owner_name}` : '未指派'}
                  {!n.owner_id && n.status === 'IN_PROGRESS' && (
                    <Select size="small" placeholder="指派" style={{ width: 100, marginLeft: 8 }}
                      options={users.map(u => ({ value: u.id, label: u.name }))}
                      onChange={v => handleAssign(n.id, v)} />
                  )}
                </div>
                <Space style={{ marginTop: 4 }}>
                  {n.canView ? (
                    <Button size="small" icon={<MessageOutlined />} onClick={() => openNodeDetail(n)}>详情</Button>
                  ) : (
                    <Tag icon={<LockOutlined />} color="default">无权查看</Tag>
                  )}
                  {n.status === 'IN_PROGRESS' && n.canView && (
                    <Button size="small" type="primary" onClick={() => setCompleteModal({ open: true, nodeId: n.id })}>完成</Button>
                  )}
                </Space>
              </div>
            ),
          }))} />
        </Card>
      </Col>

      {/* 节点详情抽屉 */}
      <Drawer title={drawerNode?.name} open={!!drawerNode} onClose={() => { setDrawerNode(null); setNodeDetail(null); }} width={500}>
        {nodeDetail && (
          <>
            {/* 关联引用 */}
            <Card title={<><LinkOutlined /> 关联引用</>} size="small" style={{ marginBottom: 16 }}
              extra={<Button size="small" onClick={() => openRefModal(drawerNode.id)}>添加关联</Button>}>
              {nodeDetail.references?.length ? (
                <List size="small" dataSource={nodeDetail.references} renderItem={(ref: any) => (
                  <List.Item actions={[
                    <Popconfirm title="移除关联？" onConfirm={async () => {
                      await nodeApi.removeReference(drawerNode.id, ref.id);
                      const r: any = await nodeApi.get(drawerNode.id); setNodeDetail(r.data);
                    }}><Button size="small" danger>移除</Button></Popconfirm>
                  ]}>
                    <Tag color="blue">{ref.ref_type}</Tag> {ref.ref_label}
                  </List.Item>
                )} />
              ) : <p style={{ color: '#888' }}>暂无关联</p>}
            </Card>

            {/* 消息通道 */}
            <Card title={<><MessageOutlined /> 消息通道</>} size="small">
              <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 12 }}>
                {nodeDetail.messages?.map((m: any) => (
                  <div key={m.id} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 6 }}>
                    <div style={{ fontSize: 12, color: '#888' }}>{m.author_name} · {new Date(m.created_at).toLocaleString('zh-CN')}</div>
                    {m.content && <div>{m.content}</div>}
                    {m.file_name && <a href={m.file_url} target="_blank" rel="noreferrer">{m.file_name}</a>}
                  </div>
                ))}
                {!nodeDetail.messages?.length && <p style={{ color: '#888' }}>暂无消息</p>}
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="输入消息..." onPressEnter={sendMessage} />
                <Button type="primary" onClick={sendMessage}>发送</Button>
              </Space.Compact>
            </Card>
          </>
        )}
      </Drawer>

      {/* 完成节点弹窗 */}
      <Modal title="完成节点 - 下一步" open={completeModal.open} onOk={handleComplete} onCancel={() => setCompleteModal({ open: false, nodeId: null })}>
        <Radio.Group value={nextAction} onChange={e => setNextAction(e.target.value)}>
          <Space direction="vertical">
            <Radio value="NEXT_TEMPLATE">进入下一预设节点</Radio>
            <Radio value="ASSIGN">指派给具体人员</Radio>
            <Radio value="CUSTOM">自定义新节点</Radio>
            <Radio value="COMPLETE_TASK">标记整个工作流完成</Radio>
            <Radio value="DEFER">稍后决定</Radio>
          </Space>
        </Radio.Group>
        {nextAction === 'ASSIGN' && (
          <div style={{ marginTop: 12 }}>
            <Select placeholder="选择处理人" style={{ width: '100%' }} showSearch optionFilterProp="label"
              options={users.map(u => ({ value: u.id, label: u.name }))} onChange={v => setAssignUserId(v)} />
            <Input style={{ marginTop: 8 }} placeholder="节点名称（可选）" value={customNodeName} onChange={e => setCustomNodeName(e.target.value)} />
          </div>
        )}
        {nextAction === 'CUSTOM' && (
          <div style={{ marginTop: 12 }}>
            <Input placeholder="节点名称" value={customNodeName} onChange={e => setCustomNodeName(e.target.value)} />
            <Select placeholder="指派处理人" style={{ width: '100%', marginTop: 8 }} showSearch optionFilterProp="label"
              options={users.map(u => ({ value: u.id, label: u.name }))} onChange={v => setAssignUserId(v)} />
          </div>
        )}
      </Modal>

      {/* 添加节点弹窗 */}
      <Modal title="添加流程节点" open={addNodeModal} onOk={handleAddNode} onCancel={() => setAddNodeModal(false)}>
        <Input placeholder="节点名称" value={newNodeName} onChange={e => setNewNodeName(e.target.value)} style={{ marginBottom: 12 }} />
        <Select placeholder="指派处理人（可选）" allowClear style={{ width: '100%' }} showSearch optionFilterProp="label"
          options={users.map(u => ({ value: u.id, label: u.name }))} onChange={v => setNewNodeAssignee(v)} />
      </Modal>

      {/* 添加关联弹窗 */}
      <Modal title="添加关联引用" open={refModal} onOk={addRef} onCancel={() => setRefModal(false)}>
        <Select value={refType} style={{ width: '100%', marginBottom: 12 }} onChange={v => loadRefItems(v)}
          options={[{ value: 'THREAD', label: '关联工作流' }, { value: 'OBJECT', label: '关联外部对象' }, { value: 'PRODUCT', label: '关联产品' }]} />
        <Select placeholder="选择关联项" style={{ width: '100%' }} showSearch optionFilterProp="label"
          options={refItems.map(i => ({ value: i.id, label: i.label }))} onChange={v => setRefId(v)} />
      </Modal>
    </Row>
  );
}
