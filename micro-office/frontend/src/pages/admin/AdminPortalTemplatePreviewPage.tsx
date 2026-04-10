import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { portalTemplateAdminApi } from '../../api';
import type { PortalTemplatePreviewPayload } from '../../api';
import PortalTemplatePreviewRenderer from '../../components/portal/PortalTemplatePreviewRenderer';

const { Text } = Typography;

function asText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

export default function AdminPortalTemplatePreviewPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PortalTemplatePreviewPayload | null>(null);

  const loadPreview = async (templateId: string) => {
    setLoading(true);
    try {
      const resp: any = await portalTemplateAdminApi.previewTemplate(templateId);
      setPreview((resp?.data || null) as PortalTemplatePreviewPayload | null);
    } catch (error: any) {
      message.error(error?.response?.data?.message || '预览加载失败');
      nav(templateId ? `/admin/portal-templates/${templateId}` : '/admin/portal-templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      void loadPreview(id);
    }
  }, [id]);

  const template = asRecord(preview?.template);
  const portalContext = asRecord(preview?.portalContext);
  const previewUser = asRecord(preview?.previewUser);
  const sections = Array.isArray(template.sections) ? template.sections : [];
  const datasets = asRecord(preview?.datasets);
  const datasetKeys = Object.keys(datasets);
  const errors = Array.isArray(preview?.errors) ? preview.errors : [];

  const contextTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; color?: string }> = [];
    const scope = asText(portalContext.scope);
    const roleKey = asText(portalContext.roleKey);
    const positionName = asText(portalContext.previewPositionName) || asText(portalContext.positionName);
    if (scope) tags.push({ key: `scope-${scope}`, label: `范围：${scope}`, color: 'blue' });
    if (roleKey) tags.push({ key: `role-${roleKey}`, label: `角色：${roleKey}`, color: 'purple' });
    if (positionName) tags.push({ key: `position-${positionName}`, label: `岗位：${positionName}`, color: 'cyan' });
    if (portalContext.previewMode === true) tags.push({ key: 'preview-mode', label: '预览模式', color: 'gold' });
    return tags;
  }, [portalContext]);

  return (
    <div className="page-fill" style={{ gap: 16, overflow: 'hidden' }}>
      <Card
        className="page-card"
        style={{ flex: 1, minHeight: 0 }}
        title={preview?.templateName ? `门户预览：${preview.templateName}` : '门户预览'}
        extra={(
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav(id ? `/admin/portal-templates/${id}` : '/admin/portal-templates')}>
              返回编辑页
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => id && void loadPreview(id)}>
              重新加载
            </Button>
          </Space>
        )}
        bodyStyle={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {loading ? (
          <div className="page-fill" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" />
          </div>
        ) : !preview ? (
          <div className="page-fill" style={{ justifyContent: 'center' }}>
            <Empty description="当前模板暂无可预览数据" />
          </div>
        ) : (
          <div className="page-card-scroll" style={{ paddingRight: 4 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" style={{ borderRadius: 16 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Descriptions size="small" column={3} bordered>
                    <Descriptions.Item label="模板名称">{asText(preview.templateName) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="模板编码">{asText(preview.templateCode) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="模板版本">{asText(preview.templateVersion) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="预览用户">{asText(previewUser.userName) || asText(previewUser.name) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="预览岗位">{asText(previewUser.positionName) || asText(portalContext.previewPositionName) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="匹配方式">{asText(previewUser.matchedBy) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="分区数量">{sections.length}</Descriptions.Item>
                    <Descriptions.Item label="数据集数量">{datasetKeys.length}</Descriptions.Item>
                    <Descriptions.Item label="实体">{asText(preview.entityType) || '-'} / {asText(preview.entityId) || '-'}</Descriptions.Item>
                  </Descriptions>

                  {contextTags.length ? (
                    <Space wrap>
                      {contextTags.map(tag => (
                        <Tag key={tag.key} color={tag.color}>{tag.label}</Tag>
                      ))}
                    </Space>
                  ) : null}

                  {datasetKeys.length ? (
                    <div>
                      <Text type="secondary">已加载数据集</Text>
                      <div style={{ marginTop: 8 }}>
                        <Space wrap>
                          {datasetKeys.map(key => <Tag key={key}>{key}</Tag>)}
                        </Space>
                      </div>
                    </div>
                  ) : null}
                </Space>
              </Card>

              {errors.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message="预览返回了错误信息"
                  description={(
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(errors, null, 2)}</pre>
                  )}
                />
              ) : null}

              <PortalTemplatePreviewRenderer preview={preview} />
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
