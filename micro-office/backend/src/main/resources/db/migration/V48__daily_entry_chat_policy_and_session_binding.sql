-- V1.1.10: daily-entry chat policy and session bindings (Micro Office local ownership)
-- Goal:
-- 1) Add local policy table for DAILY_ENTRY session resolve strategy
-- 2) Add local binding table for DAILY_ENTRY -> conversation/session mapping
-- 3) Keep external platform tables (mo_daily_entries / mo_daily_categories / mo_daily_entry_targets) untouched

CREATE TABLE IF NOT EXISTS public.mo_daily_entry_chat_policies (
    id text NOT NULL,
    external_daily_entry_id text NOT NULL,
    entry_code text,
    entry_name text,
    session_resolve_strategy text NOT NULL DEFAULT 'BY_ENTRY_ONLY',
    provider_key text NOT NULL DEFAULT 'daily_list',
    status text NOT NULL DEFAULT 'ACTIVE',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_daily_entry_chat_policies_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mo_daily_entry_session_bindings (
    id text NOT NULL,
    external_daily_entry_id text NOT NULL,
    user_id text,
    session_id text NOT NULL,
    binding_scope text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_daily_entry_session_bindings_pkey PRIMARY KEY (id)
);

ALTER TABLE public.mo_daily_entry_chat_policies
    ADD COLUMN IF NOT EXISTS entry_code text,
    ADD COLUMN IF NOT EXISTS entry_name text,
    ADD COLUMN IF NOT EXISTS session_resolve_strategy text NOT NULL DEFAULT 'BY_ENTRY_ONLY',
    ADD COLUMN IF NOT EXISTS provider_key text NOT NULL DEFAULT 'daily_list',
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

ALTER TABLE public.mo_daily_entry_session_bindings
    ADD COLUMN IF NOT EXISTS user_id text,
    ADD COLUMN IF NOT EXISTS session_id text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS binding_scope text NOT NULL DEFAULT 'SHARED',
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_external_daily_entry_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_external_daily_entry_not_blank
            CHECK (btrim(external_daily_entry_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_strategy_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_strategy_enum
            CHECK (session_resolve_strategy = ANY (ARRAY['BY_ENTRY_ONLY', 'BY_ENTRY_AND_USER']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_provider_key_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_provider_key_not_blank
            CHECK (btrim(provider_key) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_status_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_meta_object'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_chat_policies_version_positive'
    ) THEN
        ALTER TABLE public.mo_daily_entry_chat_policies
            ADD CONSTRAINT ck_mo_daily_entry_chat_policies_version_positive
            CHECK (version > 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_external_daily_entry_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_external_daily_entry_not_blank
            CHECK (btrim(external_daily_entry_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_session_id_not_blank'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_session_id_not_blank
            CHECK (btrim(session_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_binding_scope_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_binding_scope_enum
            CHECK (binding_scope = ANY (ARRAY['SHARED', 'PERSONAL']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_status_enum'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_meta_object'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_version_positive'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_version_positive
            CHECK (version > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_session_bindings_scope_user_shape'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT ck_mo_daily_entry_session_bindings_scope_user_shape
            CHECK (
                (binding_scope = 'SHARED' AND user_id IS NULL)
                OR
                (binding_scope = 'PERSONAL' AND user_id IS NOT NULL AND btrim(user_id) <> '')
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_chat_policies_external_daily_entry
    ON public.mo_daily_entry_chat_policies (external_daily_entry_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_chat_policies_provider_status
    ON public.mo_daily_entry_chat_policies (provider_key, status);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_chat_policies_strategy_status
    ON public.mo_daily_entry_chat_policies (session_resolve_strategy, status);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_session_bindings_external_daily_entry
    ON public.mo_daily_entry_session_bindings (external_daily_entry_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_session_bindings_external_user
    ON public.mo_daily_entry_session_bindings (external_daily_entry_id, user_id);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_session_bindings_session_id
    ON public.mo_daily_entry_session_bindings (session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_session_bindings_active_shared
    ON public.mo_daily_entry_session_bindings (external_daily_entry_id)
    WHERE binding_scope = 'SHARED' AND status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_session_bindings_active_personal
    ON public.mo_daily_entry_session_bindings (external_daily_entry_id, user_id)
    WHERE binding_scope = 'PERSONAL' AND status = 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_session_bindings_policy_external_entry'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT fk_mo_daily_entry_session_bindings_policy_external_entry
            FOREIGN KEY (external_daily_entry_id)
            REFERENCES public.mo_daily_entry_chat_policies (external_daily_entry_id)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'mo_conversations'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_session_bindings_session'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            ADD CONSTRAINT fk_mo_daily_entry_session_bindings_session
            FOREIGN KEY (session_id)
            REFERENCES public.mo_conversations (id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_session_bindings_session'
    ) THEN
        ALTER TABLE public.mo_daily_entry_session_bindings
            VALIDATE CONSTRAINT fk_mo_daily_entry_session_bindings_session;
    END IF;
END $$;
