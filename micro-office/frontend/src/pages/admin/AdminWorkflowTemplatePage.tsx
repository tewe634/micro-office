import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { WorkflowTemplatePackageSummary, WorkflowTemplatePositionOption, WorkflowTemplateStatus } from '../../api';
import { workflowTemplateApi } from '../../api';

const positionLabel = (record: WorkflowTemplatePackageSummary) => {
  const names = record.positionNames?.filter(Boolean) || [];
  if (names.length > 0) {
    return names.join('、');
  }
  if (record.positionName) {
    return record.positionName;
  }
  return null;
};

export default function AdminWorkflowTemplatePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<WorkflowTemplatePackageSummary[]>([]);
  const [positionOptions, setPositionOptions] = useState<WorkflowTemplatePositionOption[]>([]);
  const [status, setStatus] = useState<WorkflowTemplateStatus | undefined>(undefined);
  const [positionId, setPositionId] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkflowTemplatePackageSummary | null>(null);
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
    return [...packages]
      .filter((item) => {
        if (status && item.status !== status) return false;
        if (positionId && !(item.positionIds || []).includes(positionId)) return false;
        return true;
      })
      .sort((a, b) => {
        const sortDiff = (a.sortOrder ?? 100) - (b.sortOrder ?? 100);
        if (sortDiff !== 0) return sortDiff;
        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      });
  }, [packages, positionId, status]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ sortOrder: 100, positionIds: [] });
    setModalOpen(true);
  };

  const openEditModal = (record: WorkflowTemplatePackageSummary) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      positionIds: record.positionIds || (record.positionId ? [record.positionId] : []),
      description: record.description,
      sortOrder: record.sortOrder ?? 100,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingRecord) {
        await workflowTemplateApi.updatePackage(editingRecord.id, {
          name: values.name,
          positionIds: values.positionIds,
          description: values.description,
          sortOrder: values.sortOrder ?? 100,
        });
        message.success('模板包基础信息已更新');
      } else {
        const response: any = await workflowTemplateApi.createPackage({
          name: values.name,
          positionIds: values.positionIds,
          description: values.description,
          sortOrder: values.sortOrder ?? 100,
        });
        message.success('模板包已创建（默认停用）');
        if (response.data?.id) {
          nav(`/admin/workflow-templates/${response.data.id}`);
        }
      }
      closeModal();
      await loadPage();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || (editingRecord ? '模板包更新失败' : '模板包创建失败'));
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

  const handleDelete = async (record: WorkflowTemplatePackageSummary) => {
    try {
      await workflowTemplateApi.deletePackage(record.id);
      message.success(`模板包“${record.name}”已删除`);
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '模板包删除失败');
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
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
          scroll={{ x: 1180 }}
          columns={[
            { title: '模板名称', dataIndex: 'name', width: 220, ellipsis: true },
            {
              title: '关联岗位',
              dataIndex: 'positionNames',
              width: 320,
              render: (_: any, row: WorkflowTemplatePackageSummary) => positionLabel(row) || <span style={{ color: '#999' }}>未绑定</span>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: WorkflowTemplateStatus) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value === 'ACTIVE' ? '启用' : '停用'}</Tag>,
            },
            { title: '排序值', dataIndex: 'sortOrder', width: 100 },
            {
              title: '操作',
              key: 'action',
              width: 380,
              fixed: 'right',
              render: (_: any, row: WorkflowTemplatePackageSummary) => (
                <Space wrap>
                  <Button type="link" onClick={() => nav(`/admin/workflow-templates/${row.id}`)}>
                    编排
                  </Button>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(row)}>
                    编辑
                  </Button>
                  <Button type="link" icon={<CopyOutlined />} onClick={() => void handleCopy(row)}>
                    复制
                  </Button>
                  <Popconfirm
                    title="删除模板包"
                    description={`确定删除“${row.name}”吗？对应节点编排也会一起删除。`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void handleDelete(row)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
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
        title={editingRecord ? '编辑模板包' : '新建工作流模板包'}
        open={modalOpen}
        confirmLoading={saving}
        onOk={() => void handleSubmit()}
        onCancel={closeModal}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ sortOrder: 100, positionIds: [] }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={64} placeholder="例如：销售经理跟单流" />
          </Form.Item>
          <Form.Item
            name="positionIds"
            label="关联岗位"
            rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一个岗位' }]}
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="选择这个模板适用的岗位，可多选"
              optionFilterProp="label"
              options={positionOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={300} placeholder="说明这些岗位适用的工作流模板" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
