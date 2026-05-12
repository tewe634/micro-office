-- V59 verify SQL: nodeGraph constraint correctness + writeability check

-- A) constraint exists
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'ck_mo_wf_pkg_meta_node_graph_shape';

-- B) invalid shape count should be 0
SELECT COUNT(*) AS invalid_node_graph_rows
FROM public.mo_workflow_recommendation_packages p
WHERE p.meta ? 'nodeGraph'
  AND (
    jsonb_typeof(p.meta -> 'nodeGraph') <> 'array'
    OR jsonb_path_exists(p.meta, '$.nodeGraph[*].type() ? (@ != "array")')
    OR jsonb_path_exists(p.meta, '$.nodeGraph[*][*].type() ? (@ != "string")')
  );

-- C) writeability smoke test (transactional)
BEGIN;

UPDATE public.mo_workflow_recommendation_packages
SET meta = jsonb_set(
  COALESCE(meta, '{}'::jsonb),
  '{nodeGraph}',
  '[["44f3000a-895c-4f4d-bac9-f7ecb0140df8"]]'::jsonb,
  true
)
WHERE id = 'dba40de1-8375-4e02-848e-939099f71ca4';

SELECT id, meta
FROM public.mo_workflow_recommendation_packages
WHERE id = 'dba40de1-8375-4e02-848e-939099f71ca4';

ROLLBACK;
