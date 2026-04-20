-- V1.1.8 readonly validation SQL
-- 目标：验证门户卡片资产名称已完成去 legacy/去模板耦合清洗

-- 1) 脏名称模式计数。预期：
--    legacy_prefix_count = 0
--    template_joined_count = 0
--    uuid_tail_count = 0
SELECT
    SUM(CASE WHEN name ~* '^legacy[_\s-]*' THEN 1 ELSE 0 END) AS legacy_prefix_count,
    SUM(CASE WHEN name ~ '^[^/]+\s*/\s*[^/]+$' THEN 1 ELSE 0 END) AS template_joined_count,
    SUM(CASE WHEN name ~* '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN 1 ELSE 0 END) AS uuid_tail_count
FROM mo_portal_block_templates;

-- 2) V44 历史回填记录中，name 应与 label 对齐。预期：
--    v44_name_label_mismatch_count = 0
SELECT
    COUNT(*) AS v44_name_label_mismatch_count
FROM mo_portal_block_templates bt
WHERE bt.meta -> 'legacySource' ->> 'migrationVersion' = 'V44'
  AND btrim(bt.name) <> btrim(bt.label);

-- 3) 名称不能为空白。预期：
--    blank_name_count = 0
SELECT
    COUNT(*) AS blank_name_count
FROM mo_portal_block_templates
WHERE nullif(btrim(name), '') IS NULL;

-- 4) 脏名称明细抽样。预期：0 行
SELECT
    id,
    code,
    name,
    label,
    meta -> 'legacySource' ->> 'templateId' AS source_template_id
FROM mo_portal_block_templates
WHERE name ~* '^legacy[_\s-]*'
   OR name ~ '^[^/]+\s*/\s*[^/]+$'
   OR name ~* '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
ORDER BY id
LIMIT 200;
