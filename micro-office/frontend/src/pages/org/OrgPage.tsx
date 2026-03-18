import { useEffect, useState } from 'react';
import { Card, Tree, Table, Button, Modal, Form, Input, InputNumber, Space, TreeSelect, message, Popconfirm } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { orgApi, positionApi } from '../../api';

function buildTree(list: any[], parentId: number | null = null): DataNode[] {
  return list.filter(i => i.parentId === parentId).map(i => ({
    key: i.id, title: i.name, children: buildTree(list, i.id),
  }));
}

function buildTreeSelect(list: any[], parentId: number | null = null, excludeId?: number): any[] {
  return list
    .filter(i => i.parentId === parentId && i.id !== excludeId)
    .map(i => ({
      value: i.id, title: i.name,
      children: buildTreeSelect(list, i.id, excludeId),
    }));
}

export default function OrgPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [orgModal, setOrgModal] = useState(false);
  const [posModal, setPosModal] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [editPos, setEditPos] = useState<any>(null);
  const [orgForm] = Form.useForm();
  const [posForm] = Form.useForm();

  const loadOrgs = async () => { const r: any = await orgApi.list(); setOrgs(r.data || []); };
  const loadPositions = async () => { const r: any = await positionApi.list(); setPositions(r.data || []); };
  useEffect(() => { loadOrgs(); loadPositions(); }, []);

  const openOrgModal = (org?: any) => {
    setEditOrg(org || null);
    orgForm.resetFields();
    if (org) {
      orgForm.setFieldsValue({ name: org.name, parentId: org.parentId, sortOrder: org.sortOrder });
    }
    setOrgModal(true);
  };

  const saveOrg = async (values: any) => {
    if (editOrg) { await orgApi.update(editOrg.id, values); } else { await orgApi.create(values); }
    message.success('保存成功'); setOrgModal(false); orgForm.resetFields(); setEditOrg(null); loadOrgs();
  };

  const savePos = async (values: any) => {
    if (editPos) { await positionApi.update(editPos.id, values); } else { await positionApi.create(values); }
    message.success('保存成功'); setPosModal(false); posForm.resetFields(); setEditPos(null); loadPositions();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      <Card title="组织架构" styles={{ body: { padding: 0 } }} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} extra={<Button type="primary" onClick={() => openOrgModal()}>新增组织</Button>}>
        <div style={{ flex: 1, minHeight: 0, padding: 24, overflow: 'auto' }}>
        <Tree treeData={buildTree(orgs)} defaultExpandAll showLine
          titleRender={(node: any) => (
            <Space>
              {node.title as string}
              <Button size="small" type="link" onClick={() => openOrgModal(orgs.find(i => i.id === node.key))}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={async () => { await orgApi.delete(node.key as number); message.success('已删除'); loadOrgs(); }}>
                <Button size="small" type="link" danger>删除</Button>
              </Popconfirm>
            </Space>
          )}
        />
        </div>
      </Card>

      <Card title="岗位管理" styles={{ body: { padding: 0 } }} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} extra={<Button type="primary" onClick={() => { setEditPos(null); posForm.resetFields(); setPosModal(true); }}>新增岗位</Button>}>
        <div style={{ flex: 1, minHeight: 0, padding: 24 }}>
        <Table dataSource={positions} rowKey="id" pagination={false} showSorterTooltip={false}
          scroll={{ y: 'calc(50vh - 64px)' }}
          columns={[
          { title: '序号', key: 'index', width: 60, sorter: (_a: any, _b: any) => 0, render: (_: any, __: any, index: number) => index + 1 },
          { title: '岗位名称', dataIndex: 'name' },
          { title: '编码', dataIndex: 'code' },
          { title: '操作', render: (_: any, r: any) => (
            <Space>
              <Button size="small" onClick={() => { setEditPos(r); posForm.setFieldsValue(r); setPosModal(true); }}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={async () => { await positionApi.delete(r.id); message.success('已删除'); loadPositions(); }}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          )},
        ]} />
        </div>
      </Card>

      <Modal title={editOrg ? '编辑组织' : '新增组织'} open={orgModal} onCancel={() => setOrgModal(false)} onOk={() => orgForm.submit()} destroyOnClose>
        <Form form={orgForm} onFinish={saveOrg} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="parentId" label="上级部门">
            <TreeSelect
              treeData={buildTreeSelect(orgs, null, editOrg?.id)}
              placeholder="无（顶级部门）"
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={editPos ? '编辑岗位' : '新增岗位'} open={posModal} onCancel={() => setPosModal(false)} onOk={() => posForm.submit()}>
        <Form form={posForm} onFinish={savePos} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="parentId" label="上级岗位ID"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
