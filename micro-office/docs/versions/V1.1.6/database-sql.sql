-- V1.1.6 readonly validation SQL
-- 1) 哪些模板仍是旧内嵌块（有 items，无 block refs）
SELECT
    t.id,
    t.code,
    t.name,
    COUNT(DISTINCT i.id) AS item_count,
    COUNT(DISTINCT r.id) AS block_ref_count
FROM mo_portal_templates t
LEFT JOIN mo_portal_template_items i
  ON i.template_id = t.id
LEFT JOIN mo_portal_template_block_refs r
  ON r.template_id = t.id
GROUP BY t.id, t.code, t.name
HAVING COUNT(DISTINCT i.id) > 0
   AND COUNT(DISTINCT r.id) = 0
ORDER BY t.updated_at DESC, t.created_at DESC, t.id;

-- 2) 哪些模板已开始引用块模板
SELECT
    t.id,
    t.code,
    t.name,
    COUNT(r.id) AS block_ref_count
FROM mo_portal_templates t
JOIN mo_portal_template_block_refs r
  ON r.template_id = t.id
GROUP BY t.id, t.code, t.name
ORDER BY block_ref_count DESC, t.code;

-- 3) 某块模板被哪些模板引用（默认 MESSAGE_CENTER）
SELECT
    bt.id AS block_template_id,
    bt.code AS block_template_code,
    bt.name AS block_template_name,
    t.id AS template_id,
    t.code AS template_code,
    t.name AS template_name,
    s.id AS section_id,
    s.code AS section_code,
    r.id AS ref_id,
    r.sort_order,
    r.enabled
FROM mo_portal_block_templates bt
LEFT JOIN mo_portal_template_block_refs r
  ON r.block_template_id = bt.id
LEFT JOIN mo_portal_templates t
  ON t.id = r.template_id
LEFT JOIN mo_portal_template_sections s
  ON s.id = r.section_id
WHERE bt.code = 'MESSAGE_CENTER'
ORDER BY t.code NULLS LAST, s.sort_order NULLS LAST, r.sort_order NULLS LAST, r.id;

-- 4) 基础健康检查：块引用是否存在非法 FK（正常应为 0）
SELECT
    SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END) AS missing_template_fk,
    SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END) AS missing_section_fk,
    SUM(CASE WHEN bt.id IS NULL THEN 1 ELSE 0 END) AS missing_block_template_fk
FROM mo_portal_template_block_refs r
LEFT JOIN mo_portal_templates t
  ON t.id = r.template_id
LEFT JOIN mo_portal_template_sections s
  ON s.id = r.section_id
LEFT JOIN mo_portal_block_templates bt
  ON bt.id = r.block_template_id;
