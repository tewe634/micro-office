INSERT INTO public.mo_portal_templates (
    id,
    code,
    name,
    template_type,
    role_key,
    status,
    version,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
) VALUES (
    'portal_tpl_person_ceo_v1',
    'POSITION_CEO_DASHBOARD_V1',
    'CEO岗位驾驶舱模板V1',
    'PERSON_ROLE',
    NULL,
    'ACTIVE',
    1,
    '{
      "page_kind": "PORTAL",
      "layout_mode": "ceo-dashboard-v1",
      "generatedFrom": "POSITION",
      "positionId": "8eaffafb-8a94-4c90-98ee-24af85a93f8f",
      "positionName": "CEO",
      "positionCode": "CEO",
      "designIntent": "executive-decision-dashboard",
      "description": "CEO岗位模板，聚焦经营指标、会议待办、重大风险、AI摘要。"
    }'::jsonb,
    NOW(),
    'seed_ceo_dashboard_v1',
    NOW(),
    'seed_ceo_dashboard_v1'
);

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
    'portal_sec_ceo_overview', 'portal_tpl_person_ceo_v1', 'EXEC_OVERVIEW', '经营总览', 'BLOCK', 10,
    '{"layout":{"region":"top","span":24},"designWeight":"highest","description":"CEO最核心经营指标总览"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_sec_ceo_workbench', 'portal_tpl_person_ceo_v1', 'EXEC_WORKBENCH', '会议 / 待办', 'BLOCK', 20,
    '{"layout":{"region":"main","span":8,"column":1},"designWeight":"high","description":"需要CEO参与或决策的会议与待办"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_sec_ceo_alerts', 'portal_tpl_person_ceo_v1', 'EXEC_ALERTS', '重大风险与异常', 'BLOCK', 30,
    '{"layout":{"region":"main","span":9,"column":2},"designWeight":"highest","description":"超预算支出、大额合同、紧急付款、人事异动等异常事件"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_sec_ceo_ai', 'portal_tpl_person_ceo_v1', 'AI_BRIEF', 'AI提示', 'BLOCK', 40,
    '{"layout":{"region":"main","span":7,"column":3},"designWeight":"high","anchor":"right","description":"汇总摘要、参与会议、协作工作通知"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
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
    'portal_item_ceo_kpi_metrics', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_overview', 'ceo_kpi_metrics', '核心经营指标', 'ceo.kpi_metrics', 'STAT', 10,
    '{"fields":[{"key":"revenue","label":"营收","unit":"¥","trend":true},{"key":"profit_margin","label":"利润率","unit":"%","trend":true},{"key":"cash_flow","label":"现金流","unit":"¥","trend":true},{"key":"collections","label":"回款","unit":"¥","trend":true},{"key":"revenue_per_capita","label":"人效","unit":"¥/人","trend":true}],"designRole":"kpi-overview"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_meeting_list', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_workbench', 'ceo_meeting_list', '会议', 'ceo.meeting_list', 'LIST', 10,
    '{"fields":["title","time","participants","level","needDecision"],"designRole":"meeting-list"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_todo_list', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_workbench', 'ceo_todo_list', '待办', 'ceo.todo_list', 'LIST', 20,
    '{"fields":["title","source","priority","deadline","status"],"designRole":"todo-list"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_exception_alerts', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_alerts', 'ceo_exception_alerts', '重大风险与异常', 'ceo.exception_alerts', 'LIST', 10,
    '{"categories":["OVER_BUDGET","LARGE_CONTRACT","URGENT_PAYMENT","HR_CHANGE"],"fields":["title","category","severity","amount","owner","createdAt"],"defaultSort":"severity_desc","designRole":"risk-center"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_ai_summary', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_ai', 'ceo_ai_summary', '汇总摘要', 'ceo.ai_summary', 'TEXT', 10,
    '{"style":"brief","designRole":"ai-summary"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_participated_meetings', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_ai', 'ceo_participated_meetings', '参与的会议', 'ceo.participated_meetings', 'LIST', 20,
    '{"fields":["title","time","decisionPoint"],"designRole":"meeting-summary"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_item_ceo_collab_notifications', 'portal_tpl_person_ceo_v1', 'portal_sec_ceo_ai', 'ceo_collab_notifications', '协作工作通知', 'ceo.collab_notifications', 'LIST', 30,
    '{"fields":["title","from","priority","time"],"designRole":"collab-notify"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
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
    'portal_action_ceo_meeting_open', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_meeting_list', 'open_workbench_session', NULL, 'items[].entry_id', 'DAILY_ENTRY', '{"entryCode":"CEO_MEETING_DETAIL"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_action_ceo_todo_open', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_todo_list', 'open_workbench_session', NULL, 'items[].entry_id', 'DAILY_ENTRY', '{"entryCode":"CEO_TODO_DETAIL"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
),
(
    'portal_action_ceo_alert_open', 'portal_tpl_person_ceo_v1', 'portal_item_ceo_exception_alerts', 'open_workbench_session', NULL, 'items[].entry_id', 'DAILY_ENTRY', '{"entryCode":"CEO_RISK_CENTER"}'::jsonb,
    NOW(), 'seed_ceo_dashboard_v1', NOW(), 'seed_ceo_dashboard_v1'
);
