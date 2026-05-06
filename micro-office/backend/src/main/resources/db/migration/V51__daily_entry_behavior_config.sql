-- V1.1.13: daily-entry behavior configuration with pre-action form support
-- Goal:
-- 1) Move runtime click behavior config to daily-entry domain (not portal block action domain)
-- 2) Support structured pre-action form fields
-- 3) Support first scenario: MEETING -> input session_title -> create chat session

CREATE TABLE IF NOT EXISTS public.mo_daily_entry_behaviors (
    id text NOT NULL,
    daily_entry_id text NOT NULL,
    action_type text NOT NULL,
    requires_pre_action_form boolean NOT NULL DEFAULT false,
    pre_action_form_title text,
    pre_action_form_submit_label text,
    status text NOT NULL DEFAULT 'ACTIVE',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_daily_entry_behaviors_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mo_daily_entry_behavior_form_fields (
    id text NOT NULL,
    behavior_id text NOT NULL,
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
    CONSTRAINT mo_daily_entry_behavior_form_fields_pkey PRIMARY KEY (id)
);

ALTER TABLE public.mo_daily_entry_behaviors
    ADD COLUMN IF NOT EXISTS requires_pre_action_form boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pre_action_form_title text,
    ADD COLUMN IF NOT EXISTS pre_action_form_submit_label text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE public.mo_daily_entry_behavior_form_fields
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
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_daily_entry_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_daily_entry_not_blank
            CHECK (btrim(daily_entry_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_action_type_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_action_type_enum
            CHECK (action_type = ANY (ARRAY['CREATE_CHAT_SESSION','OPEN_WORKBENCH_SESSION']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_status_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE','INACTIVE']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_meta_object'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_version_positive'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_version_positive
            CHECK (version > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_pre_form_title_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_pre_form_title_not_blank
            CHECK (pre_action_form_title IS NULL OR btrim(pre_action_form_title) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_pre_form_submit_label_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_pre_form_submit_label_not_blank
            CHECK (pre_action_form_submit_label IS NULL OR btrim(pre_action_form_submit_label) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_behaviors_daily_entry'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT fk_mo_daily_entry_behaviors_daily_entry
            FOREIGN KEY (daily_entry_id)
            REFERENCES public.mo_daily_categories(id)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_key_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_key_not_blank
            CHECK (btrim(field_key) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_label_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_label_not_blank
            CHECK (btrim(label) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_input_type_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_input_type_enum
            CHECK (input_type = ANY (ARRAY['TEXT','TEXTAREA','NUMBER','SELECT']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_status_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE','INACTIVE']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_sort_non_negative'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_sort_non_negative
            CHECK (sort_order >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_max_length_positive'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_max_length_positive
            CHECK (max_length IS NULL OR max_length > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_form_fields_meta_object'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_form_fields_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_behavior_form_fields_behavior'
    ) THEN
        ALTER TABLE public.mo_daily_entry_behavior_form_fields
            ADD CONSTRAINT fk_mo_daily_entry_behavior_form_fields_behavior
            FOREIGN KEY (behavior_id)
            REFERENCES public.mo_daily_entry_behaviors(id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_behaviors_daily_entry
    ON public.mo_daily_entry_behaviors (daily_entry_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_behaviors_status_action
    ON public.mo_daily_entry_behaviors (status, action_type);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_behaviors_pre_form_enabled
    ON public.mo_daily_entry_behaviors (requires_pre_action_form)
    WHERE requires_pre_action_form IS TRUE;

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_behavior_form_fields_behavior_sort
    ON public.mo_daily_entry_behavior_form_fields (behavior_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_behavior_form_fields_behavior_key
    ON public.mo_daily_entry_behavior_form_fields (behavior_id, field_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_behavior_form_fields_behavior_sort
    ON public.mo_daily_entry_behavior_form_fields (behavior_id, sort_order);

-- Seed first scenario when MEETING entry exists.
INSERT INTO public.mo_daily_entry_behaviors (
    id,
    daily_entry_id,
    action_type,
    requires_pre_action_form,
    pre_action_form_title,
    pre_action_form_submit_label,
    status,
    meta,
    version,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    'daily_behavior_meeting_create_chat',
    c.id,
    'CREATE_CHAT_SESSION',
    true,
    '创建群聊',
    '创建并进入',
    'ACTIVE',
    '{"scene":"MEETING_CREATE_CHAT"}'::jsonb,
    1,
    now(),
    'seed_v1_1_13',
    now(),
    'seed_v1_1_13'
FROM public.mo_daily_categories c
WHERE upper(c.code) = 'MEETING'
ON CONFLICT (id) DO UPDATE
SET daily_entry_id = EXCLUDED.daily_entry_id,
    action_type = EXCLUDED.action_type,
    requires_pre_action_form = EXCLUDED.requires_pre_action_form,
    pre_action_form_title = EXCLUDED.pre_action_form_title,
    pre_action_form_submit_label = EXCLUDED.pre_action_form_submit_label,
    status = EXCLUDED.status,
    meta = EXCLUDED.meta,
    updated_at = now(),
    updated_by = 'seed_v1_1_13';

INSERT INTO public.mo_daily_entry_behavior_form_fields (
    id,
    behavior_id,
    field_key,
    label,
    input_type,
    required,
    placeholder,
    default_value,
    max_length,
    sort_order,
    status,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    'daily_behavior_field_meeting_session_title',
    'daily_behavior_meeting_create_chat',
    'session_title',
    '群聊主题',
    'TEXT',
    true,
    '请输入群聊主题',
    NULL,
    100,
    10,
    'ACTIVE',
    '{}'::jsonb,
    now(),
    'seed_v1_1_13',
    now(),
    'seed_v1_1_13'
WHERE EXISTS (
    SELECT 1
    FROM public.mo_daily_entry_behaviors b
    WHERE b.id = 'daily_behavior_meeting_create_chat'
)
ON CONFLICT (id) DO UPDATE
SET behavior_id = EXCLUDED.behavior_id,
    field_key = EXCLUDED.field_key,
    label = EXCLUDED.label,
    input_type = EXCLUDED.input_type,
    required = EXCLUDED.required,
    placeholder = EXCLUDED.placeholder,
    default_value = EXCLUDED.default_value,
    max_length = EXCLUDED.max_length,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    meta = EXCLUDED.meta,
    updated_at = now(),
    updated_by = 'seed_v1_1_13';
