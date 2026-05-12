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
    DROP CONSTRAINT IF EXISTS todos_workflow_id_fkey,
    DROP CONSTRAINT IF EXISTS ck_todos_scope,
    DROP CONSTRAINT IF EXISTS ck_todos_scope_v114;

ALTER TABLE IF EXISTS mo_conversations
    DROP CONSTRAINT IF EXISTS conversations_workflow_id_fkey,
    DROP CONSTRAINT IF EXISTS fk_conversations_workflow_project,
    DROP CONSTRAINT IF EXISTS ck_conversations_scope,
    DROP CONSTRAINT IF EXISTS ck_mo_conversations_scope_v129;

-- 保留待办/会话记录，但清空已下线 workflow 引用，避免留下悬空 ID。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_todos'
          AND column_name = 'workflow_id'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_todos'
          AND column_name = 'node_id'
    ) THEN
        UPDATE mo_todos
        SET workflow_id = NULL,
            node_id = NULL,
            updated_at = NOW()
        WHERE workflow_id IS NOT NULL
           OR node_id IS NOT NULL;
    END IF;
END $$;

DO $$
DECLARE
    has_project_workflow boolean := false;
    has_project_general boolean := false;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_conversations'
          AND column_name = 'workflow_id'
    ) THEN
        SELECT EXISTS (
                   SELECT 1
                   FROM pg_type t
                   JOIN pg_enum e ON e.enumtypid = t.oid
                   WHERE t.typname = 'mo_conversation_type'
                     AND e.enumlabel = 'PROJECT_WORKFLOW'
               ),
               EXISTS (
                   SELECT 1
                   FROM pg_type t
                   JOIN pg_enum e ON e.enumtypid = t.oid
                   WHERE t.typname = 'mo_conversation_type'
                     AND e.enumlabel = 'PROJECT_GENERAL'
               )
          INTO has_project_workflow, has_project_general;

        IF has_project_workflow AND has_project_general THEN
            UPDATE mo_conversations
            SET type = CASE
                    WHEN workflow_id IS NOT NULL AND type::text = 'PROJECT_WORKFLOW'
                        THEN 'PROJECT_GENERAL'::mo_conversation_type
                    ELSE type
                END,
                workflow_id = NULL,
                updated_at = NOW()
            WHERE workflow_id IS NOT NULL;
        ELSE
            UPDATE mo_conversations
            SET workflow_id = NULL,
                updated_at = NOW()
            WHERE workflow_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- PV1.1.18 起 workflow runtime 基表为 Web/H5/后台共用实例事实源，不再删除。
-- 仅清理废弃 AI 预填表；其余 mo_workflow* 实例表保留。
DROP TABLE IF EXISTS mo_workflow_node_ai_prefill CASCADE;

COMMIT;
