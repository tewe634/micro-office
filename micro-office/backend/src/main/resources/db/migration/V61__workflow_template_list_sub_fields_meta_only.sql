-- V1.1.14 adjustment: no new table, store LIST sub-fields in field-definitions.meta

-- 0) retire V60 table-based design (if applied)
DROP TRIGGER IF EXISTS trg_mo_wf_tpl_field_type_list_guard
ON public.mo_workflow_template_field_definitions;

DROP FUNCTION IF EXISTS public.fn_mo_wf_tpl_field_type_list_guard();

DROP TRIGGER IF EXISTS trg_mo_wf_tpl_list_sub_fields_guard
ON public.mo_workflow_template_field_list_sub_fields;

DROP FUNCTION IF EXISTS public.fn_mo_wf_tpl_list_sub_fields_guard();

DROP TABLE IF EXISTS public.mo_workflow_template_field_list_sub_fields;

-- 1) add meta container on main field-definition table
ALTER TABLE public.mo_workflow_template_field_definitions
    ADD COLUMN IF NOT EXISTS meta jsonb;

-- 2) base shape: meta must be object when present
ALTER TABLE public.mo_workflow_template_field_definitions
    DROP CONSTRAINT IF EXISTS ck_mo_wf_tpl_field_def_meta_object;

ALTER TABLE public.mo_workflow_template_field_definitions
    ADD CONSTRAINT ck_mo_wf_tpl_field_def_meta_object
    CHECK (
        meta IS NULL
        OR jsonb_typeof(meta) = 'object'
    );

-- 3) LIST sub-fields shape in meta.listSubFields (optional key)
ALTER TABLE public.mo_workflow_template_field_definitions
    DROP CONSTRAINT IF EXISTS ck_mo_wf_tpl_field_def_list_sub_fields_shape;

ALTER TABLE public.mo_workflow_template_field_definitions
    ADD CONSTRAINT ck_mo_wf_tpl_field_def_list_sub_fields_shape
    CHECK (
        meta IS NULL
        OR NOT (meta ? 'listSubFields')
        OR (
            jsonb_typeof(meta->'listSubFields') = 'array'
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.type() != "object")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldKey.type() != "string")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.name.type() != "string")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldType.type() != "string")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.required.type() != "boolean")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.sortOrder.type() != "number")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.description.type() != "string" && @.description.type() != "null")')
            AND NOT jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldType == "LIST")')
        )
    );

-- 4) non-LIST fields must not keep listSubFields residue
ALTER TABLE public.mo_workflow_template_field_definitions
    DROP CONSTRAINT IF EXISTS ck_mo_wf_tpl_field_def_non_list_no_sub_fields;

ALTER TABLE public.mo_workflow_template_field_definitions
    ADD CONSTRAINT ck_mo_wf_tpl_field_def_non_list_no_sub_fields
    CHECK (
        upper(field_type) = 'LIST'
        OR meta IS NULL
        OR NOT (meta ? 'listSubFields')
        OR meta->'listSubFields' = '[]'::jsonb
    );

-- 5) index for LIST field reads
CREATE INDEX IF NOT EXISTS idx_mo_wf_tpl_field_def_list_type
    ON public.mo_workflow_template_field_definitions (upper(field_type));
