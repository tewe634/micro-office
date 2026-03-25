import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Empty, List, Radio, Row, Segmented, Space, Statistic, Table, Tag } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { portalApi } from '../../api';
import type { PortalOptionItem, PortalPayload, PortalRequestParams, PortalSelection } from '../../api';
import { formatObjectType, formatRoleLabel } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

type PortalEntityType = 'users' | 'objects' | 'products';

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
  ACTIVE: 'processing',
  COMPLETED: 'success',
  ARCHIVED: 'default',
  CANCELLED: 'error',
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

const portalTypeLabelMap: Record<string, string> = {
  USER_SALES: '销售视图',
  PRODUCT: '销售视图',
  OBJECT_CUSTOMER: '销售视图',
  OBJECT_WORK: '工作视图',
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
  const candidateSet = new Set(candidates.filter(Boolean) as string[]);
  if (!candidateSet.size) {
    return null;
  }

  return (
    options.find(option => option.requestValue && candidateSet.has(option.requestValue))
    || options.find(option => candidateSet.has(option.key))
    || options.find(option => candidateSet.has(option.label))
    || null
  );
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

export default function PortalPage({ entityType }: { entityType: PortalEntityType }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const menus = useAuthStore(s => s.menus);
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingPortalValue, setPendingPortalValue] = useState<string>();

  const positionIdParam = searchParams.get('positionId') || undefined;
  const scopeParam = searchParams.get('scope') || undefined;

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
  const currentPortalVariant = normalizeText(data?.variant);
  const currentPortalLabel = formatPortalVariantLabel(currentPortalVariant);
  const currentPortalTone = portalVariantTone(currentPortalVariant);
  const customerPerspectiveLabel = normalizeText(data?.perspectiveLabel);
  const customerPerspectiveHint = normalizeText(data?.perspectiveHint);
  const isCustomerObjectPortal = entityType === 'objects' && header.type === 'CUSTOMER';
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
  const showContextPanel = hasPortalFeature || hasScopeFeature || !!customerPerspectiveLabel;

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

  const updateQueryParams = (updates: { positionId?: string; scope?: string }) => {
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

  const headerTags = () => {
    if (entityType === 'users') {
      return (
        <>
          <Tag color={roleColorMap[header.role] || 'default'}>{formatRoleLabel(header.role)}</Tag>
          {currentPortalLabel ? <Tag color={currentPortalTone}>{currentPortalLabel}</Tag> : null}
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
          {customerPerspectiveLabel ? <Tag color="cyan">{customerPerspectiveLabel}</Tag> : null}
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
        ['当前门户', currentPortalLabel],
        ['入职日期', header.hiredAt],
      ];
    }

    if (entityType === 'objects') {
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
      render: (value: string) => <Tag color={statusColorMap[value] || 'default'}>{value || '-'}</Tag>,
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
      {summaryCards.map((card: any) => (
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
          <Tag color="processing">进行中 {workSummary.active || 0}</Tag>
          <Tag color="success">已完成 {workSummary.completed || 0}</Tag>
          <Tag>归档 {workSummary.archived || 0}</Tag>
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
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title={`${customerParticipantLabel}绩效分布`} style={{ height: '100%' }}>
            <Table
              dataSource={data?.salesSummary || []}
              rowKey={(record: any) => String(record.id || record.salespersonName)}
              pagination={false}
              size="small"
              columns={[
                {
                  title: customerParticipantLabel,
                  dataIndex: 'salespersonName',
                  width: 140,
                  render: (_: unknown, record: any) => renderPortalLink('users', record.salespersonId, record.salespersonName),
                },
                {
                  title: '绩效金额',
                  dataIndex: 'amount',
                  width: 150,
                  render: (value: unknown) => <span style={{ fontWeight: 600 }}>{formatAmount(value)}</span>,
                },
                { title: '涉及产品', dataIndex: 'productCount', width: 100 },
                { title: '明细数', dataIndex: 'performanceItemCount', width: 90 },
                { title: '最近跟进', dataIndex: 'lastActiveAt', width: 120 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="相关产品" style={{ height: '100%' }}>
            <List
              size="small"
              dataSource={data?.relatedProducts || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              renderItem={(item: any) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div>{renderPortalLink('products', item.id, item.name)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {(item.code || '-')}{' · '}{formatAmount(item.amount)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="绩效明细">
        <Table
          dataSource={data?.performanceItems || []}
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

  const renderSalesUserPortal = () => (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title={`${header.positionName || '当前岗位'}客户绩效分布`} style={{ height: '100%' }}>
            <Table
              dataSource={data?.customerPerformance || []}
              rowKey={(record: any) => String(record.id || record.name)}
              pagination={false}
              size="small"
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
        </Col>
        <Col xs={24} xl={8}>
          <Card title="关联产品" style={{ height: '100%' }}>
            <List
              size="small"
              dataSource={data?.relatedProducts || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              renderItem={(item: any) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div>{renderPortalLink('products', item.id, item.name)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {(item.code || '-')}{' · '}{formatAmount(item.amount)}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title={`${header.positionName || '当前岗位'}绩效明细`}>
        <Table
          dataSource={data?.performanceItems || []}
          rowKey={(record: any) => String(record.id || `${record.customerName}-${record.productName}`)}
          pagination={false}
          size="small"
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

      {renderWorkSection()}
    </>
  );

  const renderWorkUserPortal = () => (
    <>
      <Card title={`${header.positionName || '当前岗位'}工作分布`}>
        <Table
          dataSource={data?.workBuckets || []}
          rowKey={(record: any) => String(record.id || record.label)}
          pagination={false}
          size="small"
          columns={[
            { title: '工作维度', dataIndex: 'label' },
            { title: '数量', dataIndex: 'count', width: 120 },
          ]}
        />
      </Card>

      {renderWorkSection()}
    </>
  );

  const renderVariant = () => {
    if (!data) return null;
    if (data.variant === 'PRODUCT') return renderProductPortal();
    if (data.variant === 'OBJECT_CUSTOMER') return renderCustomerObjectPortal();
    if (data.variant === 'OBJECT_WORK') return renderWorkObjectPortal();
    if (data.variant === 'USER_SALES') return renderSalesUserPortal();
    return renderWorkUserPortal();
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
        ) : null}
      </div>
    </Card>
  );
}
