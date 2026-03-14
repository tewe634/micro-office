-- V6: 个人门户 - 重大事件/奖励记录
CREATE TABLE user_achievement (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES sys_user(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    event_date  DATE,
    type        VARCHAR(20) NOT NULL DEFAULT 'ACHIEVEMENT',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_achievement_user ON user_achievement(user_id);

-- 权限表补充新菜单
INSERT INTO role_menu_permission (role, menu_key)
SELECT r.role, m.key FROM
  (VALUES ('ADMIN'),('HR'),('SALES'),('PURCHASE'),('FINANCE'),('STAFF')) AS r(role),
  (VALUES ('/portal'),('/dashboard')) AS m(key);
