INSERT INTO sales_collab_group (group_key, group_name, domain_key, description, sort_order, enabled)
VALUES
    ('COMMERCIAL_ASSISTANT', '商务单证·助理协同', 'COMMERCIAL', '在询价、报价、合同场景中单独配置助理协同人员', 30, TRUE),
    ('COMMERCIAL_BUSINESS', '商务单证·商务协同', 'COMMERCIAL', '在询价、报价、合同场景中单独配置商务协同人员', 31, TRUE),
    ('COMMERCIAL_FINANCE', '商务单证·财务协同', 'COMMERCIAL', '在询价、报价、合同场景中单独配置财务协同人员', 32, TRUE)
ON CONFLICT (group_key) DO UPDATE
SET group_name = EXCLUDED.group_name,
    domain_key = EXCLUDED.domain_key,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();

INSERT INTO sales_collab_group_scene (group_id, scene_id, sort_order)
SELECT g.id, s.id, mapping.sort_order
FROM (
    VALUES
        ('COMMERCIAL_ASSISTANT', 'INQUIRY', 30),
        ('COMMERCIAL_ASSISTANT', 'QUOTATION', 40),
        ('COMMERCIAL_ASSISTANT', 'CONTRACT', 50),
        ('COMMERCIAL_BUSINESS', 'INQUIRY', 30),
        ('COMMERCIAL_BUSINESS', 'QUOTATION', 40),
        ('COMMERCIAL_BUSINESS', 'CONTRACT', 50),
        ('COMMERCIAL_FINANCE', 'INQUIRY', 30),
        ('COMMERCIAL_FINANCE', 'QUOTATION', 40),
        ('COMMERCIAL_FINANCE', 'CONTRACT', 50)
) AS mapping(group_key, scene_key, sort_order)
JOIN sales_collab_group g ON g.group_key = mapping.group_key
JOIN sales_collab_scene s ON s.scene_key = mapping.scene_key
ON CONFLICT (group_id, scene_id) DO NOTHING;

WITH old_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'COMMERCIAL_DOCS'
), new_groups AS (
    SELECT id, group_key
    FROM sales_collab_group
    WHERE group_key IN ('COMMERCIAL_ASSISTANT', 'COMMERCIAL_BUSINESS', 'COMMERCIAL_FINANCE')
)
INSERT INTO sales_collab_template_rule (
    id, template_id, group_id, participant_role, source_type, source_ref_id, source_ref_name,
    resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    r.template_id,
    ng.id,
    r.participant_role,
    r.source_type,
    r.source_ref_id,
    r.source_ref_name,
    r.resolve_scope_type,
    r.resolve_scope_ref_id,
    r.duty_label,
    r.sort_order,
    r.enabled,
    r.remark,
    r.created_at,
    NOW()
FROM sales_collab_template_rule r
JOIN old_group og ON og.id = r.group_id
CROSS JOIN new_groups ng
WHERE NOT EXISTS (
    SELECT 1
    FROM sales_collab_template_rule existing
    WHERE existing.template_id = r.template_id
      AND existing.group_id = ng.id
      AND COALESCE(existing.participant_role, '') = COALESCE(r.participant_role, '')
      AND COALESCE(existing.source_type, '') = COALESCE(r.source_type, '')
      AND COALESCE(existing.source_ref_id, '') = COALESCE(r.source_ref_id, '')
      AND COALESCE(existing.source_ref_name, '') = COALESCE(r.source_ref_name, '')
      AND COALESCE(existing.resolve_scope_type, '') = COALESCE(r.resolve_scope_type, '')
      AND COALESCE(existing.resolve_scope_ref_id, '') = COALESCE(r.resolve_scope_ref_id, '')
      AND COALESCE(existing.duty_label, '') = COALESCE(r.duty_label, '')
      AND COALESCE(existing.sort_order, -1) = COALESCE(r.sort_order, -1)
      AND COALESCE(existing.enabled, FALSE) = COALESCE(r.enabled, FALSE)
      AND COALESCE(existing.remark, '') = COALESCE(r.remark, '')
);

WITH old_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'COMMERCIAL_DOCS'
), new_groups AS (
    SELECT id, group_key
    FROM sales_collab_group
    WHERE group_key IN ('COMMERCIAL_ASSISTANT', 'COMMERCIAL_BUSINESS', 'COMMERCIAL_FINANCE')
)
INSERT INTO sales_collab_org_rule (
    id, org_id, group_id, participant_role, source_type, source_ref_id, source_ref_name,
    resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    r.org_id,
    ng.id,
    r.participant_role,
    r.source_type,
    r.source_ref_id,
    r.source_ref_name,
    r.resolve_scope_type,
    r.resolve_scope_ref_id,
    r.duty_label,
    r.sort_order,
    r.enabled,
    r.remark,
    r.created_at,
    NOW()
FROM sales_collab_org_rule r
JOIN old_group og ON og.id = r.group_id
CROSS JOIN new_groups ng
WHERE NOT EXISTS (
    SELECT 1
    FROM sales_collab_org_rule existing
    WHERE existing.org_id = r.org_id
      AND existing.group_id = ng.id
      AND COALESCE(existing.participant_role, '') = COALESCE(r.participant_role, '')
      AND COALESCE(existing.source_type, '') = COALESCE(r.source_type, '')
      AND COALESCE(existing.source_ref_id, '') = COALESCE(r.source_ref_id, '')
      AND COALESCE(existing.source_ref_name, '') = COALESCE(r.source_ref_name, '')
      AND COALESCE(existing.resolve_scope_type, '') = COALESCE(r.resolve_scope_type, '')
      AND COALESCE(existing.resolve_scope_ref_id, '') = COALESCE(r.resolve_scope_ref_id, '')
      AND COALESCE(existing.duty_label, '') = COALESCE(r.duty_label, '')
      AND COALESCE(existing.sort_order, -1) = COALESCE(r.sort_order, -1)
      AND COALESCE(existing.enabled, FALSE) = COALESCE(r.enabled, FALSE)
      AND COALESCE(existing.remark, '') = COALESCE(r.remark, '')
);

DELETE FROM sales_collab_group
WHERE group_key = 'COMMERCIAL_DOCS';
