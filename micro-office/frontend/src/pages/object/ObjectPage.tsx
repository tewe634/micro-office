import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tabs, Tag, message, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
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

const customerRoleOptions = [
  { value: '最终用户', label: '最终用户' },
  { value: '总包商', label: '总包商' },
  { value: '制造商', label: '制造商' },
  { value: '分销商', label: '分销商' },
];

const customerScaleOptions = [
  { value: '大客户', label: '大客户（业绩>1000万）' },
  { value: '中型客户', label: '中型客户（业绩>500万）' },
  { value: '小客户', label: '小客户（业绩<500万）' },
];

type OrgNode = {
  id: string;
  name: string;
  parentId?: string;
};

type DepartmentNode = {
  id: string;
  name: string;
  parentId?: string;
  orgId: string;
};

type SearchFilters = {
  deptId?: string;
  name?: string;
  customerRole?: string;
  customerScale?: string;
};

function ObjectTable({
  type,
  orgs,
  allNodes,
  users,
  departments,
}: {
  type: string;
  orgs: OrgNode[];
  allNodes: OrgNode[];
  users: any[];
  departments: DepartmentNode[];
}) {
  const nav = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
  const [searchForm] = Form.useForm();
  const [form] = Form.useForm();
  const selectedOrgId = Form.useWatch('orgId', form);

  const isCustomerType = type === 'CUSTOMER';
  const typeLabel = allTypeOptions.find(o => o.value === type)?.label || '对象';
  const orgIdSet = useMemo(() => new Set(orgs.map(o => o.id)), [orgs]);
  const allNodeMap = useMemo(() => new Map(allNodes.map(node => [node.id, node])), [allNodes]);
  const departmentMap = useMemo(() => new Map(departments.map(dept => [dept.id, dept])), [departments]);
  const orgOptions = useMemo(() => orgs.map(o => ({ value: o.id, label: o.name })), [orgs]);
  const departmentOptions = useMemo(() => departments.map(o => ({ value: o.id, label: o.name })), [departments]);
  const filteredDepartmentOptions = useMemo(
    () => departments
      .filter(o => !selectedOrgId || o.orgId === selectedOrgId)
      .map(o => ({ value: o.id, label: o.name })),
    [departments, selectedOrgId],
  );
  const userOptions = useMemo(() => users.map(u => ({ value: u.id, label: u.name })), [users]);

  const load = async (c = current, s = size, filters: SearchFilters = activeFilters) => {
    const r: any = await objectApi.page({
      current: c,
      size: s,
      type,
      deptId: filters.deptId || undefined,
      name: filters.name?.trim() || undefined,
      customerRole: isCustomerType ? filters.customerRole || undefined : undefined,
      customerScale: isCustomerType ? filters.customerScale || undefined : undefined,
    });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(c);
    setSize(s);
  };

  useEffect(() => {
    setActiveFilters({});
    searchForm.resetFields();
    load(1, size, {});
  }, [type]);

  const onSearch = async () => {
    const values = searchForm.getFieldsValue();
    const nextFilters = {
      deptId: values.deptId || undefined,
      name: values.name?.trim() || undefined,
      customerRole: isCustomerType ? values.customerRole || undefined : undefined,
      customerScale: isCustomerType ? values.customerScale || undefined : undefined,
    };
    setActiveFilters(nextFilters);
    await load(1, size, nextFilters);
  };

  const normalizeRecordForForm = (record: any) => {
    const next = { ...record };

    if (next.orgId && !orgIdSet.has(next.orgId)) {
      const mistakenDept = departmentMap.get(next.orgId);
      if (mistakenDept) {
        next.deptId = next.deptId ?? mistakenDept.id;
        next.orgId = mistakenDept.orgId;
      }
    }

    if (next.deptId && orgIdSet.has(next.deptId)) {
      next.orgId = next.deptId;
      next.deptId = undefined;
    }

    if (next.deptId && next.orgId) {
      const dept = departmentMap.get(next.deptId);
      if (!dept || dept.orgId !== next.orgId) {
        next.deptId = undefined;
      }
    }

    return next;
  };

  const openEditor = (record?: any) => {
    setEdit(record || null);
    setModal(true);
    form.resetFields();
    if (record) {
      form.setFieldsValue(normalizeRecordForForm(record));
    }
  };

  const handleOrgChange = (orgId?: string) => {
    const deptId = form.getFieldValue('deptId');
    if (!deptId) {
      return;
    }
    const department = departmentMap.get(deptId);
    if (!department || !orgId || department.orgId !== orgId) {
      form.setFieldValue('deptId', undefined);
    }
  };

  const save = async (values: any) => {
    const payload = {
      type,
      name: values.name,
      contact: values.contact ?? null,
      phone: values.phone ?? null,
      address: values.address ?? null,
      orgId: values.orgId ?? null,
      deptId: values.deptId ?? null,
      ownerId: values.ownerId ?? null,
      remark: values.remark ?? null,
      industry: isCustomerType ? values.industry ?? null : null,
      customerRole: isCustomerType ? values.customerRole ?? null : null,
      customerScale: isCustomerType ? values.customerScale ?? null : null,
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
    load(current, size, activeFilters);
  };

  const reloadAfterDelete = async (id: string) => {
    await objectApi.delete(id);
    message.success('已删除');
    const nextCurrent = current > 1 && data.length === 1 ? current - 1 : current;
    load(nextCurrent, size, activeFilters);
  };

  const userName = (id: string) => users.find(u => u.id === id)?.name || '-';

  const resolveOrgName = (record: any) => {
    if (!record?.orgId) {
      return '-';
    }
    if (orgIdSet.has(record.orgId)) {
      return allNodeMap.get(record.orgId)?.name || '-';
    }
    const mistakenDept = departmentMap.get(record.orgId);
    if (mistakenDept) {
      return allNodeMap.get(mistakenDept.orgId)?.name || allNodeMap.get(record.orgId)?.name || '-';
    }
    return allNodeMap.get(record.orgId)?.name || '-';
  };

  const resolveDeptName = (record: any) => {
    if (record?.deptId) {
      return allNodeMap.get(record.deptId)?.name || '-';
    }
    if (record?.orgId && !orgIdSet.has(record.orgId) && departmentMap.has(record.orgId)) {
      return allNodeMap.get(record.orgId)?.name || '-';
    }
    return '-';
  };

  const columns = useMemo(() => {
    const baseColumns: any[] = [
      { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
      { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
      { title: '联系人', dataIndex: 'contact', width: 120, ellipsis: true },
      { title: '电话', dataIndex: 'phone', width: 140, ellipsis: true },
      {
        title: '所属组织',
        dataIndex: 'orgId',
        width: 120,
        render: (_: string, record: any) => record?.orgId ? <Tag color="blue">{resolveOrgName(record)}</Tag> : '-',
      },
      {
        title: '所属部门',
        dataIndex: 'deptId',
        width: 120,
        render: (_: string, record: any) => (record?.deptId || (record?.orgId && !orgIdSet.has(record.orgId) && departmentMap.has(record.orgId)))
          ? <Tag color="purple">{resolveDeptName(record)}</Tag>
          : '-',
      },
      { title: '负责人', dataIndex: 'ownerId', width: 100, render: (v: string) => v ? <Tag color="green">{userName(v)}</Tag> : '-' },
    ];

    if (isCustomerType) {
      baseColumns.splice(
        4,
        0,
        { title: '行业', dataIndex: 'industry', width: 140, ellipsis: true },
        { title: '角色', dataIndex: 'customerRole', width: 120, render: (v: string) => v ? <Tag color="cyan">{v}</Tag> : '-' },
        { title: '规模', dataIndex: 'customerScale', width: 160, render: (v: string) => v ? <Tag color="gold">{v}</Tag> : '-' },
      );
    }

    baseColumns.push({
      title: '操作',
      width: 200,
      render: (_: any, r: any) => (
        <Space size={6} wrap>
          <Button size="small" onClick={() => nav(`/objects/${r.id}/portal`)}>门户</Button>
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={() => reloadAfterDelete(r.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    });

    return baseColumns;
  }, [current, size, isCustomerType, orgIdSet, departmentMap, allNodeMap, users]);

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="page-toolbar">
          <Form
            form={searchForm}
            layout="inline"
            style={{ display: 'flex', flexWrap: 'wrap', rowGap: 12, columnGap: 8, minWidth: 0, flex: '1 1 0' }}
          >
            <Form.Item name="deptId" label="所属部门">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="请选择部门"
                style={{ width: 220 }}
                options={departmentOptions}
              />
            </Form.Item>
            <Form.Item name="name" label="名称">
              <Input allowClear placeholder="请输入名称" style={{ width: 220 }} />
            </Form.Item>
            {isCustomerType ? (
              <>
                <Form.Item name="customerRole" label="角色">
                  <Select
                    allowClear
                    optionFilterProp="label"
                    placeholder="请选择角色"
                    style={{ width: 180 }}
                    options={customerRoleOptions}
                  />
                </Form.Item>
                <Form.Item name="customerScale" label="规模">
                  <Select
                    allowClear
                    optionFilterProp="label"
                    placeholder="请选择规模"
                    style={{ width: 220 }}
                    options={customerScaleOptions}
                  />
                </Form.Item>
              </>
            ) : null}
            <Form.Item>
              <Button type="primary" onClick={onSearch}>搜索</Button>
            </Form.Item>
          </Form>
          <div className="page-toolbar-right">
            <Button type="primary" onClick={() => openEditor()}>
              新增{typeLabel}
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
              scroll={{ x: 1560, y: 'calc(100dvh - 495px)' }}
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
              onChange={(page, pageSize) => load(page, pageSize, activeFilters)}
            />
          </div>
        </div>
      </div>

      <Modal
        okText="确定"
        cancelText="取消"
        title={edit ? `编辑${typeLabel}` : `新增${typeLabel}`}
        open={modal}
        onCancel={() => {
          setModal(false);
          setEdit(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={720}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 } }}
      >
        <Form form={form} onFinish={save} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contact" label="联系人"><Input /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="电话"><Input /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="address" label="地址"><Input /></Form.Item>
            </Col>
            {isCustomerType ? (
              <>
                <Col xs={24} sm={12}>
                  <Form.Item name="industry" label="行业"><Input /></Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="customerRole" label="角色">
                    <Select
                      allowClear
                      optionFilterProp="label"
                      placeholder="请选择角色"
                      options={customerRoleOptions}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="customerScale"
                    label="规模"
                    extra="大客户：业绩>1000万；中型客户：业绩>500万；小客户：业绩<500万"
                  >
                    <Select
                      allowClear
                      optionFilterProp="label"
                      placeholder="请选择规模"
                      options={customerScaleOptions}
                    />
                  </Form.Item>
                </Col>
              </>
            ) : null}
            <Col xs={24} sm={12}>
              <Form.Item name="orgId" label="所属组织">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择组织"
                  options={orgOptions}
                  onChange={handleOrgChange}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="deptId"
                label="所属部门"
                extra="请选择对应组织后再选部门；负责人留空时，可按组织/部门共享。"
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={selectedOrgId ? '选择部门' : '请先选择组织'}
                  options={filteredDepartmentOptions}
                  disabled={!selectedOrgId}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="ownerId"
                label="负责人"
                extra="设置负责人后，仅负责人本人或其领导可见；清空负责人后，按组织/部门共享。"
              >
                <Select allowClear showSearch placeholder="选择负责人" optionFilterProp="label" options={userOptions} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="remark" label="备注"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}

export default function ObjectPage() {
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<OrgNode[]>([]);
  const [allNodes, setAllNodes] = useState<OrgNode[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);

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
      setUsers(r.data?.users || []);
      setAllNodes(prev => prev.length > 0 ? prev : (r.data?.orgs || []));
    }).catch(() => {});
    objectApi.orgStructure().then((r: any) => {
      setOrgs(r.data?.orgs || []);
      setDepartments(r.data?.departments || []);
      setAllNodes(r.data?.allNodes || []);
    }).catch(() => {});
  }, []);

  const visibleTypes = allTypeOptions.filter(o => objectTypes.includes(o.value));

  if (visibleTypes.length === 0) {
    return (
      <Card className="page-card page-fill" styles={{ body: { minHeight: 0, display: 'flex', flexDirection: 'column' } }}>
        <p style={{ color: '#888' }}>您当前岗位没有可查看的外部对象类型，请联系管理员配置。</p>
      </Card>
    );
  }

  return (
    <Card
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
                <ObjectTable type={t.value} orgs={orgs} allNodes={allNodes} users={users} departments={departments} />
              </div>
            ),
          }))}
        />
      </div>
    </Card>
  );
}
