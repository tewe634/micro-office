-- V1.1.10 transactional fix SQL
-- 目标：
-- 1) 按 (name, data_key, display_type) 去重 mo_portal_block_templates
-- 2) mo_portal_template_block_refs 全量重定向到 canonical
-- 3) 合并保留 mo_portal_block_template_actions，避免动作丢失
-- 4) 保留回滚所需映射/备份

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(hashtext('v1.1.10.portal_block_dedupe'));

-- ------------------------------
-- Backup tables for rollback
-- ------------------------------
CREATE TABLE IF NOT EXISTS public.mo_v110_block_template_dedupe_map (
    old_block_template_id text PRIMARY KEY,
    canonical_block_template_id text NOT NULL,
    dedupe_name text NOT NULL,
    dedupe_data_key text NOT NULL,
    dedupe_display_type text NOT NULL,
    canonical_reason text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_block_template_backup (
    id text PRIMARY KEY,
    code text NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    scope_type text NOT NULL,
    display_type text NOT NULL,
    data_key text NOT NULL,
    label text NOT NULL,
    meta jsonb NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    created_by text,
    updated_at timestamp with time zone NOT NULL,
    updated_by text,
    backup_reason text NOT NULL,
    backup_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_block_ref_backup (
    id text PRIMARY KEY,
    template_id text NOT NULL,
    section_id text NOT NULL,
    block_template_id text NOT NULL,
    sort_order integer NOT NULL,
    enabled boolean NOT NULL,
    override_meta jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    created_by text,
    updated_at timestamp with time zone NOT NULL,
    updated_by text,
    backup_reason text NOT NULL,
    backup_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_block_action_backup (
    id text PRIMARY KEY,
    block_template_id text NOT NULL,
    action_type text NOT NULL,
    target_subject_type text,
    target_id_path text,
    session_type text,
    sort_order integer NOT NULL,
    meta jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    created_by text,
    updated_at timestamp with time zone NOT NULL,
    updated_by text,
    backup_reason text NOT NULL,
    backup_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_ref_rewrite_log (
    ref_id text PRIMARY KEY,
    old_block_template_id text NOT NULL,
    new_block_template_id text NOT NULL,
    rewritten_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_action_merge_log (
    merged_action_id text PRIMARY KEY,
    canonical_block_template_id text NOT NULL,
    source_action_id text NOT NULL,
    source_block_template_id text NOT NULL,
    merged_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mo_v110_template_ref_count_before (
    template_id text PRIMARY KEY,
    ref_count integer NOT NULL,
    snap_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Idempotent rerun support for the latest run.
TRUNCATE TABLE public.mo_v110_block_template_dedupe_map;
TRUNCATE TABLE public.mo_v110_ref_rewrite_log;
TRUNCATE TABLE public.mo_v110_action_merge_log;
TRUNCATE TABLE public.mo_v110_template_ref_count_before;

INSERT INTO public.mo_v110_template_ref_count_before (template_id, ref_count)
SELECT template_id, COUNT(*)::integer
FROM public.mo_portal_template_block_refs
GROUP BY template_id;

-- ------------------------------
-- Build dedupe map
-- Canonical priority:
-- 1) non-LEGACY (code/id)
-- 2) highest ref_count
-- 3) latest updated_at
-- 4) smallest id
-- ------------------------------
WITH grouped AS (
    SELECT name, data_key, display_type
    FROM public.mo_portal_block_templates
    GROUP BY name, data_key, display_type
    HAVING COUNT(*) > 1
),
ranked AS (
    SELECT
        bt.id,
        bt.name,
        bt.data_key,
        bt.display_type,
        CASE
            WHEN bt.code ~* '^LEGACY_' OR bt.id LIKE 'portal_block_tpl__legacy__%' THEN 1
            ELSE 0
        END AS is_legacy,
        COALESCE((
            SELECT COUNT(*)
            FROM public.mo_portal_template_block_refs br
            WHERE br.block_template_id = bt.id
        ), 0) AS ref_count,
        bt.updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY bt.name, bt.data_key, bt.display_type
            ORDER BY
                CASE WHEN bt.code ~* '^LEGACY_' OR bt.id LIKE 'portal_block_tpl__legacy__%' THEN 1 ELSE 0 END ASC,
                COALESCE((
                    SELECT COUNT(*)
                    FROM public.mo_portal_template_block_refs br2
                    WHERE br2.block_template_id = bt.id
                ), 0) DESC,
                bt.updated_at DESC,
                bt.id ASC
        ) AS rn
    FROM public.mo_portal_block_templates bt
    JOIN grouped g
      ON g.name = bt.name
     AND g.data_key = bt.data_key
     AND g.display_type = bt.display_type
),
canonical AS (
    SELECT
        name,
        data_key,
        display_type,
        id AS canonical_id
    FROM ranked
    WHERE rn = 1
),
mapping AS (
    SELECT
        r.id AS old_id,
        c.canonical_id,
        r.name,
        r.data_key,
        r.display_type,
        CASE
            WHEN r.is_legacy = 1 THEN 'prefer_non_legacy_then_refcount'
            ELSE 'prefer_refcount_recent'
        END AS canonical_reason
    FROM ranked r
    JOIN canonical c
      ON c.name = r.name
     AND c.data_key = r.data_key
     AND c.display_type = r.display_type
    WHERE r.id <> c.canonical_id
)
INSERT INTO public.mo_v110_block_template_dedupe_map (
    old_block_template_id,
    canonical_block_template_id,
    dedupe_name,
    dedupe_data_key,
    dedupe_display_type,
    canonical_reason
)
SELECT old_id, canonical_id, name, data_key, display_type, canonical_reason
FROM mapping;

-- Backups
INSERT INTO public.mo_v110_block_template_backup (
    id, code, name, status, scope_type, display_type, data_key, label, meta, version,
    created_at, created_by, updated_at, updated_by, backup_reason
)
SELECT
    bt.id, bt.code, bt.name, bt.status, bt.scope_type, bt.display_type, bt.data_key, bt.label, bt.meta, bt.version,
    bt.created_at, bt.created_by, bt.updated_at, bt.updated_by, 'DROP_DUPLICATE_BLOCK_TEMPLATE'
FROM public.mo_portal_block_templates bt
JOIN public.mo_v110_block_template_dedupe_map m
  ON m.old_block_template_id = bt.id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mo_v110_block_ref_backup (
    id, template_id, section_id, block_template_id, sort_order, enabled, override_meta,
    created_at, created_by, updated_at, updated_by, backup_reason
)
SELECT
    br.id, br.template_id, br.section_id, br.block_template_id, br.sort_order, br.enabled, br.override_meta,
    br.created_at, br.created_by, br.updated_at, br.updated_by, 'REWRITE_SOURCE_REF'
FROM public.mo_portal_template_block_refs br
JOIN public.mo_v110_block_template_dedupe_map m
  ON m.old_block_template_id = br.block_template_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mo_v110_block_action_backup (
    id, block_template_id, action_type, target_subject_type, target_id_path, session_type, sort_order,
    meta, created_at, created_by, updated_at, updated_by, backup_reason
)
SELECT
    ba.id, ba.block_template_id, ba.action_type, ba.target_subject_type, ba.target_id_path, ba.session_type, ba.sort_order,
    ba.meta, ba.created_at, ba.created_by, ba.updated_at, ba.updated_by, 'SOURCE_TEMPLATE_ACTION'
FROM public.mo_portal_block_template_actions ba
JOIN public.mo_v110_block_template_dedupe_map m
  ON m.old_block_template_id = ba.block_template_id
ON CONFLICT (id) DO NOTHING;

-- ------------------------------
-- Rewire refs (with unique index conflict handling)
-- uq_mo_portal_template_block_refs_section_block (section_id, block_template_id)
-- ------------------------------
CREATE TEMP TABLE tmp_v110_ref_target AS
SELECT
    br.id AS ref_id,
    br.template_id,
    br.section_id,
    br.block_template_id AS old_block_template_id,
    m.canonical_block_template_id AS new_block_template_id,
    ROW_NUMBER() OVER (
        PARTITION BY br.section_id, m.canonical_block_template_id
        ORDER BY br.updated_at DESC, br.created_at DESC, br.id ASC
    ) AS rn
FROM public.mo_portal_template_block_refs br
JOIN public.mo_v110_block_template_dedupe_map m
  ON m.old_block_template_id = br.block_template_id;

-- Backup conflicting rows (that would violate section+block uniqueness after rewrite)
INSERT INTO public.mo_v110_block_ref_backup (
    id, template_id, section_id, block_template_id, sort_order, enabled, override_meta,
    created_at, created_by, updated_at, updated_by, backup_reason
)
SELECT
    br.id, br.template_id, br.section_id, br.block_template_id, br.sort_order, br.enabled, br.override_meta,
    br.created_at, br.created_by, br.updated_at, br.updated_by, 'CONFLICT_DROP_REF'
FROM public.mo_portal_template_block_refs br
JOIN tmp_v110_ref_target t
  ON t.ref_id = br.id
WHERE t.rn > 1
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.mo_portal_template_block_refs br
USING tmp_v110_ref_target t
WHERE br.id = t.ref_id
  AND t.rn > 1;

WITH rewritten AS (
    UPDATE public.mo_portal_template_block_refs br
    SET
        block_template_id = t.new_block_template_id,
        updated_at = now(),
        updated_by = 'migrate_v1_1_10_block_dedupe'
    FROM tmp_v110_ref_target t
    WHERE br.id = t.ref_id
      AND t.rn = 1
      AND br.block_template_id <> t.new_block_template_id
    RETURNING br.id, t.old_block_template_id, t.new_block_template_id
)
INSERT INTO public.mo_v110_ref_rewrite_log (ref_id, old_block_template_id, new_block_template_id)
SELECT id, old_block_template_id, new_block_template_id
FROM rewritten
ON CONFLICT (ref_id) DO UPDATE
SET old_block_template_id = EXCLUDED.old_block_template_id,
    new_block_template_id = EXCLUDED.new_block_template_id,
    rewritten_at = now();

DROP TABLE tmp_v110_ref_target;

-- ------------------------------
-- Merge actions into canonical block templates
-- ------------------------------
WITH source_actions AS (
    SELECT
        m.canonical_block_template_id,
        ba.id AS source_action_id,
        ba.block_template_id AS source_block_template_id,
        ba.action_type,
        ba.target_subject_type,
        ba.target_id_path,
        ba.session_type,
        ba.sort_order,
        ba.meta,
        ba.created_at,
        ba.created_by,
        ba.updated_at,
        ba.updated_by,
        md5(
            COALESCE(ba.action_type, '') || '|' ||
            COALESCE(ba.target_subject_type, '') || '|' ||
            COALESCE(ba.target_id_path, '') || '|' ||
            COALESCE(ba.session_type, '') || '|' ||
            COALESCE(ba.meta::text, '{}')
        ) AS sig
    FROM public.mo_portal_block_template_actions ba
    JOIN public.mo_v110_block_template_dedupe_map m
      ON m.old_block_template_id = ba.block_template_id
),
target_sig AS (
    SELECT
        ba.block_template_id AS canonical_block_template_id,
        md5(
            COALESCE(ba.action_type, '') || '|' ||
            COALESCE(ba.target_subject_type, '') || '|' ||
            COALESCE(ba.target_id_path, '') || '|' ||
            COALESCE(ba.session_type, '') || '|' ||
            COALESCE(ba.meta::text, '{}')
        ) AS sig
    FROM public.mo_portal_block_template_actions ba
    WHERE ba.block_template_id IN (
        SELECT DISTINCT canonical_block_template_id
        FROM public.mo_v110_block_template_dedupe_map
    )
),
candidates AS (
    SELECT
        sa.*,
        ROW_NUMBER() OVER (
            PARTITION BY sa.canonical_block_template_id, sa.sig
            ORDER BY sa.updated_at DESC, sa.created_at DESC, sa.source_action_id ASC
        ) AS pick_rank
    FROM source_actions sa
    LEFT JOIN target_sig ts
      ON ts.canonical_block_template_id = sa.canonical_block_template_id
     AND ts.sig = sa.sig
    WHERE ts.sig IS NULL
),
inserted AS (
    INSERT INTO public.mo_portal_block_template_actions (
        id,
        block_template_id,
        action_type,
        target_subject_type,
        target_id_path,
        session_type,
        sort_order,
        meta,
        created_at,
        created_by,
        updated_at,
        updated_by
    )
    SELECT
        'portal_block_action__merge_v110__' || md5(c.canonical_block_template_id || '__' || c.source_action_id) AS id,
        c.canonical_block_template_id,
        c.action_type,
        c.target_subject_type,
        c.target_id_path,
        c.session_type,
        c.sort_order,
        c.meta || jsonb_build_object(
            'mergedFrom',
            jsonb_build_object(
                'migrationVersion', 'V1.1.10',
                'sourceActionId', c.source_action_id,
                'sourceBlockTemplateId', c.source_block_template_id
            )
        ) AS meta,
        now(),
        'migrate_v1_1_10_block_dedupe',
        now(),
        'migrate_v1_1_10_block_dedupe'
    FROM candidates c
    WHERE c.pick_rank = 1
    ON CONFLICT (id) DO NOTHING
    RETURNING id, block_template_id, meta
)
INSERT INTO public.mo_v110_action_merge_log (
    merged_action_id,
    canonical_block_template_id,
    source_action_id,
    source_block_template_id
)
SELECT
    i.id,
    i.block_template_id,
    i.meta -> 'mergedFrom' ->> 'sourceActionId' AS source_action_id,
    i.meta -> 'mergedFrom' ->> 'sourceBlockTemplateId' AS source_block_template_id
FROM inserted i
ON CONFLICT (merged_action_id) DO NOTHING;

-- ------------------------------
-- Delete duplicate templates (refs already rewired)
-- ------------------------------
DELETE FROM public.mo_portal_block_templates bt
USING public.mo_v110_block_template_dedupe_map m
WHERE bt.id = m.old_block_template_id;

COMMIT;
