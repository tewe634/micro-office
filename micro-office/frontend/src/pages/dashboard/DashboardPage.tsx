import { useEffect, useState } from 'react';
import { Card, Tabs, Row, Col, Statistic, Table, Tag, Select, Space } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { dashboardApi, orgApi } from '../../api';

const periodOpts = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

const scopeOpts = [
  { value: 'personal', label: '个人' },
  { value: 'department', label: '部门' },
  { value: 'region', label: '大区（销售）' },
  { value: 'company', label: '公司' },
];

const typeMap: Record<string, string> = { CUSTOMER: '客户', SUPPLIER: '供应商', BANK: '银行', CARRIER: '承运商', THIRD_PARTY_PAY: '第三方支付', OTHER: '其他' };

function TimeSummary() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState<any>(null);

  useEffect(() => { dashboardApi.time(period).then((r: any) => setData(r.data)); }, [period]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>时间范围：</span>
          {periodOpts.map(o => (
            <Tag key={o.value} color={period === o.value ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }} onClick={() => setPeriod(o.value)}>{o.label}</Tag>
          ))}
        </Space>
      </div>
      {data && (
        <>
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="创建工作" value={data.threadsCreated} /></Card></Col>
            <Col span={6}><Card><Statistic title="完成工作" value={data.threadsCompleted} valueStyle={{ color: '#3f8600' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="完成节点" value={data.nodesCompleted} /></Card></Col>
            <Col span={6}><Card><Statistic title="评论数" value={data.commentsCount} /></Card></Col>
          </Row>
          {data.clockRecords?.length > 0 && (
            <Card title={<><ClockCircleOutlined /> 打卡记录</>} size="small" style={{ marginTop: 16 }}>
              <Space wrap>
                {data.clockRecords.map((r: any, i: number) => (
                  <Tag key={i} color={r.type === 'CLOCK_IN' ? 'green' : 'red'}>
                    {r.type === 'CLOCK_IN' ? '上班' : '下班'} {new Date(r.clock_time).toLocaleTimeString('zh-CN')}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function OrgSummary() {
  const [scope, setScope] = useState('personal');
  const [orgId, setOrgId] = useState<number>();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);

  useEffect(() => { orgApi.list().then((r: any) => setOrgs(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { dashboardApi.org(scope, orgId).then((r: any) => setData(r.data)); }, [scope, orgId]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>汇总范围：</span>
          <Select value={scope} options={scopeOpts} onChange={v => setScope(v)} style={{ width: 140 }} />
          {(scope === 'department' || scope === 'region') && (
            <Select placeholder="选择组织" value={orgId} allowClear style={{ width: 160 }}
              options={orgs.map(o => ({ value: o.id, label: o.name }))} onChange={v => setOrgId(v)} />
          )}
        </Space>
      </div>
      {data && (
        <>
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title={`${data.scope} - 总工作数`} value={data.totalThreads} /></Card></Col>
            <Col span={6}><Card><Statistic title="进行中" value={data.activeThreads} valueStyle={{ color: '#1677ff' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="已完成" value={data.completedThreads} valueStyle={{ color: '#3f8600' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="外部对象" value={data.externalObjects?.reduce((s: number, o: any) => s + o.count, 0) || 0} /></Card></Col>
          </Row>

          {data.byUser?.length > 0 && (
            <Card title={<><TeamOutlined /> 人员工作统计</>} size="small" style={{ marginTop: 16 }}>
              <Table dataSource={data.byUser} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: '姓名', dataIndex: 'name' },
                  { title: '总工作数', dataIndex: 'total', align: 'center' },
                  { title: '已完成', dataIndex: 'completed', align: 'center', render: (v: number) => <Tag color="green">{v}</Tag> },
                ]} />
            </Card>
          )}

          {data.externalObjects?.length > 0 && (
            <Card title="外部对象分布" size="small" style={{ marginTop: 16 }}>
              <Space wrap>
                {data.externalObjects.map((o: any) => (
                  <Tag key={o.type} color="blue">{typeMap[o.type] || o.type}: {o.count}</Tag>
                ))}
              </Space>
            </Card>
          )}
        </>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Card title={<><BarChartOutlined /> 数据汇总</>}>
      <Tabs items={[
        { key: 'time', label: '时间维度', children: <TimeSummary /> },
        { key: 'org', label: '组织维度', children: <OrgSummary /> },
      ]} />
    </Card>
  );
}
