ALTER TABLE position ADD COLUMN IF NOT EXISTS default_role VARCHAR(20);
ALTER TABLE organization ADD COLUMN IF NOT EXISTS default_role VARCHAR(20);

UPDATE position SET default_role = 'ADMIN' WHERE code IN ('BOSS', 'SYS_ADMIN');
UPDATE position SET default_role = 'SALES' WHERE code IN ('SALES_DIR', 'SALES_MGR', 'SALES_REP', 'BIZ_SPEC');
UPDATE position SET default_role = 'PURCHASE' WHERE code = 'PURCHASE_SPEC';
UPDATE position SET default_role = 'FINANCE' WHERE code = 'ACCOUNTANT';
UPDATE position SET default_role = 'HR' WHERE code = 'HR_SPEC';
UPDATE position SET default_role = 'STAFF' WHERE code IN ('WAREHOUSE_SPEC', 'SUPPORT_SPEC', 'DEPT_MGR');
