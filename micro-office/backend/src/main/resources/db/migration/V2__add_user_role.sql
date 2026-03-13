-- V2: 用户角色字段
ALTER TABLE sys_user ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'STAFF';

-- 第一个注册用户设为管理员
UPDATE sys_user SET role = 'ADMIN' WHERE id = (SELECT MIN(id) FROM sys_user);
