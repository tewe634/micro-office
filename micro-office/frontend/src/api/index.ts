import api from './client';

export type PortalScopeKey = 'personal' | 'department' | 'business' | 'system' | (string & {});

export type PortalSelectableValue = string | number | null | undefined;

export interface PortalOptionItem {
  key?: PortalSelectableValue;
  value?: PortalSelectableValue;
  id?: PortalSelectableValue;
  label?: string;
  name?: string;
  title?: string;
  positionId?: PortalSelectableValue;
  positionName?: string;
  portalType?: string;
  role?: string;
  roleName?: string;
  orgName?: string;
  deptName?: string;
  code?: string;
  scope?: PortalScopeKey;
  description?: string;
  primary?: boolean;
  isPrimary?: boolean;
  [key: string]: any;
}

export type PortalSelection = PortalOptionItem | PortalSelectableValue;

export interface PortalRequestParams {
  positionId?: string | number;
  scope?: PortalScopeKey;
}

export interface PortalPayload {
  header?: Record<string, any>;
  summaryCards?: Array<Record<string, any>>;
  workSummary?: Record<string, any>;
  portalOptions?: PortalOptionItem[];
  activePortal?: PortalSelection;
  allPositions?: PortalOptionItem[];
  scopeOptions?: PortalOptionItem[];
  activeScope?: PortalSelection;
  variant?: string;
  [key: string]: any;
}

export interface PortalTemplatePreviewPayload {
  templateId?: string;
  templateCode?: string;
  templateName?: string;
  templateVersion?: string;
  entityType?: string;
  entityId?: string;
  portalContext?: Record<string, any>;
  template?: Record<string, any>;
  datasets?: Record<string, any>;
  previewUser?: Record<string, any>;
  errors?: any[];
  [key: string]: any;
}

export interface PortalTemplatePreviewParams {
  entityType?: string;
  entityId?: string;
}

export type PortalBlockTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface PortalBlockTemplateActionPayload {
  id?: string;
  actionType: string;
  targetSubjectType?: string | null;
  targetIdPath?: string | null;
  sessionType?: string | null;
  meta?: Record<string, any>;
}

export interface PortalBlockTemplatePayload {
  code: string;
  name: string;
  status: PortalBlockTemplateStatus;
  displayType: string;
  dataKey: string;
  label: string;
  meta?: Record<string, any>;
  actions?: PortalBlockTemplateActionPayload[];
}

export type DailyEntryStatus = 'ACTIVE' | 'INACTIVE';
export type DailyEntryTargetType = 'ORG' | 'USER';
export type DailyEntrySessionResolveStrategy = 'BY_ENTRY_ONLY' | 'BY_ENTRY_AND_USER';
export type DailyEntryBindingScope = 'SHARED' | 'PERSONAL';
export type UserExternalAccountProvider = 'DINGTALK';
export type UserExternalAccountStatus = 'ACTIVE' | 'UNBOUND';

export interface DailyEntryPayload {
  code: string;
  name: string;
  sortOrder?: number;
  status: DailyEntryStatus;
  meta?: Record<string, any>;
}

export interface DailyEntryTargetPayload {
  id?: string;
  targetType: DailyEntryTargetType;
  targetId: string;
  status: DailyEntryStatus;
  sortOrder?: number;
}

export interface DailyEntryChatPolicyPayload {
  dailyEntryId?: string;
  entryCode?: string;
  entryName?: string;
  sessionResolveStrategy: DailyEntrySessionResolveStrategy;
  providerKey?: string;
  status: DailyEntryStatus;
  meta?: Record<string, any>;
}

export interface DailyEntrySessionBindingPayload {
  id?: string;
  dailyEntryId?: string;
  userId?: string | null;
  sessionId: string;
  bindingScope: DailyEntryBindingScope;
  status: DailyEntryStatus;
  meta?: Record<string, any>;
}

export interface UserExternalAccountBindingPayload {
  id?: string;
  userId: string;
  provider: UserExternalAccountProvider;
  corpId: string;
  externalUserId: string;
  status: UserExternalAccountStatus;
  boundAt?: string | null;
  meta?: Record<string, any>;
  version?: number;
}

export type WorkflowTemplateStatus = 'ACTIVE' | 'DISABLED';

export interface WorkflowTemplatePositionOption {
  id: string;
  name: string;
  code?: string;
}

export interface WorkflowTemplatePackageSummary {
  id: string;
  code: string;
  name: string;
  applicableSubjectType?: string | null;
  positionId?: string | null;
  positionIds?: string[];
  positionName?: string | null;
  positionNames?: string[];
  description?: string | null;
  status: WorkflowTemplateStatus;
  sortOrder?: number;
  allowCreateAsNormal?: boolean;
  allowCreateAsSubflow?: boolean;
  meta?: Record<string, any>;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTemplatePackageNodePayload {
  id: string;
  templateId?: string;
  moduleDefinitionId?: string | null;
  moduleDefinitionCode?: string | null;
  moduleDefinitionName?: string | null;
  moduleDefinitionStatus?: WorkflowTemplateStatus | null;
  capabilityBound?: boolean;
  version?: number;
  name: string;
  code: string;
  nodeType: string;
  sequence: number;
  isMainPath: boolean;
  allowAppendNextNode: boolean;
  allowDeriveSubflow: boolean;
  inputFields: WorkflowTemplateNodeFieldConfigPayload[];
  outputFields: WorkflowTemplateNodeFieldConfigPayload[];
  recommendedTemplates: WorkflowTemplateNodeRecommendationPayload[];
}

export interface WorkflowTemplateNodeFieldConfigPayload {
  fieldKey: string;
  label?: string | null;
  dataType?: string | null;
  sortOrder?: number;
  description?: string | null;
  fieldScope?: 'INPUT' | 'OUTPUT' | string;
  capabilityDerived?: boolean;
  displayName?: string | null;
  displayOrder: number;
  required: boolean;
  readOnly?: boolean;
  allowWriteBackParent?: boolean;
}

export interface WorkflowTemplateNodeRecommendationPayload {
  recommendedWorkflowTemplateId: string;
  recommendedWorkflowTemplateName?: string | null;
  recommendedWorkflowTemplateStatus?: WorkflowTemplateStatus | null;
  reason?: string | null;
  displayOrder: number;
  enabled: boolean;
}

export interface WorkflowTemplateFieldDefinition {
  id: string;
  fieldKey: string;
  name: string;
  fieldType: string;
  description?: string | null;
  enabled: boolean;
  sensitive: boolean;
  groupKey?: string | null;
  displayOrder: number;
  meta?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkflowTemplateInputMappingTargetType = 'NODE_INPUT' | 'SUBFLOW_INPUT';

export interface WorkflowTemplateInputMapping {
  id?: string;
  packageId?: string;
  targetType: WorkflowTemplateInputMappingTargetType;
  targetRef: string;
  targetPath: string;
  sourcePath: string;
  sortOrder?: number;
  status?: WorkflowTemplateStatus;
  meta?: Record<string, any>;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTemplateInputMappingOptionNode {
  fieldKey?: string;
  label?: string;
  path: string;
  labelPath?: string;
  fieldType?: string;
  fieldDomain?: string;
  children?: WorkflowTemplateInputMappingOptionNode[];
}

export interface WorkflowTemplateInputMappingFieldTree {
  treeType?: string;
  nodes: WorkflowTemplateInputMappingOptionNode[];
}

export interface WorkflowTemplateInputMappingNodeOption {
  nodeId: string;
  nodeName?: string;
  nodeCode?: string;
  nodeType?: string;
  currentNodeInputFieldTree?: WorkflowTemplateInputMappingFieldTree;
  currentNodeInputOutputFieldTree?: WorkflowTemplateInputMappingFieldTree;
  subflowInputFieldTrees?: Array<{
    templateId: string;
    templateName?: string;
    templateCode?: string;
    fieldTree?: WorkflowTemplateInputMappingFieldTree;
  }>;
}

export interface WorkflowTemplateInputMappingOptionsResponse {
  templateId: string;
  nodeGraph?: string[][];
  workflowContextFieldTree?: WorkflowTemplateInputMappingFieldTree;
  nodeOptions?: WorkflowTemplateInputMappingNodeOption[];
}

export interface WorkflowNodeDesignSummary {
  id: string;
  moduleDefinitionId?: string | null;
  name: string;
  code: string;
  nodeType: string;
  status: WorkflowTemplateStatus;
  inputFields?: WorkflowTemplateNodeFieldConfigPayload[];
  outputFields?: WorkflowTemplateNodeFieldConfigPayload[];
  recommendedTemplates?: WorkflowTemplateNodeRecommendationPayload[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowNodeFieldSavePayload {
  id?: string;
  fieldScope?: 'INPUT' | 'OUTPUT' | string;
  fieldKey: string;
  label?: string | null;
  dataType?: string | null;
  required?: boolean;
  readOnly?: boolean;
  sortOrder?: number;
  defaultValue?: any;
  schemaMeta?: Record<string, any>;
}

export interface WorkflowTemplateNodeReferencePayload {
  id?: string;
  nodeId: string;
  sequence: number;
  isMainPath: boolean;
  allowAppendNextNode: boolean;
  allowDeriveSubflow: boolean;
  version?: number;
}

export type WorkflowTemplateNodeGraph = string[][];

export interface WorkflowTemplateNodeGraphResponse {
  templateId: string;
  nodeGraph: WorkflowTemplateNodeGraph;
  nodeDefinitions: WorkflowNodeDesignSummary[];
}

export const authApi = {
  login: (data: { email?: string; login?: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

export const orgApi = {
  list: () => api.get('/orgs'),
  chart: () => api.get('/orgs/chart'),
  get: (id: string | number) => api.get(`/orgs/${id}`),
  create: (data: any) => api.post('/orgs', data),
  update: (id: string | number, data: any) => api.put(`/orgs/${id}`, data),
  delete: (id: string | number) => api.delete(`/orgs/${id}`),
};

export const positionApi = {
  list: () => api.get('/positions'),
  page: (params?: { current?: number; size?: number }) => api.get('/positions/page', { params }),
  create: (data: any) => api.post('/positions', data),
  update: (id: number, data: any) => api.put(`/positions/${id}`, data),
  delete: (id: number) => api.delete(`/positions/${id}`),
};

export const objectApi = {
  list: (type?: string, deptId?: string, name?: string, customerRole?: string, customerScale?: string) => api.get('/objects', { params: { type, deptId, name, customerRole, customerScale } }),
  page: (params?: { current?: number; size?: number; type?: string; deptId?: string; orgId?: string; name?: string; customerRole?: string; customerScale?: string }) => api.get('/objects/page', { params }),
  departments: () => api.get('/objects/departments'),
  orgStructure: () => api.get('/objects/org-structure'),
  get: (id: string | number) => api.get(`/objects/${id}`),
  create: (data: any) => api.post('/objects', data),
  update: (id: string | number, data: any) => api.put(`/objects/${id}`, data),
  delete: (id: string | number) => api.delete(`/objects/${id}`),
};

export const productApi = {
  list: (params?: {
    current?: number;
    size?: number;
    categoryCode?: string;
    code?: string;
    name?: string;
    productLine?: string;
    structureLevel1?: string;
    structureLevel2?: string;
    seriesDisplayName?: string;
  }) => api.get('/products', { params }),
  create: (data: any) => api.post('/products', data),
  update: (id: string | number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string | number) => api.delete(`/products/${id}`),
};

export const userApi = {
  me: () => api.get('/users/me'),
  lookups: () => api.get('/users/me/lookups'),
  changeMyPassword: (password: string) => api.put('/users/me/password', { password }),
  list: (orgId?: number) => api.get('/users', { params: { orgId } }),
  page: (params?: { current?: number; size?: number; orgId?: string | number }) => api.get('/users/page', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export const adminApi = {
  getPermissions: () => api.get('/admin/permissions'),
  savePermissions: (data: Record<string, string[]>) => api.put('/admin/permissions', data),
  getUserMenus: (userId: number) => api.get(`/admin/user-permissions/${userId}`),
  saveUserMenus: (userId: number, menus: string[]) => api.put(`/admin/user-permissions/${userId}`, menus),
  resetUserMenus: (userId: number) => api.delete(`/admin/user-permissions/${userId}`),
  getUserObjectTypes: (userId: number) => api.get(`/admin/user-object-types/${userId}`),
  saveUserObjectTypes: (userId: number, types: string[]) => api.put(`/admin/user-object-types/${userId}`, types),
  resetUserObjectTypes: (userId: number) => api.delete(`/admin/user-object-types/${userId}`),
  getPositionObjectTypes: () => api.get('/admin/position-object-types'),
  savePositionObjectTypes: (data: Record<string, string[]>) => api.put('/admin/position-object-types', data),
};

export const salesCollabApi = {
  meta: () => api.get('/admin/sales-collab/meta'),
  listTemplates: () => api.get('/admin/sales-collab/templates'),
  getTemplate: (id: string | number) => api.get(`/admin/sales-collab/templates/${id}`),
  createTemplate: (data: any) => api.post('/admin/sales-collab/templates', data),
  updateTemplate: (id: string | number, data: any) => api.put(`/admin/sales-collab/templates/${id}`, data),
  deleteTemplate: (id: string | number) => api.delete(`/admin/sales-collab/templates/${id}`),
  duplicateTemplate: (id: string | number, data?: any) => api.post(`/admin/sales-collab/templates/${id}/copy`, data),
  saveTemplateRules: (id: string | number, data: any) => api.put(`/admin/sales-collab/templates/${id}/rules`, data),
  listOrgBindings: () => api.get('/admin/sales-collab/org-bindings'),
  getOrgBinding: (orgId: string | number) => api.get(`/admin/sales-collab/org-binding/${orgId}`),
  saveOrgBinding: (orgId: string | number, data: any) => api.put(`/admin/sales-collab/org-binding/${orgId}`, data),
};

export const portalTemplateAdminApi = {
  meta: () => api.get('/admin/portal-templates/meta'),
  positions: () => api.get('/admin/portal-templates/positions'),
  listTemplates: () => api.get('/admin/portal-templates/templates'),
  getTemplate: (id: string | number) => api.get(`/admin/portal-templates/templates/${id}`),
  previewTemplate: (id: string | number, params?: PortalTemplatePreviewParams) => api.get(`/admin/portal-templates/templates/${id}/preview`, { params }),
  generateByPosition: (data: { positionId: string | number }) => api.post('/admin/portal-templates/generate-by-position', data),
  createTemplate: (data: any) => api.post('/admin/portal-templates/templates', data),
  updateTemplate: (id: string | number, data: any) => api.put(`/admin/portal-templates/templates/${id}`, data),
  deleteTemplate: (id: string | number) => api.delete(`/admin/portal-templates/templates/${id}`),
};

export const portalBlockTemplateAdminApi = {
  listTemplates: (params?: { status?: PortalBlockTemplateStatus; keyword?: string }) => api.get('/admin/portal-block-templates', { params }),
  getTemplate: (id: string | number) => api.get(`/admin/portal-block-templates/${id}`),
  createTemplate: (data: PortalBlockTemplatePayload) => api.post('/admin/portal-block-templates', data),
  updateTemplate: (id: string | number, data: PortalBlockTemplatePayload) => api.put(`/admin/portal-block-templates/${id}`, data),
  updateStatus: (id: string | number, status: PortalBlockTemplateStatus) => api.put(`/admin/portal-block-templates/${id}/status`, { status }),
  copyTemplate: (id: string | number) => api.post(`/admin/portal-block-templates/${id}/copy`),
  references: (id: string | number) => api.get(`/admin/portal-block-templates/${id}/references`),
};

export const dailyEntryAdminApi = {
  listEntries: (params?: { current?: number; size?: number; status?: DailyEntryStatus; keyword?: string }) => api.get('/admin/daily-entries', { params }),
  getEntry: (id: string | number) => api.get(`/admin/daily-entries/${id}`),
  createEntry: (data: DailyEntryPayload) => api.post('/admin/daily-entries', data),
  updateEntry: (id: string | number, data: DailyEntryPayload) => api.put(`/admin/daily-entries/${id}`, data),
  updateEntryStatus: (id: string | number, status: DailyEntryStatus) => api.put(`/admin/daily-entries/${id}/status`, { status }),
  listTargets: (id: string | number) => api.get(`/admin/daily-entries/${id}/targets`),
  saveTargets: (id: string | number, targets: DailyEntryTargetPayload[]) => api.put(`/admin/daily-entries/${id}/targets`, targets),
  getChatPolicy: (id: string | number) => api.get(`/admin/daily-entry-chat-policies/${id}`),
  saveChatPolicy: (id: string | number, data: DailyEntryChatPolicyPayload) => api.put(`/admin/daily-entry-chat-policies/${id}`, data),
  listSessionBindings: (id: string | number) => api.get(`/admin/daily-entry-chat-policies/${id}/session-bindings`),
  saveSessionBindings: (id: string | number, bindings: DailyEntrySessionBindingPayload[]) => api.put(`/admin/daily-entry-chat-policies/${id}/session-bindings`, bindings),
};

export const userExternalAccountAdminApi = {
  list: (params?: { keyword?: string; status?: UserExternalAccountStatus; provider?: UserExternalAccountProvider }) => api.get('/admin/user-external-accounts', { params }),
  get: (userId: string | number) => api.get(`/admin/users/${userId}/external-accounts`),
  save: (userId: string | number, data: UserExternalAccountBindingPayload) => api.put(`/admin/users/${userId}/external-accounts`, data),
  unbind: (userId: string | number, data?: { id?: string; corpId?: string; provider?: UserExternalAccountProvider; reason?: string }) => api.put(`/admin/users/${userId}/external-accounts/unbind`, data || {}),
  remove: (userId: string | number, params?: { corpId?: string; provider?: UserExternalAccountProvider }) => api.delete(`/admin/users/${userId}/external-accounts`, { params }),
};

export const portalApi = {
  user: (id: string | number, params?: PortalRequestParams) => api.get(`/portal/users/${id}`, { params }),
  object: (id: string | number, params?: PortalRequestParams) => api.get(`/portal/objects/${id}`, { params }),
  product: (id: string | number, params?: PortalRequestParams) => api.get(`/portal/products/${id}`, { params }),
};

export const workflowTemplateApi = {
  listPackages: (params?: { positionId?: string; status?: WorkflowTemplateStatus }) => api.get('/admin/workflow-templates/packages', { params }),
  listPositions: () => api.get('/admin/workflow-templates/positions'),
  getPackage: (id: string | number) => api.get(`/admin/workflow-templates/packages/${id}`),
  createPackage: (data: {
    name: string;
    code?: string;
    applicableSubjectType?: string | null;
    positionId?: string | null;
    positionIds?: string[];
    description?: string;
    meta?: Record<string, any>;
    version?: number;
    sortOrder?: number;
    allowCreateAsNormal?: boolean;
    allowCreateAsSubflow?: boolean;
  }) => api.post('/admin/workflow-templates/packages', data),
  updatePackage: (id: string | number, data: {
    name: string;
    code?: string;
    applicableSubjectType?: string | null;
    positionId?: string | null;
    positionIds?: string[];
    description?: string;
    meta?: Record<string, any>;
    version?: number;
    sortOrder?: number;
    allowCreateAsNormal?: boolean;
    allowCreateAsSubflow?: boolean;
  }) => api.put(`/admin/workflow-templates/packages/${id}`, data),
  updatePackageStatus: (id: string | number, status: WorkflowTemplateStatus) => api.put(`/admin/workflow-templates/packages/${id}/status`, { status }),
  deletePackage: (id: string | number) => api.delete(`/admin/workflow-templates/packages/${id}`),
  copyPackage: (id: string | number, data?: { name?: string }) => api.post(`/admin/workflow-templates/packages/${id}/copy`, data),
  listAvailablePackages: (params?: { positionId?: string }) => api.get('/workflows/template-packages', { params }),
  getNodeGraph: (id: string | number) => api.get(`/admin/workflow-templates/packages/${id}/node-graph`),
  saveNodeGraph: (id: string | number, nodeGraph: WorkflowTemplateNodeGraph) => api.put(`/admin/workflow-templates/packages/${id}/node-graph`, { nodeGraph }),
  listInputMappings: (id: string | number) => api.get(`/admin/workflow-templates/packages/${id}/input-mappings`),
  getInputMappingOptions: (id: string | number) => api.get(`/admin/workflow-templates/packages/${id}/input-mapping-options`),
  saveInputMappings: (id: string | number, mappings: WorkflowTemplateInputMapping[]) => api.put(`/admin/workflow-templates/packages/${id}/input-mappings`, mappings),
  listNodes: (id: string | number) => api.get(`/admin/workflow-templates/packages/${id}/nodes`),
  saveNodes: (id: string | number, nodes: WorkflowTemplateNodeReferencePayload[]) => api.put(`/admin/workflow-templates/packages/${id}/nodes`, { nodes }),
  listFieldDefinitions: (params?: { enabled?: boolean; keyword?: string }) => api.get('/admin/workflow-templates/field-definitions', { params }),
  createFieldDefinition: (data: {
    fieldKey: string;
    name: string;
    fieldType: string;
    description?: string;
    enabled?: boolean;
    sensitive?: boolean;
    groupKey?: string;
    displayOrder?: number;
    meta?: Record<string, any>;
  }) => api.post('/admin/workflow-templates/field-definitions', data),
  updateFieldDefinition: (fieldKey: string, data: {
    fieldKey?: string;
    name: string;
    fieldType: string;
    description?: string;
    enabled?: boolean;
    sensitive?: boolean;
    groupKey?: string;
    displayOrder?: number;
    meta?: Record<string, any>;
  }) => api.put(`/admin/workflow-templates/field-definitions/${fieldKey}`, data),
  deleteFieldDefinition: (fieldKey: string) => api.delete(`/admin/workflow-templates/field-definitions/${fieldKey}`),
};

export const workflowNodeDesignApi = {
  list: (params?: { status?: WorkflowTemplateStatus; keyword?: string }) => api.get('/admin/workflow-node-designs', { params }),
  detail: (id: string | number) => api.get(`/admin/workflow-node-designs/${id}`),
  create: (data: { id?: string; moduleDefinitionId?: string | null; name: string; code: string; nodeType: string; version?: number }) => api.post('/admin/workflow-node-designs', data),
  update: (id: string | number, data: { id?: string; moduleDefinitionId?: string | null; name: string; code: string; nodeType: string; version?: number }) => api.put(`/admin/workflow-node-designs/${id}`, data),
  updateStatus: (id: string | number, status: WorkflowTemplateStatus) => api.put(`/admin/workflow-node-designs/${id}/status`, { status }),
  delete: (id: string | number) => api.delete(`/admin/workflow-node-designs/${id}`),
  listInputFields: (id: string | number) => api.get(`/admin/workflow-node-designs/${id}/input-fields`),
  saveInputFields: (id: string | number, fields: WorkflowNodeFieldSavePayload[]) => api.put(`/admin/workflow-node-designs/${id}/input-fields`, { fields }),
  listOutputFields: (id: string | number) => api.get(`/admin/workflow-node-designs/${id}/output-fields`),
  saveOutputFields: (id: string | number, fields: WorkflowNodeFieldSavePayload[]) => api.put(`/admin/workflow-node-designs/${id}/output-fields`, { fields }),
  listRecommendations: (id: string | number) => api.get(`/admin/workflow-node-designs/${id}/recommendations`),
  saveRecommendations: (id: string | number, recommendations: WorkflowTemplateNodeRecommendationPayload[]) => api.put(`/admin/workflow-node-designs/${id}/recommendations`, { recommendations }),
};
