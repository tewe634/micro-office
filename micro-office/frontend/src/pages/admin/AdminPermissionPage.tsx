import { useEffect, useState } from 'react';
import { Card, Table, Checkbox, Button, message, Tag, Tabs, Select, Space, Divider } from 'antd';
import { adminApi, userApi, orgApi, positionApi } from '../../api';

const roles = [
  { key: 'ADMIN', label: '管理员', color: 'red' },
  { key: 'HR', label: '人事', color: 'purple' },
  { key: 'SALES', label: '销售', color: 'cyan' },
  { key: 'PURCHASE', label: '采购', color: 'geekblue' },
  { key: 'FINANCE', label: '财务', color: 'gold' },
  { key: 'STAFF', label: '普通员工', color: 'default' },
];

const menus = [
  { key: '/org', label: '组织架构' },
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

// ========== Tab 1: 角色权限 ==========
function RolePermTab() {
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => { const r: any = await adminApi.getPermissions(); setPerms(r.data || {}); };
  useEffect(() => { load(); }, []);

  const toggle = (role: string, menuKey: string, checked: boolean) => {
    setPerms(prev => {
      const list = [...(prev[role] || [])];
      if (checked && !list.includes(menuKey)) list.push(menuKey);
      if (!checked) { const i = list.indexOf(menuKey); if (i >= 0) list.splice(i, 1); }
      return { ...prev, [role]: list };
    });
  };

  const save = async () => {
    setLoading(true);
    await adminApi.savePermissions(perms);
    message.success('角色权限已保存'); setLoading(false);
  };

  return (
    <>
      <p style={{ color: '#888', marginBottom: 16 }}>配置每个角色默认可见的功能模块。用户如果没有个人权限配置，则使用角色默认权限。</p>
      <Table dataSource={menus} rowKey="key" pagination={false} bordered size="middle"
        columns={[
          { title: '功能模块', dataIndex: 'label', width: 120 },
          ...roles.map(r => ({
            title: <Tag color={r.color}>{r.label}</Tag>, width: 100, align: 'center' as const,
            render: (_: any, record: any) => (
              <Checkbox checked={(perms[r.key] || []).includes(record.key)}
                onChange={e => toggle(r.key, record.key, e.target.checked)} />
            ),
          })),
        ]}
      />
      <Button type="primary" loading={loading} onClick={save} style={{ marginTop: 16 }}>保存角色权限</Button>
    </>
  );
}

// ========== Tab 2: 人员权限（模块 + 对象类型） ==========
function UserPermTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [filterOrg, setFilterOrg] = useState<number>();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  // 模块权限
  const [userMenus, setUserMenus] = useState<string[]>([]);
  const [hasCustomMenus, setHasCustomMenus] = useState(false);
  // 对象类型权限
  const [userObjTypes, setUserObjTypes] = useState<string[]>([]);
  const [hasCustomObjTypes, setHasCustomObjTypes] = useState(false);

  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    orgApi.list().then((r: any) => setOrgs(r.data || []));
    adminApi.getPermissions().then((r: any) => setRolePerms(r.data || {}));
  }, []);

  useEffect(() => { userApi.list(filterOrg).then((r: any) => setUsers(r.data || [])); }, [filterOrg]);

  const selectUser = async (u: any) => {
    setSelectedUser(u);
    // 加载模块权限
    const menuRes: any = await adminApi.getUserMenus(u.id);
    const customMenus = (menuRes.data || []) as string[];
    if (customMenus.length > 0) {
      setUserMenus(customMenus); setHasCustomMenus(true);
    } else {
      setUserMenus(rolePerms[u.role] || []); setHasCustomMenus(false);
    }
    // 加载对象类型权限
    const objRes: any = await adminApi.getUserObjectTypes(u.id);
    const customObj = (objRes.data || []) as string[];
    if (customObj.length > 0) {
      setUserObjTypes(customObj); setHasCustomObjTypes(true);
    } else {
      setUserObjTypes([]); setHasCustomObjTypes(false);
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
    message.success(`${selectedUser.name} 的模块权限已保存`); setLoading(false);
  };

  const resetMenus = async () => {
    if (!selectedUser) return;
    await adminApi.resetUserMenus(selectedUser.id);
    setUserMenus(rolePerms[selectedUser.role] || []); setHasCustomMenus(false);
    message.success('已恢复角色默认模块权限');
  };

  const saveObjTypes = async () => {
    if (!selectedUser) return;
    setLoading(true);
    await adminApi.saveUserObjectTypes(selectedUser.id, userObjTypes);
    message.success(`${selectedUser.name} 的对象类型权限已保存`); setLoading(false);
  };

  const resetObjTypes = async () => {
    if (!selectedUser) return;
    await adminApi.resetUserObjectTypes(selectedUser.id);
    setUserObjTypes([]); setHasCustomObjTypes(false);
    message.success('已恢复岗位默认对象类型权限');
  };

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div style={{ width: 320 }}>
        <Select allowClear placeholder="按组织筛选" style={{ width: '100%', marginBottom: 12 }}
          options={orgs.map(o => ({ value: o.id, label: o.name }))} onChange={v => setFilterOrg(v)} />
        <Table dataSource={users} rowKey="id" size="small" pagination={{ pageSize: 10 }}
          onRow={r => ({ onClick: () => selectUser(r), style: { cursor: 'pointer', background: selectedUser?.id === r.id ? '#e6f4ff' : undefined } })}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 80 },
            { title: '角色', dataIndex: 'role', width: 80, render: (v: string) => {
              const r = roles.find(x => x.key === v);
              return <Tag color={r?.color}>{r?.label || v}</Tag>;
            }},
          ]}
        />
      </div>
      <div style={{ flex: 1 }}>
        {selectedUser ? (
          <>
            <h4 style={{ marginBottom: 16 }}>{selectedUser.name} 的权限配置</h4>

            {/* 模块权限 */}
            <div style={{ marginBottom: 8 }}>
              <b>功能模块</b> {hasCustomMenus ? <Tag color="orange">个人定制</Tag> : <Tag>角色默认</Tag>}
            </div>
            <Table dataSource={menus} rowKey="key" pagination={false} bordered size="small"
              columns={[
                { title: '功能模块', dataIndex: 'label', width: 150 },
                { title: '可见', width: 80, align: 'center', render: (_: any, record: any) => (
                  <Checkbox checked={userMenus.includes(record.key)} onChange={e => toggleMenu(record.key, e.target.checked)} />
                )},
              ]}
            />
            <Space style={{ marginTop: 8, marginBottom: 24 }}>
              <Button type="primary" size="small" loading={loading} onClick={saveMenus}>保存模块权限</Button>
              {hasCustomMenus && <Button size="small" onClick={resetMenus}>恢复角色默认</Button>}
            </Space>

            <Divider />

            {/* 对象类型权限 */}
            <div style={{ marginBottom: 8 }}>
              <b>外部对象类型</b> {hasCustomObjTypes ? <Tag color="orange">个人定制</Tag> : <Tag>岗位默认</Tag>}
            </div>
            <Table dataSource={objectTypes} rowKey="key" pagination={false} bordered size="small"
              columns={[
                { title: '对象类型', dataIndex: 'label', width: 150 },
                { title: '可见', width: 80, align: 'center', render: (_: any, record: any) => (
                  <Checkbox checked={userObjTypes.includes(record.key)} onChange={e => toggleObjType(record.key, e.target.checked)} />
                )},
              ]}
            />
            <Space style={{ marginTop: 8 }}>
              <Button type="primary" size="small" loading={loading} onClick={saveObjTypes}>保存对象类型权限</Button>
              {hasCustomObjTypes && <Button size="small" onClick={resetObjTypes}>恢复岗位默认</Button>}
            </Space>
          </>
        ) : <p style={{ color: '#888', marginTop: 40 }}>← 点击左侧人员查看/编辑其权限（模块 + 对象类型）</p>}
      </div>
    </div>
  );
}

// ========== Tab 3: 岗位对象类型权限 ==========
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
      if (!checked) { const i = list.indexOf(type); if (i >= 0) list.splice(i, 1); }
      return { ...prev, [key]: list };
    });
  };

  const save = async () => {
    setLoading(true);
    await adminApi.savePositionObjectTypes(perms);
    message.success('岗位对象类型权限已保存'); setLoading(false);
  };

  return (
    <>
      <p style={{ color: '#888', marginBottom: 16 }}>配置每个岗位默认可见的外部对象类型。用户如果没有个人对象类型配置，则根据岗位汇总。</p>
      <Table dataSource={positions} rowKey="id" pagination={false} bordered size="middle"
        columns={[
          { title: '岗位', width: 140, render: (_: any, r: any) => `${r.name} (${r.code})` },
          ...objectTypes.map(ot => ({
            title: ot.label, width: 90, align: 'center' as const,
            render: (_: any, record: any) => (
              <Checkbox checked={(perms[String(record.id)] || []).includes(ot.key)}
                onChange={e => toggle(record.id, ot.key, e.target.checked)} />
            ),
          })),
        ]}
      />
      <Button type="primary" loading={loading} onClick={save} style={{ marginTop: 16 }}>保存岗位对象类型权限</Button>
    </>
  );
}

// ========== 主页面 ==========
export default function AdminPermissionPage() {
  return (
    <Card title="权限配置">
      <Tabs items={[
        { key: 'role', label: '角色模块权限', children: <RolePermTab /> },
        { key: 'user', label: '人员权限', children: <UserPermTab /> },
        { key: 'object', label: '岗位对象类型', children: <ObjectTypePermTab /> },
      ]} />
    </Card>
  );
}
