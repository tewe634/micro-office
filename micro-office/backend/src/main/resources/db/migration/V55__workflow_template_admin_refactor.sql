ALTER TABLE public.mo_workflow_recommendation_packages
    ADD COLUMN IF NOT EXISTS code text,
    ADD COLUMN IF NOT EXISTS applicable_subject_type text,
    ADD COLUMN IF NOT EXISTS allow_create_as_normal boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_create_as_subflow boolean NOT NULL DEFAULT false;

UPDATE public.mo_workflow_recommendation_packages
SET code = upper(regexp_replace(coalesce(name, id), '[^A-Za-z0-9]+', '_', 'g')) || '_' || substr(md5(id), 1, 6)
WHERE code IS NULL OR btrim(code) = '';

ALTER TABLE public.mo_workflow_recommendation_packages
    ALTER COLUMN code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_mo_workflow_recommendation_packages_code_version'
    ) THEN
        ALTER TABLE public.mo_workflow_recommendation_packages
            ADD CONSTRAINT uq_mo_workflow_recommendation_packages_code_version
                UNIQUE (code, version);
    END IF;
END $$;

ALTER TABLE public.mo_workflow_recommendation_packages
    DROP CONSTRAINT IF EXISTS ck_mo_workflow_recommendation_packages_code_not_blank;

ALTER TABLE public.mo_workflow_recommendation_packages
    ADD CONSTRAINT ck_mo_workflow_recommendation_packages_code_not_blank
        CHECK (btrim(code) <> '');

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_packages_subject_status_sort
    ON public.mo_workflow_recommendation_packages(applicable_subject_type, status, sort_order);

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    ADD COLUMN IF NOT EXISTS code text,
    ADD COLUMN IF NOT EXISTS node_type text,
    ADD COLUMN IF NOT EXISTS is_main_path boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_append_next_node boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS allow_derive_subflow boolean NOT NULL DEFAULT false;

UPDATE public.mo_workflow_recommendation_package_nodes
SET code = upper(regexp_replace(coalesce(display_name, id), '[^A-Za-z0-9]+', '_', 'g')) || '_' || substr(md5(id), 1, 6)
WHERE code IS NULL OR btrim(code) = '';

UPDATE public.mo_workflow_recommendation_package_nodes
SET node_type = COALESCE(node_type, 'TASK')
WHERE node_type IS NULL OR btrim(node_type) = '';

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    ALTER COLUMN module_definition_id DROP NOT NULL,
    ALTER COLUMN code SET NOT NULL,
    ALTER COLUMN node_type SET NOT NULL;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    DROP CONSTRAINT IF EXISTS uq_mo_workflow_recommendation_package_nodes_package_code;

ALTER TABLE public.mo_workflow_recommendation_package_nodes
    ADD CONSTRAINT uq_mo_workflow_recommendation_package_nodes_package_code
        UNIQUE (package_id, code);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_recommendation_package_nodes_package_sequence
    ON public.mo_workflow_recommendation_package_nodes(package_id, sort_order, id);

CREATE TABLE IF NOT EXISTS public.mo_workflow_template_field_definitions (
    id varchar(36) PRIMARY KEY,
    field_key text NOT NULL,
    name text NOT NULL,
    field_type text NOT NULL,
    description text,
    enabled boolean NOT NULL DEFAULT true,
    sensitive boolean NOT NULL DEFAULT false,
    group_key text,
    display_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT uq_mo_workflow_template_field_definitions_field_key UNIQUE (field_key),
    CONSTRAINT ck_mo_workflow_template_field_definitions_field_key_not_blank CHECK (btrim(field_key) <> ''),
    CONSTRAINT ck_mo_workflow_template_field_definitions_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_mo_workflow_template_field_definitions_field_type_not_blank CHECK (btrim(field_type) <> ''),
    CONSTRAINT ck_mo_workflow_template_field_definitions_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_template_field_definitions_enabled_order
    ON public.mo_workflow_template_field_definitions(enabled, display_order, field_key);

DO $$
BEGIN
    IF to_regclass('public.mo_module_fields') IS NOT NULL THEN
        INSERT INTO public.mo_workflow_template_field_definitions (
            id, field_key, name, field_type, description, enabled, sensitive, group_key, display_order, created_by, updated_by
        )
        SELECT
            gen_random_uuid()::text,
            mf.field_key,
            COALESCE(NULLIF(max(mf.label), ''), mf.field_key),
            COALESCE(NULLIF(max(mf.data_type), ''), 'string'),
            NULL,
            true,
            false,
            NULL,
            COALESCE(min(mf.sort_order), 100),
            'migrate_v55_workflow_template_admin_refactor',
            'migrate_v55_workflow_template_admin_refactor'
        FROM public.mo_module_fields mf
        GROUP BY mf.field_key
        ON CONFLICT (field_key) DO NOTHING;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mo_workflow_template_node_input_fields (
    id varchar(36) PRIMARY KEY,
    node_template_id text NOT NULL REFERENCES public.mo_workflow_recommendation_package_nodes(id) ON DELETE CASCADE,
    field_key text NOT NULL REFERENCES public.mo_workflow_template_field_definitions(field_key) ON DELETE RESTRICT,
    display_name text,
    display_order integer NOT NULL DEFAULT 100,
    required boolean NOT NULL DEFAULT false,
    read_only boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT uq_mo_workflow_template_node_input_fields UNIQUE (node_template_id, field_key),
    CONSTRAINT ck_mo_workflow_template_node_input_fields_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_template_node_input_fields_node_order
    ON public.mo_workflow_template_node_input_fields(node_template_id, display_order, field_key);

CREATE TABLE IF NOT EXISTS public.mo_workflow_template_node_output_fields (
    id varchar(36) PRIMARY KEY,
    node_template_id text NOT NULL REFERENCES public.mo_workflow_recommendation_package_nodes(id) ON DELETE CASCADE,
    field_key text NOT NULL REFERENCES public.mo_workflow_template_field_definitions(field_key) ON DELETE RESTRICT,
    display_name text,
    display_order integer NOT NULL DEFAULT 100,
    required boolean NOT NULL DEFAULT false,
    allow_write_back_parent boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT uq_mo_workflow_template_node_output_fields UNIQUE (node_template_id, field_key),
    CONSTRAINT ck_mo_workflow_template_node_output_fields_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_template_node_output_fields_node_order
    ON public.mo_workflow_template_node_output_fields(node_template_id, display_order, field_key);

DO $$
BEGIN
    IF to_regclass('public.mo_module_fields') IS NOT NULL THEN
        INSERT INTO public.mo_workflow_template_node_input_fields (
            id, node_template_id, field_key, display_name, display_order, required, read_only, created_by, updated_by
        )
        SELECT
            gen_random_uuid()::text,
            n.id,
            mf.field_key,
            NULLIF(mf.label, ''),
            COALESCE(mf.sort_order, 100),
            COALESCE(mf.required, false),
            false,
            'migrate_v55_workflow_template_admin_refactor',
            'migrate_v55_workflow_template_admin_refactor'
        FROM public.mo_module_fields mf
        JOIN public.mo_workflow_recommendation_package_nodes n
          ON n.module_definition_id = mf.module_definition_id
        WHERE upper(mf.field_scope) = 'INPUT'
          AND EXISTS (
              SELECT 1
              FROM public.mo_workflow_template_field_definitions fd
              WHERE fd.field_key = mf.field_key
          )
        ON CONFLICT (node_template_id, field_key) DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.mo_module_fields') IS NOT NULL THEN
        INSERT INTO public.mo_workflow_template_node_output_fields (
            id, node_template_id, field_key, display_name, display_order, required, allow_write_back_parent, created_by, updated_by
        )
        SELECT
            gen_random_uuid()::text,
            n.id,
            mf.field_key,
            NULLIF(mf.label, ''),
            COALESCE(mf.sort_order, 100),
            COALESCE(mf.required, false),
            false,
            'migrate_v55_workflow_template_admin_refactor',
            'migrate_v55_workflow_template_admin_refactor'
        FROM public.mo_module_fields mf
        JOIN public.mo_workflow_recommendation_package_nodes n
          ON n.module_definition_id = mf.module_definition_id
        WHERE upper(mf.field_scope) = 'OUTPUT'
          AND EXISTS (
              SELECT 1
              FROM public.mo_workflow_template_field_definitions fd
              WHERE fd.field_key = mf.field_key
          )
        ON CONFLICT (node_template_id, field_key) DO NOTHING;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mo_workflow_template_node_recommendations (
    id varchar(36) PRIMARY KEY,
    current_node_template_id text NOT NULL REFERENCES public.mo_workflow_recommendation_package_nodes(id) ON DELETE CASCADE,
    recommended_workflow_template_id text NOT NULL REFERENCES public.mo_workflow_recommendation_packages(id) ON DELETE CASCADE,
    reason text,
    display_order integer NOT NULL DEFAULT 100,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT uq_mo_workflow_template_node_recommendations UNIQUE (current_node_template_id, recommended_workflow_template_id),
    CONSTRAINT ck_mo_workflow_template_node_recommendations_display_order_non_negative CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mo_workflow_template_node_recommendations_node_order
    ON public.mo_workflow_template_node_recommendations(current_node_template_id, display_order, recommended_workflow_template_id);
