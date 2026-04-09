CREATE TABLE public.mo_portal_templates (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    template_type text NOT NULL,
    role_key text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT ck_mo_portal_templates_code_not_blank CHECK ((btrim(code) <> ''::text)),
    CONSTRAINT ck_mo_portal_templates_name_not_blank CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT ck_mo_portal_templates_role_enum CHECK (((role_key IS NULL) OR (role_key = ANY (ARRAY['SALES'::text, 'FINANCE'::text, 'HR'::text])))),
    CONSTRAINT ck_mo_portal_templates_status_not_blank CHECK ((btrim(status) <> ''::text)),
    CONSTRAINT ck_mo_portal_templates_type_enum CHECK ((template_type = ANY (ARRAY['PERSON_ROLE'::text, 'PRODUCT'::text, 'CUSTOMER_COMPANY'::text, 'SUPPLIER'::text, 'CARRIER'::text, 'BANK'::text, 'ORGANIZATION'::text]))),
    CONSTRAINT ck_mo_portal_templates_type_not_blank CHECK ((btrim(template_type) <> ''::text)),
    CONSTRAINT mo_portal_templates_pkey PRIMARY KEY (id),
    CONSTRAINT uq_mo_portal_templates_code UNIQUE (code)
);

CREATE TABLE public.mo_portal_template_sections (
    id text NOT NULL,
    template_id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    section_type text DEFAULT 'BLOCK'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT ck_mo_portal_template_sections_code_not_blank CHECK ((btrim(code) <> ''::text)),
    CONSTRAINT ck_mo_portal_template_sections_name_not_blank CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT ck_mo_portal_template_sections_type_not_blank CHECK ((btrim(section_type) <> ''::text)),
    CONSTRAINT mo_portal_template_sections_pkey PRIMARY KEY (id),
    CONSTRAINT fk_mo_portal_template_sections_template FOREIGN KEY (template_id) REFERENCES public.mo_portal_templates(id) ON DELETE CASCADE
);

CREATE TABLE public.mo_portal_template_items (
    id text NOT NULL,
    template_id text NOT NULL,
    section_id text NOT NULL,
    item_key text NOT NULL,
    label text NOT NULL,
    data_key text NOT NULL,
    display_type text DEFAULT 'STAT'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT ck_mo_portal_template_items_data_key_not_blank CHECK ((btrim(data_key) <> ''::text)),
    CONSTRAINT ck_mo_portal_template_items_display_enum CHECK ((display_type = ANY (ARRAY['STAT'::text, 'LIST'::text, 'CARD'::text, 'TEXT'::text]))),
    CONSTRAINT ck_mo_portal_template_items_display_type_not_blank CHECK ((btrim(display_type) <> ''::text)),
    CONSTRAINT ck_mo_portal_template_items_key_not_blank CHECK ((btrim(item_key) <> ''::text)),
    CONSTRAINT ck_mo_portal_template_items_label_not_blank CHECK ((btrim(label) <> ''::text)),
    CONSTRAINT mo_portal_template_items_pkey PRIMARY KEY (id),
    CONSTRAINT fk_mo_portal_template_items_section FOREIGN KEY (section_id) REFERENCES public.mo_portal_template_sections(id) ON DELETE CASCADE,
    CONSTRAINT fk_mo_portal_template_items_template FOREIGN KEY (template_id) REFERENCES public.mo_portal_templates(id) ON DELETE CASCADE
);

CREATE TABLE public.mo_portal_template_item_actions (
    id text NOT NULL,
    template_id text NOT NULL,
    item_id text NOT NULL,
    action_type text NOT NULL,
    target_subject_type text,
    target_id_path text,
    session_type text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT ck_mo_portal_template_item_actions_type_enum CHECK ((action_type = ANY (ARRAY['switch_subject'::text, 'open_workbench_session'::text]))),
    CONSTRAINT ck_mo_portal_template_item_actions_type_not_blank CHECK ((btrim(action_type) <> ''::text)),
    CONSTRAINT mo_portal_template_item_actions_pkey PRIMARY KEY (id),
    CONSTRAINT fk_mo_portal_template_item_actions_item FOREIGN KEY (item_id) REFERENCES public.mo_portal_template_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_mo_portal_template_item_actions_template FOREIGN KEY (template_id) REFERENCES public.mo_portal_templates(id) ON DELETE CASCADE
);

CREATE INDEX idx_mo_portal_templates_type_role ON public.mo_portal_templates USING btree (template_type, role_key) WHERE (role_key IS NOT NULL);
CREATE INDEX idx_mo_portal_templates_type_status ON public.mo_portal_templates USING btree (template_type, status);
CREATE INDEX idx_mo_portal_template_sections_template_sort ON public.mo_portal_template_sections USING btree (template_id, sort_order);
CREATE UNIQUE INDEX uq_mo_portal_template_sections_template_code ON public.mo_portal_template_sections USING btree (template_id, code);
CREATE INDEX idx_mo_portal_template_items_section_sort ON public.mo_portal_template_items USING btree (section_id, sort_order);
CREATE UNIQUE INDEX uq_mo_portal_template_items_section_key ON public.mo_portal_template_items USING btree (section_id, item_key);
CREATE INDEX idx_mo_portal_template_item_actions_item ON public.mo_portal_template_item_actions USING btree (item_id);
CREATE INDEX idx_mo_portal_template_item_actions_type ON public.mo_portal_template_item_actions USING btree (action_type);

INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_person_sales', 'PERSON_SALES', '销售岗门户模板', 'PERSON_ROLE', 'SALES', 'ACTIVE', 1, '{"page_kind": "PORTAL", "layout_version": "FIX1.1.8"}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_person_finance', 'PERSON_FINANCE', '财务岗门户模板', 'PERSON_ROLE', 'FINANCE', 'ACTIVE', 1, '{"page_kind": "PORTAL", "layout_version": "FIX1.1.8"}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_person_hr', 'PERSON_HR', 'HR门户模板', 'PERSON_ROLE', 'HR', 'ACTIVE', 1, '{"page_kind": "PORTAL", "layout_version": "FIX1.1.8"}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_product', 'PRODUCT_PORTAL', '产品门户模板', 'PRODUCT', NULL, 'ACTIVE', 1, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_supplier', 'SUPPLIER_PORTAL', '供应商门户模板', 'SUPPLIER', NULL, 'ACTIVE', 1, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_carrier', 'CARRIER_PORTAL', '承运商门户模板', 'CARRIER', NULL, 'ACTIVE', 1, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_bank', 'BANK_PORTAL', '银行门户模板', 'BANK', NULL, 'ACTIVE', 1, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_customer', 'CUSTOMER_PORTAL', '客户公司门户模板', 'CUSTOMER_COMPANY', NULL, 'ACTIVE', 1, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_templates VALUES ('portal_tpl_organization', 'ORGANIZATION_PORTAL', '组织门户模板', 'ORGANIZATION', NULL, 'ACTIVE', 1, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');

INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_product_basic', 'portal_tpl_product', 'BASIC', '基础信息', 'BLOCK', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_supplier_basic', 'portal_tpl_supplier', 'BASIC', '基础信息', 'BLOCK', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_basic', 'portal_tpl_person_sales', 'BASIC_INFO', '基础信息', 'BLOCK', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_customer', 'portal_tpl_person_sales', 'CUSTOMER_LIST', '客户列表', 'BLOCK', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_daily', 'portal_tpl_person_sales', 'DAILY', '日常', 'BLOCK', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_relation', 'portal_tpl_person_sales', 'RELATION_GRAPH', '关系图', 'BLOCK', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_ai', 'portal_tpl_person_sales', 'AI_REMINDERS', 'AI提醒', 'BLOCK', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_basic', 'portal_tpl_person_finance', 'BASIC_INFO', '基础信息', 'BLOCK', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_customer', 'portal_tpl_person_finance', 'CUSTOMER_LIST', '客户列表', 'BLOCK', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_daily', 'portal_tpl_person_finance', 'DAILY', '日常', 'BLOCK', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_relation', 'portal_tpl_person_finance', 'RELATION_GRAPH', '关系图', 'BLOCK', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_ai', 'portal_tpl_person_finance', 'AI_REMINDERS', 'AI提醒', 'BLOCK', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_basic', 'portal_tpl_person_hr', 'BASIC_INFO', '基础信息', 'BLOCK', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_customer', 'portal_tpl_person_hr', 'CUSTOMER_LIST', '客户列表', 'BLOCK', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_daily', 'portal_tpl_person_hr', 'DAILY', '日常', 'BLOCK', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_relation', 'portal_tpl_person_hr', 'RELATION_GRAPH', '关系图', 'BLOCK', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_ai', 'portal_tpl_person_hr', 'AI_REMINDERS', 'AI提醒', 'BLOCK', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_carrier_basic', 'portal_tpl_carrier', 'BASIC', '基础信息', 'BLOCK', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_bank_basic', 'portal_tpl_bank', 'BASIC', '基础信息', 'BLOCK', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_customer_basic', 'portal_tpl_customer', 'BASIC_INFO', '基础信息', 'BLOCK', 10, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_customer_stats', 'portal_tpl_customer', 'BUSINESS_STATS', '业务统计', 'BLOCK', 20, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_customer_orders', 'portal_tpl_customer', 'ORDER_LIST', '订单列表', 'BLOCK', 30, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_customer_related', 'portal_tpl_customer', 'COMPANY_RELATED', '公司关联信息', 'BLOCK', 40, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_org_basic', 'portal_tpl_organization', 'BASIC_INFO', '基础信息', 'BLOCK', 10, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_org_stats', 'portal_tpl_organization', 'STATS_INFO', '统计信息', 'BLOCK', 20, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_org_rewards', 'portal_tpl_organization', 'REWARDS_PENALTIES', '部门奖惩', 'BLOCK', 30, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_org_star_projects', 'portal_tpl_organization', 'STAR_PROJECTS', '明星项目', 'BLOCK', 40, '{}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_sales_todo', 'portal_tpl_person_sales', 'TODO', '处理中', 'BLOCK', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_finance_todo', 'portal_tpl_person_finance', 'TODO', '处理中', 'BLOCK', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_sections VALUES ('portal_sec_hr_todo', 'portal_tpl_person_hr', 'TODO', '处理中', 'BLOCK', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');

INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_basic', 'portal_tpl_person_sales', 'portal_sec_sales_basic', 'basic_info', '基础信息', 'basic_info', 'CARD', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_todo', 'portal_tpl_person_sales', 'portal_sec_sales_todo', 'todo_list', '我的提醒', 'todo_list', 'LIST', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_customer', 'portal_tpl_person_sales', 'portal_sec_sales_customer', 'customer_list', '客户列表', 'customer_list', 'LIST', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_daily', 'portal_tpl_person_sales', 'portal_sec_sales_daily', 'daily_list', '快捷入口', 'daily_list', 'LIST', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_relation', 'portal_tpl_person_sales', 'portal_sec_sales_relation', 'relation_graph', '人员协作', 'relation_graph', 'CARD', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_sales_ai', 'portal_tpl_person_sales', 'portal_sec_sales_ai', 'aiwarn_list', '智能建议', 'aiwarn_list', 'LIST', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_basic', 'portal_tpl_person_finance', 'portal_sec_finance_basic', 'basic_info', '基础信息', 'basic_info', 'CARD', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_todo', 'portal_tpl_person_finance', 'portal_sec_finance_todo', 'todo_list', '我的提醒', 'todo_list', 'LIST', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_customer', 'portal_tpl_person_finance', 'portal_sec_finance_customer', 'customer_list', '客户列表', 'customer_list', 'LIST', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_daily', 'portal_tpl_person_finance', 'portal_sec_finance_daily', 'daily_list', '快捷入口', 'daily_list', 'LIST', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_relation', 'portal_tpl_person_finance', 'portal_sec_finance_relation', 'relation_graph', '人员协作', 'relation_graph', 'CARD', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_finance_ai', 'portal_tpl_person_finance', 'portal_sec_finance_ai', 'aiwarn_list', '智能建议', 'aiwarn_list', 'LIST', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_basic', 'portal_tpl_person_hr', 'portal_sec_hr_basic', 'basic_info', '基础信息', 'basic_info', 'CARD', 10, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_todo', 'portal_tpl_person_hr', 'portal_sec_hr_todo', 'todo_list', '我的提醒', 'todo_list', 'LIST', 20, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_customer', 'portal_tpl_person_hr', 'portal_sec_hr_customer', 'customer_list', '客户列表', 'customer_list', 'LIST', 30, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_daily', 'portal_tpl_person_hr', 'portal_sec_hr_daily', 'daily_list', '快捷入口', 'daily_list', 'LIST', 40, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_relation', 'portal_tpl_person_hr', 'portal_sec_hr_relation', 'relation_graph', '人员协作', 'relation_graph', 'CARD', 50, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_hr_ai', 'portal_tpl_person_hr', 'portal_sec_hr_ai', 'aiwarn_list', '智能建议', 'aiwarn_list', 'LIST', 60, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_product_view', 'portal_tpl_product', 'portal_sec_product_basic', 'product_profile', '产品信息', 'product_profile', 'CARD', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_supplier_view', 'portal_tpl_supplier', 'portal_sec_supplier_basic', 'supplier_profile', '供应商信息', 'supplier_profile', 'CARD', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_carrier_view', 'portal_tpl_carrier', 'portal_sec_carrier_basic', 'carrier_profile', '承运商信息', 'carrier_profile', 'CARD', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_bank_view', 'portal_tpl_bank', 'portal_sec_bank_basic', 'bank_profile', '银行信息', 'bank_profile', 'CARD', 10, '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_customer_basic', 'portal_tpl_customer', 'portal_sec_customer_basic', 'customer_basic_info', '基础信息', 'customer_basic_info', 'CARD', 10, '{"fields": ["industry", "company_scale", "company_owner", "contact_name", "contact_position", "contact_phone"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_customer_stats', 'portal_tpl_customer', 'portal_sec_customer_stats', 'customer_business_stats', '业务统计', 'customer_business_stats', 'STAT', 20, '{"fields": ["order_count", "trade_amount", "outstanding_amount", "star_products", "peak_trade_year", "peak_trade_amount", "low_trade_year", "low_trade_amount"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_customer_orders', 'portal_tpl_customer', 'portal_sec_customer_orders', 'customer_order_list', '订单列表', 'customer_order_list', 'LIST', 30, '{"fields": ["order_id", "order_name", "order_amount", "order_status", "sign_date"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_customer_related', 'portal_tpl_customer', 'portal_sec_customer_related', 'customer_company_related_info', '公司关联信息', 'customer_company_related_info', 'CARD', 40, '{"fields": ["equity_structure", "credit_rating", "external_risk_info", "company_news"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_org_basic', 'portal_tpl_organization', 'portal_sec_org_basic', 'organization_basic_info', '基础信息', 'organization_basic_info', 'CARD', 10, '{"fields": ["leader", "members", "parent_department", "child_departments"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_org_stats', 'portal_tpl_organization', 'portal_sec_org_stats', 'organization_stats_info', '统计信息', 'organization_stats_info', 'STAT', 20, '{"fields": ["year_performance", "recovered_arrears"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_org_rewards', 'portal_tpl_organization', 'portal_sec_org_rewards', 'organization_rewards_penalties', '部门奖惩', 'organization_rewards_penalties', 'LIST', 30, '{"fields": ["reward_penalty_date", "reward_penalty_type", "reward_penalty_title", "reward_penalty_desc"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');
INSERT INTO public.mo_portal_template_items VALUES ('portal_item_org_star_projects', 'portal_tpl_organization', 'portal_sec_org_star_projects', 'organization_star_projects', '明星项目', 'organization_star_projects', 'LIST', 40, '{"fields": ["project_id", "project_name", "project_owner", "project_amount", "project_status"]}', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org', '2026-04-07 13:27:37.057124+00', 'seed_v1_2_6_customer_org');

INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_supplier_open', 'portal_tpl_supplier', 'portal_item_supplier_view', 'open_workbench_session', NULL, 'supplier_id', 'SUPPLIER', '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_carrier_open', 'portal_tpl_carrier', 'portal_item_carrier_view', 'open_workbench_session', NULL, 'carrier_id', 'CARRIER', '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_bank_open', 'portal_tpl_bank', 'portal_item_bank_view', 'open_workbench_session', NULL, 'bank_id', 'BANK', '{}', '2026-04-02 02:27:49.627645+00', 'seed_v1_2_1', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_sales_daily_open', 'portal_tpl_person_sales', 'portal_item_sales_daily', 'open_workbench_session', NULL, 'items[].daily_entry_id', 'DAILY_ENTRY', '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_finance_daily_open', 'portal_tpl_person_finance', 'portal_item_finance_daily', 'open_workbench_session', NULL, 'items[].daily_entry_id', 'DAILY_ENTRY', '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_hr_daily_open', 'portal_tpl_person_hr', 'portal_item_hr_daily', 'open_workbench_session', NULL, 'items[].daily_entry_id', 'DAILY_ENTRY', '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_sales_relation_person_switch', 'portal_tpl_person_sales', 'portal_item_sales_relation', 'switch_subject', 'PERSON', 'nodes[].person_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_sales_relation_org_switch', 'portal_tpl_person_sales', 'portal_item_sales_relation', 'switch_subject', 'ORGANIZATION', 'nodes[].organization_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_finance_relation_person_switch', 'portal_tpl_person_finance', 'portal_item_finance_relation', 'switch_subject', 'PERSON', 'nodes[].person_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_finance_relation_org_switch', 'portal_tpl_person_finance', 'portal_item_finance_relation', 'switch_subject', 'ORGANIZATION', 'nodes[].organization_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_hr_relation_person_switch', 'portal_tpl_person_hr', 'portal_item_hr_relation', 'switch_subject', 'PERSON', 'nodes[].person_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
INSERT INTO public.mo_portal_template_item_actions VALUES ('portal_action_hr_relation_org_switch', 'portal_tpl_person_hr', 'portal_item_hr_relation', 'switch_subject', 'ORGANIZATION', 'nodes[].organization_id', NULL, '{}', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8', '2026-04-03 08:03:28.262609+00', 'seed_fix1_1_8');
