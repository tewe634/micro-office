import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  dailyEntryAdminApi,
  orgApi,
  userApi,
  type DailyEntryBindingScope,
  type DailyEntryChatPolicyPayload,
  type DailyEntrySessionBindingPayload,
  type DailyEntrySessionResolveStrategy,
  type DailyEntryStatus,
  type DailyEntryTargetPayload,
  type DailyEntryTargetType,
} from '../../api';
import { formatPaginationTotal, paginationLocale } from '../../constants/ui';

const { TextArea } = Input;
const { Text } = Typography;

type DailyEntryRecord = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  status: DailyEntryStatus;
  meta?: Record<string, any>;
  updatedAt?: string;
  targets?: DailyEntryTargetPayload[];
  chatPolicy?: DailyEntryChatPolicyPayload | null;
  sessionBindings?: DailyEntrySessionBindingPayload[];
};

const statusOptions: Array<{ value: DailyEntryStatus; label: string }> = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'INACTIVE', label: '停用' },
];

const targetTypeOptions: Array<{ value: DailyEntryTargetType; label: string }> = [
  { value: 'ORG', label: '指定组织' },
  { value: 'USER', label: '指定用户' },
];

const sessionStrategyOptions: Array<{ value: DailyEntrySessionResolveStrategy; label: string }> = [
  { value: 'BY_ENTRY_ONLY', label: '统一群（按条目）' },
  { value: 'BY_ENTRY_AND_USER', label: '个人群（按条目 + 用户）' },
];

const bindingScopeOptions: Array<{ value: DailyEntryBindingScope; label: string }> = [
  { value: 'SHARED', label: '共享群' },
  { value: 'PERSONAL', label: '个人群' },
];

function statusColor(status?: string) {
  return status === 'ACTIVE' ? 'green' : 'default';
}

function statusLabel(status?: DailyEntryStatus) {
  return status === 'ACTIVE' ? '启用' : '停用';
}

function safeJsonParse(text: string, label: string) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} 不是合法 JSON`);
  }
}

function prettyJson(value: any) {
  return JSON.stringify(value || {}, null, 2);
}

function normalizeEntry(item: any): DailyEntryRecord {
  return {
    id: String(item?.id || ''),
    code: String(item?.code || ''),
    name: String(item?.name || ''),
    sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : Number(item?.sortOrder || 0),
    status: (item?.status || 'INACTIVE') as DailyEntryStatus,
    meta: item?.meta || {},
    updatedAt: item?.updatedAt || item?.updated_at || undefined,
    targets: Array.isArray(item?.targets)
      ? item.targets.map((target: any) => ({
          id: target?.id,
          targetType: target?.targetType || 'ORG',
          targetId: String(target?.targetId || ''),
          status: target?.status || 'ACTIVE',
          sortOrder: typeof target?.sortOrder === 'number' ? target.sortOrder : Number(target?.sortOrder || 0),
        }))
      : [],
    chatPolicy: item?.chatPolicy
      ? {
          dailyEntryId: item.chatPolicy.dailyEntryId || item.chatPolicy.daily_entry_id || item.chatPolicy.dailyEntry?.id || item.id,
          entryCode: item.chatPolicy.entryCode,
          entryName: item.chatPolicy.entryName,
          sessionResolveStrategy: item.chatPolicy.sessionResolveStrategy || 'BY_ENTRY_ONLY',
          providerKey: item.chatPolicy.providerKey || 'daily_list',
          status: item.chatPolicy.status || 'ACTIVE',
          meta: item.chatPolicy.meta || {},
        }
      : null,
    sessionBindings: Array.isArray(item?.sessionBindings)
      ? item.sessionBindings.map((binding: any) => ({
          id: binding?.id,
          dailyEntryId: binding?.dailyEntryId || binding?.daily_entry_id || item.id,
          userId: binding?.userId || null,
          sessionId: String(binding?.sessionId || ''),
          bindingScope: binding?.bindingScope || 'SHARED',
          status: binding?.status || 'ACTIVE',
          meta: binding?.meta || {},
        }))
      : [],
  };
}

function targetSummary(targets: DailyEntryTargetPayload[], orgMap: Map<string, string>, userMap: Map<string, string>) {
  if (!targets.length) return '全局可见';
  return targets
    .map((target) => {
      if (target.targetType === 'ORG') {
        return `组织：${orgMap.get(target.targetId) || target.targetId}`;
      }
      return `用户：${userMap.get(target.targetId) || target.targetId}`;
    })
    .join('；');
}

function policySummary(policy?: DailyEntryChatPolicyPayload | null) {
  if (!policy) return '未配置';
  return `${policy.sessionResolveStrategy || '-'} / ${policy.providerKey || '-'}`;
}

function normalizePolicyPayload(raw: any, dailyEntryId: string): DailyEntryChatPolicyPayload | null {
  const policy = raw?.policy ?? raw;
  if (!policy) return null;
  return {
    dailyEntryId: String(policy.dailyEntryId || policy.daily_entry_id || dailyEntryId),
    entryCode: policy.entryCode,
    entryName: policy.entryName,
    sessionResolveStrategy: policy.sessionResolveStrategy || 'BY_ENTRY_ONLY',
    providerKey: policy.providerKey || 'daily_list',
    status: policy.status || 'ACTIVE',
    meta: policy.meta || {},
  };
}

export default function AdminDailyEntryPage() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DailyEntryRecord[]>([]);
  const [status, setStatus] = useState<DailyEntryStatus | undefined>();
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState<DailyEntryRecord | null>(null);
  const [targets, setTargets] = useState<DailyEntryTargetPayload[]>([]);
  const [chatPolicy, setChatPolicy] = useState<DailyEntryChatPolicyPayload | null>(null);
  const [sessionBindings, setSessionBindings] = useState<DailyEntrySessionBindingPayload[]>([]);
  const [orgOptions, setOrgOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [entryForm] = Form.useForm();
  const [contractIssues, setContractIssues] = useState<string[]>([]);

  const orgMap = useMemo(() => new Map(orgOptions.map((item) => [item.value, item.label])), [orgOptions]);
  const userMap = useMemo(() => new Map(userOptions.map((item) => [item.value, item.label])), [userOptions]);

  const loadLookups = async () => {
    const [orgResp, userResp] = await Promise.all([
      orgApi.list().catch(() => ({ data: [] })),
      userApi.list().catch(() => ({ data: [] })),
    ]);
    setOrgOptions((orgResp.data || []).map((item: any) => ({ value: String(item.id), label: item.name })));
    setUserOptions((userResp.data || []).map((item: any) => ({ value: String(item.id), label: item.name })));
  };

  const loadRecords = async (options?: {
    status?: DailyEntryStatus;
    current?: number;
    size?: number;
  }) => {
    const nextStatus = options?.status !== undefined ? options.status : status;
    const nextCurrent = options?.current ?? current;
    const nextSize = options?.size ?? size;
    setLoading(true);
    try {
      const resp: any = await dailyEntryAdminApi.listEntries({ status: nextStatus, current: nextCurrent, size: nextSize });
      const pageData = resp.data || {};
      const nextRecords = (pageData.records || []).map(normalizeEntry);
      const nextTotal = Number(pageData.total || 0);
      if (nextTotal > 0 && nextCurrent > 1 && !nextRecords.length) {
        await loadRecords({ status: nextStatus, current: nextCurrent - 1, size: nextSize });
        return;
      }
      setRecords(nextRecords);
      setCurrent(Number(pageData.current || nextCurrent));
      setSize(Number(pageData.size || nextSize));
      setTotal(nextTotal);
      setContractIssues([]);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '日常条目列表加载失败';
      message.error(errorMessage);
      if (error?.response?.status === 404) {
        setContractIssues(['后端尚未提供 /api/admin/daily-entries 管理接口，前端已预留独立页面与交互结构。']);
      }
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLookups();
    void loadRecords({ current: 1, size });
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const [entryResp, targetsResp, policyResp, bindingsResp] = await Promise.all([
        dailyEntryAdminApi.getEntry(id),
        dailyEntryAdminApi.listTargets(id).catch(() => ({ data: [] })),
        dailyEntryAdminApi.getChatPolicy(id).catch(() => ({ data: null })),
        dailyEntryAdminApi.listSessionBindings(id).catch(() => ({ data: [] })),
      ]);
      const entry = normalizeEntry(entryResp.data);
      setEditing(entry);
      entryForm.setFieldsValue({
        code: entry.code,
        name: entry.name,
        sortOrder: entry.sortOrder,
        status: entry.status,
        metaText: prettyJson(entry.meta),
      });
      setTargets((targetsResp.data || []).map((item: any) => ({
        id: item.id,
        targetType: item.targetType,
        targetId: String(item.targetId || ''),
        status: item.status || 'ACTIVE',
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : Number(item.sortOrder || 0),
      })));
      const nextPolicy = normalizePolicyPayload(policyResp.data, id);
      setChatPolicy(nextPolicy ?? {
        sessionResolveStrategy: 'BY_ENTRY_ONLY',
        providerKey: 'daily_list',
        status: 'ACTIVE',
        meta: {},
      });
      setSessionBindings((bindingsResp.data || []).map((item: any) => ({
        id: item.id,
        dailyEntryId: String(item.dailyEntryId || item.daily_entry_id || id),
        userId: item.userId || null,
        sessionId: item.sessionId || '',
        bindingScope: item.bindingScope || 'SHARED',
        status: item.status || 'ACTIVE',
        meta: item.meta || {},
      })));
      setContractIssues([]);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '条目详情加载失败';
      message.error(errorMessage);
      if (error?.response?.status === 404) {
        setContractIssues(['后端尚未提供条目详情 / 范围 / 聊天配置接口，前端表单结构已按版本文档拆分完成。']);
      }
      setEditing({ id, code: '', name: '', sortOrder: 100, status: 'INACTIVE', meta: {} });
      entryForm.setFieldsValue({ code: '', name: '', sortOrder: 100, status: 'INACTIVE', metaText: prettyJson({}) });
      setTargets([]);
      setChatPolicy({
        dailyEntryId: id,
        sessionResolveStrategy: 'BY_ENTRY_ONLY',
        providerKey: 'daily_list',
        status: 'ACTIVE',
        meta: {},
      });
      setSessionBindings([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing(null);
    entryForm.setFieldsValue({
      code: '',
      name: '',
      sortOrder: 100,
      status: 'ACTIVE',
      metaText: prettyJson({}),
    });
    setTargets([]);
    setChatPolicy({
      sessionResolveStrategy: 'BY_ENTRY_ONLY',
      providerKey: 'daily_list',
      status: 'ACTIVE',
      meta: {},
    });
    setSessionBindings([]);
    setDrawerOpen(true);
  };

  const handleEdit = async (record: DailyEntryRecord) => {
    setDrawerOpen(true);
    await loadDetail(record.id);
  };

  const addTarget = () => {
    setTargets((prev) => [
      ...prev,
      { targetType: 'ORG', targetId: '', status: 'ACTIVE', sortOrder: (prev.length + 1) * 10 },
    ]);
  };

  const addBinding = () => {
    setSessionBindings((prev) => [
      ...prev,
      { bindingScope: 'SHARED', userId: null, sessionId: '', status: 'ACTIVE', meta: {} },
    ]);
  };

  const save = async () => {
    const values = await entryForm.validateFields();
    const entryPayload = {
      code: String(values.code || '').trim().toUpperCase(),
      name: String(values.name || '').trim(),
      sortOrder: Number(values.sortOrder || 0),
      status: values.status as DailyEntryStatus,
      meta: safeJsonParse(values.metaText, '条目 Meta'),
    };
    if (!chatPolicy) {
      message.error('请先配置聊天策略');
      return;
    }
    try {
      setSaving(true);
      let entryId = editing?.id;
      if (entryId) {
        await dailyEntryAdminApi.updateEntry(entryId, entryPayload);
      } else {
        const entryResp: any = await dailyEntryAdminApi.createEntry(entryPayload);
        entryId = String(entryResp.data?.id || '');
      }

      if (!entryId) {
        throw new Error('后端未返回条目 ID，无法继续保存范围和聊天配置');
      }

      await dailyEntryAdminApi.saveTargets(entryId, targets.map((item, index) => ({
        ...item,
        sortOrder: Number(item.sortOrder || (index + 1) * 10),
      })));

      await dailyEntryAdminApi.saveChatPolicy(entryId, {
        ...chatPolicy,
        dailyEntryId: entryId,
        entryCode: entryPayload.code,
        entryName: entryPayload.name,
      });

      await dailyEntryAdminApi.saveSessionBindings(entryId, sessionBindings.map((item) => ({
        ...item,
        dailyEntryId: entryId,
        userId: item.bindingScope === 'PERSONAL' ? item.userId || null : null,
      })));

      message.success(editing?.id ? '日常条目已保存' : '日常条目已创建');
      setDrawerOpen(false);
      await loadRecords({ status, current, size });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '保存失败';
      message.error(errorMessage);
      if (error?.response?.status === 404) {
        setContractIssues(['后端条目管理保存接口尚未可用，前端页面与交互已独立完成。']);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (record: DailyEntryRecord, nextStatus: DailyEntryStatus) => {
    try {
      await dailyEntryAdminApi.updateEntryStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '条目已启用' : '条目已停用');
      await loadRecords({ status, current, size });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '状态更新失败';
      message.error(errorMessage);
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="日常条目管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建条目</Button>}
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12 }}
      >
        {contractIssues.map((issue) => (
          <Alert key={issue} type="warning" showIcon style={{ marginBottom: 12 }} message="检测到契约缺口" description={issue} />
        ))}

        <div className="page-toolbar" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Select
              allowClear
              placeholder="按状态筛选"
              value={status}
              style={{ width: 180 }}
              options={statusOptions}
              onChange={(value) => {
                setStatus(value);
                void loadRecords({ status: value, current: 1, size });
              }}
            />
          </Space>
        </div>

        <div className="fixed-table-page__frame" style={{ borderRadius: 12 }}>
          <div className="fixed-table-page__table">
            <Table
              loading={loading}
              rowKey="id"
              size="middle"
              dataSource={records}
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: 'calc(100dvh - 360px)' }}
              locale={{ emptyText: <Empty description="暂无日常条目" /> }}
              columns={[
                {
                  title: '序号',
                  width: 72,
                  render: (_: unknown, __: DailyEntryRecord, index: number) => (current - 1) * size + index + 1,
                },
                {
                  title: '条目名称',
                  width: 180,
                  render: (_: unknown, row: DailyEntryRecord) => (
                    <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => void handleEdit(row)}>
                      {row.name || '-'}
                    </Button>
                  ),
                },
                { title: '条目编码', dataIndex: 'code', width: 150, ellipsis: true },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 96,
                  render: (value: DailyEntryStatus) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
                },
                { title: '排序', dataIndex: 'sortOrder', width: 80 },
                {
                  title: '适用范围摘要',
                  render: (_: unknown, row: DailyEntryRecord) => targetSummary(row.targets || [], orgMap, userMap),
                },
                {
                  title: '会话策略摘要',
                  width: 180,
                  render: (_: unknown, row: DailyEntryRecord) => policySummary(row.chatPolicy),
                },
                {
                  title: '操作',
                  width: 180,
                  render: (_: unknown, row: DailyEntryRecord) => (
                    <Space wrap>
                      <Button size="small" onClick={() => void handleEdit(row)}>编辑</Button>
                      {row.status === 'ACTIVE' ? (
                        <Popconfirm
                          title="确认停用该条目？"
                          okText="停用"
                          cancelText="取消"
                          onConfirm={() => void handleStatus(row, 'INACTIVE')}
                        >
                          <Button size="small">停用</Button>
                        </Popconfirm>
                      ) : (
                        <Popconfirm
                          title="确认启用该条目？"
                          okText="启用"
                          cancelText="取消"
                          onConfirm={() => void handleStatus(row, 'ACTIVE')}
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

          <div className="fixed-table-page__footer">
            <Pagination
              locale={paginationLocale}
              current={current}
              pageSize={size}
              total={total}
              showSizeChanger
              showTotal={(count) => formatPaginationTotal(count)}
              onChange={(page, pageSize) => {
                void loadRecords({ status, current: page, size: pageSize });
              }}
            />
          </div>
        </div>
      </Card>

      <Drawer
        title={editing?.id ? `编辑日常条目：${editing.name || editing.code || editing.id}` : '新建日常条目'}
        open={drawerOpen}
        width={860}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void save()}>保存</Button>
          </Space>
        )}
      >
        {detailLoading ? (
          <div className="page-fill" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Text type="secondary">正在加载条目详情...</Text>
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="条目基础信息">
              <Form form={entryForm} layout="vertical">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <Form.Item name="name" label="条目名称" rules={[{ required: true, message: '请输入条目名称' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="code" label="条目编码" rules={[{ required: true, message: '请输入条目编码' }]}>
                    <Input onChange={(e) => entryForm.setFieldValue('code', String(e.target.value || '').toUpperCase())} />
                  </Form.Item>
                  <Form.Item name="sortOrder" label="排序">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                    <Select options={statusOptions} />
                  </Form.Item>
                </div>
                <Form.Item name="metaText" label="Meta(JSON)">
                  <TextArea rows={5} />
                </Form.Item>
              </Form>
            </Card>

            <Card
              size="small"
              title="适用范围"
              extra={<Button size="small" icon={<PlusOutlined />} onClick={addTarget}>新增范围</Button>}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text type="secondary">条目负责业务可见范围；block 页只引用 daily_list，不在 block 里逐条维护请假/报销/会议。</Text>
                {!targets.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未配置范围时视为全局可见" />
                ) : targets.map((target, index) => (
                  <Card
                    key={`${target.targetType}-${target.targetId}-${index}`}
                    size="small"
                    extra={(
                      <Button danger size="small" onClick={() => setTargets((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                        删除
                      </Button>
                    )}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr) 120px 120px', gap: 12 }}>
                      <Select
                        value={target.targetType}
                        options={targetTypeOptions}
                        onChange={(value) => setTargets((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, targetType: value, targetId: '' } : item))}
                      />
                      <Select
                        showSearch
                        optionFilterProp="label"
                        value={target.targetId || undefined}
                        placeholder={target.targetType === 'ORG' ? '选择组织' : '选择用户'}
                        options={target.targetType === 'ORG' ? orgOptions : userOptions}
                        onChange={(value) => setTargets((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, targetId: value } : item))}
                      />
                      <Select
                        value={target.status}
                        options={statusOptions}
                        onChange={(value) => setTargets((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, status: value } : item))}
                      />
                      <InputNumber
                        min={0}
                        value={target.sortOrder}
                        onChange={(value) => setTargets((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: Number(value || 0) } : item))}
                      />
                    </div>
                  </Card>
                ))}
              </Space>
            </Card>

            <Card size="small" title="聊天配置">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text type="secondary">聊天策略与会话绑定在本页管理，不写进条目主表 JSON，也不回塞到门户模板和卡片配置里。</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 6 }}>会话解析策略</div>
                    <Select
                      value={chatPolicy?.sessionResolveStrategy}
                      options={sessionStrategyOptions}
                      onChange={(value) => setChatPolicy((prev) => ({
                        dailyEntryId: prev?.dailyEntryId,
                        entryCode: prev?.entryCode,
                        entryName: prev?.entryName,
                        providerKey: prev?.providerKey || 'daily_list',
                        status: prev?.status || 'ACTIVE',
                        meta: prev?.meta || {},
                        sessionResolveStrategy: value,
                      }))}
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>Provider Key</div>
                    <Input
                      value={chatPolicy?.providerKey || 'daily_list'}
                      onChange={(e) => setChatPolicy((prev) => ({
                        dailyEntryId: prev?.dailyEntryId,
                        entryCode: prev?.entryCode,
                        entryName: prev?.entryName,
                        sessionResolveStrategy: prev?.sessionResolveStrategy || 'BY_ENTRY_ONLY',
                        status: prev?.status || 'ACTIVE',
                        meta: prev?.meta || {},
                        providerKey: e.target.value,
                      }))}
                    />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>策略状态</div>
                    <Select
                      value={chatPolicy?.status || 'ACTIVE'}
                      options={statusOptions}
                      onChange={(value) => setChatPolicy((prev) => ({
                        dailyEntryId: prev?.dailyEntryId,
                        entryCode: prev?.entryCode,
                        entryName: prev?.entryName,
                        sessionResolveStrategy: prev?.sessionResolveStrategy || 'BY_ENTRY_ONLY',
                        providerKey: prev?.providerKey || 'daily_list',
                        meta: prev?.meta || {},
                        status: value,
                      }))}
                    />
                  </div>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>会话绑定摘要</Text>
                  <Button size="small" icon={<PlusOutlined />} onClick={addBinding}>新增绑定</Button>
                </div>
                {!sessionBindings.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前未配置会话绑定" />
                ) : sessionBindings.map((binding, index) => (
                  <Card
                    key={`${binding.bindingScope}-${binding.sessionId}-${index}`}
                    size="small"
                    extra={(
                      <Button danger size="small" onClick={() => setSessionBindings((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>
                        删除
                      </Button>
                    )}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 180px minmax(0, 1fr) 120px', gap: 12 }}>
                      <Select
                        value={binding.bindingScope}
                        options={bindingScopeOptions}
                        onChange={(value) => setSessionBindings((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, bindingScope: value, userId: value === 'PERSONAL' ? item.userId : null } : item))}
                      />
                      <Select
                        allowClear
                        disabled={binding.bindingScope !== 'PERSONAL'}
                        showSearch
                        optionFilterProp="label"
                        placeholder={binding.bindingScope === 'PERSONAL' ? '选择用户' : '共享群无需指定用户'}
                        value={binding.userId || undefined}
                        options={userOptions}
                        onChange={(value) => setSessionBindings((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, userId: value || null } : item))}
                      />
                      <Input
                        value={binding.sessionId}
                        placeholder="输入会话 ID"
                        onChange={(e) => setSessionBindings((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, sessionId: e.target.value } : item))}
                      />
                      <Select
                        value={binding.status}
                        options={statusOptions}
                        onChange={(value) => setSessionBindings((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, status: value } : item))}
                      />
                    </div>
                  </Card>
                ))}
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
