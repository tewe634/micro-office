-- V4: 细化权限 - 用户级菜单权限 + 岗位级对象类型权限 + 外部对象归属

-- 用户个人菜单权限覆盖（为空则走角色默认）
CREATE TABLE user_menu_permission (
    id       SERIAL PRIMARY KEY,
    user_id  INT NOT NULL REFERENCES sys_user(id) ON DELETE CASCADE,
    menu_key VARCHAR(50) NOT NULL,
    UNIQUE(user_id, menu_key)
);

-- 岗位可见的外部对象类型
CREATE TABLE position_object_type (
    id          SERIAL PRIMARY KEY,
    position_id INT NOT NULL REFERENCES position(id) ON DELETE CASCADE,
    object_type VARCHAR(30) NOT NULL,
    UNIQUE(position_id, object_type)
);

-- 外部对象归属（关联到组织和负责人）
ALTER TABLE external_object ADD COLUMN org_id INT REFERENCES organization(id);
ALTER TABLE external_object ADD COLUMN owner_id INT REFERENCES sys_user(id);

-- 初始化岗位-对象类型权限
-- 销售岗位看客户
INSERT INTO position_object_type (position_id, object_type)
SELECT id, 'CUSTOMER' FROM position WHERE code IN ('SALES_DIR','SALES_MGR','SALES_REP','BOSS');
-- 采购岗位看供应商
INSERT INTO position_object_type (position_id, object_type)
SELECT id, 'SUPPLIER' FROM position WHERE code IN ('PURCHASE_SPEC','BOSS');
-- 财务岗位看银行、第三方支付
INSERT INTO position_object_type (position_id, object_type)
SELECT id, t.type FROM position, (VALUES ('BANK'), ('THIRD_PARTY_PAY')) AS t(type) WHERE code IN ('ACCOUNTANT','BOSS');
-- 商务看客户和供应商
INSERT INTO position_object_type (position_id, object_type)
SELECT id, t.type FROM position, (VALUES ('CUSTOMER'), ('SUPPLIER')) AS t(type) WHERE code = 'BIZ_SPEC';
-- 系统管理员看全部
INSERT INTO position_object_type (position_id, object_type)
SELECT id, t.type FROM position, (VALUES ('CUSTOMER'), ('SUPPLIER'), ('CARRIER'), ('BANK'), ('THIRD_PARTY_PAY'), ('OTHER')) AS t(type) WHERE code = 'SYS_ADMIN';
