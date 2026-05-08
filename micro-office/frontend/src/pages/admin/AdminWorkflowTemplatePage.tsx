import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { WorkflowTemplatePackageSummary, WorkflowTemplatePositionOption, WorkflowTemplateStatus } from '../../api';
import { workflowTemplateApi } from '../../api';
import { formatPaginationTotal, paginationLocale } from '../../constants/ui';

const positionLabel = (record: WorkflowTemplatePackageSummary) => {
  const names = record.positionNames?.filter(Boolean) || [];
  if (names.length > 0) return names.join('、');
  if (record.positionName) return record.positionName;
  return '未绑定';
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
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
      message.error(error?.response?.data?.message || '工作流模板加载失败');
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

  const pagedPackages = useMemo(() => {
    const start = (current - 1) * pageSize;
    return filteredPackages.slice(start, start + pageSize);
  }, [current, filteredPackages, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredPackages.length / pageSize));
    if (current > totalPages) {
      setCurrent(totalPages);
    }
  }, [current, filteredPackages.length, pageSize]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      sortOrder: 100,
      positionIds: [],
      allowCreateAsNormal: true,
      allowCreateAsSubflow: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (record: WorkflowTemplatePackageSummary) => {
    setEditingRecord(record);
    form.setFieldsValue({
      name: record.name,
      positionIds: record.positionIds || [],
      description: record.description,
      sortOrder: record.sortOrder ?? 100,
      allowCreateAsNormal: record.allowCreateAsNormal ?? true,
      allowCreateAsSubflow: record.allowCreateAsSubflow ?? false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        positionIds: values.positionIds || [],
        description: values.description,
        sortOrder: values.sortOrder ?? 100,
        allowCreateAsNormal: values.allowCreateAsNormal ?? true,
        allowCreateAsSubflow: values.allowCreateAsSubflow ?? false,
      };
      if (editingRecord) {
        await workflowTemplateApi.updatePackage(editingRecord.id, payload);
        message.success('工作流模板基础信息已更新');
      } else {
        const response: any = await workflowTemplateApi.createPackage(payload);
        message.success('工作流模板已创建（默认停用）');
        if (response.data?.id) {
          nav(`/admin/workflow-templates/${response.data.id}`);
        }
      }
      closeModal();
      await loadPage();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || (editingRecord ? '工作流模板更新失败' : '工作流模板创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (record: WorkflowTemplatePackageSummary, nextStatus: WorkflowTemplateStatus) => {
    try {
      await workflowTemplateApi.updatePackageStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '工作流模板已启用' : '工作流模板已停用');
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态更新失败');
    }
  };

  const handleDelete = async (record: WorkflowTemplatePackageSummary) => {
    try {
      await workflowTemplateApi.deletePackage(record.id);
      message.success(`工作流模板“${record.name}”已删除`);
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '工作流模板删除失败');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card
        title="流程管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建工作流模板
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="按岗位筛选"
            style={{ width: 220 }}
            value={positionId}
            onChange={(value) => {
              setPositionId(value);
              setCurrent(1);
            }}
            options={positionOptions.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 180 }}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setCurrent(1);
            }}
            options={[
              { label: '启用', value: 'ACTIVE' },
              { label: '停用', value: 'DISABLED' },
            ]}
          />
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={pagedPackages}
          pagination={{
            current,
            pageSize,
            total: filteredPackages.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: formatPaginationTotal,
            locale: paginationLocale,
            onChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            },
            onShowSizeChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            },
          }}
          scroll={{ x: 1280 }}
          columns={[
            { title: '模板名称', dataIndex: 'name', width: 220, ellipsis: true },
            {
              title: '关联岗位',
              dataIndex: 'positionNames',
              width: 260,
              render: (_: any, row: WorkflowTemplatePackageSummary) => positionLabel(row),
            },
            {
              title: '创建方式',
              key: 'createModes',
              width: 180,
              render: (_: any, row: WorkflowTemplatePackageSummary) => (
                <Space wrap>
                  {row.allowCreateAsNormal ? <Tag color="blue">普通流程</Tag> : null}
                  {row.allowCreateAsSubflow ? <Tag color="gold">子流程</Tag> : null}
                </Space>
              ),
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
              width: 360,
              fixed: 'right',
              render: (_: any, row: WorkflowTemplatePackageSummary) => (
                <Space wrap>
                  <Button type="link" onClick={() => nav(`/admin/workflow-templates/${row.id}`)}>
                    编辑节点
                  </Button>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(row)}>
                    编辑模板
                  </Button>
                  <Popconfirm
                    title="删除工作流模板"
                    description={`确定删除“${row.name}”吗？对应节点配置也会一起删除。`}
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
        title={editingRecord ? '编辑工作流模板' : '新建工作流模板'}
        open={modalOpen}
        confirmLoading={saving}
        onOk={() => void handleSubmit()}
        onCancel={closeModal}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={64} placeholder="例如：销售经理跟单流" />
          </Form.Item>
          {!editingRecord ? (
            <Form.Item label="模板编码">
              <Input value="系统自动生成" disabled />
            </Form.Item>
          ) : null}
          <Form.Item name="positionIds" label="关联岗位">
            <Select
              mode="multiple"
              showSearch
              placeholder="可选，留空表示全局模板"
              optionFilterProp="label"
              options={positionOptions.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item name="description" label="模板说明">
            <Input.TextArea rows={3} maxLength={300} placeholder="说明该模板适用于什么场景" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序值">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="allowCreateAsNormal" label="允许创建为普通工作流" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allowCreateAsSubflow" label="允许创建为子工作流" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
