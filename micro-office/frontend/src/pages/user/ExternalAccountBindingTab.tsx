import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { orgApi, positionApi, userApi, userExternalAccountAdminApi, type UserExternalAccountBindingPayload, type UserExternalAccountProvider, type UserExternalAccountStatus } from '../../api';
import { useAuthStore } from '../../store/auth';

const { Text } = Typography;

type UserOption = {
  id: string;
  name: string;
  orgId?: string | number | null;
  primaryPositionId?: string | number | null;
  extraPositionIds?: Array<string | number>;
};

type BindingRecord = {
  id?: string;
  userId: string;
  userName: string;
  orgName?: string;
  primaryPositionName?: string;
  extraPositionNames?: string[];
  provider: UserExternalAccountProvider;
  corpId: string;
  externalUserId: string;
  status: UserExternalAccountStatus;
  boundAt?: string | null;
  meta?: Record<string, any>;
  version?: number;
};

const providerOptions: Array<{ value: UserExternalAccountProvider; label: string }> = [
  { value: 'DINGTALK', label: 'DINGTALK' },
];

const statusOptions: Array<{ value: UserExternalAccountStatus; label: string }> = [
  { value: 'ACTIVE', label: '已绑定' },
  { value: 'UNBOUND', label: '已解绑' },
];

function asText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function maskExternalUserId(value: string) {
  const text = asText(value).trim();
  if (!text) return '-';
  if (text.length <= 6) return text;
  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function asPlainObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizeBindingRecord(raw: any): BindingRecord {
  const extraNames = Array.isArray(raw?.extraPositionNames)
    ? raw.extraPositionNames
    : typeof raw?.extraPositionNames === 'string'
      ? raw.extraPositionNames.split(/[;,，；]/).map((item: string) => item.trim()).filter(Boolean)
      : typeof raw?.extra_position_names === 'string'
        ? raw.extra_position_names.split(/[;,，；]/).map((item: string) => item.trim()).filter(Boolean)
        : [];

  return {
    id: raw?.id ? asText(raw.id) : undefined,
    userId: asText(raw?.userId || raw?.user_id || raw?.user?.id),
    userName: asText(raw?.userName || raw?.user_name || raw?.user?.name),
    orgName: raw?.orgName || raw?.org_name || raw?.user?.orgName || undefined,
    primaryPositionName: raw?.primaryPositionName || raw?.primary_position_name || raw?.user?.primaryPositionName || undefined,
    extraPositionNames: extraNames,
    provider: (raw?.provider || 'DINGTALK') as UserExternalAccountProvider,
    corpId: asText(raw?.corpId || raw?.corp_id),
    externalUserId: asText(raw?.externalUserId || raw?.external_user_id),
    status: (raw?.status || 'UNBOUND') as UserExternalAccountStatus,
    boundAt: raw?.boundAt || raw?.bound_at || null,
    meta: asPlainObject(raw?.meta),
    version: typeof raw?.version === 'number' ? raw.version : Number(raw?.version || 1),
  };
}

export default function ExternalAccountBindingTab() {
  const role = useAuthStore((state) => state.role);
  const canManagePersonnel = role === 'ADMIN' || role === 'HR';

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<BindingRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [orgMap, setOrgMap] = useState<Map<string, string>>(new Map());
  const [positionMap, setPositionMap] = useState<Map<string, string>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BindingRecord | null>(null);
  const [keyword, setKeyword] = useState<string>('');
  const [status, setStatus] = useState<UserExternalAccountStatus | undefined>();
  const [form] = Form.useForm<UserExternalAccountBindingPayload>();

  const userOptions = useMemo(
    () => users.map((item) => ({ value: item.id, label: item.name })),
    [users],
  );

  const loadLookups = async () => {
    const [userResp, orgResp, positionResp] = await Promise.all([
      userApi.list().catch(() => ({ data: [] })),
      orgApi.list().catch(() => ({ data: [] })),
      positionApi.list().catch(() => ({ data: [] })),
    ]);
    const nextUsers = (userResp.data || []).map((item: any) => ({
      id: asText(item.id),
      name: asText(item.name),
      orgId: item.orgId ?? item.org_id ?? null,
      primaryPositionId: item.primaryPositionId ?? item.primary_position_id ?? null,
      extraPositionIds: Array.isArray(item.extraPositionIds) ? item.extraPositionIds : [],
    }));
    setUsers(nextUsers);
    setOrgMap(new Map((orgResp.data || []).map((item: any) => [asText(item.id), asText(item.name)])));
    setPositionMap(new Map((positionResp.data || []).map((item: any) => [asText(item.id), asText(item.name)])));
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const resp: any = await userExternalAccountAdminApi.list({
        keyword: keyword.trim() || undefined,
        status,
      });
      const list = Array.isArray(resp.data?.records)
        ? resp.data.records
        : Array.isArray(resp.data)
          ? resp.data
          : [];
      setRecords(list.map(normalizeBindingRecord));
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '外部账号绑定列表加载失败';
      message.error(errorMessage);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLookups();
    void loadRecords();
  }, []);

  const fillFormByUser = (userId: string) => {
    form.setFieldsValue({
      userId,
      provider: form.getFieldValue('provider') || 'DINGTALK',
      corpId: form.getFieldValue('corpId') || '',
      externalUserId: form.getFieldValue('externalUserId') || '',
      status: form.getFieldValue('status') || 'ACTIVE',
    });
  };

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      id: undefined,
      userId: undefined as any,
      provider: 'DINGTALK',
      corpId: '',
      externalUserId: '',
      status: 'ACTIVE',
      boundAt: undefined,
      version: 1,
    });
    setDrawerOpen(true);
  };

  const openEdit = async (record: BindingRecord) => {
    setEditing(record);
    try {
      const resp: any = await userExternalAccountAdminApi.get(record.userId).catch(() => ({ data: record }));
      const detail = normalizeBindingRecord(resp.data || record);
      form.setFieldsValue({
        userId: detail.userId,
        id: detail.id,
        provider: detail.provider,
        corpId: detail.corpId,
        externalUserId: detail.externalUserId,
        status: detail.status === 'UNBOUND' ? 'ACTIVE' : detail.status,
        boundAt: detail.boundAt || undefined,
        version: detail.version || 1,
      });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '绑定详情加载失败';
      message.error(errorMessage);
    }
    setDrawerOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      setSaving(true);
      await userExternalAccountAdminApi.save(values.userId, {
        id: values.id,
        userId: values.userId,
        provider: values.provider,
        corpId: values.corpId.trim(),
        externalUserId: values.externalUserId.trim(),
        status: values.status,
        boundAt: editing?.boundAt || new Date().toISOString(),
        meta: asPlainObject(editing?.meta),
        version: values.version || 1,
      });
      message.success(editing ? '绑定信息已更新' : '绑定信息已保存');
      setDrawerOpen(false);
      await loadRecords();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '绑定保存失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUnbind = async (record: BindingRecord) => {
    try {
      await userExternalAccountAdminApi.unbind(record.userId);
      message.success('已解绑');
      await loadRecords();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || '解绑失败';
      message.error(errorMessage);
    }
  };

  const resolveUserContext = (userId: string) => {
    const user = users.find((item) => item.id === userId);
    if (!user) {
      return {
        orgName: '-',
        primaryPositionName: '-',
        extraPositionNames: [] as string[],
      };
    }
    return {
      orgName: user.orgId ? orgMap.get(asText(user.orgId)) || asText(user.orgId) : '-',
      primaryPositionName: user.primaryPositionId ? positionMap.get(asText(user.primaryPositionId)) || asText(user.primaryPositionId) : '-',
      extraPositionNames: (user.extraPositionIds || []).map((id) => positionMap.get(asText(id)) || asText(id)).filter(Boolean),
    };
  };

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="page-toolbar">
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="搜索人员姓名 / Corp ID / 外部账号"
              style={{ width: 280 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={() => void loadRecords()}
            />
            <Select
              allowClear
              placeholder="按绑定状态筛选"
              style={{ width: 180 }}
              value={status}
              options={statusOptions}
              onChange={(value) => setStatus(value)}
            />
          </Space>
          <div className="page-toolbar-right">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void loadRecords()}>刷新</Button>
              {canManagePersonnel ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增绑定</Button> : null}
            </Space>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, padding: '12px', overflow: 'hidden' }}>
            <Table
              loading={loading}
              rowKey={(record) => `${record.userId}-${record.provider}-${record.corpId}`}
              dataSource={records}
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: 'calc(100dvh - 455px)', x: 1380 }}
              locale={{ emptyText: <Empty description="暂无外部账号绑定" /> }}
              columns={[
                {
                  title: '人员',
                  width: 180,
                  render: (_: unknown, record: BindingRecord) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{record.userName || '-'}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>userId: {record.userId || '-'}</div>
                    </div>
                  ),
                },
                { title: '所属组织', dataIndex: 'orgName', width: 180, render: (value: string) => value || '-' },
                { title: '主岗位', dataIndex: 'primaryPositionName', width: 160, render: (value: string) => value || '-' },
                {
                  title: '辅助岗位',
                  dataIndex: 'extraPositionNames',
                  width: 220,
                  render: (value: string[]) => value?.length ? value.map((item) => <Tag key={item}>{item}</Tag>) : '-',
                },
                { title: 'Provider', dataIndex: 'provider', width: 120 },
                { title: 'Corp ID', dataIndex: 'corpId', width: 220, ellipsis: true },
                {
                  title: '外部账号',
                  dataIndex: 'externalUserId',
                  width: 180,
                  render: (value: string) => maskExternalUserId(value),
                },
                {
                  title: '绑定状态',
                  dataIndex: 'status',
                  width: 120,
                  render: (value: UserExternalAccountStatus) => (
                    <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>
                      {value === 'ACTIVE' ? '已绑定' : value === 'UNBOUND' ? '已解绑' : value}
                    </Tag>
                  ),
                },
                {
                  title: '绑定时间',
                  dataIndex: 'boundAt',
                  width: 180,
                  render: (value: string) => value || '-',
                },
                {
                  title: '操作',
                  width: canManagePersonnel ? 220 : 100,
                  fixed: 'right',
                  render: (_: unknown, record: BindingRecord) => (
                    <Space wrap>
                      <Button size="small" onClick={() => void openEdit(record)}>查看</Button>
                      {canManagePersonnel ? (
                        <>
                          <Button size="small" onClick={() => void openEdit(record)}>编辑</Button>
                          {record.status === 'ACTIVE' ? (
                            <Popconfirm
                              title="确认解绑该人员的外部账号？"
                              okText="解绑"
                              cancelText="取消"
                              onConfirm={() => void handleUnbind(record)}
                            >
                              <Button size="small" danger>解绑</Button>
                            </Popconfirm>
                          ) : null}
                        </>
                      ) : null}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <Drawer
        title={editing ? `编辑人员外部账号绑定：${editing.userName}` : '新增人员外部账号绑定'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={canManagePersonnel ? (
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void save()}>保存</Button>
          </Space>
        ) : null}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="绑定对象是人员"
            description="这里维护的是系统用户与第三方账号的关系。岗位信息仅用于辅助识别当前人员，不承载绑定主键。"
          />

          <Form form={form} layout="vertical" disabled={!canManagePersonnel && !editing}>
            <Form.Item name="userId" label="绑定人员" rules={[{ required: true, message: '请选择人员' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={userOptions}
                placeholder="选择人员"
                onChange={(value) => fillFormByUser(asText(value))}
                disabled={Boolean(editing)}
              />
            </Form.Item>

            {form.getFieldValue('userId') ? (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                {(() => {
                  const context = resolveUserContext(asText(form.getFieldValue('userId')));
                  return (
                    <Space direction="vertical" size={4}>
                      <Text>所属组织：{context.orgName}</Text>
                      <Text>主岗位：{context.primaryPositionName}</Text>
                      <Text>辅助岗位：{context.extraPositionNames.length ? context.extraPositionNames.join('，') : '-'}</Text>
                    </Space>
                  );
                })()}
              </div>
            ) : null}

            <Form.Item name="provider" label="Provider" rules={[{ required: true, message: '请选择 Provider' }]}>
              <Select options={providerOptions} />
            </Form.Item>
            <Form.Item name="corpId" label="Corp ID" rules={[{ required: true, message: '请输入 Corp ID' }]}>
              <Input placeholder="输入企业标识" />
            </Form.Item>
            <Form.Item name="externalUserId" label="外部账号 ID" rules={[{ required: true, message: '请输入外部账号 ID' }]}>
              <Input placeholder="输入 externalUserId" />
            </Form.Item>
            <Form.Item name="status" label="绑定状态" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={statusOptions} />
            </Form.Item>
          </Form>
        </Space>
      </Drawer>
    </>
  );
}
