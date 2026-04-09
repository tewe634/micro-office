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
    'portal_tpl_person_sales_v2',
    'PERSON_SALES_LAYOUT_V2',
    '销售岗位门户模板V2',
    'PERSON_ROLE',
    'SALES',
    'DRAFT',
    2,
    '{
      "page_kind": "PORTAL",
      "layout_version": "FIX1.1.8",
      "layout_mode": "sales-dashboard-v1",
      "reference_image": "ba74c568c5a54d4b81fc04f22fdc34c4.png",
      "design_priority": "REFERENCE_IMAGE_FIRST",
      "description": "优先参考销售门户截图的模块布局，先贴近信息架构与主次关系。",
      "hostFeatures": {
        "globalSearch": true,
        "searchScopes": ["CUSTOMER", "PRODUCT", "PERSON", "ORGANIZATION"]
      }
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
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
    'portal_sec_sales_v2_overview',
    'portal_tpl_person_sales_v2',
    'OVERVIEW',
    '顶部概览',
    'BLOCK',
    10,
    '{
      "layout": {"region": "top", "span": 24, "mode": "header-summary"},
      "description": "顶部人员信息与销售概览，承接截图中的岗位信息和绩效信息。"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_sec_sales_v2_todo',
    'portal_tpl_person_sales_v2',
    'TODO',
    '处理中',
    'BLOCK',
    20,
    '{
      "layout": {"region": "main", "span": 5, "column": 1},
      "caption": "我的提醒",
      "designWeight": "high"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_sec_sales_v2_customer',
    'portal_tpl_person_sales_v2',
    'CUSTOMER_LIST',
    '客户列表',
    'BLOCK',
    30,
    '{
      "layout": {"region": "main", "span": 8, "column": 2},
      "caption": "点击切换",
      "designWeight": "highest",
      "emphasis": "primary"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_sec_sales_v2_daily',
    'portal_tpl_person_sales_v2',
    'DAILY',
    '日常',
    'BLOCK',
    40,
    '{
      "layout": {"region": "main", "span": 4, "column": 3},
      "caption": "快捷入口",
      "designWeight": "medium"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_sec_sales_v2_relation',
    'portal_tpl_person_sales_v2',
    'RELATION_GRAPH',
    '关系图',
    'BLOCK',
    50,
    '{
      "layout": {"region": "main", "span": 4, "column": 4},
      "emptyText": "暂无信息",
      "designWeight": "medium"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_sec_sales_v2_ai',
    'portal_tpl_person_sales_v2',
    'AI_REMINDERS',
    'AI提醒',
    'BLOCK',
    60,
    '{
      "layout": {"region": "main", "span": 3, "column": 5},
      "caption": "智能建议",
      "designWeight": "high",
      "anchor": "right"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
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
    'portal_item_sales_v2_basic',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_overview',
    'basic_info',
    '基础信息',
    'basic_info',
    'CARD',
    10,
    '{
      "layout": {"span": 14},
      "fields": ["name", "positionName", "orgName", "phone", "email", "primaryPositionName"],
      "designRole": "identity"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_summary',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_overview',
    'sales_summary',
    '销售概览',
    'sales.summary',
    'STAT',
    20,
    '{
      "layout": {"span": 10},
      "keys": ["performance", "customers", "products", "openWork"],
      "designRole": "summary"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_todo',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_todo',
    'todo_list',
    '我的提醒',
    'todo_list',
    'LIST',
    10,
    '{
      "fields": ["title", "status", "stage", "updatedAt"],
      "defaultFilter": "OPEN",
      "designRole": "todo"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_customer',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_customer',
    'customer_list',
    '客户列表',
    'customer_list',
    'LIST',
    10,
    '{
      "fields": ["name", "amount", "productCount", "workItemCount", "lastActiveAt"],
      "designRole": "primary-list"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_daily',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_daily',
    'daily_list',
    '快捷入口',
    'daily_list',
    'LIST',
    10,
    '{
      "fields": ["label", "value", "suffix", "hint"],
      "designRole": "shortcut"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_relation',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_relation',
    'relation_graph',
    '关系图',
    'relation_graph',
    'CARD',
    10,
    '{
      "emptyText": "暂无信息",
      "designRole": "graph"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_item_sales_v2_ai',
    'portal_tpl_person_sales_v2',
    'portal_sec_sales_v2_ai',
    'aiwarn_list',
    '智能建议',
    'aiwarn_list',
    'LIST',
    10,
    '{
      "fields": ["title", "content", "level"],
      "designRole": "ai-reminders"
    }'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
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
    'portal_action_sales_v2_customer_switch',
    'portal_tpl_person_sales_v2',
    'portal_item_sales_v2_customer',
    'switch_subject',
    'CUSTOMER_COMPANY',
    'items[].id',
    NULL,
    '{}'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_action_sales_v2_daily_open',
    'portal_tpl_person_sales_v2',
    'portal_item_sales_v2_daily',
    'open_workbench_session',
    NULL,
    'items[].daily_entry_id',
    'DAILY_ENTRY',
    '{}'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_action_sales_v2_relation_person',
    'portal_tpl_person_sales_v2',
    'portal_item_sales_v2_relation',
    'switch_subject',
    'PERSON',
    'nodes[].person_id',
    NULL,
    '{}'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
),
(
    'portal_action_sales_v2_relation_org',
    'portal_tpl_person_sales_v2',
    'portal_item_sales_v2_relation',
    'switch_subject',
    'ORGANIZATION',
    'nodes[].organization_id',
    NULL,
    '{}'::jsonb,
    NOW(),
    'seed_sales_layout_v2',
    NOW(),
    'seed_sales_layout_v2'
);
