import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag, Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import { userApi, orgApi, positionApi } from '../../api';
import { formatPaginationTotal, formatRoleLabel, paginationLocale, uiText } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

const roleColorMap: Record<string, string> = { ADMIN: 'red', HR: 'purple', SALES: 'cyan', PURCHASE: 'geekblue', FINANCE: 'gold', BIZ: 'orange', TECH: 'lime', WAREHOUSE: 'volcano', IT: 'magenta', PRODUCTION: 'green', STAFF: 'default' };

export default function UserTab() {
  const nav = useNavigate();
  const role = useAuthStore(s => s.role);
  const canManagePersonnel = role === 'ADMIN' || role === 'HR';
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);

  const [orgs, setOrgs] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [filterOrg, setFilterOrg] = useState<any>();

  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const loadOrgs = async () => {
    const r: any = await orgApi.list();
    setOrgs(r.data || []);
  };

  const loadPositions = async () => {
    const r: any = await positionApi.list();
    setPositions(r.data || []);
  };

  const loadRoles = async () => {
    const r: any = await userApi.lookups();
    setRoles(r.data?.roles || []);
  };

  const loadUsers = async (c = current, s = size, orgId = filterOrg) => {
    const r: any = await userApi.page({ current: c, size: s, orgId });
    setUsers(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(c);
    setSize(s);
  };

  useEffect(() => {
    loadOrgs();
    loadPositions();
    loadRoles();
  }, []);

  useEffect(() => {
    loadUsers(1, size, filterOrg);
  }, [filterOrg]);

  const save = async (values: any) => {
    if (edit) {
      await userApi.update(edit.id, values);
    } else {
      await userApi.create(values);
    }
    message.success('保存成功');
    setModal(false);
    form.resetFields();
    setEdit(null);
    loadUsers(current, size, filterOrg);
  };

  const orgName = (id: any) => orgs.find(o => o.id === id)?.name || '-';
  const posName = (id: any) => positions.find(p => p.id === id)?.name || '-';

  const openEdit = (r: any) => {
    setEdit(r);
    form.setFieldsValue({ ...r, extraPositionIds: r.extraPositionIds || [] });
    setModal(true);
  };

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="page-toolbar">
          <Select
            allowClear
            placeholder="按组织筛选"
            style={{ width: 220 }}
            options={orgs.map(o => ({ value: o.id, label: o.name }))}
            onChange={v => setFilterOrg(v)}
          />
          <div className="page-toolbar-right">
            {canManagePersonnel ? <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button> : null}
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
              dataSource={users}
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: 'calc(100dvh - 455px)' }}
              columns={[
                { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                { title: '工号', dataIndex: 'empNo', width: 110, ellipsis: true },
                { title: '姓名', dataIndex: 'name', width: 90, ellipsis: true },
                { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
                { title: '手机', dataIndex: 'phone', width: 120, ellipsis: true },
                { title: '角色', dataIndex: 'role', width: 90, render: (v: string) => <Tag color={roleColorMap[v] || 'default'}>{formatRoleLabel(v, roles.find(r => r.code === v)?.name)}</Tag> },
                { title: '所属组织', dataIndex: 'orgId', width: 120, render: (v: any) => v ? <Tag color="blue">{orgName(v)}</Tag> : '-' },
                { title: '主岗位', dataIndex: 'primaryPositionId', width: 120, render: (v: any) => v ? <Tag color="green">{posName(v)}</Tag> : '-' },
                {
                  title: '辅助岗位',
                  dataIndex: 'extraPositionIds',
                  width: 180,
                  ellipsis: true,
                  render: (ids: any[]) => ids?.length ? ids.map(id => <Tag key={id} color="orange">{posName(id)}</Tag>) : '-',
                },
                {
                  title: '操作',
                  width: canManagePersonnel ? 210 : 110,
                  render: (_: any, r: any) => (
                    <Space size={6} wrap>
                      <Button size="small" onClick={() => nav(`/users/${r.id}/portal`)}>门户</Button>
                      {canManagePersonnel ? (
                        <>
                          <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
                          <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await userApi.delete(r.id); message.success('已删除'); const nextCurrent = current > 1 && users.length === 1 ? current - 1 : current; loadUsers(nextCurrent, size, filterOrg); }}>
                            <Button size="small" danger>删除</Button>
                          </Popconfirm>
                        </>
                      ) : null}
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
              showTotal={(t) => formatPaginationTotal(t)}
              onChange={(page, pageSize) => loadUsers(page, pageSize, filterOrg)}
            />
          </div>
        </div>
      </div>

      {canManagePersonnel ? <Modal okText="确定" cancelText="取消" title={edit ? '编辑人员' : '新增人员'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={520}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          {!edit && <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>}
          {!edit && <Form.Item name="password" label="密码" extra="不填默认123456"><Input.Password /></Form.Item>}
          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder="不选则根据岗位自动推导" options={roles.map((r: any) => ({ value: r.code, label: formatRoleLabel(r.code, r.name) }))} />
          </Form.Item>
          <Form.Item name="orgId" label="所属组织">
            <Select allowClear placeholder="选择组织" options={orgs.map(o => ({ value: o.id, label: o.name }))} />
          </Form.Item>
          <Form.Item name="primaryPositionId" label="主岗位">
            <Select allowClear placeholder="选择岗位" options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="extraPositionIds" label="辅助岗位（可多选）">
            <Select mode="multiple" allowClear placeholder="选择辅助岗位" options={positions.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))} />
          </Form.Item>
          <Form.Item name="hiredAt" label="入职日期"><Input placeholder="2026-01-01" /></Form.Item>
        </Form>
      </Modal> : null}
    </>
  );
}
