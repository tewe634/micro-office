import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  TreeSelect,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { orgApi, positionApi, salesCollabApi, userApi } from '../../api';

type SourceTypeOption = { value: string; label: string };
type ScopeTypeOption = { value: string; label: string };
type ParticipantRoleOption = { value: string; label: string };

type SceneMeta = {
  id: string;
  sceneKey: string;
  sceneName: string;
  domainKey: string;
  sortOrder: number;
};

type RuleItem = {
  id?: string;
  participantRole?: string;
  sourceType: string;
  sourceRefId?: string;
  sourceRefName?: string;
  resolveScopeType?: string;
  resolveScopeRefId?: string;
  dutyLabel?: string;
  sortOrder: number;
  enabled: boolean;
  remark?: string;
  _localKey?: string;
};

type GroupMeta = {
  id: string;
  groupKey: string;
  groupName: string;
  domainKey: string;
  description?: string;
  sortOrder: number;
  scenes: SceneMeta[];
  rules?: RuleItem[];
  templateRules?: RuleItem[];
  customRules?: RuleItem[];
  overrideMode?: 'INHERIT' | 'CUSTOM';
};

type MetaPayload = {
  groups: GroupMeta[];
  sourceTypes: SourceTypeOption[];
  scopeTypes: ScopeTypeOption[];
  participantRoles: ParticipantRoleOption[];
};

type TemplateSummary = {
  id: string;
  name: string;
  enabled: boolean;
  remark?: string;
  ruleCount?: number;
  bindingCount?: number;
};

type TemplateDetail = {
  id: string;
  name: string;
  enabled: boolean;
  remark?: string;
  groups: GroupMeta[];
};

type OrgItem = {
  id: string;
  name: string;
  parentId?: string | null;
};

type PositionItem = {
  id: string;
  name: string;
  code?: string;
};

type LookupUser = {
  id: string;
  name: string;
  org_id?: string | null;
};

type TreeNode = {
  title: string;
  value: string;
  key: string;
  children?: TreeNode[];
  disabled?: boolean;
};

type OrgBinding = {
  orgId: string;
  templateId?: string | null;
  templateName?: string | null;
  enabled: boolean;
  remark?: string | null;
};

type TemplateModalMode = 'create' | 'edit';

const TECH_GROUP_KEY = 'TECH_COLLAB';
const LEGACY_TECH_GROUP_KEYS = new Set(['PRE_SALES_TECH', 'AFTER_SALES_TECH']);
const TECH_GROUP_NAME = '技术协同';
const TECH_GROUP_DESCRIPTION = '销售与技术共同参与售前、售后技术支持';

function localKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyRule(sortOrder = 10): RuleItem {
  return {
    participantRole: 'COLLABORATOR',
    sourceType: 'USER',
    sortOrder,
    enabled: true,
    _localKey: localKey(),
  };
}

function normalizeRules(rules: RuleItem[] | undefined) {
  return (rules || []).map((rule, index) => ({
    ...rule,
    sortOrder: typeof rule.sortOrder === 'number' ? rule.sortOrder : (index + 1) * 10,
    enabled: rule.enabled ?? true,
    _localKey: rule._localKey || rule.id || localKey(),
  }));
}

function isTechGroup(groupKey?: string) {
  return groupKey === TECH_GROUP_KEY || (!!groupKey && LEGACY_TECH_GROUP_KEYS.has(groupKey));
}

function buildRuleSignature(rule: RuleItem) {
  return [
    rule.sourceType || '',
    rule.sourceRefId || '',
    rule.sourceRefName || '',
    rule.resolveScopeType || '',
    rule.resolveScopeRefId || '',
    String(rule.enabled ?? true),
    rule.remark || '',
  ].join('|');
}

function mergeRules(...ruleGroups: Array<RuleItem[] | undefined>) {
  const merged = normalizeRules(ruleGroups.flatMap(group => group || []));
  const seen = new Set<string>();
  return merged.filter(rule => {
    const signature = buildRuleSignature(rule);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function mergeScenes(...sceneGroups: Array<SceneMeta[] | undefined>) {
  const items = sceneGroups.flatMap(group => group || []);
  const seen = new Set<string>();
  return items
    .filter(scene => {
      const signature = scene.sceneKey || scene.id;
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function normalizeLegacyTechGroups(groups: GroupMeta[] | undefined) {
  const list = groups || [];
  const techGroups = list.filter(group => isTechGroup(group.groupKey));
  if (!techGroups.length) {
    return list;
  }
  const mergedTechGroup = techGroups.find(group => group.groupKey === TECH_GROUP_KEY) || techGroups[0];
  const mergedTechSortOrder = Math.min(...techGroups.map(group => group.sortOrder || 0));

  const result: GroupMeta[] = [];
  let techInserted = false;
  list.forEach(group => {
    if (!isTechGroup(group.groupKey)) {
      result.push(group);
      return;
    }
    if (techInserted) {
      return;
    }
    result.push({
      ...mergedTechGroup,
      groupKey: TECH_GROUP_KEY,
      groupName: TECH_GROUP_NAME,
      domainKey: 'TECH',
      description: TECH_GROUP_DESCRIPTION,
      sortOrder: mergedTechSortOrder,
      scenes: mergeScenes(...techGroups.map(item => item.scenes)),
      rules: mergeRules(...techGroups.map(item => item.rules)),
      templateRules: mergeRules(...techGroups.map(item => item.templateRules)),
      customRules: mergeRules(...techGroups.map(item => item.customRules)),
      overrideMode: techGroups.some(item => item.overrideMode === 'CUSTOM') ? 'CUSTOM' : mergedTechGroup.overrideMode,
    });
    techInserted = true;
  });
  return result;
}

function buildTree(items: OrgItem[], allowedIds?: Set<string>, disableRootId?: string, rootId?: string): TreeNode[] {
  const childrenByParent = new Map<string | null, OrgItem[]>();
  const itemById = new Map<string, OrgItem>();
  items.forEach(item => {
    itemById.set(item.id, item);
    const parentId = item.parentId || null;
    const list = childrenByParent.get(parentId) || [];
    list.push(item);
    childrenByParent.set(parentId, list);
  });

  const sortByName = (list: OrgItem[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const buildNode = (item: OrgItem): TreeNode | null => {
    if (allowedIds && !allowedIds.has(item.id)) {
      return null;
    }
    const children = sortByName(childrenByParent.get(item.id) || [])
      .map(child => buildNode(child))
      .filter((node): node is TreeNode => !!node);
    return {
      title: item.name,
      value: item.id,
      key: item.id,
      disabled: disableRootId === item.id,
      children: children.length ? children : undefined,
    };
  };

  const roots = rootId
    ? [itemById.get(rootId)].filter((item): item is OrgItem => !!item)
    : sortByName(childrenByParent.get(null) || []);

  return roots
    .map(item => buildNode(item))
    .filter((node): node is TreeNode => !!node);
}

function collectDescendantIds(rootId: string, items: OrgItem[]) {
  const childrenByParent = new Map<string | null, string[]>();
  items.forEach(item => {
    const parentId = item.parentId || null;
    const list = childrenByParent.get(parentId) || [];
    list.push(item.id);
    childrenByParent.set(parentId, list);
  });
  const result = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    if (!current || result.has(current)) continue;
    result.add(current);
    (childrenByParent.get(current) || []).forEach(childId => queue.push(childId));
  }
  return result;
}

function serializeRule(rule: RuleItem) {
  const { _localKey, dutyLabel: _dutyLabel, participantRole: _participantRole, ...payload } = rule;
  return payload;
}

function managementSourceTypeOptions(options: SourceTypeOption[]) {
  const byValue = new Map(options.map(option => [option.value, option]));
  return [byValue.get('LEADER'), byValue.get('USER')].filter(Boolean) as SourceTypeOption[];
}

function ManagementLeaderHint() {
  return (
    <Alert
      type="info"
      showIcon
      message="管理沟通协同 · 默认设计"
      description={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>支持两种配置：<strong>按领导匹配</strong>、<strong>灵活指派人员</strong>。</div>
          <div>默认会带出 3 条领导规则：当前部门领导、当前销售大区领导、固定组织领导（默认固定到“销售体系”）。</div>
          <div>按领导匹配时：业务员默认会带出“部门经理 + 业务一部/大区 + 销售体系”；若业务销售负责人本身就是部门经理，则自动跳过本人，默认保留“业务一部/大区 + 销售体系”。</div>
          <div>固定组织从“销售体系”开始向上查找合适领导；命中本人时会自动跳过本人继续向上。</div>
        </div>
      )}
    />
  );
}

function RuleEditor({
  rules,
  onChange,
  sourceTypeOptions,
  scopeTypeOptions,
  userOptions,
  positionOptions,
  orgTreeData,
}: {
  rules: RuleItem[];
  onChange: (rules: RuleItem[]) => void;
  sourceTypeOptions: SourceTypeOption[];
  scopeTypeOptions: ScopeTypeOption[];
  userOptions: Array<{ value: string; label: string }>;
  positionOptions: Array<{ value: string; label: string }>;
  orgTreeData: TreeNode[];
}) {
  const updateRule = (ruleKey: string, patch: Partial<RuleItem>) => {
    onChange(rules.map(rule => ((rule._localKey || rule.id) === ruleKey ? { ...rule, ...patch } : rule)));
  };

  const removeRule = (ruleKey: string) => {
    onChange(rules.filter(rule => (rule._localKey || rule.id) !== ruleKey));
  };

  const addRule = () => {
    const defaultSourceType = sourceTypeOptions[0]?.value || 'USER';
    const nextRule = createEmptyRule(10);
    nextRule.sourceType = defaultSourceType;
    nextRule.sourceRefId = undefined;
    nextRule.sourceRefName = defaultSourceType === 'LEADER' ? '领导' : undefined;
    nextRule.resolveScopeType = defaultSourceType === 'POSITION' || defaultSourceType === 'LEADER' ? 'CURRENT_SALES_DEPT' : undefined;
    nextRule.resolveScopeRefId = undefined;
    onChange([...rules, nextRule]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rules.map(rule => {
        const ruleKey = rule._localKey || rule.id || localKey();
        const isPosition = rule.sourceType === 'POSITION';
        const isLeader = rule.sourceType === 'LEADER';
        const needsScope = isPosition || isLeader;
        return (
          <div
            key={ruleKey}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 170px 1fr 110px auto', gap: 10 }}>
              <Select
                value={rule.sourceType}
                options={sourceTypeOptions}
                disabled={sourceTypeOptions.length === 1}
                onChange={value => updateRule(ruleKey, {
                  sourceType: value,
                  sourceRefId: undefined,
                  sourceRefName: value === 'LEADER' ? '领导' : undefined,
                  resolveScopeType: value === 'POSITION' || value === 'LEADER' ? rule.resolveScopeType || 'CURRENT_SALES_DEPT' : undefined,
                  resolveScopeRefId: undefined,
                })}
              />
              <Select
                showSearch
                optionFilterProp="label"
                value={isLeader ? undefined : rule.sourceRefId}
                options={isPosition ? positionOptions : userOptions}
                placeholder={isPosition ? '选择岗位' : isLeader ? '按业务销售负责人自动匹配领导' : '选择人员'}
                disabled={isLeader}
                onChange={(value, option) => updateRule(ruleKey, {
                  sourceRefId: String(value),
                  sourceRefName: Array.isArray(option) ? undefined : String(option?.label || ''),
                })}
              />
              <Select
                value={needsScope ? rule.resolveScopeType || 'CURRENT_SALES_DEPT' : undefined}
                options={scopeTypeOptions}
                disabled={!needsScope}
                placeholder="解析范围"
                onChange={value => updateRule(ruleKey, {
                  resolveScopeType: value,
                  resolveScopeRefId: value === 'FIXED_ORG' ? rule.resolveScopeRefId : undefined,
                })}
              />
              <TreeSelect
                value={needsScope && rule.resolveScopeType === 'FIXED_ORG' ? rule.resolveScopeRefId : undefined}
                treeData={orgTreeData}
                disabled={!needsScope || rule.resolveScopeType !== 'FIXED_ORG'}
                allowClear
                placeholder="固定组织"
                treeDefaultExpandAll
                onChange={value => updateRule(ruleKey, { resolveScopeRefId: value ? String(value) : undefined })}
              />
              <InputNumber
                value={rule.sortOrder}
                min={0}
                style={{ width: '100%' }}
                onChange={value => updateRule(ruleKey, { sortOrder: typeof value === 'number' ? value : 0 })}
              />
              <Space>
                <Switch checked={rule.enabled} onChange={checked => updateRule(ruleKey, { enabled: checked })} />
                <Button danger icon={<DeleteOutlined />} onClick={() => removeRule(ruleKey)} />
              </Space>
            </div>
            {isLeader ? (
              <div style={{ color: '#64748b', fontSize: 12 }}>
                会按业务销售负责人自动匹配领导：销售员优先匹配当前层级直属领导；若负责人本身就是该层级领导，则自动跳过本人并上提一级。
              </div>
            ) : null}
          </div>
        );
      })}
      <div>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addRule}>新增协同规则</Button>
      </div>
    </div>
  );
}

export default function AdminSalesCollabPage() {
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [templateDetail, setTemplateDetail] = useState<TemplateDetail | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [users, setUsers] = useState<LookupUser[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>();
  const [orgBinding, setOrgBinding] = useState<OrgBinding | null>(null);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<TemplateModalMode>('create');
  const [templateDuplicating, setTemplateDuplicating] = useState(false);
  const [templateForm] = Form.useForm<{ name: string; enabled: boolean; remark?: string }>();

  const orgNameMap = useMemo(() => Object.fromEntries(orgs.map(org => [org.id, org.name])), [orgs]);
  const userOptions = useMemo(() => users.map(user => ({
    value: user.id,
    label: user.org_id ? `${user.name}（${orgNameMap[user.org_id] || '未分配组织'}）` : user.name,
  })), [orgNameMap, users]);
  const positionOptions = useMemo(() => positions.map(position => ({
    value: position.id,
    label: position.code ? `${position.name}（${position.code}）` : position.name,
  })), [positions]);

  useEffect(() => {
    const bootstrap = async () => {
      const [metaRes, templateRes, orgRes, positionRes, lookupRes]: any[] = await Promise.all([
        salesCollabApi.meta(),
        salesCollabApi.listTemplates(),
        orgApi.list(),
        positionApi.list(),
        userApi.lookups(),
      ]);
      setMeta(metaRes.data ? {
        ...metaRes.data,
        groups: normalizeLegacyTechGroups(metaRes.data.groups),
      } : null);
      const templateList = (templateRes.data || []) as TemplateSummary[];
      setTemplates(templateList);
      setSelectedTemplateId(current => current || templateList[0]?.id);
      setOrgs((orgRes.data || []) as OrgItem[]);
      setPositions((positionRes.data || []) as PositionItem[]);
      setUsers((lookupRes.data?.users || []) as LookupUser[]);
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateDetail(null);
      return;
    }
    const load = async () => {
      const response: any = await salesCollabApi.getTemplate(selectedTemplateId);
      const detail = response.data as TemplateDetail;
      const normalizedGroups = normalizeLegacyTechGroups(detail.groups);
      setTemplateDetail({
        ...detail,
        groups: normalizedGroups.map(group => ({
          ...group,
          rules: normalizeRules(group.rules),
        })),
      });
    };
    void load();
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedOrgId) {
      setOrgBinding(null);
      return;
    }
    setOrgBinding({ orgId: selectedOrgId, templateId: null, templateName: null, enabled: true, remark: null });
    const load = async () => {
      const response: any = await salesCollabApi.getOrgBinding(selectedOrgId);
      setOrgBinding(response.data as OrgBinding);
    };
    void load();
  }, [selectedOrgId]);

  const salesRoot = useMemo(() => orgs.find(org => org.name === '销售体系'), [orgs]);
  const salesOrgIds = useMemo(() => (salesRoot ? collectDescendantIds(salesRoot.id, orgs) : new Set<string>()), [orgs, salesRoot]);
  const salesOrgTree = useMemo(() => buildTree(orgs, salesRoot ? salesOrgIds : undefined, salesRoot?.id, salesRoot?.id), [orgs, salesOrgIds, salesRoot]);
  const allOrgTree = useMemo(() => buildTree(orgs), [orgs]);

  const refreshTemplates = async (preferId?: string) => {
    const response: any = await salesCollabApi.listTemplates();
    const list = (response.data || []) as TemplateSummary[];
    setTemplates(list);
    setSelectedTemplateId(preferId || list[0]?.id);
  };

  const openCreateTemplate = () => {
    setTemplateModalMode('create');
    templateForm.setFieldsValue({ name: '', enabled: true, remark: '' });
    setTemplateModalOpen(true);
  };

  const openEditTemplate = () => {
    if (!templateDetail) return;
    setTemplateModalMode('edit');
    templateForm.setFieldsValue({
      name: templateDetail.name,
      enabled: templateDetail.enabled,
      remark: templateDetail.remark,
    });
    setTemplateModalOpen(true);
  };

  const submitTemplateModal = async (values: { name: string; enabled: boolean; remark?: string }) => {
    if (templateModalMode === 'create') {
      const response: any = await salesCollabApi.createTemplate(values);
      message.success('模板已创建');
      setTemplateModalOpen(false);
      await refreshTemplates(response.data?.id as string | undefined);
      return;
    }
    if (!templateDetail) return;
    await salesCollabApi.updateTemplate(templateDetail.id, values);
    message.success('模板信息已更新');
    setTemplateModalOpen(false);
    await refreshTemplates(templateDetail.id);
  };

  const removeTemplate = async () => {
    if (!templateDetail) return;
    await salesCollabApi.deleteTemplate(templateDetail.id);
    message.success('模板已删除');
    await refreshTemplates();
  };

  const duplicateTemplate = async () => {
    if (!templateDetail) return;
    setTemplateDuplicating(true);
    try {
      const response: any = await salesCollabApi.duplicateTemplate(templateDetail.id);
      message.success('模板已复制');
      await refreshTemplates(response.data?.id as string | undefined);
    } finally {
      setTemplateDuplicating(false);
    }
  };

  const saveTemplateRules = async () => {
    if (!templateDetail) return;
    setTemplateSaving(true);
    try {
      const payload = {
        groups: templateDetail.groups.map(group => ({
          groupId: group.id,
          rules: (group.rules || []).map(serializeRule),
        })),
      };
      const response: any = await salesCollabApi.saveTemplateRules(templateDetail.id, payload);
      const detail = response.data as TemplateDetail;
      const normalizedGroups = normalizeLegacyTechGroups(detail.groups);
      setTemplateDetail({
        ...detail,
        groups: normalizedGroups.map(group => ({
          ...group,
          rules: normalizeRules(group.rules),
        })),
      });
      message.success('模板规则已保存');
      await refreshTemplates(templateDetail.id);
    } finally {
      setTemplateSaving(false);
    }
  };

  const updateTemplateGroupRules = (groupId: string, rules: RuleItem[]) => {
    setTemplateDetail(current => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map(group => group.id === groupId ? { ...group, rules: normalizeRules(rules) } : group),
      };
    });
  };

  const updateOrgBinding = (patch: Partial<OrgBinding>) => {
    setOrgBinding(current => current ? { ...current, ...patch } : current);
  };

  const saveOrgBinding = async () => {
    if (!selectedOrgId || !orgBinding) return;
    setBindingSaving(true);
    try {
      const response: any = await salesCollabApi.saveOrgBinding(selectedOrgId, orgBinding);
      setOrgBinding(response.data as OrgBinding);
      message.success('部门绑定模板已保存');
    } finally {
      setBindingSaving(false);
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Alert
        type="info"
        showIcon
        message="销售协同配置"
        description="主责人固定为业务销售负责人；本模块只配置不同协同组下的协同人规则，并支持模板复用与销售部门绑定。"
      />

      <Tabs
        className="page-tabs"
        items={[
          {
            key: 'templates',
            label: '模板管理',
            children: (
              <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 4 }}>
                  <Card>
                    <Space wrap>
                      <Select
                        value={selectedTemplateId}
                        style={{ width: 320 }}
                        placeholder="选择模板"
                        options={templates.map(template => ({ value: template.id, label: template.name }))}
                        onChange={value => setSelectedTemplateId(value)}
                      />
                      <Button type="primary" onClick={openCreateTemplate}>新增模板</Button>
                      <Button onClick={openEditTemplate} disabled={!templateDetail}>编辑模板</Button>
                      <Button loading={templateDuplicating} disabled={!templateDetail} onClick={() => void duplicateTemplate()}>复制模板</Button>
                      <Button danger disabled={!templateDetail} onClick={() => {
                        void Modal.confirm({
                          title: '确认删除模板？',
                          content: '删除后不可恢复，且不能删除已被部门绑定的模板。',
                          okText: '删除',
                          cancelText: '取消',
                          onOk: async () => {
                            await removeTemplate();
                          },
                        });
                      }}>删除模板</Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={templateSaving}
                        disabled={!templateDetail}
                        onClick={() => void saveTemplateRules()}
                      >
                        保存模板规则
                      </Button>
                    </Space>
                  </Card>

                  {!templateDetail ? (
                    <Card><Empty description="请选择或创建一个协同模板" /></Card>
                  ) : (
                    <>
                      <Card title={templateDetail.name} extra={templateDetail.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}>
                        <Space size={[8, 8]} wrap>
                          <Tag color="blue">主责人固定：业务销售负责人</Tag>
                          {templateDetail.remark ? <Tag>{templateDetail.remark}</Tag> : null}
                        </Space>
                      </Card>

                      {templateDetail.groups.map(group => (
                        <Card
                          key={group.id}
                          title={group.groupName}
                          extra={<Space size={[4, 4]} wrap>{group.scenes.map(scene => <Tag key={scene.id}>{scene.sceneName}</Tag>)}</Space>}
                        >
                          {group.description ? <div style={{ color: '#64748b', marginBottom: 12 }}>{group.description}</div> : null}
                          {group.groupKey === 'MANAGEMENT_SYNC' ? <ManagementLeaderHint /> : null}
                          <RuleEditor
                            rules={normalizeRules(group.rules)}
                            onChange={rules => updateTemplateGroupRules(group.id, rules)}
                            sourceTypeOptions={group.groupKey === 'MANAGEMENT_SYNC'
                              ? managementSourceTypeOptions(meta?.sourceTypes || [])
                              : (meta?.sourceTypes || [])}
                            scopeTypeOptions={meta?.scopeTypes || []}
                            userOptions={userOptions}
                            positionOptions={positionOptions}
                            orgTreeData={allOrgTree}
                          />
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'orgs',
            label: '部门应用',
            children: (
              <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 4 }}>
                  <Card>
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 320px auto', gap: 12, alignItems: 'center' }}>
                      <TreeSelect
                        value={selectedOrgId}
                        treeData={salesOrgTree}
                        placeholder="选择销售部门"
                        treeDefaultExpandAll
                        allowClear
                        onChange={value => setSelectedOrgId(value ? String(value) : undefined)}
                      />
                      <Select
                        value={orgBinding?.templateId || undefined}
                        placeholder="绑定模板"
                        disabled={!selectedOrgId}
                        options={templates.map(template => ({ value: template.id, label: template.name }))}
                        onChange={(value, option) => updateOrgBinding({
                          templateId: value ? String(value) : null,
                          templateName: Array.isArray(option) ? undefined : String(option?.label || ''),
                        })}
                      />
                      <Button type="primary" loading={bindingSaving} disabled={!selectedOrgId} onClick={() => void saveOrgBinding()}>保存部门模板绑定</Button>
                    </div>
                  </Card>

                  {!selectedOrgId || !orgBinding ? (
                    <Card><Empty description="请选择销售部门后绑定协同模板" /></Card>
                  ) : (
                    <Card>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Alert
                          type="info"
                          showIcon
                          message="部门应用仅保留模板绑定"
                          description="部门协同规则统一在“模板管理”中维护；部门应用只负责选择并绑定模板。业务销售负责人为负责人，模板命中的其他人员默认为协作者。"
                        />
                        <Space size={[8, 8]} wrap>
                          <Tag color="blue">负责人：业务销售负责人</Tag>
                          {orgBinding.templateName ? <Tag color="green">当前模板：{orgBinding.templateName}</Tag> : <Tag>当前未绑定模板</Tag>}
                          {orgBinding.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
                        </Space>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={templateModalOpen}
        title={templateModalMode === 'create' ? '新增协同模板' : '编辑协同模板'}
        okText="确定"
        cancelText="取消"
        onCancel={() => setTemplateModalOpen(false)}
        onOk={() => templateForm.submit()}
      >
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={values => {
            void submitTemplateModal(values);
          }}
        >
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="例如：销售协同标准模板" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="补充说明这个模板适用的销售组织或业务特点" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
