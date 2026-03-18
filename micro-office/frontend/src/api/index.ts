import api from './client';

export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
};

export const orgApi = {
  list: () => api.get('/orgs'),
  get: (id: number) => api.get(`/orgs/${id}`),
  create: (data: any) => api.post('/orgs', data),
  update: (id: number, data: any) => api.put(`/orgs/${id}`, data),
  delete: (id: number) => api.delete(`/orgs/${id}`),
};

export const positionApi = {
  list: (params?: { current?: number; size?: number }) => api.get('/positions', { params }),
  create: (data: any) => api.post('/positions', data),
  update: (id: number, data: any) => api.put(`/positions/${id}`, data),
  delete: (id: number) => api.delete(`/positions/${id}`),
};

export const objectApi = {
  list: (type?: string, deptId?: string) => api.get('/objects', { params: { type, deptId } }),
  departments: () => api.get('/objects/departments'),
  get: (id: number) => api.get(`/objects/${id}`),
  create: (data: any) => api.post('/objects', data),
  update: (id: number, data: any) => api.put(`/objects/${id}`, data),
  delete: (id: number) => api.delete(`/objects/${id}`),
};

export const productApi = {
  list: (params?: { current?: number; size?: number; categoryCode?: string; code?: string; name?: string }) => api.get('/products', { params }),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
};

export const threadApi = {
  list: (status?: string, objectId?: number) => api.get('/threads', { params: { status, objectId } }),
  create: (data: any) => api.post('/threads', data),
  get: (id: number) => api.get(`/threads/${id}`),
  update: (id: number, data: any) => api.put(`/threads/${id}`, data),
  delete: (id: number) => api.delete(`/threads/${id}`),
};

export const nodeApi = {
  list: (threadId: number) => api.get(`/threads/${threadId}/nodes`),
  create: (threadId: number, data: any) => api.post(`/threads/${threadId}/nodes`, data),
  get: (id: number) => api.get(`/nodes/${id}`),
  assign: (id: number, assigneeId: number) => api.put(`/nodes/${id}/assign`, { assigneeId }),
  complete: (id: number, data: any) => api.put(`/nodes/${id}/complete`, data),
  cancel: (id: number) => api.put(`/nodes/${id}/cancel`),
  transfer: (id: number, targetUserId: number) => api.put(`/nodes/${id}/transfer`, { targetUserId }),
  spawnThread: (id: number, data: any) => api.post(`/nodes/${id}/spawn-thread`, data),
  rollback: (id: number, targetNodeId: number) => api.put(`/nodes/${id}/rollback`, null, { params: { targetNodeId } }),
  messages: (id: number) => api.get(`/nodes/${id}/messages`),
  addMessage: (id: number, data: any) => api.post(`/nodes/${id}/messages`, data),
  addReference: (id: number, data: any) => api.post(`/nodes/${id}/references`, data),
  removeReference: (id: number, refId: number) => api.delete(`/nodes/${id}/references/${refId}`),
};

export const commentApi = {
  list: (threadId: number) => api.get(`/threads/${threadId}/comments`),
  create: (threadId: number, content: string) => api.post(`/threads/${threadId}/comments`, { content }),
  update: (id: number, content: string) => api.put(`/comments/${id}`, { content }),
  delete: (id: number) => api.delete(`/comments/${id}`),
};

export const workbenchApi = {
  get: (view: string) => api.get('/workbench', { params: { view } }),
};

export const clockApi = {
  punch: (type: string) => api.post('/clock/punch', { type }),
  today: () => api.get('/clock/today'),
  history: (userId?: number, days?: number) => api.get('/clock/history', { params: { userId, days } }),
};

export const userApi = {
  me: () => api.get('/users/me'),
  lookups: () => api.get('/users/me/lookups'),
  list: (orgId?: number) => api.get('/users', { params: { orgId } }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export const templateApi = {
  list: () => api.get('/templates'),
};

export const adminApi = {
  listModules: () => api.get('/admin/modules'),
  createModule: (data: any) => api.post('/admin/modules', data),
  updateModule: (id: number, data: any) => api.put(`/admin/modules/${id}`, data),
  deleteModule: (id: number) => api.delete(`/admin/modules/${id}`),
  listTemplates: () => api.get('/admin/templates'),
  createTemplate: (data: any) => api.post('/admin/templates', data),
  templateNodes: (id: number) => api.get(`/admin/templates/${id}/nodes`),
  addTemplateNode: (id: number, data: any) => api.post(`/admin/templates/${id}/nodes`, data),
  deleteTemplate: (id: number) => api.delete(`/admin/templates/${id}`),
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

export const portalApi = {
  get: () => api.get('/portal'),
  addAchievement: (data: any) => api.post('/portal/achievements', data),
  updateAchievement: (id: number, data: any) => api.put(`/portal/achievements/${id}`, data),
  deleteAchievement: (id: number) => api.delete(`/portal/achievements/${id}`),
};

export const dashboardApi = {
  time: (period: string) => api.get('/dashboard/time', { params: { period } }),
  scopes: () => api.get('/dashboard/scopes'),
  org: (scope: string, orgId?: number, period?: string) => api.get('/dashboard/org', { params: { scope, orgId, period } }),
};
