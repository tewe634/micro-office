-- V1.1.15: user external account binding baseline
-- Scope:
-- 1) Converge DB contract around mo_user_external_accounts (user binding, not position binding)
-- 2) Ensure table/constraints/indexes exist for fresh and incremental environments
-- 3) Keep current model; no position binding table introduced

CREATE TABLE IF NOT EXISTS public.mo_user_external_accounts (
    id text NOT NULL,
    user_id varchar(36) NOT NULL,
    provider text NOT NULL,
    corp_id text NOT NULL,
    external_user_id text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    bound_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT mo_user_external_accounts_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_provider'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_provider
            CHECK (provider = 'DINGTALK');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_status'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_status
            CHECK (status = ANY (ARRAY['ACTIVE','UNBOUND']));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_version_positive'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_version_positive
            CHECK (version > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_user_not_blank'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_user_not_blank
            CHECK (btrim(user_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_corp_not_blank'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_corp_not_blank
            CHECK (btrim(corp_id) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_user_external_accounts_external_user_not_blank'
    ) THEN
        ALTER TABLE public.mo_user_external_accounts
            ADD CONSTRAINT ck_mo_user_external_accounts_external_user_not_blank
            CHECK (btrim(external_user_id) <> '');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_user_external_accounts_provider_external
    ON public.mo_user_external_accounts (provider, corp_id, external_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_user_external_accounts_user_provider_corp
    ON public.mo_user_external_accounts (user_id, provider, corp_id);

CREATE INDEX IF NOT EXISTS idx_mo_user_external_accounts_user
    ON public.mo_user_external_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_mo_user_external_accounts_lookup
    ON public.mo_user_external_accounts (provider, corp_id, external_user_id);
