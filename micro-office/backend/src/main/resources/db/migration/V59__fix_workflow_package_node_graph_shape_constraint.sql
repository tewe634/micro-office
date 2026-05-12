-- V1.1.13 hotfix: rebuild nodeGraph shape constraint to strict 2D string-array contract

-- 1) drop wrong/legacy constraint definition
ALTER TABLE public.mo_workflow_recommendation_packages
DROP CONSTRAINT IF EXISTS ck_mo_wf_pkg_meta_node_graph_shape;

-- 2) rebuild shape constraint
ALTER TABLE public.mo_workflow_recommendation_packages
ADD CONSTRAINT ck_mo_wf_pkg_meta_node_graph_shape
CHECK (
  NOT (meta ? 'nodeGraph')
  OR (
    jsonb_typeof(meta -> 'nodeGraph') = 'array'
    AND NOT jsonb_path_exists(
      meta,
      '$.nodeGraph[*].type() ? (@ != "array")'
    )
    AND NOT jsonb_path_exists(
      meta,
      '$.nodeGraph[*][*].type() ? (@ != "string")'
    )
  )
);
