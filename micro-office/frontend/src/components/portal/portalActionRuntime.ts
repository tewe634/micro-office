import type {
  PortalBlockTemplateActionFormFieldPayload,
  PortalBlockTemplateActionPayload,
  PortalRuntimeOpenWorkbenchSessionPayload,
  PortalRuntimeOpenWorkbenchSessionResult,
  PortalTemplatePreviewPayload,
} from '../../api';

export type PortalActionExecutionContext = {
  sourceRecord?: Record<string, any> | null;
  templatePreview?: PortalTemplatePreviewPayload | null;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function readPath(source: Record<string, any>, path: string) {
  return path
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce<unknown>((result, key) => {
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return undefined;
      }
      return (result as Record<string, any>)[key];
    }, source);
}

export function getActionType(action: PortalBlockTemplateActionPayload) {
  return asText(action.actionType)?.toLowerCase();
}

export function getEnabledPreActionFields(action: PortalBlockTemplateActionPayload): PortalBlockTemplateActionFormFieldPayload[] {
  return (action.preActionFields || [])
    .filter((field) => (field.status || 'ACTIVE') === 'ACTIVE')
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
}

export function requiresPreActionForm(action: PortalBlockTemplateActionPayload) {
  return action.requiresPreActionForm === true && getEnabledPreActionFields(action).length > 0;
}

export function resolveActionTargetId(action: PortalBlockTemplateActionPayload, sourceRecord?: Record<string, any> | null) {
  const source = asObject(sourceRecord);
  const path = asText(action.targetIdPath);
  if (path) {
    const value = readPath(source, path);
    return asText(value);
  }
  return asText(source.targetId) || asText(source.dailyEntryId) || asText(source.id);
}

export function buildOpenWorkbenchSessionPayload(
  action: PortalBlockTemplateActionPayload,
  context: PortalActionExecutionContext,
  formValues?: Record<string, any>,
): PortalRuntimeOpenWorkbenchSessionPayload {
  const preview = asObject(context.templatePreview);
  const portalContext = asObject(preview.portalContext);
  const sourceRecord = asObject(context.sourceRecord);
  const params = Object.entries(formValues || {}).reduce<Record<string, any>>((result, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return result;
    }
    result[key] = value;
    return result;
  }, {});

  const payload: PortalRuntimeOpenWorkbenchSessionPayload = {
    sessionType: asText(action.sessionType) || 'DAILY_ENTRY',
    targetId: resolveActionTargetId(action, sourceRecord),
    context: {
      entityType: asText(preview.entityType),
      entityId: asText(preview.entityId),
      positionId: asText(portalContext.positionId),
      scope: asText(portalContext.scope),
    },
  };

  if (payload.sessionType === 'DAILY_ENTRY' && payload.targetId) {
    payload.dailyEntryId = payload.targetId;
  }
  if (Object.keys(params).length) {
    payload.params = params;
  }
  return payload;
}

export function consumeWorkbenchSessionResult(result: PortalRuntimeOpenWorkbenchSessionResult) {
  const redirectUrl = asText(result.redirectUrl) || asText((result as any).url);
  if (redirectUrl) {
    window.location.assign(redirectUrl);
    return true;
  }
  return false;
}
