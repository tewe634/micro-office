WITH management_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'MANAGEMENT_SYNC'
    LIMIT 1
), sales_system_org AS (
    SELECT id
    FROM organization
    WHERE name = '销售体系'
    LIMIT 1
)
UPDATE sales_collab_template_rule r
SET source_ref_name = '领导',
    enabled = TRUE,
    sort_order = CASE r.resolve_scope_type
        WHEN 'CURRENT_SALES_DEPT' THEN 10
        WHEN 'CURRENT_SALES_REGION' THEN 20
        WHEN 'FIXED_ORG' THEN 30
        ELSE r.sort_order
    END,
    resolve_scope_ref_id = CASE
        WHEN r.resolve_scope_type = 'FIXED_ORG' AND (r.resolve_scope_ref_id IS NULL OR BTRIM(r.resolve_scope_ref_id) = '') THEN sso.id
        ELSE r.resolve_scope_ref_id
    END,
    updated_at = NOW()
FROM management_group mg
LEFT JOIN sales_system_org sso ON TRUE
WHERE r.group_id = mg.id
  AND r.source_type = 'LEADER';

WITH management_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'MANAGEMENT_SYNC'
    LIMIT 1
), template_ids AS (
    SELECT id AS template_id
    FROM sales_collab_template
), expected_rules AS (
    SELECT template_id,
           'CURRENT_SALES_DEPT'::varchar AS resolve_scope_type,
           NULL::varchar AS resolve_scope_ref_id,
           10 AS sort_order
    FROM template_ids
    UNION ALL
    SELECT template_id,
           'CURRENT_SALES_REGION'::varchar,
           NULL::varchar,
           20
    FROM template_ids
    UNION ALL
    SELECT t.template_id,
           'FIXED_ORG'::varchar,
           sso.id::varchar,
           30
    FROM template_ids t
    JOIN organization sso ON sso.name = '销售体系'
)
INSERT INTO sales_collab_template_rule (
    id,
    template_id,
    group_id,
    participant_role,
    source_type,
    source_ref_id,
    source_ref_name,
    resolve_scope_type,
    resolve_scope_ref_id,
    duty_label,
    sort_order,
    enabled,
    remark
)
SELECT gen_random_uuid()::text,
       er.template_id,
       mg.id,
       'COLLABORATOR',
       'LEADER',
       NULL,
       '领导',
       er.resolve_scope_type,
       er.resolve_scope_ref_id,
       NULL,
       er.sort_order,
       TRUE,
       NULL
FROM expected_rules er
CROSS JOIN management_group mg
WHERE NOT EXISTS (
    SELECT 1
    FROM sales_collab_template_rule existing
    WHERE existing.template_id = er.template_id
      AND existing.group_id = mg.id
      AND existing.source_type = 'LEADER'
      AND COALESCE(existing.resolve_scope_type, '') = COALESCE(er.resolve_scope_type, '')
      AND COALESCE(existing.resolve_scope_ref_id, '') = COALESCE(er.resolve_scope_ref_id, '')
);
