INSERT INTO role_menu_permission (role, menu_key)
SELECT 'ADMIN', '/admin/portal-block-templates'
WHERE NOT EXISTS (
    SELECT 1 FROM role_menu_permission WHERE role = 'ADMIN' AND menu_key = '/admin/portal-block-templates'
);

INSERT INTO user_menu_permission (user_id, menu_key)
SELECT su.id, '/admin/portal-block-templates'
FROM sys_user su
WHERE su.role = 'ADMIN'
  AND EXISTS (SELECT 1 FROM user_menu_permission ump WHERE ump.user_id = su.id)
  AND NOT EXISTS (
      SELECT 1 FROM user_menu_permission ump
      WHERE ump.user_id = su.id
        AND ump.menu_key = '/admin/portal-block-templates'
  );
