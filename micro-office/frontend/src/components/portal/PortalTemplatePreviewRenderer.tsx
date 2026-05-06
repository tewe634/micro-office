import { Button, Card, Empty, Input, List, Space, Statistic, Typography } from 'antd';
import { MessageOutlined, SwapOutlined } from '@ant-design/icons';
import type { PortalTemplatePreviewPayload } from '../../api';

const { Paragraph, Text } = Typography;

type RawSection = Record<string, any>;
type RawBlock = Record<string, any>;

type SectionModel = {
  key: string;
  title: string;
  blocks: BlockModel[];
};

type BlockModel = {
  key: string;
  title: string;
  dataKey: string;
  displayType: string;
  actions: Array<Record<string, any>>;
};

type ModuleModel = {
  key: string;
  title: string;
  displayType: string;
  dataKey: string;
  actions: Array<Record<string, any>>;
};

type StatItem = {
  key: string;
  label: string;
  value: unknown;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return new Intl.NumberFormat('zh-CN').format(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map(formatValue).join('、') || '-';
  if (typeof value === 'object') {
    const data = asObject(value);
    if (asText(data.label)) return asText(data.label) || '-';
    if (asText(data.title)) return asText(data.title) || '-';
    if (asText(data.name)) return asText(data.name) || '-';
    if (asText(data.summary)) return asText(data.summary) || '-';
    return JSON.stringify(value);
  }
  return String(value);
}

function formatFieldLabel(rawKey: string): string {
  const key = String(rawKey || '').trim();
  if (!key) return '-';
  const aliasMap: Record<string, string> = {
    customer_name: '客户名称',
    company_name: '企业名称',
    owner_name: '负责人',
    customer_status: '客户状态',
    generatedAt: '生成时间',
    source: '来源',
    revenue: '营收',
    profit_margin: '利润率',
    cash_flow: '现金流',
    collections: '回款',
    revenue_per_capita: '人均营收',
  };
  if (aliasMap[key]) return aliasMap[key];
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return normalized || key;
}

function summarizeObject(value: Record<string, any>) {
  const preferred = [
    asText(value.summary),
    asText(value.title),
    asText(value.label),
    asText(value.name),
    asText(value.description),
    asText(value.content),
    asText(value.text),
    asText(value.message),
  ].filter(Boolean);
  if (preferred.length) return preferred[0] || '-';
  const parts = Object.entries(value)
    .filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
    .slice(0, 4)
    .map(([key, entry]) => `${formatFieldLabel(key)}：${formatValue(asObject(entry).value ?? entry)}`);
  return parts.join('；') || '-';
}

function normalizeActionList(raw: RawBlock) {
  const direct = asArray<Record<string, any>>(raw.actions);
  if (direct.length) return direct;
  const metaActions = asArray<Record<string, any>>(asObject(raw.meta).actions);
  return metaActions;
}

function normalizeBlock(raw: RawBlock): BlockModel {
  const meta = asObject(raw.meta);
  const key = asText(raw.key) || asText(raw.code) || asText(raw.item_key) || asText(raw.itemKey) || `block-${Math.random().toString(36).slice(2, 8)}`;
  const dataKey = asText(raw.data_key) || asText(raw.dataKey) || key;
  const displayType = (asText(raw.display_type) || asText(raw.displayType) || asText(meta.display_type) || 'CARD').toUpperCase();
  return {
    key,
    title: asText(raw.title) || asText(raw.label) || asText(raw.name) || key,
    dataKey,
    displayType,
    actions: normalizeActionList(raw),
  };
}

function normalizeSection(raw: RawSection): SectionModel {
  const rawBlocks = asArray<RawBlock>(raw.blocks).length ? asArray<RawBlock>(raw.blocks) : asArray<RawBlock>(raw.items);
  return {
    key: asText(raw.key) || asText(raw.code) || `section-${Math.random().toString(36).slice(2, 8)}`,
    title: asText(raw.title) || asText(raw.name) || asText(raw.label) || '分区',
    blocks: rawBlocks.map(normalizeBlock),
  };
}

function findBlockPayload(block: BlockModel, blocksData: Record<string, any>) {
  return blocksData[block.dataKey] ?? blocksData[block.key] ?? null;
}

function extractListItems(payload: unknown) {
  const data = asObject(payload);
  const items = asArray<Record<string, any>>(data.items);
  if (items.length) return items;
  return asArray<Record<string, any>>(payload);
}

function extractCardItems(payload: unknown) {
  const data = asObject(payload);
  const entries = asArray<Record<string, any>>(data.entries);
  if (entries.length) return entries;
  const blocks = asArray<Record<string, any>>(data.blocks);
  if (blocks.length) return blocks;
  if (Object.keys(data).length) return [data];
  return [];
}

function actionButton(items: Array<Record<string, any>>) {
  const hasSwitch = items.some(action => asText(action.actionType || action.action_type) === 'switch_subject');
  const hasSession = items.some(action => asText(action.actionType || action.action_type) === 'open_workbench_session');
  if (!hasSwitch && !hasSession) return null;
  return (
    <Space size={8}>
      {hasSwitch ? <Button size="small" className="portal-preview-action-btn" icon={<SwapOutlined />}>切换</Button> : null}
      {hasSession ? <Button size="small" className="portal-preview-action-btn" icon={<MessageOutlined />}>会话</Button> : null}
    </Space>
  );
}

function renderListBlock(block: BlockModel, payload: unknown) {
  const rows = extractListItems(payload);
  if (!rows.length) return null;
  return (
    <List
      split={false}
      dataSource={rows}
      renderItem={(row) => {
        const customerName = asText(row.customer_name) || asText(row.company_name) || asText(row.name) || asText(row.title) || '未命名';
        const ownerName = asText(row.owner_name) || asText(row.ownerName) || '-';
        const customerStatus = asText(row.customer_status) || asText(row.customerStatus);
        const subtitle = [ownerName, customerStatus].filter(Boolean).join(' · ');
        return (
          <List.Item style={{ padding: 0, marginBottom: 8 }}>
            <Card size="small" className="portal-preview-inner-card portal-preview-inner-card--list" style={{ width: '100%' }}>
              <div className="portal-preview-list-row">
                <div className="portal-preview-list-row__meta">
                  <div className="portal-preview-list-row__title">{customerName}</div>
                  <Text className="portal-preview-muted-text">{subtitle || '-'}</Text>
                </div>
                {actionButton(block.actions)}
              </div>
            </Card>
          </List.Item>
        );
      }}
    />
  );
}

function renderCardBlock(block: BlockModel, payload: unknown) {
  const rows = extractCardItems(payload);
  if (!rows.length) return null;
  if (rows.length === 1 && Object.keys(asObject(rows[0])).length > 1) {
    const data = asObject(rows[0]);
    return (
      <div className="portal-preview-kv-grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="portal-preview-kv-card">
            <Text className="portal-preview-muted-text">{formatFieldLabel(key)}</Text>
            <div className="portal-preview-kv-card__value">{formatValue(asObject(value).value ?? value)}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="portal-preview-card-list">
      {rows.map((row, index) => (
        <Card key={`${block.key}-${index}`} size="small" className="portal-preview-inner-card">
          <div className="portal-preview-kv-grid">
            {Object.entries(asObject(row)).map(([key, value]) => (
              <div key={key} className="portal-preview-kv-card">
                <Text className="portal-preview-muted-text">{formatFieldLabel(key)}</Text>
                <div className="portal-preview-kv-card__value">{formatValue(asObject(value).value ?? value)}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function extractStatItems(payload: unknown): StatItem[] {
  const rows = extractCardItems(payload);
  if (!rows.length) return [];
  const firstRow = asObject(rows[0]);

  const candidateList = [
    asArray<Record<string, any>>(firstRow.items),
    asArray<Record<string, any>>(firstRow.metrics),
    asArray<Record<string, any>>(firstRow.entries),
  ].find((list) => list.length > 0);

  if (candidateList) {
    return candidateList.map((entry, index) => {
      const record = asObject(entry);
      const key = asText(record.key) || asText(record.code) || asText(record.name) || `metric-${index}`;
      const label = asText(record.label) || asText(record.title) || formatFieldLabel(key);
      const value = record.value ?? record.metricValue ?? record.amount ?? record.count ?? record;
      return { key, label, value };
    });
  }

  return Object.entries(firstRow).map(([key, value]) => ({
    key,
    label: formatFieldLabel(key),
    value: asObject(value).value ?? value,
  }));
}

function renderStatBlock(payload: unknown) {
  const statItems = extractStatItems(payload);
  if (!statItems.length) return null;
  return (
    <div className="portal-preview-stat-list-scroll">
      <div className="portal-preview-stat-grid">
        {statItems.map((item) => (
          <Card key={item.key} size="small" className="portal-preview-inner-card portal-preview-inner-card--stat">
            <Statistic title={item.label} value={typeof item.value === 'number' ? item.value : undefined} formatter={() => formatValue(item.value)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function renderTextBlock(payload: unknown) {
  if (typeof payload === 'string') return <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{payload}</Paragraph>;
  if (Array.isArray(payload)) {
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {payload.map((entry, index) => (
          <Card key={`text-${index}`} size="small" className="portal-preview-inner-card portal-preview-inner-card--text">
            <Paragraph className="portal-preview-summary-text" style={{ marginBottom: 0 }}>
              {typeof entry === 'object' ? summarizeObject(asObject(entry)) : formatValue(entry)}
            </Paragraph>
          </Card>
        ))}
      </Space>
    );
  }
  if (typeof payload === 'object' && payload) {
    return (
      <Card size="small" className="portal-preview-inner-card portal-preview-inner-card--text">
        <Paragraph className="portal-preview-summary-text" style={{ marginBottom: 0 }}>
          {summarizeObject(asObject(payload))}
        </Paragraph>
      </Card>
    );
  }
  return <Paragraph className="portal-preview-summary-text" style={{ marginBottom: 0 }}>{formatValue(payload)}</Paragraph>;
}

function renderBlock(block: BlockModel, payload: unknown) {
  if (block.displayType === 'LIST') return renderListBlock(block, payload);
  if (block.displayType === 'STAT') return renderStatBlock(payload);
  if (block.displayType === 'TEXT') return renderTextBlock(payload);
  return renderCardBlock(block, payload);
}

function collectModules(sections: SectionModel[]): ModuleModel[] {
  const modules = sections.flatMap((section) => {
    if (!section.blocks.length) {
      return [{
        key: section.key,
        title: section.title,
        displayType: 'CARD',
        dataKey: section.key,
        actions: [],
      }];
    }
    return section.blocks.map((block) => ({
      key: block.key,
      title: block.title,
      displayType: block.displayType,
      dataKey: block.dataKey,
      actions: block.actions,
    }));
  });
  return modules;
}

function renderModule(module: ModuleModel, blocksData: Record<string, any>) {
  const payload = findBlockPayload(module, blocksData);
  const block: BlockModel = {
    key: module.key,
    title: module.title,
    dataKey: module.dataKey,
    displayType: module.displayType,
    actions: module.actions,
  };
  return (
    <Card key={module.key} size="small" className="portal-preview-module-card" title={module.title}>
      {payload !== null && payload !== undefined ? (
        renderBlock(block, payload)
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无展示数据" />
      )}
    </Card>
  );
}

export default function PortalTemplatePreviewRenderer({ preview }: { preview: PortalTemplatePreviewPayload | null }) {
  const wrapper = asObject(preview);
  const dataRoot = asObject((wrapper as any).data || wrapper);
  const template = asObject(dataRoot.template || preview?.template);
  const sectionsRaw = asArray<RawSection>(template.sections);
  const sections = sectionsRaw.map(normalizeSection);
  const blocksData = asObject(asObject(dataRoot.data || preview?.datasets).blocks || preview?.datasets);
  const modules = collectModules(sections);
  const globalSearch = asObject(asObject(template.meta).globalSearch);
  const globalSearchEnabled = globalSearch.enabled === true;
  const globalSearchPlaceholder = asText(globalSearch.placeholder) || '搜索全局相关内容';

  if (!modules.length) {
    return <Empty description="当前模板暂无可预览结构" />;
  }

  return (
    <div className="portal-preview-cockpit">
      <div className="portal-preview-cockpit__glow portal-preview-cockpit__glow--a" />
      <div className="portal-preview-cockpit__glow portal-preview-cockpit__glow--b" />
      <div className="portal-preview-cockpit__body">
        {globalSearchEnabled ? (
          <div className="portal-preview-search-shell">
            <Input.Search disabled enterButton="检索" placeholder={globalSearchPlaceholder} />
          </div>
        ) : null}
        <div className="portal-preview-module-grid">
          {modules.map(module => renderModule(module, blocksData))}
        </div>
      </div>
    </div>
  );
}
