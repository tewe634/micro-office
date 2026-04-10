UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'title', 'label', '工作标题'),
        jsonb_build_object('key', 'assignee', 'label', '负责人'),
        jsonb_build_object('key', 'deadline', 'label', '截止时间')
    ),
    'designRole', 'work-task-list'
),
updated_at = NOW(),
updated_by = 'migrate_v40_ceo_visible_fields'
WHERE id = 'portal_item_ceo_work_tasks';

UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'name', 'label', '姓名'),
        jsonb_build_object('key', 'openTasks', 'label', '未完成任务数'),
        jsonb_build_object('key', 'meetings', 'label', '关联会议数'),
        jsonb_build_object('key', 'relationHint', 'label', '关系提示')
    ),
    'designRole', 'internal-objects'
),
updated_at = NOW(),
updated_by = 'migrate_v40_ceo_visible_fields'
WHERE id = 'portal_item_ceo_internal_objects';
