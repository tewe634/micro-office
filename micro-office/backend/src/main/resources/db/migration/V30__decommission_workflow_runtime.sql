-- 下线遗留 workflow runtime 表。
-- 保留 mo_todos / mo_conversations 主表，只解除与 workflow 的引用关系，避免误删非 workflow 业务数据。

BEGIN;

-- 兼容视图依赖 mo_workflow* 基表，先删除，避免遗留失效对象。
DROP VIEW IF EXISTS workflow_branch_group_members;
DROP VIEW IF EXISTS workflow_branch_groups;
DROP VIEW IF EXISTS workflow_edges;
DROP VIEW IF EXISTS workflow_node_assignees;
DROP VIEW IF EXISTS workflow_node_form_data;
DROP VIEW IF EXISTS workflow_nodes;
DROP VIEW IF EXISTS workflow_runtime_caches;
DROP VIEW IF EXISTS workflow_subflows;
DROP VIEW IF EXISTS workflows;

-- 解除保留表对 workflow 的外键依赖。
ALTER TABLE IF EXISTS mo_todos
    DROP CONSTRAINT IF EXISTS fk_todos_workflow_node,
    DROP CONSTRAINT IF EXISTS todos_node_id_fkey,
    DROP CONSTRAINT IF EXISTS fk_todos_workflow_project,
    DROP CONSTRAINT IF EXISTS todos_workflow_id_fkey;

ALTER TABLE IF EXISTS mo_conversations
    DROP CONSTRAINT IF EXISTS conversations_workflow_id_fkey,
    DROP CONSTRAINT IF EXISTS fk_conversations_workflow_project;

-- 保留待办/会话记录，但清空已下线 workflow 引用，避免留下悬空 ID。
UPDATE mo_todos
SET workflow_id = NULL,
    node_id = NULL,
    updated_at = NOW()
WHERE workflow_id IS NOT NULL
   OR node_id IS NOT NULL;

UPDATE mo_conversations
SET type = CASE
        WHEN workflow_id IS NOT NULL AND type = 'PROJECT_WORKFLOW'::mo_conversation_type
            THEN 'PROJECT_GENERAL'::mo_conversation_type
        ELSE type
    END,
    workflow_id = NULL,
    updated_at = NOW()
WHERE workflow_id IS NOT NULL;

-- 删除 workflow runtime 基表。
DROP TABLE IF EXISTS mo_workflow_node_ai_prefill CASCADE;
DROP TABLE IF EXISTS mo_workflow_node_assignees CASCADE;
DROP TABLE IF EXISTS mo_workflow_node_form_data CASCADE;
DROP TABLE IF EXISTS mo_workflow_runtime_caches CASCADE;
DROP TABLE IF EXISTS mo_workflow_branch_group_members CASCADE;
DROP TABLE IF EXISTS mo_workflow_edges CASCADE;
DROP TABLE IF EXISTS mo_workflow_subflows CASCADE;
DROP TABLE IF EXISTS mo_workflow_branch_groups CASCADE;
DROP TABLE IF EXISTS mo_workflow_nodes CASCADE;
DROP TABLE IF EXISTS mo_workflows CASCADE;

COMMIT;
