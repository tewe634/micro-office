INSERT INTO sales_collab_group (group_key, group_name, domain_key, description, sort_order, enabled)
VALUES ('TECH_COLLAB', '技术协同', 'TECH', '销售与技术共同参与售前、售后技术支持', 10, TRUE)
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
        ('PRE_SALES_SUPPORT', 10),
        ('AFTER_SALES_SUPPORT', 20)
) AS mapping(scene_key, sort_order)
JOIN sales_collab_group g ON g.group_key = 'TECH_COLLAB'
JOIN sales_collab_scene s ON s.scene_key = mapping.scene_key
ON CONFLICT (group_id, scene_id) DO UPDATE
SET sort_order = EXCLUDED.sort_order;

WITH tech_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'TECH_COLLAB'
    LIMIT 1
), legacy_groups AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH')
), legacy_template_rules AS (
    SELECT r.*, ROW_NUMBER() OVER (
        PARTITION BY r.template_id,
                     COALESCE(r.participant_role, ''),
                     COALESCE(r.source_type, ''),
                     COALESCE(r.source_ref_id, ''),
                     COALESCE(r.source_ref_name, ''),
                     COALESCE(r.resolve_scope_type, ''),
                     COALESCE(r.resolve_scope_ref_id, ''),
                     COALESCE(r.duty_label, ''),
                     r.enabled,
                     COALESCE(r.remark, '')
        ORDER BY r.sort_order, r.created_at, r.id
    ) AS rn
    FROM sales_collab_template_rule r
    JOIN legacy_groups lg ON lg.id = r.group_id
)
INSERT INTO sales_collab_template_rule (
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
    remark,
    created_at,
    updated_at
)
SELECT lr.template_id,
       tg.id,
       lr.participant_role,
       lr.source_type,
       lr.source_ref_id,
       lr.source_ref_name,
       lr.resolve_scope_type,
       lr.resolve_scope_ref_id,
       lr.duty_label,
       lr.sort_order,
       lr.enabled,
       lr.remark,
       lr.created_at,
       lr.updated_at
FROM legacy_template_rules lr
CROSS JOIN tech_group tg
WHERE lr.rn = 1
  AND NOT EXISTS (
      SELECT 1
      FROM sales_collab_template_rule existing
      WHERE existing.template_id = lr.template_id
        AND existing.group_id = tg.id
        AND COALESCE(existing.participant_role, '') = COALESCE(lr.participant_role, '')
        AND COALESCE(existing.source_type, '') = COALESCE(lr.source_type, '')
        AND COALESCE(existing.source_ref_id, '') = COALESCE(lr.source_ref_id, '')
        AND COALESCE(existing.source_ref_name, '') = COALESCE(lr.source_ref_name, '')
        AND COALESCE(existing.resolve_scope_type, '') = COALESCE(lr.resolve_scope_type, '')
        AND COALESCE(existing.resolve_scope_ref_id, '') = COALESCE(lr.resolve_scope_ref_id, '')
        AND COALESCE(existing.duty_label, '') = COALESCE(lr.duty_label, '')
        AND existing.enabled = lr.enabled
        AND COALESCE(existing.remark, '') = COALESCE(lr.remark, '')
  );

WITH tech_group AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key = 'TECH_COLLAB'
    LIMIT 1
), legacy_groups AS (
    SELECT id
    FROM sales_collab_group
    WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH')
), legacy_org_rules AS (
    SELECT r.*, ROW_NUMBER() OVER (
        PARTITION BY r.org_id,
                     COALESCE(r.participant_role, ''),
                     COALESCE(r.source_type, ''),
                     COALESCE(r.source_ref_id, ''),
                     COALESCE(r.source_ref_name, ''),
                     COALESCE(r.resolve_scope_type, ''),
                     COALESCE(r.resolve_scope_ref_id, ''),
                     COALESCE(r.duty_label, ''),
                     r.enabled,
                     COALESCE(r.remark, '')
        ORDER BY r.sort_order, r.created_at, r.id
    ) AS rn
    FROM sales_collab_org_rule r
    JOIN legacy_groups lg ON lg.id = r.group_id
)
INSERT INTO sales_collab_org_rule (
    org_id,
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
    remark,
    created_at,
    updated_at
)
SELECT lr.org_id,
       tg.id,
       lr.participant_role,
       lr.source_type,
       lr.source_ref_id,
       lr.source_ref_name,
       lr.resolve_scope_type,
       lr.resolve_scope_ref_id,
       lr.duty_label,
       lr.sort_order,
       lr.enabled,
       lr.remark,
       lr.created_at,
       lr.updated_at
FROM legacy_org_rules lr
CROSS JOIN tech_group tg
WHERE lr.rn = 1
  AND NOT EXISTS (
      SELECT 1
      FROM sales_collab_org_rule existing
      WHERE existing.org_id = lr.org_id
        AND existing.group_id = tg.id
        AND COALESCE(existing.participant_role, '') = COALESCE(lr.participant_role, '')
        AND COALESCE(existing.source_type, '') = COALESCE(lr.source_type, '')
        AND COALESCE(existing.source_ref_id, '') = COALESCE(lr.source_ref_id, '')
        AND COALESCE(existing.source_ref_name, '') = COALESCE(lr.source_ref_name, '')
        AND COALESCE(existing.resolve_scope_type, '') = COALESCE(lr.resolve_scope_type, '')
        AND COALESCE(existing.resolve_scope_ref_id, '') = COALESCE(lr.resolve_scope_ref_id, '')
        AND COALESCE(existing.duty_label, '') = COALESCE(lr.duty_label, '')
        AND existing.enabled = lr.enabled
        AND COALESCE(existing.remark, '') = COALESCE(lr.remark, '')
  );

DELETE FROM sales_collab_template_rule
WHERE group_id IN (
    SELECT id
    FROM sales_collab_group
    WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH')
);

DELETE FROM sales_collab_org_rule
WHERE group_id IN (
    SELECT id
    FROM sales_collab_group
    WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH')
);

DELETE FROM sales_collab_group_scene
WHERE group_id IN (
    SELECT id
    FROM sales_collab_group
    WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH')
);

DELETE FROM sales_collab_group
WHERE group_key IN ('PRE_SALES_TECH', 'AFTER_SALES_TECH');
