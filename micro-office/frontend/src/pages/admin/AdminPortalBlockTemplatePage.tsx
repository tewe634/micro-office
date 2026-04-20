import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Table, Tag, message } from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { portalBlockTemplateAdminApi, type PortalBlockTemplateStatus } from '../../api';

const statusOptions: Array<{ value: PortalBlockTemplateStatus; label: string }> = [
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

function statusColor(status: PortalBlockTemplateStatus) {
  if (status === 'ACTIVE') return 'green';
  if (status === 'DRAFT') return 'gold';
  return 'default';
}

export default function AdminPortalBlockTemplatePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<PortalBlockTemplateStatus | undefined>();

  const contractIssues = useMemo(() => {
    const invalidNames = items
      .map((item) => String(item?.name || ''))
      .filter((name) => /^LEGACY_/i.test(name) || /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(name));
    if (!invalidNames.length) return [];
    return ['后端返回的卡片资产名称仍包含 legacy/UUID 技术命名，需由后端或数据库修正 name，前端未做清洗兜底。'];
  }, [items]);

  const load = async (nextStatus = status) => {
    setLoading(true);
    try {
      const resp: any = await portalBlockTemplateAdminApi.listTemplates({
        status: nextStatus,
      });
      setItems(resp.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '卡片块列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCopy = async (id: string) => {
    try {
      const resp: any = await portalBlockTemplateAdminApi.copyTemplate(id);
      message.success('卡片块已复制');
      await load();
      if (resp.data?.id) {
        nav(`/admin/portal-block-templates/${resp.data.id}`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '复制失败');
    }
  };

  const handleStatus = async (id: string, nextStatus: PortalBlockTemplateStatus) => {
    try {
      await portalBlockTemplateAdminApi.updateStatus(id, nextStatus);
      message.success(`状态已更新为 ${nextStatus}`);
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态更新失败');
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        title="门户卡片管理"
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => nav('/admin/portal-block-templates/new')}>新建门户卡片</Button>
          </Space>
        )}
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
                void load(value);
              }}
            />
            <Button type="primary" onClick={() => void load(status)}>应用筛选</Button>
          </Space>
        </div>

        <div className="fixed-table-page__table">
          <Table
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            dataSource={items}
            scroll={{ x: 1080, y: 'calc(100dvh - 320px)' }}
            columns={[
              {
                title: '卡片块',
                width: 260,
                render: (_: any, row: any) => (
                  <Button type="link" style={{ paddingInline: 0, fontWeight: 700 }} onClick={() => nav(`/admin/portal-block-templates/${row.id}`)}>
                    {row.name}
                  </Button>
                ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 120,
                render: (value: PortalBlockTemplateStatus) => <Tag color={statusColor(value)}>{value}</Tag>,
              },
              {
                title: '展示类型',
                dataIndex: 'displayType',
                width: 120,
              },
              {
                title: '数据键',
                dataIndex: 'dataKey',
                width: 180,
              },
              {
                title: '标题',
                dataIndex: 'label',
                width: 220,
              },
              {
                title: '引用次数',
                dataIndex: 'referenceCount',
                width: 100,
                render: (value: any) => value ?? 0,
              },
              {
                title: '操作',
                width: 320,
                render: (_: any, row: any) => (
                  <Space wrap>
                    <Button size="small" onClick={() => nav(`/admin/portal-block-templates/${row.id}`)}>编辑</Button>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(row.id)}>复制</Button>
                    {row.status !== 'ACTIVE' ? (
                      <Button size="small" onClick={() => void handleStatus(row.id, 'ACTIVE')}>启用</Button>
                    ) : (
                      <Button size="small" onClick={() => void handleStatus(row.id, 'INACTIVE')}>停用</Button>
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
