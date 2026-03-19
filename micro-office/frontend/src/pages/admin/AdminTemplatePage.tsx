import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Tag } from 'antd';
import { adminApi } from '../../api';
import { uiText } from '../../constants/ui';

export default function AdminTemplatePage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [nodeModal, setNodeModal] = useState<{ open: boolean; templateId: number | null }>({ open: false, templateId: null });
  const [nodes, setNodes] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [nodeForm] = Form.useForm();

  const load = async () => { const r: any = await adminApi.listTemplates(); setTemplates(r.data || []); };
  useEffect(() => { load(); }, []);

  const save = async (values: any) => {
    await adminApi.createTemplate(values);
    message.success('创建成功'); setModal(false); form.resetFields(); load();
  };

  const loadNodes = async (templateId: number) => {
    const r: any = await adminApi.templateNodes(templateId);
    setNodes(r.data || []);
    setNodeModal({ open: true, templateId });
  };

  const addNode = async (values: any) => {
    if (!nodeModal.templateId) return;
    await adminApi.addTemplateNode(nodeModal.templateId, values);
    message.success('节点已添加'); nodeForm.resetFields(); loadNodes(nodeModal.templateId);
  };

  return (
    <Card title="流程模板管理" extra={<Button type="primary" onClick={() => { form.resetFields(); setModal(true); }}>新增模板</Button>}>
      <Table dataSource={templates} rowKey="id" showSorterTooltip={false} columns={[
        { title: '序号', key: 'index', width: 60, sorter: (_a: any, _b: any) => 0, render: (_: any, __: any, index: number) => index + 1 },
        { title: '模板名称', dataIndex: 'name' },
        { title: '描述', dataIndex: 'description' },
        { title: '操作', render: (_: any, r: any) => (
          <Space>
            <Button size="small" onClick={() => loadNodes(r.id)}>管理节点</Button>
            <Popconfirm title={uiText.deleteConfirm} onConfirm={async () => { await adminApi.deleteTemplate(r.id); message.success('已删除'); load(); }}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          </Space>
        )},
      ]} />

      <Modal title="新增流程模板" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input placeholder="如：销售全流程" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>

      <Modal title="模板节点管理" open={nodeModal.open} onCancel={() => setNodeModal({ open: false, templateId: null })} footer={null} width={600}>
        <div style={{ marginBottom: 16 }}>
          {nodes.map((n: any, i: number) => (
            <Tag key={n.id} color="blue" style={{ marginBottom: 4 }}>{i + 1}. {n.name}</Tag>
          ))}
          {nodes.length === 0 && <span style={{ color: '#999' }}>{uiText.noNodeRecords}</span>}
        </div>
        <Form form={nodeForm} onFinish={addNode} layout="inline">
          <Form.Item name="name" rules={[{ required: true, message: '请输入节点名称' }]}><Input placeholder="节点名称" /></Form.Item>
          <Form.Item name="sortOrder"><InputNumber placeholder="排序" /></Form.Item>
          <Button type="primary" htmlType="submit">添加节点</Button>
        </Form>
      </Modal>
    </Card>
  );
}
