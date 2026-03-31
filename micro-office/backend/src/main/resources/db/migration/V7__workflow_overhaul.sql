-- V7: 工作流大改造

-- 1. 新增 CANCELLED 状态
ALTER TYPE thread_status ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE node_status ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. 节点消息通道（每个节点独立，只有参与人可见）
CREATE TABLE node_message (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     VARCHAR(36) NOT NULL REFERENCES work_node(id) ON DELETE CASCADE,
    author_id   VARCHAR(36) NOT NULL REFERENCES sys_user(id),
    content     TEXT,
    file_url    VARCHAR(500),
    file_name   VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nodemsg_node ON node_message(node_id);

-- 3. 节点关联引用（关联其他工作流/外部对象/产品等作为参考）
CREATE TABLE node_reference (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     VARCHAR(36) NOT NULL REFERENCES work_node(id) ON DELETE CASCADE,
    ref_type    VARCHAR(30) NOT NULL,
    ref_id      VARCHAR(36) NOT NULL,
    ref_label   VARCHAR(300),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_noderef_node ON node_reference(node_id);

-- 4. 岗位字段可见性控制
CREATE TABLE field_visibility (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id VARCHAR(36) NOT NULL REFERENCES position(id) ON DELETE CASCADE,
    entity_type VARCHAR(30) NOT NULL,
    hidden_fields TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE(position_id, entity_type)
);

-- 5. 工作流增加产品关联
ALTER TABLE work_thread ADD COLUMN IF NOT EXISTS product_id VARCHAR(36) REFERENCES product(id);

-- 6. 删除任务池菜单权限
DELETE FROM role_menu_permission WHERE menu_key = '/taskpool';
DELETE FROM user_menu_permission WHERE menu_key = '/taskpool';
