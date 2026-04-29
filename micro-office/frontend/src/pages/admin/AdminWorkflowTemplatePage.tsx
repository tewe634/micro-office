import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { WorkflowTemplatePackageSummary, WorkflowTemplatePositionOption, WorkflowTemplateStatus } from '../../api';
import { workflowTemplateApi } from '../../api';

export default function AdminWorkflowTemplatePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<WorkflowTemplatePackageSummary[]>([]);
  const [positionOptions, setPositionOptions] = useState<WorkflowTemplatePositionOption[]>([]);
  const [status, setStatus] = useState<WorkflowTemplateStatus | undefined>(undefined);
  const [positionId, setPositionId] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadPage = async () => {
    setLoading(true);
    try {
      const [packagesResponse, positionsResponse]: any = await Promise.all([
        workflowTemplateApi.listPackages(),
        workflowTemplateApi.listPositions(),
      ]);
      setPackages(packagesResponse.data || []);
      setPositionOptions(positionsResponse.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '工作流模板包加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const filteredPackages = useMemo(() => {
    return packages.filter((item) => {
      if (status && item.status !== status) return false;
      if (positionId && item.positionId !== positionId) return false;
      return true;
    });
  }, [packages, positionId, status]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const response: any = await workflowTemplateApi.createPackage({
        name: values.name,
        positionId: values.positionId,
        description: values.description,
        sortOrder: values.sortOrder ?? 100,
      });
      message.success('模板包已创建（默认停用）');
      setCreateOpen(false);
      form.resetFields();
      await loadPage();
      if (response.data?.id) {
        nav(`/admin/workflow-templates/${response.data.id}`);
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || '模板包创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (record: WorkflowTemplatePackageSummary, nextStatus: WorkflowTemplateStatus) => {
    try {
      await workflowTemplateApi.updatePackageStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '模板包已启用' : '模板包已停用');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态更新失败');
    }
  };

  const handleCopy = async (record: WorkflowTemplatePackageSummary) => {
    try {
      const response: any = await workflowTemplateApi.copyPackage(record.id);
      message.success('模板包已复制');
      await loadPage();
      if (response.data?.id) {
        nav(`/admin/workflow-templates/${response.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '模板包复制失败');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card
        title="工作流模板管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadPage()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ sortOrder: 100 });
                setCreateOpen(true);
              }}
            >
              新建模板包
            </Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="按岗位筛选"
            style={{ width: 220 }}
            value={positionId}
            onChange={(value) => setPositionId(value)}
            options={positionOptions.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 180 }}
            value={status}
            onChange={(value) => setStatus(value)}
            options={[
              { label: '启用', value: 'ACTIVE' },
              { label: '停用', value: 'DISABLED' },
            ]}
          />
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredPackages}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
          columns={[
            { title: '模板名称', dataIndex: 'name', width: 220, ellipsis: true },
            {
              title: '关联岗位',
              dataIndex: 'positionName',
              width: 220,
              render: (_: any, row: WorkflowTemplatePackageSummary) => row.positionName || <span style={{ color: '#999' }}>未绑定</span>,
            },
            {
              title: '原场景字段',
              dataIndex: 'sceneCategory',
              width: 160,
              ellipsis: true,
              render: (value?: string | null) => value || <span style={{ color: '#999' }}>—</span>,
            },
            { title: '描述', dataIndex: 'description', ellipsis: true },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: WorkflowTemplateStatus) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value}</Tag>,
            },
            { title: '排序值', dataIndex: 'sortOrder', width: 100 },
            {
              title: '操作',
              key: 'action',
              width: 260,
              fixed: 'right',
              render: (_: any, row: WorkflowTemplatePackageSummary) => (
                <Space wrap>
                  <Button type="link" icon={<EditOutlined />} onClick={() => nav(`/admin/workflow-templates/${row.id}`)}>
                    编排
                  </Button>
                  <Button type="link" icon={<CopyOutlined />} onClick={() => void handleCopy(row)}>
                    复制
                  </Button>
                  {row.status === 'ACTIVE' ? (
                    <Button type="link" danger onClick={() => void handleUpdateStatus(row, 'DISABLED')}>
                      停用
                    </Button>
                  ) : (
                    <Button type="link" onClick={() => void handleUpdateStatus(row, 'ACTIVE')}>
                      启用
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新建工作流模板包"
        open={createOpen}
        confirmLoading={saving}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ sortOrder: 100 }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={64} placeholder="例如：销售经理跟单流" />
          </Form.Item>
          <Form.Item name="positionId" label="关联岗位" rules={[{ required: true, message: '请选择岗位' }]}>
            <Select
              showSearch
              placeholder="选择这个模板面向的岗位"
              optionFilterProp="label"
              options={positionOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={300} placeholder="说明这个岗位适用的工作流模板" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
