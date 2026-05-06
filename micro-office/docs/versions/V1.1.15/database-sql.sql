-- V1.1.15 readonly validation SQL
-- Goal: verify mo_user_external_accounts is the user binding source and constraints are healthy.

-- 1) Table exists. Expected: table_name is not null.
SELECT to_regclass('public.mo_user_external_accounts') AS table_name;

-- 2) Required columns exist. Expected: missing_required_columns = 0.
WITH required_columns(column_name) AS (
    VALUES
        ('id'),
        ('user_id'),
        ('provider'),
        ('corp_id'),
        ('external_user_id'),
        ('status'),
        ('bound_at'),
        ('meta'),
        ('created_at'),
        ('updated_at'),
        ('version')
)
SELECT COUNT(*) AS missing_required_columns
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'mo_user_external_accounts'
 AND c.column_name = r.column_name
WHERE c.column_name IS NULL;

-- 3) Required constraints and indexes exist. Expected: all missing counts are 0.
WITH required_constraints(conname) AS (
    VALUES
        ('mo_user_external_accounts_pkey'),
        ('ck_mo_user_external_accounts_provider'),
        ('ck_mo_user_external_accounts_status'),
        ('uq_mo_user_external_accounts_provider_external'),
        ('uq_mo_user_external_accounts_user_provider_corp')
),
required_indexes(indexname) AS (
    VALUES
        ('idx_mo_user_external_accounts_user'),
        ('idx_mo_user_external_accounts_lookup')
)
SELECT
    (SELECT COUNT(*)
     FROM required_constraints r
     LEFT JOIN pg_constraint c ON c.conname = r.conname
     WHERE c.conname IS NULL) AS missing_required_constraints,
    (SELECT COUNT(*)
     FROM required_indexes r
     LEFT JOIN pg_indexes i
       ON i.schemaname = 'public'
      AND i.tablename = 'mo_user_external_accounts'
      AND i.indexname = r.indexname
     WHERE i.indexname IS NULL) AS missing_required_indexes;

-- 4) Binding model guardrails (user binding only). Expected:
--    has_position_id_column = 0, has_binding_position_table = null.
SELECT
    (SELECT COUNT(*)
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'mo_user_external_accounts'
       AND column_name = 'position_id') AS has_position_id_column,
    to_regclass('public.mo_position_external_accounts') AS has_binding_position_table;

-- 5) Data quality checks. Expected: all violation counts are 0.
SELECT
    COUNT(*) FILTER (WHERE provider <> 'DINGTALK') AS invalid_provider_count,
    COUNT(*) FILTER (WHERE status NOT IN ('ACTIVE','UNBOUND')) AS invalid_status_count,
    COUNT(*) FILTER (WHERE btrim(user_id) = '') AS blank_user_id_count,
    COUNT(*) FILTER (WHERE btrim(corp_id) = '') AS blank_corp_id_count,
    COUNT(*) FILTER (WHERE btrim(external_user_id) = '') AS blank_external_user_id_count
FROM mo_user_external_accounts;

-- 6) Uniqueness collision pre-check. Expected: duplicate counts are 0.
SELECT COUNT(*) AS duplicate_provider_external_pairs
FROM (
    SELECT provider, corp_id, external_user_id, COUNT(*) AS cnt
    FROM mo_user_external_accounts
    GROUP BY provider, corp_id, external_user_id
    HAVING COUNT(*) > 1
) t;

SELECT COUNT(*) AS duplicate_user_provider_corp_pairs
FROM (
    SELECT user_id, provider, corp_id, COUNT(*) AS cnt
    FROM mo_user_external_accounts
    GROUP BY user_id, provider, corp_id
    HAVING COUNT(*) > 1
) t;
