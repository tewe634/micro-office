import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, Modal, Form, Input, InputNumber, Space, TreeSelect, message, Popconfirm, Slider, Empty, Tag, Drawer, Descriptions } from 'antd';
import { MinusOutlined, PlusOutlined, ReloadOutlined, ZoomInOutlined } from '@ant-design/icons';
import { orgApi } from '../../api';
import { formatRoleLabel, uiText } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

type OrgItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

type OrgUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  emp_no?: string | null;
  org_id: string;
  org_name?: string | null;
  role?: string | null;
  hired_at?: string | null;
  primary_position_name?: string | null;
  extra_position_names?: string | null;
  leaderCandidate?: boolean;
};

const ROOT_NAME = '总经办';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 60;
const MAX_ZOOM = 160;
const FIXED_LEADER_NAME = '杨筱辉';
const HIDE_MEMBER_SECTION_NODE_NAMES = new Set(['总经办', '产品支持体系', '管理体系', '销售体系', '销售体系业务一部', '销售体系业务二部', '销售体系业务三部', '业务一部', '业务二部', '业务三部', '商务部']);
const FIXED_LEADER_NODE_NAMES = new Set(['产品支持体系', '销售体系']);

function shouldHideMemberSection(nodeName: string) {
  return HIDE_MEMBER_SECTION_NODE_NAMES.has(nodeName)
    || /^销售体系业务[一二三123]部$/.test(nodeName)
    || /^业务[一二三123]部$/.test(nodeName);
}

const orgChartStyles = `
.org-canvas-page {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  background:
    linear-gradient(90deg, rgba(145, 202, 255, 0.10) 1px, transparent 1px),
    linear-gradient(rgba(145, 202, 255, 0.10) 1px, transparent 1px),
    linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
  background-size: 32px 32px, 32px 32px, 100% 100%;
}

.org-canvas-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 40px 48px 96px;
  cursor: grab;
}

.org-canvas-viewport--dragging {
  cursor: grabbing;
  user-select: none;
}

.org-canvas-viewport--dragging * {
  user-select: none;
}

.org-canvas-stage {
  width: 100%;
  min-height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.org-canvas-content {
  width: max-content;
  transform-origin: top center;
  will-change: transform;
}

.org-root-wrap {
  display: flex;
  justify-content: center;
}

.org-node-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-tree-children {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 0;
  padding: 24px 0 0;
  list-style: none;
}

.org-tree-children::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 2px;
  height: 24px;
  background: #91caff;
  transform: translateX(-50%);
}

.org-tree-children > li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 12px 0;
}

.org-tree-children > li::before,
.org-tree-children > li::after {
  content: '';
  position: absolute;
  top: 0;
  width: 50%;
  height: 24px;
  border-top: 2px solid #91caff;
}

.org-tree-children > li::before {
  right: 50%;
  border-right: 2px solid #91caff;
}

.org-tree-children > li::after {
  left: 50%;
  border-left: 2px solid #91caff;
}

.org-tree-children > li:only-child {
  padding-top: 0;
}

.org-tree-children > li:only-child::before,
.org-tree-children > li:only-child::after {
  display: none;
}

.org-tree-children > li:first-child::before {
  display: none;
}

.org-tree-children > li:last-child::after {
  display: none;
}

.org-node-card {
  min-width: 300px;
  max-width: 400px;
  padding: 14px 16px 14px;
  border: 1px solid #d6e4ff;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.08);
  backdrop-filter: blur(4px);
}

.org-node-card--root {
  min-width: 320px;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 16px 28px rgba(22, 119, 255, 0.22);
}

.org-node-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.org-node-card__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  word-break: break-word;
}

.org-node-card__meta {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.org-node-card--root .org-node-card__meta {
  color: rgba(255, 255, 255, 0.82);
}

.org-node-card__section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(5, 5, 5, 0.10);
}

.org-node-card--root .org-node-card__section {
  border-top-color: rgba(255, 255, 255, 0.22);
}

.org-node-card__section-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
}

.org-node-card--root .org-node-card__section-label {
  color: rgba(255, 255, 255, 0.85);
}

.org-node-card__people {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.org-person-card {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #d6e4ff;
  background: #f7faff;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.org-person-card:hover {
  transform: translateY(-1px);
  border-color: #91caff;
  box-shadow: 0 8px 18px rgba(22, 119, 255, 0.10);
}

.org-node-card--root .org-person-card {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.22);
}

.org-person-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.org-person-card__name {
  font-size: 13px;
  font-weight: 700;
}

.org-person-card__meta {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}

.org-node-card--root .org-person-card__meta {
  color: rgba(255, 255, 255, 0.84);
}

.org-node-card__empty {
  color: rgba(0, 0, 0, 0.4);
  font-size: 12px;
}

.org-node-card--root .org-node-card__empty {
  color: rgba(255, 255, 255, 0.8);
}

.org-node-card__actions {
  margin-top: 12px;
}

.org-node-card__toggle.ant-btn {
  width: 26px;
  min-width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 999px;
}

.org-canvas-toolbar {
  position: fixed;
  right: 44px;
  bottom: 28px;
  z-index: 50;
  width: 260px;
  padding: 12px 14px;
  border: 1px solid #d6e4ff;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 30px rgba(31, 55, 88, 0.14);
  backdrop-filter: blur(8px);
}

.org-canvas-toolbar__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #1f1f1f;
  font-size: 13px;
  font-weight: 600;
}

.org-canvas-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 420px;
}
`;

function sortOrgList(list: OrgItem[]) {
  return [...list].sort((a, b) => {
    const sortDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (sortDiff !== 0) return sortDiff;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

function buildTreeSelect(list: OrgItem[], parentId: string | null = null, excludeId?: string): any[] {
  return sortOrgList(list)
    .filter(i => i.parentId === parentId && i.id !== excludeId)
    .map(i => ({
      value: i.id,
      title: i.name,
      children: buildTreeSelect(list, i.id, excludeId),
    }));
}

function PersonCard({ user, onClick }: { user: OrgUser; onClick: (user: OrgUser) => void }) {
  return (
    <button type="button" className="org-person-card" onClick={() => onClick(user)}>
      <div className="org-person-card__top">
        <span className="org-person-card__name">{user.name}</span>
        {user.leaderCandidate ? <Tag color="gold" style={{ marginRight: 0 }}>负责人</Tag> : null}
      </div>
      <div className="org-person-card__meta">
        <span>主岗位：{user.primary_position_name || '-'}</span>
        <span>手机号：{user.phone || '-'}</span>
        <span>角色：{formatRoleLabel(user.role || undefined, user.role || undefined)}</span>
      </div>
    </button>
  );
}

function OrgChartNode({
  node,
  rootId,
  childrenMap,
  usersByOrg,
  expandedKeys,
  onToggle,
  canManageOrg,
  onEdit,
  onDelete,
  onSelectUser,
  fixedLeaderUser,
}: {
  node: OrgItem;
  rootId?: string;
  childrenMap: Map<string | null, OrgItem[]>;
  usersByOrg: Map<string, OrgUser[]>;
  expandedKeys: string[];
  onToggle: (id: string) => void;
  canManageOrg: boolean;
  onEdit: (org?: OrgItem) => void;
  onDelete: (id: string) => Promise<void>;
  onSelectUser: (user: OrgUser) => void;
  fixedLeaderUser?: OrgUser | null;
}) {
  const children = childrenMap.get(node.id) || [];
  const users = [...(usersByOrg.get(node.id) || [])].sort((a, b) => {
    if (!!b.leaderCandidate !== !!a.leaderCandidate) return Number(b.leaderCandidate) - Number(a.leaderCandidate);
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  const defaultLeaderUsers = users.filter(user => user.leaderCandidate);
  const leaderUsers = FIXED_LEADER_NODE_NAMES.has(node.name) && fixedLeaderUser ? [fixedLeaderUser] : defaultLeaderUsers;
  const leaderUserIds = new Set(leaderUsers.map(user => user.id));
  const memberUsers = leaderUsers.length > 0 ? users.filter(user => !leaderUserIds.has(user.id)) : users;
  const showMemberSection = !shouldHideMemberSection(node.name);
  const expanded = expandedKeys.includes(node.id);
  const isRoot = node.id === rootId;

  return (
    <div className="org-node-wrap">
      <div className={`org-node-card${isRoot ? ' org-node-card--root' : ''}`}>
        <div className="org-node-card__header">
          <div className="org-node-card__title">{node.name}</div>
          {children.length > 0 ? (
            <Button
              type={isRoot ? 'default' : 'text'}
              size="small"
              className="org-node-card__toggle"
              icon={expanded ? <MinusOutlined /> : <PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
            />
          ) : null}
        </div>

        <div className="org-node-card__meta">
          {children.length} 个下级组织 · {users.length} 人
        </div>

        <div className="org-node-card__section">
          <div className="org-node-card__section-label">负责人</div>
          {leaderUsers.length > 0 ? (
            <div className="org-node-card__people">
              {leaderUsers.map(user => <PersonCard key={`leader-${user.id}`} user={user} onClick={onSelectUser} />)}
            </div>
          ) : (
            <div className="org-node-card__empty">暂无负责人标识</div>
          )}
        </div>

        {showMemberSection ? (
          <div className="org-node-card__section">
            <div className="org-node-card__section-label">节点下人员</div>
            {memberUsers.length > 0 ? (
              <div className="org-node-card__people">
                {memberUsers.map(user => <PersonCard key={user.id} user={user} onClick={onSelectUser} />)}
              </div>
            ) : (
              <div className="org-node-card__empty">当前节点暂无其他人员</div>
            )}
          </div>
        ) : null}

        {canManageOrg ? (
          <div className="org-node-card__actions">
            <Space size={4} wrap>
              <Button size="small" type={isRoot ? 'default' : 'link'} onClick={() => onEdit(node)}>编辑</Button>
              <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={() => onDelete(node.id)}>
                <Button size="small" type={isRoot ? 'default' : 'link'} danger>删除</Button>
              </Popconfirm>
            </Space>
          </div>
        ) : null}
      </div>

      {children.length > 0 && expanded ? (
        <ul className="org-tree-children">
          {children.map(child => (
            <li key={child.id}>
              <OrgChartNode
                node={child}
                rootId={rootId}
                childrenMap={childrenMap}
                usersByOrg={usersByOrg}
                expandedKeys={expandedKeys}
                onToggle={onToggle}
                canManageOrg={canManageOrg}
                onEdit={onEdit}
                onDelete={onDelete}
                onSelectUser={onSelectUser}
                fixedLeaderUser={fixedLeaderUser}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function OrgPage() {
  const role = useAuthStore(s => s.role);
  const canManageOrg = role === 'ADMIN' || role === 'HR';
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [orgModal, setOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgItem | null>(null);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [orgForm] = Form.useForm();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, OrgItem[]>();
    const sorted = sortOrgList(orgs);
    sorted.forEach(item => {
      const key = item.parentId ?? null;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [orgs]);

  const usersByOrg = useMemo(() => {
    const map = new Map<string, OrgUser[]>();
    orgUsers.forEach(user => {
      const key = String(user.org_id);
      map.set(key, [...(map.get(key) || []), user]);
    });
    return map;
  }, [orgUsers]);

  const rootOrg = useMemo(() => {
    return orgs.find(item => item.name === ROOT_NAME) || orgs.find(item => !item.parentId) || null;
  }, [orgs]);

  const fixedLeaderUser = useMemo(() => {
    return orgUsers.find(user => user.name === FIXED_LEADER_NAME) || null;
  }, [orgUsers]);

  const loadChart = async () => {
    const r: any = await orgApi.chart();
    setOrgs(r.data?.orgs || []);
    setOrgUsers(r.data?.users || []);
  };

  useEffect(() => {
    loadChart();
  }, []);

  useEffect(() => {
    if (!rootOrg) return;
    setExpandedKeys(prev => {
      const validKeys = prev.filter(key => orgs.some(item => item.id === key));
      return validKeys.length > 0 ? Array.from(new Set([rootOrg.id, ...validKeys])) : [rootOrg.id];
    });
  }, [rootOrg, orgs]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - dragStateRef.current.startX;
      const deltaY = event.clientY - dragStateRef.current.startY;
      setPan({
        x: dragStateRef.current.panX + deltaX,
        y: dragStateRef.current.panY + deltaY,
      });
    };

    const stopDragging = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseleave', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('mouseleave', stopDragging);
    };
  }, [isDragging]);

  const handleViewportMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.org-canvas-toolbar, .ant-btn, .ant-slider, .ant-input, .ant-input-number, .ant-select, .ant-tree-select, .org-person-card')) {
      return;
    }
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
    event.preventDefault();
  };

  const openOrgModal = (org?: OrgItem) => {
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
    loadChart();
  };

  const deleteOrg = async (id: string) => {
    await orgApi.delete(id);
    message.success('已删除');
    loadChart();
  };

  const toggleExpanded = (id: string) => {
    setExpandedKeys(prev => prev.includes(id) ? prev.filter(key => key !== id) : [...prev, id]);
  };

  return (
    <div className="page-fill">
      <style>{orgChartStyles}</style>
      <Card
        title="公司整体组织架构"
        className="page-card page-fill"
        styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
        extra={canManageOrg ? <Button type="primary" onClick={() => openOrgModal()}>新增组织</Button> : null}
      >
        <div className="page-card-body page-card-body--flush">
          <div className="org-canvas-page">
            <div
              className={`org-canvas-viewport${isDragging ? ' org-canvas-viewport--dragging' : ''}`}
              ref={viewportRef}
              onMouseDown={handleViewportMouseDown}
            >
              <div className="org-canvas-stage">
                <div
                  className="org-canvas-content"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                    transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                  }}
                >
                  {rootOrg ? (
                    <div className="org-root-wrap">
                      <OrgChartNode
                        node={rootOrg}
                        rootId={rootOrg.id}
                        childrenMap={childrenMap}
                        usersByOrg={usersByOrg}
                        expandedKeys={expandedKeys}
                        onToggle={toggleExpanded}
                        canManageOrg={canManageOrg}
                        onEdit={openOrgModal}
                        onDelete={deleteOrg}
                        onSelectUser={setSelectedUser}
                        fixedLeaderUser={fixedLeaderUser}
                      />
                    </div>
                  ) : (
                    <div className="org-canvas-empty">
                      <Empty description="暂无组织架构数据" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="org-canvas-toolbar">
              <div className="org-canvas-toolbar__top">
                <Space size={6}>
                  <ZoomInOutlined />
                  <span>缩放比例</span>
                </Space>
                <span>{zoom}%</span>
              </div>
              <Space.Compact block>
                <Button icon={<MinusOutlined />} onClick={() => setZoom(value => Math.max(MIN_ZOOM, value - 10))} />
                <Slider
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={10}
                  value={zoom}
                  onChange={(value) => setZoom(Array.isArray(value) ? value[0] : value)}
                  style={{ flex: 1, marginInline: 12 }}
                />
                <Button icon={<PlusOutlined />} onClick={() => setZoom(value => Math.min(MAX_ZOOM, value + 10))} />
              </Space.Compact>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => { setZoom(DEFAULT_ZOOM); setPan({ x: 0, y: 0 }); }}>恢复 100%</Button>
                <Button size="small" onClick={() => { if (rootOrg) setExpandedKeys([rootOrg.id]); setPan({ x: 0, y: 0 }); }}>回到默认展开</Button>
              </div>
            </div>
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

      <Drawer title={selectedUser ? `${selectedUser.name} · 人员详情` : '人员详情'} width={420} open={!!selectedUser} onClose={() => setSelectedUser(null)}>
        {selectedUser ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="姓名">{selectedUser.name}</Descriptions.Item>
            <Descriptions.Item label="工号">{selectedUser.emp_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{selectedUser.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedUser.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">{formatRoleLabel(selectedUser.role || undefined, selectedUser.role || undefined)}</Descriptions.Item>
            <Descriptions.Item label="所属组织">{selectedUser.org_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="主岗位">{selectedUser.primary_position_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="入职日期">{selectedUser.hired_at || '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
