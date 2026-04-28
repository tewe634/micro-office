ALTER TABLE position ADD COLUMN IF NOT EXISTS sort_order INT;

UPDATE position
SET sort_order = 0
WHERE sort_order IS NULL;

ALTER TABLE position ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE position ALTER COLUMN sort_order SET NOT NULL;
