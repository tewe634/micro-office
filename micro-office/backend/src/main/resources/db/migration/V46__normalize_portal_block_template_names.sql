-- V1.1.8: normalize portal block template names to asset semantics
-- Goal:
-- 1) Remove legacy/template-derived name styles from mo_portal_block_templates.name
-- 2) Keep block asset names user-readable and template-decoupled
-- 3) Avoid frontend/backend fallback for dirty name display

WITH candidates AS (
    SELECT
        bt.id,
        bt.name AS old_name,
        bt.label,
        CASE
            -- Primary source: label is the intended block asset title.
            WHEN nullif(btrim(bt.label), '') IS NOT NULL THEN btrim(bt.label)
            -- Fallback for "模板名 / 卡片名" style.
            WHEN bt.name ~ '^[^/]+\s*/\s*[^/]+$' THEN btrim(regexp_replace(bt.name, '^.*/\s*', ''))
            -- Fallback for LEGACY/UUID style names.
            ELSE btrim(
                regexp_replace(
                    regexp_replace(
                        bt.name,
                        '(?i)^legacy[_\s-]*',
                        ''
                    ),
                    '(?i)[_-]?[0-9a-f]{8}([_-]?[0-9a-f]{4}){3}[_-]?[0-9a-f]{12}$',
                    ''
                )
            )
        END AS normalized_name
    FROM public.mo_portal_block_templates bt
    WHERE
        bt.meta -> 'legacySource' ->> 'migrationVersion' = 'V44'
        OR bt.name ~* '^legacy[_\s-]*'
        OR bt.name ~ '^[^/]+\s*/\s*[^/]+$'
        OR bt.name ~* '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
),
prepared AS (
    SELECT
        id,
        old_name,
        CASE
            WHEN nullif(normalized_name, '') IS NULL THEN '未命名卡片'
            ELSE normalized_name
        END AS new_name
    FROM candidates
)
UPDATE public.mo_portal_block_templates bt
SET
    name = p.new_name,
    updated_at = now(),
    updated_by = 'migrate_v46_block_template_name_cleanup'
FROM prepared p
WHERE bt.id = p.id
  AND bt.name <> p.new_name;
