-- V3: 角色菜单权限配置表
CREATE TABLE role_menu_permission (
    id       SERIAL PRIMARY KEY,
    role     VARCHAR(20) NOT NULL,
    menu_key VARCHAR(50) NOT NULL,
    UNIQUE(role, menu_key)
);

-- 初始化默认权限数据
INSERT INTO role_menu_permission (role, menu_key) VALUES
-- ADMIN: 全部
('ADMIN', '/workbench'), ('ADMIN', '/threads'), ('ADMIN', '/taskpool'),
('ADMIN', '/org'), ('ADMIN', '/users'), ('ADMIN', '/objects'),
('ADMIN', '/products'), ('ADMIN', '/clock'), ('ADMIN', '/admin'),
-- HR: 基础 + 组织 + 人员
('HR', '/workbench'), ('HR', '/threads'), ('HR', '/taskpool'),
('HR', '/org'), ('HR', '/users'), ('HR', '/products'), ('HR', '/clock'),
-- SALES: 基础 + 外部对象
('SALES', '/workbench'), ('SALES', '/threads'), ('SALES', '/taskpool'),
('SALES', '/objects'), ('SALES', '/products'), ('SALES', '/clock'),
-- PURCHASE: 基础 + 外部对象
('PURCHASE', '/workbench'), ('PURCHASE', '/threads'), ('PURCHASE', '/taskpool'),
('PURCHASE', '/objects'), ('PURCHASE', '/products'), ('PURCHASE', '/clock'),
-- FINANCE: 基础 + 外部对象
('FINANCE', '/workbench'), ('FINANCE', '/threads'), ('FINANCE', '/taskpool'),
('FINANCE', '/objects'), ('FINANCE', '/products'), ('FINANCE', '/clock'),
-- STAFF: 基础
('STAFF', '/workbench'), ('STAFF', '/threads'), ('STAFF', '/taskpool'),
('STAFF', '/products'), ('STAFF', '/clock');
