-- Compatibility hotfix for workflow template package creation.
-- Current application code allows scene_category to be null,
-- but some production databases still keep the old NOT NULL/check constraint.
-- Safe to run multiple times.

ALTER TABLE public.mo_workflow_recommendation_packages
    ALTER COLUMN scene_category DROP NOT NULL;

ALTER TABLE public.mo_workflow_recommendation_packages
    DROP CONSTRAINT IF EXISTS ck_mo_workflow_recommendation_packages_scene_not_blank;

ALTER TABLE public.mo_workflow_recommendation_packages
    ADD CONSTRAINT ck_mo_workflow_recommendation_packages_scene_not_blank
        CHECK (scene_category IS NULL OR btrim(scene_category) <> '');

COMMENT ON COLUMN public.mo_workflow_recommendation_packages.scene_category IS
    'Legacy optional recommendation scope key. Kept for compatibility with node recommendation rules.';
