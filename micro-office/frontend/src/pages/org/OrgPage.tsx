import { useEffect, useState } from 'react';
import { Card, Tree, Button, Modal, Form, Input, InputNumber, Space, TreeSelect, message, Popconfirm } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { orgApi } from '../../api';
import { uiText } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

function buildTree(list: any[], parentId: string | null = null): DataNode[] {
  return list.filter(i => i.parentId === parentId).map(i => ({
    key: i.id,
    title: i.name,
    children: buildTree(list, i.id),
  }));
}

function buildTreeSelect(list: any[], parentId: string | null = null, excludeId?: string): any[] {
  return list
    .filter(i => i.parentId === parentId && i.id !== excludeId)
    .map(i => ({
      value: i.id,
      title: i.name,
      children: buildTreeSelect(list, i.id, excludeId),
    }));
}

export default function OrgPage() {
  const role = useAuthStore(s => s.role);
  const canManageOrg = role === 'ADMIN' || role === 'HR';
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgModal, setOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [orgForm] = Form.useForm();

  const loadOrgs = async () => {
    const r: any = await orgApi.list();
    setOrgs(r.data || []);
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const openOrgModal = (org?: any) => {
    if (!canManageOrg) return;
    setEditOrg(org || null);
    orgForm.resetFields();
    if (org) {
      orgForm.setFieldsValue({ name: org.name, parentId: org.parentId, sortOrder: org.sortOrder });
    }
    setOrgModal(true);
  };

  const saveOrg = async (values: any) => {
    if (editOrg) await orgApi.update(editOrg.id, values);
    else await orgApi.create(values);
    message.success('保存成功');
    setOrgModal(false);
    orgForm.resetFields();
    setEditOrg(null);
    loadOrgs();
  };

  return (
    <div className="page-fill">
      <Card
        title="公司整体组织架构"
        className="page-card page-fill"
        styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
        extra={canManageOrg ? <Button type="primary" onClick={() => openOrgModal()}>新增组织</Button> : null}
      >
        <div className="page-card-body">
          <div className="page-card-scroll">
            <Tree
              treeData={buildTree(orgs)}
              defaultExpandedKeys={['90f8e26c-cf34-4e9b-a4c8-ea18353879bb']}
              showLine
              titleRender={(node: any) => (
                <Space>
                  {node.title as string}
                  {canManageOrg ? (
                    <>
                      <Button size="small" type="link" onClick={() => openOrgModal(orgs.find(i => i.id === node.key))}>编辑</Button>
                      <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await orgApi.delete(node.key as any); message.success('已删除'); loadOrgs(); }}>
                        <Button size="small" type="link" danger>删除</Button>
                      </Popconfirm>
                    </>
                  ) : null}
                </Space>
              )}
            />
          </div>
        </div>
      </Card>

      <Modal okText="确定" cancelText="取消" title={editOrg ? '编辑组织' : '新增组织'} open={orgModal} onCancel={() => setOrgModal(false)} onOk={() => orgForm.submit()} destroyOnClose>
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
    </div>
  );
}
