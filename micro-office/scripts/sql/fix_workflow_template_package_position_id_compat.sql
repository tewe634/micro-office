-- Compatibility hotfix for workflow template admin on databases missing
-- mo_workflow_recommendation_packages.position_id after the multi-position refactor.
-- Safe to run multiple times.

ALTER TABLE public.mo_workflow_recommendation_packages
    ADD COLUMN IF NOT EXISTS position_id text;

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

WITH first_binding AS (
    SELECT DISTINCT ON (pp.package_id)
        pp.package_id,
        pp.position_id
    FROM public.mo_workflow_recommendation_package_positions pp
    WHERE pp.position_id IS NOT NULL
    ORDER BY pp.package_id, pp.sort_order, pp.position_id
)
UPDATE public.mo_workflow_recommendation_packages p
SET position_id = fb.position_id
FROM first_binding fb
WHERE p.id = fb.package_id
  AND (p.position_id IS NULL OR p.position_id = '');

COMMENT ON COLUMN public.mo_workflow_recommendation_packages.position_id IS
    'Legacy primary position id kept for compatibility; multi-position visibility is stored in mo_workflow_recommendation_package_positions.';
