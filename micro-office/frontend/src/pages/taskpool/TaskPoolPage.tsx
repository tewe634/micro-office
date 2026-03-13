import { useEffect, useState } from 'react';
import { Card, InputNumber, List, Button, Tag, Empty, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { taskpoolApi } from '../../api';

export default function TaskPoolPage() {
  const [positionId, setPositionId] = useState<number>(1);
  const [tasks, setTasks] = useState<any[]>([]);
  const nav = useNavigate();

  const load = async () => { const r: any = await taskpoolApi.list(positionId); setTasks(r.data || []); };
  useEffect(() => { load(); }, [positionId]);

  const handleClaim = async (nodeId: number) => {
    try {
      await taskpoolApi.claim(nodeId);
      message.success('领取成功');
      load();
    } catch { message.error('已被他人领取'); }
  };

  return (
    <Card title="任务池" extra={
      <span>岗位ID: <InputNumber value={positionId} onChange={v => v && setPositionId(v)} min={1} style={{ width: 100 }} /></span>
    }>
      {tasks.length === 0 ? <Empty description="暂无待领取任务" /> : (
        <List dataSource={tasks} renderItem={(item: any) => (
          <List.Item actions={[
            <Button type="primary" onClick={() => handleClaim(item.id)}>领取</Button>,
            <Button onClick={() => nav(`/threads/${item.threadId}`)}>查看</Button>,
          ]}>
            <List.Item.Meta title={item.name} description={`工作ID: ${item.threadId} | 创建时间: ${item.createdAt}`} />
            <Tag color="orange">待领取</Tag>
          </List.Item>
        )} />
      )}
    </Card>
  );
}
