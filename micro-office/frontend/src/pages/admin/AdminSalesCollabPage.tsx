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
  Radio,
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

type OrgRuleDetail = {
  orgId: string;
  binding: OrgBinding;
  groups: GroupMeta[];
};

type PreviewPayload = {
  group: { id: string; groupKey: string; groupName: string; domainKey: string };
  owner?: { userId: string; name: string; orgId?: string; orgName?: string } | null;
  collaborators: Array<{
    userId: string;
    name: string;
    orgId?: string;
    orgName?: string;
    sourceType?: string;
    sourceRefName?: string;
    resolvedBy?: string;
  }>;
  unmatchedRules: Array<{
    reason: string;
    sourceType?: string;
    sourceRefName?: string;
    resolveScopeType?: string;
  }>;
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

function cloneRules(rules: RuleItem[] | undefined) {
  return normalizeRules(rules).map(rule => ({
    ...rule,
    id: undefined,
    _localKey: localKey(),
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

function RuleSummary({ rules, scopeLabelMap }: { rules: RuleItem[]; scopeLabelMap: Record<string, string> }) {
  if (!rules.length) {
    return <div style={{ color: '#94a3b8' }}>暂无协同规则</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rules.map(rule => {
        const isPosition = rule.sourceType === 'POSITION';
        const isLeader = rule.sourceType === 'LEADER';
        const sourceLabel = isPosition ? '岗位' : isLeader ? '领导' : '人员';
        return (
          <div
            key={rule._localKey || rule.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              background: '#fafafa',
            }}
          >
            <Space size={[8, 4]} wrap>
              <Tag color="blue">{sourceLabel}</Tag>
              <span>{rule.sourceRefName || (isLeader ? '按业务销售负责人自动解析' : '-')}</span>
              {(isPosition || isLeader) && rule.resolveScopeType ? (
                <Tag>{scopeLabelMap[rule.resolveScopeType] || rule.resolveScopeType}</Tag>
              ) : null}
              {rule.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
            </Space>
            <span style={{ color: '#94a3b8' }}>排序 {rule.sortOrder}</span>
          </div>
        );
      })}
    </div>
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
  const [orgRuleDetail, setOrgRuleDetail] = useState<OrgRuleDetail | null>(null);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [orgRulesSaving, setOrgRulesSaving] = useState(false);
  const [previewSceneKey, setPreviewSceneKey] = useState<string>();
  const [previewSalesOwnerUserId, setPreviewSalesOwnerUserId] = useState<string>();
  const [previewData, setPreviewData] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<TemplateModalMode>('create');
  const [templateDuplicating, setTemplateDuplicating] = useState(false);
  const [copyOrgModalOpen, setCopyOrgModalOpen] = useState(false);
  const [copyOrgTargetIds, setCopyOrgTargetIds] = useState<string[]>([]);
  const [copyOrgSubmitting, setCopyOrgSubmitting] = useState(false);
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
  const scopeLabelMap = useMemo(() => Object.fromEntries((meta?.scopeTypes || []).map(item => [item.value, item.label])), [meta]);

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
      setOrgRuleDetail(null);
      setPreviewData(null);
      return;
    }
    const load = async () => {
      const response: any = await salesCollabApi.getOrgRules(selectedOrgId);
      const detail = response.data as OrgRuleDetail;
      const normalizedGroups = normalizeLegacyTechGroups(detail.groups);
      setOrgRuleDetail({
        ...detail,
        groups: normalizedGroups.map(group => ({
          ...group,
          rules: normalizeRules(group.rules),
          templateRules: normalizeRules(group.templateRules),
          customRules: normalizeRules(group.customRules),
        })),
      });
      setPreviewData(null);
    };
    void load();
  }, [selectedOrgId]);

  const salesRoot = useMemo(() => orgs.find(org => org.name === '销售体系'), [orgs]);
  const salesOrgIds = useMemo(() => (salesRoot ? collectDescendantIds(salesRoot.id, orgs) : new Set<string>()), [orgs, salesRoot]);
  const salesOrgTree = useMemo(() => buildTree(orgs, salesRoot ? salesOrgIds : undefined, salesRoot?.id, salesRoot?.id), [orgs, salesOrgIds, salesRoot]);
  const allOrgTree = useMemo(() => buildTree(orgs), [orgs]);
  const sceneOptions = useMemo(() => {
    const groups = meta?.groups || [];
    return groups.flatMap(group => (group.scenes || []).map(scene => ({
      value: scene.sceneKey,
      label: `${scene.sceneName}（${group.groupName}）`,
    })));
  }, [meta]);

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
    setOrgRuleDetail(current => current ? { ...current, binding: { ...current.binding, ...patch } } : current);
  };

  const saveOrgBinding = async () => {
    if (!selectedOrgId || !orgRuleDetail) return;
    setBindingSaving(true);
    try {
      const response: any = await salesCollabApi.saveOrgBinding(selectedOrgId, orgRuleDetail.binding);
      setOrgRuleDetail(current => current ? { ...current, binding: response.data as OrgBinding } : current);
      message.success('部门绑定模板已保存');
      const detailResponse: any = await salesCollabApi.getOrgRules(selectedOrgId);
      const detail = detailResponse.data as OrgRuleDetail;
      const normalizedGroups = normalizeLegacyTechGroups(detail.groups);
      setOrgRuleDetail({
        ...detail,
        groups: normalizedGroups.map(group => ({
          ...group,
          rules: normalizeRules(group.rules),
          templateRules: normalizeRules(group.templateRules),
          customRules: normalizeRules(group.customRules),
        })),
      });
    } finally {
      setBindingSaving(false);
    }
  };

  const updateOrgGroup = (groupId: string, patch: Partial<GroupMeta>) => {
    setOrgRuleDetail(current => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map(group => group.id === groupId ? { ...group, ...patch } : group),
      };
    });
  };

  const changeOverrideMode = (groupId: string, overrideMode: 'INHERIT' | 'CUSTOM') => {
    setOrgRuleDetail(current => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map(group => {
          if (group.id !== groupId) return group;
          if (overrideMode === 'INHERIT') {
            return {
              ...group,
              overrideMode,
              rules: cloneRules(group.templateRules),
              customRules: [],
            };
          }
          const customRules = group.customRules && group.customRules.length
            ? cloneRules(group.customRules)
            : cloneRules(group.templateRules);
          return {
            ...group,
            overrideMode,
            rules: customRules,
            customRules,
          };
        }),
      };
    });
  };

  const updateOrgGroupRules = (groupId: string, rules: RuleItem[]) => {
    updateOrgGroup(groupId, { rules: normalizeRules(rules), customRules: normalizeRules(rules) });
  };

  const saveOrgRules = async () => {
    if (!selectedOrgId || !orgRuleDetail) return;
    setOrgRulesSaving(true);
    try {
      const payload = {
        groups: orgRuleDetail.groups.map(group => ({
          groupId: group.id,
          overrideMode: group.overrideMode || 'INHERIT',
          rules: (group.overrideMode === 'CUSTOM' ? (group.rules || []) : []).map(serializeRule),
        })),
      };
      const response: any = await salesCollabApi.saveOrgRules(selectedOrgId, payload);
      const detail = response.data as OrgRuleDetail;
      const normalizedGroups = normalizeLegacyTechGroups(detail.groups);
      setOrgRuleDetail({
        ...detail,
        groups: normalizedGroups.map(group => ({
          ...group,
          rules: normalizeRules(group.rules),
          templateRules: normalizeRules(group.templateRules),
          customRules: normalizeRules(group.customRules),
        })),
      });
      message.success('部门协同规则已保存');
    } finally {
      setOrgRulesSaving(false);
    }
  };

  const submitCopyOrgRules = async () => {
    if (!selectedOrgId) return;
    if (!copyOrgTargetIds.length) {
      message.warning('请选择目标销售部门');
      return;
    }
    setCopyOrgSubmitting(true);
    try {
      const response: any = await salesCollabApi.copyOrgRules(selectedOrgId, { targetOrgIds: copyOrgTargetIds });
      message.success(`已复制到 ${response.data?.copiedCount || copyOrgTargetIds.length} 个销售部门`);
      setCopyOrgModalOpen(false);
      setCopyOrgTargetIds([]);
    } finally {
      setCopyOrgSubmitting(false);
    }
  };

  const loadPreview = async () => {
    if (!selectedOrgId || !previewSceneKey || !previewSalesOwnerUserId) {
      message.warning('请选择销售部门、协同场景和业务销售负责人');
      return;
    }
    setPreviewLoading(true);
    try {
      const response: any = await salesCollabApi.preview({
        orgId: selectedOrgId,
        sceneKey: previewSceneKey,
        salesOwnerUserId: previewSalesOwnerUserId,
      });
      setPreviewData(response.data as PreviewPayload);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Alert
        type="info"
        showIcon
        message="销售协同配置"
        description="主责人固定为业务销售负责人；本模块只配置不同协同组下的协同人规则，并支持模板复用与销售部门覆盖。"
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
                        value={orgRuleDetail?.binding.templateId || undefined}
                        placeholder="绑定模板"
                        disabled={!selectedOrgId}
                        options={templates.map(template => ({ value: template.id, label: template.name }))}
                        onChange={value => updateOrgBinding({ templateId: value ? String(value) : null })}
                      />
                      <Button type="primary" loading={bindingSaving} disabled={!selectedOrgId} onClick={() => void saveOrgBinding()}>保存部门模板绑定</Button>
                    </div>
                  </Card>

                  {!selectedOrgId || !orgRuleDetail ? (
                    <Card><Empty description="请选择销售部门后配置协同规则" /></Card>
                  ) : (
                    <>
                      {orgRuleDetail.groups.map(group => (
                        <Card
                          key={group.id}
                          title={group.groupName}
                          extra={<Space size={[4, 4]} wrap>{group.scenes.map(scene => <Tag key={scene.id}>{scene.sceneName}</Tag>)}</Space>}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Space size={[8, 8]} wrap>
                              <Tag color="blue">主责人：业务销售负责人（自动带出）</Tag>
                              {group.description ? <Tag>{group.description}</Tag> : null}
                            </Space>

                            <Radio.Group
                              value={group.overrideMode || 'INHERIT'}
                              onChange={event => changeOverrideMode(group.id, event.target.value as 'INHERIT' | 'CUSTOM')}
                            >
                              <Radio.Button value="INHERIT">继承模板</Radio.Button>
                              <Radio.Button value="CUSTOM">部门自定义</Radio.Button>
                            </Radio.Group>

                            {group.groupKey === 'MANAGEMENT_SYNC' ? <ManagementLeaderHint /> : null}

                            {(group.overrideMode || 'INHERIT') === 'INHERIT' ? (
                              <RuleSummary rules={normalizeRules(group.templateRules)} scopeLabelMap={scopeLabelMap} />
                            ) : (
                              <RuleEditor
                                rules={normalizeRules(group.rules)}
                                onChange={rules => updateOrgGroupRules(group.id, rules)}
                                sourceTypeOptions={group.groupKey === 'MANAGEMENT_SYNC'
                                  ? managementSourceTypeOptions(meta?.sourceTypes || [])
                                  : (meta?.sourceTypes || [])}
                                scopeTypeOptions={meta?.scopeTypes || []}
                                userOptions={userOptions}
                                positionOptions={positionOptions}
                                orgTreeData={allOrgTree}
                              />
                            )}
                          </div>
                        </Card>
                      ))}

                      <Card>
                        <Space wrap>
                          <Button type="primary" icon={<SaveOutlined />} loading={orgRulesSaving} onClick={() => void saveOrgRules()}>
                            保存部门协同规则
                          </Button>
                          <Button disabled={!selectedOrgId} onClick={() => {
                            setCopyOrgTargetIds([]);
                            setCopyOrgModalOpen(true);
                          }}>
                            复制到其他部门
                          </Button>
                        </Space>
                      </Card>

                      <Card title="责任人预览">
                        <div style={{ display: 'grid', gridTemplateColumns: '280px 280px auto', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                          <Select
                            value={previewSceneKey}
                            options={sceneOptions}
                            placeholder="选择协同场景"
                            onChange={value => setPreviewSceneKey(value)}
                          />
                          <Select
                            showSearch
                            optionFilterProp="label"
                            value={previewSalesOwnerUserId}
                            options={userOptions}
                            placeholder="选择业务销售负责人"
                            onChange={value => setPreviewSalesOwnerUserId(value)}
                          />
                          <Button loading={previewLoading} onClick={() => void loadPreview()}>预览解析结果</Button>
                        </div>

                        {!previewData ? (
                          <Empty description="选择场景与业务销售负责人后可预览最终参与人" />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                              <Space size={[8, 8]} wrap>
                                <Tag color="purple">{previewData.group.groupName}</Tag>
                                <Tag>{previewData.owner?.name || '未指定销售负责人'}</Tag>
                                {previewData.owner?.orgName ? <Tag>{previewData.owner.orgName}</Tag> : null}
                              </Space>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>协同人</div>
                              {previewData.collaborators.length ? previewData.collaborators.map(user => (
                                <div
                                  key={user.userId}
                                  style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 12,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    background: '#fafafa',
                                  }}
                                >
                                  <Space size={[8, 8]} wrap>
                                    <span>{user.name}</span>
                                    {user.orgName ? <Tag>{user.orgName}</Tag> : null}
                                    {user.sourceRefName ? <Tag color="blue">{user.sourceRefName}</Tag> : null}
                                  </Space>
                                  <span style={{ color: '#94a3b8' }}>{user.resolvedBy || user.sourceType}</span>
                                </div>
                              )) : <div style={{ color: '#94a3b8' }}>当前没有解析出协同人</div>}
                            </div>

                            {previewData.unmatchedRules.length ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontWeight: 600 }}>未命中规则</div>
                                {previewData.unmatchedRules.map((item, index) => (
                                  <Alert
                                    key={`${item.reason}-${index}`}
                                    type="warning"
                                    showIcon
                                    message={item.reason}
                                    description={[item.sourceRefName, item.resolveScopeType].filter(Boolean).join(' / ') || '请检查规则配置'}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </Card>
                    </>
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

      <Modal
        open={copyOrgModalOpen}
        title="复制部门协同配置"
        okText="开始复制"
        cancelText="取消"
        confirmLoading={copyOrgSubmitting}
        onCancel={() => setCopyOrgModalOpen(false)}
        onOk={() => void submitCopyOrgRules()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#64748b' }}>会复制当前部门的模板绑定和自定义协同规则到目标销售部门。</div>
          <TreeSelect
            value={copyOrgTargetIds}
            treeData={salesOrgTree}
            treeCheckable
            multiple
            allowClear
            showSearch
            treeDefaultExpandAll
            placeholder="选择目标销售部门"
            onChange={value => setCopyOrgTargetIds((value || []) as string[])}
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </div>
  );
}
