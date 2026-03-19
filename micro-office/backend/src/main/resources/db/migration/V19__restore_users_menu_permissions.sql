INSERT INTO role_menu_permission (role, menu_key)
VALUES
    ('ADMIN', '/users'),
    ('HR', '/users')
ON CONFLICT (role, menu_key) DO NOTHING;
