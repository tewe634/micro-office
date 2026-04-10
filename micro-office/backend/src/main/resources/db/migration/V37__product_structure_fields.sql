ALTER TABLE product
    ADD COLUMN IF NOT EXISTS structure_level1 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS structure_level2 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS series_display_name VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_product_structure_level1 ON product(structure_level1);
CREATE INDEX IF NOT EXISTS idx_product_structure_level2 ON product(structure_level2);
