-- V1.1.10 post-fix validation SQL
-- 目标：
-- 1) 重复归零
-- 2) 悬挂引用归零
-- 3) 模板引用计数对比（before vs after）
-- 4) 动作完整性校验

-- 1) 重复组检查。预期：
--    duplicate_groups = 0
--    duplicate_rows = 0
WITH g AS (
    SELECT name, data_key, display_type, COUNT(*) AS cnt
    FROM mo_portal_block_templates
    GROUP BY name, data_key, display_type
    HAVING COUNT(*) > 1
)
SELECT
    COUNT(*) AS duplicate_groups,
    COALESCE(SUM(cnt), 0) AS duplicate_rows
FROM g;

-- 2) block refs 悬挂引用。预期：
--    dangling_block_ref_count = 0
SELECT COUNT(*) AS dangling_block_ref_count
FROM mo_portal_template_block_refs br
LEFT JOIN mo_portal_block_templates bt
  ON bt.id = br.block_template_id
WHERE bt.id IS NULL;

-- 3) actions 悬挂引用。预期：
--    dangling_action_ref_count = 0
SELECT COUNT(*) AS dangling_action_ref_count
FROM mo_portal_block_template_actions ba
LEFT JOIN mo_portal_block_templates bt
  ON bt.id = ba.block_template_id
WHERE bt.id IS NULL;

-- 4) 模板引用计数对比（before snapshot vs after）。预期：
--    delta_total_refs = 0（若存在冲突折叠，值可能小于 0，需人工确认）
WITH before_cnt AS (
    SELECT template_id, ref_count::bigint AS cnt
    FROM mo_v110_template_ref_count_before
),
after_cnt AS (
    SELECT template_id, COUNT(*)::bigint AS cnt
    FROM mo_portal_template_block_refs
    GROUP BY template_id
),
joined AS (
    SELECT
        COALESCE(b.template_id, a.template_id) AS template_id,
        COALESCE(b.cnt, 0) AS before_ref_count,
        COALESCE(a.cnt, 0) AS after_ref_count
    FROM before_cnt b
    FULL OUTER JOIN after_cnt a
      ON a.template_id = b.template_id
)
SELECT
    SUM(before_ref_count) AS total_before_refs,
    SUM(after_ref_count) AS total_after_refs,
    SUM(after_ref_count - before_ref_count) AS delta_total_refs
FROM joined;

-- 5) 逐模板差异明细（用于排查）。预期：0 行或仅人工确认可接受差异
WITH before_cnt AS (
    SELECT template_id, ref_count::bigint AS cnt
    FROM mo_v110_template_ref_count_before
),
after_cnt AS (
    SELECT template_id, COUNT(*)::bigint AS cnt
    FROM mo_portal_template_block_refs
    GROUP BY template_id
),
joined AS (
    SELECT
        COALESCE(b.template_id, a.template_id) AS template_id,
        COALESCE(b.cnt, 0) AS before_ref_count,
        COALESCE(a.cnt, 0) AS after_ref_count
    FROM before_cnt b
    FULL OUTER JOIN after_cnt a
      ON a.template_id = b.template_id
)
SELECT *
FROM joined
WHERE before_ref_count <> after_ref_count
ORDER BY template_id;
