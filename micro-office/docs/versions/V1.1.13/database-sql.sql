-- V1.1.13 验收 SQL（节点定义独立化 + 工作流 nodeGraph）
-- 使用方式：psql -U postgres -d micro_office -f docs/versions/V1.1.13/database-sql.sql

\echo '=== 1) 关键约束存在性 ==='
SELECT conname
FROM pg_constraint
WHERE conname IN (
  'ck_mo_wf_nodes_pkg_id_null',
  'ck_mo_wf_nodes_parent_null',
  'ck_mo_wf_pkg_meta_node_graph_shape'
)
ORDER BY conname;

\echo '=== 2) 节点表是否已收紧为定义单语义 ==='
SELECT
  COUNT(*) AS total_nodes,
  COUNT(*) FILTER (WHERE package_id IS NOT NULL) AS package_bound_nodes,
  COUNT(*) FILTER (WHERE parent_package_node_id IS NOT NULL) AS parent_bound_nodes
FROM mo_workflow_recommendation_package_nodes;

\echo '=== 3) 节点表是否仍残留指向工作流包的 FK ==='
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'mo_workflow_recommendation_package_nodes'::regclass
  AND contype = 'f'
ORDER BY conname;

\echo '=== 4) nodeGraph 结构脏数据检查（应为 0） ==='
SELECT COUNT(*) AS invalid_node_graph_rows
FROM mo_workflow_recommendation_packages p
WHERE p.meta ? 'nodeGraph'
  AND (
    jsonb_typeof(p.meta->'nodeGraph') <> 'array'
    OR jsonb_path_exists(p.meta, '$.nodeGraph[*] ? (@.type() != "array")')
    OR jsonb_path_exists(p.meta, '$.nodeGraph[*][*] ? (@.type() != "string")')
  );

\echo '=== 5) package 引用图中节点 ID 是否都可命中节点定义（应为 0） ==='
WITH ref_ids AS (
  SELECT
    p.id AS package_id,
    jsonb_array_elements(jsonb_array_elements(p.meta->'nodeGraph')) #>> '{}' AS node_id_text
  FROM mo_workflow_recommendation_packages p
  WHERE p.meta ? 'nodeGraph'
), dangling AS (
  SELECT r.package_id, r.node_id_text
  FROM ref_ids r
  LEFT JOIN mo_workflow_recommendation_package_nodes n
    ON n.id::text = r.node_id_text
  WHERE n.id IS NULL
)
SELECT COUNT(*) AS dangling_node_refs
FROM dangling;

\echo '=== 6) 旧工作流节点副本残留量（应为 0） ==='
SELECT COUNT(*) AS legacy_workflow_node_copies
FROM mo_workflow_recommendation_package_nodes
WHERE package_id IS NOT NULL
   OR parent_package_node_id IS NOT NULL;

\echo '=== 7) nodeGraph 覆盖情况（观测项） ==='
SELECT
  COUNT(*) AS total_packages,
  COUNT(*) FILTER (WHERE meta ? 'nodeGraph') AS packages_with_node_graph,
  COUNT(*) FILTER (WHERE meta ? 'nodeGraph' AND meta->'nodeGraph' <> '[]'::jsonb) AS packages_with_non_empty_node_graph
FROM mo_workflow_recommendation_packages;
