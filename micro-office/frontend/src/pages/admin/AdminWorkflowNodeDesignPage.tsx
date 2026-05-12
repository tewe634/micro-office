import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { WorkflowNodeDesignSummary, WorkflowTemplateStatus } from '../../api';
import { workflowNodeDesignApi } from '../../api';
import FixedTablePage from '../../components/FixedTablePage';
import { formatPaginationTotal, formatWorkflowNodeTypeLabel, paginationLocale } from '../../constants/ui';

export default function AdminWorkflowNodeDesignPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<WorkflowTemplateStatus | undefined>(undefined);
  const [records, setRecords] = useState<WorkflowNodeDesignSummary[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkflowNodeDesignSummary | null>(null);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form] = Form.useForm();

  const loadList = async () => {
    setLoading(true);
    try {
      const response: any = await workflowNodeDesignApi.list({ keyword, status });
      const next = Array.isArray(response.data) ? response.data : response.data?.records || [];
      setRecords(next);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点设计列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, [keyword, status]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')),
    [records],
  );

  const pagedRecords = useMemo(() => {
    const start = (current - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [current, sortedRecords, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
    if (current > totalPages) {
      setCurrent(totalPages);
    }
  }, [current, sortedRecords.length, pageSize]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ nodeType: 'TASK', version: 1 });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        moduleDefinitionId: values.moduleDefinitionId || undefined,
        name: values.name,
        code: values.code,
        nodeType: values.nodeType,
        version: values.version ?? 1,
      };
      if (editingRecord) {
        await workflowNodeDesignApi.update(editingRecord.id, payload);
        message.success('节点定义已更新');
      } else {
        await workflowNodeDesignApi.create(payload);
        message.success('节点定义已创建');
      }
      closeModal();
      await loadList();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || (editingRecord ? '节点定义更新失败' : '节点定义创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (record: WorkflowNodeDesignSummary, nextStatus: WorkflowTemplateStatus) => {
    try {
      await workflowNodeDesignApi.updateStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '节点已启用' : '节点已停用');
      await loadList();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点状态更新失败');
    }
  };

  const handleDelete = async (record: WorkflowNodeDesignSummary) => {
    try {
      await workflowNodeDesignApi.delete(record.id);
      message.success(`节点“${record.name}”已删除`);
      await loadList();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点删除失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="节点设计"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建节点
          </Button>
        }
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12 }}
      >
        <FixedTablePage
          top={
            <div className="page-toolbar">
              <Space wrap>
                <Input
                  allowClear
                  placeholder="按节点名称 / 编码筛选"
                  style={{ width: 260 }}
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value || undefined);
                    setCurrent(1);
                  }}
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
                <Button onClick={() => void loadList()}>刷新列表</Button>
              </Space>
            </div>
          }
          table={
            <Table
              rowKey="id"
              loading={loading}
              size="small"
              pagination={false}
              dataSource={pagedRecords}
              tableLayout="fixed"
              scroll={{ x: 1320, y: 'calc(100dvh - 360px)' }}
              columns={[
                {
                  title: '序号',
                  key: 'index',
                  width: 72,
                  fixed: 'left',
                  render: (_: unknown, __: WorkflowNodeDesignSummary, index: number) => (current - 1) * pageSize + index + 1,
                },
                {
                  title: '节点名称',
                  dataIndex: 'name',
                  width: 220,
                  fixed: 'left',
                  render: (value: string, row: WorkflowNodeDesignSummary) => (
                    <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => nav(`/admin/workflow-node-designs/${row.id}`)}>
                      {value}
                    </Button>
                  ),
                },
                { title: '节点编码', dataIndex: 'code', width: 180 },
                { title: '节点类型', dataIndex: 'nodeType', width: 140, render: (value: string) => formatWorkflowNodeTypeLabel(value) },
                { title: '模块定义 ID', dataIndex: 'moduleDefinitionId', width: 220, ellipsis: true, render: (value?: string | null) => value || '-' },
                { title: '版本号', dataIndex: 'version', width: 100, render: (value?: number) => value ?? 1 },
                { title: '状态', dataIndex: 'status', width: 100, render: (value: WorkflowTemplateStatus) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value === 'ACTIVE' ? '启用' : '停用'}</Tag> },
                {
                  title: '操作',
                  width: 320,
                  fixed: 'right',
                  render: (_: unknown, row: WorkflowNodeDesignSummary) => (
                    <Space wrap>
                      <Button type="link" onClick={() => nav(`/admin/workflow-node-designs/${row.id}`)}>查看</Button>
                      <Button type="link" icon={<EditOutlined />} onClick={() => nav(`/admin/workflow-node-designs/${row.id}`)}>编辑</Button>
                      {row.status === 'ACTIVE' ? (
                        <Button type="link" danger onClick={() => void handleUpdateStatus(row, 'DISABLED')}>停用</Button>
                      ) : (
                        <Button type="link" onClick={() => void handleUpdateStatus(row, 'ACTIVE')}>启用</Button>
                      )}
                      <Popconfirm
                        title="删除节点定义"
                        description={`确定删除“${row.name}”吗？`}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => void handleDelete(row)}
                      >
                        <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          }
          pagination={
            <Pagination
              locale={paginationLocale}
              current={current}
              pageSize={pageSize}
              total={sortedRecords.length}
              showSizeChanger
              showQuickJumper
              pageSizeOptions={['10', '20', '50', '100']}
              showTotal={formatPaginationTotal}
              onChange={(page, size) => {
                setCurrent(page);
                setPageSize(size);
              }}
            />
          }
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑节点定义' : '新建节点定义'}
        open={modalOpen}
        confirmLoading={saving}
        onOk={() => void handleSubmit()}
        onCancel={closeModal}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="moduleDefinitionId" label="模块定义 ID">
            <Input maxLength={64} placeholder="可选" />
          </Form.Item>
          <Form.Item name="name" label="节点名称" rules={[{ required: true, message: '请输入节点名称' }]}> 
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="code" label="节点编码" rules={[{ required: true, message: '请输入节点编码' }]}> 
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="nodeType" label="节点类型" rules={[{ required: true, message: '请输入节点类型' }]}> 
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="version" label="版本号">
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
