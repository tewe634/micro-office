-- V1.1.13: nodes-definition-only + package.meta.nodeGraph contract (no new tables)
-- Goal:
-- 1) mo_workflow_recommendation_package_nodes stores node definitions only
-- 2) workflow orchestration persists in mo_workflow_recommendation_packages.meta.nodeGraph

-- Step 1) Backfill nodeGraph from legacy package-bound node rows.
-- Rule:
-- - one layer = one hierarchy_level
-- - each layer is an array of node ids ordered by branch_order, sort_order, id
WITH graph_layers AS (
    SELECT
        n.package_id,
        n.hierarchy_level,
        jsonb_agg(to_jsonb(n.id) ORDER BY COALESCE(n.branch_order, 2147483647), n.sort_order, n.id) AS layer_nodes
    FROM public.mo_workflow_recommendation_package_nodes n
    WHERE n.package_id IS NOT NULL
    GROUP BY n.package_id, n.hierarchy_level
),
package_graph AS (
    SELECT
        g.package_id,
        jsonb_agg(g.layer_nodes ORDER BY g.hierarchy_level) AS node_graph
    FROM graph_layers g
    GROUP BY g.package_id
)
UPDATE public.mo_workflow_recommendation_packages p
SET meta = jsonb_set(
        COALESCE(p.meta, '{}'::jsonb),
        '{nodeGraph}',
        pg.node_graph,
        true
    ),
    updated_at = now(),
    updated_by = COALESCE(p.updated_by, 'migrate_v58_node_graph')
FROM package_graph pg
WHERE p.id = pg.package_id
  AND (
      p.meta IS NULL
      OR p.meta->'nodeGraph' IS NULL
      OR p.meta->'nodeGraph' = 'null'::jsonb
      OR p.meta->'nodeGraph' = '[]'::jsonb
  );

-- Step 2) Keep node rows as definitions only (clear workflow-binding attributes).
UPDATE public.mo_workflow_recommendation_package_nodes
SET package_id = NULL,
    parent_package_node_id = NULL,
    hierarchy_level = 0,
    relation_type = 'SEQUENCE',
    branch_group_key = NULL,
    branch_order = NULL,
    is_main_path = TRUE,
    updated_at = now(),
    updated_by = COALESCE(updated_by, 'migrate_v58_node_definition_only')
WHERE package_id IS NOT NULL;

-- Step 3) Remove package binding FK from node definitions.
ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS mo_workflow_recommendation_package_nodes_package_id_fkey;

-- Step 4) Enforce definition-only contract on node table.
ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS ck_mo_wf_pkg_nodes_parent_requires_pkg;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_wf_nodes_pkg_id_null'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_package_nodes
            ADD CONSTRAINT ck_mo_wf_nodes_pkg_id_null
            CHECK (package_id IS NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_wf_nodes_parent_null'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_package_nodes
            ADD CONSTRAINT ck_mo_wf_nodes_parent_null
            CHECK (parent_package_node_id IS NULL);
    END IF;
END $$;

-- Step 5) Enforce package.meta.nodeGraph shape at DB layer.
-- Contract:
-- - meta is object (already enforced)
-- - nodeGraph optional
-- - if present, must be array of array of strings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_wf_pkg_meta_node_graph_shape'
    ) THEN
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
    END IF;
END $$;

-- Optional query-path index for nodeGraph presence.
CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_packages_has_node_graph
    ON public.mo_workflow_recommendation_packages ((meta ? 'nodeGraph'));
