-- V1.1.6: portal block template library
-- Goal:
-- 1) Add reusable block template assets
-- 2) Add block-template action table
-- 3) Add page-template block-reference table
-- Keep legacy portal item/action tables untouched for coexistence.

CREATE TABLE IF NOT EXISTS public.mo_portal_block_templates (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    scope_type text NOT NULL DEFAULT 'PORTAL_BLOCK',
    display_type text NOT NULL DEFAULT 'CARD',
    data_key text NOT NULL,
    label text NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_portal_block_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mo_portal_block_template_actions (
    id text NOT NULL,
    block_template_id text NOT NULL,
    action_type text NOT NULL,
    target_subject_type text,
    target_id_path text,
    session_type text,
    sort_order integer NOT NULL DEFAULT 0,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_portal_block_template_actions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mo_portal_template_block_refs (
    id text NOT NULL,
    template_id text NOT NULL,
    section_id text NOT NULL,
    block_template_id text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    enabled boolean NOT NULL DEFAULT true,
    override_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_portal_template_block_refs_pkey PRIMARY KEY (id)
);

-- Backfill-safe column guards for environments with partially created tables.
ALTER TABLE public.mo_portal_block_templates
    ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'PORTAL_BLOCK',
    ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'CARD',
    ADD COLUMN IF NOT EXISTS data_key text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE public.mo_portal_block_template_actions
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE public.mo_portal_template_block_refs
    ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS override_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_code_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_code_not_blank CHECK (btrim(code) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_name_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_name_not_blank CHECK (btrim(name) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_data_key_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_data_key_not_blank CHECK (btrim(data_key) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_label_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_label_not_blank CHECK (btrim(label) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_status_enum'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_status_enum CHECK (status = ANY (ARRAY['DRAFT','ACTIVE','INACTIVE']));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_scope_type_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_scope_type_not_blank CHECK (btrim(scope_type) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_display_type_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_display_type_not_blank CHECK (btrim(display_type) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_templates_meta_object'
    ) THEN
        ALTER TABLE public.mo_portal_block_templates
            ADD CONSTRAINT ck_mo_portal_block_templates_meta_object CHECK (jsonb_typeof(meta) = 'object');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_actions_action_type_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT ck_mo_portal_block_template_actions_action_type_not_blank CHECK (btrim(action_type) <> '');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_actions_sort_non_negative'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT ck_mo_portal_block_template_actions_sort_non_negative CHECK (sort_order >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_actions_meta_object'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT ck_mo_portal_block_template_actions_meta_object CHECK (jsonb_typeof(meta) = 'object');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_block_template_actions_block_template'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT fk_mo_portal_block_template_actions_block_template
            FOREIGN KEY (block_template_id) REFERENCES public.mo_portal_block_templates(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_template_block_refs_sort_non_negative'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT ck_mo_portal_template_block_refs_sort_non_negative CHECK (sort_order >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_template_block_refs_override_meta_object'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT ck_mo_portal_template_block_refs_override_meta_object CHECK (jsonb_typeof(override_meta) = 'object');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_template_block_refs_template'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT fk_mo_portal_template_block_refs_template
            FOREIGN KEY (template_id) REFERENCES public.mo_portal_templates(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_template_block_refs_section'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT fk_mo_portal_template_block_refs_section
            FOREIGN KEY (section_id) REFERENCES public.mo_portal_template_sections(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_template_block_refs_block_template'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT fk_mo_portal_template_block_refs_block_template
            FOREIGN KEY (block_template_id) REFERENCES public.mo_portal_block_templates(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_block_templates_code
    ON public.mo_portal_block_templates (code);

CREATE INDEX IF NOT EXISTS idx_mo_portal_block_templates_status
    ON public.mo_portal_block_templates (status);

CREATE INDEX IF NOT EXISTS idx_mo_portal_block_template_actions_block_sort
    ON public.mo_portal_block_template_actions (block_template_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_mo_portal_template_block_refs_template_section_sort
    ON public.mo_portal_template_block_refs (template_id, section_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_mo_portal_template_block_refs_block_template
    ON public.mo_portal_template_block_refs (block_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_template_block_refs_section_block
    ON public.mo_portal_template_block_refs (section_id, block_template_id);

-- Optional stronger integrity: section must belong to template.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_template_sections_template_id_id
    ON public.mo_portal_template_sections (template_id, id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_template_block_refs_template_section'
    ) THEN
        ALTER TABLE public.mo_portal_template_block_refs
            ADD CONSTRAINT fk_mo_portal_template_block_refs_template_section
            FOREIGN KEY (template_id, section_id)
            REFERENCES public.mo_portal_template_sections (template_id, id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

ALTER TABLE public.mo_portal_template_block_refs
    VALIDATE CONSTRAINT fk_mo_portal_template_block_refs_template_section;

-- Seed: reusable message center block template (idempotent)
INSERT INTO public.mo_portal_block_templates (
    id,
    code,
    name,
    status,
    scope_type,
    display_type,
    data_key,
    label,
    meta,
    version,
    created_at,
    created_by,
    updated_at,
    updated_by
) VALUES (
    'portal_block_tpl_message_center',
    'MESSAGE_CENTER',
    '消息中心',
    'ACTIVE',
    'PORTAL_BLOCK',
    'LIST',
    'message_center',
    '消息中心',
    '{"description":"可复用消息中心块模板","fields":["title","time","severity","source"],"layout":{"minHeight":240}}'::jsonb,
    1,
    now(),
    'seed_v1_1_6',
    now(),
    'seed_v1_1_6'
)
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    scope_type = EXCLUDED.scope_type,
    display_type = EXCLUDED.display_type,
    data_key = EXCLUDED.data_key,
    label = EXCLUDED.label,
    meta = EXCLUDED.meta,
    updated_at = now(),
    updated_by = 'seed_v1_1_6';
