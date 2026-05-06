-- V1.1.12: structured pre-action modal config for portal block actions
-- Goal:
-- 1) Keep action execution model extensible (not hardcoded to meeting scene)
-- 2) Avoid unbounded JSON as long-term schema for pre-action form fields
-- 3) Support first scene: collect session_title before creating/opening session

ALTER TABLE public.mo_portal_block_template_actions
    ADD COLUMN IF NOT EXISTS requires_pre_action_form boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pre_action_form_title text,
    ADD COLUMN IF NOT EXISTS pre_action_form_submit_label text;

CREATE TABLE IF NOT EXISTS public.mo_portal_block_template_action_form_fields (
    id text NOT NULL,
    action_id text NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    input_type text NOT NULL DEFAULT 'TEXT',
    required boolean NOT NULL DEFAULT false,
    placeholder text,
    default_value text,
    max_length integer,
    sort_order integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'ACTIVE',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_portal_block_template_action_form_fields_pkey PRIMARY KEY (id)
);

ALTER TABLE public.mo_portal_block_template_action_form_fields
    ADD COLUMN IF NOT EXISTS input_type text NOT NULL DEFAULT 'TEXT',
    ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS placeholder text,
    ADD COLUMN IF NOT EXISTS default_value text,
    ADD COLUMN IF NOT EXISTS max_length integer,
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_actions_pre_form_title_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT ck_mo_portal_block_template_actions_pre_form_title_not_blank
            CHECK (pre_action_form_title IS NULL OR btrim(pre_action_form_title) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_actions_pre_form_submit_label_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_actions
            ADD CONSTRAINT ck_mo_portal_block_template_actions_pre_form_submit_label_not_blank
            CHECK (pre_action_form_submit_label IS NULL OR btrim(pre_action_form_submit_label) <> '');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_key_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_key_not_blank
            CHECK (btrim(field_key) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_label_not_blank'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_label_not_blank
            CHECK (btrim(label) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_input_type_enum'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_input_type_enum
            CHECK (input_type = ANY (ARRAY['TEXT', 'TEXTAREA', 'NUMBER', 'SELECT']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_sort_non_negative'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_sort_non_negative
            CHECK (sort_order >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_max_length_positive'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_max_length_positive
            CHECK (max_length IS NULL OR max_length > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_status_enum'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_block_template_action_form_fields_meta_object'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT ck_mo_portal_block_template_action_form_fields_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_block_template_action_form_fields_action'
    ) THEN
        ALTER TABLE public.mo_portal_block_template_action_form_fields
            ADD CONSTRAINT fk_mo_portal_block_template_action_form_fields_action
            FOREIGN KEY (action_id)
            REFERENCES public.mo_portal_block_template_actions(id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mo_portal_block_template_actions_pre_form_enabled
    ON public.mo_portal_block_template_actions (requires_pre_action_form)
    WHERE requires_pre_action_form IS TRUE;

CREATE INDEX IF NOT EXISTS idx_mo_portal_block_template_action_form_fields_action_sort
    ON public.mo_portal_block_template_action_form_fields (action_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_block_template_action_form_fields_action_key
    ON public.mo_portal_block_template_action_form_fields (action_id, field_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_block_template_action_form_fields_action_sort
    ON public.mo_portal_block_template_action_form_fields (action_id, sort_order);
