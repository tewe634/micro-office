import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Timeline, Tag, Input, Button, List, Modal, Radio, Space, message } from 'antd';
import { threadApi, nodeApi, commentApi } from '../../api';

const statusMap: Record<string, { color: string; text: string }> = {
  IN_PROGRESS: { color: 'processing', text: '进行中' },
  COMPLETED: { color: 'success', text: '已完成' },
  VOIDED: { color: 'default', text: '已作废' },
  PENDING_NEXT: { color: 'warning', text: '待定下一步' },
};

export default function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [completeModal, setCompleteModal] = useState<{ open: boolean; nodeId: number | null }>({ open: false, nodeId: null });
  const [nextAction, setNextAction] = useState('DEFER');

  const load = async () => {
    const tid = Number(id);
    const [t, n, c]: any[] = await Promise.all([threadApi.get(tid), nodeApi.list(tid), commentApi.list(tid)]);
    setThread(t.data);
    setNodes(n.data);
    setComments(c.data);
  };

  useEffect(() => { load(); }, [id]);

  const addComment = async () => {
    if (!commentText.trim()) return;
    await commentApi.create(Number(id), commentText);
    setCommentText('');
    load();
  };

  const handleComplete = async () => {
    if (!completeModal.nodeId) return;
    await nodeApi.complete(completeModal.nodeId, { nextAction });
    setCompleteModal({ open: false, nodeId: null });
    message.success('节点已完成');
    load();
  };

  if (!thread) return null;

  return (
    <Row gutter={24}>
      <Col span={16}>
        <Card title={thread.title} extra={<Tag>{thread.status}</Tag>}>
          <p>{thread.content || '暂无描述'}</p>
        </Card>
        <Card title="评论区" style={{ marginTop: 16 }}>
          <List dataSource={comments} renderItem={(c: any) => (
            <List.Item>
              <List.Item.Meta title={`用户${c.authorId}`} description={c.createdAt} />
              <div>
                {c.content}
                {c.triggers?.map((t: any, i: number) => (
                  <Button key={i} type="link" size="small" href={t.moduleUrl} target="_blank">发起{t.moduleName}</Button>
                ))}
              </div>
            </List.Item>
          )} />
          <Space.Compact style={{ width: '100%', marginTop: 12 }}>
            <Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="输入评论..." onPressEnter={addComment} />
            <Button type="primary" onClick={addComment}>发送</Button>
          </Space.Compact>
        </Card>
      </Col>
      <Col span={8}>
        <Card title="节点时间线">
          <Timeline items={nodes.map(n => ({
            color: statusMap[n.status]?.color || 'gray',
            children: (
              <div>
                <strong>{n.name}</strong> <Tag color={statusMap[n.status]?.color}>{statusMap[n.status]?.text}</Tag>
                <br /><small>负责人ID: {n.ownerId || '未指派'} | {n.createdAt}</small>
                {n.status === 'IN_PROGRESS' && (
                  <div><Button size="small" type="primary" onClick={() => setCompleteModal({ open: true, nodeId: n.id })}>完成节点</Button></div>
                )}
              </div>
            ),
          }))} />
        </Card>
      </Col>

      <Modal title="下一步决策" open={completeModal.open} onOk={handleComplete} onCancel={() => setCompleteModal({ open: false, nodeId: null })}>
        <Radio.Group value={nextAction} onChange={e => setNextAction(e.target.value)}>
          <Space direction="vertical">
            <Radio value="NEXT_TEMPLATE">进入下一预设节点</Radio>
            <Radio value="ASSIGN">指派给具体人员</Radio>
            <Radio value="POOL">丢入岗位任务池</Radio>
            <Radio value="CUSTOM">自定义新节点</Radio>
            <Radio value="COMPLETE_TASK">标记整个任务完成</Radio>
            <Radio value="DEFER">稍后决定</Radio>
          </Space>
        </Radio.Group>
      </Modal>
    </Row>
  );
}
