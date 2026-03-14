import { useEffect, useState } from 'react';
import { Card, Tabs, Row, Col, Statistic, Table, Tag, Space } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { dashboardApi } from '../../api';

const periodOpts = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];
const typeMap: Record<string, string> = { CUSTOMER: '客户', SUPPLIER: '供应商', BANK: '银行', CARRIER: '承运商', THIRD_PARTY_PAY: '第三方支付', OTHER: '其他' };

export default function DashboardPage() {
  const [scopes, setScopes] = useState<any[]>([]);
  const [activeScope, setActiveScope] = useState<any>(null);
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    dashboardApi.scopes().then((r: any) => {
      const s = r.data || [];
      setScopes(s);
      if (s.length) setActiveScope(s[0]);
    });
  }, []);

  useEffect(() => {
    if (!activeScope) return;
    dashboardApi.org(activeScope.key, activeScope.orgId, period).then((r: any) => setData(r.data));
  }, [activeScope, period]);

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '部门', dataIndex: 'org_name', width: 100 },
    { title: '岗位', dataIndex: 'pos_name', width: 100 },
    { title: '总工作数', dataIndex: 'total', width: 90, align: 'center' as const, sorter: (a: any, b: any) => a.total - b.total },
    { title: '进行中', dataIndex: 'active', width: 80, align: 'center' as const, render: (v: number) => v > 0 ? <Tag color="blue">{v}</Tag> : 0 },
    { title: '已完成', dataIndex: 'completed', width: 80, align: 'center' as const, render: (v: number) => v > 0 ? <Tag color="green">{v}</Tag> : 0 },
  ];

  return (
    <Card title={<><BarChartOutlined /> 数据汇总</>}>
      {scopes.length > 0 && (
        <Tabs activeKey={activeScope?.key + (activeScope?.orgId || '')}
          onChange={k => setActiveScope(scopes.find(s => s.key + (s.orgId || '') === k))}
          items={scopes.map(s => ({ key: s.key + (s.orgId || ''), label: s.label }))} />
      )}
      <div style={{ marginBottom: 16 }}>
        <Space>
          {periodOpts.map(o => (
            <Tag key={o.value} color={period === o.value ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }} onClick={() => setPeriod(o.value)}>{o.label}</Tag>
          ))}
        </Space>
      </div>
      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="人员数" value={data.userCount} /></Card></Col>
            <Col span={6}><Card><Statistic title="总工作数" value={data.totalThreads} /></Card></Col>
            <Col span={6}><Card><Statistic title="进行中" value={data.activeThreads} valueStyle={{ color: '#1677ff' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="已完成" value={data.completedThreads} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          </Row>
          <Table dataSource={data.byUser} rowKey="id" size="small" columns={columns} pagination={false} />
          {data.externalObjects?.length > 0 && (
            <Card title="外部对象分布" size="small" style={{ marginTop: 16 }}>
              <Space wrap>{data.externalObjects.map((o: any) => <Tag key={o.type} color="blue">{typeMap[o.type] || o.type}: {o.count}</Tag>)}</Space>
            </Card>
          )}
        </>
      )}
    </Card>
  );
}
