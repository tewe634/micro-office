-- V1.1.7 readonly validation SQL
-- 目标：验证门户模板已经完全收敛到 block template + block refs 最新模型

-- 1) 旧表必须已经退休。预期：
--    legacy_items_table = null
--    legacy_item_actions_table = null
SELECT
    to_regclass('public.mo_portal_template_items') AS legacy_items_table,
    to_regclass('public.mo_portal_template_item_actions') AS legacy_item_actions_table;

-- 2) 仍有 section 但没有 block refs 的模板数量。预期：0 行
SELECT
    t.id,
    t.code,
    t.name,
    COUNT(DISTINCT s.id) AS section_count,
    COUNT(DISTINCT br.id) AS block_ref_count
FROM mo_portal_templates t
JOIN mo_portal_template_sections s
  ON s.template_id = t.id
LEFT JOIN mo_portal_template_block_refs br
  ON br.template_id = t.id
GROUP BY t.id, t.code, t.name
HAVING COUNT(DISTINCT s.id) > 0
   AND COUNT(DISTINCT br.id) = 0
ORDER BY t.code;

-- 3) V44 从 legacy item 回填出的块模板与引用数量。预期：
--    migrated_block_template_count = migrated_block_ref_count
--    且都大于 0（如果库里存在历史门户模板数据）
SELECT
    (SELECT COUNT(*)
     FROM mo_portal_block_templates bt
     WHERE bt.meta -> 'legacySource' ->> 'migrationVersion' = 'V44') AS migrated_block_template_count,
    (SELECT COUNT(*)
     FROM mo_portal_template_block_refs br
     WHERE br.id LIKE 'portal_block_ref__legacy__%') AS migrated_block_ref_count;

-- 4) 引用完整性健康检查。预期：
--    missing_template_fk = 0
--    missing_section_fk = 0
--    missing_block_template_fk = 0
--    disabled_or_non_active_block_refs = 0
SELECT
    SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END) AS missing_template_fk,
    SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END) AS missing_section_fk,
    SUM(CASE WHEN bt.id IS NULL THEN 1 ELSE 0 END) AS missing_block_template_fk,
    SUM(CASE WHEN bt.id IS NOT NULL AND (br.enabled IS NOT TRUE OR bt.status <> 'ACTIVE') THEN 1 ELSE 0 END) AS disabled_or_non_active_block_refs
FROM mo_portal_template_block_refs br
LEFT JOIN mo_portal_templates t
  ON t.id = br.template_id
LEFT JOIN mo_portal_template_sections s
  ON s.id = br.section_id
LEFT JOIN mo_portal_block_templates bt
  ON bt.id = br.block_template_id;

-- 5) 块模板动作完整性检查。预期：
--    missing_block_template_fk = 0
SELECT
    SUM(CASE WHEN bt.id IS NULL THEN 1 ELSE 0 END) AS missing_block_template_fk
FROM mo_portal_block_template_actions ba
LEFT JOIN mo_portal_block_templates bt
  ON bt.id = ba.block_template_id;

-- 6) 仍残留 legacy 回填但未挂到模板上的块模板。预期：0 行
SELECT
    bt.id,
    bt.code,
    bt.name,
    bt.meta -> 'legacySource' ->> 'templateId' AS source_template_id,
    bt.meta -> 'legacySource' ->> 'itemId' AS source_item_id
FROM mo_portal_block_templates bt
LEFT JOIN mo_portal_template_block_refs br
  ON br.block_template_id = bt.id
WHERE bt.meta -> 'legacySource' ->> 'migrationVersion' = 'V44'
GROUP BY bt.id, bt.code, bt.name, bt.meta
HAVING COUNT(br.id) = 0
ORDER BY bt.code;
