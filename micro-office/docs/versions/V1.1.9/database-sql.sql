-- V1.1.9 readonly validation SQL
-- 目标：验证岗位模板关系已从 meta.positionId 收敛到 mo_portal_templates.position_id

-- 1) 列存在检查。预期：
--    has_position_id_column = 1
SELECT COUNT(*) AS has_position_id_column
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mo_portal_templates'
  AND column_name = 'position_id';

-- 2) PERSON_ROLE 模板中的“仅 meta 有值、主列为空”残留。预期：
--    meta_only_binding_count = 0
SELECT COUNT(*) AS meta_only_binding_count
FROM mo_portal_templates
WHERE template_type = 'PERSON_ROLE'
  AND position_id IS NULL
  AND NULLIF(btrim(meta ->> 'positionId'), '') IS NOT NULL;

-- 3) PERSON_ROLE 模板 position_id 外键健康。预期：
--    invalid_position_fk_count = 0
SELECT COUNT(*) AS invalid_position_fk_count
FROM mo_portal_templates t
LEFT JOIN position p
  ON p.id = t.position_id
WHERE t.template_type = 'PERSON_ROLE'
  AND t.position_id IS NOT NULL
  AND p.id IS NULL;

-- 4) 非 PERSON_ROLE 模板误用 position_id。预期：
--    non_person_role_position_id_count = 0
SELECT COUNT(*) AS non_person_role_position_id_count
FROM mo_portal_templates
WHERE template_type <> 'PERSON_ROLE'
  AND position_id IS NOT NULL;

-- 5) meta.positionId 清理情况。预期：
--    meta_position_id_residual_count = 0
SELECT COUNT(*) AS meta_position_id_residual_count
FROM mo_portal_templates
WHERE meta ? 'positionId';

-- 6) 索引存在检查。预期：
--    person_status_position_idx_exists = true
--    person_active_position_idx_exists = true
SELECT
    EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mo_portal_templates'
          AND indexname = 'idx_mo_portal_templates_person_status_position_order'
    ) AS person_status_position_idx_exists,
    EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mo_portal_templates'
          AND indexname = 'idx_mo_portal_templates_person_active_position_order'
    ) AS person_active_position_idx_exists;

-- 7) PERSON_ROLE 迁移完成面板（信息项）。预期：
--    position_id_filled_count >= 0（用于观察）
SELECT
    COUNT(*) FILTER (WHERE template_type = 'PERSON_ROLE') AS person_role_total,
    COUNT(*) FILTER (WHERE template_type = 'PERSON_ROLE' AND position_id IS NOT NULL) AS position_id_filled_count,
    COUNT(*) FILTER (WHERE template_type = 'PERSON_ROLE' AND position_id IS NULL) AS position_id_null_count
FROM mo_portal_templates;
