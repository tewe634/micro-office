CREATE TABLE IF NOT EXISTS public.mo_workflow_recommendation_package_positions (
    package_id text NOT NULL,
    position_id character varying(36) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text NULL,
    CONSTRAINT mo_workflow_recommendation_package_positions_pkey PRIMARY KEY (package_id, position_id),
    CONSTRAINT mo_workflow_recommendation_package_positions_package_id_fkey FOREIGN KEY (package_id)
        REFERENCES public.mo_workflow_recommendation_packages (id) ON DELETE CASCADE,
    CONSTRAINT mo_workflow_recommendation_package_positions_position_id_fkey FOREIGN KEY (position_id)
        REFERENCES public.position (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_package_positions_position_id
    ON public.mo_workflow_recommendation_package_positions(position_id);

INSERT INTO public.mo_workflow_recommendation_package_positions (package_id, position_id, created_by, updated_by)
SELECT id, position_id, updated_by, updated_by
FROM public.mo_workflow_recommendation_packages
WHERE position_id IS NOT NULL
ON CONFLICT (package_id, position_id) DO NOTHING;

COMMENT ON TABLE public.mo_workflow_recommendation_package_positions IS
    'Multi-position visibility bindings for workflow template packages.';

COMMENT ON COLUMN public.mo_workflow_recommendation_packages.position_id IS
    'Legacy primary position id kept for compatibility; multi-position visibility is stored in mo_workflow_recommendation_package_positions.';
