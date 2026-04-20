-- V1.1.11: converge daily-entry domain semantics to mo_daily_categories
-- Goal:
-- 1) mo_daily_categories becomes the single main table for daily-entry master data
-- 2) mo_daily_entry_targets / chat_policies / session_bindings all bind to category entry id semantics
-- 3) avoid long-term dual-fact paths with mo_daily_entries

-- ------------------------------
-- Step 1: rename policy/binding key column to daily_entry_id
-- ------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_daily_entry_chat_policies'
          AND column_name = 'external_daily_entry_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_daily_entry_chat_policies'
          AND column_name = 'daily_entry_id'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            RENAME COLUMN external_daily_entry_id TO daily_entry_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_daily_entry_session_bindings'
          AND column_name = 'external_daily_entry_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_daily_entry_session_bindings'
          AND column_name = 'daily_entry_id'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            RENAME COLUMN external_daily_entry_id TO daily_entry_id;
    END IF;
END $$;

-- ------------------------------
-- Step 2: backfill target refs from old mo_daily_entries ids to category ids
-- Mapping strategy:
-- 1) code(case-insensitive) direct match
-- 2) name exact match
-- 3) explicit alias: REIMBURSE -> expense
-- ------------------------------
ALTER TABLE public.mo_daily_entry_targets
    DROP CONSTRAINT IF EXISTS fk_mo_daily_entry_targets_entry;

DO $$
DECLARE
    unmapped_count integer;
    ambiguous_count integer;
BEGIN
    WITH old_entry_in_targets AS (
        SELECT DISTINCT t.daily_entry_id
        FROM public.mo_daily_entry_targets t
        JOIN public.mo_daily_entries e
          ON e.id = t.daily_entry_id
    ),
    mapped_candidates AS (
        SELECT
            e.id AS old_entry_id,
            c.id AS category_id
        FROM old_entry_in_targets x
        JOIN public.mo_daily_entries e
          ON e.id = x.daily_entry_id
        JOIN public.mo_daily_categories c
          ON lower(c.code) = lower(e.code)
          OR c.name = e.name
          OR (upper(e.code) = 'REIMBURSE' AND lower(c.code) = 'expense')
    ),
    mapped_stats AS (
        SELECT
            old_entry_id,
            COUNT(DISTINCT category_id) AS match_count
        FROM mapped_candidates
        GROUP BY old_entry_id
    )
    SELECT COUNT(*)
    INTO unmapped_count
    FROM old_entry_in_targets x
    LEFT JOIN mapped_stats s
      ON s.old_entry_id = x.daily_entry_id
    WHERE COALESCE(s.match_count, 0) = 0;

    WITH old_entry_in_targets AS (
        SELECT DISTINCT t.daily_entry_id
        FROM public.mo_daily_entry_targets t
        JOIN public.mo_daily_entries e
          ON e.id = t.daily_entry_id
    ),
    mapped_candidates AS (
        SELECT
            e.id AS old_entry_id,
            c.id AS category_id
        FROM old_entry_in_targets x
        JOIN public.mo_daily_entries e
          ON e.id = x.daily_entry_id
        JOIN public.mo_daily_categories c
          ON lower(c.code) = lower(e.code)
          OR c.name = e.name
          OR (upper(e.code) = 'REIMBURSE' AND lower(c.code) = 'expense')
    ),
    mapped_stats AS (
        SELECT
            old_entry_id,
            COUNT(DISTINCT category_id) AS match_count
        FROM mapped_candidates
        GROUP BY old_entry_id
    )
    SELECT COUNT(*)
    INTO ambiguous_count
    FROM mapped_stats
    WHERE match_count > 1;

    IF unmapped_count > 0 OR ambiguous_count > 0 THEN
        RAISE EXCEPTION
            'V49 mapping check failed: unmapped_count=%, ambiguous_count=%',
            unmapped_count,
            ambiguous_count;
    END IF;
END $$;

WITH old_entry_in_targets AS (
    SELECT DISTINCT t.daily_entry_id
    FROM public.mo_daily_entry_targets t
    JOIN public.mo_daily_entries e
      ON e.id = t.daily_entry_id
),
mapped_candidates AS (
    SELECT
        e.id AS old_entry_id,
        c.id AS category_id,
        ROW_NUMBER() OVER (
            PARTITION BY e.id
            ORDER BY
                CASE WHEN lower(c.code) = lower(e.code) THEN 1 ELSE 2 END,
                CASE WHEN c.name = e.name THEN 1 ELSE 2 END,
                c.id
        ) AS rn
    FROM old_entry_in_targets x
    JOIN public.mo_daily_entries e
      ON e.id = x.daily_entry_id
    JOIN public.mo_daily_categories c
      ON lower(c.code) = lower(e.code)
      OR c.name = e.name
      OR (upper(e.code) = 'REIMBURSE' AND lower(c.code) = 'expense')
),
final_map AS (
    SELECT old_entry_id, category_id
    FROM mapped_candidates
    WHERE rn = 1
)
UPDATE public.mo_daily_entry_targets t
SET
    daily_entry_id = m.category_id,
    updated_at = now(),
    updated_by = 'migrate_v49_daily_domain_converge'
FROM final_map m
WHERE t.daily_entry_id = m.old_entry_id;

-- ------------------------------
-- Step 3: rebind constraints/FKs/indexes to category semantics
-- ------------------------------
ALTER TABLE public.mo_daily_entry_targets
    DROP CONSTRAINT IF EXISTS fk_mo_daily_entry_chat_policies_category;

ALTER TABLE public.mo_daily_entry_session_bindings
    DROP CONSTRAINT IF EXISTS fk_mo_daily_entry_session_bindings_policy_external_entry;

ALTER TABLE public.mo_daily_entry_session_bindings
    DROP CONSTRAINT IF EXISTS fk_mo_daily_entry_session_bindings_policy_daily_entry;

ALTER TABLE public.mo_daily_entry_chat_policies
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_chat_policies_external_daily_entry_not_blank;

ALTER TABLE public.mo_daily_entry_session_bindings
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_session_bindings_external_daily_entry_not_bla;

ALTER TABLE public.mo_daily_entry_session_bindings
    DROP CONSTRAINT IF EXISTS ck_mo_daily_entry_session_bindings_external_daily_entry_not_blank;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_daily_entry_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_daily_entry_not_blank
            CHECK (btrim(daily_entry_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_daily_entry_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_daily_entry_not_blank
            CHECK (btrim(daily_entry_id) <> '');
    END IF;

END $$;

DROP INDEX IF EXISTS public.uq_mo_daily_entry_chat_policies_external_daily_entry;
DROP INDEX IF EXISTS public.idx_mo_daily_entry_session_bindings_external_daily_entry;
DROP INDEX IF EXISTS public.idx_mo_daily_entry_session_bindings_external_user;
DROP INDEX IF EXISTS public.uq_mo_daily_entry_session_bindings_active_shared;
DROP INDEX IF EXISTS public.uq_mo_daily_entry_session_bindings_active_personal;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_chat_policies_daily_entry
    ON public.mo_daily_entry_chat_policies (daily_entry_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_session_bindings_daily_entry
    ON public.mo_daily_entry_session_bindings (daily_entry_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_session_bindings_daily_entry_user
    ON public.mo_daily_entry_session_bindings (daily_entry_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_session_bindings_active_shared
    ON public.mo_daily_entry_session_bindings (daily_entry_id)
    WHERE binding_scope = 'SHARED' AND status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_session_bindings_active_personal
    ON public.mo_daily_entry_session_bindings (daily_entry_id, user_id)
    WHERE binding_scope = 'PERSONAL' AND status = 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_targets_category'
    ) THEN
        ALTER TABLE public.mo_daily_entry_targets
            ADD CONSTRAINT fk_mo_daily_entry_targets_category
            FOREIGN KEY (daily_entry_id)
            REFERENCES public.mo_daily_categories(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_chat_policies_category'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT fk_mo_daily_entry_chat_policies_category
            FOREIGN KEY (daily_entry_id)
            REFERENCES public.mo_daily_categories(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_session_bindings_policy_daily_entry'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT fk_mo_daily_entry_session_bindings_policy_daily_entry
            FOREIGN KEY (daily_entry_id)
            REFERENCES public.mo_daily_entry_chat_policies(daily_entry_id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

ALTER TABLE public.mo_daily_entry_targets
    VALIDATE CONSTRAINT fk_mo_daily_entry_targets_category;

ALTER TABLE public.mo_daily_entry_chat_policies
    VALIDATE CONSTRAINT fk_mo_daily_entry_chat_policies_category;

ALTER TABLE public.mo_daily_entry_session_bindings
    VALIDATE CONSTRAINT fk_mo_daily_entry_session_bindings_policy_daily_entry;
