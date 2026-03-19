import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tabs, Tag, Pagination } from 'antd';
import { objectApi, userApi } from '../../api';
import { formatPaginationTotal, paginationLocale, uiText } from '../../constants/ui';

const allTypeOptions = [
  { value: 'CUSTOMER', label: '客户' },
  { value: 'SUPPLIER', label: '供应商' },
  { value: 'CARRIER', label: '承运商' },
  { value: 'BANK', label: '银行' },
  { value: 'THIRD_PARTY_PAY', label: '第三方支付' },
  { value: 'OTHER', label: '其他' },
];

function ObjectTable({ type, orgs, users, departments }: { type: string; orgs: any[]; users: any[]; departments: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [form] = Form.useForm();

  const isCustomerType = type === 'CUSTOMER';

  const load = async (c = current, s = size, deptId = filterDept) => {
    const r: any = await objectApi.page({ current: c, size: s, type, deptId });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(c);
    setSize(s);
  };

  useEffect(() => {
    load(1, size, filterDept);
  }, [type, filterDept]);

  const save = async (values: any) => {
    const payload = {
      ...values,
      type,
      industry: isCustomerType ? values.industry : null,
    };
    if (edit) {
      await objectApi.update(edit.id, payload);
    } else {
      await objectApi.create(payload);
    }
    message.success('保存成功');
    setModal(false);
    form.resetFields();
    setEdit(null);
    load(1, size, filterDept);
  };

  const reloadAfterDelete = async (id: string) => {
    await objectApi.delete(id);
    message.success('已删除');
    const nextCurrent = current > 1 && data.length === 1 ? current - 1 : current;
    load(nextCurrent, size, filterDept);
  };

  const orgName = (id: string) => orgs.find(o => o.id === id)?.name || '-';
  const deptName = (id: string) => departments.find(o => o.id === id)?.name || orgName(id);
  const userName = (id: string) => users.find(u => u.id === id)?.name || '-';

  const columns = useMemo(() => {
    const baseColumns: any[] = [
      { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
      { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
      { title: '联系人', dataIndex: 'contact', width: 120, ellipsis: true },
      { title: '电话', dataIndex: 'phone', width: 140, ellipsis: true },
      { title: '所属组织', dataIndex: 'orgId', width: 120, render: (v: string) => v ? <Tag color="blue">{orgName(v)}</Tag> : '-' },
      { title: '所属部门', dataIndex: 'deptId', width: 120, render: (v: string) => v ? <Tag color="purple">{deptName(v)}</Tag> : '-' },
      { title: '负责人', dataIndex: 'ownerId', width: 100, render: (v: string) => v ? <Tag color="green">{userName(v)}</Tag> : '-' },
    ];

    if (isCustomerType) {
      baseColumns.splice(4, 0, { title: '行业', dataIndex: 'industry', width: 140, ellipsis: true });
    }

    baseColumns.push({
      title: '操作',
      width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
          <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={() => reloadAfterDelete(r.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    });

    return baseColumns;
  }, [current, size, isCustomerType, orgs, departments, users]);

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="page-toolbar">
          <Select
            allowClear
            placeholder="按所属部门筛选"
            style={{ width: 220 }}
            onChange={v => setFilterDept(v)}
            options={departments.map(o => ({ value: o.id, label: o.name }))}
          />
          <div className="page-toolbar-right">
            <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>
              新增{allTypeOptions.find(o => o.value === type)?.label}
            </Button>
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
          <div style={{ flex: 1, minHeight: 0, padding: '12px 12px 32px 12px', overflow: 'hidden' }}>
            <Table
              dataSource={data}
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              showSorterTooltip={false}
              scroll={{ y: 'calc(100dvh - 455px)' }}
              columns={columns}
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
              showTotal={(t) => formatPaginationTotal(t)}
              onChange={(page, pageSize) => load(page, pageSize, filterDept)}
            />
          </div>
        </div>
      </div>

      <Modal okText="确定" cancelText="取消" title={edit ? '编辑' : '新增'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          {isCustomerType ? <Form.Item name="industry" label="行业"><Input /></Form.Item> : null}
          <Form.Item name="orgId" label="所属组织">
            <Select allowClear placeholder="选择组织" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="deptId" label="所属部门">
            <Select allowClear placeholder="选择部门" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="ownerId" label="负责人">
            <Select allowClear showSearch placeholder="选择负责人" optionFilterProp="label"
              options={users.map(u => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function ObjectPage() {
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    userApi.me().then((r: any) => {
      const types = r.data?.objectTypes || [];
      if (types.length === 0 && r.data?.role === 'ADMIN') {
        setObjectTypes(allTypeOptions.map(o => o.value));
      } else {
        setObjectTypes(types);
      }
    });
    userApi.lookups().then((r: any) => {
      setOrgs(r.data?.orgs || []);
      setUsers(r.data?.users || []);
    }).catch(() => {});
    objectApi.departments().then((r: any) => {
      setDepartments(r.data || []);
    }).catch(() => {});
  }, []);

  const visibleTypes = allTypeOptions.filter(o => objectTypes.includes(o.value));

  if (visibleTypes.length === 0) {
    return (
      <Card title="外部对象管理" className="page-card page-fill" styles={{ body: { minHeight: 0, display: 'flex', flexDirection: 'column' } }}>
        <p style={{ color: '#888' }}>您当前岗位没有可查看的外部对象类型，请联系管理员配置。</p>
      </Card>
    );
  }

  return (
    <Card
      title="外部对象管理"
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body">
        <Tabs
          className="page-tabs"
          items={visibleTypes.map(t => ({
            key: t.value,
            label: t.label,
            children: (
              <div className="page-fill">
                <ObjectTable type={t.value} orgs={orgs} users={users} departments={departments} />
              </div>
            ),
          }))}
        />
      </div>
    </Card>
  );
}
