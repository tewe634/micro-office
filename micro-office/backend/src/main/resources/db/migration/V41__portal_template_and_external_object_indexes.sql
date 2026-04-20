-- Portal template and external object performance + integrity hardening.
-- 1) Add indexes for real query paths used by portal runtime/admin and object portal.
-- 2) Add cross-table consistency FKs to prevent template graph mismatches.

-- ------------------------------
-- external_object query-path indexes
-- ------------------------------
CREATE INDEX IF NOT EXISTS idx_external_object_type_owner_name_id
    ON public.external_object (type, owner_id, name, id);

CREATE INDEX IF NOT EXISTS idx_external_object_type_org_name_id
    ON public.external_object (type, org_id, name, id);

CREATE INDEX IF NOT EXISTS idx_external_object_type_dept_name_id
    ON public.external_object (type, dept_id, name, id);

CREATE INDEX IF NOT EXISTS idx_external_object_type_updated_created_id
    ON public.external_object (type, updated_at DESC, created_at DESC, id DESC);

-- ------------------------------
-- mo_portal_templates query-path indexes
-- Compatible with both schemas:
-- A) newer branch with position_id column
-- B) older branch resolving from meta->>'positionId'
-- ------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_portal_templates'
          AND column_name = 'position_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_mo_portal_templates_person_active_position_order
            ON public.mo_portal_templates (template_type, status, position_id, updated_at DESC, created_at DESC)
            WHERE template_type = 'PERSON_ROLE'
              AND status = 'ACTIVE'
              AND position_id IS NOT NULL;
    ELSE
        CREATE INDEX IF NOT EXISTS idx_mo_portal_templates_person_active_meta_position_order
            ON public.mo_portal_templates (
                template_type,
                status,
                (COALESCE(meta ->> 'positionId', '')),
                updated_at DESC,
                created_at DESC
            )
            WHERE template_type = 'PERSON_ROLE'
              AND status = 'ACTIVE';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mo_portal_templates_person_active_role_seed_order
    ON public.mo_portal_templates (template_type, status, role_key, updated_at DESC, created_at DESC)
    WHERE template_type = 'PERSON_ROLE'
      AND status = 'ACTIVE'
      AND role_key IS NOT NULL;

-- ------------------------------
-- Portal template hierarchy integrity
-- ------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_template_sections_template_id_id
    ON public.mo_portal_template_sections (template_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mo_portal_template_items_template_id_id
    ON public.mo_portal_template_items (template_id, id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_mo_portal_template_items_template_section'
    ) THEN
        ALTER TABLE public.mo_portal_template_items
            ADD CONSTRAINT fk_mo_portal_template_items_template_section
            FOREIGN KEY (template_id, section_id)
            REFERENCES public.mo_portal_template_sections (template_id, id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_mo_portal_template_item_actions_template_item'
    ) THEN
        ALTER TABLE public.mo_portal_template_item_actions
            ADD CONSTRAINT fk_mo_portal_template_item_actions_template_item
            FOREIGN KEY (template_id, item_id)
            REFERENCES public.mo_portal_template_items (template_id, id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

ALTER TABLE public.mo_portal_template_items
    VALIDATE CONSTRAINT fk_mo_portal_template_items_template_section;

ALTER TABLE public.mo_portal_template_item_actions
    VALIDATE CONSTRAINT fk_mo_portal_template_item_actions_template_item;
