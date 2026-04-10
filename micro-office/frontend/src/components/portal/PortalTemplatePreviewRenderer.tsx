import { Card, Descriptions, Empty, List, Space, Statistic, Tag, Typography } from 'antd';
import type { PortalTemplatePreviewPayload } from '../../api';

const { Paragraph, Text, Title } = Typography;

type PortalTemplateSection = Record<string, any>;
type PortalTemplateItem = Record<string, any>;

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
}

function formatLabel(value: string | undefined) {
  if (!value) {
    return '字段';
  }
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, letter => letter.toUpperCase());
}

function formatValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    if (unit === '%' || unit === '％') {
      return `${value}%`;
    }
    if (unit?.includes('¥') || unit?.includes('元')) {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        maximumFractionDigits: 0,
      }).format(value);
    }
    return `${new Intl.NumberFormat('zh-CN').format(value)}${unit || ''}`;
  }
  if (Array.isArray(value)) {
    return value.map(item => formatValue(item)).join('、') || '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return unit ? `${String(value)}${unit}` : String(value);
}

function resolveGridSpan(meta: Record<string, any>, fallback: number) {
  const span = Number(asObject(meta.layout).span ?? fallback);
  if (!Number.isFinite(span)) {
    return fallback;
  }
  return Math.max(1, Math.min(24, span));
}

function renderStat(dataset: unknown, itemMeta: Record<string, any>) {
  const data = asObject(dataset);
  const keys = asArray<any>(itemMeta.keys).map(entry => typeof entry === 'string' ? { key: entry } : asObject(entry));
  const fields = asArray<any>(itemMeta.fields).map(entry => typeof entry === 'string' ? { key: entry } : asObject(entry));
  const candidates = keys.length ? keys : fields;

  const statItems = candidates.length
    ? candidates.map((entry, index) => {
      const key = asText(entry.key) || asText(entry.dataKey) || asText(entry.name) || `stat-${index}`;
      const source = asObject(data[key]);
      const value = source.value ?? data[key];
      return {
        key,
        label: asText(entry.label) || asText(source.label) || formatLabel(key),
        value,
        unit: asText(entry.unit) || asText(source.unit),
        trend: asText(source.trend),
        delta: source.delta,
      };
    })
    : Object.entries(data).map(([key, raw]) => {
      const source = asObject(raw);
      return {
        key,
        label: asText(source.label) || formatLabel(key),
        value: source.value ?? raw,
        unit: asText(source.unit),
        trend: asText(source.trend),
        delta: source.delta,
      };
    });

  if (!statItems.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无统计数据" />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      {statItems.map(stat => (
        <Card key={stat.key} size="small" style={{ borderRadius: 14 }}>
          <Statistic title={stat.label} value={typeof stat.value === 'number' ? stat.value : undefined} formatter={() => formatValue(stat.value, stat.unit)} />
          {(stat.trend || stat.delta !== undefined) ? (
            <Space size={8} wrap style={{ marginTop: 8 }}>
              {stat.trend ? <Tag color={stat.trend === 'down' ? 'error' : 'success'}>{stat.trend === 'down' ? '下降' : '上升'}</Tag> : null}
              {stat.delta !== undefined ? <Text type="secondary">变化 {formatValue(stat.delta, stat.unit === '%' ? '%' : undefined)}</Text> : null}
            </Space>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function resolveListFields(rows: Record<string, any>[], itemMeta: Record<string, any>) {
  const config = asArray<any>(itemMeta.fields);
  if (config.length) {
    return config.map((entry, index) => {
      if (typeof entry === 'string') {
        return { key: entry, label: formatLabel(entry), title: index === 0 };
      }
      const record = asObject(entry);
      const key = asText(record.key) || asText(record.dataKey) || `field-${index}`;
      return {
        key,
        label: asText(record.label) || formatLabel(key),
        title: record.title === true || index === 0,
      };
    });
  }

  const first = rows[0] || {};
  return Object.keys(first).slice(0, 5).map((key, index) => ({ key, label: formatLabel(key), title: index === 0 }));
}

function renderList(dataset: unknown, itemMeta: Record<string, any>) {
  const rows = asArray<Record<string, any>>(dataset).map(asObject);
  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无列表数据" />;
  }
  const fields = resolveListFields(rows, itemMeta);

  return (
    <List
      dataSource={rows}
      split={false}
      renderItem={(row, index) => {
        const titleField = fields.find(field => field.title) || fields[0];
        const titleValue = titleField ? formatValue(row[titleField.key]) : `记录 ${index + 1}`;
        const extraFields = fields.filter(field => field.key !== titleField?.key && row[field.key] !== undefined && row[field.key] !== null && row[field.key] !== '');
        return (
          <List.Item style={{ padding: 0, marginBottom: 10 }}>
            <Card size="small" style={{ width: '100%', borderRadius: 14 }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Title level={5} style={{ margin: 0 }}>{titleValue}</Title>
                {extraFields.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {extraFields.map(field => (
                      <div key={field.key}>
                        <Text type="secondary">{field.label}</Text>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{formatValue(row[field.key])}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Space>
            </Card>
          </List.Item>
        );
      }}
    />
  );
}

function renderText(dataset: unknown) {
  if (typeof dataset === 'string') {
    return <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{dataset}</Paragraph>;
  }

  if (Array.isArray(dataset)) {
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {dataset.map((item, index) => (
          <Card key={`text-${index}`} size="small" style={{ borderRadius: 14 }}>
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{formatValue(item)}</Paragraph>
          </Card>
        ))}
      </Space>
    );
  }

  const data = asObject(dataset);
  const summary = asText(data.summary);
  const highlights = asArray(data.highlights);

  if (!summary && !highlights.length && !Object.keys(data).length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文本数据" />;
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {summary ? <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{summary}</Paragraph> : null}
      {highlights.length ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {highlights.map((item, index) => (
            <Card key={`highlight-${index}`} size="small" style={{ borderRadius: 14 }}>
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{formatValue(item)}</Paragraph>
            </Card>
          ))}
        </Space>
      ) : null}
      {!summary && !highlights.length ? (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{JSON.stringify(data, null, 2)}</pre>
      ) : null}
    </Space>
  );
}

function resolveCardFields(data: Record<string, any>, itemMeta: Record<string, any>) {
  const config = asArray<any>(itemMeta.fields);
  if (config.length) {
    return config.map((entry, index) => {
      if (typeof entry === 'string') {
        return { key: entry, label: formatLabel(entry) };
      }
      const record = asObject(entry);
      const key = asText(record.key) || asText(record.dataKey) || `field-${index}`;
      return { key, label: asText(record.label) || formatLabel(key) };
    });
  }
  return Object.keys(data).slice(0, 8).map(key => ({ key, label: formatLabel(key) }));
}

function renderCard(dataset: unknown, itemMeta: Record<string, any>) {
  if (Array.isArray(dataset)) {
    return renderList(dataset, itemMeta);
  }

  const data = asObject(dataset);
  const fields = resolveCardFields(data, itemMeta);
  const entries = fields.filter(field => data[field.key] !== undefined && data[field.key] !== null && data[field.key] !== '');
  if (!entries.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无卡片数据" />;
  }

  return (
    <Descriptions size="small" column={1} bordered>
      {entries.map(field => (
        <Descriptions.Item key={field.key} label={field.label}>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{formatValue(data[field.key])}</div>
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function renderItemContent(item: PortalTemplateItem, datasets: Record<string, any>) {
  const itemMeta = asObject(item.meta);
  const dataset = datasets[item.dataKey] ?? datasets[item.itemKey];
  const displayType = asText(item.displayType)?.toUpperCase();

  switch (displayType) {
    case 'STAT':
      return renderStat(dataset, itemMeta);
    case 'LIST':
      return renderList(dataset, itemMeta);
    case 'TEXT':
      return renderText(dataset);
    case 'CARD':
    default:
      return renderCard(dataset, itemMeta);
  }
}

function renderSectionItem(item: PortalTemplateItem, datasets: Record<string, any>) {
  const itemMeta = asObject(item.meta);
  const span = resolveGridSpan(itemMeta, 24);
  return (
    <div key={item.id || item.itemKey} style={{ gridColumn: `span ${span}` }}>
      <Card
        size="small"
        title={item.label || item.itemKey || '展示项'}
        style={{ height: '100%', borderRadius: 16 }}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <Text type="secondary">dataKey：{item.dataKey || '-'}</Text>
        {renderItemContent(item, datasets)}
      </Card>
    </div>
  );
}

function renderSection(section: PortalTemplateSection, datasets: Record<string, any>) {
  const sectionMeta = asObject(section.meta);
  const items = asArray<PortalTemplateItem>(section.items).slice().sort((left, right) => Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0));
  const itemColumns = Number(asObject(sectionMeta.layout).columns || 24);
  const gridColumns = Math.max(1, Math.min(24, itemColumns));

  return (
    <div
      key={section.id || section.code}
      style={{ gridColumn: `span ${resolveGridSpan(sectionMeta, 24)}` }}
    >
      <Card
        title={section.name || section.code || '分区'}
        extra={section.code ? <Tag>{section.code}</Tag> : null}
        style={{ height: '100%', borderRadius: 18 }}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {sectionMeta.description ? <Text type="secondary">{sectionMeta.description}</Text> : null}
        {items.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gap: 12 }}>
            {items.map(item => renderSectionItem(item, datasets))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前分区暂无展示项" />
        )}
      </Card>
    </div>
  );
}

export default function PortalTemplatePreviewRenderer({ preview }: { preview: PortalTemplatePreviewPayload | null }) {
  const template = asObject(preview?.template);
  const datasets = asObject(preview?.datasets);
  const sections = asArray<PortalTemplateSection>(template.sections).slice().sort((left, right) => Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0));

  if (!preview || !sections.length) {
    return <Empty description="当前模板暂无可预览结构" />;
  }

  const topSections = sections.filter(section => asText(asObject(asObject(section.meta).layout).region) === 'top');
  const mainSections = sections.filter(section => asText(asObject(asObject(section.meta).layout).region) !== 'top');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {topSections.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 16 }}>
          {topSections.map(section => renderSection(section, datasets))}
        </div>
      ) : null}
      {mainSections.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
          {mainSections.map(section => renderSection(section, datasets))}
        </div>
      ) : null}
    </Space>
  );
}
