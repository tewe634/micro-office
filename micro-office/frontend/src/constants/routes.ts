const baseMenus = ['/org'];

const disabledMenus = new Set([
  '/admin/workflow-node-features',
  '/admin/workflow-templates',
  '/admin/daily-entries',
]);

const routePriority = [
  '/org',
  '/users',
  '/objects',
  '/products',
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

const adminRoutePriority = [
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

export function buildAllowedMenus(menus: string[]) {
  return Array.from(new Set([...baseMenus, ...menus]));
}

export function canAccessMenu(menuKey: string, menus: string[]) {
  if (disabledMenus.has(menuKey)) {
    return false;
  }
  if (menuKey === '/org') {
    return true;
  }
  if (menuKey === '/admin') {
    return menus.some(menu => menu.startsWith('/admin/') && !disabledMenus.has(menu));
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
