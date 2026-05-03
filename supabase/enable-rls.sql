-- Run this INSTEAD of disable-rls.sql to keep RLS active with authenticated-user access
-- Requires: a Supabase Auth user created in Dashboard → Authentication → Users
--
-- NOTE: The allow_authenticated policies are already created by supabase_schema.sql
-- (via a DO block that loops over all tables in the 7 schemas).
-- This file only re-enables RLS if you previously ran disable-rls.sql.

-- Enable RLS on all tables
ALTER TABLE customers.kna1                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers.buyers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.mara                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.brands                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.colors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.fits                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.material_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.body_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.category_l3           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbak               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbap               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.return_reasons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_header          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.gst_config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.sales_price             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.customer_discount       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.product_discount        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.departments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.designations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_headers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_lines                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.attendance                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups.customer_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups.group_members            ENABLE ROW LEVEL SECURITY;

-- Policies are already created by supabase_schema.sql.
-- If for any reason they are missing, re-run the DO block from supabase_schema.sql,
-- or create them manually, e.g.:
--
-- CREATE POLICY allow_authenticated ON customers.kna1
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);
