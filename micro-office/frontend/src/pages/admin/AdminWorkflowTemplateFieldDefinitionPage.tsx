import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { WorkflowTemplateFieldDefinition } from '../../api';
import { workflowTemplateApi } from '../../api';
import { formatPaginationTotal, paginationLocale } from '../../constants/ui';

const fieldTypeOptions = [
  { label: 'string', value: 'string' },
  { label: 'text', value: 'text' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'date', value: 'date' },
  { label: 'datetime', value: 'datetime' },
  { label: 'list', value: 'list' },
  { label: 'json', value: 'json' },
];

const listChildFieldTypeOptions = fieldTypeOptions.filter((item) => item.value !== 'list');

type ListChildFieldDraft = {
  fieldKey: string;
  name: string;
  fieldType: string;
  required: boolean;
  sortOrder: number;
  description?: string;
};

function createListChildFieldDraft(sortOrder: number): ListChildFieldDraft {
  return {
    fieldKey: '',
    name: '',
    fieldType: 'string',
    required: false,
    sortOrder,
    description: '',
  };
}

export default function AdminWorkflowTemplateFieldDefinitionPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState<string | undefined>(undefined);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [records, setRecords] = useState<WorkflowTemplateFieldDefinition[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkflowTemplateFieldDefinition | null>(null);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listChildFields, setListChildFields] = useState<ListChildFieldDraft[]>([]);
  const [form] = Form.useForm();
  const fieldType = Form.useWatch('fieldType', form);

  const loadPage = async () => {
    setLoading(true);
    try {
      const response: any = await workflowTemplateApi.listFieldDefinitions({ keyword, enabled });
      const next = Array.isArray(response.data) ? response.data : response.data?.records || [];
      setRecords(next);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '字段字典加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [keyword, enabled]);

  const filteredRecords = useMemo(
    () => [...records].sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100) || a.fieldKey.localeCompare(b.fieldKey, 'zh-CN')),
    [records],
  );

  const pagedRecords = useMemo(() => {
    const start = (current - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [current, filteredRecords, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    if (current > totalPages) {
      setCurrent(totalPages);
    }
  }, [current, filteredRecords.length, pageSize]);

  useEffect(() => {
    if (fieldType !== 'list' && listChildFields.length > 0) {
      setListChildFields([]);
    }
  }, [fieldType, listChildFields.length]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setListChildFields([]);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      fieldType: 'string',
      enabled: true,
      sensitive: false,
      displayOrder: 100,
    });
    setListChildFields([]);
    setModalOpen(true);
  };

  const openEditModal = (record: WorkflowTemplateFieldDefinition) => {
    setEditingRecord(record);
    form.setFieldsValue({
      fieldKey: record.fieldKey,
      name: record.name,
      fieldType: record.fieldType,
      description: record.description,
      enabled: record.enabled,
      sensitive: record.sensitive,
      groupKey: record.groupKey,
      displayOrder: record.displayOrder,
    });
    const rawChildFields = Array.isArray(record.meta?.listSubFields) ? record.meta?.listSubFields : [];
    setListChildFields(
      rawChildFields.map((item: any, index: number) => ({
        fieldKey: String(item?.fieldKey || ''),
        name: String(item?.name || ''),
        fieldType: String(item?.fieldType || 'string'),
        required: Boolean(item?.required),
        sortOrder: Number(item?.sortOrder ?? index + 1),
        description: item?.description || '',
      })),
    );
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.fieldType === 'list') {
        if (listChildFields.length === 0) {
          message.error('请至少添加一个列表项子字段');
          return;
        }
        const hasInvalidChildField = listChildFields.some((item) => !item.fieldKey.trim() || !item.name.trim() || !item.fieldType);
        if (hasInvalidChildField) {
          message.error('请补全列表项子字段的 key、名称和类型');
          return;
        }
      }
      setSaving(true);
      const payload = {
        fieldKey: values.fieldKey,
        name: values.name,
        fieldType: values.fieldType,
        description: values.description,
        enabled: values.enabled ?? true,
        sensitive: values.sensitive ?? false,
        groupKey: values.groupKey,
        displayOrder: values.displayOrder ?? 100,
        meta: values.fieldType === 'list'
          ? {
              listSubFields: [...listChildFields]
                .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
                .map((item, index) => ({
                fieldKey: item.fieldKey.trim(),
                name: item.name.trim(),
                fieldType: item.fieldType,
                required: Boolean(item.required),
                sortOrder: Number(item.sortOrder ?? index + 1),
                description: item.description?.trim() || undefined,
              })),
            }
          : undefined,
      };
      if (editingRecord) {
        await workflowTemplateApi.updateFieldDefinition(editingRecord.fieldKey, payload);
        message.success('字段定义已更新');
      } else {
        await workflowTemplateApi.createFieldDefinition(payload);
        message.success('字段定义已创建');
      }
      closeModal();
      await loadPage();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.message || (editingRecord ? '字段定义更新失败' : '字段定义创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: WorkflowTemplateFieldDefinition) => {
    try {
      await workflowTemplateApi.deleteFieldDefinition(record.fieldKey);
      message.success(`字段“${record.name}”已删除`);
      await loadPage();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '字段定义删除失败');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex' }}>
      <Card
        title="流程字段字典"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建字段定义
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            allowClear
            placeholder="按字段 key / 名称筛选"
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
            value={enabled}
            onChange={(value) => {
              setEnabled(value);
              setCurrent(1);
            }}
            options={[
              { label: '启用', value: true },
              { label: '停用', value: false },
            ]}
          />
        </Space>

        <Table
          rowKey="fieldKey"
          loading={loading}
          dataSource={pagedRecords}
          pagination={{
            current,
            pageSize,
            total: filteredRecords.length,
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
            { title: '字段 Key', dataIndex: 'fieldKey', width: 220 },
            { title: '字段名称', dataIndex: 'name', width: 180 },
            { title: '字段类型', dataIndex: 'fieldType', width: 120, render: (value: string) => <Tag>{value}</Tag> },
            { title: '分组', dataIndex: 'groupKey', width: 140, render: (value?: string | null) => value || '-' },
            { title: '排序值', dataIndex: 'displayOrder', width: 100 },
            { title: '敏感字段', dataIndex: 'sensitive', width: 100, render: (value: boolean) => (value ? '是' : '否') },
            { title: '状态', dataIndex: 'enabled', width: 100, render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag> },
            { title: '说明', dataIndex: 'description', ellipsis: true },
            {
              title: '操作',
              key: 'action',
              width: 220,
              fixed: 'right',
              render: (_: unknown, row: WorkflowTemplateFieldDefinition) => (
                <Space wrap>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(row)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除字段定义"
                    description={`确定删除“${row.name}”吗？`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void handleDelete(row)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑字段定义' : '新建字段定义'}
        open={modalOpen}
        confirmLoading={saving}
        onOk={() => void handleSubmit()}
        onCancel={closeModal}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="fieldKey" label="字段 Key" rules={[{ required: true, message: '请输入字段 key' }]}>
            <Input maxLength={64} placeholder="例如 customer_name" disabled={Boolean(editingRecord)} />
          </Form.Item>
          <Form.Item name="name" label="字段名称" rules={[{ required: true, message: '请输入字段名称' }]}>
            <Input maxLength={64} placeholder="例如 客户名称" />
          </Form.Item>
          <Form.Item name="fieldType" label="字段类型" rules={[{ required: true, message: '请选择字段类型' }]}>
            <Select options={fieldTypeOptions} />
          </Form.Item>
          <Form.Item name="groupKey" label="分组 Key">
            <Input maxLength={64} placeholder="可选，例如 customer" />
          </Form.Item>
          <Form.Item name="description" label="字段说明">
            <Input.TextArea rows={3} maxLength={300} placeholder="说明字段用途" />
          </Form.Item>
          <Form.Item name="displayOrder" label="排序值">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sensitive" label="敏感字段" valuePropName="checked">
            <Switch />
          </Form.Item>
          {fieldType === 'list' ? (
            <Form.Item label="列表项字段">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12 }}>
                  子字段将保存到 `meta.listSubFields`，首版不支持子字段再次选择 `list`。
                </div>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(_, index) => `list-child-${index}`}
                  dataSource={listChildFields}
                  scroll={{ x: 960 }}
                  columns={[
                    {
                      title: '子字段 Key',
                      width: 180,
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <Input
                          value={row.fieldKey}
                          onChange={(event) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, fieldKey: event.target.value } : item))}
                        />
                      ),
                    },
                    {
                      title: '子字段名称',
                      width: 180,
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <Input
                          value={row.name}
                          onChange={(event) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                        />
                      ),
                    },
                    {
                      title: '子字段类型',
                      width: 140,
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <Select
                          style={{ width: '100%' }}
                          options={listChildFieldTypeOptions}
                          value={row.fieldType}
                          onChange={(value) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, fieldType: String(value || 'string') } : item))}
                        />
                      ),
                    },
                    {
                      title: '必填',
                      width: 90,
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <Switch
                          checked={Boolean(row.required)}
                          onChange={(checked) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, required: checked } : item))}
                        />
                      ),
                    },
                    {
                      title: '排序',
                      width: 100,
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <InputNumber
                          min={1}
                          precision={0}
                          style={{ width: '100%' }}
                          value={row.sortOrder}
                          onChange={(value) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: Number(value || 1) } : item))}
                        />
                      ),
                    },
                    {
                      title: '说明',
                      render: (_: unknown, row: ListChildFieldDraft, index: number) => (
                        <Input
                          value={row.description}
                          onChange={(event) => setListChildFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                        />
                      ),
                    },
                    {
                      title: '操作',
                      width: 80,
                      render: (_: unknown, _row: ListChildFieldDraft, index: number) => (
                        <Button type="link" danger onClick={() => setListChildFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                          删除
                        </Button>
                      ),
                    },
                  ]}
                />
                <Button icon={<PlusOutlined />} onClick={() => setListChildFields((prev) => [...prev, createListChildFieldDraft(prev.length + 1)])}>
                  添加子字段
                </Button>
              </Space>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </Space>
  );
}
