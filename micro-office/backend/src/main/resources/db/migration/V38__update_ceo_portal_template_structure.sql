UPDATE public.mo_portal_templates
SET name = 'CEO岗位驾驶舱模板V1',
    status = 'ACTIVE',
    version = GREATEST(version, 2),
    meta = jsonb_build_object(
        'page_kind', 'PORTAL',
        'layout_mode', 'ceo-dashboard-v1',
        'generatedFrom', 'POSITION',
        'positionId', '8eaffafb-8a94-4c90-98ee-24af85a93f8f',
        'positionName', 'CEO',
        'positionCode', 'CEO',
        'designIntent', 'executive-collaboration-dashboard',
        'description', 'CEO岗位模板，聚焦工作与会议、内部对象、事件、AI总结。',
        'globalSearch', jsonb_build_object(
            'enabled', true,
            'placeholder', '搜索全局相关内容'
        )
    ),
    updated_at = NOW(),
    updated_by = 'migrate_v38_ceo_template_v2'
WHERE id = 'portal_tpl_person_ceo_v1';

DELETE FROM public.mo_portal_template_item_actions
WHERE template_id = 'portal_tpl_person_ceo_v1';

DELETE FROM public.mo_portal_template_items
WHERE template_id = 'portal_tpl_person_ceo_v1';

DELETE FROM public.mo_portal_template_sections
WHERE template_id = 'portal_tpl_person_ceo_v1';

INSERT INTO public.mo_portal_template_sections (
    id,
    template_id,
    code,
    name,
    section_type,
    sort_order,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
) VALUES
(
    'portal_sec_ceo_work_meeting', 'portal_tpl_person_ceo_v1', 'WORK_MEETING', '工作与会议', 'BLOCK', 10,
    '{"layout":{"region":"main","span":12,"column":1},"designWeight":"highest","description":"布置的工作、需协助解决的任务、组织的会议与需要参加的会议。"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_sec_ceo_internal_objects', 'portal_tpl_person_ceo_v1', 'INTERNAL_OBJECTS', '内部对象', 'BLOCK', 20,
    '{"layout":{"region":"main","span":12,"column":2},"designWeight":"high","description":"聚焦组织内部负责人、关键岗位、销售及内部协同关系。"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_sec_ceo_events', 'portal_tpl_person_ceo_v1', 'EVENTS', '事件', 'BLOCK', 30,
    '{"layout":{"region":"main","span":12,"column":1},"designWeight":"highest","description":"汇总自己关注的事情、公司紧急的工作以及异常事件。"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_sec_ceo_ai_summary', 'portal_tpl_person_ceo_v1', 'AI_SUMMARY', 'AI总结', 'BLOCK', 40,
    '{"layout":{"region":"main","span":12,"column":2},"designWeight":"high","description":"承接AI/Agent后续分析、汇总与建议。"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
);

INSERT INTO public.mo_portal_template_items (
    id,
    template_id,
    section_id,
    item_key,
    label,
    data_key,
    display_type,
    sort_order,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
) VALUES
(
    'portal_item_ceo_work_tasks', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_work_meeting', 'ceo_work_tasks', '工作任务', 'ceo.todo_list', 'LIST', 10,
    '{"fields":["title","assignee","priority","deadline","status","source"],"designRole":"work-task-list"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_item_ceo_work_meetings', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_work_meeting', 'ceo_work_meetings', '会议', 'ceo.meeting_list', 'LIST', 20,
    '{"fields":["title","time","participants","needDecision","latestMessage"],"designRole":"meeting-list"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_item_ceo_internal_objects', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_internal_objects', 'ceo_internal_objects', '内部对象', 'ceo.internal_objects', 'LIST', 10,
    '{"fields":["name","position","orgName","openTasks","meetings","relationHint"],"designRole":"internal-objects"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_item_ceo_event_list', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_events', 'ceo_event_list', '事件', 'ceo.event_list', 'LIST', 10,
    '{"fields":["title","eventType","severity","owner","deadline","status"],"designRole":"event-center"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_item_ceo_ai_summary', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_ai_summary', 'ceo_ai_summary', 'AI总结', 'ceo.ai_summary', 'TEXT', 10,
    '{"style":"brief","designRole":"ai-summary"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_item_ceo_ai_followups', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_ai_summary', 'ceo_ai_followups', 'AI建议', 'ceo.ai_followups', 'LIST', 20,
    '{"fields":["title","action","reason","priority"],"designRole":"ai-followups"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
);

INSERT INTO public.mo_portal_template_item_actions (
    id,
    template_id,
    item_id,
    action_type,
    target_subject_type,
    target_id_path,
    session_type,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
) VALUES
(
    'portal_action_ceo_work_task_open', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_work_tasks', 'open_workbench_session', NULL, 'items[].entry_id', 'DAILY_ENTRY', '{"entryCode":"CEO_TODO_DETAIL"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_action_ceo_work_meeting_open', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_work_meetings', 'open_workbench_session', NULL, 'items[].entry_id', 'DAILY_ENTRY', '{"entryCode":"CEO_MEETING_DETAIL"}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
),
(
    'portal_action_ceo_internal_person_switch', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_internal_objects', 'switch_subject', 'PERSON', 'items[].person_id', NULL, '{}'::jsonb,
    NOW(), 'migrate_v38_ceo_template_v2', NOW(), 'migrate_v38_ceo_template_v2'
);
