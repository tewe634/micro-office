-- V1: 基础数据模块 + 工作流程 + 打卡

-- ==================== 基础数据 ====================

-- 组织（树形）
CREATE TABLE organization (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    parent_id   VARCHAR(36) REFERENCES organization(id),
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 岗位（树形）
CREATE TABLE position (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50) NOT NULL UNIQUE,
    parent_id   VARCHAR(36) REFERENCES position(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户
CREATE TABLE sys_user (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(50) NOT NULL,
    phone               VARCHAR(20),
    email               VARCHAR(100) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    org_id              VARCHAR(36) REFERENCES organization(id),
    primary_position_id VARCHAR(36) REFERENCES position(id),
    hired_at            DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户-附加岗位
CREATE TABLE user_position (
    user_id     VARCHAR(36) NOT NULL REFERENCES sys_user(id),
    position_id VARCHAR(36) NOT NULL REFERENCES position(id),
    PRIMARY KEY (user_id, position_id)
);

-- ==================== 外部对象 ====================

CREATE TYPE object_type AS ENUM ('CUSTOMER','SUPPLIER','CARRIER','BANK','THIRD_PARTY_PAY','OTHER');

CREATE TABLE external_object (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    type        object_type NOT NULL,
    name        VARCHAR(200) NOT NULL,
    contact     VARCHAR(100),
    phone       VARCHAR(20),
    address     VARCHAR(500),
    remark      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== 产品与服务 ====================

CREATE TABLE product (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(50) NOT NULL UNIQUE,
    parent_id   VARCHAR(36) REFERENCES product(id),
    spec        VARCHAR(500),
    price       DECIMAL(12,2),
    org_id      VARCHAR(36),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== 流程模板 ====================

CREATE TABLE workflow_template (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE node_type AS ENUM ('TASK','APPROVAL','MODULE','CUSTOM');

CREATE TABLE template_node (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(36) NOT NULL REFERENCES workflow_template(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    sort_order  INT DEFAULT 0,
    type        node_type NOT NULL DEFAULT 'TASK',
    position_id VARCHAR(36) REFERENCES position(id)
);

-- ==================== 工作主帖 ====================

CREATE TYPE thread_status AS ENUM ('ACTIVE','COMPLETED','ARCHIVED');

CREATE TABLE work_thread (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(300) NOT NULL,
    content     TEXT,
    status      thread_status NOT NULL DEFAULT 'ACTIVE',
    creator_id  VARCHAR(36) NOT NULL REFERENCES sys_user(id),
    object_id   VARCHAR(36) REFERENCES external_object(id),
    template_id VARCHAR(36) REFERENCES workflow_template(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_thread_creator ON work_thread(creator_id);
CREATE INDEX idx_thread_object ON work_thread(object_id);
CREATE INDEX idx_thread_status ON work_thread(status);

-- ==================== 工作流节点 ====================

CREATE TYPE node_status AS ENUM ('IN_PROGRESS','COMPLETED','VOIDED','PENDING_NEXT');

CREATE TABLE work_node (
    id               VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id        VARCHAR(36) NOT NULL REFERENCES work_thread(id),
    name             VARCHAR(200) NOT NULL,
    type             node_type NOT NULL DEFAULT 'TASK',
    status           node_status NOT NULL DEFAULT 'IN_PROGRESS',
    owner_id         VARCHAR(36) REFERENCES sys_user(id),
    prev_node_id     VARCHAR(36) REFERENCES work_node(id),
    next_node_id     VARCHAR(36) REFERENCES work_node(id),
    module_data      JSONB,
    next_options     JSONB,
    pool_position_id VARCHAR(36) REFERENCES position(id),
    response_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_node_thread ON work_node(thread_id);
CREATE INDEX idx_node_owner_status ON work_node(owner_id, status);
CREATE INDEX idx_node_pool ON work_node(pool_position_id, status);

-- ==================== 评论 ====================

CREATE TABLE comment (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id   VARCHAR(36) NOT NULL REFERENCES work_thread(id),
    author_id   VARCHAR(36) NOT NULL REFERENCES sys_user(id),
    content     TEXT NOT NULL,
    triggers    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comment_thread ON comment(thread_id);

-- ==================== 模块配置 ====================

CREATE TABLE module_config (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword     VARCHAR(50) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    module_url  VARCHAR(500) NOT NULL,
    object_types object_type[] DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 模块-岗位关联
CREATE TABLE module_config_position (
    module_config_id VARCHAR(36) NOT NULL REFERENCES module_config(id) ON DELETE CASCADE,
    position_id      VARCHAR(36) NOT NULL REFERENCES position(id),
    PRIMARY KEY (module_config_id, position_id)
);

-- ==================== 打卡 ====================

CREATE TYPE clock_type AS ENUM ('CLOCK_IN','CLOCK_OUT');

CREATE TABLE clock_record (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(36) NOT NULL REFERENCES sys_user(id),
    type        clock_type NOT NULL,
    clock_time  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clock_user_time ON clock_record(user_id, clock_time);
