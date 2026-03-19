import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, Modal, Form, Input, InputNumber, Space, TreeSelect, message, Popconfirm, Slider, Empty, Tag } from 'antd';
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
  phone?: string | null;
  role?: string | null;
  org_id: string;
  primary_position_name?: string | null;
  leaderCandidate?: boolean;
};

const ROOT_NAME = '总经办';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 60;
const MAX_ZOOM = 160;
const MAX_VISIBLE_USERS = 6;

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
  min-width: 260px;
  max-width: 340px;
  padding: 14px 16px 14px;
  border: 1px solid #d6e4ff;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 24px rgba(22, 119, 255, 0.08);
  backdrop-filter: blur(4px);
}

.org-node-card--root {
  min-width: 280px;
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
  flex-wrap: wrap;
  gap: 8px;
}

.org-person-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f5f8ff;
  border: 1px solid #d6e4ff;
  font-size: 12px;
  color: #1f1f1f;
}

.org-node-card--root .org-person-chip {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.22);
}

.org-person-chip__name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.org-person-chip__sub {
  color: rgba(0, 0, 0, 0.45);
}

.org-node-card--root .org-person-chip__sub {
  color: rgba(255, 255, 255, 0.82);
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

function PersonChip({ user, root }: { user: OrgUser; root?: boolean }) {
  return (
    <div className="org-person-chip" title={`${user.name}${user.primary_position_name ? ` / ${user.primary_position_name}` : ''}${user.phone ? ` / ${user.phone}` : ''}`}>
      <span className="org-person-chip__name">{user.name}</span>
      {user.primary_position_name ? <span className="org-person-chip__sub">{user.primary_position_name}</span> : null}
      {!user.primary_position_name && user.role ? <span className="org-person-chip__sub">{formatRoleLabel(user.role, user.role)}</span> : null}
      {root ? <Tag color="gold" style={{ marginInlineStart: 2, marginRight: 0 }}>负责人</Tag> : null}
    </div>
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
}) {
  const children = childrenMap.get(node.id) || [];
  const users = usersByOrg.get(node.id) || [];
  const leaderUsers = users.filter(user => user.leaderCandidate);
  const displayLeaders = leaderUsers.length > 0 ? leaderUsers : (users.length === 1 ? users : []);
  const expanded = expandedKeys.includes(node.id);
  const isRoot = node.id === rootId;
  const visibleUsers = users.slice(0, MAX_VISIBLE_USERS);
  const hiddenUserCount = Math.max(users.length - MAX_VISIBLE_USERS, 0);

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
          {displayLeaders.length > 0 ? (
            <div className="org-node-card__people">
              {displayLeaders.map(user => <PersonChip key={user.id} user={user} root />)}
            </div>
          ) : (
            <div className="org-node-card__empty">暂无负责人标识</div>
          )}
        </div>

        <div className="org-node-card__section">
          <div className="org-node-card__section-label">节点下人员</div>
          {users.length > 0 ? (
            <div className="org-node-card__people">
              {visibleUsers.map(user => <PersonChip key={user.id} user={user} />)}
              {hiddenUserCount > 0 ? <div className="org-person-chip">+{hiddenUserCount} 人</div> : null}
            </div>
          ) : (
            <div className="org-node-card__empty">当前节点暂无人员</div>
          )}
        </div>

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
    if (target.closest('.org-canvas-toolbar, .ant-btn, .ant-slider, .ant-input, .ant-input-number, .ant-select, .ant-tree-select')) {
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
    </div>
  );
}
