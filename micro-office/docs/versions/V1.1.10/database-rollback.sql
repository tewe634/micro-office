-- V1.1.10 rollback SQL
-- 依赖：database-fix.sql 已创建并写入备份表

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(hashtext('v1.1.10.portal_block_dedupe.rollback'));

-- 1) 恢复被删除的 block templates
INSERT INTO public.mo_portal_block_templates (
    id, code, name, status, scope_type, display_type, data_key, label, meta, version,
    created_at, created_by, updated_at, updated_by
)
SELECT
    b.id, b.code, b.name, b.status, b.scope_type, b.display_type, b.data_key, b.label, b.meta, b.version,
    b.created_at, b.created_by, b.updated_at, b.updated_by
FROM public.mo_v110_block_template_backup b
JOIN public.mo_v110_block_template_dedupe_map m
  ON m.old_block_template_id = b.id
ON CONFLICT (id) DO NOTHING;

-- 2) 删除本次 merge 新增动作
DELETE FROM public.mo_portal_block_template_actions a
USING public.mo_v110_action_merge_log l
WHERE a.id = l.merged_action_id;

-- 3) 恢复源模板动作
INSERT INTO public.mo_portal_block_template_actions (
    id, block_template_id, action_type, target_subject_type, target_id_path, session_type,
    sort_order, meta, created_at, created_by, updated_at, updated_by
)
SELECT
    b.id, b.block_template_id, b.action_type, b.target_subject_type, b.target_id_path, b.session_type,
    b.sort_order, b.meta, b.created_at, b.created_by, b.updated_at, b.updated_by
FROM public.mo_v110_block_action_backup b
WHERE b.backup_reason = 'SOURCE_TEMPLATE_ACTION'
ON CONFLICT (id) DO UPDATE
SET block_template_id = EXCLUDED.block_template_id,
    action_type = EXCLUDED.action_type,
    target_subject_type = EXCLUDED.target_subject_type,
    target_id_path = EXCLUDED.target_id_path,
    session_type = EXCLUDED.session_type,
    sort_order = EXCLUDED.sort_order,
    meta = EXCLUDED.meta,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

-- 4) 恢复 refs（包含 rewrite 与 conflict-drop）
INSERT INTO public.mo_portal_template_block_refs (
    id, template_id, section_id, block_template_id, sort_order, enabled, override_meta,
    created_at, created_by, updated_at, updated_by
)
SELECT
    b.id, b.template_id, b.section_id, b.block_template_id, b.sort_order, b.enabled, b.override_meta,
    b.created_at, b.created_by, b.updated_at, b.updated_by
FROM public.mo_v110_block_ref_backup b
ON CONFLICT (id) DO UPDATE
SET template_id = EXCLUDED.template_id,
    section_id = EXCLUDED.section_id,
    block_template_id = EXCLUDED.block_template_id,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    override_meta = EXCLUDED.override_meta,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

COMMIT;
