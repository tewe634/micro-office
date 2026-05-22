-- 为 external_object 表添加 bank_name 字段（开户行）
-- 用于存储客户的开户银行信息

ALTER TABLE external_object
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200);

COMMENT ON COLUMN external_object.bank_name IS '开户行';
