import { useEffect, useState } from 'react';
import { Card, List, Tag, Button, Modal, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { workbenchApi, threadApi } from '../../api';

export default function ThreadListPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();
  const nav = useNavigate();

  const load = async () => { const r: any = await workbenchApi.get('active'); setThreads(r.data.threads || []); };
  useEffect(() => { load(); }, []);

  const create = async (values: any) => {
    await threadApi.create(values);
    message.success('创建成功'); setModal(false); form.resetFields(); load();
  };

  return (
    <Card title="工作列表" extra={<Button type="primary" onClick={() => { form.resetFields(); setModal(true); }}>新建工作</Button>}>
      <List dataSource={threads} renderItem={(item: any) => (
        <List.Item actions={[<Button type="link" onClick={() => nav(`/threads/${item.id}`)}>查看详情</Button>]}>
          <List.Item.Meta title={item.title} description={`创建时间: ${item.createdAt}`} />
          <Tag color={item.status === 'ACTIVE' ? 'blue' : 'green'}>{item.status === 'ACTIVE' ? '进行中' : '已完成'}</Tag>
        </List.Item>
      )} />
      <Modal title="新建工作" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={create} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="content" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
