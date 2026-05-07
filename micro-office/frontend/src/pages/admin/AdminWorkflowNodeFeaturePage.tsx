import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Pagination, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { workflowNodeFeatureApi, type WorkflowNodeFeatureStatus } from '../../api';
import { formatPaginationTotal, paginationLocale } from '../../constants/ui';

const statusOptions: Array<{ value: WorkflowNodeFeatureStatus; label: string }> = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'DISABLED', label: '停用' },
];

const nodeTypeLabelMap: Record<string, string> = {
  TASK: '任务',
  APPROVAL: '审批',
  REVIEW: '审核',
  CC: '抄送',
  COPY: '抄送',
  NOTIFY: '通知',
  NOTICE: '通知',
  HANDLE: '办理',
  PROCESS: '处理',
  START: '开始',
  END: '结束',
  CONDITION: '条件',
  BRANCH: '分支',
  MERGE: '汇聚',
  AUTO: '自动',
};

function formatNodeTypeLabel(nodeType?: string) {
  const key = String(nodeType || '').trim().toUpperCase();
  return key ? nodeTypeLabelMap[key] || key : '-';
}

function statusColor(status?: string) {
  return status === 'ACTIVE' ? 'green' : 'default';
}

function statusLabel(status?: string) {
  return status === 'ACTIVE' ? '启用' : status === 'DISABLED' ? '停用' : status || '-';
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
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);

  const nodeTypeOptions = useMemo(() => {
    const values = new Set(records.map((item) => String(item.nodeType || '')).filter(Boolean));
    if (nodeType) {
      values.add(String(nodeType));
    }
    return Array.from(values)
      .sort()
      .map((item) => ({ value: item, label: formatNodeTypeLabel(item) }));
  }, [records, nodeType]);

  const load = async (params?: {
    current?: number;
    size?: number;
    status?: WorkflowNodeFeatureStatus;
    nodeType?: string;
    keyword?: string;
    positionKey?: string;
    roleKey?: string;
  }) => {
    const nextCurrent = params?.current ?? current;
    const nextSize = params?.size ?? size;
    const nextStatus = params?.status ?? status;
    const nextNodeType = params?.nodeType ?? nodeType;
    const nextKeyword = params?.keyword ?? (keyword || undefined);
    const nextPositionKey = params?.positionKey ?? positionKey;
    const nextRoleKey = params?.roleKey ?? roleKey;

    setLoading(true);
    try {
      const response: any = await workflowNodeFeatureApi.list({
        current: nextCurrent,
        size: nextSize,
        status: nextStatus,
        nodeType: nextNodeType,
        keyword: nextKeyword,
        positionKey: nextPositionKey,
        roleKey: nextRoleKey,
      });
      const payload = response.data;
      const nextRecords = Array.isArray(payload) ? payload : payload?.records || [];
      const nextTotal = Array.isArray(payload) ? nextRecords.length : Number(payload?.total || 0);
      if (nextTotal > 0 && nextCurrent > 1 && !nextRecords.length) {
        await load({ ...params, current: nextCurrent - 1, size: nextSize });
        return;
      }
      setRecords(nextRecords);
      setCurrent(Number(Array.isArray(payload) ? nextCurrent : payload?.current || nextCurrent));
      setSize(Number(Array.isArray(payload) ? nextSize : payload?.size || nextSize));
      setTotal(nextTotal);
    } catch (error: any) {
      setRecords([]);
      setTotal(0);
      message.error(error?.response?.data?.message || '节点功能列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load({ current: 1, size });
  }, []);

  const updateStatus = async (record: any, nextStatus: WorkflowNodeFeatureStatus) => {
    try {
      await workflowNodeFeatureApi.updateStatus(record.id, nextStatus);
      message.success(nextStatus === 'ACTIVE' ? '节点功能已启用（ACTIVE）' : '节点功能已停用（DISABLED）');
      await load({ current, size, status, nodeType, keyword: keyword || undefined, positionKey, roleKey });
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态切换失败');
    }
  };

  const copyRecord = async (record: any) => {
    try {
      const response: any = await workflowNodeFeatureApi.copy(record.id);
      message.success('节点功能已复制');
      await load({ current, size, status, nodeType, keyword: keyword || undefined, positionKey, roleKey });
      if (response.data?.id) {
        nav(`/admin/workflow-node-features/${response.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '复制失败');
    }
  };

  const deleteRecord = async (record: any) => {
    try {
      await workflowNodeFeatureApi.delete(record.id);
      message.success(`节点功能“${record.name}”已删除`);
      await load({ current, size, status, nodeType, keyword: keyword || undefined, positionKey, roleKey });
    } catch (error: any) {
      message.error(error?.response?.data?.message || '节点功能删除失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="节点管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/admin/workflow-node-features/new')}>
            新建工作节点模版
          </Button>
        }
        bodyStyle={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: 12 }}
      >
        <div className="page-toolbar" style={{ marginBottom: 12 }}>
          <Space wrap>
            <Input
              allowClear
              placeholder="搜索节点编码 / 节点名称"
              value={keyword}
              style={{ width: 260 }}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => void load({ current: 1, size, status, nodeType, keyword: keyword || undefined, positionKey, roleKey })}
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
            <Button type="primary" onClick={() => void load({ current: 1, size, status, nodeType, keyword: keyword || undefined, positionKey, roleKey })}>
              查询
            </Button>
          </Space>
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
          <div style={{ flex: 1, minHeight: 0, padding: '12px 12px 32px 12px', overflow: 'hidden' }}>
            <Table
              loading={loading}
              rowKey="id"
              dataSource={records}
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: 'calc(100dvh - 455px)' }}
              columns={[
                {
                  title: '序号',
                  key: 'index',
                  width: 70,
                  render: (_: unknown, __: any, index: number) => (current - 1) * size + index + 1,
                },
                {
                  title: '节点功能',
                  width: 220,
                  render: (_: unknown, row: any) => (
                    <Button type="link" style={{ paddingInline: 0, fontWeight: 700 }} onClick={() => nav(`/admin/workflow-node-features/${row.id}`)}>
                      {row.name}
                    </Button>
                  ),
                },
                { title: '节点编码', dataIndex: 'code', width: 150, ellipsis: true },
                {
                  title: '节点类型',
                  dataIndex: 'nodeType',
                  width: 100,
                  render: (value: string) => formatNodeTypeLabel(value),
                },
                { title: '岗位标识', dataIndex: 'positionKey', width: 140, ellipsis: true },
                { title: '角色标识', dataIndex: 'roleKey', width: 120, ellipsis: true },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (value: WorkflowNodeFeatureStatus) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
                },
                { title: '版本', dataIndex: 'version', width: 80 },
                {
                  title: '操作',
                  width: 290,
                  render: (_: unknown, row: any) => (
                    <Space size={6} wrap>
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
                      <Popconfirm
                        title="删除节点功能"
                        description={`确定删除“${row.name}”吗？字段契约与行为配置会一并删除，且不可恢复。`}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => void deleteRecord(row)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </div>

          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '12px 16px 16px',
              borderTop: '1px solid #f0f0f0',
              background: '#fff',
            }}
          >
            <Pagination
              locale={paginationLocale}
              current={current}
              pageSize={size}
              total={total}
              showSizeChanger
              showTotal={(count) => formatPaginationTotal(count)}
              onChange={(page, pageSize) => {
                void load({ current: page, size: pageSize, status, nodeType, keyword: keyword || undefined, positionKey, roleKey });
              }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
