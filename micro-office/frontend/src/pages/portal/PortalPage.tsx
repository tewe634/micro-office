import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Table, Row, Col, Button, Modal, Form, Input, Select, Space, message, Popconfirm, List } from 'antd';
import { TrophyOutlined, UserOutlined, TeamOutlined, GlobalOutlined } from '@ant-design/icons';
import { portalApi } from '../../api';
import { formatObjectType, formatRoleLabel, uiText } from '../../constants/ui';

const achTypeOpts = [{ value: 'ACHIEVEMENT', label: '重大贡献' }, { value: 'AWARD', label: '奖励' }, { value: 'MILESTONE', label: '里程碑' }];
const achColorMap: Record<string, string> = { ACHIEVEMENT: 'gold', AWARD: 'red', MILESTONE: 'blue' };

export default function PortalPage() {
  const [data, setData] = useState<any>(null);
  const [modal, setModal] = useState(false);
  const [editAch, setEditAch] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => { const r: any = await portalApi.get(); setData(r.data); };
  useEffect(() => { load(); }, []);

  const saveAch = async (values: any) => {
    const payload = { ...values, eventDate: values.eventDate?.format?.('YYYY-MM-DD') || values.eventDate };
    if (editAch) { await portalApi.updateAchievement(editAch.id, payload); }
    else { await portalApi.addAchievement(payload); }
    message.success('保存成功'); setModal(false); form.resetFields(); setEditAch(null); load();
  };

  if (!data) return <Card loading />;
  const p = data.profile || {};

  return (
    <div>
      <Row gutter={[16, 16]}>
        {/* 基础信息 */}
        <Col span={16}>
          <Card title={<><UserOutlined /> 个人信息</>}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="姓名">{p.name}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{p.email}</Descriptions.Item>
              <Descriptions.Item label="手机">{p.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色"><Tag color="blue">{formatRoleLabel(p.role, p.roleName)}</Tag></Descriptions.Item>
              <Descriptions.Item label="所属组织">{p.orgName || '-'}</Descriptions.Item>
              <Descriptions.Item label="岗位">{p.positionName || '-'}</Descriptions.Item>
              <Descriptions.Item label="入职日期">{p.hiredAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="在职天数">{p.daysEmployed != null ? <b>{p.daysEmployed} 天</b> : '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 同岗位排名 */}
        <Col span={8}>
          <Card title={<><TrophyOutlined /> 同岗位排名</>} size="small">
            {data.positionRanking?.length ? (
              <Table dataSource={data.positionRanking} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: '排名', width: 50, render: (_: any, __: any, i: number) => <b>{i + 1}</b> },
                  { title: '姓名', dataIndex: 'name' },
                  { title: '完成工作数', dataIndex: 'thread_count', align: 'center' },
                ]} />
            ) : <p style={{ color: '#888' }}>{uiText.appEmpty}</p>}
          </Card>
        </Col>

        {/* 关系网 - 对内 */}
        <Col span={12}>
          <Card title={<><TeamOutlined /> 对内关系网</>} size="small">
            <div style={{ marginBottom: 8 }}><b>上级</b></div>
            {data.superiors?.length ? (
              <Space wrap>{data.superiors.map((s: any) => <Tag key={s.id} color="purple">{s.name}{s.pos_name ? `（${s.pos_name}）` : ''}</Tag>)}</Space>
            ) : <p style={{ color: '#888' }}>无</p>}
            <div style={{ marginTop: 12, marginBottom: 8 }}><b>下级</b></div>
            {data.subordinates?.length ? (
              <Space wrap>{data.subordinates.map((s: any) => <Tag key={s.id} color="cyan">{s.name}{s.pos_name ? `（${s.pos_name}）` : ''}</Tag>)}</Space>
            ) : <p style={{ color: '#888' }}>无</p>}
          </Card>
        </Col>

        {/* 关系网 - 对外 */}
        <Col span={12}>
          <Card title={<><GlobalOutlined /> 对外关系网</>} size="small">
            {data.externalContacts?.length ? (
              <List size="small" dataSource={data.externalContacts} renderItem={(item: any) => (
                <List.Item>
                  <Tag color="orange">{formatObjectType(item.type)}</Tag>
                  {item.name} {item.contact ? `(${item.contact})` : ''} {item.phone || ''}
                </List.Item>
              )} />
            ) : <p style={{ color: '#888' }}>{uiText.noExternalObjectLinks}</p>}
          </Card>
        </Col>

        {/* 重大事件 */}
        <Col span={24}>
          <Card title={<><TrophyOutlined /> 重大事件 / 奖励记录</>} extra={
            <Button type="primary" size="small" onClick={() => { setEditAch(null); form.resetFields(); setModal(true); }}>添加记录</Button>
          }>
            {data.achievements?.length ? (
              <Table dataSource={data.achievements} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: '类型', dataIndex: 'type', width: 90, render: (v: string) => <Tag color={achColorMap[v]}>{achTypeOpts.find(o => o.value === v)?.label || v}</Tag> },
                  { title: '标题', dataIndex: 'title' },
                  { title: '描述', dataIndex: 'description', ellipsis: true },
                  { title: '日期', dataIndex: 'event_date', width: 110 },
                  { title: '操作', width: 120, render: (_: any, r: any) => (
                    <Space>
                      <Button size="small" onClick={() => { setEditAch(r); form.setFieldsValue({ ...r, eventDate: r.event_date }); setModal(true); }}>编辑</Button>
                      <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await portalApi.deleteAchievement(r.id); message.success('已删除'); load(); }}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )},
                ]} />
            ) : <p style={{ color: '#888' }}>{uiText.noAchievementRecords}</p>}
          </Card>
        </Col>
      </Row>

      <Modal okText="确定" cancelText="取消" title={editAch ? '编辑记录' : '添加记录'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={saveAch} layout="vertical">
          <Form.Item name="type" label="类型" initialValue="ACHIEVEMENT"><Select options={achTypeOpts} /></Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="eventDate" label="日期"><Input placeholder="2026-01-01" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
