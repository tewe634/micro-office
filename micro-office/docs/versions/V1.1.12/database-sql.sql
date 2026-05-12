-- V1.1.12 readonly validation SQL
-- Goal: verify node-design / workflow-orchestration decoupling without new tables.

-- 1) Key tables exist. Expected: all not null.
SELECT
    to_regclass('public.mo_workflow_recommendation_package_nodes') AS nodes_table,
    to_regclass('public.mo_workflow_recommendation_packages') AS packages_table,
    to_regclass('public.mo_workflow_template_node_input_fields') AS input_fields_table,
    to_regclass('public.mo_workflow_template_node_output_fields') AS output_fields_table,
    to_regclass('public.mo_workflow_template_node_recommendations') AS recommendation_table;

-- 2) package_id nullability in node table. Expected: package_id_nullable = YES.
SELECT
    column_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mo_workflow_recommendation_package_nodes'
  AND column_name = 'package_id';

-- 3) Required constraints/indexes after decoupling.
-- Expected:
--   has_unique_code_constraint = 1
--   has_parent_fk = 1
--   has_parent_requires_pkg_check = 1
--   has_scope_sequence_idx = 1
--   has_unbound_idx = 1
SELECT
    (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'uq_mo_workflow_recommendation_package_nodes_code') AS has_unique_code_constraint,
    (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'fk_mo_workflow_recommendation_package_nodes_parent') AS has_parent_fk,
    (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'ck_mo_wf_pkg_nodes_parent_requires_pkg') AS has_parent_requires_pkg_check,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_mo_workflow_recommendation_package_nodes_scope_sequence') AS has_scope_sequence_idx,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname='idx_mo_workflow_recommendation_package_nodes_unbound') AS has_unbound_idx;

-- 4) Data-quality checks for split semantics.
-- Expected:
--   parent_without_package_count = 0
--   dangling_parent_count = 0
--   input_dangling_count = 0
--   output_dangling_count = 0
--   recommendation_dangling_count = 0
SELECT
    (SELECT COUNT(*)
     FROM mo_workflow_recommendation_package_nodes n
     WHERE n.parent_package_node_id IS NOT NULL
       AND n.package_id IS NULL) AS parent_without_package_count,
    (SELECT COUNT(*)
     FROM mo_workflow_recommendation_package_nodes n
     LEFT JOIN mo_workflow_recommendation_package_nodes p
       ON p.id = n.parent_package_node_id
     WHERE n.parent_package_node_id IS NOT NULL
       AND p.id IS NULL) AS dangling_parent_count,
    (SELECT COUNT(*)
     FROM mo_workflow_template_node_input_fields f
     LEFT JOIN mo_workflow_recommendation_package_nodes n
       ON n.id = f.node_template_id
     WHERE n.id IS NULL) AS input_dangling_count,
    (SELECT COUNT(*)
     FROM mo_workflow_template_node_output_fields f
     LEFT JOIN mo_workflow_recommendation_package_nodes n
       ON n.id = f.node_template_id
     WHERE n.id IS NULL) AS output_dangling_count,
    (SELECT COUNT(*)
     FROM mo_workflow_template_node_recommendations r
     LEFT JOIN mo_workflow_recommendation_package_nodes n
       ON n.id = r.current_node_template_id
     WHERE n.id IS NULL) AS recommendation_dangling_count;

-- 5) Split distribution observation (info only).
-- Expected: both columns returned; values can vary by environment.
SELECT
    COUNT(*) FILTER (WHERE package_id IS NULL) AS node_design_count,
    COUNT(*) FILTER (WHERE package_id IS NOT NULL) AS workflow_bound_count
FROM mo_workflow_recommendation_package_nodes;
