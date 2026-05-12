const baseMenus = ['/org'];

const routePriority = [
  '/org',
  '/admin/external-accounts',
  '/objects',
  '/products',
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/workflow-node-designs',
  '/admin/workflow-templates',
  '/admin/workflow-template-fields',
  '/admin/daily-entries',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

const adminRoutePriority = [
  '/admin/external-accounts',
  '/admin/permissions',
  '/admin/sales-collab',
  '/admin/workflow-node-designs',
  '/admin/workflow-templates',
  '/admin/workflow-template-fields',
  '/admin/daily-entries',
  '/admin/portal-block-templates',
  '/admin/portal-templates',
];

const menuAccessAliases: Record<string, string[]> = {
  '/admin/external-accounts': ['/users'],
};

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
  const candidates = [menuKey, ...(menuAccessAliases[menuKey] || [])];
  return candidates.some(candidate => menus.includes(candidate));
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
