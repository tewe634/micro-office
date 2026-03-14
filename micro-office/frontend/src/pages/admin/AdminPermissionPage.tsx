import { useEffect, useState } from 'react';
import { Card, Table, Checkbox, Button, message, Tag } from 'antd';
import { adminApi } from '../../api';

const roles = [
  { key: 'ADMIN', label: '管理员' },
  { key: 'HR', label: '人事' },
  { key: 'SALES', label: '销售' },
  { key: 'PURCHASE', label: '采购' },
  { key: 'FINANCE', label: '财务' },
  { key: 'STAFF', label: '普通员工' },
];

const menus = [
  { key: '/workbench', label: '工作台' },
  { key: '/threads', label: '工作列表' },
  { key: '/taskpool', label: '任务池' },
  { key: '/org', label: '组织架构' },
  { key: '/users', label: '人员管理' },
  { key: '/objects', label: '外部对象' },
  { key: '/products', label: '产品服务' },
  { key: '/clock', label: '打卡' },
  { key: '/admin', label: '系统管理' },
];

export default function AdminPermissionPage() {
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r: any = await adminApi.getPermissions();
    setPerms(r.data || {});
  };
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
    try {
      await adminApi.savePermissions(perms);
      message.success('权限配置已保存，用户刷新页面后生效');
    } catch { message.error('保存失败'); }
    setLoading(false);
  };

  const columns = [
    { title: '功能模块', dataIndex: 'label', width: 120, fixed: 'left' as const },
    ...roles.map(r => ({
      title: <Tag color={r.key === 'ADMIN' ? 'red' : 'blue'}>{r.label}</Tag>,
      dataIndex: r.key,
      width: 100,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Checkbox
          checked={(perms[r.key] || []).includes(record.key)}
          onChange={e => toggle(r.key, record.key, e.target.checked)}
        />
      ),
    })),
  ];

  return (
    <Card title="角色权限配置" extra={<Button type="primary" loading={loading} onClick={save}>保存配置</Button>}>
      <p style={{ color: '#888', marginBottom: 16 }}>勾选表示该角色可以看到对应的功能模块，保存后用户刷新页面即生效。</p>
      <Table
        dataSource={menus}
        columns={columns}
        rowKey="key"
        pagination={false}
        bordered
        size="middle"
      />
    </Card>
  );
}
