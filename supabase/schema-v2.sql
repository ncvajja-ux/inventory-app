-- ============================================================
-- schema-v2.sql  —  Run in Supabase SQL Editor
-- Drop old inventory tables first if migrating
-- ============================================================

-- SCHEMAS (idempotent)
CREATE SCHEMA IF NOT EXISTS customers;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS transactions;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS groups;
CREATE SCHEMA IF NOT EXISTS buyers;
CREATE SCHEMA IF NOT EXISTS hr;

-- ── inventory.products ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory.products (
  sku_id         SERIAL PRIMARY KEY,
  sku_code       TEXT UNIQUE NOT NULL,   -- e.g. "P100001"
  brand          TEXT NOT NULL,
  brandfamily    TEXT,
  gender         TEXT,
  category       TEXT NOT NULL,
  subcategory    TEXT,
  subsubcategory TEXT,
  color          TEXT,
  fit            TEXT,
  tax_category   TEXT,
  body_type      TEXT,
  material_type  TEXT,
  mrp            REAL DEFAULT 0,
  cost_price     REAL DEFAULT 0,
  image_data     TEXT,
  param1         TEXT,
  param2         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── inventory.mara (variants) ───────────────────────────────
CREATE TABLE IF NOT EXISTS inventory.mara (
  matnr    TEXT PRIMARY KEY CHECK (length(matnr) = 6),
  sku_id   INTEGER NOT NULL REFERENCES inventory.products(sku_id) ON DELETE CASCADE,
  size     TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  UNIQUE (sku_id, size)
);

-- ── inventory meta tables ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory.brands        (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS inventory.colors        (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, hex TEXT);
CREATE TABLE IF NOT EXISTS inventory.fits          (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS inventory.material_types(id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS inventory.body_types    (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS inventory.categories    (id SERIAL PRIMARY KEY, category TEXT NOT NULL, subcategory TEXT);
CREATE TABLE IF NOT EXISTS inventory.category_l3   (
  id            SERIAL PRIMARY KEY,
  category      TEXT NOT NULL,
  subcategory   TEXT NOT NULL,
  subsubcategory TEXT NOT NULL,
  sizes         TEXT,
  UNIQUE(category, subcategory, subsubcategory)
);

-- ── pricing ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing.sales_price (
  id          SERIAL PRIMARY KEY,
  matnr       TEXT NOT NULL,
  unit_price  REAL NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE
);
CREATE TABLE IF NOT EXISTS pricing.customer_discount (
  id           SERIAL PRIMARY KEY,
  kunnr        TEXT NOT NULL,
  discount_pct REAL NOT NULL,
  valid_from   DATE NOT NULL,
  valid_to     DATE
);
CREATE TABLE IF NOT EXISTS pricing.product_discount (
  id           SERIAL PRIMARY KEY,
  matnr        TEXT NOT NULL,
  discount_pct REAL NOT NULL,
  valid_from   DATE NOT NULL,
  valid_to     DATE
);
CREATE TABLE IF NOT EXISTS pricing.gst_config (
  id           SERIAL PRIMARY KEY,
  tax_category TEXT NOT NULL,
  gst_rate     REAL NOT NULL DEFAULT 0,
  valid_from   DATE,
  valid_to     TEXT
);

-- ── customers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers.kna1 (
  kunnr       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  number      TEXT,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  gstin       TEXT,
  body_type   TEXT,
  status      TEXT DEFAULT 'Active',
  image_data  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customers.customer_preferences (
  id       SERIAL PRIMARY KEY,
  kunnr    TEXT NOT NULL REFERENCES customers.kna1(kunnr) ON DELETE CASCADE,
  brand    TEXT,
  category TEXT,
  fit      TEXT,
  size     TEXT,
  UNIQUE (kunnr, brand, category)
);

-- ── transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions.vbak (
  order_id              TEXT PRIMARY KEY,
  kunnr                 TEXT NOT NULL,
  status                TEXT DEFAULT 'CONFIRMED',
  payment_status        TEXT DEFAULT 'PENDING',
  paid_amount           REAL DEFAULT 0,
  order_type            TEXT DEFAULT 'S',
  original_order_id     TEXT,
  return_reason         TEXT,
  customer_discount_pct REAL DEFAULT 0,
  manual_discount       REAL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS transactions.vbap (
  id           SERIAL PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES transactions.vbak(order_id) ON DELETE CASCADE,
  matnr        TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  price        REAL DEFAULT 0,
  mrp          REAL DEFAULT 0,
  discount_pct REAL DEFAULT 0,
  gst_rate     REAL DEFAULT 0,
  line_total   REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions.return_reasons (
  id     SERIAL PRIMARY KEY,
  reason TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions.po_header (
  po_id          TEXT PRIMARY KEY,
  buyer_id       TEXT,
  po_date        DATE DEFAULT CURRENT_DATE,
  expected_date  DATE,
  payment_status TEXT DEFAULT 'PENDING',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS transactions.po_items (
  id         SERIAL PRIMARY KEY,
  po_id      TEXT NOT NULL REFERENCES transactions.po_header(po_id) ON DELETE CASCADE,
  line_no    INTEGER NOT NULL,
  matnr      TEXT NOT NULL,
  quantity   INTEGER DEFAULT 0,
  unit_price REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  status     TEXT DEFAULT 'Created'
);

-- ── groups ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups.customer_groups (
  group_id SERIAL PRIMARY KEY,
  name     TEXT UNIQUE NOT NULL,
  notes    TEXT
);
CREATE TABLE IF NOT EXISTS groups.group_members (
  id       SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups.customer_groups(group_id) ON DELETE CASCADE,
  kunnr    TEXT NOT NULL,
  UNIQUE(group_id, kunnr)
);

-- ── buyers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyers.buyers (
  buyer_id     TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  gstin        TEXT,
  tax_id       TEXT,
  export_id    TEXT,
  payment_terms TEXT,
  addr1        TEXT,
  addr2        TEXT,
  city         TEXT,
  state        TEXT,
  country      TEXT DEFAULT 'India',
  zip          TEXT,
  ship_city    TEXT,
  status       TEXT DEFAULT 'Active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── hr ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr.employees (
  emp_id      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  dept        TEXT,
  designation TEXT,
  doj         DATE,
  basic       REAL DEFAULT 0,
  hra         REAL DEFAULT 0,
  da          REAL DEFAULT 0,
  phone       TEXT,
  email       TEXT,
  status      TEXT DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hr.departments   (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS hr.designations  (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS hr.salary_headers(
  id      SERIAL PRIMARY KEY,
  emp_id  TEXT NOT NULL,
  month   TEXT NOT NULL,
  UNIQUE(emp_id, month)
);
CREATE TABLE IF NOT EXISTS hr.salary_lines (
  id        SERIAL PRIMARY KEY,
  header_id INTEGER NOT NULL REFERENCES hr.salary_headers(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  amount    REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS hr.attendance (
  id       SERIAL PRIMARY KEY,
  emp_id   TEXT NOT NULL,
  att_date DATE NOT NULL,
  status   TEXT DEFAULT 'Present',
  UNIQUE(emp_id, att_date)
);

-- ── indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mara_sku_id   ON inventory.mara (sku_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON inventory.products (brand);
CREATE INDEX IF NOT EXISTS idx_products_cat   ON inventory.products (category);
CREATE INDEX IF NOT EXISTS idx_vbak_kunnr     ON transactions.vbak (kunnr);
CREATE INDEX IF NOT EXISTS idx_vbak_status    ON transactions.vbak (status);
CREATE INDEX IF NOT EXISTS idx_vbak_created   ON transactions.vbak (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vbap_matnr     ON transactions.vbap (matnr);
CREATE INDEX IF NOT EXISTS idx_sales_price_matnr ON pricing.sales_price (matnr, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_cust_disc_kunnr   ON pricing.customer_discount (kunnr, valid_from);

-- ── grants ───────────────────────────────────────────────────
GRANT USAGE ON SCHEMA customers, inventory, transactions, pricing, groups, buyers, hr TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA customers TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA inventory TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA transactions TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pricing TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA groups TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA buyers TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA inventory TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA transactions TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pricing TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA customers TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA groups TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA buyers TO authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
