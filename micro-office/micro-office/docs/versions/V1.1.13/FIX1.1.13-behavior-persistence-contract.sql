-- FIX1.1.13-behavior-persistence-contract
-- Runbook SQL: precheck -> migrate -> validate -> rollback

-- ============================================================
-- 0) PRECHECK (read-only)
-- ============================================================
SELECT
    to_regclass('public.mo_daily_entry_behaviors') AS behaviors_table,
    to_regclass('public.mo_daily_entry_behavior_fields') AS behavior_fields_table,
    to_regclass('public.mo_daily_entry_behavior_form_fields') AS behavior_form_fields_legacy_name;

SELECT
    COUNT(*) FILTER (WHERE column_name = 'session_type') AS has_session_type,
    COUNT(*) FILTER (WHERE column_name = 'execution_mode') AS has_execution_mode
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mo_daily_entry_behaviors'
  AND column_name IN ('session_type', 'execution_mode');

SELECT
    (SELECT COUNT(*) FROM mo_daily_entry_behaviors) AS behavior_count,
    (SELECT COUNT(*) FROM mo_daily_entry_behavior_form_fields) AS legacy_field_table_count;

SELECT
    COUNT(*) AS legacy_action_type_count
FROM mo_daily_entry_behaviors
WHERE action_type = 'CREATE_CHAT_SESSION';

-- ============================================================
-- 1) MIGRATION EXECUTION
-- ============================================================
-- Use psql to run:
-- \i /Users/kevin/workspace/micro-office/backend/src/main/resources/db/migration/V52__fix_daily_entry_behavior_persistence_contract.sql

-- ============================================================
-- 2) POST VALIDATION (read-only)
-- ============================================================
SELECT
    to_regclass('public.mo_daily_entry_behaviors') AS behaviors_table,
    to_regclass('public.mo_daily_entry_behavior_fields') AS behavior_fields_table,
    to_regclass('public.mo_daily_entry_behavior_form_fields') AS compatibility_view;

SELECT
    COUNT(*) AS invalid_behavior_contract_count
FROM mo_daily_entry_behaviors
WHERE action_type <> 'OPEN_WORKBENCH_SESSION'
   OR session_type <> 'DAILY_ENTRY'
   OR execution_mode NOT IN ('OPEN_EXISTING', 'CREATE_SESSION')
   OR status NOT IN ('ACTIVE', 'INACTIVE');

SELECT
    COUNT(*) AS dangling_behavior_fields_count
FROM mo_daily_entry_behavior_fields f
LEFT JOIN mo_daily_entry_behaviors b ON b.id = f.behavior_id
WHERE b.id IS NULL;

SELECT
    COUNT(*) AS invalid_field_version_count
FROM mo_daily_entry_behavior_fields
WHERE version IS NULL OR version <= 0;

SELECT
    c.code,
    b.id AS behavior_id,
    b.action_type,
    b.session_type,
    b.execution_mode,
    b.requires_pre_action_form,
    (SELECT COUNT(*)
     FROM mo_daily_entry_behavior_fields f
     WHERE f.behavior_id = b.id
       AND f.field_key = 'session_title'
       AND f.input_type = 'TEXT'
       AND f.required IS TRUE
       AND f.status = 'ACTIVE') AS session_title_field_count
FROM mo_daily_entry_behaviors b
JOIN mo_daily_categories c ON c.id = b.daily_entry_id
WHERE upper(c.code) = 'MEETING';

-- ============================================================
-- 3) ROLLBACK SQL (structure-level + behavior value restore)
-- ============================================================
-- IMPORTANT:
-- - Execute in low traffic window.
-- - This rollback assumes V52 created snapshot table:
--   public.mo_fix_1_1_13_behavior_snapshot

BEGIN;

-- 3.1 restore behavior values from snapshot
UPDATE public.mo_daily_entry_behaviors b
SET action_type = s.action_type,
    session_type = s.session_type,
    execution_mode = s.execution_mode,
    status = s.status,
    meta = s.meta,
    updated_at = now(),
    updated_by = 'rollback_fix_1_1_13_behavior_contract'
FROM public.mo_fix_1_1_13_behavior_snapshot s
WHERE s.id = b.id;

-- 3.2 drop contract constraints/indexes introduced by V52
ALTER TABLE IF EXISTS public.mo_daily_entry_behaviors
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behaviors_session_type_enum,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behaviors_execution_mode_enum;

DROP INDEX IF EXISTS public.idx_mo_daily_entry_behaviors_status_execution;

ALTER TABLE IF EXISTS public.mo_daily_entry_behavior_fields
    DROP CONSTRAINT IF EXISTS fk_mo_daily_entry_behavior_fields_behavior,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_key_not_blank,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_label_not_blank,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_input_type_enum,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_status_enum,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_sort_non_negative,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_max_length_positive,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_meta_object,
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_behavior_fields_version_positive;

DROP INDEX IF EXISTS public.idx_mo_daily_entry_behavior_fields_behavior_sort;
DROP INDEX IF EXISTS public.uq_mo_daily_entry_behavior_fields_behavior_key;
DROP INDEX IF EXISTS public.uq_mo_daily_entry_behavior_fields_behavior_sort;

-- 3.3 rollback compatibility object: remove view and restore legacy table name
DROP VIEW IF EXISTS public.mo_daily_entry_behavior_form_fields;

DO $$
BEGIN
    IF to_regclass('public.mo_daily_entry_behavior_form_fields') IS NULL
       AND to_regclass('public.mo_daily_entry_behavior_fields') IS NOT NULL THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            RENAME TO mo_daily_entry_behavior_form_fields;
    END IF;
END $$;

-- 3.4 optional structural rollback of behavior columns (only if app no longer reads them)
-- ALTER TABLE public.mo_daily_entry_behaviors
--     DROP COLUMN IF EXISTS session_type,
--     DROP COLUMN IF EXISTS execution_mode;

COMMIT;
