import { useEffect, useState } from 'react';
import { Card, Table, Checkbox, Button, message, Tag, Tabs, Select, Space, Divider } from 'antd';
import { adminApi, userApi, orgApi, positionApi } from '../../api';
import { formatRoleLabel } from '../../constants/ui';

type RoleItem = {
  key: string;
  label: string;
  color: string;
};

const roleColorMap: Record<string, string> = {
  ADMIN: 'red',
  HR: 'purple',
  SALES: 'cyan',
  PURCHASE: 'geekblue',
  FINANCE: 'gold',
  BIZ: 'orange',
  TECH: 'lime',
  WAREHOUSE: 'volcano',
  IT: 'magenta',
  PRODUCTION: 'green',
  STAFF: 'default',
};

const menus = [
  { key: '/users', label: '人员管理' },
  { key: '/objects', label: '外部对象' },
  { key: '/products', label: '产品服务' },
  { key: '/admin', label: '系统管理' },
  { key: '/admin/permissions', label: '权限配置' },
];

const objectTypes = [
  { key: 'CUSTOMER', label: '客户' },
  { key: 'SUPPLIER', label: '供应商' },
  { key: 'CARRIER', label: '承运商' },
  { key: 'BANK', label: '银行' },
  { key: 'THIRD_PARTY_PAY', label: '第三方支付' },
  { key: 'OTHER', label: '其他' },
];

function RolePermTab({ roles }: { roles: RoleItem[] }) {
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r: any = await adminApi.getPermissions();
    setPerms(r.data || {});
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (role: string, menuKey: string, checked: boolean) => {
    setPerms(prev => {
      const list = [...(prev[role] || [])];
      if (checked && !list.includes(menuKey)) list.push(menuKey);
      if (!checked) {
        const i = list.indexOf(menuKey);
        if (i >= 0) list.splice(i, 1);
      }
      return { ...prev, [role]: list };
    });
  };

  const save = async () => {
    setLoading(true);
    const payload = roles.reduce((acc, role) => {
      acc[role.key] = perms[role.key] || [];
      return acc;
    }, {} as Record<string, string[]>);
    await adminApi.savePermissions(payload);
    message.success('角色权限已保存');
    setLoading(false);
  };

  return (
    <div className="page-fill" style={{ gap: 16 }}>
      <p style={{ color: '#888', margin: 0 }}>角色模块权限已同步系统角色表。组织架构模块固定为全员可见；人员管理仍走权限配置，与组织架构查看权限相互独立。</p>
      <div className="page-card-scroll">
        <Table
          dataSource={menus}
          rowKey="key"
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: Math.max(900, 140 + roles.length * 110) }}
          columns={[
            { title: '功能模块', dataIndex: 'label', width: 140, fixed: 'left' as const },
            ...roles.map(r => ({
              title: <Tag color={r.color}>{r.label}</Tag>,
              width: 110,
              align: 'center' as const,
              render: (_: any, record: any) => (
                <Checkbox
                  checked={(perms[r.key] || []).includes(record.key)}
                  onChange={e => toggle(r.key, record.key, e.target.checked)}
                />
              ),
            })),
          ]}
        />
      </div>
      <div>
        <Button type="primary" loading={loading} onClick={save}>保存角色权限</Button>
      </div>
    </div>
  );
}

function UserPermTab({ roles }: { roles: RoleItem[] }) {
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [filterOrg, setFilterOrg] = useState<string | number>();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userMenus, setUserMenus] = useState<string[]>([]);
  const [hasCustomMenus, setHasCustomMenus] = useState(false);
  const [userObjTypes, setUserObjTypes] = useState<string[]>([]);
  const [hasCustomObjTypes, setHasCustomObjTypes] = useState(false);
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    orgApi.list().then((r: any) => setOrgs(r.data || []));
    adminApi.getPermissions().then((r: any) => setRolePerms(r.data || {}));
  }, []);

  useEffect(() => {
    userApi.list(filterOrg as any).then((r: any) => setUsers(r.data || []));
  }, [filterOrg]);

  const selectUser = async (u: any) => {
    setSelectedUser(u);

    const menuRes: any = await adminApi.getUserMenus(u.id);
    const customMenus = (menuRes.data || []) as string[];
    if (customMenus.length > 0) {
      setUserMenus(customMenus);
      setHasCustomMenus(true);
    } else {
      setUserMenus(rolePerms[u.role] || []);
      setHasCustomMenus(false);
    }

    const objRes: any = await adminApi.getUserObjectTypes(u.id);
    const customObj = (objRes.data || []) as string[];
    if (customObj.length > 0) {
      setUserObjTypes(customObj);
      setHasCustomObjTypes(true);
    } else {
      setUserObjTypes([]);
      setHasCustomObjTypes(false);
    }
  };

  const toggleMenu = (key: string, checked: boolean) => {
    setHasCustomMenus(true);
    setUserMenus(prev => checked ? [...prev, key] : prev.filter(k => k !== key));
  };

  const toggleObjType = (type: string, checked: boolean) => {
    setHasCustomObjTypes(true);
    setUserObjTypes(prev => checked ? [...prev, type] : prev.filter(t => t !== type));
  };

  const saveMenus = async () => {
    if (!selectedUser) return;
    setLoading(true);
    await adminApi.saveUserMenus(selectedUser.id, userMenus);
    message.success(`${selectedUser.name} 的模块权限已保存`);
    setLoading(false);
  };

  const resetMenus = async () => {
    if (!selectedUser) return;
    await adminApi.resetUserMenus(selectedUser.id);
    setUserMenus(rolePerms[selectedUser.role] || []);
    setHasCustomMenus(false);
    message.success('已恢复角色默认模块权限');
  };

  const saveObjTypes = async () => {
    if (!selectedUser) return;
    setLoading(true);
    await adminApi.saveUserObjectTypes(selectedUser.id, userObjTypes);
    message.success(`${selectedUser.name} 的对象类型权限已保存`);
    setLoading(false);
  };

  const resetObjTypes = async () => {
    if (!selectedUser) return;
    await adminApi.resetUserObjectTypes(selectedUser.id);
    setUserObjTypes([]);
    setHasCustomObjTypes(false);
    message.success('已恢复岗位默认对象类型权限');
  };

  return (
    <div className="split-panel">
      <div className="split-panel__aside">
        <Select
          allowClear
          placeholder="按组织筛选"
          style={{ width: '100%', marginBottom: 12 }}
          options={orgs.map(o => ({ value: o.id, label: o.name }))}
          onChange={v => setFilterOrg(v)}
        />
        <div className="fixed-table-page__frame" style={{ borderRadius: 12 }}>
          <div className="fixed-table-page__table">
            <Table
              dataSource={users}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              scroll={{ y: '100%' }}
              style={{ height: '100%' }}
              onRow={r => ({
                onClick: () => selectUser(r),
                style: { cursor: 'pointer', background: selectedUser?.id === r.id ? '#e6f4ff' : undefined },
              })}
              columns={[
                { title: '姓名', dataIndex: 'name', width: 80 },
                {
                  title: '角色',
                  dataIndex: 'role',
                  width: 100,
                  render: (v: string) => {
                    const r = roles.find(x => x.key === v);
                    return <Tag color={r?.color || 'default'}>{r?.label || v}</Tag>;
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="split-panel__content">
        <div className="split-panel__scroll">
          {selectedUser ? (
            <div style={{ paddingRight: 8 }}>
              <h4 style={{ marginTop: 0, marginBottom: 16 }}>{selectedUser.name} 的权限配置</h4>

              <div style={{ marginBottom: 8 }}>
                <b>功能模块</b> {hasCustomMenus ? <Tag color="orange">个人定制</Tag> : <Tag>角色默认</Tag>}
              </div>
              <Table
                dataSource={menus}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                columns={[
                  { title: '功能模块', dataIndex: 'label', width: 150 },
                  {
                    title: '可见',
                    width: 80,
                    align: 'center',
                    render: (_: any, record: any) => (
                      <Checkbox checked={userMenus.includes(record.key)} onChange={e => toggleMenu(record.key, e.target.checked)} />
                    ),
                  },
                ]}
              />
              <Space style={{ marginTop: 8, marginBottom: 24 }}>
                <Button type="primary" size="small" loading={loading} onClick={saveMenus}>保存模块权限</Button>
                {hasCustomMenus && <Button size="small" onClick={resetMenus}>恢复角色默认</Button>}
              </Space>

              <Divider />

              <div style={{ marginBottom: 8 }}>
                <b>外部对象类型</b> {hasCustomObjTypes ? <Tag color="orange">个人定制</Tag> : <Tag>岗位默认</Tag>}
              </div>
              <Table
                dataSource={objectTypes}
                rowKey="key"
                pagination={false}
                bordered
                size="small"
                columns={[
                  { title: '对象类型', dataIndex: 'label', width: 150 },
                  {
                    title: '可见',
                    width: 80,
                    align: 'center',
                    render: (_: any, record: any) => (
                      <Checkbox checked={userObjTypes.includes(record.key)} onChange={e => toggleObjType(record.key, e.target.checked)} />
                    ),
                  },
                ]}
              />
              <Space style={{ marginTop: 8 }}>
                <Button type="primary" size="small" loading={loading} onClick={saveObjTypes}>保存对象类型权限</Button>
                {hasCustomObjTypes && <Button size="small" onClick={resetObjTypes}>恢复岗位默认</Button>}
              </Space>
            </div>
          ) : (
            <p style={{ color: '#888', marginTop: 40 }}>← 点击左侧人员查看/编辑其权限（模块 + 对象类型）</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ObjectTypePermTab() {
  const [positions, setPositions] = useState<any[]>([]);
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    positionApi.list().then((r: any) => setPositions(r.data || []));
    adminApi.getPositionObjectTypes().then((r: any) => {
      const data = r.data || {};
      const mapped: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(data)) mapped[String(k)] = v as string[];
      setPerms(mapped);
    });
  }, []);

  const toggle = (posId: number, type: string, checked: boolean) => {
    const key = String(posId);
    setPerms(prev => {
      const list = [...(prev[key] || [])];
      if (checked && !list.includes(type)) list.push(type);
      if (!checked) {
        const i = list.indexOf(type);
        if (i >= 0) list.splice(i, 1);
      }
      return { ...prev, [key]: list };
    });
  };

  const save = async () => {
    setLoading(true);
    await adminApi.savePositionObjectTypes(perms);
    message.success('岗位对象类型权限已保存');
    setLoading(false);
  };

  return (
    <div className="page-fill" style={{ gap: 16 }}>
      <p style={{ color: '#888', margin: 0 }}>配置每个岗位默认可见的外部对象类型。用户如果没有个人对象类型配置，则根据岗位汇总。</p>
      <div className="page-card-scroll">
        <Table
          dataSource={positions}
          rowKey="id"
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 900 }}
          columns={[
            { title: '岗位', width: 140, render: (_: any, r: any) => `${r.name} (${r.code})` },
            ...objectTypes.map(ot => ({
              title: ot.label,
              width: 90,
              align: 'center' as const,
              render: (_: any, record: any) => (
                <Checkbox
                  checked={(perms[String(record.id)] || []).includes(ot.key)}
                  onChange={e => toggle(record.id, ot.key, e.target.checked)}
                />
              ),
            })),
          ]}
        />
      </div>
      <div>
        <Button type="primary" loading={loading} onClick={save}>保存岗位对象类型权限</Button>
      </div>
    </div>
  );
}

export default function AdminPermissionPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);

  useEffect(() => {
    userApi.lookups().then((r: any) => {
      const roleList = (r.data?.roles || []).map((role: any) => ({
        key: role.code,
        label: formatRoleLabel(role.code, role.name),
        color: roleColorMap[role.code] || 'default',
      }));
      setRoles(roleList);
    }).catch(() => {});
  }, []);

  return (
    <Card
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body">
        <Tabs
          className="page-tabs"
          items={[
            { key: 'role', label: '角色模块权限', children: <RolePermTab roles={roles} /> },
            { key: 'user', label: '人员权限', children: <UserPermTab roles={roles} /> },
            { key: 'object', label: '岗位对象类型', children: <ObjectTypePermTab /> },
          ]}
        />
      </div>
    </Card>
  );
}
