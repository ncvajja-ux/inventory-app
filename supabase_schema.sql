-- ============================================================
--  Inventory App — Supabase / PostgreSQL Schema
--  Run this entire file in the Supabase SQL Editor once.
--  Creates 7 logical schemas matching the original SQLite DBs.
-- ============================================================

-- ─── Schemas ─────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS customers;
CREATE SCHEMA IF NOT EXISTS buyers;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS transactions;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS groups;


-- ============================================================
--  1. CUSTOMERS schema  (customers.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS customers.kna1 (
    kunnr       TEXT PRIMARY KEY CHECK (length(kunnr) = 6),
    name        TEXT        NOT NULL,
    number      TEXT,
    address     TEXT,
    email       TEXT,
    gstin       TEXT,
    dob         TEXT,
    anniversary TEXT,
    notes       TEXT,
    status      TEXT        DEFAULT 'Active',
    body_type   TEXT
);

CREATE TABLE IF NOT EXISTS customers.customer_measurements (
    kunnr         TEXT PRIMARY KEY REFERENCES customers.kna1 (kunnr) ON DELETE CASCADE,
    photo_data    TEXT,
    shoulders     REAL,
    top_inseam    REAL,
    tummy         REAL,
    waist         REAL,
    thighs        REAL,
    bottom_inseam REAL,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.customer_preferences (
    id       SERIAL PRIMARY KEY,
    kunnr    TEXT NOT NULL REFERENCES customers.kna1 (kunnr) ON DELETE CASCADE,
    brand    TEXT NOT NULL,
    category TEXT,
    size     TEXT,
    fit      TEXT,
    UNIQUE (kunnr, brand, category)
);


-- ============================================================
--  2. BUYERS schema  (buyers.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS buyers.buyers (
    buyer_id      TEXT PRIMARY KEY CHECK (length(buyer_id) = 6),
    name          TEXT        NOT NULL,
    phone         TEXT,
    email         TEXT,
    gstin         TEXT,
    tax_id        TEXT,
    export_id     TEXT,
    addr1         TEXT,
    addr2         TEXT,
    city          TEXT,
    state         TEXT,
    country       TEXT        DEFAULT 'India',
    zip           TEXT,
    ship_city     TEXT,
    payment_terms TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    status        TEXT        DEFAULT 'Active'
);


-- ============================================================
--  3. INVENTORY schema  (inventory.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory.brands (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inventory.colors (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    hex  TEXT
);

CREATE TABLE IF NOT EXISTS inventory.fits (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inventory.material_types (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inventory.body_types (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inventory.categories (
    id          SERIAL PRIMARY KEY,
    category    TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    UNIQUE (category, subcategory)
);

CREATE TABLE IF NOT EXISTS inventory.category_l3 (
    id             SERIAL PRIMARY KEY,
    category       TEXT NOT NULL,
    subcategory    TEXT NOT NULL,
    subsubcategory TEXT NOT NULL,
    sizes          TEXT,
    UNIQUE (category, subcategory, subsubcategory)
);

CREATE TABLE IF NOT EXISTS inventory.mara (
    matnr           TEXT PRIMARY KEY CHECK (length(matnr) = 6),
    brand           TEXT,
    brandfamily     TEXT,
    size            TEXT,
    quantity        INTEGER DEFAULT 0,
    price           REAL    DEFAULT 0.00,
    cost_price      REAL    DEFAULT 0.00,
    mrp             REAL    DEFAULT 0.00,
    reserved        INTEGER DEFAULT 0,
    gender          TEXT,
    category        TEXT,
    subcategory     TEXT,
    subsubcategory  TEXT,
    color           TEXT,
    fit             TEXT,
    tax_category    TEXT,
    image_data      TEXT,
    material_type   TEXT,
    body_type       TEXT,
    param1          TEXT,
    param2          TEXT
);


-- ============================================================
--  4. TRANSACTIONS schema  (transactions.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions.vbak (
    order_id              TEXT PRIMARY KEY,
    kunnr                 TEXT        NOT NULL,
    status                TEXT        DEFAULT 'TEMP',
    payment_status        TEXT        DEFAULT 'PENDING',
    paid_amount           REAL        DEFAULT 0.00,
    customer_discount_pct REAL        DEFAULT 0.00,
    order_type            TEXT        DEFAULT 'S',
    original_order_id     TEXT        DEFAULT NULL,
    return_reason         TEXT        DEFAULT NULL,
    manual_discount       REAL        DEFAULT 0.00,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions.vbap (
    order_id     TEXT NOT NULL REFERENCES transactions.vbak (order_id) ON DELETE CASCADE,
    matnr        TEXT NOT NULL,
    quantity     INTEGER     NOT NULL DEFAULT 1,
    price        REAL        NOT NULL DEFAULT 0.00,
    mrp          REAL                 DEFAULT 0.00,
    discount_pct REAL                 DEFAULT 0.00,
    gst_rate     REAL                 DEFAULT 0.00,
    line_total   REAL                 DEFAULT 0.00,
    PRIMARY KEY (order_id, matnr)
);

CREATE TABLE IF NOT EXISTS transactions.return_reasons (
    id         SERIAL PRIMARY KEY,
    reason     TEXT        NOT NULL UNIQUE,
    active     INTEGER     DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions.po_header (
    po_id          TEXT PRIMARY KEY,
    buyer_id       TEXT        NOT NULL REFERENCES buyers.buyers (buyer_id),
    po_date        DATE        DEFAULT CURRENT_DATE,
    payment_terms  TEXT,
    payment_status TEXT        DEFAULT 'PENDING',
    receiver_name  TEXT,
    receiver_phone TEXT,
    receiver_email TEXT,
    receiver_gstin TEXT,
    tax_id         TEXT,
    export_id      TEXT,
    addr1          TEXT,
    addr2          TEXT,
    city           TEXT,
    state          TEXT,
    country        TEXT        DEFAULT 'India',
    zip            TEXT,
    ship_city      TEXT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions.po_items (
    po_id      TEXT    NOT NULL REFERENCES transactions.po_header (po_id) ON DELETE CASCADE,
    line_no    INTEGER NOT NULL,
    matnr      TEXT    NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    unit_price REAL    NOT NULL DEFAULT 0.00,
    line_total REAL    NOT NULL DEFAULT 0.00,
    status     TEXT    NOT NULL DEFAULT 'Created',
    PRIMARY KEY (po_id, line_no)
);


-- ============================================================
--  5. PRICING schema  (pricing.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing.gst_config (
    id           SERIAL PRIMARY KEY,
    tax_category TEXT NOT NULL UNIQUE,
    gst_rate     REAL NOT NULL DEFAULT 0.00,
    valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to     TEXT NOT NULL DEFAULT '9999-12-31'
);

CREATE TABLE IF NOT EXISTS pricing.sales_price (
    id         SERIAL PRIMARY KEY,
    matnr      TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to   DATE,
    unit_price REAL NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS pricing.customer_discount (
    id           SERIAL PRIMARY KEY,
    kunnr        TEXT NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0.00,
    valid_from   DATE NOT NULL,
    valid_to     DATE
);

CREATE TABLE IF NOT EXISTS pricing.product_discount (
    id           SERIAL PRIMARY KEY,
    matnr        TEXT NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0.00,
    valid_from   DATE NOT NULL,
    valid_to     DATE
);

-- Seed GST categories
INSERT INTO pricing.gst_config (tax_category, gst_rate, valid_from, valid_to)
VALUES
    ('Apparel',    5,  CURRENT_DATE, '9999-12-31'),
    ('Footwear',   12, CURRENT_DATE, '9999-12-31'),
    ('Accessories',18, CURRENT_DATE, '9999-12-31'),
    ('Innerwear',   5, CURRENT_DATE, '9999-12-31'),
    ('Sportswear', 12, CURRENT_DATE, '9999-12-31')
ON CONFLICT (tax_category) DO NOTHING;


-- ============================================================
--  6. HR schema  (hr.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS hr.departments (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS hr.designations (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS hr.employees (
    emp_id      TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    pan         TEXT,
    aadhar      TEXT,
    salary      REAL    DEFAULT 0,
    start_date  DATE,
    end_date    DATE,
    pay_mode    TEXT    DEFAULT 'cash',
    salary_day  INTEGER,
    department  TEXT,
    designation TEXT,
    phone       TEXT,
    address     TEXT,
    status      TEXT    DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS hr.salary_headers (
    header_id  TEXT PRIMARY KEY,
    emp_id     TEXT        NOT NULL REFERENCES hr.employees (emp_id) ON DELETE CASCADE,
    month      TEXT        NOT NULL,   -- stored as 'YYYY-MM'
    total_paid REAL        DEFAULT 0,
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (emp_id, month)
);

CREATE TABLE IF NOT EXISTS hr.salary_lines (
    line_id      TEXT PRIMARY KEY,
    header_id    TEXT NOT NULL REFERENCES hr.salary_headers (header_id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL,
    amount       REAL NOT NULL,
    pay_date     DATE NOT NULL,
    pay_mode     TEXT NOT NULL,
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS hr.attendance (
    att_id   TEXT PRIMARY KEY,
    emp_id   TEXT NOT NULL REFERENCES hr.employees (emp_id) ON DELETE CASCADE,
    att_date DATE NOT NULL,
    status   TEXT NOT NULL,
    notes    TEXT,
    UNIQUE (emp_id, att_date)
);


-- ============================================================
--  7. GROUPS schema  (groups.db)
-- ============================================================

CREATE TABLE IF NOT EXISTS groups.customer_groups (
    group_id   TEXT PRIMARY KEY,
    name       TEXT        NOT NULL,
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups.group_members (
    group_id TEXT NOT NULL REFERENCES groups.customer_groups (group_id) ON DELETE CASCADE,
    kunnr    TEXT NOT NULL REFERENCES customers.kna1 (kunnr) ON DELETE CASCADE,
    PRIMARY KEY (group_id, kunnr)
);


-- ============================================================
--  Indexes (common query patterns)
-- ============================================================

-- Customer lookups
CREATE INDEX IF NOT EXISTS idx_kna1_status    ON customers.kna1 (status);
CREATE INDEX IF NOT EXISTS idx_kna1_body_type ON customers.kna1 (body_type);
CREATE INDEX IF NOT EXISTS idx_pref_kunnr     ON customers.customer_preferences (kunnr);
CREATE INDEX IF NOT EXISTS idx_pref_brand     ON customers.customer_preferences (brand);

-- Inventory lookups
CREATE INDEX IF NOT EXISTS idx_mara_brand     ON inventory.mara (brand);
CREATE INDEX IF NOT EXISTS idx_mara_category  ON inventory.mara (category);
CREATE INDEX IF NOT EXISTS idx_mara_body_type ON inventory.mara (body_type);

-- Order lookups
CREATE INDEX IF NOT EXISTS idx_vbak_kunnr     ON transactions.vbak (kunnr);
CREATE INDEX IF NOT EXISTS idx_vbak_status    ON transactions.vbak (status);
CREATE INDEX IF NOT EXISTS idx_vbak_created   ON transactions.vbak (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vbap_matnr     ON transactions.vbap (matnr);

-- Pricing lookups
CREATE INDEX IF NOT EXISTS idx_sales_price_matnr ON pricing.sales_price (matnr, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_cust_disc_kunnr    ON pricing.customer_discount (kunnr, valid_from);

-- HR
CREATE INDEX IF NOT EXISTS idx_attendance_emp  ON hr.attendance (emp_id, att_date);
CREATE INDEX IF NOT EXISTS idx_salary_emp      ON hr.salary_headers (emp_id);

-- Groups
CREATE INDEX IF NOT EXISTS idx_group_members_kunnr ON groups.group_members (kunnr);


-- ============================================================
--  Row Level Security (enable but leave open for now —
--  tighten per table once auth is wired up)
-- ============================================================

ALTER TABLE customers.kna1                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_measurements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers.customer_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers.buyers                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.mara                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbak                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.vbap                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.return_reasons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_header            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions.po_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.gst_config                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.sales_price               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.customer_discount         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing.product_discount          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_headers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.salary_lines                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.attendance                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups.customer_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups.group_members              ENABLE ROW LEVEL SECURITY;

-- Permissive policy: allow all for authenticated users
-- Replace with fine-grained policies once roles are defined.
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('customers','buyers','inventory','transactions','pricing','hr','groups')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = tbl.schemaname
              AND tablename  = tbl.tablename
              AND policyname = 'allow_authenticated'
        ) THEN
            EXECUTE format(
                'CREATE POLICY allow_authenticated ON %I.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                tbl.schemaname, tbl.tablename
            );
        END IF;
    END LOOP;
END $$;


-- ============================================================
--  Done — 7 schemas, 31 tables, indexes, RLS enabled.
-- ============================================================
