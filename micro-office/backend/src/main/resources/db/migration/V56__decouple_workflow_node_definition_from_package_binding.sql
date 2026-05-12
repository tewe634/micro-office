-- V1.1.12: decouple node definition from workflow package binding (no new tables)
-- Goal:
-- 1) allow independent node definitions (package_id nullable)
-- 2) keep package-scoped orchestration constraints when package_id is present

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    ALTER COLUMN package_id DROP NOT NULL;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS fk_mo_workflow_recommendation_package_nodes_parent;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS uq_mo_workflow_recommendation_package_nodes_package_code;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS uq_mo_workflow_recommendation_package_nodes_package_id_id;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    ADD CONSTRAINT uq_mo_workflow_recommendation_package_nodes_code
        UNIQUE (code);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_mo_workflow_recommendation_package_nodes_parent'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_package_nodes
            ADD CONSTRAINT fk_mo_workflow_recommendation_package_nodes_parent
            FOREIGN KEY (parent_package_node_id)
            REFERENCES public.mo_workflow_recommendation_package_nodes(id)
            ON DELETE CASCADE
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_mo_wf_pkg_nodes_parent_requires_pkg'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_package_nodes
            ADD CONSTRAINT ck_mo_wf_pkg_nodes_parent_requires_pkg
            CHECK (
                parent_package_node_id IS NULL
                OR package_id IS NOT NULL
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_package_nodes_scope_sequence
    ON public.mo_workflow_recommendation_package_nodes(package_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_package_nodes_unbound
    ON public.mo_workflow_recommendation_package_nodes(updated_at DESC, id)
    WHERE package_id IS NULL;
