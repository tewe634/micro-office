-- V1.1.10 readonly audit SQL
-- 目标：审计 mo_portal_block_templates 的重复定义与去重影响面

-- 建议去重键：(name, data_key, display_type)
WITH grp AS (
    SELECT
        name,
        data_key,
        display_type,
        COUNT(*) AS block_count
    FROM mo_portal_block_templates
    GROUP BY name, data_key, display_type
    HAVING COUNT(*) > 1
),
blk AS (
    SELECT
        bt.name,
        bt.data_key,
        bt.display_type,
        bt.id,
        bt.code,
        bt.status,
        bt.updated_at,
        CASE
            WHEN bt.code ~* '^LEGACY_' OR bt.id LIKE 'portal_block_tpl__legacy__%' THEN 1
            ELSE 0
        END AS is_legacy,
        COUNT(br.id) AS ref_count
    FROM mo_portal_block_templates bt
    LEFT JOIN mo_portal_template_block_refs br
      ON br.block_template_id = bt.id
    GROUP BY bt.name, bt.data_key, bt.display_type, bt.id, bt.code, bt.status, bt.updated_at
),
ranked AS (
    SELECT
        b.*,
        ROW_NUMBER() OVER (
            PARTITION BY b.name, b.data_key, b.display_type
            ORDER BY
                b.is_legacy ASC,
                b.ref_count DESC,
                b.updated_at DESC,
                b.id ASC
        ) AS canonical_rank
    FROM blk b
    JOIN grp g
      ON g.name = b.name
     AND g.data_key = b.data_key
     AND g.display_type = b.display_type
)
SELECT
    r.name,
    r.data_key,
    r.display_type,
    r.id,
    r.code,
    r.is_legacy,
    r.ref_count,
    r.updated_at,
    r.canonical_rank,
    CASE WHEN r.canonical_rank = 1 THEN 'KEEP' ELSE 'DROP' END AS dedupe_decision
FROM ranked r
ORDER BY r.name, r.data_key, r.display_type, r.canonical_rank, r.id;

-- 汇总视图：重复组和预计删除量
WITH grp AS (
    SELECT name, data_key, display_type, COUNT(*) AS cnt
    FROM mo_portal_block_templates
    GROUP BY name, data_key, display_type
    HAVING COUNT(*) > 1
)
SELECT
    COUNT(*) AS duplicate_groups,
    COALESCE(SUM(cnt), 0) AS duplicate_rows,
    COALESCE(SUM(cnt - 1), 0) AS rows_to_drop
FROM grp;

-- 预计受影响引用数（source refs）和动作数（source actions）
WITH grp AS (
    SELECT name, data_key, display_type
    FROM mo_portal_block_templates
    GROUP BY name, data_key, display_type
    HAVING COUNT(*) > 1
),
ranked AS (
    SELECT
        bt.id,
        bt.name,
        bt.data_key,
        bt.display_type,
        ROW_NUMBER() OVER (
            PARTITION BY bt.name, bt.data_key, bt.display_type
            ORDER BY
                CASE WHEN bt.code ~* '^LEGACY_' OR bt.id LIKE 'portal_block_tpl__legacy__%' THEN 1 ELSE 0 END ASC,
                (SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id = bt.id) DESC,
                bt.updated_at DESC,
                bt.id ASC
        ) AS rn
    FROM mo_portal_block_templates bt
    JOIN grp g
      ON g.name = bt.name
     AND g.data_key = bt.data_key
     AND g.display_type = bt.display_type
)
SELECT
    (SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id IN (SELECT id FROM ranked WHERE rn > 1)) AS refs_to_rewrite,
    (SELECT COUNT(*) FROM mo_portal_block_template_actions ba WHERE ba.block_template_id IN (SELECT id FROM ranked WHERE rn > 1)) AS actions_to_merge;
