CREATE TABLE IF NOT EXISTS sys_role (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO sys_role (code, name, sort_order) VALUES
  ('ADMIN', '管理员', 0),
  ('SALES', '销售', 1),
  ('BIZ', '商务', 2),
  ('FINANCE', '财务', 3),
  ('HR', '人事', 4),
  ('TECH', '技术', 5),
  ('WAREHOUSE', '仓储', 6),
  ('IT', 'IT', 7),
  ('PRODUCTION', '生产', 8),
  ('PURCHASE', '采购', 9),
  ('STAFF', '普通员工', 99)
ON CONFLICT (code) DO NOTHING;
