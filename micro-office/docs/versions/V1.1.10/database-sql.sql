-- V1.1.10 readonly validation SQL
-- 目标：验证 DAILY_ENTRY 本地策略表/绑定表已建立，且约束与索引可用

-- 1) 新表存在检查。预期：
--    chat_policies_table / session_bindings_table 均非 null
SELECT
    to_regclass('public.mo_daily_entry_chat_policies') AS chat_policies_table,
    to_regclass('public.mo_daily_entry_session_bindings') AS session_bindings_table;

-- 2) 关键列存在检查。预期：
--    missing_required_columns = 0
WITH required_columns(table_name, column_name) AS (
    VALUES
        ('mo_daily_entry_chat_policies', 'external_daily_entry_id'),
        ('mo_daily_entry_chat_policies', 'session_resolve_strategy'),
        ('mo_daily_entry_chat_policies', 'provider_key'),
        ('mo_daily_entry_chat_policies', 'status'),
        ('mo_daily_entry_chat_policies', 'meta'),
        ('mo_daily_entry_session_bindings', 'external_daily_entry_id'),
        ('mo_daily_entry_session_bindings', 'user_id'),
        ('mo_daily_entry_session_bindings', 'session_id'),
        ('mo_daily_entry_session_bindings', 'binding_scope'),
        ('mo_daily_entry_session_bindings', 'status'),
        ('mo_daily_entry_session_bindings', 'meta')
)
SELECT COUNT(*) AS missing_required_columns
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = rc.table_name
 AND c.column_name = rc.column_name
WHERE c.column_name IS NULL;

-- 3) 关键约束存在检查。预期：
--    required_constraints_missing = 0
WITH required_constraints(conname) AS (
    VALUES
        ('ck_mo_daily_entry_chat_policies_strategy_enum'),
        ('ck_mo_daily_entry_chat_policies_status_enum'),
        ('ck_mo_daily_entry_session_bindings_binding_scope_enum'),
        ('ck_mo_daily_entry_session_bindings_scope_user_shape'),
        ('fk_mo_daily_entry_session_bindings_policy_external_entry')
)
SELECT COUNT(*) AS required_constraints_missing
FROM required_constraints r
LEFT JOIN pg_constraint c
  ON c.conname = r.conname
WHERE c.conname IS NULL;

-- 4) 关键索引存在检查。预期：
--    required_indexes_missing = 0
WITH required_indexes(indexname) AS (
    VALUES
        ('uq_mo_daily_entry_chat_policies_external_daily_entry'),
        ('idx_mo_daily_entry_chat_policies_provider_status'),
        ('idx_mo_daily_entry_session_bindings_external_daily_entry'),
        ('idx_mo_daily_entry_session_bindings_external_user'),
        ('idx_mo_daily_entry_session_bindings_session_id'),
        ('uq_mo_daily_entry_session_bindings_active_shared'),
        ('uq_mo_daily_entry_session_bindings_active_personal')
)
SELECT COUNT(*) AS required_indexes_missing
FROM required_indexes r
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.tablename IN ('mo_daily_entry_chat_policies', 'mo_daily_entry_session_bindings')
 AND i.indexname = r.indexname
WHERE i.indexname IS NULL;

-- 5) 数据健康检查（空表下应返回 0）。预期：
--    invalid_binding_scope_user_shape = 0
--    dangling_policy_reference = 0
SELECT
    COALESCE(SUM(
        CASE
            WHEN (b.binding_scope = 'SHARED' AND b.user_id IS NULL)
              OR (b.binding_scope = 'PERSONAL' AND b.user_id IS NOT NULL AND btrim(b.user_id) <> '')
            THEN 0 ELSE 1
        END
    ), 0) AS invalid_binding_scope_user_shape,
    COALESCE(SUM(CASE WHEN p.external_daily_entry_id IS NULL THEN 1 ELSE 0 END), 0) AS dangling_policy_reference
FROM mo_daily_entry_session_bindings b
LEFT JOIN mo_daily_entry_chat_policies p
  ON p.external_daily_entry_id = b.external_daily_entry_id;
