-- V1.1.13: support multi-position binding for workflow template packages
-- Compatible with both fresh databases and environments where the binding table already exists.

CREATE TABLE IF NOT EXISTS public.mo_workflow_recommendation_package_positions (
    package_id VARCHAR(36) NOT NULL,
    position_id VARCHAR(36) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(64),
    CONSTRAINT pk_mo_workflow_recommendation_package_positions PRIMARY KEY (package_id, position_id),
    CONSTRAINT fk_mo_workflow_recommendation_package_positions_package
        FOREIGN KEY (package_id) REFERENCES public.mo_workflow_recommendation_packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_mo_workflow_recommendation_package_positions_position
        FOREIGN KEY (position_id) REFERENCES public.position(id) ON DELETE RESTRICT
);

ALTER TABLE public.mo_workflow_recommendation_package_positions
    ADD COLUMN IF NOT EXISTS sort_order INTEGER;

UPDATE public.mo_workflow_recommendation_package_positions
SET sort_order = 0
WHERE sort_order IS NULL;

ALTER TABLE public.mo_workflow_recommendation_package_positions
    ALTER COLUMN sort_order SET DEFAULT 0;

ALTER TABLE public.mo_workflow_recommendation_package_positions
    ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_package_positions_position
    ON public.mo_workflow_recommendation_package_positions(position_id, package_id, sort_order);

INSERT INTO public.mo_workflow_recommendation_package_positions (
    package_id,
    position_id,
    sort_order,
    created_by,
    updated_by
)
SELECT
    p.id,
    p.position_id,
    0,
    'migrate_v52_package_multi_positions',
    'migrate_v52_package_multi_positions'
FROM public.mo_workflow_recommendation_packages p
WHERE p.position_id IS NOT NULL
ON CONFLICT (package_id, position_id) DO NOTHING;
