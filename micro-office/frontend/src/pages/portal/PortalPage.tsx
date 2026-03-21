import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Empty, List, Row, Space, Statistic, Table, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { portalApi } from '../../api';
import { formatObjectType, formatRoleLabel } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

type PortalEntityType = 'users' | 'objects' | 'products';

const roleColorMap: Record<string, string> = {
  ADMIN: 'red',
  HR: 'purple',
  SALES: 'cyan',
  PURCHASE: 'geekblue',
  FINANCE: 'gold',
  TECH: 'green',
  STAFF: 'default',
};

const statusColorMap: Record<string, string> = {
  ACTIVE: 'processing',
  COMPLETED: 'success',
  ARCHIVED: 'default',
  CANCELLED: 'error',
};

function formatStatValue(value: any, suffix?: string) {
  const numericValue = Number(value || 0);
  if (suffix === '元') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      maximumFractionDigits: 0,
    }).format(numericValue);
  }
  return `${new Intl.NumberFormat('zh-CN').format(numericValue)}${suffix || ''}`;
}

function formatAmount(value: any) {
  return formatStatValue(value, '元');
}

function isRealEntityId(id?: string | number | null) {
  return !!id && !String(id).startsWith('mock-');
}

export default function PortalPage({ entityType }: { entityType: PortalEntityType }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const menus = useAuthStore(s => s.menus);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loader = useMemo(() => {
    if (entityType === 'users') return portalApi.user;
    if (entityType === 'objects') return portalApi.object;
    return portalApi.product;
  }, [entityType]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response: any = await loader(id);
        if (!cancelled) {
          setData(response.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || '门户数据加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, loader]);

  const goPortal = (kind: PortalEntityType, targetId?: string | number | null) => {
    if (!isRealEntityId(targetId)) return;
    navigate(`/${kind}/${targetId}/portal`);
  };

  const renderPortalLink = (kind: PortalEntityType, targetId: any, label: any) => {
    const menuKey = `/${kind}`;
    if (!isRealEntityId(targetId) || !menus.includes(menuKey)) {
      return <span>{label || '-'}</span>;
    }
    return (
      <Button
        type="link"
        size="small"
        onClick={() => goPortal(kind, targetId)}
        style={{ padding: 0, height: 'auto' }}
      >
        {label}
      </Button>
    );
  };

  const header = data?.header || {};
  const summaryCards = data?.summaryCards || [];
  const workSummary = data?.workSummary || {};

  const headerTags = () => {
    if (entityType === 'users') {
      return (
        <>
          <Tag color={roleColorMap[header.role] || 'default'}>{formatRoleLabel(header.role)}</Tag>
          {header.empNo ? <Tag>{header.empNo}</Tag> : null}
          <Tag color="processing">{header.year} 门户</Tag>
        </>
      );
    }

    if (entityType === 'objects') {
      return (
        <>
          <Tag color="blue">{formatObjectType(header.type)}</Tag>
          {header.industry ? <Tag color="geekblue">{header.industry}</Tag> : null}
          <Tag color="processing">{header.year} 门户</Tag>
        </>
      );
    }

    return (
      <>
        {header.productLine ? <Tag color="blue">{header.productLine}</Tag> : null}
        {header.categoryCode ? <Tag>{header.categoryCode}</Tag> : null}
        <Tag color="processing">{header.year} 门户</Tag>
      </>
    );
  };

  const descriptionItems = () => {
    if (entityType === 'users') {
      return [
        ['邮箱', header.email],
        ['手机号', header.phone],
        ['所属组织', header.orgName],
        ['岗位', header.positionName],
        ['角色', formatRoleLabel(header.role)],
        ['入职日期', header.hiredAt],
      ];
    }

    if (entityType === 'objects') {
      return [
        ['对象类型', formatObjectType(header.type)],
        ['联系人', header.contact],
        ['联系电话', header.phone],
        ['所属组织', header.orgName],
        ['所属部门', header.deptName],
        ['负责人', header.ownerName],
        ['地址', header.address],
        ['备注', header.remark],
      ];
    }

    return [
      ['物料号', header.code],
      ['规格尺寸', header.spec],
      ['产品线', header.productLine],
      ['物料类别', header.categoryCode],
      ['一级类别', header.categoryLevel1],
      ['二级类别', header.categoryLevel2],
      ['三级类别', header.categoryLevel3],
    ];
  };

  const workColumns = [
    {
      title: '工作事项',
      dataIndex: 'title',
      render: (value: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{value}</div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>{record.stage || '-'}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <Tag color={statusColorMap[value] || 'default'}>{value || '-'}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      width: 140,
      render: (_: any, record: any) => renderPortalLink('users', record.ownerId, record.ownerName),
    },
    {
      title: '关联对象',
      dataIndex: 'objectName',
      width: 180,
      render: (_: any, record: any) => record.objectName ? renderPortalLink('objects', record.objectId, record.objectName) : '-',
    },
    {
      title: '关联产品',
      dataIndex: 'productName',
      width: 180,
      render: (_: any, record: any) => record.productName ? renderPortalLink('products', record.productId, record.productName) : '-',
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 120,
    },
  ];

  const renderSummaryCards = () => (
    <Row gutter={[16, 16]}>
      {summaryCards.map((card: any) => (
        <Col xs={24} sm={12} xl={6} key={card.key}>
          <Card size="small" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={card.label}
              value={Number(card.value || 0)}
              formatter={(value) => formatStatValue(value, card.suffix)}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderWorkSection = () => (
    <Card
      title="关联工作"
      extra={(
        <Space wrap>
          <Tag color="processing">进行中 {workSummary.active || 0}</Tag>
          <Tag color="success">已完成 {workSummary.completed || 0}</Tag>
          <Tag>归档 {workSummary.archived || 0}</Tag>
          <Tag color="error">取消 {workSummary.cancelled || 0}</Tag>
        </Space>
      )}
    >
      <Table
        dataSource={data?.workItems || []}
        rowKey={(record: any) => String(record.id || record.title)}
        columns={workColumns}
        pagination={false}
        size="small"
      />
    </Card>
  );

  const renderProductPortal = () => (
    <>
      <Card title="销售分布">
        <Table
          dataSource={data?.salesSummary || []}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.customerName}`)}
          pagination={false}
          size="small"
          columns={[
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: any, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '客户',
              dataIndex: 'customerName',
              render: (_: any, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            {
              title: '销售额',
              dataIndex: 'amount',
              width: 150,
              render: (value: any) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
            },
            {
              title: '成交次数',
              dataIndex: 'orderCount',
              width: 100,
            },
            {
              title: '最近成交',
              dataIndex: 'lastSoldAt',
              width: 120,
            },
          ]}
        />
      </Card>

      <Card title="绩效明细">
        <Table
          dataSource={data?.performanceItems || []}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.customerName}`)}
          pagination={false}
          size="small"
          columns={[
            { title: '日期', dataIndex: 'happenedAt', width: 120 },
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: any, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '客户',
              dataIndex: 'customerName',
              width: 180,
              render: (_: any, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            { title: '阶段', dataIndex: 'stage', width: 120 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: any) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderCustomerObjectPortal = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="客户绩效分布" style={{ height: '100%' }}>
            <Table
              dataSource={data?.salesSummary || []}
              rowKey={(record: any) => String(record.id || record.salespersonName)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '销售',
                  dataIndex: 'salespersonName',
                  width: 140,
                  render: (_: any, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
                },
                {
                  title: '绩效金额',
                  dataIndex: 'amount',
                  width: 150,
                  render: (value: any) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
                },
                { title: '涉及产品', dataIndex: 'productCount', width: 100 },
                { title: '明细数', dataIndex: 'performanceItemCount', width: 90 },
                { title: '最近跟进', dataIndex: 'lastActiveAt', width: 120 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="相关产品" style={{ height: '100%' }}>
            <List
              size="small"
              dataSource={data?.relatedProducts || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              renderItem={(item: any) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div>{renderPortalLink('products', item.id, item.name)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {(item.code || '-')}{' · '}{formatAmount(item.amount)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="绩效明细">
        <Table
          dataSource={data?.performanceItems || []}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.productName}`)}
          pagination={false}
          size="small"
          columns={[
            { title: '日期', dataIndex: 'achievedAt', width: 120 },
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: any, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '产品',
              dataIndex: 'productName',
              width: 180,
              render: (_: any, record: any) => renderPortalLink('products', record.productId, record.productName),
            },
            { title: '绩效项', dataIndex: 'achievementType', width: 100 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: any) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderWorkObjectPortal = () => (
    <>
      <Card title="工作摘要">
        <Table
          dataSource={data?.workOwnerSummary || []}
          rowKey={(record: any) => String(record.id || record.ownerName)}
          pagination={false}
          size="small"
          columns={[
            {
              title: '负责人',
              dataIndex: 'ownerName',
              render: (_: any, record: any) => renderPortalLink('users', record.ownerId, record.ownerName),
            },
            { title: '工作总数', dataIndex: 'totalCount', width: 100 },
            { title: '进行中', dataIndex: 'activeCount', width: 100 },
            { title: '已完成', dataIndex: 'completedCount', width: 100 },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderSalesUserPortal = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="客户绩效分布" style={{ height: '100%' }}>
            <Table
              dataSource={data?.customerPerformance || []}
              rowKey={(record: any) => String(record.id || record.name)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '客户',
                  dataIndex: 'name',
                  render: (_: any, record: any) => renderPortalLink('objects', record.id, record.name),
                },
                {
                  title: '绩效金额',
                  dataIndex: 'amount',
                  width: 150,
                  render: (value: any) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
                },
                { title: '涉及产品', dataIndex: 'productCount', width: 100 },
                { title: '相关工作', dataIndex: 'workItemCount', width: 100 },
                { title: '最近跟进', dataIndex: 'lastActiveAt', width: 120 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="关联产品" style={{ height: '100%' }}>
            <List
              size="small"
              dataSource={data?.relatedProducts || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              renderItem={(item: any) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div>{renderPortalLink('products', item.id, item.name)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {(item.code || '-')}{' · '}{formatAmount(item.amount)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="绩效明细">
        <Table
          dataSource={data?.performanceItems || []}
          rowKey={(record: any) => String(record.id || `${record.customerName}-${record.productName}`)}
          pagination={false}
          size="small"
          columns={[
            { title: '日期', dataIndex: 'achievedAt', width: 120 },
            {
              title: '客户',
              dataIndex: 'customerName',
              width: 180,
              render: (_: any, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            {
              title: '产品',
              dataIndex: 'productName',
              width: 180,
              render: (_: any, record: any) => renderPortalLink('products', record.productId, record.productName),
            },
            { title: '阶段', dataIndex: 'stage', width: 120 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: any) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderWorkUserPortal = () => (
    <>
      <Card title="工作分布">
        <Table
          dataSource={data?.workBuckets || []}
          rowKey={(record: any) => String(record.id || record.label)}
          pagination={false}
          size="small"
          columns={[
            { title: '工作维度', dataIndex: 'label' },
            { title: '数量', dataIndex: 'count', width: 120 },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderVariant = () => {
    if (!data) return null;
    if (data.variant === 'PRODUCT') return renderProductPortal();
    if (data.variant === 'OBJECT_CUSTOMER') return renderCustomerObjectPortal();
    if (data.variant === 'OBJECT_WORK') return renderWorkObjectPortal();
    if (data.variant === 'USER_SALES') return renderSalesUserPortal();
    return renderWorkUserPortal();
  };

  return (
    <Card
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body page-card-scroll">
        {loading ? <Card loading /> : null}
        {!loading && error ? <Alert type="error" showIcon message={error} /> : null}
        {!loading && !error && data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              type="info"
              showIcon
              message="门户主体内容为稳定 Mock 数据生成，头部基础信息来自当前系统记录。"
            />

            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{header.name || '-'}</div>
                    <Space wrap style={{ marginTop: 8 }}>
                      {headerTags()}
                    </Space>
                  </div>
                </div>

                <Descriptions column={2} bordered size="small">
                  {descriptionItems().map(([label, value]) => (
                    <Descriptions.Item key={label} label={label}>
                      {value || '-'}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            </Card>

            {renderSummaryCards()}
            {renderVariant()}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
