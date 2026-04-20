-- V1.1.9: converge PERSON_ROLE template-position binding to structured column
-- Goal:
-- 1) Add mo_portal_templates.position_id as the single relation fact
-- 2) Backfill from legacy meta.positionId
-- 3) Add integrity constraints and query indexes
-- 4) Remove meta.positionId dual-semantic residue

ALTER TABLE public.mo_portal_templates
    ADD COLUMN IF NOT EXISTS position_id VARCHAR(36);

-- Backfill structured column from legacy meta.positionId for PERSON_ROLE templates.
UPDATE public.mo_portal_templates t
SET
    position_id = NULLIF(btrim(t.meta ->> 'positionId'), ''),
    updated_at = now(),
    updated_by = 'migrate_v47_position_binding'
WHERE t.template_type = 'PERSON_ROLE'
  AND t.position_id IS NULL
  AND NULLIF(btrim(t.meta ->> 'positionId'), '') IS NOT NULL;

-- Guardrail: fail if any PERSON_ROLE template has a non-existing position binding.
DO $$
DECLARE
    missing_position_count integer;
BEGIN
    SELECT COUNT(*)
    INTO missing_position_count
    FROM public.mo_portal_templates t
    LEFT JOIN public.position p
      ON p.id = t.position_id
    WHERE t.template_type = 'PERSON_ROLE'
      AND t.position_id IS NOT NULL
      AND p.id IS NULL;

    IF missing_position_count > 0 THEN
        RAISE EXCEPTION
            'V47 invalid PERSON_ROLE position_id references: % rows',
            missing_position_count;
    END IF;
END $$;

-- Non-PERSON_ROLE templates must not carry position_id.
UPDATE public.mo_portal_templates
SET
    position_id = NULL,
    updated_at = now(),
    updated_by = 'migrate_v47_position_binding'
WHERE template_type <> 'PERSON_ROLE'
  AND position_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_mo_portal_templates_position_id_person_role_only'
    ) THEN
        ALTER TABLE public.mo_portal_templates
            ADD CONSTRAINT ck_mo_portal_templates_position_id_person_role_only
            CHECK (template_type = 'PERSON_ROLE' OR position_id IS NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mo_portal_templates_position'
    ) THEN
        ALTER TABLE public.mo_portal_templates
            ADD CONSTRAINT fk_mo_portal_templates_position
            FOREIGN KEY (position_id) REFERENCES public.position(id) ON DELETE RESTRICT NOT VALID;
    END IF;
END $$;

ALTER TABLE public.mo_portal_templates
    VALIDATE CONSTRAINT fk_mo_portal_templates_position;

-- Replace legacy meta-position index with structured-column index path.
DROP INDEX IF EXISTS public.idx_mo_portal_templates_person_active_meta_position_order;

CREATE INDEX IF NOT EXISTS idx_mo_portal_templates_person_status_position_order
    ON public.mo_portal_templates (template_type, status, position_id, updated_at DESC, created_at DESC)
    WHERE template_type = 'PERSON_ROLE';

CREATE INDEX IF NOT EXISTS idx_mo_portal_templates_person_active_position_order
    ON public.mo_portal_templates (template_type, status, position_id, updated_at DESC, created_at DESC)
    WHERE template_type = 'PERSON_ROLE'
      AND status = 'ACTIVE'
      AND position_id IS NOT NULL;

-- Remove deprecated relation fact from meta to avoid dual-path semantics.
UPDATE public.mo_portal_templates
SET
    meta = meta - 'positionId',
    updated_at = now(),
    updated_by = 'migrate_v47_position_binding'
WHERE meta ? 'positionId';
