-- V1.1.15: add meta text field for user external account binding
-- Note: table is owned by micro-office-chat platform; this migration only adds compatible extension column.

ALTER TABLE IF EXISTS public.mo_user_external_accounts
    ADD COLUMN IF NOT EXISTS meta text;
