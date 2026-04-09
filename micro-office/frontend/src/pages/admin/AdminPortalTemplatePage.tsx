import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { portalTemplateAdminApi } from '../../api';

export default function AdminPortalTemplatePage() {
  const nav = useNavigate();
  const [meta, setMeta] = useState<any>({});
  const [positions, setPositions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const templateTypeOptions = useMemo(() => meta.templateTypes || [], [meta]);
  const roleOptions = useMemo(() => meta.roleKeys || [], [meta]);
  const statusOptions = useMemo(() => meta.statusOptions || [], [meta]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const [metaResp, positionResp, templateResp] = await Promise.all([
        portalTemplateAdminApi.meta(),
        portalTemplateAdminApi.positions(),
        portalTemplateAdminApi.listTemplates(),
      ]);
      setMeta(metaResp.data || {});
      setPositions(positionResp.data || []);
      setTemplates(templateResp.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLists();
  }, []);

  const handleGenerate = async (positionId: string) => {
    const resp: any = await portalTemplateAdminApi.generateByPosition({ positionId });
    await loadLists();
    message.success('岗位模板已生成，已跳转到编辑页');
    if (resp.data?.id) {
      nav(`/admin/portal-templates/${resp.data.id}`);
    }
  };

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    const resp: any = await portalTemplateAdminApi.createTemplate({
      code: values.code,
      name: values.name,
      templateType: values.templateType,
      roleKey: values.templateType === 'PERSON_ROLE' ? values.roleKey || null : null,
      status: values.status || 'DRAFT',
      version: values.version || 1,
      meta: {},
      sections: [],
    });
    setCreateOpen(false);
    createForm.resetFields();
    await loadLists();
    message.success('模板已创建，已跳转到编辑页');
    if (resp.data?.id) {
      nav(`/admin/portal-templates/${resp.data.id}`);
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Alert
        type="info"
        showIcon
        message="门户模板"
        description="当前页只保留岗位生成和模板列表。模板编辑已拆到独立子页面，点击“编辑”或模板名称后通过路由跳转。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <Card
          className="page-card"
          title="按岗位生成模板"
          extra={<Button icon={<ReloadOutlined />} onClick={() => void loadLists()}>刷新</Button>}
          bodyStyle={{ padding: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Spin spinning={loading} style={{ flex: 1, minHeight: 0 }}>
            <Table
              rowKey="positionId"
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={positions}
              scroll={{ x: 780, y: 520 }}
              columns={[
                {
                  title: '岗位',
                  dataIndex: 'positionName',
                  width: 190,
                  render: (_: any, row: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.positionName}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{row.positionCode || '-'}</div>
                    </div>
                  ),
                },
                {
                  title: '推荐种子',
                  width: 220,
                  render: (_: any, row: any) => (
                    <Space direction="vertical" size={2}>
                      {row.recommendedRole ? <Tag color="blue">{row.recommendedRole}</Tag> : <Tag>未推断</Tag>}
                      <span style={{ color: '#6b7280', fontSize: 12 }}>{row.seedTemplateName || '无匹配种子，生成空模板'}</span>
                    </Space>
                  ),
                },
                {
                  title: '当前模板',
                  width: 220,
                  render: (_: any, row: any) => (
                    row.templateId ? (
                      <Button type="link" style={{ paddingInline: 0 }} onClick={() => nav(`/admin/portal-templates/${row.templateId}`)}>
                        {row.templateName}
                      </Button>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>未生成</span>
                    )
                  ),
                },
                {
                  title: '操作',
                  width: 140,
                  render: (_: any, row: any) => (
                    row.templateId ? (
                      <Button size="small" onClick={() => nav(`/admin/portal-templates/${row.templateId}`)}>编辑模板</Button>
                    ) : (
                      <Button size="small" type="primary" onClick={() => void handleGenerate(row.positionId)}>生成模板</Button>
                    )
                  ),
                },
              ]}
            />
          </Spin>
        </Card>

        <Card
          className="page-card"
          title="模板列表"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建空模板</Button>}
          bodyStyle={{ padding: 12, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Spin spinning={loading} style={{ flex: 1, minHeight: 0 }}>
            <Table
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={templates}
              scroll={{ x: 920, y: 520 }}
              columns={[
                {
                  title: '模板',
                  width: 260,
                  render: (_: any, row: any) => (
                    <div>
                      <Button type="link" style={{ paddingInline: 0, fontWeight: 600 }} onClick={() => nav(`/admin/portal-templates/${row.id}`)}>
                        {row.name}
                      </Button>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{row.code}</div>
                    </div>
                  ),
                },
                {
                  title: '类型',
                  width: 120,
                  render: (_: any, row: any) => <Tag>{row.templateType}</Tag>,
                },
                {
                  title: '岗位',
                  width: 180,
                  render: (_: any, row: any) => row.positionName || '-',
                },
                {
                  title: '状态',
                  width: 100,
                  render: (_: any, row: any) => (
                    <Tag color={row.status === 'ACTIVE' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>{row.status}</Tag>
                  ),
                },
                {
                  title: '结构',
                  width: 160,
                  render: (_: any, row: any) => `${row.sectionCount}/${row.itemCount}/${row.actionCount}`,
                },
                {
                  title: '操作',
                  width: 120,
                  render: (_: any, row: any) => (
                    <Button size="small" onClick={() => nav(`/admin/portal-templates/${row.id}`)}>编辑</Button>
                  ),
                },
              ]}
            />
          </Spin>
        </Card>
      </div>

      <Modal
        title="新建空模板"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => void handleCreate()}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ templateType: 'PERSON_ROLE', status: 'DRAFT', version: 1 }}
        >
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="模板编码" rules={[{ required: true, message: '请输入模板编码' }]}>
            <Input placeholder="例如 POSITION_CEO" onChange={e => createForm.setFieldValue('code', String(e.target.value || '').toUpperCase())} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Form.Item name="templateType" label="模板类型" rules={[{ required: true, message: '请选择模板类型' }]}>
              <Select options={templateTypeOptions} />
            </Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() => (
                <Form.Item name="roleKey" label="角色标识">
                  <Select allowClear options={roleOptions} disabled={createForm.getFieldValue('templateType') !== 'PERSON_ROLE'} />
                </Form.Item>
              )}
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={statusOptions} />
            </Form.Item>
          </div>
          <Form.Item name="version" label="版本">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
