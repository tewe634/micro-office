import { useEffect, useState } from 'react';
import { Tabs, List, Tag, Button, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { workbenchApi } from '../../api';

export default function WorkbenchPage() {
  const [activeData, setActiveData] = useState<any[]>([]);
  const [doneData, setDoneData] = useState<any[]>([]);
  const [todoData, setTodoData] = useState<any[]>([]);
  const nav = useNavigate();

  const load = async (view: string, setter: Function) => {
    const res: any = await workbenchApi.get(view);
    setter(res.data.threads || res.data.nodes || []);
  };

  useEffect(() => { load('active', setActiveData); }, []);

  const statusColor: Record<string, string> = { ACTIVE: 'blue', COMPLETED: 'green', IN_PROGRESS: 'processing', PENDING_NEXT: 'warning' };

  const renderList = (data: any[], isNode = false) => (
    <List dataSource={data} renderItem={(item: any) => (
      <List.Item actions={[<Button type="link" onClick={() => nav(isNode ? `/threads/${item.threadId}` : `/threads/${item.id}`)}>查看</Button>]}>
        <List.Item.Meta title={isNode ? item.name : item.title} description={isNode ? `负责人ID: ${item.ownerId}` : `创建时间: ${item.createdAt}`} />
        <Tag color={statusColor[item.status]}>{item.status}</Tag>
      </List.Item>
    )} />
  );

  return (
    <Card title="工作台">
      <Tabs items={[
        { key: 'active', label: '进行中工作', children: renderList(activeData) },
        { key: 'done', label: '已完成工作', children: renderList(doneData) },
        { key: 'todo', label: '待办工作', children: renderList(todoData, true) },
      ]} onChange={key => {
        if (key === 'active') load('active', setActiveData);
        if (key === 'done') load('done', setDoneData);
        if (key === 'todo') load('todo', setTodoData);
      }} />
    </Card>
  );
}
