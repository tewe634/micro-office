ALTER TABLE external_object ADD COLUMN IF NOT EXISTS customer_role VARCHAR(20);
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS customer_scale VARCHAR(20);

UPDATE external_object
SET customer_role = NULL,
    customer_scale = NULL
WHERE type <> 'CUSTOMER';
