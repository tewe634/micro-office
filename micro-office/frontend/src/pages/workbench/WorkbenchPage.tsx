import { useEffect, useState } from 'react';
import { Tabs, List, Tag, Button, Card, Modal, Form, Input, Select, Badge, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workbenchApi, threadApi, objectApi, productApi, templateApi, userApi } from '../../api';

const statusColor: Record<string, string> = { ACTIVE: 'blue', COMPLETED: 'green', CANCELLED: 'default', IN_PROGRESS: 'processing', PENDING_NEXT: 'warning' };
const statusLabel: Record<string, string> = { ACTIVE: '进行中', COMPLETED: '已完成', CANCELLED: '已取消', IN_PROGRESS: '进行中', PENDING_NEXT: '待处理' };

export default function WorkbenchPage() {
  const [data, setData] = useState<any>({ threads: [], todoNodes: [], counts: {} });
  const [view, setView] = useState('todo');
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const [objects, setObjects] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const nav = useNavigate();

  const load = async (v?: string) => {
    const res: any = await workbenchApi.get(v || view);
    setData(res.data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = async () => {
    form.resetFields();
    const [o, p, t, u] = await Promise.allSettled([objectApi.list(), productApi.list(), templateApi.list(), userApi.lookups()]);
    setObjects(o.status === 'fulfilled' ? (o.value as any).data || [] : []);
    setProducts(p.status === 'fulfilled' ? (p.value as any).data || [] : []);
    setTemplates(t.status === 'fulfilled' ? (t.value as any).data || [] : []);
    setUsers(u.status === 'fulfilled' ? (u.value as any).data?.users || [] : []);
    setModal(true);
  };

  const createThread = async (values: any) => {
    await threadApi.create(values);
    message.success('工作流创建成功');
    setModal(false);
    load();
  };

  const c = data.counts || {};

  return (
    <Card title="工作台" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建工作流</Button>}>
      <Tabs activeKey={view} onChange={v => { setView(v); load(v); }} items={[
        { key: 'todo', label: <Badge count={c.todo} size="small" offset={[8, 0]}>待办</Badge> },
        { key: 'active', label: <Badge count={c.active} size="small" offset={[8, 0]} color="blue">进行中</Badge> },
        { key: 'completed', label: <Badge count={c.completed} size="small" offset={[8, 0]} color="green">已完成</Badge> },
        { key: 'cancelled', label: <Badge count={c.cancelled} size="small" offset={[8, 0]} color="gray">已取消</Badge> },
      ]} />

      {view === 'todo' && (
        <List dataSource={data.todoNodes} locale={{ emptyText: '暂无待办' }} renderItem={(item: any) => (
          <List.Item actions={[<Button type="link" onClick={() => nav(`/threads/${item.thread_id}`)}>处理</Button>]}>
            <List.Item.Meta title={<><Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag> {item.name}</>}
              description={item.thread_title} />
          </List.Item>
        )} />
      )}

      {view !== 'todo' && <List dataSource={data.threads} locale={{ emptyText: '暂无数据' }} renderItem={(item: any) => (
        <List.Item actions={[<Button type="link" onClick={() => nav(`/threads/${item.id}`)}>查看</Button>]}>
          <List.Item.Meta
            title={<>{item.title} {item.object_name && <Tag color="orange">{item.object_name}</Tag>}</>}
            description={`${item.creator_name} · ${new Date(item.created_at).toLocaleString('zh-CN')}`} />
          <Tag color={statusColor[item.status]}>{statusLabel[item.status]}</Tag>
        </List.Item>
      )} />}

      <Modal title="新建工作流" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={500}>
        <Form form={form} onFinish={createThread} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="templateId" label="流程模板">
            <Select allowClear placeholder="选择模板" options={templates.map(t => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="objectId" label="关联外部对象">
            <Select allowClear showSearch optionFilterProp="label" placeholder="选择对象"
              options={objects.map(o => ({ value: o.id, label: `[${o.type}] ${o.name}` }))} />
          </Form.Item>
          <Form.Item name="productId" label="关联产品">
            <Select allowClear showSearch optionFilterProp="label" placeholder="选择产品"
              options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="assignToUserId" label="指派处理人" rules={[{ required: true, message: '请选择处理人' }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择处理人"
              options={users.map(u => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="firstNodeName" label="任务名称">
            <Input placeholder="默认：发起处理" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
