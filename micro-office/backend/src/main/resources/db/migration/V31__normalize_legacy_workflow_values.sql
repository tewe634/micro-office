-- 清理 workflow 下线后遗留的业务值。
-- 说明：
-- 1) mo_todos.source_type 从 WORKFLOW_NODE 统一收口为 PROJECT_TASK。
-- 2) mo_conversations 不再允许 PROJECT_WORKFLOW 作为合法类型分支。
-- 3) PostgreSQL 不支持直接删除 enum 中的单个值，因此 mo_conversation_type 中的 PROJECT_WORKFLOW 枚举值先保留为未使用值。

BEGIN;

UPDATE mo_todos
SET source_type = 'PROJECT_TASK',
    updated_at = NOW()
WHERE source_type = 'WORKFLOW_NODE';

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
            SET type = 'PROJECT_GENERAL'::mo_conversation_type,
                workflow_id = NULL,
                updated_at = NOW()
            WHERE type::text = 'PROJECT_WORKFLOW';
        ELSE
            UPDATE mo_conversations
            SET workflow_id = NULL,
                updated_at = NOW()
            WHERE workflow_id IS NOT NULL;
        END IF;

        ALTER TABLE IF EXISTS mo_conversations
            DROP CONSTRAINT IF EXISTS ck_conversations_scope;
    END IF;
END $$;

COMMIT;
