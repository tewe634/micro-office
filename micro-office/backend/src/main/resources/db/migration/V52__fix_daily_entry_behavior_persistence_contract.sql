-- FIX1.1.13-behavior-persistence-contract
-- Goal:
-- 1) Align daily-entry behavior persistence schema with backend runtime contract.
-- 2) Backfill legacy rows to OPEN_WORKBENCH_SESSION + session/execution columns.
-- 3) Converge field table to mo_daily_entry_behavior_fields, keep old name as compatibility view.

-- 0) Ensure base table exists before fix.
DO $$
BEGIN
    IF to_regclass('public.mo_daily_entry_behaviors') IS NULL THEN
        RAISE EXCEPTION 'mo_daily_entry_behaviors does not exist; apply V51 first';
    END IF;
END $$;

-- 1) Add behavior contract columns and backfill.
ALTER TABLE public.mo_daily_entry_behaviors
    ADD COLUMN IF NOT EXISTS session_type text,
    ADD COLUMN IF NOT EXISTS execution_mode text;

-- 2) Snapshot for rollback of key behavior fields.
CREATE TABLE IF NOT EXISTS public.mo_fix_1_1_13_behavior_snapshot (
    id text PRIMARY KEY,
    action_type text,
    session_type text,
    execution_mode text,
    status text,
    meta jsonb,
    snapshot_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.mo_fix_1_1_13_behavior_snapshot (id, action_type, session_type, execution_mode, status, meta, snapshot_at)
SELECT b.id, b.action_type, b.session_type, b.execution_mode, b.status, b.meta, now()
FROM public.mo_daily_entry_behaviors b
ON CONFLICT (id) DO NOTHING;

UPDATE public.mo_daily_entry_behaviors b
SET action_type = CASE
        WHEN upper(coalesce(b.action_type, '')) = 'CREATE_CHAT_SESSION' THEN 'OPEN_WORKBENCH_SESSION'
        WHEN btrim(coalesce(b.action_type, '')) = '' THEN 'OPEN_WORKBENCH_SESSION'
        ELSE upper(b.action_type)
    END,
    session_type = CASE
        WHEN btrim(coalesce(b.session_type, '')) <> '' THEN upper(b.session_type)
        WHEN btrim(coalesce(b.meta ->> 'sessionType', '')) <> '' THEN upper(b.meta ->> 'sessionType')
        ELSE 'DAILY_ENTRY'
    END,
    execution_mode = CASE
        WHEN btrim(coalesce(b.execution_mode, '')) <> '' THEN upper(b.execution_mode)
        WHEN btrim(coalesce(b.meta ->> 'executionMode', '')) <> '' THEN upper(b.meta ->> 'executionMode')
        WHEN upper(coalesce(b.action_type, '')) = 'CREATE_CHAT_SESSION' THEN 'CREATE_SESSION'
        ELSE 'OPEN_EXISTING'
    END,
    status = CASE
        WHEN btrim(coalesce(b.status, '')) = '' THEN 'ACTIVE'
        ELSE upper(b.status)
    END,
    updated_at = now(),
    updated_by = coalesce(nullif(b.updated_by, ''), 'fix_1_1_13_behavior_contract')
WHERE upper(coalesce(b.action_type, '')) = 'CREATE_CHAT_SESSION'
   OR btrim(coalesce(b.action_type, '')) = ''
   OR btrim(coalesce(b.session_type, '')) = ''
   OR btrim(coalesce(b.execution_mode, '')) = ''
   OR btrim(coalesce(b.status, '')) = '';

-- Meeting scenario should create session.
UPDATE public.mo_daily_entry_behaviors b
SET action_type = 'OPEN_WORKBENCH_SESSION',
    session_type = 'DAILY_ENTRY',
    execution_mode = 'CREATE_SESSION',
    requires_pre_action_form = true,
    updated_at = now(),
    updated_by = 'fix_1_1_13_behavior_contract'
FROM public.mo_daily_categories c
WHERE c.id = b.daily_entry_id
  AND upper(c.code) = 'MEETING'
  AND (
      b.action_type <> 'OPEN_WORKBENCH_SESSION'
      OR b.session_type <> 'DAILY_ENTRY'
      OR b.execution_mode <> 'CREATE_SESSION'
      OR b.requires_pre_action_form IS DISTINCT FROM true
  );

ALTER TABLE public.mo_daily_entry_behaviors
    ALTER COLUMN session_type SET DEFAULT 'DAILY_ENTRY',
    ALTER COLUMN execution_mode SET DEFAULT 'OPEN_EXISTING';

UPDATE public.mo_daily_entry_behaviors
SET session_type = 'DAILY_ENTRY'
WHERE btrim(coalesce(session_type, '')) = '';

UPDATE public.mo_daily_entry_behaviors
SET execution_mode = 'OPEN_EXISTING'
WHERE btrim(coalesce(execution_mode, '')) = '';

ALTER TABLE public.mo_daily_entry_behaviors
    ALTER COLUMN session_type SET NOT NULL,
    ALTER COLUMN execution_mode SET NOT NULL;

-- 3) Create target field table and converge legacy table data.
CREATE TABLE IF NOT EXISTS public.mo_daily_entry_behavior_fields (
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
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT mo_daily_entry_behavior_fields_pkey PRIMARY KEY (id)
);

DO $$
DECLARE
    legacy_rel regclass;
    legacy_kind "char";
BEGIN
    legacy_rel := to_regclass('public.mo_daily_entry_behavior_form_fields');
    IF legacy_rel IS NULL THEN
        RETURN;
    END IF;

    SELECT c.relkind
    INTO legacy_kind
    FROM pg_class c
    WHERE c.oid = legacy_rel;

    IF legacy_kind = 'r' THEN
        EXECUTE 'ALTER TABLE public.mo_daily_entry_behavior_form_fields ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1';
    END IF;
END $$;

DO $$
DECLARE
    legacy_rel regclass;
    legacy_kind "char";
BEGIN
    legacy_rel := to_regclass('public.mo_daily_entry_behavior_form_fields');
    IF legacy_rel IS NULL THEN
        RETURN;
    END IF;

    SELECT c.relkind
    INTO legacy_kind
    FROM pg_class c
    WHERE c.oid = legacy_rel;

    -- Only merge when legacy object is a real table.
    IF legacy_kind = 'r' THEN
        INSERT INTO public.mo_daily_entry_behavior_fields (
            id, behavior_id, field_key, label, input_type, required, placeholder, default_value,
            max_length, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by
        )
        SELECT
            f.id, f.behavior_id, f.field_key, f.label, f.input_type, f.required, f.placeholder, f.default_value,
            f.max_length, f.sort_order, f.status, f.meta, coalesce(f.version, 1), f.created_at, f.created_by, f.updated_at, f.updated_by
        FROM public.mo_daily_entry_behavior_form_fields f
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
            version = EXCLUDED.version,
            created_at = EXCLUDED.created_at,
            created_by = EXCLUDED.created_by,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by;

        EXECUTE 'DROP TABLE public.mo_daily_entry_behavior_form_fields';
    END IF;
END $$;

-- Compatibility object for legacy reads: old name -> new table.
DO $$
BEGIN
    IF to_regclass('public.mo_daily_entry_behavior_form_fields') IS NULL THEN
        EXECUTE 'CREATE VIEW public.mo_daily_entry_behavior_form_fields AS SELECT * FROM public.mo_daily_entry_behavior_fields';
    END IF;
END $$;

-- 4) Normalize field rows.
UPDATE public.mo_daily_entry_behavior_fields
SET input_type = upper(coalesce(input_type, 'TEXT')),
    status = upper(coalesce(status, 'ACTIVE')),
    version = CASE WHEN version IS NULL OR version <= 0 THEN 1 ELSE version END,
    updated_at = now(),
    updated_by = coalesce(nullif(updated_by, ''), 'fix_1_1_13_behavior_contract')
WHERE input_type IS NULL
   OR input_type <> upper(input_type)
   OR status IS NULL
   OR status <> upper(status)
   OR version IS NULL
   OR version <= 0;

-- 5) Constraints and indexes aligned with backend contract.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_action_type_enum') THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            DROP CONSTRAINT ck_mo_daily_entry_behaviors_action_type_enum;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_action_type_enum') THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_action_type_enum
            CHECK (action_type = 'OPEN_WORKBENCH_SESSION');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_session_type_enum') THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_session_type_enum
            CHECK (session_type = 'DAILY_ENTRY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_execution_mode_enum') THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_execution_mode_enum
            CHECK (execution_mode = ANY (ARRAY['OPEN_EXISTING','CREATE_SESSION']));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behaviors_status_enum') THEN
        ALTER TABLE public.mo_daily_entry_behaviors
            ADD CONSTRAINT ck_mo_daily_entry_behaviors_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE','INACTIVE']));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_daily_entry_behavior_fields_behavior') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT fk_mo_daily_entry_behavior_fields_behavior
            FOREIGN KEY (behavior_id)
            REFERENCES public.mo_daily_entry_behaviors(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_key_not_blank') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_key_not_blank
            CHECK (btrim(field_key) <> '');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_label_not_blank') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_label_not_blank
            CHECK (btrim(label) <> '');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_input_type_enum') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_input_type_enum
            CHECK (input_type = ANY (ARRAY['TEXT','TEXTAREA','NUMBER','SELECT']));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_status_enum') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_status_enum
            CHECK (status = ANY (ARRAY['ACTIVE','INACTIVE']));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_sort_non_negative') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_sort_non_negative
            CHECK (sort_order >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_max_length_positive') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_max_length_positive
            CHECK (max_length IS NULL OR max_length > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_meta_object') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_meta_object
            CHECK (jsonb_typeof(meta) = 'object');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_daily_entry_behavior_fields_version_positive') THEN
        ALTER TABLE public.mo_daily_entry_behavior_fields
            ADD CONSTRAINT ck_mo_daily_entry_behavior_fields_version_positive
            CHECK (version > 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_behaviors_status_execution
    ON public.mo_daily_entry_behaviors (status, execution_mode);

CREATE INDEX IF NOT EXISTS idx_mo_daily_entry_behavior_fields_behavior_sort
    ON public.mo_daily_entry_behavior_fields (behavior_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_behavior_fields_behavior_key
    ON public.mo_daily_entry_behavior_fields (behavior_id, field_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_daily_entry_behavior_fields_behavior_sort
    ON public.mo_daily_entry_behavior_fields (behavior_id, sort_order);
