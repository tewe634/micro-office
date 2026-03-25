CREATE TABLE IF NOT EXISTS sales_collab_group (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key       VARCHAR(50) NOT NULL UNIQUE,
    group_name      VARCHAR(100) NOT NULL,
    domain_key      VARCHAR(30) NOT NULL,
    description     TEXT,
    sort_order      INT NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_collab_scene (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_key       VARCHAR(50) NOT NULL UNIQUE,
    scene_name      VARCHAR(100) NOT NULL,
    domain_key      VARCHAR(30) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_collab_group_scene (
    group_id        VARCHAR(36) NOT NULL REFERENCES sales_collab_group(id) ON DELETE CASCADE,
    scene_id        VARCHAR(36) NOT NULL REFERENCES sales_collab_scene(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, scene_id)
);

CREATE TABLE IF NOT EXISTS sales_collab_template (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    applicable_scope    VARCHAR(30) NOT NULL DEFAULT 'SALES_DEPARTMENT',
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    remark              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_collab_template_rule (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         VARCHAR(36) NOT NULL REFERENCES sales_collab_template(id) ON DELETE CASCADE,
    group_id            VARCHAR(36) NOT NULL REFERENCES sales_collab_group(id) ON DELETE CASCADE,
    participant_role    VARCHAR(30) NOT NULL DEFAULT 'COLLABORATOR',
    source_type         VARCHAR(30) NOT NULL,
    source_ref_id       VARCHAR(36),
    source_ref_name     VARCHAR(100),
    resolve_scope_type  VARCHAR(30),
    resolve_scope_ref_id VARCHAR(36),
    duty_label          VARCHAR(50),
    sort_order          INT NOT NULL DEFAULT 0,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    remark              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_collab_template_rule_template ON sales_collab_template_rule(template_id);
CREATE INDEX IF NOT EXISTS idx_sales_collab_template_rule_template_group ON sales_collab_template_rule(template_id, group_id);

CREATE TABLE IF NOT EXISTS sales_collab_org_binding (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          VARCHAR(36) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    template_id     VARCHAR(36) NOT NULL REFERENCES sales_collab_template(id) ON DELETE CASCADE,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    remark          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS sales_collab_org_rule (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              VARCHAR(36) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    group_id            VARCHAR(36) NOT NULL REFERENCES sales_collab_group(id) ON DELETE CASCADE,
    participant_role    VARCHAR(30) NOT NULL DEFAULT 'COLLABORATOR',
    source_type         VARCHAR(30) NOT NULL,
    source_ref_id       VARCHAR(36),
    source_ref_name     VARCHAR(100),
    resolve_scope_type  VARCHAR(30),
    resolve_scope_ref_id VARCHAR(36),
    duty_label          VARCHAR(50),
    sort_order          INT NOT NULL DEFAULT 0,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    remark              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_collab_org_rule_org ON sales_collab_org_rule(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_collab_org_rule_org_group ON sales_collab_org_rule(org_id, group_id);

INSERT INTO sales_collab_group (group_key, group_name, domain_key, description, sort_order)
VALUES
    ('PRE_SALES_TECH', '售前技术协同', 'TECH', '销售与技术共同参与售前支持', 10),
    ('AFTER_SALES_TECH', '售后技术协同', 'TECH', '销售与技术共同参与售后技术支持', 20),
    ('COMMERCIAL_DOCS', '商务单证协同', 'COMMERCIAL', '销售与商务、助理、财务共同参与询价、报价、合同', 30),
    ('LOGISTICS', '物流协同', 'LOGISTICS', '销售与仓储共同参与产品物流', 40),
    ('MANAGEMENT_SYNC', '管理沟通协同', 'MANAGEMENT', '销售与领导共同参与业务沟通同步', 50)
ON CONFLICT (group_key) DO NOTHING;

INSERT INTO sales_collab_scene (scene_key, scene_name, domain_key, sort_order)
VALUES
    ('PRE_SALES_SUPPORT', '售前支持', 'TECH', 10),
    ('AFTER_SALES_SUPPORT', '售后技术支持', 'TECH', 20),
    ('INQUIRY', '询价', 'COMMERCIAL', 30),
    ('QUOTATION', '报价', 'COMMERCIAL', 40),
    ('CONTRACT', '合同', 'COMMERCIAL', 50),
    ('PRODUCT_LOGISTICS', '产品物流', 'LOGISTICS', 60),
    ('BUSINESS_SYNC', '业务沟通同步', 'MANAGEMENT', 70)
ON CONFLICT (scene_key) DO NOTHING;

INSERT INTO sales_collab_group_scene (group_id, scene_id, sort_order)
SELECT g.id, s.id, mapping.sort_order
FROM (
    VALUES
        ('PRE_SALES_TECH', 'PRE_SALES_SUPPORT', 10),
        ('AFTER_SALES_TECH', 'AFTER_SALES_SUPPORT', 20),
        ('COMMERCIAL_DOCS', 'INQUIRY', 30),
        ('COMMERCIAL_DOCS', 'QUOTATION', 40),
        ('COMMERCIAL_DOCS', 'CONTRACT', 50),
        ('LOGISTICS', 'PRODUCT_LOGISTICS', 60),
        ('MANAGEMENT_SYNC', 'BUSINESS_SYNC', 70)
) AS mapping(group_key, scene_key, sort_order)
JOIN sales_collab_group g ON g.group_key = mapping.group_key
JOIN sales_collab_scene s ON s.scene_key = mapping.scene_key
ON CONFLICT (group_id, scene_id) DO NOTHING;

INSERT INTO role_menu_permission (role, menu_key)
SELECT 'ADMIN', '/admin/sales-collab'
WHERE NOT EXISTS (
    SELECT 1 FROM role_menu_permission WHERE role = 'ADMIN' AND menu_key = '/admin/sales-collab'
);
