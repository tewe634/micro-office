ALTER TABLE product ADD COLUMN IF NOT EXISTS product_line VARCHAR(20) DEFAULT 'ABB';

UPDATE product
SET product_line = 'ABB'
WHERE product_line IS NULL OR product_line = '';
