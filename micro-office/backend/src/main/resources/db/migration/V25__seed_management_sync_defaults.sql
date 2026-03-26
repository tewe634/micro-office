WITH management_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'MANAGEMENT_SYNC'
    LIMIT 1
), default_rules AS (
    SELECT 'LEADER'::varchar AS source_type,
           NULL::varchar AS source_ref_id,
           '领导'::varchar AS source_ref_name,
           'CURRENT_SALES_DEPT'::varchar AS resolve_scope_type,
           NULL::varchar AS resolve_scope_ref_id,
           10 AS sort_order
    UNION ALL
    SELECT 'LEADER'::varchar,
           NULL::varchar,
           '领导'::varchar,
           'CURRENT_SALES_REGION'::varchar,
           NULL::varchar,
           20
), sales_system_org AS (
    SELECT id
    FROM organization
    WHERE name = '销售体系'
    LIMIT 1
), fixed_org_rule AS (
    SELECT 'LEADER'::varchar AS source_type,
           NULL::varchar AS source_ref_id,
           '领导'::varchar AS source_ref_name,
           'FIXED_ORG'::varchar AS resolve_scope_type,
           id::varchar AS resolve_scope_ref_id,
           30 AS sort_order
    FROM sales_system_org
), all_default_rules AS (
    SELECT * FROM default_rules
    UNION ALL
    SELECT * FROM fixed_org_rule
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
       t.id,
       mg.id,
       'COLLABORATOR',
       d.source_type,
       d.source_ref_id,
       d.source_ref_name,
       d.resolve_scope_type,
       d.resolve_scope_ref_id,
       NULL,
       d.sort_order,
       TRUE,
       NULL
FROM sales_collab_template t
CROSS JOIN management_group mg
JOIN all_default_rules d ON TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM sales_collab_template_rule r
    WHERE r.template_id = t.id
      AND r.group_id = mg.id
      AND COALESCE(r.source_type, '') = COALESCE(d.source_type, '')
      AND COALESCE(r.source_ref_id, '') = COALESCE(d.source_ref_id, '')
      AND COALESCE(r.source_ref_name, '') = COALESCE(d.source_ref_name, '')
      AND COALESCE(r.resolve_scope_type, '') = COALESCE(d.resolve_scope_type, '')
      AND COALESCE(r.resolve_scope_ref_id, '') = COALESCE(d.resolve_scope_ref_id, '')
      AND COALESCE(r.remark, '') = ''
);
