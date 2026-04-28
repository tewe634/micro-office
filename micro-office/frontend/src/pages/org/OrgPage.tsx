import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, Modal, Form, Input, InputNumber, Space, TreeSelect, message, Popconfirm, Slider, Empty, Tag, Drawer, Descriptions, Tabs } from 'antd';
import { MinusOutlined, PlusOutlined, ReloadOutlined, ZoomInOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { orgApi } from '../../api';
import { formatRoleLabel, uiText } from '../../constants/ui';
import { buildAllowedMenus, canAccessMenu } from '../../constants/routes';
import { useAuthStore } from '../../store/auth';
import PositionTab from '../user/PositionTab';
import UserTab from '../user/UserTab';

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
  org_id: string | null;
  org_name?: string | null;
  role?: string | null;
  hired_at?: string | null;
  primary_position_name?: string | null;
  extra_position_names?: string | null;
  leaderCandidate?: boolean;
};

type OrgPageTabKey = 'org' | 'users' | 'positions';

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 60;
const MAX_ZOOM = 160;
const FIXED_DISPLAY_LEADER_NAMES_BY_ORG_NAME: Record<string, string[]> = {
  总经办: ['杨筱辉'],
  产品支持体系: ['杨筱辉'],
  销售体系: ['杨筱辉'],
  商务部: ['吴敏'],
  业务一部: ['严春南'],
  业务二部: ['张巨根'],
  业务三部: ['吕跃水'],
};
const SPECIAL_DISPLAY_USER_NAMES_BY_ORG_NAME: Record<string, string[]> = {
  产品支持体系: ['杨筱辉'],
  销售体系: ['杨筱辉'],
  管理体系: ['王舟珍'],
  财务部: ['王舟珍'],
  商务部: ['吴敏'],
  业务一部: ['严春南'],
  业务二部: ['张巨根'],
  业务三部: ['吕跃水'],
  业务数字化: ['杨筱辉'],
  生产成套部: ['方俊锋'],
};
const HIDE_MEMBER_SECTION_ORG_NAMES = new Set(['商务部', '业务一部', '业务二部', '业务三部']);

function shouldHideMemberSection(depth: number, nodeName: string) {
  return depth <= 2 || HIDE_MEMBER_SECTION_ORG_NAMES.has(nodeName);
}

function dedupeUsers(list: OrgUser[]) {
  const seen = new Set<string>();
  return list.filter(user => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
}

function sortUsers(list: OrgUser[]) {
  return [...list].sort((a, b) => {
    if (!!b.leaderCandidate !== !!a.leaderCandidate) {
      return Number(b.leaderCandidate) - Number(a.leaderCandidate);
    }
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

function collectSubtreeOrgIds(
  orgId: string,
  childrenMap: Map<string | null, OrgItem[]>,
  cache: Map<string, string[]>,
): string[] {
  const cached = cache.get(orgId);
  if (cached) {
    return cached;
  }

  const ids = [orgId];
  (childrenMap.get(orgId) || []).forEach(child => {
    ids.push(...collectSubtreeOrgIds(child.id, childrenMap, cache));
  });
  cache.set(orgId, ids);
  return ids;
}

function buildDisplayUsersByOrg(
  orgs: OrgItem[],
  orgUsers: OrgUser[],
  rootId: string | undefined,
  childrenMap: Map<string | null, OrgItem[]>,
) {
  const directUsersByOrg = new Map<string, OrgUser[]>();
  const userByName = new Map<string, OrgUser>();
  const subtreeCache = new Map<string, string[]>();

  orgUsers.forEach(user => {
    if (user.org_id) {
      directUsersByOrg.set(user.org_id, [...(directUsersByOrg.get(user.org_id) || []), user]);
    }
    if (!userByName.has(user.name)) {
      userByName.set(user.name, user);
    }
  });

  const usersByOrg = new Map<string, OrgUser[]>();
  const specialLeaderUserIdsByOrg = new Map<string, Set<string>>();

  orgs.forEach(org => {
    const specialUsers = (SPECIAL_DISPLAY_USER_NAMES_BY_ORG_NAME[org.name] || [])
      .map(userName => userByName.get(userName))
      .filter((user): user is OrgUser => !!user);
    const specialLeaderIds = new Set(specialUsers.map(user => user.id));
    const baseUsers = org.id === rootId
      ? orgUsers.filter(user => user.role === 'ADMIN')
      : collectSubtreeOrgIds(org.id, childrenMap, subtreeCache).flatMap(orgNodeId => directUsersByOrg.get(orgNodeId) || []);
    usersByOrg.set(org.id, sortUsers(dedupeUsers([...baseUsers, ...specialUsers])));
    specialLeaderUserIdsByOrg.set(org.id, specialLeaderIds);
  });

  return { usersByOrg, directUsersByOrg, specialLeaderUserIdsByOrg };
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

function PersonCard({ user, onClick, showLeaderTag }: { user: OrgUser; onClick: (user: OrgUser) => void; showLeaderTag?: boolean }) {
  return (
    <button type="button" className="org-person-card" onClick={() => onClick(user)}>
      <div className="org-person-card__top">
        <span className="org-person-card__name">{user.name}</span>
        {showLeaderTag || user.leaderCandidate ? <Tag color="gold" style={{ marginRight: 0 }}>负责人</Tag> : null}
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
  depth,
  childrenMap,
  usersByOrg,
  directUsersByOrg,
  specialLeaderUserIdsByOrg,
  expandedKeys,
  onToggle,
  canManageOrg,
  onEdit,
  onDelete,
  onSelectUser,
  canAccessUserDirectory,
  onOpenUsers,
}: {
  node: OrgItem;
  rootId?: string;
  depth: number;
  childrenMap: Map<string | null, OrgItem[]>;
  usersByOrg: Map<string, OrgUser[]>;
  directUsersByOrg: Map<string, OrgUser[]>;
  specialLeaderUserIdsByOrg: Map<string, Set<string>>;
  expandedKeys: string[];
  onToggle: (id: string) => void;
  canManageOrg: boolean;
  onEdit: (org?: OrgItem) => void;
  onDelete: (id: string) => Promise<void>;
  onSelectUser: (user: OrgUser) => void;
  canAccessUserDirectory: boolean;
  onOpenUsers: (orgId: string) => void;
}) {
  const children = childrenMap.get(node.id) || [];
  const users = usersByOrg.get(node.id) || [];
  const directUsers = directUsersByOrg.get(node.id) || [];
  const specialLeaderUserIds = specialLeaderUserIdsByOrg.get(node.id) || new Set<string>();
  const expanded = expandedKeys.includes(node.id);
  const isRoot = node.id === rootId;
  const showMemberSection = !shouldHideMemberSection(depth, node.name);
  const fixedLeaderNames = FIXED_DISPLAY_LEADER_NAMES_BY_ORG_NAME[node.name] || [];
  const leaderSourceUsers = fixedLeaderNames.length > 0
    ? users.filter(user => fixedLeaderNames.includes(user.name))
    : showMemberSection
      ? users
      : sortUsers(dedupeUsers([
          ...directUsers,
          ...users.filter(user => specialLeaderUserIds.has(user.id)),
        ]));
  const leaderUsers = dedupeUsers(leaderSourceUsers.filter(user => user.leaderCandidate || specialLeaderUserIds.has(user.id)));
  const leaderUserIds = new Set(leaderUsers.map(user => user.id));
  const memberUsers = leaderUsers.length > 0 ? users.filter(user => !leaderUserIds.has(user.id)) : users;

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
              {leaderUsers.map(user => <PersonCard key={`leader-${user.id}`} user={user} onClick={onSelectUser} showLeaderTag />)}
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

        {canManageOrg || canAccessUserDirectory ? (
          <div className="org-node-card__actions">
            <Space size={4} wrap>
              {canAccessUserDirectory ? (
                <Button size="small" type={isRoot ? 'default' : 'link'} onClick={() => onOpenUsers(node.id)}>查看人员</Button>
              ) : null}
              {canManageOrg ? (
                <Button size="small" type={isRoot ? 'default' : 'link'} onClick={() => onEdit(node)}>编辑</Button>
              ) : null}
              {canManageOrg ? (
                <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={() => onDelete(node.id)}>
                  <Button size="small" type={isRoot ? 'default' : 'link'} danger>删除</Button>
                </Popconfirm>
              ) : null}
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
                depth={depth + 1}
                childrenMap={childrenMap}
                usersByOrg={usersByOrg}
                directUsersByOrg={directUsersByOrg}
                specialLeaderUserIdsByOrg={specialLeaderUserIdsByOrg}
                expandedKeys={expandedKeys}
                onToggle={onToggle}
                canManageOrg={canManageOrg}
                onEdit={onEdit}
                onDelete={onDelete}
                onSelectUser={onSelectUser}
                canAccessUserDirectory={canAccessUserDirectory}
                onOpenUsers={onOpenUsers}
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
  const menus = useAuthStore(s => s.menus);
  const canManageOrg = role === 'ADMIN' || role === 'HR';
  const allowedMenus = useMemo(() => buildAllowedMenus(menus), [menus]);
  const canAccessUserDirectory = canAccessMenu('/users', allowedMenus);
  const [searchParams, setSearchParams] = useSearchParams();
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

  const rootOrg = useMemo(() => {
    return orgs.find(item => !item.parentId) || null;
  }, [orgs]);

  const { usersByOrg, directUsersByOrg, specialLeaderUserIdsByOrg } = useMemo(() => {
    return buildDisplayUsersByOrg(orgs, orgUsers, rootOrg?.id, childrenMap);
  }, [childrenMap, orgUsers, orgs, rootOrg?.id]);

  const rawTab = searchParams.get('tab');
  const activeTab: OrgPageTabKey = useMemo(() => {
    if (!canAccessUserDirectory) {
      return 'org';
    }
    if (rawTab === 'users' || rawTab === 'positions') {
      return rawTab;
    }
    return 'org';
  }, [canAccessUserDirectory, rawTab]);
  const selectedOrgId = searchParams.get('orgId') || undefined;

  const loadChart = async () => {
    const r: any = await orgApi.chart();
    setOrgs(r.data?.orgs || []);
    setOrgUsers(r.data?.users || []);
  };

  useEffect(() => {
    loadChart();
  }, []);

  useEffect(() => {
    if (!canAccessUserDirectory) {
      const requestedTab = searchParams.get('tab');
      if (requestedTab === 'users' || requestedTab === 'positions') {
        const next = new URLSearchParams(searchParams);
        next.delete('tab');
        next.delete('orgId');
        setSearchParams(next, { replace: true });
      }
    }
  }, [canAccessUserDirectory, searchParams, setSearchParams]);

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

  const updateOrgPageSearch = (updates: { tab?: OrgPageTabKey | null; orgId?: string | null }) => {
    const next = new URLSearchParams(searchParams);

    if (Object.prototype.hasOwnProperty.call(updates, 'tab')) {
      if (updates.tab && updates.tab !== 'org') {
        next.set('tab', updates.tab);
      } else {
        next.delete('tab');
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'orgId')) {
      if (updates.orgId) {
        next.set('orgId', updates.orgId);
      } else {
        next.delete('orgId');
      }
    }

    setSearchParams(next, { replace: true });
  };

  const handleTabChange = (nextTab: string) => {
    updateOrgPageSearch({ tab: nextTab as OrgPageTabKey });
    if (nextTab !== 'org') {
      setSelectedUser(null);
    }
  };

  const handleOpenUsers = (orgId: string) => {
    if (!canAccessUserDirectory) return;
    updateOrgPageSearch({ tab: 'users', orgId });
    setSelectedUser(null);
  };

  const handleUserOrgChange = (orgId?: string) => {
    updateOrgPageSearch({ orgId: orgId || null });
  };

  return (
    <div className="page-fill">
      <style>{orgChartStyles}</style>
      <Card
        className="page-card page-fill"
        styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
      >
        <div className="page-card-body">
          <Tabs
            activeKey={activeTab}
            className="page-tabs"
            onChange={handleTabChange}
            items={[
              {
                key: 'org',
                label: '组织',
                children: (
                  <div className="page-fill">
                    <div className="page-toolbar" style={{ padding: '0 20px' }}>
                      <div />
                      <div className="page-toolbar-right">
                        {canManageOrg ? <Button type="primary" onClick={() => openOrgModal()}>新增组织</Button> : null}
                      </div>
                    </div>
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
                                  depth={1}
                                  childrenMap={childrenMap}
                                  usersByOrg={usersByOrg}
                                  directUsersByOrg={directUsersByOrg}
                                  specialLeaderUserIdsByOrg={specialLeaderUserIdsByOrg}
                                  expandedKeys={expandedKeys}
                                  onToggle={toggleExpanded}
                                  canManageOrg={canManageOrg}
                                  onEdit={openOrgModal}
                                  onDelete={deleteOrg}
                                  onSelectUser={setSelectedUser}
                                  canAccessUserDirectory={canAccessUserDirectory}
                                  onOpenUsers={handleOpenUsers}
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
                ),
              },
              ...(canAccessUserDirectory ? [
                {
                  key: 'users',
                  label: '人员',
                  children: (
                    <div className="page-fill">
                      <UserTab orgId={selectedOrgId} onOrgIdChange={handleUserOrgChange} />
                    </div>
                  ),
                },
                {
                  key: 'positions',
                  label: '岗位',
                  children: (
                    <div className="page-fill">
                      <PositionTab />
                    </div>
                  ),
                },
              ] : []),
            ]}
          />
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
