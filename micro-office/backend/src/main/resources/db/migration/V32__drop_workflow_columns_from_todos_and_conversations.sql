-- 删除 workflow 下线后在 mo_todos / mo_conversations 中残留的结构字段，
-- 并同步清理相关索引、约束与兼容视图。

BEGIN;

DROP VIEW IF EXISTS todos;
DROP VIEW IF EXISTS conversations;

ALTER TABLE IF EXISTS mo_todos
    DROP CONSTRAINT IF EXISTS ck_todos_scope;

DROP INDEX IF EXISTS idx_conversations_workflow_status;
DROP INDEX IF EXISTS idx_todos_workflow_status;
DROP INDEX IF EXISTS uq_todos_active_node_assignee;

ALTER TABLE IF EXISTS mo_conversations
    DROP COLUMN IF EXISTS workflow_id;

ALTER TABLE IF EXISTS mo_todos
    DROP COLUMN IF EXISTS workflow_id,
    DROP COLUMN IF EXISTS node_id;

CREATE VIEW conversations AS
SELECT
    id,
    organization_id,
    project_id,
    daily_entry_id,
    type,
    title,
    status,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by,
    version
FROM mo_conversations;

CREATE VIEW todos AS
SELECT
    id,
    organization_id,
    project_id,
    conversation_id,
    assignee_user_id,
    title,
    status,
    source_type,
    due_at,
    completed_at,
    completed_by,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by,
    version
FROM mo_todos;

COMMIT;
