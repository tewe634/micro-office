import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workflowTemplateApi } from '../../api';

type WorkflowTemplateStatus = 'ACTIVE' | 'DISABLED';

const statusOptions: Array<{ value: WorkflowTemplateStatus; label: string }> = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'DISABLED', label: 'DISABLED' },
];

function statusTagColor(status: WorkflowTemplateStatus) {
  return status === 'ACTIVE' ? 'green' : 'default';
}

export default function AdminWorkflowTemplatePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [sceneOptions, setSceneOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [sceneCategory, setSceneCategory] = useState<string | undefined>();
  const [status, setStatus] = useState<WorkflowTemplateStatus | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const loadPackages = async (nextSceneCategory = sceneCategory, nextStatus = status) => {
    setLoading(true);
    try {
      const response: any = await workflowTemplateApi.listPackages({
        sceneCategory: nextSceneCategory,
        status: nextStatus,
      });
      const records = response.data || [];
      setPackages(records);
      const sceneSet = new Set<string>();
      records.forEach((item: any) => {
        if (item.scene_category) sceneSet.add(item.scene_category);
      });
      setSceneOptions(Array.from(sceneSet).sort().map(item => ({ value: item, label: item })));
    } catch (error: any) {
      message.error(error?.response?.data?.message || '模板包列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPackages();
  }, []);

  const filteredPackages = useMemo(() => {
    return packages.filter((item) => {
      if (sceneCategory && item.scene_category !== sceneCategory) return false;
      if (status && item.status !== status) return false;
      return true;
    });
  }, [packages, sceneCategory, status]);

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    try {
      const response: any = await workflowTemplateApi.createPackage({
        name: values.name,
        scene_category: values.scene_category,
        description: values.description || '',
        status: values.status as WorkflowTemplateStatus,
        sort_order: values.sort_order ?? 100,
        tags: [],
        meta: {},
      });
      message.success('模板包已创建');
      setCreateOpen(false);
      createForm.resetFields();
      await loadPackages();
      if (response.data?.id) {
        nav(`/admin/workflow-templates/${response.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建模板包失败');
    }
  };

  const handleUpdateStatus = async (record: any, nextStatus: WorkflowTemplateStatus) => {
    try {
      await workflowTemplateApi.updatePackageStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '模板包已启用（ACTIVE）' : '模板包已停用（DISABLED）');
      await loadPackages();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态更新失败');
    }
  };

  const handleCopy = async (record: any) => {
    try {
      const response: any = await workflowTemplateApi.copyPackage(record.id, { name: `${record.name}-副本` });
      message.success('模板包已复制');
      await loadPackages();
      if (response.data?.id) {
        nav(`/admin/workflow-templates/${response.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '复制模板包失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="工作流模板包"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPackages(sceneCategory, status)}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建模板包</Button>
          </Space>
        )}
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12 }}
      >
        <div className="page-toolbar" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Select
              allowClear
              placeholder="按场景筛选"
              value={sceneCategory}
              style={{ minWidth: 220 }}
              options={sceneOptions}
              onChange={(value) => setSceneCategory(value)}
            />
            <Select
              allowClear
              placeholder="按状态筛选"
              value={status}
              style={{ width: 180 }}
              options={statusOptions}
              onChange={(value) => setStatus(value)}
            />
          </Space>
        </div>

        <div className="page-card-scroll">
          <Table
            loading={loading}
            rowKey="id"
            size="middle"
            dataSource={filteredPackages}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1200 }}
            columns={[
              {
                title: '模板包',
                width: 280,
                render: (_: unknown, row: any) => (
                  <div>
                    <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => nav(`/admin/workflow-templates/${row.id}`)}>
                      {row.name}
                    </Button>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{row.id}</div>
                  </div>
                ),
              },
              { title: '场景分类', dataIndex: 'scene_category', width: 180 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 120,
                render: (value: WorkflowTemplateStatus) => <Tag color={statusTagColor(value)}>{value}</Tag>,
              },
              { title: '排序值', dataIndex: 'sort_order', width: 100 },
              { title: '版本', dataIndex: 'version', width: 90 },
              { title: '更新时间', dataIndex: 'updated_at', width: 200 },
              {
                title: '操作',
                width: 320,
                fixed: 'right',
                render: (_: unknown, row: any) => (
                  <Space wrap>
                    <Button size="small" onClick={() => nav(`/admin/workflow-templates/${row.id}`)}>节点编排</Button>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(row)}>复制</Button>
                    {row.status === 'ACTIVE' ? (
                      <Popconfirm
                        title="确认停用该模板包？"
                        description="停用后将无法用于新建流程实例。"
                        okText="停用"
                        cancelText="取消"
                        onConfirm={() => void handleUpdateStatus(row, 'DISABLED')}
                      >
                        <Button size="small">停用</Button>
                      </Popconfirm>
                    ) : (
                      <Popconfirm
                        title="确认启用该模板包？"
                        description="启用后可用于新建流程实例。"
                        okText="启用"
                        cancelText="取消"
                        onConfirm={() => void handleUpdateStatus(row, 'ACTIVE')}
                      >
                        <Button size="small" type="primary">启用</Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <Modal
        title="新建工作流模板包"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => void handleCreate()}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ status: 'DISABLED', sort_order: 100 }}
        >
          <Form.Item name="name" label="模板包名称" rules={[{ required: true, message: '请输入模板包名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scene_category" label="场景分类" rules={[{ required: true, message: '请输入场景分类' }]}>
            <Input placeholder="例如 SALES_COLLAB" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item name="sort_order" label="排序">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
