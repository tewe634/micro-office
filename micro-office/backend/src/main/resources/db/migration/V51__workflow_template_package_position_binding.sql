ALTER TABLE public.mo_workflow_recommendation_packages
    ADD COLUMN IF NOT EXISTS position_id text;

ALTER TABLE public.mo_workflow_recommendation_packages
    ALTER COLUMN scene_category DROP NOT NULL;

ALTER TABLE public.mo_workflow_recommendation_packages
    DROP CONSTRAINT IF EXISTS ck_mo_workflow_recommendation_packages_scene_not_blank;

ALTER TABLE public.mo_workflow_recommendation_packages
    ADD CONSTRAINT ck_mo_workflow_recommendation_packages_scene_not_blank
        CHECK (scene_category IS NULL OR btrim(scene_category) <> '');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mo_workflow_recommendation_packages_position_id_fkey'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_packages
            ADD CONSTRAINT mo_workflow_recommendation_packages_position_id_fkey
                FOREIGN KEY (position_id) REFERENCES public.position(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_packages_position_status_sort
    ON public.mo_workflow_recommendation_packages(position_id, status, sort_order);

COMMENT ON COLUMN public.mo_workflow_recommendation_packages.position_id IS
    'Bound position id for workflow template visibility. Null means a global template.';

COMMENT ON COLUMN public.mo_workflow_recommendation_packages.scene_category IS
    'Legacy optional recommendation scope key. Kept for compatibility with node recommendation rules.';
