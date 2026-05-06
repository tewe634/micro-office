-- V1.1.12 readonly validation SQL
-- 目标：验证“前置弹窗参数动作”数据库结构已就绪，且首个场景可配置

-- 1) 主表字段检查。预期：
--    missing_action_columns = 0
WITH required_columns(column_name) AS (
    VALUES
        ('requires_pre_action_form'),
        ('pre_action_form_title'),
        ('pre_action_form_submit_label')
)
SELECT COUNT(*) AS missing_action_columns
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'mo_portal_block_template_actions'
 AND c.column_name = rc.column_name
WHERE c.column_name IS NULL;

-- 2) 子表存在检查。预期：
--    form_fields_table 非 null
SELECT to_regclass('public.mo_portal_block_template_action_form_fields') AS form_fields_table;

-- 3) 关键约束/索引检查。预期：
--    required_constraints_missing = 0
--    required_indexes_missing = 0
WITH required_constraints(conname) AS (
    VALUES
        ('fk_mo_portal_block_template_action_form_fields_action'),
        ('ck_mo_portal_block_template_action_form_fields_input_type_enum'),
        ('ck_mo_portal_block_template_action_form_fields_status_enum'),
        ('ck_mo_portal_block_template_action_form_fields_meta_object')
),
required_indexes(indexname) AS (
    VALUES
        ('idx_mo_portal_block_template_actions_pre_form_enabled'),
        ('idx_mo_portal_block_template_action_form_fields_action_sort'),
        ('uq_mo_portal_block_template_action_form_fields_action_key'),
        ('uq_mo_portal_block_template_action_form_fields_action_sort')
)
SELECT
    (SELECT COUNT(*)
     FROM required_constraints r
     LEFT JOIN pg_constraint c ON c.conname = r.conname
     WHERE c.conname IS NULL) AS required_constraints_missing,
    (SELECT COUNT(*)
     FROM required_indexes r
     LEFT JOIN pg_indexes i
       ON i.schemaname = 'public'
      AND i.indexname = r.indexname
     WHERE i.indexname IS NULL) AS required_indexes_missing;

-- 4) 首个场景能力检查（session_title 字段定义可读）。预期：
--    ready_session_title_field_count >= 0（信息项；部署后应 >= 1）
SELECT COUNT(*) AS ready_session_title_field_count
FROM mo_portal_block_template_action_form_fields f
JOIN mo_portal_block_template_actions a
  ON a.id = f.action_id
WHERE a.requires_pre_action_form IS TRUE
  AND f.status = 'ACTIVE'
  AND f.field_key = 'session_title'
  AND f.input_type = 'TEXT';

-- 5) 数据健康检查。预期：
--    invalid_form_link_count = 0
--    invalid_enabled_without_field_count = 0
SELECT
    COALESCE(SUM(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END), 0) AS invalid_form_link_count,
    (
        SELECT COUNT(*)
        FROM mo_portal_block_template_actions a2
        WHERE a2.requires_pre_action_form IS TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM mo_portal_block_template_action_form_fields f2
              WHERE f2.action_id = a2.id
                AND f2.status = 'ACTIVE'
          )
    ) AS invalid_enabled_without_field_count
FROM mo_portal_block_template_action_form_fields f
LEFT JOIN mo_portal_block_template_actions a
  ON a.id = f.action_id;
