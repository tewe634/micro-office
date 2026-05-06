-- V1.1.13 readonly validation SQL
-- 目标：验证“日常条目行为配置”已结构化落在 daily-entry 侧

-- 1) 新表存在检查。预期：
--    behaviors_table / behavior_fields_table 均非 null
SELECT
    to_regclass('public.mo_daily_entry_behaviors') AS behaviors_table,
    to_regclass('public.mo_daily_entry_behavior_form_fields') AS behavior_fields_table;

-- 2) 关键约束/索引检查。预期：
--    required_constraints_missing = 0
--    required_indexes_missing = 0
WITH required_constraints(conname) AS (
    VALUES
        ('fk_mo_daily_entry_behaviors_daily_entry'),
        ('fk_mo_daily_entry_behavior_form_fields_behavior'),
        ('ck_mo_daily_entry_behaviors_action_type_enum'),
        ('ck_mo_daily_entry_behavior_form_fields_input_type_enum'),
        ('ck_mo_daily_entry_behavior_form_fields_status_enum')
),
required_indexes(indexname) AS (
    VALUES
        ('uq_mo_daily_entry_behaviors_daily_entry'),
        ('idx_mo_daily_entry_behaviors_status_action'),
        ('idx_mo_daily_entry_behaviors_pre_form_enabled'),
        ('idx_mo_daily_entry_behavior_form_fields_behavior_sort'),
        ('uq_mo_daily_entry_behavior_form_fields_behavior_key'),
        ('uq_mo_daily_entry_behavior_form_fields_behavior_sort')
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

-- 3) 行为配置挂载完整性（行为必须命中条目）。预期：
--    dangling_behavior_daily_entry_count = 0
SELECT COUNT(*) AS dangling_behavior_daily_entry_count
FROM mo_daily_entry_behaviors b
LEFT JOIN mo_daily_categories c
  ON c.id = b.daily_entry_id
WHERE c.id IS NULL;

-- 4) 字段配置挂载完整性（字段必须命中行为）。预期：
--    dangling_behavior_field_count = 0
SELECT COUNT(*) AS dangling_behavior_field_count
FROM mo_daily_entry_behavior_form_fields f
LEFT JOIN mo_daily_entry_behaviors b
  ON b.id = f.behavior_id
WHERE b.id IS NULL;

-- 5) 首个场景配置检查（会议 -> session_title）。预期：
--    meeting_behavior_count >= 1
--    meeting_session_title_field_count >= 1
SELECT
    (SELECT COUNT(*)
     FROM mo_daily_entry_behaviors b
     JOIN mo_daily_categories c ON c.id = b.daily_entry_id
     WHERE upper(c.code) = 'MEETING'
       AND b.action_type = 'CREATE_CHAT_SESSION'
       AND b.requires_pre_action_form IS TRUE
       AND b.status = 'ACTIVE') AS meeting_behavior_count,
    (SELECT COUNT(*)
     FROM mo_daily_entry_behavior_form_fields f
     JOIN mo_daily_entry_behaviors b ON b.id = f.behavior_id
     JOIN mo_daily_categories c ON c.id = b.daily_entry_id
     WHERE upper(c.code) = 'MEETING'
       AND f.field_key = 'session_title'
       AND f.input_type = 'TEXT'
       AND f.required IS TRUE
       AND f.status = 'ACTIVE') AS meeting_session_title_field_count;

-- 6) 非目标提醒（信息项）：block 动作侧 V50 结构仍在但非本版主路径
-- 预期：仅用于观测，不作为失败条件
SELECT
    to_regclass('public.mo_portal_block_template_action_form_fields') AS legacy_block_action_form_table,
    (SELECT COUNT(*)
     FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='mo_portal_block_template_actions'
       AND column_name='requires_pre_action_form') AS legacy_block_pre_form_column_exists;
