UPDATE organization
SET name = '浙江东华信息控制技术有限公司',
    updated_at = CURRENT_TIMESTAMP
WHERE parent_id IS NULL
  AND name = '总经办';
