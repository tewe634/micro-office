import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, ArrowRightOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Empty, Radio, Row, Segmented, Space, Statistic, Table, Tag } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { portalApi } from '../../api';
import type { PortalOptionItem, PortalPayload, PortalRequestParams, PortalSelection } from '../../api';
import { formatObjectType, formatRoleLabel } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

type PortalEntityType = 'users' | 'objects' | 'products';
type WorkflowFilterKey = 'ALL' | 'OPEN' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type UserPortalDetailSection = 'workflow' | 'performance' | 'customers' | 'products';

type NormalizedContextOption = {
  key: string;
  requestValue?: string;
  label: string;
  hint?: string;
  portalLabel?: string;
  badge?: string;
  tone?: string;
};

const roleColorMap: Record<string, string> = {
  ADMIN: 'red',
  HR: 'purple',
  SALES: 'cyan',
  PURCHASE: 'geekblue',
  FINANCE: 'gold',
  TECH: 'green',
  STAFF: 'default',
};

const statusColorMap: Record<string, string> = {
  TODO: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const statusLabelMap: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '取消',
};

const scopeLabelMap: Record<string, string> = {
  personal: '个人',
  department: '部门',
  business: '业务',
  system: '全局',
};

const scopeColorMap: Record<string, string> = {
  personal: 'blue',
  department: 'cyan',
  business: 'geekblue',
  system: 'purple',
};

const workflowFilterStatusMap: Record<WorkflowFilterKey, string[]> = {
  ALL: [],
  OPEN: ['TODO', 'IN_PROGRESS'],
  TODO: ['TODO'],
  IN_PROGRESS: ['IN_PROGRESS'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
};

const workflowFilterLabelMap: Record<WorkflowFilterKey, string> = {
  ALL: '全部工作',
  OPEN: '待推进工作',
  TODO: '待办',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CANCELLED: '取消',
};

const workflowHomeStatusOrder: WorkflowFilterKey[] = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const portalTypeLabelMap: Record<string, string> = {
  USER_SALES: '销售视图',
  PRODUCT: '销售视图',
  OBJECT_CUSTOMER: '销售视图',
  OBJECT_WORK: '工作视图',
};

const userPortalDetailMetaMap: Record<UserPortalDetailSection, { title: string; description: string }> = {
  workflow: {
    title: '工作流详情',
    description: '查看当前岗位关联事项，并按状态或维度筛选明细。',
  },
  performance: {
    title: '绩效详情',
    description: '查看销售排名与销售过程明细。',
  },
  customers: {
    title: '关联客户详情',
    description: '查看当前销售岗位关联客户与推进情况。',
  },
  products: {
    title: '主推产品详情',
    description: '查看当前销售岗位主推产品与金额分布。',
  },
};

function formatPortalVariantLabel(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  if (value.startsWith('USER_WORK')) {
    return '工作视图';
  }
  return portalTypeLabelMap[value] || value;
}

function portalVariantTone(value: string | undefined) {
  if (!value) {
    return 'default';
  }
  if (value === 'USER_SALES' || value === 'PRODUCT' || value === 'OBJECT_CUSTOMER') {
    return 'cyan';
  }
  if (value.startsWith('USER_WORK') || value === 'OBJECT_WORK') {
    return 'geekblue';
  }
  return 'default';
}

function formatStatValue(value: unknown, suffix?: string) {
  const numericValue = Number(value || 0);
  if (suffix === '元') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      maximumFractionDigits: 0,
    }).format(numericValue);
  }
  return `${new Intl.NumberFormat('zh-CN').format(numericValue)}${suffix || ''}`;
}

function formatAmount(value: unknown) {
  return formatStatValue(value, '元');
}

function formatMetricDisplay(value: unknown, suffix?: string) {
  if (typeof value === 'number') {
    return formatStatValue(value, suffix);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '-';
    }
    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue) && trimmed === String(numericValue)) {
      return formatStatValue(numericValue, suffix);
    }
    return suffix ? `${trimmed}${suffix}` : trimmed;
  }

  return '-';
}

function isRealEntityId(id?: string | number | null) {
  return !!id && !String(id).startsWith('mock-');
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function normalizeSelectionObject(value: PortalSelection | undefined | null) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }
  return value as PortalOptionItem;
}

function buildHint(parts: Array<string | undefined>) {
  const items = parts.filter(Boolean) as string[];
  return items.length ? items.join(' · ') : undefined;
}

function buildSelectionCandidates(value: PortalSelection | undefined | null) {
  const candidates = new Set<string>();
  const scalar = normalizeText(value);
  if (scalar) {
    candidates.add(scalar);
  }

  const record = normalizeSelectionObject(value);
  if (!record) {
    return Array.from(candidates);
  }

  ['positionId', 'scope', 'id', 'value', 'key', 'portalType', 'type', 'variant', 'label', 'name', 'title', 'code'].forEach((field) => {
    const candidate = normalizeText(record[field]);
    if (candidate) {
      candidates.add(candidate);
    }
  });

  return Array.from(candidates);
}

function normalizePortalOption(item: PortalOptionItem, index: number): NormalizedContextOption {
  const portalType = normalizeText(item.portalType) ?? normalizeText(item.type) ?? normalizeText(item.variant);
  const requestValue = normalizeText(item.positionId) ?? normalizeText(item.id) ?? normalizeText(item.value) ?? normalizeText(item.key);
  const label = normalizeText(item.label) ?? normalizeText(item.positionName) ?? normalizeText(item.name) ?? normalizeText(item.title) ?? `岗位 ${index + 1}`;
  const roleCode = normalizeText(item.role);
  const roleText = normalizeText(item.roleName) ?? (roleCode ? formatRoleLabel(roleCode) : undefined);
  const orgText = normalizeText(item.deptName) ?? normalizeText(item.orgName);
  const portalText = formatPortalVariantLabel(portalType);
  const codeText = normalizeText(item.code);

  return {
    key: requestValue ?? normalizeText(item.key) ?? `portal-${index}`,
    requestValue,
    label,
    hint: buildHint([roleText, orgText, portalText, codeText]),
    portalLabel: portalText,
    badge: item.primary === true || item.isPrimary === true ? '主岗位' : undefined,
  };
}

function normalizeScopeOption(item: PortalOptionItem, index: number): NormalizedContextOption {
  const scopeValue = normalizeText(item.scope) ?? normalizeText(item.value) ?? normalizeText(item.key) ?? normalizeText(item.id);
  const label = normalizeText(item.label) ?? normalizeText(item.name) ?? normalizeText(item.title) ?? (scopeValue ? scopeLabelMap[scopeValue] || scopeValue : `范围 ${index + 1}`);

  return {
    key: scopeValue ?? `scope-${index}`,
    requestValue: scopeValue,
    label,
    hint: normalizeText(item.description),
    tone: scopeValue ? scopeColorMap[scopeValue] || 'cyan' : 'cyan',
  };
}

function dedupeOptions(options: NormalizedContextOption[]) {
  const seen = new Set<string>();
  const result: NormalizedContextOption[] = [];

  options.forEach((option) => {
    if (seen.has(option.key)) {
      return;
    }
    seen.add(option.key);
    result.push(option);
  });

  return result;
}

function findMatchedOption(options: NormalizedContextOption[], candidates: Array<string | undefined>) {
  const orderedCandidates = candidates.filter(Boolean) as string[];
  if (!orderedCandidates.length) {
    return null;
  }

  for (const candidate of orderedCandidates) {
    const matched = options.find(option => (
      (option.requestValue && option.requestValue === candidate)
      || option.key === candidate
      || option.label === candidate
    ));
    if (matched) {
      return matched;
    }
  }

  return null;
}

function normalizePortalSelection(value: PortalSelection | undefined | null) {
  const record = normalizeSelectionObject(value);
  if (record) {
    return normalizePortalOption(record, 0);
  }

  const scalar = normalizeText(value);
  if (!scalar) {
    return null;
  }

  return {
    key: scalar,
    requestValue: scalar,
    label: scalar,
  };
}

function normalizeScopeSelection(value: PortalSelection | undefined | null) {
  const record = normalizeSelectionObject(value);
  if (record) {
    return normalizeScopeOption(record, 0);
  }

  const scalar = normalizeText(value);
  if (!scalar) {
    return null;
  }

  return {
    key: scalar,
    requestValue: scalar,
    label: scopeLabelMap[scalar] || scalar,
    tone: scopeColorMap[scalar] || 'cyan',
  };
}

function normalizeWorkflowFilterKey(value: unknown): WorkflowFilterKey {
  const key = normalizeText(value)?.toUpperCase();
  if (key === 'OPEN' || key === 'TODO' || key === 'IN_PROGRESS' || key === 'COMPLETED' || key === 'CANCELLED') {
    return key as WorkflowFilterKey;
  }
  return 'ALL';
}

function normalizeUserPortalDetailSection(value: unknown): UserPortalDetailSection {
  const key = normalizeText(value);
  if (key === 'performance' || key === 'customers' || key === 'products') {
    return key;
  }
  if (key === 'ranking') {
    return 'performance';
  }
  return 'workflow';
}

export default function PortalPage({ entityType }: { entityType: PortalEntityType }) {
  const { id, detailSection: detailSectionParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const menus = useAuthStore(s => s.menus);
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingPortalValue, setPendingPortalValue] = useState<string>();

  const positionIdParam = searchParams.get('positionId') || undefined;
  const scopeParam = searchParams.get('scope') || undefined;
  const workflowStatusFilter = normalizeWorkflowFilterKey(searchParams.get('status'));
  const workflowStageFilter = normalizeText(searchParams.get('stage')) || 'ALL';
  const isUserDetailRoute = entityType === 'users' && !!detailSectionParam;
  const userDetailSection = isUserDetailRoute ? normalizeUserPortalDetailSection(detailSectionParam) : null;

  const loader = useMemo(() => {
    if (entityType === 'users') return portalApi.user;
    if (entityType === 'objects') return portalApi.object;
    return portalApi.product;
  }, [entityType]);

  const requestParams = useMemo<PortalRequestParams>(() => {
    const params: PortalRequestParams = {};
    if (entityType === 'users' && positionIdParam) {
      params.positionId = positionIdParam;
    }
    if (entityType !== 'users' && scopeParam) {
      params.scope = scopeParam;
    }
    return params;
  }, [entityType, positionIdParam, scopeParam]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response: any = await loader(id, requestParams);
        if (!cancelled) {
          setData((response?.data || null) as PortalPayload | null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || '门户数据加载失败');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setPendingPortalValue(undefined);
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, loader, requestParams]);

  const goPortal = (kind: PortalEntityType, targetId?: string | number | null) => {
    if (!isRealEntityId(targetId)) return;
    navigate(`/${kind}/${targetId}/portal`);
  };

  const renderPortalLink = (kind: PortalEntityType, targetId: unknown, label: unknown) => {
    const menuKey = `/${kind}`;
    if (!isRealEntityId(targetId as string | number | null | undefined) || !menus.includes(menuKey)) {
      return <span>{normalizeText(label) || '-'}</span>;
    }
    return (
      <Button
        type="link"
        size="small"
        onClick={() => goPortal(kind, targetId as string | number)}
        style={{ padding: 0, height: 'auto' }}
      >
        {label as string}
      </Button>
    );
  };

  const header = (data?.header || {}) as Record<string, any>;
  const summaryCards = Array.isArray(data?.summaryCards) ? data.summaryCards : [];
  const workSummary = (data?.workSummary || {}) as Record<string, any>;
  const userWorkItems = Array.isArray(data?.workItems) ? data.workItems : [];
  const salesActionCards = Array.isArray(data?.salesActionCards) ? data.salesActionCards : summaryCards;
  const workflowStatusCards = Array.isArray(data?.workflowStatusCards) ? data.workflowStatusCards : [];
  const salesRankingRows = Array.isArray(data?.salesRanking) ? data.salesRanking : [];
  const customerPerformanceRows = Array.isArray(data?.customerPerformance) ? data.customerPerformance : [];
  const relatedProductsRows = Array.isArray(data?.relatedProducts) ? data.relatedProducts : [];
  const performanceItemRows = Array.isArray(data?.performanceItems) ? data.performanceItems : [];
  const currentPortalVariant = normalizeText(data?.variant);
  const currentPortalLabel = formatPortalVariantLabel(currentPortalVariant);
  const customerPerspectiveLabel = normalizeText(data?.perspectiveLabel);
  const customerPerspectiveHint = normalizeText(data?.perspectiveHint);
  const isCustomerObjectPortal = entityType === 'objects' && header.type === 'CUSTOMER';
  const displaySummaryCards = useMemo(
    () => (isCustomerObjectPortal ? summaryCards.filter((card: any) => normalizeText(card?.key) !== 'participants') : summaryCards),
    [isCustomerObjectPortal, summaryCards],
  );
  const customerParticipantLabel = normalizeText(data?.perspectiveMode) === 'OWNER' ? '负责人' : '关联人员';

  const portalOptions = useMemo(() => {
    const primaryOptions = Array.isArray(data?.portalOptions) ? data.portalOptions : [];
    const fallbackOptions = primaryOptions.length ? primaryOptions : Array.isArray(data?.allPositions) ? data.allPositions : [];
    return dedupeOptions(fallbackOptions.map((item, index) => normalizePortalOption(item, index)));
  }, [data]);

  const scopeOptions = useMemo(() => {
    const options = Array.isArray(data?.scopeOptions) ? data.scopeOptions : [];
    return dedupeOptions(options.map((item, index) => normalizeScopeOption(item, index)));
  }, [data]);

  const hasPortalFeature = entityType === 'users'
    && (portalOptions.length > 0
      || (Array.isArray(data?.allPositions) && data.allPositions.length > 0)
      || !!data?.activePortal);

  const hasScopeFeature = entityType !== 'users'
    && !isCustomerObjectPortal
    && (scopeOptions.length > 0 || !!data?.activeScope || !!normalizeText(data?.scope));

  const activePortalOption = useMemo(() => {
    if (!hasPortalFeature) {
      return null;
    }

    const matched = findMatchedOption(portalOptions, [
      ...buildSelectionCandidates(data?.activePortal),
      normalizeText(header.positionId),
      normalizeText(header.primaryPositionId),
      positionIdParam,
    ]);

    if (matched) {
      return matched;
    }

    return normalizePortalSelection(data?.activePortal)
      || portalOptions[0]
      || null;
  }, [data, hasPortalFeature, header.positionId, header.primaryPositionId, portalOptions, positionIdParam]);

  const activeScopeOption = useMemo(() => {
    if (!hasScopeFeature) {
      return null;
    }

    const matched = findMatchedOption(scopeOptions, [
      scopeParam,
      ...buildSelectionCandidates(data?.activeScope),
      normalizeText(data?.scope),
    ]);

    if (matched) {
      return matched;
    }

    return normalizeScopeSelection(data?.activeScope ?? data?.scope)
      || scopeOptions[0]
      || null;
  }, [data, hasScopeFeature, scopeOptions, scopeParam]);

  const showPortalSwitch = hasPortalFeature && portalOptions.length > 1;
  const showScopeSwitch = hasScopeFeature && scopeOptions.length > 1;
  const userWorkBuckets = useMemo(() => {
    if (Array.isArray(data?.workBuckets) && data.workBuckets.length) {
      return data.workBuckets;
    }

    const counts = new Map<string, number>();
    userWorkItems.forEach((item: any) => {
      const stage = normalizeText(item.stage) || '未分类';
      counts.set(stage, (counts.get(stage) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([label, count], index) => ({
      id: `bucket-${index}`,
      label,
      count,
      filterValue: label,
      description: '点击查看该维度明细',
    }));
  }, [data, userWorkItems]);
  const selectedPortalLabel = activePortalOption?.portalLabel || currentPortalLabel;
  const selectedPortalTone = portalVariantTone(
    selectedPortalLabel === '工作视图'
      ? 'USER_WORK'
      : selectedPortalLabel === '销售视图'
        ? 'USER_SALES'
        : currentPortalVariant
  );
  const activePortalValue = activePortalOption?.requestValue ?? activePortalOption?.key;
  const portalSwitchValue = activePortalOption?.requestValue ?? activePortalOption?.key ?? portalOptions[0]?.requestValue ?? portalOptions[0]?.key;
  const primaryPortalValue = normalizeText(header.primaryPositionId)
    ?? portalOptions.find(option => option.badge === '主岗位')?.requestValue;
  const pendingPortalOption = useMemo(() => {
    if (!pendingPortalValue) {
      return null;
    }

    return portalOptions.find(option => (option.requestValue ?? option.key) === pendingPortalValue) || null;
  }, [pendingPortalValue, portalOptions]);
  const isPortalSwitchPending = !!pendingPortalOption && pendingPortalOption.requestValue !== activePortalValue;
  const showContextPanel = !isCustomerObjectPortal && (hasPortalFeature || hasScopeFeature || !!customerPerspectiveLabel);
  const filteredUserWorkItems = useMemo(() => {
    return userWorkItems.filter((item: any) => {
      const status = normalizeText(item.status) || '';
      const stage = normalizeText(item.stage) || '';
      const matchesStatus = workflowStatusFilter === 'ALL'
        || workflowFilterStatusMap[workflowStatusFilter].includes(status);
      const matchesStage = workflowStageFilter === 'ALL' || stage === workflowStageFilter;
      return matchesStatus && matchesStage;
    });
  }, [userWorkItems, workflowStageFilter, workflowStatusFilter]);
  const activeWorkflowStatusLabel = workflowFilterLabelMap[workflowStatusFilter];

  const listRoute = useMemo(() => {
    if (entityType === 'users') return '/users';
    if (entityType === 'objects') return '/objects';
    return '/products';
  }, [entityType]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(listRoute);
  };

  const updateQueryParams = (updates: { positionId?: string; scope?: string; status?: string; stage?: string }) => {
    const next = new URLSearchParams(searchParams);

    if (Object.prototype.hasOwnProperty.call(updates, 'positionId')) {
      if (updates.positionId) {
        next.set('positionId', updates.positionId);
      } else {
        next.delete('positionId');
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'scope')) {
      if (updates.scope) {
        next.set('scope', updates.scope);
      } else {
        next.delete('scope');
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
      if (updates.status && updates.status !== 'ALL') {
        next.set('status', updates.status);
      } else {
        next.delete('status');
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'stage')) {
      if (updates.stage && updates.stage !== 'ALL') {
        next.set('stage', updates.stage);
      } else {
        next.delete('stage');
      }
    }

    setSearchParams(next, { replace: true });
  };

  const handlePortalSwitch = (option: NormalizedContextOption) => {
    if (!option.requestValue || option.requestValue === activePortalValue || loading) {
      return;
    }

    setPendingPortalValue(option.requestValue);
    updateQueryParams({
      positionId: option.requestValue === primaryPortalValue ? undefined : option.requestValue,
    });
  };

  const handlePortalSwitchValue = (value: string | number) => {
    const nextValue = String(value);
    const option = portalOptions.find(item => (item.requestValue ?? item.key) === nextValue);
    if (option) {
      handlePortalSwitch(option);
    }
  };

  const handleScopeSwitch = (value: string | number) => {
    const nextValue = String(value);
    if (!nextValue || nextValue === scopeParam) {
      return;
    }
    updateQueryParams({ scope: nextValue });
  };

  const buildUserPortalSearch = (updates?: { status?: string; stage?: string }) => {
    const next = new URLSearchParams();
    if (positionIdParam) {
      next.set('positionId', positionIdParam);
    }
    if (updates?.status && updates.status !== 'ALL') {
      next.set('status', updates.status);
    }
    if (updates?.stage && updates.stage !== 'ALL') {
      next.set('stage', updates.stage);
    }
    const query = next.toString();
    return query ? `?${query}` : '';
  };

  const navigateToUserPortalHome = () => {
    if (!id) {
      return;
    }
    navigate(`/users/${id}/portal${buildUserPortalSearch()}`);
  };

  const navigateToUserPortalDetail = (
    section: UserPortalDetailSection,
    updates?: { status?: string; stage?: string },
  ) => {
    if (!id) {
      return;
    }
    navigate(`/users/${id}/portal/details/${section}${buildUserPortalSearch(updates)}`);
  };

  const handleWorkflowStatusCard = (filter: WorkflowFilterKey) => {
    const nextStatus = workflowStatusFilter === filter || filter === 'ALL' ? undefined : filter;
    updateQueryParams({
      status: nextStatus,
      stage: workflowStageFilter === 'ALL' ? undefined : workflowStageFilter,
    });
  };

  const handleWorkflowBucket = (value: unknown) => {
    const filterValue = normalizeText(value) || 'ALL';
    const nextStage = workflowStageFilter === filterValue || filterValue === 'ALL' ? undefined : filterValue;
    updateQueryParams({
      status: workflowStatusFilter === 'ALL' ? undefined : workflowStatusFilter,
      stage: nextStage,
    });
  };

  const clearWorkflowFilters = () => {
    updateQueryParams({
      status: undefined,
      stage: undefined,
    });
  };

  const handleSalesActionCard = (card: Record<string, any>) => {
    const targetSection = normalizeUserPortalDetailSection(card.targetSection);
    const nextFilter = normalizeWorkflowFilterKey(card.filterKey);
    if (targetSection === 'workflow') {
      navigateToUserPortalDetail('workflow', {
        status: nextFilter === 'ALL' ? undefined : nextFilter,
      });
      return;
    }
    navigateToUserPortalDetail(targetSection);
  };

  const headerTags = () => {
    if (entityType === 'users') {
      return (
        <>
          <Tag color={roleColorMap[header.role] || 'default'}>{formatRoleLabel(header.role)}</Tag>
          {header.positionName ? <Tag>{header.positionName}</Tag> : null}
          {header.empNo ? <Tag>{header.empNo}</Tag> : null}
          <Tag color="processing">{header.year} 门户</Tag>
        </>
      );
    }

    if (entityType === 'objects') {
      return (
        <>
          <Tag color="blue">{formatObjectType(header.type)}</Tag>
          {!isCustomerObjectPortal && customerPerspectiveLabel ? <Tag color="cyan">{customerPerspectiveLabel}</Tag> : null}
          {header.industry ? <Tag color="geekblue">{header.industry}</Tag> : null}
          <Tag color="processing">{header.year} 门户</Tag>
        </>
      );
    }

    return (
      <>
        {header.productLine ? <Tag color="blue">{header.productLine}</Tag> : null}
        {header.categoryCode ? <Tag>{header.categoryCode}</Tag> : null}
        <Tag color="processing">{header.year} 门户</Tag>
      </>
    );
  };

  const descriptionItems = () => {
    if (entityType === 'users') {
      return [
        ['邮箱', header.email],
        ['手机号', header.phone],
        ['所属组织', header.orgName],
        ['岗位', header.positionName],
        ['角色', formatRoleLabel(header.role)],
        ['入职日期', header.hiredAt],
      ];
    }

    if (entityType === 'objects') {
      if (isCustomerObjectPortal) {
        return [
          ['对象类型', formatObjectType(header.type)],
          ['联系人', header.contact],
          ['联系电话', header.phone],
          ['所属组织', header.orgName],
          ['所属部门', header.deptName],
          ['地址', header.address],
          ['备注', header.remark],
        ];
      }

      return [
        ['对象类型', formatObjectType(header.type)],
        ['联系人', header.contact],
        ['联系电话', header.phone],
        ['所属组织', header.orgName],
        ['所属部门', header.deptName],
        ['负责人', header.ownerName],
        ['客户门户口径', customerPerspectiveLabel],
        ['地址', header.address],
        ['备注', header.remark],
      ];
    }

    return [
      ['物料号', header.code],
      ['规格尺寸', header.spec],
      ['产品线', header.productLine],
      ['物料类别', header.categoryCode],
      ['一级类别', header.categoryLevel1],
      ['二级类别', header.categoryLevel2],
      ['三级类别', header.categoryLevel3],
    ];
  };

  const workColumns = [
    {
      title: '工作事项',
      dataIndex: 'title',
      render: (value: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{value}</div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>{record.stage || '-'}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <Tag color={statusColorMap[value] || 'default'}>{statusLabelMap[value] || value || '-'}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      width: 140,
      render: (_: unknown, record: any) => renderPortalLink('users', record.ownerId, record.ownerName),
    },
    {
      title: '关联对象',
      dataIndex: 'objectName',
      width: 180,
      render: (_: unknown, record: any) => (record.objectName ? renderPortalLink('objects', record.objectId, record.objectName) : '-'),
    },
    {
      title: '关联产品',
      dataIndex: 'productName',
      width: 180,
      render: (_: unknown, record: any) => (record.productName ? renderPortalLink('products', record.productId, record.productName) : '-'),
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      width: 120,
    },
  ];

  const renderSummaryCards = () => (
    <Row gutter={[16, 16]}>
      {displaySummaryCards.map((card: any) => (
        <Col xs={24} sm={12} xl={6} key={card.key}>
          <Card size="small" styles={{ body: { padding: 20 } }}>
            <Statistic
              title={card.label}
              value={Number(card.value || 0)}
              formatter={value => formatStatValue(value, card.suffix)}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderWorkSection = () => (
    <Card
      title="关联工作"
      extra={(
        <Space wrap>
          <Tag>待办 {workSummary.todo || 0}</Tag>
          <Tag color="processing">进行中 {workSummary.inProgress || 0}</Tag>
          <Tag color="success">已完成 {workSummary.completed || 0}</Tag>
          <Tag color="error">取消 {workSummary.cancelled || 0}</Tag>
        </Space>
      )}
    >
      <Table
        dataSource={data?.workItems || []}
        rowKey={(record: any) => String(record.id || record.title)}
        columns={workColumns}
        pagination={false}
        size="small"
      />
    </Card>
  );

  const renderProductPortal = () => (
    <>
      <Card title="销售分布">
        <Table
          dataSource={data?.salesSummary || []}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.customerName}`)}
          pagination={false}
          size="small"
          columns={[
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: unknown, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '客户',
              dataIndex: 'customerName',
              render: (_: unknown, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            {
              title: '销售额',
              dataIndex: 'amount',
              width: 150,
              render: (value: unknown) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
            },
            {
              title: '成交次数',
              dataIndex: 'orderCount',
              width: 100,
            },
            {
              title: '最近成交',
              dataIndex: 'lastSoldAt',
              width: 120,
            },
          ]}
        />
      </Card>

      <Card title="绩效明细">
        <Table
          dataSource={data?.performanceItems || []}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.customerName}`)}
          pagination={false}
          size="small"
          columns={[
            { title: '日期', dataIndex: 'happenedAt', width: 120 },
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: unknown, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '客户',
              dataIndex: 'customerName',
              width: 180,
              render: (_: unknown, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            { title: '阶段', dataIndex: 'stage', width: 120 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: unknown) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderCustomerObjectPortal = () => (
    <>
      <Card title="绩效明细">
        <Table
          dataSource={performanceItemRows}
          rowKey={(record: any) => String(record.id || `${record.salespersonName}-${record.productName}`)}
          pagination={false}
          size="small"
          columns={[
            { title: '日期', dataIndex: 'achievedAt', width: 120 },
            {
              title: customerParticipantLabel,
              dataIndex: 'salespersonName',
              width: 140,
              render: (_: unknown, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '产品',
              dataIndex: 'productName',
              width: 180,
              render: (_: unknown, record: any) => renderPortalLink('products', record.productId, record.productName),
            },
            { title: '绩效项', dataIndex: 'achievementType', width: 100 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: unknown) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderWorkObjectPortal = () => (
    <>
      <Card title="工作摘要">
        <Table
          dataSource={data?.workOwnerSummary || []}
          rowKey={(record: any) => String(record.id || record.ownerName)}
          pagination={false}
          size="small"
          columns={[
            {
              title: '负责人',
              dataIndex: 'ownerName',
              render: (_: unknown, record: any) => renderPortalLink('users', record.ownerId, record.ownerName),
            },
            { title: '工作总数', dataIndex: 'totalCount', width: 100 },
            { title: '进行中', dataIndex: 'activeCount', width: 100 },
            { title: '已完成', dataIndex: 'completedCount', width: 100 },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderUserHeaderStrip = () => {
    const compactMeta = (isUserDetailRoute
      ? [
        activePortalOption?.label || header.positionName,
        header.orgName,
        header.empNo ? `工号 ${header.empNo}` : undefined,
        header.email,
        header.phone,
      ]
      : [
        activePortalOption?.label || header.positionName,
        header.orgName,
        header.empNo ? `工号 ${header.empNo}` : undefined,
      ]).filter(Boolean);

    return (
      <div className={`portal-user-strip${isUserDetailRoute ? '' : ' portal-user-strip--home'}`}>
        <div className="portal-user-strip__identity">
          <div className="portal-user-strip__eyebrow">{isUserDetailRoute ? '个人门户' : '工作台'}</div>
          <div className="portal-user-strip__heading">
            <div className="portal-user-strip__name">{header.name || '-'}</div>
            {isUserDetailRoute ? (
              <Space wrap size={[8, 8]} className="portal-user-strip__tags">
                <Tag color={roleColorMap[header.role] || 'default'}>{formatRoleLabel(header.role)}</Tag>
                {selectedPortalLabel ? <Tag color={selectedPortalTone}>{selectedPortalLabel}</Tag> : null}
              </Space>
            ) : (
              <div className="portal-user-strip__tags portal-user-strip__tags--home">
                <span className="portal-user-strip__tag portal-user-strip__tag--role">{formatRoleLabel(header.role)}</span>
                {selectedPortalLabel ? <span className="portal-user-strip__tag portal-user-strip__tag--portal">{selectedPortalLabel}</span> : null}
              </div>
            )}
          </div>
          {compactMeta.length ? (
            isUserDetailRoute ? (
              <div className="portal-user-strip__meta">
                {compactMeta.map(item => (
                  <span key={item} className="portal-user-strip__meta-item">{item}</span>
                ))}
              </div>
            ) : (
              <div className="portal-user-strip__meta-line">{compactMeta.join(' · ')}</div>
            )
          ) : null}
        </div>

        {showPortalSwitch ? (
          <div className="portal-user-strip__controls">
            <div className="portal-user-strip__switch-label">切换岗位</div>
            <Radio.Group
              className="portal-position-pill-group"
              value={portalSwitchValue}
              disabled={loading}
              onChange={event => handlePortalSwitchValue(event.target.value)}
            >
              {portalOptions.map(option => {
                const value = option.requestValue || option.key;
                const hint = buildHint([option.badge, option.portalLabel]);
                return (
                  <Radio.Button
                    key={option.key}
                    value={value}
                    className="portal-position-pill"
                  >
                    <span className="portal-position-pill__title">{option.label}</span>
                    {hint ? <span className="portal-position-pill__hint">{hint}</span> : null}
                  </Radio.Button>
                );
              })}
            </Radio.Group>
            {isPortalSwitchPending && pendingPortalOption ? (
              <div className="portal-user-strip__status">
                正在切换到 {pendingPortalOption.label}
                {pendingPortalOption.portalLabel ? ` · ${pendingPortalOption.portalLabel}` : ''}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderUserShortcutSection = (
    title: string,
    items: Array<{
      key: string;
      label: string;
      value: string;
      onClick: () => void;
      tone?: 'sales';
    }>,
  ) => {
    if (!items.length) {
      return null;
    }

    return (
      <section className="portal-shortcut-group">
        <div className="portal-shortcut-group__header">
          <div className="portal-shortcut-group__title">{title}</div>
        </div>
        <div className="portal-shortcut-grid">
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              className={`portal-shortcut-card${item.tone === 'sales' ? ' portal-shortcut-card--sales' : ''}`}
              onClick={item.onClick}
            >
              <div className="portal-shortcut-card__topline">
                <div className="portal-shortcut-card__label">{item.label}</div>
                <div className="portal-shortcut-card__jump">
                  <span>进入</span>
                  <ArrowRightOutlined />
                </div>
              </div>
              <div className="portal-shortcut-card__value">{item.value}</div>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const renderSalesActionRow = () => {
    if (data?.variant !== 'USER_SALES' || !salesActionCards.length) {
      return null;
    }

    return renderUserShortcutSection(
      '销售',
      salesActionCards.map((card: any) => ({
        key: String(card.key || card.label),
        label: card.label,
        value: formatMetricDisplay(card.value, card.suffix),
        onClick: () => handleSalesActionCard(card),
        tone: 'sales',
      })),
    );
  };

  const renderUserWorkflowStatusOverview = () => {
    const cardMap = new Map<WorkflowFilterKey, any>();
    workflowStatusCards.forEach((card: any) => {
      const key = normalizeWorkflowFilterKey(card.filterKey ?? card.key);
      if (workflowHomeStatusOrder.includes(key)) {
        cardMap.set(key, card);
      }
    });

    return renderUserShortcutSection(
      '工作流',
      workflowHomeStatusOrder.map(statusKey => {
        const card = cardMap.get(statusKey);
        return {
          key: `workflow-${statusKey}`,
          label: workflowFilterLabelMap[statusKey],
          value: formatMetricDisplay(card?.count ?? 0, '项'),
          onClick: () => navigateToUserPortalDetail('workflow', { status: statusKey }),
        };
      }),
    );
  };

  const renderUserPromptPanel = () => (
    <section className="portal-home__prompt">
      <div className="portal-home__prompt-panel">
        <div className="portal-home__prompt-eyebrow">AI 入口</div>
        <div className="portal-home__prompt-title">想查什么，直接输入</div>
        <div className="portal-home__prompt-box">
          <div className="portal-home__prompt-field">
            <div className="portal-home__prompt-icon" aria-hidden="true">
              <SearchOutlined />
            </div>
            <div className="portal-home__prompt-blank" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );

  const renderUserWorkflowDetail = () => (
    <Card
      className="portal-section-card"
      title="工作流明细"
      extra={(
        <Space wrap>
          {workflowStatusFilter !== 'ALL' ? <Tag color="blue">状态：{activeWorkflowStatusLabel}</Tag> : null}
          {workflowStageFilter !== 'ALL' ? <Tag color="gold">维度：{workflowStageFilter}</Tag> : null}
          {workflowStatusFilter !== 'ALL' || workflowStageFilter !== 'ALL' ? (
            <Button size="small" onClick={clearWorkflowFilters}>清空筛选</Button>
          ) : null}
        </Space>
      )}
    >
      <div className="portal-section-stack">
        <div className="portal-section-lead">
          状态卡与维度卡会直接筛选当前岗位关联的工作流明细。
        </div>

        <div className="portal-status-grid">
          <button
            type="button"
            className={`portal-status-card${workflowStatusFilter === 'ALL' ? ' portal-status-card--active' : ''}`}
            onClick={() => handleWorkflowStatusCard('ALL')}
          >
            <div className="portal-status-card__label">全部工作</div>
            <div className="portal-status-card__value">{formatMetricDisplay(userWorkItems.length, '项')}</div>
            <div className="portal-status-card__description">查看当前岗位全部工作流事项</div>
          </button>

          {workflowStatusCards.map((card: any) => {
            const cardFilter = normalizeWorkflowFilterKey(card.filterKey ?? card.key);
            return (
              <button
                key={String(card.key || card.label)}
                type="button"
                className={`portal-status-card${workflowStatusFilter === cardFilter ? ' portal-status-card--active' : ''}`}
                onClick={() => handleWorkflowStatusCard(cardFilter)}
              >
                <div className="portal-status-card__label">{card.label}</div>
                <div className="portal-status-card__value">{formatMetricDisplay(card.count, '项')}</div>
                <div className="portal-status-card__description">{card.description || '点击筛选明细'}</div>
              </button>
            );
          })}
        </div>

        {userWorkBuckets.length ? (
          <div className="portal-bucket-panel">
            <div className="portal-section-subtitle">工作维度分布</div>
            <div className="portal-bucket-grid">
              {userWorkBuckets.map((bucket: any) => {
                const filterValue = normalizeText(bucket.filterValue) || normalizeText(bucket.label) || 'ALL';
                const isActive = workflowStageFilter !== 'ALL' && workflowStageFilter === filterValue;
                return (
                  <button
                    key={String(bucket.id || bucket.label)}
                    type="button"
                    className={`portal-bucket-card${isActive ? ' portal-bucket-card--active' : ''}`}
                    onClick={() => handleWorkflowBucket(filterValue)}
                  >
                    <div className="portal-bucket-card__label">{bucket.label}</div>
                    <div className="portal-bucket-card__value">{formatMetricDisplay(bucket.count, '项')}</div>
                    <div className="portal-bucket-card__description">{bucket.description || '点击筛选该维度'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <Table
          dataSource={filteredUserWorkItems}
          rowKey={(record: any) => String(record.id || record.title)}
          columns={workColumns}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
        />
      </div>
    </Card>
  );

  const renderUserPerformanceDetail = () => (
    <>
      <Card className="portal-section-card" title="销售排名">
        <Table
          dataSource={salesRankingRows}
          rowKey={(record: any) => String(record.id || record.salespersonName)}
          pagination={false}
          size="small"
          scroll={{ x: 680 }}
          columns={[
            {
              title: '排名',
              dataIndex: 'rank',
              width: 80,
              render: (value: unknown, record: any) => (
                <Space size={6}>
                  <span style={{ fontWeight: 700 }}>{String(value ?? '-')}</span>
                  {record.currentUser ? <Tag color="blue">我</Tag> : null}
                </Space>
              ),
            },
            {
              title: '销售',
              dataIndex: 'salespersonName',
              width: 120,
              render: (_: unknown, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
            },
            {
              title: '销售额',
              dataIndex: 'salesAmount',
              width: 140,
              render: (value: unknown) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
            },
            {
              title: '达成率',
              dataIndex: 'completionRate',
              width: 100,
              render: (value: unknown) => `${value || 0}%`,
            },
            { title: '主推产品', dataIndex: 'focusProduct' },
          ]}
        />
      </Card>

      <Card className="portal-section-card" title="销售过程明细">
        <Table
          dataSource={performanceItemRows}
          rowKey={(record: any) => String(record.id || `${record.customerName}-${record.productName}`)}
          pagination={false}
          size="small"
          scroll={{ x: 980 }}
          columns={[
            { title: '日期', dataIndex: 'achievedAt', width: 120 },
            {
              title: '客户',
              dataIndex: 'customerName',
              width: 180,
              render: (_: unknown, record: any) => renderPortalLink('objects', record.customerId, record.customerName),
            },
            {
              title: '产品',
              dataIndex: 'productName',
              width: 180,
              render: (_: unknown, record: any) => renderPortalLink('products', record.productId, record.productName),
            },
            { title: '阶段', dataIndex: 'stage', width: 120 },
            {
              title: '金额',
              dataIndex: 'amount',
              width: 150,
              render: (value: unknown) => formatAmount(value),
            },
            { title: '说明', dataIndex: 'note' },
          ]}
        />
      </Card>
    </>
  );

  const renderUserCustomerDetail = () => (
    <Card className="portal-section-card" title="关联客户">
      <Table
        dataSource={customerPerformanceRows}
        rowKey={(record: any) => String(record.id || record.name)}
        pagination={false}
        size="small"
        scroll={{ x: 760 }}
        columns={[
          {
            title: '客户',
            dataIndex: 'name',
            render: (_: unknown, record: any) => renderPortalLink('objects', record.id, record.name),
          },
          {
            title: '绩效金额',
            dataIndex: 'amount',
            width: 150,
            render: (value: unknown) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
          },
          { title: '涉及产品', dataIndex: 'productCount', width: 100 },
          { title: '相关工作', dataIndex: 'workItemCount', width: 100 },
          { title: '最近跟进', dataIndex: 'lastActiveAt', width: 120 },
        ]}
      />
    </Card>
  );

  const renderUserProductDetail = () => (
    <Card className="portal-section-card" title="主推产品">
      <Table
        dataSource={relatedProductsRows}
        rowKey={(record: any) => String(record.id || record.name)}
        pagination={false}
        size="small"
        scroll={{ x: 680 }}
        columns={[
          {
            title: '产品',
            dataIndex: 'name',
            render: (_: unknown, record: any) => renderPortalLink('products', record.id, record.name),
          },
          { title: '编码', dataIndex: 'code', width: 180 },
          {
            title: '金额',
            dataIndex: 'amount',
            width: 150,
            render: (value: unknown) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
          },
        ]}
      />
    </Card>
  );

  const renderUserDetailIntro = () => {
    if (!userDetailSection) {
      return null;
    }

    const meta = userPortalDetailMetaMap[userDetailSection];
    return (
      <Card className="portal-detail-intro-card" styles={{ body: { padding: 20 } }}>
        <div className="portal-detail-intro">
          <div className="portal-detail-intro__eyebrow">Detail View</div>
          <div className="portal-detail-intro__title">{meta.title}</div>
          <div className="portal-detail-intro__description">{meta.description}</div>
        </div>
      </Card>
    );
  };

  const renderSalesOnlyDetailState = () => (
    <Card className="portal-section-card">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前岗位不是销售门户，暂无该详情内容。" />
    </Card>
  );

  const renderUserMainPortal = () => (
    <div className="portal-home">
      {renderUserPromptPanel()}
      <div className="portal-shortcut-stack">
        {renderSalesActionRow()}
        {renderUserWorkflowStatusOverview()}
      </div>
    </div>
  );

  const renderUserDetailPortal = () => {
    if (!userDetailSection) {
      return null;
    }

    if (userDetailSection === 'workflow') {
      return (
        <>
          {renderUserDetailIntro()}
          {renderUserWorkflowDetail()}
        </>
      );
    }

    if (data?.variant !== 'USER_SALES') {
      return (
        <>
          {renderUserDetailIntro()}
          {renderSalesOnlyDetailState()}
        </>
      );
    }

    if (userDetailSection === 'performance') {
      return (
        <>
          {renderUserDetailIntro()}
          {renderUserPerformanceDetail()}
        </>
      );
    }

    if (userDetailSection === 'customers') {
      return (
        <>
          {renderUserDetailIntro()}
          {renderUserCustomerDetail()}
        </>
      );
    }

    return (
      <>
        {renderUserDetailIntro()}
        {renderUserProductDetail()}
      </>
    );
  };

  const renderVariant = () => {
    if (!data) return null;
    if (data.variant === 'PRODUCT') return renderProductPortal();
    if (data.variant === 'OBJECT_CUSTOMER') return renderCustomerObjectPortal();
    return renderWorkObjectPortal();
  };

  const contextHint = useMemo(() => {
    const hints: string[] = [];

    if (activePortalOption) {
      const portalDetail = buildHint([activePortalOption.badge, activePortalOption.hint]);
      hints.push(portalDetail ? `岗位上下文：${portalDetail}` : `当前人员门户按“${activePortalOption.label}”岗位展示`);
    }

    if (isPortalSwitchPending && pendingPortalOption) {
      const pendingDetail = pendingPortalOption.portalLabel
        ? `${pendingPortalOption.label} · ${pendingPortalOption.portalLabel}`
        : pendingPortalOption.label;
      hints.push(`切换中：正在加载“${pendingDetail}”门户数据`);
    }

    if (entityType === 'users' && selectedPortalLabel) {
      hints.push(`当前门户类型：${selectedPortalLabel}`);
    }

    if (customerPerspectiveLabel) {
      hints.push(customerPerspectiveHint ? `客户门户口径：${customerPerspectiveLabel}，${customerPerspectiveHint}` : `客户门户口径：${customerPerspectiveLabel}`);
    }

    if (activeScopeOption) {
      hints.push(activeScopeOption.hint ? `统计口径：${activeScopeOption.label}汇总，${activeScopeOption.hint}` : `统计口径：${activeScopeOption.label}汇总`);
    }

    return hints.join('；');
  }, [activePortalOption, activeScopeOption, customerPerspectiveHint, customerPerspectiveLabel, entityType, isPortalSwitchPending, pendingPortalOption, selectedPortalLabel]);

  const renderContextPanel = () => {
    if (!showContextPanel) {
      return null;
    }

    return (
      <Card
        size="small"
        className="portal-context-card"
        styles={{ body: { padding: 16 } }}
      >
        <div className="portal-context-card__inner">
          <div className="portal-context-card__summary">
            <div className="portal-context-card__eyebrow">当前查看</div>
            <Space wrap size={[8, 8]}>
              {activePortalOption ? <Tag color="blue">岗位：{activePortalOption.label}</Tag> : null}
              {activePortalOption?.badge ? <Tag>{activePortalOption.badge}</Tag> : null}
              {entityType === 'users' && selectedPortalLabel ? <Tag color={selectedPortalTone}>门户：{selectedPortalLabel}</Tag> : null}
              {customerPerspectiveLabel ? <Tag color="cyan">客户口径：{customerPerspectiveLabel}</Tag> : null}
              {activeScopeOption ? <Tag color={activeScopeOption.tone || 'cyan'}>范围：{activeScopeOption.label}</Tag> : null}
            </Space>
            {contextHint ? <div className="portal-context-card__hint">{contextHint}</div> : null}
          </div>

          <div className="portal-context-card__controls">
            {showPortalSwitch ? (
              <div className="portal-switch">
                <span className="portal-switch__label">切换岗位门户</span>
                <Radio.Group
                  className="portal-position-radio-group"
                  value={portalSwitchValue}
                  disabled={loading}
                  onChange={event => handlePortalSwitchValue(event.target.value)}
                >
                  {portalOptions.map(option => {
                    const value = option.requestValue || option.key;
                    return (
                      <Radio.Button
                        key={option.key}
                        value={value}
                        className="portal-position-radio"
                      >
                        <span className="portal-position-radio__title">{option.label}</span>
                        {option.badge ? <span className="portal-position-radio__badge">{option.badge}</span> : null}
                        {option.hint ? <span className="portal-position-radio__hint">{option.hint}</span> : null}
                      </Radio.Button>
                    );
                  })}
                </Radio.Group>
                {isPortalSwitchPending && pendingPortalOption ? (
                  <div className="portal-switch__status">
                    正在切换到 {pendingPortalOption.label}
                    {pendingPortalOption.portalLabel ? ` · ${pendingPortalOption.portalLabel}` : ''}
                    ，当前页面会在刷新完成后再更新展示。
                  </div>
                ) : null}
              </div>
            ) : null}

            {showScopeSwitch ? (
              <div className="portal-switch portal-switch--scope">
                <span className="portal-switch__label">切换统计范围</span>
                <Segmented
                  className="portal-scope-segmented"
                  value={activeScopeOption?.requestValue ?? scopeOptions[0]?.requestValue}
                  onChange={value => handleScopeSwitch(value)}
                  options={scopeOptions.map(option => ({
                    label: option.label,
                    value: option.requestValue || option.key,
                  }))}
                />
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    );
  };

  const isInitialLoading = loading && !data;
  const isRefreshing = loading && !!data;
  const refreshingMessage = entityType === 'users'
    ? isPortalSwitchPending && pendingPortalOption
      ? `正在切换到 ${pendingPortalOption.label}${pendingPortalOption.portalLabel ? ` · ${pendingPortalOption.portalLabel}` : ''} 并刷新数据...`
      : '正在刷新人员门户数据...'
    : '正在刷新门户数据...';

  return (
    <Card
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body page-card-scroll">
        {isInitialLoading ? <Card loading /> : null}
        {!isInitialLoading && error ? <Alert type="error" showIcon message={error} /> : null}
        {!error && data ? (
          entityType === 'users' ? (
            <div className="portal-dashboard portal-dashboard--user">
              {isRefreshing ? <Alert type="info" showIcon message={refreshingMessage} /> : null}
              <div className={`portal-user-shell${isUserDetailRoute ? ' portal-user-shell--detail' : ' portal-user-shell--home'}`}>
                <div className="page-toolbar portal-user-toolbar" style={{ justifyContent: 'flex-start' }}>
                  <Space wrap>
                    <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                      返回
                    </Button>
                    {isUserDetailRoute ? (
                      <Button onClick={navigateToUserPortalHome}>
                        返回主门户
                      </Button>
                    ) : null}
                  </Space>
                </div>
                {renderUserHeaderStrip()}
                {isUserDetailRoute ? renderUserDetailPortal() : renderUserMainPortal()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isRefreshing ? <Alert type="info" showIcon message={refreshingMessage} /> : null}
              <div className="page-toolbar" style={{ justifyContent: 'flex-start' }}>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                  返回
                </Button>
              </div>

              {renderContextPanel()}

              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{header.name || '-'}</div>
                      <Space wrap style={{ marginTop: 8 }}>
                        {headerTags()}
                      </Space>
                    </div>
                  </div>

                  <Descriptions column={2} bordered size="small">
                    {descriptionItems().map(([label, value]) => (
                      <Descriptions.Item key={label} label={label}>
                        {value || '-'}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              </Card>

              {renderSummaryCards()}
              {renderVariant()}
            </div>
          )
        ) : null}
      </div>
    </Card>
  );
}
