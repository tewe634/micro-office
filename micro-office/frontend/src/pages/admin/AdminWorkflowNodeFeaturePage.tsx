import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workflowNodeFeatureApi, type WorkflowNodeFeatureStatus } from '../../api';

const statusOptions: Array<{ value: WorkflowNodeFeatureStatus; label: string }> = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'DISABLED', label: 'DISABLED' },
];

function statusColor(status?: string) {
  return status === 'ACTIVE' ? 'green' : 'default';
}

export default function AdminWorkflowNodeFeaturePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<WorkflowNodeFeatureStatus | undefined>();
  const [nodeType, setNodeType] = useState<string | undefined>();
  const [positionKey, setPositionKey] = useState<string | undefined>();
  const [roleKey, setRoleKey] = useState<string | undefined>();

  const nodeTypeOptions = useMemo(
    () =>
      Array.from(new Set(records.map((item) => String(item.nodeType || '')).filter(Boolean)))
        .sort()
        .map((item) => ({ value: item, label: item })),
    [records],
  );

  const load = async (params?: {
    status?: WorkflowNodeFeatureStatus;
    nodeType?: string;
    keyword?: string;
    positionKey?: string;
    roleKey?: string;
  }) => {
    setLoading(true);
    try {
      const response: any = await workflowNodeFeatureApi.list({
        status: params?.status ?? status,
        nodeType: params?.nodeType ?? nodeType,
        keyword: params?.keyword ?? (keyword || undefined),
        positionKey: params?.positionKey ?? positionKey,
        roleKey: params?.roleKey ?? roleKey,
      });
      setRecords(response.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点功能列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load({});
  }, []);

  const updateStatus = async (record: any, nextStatus: WorkflowNodeFeatureStatus) => {
    try {
      await workflowNodeFeatureApi.updateStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '节点功能已启用（ACTIVE）' : '节点功能已停用（DISABLED）');
      await load({});
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态切换失败');
    }
  };

  const copyRecord = async (record: any) => {
    try {
      const response: any = await workflowNodeFeatureApi.copy(record.id);
      message.success('节点功能已复制');
      await load({});
      if (response.data?.id) {
        nav(`/admin/workflow-node-features/${response.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '复制失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="工作节点模版管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load({})}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/admin/workflow-node-features/new')}>
              新建工作节点模版
            </Button>
          </Space>
        }
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12 }}
      >
        <div className="page-toolbar" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Input
              allowClear
              placeholder="搜索节点编码 / 节点名称 / 来源系统"
              value={keyword}
              style={{ width: 260 }}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => void load({})}
            />
            <Select
              allowClear
              placeholder="按节点类型筛选"
              value={nodeType}
              style={{ width: 180 }}
              options={nodeTypeOptions}
              onChange={(value) => setNodeType(value)}
            />
            <Select
              allowClear
              placeholder="按状态筛选"
              value={status}
              style={{ width: 160 }}
              options={statusOptions}
              onChange={(value) => setStatus(value)}
            />
            <Input allowClear placeholder="岗位标识" value={positionKey} style={{ width: 180 }} onChange={(e) => setPositionKey(e.target.value || undefined)} />
            <Input allowClear placeholder="角色标识" value={roleKey} style={{ width: 160 }} onChange={(e) => setRoleKey(e.target.value || undefined)} />
            <Button type="primary" onClick={() => void load({})}>
              查询
            </Button>
          </Space>
        </div>

        <div className="page-card-scroll">
          <Table
            loading={loading}
            rowKey="id"
            dataSource={records}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1280 }}
            columns={[
              {
                title: '节点功能',
                width: 260,
                render: (_: unknown, row: any) => (
                  <div>
                    <Button type="link" style={{ paddingInline: 0, fontWeight: 700 }} onClick={() => nav(`/admin/workflow-node-features/${row.id}`)}>
                      {row.name}
                    </Button>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{row.id}</div>
                  </div>
                ),
              },
              { title: '节点编码', dataIndex: 'code', width: 180 },
              { title: '节点类型', dataIndex: 'nodeType', width: 160 },
              { title: '来源系统', dataIndex: 'sourceSystem', width: 160 },
              { title: '岗位标识', dataIndex: 'positionKey', width: 160 },
              { title: '角色标识', dataIndex: 'roleKey', width: 140 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 120,
                render: (value: WorkflowNodeFeatureStatus) => <Tag color={statusColor(value)}>{value}</Tag>,
              },
              { title: '版本', dataIndex: 'version', width: 100 },
              { title: '更新时间', dataIndex: 'updatedAt', width: 200 },
              {
                title: '操作',
                width: 320,
                fixed: 'right',
                render: (_: unknown, row: any) => (
                  <Space wrap>
                    <Button size="small" onClick={() => nav(`/admin/workflow-node-features/${row.id}`)}>
                      编辑
                    </Button>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void copyRecord(row)}>
                      复制
                    </Button>
                    {row.status === 'ACTIVE' ? (
                      <Popconfirm title="确认停用该节点功能？" okText="停用" cancelText="取消" onConfirm={() => void updateStatus(row, 'DISABLED')}>
                        <Button size="small">停用</Button>
                      </Popconfirm>
                    ) : (
                      <Popconfirm title="确认启用该节点功能？" okText="启用" cancelText="取消" onConfirm={() => void updateStatus(row, 'ACTIVE')}>
                        <Button size="small" type="primary">
                          启用
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
