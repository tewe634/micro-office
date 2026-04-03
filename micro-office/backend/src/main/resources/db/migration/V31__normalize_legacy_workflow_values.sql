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
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'mo_conversations'
          AND column_name = 'workflow_id'
    ) THEN
        UPDATE mo_conversations
        SET type = 'PROJECT_GENERAL'::mo_conversation_type,
            workflow_id = NULL,
            updated_at = NOW()
        WHERE type = 'PROJECT_WORKFLOW'::mo_conversation_type;

        ALTER TABLE IF EXISTS mo_conversations
            DROP CONSTRAINT IF EXISTS ck_conversations_scope;

        ALTER TABLE IF EXISTS mo_conversations
            ADD CONSTRAINT ck_conversations_scope CHECK (
                (
                    type = 'PROJECT_GENERAL'::mo_conversation_type
                    AND project_id IS NOT NULL
                    AND workflow_id IS NULL
                    AND daily_entry_id IS NULL
                )
                OR (
                    type = 'DAILY_ENTRY'::mo_conversation_type
                    AND project_id IS NULL
                    AND daily_entry_id IS NOT NULL
                    AND workflow_id IS NULL
                )
            );
    END IF;
END $$;

COMMIT;
