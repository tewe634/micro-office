import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Timeline, Tag, Input, Button, List, Modal, Space, message, Select, Descriptions, Popconfirm, Drawer, Form } from 'antd';
import { LockOutlined, MessageOutlined, LinkOutlined, SendOutlined, SwapOutlined, CheckCircleOutlined, StopOutlined, FlagOutlined, ArrowLeftOutlined } from '@ant-design/icons';
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
  const nav = useNavigate();
  const [thread, setThread] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  // Drawer
  const [drawerNode, setDrawerNode] = useState<any>(null);
  const [nodeDetail, setNodeDetail] = useState<any>(null);
  const [msgText, setMsgText] = useState('');
  // Modals
  const [assignModal, setAssignModal] = useState<number | null>(null);
  const [assignUser, setAssignUser] = useState<number>();
  const [assignNodeName, setAssignNodeName] = useState('');
  const [transferModal, setTransferModal] = useState<number | null>(null);
  const [transferUser, setTransferUser] = useState<number>();
  const [spawnModal, setSpawnModal] = useState<number | null>(null);
  const [spawnForm] = Form.useForm();
  // Reference
  const [refModal, setRefModal] = useState(false);
  const [refType, setRefType] = useState('THREAD');
  const [refItems, setRefItems] = useState<any[]>([]);
  const [refId, setRefId] = useState<number>();

  const load = async () => {
    const t: any = await threadApi.get(Number(id));
    setThread(t.data);
    setNodes(t.data.nodes || []);
  };

  useEffect(() => { load(); userApi.lookups().then((r: any) => setUsers(r.data?.users || [])).catch(() => {}); }, [id]);

  const openNodeDetail = async (node: any) => {
    if (!node.canView) { message.warning('无权查看此节点详情'); return; }
    setDrawerNode(node);
    try { const r: any = await nodeApi.get(node.id); setNodeDetail(r.data); }
    catch { message.error('无权查看'); setDrawerNode(null); }
  };

  const refreshDrawer = async () => {
    if (!drawerNode) return;
    const r: any = await nodeApi.get(drawerNode.id); setNodeDetail(r.data);
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !drawerNode) return;
    await nodeApi.addMessage(drawerNode.id, { content: msgText });
    setMsgText('');
    refreshDrawer();
  };

  // === 操作 ===
  const handleCompleteAssign = async () => {
    if (!assignModal || !assignUser) return;
    await nodeApi.complete(assignModal, { nextAction: 'ASSIGN', assignToUserId: assignUser, customNodeName: assignNodeName || undefined });
    setAssignModal(null); setAssignUser(undefined); setAssignNodeName('');
    message.success('已完成并指派');
    load();
  };

  const handleTransfer = async () => {
    if (!transferModal || !transferUser) return;
    await nodeApi.transfer(transferModal, transferUser);
    setTransferModal(null); setTransferUser(undefined);
    message.success('已转派');
    load();
  };

  const handleSpawn = async (values: any) => {
    if (!spawnModal) return;
    const r: any = await nodeApi.spawnThread(spawnModal, values);
    setSpawnModal(null); spawnForm.resetFields();
    message.success('子工作流已创建');
    load();
    // 可选：跳转到新工作流
    if (r.data?.threadId) {
      Modal.confirm({ title: '子工作流已创建', content: '是否跳转到新工作流？', okText: '跳转', cancelText: '留在当前',
        onOk: () => nav(`/threads/${r.data.threadId}`) });
    }
  };

  const handleFinish = async (nodeId: number) => {
    await nodeApi.complete(nodeId, { nextAction: 'COMPLETE_TASK' });
    message.success('工作流已完成');
    load();
  };

  const handleCancel = async (nodeId: number) => {
    await nodeApi.cancel(nodeId);
    message.success('节点已取消');
    load();
  };

  const handleAssignUnassigned = async (nodeId: number, userId: number) => {
    await nodeApi.assign(nodeId, userId);
    message.success('已指派');
    load();
  };

  // Reference
  const loadRefItems = async (type: string) => {
    setRefType(type);
    try {
      if (type === 'THREAD') { const r: any = await threadApi.list(); setRefItems((r.data || []).map((t: any) => ({ id: t.id, label: t.title }))); }
      else if (type === 'OBJECT') { const r: any = await objectApi.list(); setRefItems((r.data || []).map((o: any) => ({ id: o.id, label: `[${o.type}] ${o.name}` }))); }
      else if (type === 'PRODUCT') { const r: any = await productApi.list(); setRefItems((r.data || []).map((p: any) => ({ id: p.id, label: p.name }))); }
    } catch { setRefItems([]); }
  };

  const addRef = async () => {
    if (!drawerNode || !refId) return;
    const item = refItems.find(i => i.id === refId);
    await nodeApi.addReference(drawerNode.id, { refType, refId, refLabel: item?.label });
    setRefModal(false);
    refreshDrawer();
    message.success('关联已添加');
  };

  if (!thread) return null;

  const isActive = thread.status === 'ACTIVE';

  return (
    <Row gutter={24}>
      <Col span={16}>
        <Card title={<Space><Button icon={<ArrowLeftOutlined />} type="text" onClick={() => nav('/workbench')} />  {thread.title}</Space>} extra={<Space>
          <Tag color={statusMap[thread.status]?.color}>{statusMap[thread.status]?.text || thread.status}</Tag>
          {isActive && (
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
        <Card title="流程节点">
          <Timeline items={nodes.map((n: any) => ({
            color: statusMap[n.status]?.color || 'gray',
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{n.name}</strong>
                  <Tag color={statusMap[n.status]?.color}>{statusMap[n.status]?.text}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                  {n.owner_name ? `处理人: ${n.owner_name}` : '未指派'}
                  {!n.owner_id && n.status === 'IN_PROGRESS' && (
                    <Select size="small" placeholder="指派" style={{ width: 100, marginLeft: 8 }}
                      options={users.map(u => ({ value: u.id, label: u.name }))}
                      onChange={v => handleAssignUnassigned(n.id, v)} />
                  )}
                </div>
                {/* 操作按钮区 */}
                <Space wrap size={4}>
                  {n.canView ? (
                    <Button size="small" icon={<MessageOutlined />} onClick={() => openNodeDetail(n)}>详情</Button>
                  ) : (
                    <Tag icon={<LockOutlined />} color="default">无权查看</Tag>
                  )}
                  {n.status === 'IN_PROGRESS' && n.canView && isActive && (<>
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                      onClick={() => { setAssignModal(n.id); setAssignUser(undefined); setAssignNodeName(''); }}>完成并指派</Button>
                    <Button size="small" icon={<SendOutlined />}
                      onClick={() => { setSpawnModal(n.id); spawnForm.resetFields(); }}>发起工作流</Button>
                    <Button size="small" icon={<SwapOutlined />}
                      onClick={() => { setTransferModal(n.id); setTransferUser(undefined); }}>转派</Button>
                    <Popconfirm title="确认取消此节点？" onConfirm={() => handleCancel(n.id)}>
                      <Button size="small" danger icon={<StopOutlined />}>取消</Button>
                    </Popconfirm>
                    <Popconfirm title="确认完成此节点并标记整个工作流完成？" onConfirm={() => handleFinish(n.id)}>
                      <Button size="small" icon={<FlagOutlined />}>完成</Button>
                    </Popconfirm>
                  </>)}
                </Space>
              </div>
            ),
          }))} />
        </Card>
      </Col>

      {/* 节点详情抽屉 */}
      <Drawer title={drawerNode?.name} open={!!drawerNode} onClose={() => { setDrawerNode(null); setNodeDetail(null); }} width={500}>
        {nodeDetail && (<>
          <Card title={<><LinkOutlined /> 关联引用</>} size="small" style={{ marginBottom: 16 }}
            extra={<Button size="small" onClick={() => { setRefModal(true); setRefType('THREAD'); setRefId(undefined); loadRefItems('THREAD'); }}>添加关联</Button>}>
            {nodeDetail.references?.length ? (
              <List size="small" dataSource={nodeDetail.references} renderItem={(ref: any) => (
                <List.Item actions={[
                  <Popconfirm title="移除关联？" onConfirm={async () => { await nodeApi.removeReference(drawerNode.id, ref.id); refreshDrawer(); }}>
                    <Button size="small" danger>移除</Button>
                  </Popconfirm>
                ]}>
                  <Tag color="blue">{ref.ref_type}</Tag> {ref.ref_label}
                  {ref.ref_type === 'THREAD' && <Button type="link" size="small" onClick={() => nav(`/threads/${ref.ref_id}`)}>查看</Button>}
                </List.Item>
              )} />
            ) : <p style={{ color: '#888' }}>暂无关联</p>}
          </Card>

          <Card title={<><MessageOutlined /> 消息通道</>} size="small">
            <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 12 }}>
              {nodeDetail.messages?.map((m: any) => (
                <div key={m.id} style={{ marginBottom: 8, padding: 8, background: m.content?.startsWith('[系统]') ? '#fff7e6' : '#f5f5f5', borderRadius: 6 }}>
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
        </>)}
      </Drawer>

      {/* 完成并指派弹窗 */}
      <Modal title="完成并指派" open={!!assignModal} onOk={handleCompleteAssign} onCancel={() => setAssignModal(null)}
        okButtonProps={{ disabled: !assignUser }}>
        <Select placeholder="选择下一处理人" style={{ width: '100%', marginBottom: 12 }} showSearch optionFilterProp="label"
          options={users.map(u => ({ value: u.id, label: u.name }))} value={assignUser} onChange={v => setAssignUser(v)} />
        <Input placeholder="节点名称（可选）" value={assignNodeName} onChange={e => setAssignNodeName(e.target.value)} />
      </Modal>

      {/* 转派弹窗 */}
      <Modal title="转派节点" open={!!transferModal} onOk={handleTransfer} onCancel={() => setTransferModal(null)}
        okButtonProps={{ disabled: !transferUser }}>
        <Select placeholder="选择转派目标" style={{ width: '100%' }} showSearch optionFilterProp="label"
          options={users.map(u => ({ value: u.id, label: u.name }))} value={transferUser} onChange={v => setTransferUser(v)} />
      </Modal>

      {/* 发起子工作流弹窗 */}
      <Modal title="发起子工作流" open={!!spawnModal} onOk={() => spawnForm.submit()} onCancel={() => setSpawnModal(null)} width={500}>
        <Form form={spawnForm} onFinish={handleSpawn} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
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
