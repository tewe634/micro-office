-- V1.1.1 database checks and repair scripts
-- Scope: keep existing 4 template tables, harden meta.previewEntity usage.
-- Tables:
--   mo_portal_templates
--   mo_portal_template_sections
--   mo_portal_template_items
--   mo_portal_template_item_actions

-- ============================================================
-- 1) previewEntity completeness check
-- ============================================================
SELECT
    t.id,
    t.code,
    t.name,
    t.template_type,
    t.status,
    COALESCE(t.meta -> 'previewEntity', '{}'::jsonb) AS preview_entity,
    NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')), '') AS entity_type,
    NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityId', '')), '') AS entity_id
FROM mo_portal_templates t
WHERE NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')), '') IS NULL
   OR NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityId', '')), '') IS NULL
ORDER BY t.updated_at DESC, t.created_at DESC, t.id;

-- Summary count
SELECT COUNT(*) AS missing_preview_entity_count
FROM mo_portal_templates t
WHERE NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')), '') IS NULL
   OR NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityId', '')), '') IS NULL;

-- ============================================================
-- 2) previewEntity.entityType legal-enum check
-- Allowed: PERSON|PRODUCT|CUSTOMER_COMPANY|SUPPLIER|CARRIER|BANK|ORGANIZATION
-- ============================================================
SELECT
    t.id,
    t.code,
    t.name,
    t.template_type,
    t.meta -> 'previewEntity' ->> 'entityType' AS entity_type
FROM mo_portal_templates t
WHERE NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')), '') IS NOT NULL
  AND UPPER(t.meta -> 'previewEntity' ->> 'entityType') NOT IN (
      'PERSON',
      'PRODUCT',
      'CUSTOMER_COMPANY',
      'SUPPLIER',
      'CARRIER',
      'BANK',
      'ORGANIZATION'
  )
ORDER BY t.updated_at DESC, t.created_at DESC, t.id;

-- ============================================================
-- 3) templateType <-> previewEntity.entityType consistency check
-- Mapping:
--   PERSON_ROLE -> PERSON
--   PRODUCT -> PRODUCT
--   CUSTOMER_COMPANY -> CUSTOMER_COMPANY
--   SUPPLIER -> SUPPLIER
--   CARRIER -> CARRIER
--   BANK -> BANK
--   ORGANIZATION -> ORGANIZATION
-- ============================================================
WITH expected AS (
    SELECT * FROM (VALUES
        ('PERSON_ROLE', 'PERSON'),
        ('PRODUCT', 'PRODUCT'),
        ('CUSTOMER_COMPANY', 'CUSTOMER_COMPANY'),
        ('SUPPLIER', 'SUPPLIER'),
        ('CARRIER', 'CARRIER'),
        ('BANK', 'BANK'),
        ('ORGANIZATION', 'ORGANIZATION')
    ) AS m(template_type, expected_entity_type)
)
SELECT
    t.id,
    t.code,
    t.name,
    t.template_type,
    e.expected_entity_type,
    UPPER(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')) AS actual_entity_type
FROM mo_portal_templates t
JOIN expected e
  ON e.template_type = t.template_type
WHERE NULLIF(BTRIM(COALESCE(t.meta -> 'previewEntity' ->> 'entityType', '')), '') IS NOT NULL
  AND UPPER(t.meta -> 'previewEntity' ->> 'entityType') <> e.expected_entity_type
ORDER BY t.updated_at DESC, t.created_at DESC, t.id;

-- ============================================================
-- 4) optional list: missing cockpit-dark layout meta
-- ============================================================
SELECT
    t.id,
    t.code,
    t.name,
    t.template_type,
    t.meta ->> 'layout_mode' AS layout_mode
FROM mo_portal_templates t
WHERE NULLIF(BTRIM(COALESCE(t.meta ->> 'layout_mode', '')), '') IS NULL
ORDER BY t.updated_at DESC, t.created_at DESC, t.id;

-- ============================================================
-- 5) optional repair A: fill default layout_mode
-- Safe and idempotent.
-- ============================================================
UPDATE mo_portal_templates t
SET meta = jsonb_set(t.meta, '{layout_mode}', '"cockpit_dark"'::jsonb, true),
    updated_at = NOW(),
    updated_by = COALESCE(updated_by, 'v1.1.1_db_fix_layout_mode')
WHERE NULLIF(BTRIM(COALESCE(t.meta ->> 'layout_mode', '')), '') IS NULL;

-- ============================================================
-- 6) optional repair B: set previewEntity by explicit input
-- Usage:
--   1) Replace values in fix_input.
--   2) Run this block.
-- Notes:
--   - Does not create new table/schema.
--   - Auditable via RETURNING old/new meta.
-- ============================================================
WITH fix_input(template_id, entity_type, entity_id) AS (
    VALUES
        -- ('portal_tpl_product', 'PRODUCT', 'your-real-product-id')
        -- ('portal_tpl_customer', 'CUSTOMER_COMPANY', 'your-real-customer-id')
        -- ('portal_tpl_person_sales', 'PERSON', 'your-real-user-id')
        ('__REPLACE_TEMPLATE_ID__', '__REPLACE_ENTITY_TYPE__', '__REPLACE_ENTITY_ID__')
),
normalized AS (
    SELECT
        template_id,
        UPPER(BTRIM(entity_type)) AS entity_type,
        BTRIM(entity_id) AS entity_id
    FROM fix_input
),
validated AS (
    SELECT
        n.template_id,
        n.entity_type,
        n.entity_id,
        t.template_type,
        CASE t.template_type
            WHEN 'PERSON_ROLE' THEN 'PERSON'
            WHEN 'PRODUCT' THEN 'PRODUCT'
            WHEN 'CUSTOMER_COMPANY' THEN 'CUSTOMER_COMPANY'
            WHEN 'SUPPLIER' THEN 'SUPPLIER'
            WHEN 'CARRIER' THEN 'CARRIER'
            WHEN 'BANK' THEN 'BANK'
            WHEN 'ORGANIZATION' THEN 'ORGANIZATION'
            ELSE NULL
        END AS expected_entity_type
    FROM normalized n
    JOIN mo_portal_templates t ON t.id = n.template_id
    WHERE n.entity_type IN (
        'PERSON',
        'PRODUCT',
        'CUSTOMER_COMPANY',
        'SUPPLIER',
        'CARRIER',
        'BANK',
        'ORGANIZATION'
    )
      AND NULLIF(n.entity_id, '') IS NOT NULL
),
ready AS (
    SELECT *
    FROM validated
    WHERE expected_entity_type IS NOT NULL
      AND entity_type = expected_entity_type
)
UPDATE mo_portal_templates t
SET meta = jsonb_set(
            jsonb_set(t.meta, '{previewEntity,entityType}', to_jsonb(r.entity_type::text), true),
            '{previewEntity,entityId}', to_jsonb(r.entity_id::text), true
          ),
    updated_at = NOW(),
    updated_by = 'v1.1.1_db_fix_preview_entity'
FROM ready r
WHERE t.id = r.template_id
RETURNING
    t.id,
    t.code,
    t.template_type,
    t.meta -> 'previewEntity' AS new_preview_entity;
