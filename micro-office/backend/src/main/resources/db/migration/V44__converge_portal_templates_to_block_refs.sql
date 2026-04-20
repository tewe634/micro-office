-- V1.1.7: converge portal templates to block-template references only
-- Goal:
-- 1) Backfill legacy template items into reusable block template assets
-- 2) Backfill legacy item actions into block-template actions
-- 3) Backfill template block refs so runtime/admin can use the latest model directly
-- 4) Retire legacy item/action tables to avoid long-term dual-path compatibility

-- ------------------------------
-- Backfill block templates from legacy items
-- ------------------------------
INSERT INTO public.mo_portal_block_templates (
    id,
    code,
    name,
    status,
    scope_type,
    display_type,
    data_key,
    label,
    meta,
    version,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    'portal_block_tpl__legacy__' || i.id AS id,
    regexp_replace(
        upper('LEGACY_' || t.code || '_' || coalesce(nullif(i.item_key, ''), 'ITEM') || '_' || i.id),
        '[^A-Z0-9_]+',
        '_',
        'g'
    ) AS code,
    t.name || ' / ' || i.label AS name,
    'ACTIVE' AS status,
    'PORTAL_BLOCK' AS scope_type,
    i.display_type,
    i.data_key,
    i.label,
    i.meta || jsonb_build_object(
        'legacySource',
        jsonb_build_object(
            'migrationVersion', 'V44',
            'sourceTable', 'mo_portal_template_items',
            'templateId', i.template_id,
            'sectionId', i.section_id,
            'itemId', i.id,
            'itemKey', i.item_key
        )
    ) AS meta,
    greatest(coalesce(t.version, 1), 1) AS version,
    i.created_at,
    i.created_by,
    i.updated_at,
    coalesce(i.updated_by, 'migrate_v44_portal_structure')
FROM public.mo_portal_template_items i
JOIN public.mo_portal_templates t
  ON t.id = i.template_id
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    scope_type = EXCLUDED.scope_type,
    display_type = EXCLUDED.display_type,
    data_key = EXCLUDED.data_key,
    label = EXCLUDED.label,
    meta = EXCLUDED.meta,
    version = EXCLUDED.version,
    updated_at = now(),
    updated_by = 'migrate_v44_portal_structure';

-- ------------------------------
-- Backfill block-template actions from legacy item actions
-- ------------------------------
WITH ranked_actions AS (
    SELECT
        ia.id,
        ia.item_id,
        ia.action_type,
        ia.target_subject_type,
        ia.target_id_path,
        ia.session_type,
        ia.meta,
        ia.created_at,
        ia.created_by,
        ia.updated_at,
        ia.updated_by,
        row_number() OVER (
            PARTITION BY ia.item_id
            ORDER BY ia.created_at, ia.id
        ) * 10 AS resolved_sort_order
    FROM public.mo_portal_template_item_actions ia
)
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
    'portal_block_action__legacy__' || ra.id AS id,
    'portal_block_tpl__legacy__' || ra.item_id AS block_template_id,
    ra.action_type,
    ra.target_subject_type,
    ra.target_id_path,
    ra.session_type,
    ra.resolved_sort_order,
    ra.meta || jsonb_build_object(
        'legacySource',
        jsonb_build_object(
            'migrationVersion', 'V44',
            'sourceTable', 'mo_portal_template_item_actions',
            'actionId', ra.id,
            'itemId', ra.item_id
        )
    ) AS meta,
    ra.created_at,
    ra.created_by,
    ra.updated_at,
    coalesce(ra.updated_by, 'migrate_v44_portal_structure')
FROM ranked_actions ra
ON CONFLICT (id) DO UPDATE
SET block_template_id = EXCLUDED.block_template_id,
    action_type = EXCLUDED.action_type,
    target_subject_type = EXCLUDED.target_subject_type,
    target_id_path = EXCLUDED.target_id_path,
    session_type = EXCLUDED.session_type,
    sort_order = EXCLUDED.sort_order,
    meta = EXCLUDED.meta,
    updated_at = now(),
    updated_by = 'migrate_v44_portal_structure';

-- ------------------------------
-- Backfill template block refs from legacy items
-- ------------------------------
INSERT INTO public.mo_portal_template_block_refs (
    id,
    template_id,
    section_id,
    block_template_id,
    sort_order,
    enabled,
    override_meta,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    'portal_block_ref__legacy__' || i.id AS id,
    i.template_id,
    i.section_id,
    'portal_block_tpl__legacy__' || i.id AS block_template_id,
    i.sort_order,
    true AS enabled,
    '{}'::jsonb AS override_meta,
    i.created_at,
    i.created_by,
    i.updated_at,
    coalesce(i.updated_by, 'migrate_v44_portal_structure')
FROM public.mo_portal_template_items i
ON CONFLICT (id) DO UPDATE
SET template_id = EXCLUDED.template_id,
    section_id = EXCLUDED.section_id,
    block_template_id = EXCLUDED.block_template_id,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    override_meta = EXCLUDED.override_meta,
    updated_at = now(),
    updated_by = 'migrate_v44_portal_structure';

-- ------------------------------
-- Guardrail: fail the migration if any legacy row was not mapped
-- ------------------------------
DO $$
DECLARE
    missing_item_count integer;
    missing_action_count integer;
BEGIN
    SELECT COUNT(*)
    INTO missing_item_count
    FROM public.mo_portal_template_items i
    LEFT JOIN public.mo_portal_block_templates bt
      ON bt.id = 'portal_block_tpl__legacy__' || i.id
    LEFT JOIN public.mo_portal_template_block_refs br
      ON br.id = 'portal_block_ref__legacy__' || i.id
    WHERE bt.id IS NULL
       OR br.id IS NULL;

    SELECT COUNT(*)
    INTO missing_action_count
    FROM public.mo_portal_template_item_actions ia
    LEFT JOIN public.mo_portal_block_template_actions ba
      ON ba.id = 'portal_block_action__legacy__' || ia.id
    WHERE ba.id IS NULL;

    IF missing_item_count > 0 OR missing_action_count > 0 THEN
        RAISE EXCEPTION
            'V44 legacy portal migration incomplete: missing_item_count=%, missing_action_count=%',
            missing_item_count,
            missing_action_count;
    END IF;
END $$;

-- ------------------------------
-- Retirement: legacy embedded item/action path is no longer kept
-- ------------------------------
DROP TABLE IF EXISTS public.mo_portal_template_item_actions;
DROP TABLE IF EXISTS public.mo_portal_template_items;
