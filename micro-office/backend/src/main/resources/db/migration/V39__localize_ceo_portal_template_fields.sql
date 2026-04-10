UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'title', 'label', '工作标题'),
        jsonb_build_object('key', 'assignee', 'label', '负责人'),
        jsonb_build_object('key', 'priority', 'label', '优先级'),
        jsonb_build_object('key', 'deadline', 'label', '截止时间'),
        jsonb_build_object('key', 'status', 'label', '状态'),
        jsonb_build_object('key', 'source', 'label', '来源')
    ),
    'designRole', 'work-task-list'
),
updated_at = NOW(),
updated_by = 'migrate_v39_ceo_template_cn_labels'
WHERE id = 'portal_item_ceo_work_tasks';

UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'title', 'label', '会议主题'),
        jsonb_build_object('key', 'time', 'label', '会议时间'),
        jsonb_build_object('key', 'participants', 'label', '参与人'),
        jsonb_build_object('key', 'needDecision', 'label', '是否需决策'),
        jsonb_build_object('key', 'latestMessage', 'label', '最新提示')
    ),
    'designRole', 'meeting-list'
),
updated_at = NOW(),
updated_by = 'migrate_v39_ceo_template_cn_labels'
WHERE id = 'portal_item_ceo_work_meetings';

UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'name', 'label', '姓名'),
        jsonb_build_object('key', 'position', 'label', '岗位'),
        jsonb_build_object('key', 'orgName', 'label', '所属组织'),
        jsonb_build_object('key', 'openTasks', 'label', '未完成任务数'),
        jsonb_build_object('key', 'meetings', 'label', '关联会议数'),
        jsonb_build_object('key', 'relationHint', 'label', '关系提示')
    ),
    'designRole', 'internal-objects'
),
updated_at = NOW(),
updated_by = 'migrate_v39_ceo_template_cn_labels'
WHERE id = 'portal_item_ceo_internal_objects';

UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'title', 'label', '事件标题'),
        jsonb_build_object('key', 'eventType', 'label', '事件类型'),
        jsonb_build_object('key', 'severity', 'label', '严重程度'),
        jsonb_build_object('key', 'owner', 'label', '责任人'),
        jsonb_build_object('key', 'deadline', 'label', '截止时间'),
        jsonb_build_object('key', 'status', 'label', '状态')
    ),
    'designRole', 'event-center'
),
updated_at = NOW(),
updated_by = 'migrate_v39_ceo_template_cn_labels'
WHERE id = 'portal_item_ceo_event_list';

UPDATE public.mo_portal_template_items
SET meta = jsonb_build_object(
    'fields', jsonb_build_array(
        jsonb_build_object('key', 'title', 'label', '建议标题'),
        jsonb_build_object('key', 'action', 'label', '建议动作'),
        jsonb_build_object('key', 'reason', 'label', '原因'),
        jsonb_build_object('key', 'priority', 'label', '优先级')
    ),
    'designRole', 'ai-followups'
),
updated_at = NOW(),
updated_by = 'migrate_v39_ceo_template_cn_labels'
WHERE id = 'portal_item_ceo_ai_followups';
