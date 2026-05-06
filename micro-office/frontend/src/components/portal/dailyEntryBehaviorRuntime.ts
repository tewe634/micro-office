import type {
  DailyEntryBehaviorPayload,
  PortalBlockTemplateActionFormFieldPayload,
  PortalRuntimeOpenWorkbenchSessionPayload,
  PortalRuntimeOpenWorkbenchSessionResult,
} from '../../api';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function normalizeDailyEntryBehavior(raw: any): DailyEntryBehaviorPayload | null {
  const behavior = raw?.behaviorConfig || raw?.behavior_config || null;
  if (!behavior || typeof behavior !== 'object') {
    return null;
  }

  const fields = Array.isArray(behavior.preActionFields)
    ? behavior.preActionFields
    : Array.isArray(behavior.pre_action_fields)
      ? behavior.pre_action_fields
      : [];

  return {
    actionId: asText(behavior.actionId || behavior.action_id),
    enabled: behavior.enabled !== false,
    actionType: asText(behavior.actionType || behavior.action_type) || 'OPEN_WORKBENCH_SESSION',
    sessionType: asText(behavior.sessionType || behavior.session_type) || 'DAILY_ENTRY',
    requiresPreActionForm: behavior.requiresPreActionForm === true || behavior.requires_pre_action_form === true,
    preActionFormTitle: asText(behavior.preActionFormTitle || behavior.pre_action_form_title) || null,
    preActionFormSubmitLabel: asText(behavior.preActionFormSubmitLabel || behavior.pre_action_form_submit_label) || null,
    preActionFields: fields.map((field: any, index: number): PortalBlockTemplateActionFormFieldPayload => ({
      id: asText(field.id),
      fieldKey: asText(field.fieldKey || field.field_key) || `field-${index}`,
      label: asText(field.label) || `字段${index + 1}`,
      inputType: asText(field.inputType || field.input_type) || 'TEXT',
      required: field.required === true,
      placeholder: asText(field.placeholder) || null,
      defaultValue: asText(field.defaultValue || field.default_value) || null,
      maxLength: typeof field.maxLength === 'number' ? field.maxLength : typeof field.max_length === 'number' ? field.max_length : null,
      sortOrder: typeof field.sortOrder === 'number' ? field.sortOrder : typeof field.sort_order === 'number' ? field.sort_order : index,
      status: (asText(field.status) || 'ACTIVE') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      meta: asObject(field.meta),
    })),
    meta: asObject(behavior.meta),
  };
}

export function getEnabledDailyEntryBehaviorFields(behavior: DailyEntryBehaviorPayload | null) {
  return (behavior?.preActionFields || [])
    .filter((field) => (field.status || 'ACTIVE') === 'ACTIVE')
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
}

export function requiresDailyEntryPreActionForm(behavior: DailyEntryBehaviorPayload | null) {
  return behavior?.enabled === true
    && behavior.actionType === 'OPEN_WORKBENCH_SESSION'
    && behavior.requiresPreActionForm === true
    && getEnabledDailyEntryBehaviorFields(behavior).length > 0;
}

export function buildDailyEntryOpenSessionPayload(
  entry: Record<string, any>,
  behavior: DailyEntryBehaviorPayload,
  runtimeContext?: Record<string, any>,
  formValues?: Record<string, any>,
): PortalRuntimeOpenWorkbenchSessionPayload {
  const params = Object.entries(formValues || {}).reduce<Record<string, any>>((result, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return result;
    }
    result[key] = value;
    return result;
  }, {});

  return {
    sessionType: asText(behavior.sessionType) || 'DAILY_ENTRY',
    targetId: asText(entry.id) || asText(entry.dailyEntryId),
    dailyEntryId: asText(entry.id) || asText(entry.dailyEntryId),
    actionId: behavior.actionId,
    actionParams: Object.keys(params).length ? params : undefined,
    formData: Object.keys(params).length ? params : undefined,
    params: Object.keys(params).length ? params : undefined,
    context: runtimeContext || {},
  };
}

export function consumeDailyEntrySessionResult(result: PortalRuntimeOpenWorkbenchSessionResult) {
  const redirectUrl = asText(result.redirectUrl) || asText((result as any).url);
  if (redirectUrl) {
    window.location.assign(redirectUrl);
    return true;
  }
  return false;
}
