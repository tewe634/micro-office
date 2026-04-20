const baseMenus = ['/org'];

const routePriority = [
  '/org',
  '/users',
  '/objects',
  '/products',
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/workflow-node-features',
  '/admin/workflow-templates',
  '/admin/daily-entries',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

const adminRoutePriority = [
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/workflow-node-features',
  '/admin/workflow-templates',
  '/admin/daily-entries',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

export function buildAllowedMenus(menus: string[]) {
  return Array.from(new Set([...baseMenus, ...menus]));
}

export function canAccessMenu(menuKey: string, menus: string[]) {
  if (menuKey === '/org') {
    return true;
  }
  if (menus.includes('/admin') && menuKey.startsWith('/admin')) {
    return true;
  }
  return menus.includes(menuKey);
}

export function resolveHomePath(menus: string[]) {
  const allowedMenus = buildAllowedMenus(menus);
  const nextPath = routePriority.find(path => canAccessMenu(path, allowedMenus));
  return nextPath || '/org';
}

export function resolveAdminHomePath(menus: string[]) {
  const allowedMenus = buildAllowedMenus(menus);
  const nextPath = adminRoutePriority.find(path => canAccessMenu(path, allowedMenus));
  return nextPath || resolveHomePath(allowedMenus);
}
