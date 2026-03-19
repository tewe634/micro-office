ALTER TABLE product DROP CONSTRAINT IF EXISTS product_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uk_product_code_line ON product (code, product_line);
