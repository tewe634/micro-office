-- V1.1.14: structured sub-field storage for LIST fields

CREATE TABLE IF NOT EXISTS public.mo_workflow_template_field_list_sub_fields (
    id varchar(36) PRIMARY KEY,
    parent_field_key text NOT NULL,
    field_key text NOT NULL,
    name text NOT NULL,
    field_type text NOT NULL,
    required boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 100,
    description text,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT fk_mo_wf_tpl_field_list_sub_fields_parent
        FOREIGN KEY (parent_field_key)
        REFERENCES public.mo_workflow_template_field_definitions(field_key)
        ON DELETE CASCADE,
    CONSTRAINT uq_mo_wf_tpl_field_list_sub_fields_parent_key
        UNIQUE (parent_field_key, field_key),
    CONSTRAINT uq_mo_wf_tpl_field_list_sub_fields_parent_sort
        UNIQUE (parent_field_key, sort_order),
    CONSTRAINT ck_mo_wf_tpl_field_list_sub_fields_key_not_blank
        CHECK (btrim(field_key) <> ''),
    CONSTRAINT ck_mo_wf_tpl_field_list_sub_fields_name_not_blank
        CHECK (btrim(name) <> ''),
    CONSTRAINT ck_mo_wf_tpl_field_list_sub_fields_type_not_blank
        CHECK (btrim(field_type) <> ''),
    CONSTRAINT ck_mo_wf_tpl_field_list_sub_fields_sort_non_negative
        CHECK (sort_order >= 0),
    CONSTRAINT ck_mo_wf_tpl_field_list_sub_fields_no_nested_list
        CHECK (upper(field_type) <> 'LIST')
);

CREATE INDEX IF NOT EXISTS idx_mo_wf_tpl_field_list_sub_fields_parent_order
    ON public.mo_workflow_template_field_list_sub_fields(parent_field_key, sort_order, field_key);

CREATE OR REPLACE FUNCTION public.fn_mo_wf_tpl_list_sub_fields_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_type text;
BEGIN
    SELECT upper(field_type)
      INTO v_parent_type
      FROM public.mo_workflow_template_field_definitions
     WHERE field_key = NEW.parent_field_key;

    IF v_parent_type IS NULL THEN
        RAISE EXCEPTION 'parent field_key % not found in mo_workflow_template_field_definitions', NEW.parent_field_key;
    END IF;

    IF v_parent_type <> 'LIST' THEN
        RAISE EXCEPTION 'parent field_key % is %, not LIST; list sub-fields are forbidden', NEW.parent_field_key, v_parent_type;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mo_wf_tpl_list_sub_fields_guard
ON public.mo_workflow_template_field_list_sub_fields;

CREATE TRIGGER trg_mo_wf_tpl_list_sub_fields_guard
BEFORE INSERT OR UPDATE ON public.mo_workflow_template_field_list_sub_fields
FOR EACH ROW
EXECUTE FUNCTION public.fn_mo_wf_tpl_list_sub_fields_guard();

CREATE OR REPLACE FUNCTION public.fn_mo_wf_tpl_field_type_list_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF upper(NEW.field_type) <> 'LIST' THEN
        IF EXISTS (
            SELECT 1
              FROM public.mo_workflow_template_field_list_sub_fields s
             WHERE s.parent_field_key = NEW.field_key
        ) THEN
            RAISE EXCEPTION 'field_key % has list sub-fields; cannot change field_type from LIST to %', NEW.field_key, NEW.field_type;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mo_wf_tpl_field_type_list_guard
ON public.mo_workflow_template_field_definitions;

CREATE TRIGGER trg_mo_wf_tpl_field_type_list_guard
BEFORE UPDATE OF field_type ON public.mo_workflow_template_field_definitions
FOR EACH ROW
EXECUTE FUNCTION public.fn_mo_wf_tpl_field_type_list_guard();
