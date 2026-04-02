ALTER TABLE external_object ADD COLUMN IF NOT EXISTS parent_object_id VARCHAR(36);
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS customer_health VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_external_object_parent_object_id
    ON external_object(parent_object_id);

UPDATE external_object
SET parent_object_id = NULL,
    customer_health = NULL
WHERE type <> 'CUSTOMER';
