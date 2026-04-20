-- V1.1.11 readonly validation SQL
-- 目标：验证“日常条目管理”主表与关系表职责已收敛到 mo_daily_categories 语义

-- 1) 主表重复 code 检查。预期：
--    duplicate_category_code_count = 0
SELECT COUNT(*) AS duplicate_category_code_count
FROM (
    SELECT code
    FROM mo_daily_categories
    GROUP BY code
    HAVING COUNT(*) > 1
) t;

-- 2) 范围表悬挂引用检查（targets -> categories）。预期：
--    target_dangling_count = 0
SELECT COUNT(*) AS target_dangling_count
FROM mo_daily_entry_targets t
LEFT JOIN mo_daily_categories c
  ON c.id = t.daily_entry_id
WHERE c.id IS NULL;

-- 3) 聊天策略悬挂引用检查（policies -> categories）。预期：
--    policy_dangling_count = 0
SELECT COUNT(*) AS policy_dangling_count
FROM mo_daily_entry_chat_policies p
LEFT JOIN mo_daily_categories c
  ON c.id = p.daily_entry_id
WHERE c.id IS NULL;

-- 4) 会话绑定形状与策略引用检查。预期：
--    binding_shape_invalid_count = 0
--    binding_policy_dangling_count = 0
SELECT
    COALESCE(SUM(
        CASE
            WHEN (b.binding_scope = 'SHARED' AND b.user_id IS NULL)
              OR (b.binding_scope = 'PERSONAL' AND b.user_id IS NOT NULL AND btrim(b.user_id) <> '')
            THEN 0 ELSE 1
        END
    ), 0) AS binding_shape_invalid_count,
    COALESCE(SUM(CASE WHEN p.daily_entry_id IS NULL THEN 1 ELSE 0 END), 0) AS binding_policy_dangling_count
FROM mo_daily_entry_session_bindings b
LEFT JOIN mo_daily_entry_chat_policies p
  ON p.daily_entry_id = b.daily_entry_id;

-- 5) 旧主表依赖检查（targets/policies/bindings 不应再 FK 到 mo_daily_entries）。预期：
--    fk_to_old_entries_count = 0
SELECT COUNT(*) AS fk_to_old_entries_count
FROM pg_constraint c
JOIN pg_class src ON src.oid = c.conrelid
JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
JOIN pg_class tgt ON tgt.oid = c.confrelid
JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
WHERE c.contype = 'f'
  AND src_ns.nspname = 'public'
  AND tgt_ns.nspname = 'public'
  AND src.relname IN ('mo_daily_entry_targets', 'mo_daily_entry_chat_policies', 'mo_daily_entry_session_bindings')
  AND tgt.relname = 'mo_daily_entries';

-- 6) 关键约束/索引检查。预期：
--    required_constraints_missing = 0
--    required_indexes_missing = 0
WITH required_constraints(conname) AS (
    VALUES
        ('fk_mo_daily_entry_targets_category'),
        ('fk_mo_daily_entry_chat_policies_category'),
        ('fk_mo_daily_entry_session_bindings_policy_daily_entry'),
        ('ck_mo_daily_entry_session_bindings_scope_user_shape')
),
required_indexes(indexname) AS (
    VALUES
        ('uq_mo_daily_categories_code'),
        ('uq_mo_daily_entry_targets_entry_target'),
        ('uq_mo_daily_entry_chat_policies_daily_entry'),
        ('idx_mo_daily_entry_session_bindings_daily_entry'),
        ('idx_mo_daily_entry_session_bindings_daily_entry_user'),
        ('idx_mo_daily_entry_session_bindings_session_id'),
        ('uq_mo_daily_entry_session_bindings_active_shared'),
        ('uq_mo_daily_entry_session_bindings_active_personal')
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
