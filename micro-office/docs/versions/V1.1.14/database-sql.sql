-- V1.1.14 验收 SQL（收敛版：不新增表，仅 meta.listSubFields）

\echo '=== 1) 字段主表是否已有 meta 列 ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mo_workflow_template_field_definitions'
  AND column_name = 'meta';

\echo '=== 2) 关键约束是否存在 ==='
SELECT conname
FROM pg_constraint
WHERE conname IN (
  'ck_mo_wf_tpl_field_def_meta_object',
  'ck_mo_wf_tpl_field_def_list_sub_fields_shape',
  'ck_mo_wf_tpl_field_def_non_list_no_sub_fields'
)
ORDER BY conname;

\echo '=== 3) 非 LIST 字段残留 listSubFields 检查（应为 0） ==='
SELECT COUNT(*) AS non_list_with_list_sub_fields
FROM public.mo_workflow_template_field_definitions
WHERE upper(field_type) <> 'LIST'
  AND meta IS NOT NULL
  AND meta ? 'listSubFields'
  AND meta->'listSubFields' <> '[]'::jsonb;

\echo '=== 4) listSubFields 结构脏数据检查（应为 0） ==='
SELECT COUNT(*) AS invalid_list_sub_fields_shape
FROM public.mo_workflow_template_field_definitions
WHERE meta IS NOT NULL
  AND meta ? 'listSubFields'
  AND (
    jsonb_typeof(meta->'listSubFields') <> 'array'
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.type() != "object")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldKey.type() != "string")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.name.type() != "string")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldType.type() != "string")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.required.type() != "boolean")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.sortOrder.type() != "number")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.description.type() != "string" && @.description.type() != "null")')
    OR jsonb_path_exists(meta, '$.listSubFields[*] ? (@.fieldType == "LIST")')
  );

\echo '=== 5) 观测项：LIST 字段与已配置子结构数量 ==='
SELECT
  COUNT(*) FILTER (WHERE upper(field_type) = 'LIST') AS list_field_count,
  COUNT(*) FILTER (
    WHERE upper(field_type) = 'LIST'
      AND meta IS NOT NULL
      AND meta ? 'listSubFields'
      AND jsonb_typeof(meta->'listSubFields') = 'array'
      AND jsonb_array_length(meta->'listSubFields') > 0
  ) AS list_fields_with_sub_defs
FROM public.mo_workflow_template_field_definitions;
