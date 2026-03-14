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
  list: () => api.get('/positions'),
  create: (data: any) => api.post('/positions', data),
  update: (id: number, data: any) => api.put(`/positions/${id}`, data),
  delete: (id: number) => api.delete(`/positions/${id}`),
};

export const objectApi = {
  list: (type?: string) => api.get('/objects', { params: { type } }),
  get: (id: number) => api.get(`/objects/${id}`),
  create: (data: any) => api.post('/objects', data),
  update: (id: number, data: any) => api.put(`/objects/${id}`, data),
  delete: (id: number) => api.delete(`/objects/${id}`),
};

export const productApi = {
  list: () => api.get('/products'),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
};

export const threadApi = {
  create: (data: any) => api.post('/threads', data),
  get: (id: number) => api.get(`/threads/${id}`),
};

export const nodeApi = {
  list: (threadId: number) => api.get(`/threads/${threadId}/nodes`),
  create: (threadId: number, data: any) => api.post(`/threads/${threadId}/nodes`, data),
  complete: (id: number, data: any) => api.put(`/nodes/${id}/complete`, data),
  rollback: (id: number, targetNodeId: number) => api.put(`/nodes/${id}/rollback`, null, { params: { targetNodeId } }),
};

export const commentApi = {
  list: (threadId: number) => api.get(`/threads/${threadId}/comments`),
  create: (threadId: number, content: string) => api.post(`/threads/${threadId}/comments`, { content }),
};

export const taskpoolApi = {
  list: (positionId: number) => api.get('/taskpool', { params: { positionId } }),
  claim: (nodeId: number) => api.post(`/taskpool/${nodeId}/claim`),
};

export const workbenchApi = {
  get: (view: string) => api.get('/workbench', { params: { view } }),
};

export const clockApi = {
  punch: (type: string) => api.post('/clock/punch', { type }),
  today: () => api.get('/clock/today'),
};

export const userApi = {
  me: () => api.get('/users/me'),
  list: (orgId?: number) => api.get('/users', { params: { orgId } }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
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
